import { NextResponse } from 'next/server';
import { BodyTooLargeError, readJsonLimited } from '@/lib/http';
import { MAX_REVIEW_CHARS, setSellerReply } from '@/lib/reviews';
import type { ApiErrorResponse } from '@/lib/types';
import { planGate, requireOrganizerApi } from '../auth';

// The seller's answer to a review of their own goods — the ONLY thing a seller
// may do to a review, and the whole reason this route is separate from the
// admin one next door. Hiding lives behind the admin session; nothing here can
// reach it, and setSellerReply() cannot express it even if this route tried.
//
// Ownership is not checked here at all, on purpose. setSellerReply() folds the
// organizer id into the UPDATE's own WHERE clause, so a reviewId belonging to
// somebody else's shop matches no row and comes back false — there is no
// window between a "do they own it?" read and the write, and no way for a
// future caller to forget the first half. What this route does with the false
// is the interesting part: a 404, indistinguishable from a review that does
// not exist, exactly like requireOwnedEvent() answers for an event. Telling a
// seller "that review is real, it just is not yours" would turn this route
// into a way of enumerating other people's reviews.
//
// It answers two kinds of caller, which is unusual for this codebase and worth
// the paragraph. /portal/reviews submits a PLAIN HTML FORM: the reply box has
// to work on a seller's phone with a flaky connection and no patience for
// JavaScript, and a <form> that posts and comes back is the version that
// cannot half-fail. A form post wants a redirect, not a page of JSON, so
// answer() below turns every outcome into one of two shapes — 303 back to the
// page with a short code in ?note= for a form, JSON for anything sending JSON.
// The codes are a closed set the page knows by heart rather than a message
// passed through the URL, because a message in a query string is a sentence
// any stranger can put on our page by sending somebody a link.

/**
 * How much of a submission is read before it is refused.
 *
 * A reply is capped at MAX_REVIEW_CHARS of text, so 16 KB is already generous
 * enough to hold one written entirely in four-byte characters plus its form
 * encoding, and small enough that a flood of them costs nothing.
 */
const MAX_BODY_BYTES = 16 * 1024;

/** Friendly validation failure. `code` is what the page will read from ?note=. */
class ValidationError extends Error {
  constructor(
    message: string,
    readonly code: string
  ) {
    super(message);
  }
}

/** True when a browser posted a form rather than a script posting JSON. */
function isFormSubmission(req: Request): boolean {
  const type = (req.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  return type === 'application/x-www-form-urlencoded';
}

/**
 * The submitted fields, whichever way they arrived, as plain strings.
 *
 * The JSON half goes through readJsonLimited, which counts the bytes as they
 * stream in and aborts mid-read — the only safe way to bound a body whose
 * Content-Length may be absent or a lie.
 *
 * The form half is bounded by the header instead, and that is sound for this
 * one narrow case rather than a general shortcut: a request with no
 * Content-Length is refused outright here, and a request that declares one is
 * held to it by Node's own HTTP parser, which stops reading the body at
 * exactly that many bytes. So the two ways of lying — omit the header, or
 * understate it — are covered by a refusal and by the parser respectively.
 * Every browser sends Content-Length on a urlencoded form post.
 */
async function readFields(req: Request, fromForm: boolean): Promise<Record<string, string>> {
  const out: Record<string, string> = {};

  if (fromForm) {
    const declared = Number(req.headers.get('content-length') ?? '');
    if (!Number.isFinite(declared) || declared <= 0) {
      throw new ValidationError('Nothing to save.', 'invalid');
    }
    if (declared > MAX_BODY_BYTES) throw new BodyTooLargeError();
    for (const [key, value] of new URLSearchParams(await req.text())) out[key] = value;
    return out;
  }

  let parsed: unknown;
  try {
    parsed = await readJsonLimited(req, MAX_BODY_BYTES);
  } catch (e) {
    // A body that is too large is a different answer from a body that is not
    // JSON, and only the first one deserves a 413.
    if (e instanceof BodyTooLargeError) throw e;
    throw new ValidationError('Nothing to save.', 'invalid');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new ValidationError('Nothing to save.', 'invalid');
  }
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof value === 'string') out[key] = value;
  }
  return out;
}

/**
 * Send the browser back to a page of this site after a form post.
 *
 * The Location is RELATIVE, and not because it is shorter. NextResponse
 * .redirect() insists on an absolute URL, which from inside a route handler
 * means building one out of req.url — and req.url carries whatever host the
 * request arrived on at THIS process, which behind a reverse proxy is the
 * internal one. A seller would be redirected to localhost. A relative Location
 * is legal (RFC 7231 §7.1.2) and every browser resolves it against the address
 * it actually typed, which is the one that is correct and the one this process
 * cannot see.
 */
function seeOther(path: string): NextResponse {
  return new NextResponse(null, { status: 303, headers: { Location: path } });
}

/**
 * The single exit. Every outcome — good and bad — is described once as a
 * status, a code and a sentence, and turned into whichever shape the caller
 * can read.
 *
 * Keeping this in one function is what stops the two callers drifting apart:
 * a branch that returned JSON to a form post would leave a seller staring at
 * `{"error":...}` where their page used to be, and that is precisely the bug
 * a route with a dozen return statements grows within a month.
 */
function answer(
  fromForm: boolean,
  outcome: { status: number; code: string; message: string; reviewId?: string }
): NextResponse {
  if (!fromForm) {
    return outcome.status === 200
      ? NextResponse.json({ ok: true })
      : NextResponse.json({ error: outcome.message } satisfies ApiErrorResponse, { status: outcome.status });
  }

  const query = new URLSearchParams({ note: outcome.code });
  // Back to the review they were answering rather than to the top of a long
  // list — on a phone the reply they just posted would otherwise land several
  // screens below where the page opens.
  const fragment = outcome.reviewId ? `#r-${encodeURIComponent(outcome.reviewId)}` : '';
  return seeOther(`/portal/reviews?${query}${fragment}`);
}

/**
 * Post, change or take down the seller's reply to one review.
 *
 * Body: `{ reviewId, reply }` — as JSON, or as the two fields of a form.
 * An EMPTY reply retracts: a seller may take their own words back down, which
 * is the one deletion anybody is allowed anywhere near a review.
 */
export async function POST(req: Request) {
  const fromForm = isFormSubmission(req);
  try {
    const auth = await requireOrganizerApi();
    if (auth.failure) {
      // A signed-out form post is a session that expired while the page sat
      // open. Sending them to sign in gets them back to their reply; handing
      // them a 401 in JSON would just look broken.
      return fromForm ? seeOther('/portal/login') : auth.failure;
    }
    const { organizer } = auth;

    // Replying is a change to a public page, so it follows the same rule as
    // every other portal write: an account the platform has switched off makes
    // none. Their shops and their existing replies stay exactly as they are.
    const blocked = planGate(organizer);
    if (blocked) {
      return fromForm ? answer(true, { status: 403, code: 'off', message: '' }) : blocked;
    }

    const fields = await readFields(req, fromForm);

    const reviewId = (fields.reviewId ?? '').trim();
    if (!reviewId) throw new ValidationError('Which review?', 'invalid');

    const reply = (fields.reply ?? '').trim();
    if (reply.length > MAX_REVIEW_CHARS) {
      // Refused rather than quietly cut. setSellerReply() would slice it at
      // the same ceiling and save the front of it, and a seller whose last
      // sentence disappeared without anybody saying so would reasonably think
      // the whole thing had saved.
      throw new ValidationError(`Please keep your reply under ${MAX_REVIEW_CHARS} characters.`, 'toolong');
    }

    if (!setSellerReply(reviewId, organizer.id, reply)) {
      return answer(fromForm, {
        status: 404,
        code: 'notfound',
        message: 'We could not find that review.',
      });
    }

    return answer(fromForm, {
      status: 200,
      code: reply ? 'replied' : 'cleared',
      message: '',
      reviewId,
    });
  } catch (e) {
    if (e instanceof ValidationError) {
      return answer(fromForm, { status: 400, code: e.code, message: e.message });
    }
    if (e instanceof BodyTooLargeError) {
      return answer(fromForm, {
        status: 413,
        code: 'toolong',
        message: 'That request was too large.',
      });
    }
    console.error('POST /api/portal/reviews failed:', e);
    return answer(fromForm, {
      status: 500,
      code: 'failed',
      message: 'Something went wrong. Please try again.',
    });
  }
}
