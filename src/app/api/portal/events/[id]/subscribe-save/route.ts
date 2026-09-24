import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { BodyTooLargeError, readJsonLimited } from '@/lib/http';
import { SUBSCRIBE_PCT_CHOICES } from '@/lib/subscriptions';
import type { ApiErrorResponse } from '@/lib/types';
import { planGate, requireOrganizerApi, requireOwnedEvent } from '../../../auth';

export const dynamic = 'force-dynamic';

function bad(error: string, status = 400) {
  return NextResponse.json({ error } satisfies ApiErrorResponse, { status });
}

/**
 * A shop's Subscribe & save offer (lib/subscriptions): the % off every repeat.
 * Changing it never touches existing subscribers — each keeps the % they
 * signed up at.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireOrganizerApi();
  if (auth.failure) return auth.failure;
  const blocked = planGate(auth.organizer);
  if (blocked) return blocked;
  const owned = requireOwnedEvent(auth.organizer, id);
  if (owned.failure) return owned.failure;
  if (owned.event.kind !== 'shop') return bad('Subscribe & save is for shops.');
  let body: { pct?: unknown };
  try {
    body = ((await readJsonLimited(req)) ?? {}) as typeof body;
  } catch (e) {
    return bad(e instanceof BodyTooLargeError ? 'That request was too large.' : 'Nothing to save.');
  }
  const pct = Number(body.pct);
  if (!(SUBSCRIBE_PCT_CHOICES as readonly number[]).includes(pct)) return bad('Pick one of the offered discounts.');
  getDb().prepare(`UPDATE events SET subscribe_pct = ? WHERE id = ?`).run(pct, owned.event.id);
  return NextResponse.json({ ok: true });
}
