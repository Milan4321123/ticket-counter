// Three languages for the most-used parts of the site: English, Deutsch and
// नेपाली. Client-safe (no server imports) — the server reads the choice from
// the `lang` cookie (lib/i18nServer), client components receive it as a prop.
//
// Scope, stated honestly: the header, footer links, the homepage band, the
// bazaar's controls, the checkout's headings and buttons, and the seller hub's
// navigation and home screen. Long explanatory copy elsewhere stays English
// for now; a missing key always falls back to English, never to a blank.

export type Lang = 'en' | 'de' | 'ne';
export const LANGS: { code: Lang; label: string; short: string }[] = [
  { code: 'en', label: 'English', short: 'EN' },
  { code: 'de', label: 'Deutsch', short: 'DE' },
  { code: 'ne', label: 'नेपाली', short: 'ने' },
];
export const LANG_COOKIE = 'lang';

export function asLang(v: unknown): Lang {
  return v === 'de' || v === 'ne' ? v : 'en';
}

const D = {
  // header & footer
  'nav.browse': { en: 'Browse events', de: 'Events entdecken', ne: 'कार्यक्रमहरू' },
  'nav.browse.short': { en: 'Browse', de: 'Events', ne: 'कार्यक्रम' },
  'nav.events': { en: 'Events', de: 'Events', ne: 'कार्यक्रम' },
  'nav.search': { en: 'Search the bazaar', de: 'Basar durchsuchen', ne: 'बजारमा खोज्नुहोस्' },
  'nav.bazaar': { en: 'The bazaar', de: 'Der Basar', ne: 'बजार' },
  'nav.bazaar.short': { en: 'Bazaar', de: 'Basar', ne: 'बजार' },
  'nav.organizer': { en: 'Organizer sign in', de: 'Veranstalter-Login', ne: 'आयोजक लगइन' },
  'nav.organizer.short': { en: 'Organizer', de: 'Login', ne: 'आयोजक' },
  'nav.language': { en: 'Language', de: 'Sprache', ne: 'भाषा' },
  'skip': { en: 'Skip to the page', de: 'Zum Inhalt springen', ne: 'पृष्ठमा जानुहोस्' },

  // homepage
  'home.title': { en: 'Nepali events & bazaar, near you', de: 'Nepalesische Events & Basar in deiner Nähe', ne: 'तपाईंको नजिकै नेपाली कार्यक्रम र बजार' },
  'home.sub': {
    en: 'Tickets from Nepali organizers, goods from Nepali sellers — pay them directly, get a QR code by email.',
    de: 'Tickets von nepalesischen Veranstaltern, Waren von nepalesischen Händlern — direkt bezahlen, QR-Code per E-Mail.',
    ne: 'नेपाली आयोजकका टिकट, नेपाली विक्रेताका सामान — सिधै भुक्तानी गर्नुहोस्, इमेलमा QR कोड पाउनुहोस्।',
  },
  'home.onSale': { en: 'on sale', de: 'im Verkauf', ne: 'बिक्रीमा' },
  'home.inCities': { en: 'in {n} cities', de: 'in {n} Städten', ne: '{n} शहरमा' },
  'home.shop': { en: 'Shop the bazaar →', de: 'Zum Basar →', ne: 'बजार हेर्नुहोस् →' },
  'home.organizers': { en: 'For organizers', de: 'Für Veranstalter', ne: 'आयोजकहरूका लागि' },
  'home.demo': { en: 'Try the demo', de: 'Demo testen', ne: 'डेमो हेर्नुहोस्' },
  'home.picks': { en: 'Top picks', de: 'Top-Auswahl', ne: 'छानिएका सामान' },
  'home.seeAll': { en: 'See all', de: 'Alle ansehen', ne: 'सबै हेर्नुहोस्' },
  'bb.event': { en: 'Event', de: 'Event', ne: 'कार्यक्रम' },
  'bb.bazaar': { en: 'From the bazaar', de: 'Aus dem Basar', ne: 'बजारबाट' },
  'bb.free': { en: 'Free', de: 'Kostenlos', ne: 'निःशुल्क' },
  'bb.from': { en: 'from {price}', de: 'ab {price}', ne: '{price} देखि' },
  'bb.tickets': { en: 'Get tickets', de: 'Tickets holen', ne: 'टिकट लिनुहोस्' },
  'bb.order': { en: 'Order now', de: 'Jetzt bestellen', ne: 'अहिले अर्डर गर्नुहोस्' },

  // bazaar
  'bz.kicker': { en: 'The bazaar', de: 'Der Basar', ne: 'बजार' },
  'bz.title': { en: 'Nepali shops across Germany — order direct, collect with a QR code', de: 'Nepalesische Läden in ganz Deutschland — direkt bestellen, mit QR-Code abholen', ne: 'जर्मनीभरका नेपाली पसल — सिधै अर्डर, QR कोडले लिनुहोस्' },
  'bz.search': { en: 'Search', de: 'Suchen', ne: 'खोज्नुहोस्' },
  'bz.placeholder': { en: 'momo, timur, dhaka topi, Berlin…', de: 'Momo, Timur, Dhaka Topi, Berlin…', ne: 'मम, टिमुर, ढाका टोपी, बर्लिन…' },
  'bz.all': { en: 'All', de: 'Alle', ne: 'सबै' },
  'bz.items': { en: 'items', de: 'Artikel', ne: 'सामान' },
  'bz.item': { en: 'item', de: 'Artikel', ne: 'सामान' },
  'bz.inStock': { en: 'In stock only', de: 'Nur vorrätig', ne: 'स्टकमा मात्र' },
  'bz.sort': { en: 'Sort', de: 'Sortieren', ne: 'क्रम' },
  'bz.apply': { en: 'Apply', de: 'Anwenden', ne: 'लागू' },

  // checkout
  'co.title': { en: 'Checkout', de: 'Kasse', ne: 'चेकआउट' },
  'co.yourTickets': { en: 'Your tickets', de: 'Deine Tickets', ne: 'तपाईंका टिकट' },
  'co.yourOrder': { en: 'Your order', de: 'Deine Bestellung', ne: 'तपाईंको अर्डर' },
  'co.details': { en: 'Your details', de: 'Deine Angaben', ne: 'तपाईंको विवरण' },
  'co.fullName': { en: 'Full name', de: 'Vollständiger Name', ne: 'पूरा नाम' },
  'co.email': { en: 'Email address', de: 'E-Mail-Adresse', ne: 'इमेल ठेगाना' },
  'co.payment': { en: 'Payment', de: 'Bezahlung', ne: 'भुक्तानी' },
  'co.reserveSpot': { en: 'Reserve your spot', de: 'Platz reservieren', ne: 'स्थान आरक्षित गर्नुहोस्' },
  'co.seats': { en: 'Choose your seats', de: 'Plätze wählen', ne: 'सिट छान्नुहोस्' },
  'co.seatsHint': { en: 'Tap the seats you want — each is held for you as soon as you reserve.', de: 'Tippe auf die gewünschten Plätze — sie werden beim Reservieren für dich gehalten.', ne: 'चाहेका सिट छुनुहोस् — आरक्षण गर्नासाथ तपाईंका लागि राखिन्छ।' },
  'co.when': { en: 'When will you collect?', de: 'Wann holst du ab?', ne: 'कहिले लिन आउनुहुन्छ?' },
  'co.nothing': { en: 'Nothing selected yet.', de: 'Noch nichts ausgewählt.', ne: 'अहिलेसम्म केही छानिएको छैन।' },
  'co.total': { en: 'Total', de: 'Gesamt', ne: 'जम्मा' },

  // seller hub
  'hub.home': { en: 'Home', de: 'Start', ne: 'गृह' },
  'hub.reviews': { en: 'Reviews', de: 'Bewertungen', ne: 'समीक्षा' },
  'hub.codes': { en: 'Discount codes', de: 'Rabattcodes', ne: 'छुट कोड' },
  'hub.codes.short': { en: 'Codes', de: 'Codes', ne: 'कोड' },
  'hub.statements': { en: 'Statements', de: 'Abrechnungen', ne: 'विवरण' },
  'hub.money': { en: 'Money', de: 'Geld', ne: 'पैसा' },
  'hub.settings': { en: 'Settings', de: 'Einstellungen', ne: 'सेटिङ' },
  'hub.listings': { en: 'Your listings', de: 'Deine Angebote', ne: 'तपाईंका सूची' },
  'hub.viewBazaar': { en: 'View the bazaar', de: 'Basar ansehen', ne: 'बजार हेर्नुहोस्' },
  'hub.role': { en: 'Seller hub', de: 'Händler-Zentrale', ne: 'विक्रेता केन्द्र' },
  'hub.namaste': { en: 'Namaste', de: 'Namaste', ne: 'नमस्ते' },
  'hub.new': { en: '+ New event or shop', de: '+ Neues Event oder Laden', ne: '+ नयाँ कार्यक्रम वा पसल' },
  'hub.received': { en: 'Received', de: 'Erhalten', ne: 'प्राप्त' },
  'hub.onItsWay': { en: 'On its way', de: 'Unterwegs', ne: 'आउँदै' },
  'hub.sold': { en: 'Sold', de: 'Verkauft', ne: 'बिक्री' },
  'hub.scanned': { en: 'Scanned', de: 'Gescannt', ne: 'स्क्यान' },
  'hub.attention': { en: 'Needs your attention', de: 'Braucht deine Aufmerksamkeit', ne: 'ध्यान दिनुपर्ने' },
  'hub.tools': { en: 'Quick tools', de: 'Werkzeuge', ne: 'छिटो उपकरण' },
  'hub.yourListings': { en: 'Your events & shops', de: 'Deine Events & Läden', ne: 'तपाईंका कार्यक्रम र पसल' },
  'hub.allClear': { en: 'All caught up — nothing is waiting for you.', de: 'Alles erledigt — nichts wartet auf dich.', ne: 'सबै सकियो — केही बाँकी छैन।' },
  'hub.edit': { en: 'Edit', de: 'Bearbeiten', ne: 'सम्पादन' },
  'hub.orders': { en: 'Orders', de: 'Bestellungen', ne: 'अर्डर' },
  'hub.view': { en: 'View', de: 'Ansehen', ne: 'हेर्नुहोस्' },
} as const;

export type I18nKey = keyof typeof D;

/** The phrase in this language, with {n}-style placeholders filled in. */
export function t(lang: Lang, key: I18nKey, vars?: Record<string, string | number>): string {
  const entry = D[key] as Record<Lang, string>;
  let s = entry[lang] ?? entry.en;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
  return s;
}

/** A bound translator: const tr = translator(lang); tr('nav.bazaar'). */
export function translator(lang: Lang) {
  return (key: I18nKey, vars?: Record<string, string | number>) => t(lang, key, vars);
}
