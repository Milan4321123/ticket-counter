// Server-only: the homepage "Ask" bar. One line of text in, three kinds of
// help out, in this order:
//   1. WHERE TO GO — "my basket", "sell tickets", "try the demo": the page that
//      does it, as a button (and `go` when the text was plainly a command, so
//      the bar can open it straight away).
//   2. WHAT MATCHES — events, shops and items whose words contain every search
//      word ("momo berlin", "dashain", "sugam pokhrel"). Plain text search over
//      what is published; no AI, so it is instant and free.
//   3. AN ANSWER — only for a real question ("what can this site do?", "is it
//      free?"), from the platform's own knowledge base (lib/assistant), under
//      the daily AI caps.
// Every rule understands English, German, Nepali and Roman Nepali.
import { listPublishedEvents, mediaUrl, type EventRow } from './events';
import { listShopItems, searchShopItems } from './marketItems';
import { formatMoney } from './money';

export interface AskLink {
  label: string;
  href: string;
  icon: string;
}
export interface AskResult {
  kind: 'event' | 'shop' | 'item';
  title: string;
  sub: string;
  href: string;
  image: string | null;
}

const INTENTS: { re: RegExp; link: AskLink }[] = [
  { re: /\b(basket|cart|warenkorb|korb|tokari)\b|टोकरी|बास्केट/i, link: { label: 'Your basket', href: '/basket', icon: '🧺' } },
  { re: /\b(my (orders?|tickets?|account)|account|sign ?in|log ?in|konto|meine (bestellung|tickets)|anmelden|mero (ticket|order|khata))\b|मेरो (टिकट|अर्डर|खाता)|खाता/i, link: { label: 'Your account & tickets', href: '/account', icon: '👤' } },
  { re: /\b(sell|seller|organi[sz]er|open (a |my )?(shop|store)|create (an? )?(event|shop)|verkauf|veranstalter|bech(na|nu|chu)|pasal kholn)\w*|बेच्न|पसल खोल्न/i, link: { label: 'Sell with us — free', href: '/organizers', icon: '🚀' } },
  { re: /\b(demo|try (it|the app)|ausprobieren|testen)\b|डेमो/i, link: { label: 'Try the demo', href: '/demo', icon: '▶' } },
  { re: /\b(bazaar|bazar|market|basar|groceries|grocery|food|essen|khana|khaja)\b|बजार|खाना/i, link: { label: 'The bazaar', href: '/market', icon: '🛍' } },
  { re: /\b(portal|seller (login|hub)|organi[sz]er (login|sign))\b/i, link: { label: 'Seller sign-in', href: '/portal/login', icon: '🔑' } },
  { re: /\b(contact|support|help me|human|person|kontakt|hilfe|sampark)\b|सम्पर्क/i, link: { label: 'Talk to a person', href: '/contact', icon: '💬' } },
  { re: /\b(privacy|datenschutz|gdpr|dsgvo)\b/i, link: { label: 'Privacy', href: '/privacy', icon: '🔒' } },
];

/** "open my basket", "take me to…", "zeig mir…", "… khol" — do it, do not just offer it. */
const COMMAND =
  /^\s*(open|go( to)?|take me( to)?|show( me)?|bring me( to)?|öffne|zeig( mir)?|geh( zu)?|khol(nus|a)?|dekhau)\b|\b(khol(nus|a|dinus)?|dekhau(nus)?|öffnen|aufmachen)\s*[.!]?\s*$|(खोल्नुहोस्|खोल|देखाउनुहोस्)\s*[।.!]?\s*$/i;
const QUESTION =
  /\?\s*$|^\s*(how|what|why|when|where|who|which|can|could|is|are|do|does|will|should|wie|was|warum|wann|wo|kann|ist|sind|gibt|kasari|ke|k |kina|kaha|kun)\b|^\s*(कसरी|के|किन|कहाँ|कुन)/i;

const STOP = new Set(
  (
    'find show me search for looking look i want to the a an in at on near nearby some any events event shows show ' +
    'tickets ticket shop shops items item buy get where is are there please with and of from my your ' +
    'finde suche zeig mir ich will die der das ein eine in bei für nach gibt es bitte ' +
    'khoja khojnus dekhau chahiyo cha xa ma ko ra'
  ).split(' ')
);

function fold(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ß/g, 'ss')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function askIntents(q: string): { links: AskLink[]; go: boolean } {
  const links = INTENTS.filter((i) => i.re.test(q)).map((i) => i.link);
  return { links, go: links.length === 1 && COMMAND.test(q) };
}

export function isQuestion(q: string): boolean {
  return QUESTION.test(q.trim());
}

const today = () => new Date().toISOString().slice(0, 10);

/** Events, shops and items where every search word appears. */
export function askSearch(q: string): AskResult[] {
  const terms = fold(q)
    .split(' ')
    .filter((t) => t.length > 1 && !STOP.has(t));
  if (terms.length === 0) return [];
  const has = (hay: string) => terms.every((t) => hay.includes(t));

  const all = listPublishedEvents();
  const events = all
    .filter((e) => e.kind !== 'shop' && (!e.eventDate || e.eventDate >= today()))
    .filter((e) => has(fold([e.name, e.artist, e.city, e.venueName, e.dateDisplay, e.description.slice(0, 400)].join(' '))))
    .sort((a, b) => (a.eventDate ?? '9').localeCompare(b.eventDate ?? '9'))
    .slice(0, 4)
    .map((e) => ({
      kind: 'event' as const,
      title: e.name,
      sub: [e.dateDisplay || e.eventDate || '', e.city].filter(Boolean).join(' · '),
      href: `/e/${e.slug}`,
      image: pictureOf(e),
    }));

  const shops = all
    .filter((e) => e.kind === 'shop')
    .filter((e) => has(fold([e.name, e.artist, e.city, e.category, e.description.slice(0, 300)].join(' '))))
    .slice(0, 3)
    .map((e) => ({ kind: 'shop' as const, title: e.name, sub: e.city || 'Shop', href: `/e/${e.slug}`, image: pictureOf(e) }));

  const items = searchShopItems(listShopItems(), terms)
    .slice(0, 6)
    .map((it) => ({
      kind: 'item' as const,
      title: it.tier.name,
      sub: `${formatMoney(it.priceCents, it.currency)} · ${it.shopName}`,
      href: it.href,
      image: it.photo ? mediaUrl(it.photo.id, 'card', null) : null,
    }));

  return [...events, ...shops, ...items];
}

function pictureOf(e: EventRow): string | null {
  const id = e.posterMediaId || e.coverMediaId || e.profileMediaId;
  return id ? mediaUrl(id, 'card', null) : null;
}
