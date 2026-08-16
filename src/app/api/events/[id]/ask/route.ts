import { NextResponse } from 'next/server';
import { answerVisitorQuestion, type AssistantContext } from '@/lib/ai';
import {
  createEventQuestion,
  getEventById,
  getEventFaqs,
  getEventTiers,
  listEventPosts,
  listEventQuestions,
} from '@/lib/events';
import { BodyTooLargeError, readJsonLimited } from '@/lib/http';
import { getAvailability } from '@/lib/inventory';
import { formatMoney } from '@/lib/money';
import { clientIp, rateLimit } from '@/lib/ratelimit';
import type { ApiErrorResponse } from '@/lib/types';

const MIN_QUESTION = 3;
const MAX_QUESTION = 500;
const MAX_NAME = 80;
const MAX_EMAIL = 160;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Limits on the ESCALATION path specifically — the one that writes a row.
 *
 * The per-IP limit above this is not enough on its own: it is per IP, and the
 * global bucket that would catch a rotating-IP flood is consumed further down,
 * AFTER the escalation branch has already written to the database. So a
 * distributed bot could create rows without ever touching a global limit.
 *
 * Three ceilings, each closing a different hole:
 *   - a global one, so a rotating-IP flood is bounded platform-wide;
 *   - a per-event one, so a single organizer's inbox cannot be buried even by
 *     traffic that is under the global limit;
 *   - a per-address one, so this form cannot be used to make somebody else's
 *     inbox receive a stream of answers they never asked for.
 */
const ESCALATE_GLOBAL_LIMIT = 60;
const ESCALATE_EVENT_LIMIT = 10;
const ESCALATE_EMAIL_LIMIT = 3;
const ESCALATE_WINDOW_MS = 10 * 60_000;
/**
 * Hard ceiling on unanswered questions per event. Rate limits bound the SPEED
 * of writes; nothing bounded the total, so a patient script could grow one
 * event's queue without limit. Past this, asking is refused until the organizer
 * works through what is already there.
 */
const MAX_OPEN_QUESTIONS = 200;
/** How much organizer content the assistant sees (keeps the prompt small). */
const MAX_POSTS = 5;
const MAX_POST_CHARS = 300;
const MAX_ANSWERED = 10;

function apiError(status: number, error: string) {
  return NextResponse.json({ error } satisfies ApiErrorResponse, { status });
}

/**
 * PUBLIC: a visitor asks a question on an event page. The AI answers straight
 * from the organizer's own content when it can; anything else is saved as an
 * open question for the organizer to answer in the portal.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    // Per-IP first so one curious visitor can't spam; the global bucket below
    // is the backstop against spoofed-IP floods (it is only consumed AFTER
    // validation so garbage requests cannot exhaust it for real visitors).
    if (!rateLimit(`ask:${clientIp(req)}`, 5, 60_000)) {
      return apiError(429, 'That is a lot of questions at once — please wait a minute and ask again.');
    }

    let raw: unknown;
    try {
      raw = await readJsonLimited(req);
    } catch (e) {
      if (e instanceof BodyTooLargeError) {
        return apiError(413, 'That request was too large.');
      }
      return apiError(400, 'Please type a question first.');
    }

    const question =
      raw && typeof raw === 'object' && typeof (raw as { question?: unknown }).question === 'string'
        ? (raw as { question: string }).question.trim()
        : '';
    if (question.length < MIN_QUESTION) {
      return apiError(400, 'Please type a question first (at least a few characters).');
    }
    if (question.length > MAX_QUESTION) {
      return apiError(400, `Questions can be at most ${MAX_QUESTION} characters — please shorten yours a little.`);
    }

    // Only published events take questions; drafts/archived look like 404s.
    const event = getEventById(id);
    if (!event || event.status !== 'published') {
      return apiError(404, 'We could not find that event — it may no longer be available.');
    }

    // The visitor asked us to pass this one to a human. Costs no AI call, so it
    // is handled before the assistant's own rate limit — but it writes a row, so
    // it keeps the per-IP limit above it.
    const wantsEscalation = raw && typeof raw === 'object' && (raw as { escalate?: unknown }).escalate === true;
    if (wantsEscalation) {
      const body = raw as {
        askerName?: unknown;
        askerEmail?: unknown;
        privacyAck?: unknown;
        website?: unknown;
      };

      // Honeypot: a field positioned off-screen that a person never sees and a
      // form-filling bot cannot resist. Answered with the same cheerful message
      // as a real submission so a scraper learns nothing from the difference,
      // but nothing is written.
      if (typeof body.website === 'string' && body.website.trim() !== '') {
        return NextResponse.json({
          kind: 'escalated',
          message: 'Sent to the organizer — they will answer it on this page. Thanks for asking!',
          willEmail: false,
        });
      }

      if (
        !rateLimit('ask:escalate:all', ESCALATE_GLOBAL_LIMIT, ESCALATE_WINDOW_MS) ||
        !rateLimit(`ask:escalate:event:${id}`, ESCALATE_EVENT_LIMIT, ESCALATE_WINDOW_MS)
      ) {
        return apiError(429, 'A lot of questions have just come in — please try again in a few minutes.');
      }

      if (listEventQuestions(event.id, 'open').length >= MAX_OPEN_QUESTIONS) {
        return apiError(
          429,
          'The organizer has a lot of unanswered questions right now. Please try again in a day or two.'
        );
      }
      const askerName = typeof body.askerName === 'string' ? body.askerName.trim().slice(0, MAX_NAME) : '';
      const askerEmail = typeof body.askerEmail === 'string' ? body.askerEmail.trim().slice(0, MAX_EMAIL) : '';

      // An address is OPTIONAL — asking anonymously stays a real choice, and
      // the question is answered on the page either way. But the moment one is
      // given this stops being an anonymous question and becomes personal data,
      // so it must be valid and it must be consented to. The tick is checked
      // here and not only in the browser: a form is not a security boundary.
      if (askerEmail) {
        if (!EMAIL_RE.test(askerEmail)) {
          return apiError(400, 'That email address does not look right — please check it.');
        }
        if (body.privacyAck !== true) {
          return apiError(400, 'Please tick the box to confirm we may use your email to send you the answer.');
        }
        // Nobody else's inbox becomes a target through this form.
        if (!rateLimit(`ask:escalate:email:${askerEmail}`, ESCALATE_EMAIL_LIMIT, ESCALATE_WINDOW_MS)) {
          return apiError(
            429,
            'That email address has already asked a few questions — please wait a little before asking again.'
          );
        }
      }

      createEventQuestion(event.id, question.slice(0, MAX_QUESTION), {
        name: askerName,
        email: askerEmail,
      });
      return NextResponse.json({
        kind: 'escalated',
        message: askerEmail
          ? 'Sent to the organizer. They will answer it on this page, and we will email you their answer.'
          : 'Sent to the organizer — they will answer it on this page. Thanks for asking!',
        willEmail: Boolean(askerEmail),
      });
    }

    if (!rateLimit('ask:all', 60, 60_000)) {
      return apiError(429, 'The assistant is very busy right now — please try again in a minute.');
    }

    // Everything the assistant is allowed to know: the organizer's own
    // event content, nothing else.
    const availability = getAvailability(event.id);
    const ctx: AssistantContext = {
      eventName: event.name,
      artist: event.artist,
      description: event.description,
      dateDisplay: event.dateDisplay,
      venueName: event.venueName,
      address: event.address,
      city: event.city,
      payWithinDays: event.payWithinDays,
      tiers: getEventTiers(event.id).map((t) => ({
        name: t.name,
        priceDisplay: formatMoney(t.priceCents, event.currency),
        studentOnly: t.studentOnly,
        description: t.description,
        soldOut: (availability.tiers[t.tierKey]?.remaining ?? 0) === 0,
      })),
      faqs: getEventFaqs(event.id).map((f) => ({ question: f.question, answer: f.answer })),
      posts: listEventPosts(event.id)
        .slice(0, MAX_POSTS)
        .map((p) => p.body.slice(0, MAX_POST_CHARS)),
      answeredQuestions: listEventQuestions(event.id, 'answered')
        .slice(0, MAX_ANSWERED)
        .map((q) => ({ question: q.question, answer: q.answer ?? '' })),
      // Written by the organizer in the portal; trimmed to size inside lib/ai.
      organizerNotes: event.assistantContext,
    };

    const result = await answerVisitorQuestion(ctx, question);
    if (result.kind === 'answered') {
      return NextResponse.json({ kind: 'answered', answer: result.answer });
    }

    // Not a question at all. Saving it would put "sdfdsf" in the organizer's
    // to-do list — the queue fills with keyboard mash and the real questions get
    // lost in it. Ask for a rephrase and record nothing.
    if (result.kind === 'unclear') {
      return NextResponse.json({
        kind: 'unclear',
        message:
          'Sorry — I did not catch that. Try asking something like "what time do doors open?" or "how much are tickets?"',
      });
    }

    // Couldn't answer it. Nothing is saved YET: passing it to the organizer is
    // the visitor's call, not ours. Auto-filing every miss buried the real
    // questions under keyboard mash and idle curiosity, and told the visitor a
    // human was on it when they may not have wanted one. The client shows a
    // "send this to the organizer" link, which comes back here with escalate.
    return NextResponse.json({
      kind: 'unanswered',
      message: 'I could not find that in the event details.',
      canEscalate: true,
    });
  } catch (e) {
    console.error(`POST /api/events/${id}/ask failed:`, e);
    return apiError(500, 'Something went wrong. Please try again.');
  }
}
