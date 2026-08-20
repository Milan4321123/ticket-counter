import { NextResponse } from 'next/server';
import { getEventById } from '@/lib/events';
import { BodyTooLargeError, readJsonLimited } from '@/lib/http';
import { getPaidOrderByReferralCode } from '@/lib/orders';
import { getOrganizer } from '@/lib/organizers';
import { clientIp, rateLimit } from '@/lib/ratelimit';
import { vocabFor } from '@/lib/vocab';
import type { ApiErrorResponse, ReferralCheckRequest, ReferralCheckResponse } from '@/lib/types';

function apiError(status: number, code: ApiErrorResponse['code'], error: string) {
  return NextResponse.json<ApiErrorResponse>({ error, code }, { status });
}

/**
 * The refusal, in ONE wording for every way a referral code can fail to name
 * anybody: junk, a code from another seller, a code whose order was never
 * paid, a code from before share codes existed.
 *
 * Deliberately HARMLESS in tone, because the failure is harmless. Nothing
 * about this buyer's order or price depends on it — the only thing a bad code
 * costs is that nobody gets credited — and a checkout that shouted "invalid"
 * at that moment would frighten somebody into abandoning a perfectly good
 * purchase over a typo in a favour they were doing a friend.
 *
 * It also says nothing about which of those reasons applies. Like the voucher
 * check next door, this is an unauthenticated endpoint that answers questions
 * about codes, and an answer that distinguished "no such code" from "that one
 * is not paid yet" would let a script map a seller's buyers.
 */
const NOT_CREDITABLE =
  'We could not match that referral code, so nobody will be credited for it. Nothing changes about ' +
  'your order or your price — check it with the person who sent it if you like, or carry on without it.';

/**
 * "Is this referral code one somebody can be credited for?" — so a buyer who
 * typed a code off a screenshot or a WhatsApp message is told there and then,
 * instead of having it silently dropped.
 *
 * A PREVIEW that decides nothing. The orders route re-validates the code when
 * the order is written and stores '' for anything that does not hold up —
 * including the one rule that cannot be checked here, self-referral, which
 * needs the buyer's own email and is applied silently there (crediting
 * yourself for your own booking was never going to work, and telling somebody
 * that mid-checkout would be a strange thing to say out loud).
 *
 * Rate-limited like the voucher check: a code is 8 random characters, and an
 * endpoint that says yes or no to a guess is exactly what a script would grind
 * against.
 */
export async function POST(req: Request) {
  try {
    if (!rateLimit(`referral:${clientIp(req)}`, 12, 60_000)) {
      return apiError(429, 'INTERNAL', 'Too many code attempts — please wait a minute and try again.');
    }

    let raw: unknown;
    try {
      raw = await readJsonLimited(req);
    } catch (e) {
      if (e instanceof BodyTooLargeError) return apiError(413, 'VALIDATION', 'That request was too large.');
      return apiError(400, 'VALIDATION', 'Please enter a referral code and try again.');
    }

    const body = (raw && typeof raw === 'object' ? raw : {}) as Partial<ReferralCheckRequest>;
    const eventId = typeof body.eventId === 'string' ? body.eventId : '';
    const code = (typeof body.code === 'string' ? body.code : '').trim().toUpperCase();
    const event = eventId ? getEventById(eventId) : null;
    if (!event || event.status !== 'published') {
      return apiError(404, 'NOT_FOUND', 'We could not find that listing — it may no longer be available.');
    }
    // Same refusal the orders route gives when nothing can be bought here, so
    // a buyer gets one story either way.
    if (!event.salesOpen) {
      const v = vocabFor(event.kind);
      return apiError(403, 'SALES_CLOSED', `${v.Sales} are currently closed for this ${v.listing}.`);
    }

    // Shape first — this branch says nothing about any code that exists.
    if (!/^[A-Z0-9]{8}$/.test(code)) {
      return apiError(400, 'VALIDATION', NOT_CREDITABLE);
    }
    // Global backstop against a distributed or spoofed-IP grind, beside the
    // per-IP limit above and in the same style as the orders route's
    // 'orders:all'. clientIp() is only as trustworthy as the proxy in front of
    // it, so the per-IP bucket alone is not a ceiling on guessing — this is.
    // Consumed only after the listing and shape checks, so garbage requests
    // cannot exhaust it for real buyers. 300 a minute is far above any human
    // peak (a buyer types one referral code at most).
    if (!rateLimit('referral:all', 300, 60_000)) {
      return apiError(429, 'INTERNAL', 'The site is very busy right now — please try again in a minute.');
    }

    // The same lookup the orders route trusts: a paid order of any listing
    // belonging to THIS seller. One function, so the answer here and the
    // decision there can never disagree.
    if (!getPaidOrderByReferralCode(event.id, code)) {
      return apiError(400, 'VALIDATION', NOT_CREDITABLE);
    }

    const response: ReferralCheckResponse = {
      ok: true,
      code,
      sellerName: getOrganizer(event.organizerId)?.name?.trim() || '',
    };
    return NextResponse.json(response);
  } catch (e) {
    console.error('POST /api/orders/referral failed:', e);
    return apiError(500, 'INTERNAL', 'We could not check that code just now — please try again.');
  }
}
