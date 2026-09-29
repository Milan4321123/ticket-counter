import { NextResponse } from 'next/server';
import { getEventById, getEventTier } from '@/lib/events';
import { clientIp, rateLimit } from '@/lib/ratelimit';
import { canWish, deviceKey, hasWished, setWish, wishCount } from '@/lib/wishes';

export const dynamic = 'force-dynamic';

/**
 * The wish list (lib/wishes). POST {eventId, tierKey, device, on} adds or
 * removes this browser's wish and answers with the new count; GET with the
 * same query answers whether it is on and how many want it.
 */
export async function POST(req: Request) {
  if (!rateLimit(`wish:${clientIp(req)}`, 40, 60_000)) {
    return NextResponse.json({ error: 'Too many at once — wait a moment.' }, { status: 429 });
  }
  const body = (await req.json().catch(() => null)) as { eventId?: unknown; tierKey?: unknown; device?: unknown; on?: unknown } | null;
  const eventId = typeof body?.eventId === 'string' ? body.eventId : '';
  const tierKey = typeof body?.tierKey === 'string' ? body.tierKey : '';
  const device = deviceKey(typeof body?.device === 'string' ? body.device : '', eventId, tierKey);
  const event = eventId ? getEventById(eventId) : null;
  const tier = event && tierKey ? getEventTier(event.id, tierKey) : null;
  if (!device || !canWish(event, tier)) return NextResponse.json({ error: 'This item cannot be wished for.' }, { status: 400 });
  const on = body?.on !== false;
  return NextResponse.json({ on, count: setWish(eventId, tierKey, device, on) });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const eventId = url.searchParams.get('eventId') ?? '';
  const tierKey = url.searchParams.get('tierKey') ?? '';
  if (!eventId || !tierKey) return NextResponse.json({ on: false, count: 0 });
  const device = deviceKey(url.searchParams.get('device') ?? '', eventId, tierKey);
  return NextResponse.json({ on: device ? hasWished(eventId, tierKey, device) : false, count: wishCount(eventId, tierKey) });
}
