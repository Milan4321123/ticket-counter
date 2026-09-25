// Server-only: the editor's setup assistant. A seller describes their event or
// shop in their own words; this turns that into a PROPOSAL of field values for
// the editor — never a save. The seller sees every line, unticks what is wrong,
// and the editor saves the rest through the normal validated route.
//
// Fixed rules, enforced here in code (the model is only asked nicely):
//   · only facts the seller stated — nothing invented, no guessed prices,
//     dates or addresses; a field that was not mentioned is left out;
//   · money in whole cents, 0 … €50,000; quantities 1 … 200,000;
//   · a calendar date as YYYY-MM-DD, in the future, for events only;
//   · a shop's shelf from the fixed category list, or nothing;
//   · at most 10 ticket types / items, names ≤ 60 characters.
// With no AI (no key, busy, quota), a plain-rules reader still picks out
// prices, dates, capacity and a city — less, but never wrong in the same way.
import { geminiJson } from './gemini';
import { SHOP_CATEGORIES } from './categories';

export interface ProposedTier {
  name: string;
  priceCents: number;
  /** How many; 0 = not said (the editor then treats it as unlimited for a shop). */
  cap: number;
  description: string;
  studentOnly: boolean;
}

export interface SetupProposal {
  name?: string;
  artist?: string;
  description?: string;
  dateDisplay?: string;
  eventDate?: string;
  venueName?: string;
  address?: string;
  city?: string;
  totalCapacity?: number;
  pickupInfo?: string;
  category?: string;
  tiers?: ProposedTier[];
}

export interface SetupAnswer {
  proposal: SetupProposal;
  /** True when the seller asked the assistant to invent the content itself. */
  suggested: boolean;
  /** What the assistant says back, in one or two sentences. */
  reply: string;
  /** 'ai' or the plain-rules fallback. */
  source: 'ai' | 'rules';
}

const MAX_TIERS = 20;

function str(v: unknown, max: number): string | undefined {
  if (typeof v !== 'string') return undefined;
  const s = v.replace(/[\u0000-\u0008\u000B-\u001F\u007F]+/g, ' ').replace(/[ \t]+/g, ' ').trim();
  return s ? s.slice(0, max) : undefined;
}

function int(v: unknown, min: number, max: number): number | undefined {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v.replace(',', '.')) : NaN;
  if (!Number.isFinite(n)) return undefined;
  const r = Math.round(n);
  return r >= min && r <= max ? r : undefined;
}

function todayBerlin(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date());
}

/** Apply the fixed rules to whatever came back. Anything that breaks a rule is dropped. */
export function normaliseProposal(raw: unknown, kind: 'event' | 'shop'): SetupProposal {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const out: SetupProposal = {};
  const name = str(r.name, 120);
  if (name) out.name = name;
  if (kind === 'event') {
    const artist = str(r.artist, 120);
    if (artist) out.artist = artist;
    const dateDisplay = str(r.dateDisplay, 120);
    if (dateDisplay) out.dateDisplay = dateDisplay;
    const d = typeof r.eventDate === 'string' ? r.eventDate.trim() : '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d)) && d >= todayBerlin()) out.eventDate = d;
    const venue = str(r.venueName, 160);
    if (venue) out.venueName = venue;
  } else {
    const pickup = str(r.pickupInfo, 600);
    if (pickup) out.pickupInfo = pickup;
    const cat = typeof r.category === 'string' ? r.category.trim() : '';
    if (SHOP_CATEGORIES.some((c) => c.key === cat)) out.category = cat;
  }
  const description = str(r.description, 1200);
  if (description) out.description = description;
  const address = str(r.address, 240);
  if (address) out.address = address;
  const city = str(r.city, 80);
  if (city) out.city = city;
  const cap = int(r.totalCapacity, 1, 200_000);
  if (cap) out.totalCapacity = cap;

  if (Array.isArray(r.tiers)) {
    const tiers: ProposedTier[] = [];
    for (const t of r.tiers.slice(0, MAX_TIERS)) {
      if (!t || typeof t !== 'object') continue;
      const o = t as Record<string, unknown>;
      const rawName = str(o.name, 60);
      // "early bird" → "Early bird": a ticket name is a label on a button.
      const tname = rawName ? rawName.charAt(0).toUpperCase() + rawName.slice(1) : undefined;
      const price = int(o.priceCents, 0, 5_000_000);
      if (!tname || price === undefined) continue; // no price said = not proposed
      tiers.push({
        name: tname,
        priceCents: price,
        cap: int(o.cap, 1, 200_000) ?? 0,
        description: str(o.description, 160) ?? '',
        studentOnly: o.studentOnly === true || /student/i.test(tname),
      });
    }
    if (tiers.length) out.tiers = tiers;
  }
  return out;
}

/**
 * Did the seller ask the assistant to come up with the content itself ("come
 * up with your own idea", "make a demo", "you decide", "suggest 10 items")?
 * Then — and only then — it may invent names, prices and descriptions, and
 * the reply says they are suggestions.
 */
export function wantsSuggestions(said: string): boolean {
  return (
    /\b(come up with|your own (idea|one)|make (it|one|a|me) up|make up|invent|suggest|you decide|up to you|surprise me|example|sample|demo|dummy|just (give|make|create)|create (me )?(a|an) |denk dir|ausdenken|beispiel|vorschlag|du entscheidest)/i.test(said) ||
    // Nepali: "yourself", "make it for me", "example", "demo", "suggest".
    /आफैं|आफै|बनाइदिनु|बनाइदेऊ|बनाइदिनुस्|उदाहरण|डेमो|सुझाव|तपाईं नै/.test(said)
  );
}

function prompt(kind: 'event' | 'shop', said: string): string {
  const today = todayBerlin();
  const cats = SHOP_CATEGORIES.map((c) => `${c.key} (${c.label})`).join(', ');
  return `You fill in a form for a Nepali ${kind === 'shop' ? 'shop selling goods' : 'event selling tickets'} in Germany, from what the seller wrote.
Today is ${today} (Europe/Berlin).

${wantsSuggestions(said) ? `SUGGESTION MODE — the seller asked you to come up with the content yourself:
- Invent a complete, realistic, appealing ${kind === 'shop' ? 'Nepali shop in Germany' : 'Nepali event in Germany'}: a name, a warm "description" (2–3 sentences), ${kind === 'shop' ? `a "category", "pickupInfo" (e.g. collection days and times, WITHOUT a street address)` : '"artist", a "dateDisplay" and future "eventDate", a "venueName" (a generic hall name)'} and ${kind === 'shop' ? 'items' : 'ticket types'} in "tiers" — as many as the seller asked for (default 6, at most 20), each with a real-sounding name, a realistic price in cents${kind === 'shop' ? ' (typical Nepali goods: €2–€40)' : ' (€10–€60)'}, "cap" 20–100 and a one-line "description".
- Use what the seller DID say (city, theme, count) and fill the rest yourself.
- Never invent a street address or anything about payment or bank details.
- "reply": say these are suggestions to check and change before filling in.
` : ''}STRICT RULES:
- ${wantsSuggestions(said) ? 'Apart from the suggestion mode above, use' : 'Use'} ONLY facts the seller stated. Never invent a price, date, time, address, capacity or name. If something was not said, leave that key out.
- Money: convert to integer cents (e.g. "25€", "25 euro", "EUR 25" -> 2500).
- ${kind === 'event' ? '"eventDate": the event day as YYYY-MM-DD (resolve words like "next Saturday" from today); "dateDisplay": that day written out, with doors/start time if said, e.g. "Saturday, 10 October 2026 · Doors 18:00".' : 'No dates. "pickupInfo": where/when buyers collect, only if said.'}
- ${kind === 'event' ? '"tiers" are ticket types' : '"tiers" are the items for sale'}: [{"name","priceCents","cap","description","studentOnly"}]; "cap" only if a quantity was said.
- ${kind === 'shop' ? `"category": one key from: ${cats} — only if clearly one of them.` : '"artist": performers, only if named. "venueName": the venue, only if named.'}
- LANGUAGE: write "description" and "reply" in the SAME language the seller wrote in — English if they wrote English, German if German, Nepali (Devanagari) if Nepali or romanised Nepali. Names of items may stay as the seller wrote them.
- "description": 1–3 friendly sentences built ONLY from the stated facts, no promises that were not made.
- "totalCapacity": total people/items, only if said. "city" and "address" only if said.
- "reply": one short sentence to the seller about what you filled and what is still missing (e.g. no date yet).

Return JSON: {"name","artist","description","dateDisplay","eventDate","venueName","address","city","totalCapacity","pickupInfo","category","tiers":[...],"reply"} with only the keys you can fill.

The seller wrote:
"""
${said.slice(0, 3000)}
"""`;
}

// ---------------------------------------------------------------------------
// Plain rules, for when there is no AI answer.
// ---------------------------------------------------------------------------

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, januar: 1, feb: 2, february: 2, februar: 2, mar: 3, march: 3, märz: 3, maerz: 3,
  apr: 4, april: 4, may: 5, mai: 5, jun: 6, june: 6, juni: 6, jul: 7, july: 7, juli: 7, aug: 8, august: 8,
  sep: 9, sept: 9, september: 9, oct: 10, october: 10, okt: 10, oktober: 10, nov: 11, november: 11,
  dec: 12, december: 12, dez: 12, dezember: 12,
};

export function rulesProposal(said: string, kind: 'event' | 'shop'): SetupProposal {
  const text = said.replace(/\s+/g, ' ');
  const out: Record<string, unknown> = {};
  // "Standard 25€", "VIP: €45", "momo 9.50 euro"
  const tiers: Record<string, unknown>[] = [];
  const priceRe = /([A-Za-zÀ-ž][A-Za-zÀ-ž0-9 ()'-]{1,40}?)\s*(?:[:\-–]|for|at|für|zu)?\s*(?:€|eur(?:o)?\s*)?\s*(\d{1,5}(?:[.,]\d{1,2})?)\s*(?:€|eur(?:o|os)?\b)/gi;
  const priceRe2 = /([A-Za-zÀ-ž][A-Za-zÀ-ž0-9 ()'-]{1,40}?)\s*(?:[:\-–]|for|at|für|zu)?\s*€\s*(\d{1,5}(?:[.,]\d{1,2})?)/gi;
  for (const re of [priceRe, priceRe2]) {
    for (const m of text.matchAll(re)) {
      const name = m[1].replace(/^(and|und|,)\s+/i, '').replace(/\b(tickets?|costs?|kostet|is|are)\b/gi, '').trim();
      if (!name || tiers.some((t) => t.name === name)) continue;
      tiers.push({ name: name.charAt(0).toUpperCase() + name.slice(1), priceCents: Math.round(Number(m[2].replace(',', '.')) * 100) });
    }
  }
  if (tiers.length) out.tiers = tiers;
  // "10 October 2026", "10. Oktober", "October 10"
  const d1 = /(\d{1,2})\.?\s+([A-Za-zä]{3,9})\.?(?:\s+(\d{4}))?/.exec(text);
  const d2 = /([A-Za-zä]{3,9})\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?/.exec(text);
  const pick = d1 && MONTHS[d1[2].toLowerCase()] ? { day: +d1[1], month: MONTHS[d1[2].toLowerCase()], year: d1[3] } : d2 && MONTHS[d2[1].toLowerCase()] ? { day: +d2[2], month: MONTHS[d2[1].toLowerCase()], year: d2[3] } : null;
  if (kind === 'event' && pick) {
    const today = todayBerlin();
    let year = pick.year ? +pick.year : +today.slice(0, 4);
    let iso = `${year}-${String(pick.month).padStart(2, '0')}-${String(pick.day).padStart(2, '0')}`;
    if (!pick.year && iso < today) {
      year += 1;
      iso = `${year}-${String(pick.month).padStart(2, '0')}-${String(pick.day).padStart(2, '0')}`;
    }
    out.eventDate = iso;
    out.dateDisplay = new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  }
  const cap = /(\d{2,6})\s*(?:people|persons|guests|seats|tickets|personen|gäste|plätze)/i.exec(text);
  if (cap) out.totalCapacity = Number(cap[1]);
  const city = /\b(?:in|at)\s+([A-ZÄÖÜ][a-zäöüß]+(?:\s+am\s+Main)?)\b/.exec(text);
  if (city) out.city = city[1];
  return normaliseProposal(out, kind);
}

/** Turn what the seller said into a proposal (AI first, plain rules as the fallback). */
export async function proposeSetup(said: string, kind: 'event' | 'shop'): Promise<SetupAnswer> {
  const suggested = wantsSuggestions(said);
  const raw = (await geminiJson(prompt(kind, said), {
    maxOutputTokens: suggested ? 6000 : 2000,
    timeoutMs: suggested ? 30_000 : 20_000,
  })) as Record<string, unknown> | null;
  if (raw && typeof raw === 'object') {
    const proposal = normaliseProposal(raw, kind);
    if (Object.keys(proposal).length > 0) {
      // A suggestion never carries an address, whatever came back.
      if (suggested) delete proposal.address;
      return {
        proposal,
        suggested,
        reply:
          str(raw.reply, 300) ??
          (suggested ? 'Here is a complete suggestion — change anything you like before filling it in.' : 'Here is what I can fill in — untick anything that is not right.'),
        source: 'ai',
      };
    }
  }
  const proposal = rulesProposal(said, kind);
  return {
    proposal,
    suggested: false,
    reply: Object.keys(proposal).length
      ? 'I picked out what I could — check each line, untick anything wrong, and add the rest in the chat or the form.'
      : suggested
        ? 'The AI helper is busy right now, so I cannot invent a shop for you this minute — try again shortly, or tell me your items and prices.'
      : 'I could not pick out details from that. Try something like: “Dashain party on 10 October in Berlin, 200 people, standard 25€, VIP 45€”.',
    source: 'rules',
  };
}
