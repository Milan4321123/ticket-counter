// The Ask chat's instant answers: the handful of questions nearly everybody
// asks first ("what is this?", "is it free?", "how do I sell?", "how do I
// pay?"), answered from here in the visitor's own language — no model, no
// wait, no daily cap, and never "I am not sure" on the site's own basics.
// Everything else still goes to the AI (api/ask), and when the AI is slow or
// down the chat falls back to ABOUT below rather than a dead end.
//
// Links are written inline as [label](/path) and must be pages in
// lib/siteAsk SITE_PAGES — answerLinks turns them into buttons.
export type AskLang = 'en' | 'de' | 'ne' | 'rn';

/** Which language to answer in: Devanagari, German, Roman Nepali, or English. */
export function askLang(q: string): AskLang {
  if (/[ऀ-ॿ]/.test(q)) return 'ne';
  const t = ` ${q.toLowerCase()} `;
  if (/[äöüß]|\b(was|wie|ist|ich|kann|und|kostet|verkaufen|bezahle|bezahlen|funktioniert|gibt|eine?|mein|meine|warum|wo)\b/.test(t)) return 'de';
  if (/\b(ke|ho|garna|garne|kasari|cha|chha|xa|mero|lagcha|lagchha|chahanchu|chahanchhu|kina|kaha|huncha|hunchha|paincha|garnu|tirne|kinne|bechne|rakhne|haru|pani|yo)\b/.test(t)) return 'rn';
  return 'en';
}

type Answers = Record<AskLang, string>;

export const ABOUT: Answers = {
  en:
    'MartNepali is where Nepali events and Nepali shops in Germany meet their people: buy tickets for concerts and festivals, and order momo, sweets, groceries and crafts to collect with a QR code. ' +
    'Browse [upcoming events](/#events) or [the bazaar](/market) — or, if you organize events or run a shop, [sell with us for free](/organizers). The [1-minute video](/organizers#video) shows it all.',
  de:
    'MartNepali bringt nepalesische Events und Läden in Deutschland zusammen: Tickets für Konzerte und Feste kaufen, Momo, Süßes, Lebensmittel und Handwerk bestellen und mit QR-Code abholen. ' +
    'Schau dir [kommende Events](/#events) oder [den Basar](/market) an — oder, wenn du Events veranstaltest oder einen Laden hast, [verkaufe kostenlos bei uns](/organizers). Das [1-Minuten-Video](/organizers#video) zeigt alles.',
  ne:
    'MartNepali जर्मनीका नेपाली कार्यक्रम र नेपाली पसलहरूको ठाउँ हो: कन्सर्ट र चाडपर्वका टिकट किन्नुहोस्, मम, मिठाई, किराना र हस्तकला अर्डर गरेर QR कोडले लिनुहोस्। ' +
    '[आउँदा कार्यक्रम](/#events) वा [बजार](/market) हेर्नुहोस् — कार्यक्रम वा पसल चलाउनुहुन्छ भने [निःशुल्क बेच्नुहोस्](/organizers)। [१ मिनेटको भिडियो](/organizers#video) ले सबै देखाउँछ।',
  rn:
    'MartNepali Germany ka Nepali event ra Nepali pasal haru ko thau ho: concert ra chadparva ko ticket kinna, ani momo, mithai, kirana ra hastakala order garera QR code le lina milcha. ' +
    '[Aauna lageka event](/#events) wa [bazaar](/market) hernus — event wa pasal chalaunu huncha bhane [free ma bechnus](/organizers). [1 minute ko video](/organizers#video) le sabai dekhaucha.',
};

const FREE: Answers = {
  en:
    'Yes — free. Browsing and buying cost nothing extra, and for sellers the page, the tickets, the QR codes and the tools are free with no commission. ' +
    'You pay the organizer or shop directly; the money never passes through us. [Sell with us](/organizers) · [apply for a free account](/contact?intent=account).',
  de:
    'Ja — kostenlos. Stöbern und Kaufen kostet nichts extra, und für Verkäufer sind Seite, Tickets, QR-Codes und Werkzeuge gratis, ohne Provision. ' +
    'Du bezahlst den Veranstalter oder Laden direkt; das Geld läuft nie über uns. [Bei uns verkaufen](/organizers) · [kostenloses Konto beantragen](/contact?intent=account).',
  ne:
    'हो — निःशुल्क। हेर्न र किन्न कुनै थप शुल्क लाग्दैन, र बेच्नेहरूका लागि पेज, टिकट, QR कोड र टुलहरू कमिसनबिना निःशुल्क छन्। ' +
    'तपाईं आयोजक वा पसललाई सिधै तिर्नुहुन्छ; पैसा हामीबाट हुँदै जाँदैन। [हामीसँग बेच्नुहोस्](/organizers) · [निःशुल्क खाता](/contact?intent=account)।',
  rn:
    'Ho — free ho. Herna ra kinna kei extra lagdaina, ani bechne haru ko lagi page, ticket, QR code ra tools commission bina free chan. ' +
    'Paisa sidhai organizer wa pasal lai tirne ho; hamro haat bata jadaina. [Hamrosanga bechnus](/organizers) · [free account](/contact?intent=account).',
};

const HOW: Answers = {
  en:
    'Pick an event or a shop, choose your tickets or items, and pay the seller directly — bank transfer, PayPal or card, whatever they offer. Your QR code arrives by email: show it at the door, or when you collect your order. ' +
    '[Watch it in 1½ minutes](/#watch) — or, if you sell, see [the seller side](/organizers#video).',
  de:
    'Wähle ein Event oder einen Laden, such dir Tickets oder Artikel aus und bezahle direkt beim Verkäufer — Überweisung, PayPal oder Karte, je nach Angebot. Dein QR-Code kommt per E-Mail: am Einlass zeigen oder beim Abholen. ' +
    '[In 1½ Minuten ansehen](/#watch) — oder, wenn du verkaufst, [die Verkäuferseite](/organizers#video).',
  ne:
    'कार्यक्रम वा पसल छान्नुहोस्, टिकट वा सामान रोज्नुहोस्, र बेच्नेलाई सिधै तिर्नुहोस् — बैंक ट्रान्सफर, PayPal वा कार्ड, जे उपलब्ध छ। QR कोड इमेलमा आउँछ: ढोकामा वा सामान लिँदा देखाउनुहोस्। ' +
    '[१½ मिनेटमा हेर्नुहोस्](/#watch) — बेच्नुहुन्छ भने [बेच्नेको भाग](/organizers#video)।',
  rn:
    'Event wa pasal channus, ticket wa saman rojnus, ani bechne lai sidhai tirnus — bank transfer, PayPal wa card, je cha. QR code email ma aaucha: dhoka ma wa saman lina jada dekhaunus. ' +
    '[1½ minute ma hernus](/#watch) — bechnu huncha bhane [bechne ko bhag](/organizers#video).',
};

const SELL: Answers = {
  en:
    'Wonderful — it is free, with no commission, and the money goes straight to your own account. An AI helper fills in your page from a few words: tickets, menus, photos, payment. ' +
    '[Build it now with the AI helper](/demo#build) (free demo, no sign-up), see [how it works](/organizers), then [apply for your free account](/contact?intent=account) — a person approves it quickly.',
  de:
    'Super — kostenlos, ohne Provision, und das Geld geht direkt auf dein eigenes Konto. Ein KI-Helfer füllt deine Seite aus ein paar Worten: Tickets, Menüs, Fotos, Zahlung. ' +
    '[Jetzt mit dem KI-Helfer bauen](/demo#build) (kostenlose Demo, ohne Anmeldung), [so funktioniert es](/organizers), dann [kostenloses Konto beantragen](/contact?intent=account) — ein Mensch schaltet es schnell frei.',
  ne:
    'राम्रो — यो निःशुल्क छ, कमिसन छैन, र पैसा सिधै तपाईंको आफ्नै खातामा आउँछ। AI सहायकले केही शब्दबाट पेज भरिदिन्छ: टिकट, मेनु, फोटो, भुक्तानी। ' +
    '[अहिले AI सहायकसँग बनाउनुहोस्](/demo#build) (निःशुल्क डेमो, साइन-अप चाहिँदैन), [कसरी चल्छ](/organizers) हेर्नुहोस्, अनि [निःशुल्क खाता माग्नुहोस्](/contact?intent=account)।',
  rn:
    'Ekdam ramro — yo free ho, commission chaina, ani paisa sidhai tapaiko aafno account ma aaucha. AI helper le kehi shabda bata page bhardincha: ticket, menu, photo, payment. ' +
    '[Ahile AI helper sanga banaunus](/demo#build) (free demo, sign-up chahidaina), [kasari chalcha](/organizers) hernus, ani [free account magnus](/contact?intent=account) — manche le chitto approve garcha.',
};

const PAY: Answers = {
  en:
    'You pay the organizer or shop directly — never us. At checkout you see their options: bank transfer with a personal reference (a QR code for your banking app is shown), PayPal, or card where they offer it. ' +
    'Once they see your payment, your QR code arrives by email and is always in [your account](/account).',
  de:
    'Du bezahlst den Veranstalter oder Laden direkt — nie uns. Beim Checkout siehst du ihre Optionen: Überweisung mit persönlicher Referenz (mit QR-Code für deine Banking-App), PayPal oder Karte, wo angeboten. ' +
    'Sobald die Zahlung da ist, kommt dein QR-Code per E-Mail und liegt immer in [deinem Konto](/account).',
  ne:
    'तपाईं आयोजक वा पसललाई सिधै तिर्नुहुन्छ — हामीलाई कहिल्यै होइन। चेकआउटमा विकल्प देखिन्छ: व्यक्तिगत रेफरेन्ससहित बैंक ट्रान्सफर (बैंकिङ एपका लागि QR), PayPal, वा कार्ड। ' +
    'भुक्तानी पुगेपछि QR कोड इमेलमा आउँछ र सधैं [तपाईंको खाता](/account) मा हुन्छ।',
  rn:
    'Tapai organizer wa pasal lai sidhai tirnu huncha — hamilai kahile pani haina. Checkout ma option dekhincha: personal reference sanga bank transfer (banking app ko lagi QR), PayPal, wa card. ' +
    'Payment pugepachi QR code email ma aaucha ra sadhai [tapaiko account](/account) ma huncha.',
};

const HELP: Answers = {
  en:
    'No problem — here is what you can do here:\n' +
    '🎟 **Go out** — [upcoming Nepali events](/#events): concerts, Dashain and Tihar nights, tickets straight to your phone.\n' +
    '🥟 **Eat & shop** — [the bazaar](/market): momo, sweets, groceries and crafts to collect with a QR code. Try “items under 10 euro”.\n' +
    '🚀 **Sell** — put your own event, shop or restaurant here, free: [try the demo](/organizers).\n' +
    '▶ Or [watch how it all works](/#watch) in 1½ minutes. Just tell me which one — or ask anything.',
  de:
    'Kein Problem — das kannst du hier machen:\n' +
    '🎟 **Ausgehen** — [kommende nepalesische Events](/#events): Konzerte, Dashain- und Tihar-Abende, Tickets direkt aufs Handy.\n' +
    '🥟 **Essen & einkaufen** — [der Basar](/market): Momo, Süßes, Lebensmittel und Handwerk, abholen mit QR-Code. Probier „Artikel unter 10 Euro“.\n' +
    '🚀 **Verkaufen** — dein eigenes Event, deinen Laden oder dein Restaurant hier, kostenlos: [Demo ausprobieren](/organizers).\n' +
    'Sag einfach, was davon — oder frag irgendwas.',
  ne:
    'कुनै समस्या छैन — यहाँ यी गर्न सकिन्छ:\n' +
    '🎟 **घुम्न** — [आउँदा नेपाली कार्यक्रम](/#events): कन्सर्ट, दशैं-तिहार साँझ, टिकट सिधै फोनमा।\n' +
    '🥟 **खान र किन्न** — [बजार](/market): मम, मिठाई, किराना र हस्तकला, QR कोडले लिनुहोस्।\n' +
    '🚀 **बेच्न** — आफ्नो कार्यक्रम, पसल वा रेस्टुरेन्ट यहाँ निःशुल्क: [डेमो चलाउनुहोस्](/organizers)।\n' +
    'कुन चाहिन्छ भन्नुहोस् — वा जे पनि सोध्नुहोस्।',
  rn:
    'Kei samasya chaina — yaha yo garna sakincha:\n' +
    '🎟 **Ghumna** — [aauna lageka Nepali event](/#events): concert, Dashain-Tihar saanjh, ticket sidhai phone ma.\n' +
    '🥟 **Khana ra kinna** — [bazaar](/market): momo, mithai, kirana ra hastakala, QR code le linus. “10 euro bhanda sasto khaja” lekhnus.\n' +
    '🚀 **Bechna** — aafno event, pasal wa restaurant yaha free ma: [demo chalaunus](/organizers).\n' +
    'Kun chahincha bhannus — wa je pani sodhnus.',
};

const CUSTOM: Answers = {
  en:
    'Want your own event page, a shop, a website or a promo video for Reels and WhatsApp? MartNepali sets it up with you — free while we grow. ' +
    'See [what we build](/studio), then [talk to us](/contact) — a person reads every message.',
  de:
    'Du möchtest eine eigene Event-Seite, einen Laden, eine Website oder ein Promo-Video für Reels und WhatsApp? MartNepali richtet es mit dir ein — kostenlos, solange wir wachsen. ' +
    'Sieh dir an, [was wir bauen](/studio), und [schreib uns](/contact).',
  ne:
    'आफ्नै कार्यक्रम पेज, पसल, वेबसाइट वा Reels/WhatsApp का लागि प्रमो भिडियो चाहनुहुन्छ? MartNepali ले निःशुल्क बनाइदिन्छ। ' +
    '[हामी के बनाउँछौं](/studio) हेर्नुहोस्, अनि [हामीलाई लेख्नुहोस्](/contact)।',
  rn:
    'Aafno event page, pasal, website wa Reels/WhatsApp ko lagi promo video chahiyo? MartNepali le sangai banaidincha — ahile free. ' +
    '[Hami ke banauchau](/studio) hernus, ani [hamilai lekhnus](/contact).',
};

const TOPICS: { re: RegExp; answer: Answers }[] = [
  {
    // "Can you make me a website / a promo video?", "marketing for my event".
    re: /\b(website|web ?site|webseite|promo ?video|video (for|of) (my|our)|(make|create|design|build) (me |us )?(a |an )?(video|website|page|poster|ad|advert)|advert\w*|marketing|werbung|custom (page|design|website)|video banau\w*|website banau\w*)\b/i,
    answer: CUSTOM,
  },
  {
    // "I am not sure what to do", "help", "keine Ahnung", "k garne thaha chaina".
    re: /^\s*(help|hi|hello|hey|hallo|namaste|namaskar|start|menu|\?+)\s*[!.?]*\s*$|\b(nots?\s?s?rue|not sure|dont know|don'?t know|no idea|what (can|should|do) i do|where (do|should) i start|what now|confused|lost|keine ahnung|was kann ich (hier )?(machen|tun)|k garne|ke garne|thaha chaina|thaha xaina|bujhina)\b|के गर्ने|थाहा छैन/i,
    answer: HELP,
  },
  {
    // "How do I sell / put my event / open a shop", "event setup garna chahanchhu".
    re: /\b((can|could|may) (i|we) (set ?up|create|make|put|list|add|sell|open|host|organi[sz]e|start|advertise|post|run)|(set ?up|create|make|host|organi[sz]e|list|post|add) (an? |my |our )?(own )?(event|shop|restaurant|concert|program|party|store|business)|how (do|can|could) (i|we) (sell|list|put|add|open|create|start|advertise|set ?up)|i (want|would like) to (sell|put|list|add|open|create|advertise)|sell (my|our|tickets|food)|put my (event|shop)|become (a )?(seller|organi[sz]er)|wie (kann|verkaufe|biete) ich|ich (möchte|will) (mein|meine|verkaufen|anbieten)|(event|pasal|karyakram|restaurant) (setup|set up|khol\w*|rakh\w*|banau\w*)|setup garn\w*|kasari (bechne|rakhne|kholne)|bechna chahan\w*)\b|बेच्न|राख्न चाहन्छु|सेटअप/i,
    answer: SELL,
  },
  {
    re: /\b(is (it|this|martnepali|the site) free|(does|do) (it|this|selling|using it) cost|how much (does|do) (it|you) (cost|charge|take)|any (fees?|commission)|what (are )?the fees|kostenlos|was kostet|gebühren?|provision|free ho|kati (paisa )?lag(cha|chha)|paisa lag(cha|chha))\b|निःशुल्क|कति लाग्छ|शुल्क/i,
    answer: FREE,
  },
  {
    re: /\b(how do i (pay|buy|order)|how (to|can i) (pay|buy|order)|how does (payment|paying|buying|ordering) work|payment methods?|wie (bezahle|kaufe|bestelle) ich|wie (zahlt|bezahlt) man|kasari (tirne|kinne|bhuktani|order)|payment kasari)\b|कसरी भुक्तानी|कसरी किन्ने|भुक्तानी कसरी/i,
    answer: PAY,
  },
  {
    re: /\b(how (does|do) (it|this|the site|the app|martnepali|everything) work|how it works|show me how|wie funktioniert|kasari chal(cha|chha|dai)|kasari kaam garcha)\b|कसरी चल्छ|कसरी काम/i,
    answer: HOW,
  },
  {
    re: /\b(what is (martnepali|this( site| page| app| platform)?|the site|it)|what('s| is) this|what (does|can) (this|the|martnepali)( site| page| app)? do|who are you|tell me about (martnepali|this site)|was ist (martnepali|das|diese seite)|was macht (martnepali|diese seite)|(martnepali|yo|yo site|yo page) ke ho|ke ho yo)\b|के हो|के गर्छ/i,
    answer: ABOUT,
  },
];

/** An instant answer to one of the basics, or null. */
export function quickAnswer(q: string): string | null {
  const text = q.trim();
  if (text.length > 140) return null;
  const hit = TOPICS.find((t) => t.re.test(text));
  return hit ? hit.answer[askLang(text)] : null;
}

/** The overview in the visitor's language — what the chat says when the AI cannot answer in time. */
export function aboutAnswer(q: string): string {
  return ABOUT[askLang(q)];
}

const SORRY: Record<AskLang, string> = {
  en: 'I did not quite catch that — tap “Talk to a person” below for anything special.',
  de: 'Das habe ich nicht ganz verstanden — für Besonderes tippe unten auf „Talk to a person“.',
  ne: 'मैले ठ्याक्कै बुझिनँ — विशेष कुराका लागि तलको “Talk to a person” थिच्नुहोस्।',
  rn: 'Maile thyakkai bujhina — bishesh kura ko lagi tala “Talk to a person” thichnus.',
};

/** When the AI is busy or unsure: a friendly menu of what the site does — never a dead end. */
export function fallbackAnswer(q: string): string {
  const lang = askLang(q);
  return `${HELP[lang]}\n\n${SORRY[lang]}`;
}

/**
 * What the homepage chat's AI is told about the site — short on purpose: a
 * 14,000-character manual made every answer slow enough to time out.
 */
export const ASK_CONTEXT = [
  'MartNepali: Nepali events and a bazaar of Nepali shops in Germany (Berlin, Frankfurt, Munich, Hamburg, Darmstadt and more).',
  'Buyers: find events and buy tickets; order food (momo, sweets), groceries, clothes, jewellery and crafts from shops and collect them with a QR code; a basket can hold items from several shops.',
  'Payment: buyers pay each organizer or shop DIRECTLY (bank transfer with a personal reference and a QR for the banking app, PayPal, or card where the seller offers it). The money never passes through MartNepali.',
  'After paying, QR tickets / collection codes arrive by email and are in the buyer account (/account). Sold-out events have a waitlist. Things not on sale yet can go on a wish list.',
  'Sellers (organizers, shops, restaurants, salons): completely free, no commission. An AI helper builds the page from a few words in a chat (tickets, menus, photos, payment). Features: ticket types, student tickets, table bookings, seat maps, pickup time slots, kitchen screen, door scanner, discount codes, referral rewards, subscribe & save, reviews, insights, pages in English, German and Nepali.',
  'To start selling: try the demo without signing up (/organizers), then apply for a free account (/contact?intent=account) — a person approves it. Seller sign-in: /portal/login.',
  'The team can design a custom page or a promo video on request (/contact).',
].join('\n');

/**
 * "Set up a shop with momo for 30 euro and topi for 20" — not a question about
 * selling but the request itself. The chat hands it to the setup assistant
 * (in a free demo), which builds the page from exactly these words.
 */
export function setupRequest(q: string): { kind: 'event' | 'shop' | 'restaurant' } | null {
  const t = q.toLowerCase();
  const build =
    /\b(set ?up|setup|create|make|build|open|start|banau\w*|khol\w*|erstell\w*|anleg\w*|eröffne\w*)\b.{0,20}\b(an? |my |our |mero |ein |einen |eine |meine?n? )?(own )?(shop|store|pasal|restaurant|kitchen|stall|event|concert|party|festival|program|programme|karyakram|laden|geschäft|veranstaltung|konzert|page|site|website|listing|seite)(s|en)?\b/i.test(t) ||
    /\b(shop|pasal|event|karyakram|restaurant)\s+(setup|set up|banau\w*|khol\w*)\b/i.test(t);
  // Only with something to build from — a price, an item, a name, a date.
  const details = /\d|€|\beuro|\bwith\b|\bmit\b|\bsanga\b|\bitems?\b|\bcalled\b|\bnamed\b|\bmenu\b|\btickets?\b/i.test(t);
  if (!build || !details) return null;
  const event = /\b(events?|concerts?|party|festival|program|programme|karyakram|veranstaltung|konzert|night|tickets?)\b/i.test(t);
  const shop = /\b(shop|store|pasal|restaurant|kitchen|stall|laden|geschäft|items?|menu|momo|food|khaja)\b/i.test(t);
  if (event && !shop) return { kind: 'event' };
  const food = /\b(restaurant|kitchen|momo|khaja|food|menu|thukpa|chowmein|dish|dishes|essen|gericht\w*|khana)\b/i.test(t);
  return { kind: food ? 'restaurant' : 'shop' };
}

const SETUP_SAY: Record<AskLang, (kind: 'event' | 'shop' | 'restaurant') => string> = {
  en: (k) => `Let’s build it! I am opening the setup assistant in a free demo with your request — it fills in your ${k} page, and you check it. Nothing goes live without you.`,
  de: (k) => `Los geht’s! Ich öffne den Einrichtungs-Assistenten in einer kostenlosen Demo mit deiner Anfrage — er füllt deine ${k === 'event' ? 'Event' : k === 'restaurant' ? 'Restaurant' : 'Laden'}-Seite aus, du prüfst sie. Nichts geht ohne dich online.`,
  ne: (k) => `बनाऔं! तपाईंको अनुरोधसहित निःशुल्क डेमोमा सेटअप सहायक खोल्दैछु — उसले ${k === 'event' ? 'कार्यक्रम' : k === 'restaurant' ? 'रेस्टुरेन्ट' : 'पसल'} पेज भर्छ, तपाईं जाँच्नुहोस्। तपाईंबिना केही लाइभ हुँदैन।`,
  rn: (k) => `Banaaun! Tapaiko request sanga free demo ma setup assistant kholdai chu — usle ${k === 'event' ? 'event' : k === 'restaurant' ? 'restaurant' : 'pasal'} page bhardincha, tapai check garnus. Tapai bina kei live hudaina.`,
};

export function setupSay(q: string, kind: 'event' | 'shop' | 'restaurant'): string {
  return SETUP_SAY[askLang(q)](kind);
}
