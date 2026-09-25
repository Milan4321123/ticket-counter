import { NextResponse } from 'next/server';
import { BodyTooLargeError, readJsonLimited } from '@/lib/http';
import { clientIp, rateLimit } from '@/lib/ratelimit';
import { proposeSetup } from '@/lib/setupAssistant';
import { getEventMedia, getEventTiers } from '@/lib/events';
import { anyPaymentRoute, paymentOptionsFor } from '@/lib/paymentConnections';
import type { ApiErrorResponse } from '@/lib/types';
import { requireOrganizerApi, requireOwnedEvent } from '../../../auth';

export const dynamic = 'force-dynamic';

function bad(error: string, status = 400) {
  return NextResponse.json({ error } satisfies ApiErrorResponse, { status });
}

/**
 * The editor's setup assistant (lib/setupAssistant): what the seller said in,
 * a PROPOSAL of field values out. Saves nothing — the editor applies what the
 * seller keeps through the normal, validated save.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireOrganizerApi();
  if (auth.failure) return auth.failure;
  const owned = requireOwnedEvent(auth.organizer, id);
  if (owned.failure) return owned.failure;
  if (!rateLimit(`setup-assistant:${auth.organizer.id}`, 20, 60 * 60_000) || !rateLimit(`setup-assistant:ip:${clientIp(req)}`, 40, 60 * 60_000)) {
    return bad('That is a lot of requests — please fill the rest in the form, or try again in a while.', 429);
  }
  let body: { text?: unknown };
  try {
    body = ((await readJsonLimited(req, 8 * 1024)) ?? {}) as typeof body;
  } catch (e) {
    return bad(e instanceof BodyTooLargeError ? 'That is too long — a few sentences are enough.' : 'Tell me about your listing first.');
  }
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (text.length < 5) return bad('Tell me a little about your listing first.');
  const answer = await proposeSetup(text, owned.event.kind);
  return NextResponse.json(answer);
}

/**
 * What the required steps still need, field by field — the assistant asks for
 * these one at a time after it has filled what it could.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireOrganizerApi();
  if (auth.failure) return auth.failure;
  const owned = requireOwnedEvent(auth.organizer, id);
  if (owned.failure) return owned.failure;
  const e = owned.event;
  const missing: string[] = [];
  if (!e.name.trim()) missing.push('name');
  if (e.kind === 'shop') {
    if (!e.pickupInfo.trim()) missing.push('pickupInfo');
  } else {
    if (!e.eventDate) missing.push('eventDate');
    if (!e.venueName.trim()) missing.push('venueName');
    if (!e.address.trim()) missing.push('address');
  }
  if (!e.description.trim()) missing.push('description');
  if (!anyPaymentRoute(paymentOptionsFor(e))) missing.push(auth.organizer.isDemo ? 'payoutDemo' : 'payout');
  if (getEventTiers(e.id).length === 0) missing.push('tiers');
  if (getEventMedia(e.id).length === 0) missing.push('photo');
  if (e.status !== 'published') missing.push('publish');
  return NextResponse.json({ missing });
}
