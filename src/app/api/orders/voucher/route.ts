import { NextResponse } from 'next/server';
import { getEventById } from '@/lib/events';
import { BodyTooLargeError, readJsonLimited } from '@/lib/http';
import { getOrganizer } from '@/lib/organizers';
import { clientIp, rateLimit } from '@/lib/ratelimit';
import { requireRedeemableVoucher, VoucherError } from '@/lib/referrals';
import { vocabFor } from '@/lib/vocab';
import type { ApiErrorResponse, VoucherCheckRequest, VoucherCheckResponse } from '@/lib/types';

function apiError(status: number, code: ApiErrorResponse['code'], error: string) {
  return NextResponse.json<ApiErrorResponse>({ error, code }, { status });
}

/**
 * "Does this voucher work here, and how much does it take off?" — so the
 * checkout can show the discount and the new total BEFORE the buyer commits to
 * anything. Somebody who types a code has to be told there and then whether it
 * applied; finding out on the payment page, or not at all, is worse than not
 * offering the box.
 *
 * This is a PREVIEW ONLY and decides nothing. The order route re-checks and
 * CLAIMS the voucher inside the same transaction that writes the order, so
 * whatever happens between this answer and that one, the money and the
 * redemption cannot disagree.
 *
 * Rate-limited harder than it looks like it needs to be: a code is 8 random
 * characters, and an endpoint that says yes or no to a guess is exactly what a
 * script would grind against. The limit is the difference between "unguessable"
 * and "unguessable at any useful speed".
 */
export async function POST(req: Request) {
  try {
    if (!rateLimit(`voucher:${clientIp(req)}`, 12, 60_000)) {
      return apiError(429, 'INTERNAL', 'Too many voucher attempts — please wait a minute and try again.');
    }

    let raw: unknown;
    try {
      raw = await readJsonLimited(req);
    } catch (e) {
      if (e instanceof BodyTooLargeError) return apiError(413, 'VALIDATION', 'That request was too large.');
      return apiError(400, 'VALIDATION', 'Please enter a voucher code and try again.');
    }

    const body = (raw && typeof raw === 'object' ? raw : {}) as Partial<VoucherCheckRequest>;
    const eventId = typeof body.eventId === 'string' ? body.eventId : '';
    const code = typeof body.code === 'string' ? body.code : '';
    const event = eventId ? getEventById(eventId) : null;
    if (!event || event.status !== 'published') {
      return apiError(404, 'NOT_FOUND', 'We could not find that listing — it may no longer be available.');
    }
    // Nothing can be bought here, so nothing needs previewing — and an
    // endpoint that answers questions about codes and sellers should answer
    // none at all where there is no checkout to answer them for. Same refusal
    // the orders route gives, so a buyer gets one story either way.
    if (!event.salesOpen) {
      const v = vocabFor(event.kind);
      return apiError(403, 'SALES_CLOSED', `${v.Sales} are currently closed for this ${v.listing}.`);
    }

    // Scoped to the SELLER of this listing: a voucher is one seller's discount
    // on one seller's prices, and it is never spendable at anyone else's till.
    const voucher = requireRedeemableVoucher(event.organizerId, code);
    const response: VoucherCheckResponse = {
      ok: true,
      code: voucher.code,
      amountCents: voucher.amountCents,
      currency: event.currency,
      sellerName: getOrganizer(event.organizerId)?.name?.trim() || '',
    };
    return NextResponse.json(response);
  } catch (e) {
    // A VoucherError is the buyer's answer, written for them to read.
    if (e instanceof VoucherError) return apiError(400, 'VALIDATION', e.message);
    console.error('POST /api/orders/voucher failed:', e);
    return apiError(500, 'INTERNAL', 'We could not check that voucher just now — please try again.');
  }
}
