// The weekly digest — "यो हप्ता के छ" — as one copy-paste WhatsApp message.
//
// This platform's audience does not browse websites; it forwards messages.
// The digest turns the feed into the thing the community actually circulates:
// a short bilingual "what's on" that a person pastes into their groups. The
// person is the delivery mechanism on purpose — no broadcast API, no sender
// account, no per-send cost, and a message forwarded by someone you know
// carries a trust no notification ever will. The operator pastes it weekly;
// a group admin who likes looking useful takes over from there.
//
// Everything here is plain text composed from PUBLISHED listings only — the
// same information any visitor sees — so there is nothing to consent to and
// nothing personal riding along.
import { getBaseUrl } from './config';
import { readListingName } from './exampleShop';
import { listPublishedEvents, type EventRow } from './events';
import { loadFeedSnapshot } from './feedSnapshot';
import { currentOccurrence, FESTIVALS } from './festivals';
import { ticketState, visibleTiers } from './ticketState';

/** "Sat 17 Oct" — short enough for a phone screen, day name first because
 * that is how people decide whether they can come. The year appears only when
 * it is not this year: "Sat 11 Dec 2027" is information, "Sat 17 Oct 2026" in
 * October 2026 is noise. */
function shortDate(iso: string, today = new Date()): string {
  const d = new Date(iso + 'T12:00:00Z');
  const sameYear = d.getUTCFullYear() === today.getUTCFullYear();
  return d.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
    timeZone: 'UTC',
  });
}

function shiftDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function eventLine(e: EventRow, base: string): string {
  const where = [e.venueName, e.city].filter(Boolean).join(', ');
  const when = e.eventDate ? shortDate(e.eventDate.slice(0, 10)) : e.dateDisplay;
  const meta = [when, where].filter(Boolean).join(' · ');
  return `🎟 *${e.name}*${meta ? `\n   ${meta}` : ''}\n   ${base}/e/${e.slug}`;
}

export interface DigestSections {
  /** Events in the next 14 days. */
  thisWeek: EventRow[];
  /** Dated events beyond the fortnight. */
  comingUp: EventRow[];
  /**
   * Shops worth a line THIS WEEK, best first and capped — see DIGEST_SHOPS.
   * Only shops with something actually on sale: a line pointing at an empty
   * shelf spends a stranger's tap and their patience.
   */
  shops: EventRow[];
  /** How many shops are open in total, so the message can say what it left out. */
  shopsTotal: number;
  /** A festival whose window starts within ~35 days, if any. */
  festivalLine: string | null;
}

export function digestSections(today = new Date()): DigestSections {
  const iso = today.toISOString().slice(0, 10);
  const horizon = shiftDays(iso, 14);
  const all = listPublishedEvents();

  const dated = all
    .filter((e) => e.kind !== 'shop' && e.eventDate && e.eventDate.slice(0, 10) >= iso)
    .sort((a, b) => (a.eventDate ?? '').localeCompare(b.eventDate ?? ''));

  const base = getBaseUrl();
  let festivalLine: string | null = null;
  for (const f of FESTIVALS) {
    const o = currentOccurrence(f, today);
    if (!o) continue;
    // Worth a line while people are planning — from five weeks out until the
    // festival ends. mainDay may already be past inside the window; say what
    // is still ahead.
    if (o.start <= shiftDays(iso, 35) && o.end >= iso) {
      const day = o.mainDay >= iso ? `${o.mainDayName}: ${shortDate(o.mainDay)}` : `until ${shortDate(o.end)}`;
      festivalLine = `🪔 ${f.name} ${o.year} — ${day} · ${base}/${f.slug}`;
      break;
    }
  }

  // ---- the bazaar's share of the message ---------------------------------
  //
  // Events bound themselves: they have dates, and the fortnight horizon above
  // decides which ones are news. A shop has no date, so "every published shop"
  // was the whole list forever — fine at seven, and an unpasteable wall at
  // fifty. WhatsApp truncates a long message and a reader gives up well before
  // that, so the digest that lists everything is the digest nobody forwards.
  //
  // Three rules, in this order:
  //   1. only shops with something ON SALE — a line to an empty shelf spends a
  //      stranger's tap and teaches them the list is padded;
  //   2. real sellers before the site's own example shops, exactly as /market
  //      orders them, because the point of the message is trade;
  //   3. capped, with the remainder named honestly and handed to /market.
  const openShops = all.filter((e) => e.kind === 'shop');
  const snapshot = loadFeedSnapshot(openShops);
  const sellable = openShops.filter((shop) => {
    const tiers = snapshot.tiers.get(shop.id) ?? [];
    const availability = snapshot.availability.get(shop.id);
    if (!availability) return false;
    const state = ticketState(shop, tiers, availability);
    if (!state.buyable) return false;
    return visibleTiers(tiers).some(
      (t) => t.status === 'on-sale' && (availability.tiers[t.tierKey]?.remaining ?? 0) > 0
    );
  });
  const ranked = [...sellable].sort(
    (a, b) => Number(readListingName(a.name).isExample) - Number(readListingName(b.name).isExample)
  );

  return {
    thisWeek: dated.filter((e) => (e.eventDate as string).slice(0, 10) <= horizon),
    comingUp: dated.filter((e) => (e.eventDate as string).slice(0, 10) > horizon),
    shops: ranked.slice(0, DIGEST_SHOPS),
    shopsTotal: ranked.length,
    festivalLine,
  };
}

/**
 * How many shops one message may carry.
 *
 * Six is about the point where a pasted message stops being scannable on a
 * phone — past that a reader scrolls rather than reads, and the events above
 * lose the attention they were the reason for. The rest are not hidden: the
 * line under them says how many there are and links to the bazaar.
 */
export const DIGEST_SHOPS = 6;

/**
 * The whole message, ready for the clipboard. Bilingual on the lines that are
 * ritual (the greeting, the section names) and English on the lines that are
 * data — the mix the community's own group messages actually use.
 */
export function digestText(today = new Date()): string {
  const { thisWeek, comingUp, shops, shopsTotal, festivalLine } = digestSections(today);
  const base = getBaseUrl();

  const parts: string[] = ['🙏 *यो हप्ता के छ? · What’s on*'];

  if (festivalLine) parts.push(festivalLine);

  if (thisWeek.length > 0) {
    parts.push(thisWeek.map((e) => eventLine(e, base)).join('\n\n'));
  }
  if (comingUp.length > 0) {
    parts.push('*अब आउँदै · Coming up*\n\n' + comingUp.map((e) => eventLine(e, base)).join('\n\n'));
  }
  if (shops.length > 0) {
    const rest =
      shopsTotal > shops.length
        ? `\n\n   +${shopsTotal - shops.length} more in the bazaar: ${base}/market`
        : `\n\n   The whole bazaar: ${base}/market`;
    parts.push(
      '*अर्डर गर्नुहोस् · Order for collection*\n\n' +
        shops.map((s) => `🥟 *${s.name}*\n   ${base}/e/${s.slug}`).join('\n\n') +
        rest
    );
  }
  if (thisWeek.length === 0 && comingUp.length === 0 && shops.length === 0) {
    parts.push(`Nothing listed yet — putting something on? List it free: ${base}/organizers`);
  }

  parts.push(`सबै कार्यक्रम · Everything: ${base}`);
  return parts.join('\n\n');
}
