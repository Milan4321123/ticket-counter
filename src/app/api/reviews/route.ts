import { NextResponse } from 'next/server';
import { BodyTooLargeError, readJsonLimited } from '@/lib/http';
import { verifyOrderAccessToken } from '@/lib/orders';
import { clientIp, rateLimit } from '@/lib/ratelimit';
import { deleteOwnReview, writeReview } from '@/lib/reviews';
import type { ApiErrorResponse } from '@/lib/types';

/**
 * How fast one connection may write reviews.
 *
 * Higher than the ask form's five a minute on purpose: an order with six jars
 * on it produces six separate forms on the order page, and somebody working
 * down them in one sitting is the ordinary case, not an attack. The limit is
 * here to stop a script hammering the endpoint, not to make a diligent buyer
 * wait between the third item and the fourth.
 */
const IP_LIMIT = 12;
const IP_WINDOW_MS = 60_000;

/**
 * How much writing ONE order may do, whatever address it comes from.
 *
 * The per-IP bucket above does not cover this: a buyer's emailed link can be
 * opened on a phone, a laptop and a friend's machine, and anybody the link was
 * forwarded to holds the same capability. This is the ceiling on the ORDER, so
 * a leaked link cannot be used to rewrite the same review a thousand times and
 * churn the item page's "newest first" list for everybody reading it.
 *
 * Generous enough that a real buyer never meets it: every item on the order
 * once, then plenty of second thoughts.
 */
const ORDER_LIMIT = 30;
const ORDER_WINDOW_MS = 10 * 60_000;

/**
 * There is deliberately NO global bucket here, unlike /api/events/[id]/ask and
 * the waitlist route.
 *
 * Those two write a row for an anonymous visitor, so a flood from rotating
 * spoofed IPs can fill a table without ever touching a per-IP limit, and the
 * global ceiling is what bounds it. This route writes nothing at all without
 * verifyOrderAccessToken passing, and that token is an HMAC over the order id
 * under APP_SECRET which reaches exactly one inbox. A rotating-IP flood of
 * requests carrying invented tokens costs one hash each and creates nothing —
 * so a global bucket would add no protection, and would add a way for that
 * same flood to lock genuine buyers out of reviewing.
 */

function apiError(status: number, error: string) {
  return NextResponse.json({ error } satisfies ApiErrorResponse, { status });
}

/**
 * PUBLIC: the buyer of a paid shop order rates one of the things on it.
 *
 * WHY THE EMAILED TOKEN IS THE WHOLE AUTHENTICATION, and why an order id on
 * its own would be worthless here:
 *
 * The person with the strongest motive to write a five-star review of a shop
 * is the seller who owns it, and they are the ONE person who already knows
 * every order id it has ever taken — /portal/events/<id>/orders lists them, by
 * design, because they have to reconcile payments against them. If "name a
 * paid order for this shop" were the test, a seller could sign into their own
 * portal, copy their buyers' order ids out of a page built for them, and post
 * a perfect score for every item they sell. The reviews would be verified, in
 * the sense that every one of them would sit on a real paid order, and they
 * would also all be written by the seller.
 *
 * verifyOrderAccessToken asks a different question: not "do you know which
 * order this is" but "can you read the mailbox that order was sent to". The
 * token is an HMAC of the order id under APP_SECRET (lib/orders.ts), it is
 * never rendered in the portal, never rendered on the public order page, and
 * the seller cannot compute one — the secret is the deployment's, not theirs.
 * It travels down exactly one road: the link in the mail addressed to
 * orders.buyer_email. So a portal session, which proves ownership of the shop,
 * buys nothing on this route, and that is the point.
 *
 * The token proves WHO is speaking. What they may speak ABOUT — the order is
 * paid, it is a shop, that item is genuinely on it, the rating is 1..5 — is
 * re-checked inside writeReview against the database on every call, so this
 * route cannot weaken those rules by forgetting one.
 */
export async function POST(req: Request) {
  try {
    // Before the body is even read: an unauthenticated caller should not be
    // able to make the server parse JSON for it at whatever rate it likes.
    if (!rateLimit(`reviews:ip:${clientIp(req)}`, IP_LIMIT, IP_WINDOW_MS)) {
      return apiError(429, 'That is a lot of reviews at once — please wait a minute and try again.');
    }

    let raw: unknown;
    try {
      raw = await readJsonLimited(req);
    } catch (e) {
      if (e instanceof BodyTooLargeError) {
        return apiError(413, 'That request was too large.');
      }
      return apiError(400, 'That review could not be read — please reload the page and try again.');
    }

    const body = (raw ?? {}) as {
      orderId?: unknown;
      token?: unknown;
      tierKey?: unknown;
      rating?: unknown;
      body?: unknown;
      website?: unknown;
    };

    const orderId = typeof body.orderId === 'string' ? body.orderId.trim() : '';
    const token = typeof body.token === 'string' ? body.token : '';
    const tierKey = typeof body.tierKey === 'string' ? body.tierKey.trim() : '';
    if (!orderId || !tierKey) {
      // Nothing a buyer can act on beyond starting again from the mail: both
      // fields are put there by the page, so their absence means the form was
      // hand-made or the page was opened from a mangled URL.
      return apiError(
        400,
        'That form is missing something — please open your order again from the link in your email.'
      );
    }

    // Honeypot: a field no person can see and a form-filling bot fills in
    // anyway. Answered as though it had worked, exactly like the ask form, so
    // a scraper learns nothing from the difference — nothing is written.
    //
    // Belt and braces on this route rather than the main defence: a bot that
    // got this far already had a valid-looking token, and the check below is
    // what actually decides. It costs one comparison and it catches the dumb
    // half of anything that ever gets hold of a forwarded link.
    if (typeof body.website === 'string' && body.website.trim() !== '') {
      return NextResponse.json({ ok: true, authorName: '', status: 'published' });
    }

    // The one gate. Note that this touches no database at all — it recomputes
    // an HMAC over the id it was handed — so a token for an order that does
    // not exist is refused in exactly the same way, with the same timing, as a
    // wrong token for an order that does. Nobody can use this endpoint to find
    // out which order ids are real.
    if (!verifyOrderAccessToken(orderId, token)) {
      return apiError(
        403,
        'Reviews can only be written from the link in your order confirmation email — please open your order from there and try again.'
      );
    }

    // Consumed only now that the caller has proved the mailbox. Counting
    // strikes against the ORDER before the token was checked would let anybody
    // who guessed an order id spend that order's whole allowance and leave its
    // real buyer unable to write a word.
    if (!rateLimit(`reviews:order:${orderId}`, ORDER_LIMIT, ORDER_WINDOW_MS)) {
      return apiError(429, 'That is a lot of changes at once — please wait a few minutes and try again.');
    }

    const rating = typeof body.rating === 'number' ? body.rating : NaN;
    if (!Number.isInteger(rating)) {
      // The same sentence writeReview uses for a rating out of range, because
      // to the person reading it "I sent no stars" and "I sent seven" are the
      // same mistake and deserve the same instruction.
      return apiError(400, 'Please choose between one and five stars.');
    }

    const text = typeof body.body === 'string' ? body.body : '';

    try {
      const review = writeReview({ orderId, tierKey, rating, body: text });
      // What comes back is deliberately not the whole row: it carries the
      // order id, which lib/reviews calls a capability and which no response
      // needs to repeat to somebody who already sent it.
      //
      // authorName is echoed because the panel promises the buyer their review
      // will be signed "First L." and this is the byline that was actually
      // stored — the promise and the fact come from the same place.
      //
      // status is echoed because a review the platform has hidden STAYS hidden
      // when its author edits it (writeReview leaves the column alone on
      // purpose). Without this the form would tell somebody their words are
      // back on the shop page when they are not.
      return NextResponse.json({ ok: true, authorName: review.authorName, status: review.status });
    } catch (e) {
      // writeReview refuses with a plain Error whose message is already
      // written for a buyer to read — "That item is not on this order.", not a
      // constraint name. Anything else that comes out of here is a bug or a
      // database fault, and its message is for the log, never for the screen:
      // better-sqlite3 raises SqliteError and a programming slip raises
      // TypeError, so the constructor's own name is what tells them apart.
      if (e instanceof Error && e.name === 'Error') {
        return apiError(400, e.message);
      }
      throw e;
    }
  } catch (e) {
    console.error('POST /api/reviews failed:', e);
    return apiError(500, 'Something went wrong. Please try again.');
  }
}

/**
 * PUBLIC: the buyer takes back their own review of one item (Art. 17 GDPR).
 *
 * Exactly the same door as POST above — the token from the buyer's own email
 * is the whole authentication, for the same reason: the seller knows every
 * order id, and must not be able to delete the reviews of their goods by
 * naming them. What "taking back" means (delete, or empty a hidden row so it
 * cannot be used to dodge moderation) is lib/reviews' deleteOwnReview.
 */
export async function DELETE(req: Request) {
  try {
    if (!rateLimit(`reviews:ip:${clientIp(req)}`, IP_LIMIT, IP_WINDOW_MS)) {
      return apiError(429, 'That is a lot of changes at once — please wait a minute and try again.');
    }
    let raw: unknown;
    try {
      raw = await readJsonLimited(req);
    } catch (e) {
      if (e instanceof BodyTooLargeError) return apiError(413, 'That request was too large.');
      return apiError(400, 'That request could not be read — please reload the page and try again.');
    }
    const body = (raw ?? {}) as { orderId?: unknown; token?: unknown; tierKey?: unknown };
    const orderId = typeof body.orderId === 'string' ? body.orderId.trim() : '';
    const token = typeof body.token === 'string' ? body.token : '';
    const tierKey = typeof body.tierKey === 'string' ? body.tierKey.trim() : '';
    if (!orderId || !tierKey) {
      return apiError(400, 'That form is missing something — please open your order again from the link in your email.');
    }
    if (!verifyOrderAccessToken(orderId, token)) {
      return apiError(
        403,
        'Reviews can only be changed from the link in your order confirmation email — please open your order from there and try again.'
      );
    }
    if (!rateLimit(`reviews:order:${orderId}`, ORDER_LIMIT, ORDER_WINDOW_MS)) {
      return apiError(429, 'That is a lot of changes at once — please wait a few minutes and try again.');
    }
    const outcome = deleteOwnReview(orderId, tierKey);
    return NextResponse.json({ ok: true, outcome });
  } catch (e) {
    console.error('DELETE /api/reviews failed:', e);
    return apiError(500, 'Something went wrong. Please try again.');
  }
}
