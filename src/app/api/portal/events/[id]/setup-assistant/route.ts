import { NextResponse } from 'next/server';
import { takeAiQuota } from '@/lib/aiQuota';
import { BodyTooLargeError, readJsonLimited } from '@/lib/http';
import { clientIp, rateLimit } from '@/lib/ratelimit';
import { kindMismatch, proposeSetup, soundsLikeFood } from '@/lib/setupAssistant';
import { getDb } from '@/lib/db';
import { getEventFaqs, getEventMedia, getEventTiers, listEventPosts } from '@/lib/events';
import { parseSlotConfig } from '@/lib/kitchen';
import { parseSeatMap } from '@/lib/seats';
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
  // A burst (several messages fired at once), an hour, and a whole day.
  if (!rateLimit(`setup-assistant:burst:${auth.organizer.id}`, 6, 60_000)) {
    return bad('One moment — that is a lot of messages at once. Wait a few seconds and send again.', 429);
  }
  if (!rateLimit(`setup-assistant:${auth.organizer.id}`, 20, 60 * 60_000) || !rateLimit(`setup-assistant:ip:${clientIp(req)}`, 40, 60 * 60_000)) {
    return bad('That is a lot of requests — please fill the rest in the form, or try again in a while.', 429);
  }
  if (
    !takeAiQuota([
      { key: `setup:org:${auth.organizer.id}`, perDay: auth.organizer.isDemo ? 30 : 80 },
      { key: `setup:ip:${clientIp(req)}`, perDay: 100 },
      { key: 'setup:all', perDay: 2000 },
    ])
  ) {
    return bad('That is the limit for the AI helper today — you can still fill everything in the form, and it is back tomorrow.', 429);
  }
  let body: { text?: unknown };
  try {
    body = ((await readJsonLimited(req, 8 * 1024)) ?? {}) as typeof body;
  } catch (e) {
    return bad(e instanceof BodyTooLargeError ? 'That is too long — a few sentences are enough.' : 'Tell me about your listing first.');
  }
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (text.length < 5) return bad('Tell me a little about your listing first.');
  // "mero momo pasal…" on a blank EVENT draft (or a concert on a blank shop):
  // the page is simply the other kind — switch it rather than fill an event
  // with a menu. Only while nothing is on it yet: no items, no description.
  const e = owned.event;
  let kind = e.kind;
  let switchedKind: 'event' | 'shop' | null = null;
  const blank = e.status === 'draft' && !e.description.trim() && getEventTiers(e.id).length === 0;
  if (blank && kindMismatch(text, kind)) {
    kind = kind === 'event' ? 'shop' : 'event';
    const category = kind === 'shop' && soundsLikeFood(text) ? 'khaja-food' : '';
    getDb().prepare(`UPDATE events SET kind = ?, category = ? WHERE id = ?`).run(kind, category, e.id);
    switchedKind = kind;
  }
  const answer = await proposeSetup(text, kind);
  return NextResponse.json({ ...answer, switchedKind });
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
  // "My new event" is the blank draft's placeholder, not a name.
  if (!e.name.trim() || /^My new (event|shop|restaurant)$/i.test(e.name.trim())) missing.push('name');
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
  // A demo never goes live (the platform decides who publishes): its last
  // step is looking at the private preview instead.
  if (e.status !== 'published') missing.push(auth.organizer.isDemo ? 'preview' : 'publish');

  // What is on the page so far, and the optional extras still open — so the
  // assistant can say "done: … · could still add: …" once the musts are in.
  const isShop = e.kind === 'shop';
  const tiers = getEventTiers(e.id);
  const media = getEventMedia(e.id);
  const photos = media.filter((m) => m.mime.startsWith('image/')).length;
  const videos = media.filter((m) => m.mime.startsWith('video/')).length;
  const filled = [
    e.name.trim() && 'Name',
    isShop ? e.pickupInfo.trim() && 'Pickup details' : e.eventDate && `Date${e.venueName.trim() ? ' & place' : ''}`,
    e.description.trim() && 'Description',
    tiers.length > 0 && `${tiers.length} ${isShop ? (tiers.length === 1 ? 'item' : 'items') : tiers.length === 1 ? 'ticket type' : 'ticket types'}`,
    photos > 0 && `${photos} photo${photos === 1 ? '' : 's'}`,
    anyPaymentRoute(paymentOptionsFor(e)) && 'Payment details',
    e.status === 'published' && 'Published',
  ].filter(Boolean) as string[];
  const slots = parseSlotConfig(e.pickupSlots);
  const extras: { tab: string; label: string; done: boolean }[] = [
    { tab: 'media', label: videos ? `${videos} video${videos === 1 ? '' : 's'}` : 'A short video', done: videos > 0 },
    ...(photos < 3 ? [{ tab: 'media', label: 'More photos (3+ sell better)', done: false }] : []),
    { tab: 'updates', label: 'An update for buyers', done: listEventPosts(e.id).length > 0 },
    { tab: 'faq', label: 'FAQ — answers before people ask', done: getEventFaqs(e.id).length > 0 },
    { tab: 'design', label: 'Colours & layout', done: Boolean(e.pageDesign && e.pageDesign !== '{}') },
    ...(isShop
      ? [
          { tab: 'kitchen', label: slots.purpose === 'appointment' ? 'Booking times' : 'Pick-up times & options', done: slots.enabled },
          { tab: 'subscribe', label: 'Subscribe & save', done: e.subscribePct > 0 },
        ]
      : [{ tab: 'seating', label: 'A seat map', done: Boolean(parseSeatMap(e.seatMap)?.enabled) }]),
    { tab: 'languages', label: 'Deutsch & नेपाली versions', done: false },
  ];
  return NextResponse.json({ missing, progress: { filled, extras } });
}
