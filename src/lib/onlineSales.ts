// Online sales stop shortly before the show; the counter at the venue takes over.
//
// Why it exists: on show night an organizer is selling at the door AND the page
// is still selling online, from the same room. Two tills on one stock is how a
// hall gets oversold — the counter sells the last seat while someone in the
// car park pays for it on their phone — and how a buyer ends up paying online
// for a show that started an hour ago. So every event has a moment when online
// buying ends: automatically, N minutes before the start, or the moment the
// organizer presses "Stop online sales now". After it the page does not just go
// quiet — a buyer who taps Get tickets is told to buy at the counter.
//
// Client-safe on purpose (no db import): ticketState reads it, and so does the
// buyer-facing sheet, and both must agree on the minute.
//
// Times are Germany's wall clock (Europe/Berlin), like the restaurant slots in
// lib/kitchen: "doors at 18:00" is a time on the poster, not an instant, and a
// buyer looking from Kathmandu must still read 18:00.
import type { EventKind } from './types';

export const SALES_TZ = 'Europe/Berlin';

/**
 * How long before the start online sales close. `null` = never — keep selling
 * online until the show is over. The default for every event is one hour:
 * long enough for the door list to be final, short enough that the
 * same-afternoon buyers — a lot of them, for a community concert — still get
 * to buy from the sofa.
 */
export const ONLINE_CLOSE_CHOICES: { min: number | null; label: string }[] = [
  { min: null, label: 'Never — keep selling online' },
  { min: 0, label: 'When the show starts' },
  { min: 15, label: '15 minutes before' },
  { min: 30, label: '30 minutes before' },
  { min: 60, label: '1 hour before' },
  { min: 120, label: '2 hours before' },
  { min: 180, label: '3 hours before' },
  { min: 360, label: '6 hours before' },
  { min: 720, label: '12 hours before' },
  { min: 1440, label: '1 day before' },
];
export const DEFAULT_ONLINE_CLOSE_MIN = 60;

export function isOnlineCloseChoice(v: unknown): v is number | null {
  return ONLINE_CLOSE_CHOICES.some((c) => c.min === v);
}

/**
 * How long after the start a show counts as over. Six hours covers a long
 * concert with an after-party; after that "buy at the counter" would be
 * sending somebody to a locked hall.
 */
export const SHOW_LENGTH_MIN = 6 * 60;

export interface OnlineSalesInput {
  kind: EventKind;
  eventDate: string | null;
  dateDisplay: string;
  showTime: string;
  onlineCloseMin: number | null;
  onlineStopped: boolean;
  counterSales: boolean;
  counterNote: string;
}

export interface OnlineSales {
  /** Online buying is closed right now — by the organizer, or by the clock. */
  closed: boolean;
  /** 'stopped' = the organizer pressed the button; 'clock' = the cutoff passed. */
  reason: 'stopped' | 'clock' | null;
  /** When the automatic cutoff is (Berlin wall clock), or null when it is off or no start is known. */
  closesAt: { date: string; time: string } | null;
  /**
   * What the cutoff counts back from. 'show' = the "Show starts" field;
   * 'text' = a start time written in the date line; 'doors' = the doors time.
   */
  start: { date: string; time: string; source: 'show' | 'text' | 'doors' } | null;
  /** The show is over (start + SHOW_LENGTH_MIN). */
  over: boolean;
  /** Tickets are sold at the counter at the venue. */
  counter: boolean;
  /** The organizer's line for the counter: "Opens 17:30 · cash only". */
  counterNote: string;
}

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isHhmm(v: unknown): v is string {
  return typeof v === 'string' && HHMM.test(v);
}

function toMin(hhmm: string): number {
  const m = HHMM.exec(hhmm)!;
  return Number(m[1]) * 60 + Number(m[2]);
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * "19:00", "7 PM", "7:30pm", "19.00" → "19:00". Null when it is not a time.
 * Twelve-hour times need the am/pm: a bare "7" is a number, not a time.
 */
function readClock(h: string, m: string | undefined, ampm: string | undefined): string | null {
  let hour = Number(h);
  const min = m === undefined ? 0 : Number(m);
  if (!Number.isInteger(hour) || !Number.isInteger(min) || min > 59) return null;
  if (ampm) {
    if (hour < 1 || hour > 12) return null;
    const pm = ampm.toLowerCase() === 'pm';
    hour = (hour % 12) + (pm ? 12 : 0);
  } else if (m === undefined || hour > 23) {
    return null;
  }
  return `${pad(hour)}:${pad(min)}`;
}

/**
 * A start time written into the date line, for events made before the "Show
 * starts" field existed. The date line is what the editor itself writes —
 * "Saturday 24 October 2026 · Doors 18:00" — or what the organizer typed:
 * "Doors 6 PM · Show 7 PM", "Einlass 18:00 · Beginn 19:00".
 *
 * The show time wins over the doors time, because that is what the cutoff is
 * defined against. Doors are the fallback because the counter opens with them,
 * so closing online sales an hour before doors still hands over to it cleanly.
 */
export function startFromText(text: string): { time: string; source: 'text' | 'doors' } | null {
  const clock = String.raw`(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?`;
  const norm = (s: string | undefined) => (s ? s.replace(/\./g, '') : undefined);
  const show = new RegExp(String.raw`\b(?:show|start|starts|beginn|music|programm?)\b[^\d]{0,12}${clock}`, 'i').exec(text);
  if (show) {
    const t = readClock(show[1], show[2], norm(show[3]));
    if (t) return { time: t, source: 'text' };
  }
  const doors = new RegExp(String.raw`\b(?:doors?|einlass)\b[^\d]{0,12}${clock}`, 'i').exec(text);
  if (doors) {
    const t = readClock(doors[1], doors[2], norm(doors[3]));
    if (t) return { time: t, source: 'doors' };
  }
  return null;
}

/** Days since 1970 for a 'YYYY-MM-DD', so wall-clock minutes can be compared across midnight. */
function dayNumber(date: string): number {
  return Math.round(Date.parse(`${date}T00:00:00Z`) / 86_400_000);
}

function fromAbs(abs: number): { date: string; time: string } {
  const day = Math.floor(abs / 1440);
  const min = abs - day * 1440;
  const date = new Date(day * 86_400_000).toISOString().slice(0, 10);
  return { date, time: `${pad(Math.floor(min / 60))}:${pad(min % 60)}` };
}

/** Now on the German wall clock, as minutes since 1970-01-01 00:00 (wall time, not UTC). */
export function berlinNowAbs(at: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: SALES_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(at);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  return dayNumber(`${get('year')}-${get('month')}-${get('day')}`) * 1440 + Number(get('hour')) * 60 + Number(get('minute'));
}

/**
 * The one answer to "can this event still be bought ONLINE right now".
 *
 * Shops never close this way: they have no show to start, and a shop's own
 * pause is the ordinary "Sales open" switch.
 */
export function onlineSales(event: OnlineSalesInput, at: Date = new Date()): OnlineSales {
  const counter = event.counterSales;
  const counterNote = event.counterNote.trim();
  const none: OnlineSales = { closed: false, reason: null, closesAt: null, start: null, over: false, counter, counterNote };
  if (event.kind !== 'event') return none;

  let start: OnlineSales['start'] = null;
  if (event.eventDate && DATE.test(event.eventDate)) {
    if (isHhmm(event.showTime)) {
      start = { date: event.eventDate, time: event.showTime, source: 'show' };
    } else {
      const fromText = startFromText(event.dateDisplay);
      if (fromText) start = { date: event.eventDate, ...fromText };
    }
  }

  const now = berlinNowAbs(at);
  const startAbs = start ? dayNumber(start.date) * 1440 + toMin(start.time) : null;
  const cutoffAbs = startAbs !== null && event.onlineCloseMin !== null ? startAbs - event.onlineCloseMin : null;
  const closesAt = cutoffAbs !== null ? fromAbs(cutoffAbs) : null;
  const over = startAbs !== null && now >= startAbs + SHOW_LENGTH_MIN;

  // The organizer's button first: it is the more deliberate of the two, and an
  // organizer who pressed it should see "you stopped it", not "the clock did".
  if (event.onlineStopped) return { ...none, closed: true, reason: 'stopped', closesAt, start, over };
  if (cutoffAbs !== null && now >= cutoffAbs) return { ...none, closed: true, reason: 'clock', closesAt, start, over };
  return { ...none, closesAt, start, over };
}

/** Minutes from now until a Berlin wall-clock moment; negative once it has passed. */
export function minutesUntil(when: { date: string; time: string }, at: Date = new Date()): number {
  return dayNumber(when.date) * 1440 + toMin(when.time) - berlinNowAbs(at);
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "today at 18:00", "tomorrow at 18:00", "Sat 24 Oct at 18:00". */
export function wallClockLabel(when: { date: string; time: string }, at: Date = new Date()): string {
  const today = Math.floor(berlinNowAbs(at) / 1440);
  const day = dayNumber(when.date);
  if (day === today) return `today at ${when.time}`;
  if (day === today + 1) return `tomorrow at ${when.time}`;
  const d = new Date(`${when.date}T12:00:00Z`);
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} at ${when.time}`;
}

/**
 * Why an online order must be refused right now, in words a buyer can act on —
 * or null when online buying is open. The orders, voucher and referral routes
 * all ask this AFTER their own "Sales open" check, so a buyer whose page went
 * stale is told the same thing the page now says.
 */
export function onlineRefusal(event: OnlineSalesInput, at: Date = new Date()): string | null {
  const s = onlineSales(event, at);
  if (s.over) return 'This event has already taken place.';
  if (!s.closed) return null;
  return s.counter
    ? 'Online sales for this event have closed. Tickets are still available at the counter at the venue.'
    : 'Online sales for this event have closed.';
}

/** What the organizer's "Stop online sales now" control shows (portal/OnlineSalesSwitch). */
export function onlineSwitchState(
  event: OnlineSalesInput,
  at: Date = new Date()
): { closed: boolean; reason: 'stopped' | 'clock' | null; clockPassed: boolean; closesLabel: string | null; counter: boolean } {
  const s = onlineSales(event, at);
  return {
    closed: s.closed,
    reason: s.reason,
    clockPassed: s.closesAt !== null && minutesUntil(s.closesAt, at) <= 0,
    closesLabel: s.closesAt ? wallClockLabel(s.closesAt, at) : null,
    counter: s.counter,
  };
}
