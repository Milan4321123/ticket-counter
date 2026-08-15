import { NextResponse } from 'next/server';
import { setEventFaqs } from '@/lib/events';
import { readJsonLimited, BodyTooLargeError } from '@/lib/http';
import type { ApiErrorResponse } from '@/lib/types';
import { planGate, requireOrganizerApi, requireOwnedEvent } from '../../../auth';

const MAX_FAQS = 12;
const MAX_QUESTION = 200;
const MAX_ANSWER = 1000;

/** Friendly validation failure — message goes straight to the UI. */
class ValidationError extends Error {}

function need(cond: boolean, message: string): asserts cond {
  if (!cond) throw new ValidationError(message);
}

/**
 * Replace the event's FAQ list wholesale (the portal editor always saves the
 * full list). Same guard chain as every other portal event route: signed-in
 * organizer, active plan, owns the event, event not archived.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const auth = await requireOrganizerApi();
    if (auth.failure) return auth.failure;
    const { organizer } = auth;

    const blocked = planGate(organizer);
    if (blocked) return blocked;

    const owned = requireOwnedEvent(organizer, id);
    if (owned.failure) return owned.failure;
    const { event } = owned;

    need(
      event.status !== 'archived',
      'This event has been archived by the platform and can no longer be changed.'
    );

    let body: Record<string, unknown>;
    try {
      const parsed = await readJsonLimited(req, 64 * 1024);
      need(Boolean(parsed) && typeof parsed === 'object' && !Array.isArray(parsed), 'Nothing to save.');
      body = parsed as Record<string, unknown>;
    } catch (e) {
      if (e instanceof BodyTooLargeError) {
        return NextResponse.json({ error: 'That request was too large.' } satisfies ApiErrorResponse, { status: 413 });
      }
      if (e instanceof ValidationError) throw e;
      return NextResponse.json({ error: 'Nothing to save.' } satisfies ApiErrorResponse, { status: 400 });
    }

    need(Array.isArray(body.faqs), 'Invalid FAQ list.');
    const rows = body.faqs as unknown[];
    need(rows.length <= MAX_FAQS, `An event can have at most ${MAX_FAQS} FAQ entries.`);

    const clean: { question: string; answer: string }[] = [];
    for (const raw of rows) {
      need(Boolean(raw) && typeof raw === 'object', 'Invalid FAQ entry.');
      const r = raw as Record<string, unknown>;
      need(typeof r.question === 'string' && typeof r.answer === 'string', 'Invalid FAQ entry.');
      const question = r.question.trim();
      const answer = r.answer.trim();
      need(question.length > 0, 'Every FAQ needs a question.');
      need(answer.length > 0, `The question “${question.slice(0, 60)}” still needs an answer.`);
      need(question.length <= MAX_QUESTION, `Questions can be at most ${MAX_QUESTION} characters.`);
      need(answer.length <= MAX_ANSWER, `Answers can be at most ${MAX_ANSWER} characters.`);
      clean.push({ question, answer });
    }

    const faqs = setEventFaqs(event.id, clean);
    return NextResponse.json({
      ok: true,
      faqs: faqs.map((f) => ({ id: f.id, question: f.question, answer: f.answer })),
    });
  } catch (e) {
    if (e instanceof ValidationError) {
      return NextResponse.json({ error: e.message } satisfies ApiErrorResponse, { status: 400 });
    }
    console.error(`POST /api/portal/events/${id}/faqs failed:`, e);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' } satisfies ApiErrorResponse,
      { status: 500 }
    );
  }
}
