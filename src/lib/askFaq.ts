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
    'The [1-minute video](/organizers#video) walks through it, or [try the seller side yourself](/demo).',
  de:
    'Wähle ein Event oder einen Laden, such dir Tickets oder Artikel aus und bezahle direkt beim Verkäufer — Überweisung, PayPal oder Karte, je nach Angebot. Dein QR-Code kommt per E-Mail: am Einlass zeigen oder beim Abholen. ' +
    'Das [1-Minuten-Video](/organizers#video) zeigt es, oder [probier die Verkäuferseite selbst aus](/demo).',
  ne:
    'कार्यक्रम वा पसल छान्नुहोस्, टिकट वा सामान रोज्नुहोस्, र बेच्नेलाई सिधै तिर्नुहोस् — बैंक ट्रान्सफर, PayPal वा कार्ड, जे उपलब्ध छ। QR कोड इमेलमा आउँछ: ढोकामा वा सामान लिँदा देखाउनुहोस्। ' +
    '[१ मिनेटको भिडियो](/organizers#video) हेर्नुहोस्, वा [आफैं डेमो चलाउनुहोस्](/demo)।',
  rn:
    'Event wa pasal channus, ticket wa saman rojnus, ani bechne lai sidhai tirnus — bank transfer, PayPal wa card, je cha. QR code email ma aaucha: dhoka ma wa saman lina jada dekhaunus. ' +
    '[1 minute ko video](/organizers#video) hernus, wa [aafai demo chalaunus](/demo).',
};

const SELL: Answers = {
  en:
    'Wonderful — it is free, with no commission, and the money goes straight to your own account. An AI helper fills in your page from a few words: tickets, menus, photos, payment. ' +
    '[Try it now in the demo](/demo) (no sign-up), see [how it works](/organizers), then [apply for your free account](/contact?intent=account) — a person approves it quickly.',
  de:
    'Super — kostenlos, ohne Provision, und das Geld geht direkt auf dein eigenes Konto. Ein KI-Helfer füllt deine Seite aus ein paar Worten: Tickets, Menüs, Fotos, Zahlung. ' +
    '[Jetzt in der Demo ausprobieren](/demo) (ohne Anmeldung), [so funktioniert es](/organizers), dann [kostenloses Konto beantragen](/contact?intent=account) — ein Mensch schaltet es schnell frei.',
  ne:
    'राम्रो — यो निःशुल्क छ, कमिसन छैन, र पैसा सिधै तपाईंको आफ्नै खातामा आउँछ। AI सहायकले केही शब्दबाट पेज भरिदिन्छ: टिकट, मेनु, फोटो, भुक्तानी। ' +
    '[अहिले डेमोमा चलाउनुहोस्](/demo) (साइन-अप चाहिँदैन), [कसरी चल्छ](/organizers) हेर्नुहोस्, अनि [निःशुल्क खाता माग्नुहोस्](/contact?intent=account)।',
  rn:
    'Ekdam ramro — yo free ho, commission chaina, ani paisa sidhai tapaiko aafno account ma aaucha. AI helper le kehi shabda bata page bhardincha: ticket, menu, photo, payment. ' +
    '[Ahile demo ma chalaunus](/demo) (sign-up chahidaina), [kasari chalcha](/organizers) hernus, ani [free account magnus](/contact?intent=account) — manche le chitto approve garcha.',
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

const TOPICS: { re: RegExp; answer: Answers }[] = [
  {
    // "How do I sell / put my event / open a shop", "event setup garna chahanchhu".
    re: /\b(how (do|can|could) (i|we) (sell|list|put|add|open|create|start|advertise)|i (want|would like) to (sell|put|list|add|open|create|advertise)|sell (my|our|tickets|food)|put my (event|shop)|become (a )?(seller|organi[sz]er)|wie (kann|verkaufe|biete) ich|ich (möchte|will) (mein|meine|verkaufen|anbieten)|(event|pasal|karyakram|restaurant) (setup|set up|khol\w*|rakh\w*|banau\w*)|setup garn\w*|kasari (bechne|rakhne|kholne)|bechna chahan\w*)\b|बेच्न|राख्न चाहन्छु|सेटअप/i,
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
  en: 'I could not answer that one just now — a person from the team can (button below). In short:',
  de: 'Das konnte ich gerade nicht beantworten — ein Mensch aus dem Team hilft gern (Button unten). Kurz gesagt:',
  ne: 'अहिले यसको उत्तर दिन सकिनँ — टिमका मानिसले मद्दत गर्नुहुन्छ (तलको बटन)। छोटकरीमा:',
  rn: 'Ahile yesko uttar dina sakina — team ko manche le help garcha (tala ko button). Chhotkari ma:',
};

/** When the AI is busy or unsure: say so briefly, then what the site is — never a dead end. */
export function fallbackAnswer(q: string): string {
  const lang = askLang(q);
  return `${SORRY[lang]} ${ABOUT[lang]}`;
}
