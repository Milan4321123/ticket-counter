import { NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/auth';
import { BodyTooLargeError, readJsonLimited } from '@/lib/http';
import { MAX_REVIEW_CHARS, setReviewStatus } from '@/lib/reviews';
import type { ApiErrorResponse } from '@/lib/types';

// Taking a review down, and putting it back up. The platform's power over a
// review and nobody else's — which is the entire reason reviews are worth
// reading. A seller who could bury a bad one would be publishing an
// advertisement with stars on it, so /api/portal/reviews next door can only
// ever write a reply, and this route lives behind the admin session that the
// seller does not have.
//
// Hiding takes a REASON and this route refuses without one. lib/reviews would
// accept an empty string quite happily; the rule lives here because this is
// where a human is making the decision, and a moderation decision nobody wrote
// down is one nobody can defend three months later when the seller asks why
// their five-star review vanished. The reason is kept on the row and is what
// both sides are told if either asks.
//
// Nothing is ever deleted. A hidden review still holds its place as that
// order's one review, so a buyer cannot slip a second one past the table's
// UNIQUE by being moderated, and a decision that turns out to be wrong is
// undone by publishing the row again rather than by recovering it.
//
// Like the portal route, it answers both a plain form post from /admin/reviews
// (a 303 back to the page with a short code in ?note=) and JSON from anything
// scripted. The moderation page is a list of long paragraphs with a control
// under each; a form that posts and comes back is the version that keeps
// working when the owner is moderating from a phone on a train.

/** How much of a submission is read before it is refused. A reason is short. */
const MAX_BODY_BYTES = 16 * 1024;

/**
 * How long a written reason may be. The same ceiling a review itself gets:
 * the reason is answering one, so it has no business being longer than one.
 */
const MAX_REASON_CHARS = MAX_REVIEW_CHARS;

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
 * The JSON half streams through readJsonLimited, which counts bytes as they
 * arrive and aborts mid-read — the only safe way to bound a body whose
 * Content-Length may be missing or a lie. The form half is bounded by that
 * header instead, which is sound in this one narrow case: a submission with no
 * Content-Length is refused here, and one that declares a length is held to it
 * by Node's own HTTP parser, which stops reading the body at exactly that many
 * bytes. Browsers always send it for a urlencoded form post.
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
 * internal one. The owner would be redirected to localhost. A relative
 * Location is legal (RFC 7231 §7.1.2) and every browser resolves it against
 * the address it actually typed.
 */
function seeOther(path: string): NextResponse {
  return new NextResponse(null, { status: 303, headers: { Location: path } });
}

/**
 * The single exit: one outcome described once, rendered as whichever shape the
 * caller can read. A branch that answered a form post with JSON would leave the
 * owner staring at `{"error":...}` where the moderation list used to be.
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
  // Back to the row that was just acted on: moderating the fortieth review in
  // the list and being returned to the first one is how the same row gets
  // hidden twice.
  const fragment = outcome.reviewId ? `#r-${encodeURIComponent(outcome.reviewId)}` : '';
  return seeOther(`/admin/reviews?${query}${fragment}`);
}

/**
 * Hide one review, or publish it again.
 *
 * Body: `{ reviewId, status, reason }` — as JSON, or as the fields of a form.
 * `status` is 'hidden' or 'published'; `reason` is required to hide and is
 * ignored (and cleared on the row) when publishing, because a live review
 * carrying an old "hidden because…" note reads as a warning about a review
 * that is in fact perfectly fine.
 */
export async function POST(req: Request) {
  const fromForm = isFormSubmission(req);
  try {
    if (!(await isAdminRequest())) {
      // A signed-out form post is a session that expired while the list sat
      // open in a tab. Sending them to sign in gets them back to the decision
      // they were making.
      return fromForm
        ? seeOther('/admin/login')
        : NextResponse.json(
            { error: 'Please sign in to the admin area first.' } satisfies ApiErrorResponse,
            { status: 401 }
          );
    }

    const fields = await readFields(req, fromForm);

    const reviewId = (fields.reviewId ?? '').trim();
    if (!reviewId) throw new ValidationError('Which review?', 'invalid');

    const status = (fields.status ?? '').trim();
    if (status !== 'hidden' && status !== 'published') {
      throw new ValidationError('Hide it or publish it — nothing else.', 'invalid');
    }

    const reason = (fields.reason ?? '').trim();
    if (status === 'hidden' && !reason) {
      throw new ValidationError('Write down why it is coming down.', 'noreason');
    }
    if (reason.length > MAX_REASON_CHARS) {
      throw new ValidationError(`Keep the reason under ${MAX_REASON_CHARS} characters.`, 'toolong');
    }

    if (!setReviewStatus(reviewId, status, reason)) {
      return answer(fromForm, {
        status: 404,
        code: 'notfound',
        message: 'We could not find that review.',
      });
    }

    return answer(fromForm, {
      status: 200,
      code: status === 'hidden' ? 'hidden' : 'shown',
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
    console.error('POST /api/admin/reviews failed:', e);
    return answer(fromForm, {
      status: 500,
      code: 'failed',
      message: 'Something went wrong. Please try again.',
    });
  }
}
