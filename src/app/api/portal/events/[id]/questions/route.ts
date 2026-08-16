import { NextResponse } from 'next/server';
import {
  answerEventQuestion,
  dismissEventQuestion,
  getEventQuestion,
  markQuestionAnswerEmailed,
} from '@/lib/events';
import { sendQuestionAnsweredEmail } from '@/lib/email';
import type { EventRow } from '@/lib/events';
import { BodyTooLargeError, readJsonLimited } from '@/lib/http';
import type { ApiErrorResponse } from '@/lib/types';
import { planGate, requireOrganizerApi, requireOwnedEvent } from '../../../auth';

const MAX_ANSWER = 1000;

/** Friendly validation failure — message goes straight to the UI. */
class ValidationError extends Error {}

function need(cond: boolean, message: string): asserts cond {
  if (!cond) throw new ValidationError(message);
}

/**
 * Same guard chain as every other portal event route: signed-in organizer,
 * active plan, owns the event, event not archived.
 */
async function guardedEvent(
  id: string
): Promise<{ event: EventRow; failure: null } | { event: null; failure: NextResponse }> {
  const auth = await requireOrganizerApi();
  if (auth.failure) return { event: null, failure: auth.failure };
  const { organizer } = auth;

  const blocked = planGate(organizer);
  if (blocked) return { event: null, failure: blocked };

  const owned = requireOwnedEvent(organizer, id);
  if (owned.failure) return { event: null, failure: owned.failure };

  need(
    owned.event.status !== 'archived',
    'This event has been archived by the platform and can no longer be changed.'
  );
  return { event: owned.event, failure: null };
}

/**
 * Handle one visitor question: publish an answer ({questionId, answer}) so it
 * appears on the event page and teaches the assistant, or dismiss it
 * ({questionId, dismiss: true}).
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const guarded = await guardedEvent(id);
    if (guarded.failure) return guarded.failure;
    const { event } = guarded;

    let body: Record<string, unknown>;
    try {
      const parsed = await readJsonLimited(req, 64 * 1024);
      need(Boolean(parsed) && typeof parsed === 'object' && !Array.isArray(parsed), 'Nothing to save.');
      body = parsed as Record<string, unknown>;
    } catch (e) {
      if (e instanceof BodyTooLargeError || e instanceof ValidationError) throw e;
      throw new ValidationError('Nothing to save.');
    }

    need(typeof body.questionId === 'string' && body.questionId.length > 0, 'Which question is this about?');

    if (body.dismiss === true) {
      const dismissed = dismissEventQuestion(event.id, body.questionId);
      if (!dismissed) {
        return NextResponse.json(
          { error: 'That question is no longer open.' } satisfies ApiErrorResponse,
          { status: 404 }
        );
      }
      return NextResponse.json({ ok: true });
    }

    need(typeof body.answer === 'string', 'The answer text is missing.');
    const answer = body.answer.trim();
    need(answer.length > 0, 'Write an answer first — it is empty.');
    need(answer.length <= MAX_ANSWER, `Answers can be at most ${MAX_ANSWER} characters.`);

    const answered = answerEventQuestion(event.id, body.questionId, answer);
    if (!answered) {
      return NextResponse.json(
        { error: 'That question no longer exists.' } satisfies ApiErrorResponse,
        { status: 404 }
      );
    }

    // Send the answer to whoever asked, when they left an address.
    //
    // Awaited rather than fired and forgotten, because the organizer is told
    // what happened: "we emailed them" is a promise, and a silent failure would
    // leave them believing someone was told when nobody was. The answer is
    // already saved by this point, so a failed send costs the email, never the
    // answer itself.
    let emailed: boolean | null = null;
    const asked = getEventQuestion(event.id, body.questionId);
    if (asked?.askerEmail && !asked.askerErasedAt) {
      const result = await sendQuestionAnsweredEmail(asked);
      emailed = result.sent;
      if (result.sent) markQuestionAnswerEmailed(asked.id);
    }
    return NextResponse.json({ ok: true, emailed });
  } catch (e) {
    if (e instanceof BodyTooLargeError) {
      return NextResponse.json({ error: 'That request was too large.' } satisfies ApiErrorResponse, { status: 413 });
    }
    if (e instanceof ValidationError) {
      return NextResponse.json({ error: e.message } satisfies ApiErrorResponse, { status: 400 });
    }
    console.error(`POST /api/portal/events/${id}/questions failed:`, e);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' } satisfies ApiErrorResponse,
      { status: 500 }
    );
  }
}
