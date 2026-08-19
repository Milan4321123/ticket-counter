import { NextResponse } from 'next/server';
import { getEventById, getEventTiers } from '@/lib/events';
import { BodyTooLargeError, readJsonLimited } from '@/lib/http';
import { getAvailability } from '@/lib/inventory';
import { clientIp, rateLimit } from '@/lib/ratelimit';
import { ticketState } from '@/lib/ticketState';
import type { ApiErrorResponse } from '@/lib/types';
import { vocabFor } from '@/lib/vocab';
import { joinWaitlist, waitlistCount } from '@/lib/waitlist';

const MAX_EMAIL = 160;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Three ceilings, same shape as the ask route's escalation path and closing
 * the same three holes: a global one so a rotating-IP flood is bounded
 * platform-wide, a per-IP one so a single visitor cannot hammer, and a
 * per-address one so this form cannot be used to sign somebody ELSE's inbox
 * up to a stream of "available again" emails across many events.
 */
const IP_LIMIT = 5;
const IP_WINDOW_MS = 60_000;
const GLOBAL_LIMIT = 120;
const EMAIL_LIMIT = 10;
const SHARED_WINDOW_MS = 10 * 60_000;

/**
 * Hard ceiling on one event's list. Rate limits bound the SPEED of writes,
 * not the total, so a patient script could otherwise grow a list without end.
 * Refused honestly rather than absorbed silently: an address stored past the
 * point anyone would realistically win the race is a privacy cost with no
 * benefit to the person who typed it.
 */
const MAX_WAITLIST_PER_EVENT = 1000;

function apiError(status: number, error: string) {
  return NextResponse.json({ error } satisfies ApiErrorResponse, { status });
}

/**
 * PUBLIC: join a sold-out event's waitlist. The only thing stored is the
 * email, lowercased, and only while the event is published and genuinely sold
 * out — if spots are in fact buyable the response says so instead, so the UI
 * can send the visitor to checkout rather than onto a pointless list.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    if (!rateLimit(`waitlist:${clientIp(req)}`, IP_LIMIT, IP_WINDOW_MS)) {
      return apiError(429, 'That is a lot of tries at once — please wait a minute and try again.');
    }

    let raw: unknown;
    try {
      raw = await readJsonLimited(req);
    } catch (e) {
      if (e instanceof BodyTooLargeError) {
        return apiError(413, 'That request was too large.');
      }
      return apiError(400, 'Please enter your email address first.');
    }

    const email =
      raw && typeof raw === 'object' && typeof (raw as { email?: unknown }).email === 'string'
        ? (raw as { email: string }).email.trim().toLowerCase()
        : '';
    if (!email || email.length > MAX_EMAIL || !EMAIL_RE.test(email)) {
      return apiError(400, 'That email address does not look right — please check it.');
    }

    // Drafts and archived events look like 404s, exactly as their pages do.
    const event = getEventById(id);
    if (!event || event.status !== 'published') {
      return apiError(404, 'We could not find that event — it may no longer be available.');
    }
    const v = vocabFor(event.kind);

    // The global and per-address buckets are consumed only AFTER validation,
    // so garbage requests cannot exhaust them for real visitors (the same
    // ordering the ask route uses).
    if (!rateLimit('waitlist:all', GLOBAL_LIMIT, SHARED_WINDOW_MS)) {
      return apiError(429, 'A lot of people are signing up right now — please try again in a few minutes.');
    }
    if (!rateLimit(`waitlist:email:${email}`, EMAIL_LIMIT, SHARED_WINDOW_MS)) {
      return apiError(429, 'That email address has joined a few waitlists already — please wait a little.');
    }

    // Genuinely sold out, decided by the same pair of helpers the page and the
    // checkout use — never by the room alone, which can have space while every
    // sellable type is gone.
    const state = ticketState(event, getEventTiers(event.id), getAvailability(event.id));
    if (state.buyable) {
      // Not an error: between the page render and this click, somebody's
      // reservation may have expired. The kindest answer is "go and buy one".
      return NextResponse.json({ ok: true, onSale: true });
    }
    if (state.kind !== 'sold-out') {
      // Paused, announced-only, or past. A waitlist here would promise an
      // email on a condition that has nothing to do with spots freeing up.
      return apiError(
        409,
        `The waitlist is only for a sold-out ${v.listing} — right now ${v.units} are simply not on sale here.`
      );
    }

    if (waitlistCount(event.id) >= MAX_WAITLIST_PER_EVENT) {
      return apiError(
        429,
        `The waitlist for this ${v.listing} is full — more people are waiting than could realistically get a spot.`
      );
    }

    // A duplicate address is a silent success inside joinWaitlist (INSERT OR
    // IGNORE), and deliberately indistinguishable out here: the response must
    // never confirm whether an address was already on the list.
    joinWaitlist(event.id, email);
    return NextResponse.json({ ok: true, onSale: false });
  } catch (e) {
    console.error(`POST /api/events/${id}/waitlist failed:`, e);
    return apiError(500, 'Something went wrong. Please try again.');
  }
}
