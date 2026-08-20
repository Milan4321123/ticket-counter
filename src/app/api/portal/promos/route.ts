import { NextResponse } from 'next/server';
import { readJsonLimited, BodyTooLargeError } from '@/lib/http';
import { createPromoCode, listPromoCodes, PromoError, setPromoActive, type PromoKind } from '@/lib/promos';
import type { ApiErrorResponse } from '@/lib/types';
import { planGate, requireOrganizerApi } from '../auth';

/** Friendly validation failure — message goes straight to the UI. */
class ValidationError extends Error {}

function need(cond: boolean, message: string): asserts cond {
  if (!cond) throw new ValidationError(message);
}

function fail(e: unknown, where: string) {
  if (e instanceof ValidationError || e instanceof PromoError) {
    return NextResponse.json({ error: e.message } satisfies ApiErrorResponse, { status: 400 });
  }
  console.error(`${where} failed:`, e);
  return NextResponse.json(
    { error: 'Something went wrong. Please try again.' } satisfies ApiErrorResponse,
    { status: 500 }
  );
}

/** Every code this organizer has minted, with how often each has been used. */
export async function GET() {
  try {
    const auth = await requireOrganizerApi();
    if (auth.failure) return auth.failure;
    return NextResponse.json({ codes: listPromoCodes(auth.organizer.id) });
  } catch (e) {
    return fail(e, 'GET /api/portal/promos');
  }
}

/**
 * Mint one code.
 *
 * The organizer is the only person who may do this — it is a discount on THEIR
 * prices, granted by them, and the platform neither funds nor takes any part
 * of it. Everything the code is allowed to be is decided in lib/promos.ts, so
 * this route only has to get the types right.
 */
export async function POST(req: Request) {
  try {
    const auth = await requireOrganizerApi();
    if (auth.failure) return auth.failure;
    const { organizer } = auth;

    const blocked = planGate(organizer);
    if (blocked) return blocked;

    let body: Record<string, unknown>;
    try {
      const parsed = await readJsonLimited(req);
      need(Boolean(parsed) && typeof parsed === 'object' && !Array.isArray(parsed), 'Nothing to save.');
      body = parsed as Record<string, unknown>;
    } catch (e) {
      if (e instanceof BodyTooLargeError) {
        return NextResponse.json({ error: 'That request was too large.' } satisfies ApiErrorResponse, { status: 413 });
      }
      if (e instanceof ValidationError) throw e;
      return NextResponse.json({ error: 'Nothing to save.' } satisfies ApiErrorResponse, { status: 400 });
    }

    const kind = body.kind === 'percent' ? 'percent' : ('fixed' as PromoKind);
    need(typeof body.code === 'string', 'Please type the code you want to hand out.');
    const promo = createPromoCode(organizer.id, {
      code: body.code as string,
      kind,
      amountCents: Math.round(typeof body.amountCents === 'number' ? body.amountCents : 0),
      percent: Math.round(typeof body.percent === 'number' ? body.percent : 0),
      eventId: typeof body.eventId === 'string' ? body.eventId : '',
      maxRedemptions: Math.round(typeof body.maxRedemptions === 'number' ? body.maxRedemptions : 0),
      expiresOn: typeof body.expiresOn === 'string' ? body.expiresOn.trim() : '',
    });
    return NextResponse.json({ ok: true, promo });
  } catch (e) {
    return fail(e, 'POST /api/portal/promos');
  }
}

/**
 * Switch a code on or off. There is no DELETE on purpose: a code that has been
 * handed out and redeemed is part of the record of what this seller gave away
 * (see lib/promos.ts), and deactivating stops it working just as completely.
 */
export async function PATCH(req: Request) {
  try {
    const auth = await requireOrganizerApi();
    if (auth.failure) return auth.failure;
    const { organizer } = auth;

    const blocked = planGate(organizer);
    if (blocked) return blocked;

    let body: Record<string, unknown>;
    try {
      const parsed = await readJsonLimited(req);
      need(Boolean(parsed) && typeof parsed === 'object' && !Array.isArray(parsed), 'Nothing to change.');
      body = parsed as Record<string, unknown>;
    } catch (e) {
      if (e instanceof BodyTooLargeError) {
        return NextResponse.json({ error: 'That request was too large.' } satisfies ApiErrorResponse, { status: 413 });
      }
      if (e instanceof ValidationError) throw e;
      return NextResponse.json({ error: 'Nothing to change.' } satisfies ApiErrorResponse, { status: 400 });
    }

    need(typeof body.id === 'string' && body.id.length > 0, 'We could not find that code.');
    need(typeof body.active === 'boolean', 'Say whether the code should be on or off.');
    // Scoped to this organizer inside setPromoActive: a miss is a 404 whether
    // the code does not exist or belongs to somebody else.
    const changed = setPromoActive(organizer.id, body.id as string, body.active as boolean);
    if (!changed) {
      return NextResponse.json({ error: 'We could not find that code.' } satisfies ApiErrorResponse, { status: 404 });
    }
    return NextResponse.json({ ok: true, id: body.id, active: body.active });
  } catch (e) {
    return fail(e, 'PATCH /api/portal/promos');
  }
}
