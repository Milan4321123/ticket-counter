// Instant answers on a listing's own page — no model, no wait, no quota.
//
// The questions nearly every visitor asks first ("what is this?", "who is
// organizing it?", "when?", "where?", "how much?", "how do I buy?") are all
// answered by the listing's own fields. Waiting for an AI to restate them was
// slow, and on a server with no AI at all every one of them ended in "I could
// not find that in the event details" — a dead end on the page's own basics.
//
// So these come first, straight from the listing, in the visitor's language
// (English, German or Roman Nepali — lib/askFaq askLang), and every answer
// points somewhere useful: the tickets, the organizer, or — for someone who
// wants a page or a video of their own — the team.
//
// Only facts the listing holds are ever stated; anything else is left to the
// AI (when there is one) or to the organizer.
import { askLang, type AskLang } from './askFaq';

export interface EventAskInput {
  kind: 'event' | 'shop';
  name: string;
  artist: string;
  description: string;
  dateDisplay: string;
  showTime: string;
  venueName: string;
  address: string;
  city: string;
  payWithinDays: number;
  organizerName: string;
  /** The seller's registered (legal) name when it differs, e.g. a Verein. */
  sellerLegalName: string;
  tiers: { name: string; priceDisplay: string; studentOnly: boolean; soldOut: boolean; free: boolean }[];
  faqs: { question: string; answer: string }[];
}

export interface QuickLink {
  label: string;
  href: string;
}

export interface EventAnswer {
  answer: string;
  links: QuickLink[];
}

type Intent = 'custom' | 'organizer' | 'refund' | 'arrive' | 'buy' | 'price' | 'when' | 'where' | 'about';

const INTENTS: [Intent, RegExp][] = [
  [
    'custom',
    /\b(my own (event|page|shop|website|site)|own (event|page|shop|website)|sell\w* (my|our|tickets|here|on)|(want|like) to sell|how (do|can) (i|we) sell|organi[sz]e (my|an|our)|website|promo ?video|video for|advert\w*|marketing|custom (page|design|site)|design (a|my)|eigene\w* (seite|event|veranstaltung)|werbung|webseite|afno|aafno|bechna|bechne)\b/i,
  ],
  [
    'organizer',
    /\b(who('s| is| are)? (organi[sz]\w*|responsible|running|hosting|behind|doing|making)|organi[sz]er|organi[sz]ed by|responsible|veranstalter|wer (organisiert|veranstaltet|steckt)|ayojak|aayojak|kasle|kasko|contact|kontakt|phone|whatsapp|reach (the|them))\b/i,
  ],
  ['refund', /\b(refund\w*|cancel\w*|money back|storn\w*|erstatt\w*|zurückgeb\w*|paisa firta)\b/i],
  ['arrive', /\b(when (will|do) i get|where is my ticket|ticket (come|arrive)|receive (my|the) ticket|email|e-mail|qr|got no ticket|kein ticket|ticket aayena)\b/i],
  ['buy', /\b(how (do|can|to) (i |we )?(buy|book|pay|order|get (a |the )?tickets?)|buy|booking|book|pay\w*|reserve|kaufen|bezahl\w*|buchen|kinne|kinna|kasari tirne|tirne)\b/i],
  ['price', /\b(price|prices|cost|costs|how much|fee|cheap|student|tickets?|euro|preis\w*|kostet|kosten|kati (ho|parcha|lagcha)|kati paisa|mol)\b|€/i],
  ['when', /\b(when|what time|date|day|doors?|starts|start time|begins|wann|uhrzeit|datum|einlass|kahile|kati baje|baje|samaya|bela)\b/i],
  ['where', /\b(where|venue|address|location|place|directions?|how (do i|to) get there|wo\b|ort|adresse|kaha|kahaa|thau)\b/i],
  [
    'about',
    /\b(what('s| is) (this|it|happening|the event|this event|this about)|tell me (about|more)|about (this|it)|details|worum|was ist (das|los)|ke ho|k ho|yo ke|ke cha|bare ma|programme? ke)\b|^\s*(info|details?|about)\s*\??\s*$/i,
  ],
];

/** Which of the common questions this is, if any. */
export function eventIntent(question: string): Intent | null {
  const q = question.toLowerCase();
  return INTENTS.find(([, re]) => re.test(q))?.[0] ?? null;
}

const STOP = new Set(
  'the a an is are do does i we you can to of for in on at it this that there be and or with my your what how when where who any will'.split(' ')
);

function words(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^a-zäöüßऀ-ॿ0-9]+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
}

/** The organizer's own FAQ entry for this question, when two real words match. */
function faqMatch(input: EventAskInput, question: string): string | null {
  const q = new Set(words(question));
  let best: { score: number; answer: string } | null = null;
  for (const f of input.faqs) {
    const score = words(f.question).filter((w) => q.has(w)).length;
    if (score >= 2 && (!best || score > best.score)) best = { score, answer: f.answer };
  }
  return best?.answer ?? null;
}

function when(input: EventAskInput): string {
  return [input.dateDisplay, input.showTime && !input.dateDisplay.includes(input.showTime) ? input.showTime : '']
    .filter(Boolean)
    .join(', ');
}

function where(input: EventAskInput): string {
  const city = input.city.trim();
  // "Auguststrasse 24, 10117 Berlin" already says Berlin.
  const cityShown = city && `${input.venueName} ${input.address}`.toLowerCase().includes(city.toLowerCase());
  return [input.venueName, input.address, cityShown ? '' : city].map((s) => s.trim()).filter(Boolean).filter((s, i, a) => a.indexOf(s) === i).join(', ');
}

function fromPrice(input: EventAskInput): string | null {
  const open = input.tiers.filter((t) => !t.soldOut);
  if (open.length === 0) return null;
  if (open.every((t) => t.free)) return 'free';
  const paid = open.filter((t) => !t.free);
  return paid[0]?.priceDisplay ?? null;
}

function soldOut(input: EventAskInput): boolean {
  return input.tiers.length > 0 && input.tiers.every((t) => t.soldOut);
}

/** Placeholder account names that must never be read out as a seller. */
const NO_NAME = /^(unknown|n\/?a|none|test|-+|\?+)$/i;

function seller(input: EventAskInput): string {
  const clean = (s: string) => (NO_NAME.test(s.trim()) ? '' : s.trim());
  const legal = clean(input.sellerLegalName);
  const name = clean(input.organizerName) || legal || 'the organizer';
  return legal && legal.toLowerCase() !== name.toLowerCase() ? `${name} (${legal})` : name;
}

/** "Tickets from €20 — grab yours." in the visitor's language; null when nothing is on sale. */
function nudge(input: EventAskInput, lang: AskLang): string {
  if (soldOut(input)) {
    return { en: 'It is sold out right now — join the waitlist on the page and you hear first if seats free up.', de: 'Gerade ausverkauft — trag dich auf der Seite in die Warteliste ein.', ne: 'अहिले टिकट सकियो — पेजमा waitlist मा नाम लेख्नुहोस्।', rn: 'Ahile ticket sakiyo — page ma waitlist ma naam lekhnus.' }[lang];
  }
  const from = fromPrice(input);
  if (!from) return '';
  const shop = input.kind === 'shop';
  if (from === 'free') {
    return { en: 'It is free — reserve your spot below.', de: 'Der Eintritt ist frei — sichere dir unten deinen Platz.', ne: 'निःशुल्क छ — तल आफ्नो ठाउँ बुक गर्नुहोस्।', rn: 'Free ho — tala aafno thau book garnus.' }[lang];
  }
  if (shop) {
    return { en: `Prices from ${from} — order below and collect with your QR code.`, de: `Preise ab ${from} — unten bestellen und mit QR-Code abholen.`, ne: `${from} देखि — तल अर्डर गर्नुहोस्।`, rn: `${from} dekhi — tala order garnus.` }[lang];
  }
  return {
    en: `Tickets from ${from} — get yours below before they sell out.`,
    de: `Tickets ab ${from} — hol dir deins unten, bevor sie weg sind.`,
    ne: `टिकट ${from} देखि — सकिनु अघि तल किन्नुहोस्।`,
    rn: `Ticket ${from} dekhi — sakinu agadi tala kinnus.`,
  }[lang];
}

const TICKETS_LINK = (input: EventAskInput): QuickLink[] =>
  soldOut(input) ? [] : [{ label: input.kind === 'shop' ? 'Order now' : 'Get tickets', href: '#tickets' }];

const CUSTOM_LINKS: QuickLink[] = [
  { label: 'Talk to us', href: '/contact' },
  { label: 'What we build', href: '/studio' },
];

function join(...parts: string[]): string {
  return parts.map((p) => p.trim()).filter(Boolean).join(' ');
}

function firstSentences(text: string, max = 260): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  return end > 80 ? cut.slice(0, end + 1) : `${cut.trimEnd()}…`;
}

/** The short "what is this" paragraph — used by 'about' and as the friendly fallback. */
export function eventSummary(input: EventAskInput, lang: AskLang = 'en'): string {
  const w = when(input);
  const p = where(input);
  const who = input.artist.trim();
  const desc = firstSentences(input.description);
  const head = {
    en: `${input.name}${who ? ` with ${who}` : ''}${w ? ` — ${w}` : ''}${p ? `, at ${p}` : ''}. Organized by ${seller(input)}.`,
    de: `${input.name}${who ? ` mit ${who}` : ''}${w ? ` — ${w}` : ''}${p ? `, in ${p}` : ''}. Veranstaltet von ${seller(input)}.`,
    ne: `${input.name}${who ? ` (${who})` : ''}${w ? ` — ${w}` : ''}${p ? `, ${p}` : ''}। आयोजक: ${seller(input)}।`,
    rn: `${input.name}${who ? ` — ${who}` : ''}${w ? `, ${w}` : ''}${p ? `, ${p} ma` : ''}. Aayojak: ${seller(input)}.`,
  }[lang];
  return join(head, desc);
}

/**
 * An instant answer for the common questions, or null to let the AI (or the
 * organizer) take it. The organizer's own FAQ wins when it clearly matches.
 */
export function instantEventAnswer(input: EventAskInput, question: string): EventAnswer | null {
  const lang = askLang(question);
  const faq = faqMatch(input, question);
  if (faq) return { answer: faq, links: TICKETS_LINK(input) };
  const intent = eventIntent(question);
  if (!intent) return null;
  const n = nudge(input, lang);
  switch (intent) {
    case 'custom':
      return {
        answer: {
          en: 'Want a page like this for your own event or shop — or a promo video for Reels and WhatsApp? It is free on MartNepali: tell us what you need and we set it up with you.',
          de: 'Du möchtest so eine Seite für dein eigenes Event oder deinen Laden — oder ein Promo-Video für Reels und WhatsApp? Bei MartNepali ist das kostenlos: sag uns, was du brauchst.',
          ne: 'आफ्नै कार्यक्रम वा पसलका लागि यस्तै पेज, वा Reels/WhatsApp का लागि प्रमो भिडियो चाहनुहुन्छ? MartNepali मा निःशुल्क छ — हामीलाई भन्नुहोस्।',
          rn: 'Aafno event wa pasal ko lagi yesto page, wa Reels/WhatsApp ko lagi promo video chahiyo? MartNepali ma free ho — hamilai bhannus, sangai setup garchau.',
        }[lang],
        links: CUSTOM_LINKS,
      };
    case 'organizer':
      return {
        answer: join(
          {
            en: `This ${input.kind === 'shop' ? 'shop is run' : 'event is organized'} by ${seller(input)} — they are the seller and you pay them directly. MartNepali only provides the page and the tickets. Ask them anything here, or use the WhatsApp button on the page if there is one.`,
            de: `${input.kind === 'shop' ? 'Der Laden gehört' : 'Veranstalter ist'} ${seller(input)} — du bezahlst direkt an sie. MartNepali stellt nur die Seite und die Tickets bereit. Frag hier oder über den WhatsApp-Button auf der Seite.`,
            ne: `यसका आयोजक ${seller(input)} हुन् — तपाईं उहाँहरूलाई सिधै तिर्नुहुन्छ। MartNepali ले पेज र टिकट मात्र दिन्छ। प्रश्न यहीँ सोध्नुहोस्।`,
            rn: `Yo ${input.kind === 'shop' ? 'pasal' : 'event'} ${seller(input)} le chalaunu bhako ho — paisa sidhai unlai tirne ho. MartNepali le page ra ticket matra dincha. Prashna yahi sodhnus, wa page ma WhatsApp button cha bhane tyaha.`,
          }[lang],
          n
        ),
        links: TICKETS_LINK(input),
      };
    case 'refund':
      return {
        answer: {
          en: `Refunds are decided by the organizer, ${seller(input)}, since you pay them directly. Ask them here — tap "send to the organizer" if I cannot answer — and keep your payment reference handy.`,
          de: `Über Erstattungen entscheidet der Veranstalter, ${seller(input)}, weil du direkt an ihn zahlst. Frag hier nach und halte deinen Verwendungszweck bereit.`,
          ne: `पैसा फिर्ताको निर्णय आयोजक ${seller(input)} ले गर्नुहुन्छ। यहीँ सोध्नुहोस्।`,
          rn: `Paisa firta ko kura aayojak ${seller(input)} le decide garnu huncha, kinaki paisa sidhai unlai tirne ho. Yahi sodhnus ani payment reference rakhnus.`,
        }[lang],
        links: [],
      };
    case 'arrive':
      return {
        answer: {
          en: 'Once your payment is confirmed, your QR ticket arrives by email (check spam too). It is also under "Your account" when you sign in with the same email. Show it on your phone or on paper at the door — each code works once.',
          de: 'Sobald die Zahlung bestätigt ist, kommt dein QR-Ticket per E-Mail (auch im Spam schauen). Du findest es auch unter „Dein Konto“ mit derselben E-Mail. Am Einlass auf dem Handy oder ausgedruckt zeigen.',
          ne: 'भुक्तानी पक्का भएपछि QR टिकट इमेलमा आउँछ (spam पनि हेर्नुहोस्)। ढोकामा फोनमा देखाउनुहोस्।',
          rn: 'Payment confirm bhaye pachi QR ticket email ma aaucha (spam pani hernus). Same email le sign in garda "Your account" ma pani huncha. Dhoka ma phone ma dekhaunus.',
        }[lang],
        links: [{ label: 'Your account', href: '/account' }],
      };
    case 'buy':
      return {
        answer: join(
          {
            en: `Choose your ${input.kind === 'shop' ? 'items' : 'tickets'} below, enter your name and email, and pay the organizer directly — no account needed. ${input.payWithinDays ? `A bank transfer should arrive within ${input.payWithinDays} days. ` : ''}Your QR code comes by email.`,
            de: `Wähle unten deine ${input.kind === 'shop' ? 'Artikel' : 'Tickets'}, gib Namen und E-Mail ein und bezahle direkt beim Veranstalter — kein Konto nötig. Dein QR-Code kommt per E-Mail.`,
            ne: 'तल टिकट छान्नुहोस्, नाम र इमेल लेख्नुहोस्, अनि आयोजकलाई सिधै तिर्नुहोस् — खाता चाहिँदैन। QR कोड इमेलमा आउँछ।',
            rn: `Tala ${input.kind === 'shop' ? 'saman' : 'ticket'} chhannus, naam ra email halnus, ani aayojak lai sidhai tirnus — account chahidaina. QR code email ma aaucha.`,
          }[lang],
          n
        ),
        links: TICKETS_LINK(input),
      };
    case 'price': {
      const lines = input.tiers.map((t) => `${t.name}: ${t.free ? 'free' : t.priceDisplay}${t.studentOnly ? ' (students, ID at the door)' : ''}${t.soldOut ? ' — sold out' : ''}`);
      if (!lines.length) return null;
      return { answer: join(lines.join(' · ') + '.', n), links: TICKETS_LINK(input) };
    }
    case 'when': {
      const w = when(input);
      if (!w) return null;
      return {
        answer: join({ en: `It is on ${w}.`, de: `Es ist am ${w}.`, ne: `${w} मा छ।`, rn: `${w} ma cha.` }[lang], n),
        links: TICKETS_LINK(input),
      };
    }
    case 'where': {
      const p = where(input);
      if (!p) return null;
      return {
        answer: join({ en: `It is at ${p}. The page has an "Open in Maps" button for directions.`, de: `Es findet statt in: ${p}. Auf der Seite gibt es einen Karten-Link.`, ne: `${p} मा छ।`, rn: `${p} ma cha. Page ma map ko button cha.` }[lang], n),
        links: TICKETS_LINK(input),
      };
    }
    case 'about':
      return { answer: join(eventSummary(input, lang), n), links: TICKETS_LINK(input) };
  }
}

/**
 * When nothing — not the instant answers, not the AI — could answer: still
 * say something useful. What the page is, who to ask, and the way in.
 */
export function fallbackEventAnswer(input: EventAskInput, question: string): string {
  const lang = askLang(question);
  const lead = {
    en: 'I do not have that detail on this page.',
    de: 'Das steht leider nicht auf dieser Seite.',
    ne: 'यो कुरा यो पेजमा छैन।',
    rn: 'Yo kura yo page ma chaina.',
  }[lang];
  const tail = {
    en: `Here is what I know: ${eventSummary(input, 'en')}`,
    de: `Das weiß ich: ${eventSummary(input, 'de')}`,
    ne: `मलाई थाहा भएको: ${eventSummary(input, 'ne')}`,
    rn: `Malai thaha bhako: ${eventSummary(input, 'rn')}`,
  }[lang];
  return join(lead, tail);
}

/** Links worth offering beside an AI answer, from the question alone. */
export function linksForQuestion(input: EventAskInput, question: string): QuickLink[] {
  const intent = eventIntent(question);
  if (intent === 'custom') return CUSTOM_LINKS;
  if (intent === 'arrive') return [{ label: 'Your account', href: '/account' }];
  if (intent === 'refund') return [];
  return TICKETS_LINK(input);
}
