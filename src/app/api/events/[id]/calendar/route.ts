import { NextResponse } from 'next/server';
import { listingOpenTo } from '@/lib/demo';
import { getEventById } from '@/lib/events';
import { platformNameFromEnv } from '@/lib/platform';
import { absoluteUrl, machineDate } from '@/lib/seo';

export const dynamic = 'force-dynamic';

/**
 * Escape text for an ICS property value (RFC 5545 §3.3.11).
 *
 * Backslash first — escaping it later would double the backslashes this very
 * function just introduced. Newlines become the literal two characters "\n",
 * which is how the format spells a line break inside a value; real CR/LF would
 * end the property mid-value and turn the rest into a parse error.
 */
function icsText(input: string): string {
  return input
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

/**
 * Fold one content line to RFC 5545's 75-octet limit.
 *
 * The limit is OCTETS, not characters — an event name in Devanagari is three
 * bytes per character, and counting characters would produce lines strict
 * parsers reject. Folding is also forbidden from splitting a multi-byte
 * character, so the walk is per code point with its UTF-8 size, never per
 * byte. Continuation lines begin with a space that counts toward their own
 * limit, hence 74 for every segment after the first.
 */
function foldLine(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;
  const segments: string[] = [];
  let segment = '';
  let octets = 0;
  let limit = 75;
  for (const ch of line) {
    const size = encoder.encode(ch).length;
    if (octets + size > limit) {
      segments.push(segment);
      segment = '';
      octets = 0;
      limit = 74;
    }
    segment += ch;
    octets += size;
  }
  if (segment) segments.push(segment);
  return segments.join('\r\n ');
}

/**
 * PUBLIC: the event as a downloadable .ics file, so "add to calendar" works in
 * every calendar app at once instead of needing one deep link per vendor.
 *
 * All-day rather than timed, deliberately: the only trustworthy date is the
 * machine column (see machineDate in lib/seo — dateDisplay is free text and is
 * never parsed), and there is no machine start TIME at all. A guessed time in
 * someone's calendar is worse than no time; the doors-open detail stays in
 * dateDisplay on the pages this file links back to.
 *
 * Everything without that trustworthy date 404s: drafts and archived events
 * (this route must not leak them), shops (they have no date — collection is
 * free-text pickupInfo), and events whose organizer never set a real date.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = getEventById(id);
  if (!event || !(await listingOpenTo(event)) || event.kind !== 'event') {
    return new NextResponse('Not found', { status: 404 });
  }
  const date = machineDate(event);
  if (!date) return new NextResponse('Not found', { status: 404 });

  const url = absoluteUrl(`/e/${event.slug}`);
  // For an all-day VEVENT, DTEND is exclusive — the day AFTER the event. The
  // date is already validated as YYYY-MM-DD, so UTC arithmetic cannot slip a
  // day the way local-timezone parsing could.
  const startValue = date.replace(/-/g, '');
  const endValue = new Date(Date.parse(`${date}T00:00:00Z`) + 86_400_000)
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, '');
  const dtstamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  // Stable across downloads, so re-importing the file updates the existing
  // calendar entry instead of stacking a duplicate next to it.
  const uid = `${event.id}@${new URL(absoluteUrl('/')).hostname}`;
  // Deduped case-insensitively: organizers routinely paste the same string
  // into venue and address, and "Hall X, Hall X, Berlin" in a calendar entry
  // reads as our bug, not their typing.
  const locationParts: string[] = [];
  for (const raw of [event.venueName, event.address, event.city]) {
    const s = raw.trim();
    if (s && !locationParts.some((p) => p.toLowerCase() === s.toLowerCase())) locationParts.push(s);
  }
  const location = locationParts.join(', ');

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//${icsText(platformNameFromEnv())}//Event Calendar//EN`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART;VALUE=DATE:${startValue}`,
    `DTEND;VALUE=DATE:${endValue}`,
    `SUMMARY:${icsText(event.name)}`,
    ...(location ? [`LOCATION:${icsText(location)}`] : []),
    `DESCRIPTION:${icsText(`Full details for ${event.name} are on the event page: ${url}`)}`,
    `URL:${url}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  return new NextResponse(lines.map(foldLine).join('\r\n') + '\r\n', {
    headers: {
      // The charset matters: without it some clients assume Latin-1 and mangle
      // every non-ASCII event name at the exact moment it lands in a calendar.
      'Content-Type': 'text/calendar; charset=utf-8',
      // Slugs are [a-z0-9-] only (see makeUniqueSlug), so the filename needs
      // no escaping beyond the quotes.
      'Content-Disposition': `attachment; filename="${event.slug}.ics"`,
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
