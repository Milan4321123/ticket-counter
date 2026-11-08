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
    'MartNepali is a studio for the Nepali community: we make apps, websites and ad & stage videos — ticketing with QR check-in, restaurant order-ahead, association websites, event ads and walk-on intros. See [our work](/studio), then [tell us what you need](/contact). ' +
    'The site itself is also home to [Nepali events](/events) and [the bazaar](/market) — and organizers and shops can [sell with us for free](/organizers).',
  de:
    'MartNepali ist ein Studio für die nepalesische Community: Wir machen Apps, Websites sowie Werbe- und Bühnenvideos — Ticketing mit QR-Einlass, Vorbestellung für Restaurants, Vereinswebsites, Event-Werbung und Walk-on-Intros. Sieh dir [unsere Arbeit](/studio) an und [sag uns, was du brauchst](/contact). ' +
    'Auf der Seite findest du außerdem [nepalesische Events](/events) und [den Basar](/market) — und Veranstalter und Läden [verkaufen hier kostenlos](/organizers).',
  ne:
    'MartNepali नेपाली समुदायका लागि स्टुडियो हो: हामी एप, वेबसाइट र विज्ञापन तथा स्टेज भिडियो बनाउँछौं — QR चेक-इनसहित टिकटिङ, रेस्टुरेन्टको अग्रिम अर्डर, संस्थाको वेबसाइट, कार्यक्रमका विज्ञापन र वाक-अन इन्ट्रो। [हाम्रो काम](/studio) हेर्नुहोस्, अनि [के चाहिन्छ भन्नुहोस्](/contact)। ' +
    'यही साइटमा [नेपाली कार्यक्रम](/events) र [बजार](/market) पनि छन् — आयोजक र पसलहरू [निःशुल्क बेच्न सक्छन्](/organizers)।',
  rn:
    'MartNepali Nepali samudaya ko lagi studio ho: hami app, website ra ad / stage video banauchau — QR check-in sanga ticketing, restaurant ko advance order, sanstha ko website, event ko ad ra walk-on intro. [Hamro kaam](/studio) hernus, ani [ke chahincha bhannus](/contact). ' +
    'Yahi site ma [Nepali event](/events) ra [bazaar](/market) pani cha — organizer ra pasal le [free ma bechna milcha](/organizers).',
};

const FREE: Answers = {
  en:
    'Yes — free. Browsing and buying cost nothing extra, and for sellers the page, the tickets, the QR codes and the tools are free with no commission. ' +
    'You pay the organizer or shop directly; the money never passes through us. [Sell with us](/organizers) · [apply for a free account](/contact?intent=account). The apps, websites and videos [we make](/studio) are free while we grow, too.',
  de:
    'Ja — kostenlos. Stöbern und Kaufen kostet nichts extra, und für Verkäufer sind Seite, Tickets, QR-Codes und Werkzeuge gratis, ohne Provision. ' +
    'Du bezahlst den Veranstalter oder Laden direkt; das Geld läuft nie über uns. [Bei uns verkaufen](/organizers) · [kostenloses Konto beantragen](/contact?intent=account). Auch die Apps, Websites und Videos, [die wir machen](/studio), sind kostenlos, solange wir wachsen.',
  ne:
    'हो — निःशुल्क। हेर्न र किन्न कुनै थप शुल्क लाग्दैन, र बेच्नेहरूका लागि पेज, टिकट, QR कोड र टुलहरू कमिसनबिना निःशुल्क छन्। ' +
    'तपाईं आयोजक वा पसललाई सिधै तिर्नुहुन्छ; पैसा हामीबाट हुँदै जाँदैन। [हामीसँग बेच्नुहोस्](/organizers) · [निःशुल्क खाता](/contact?intent=account)। [हामीले बनाउने](/studio) एप, वेबसाइट र भिडियो पनि अहिले निःशुल्क छन्।',
  rn:
    'Ho — free ho. Herna ra kinna kei extra lagdaina, ani bechne haru ko lagi page, ticket, QR code ra tools commission bina free chan. ' +
    'Paisa sidhai organizer wa pasal lai tirne ho; hamro haat bata jadaina. [Hamrosanga bechnus](/organizers) · [free account](/contact?intent=account). [Hamile banaune](/studio) app, website ra video pani ahile free chan.',
};

const HOW: Answers = {
  en:
    'Pick an event or a shop, choose your tickets or items, and pay the seller directly — bank transfer, PayPal or card, whatever they offer. Your QR code arrives by email: show it at the door, or when you collect your order. ' +
    '[Watch it in 1½ minutes](/events#watch) — or, if you sell, see [the seller side](/organizers#video).',
  de:
    'Wähle ein Event oder einen Laden, such dir Tickets oder Artikel aus und bezahle direkt beim Verkäufer — Überweisung, PayPal oder Karte, je nach Angebot. Dein QR-Code kommt per E-Mail: am Einlass zeigen oder beim Abholen. ' +
    '[In 1½ Minuten ansehen](/events#watch) — oder, wenn du verkaufst, [die Verkäuferseite](/organizers#video).',
  ne:
    'कार्यक्रम वा पसल छान्नुहोस्, टिकट वा सामान रोज्नुहोस्, र बेच्नेलाई सिधै तिर्नुहोस् — बैंक ट्रान्सफर, PayPal वा कार्ड, जे उपलब्ध छ। QR कोड इमेलमा आउँछ: ढोकामा वा सामान लिँदा देखाउनुहोस्। ' +
    '[१½ मिनेटमा हेर्नुहोस्](/events#watch) — बेच्नुहुन्छ भने [बेच्नेको भाग](/organizers#video)।',
  rn:
    'Event wa pasal channus, ticket wa saman rojnus, ani bechne lai sidhai tirnus — bank transfer, PayPal wa card, je cha. QR code email ma aaucha: dhoka ma wa saman lina jada dekhaunus. ' +
    '[1½ minute ma hernus](/events#watch) — bechnu huncha bhane [bechne ko bhag](/organizers#video).',
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
    '🎬 **Get one made** — an app, a website or an ad video for your event, association or shop: [see our work](/studio) · [tell us what you need](/contact).\n' +
    '🎟 **Go out** — [upcoming Nepali events](/events#events): concerts, Dashain and Tihar nights, tickets straight to your phone.\n' +
    '🥟 **Eat & shop** — [the bazaar](/market): momo, sweets, groceries and crafts to collect with a QR code. Try “items under 10 euro”.\n' +
    '🚀 **Sell** — put your own event, shop or restaurant here, free: [try the demo](/organizers).\n' +
    '▶ Or [watch how it all works](/events#watch) in 1½ minutes. Just tell me which one — or ask anything.',
  de:
    'Kein Problem — das kannst du hier machen:\n' +
    '🎬 **Machen lassen** — eine App, eine Website oder ein Werbevideo für dein Event, deinen Verein oder Laden: [unsere Arbeit](/studio) · [sag uns, was du brauchst](/contact).\n' +
    '🎟 **Ausgehen** — [kommende nepalesische Events](/events#events): Konzerte, Dashain- und Tihar-Abende, Tickets direkt aufs Handy.\n' +
    '🥟 **Essen & einkaufen** — [der Basar](/market): Momo, Süßes, Lebensmittel und Handwerk, abholen mit QR-Code. Probier „Artikel unter 10 Euro“.\n' +
    '🚀 **Verkaufen** — dein eigenes Event, deinen Laden oder dein Restaurant hier, kostenlos: [Demo ausprobieren](/organizers).\n' +
    'Sag einfach, was davon — oder frag irgendwas.',
  ne:
    'कुनै समस्या छैन — यहाँ यी गर्न सकिन्छ:\n' +
    '🎬 **बनाउन लगाउन** — कार्यक्रम, संस्था वा पसलका लागि एप, वेबसाइट वा विज्ञापन भिडियो: [हाम्रो काम](/studio) · [हामीलाई भन्नुहोस्](/contact)।\n' +
    '🎟 **घुम्न** — [आउँदा नेपाली कार्यक्रम](/events#events): कन्सर्ट, दशैं-तिहार साँझ, टिकट सिधै फोनमा।\n' +
    '🥟 **खान र किन्न** — [बजार](/market): मम, मिठाई, किराना र हस्तकला, QR कोडले लिनुहोस्।\n' +
    '🚀 **बेच्न** — आफ्नो कार्यक्रम, पसल वा रेस्टुरेन्ट यहाँ निःशुल्क: [डेमो चलाउनुहोस्](/organizers)।\n' +
    'कुन चाहिन्छ भन्नुहोस् — वा जे पनि सोध्नुहोस्।',
  rn:
    'Kei samasya chaina — yaha yo garna sakincha:\n' +
    '🎬 **Banaauna** — event, sanstha wa pasal ko lagi app, website wa ad video: [hamro kaam](/studio) · [hamilai bhannus](/contact).\n' +
    '🎟 **Ghumna** — [aauna lageka Nepali event](/events#events): concert, Dashain-Tihar saanjh, ticket sidhai phone ma.\n' +
    '🥟 **Khana ra kinna** — [bazaar](/market): momo, mithai, kirana ra hastakala, QR code le linus. “10 euro bhanda sasto khaja” lekhnus.\n' +
    '🚀 **Bechna** — aafno event, pasal wa restaurant yaha free ma: [demo chalaunus](/organizers).\n' +
    'Kun chahincha bhannus — wa je pani sodhnus.',
};

/** "Can you make me an app / a website / a video?" — the studio. */
const CUSTOM: Answers = {
  en:
    'Yes — we make apps, websites and ad & stage videos for the Nepali community: ticketing and door scanning, order-ahead for restaurants, shops, association websites, Reels ads, walk-on intros and stage screens. Free while we grow. ' +
    'See [our work](/studio), then tell us what you need: [an app](/contact?intent=app), [a website](/contact?intent=website) or [a video](/contact?intent=video) — or just [talk to us](/contact). A real person reads every message.',
  de:
    'Ja — wir machen Apps, Websites sowie Werbe- und Bühnenvideos für die nepalesische Community: Ticketing mit Einlass-Scan, Vorbestellung für Restaurants, Shops, Vereinswebsites, Reels-Werbung, Walk-on-Intros und Bühnen-Screens. Kostenlos, solange wir wachsen. ' +
    'Sieh dir [unsere Arbeit](/studio) an und sag uns, was du brauchst: [eine App](/contact?intent=app), [eine Website](/contact?intent=website) oder [ein Video](/contact?intent=video) — oder [schreib uns einfach](/contact).',
  ne:
    'हो — हामी नेपाली समुदायका लागि एप, वेबसाइट र विज्ञापन तथा स्टेज भिडियो बनाउँछौं: टिकट र ढोकामा स्क्यान, रेस्टुरेन्टको अग्रिम अर्डर, पसल, संस्थाको वेबसाइट, Reels विज्ञापन, वाक-अन इन्ट्रो र स्टेज स्क्रिन। हामी बढ्दै गर्दा निःशुल्क। ' +
    '[हाम्रो काम](/studio) हेर्नुहोस्, अनि भन्नुहोस्: [एप](/contact?intent=app), [वेबसाइट](/contact?intent=website) वा [भिडियो](/contact?intent=video) — वा [हामीलाई लेख्नुहोस्](/contact)।',
  rn:
    'Ho — hami Nepali samudaya ko lagi app, website ra ad / stage video banauchau: ticket ra dhoka ma scan, restaurant ko advance order, pasal, sanstha ko website, Reels ad, walk-on intro ra stage screen. Ahile free. ' +
    '[Hamro kaam](/studio) hernus, ani bhannus: [app](/contact?intent=app), [website](/contact?intent=website) wa [video](/contact?intent=video) — wa [hamilai lekhnus](/contact).',
};

/** "What have you built?" — the projects, in one breath. */
const WORK: Answers = {
  en:
    'Our own ticketing platform (the one you are on — QR tickets, door scanning, seat maps), a restaurant order-ahead app and online shops, the NPJOE e.V. website in three languages, and for Prakash Saput Live in Frankfurt: event ads, walk-on intros and stage screens. ' +
    'Every project and film is on [our work](/studio). Want one like these? [Talk to us](/contact).',
  de:
    'Unsere eigene Ticket-Plattform (die, auf der du gerade bist — QR-Tickets, Einlass-Scan, Saalpläne), eine Vorbestell-App für Restaurants und Online-Shops, die dreisprachige Website von NPJOE e.V. und für Prakash Saput Live in Frankfurt: Event-Werbung, Walk-on-Intros und Bühnen-Screens. ' +
    'Alle Projekte und Filme: [unsere Arbeit](/studio). So etwas für dich? [Schreib uns](/contact).',
  ne:
    'हाम्रो आफ्नै टिकटिङ प्लेटफर्म (तपाईं अहिले यसैमा हुनुहुन्छ — QR टिकट, ढोकामा स्क्यान, सिट नक्सा), रेस्टुरेन्टको अग्रिम अर्डर एप र अनलाइन पसल, तीन भाषामा NPJOE e.V. को वेबसाइट, र फ्रैंकफर्टको Prakash Saput Live का लागि विज्ञापन, वाक-अन इन्ट्रो र स्टेज स्क्रिन। ' +
    'सबै काम [हाम्रो काम](/studio) मा छ। यस्तै चाहनुहुन्छ? [हामीलाई भन्नुहोस्](/contact)।',
  rn:
    'Hamro aafnai ticketing platform (tapai ahile yasaimai hunuhuncha — QR ticket, dhoka ma scan, seat map), restaurant ko advance order app ra online pasal, tin bhasha ma NPJOE e.V. ko website, ani Frankfurt ko Prakash Saput Live ko lagi ad, walk-on intro ra stage screen. ' +
    'Sabai kaam [hamro kaam](/studio) ma cha. Yesto chahiyo? [Hamilai bhannus](/contact).',
};

/**
 * "How much does a website / an app / a video cost?" — never a number, a rate
 * or a quote (the operator is a student; see app/studio/page.tsx): free while
 * we grow, and the way in is a conversation.
 */
const STUDIO_COST: Answers = {
  en: 'It is free while we grow — no catch. Tell us what you need and when, and we make it with you: [talk to us](/contact). See [our work](/studio) for ideas.',
  de: 'Kostenlos, solange wir wachsen — ohne Haken. Sag uns, was du brauchst und bis wann, und wir machen es mit dir: [schreib uns](/contact). Ideen: [unsere Arbeit](/studio).',
  ne: 'हामी बढ्दै गर्दा यो निःशुल्क छ। के चाहिन्छ र कहिलेसम्म भन्नुहोस्, हामी तपाईंसँगै बनाउँछौं: [हामीलाई लेख्नुहोस्](/contact)। उदाहरण: [हाम्रो काम](/studio)।',
  rn: 'Ahile hami badhdai garda yo free ho. Ke chahincha ra kahile samma bhannus, hami sangai banauchau: [hamilai lekhnus](/contact). Udaharan: [hamro kaam](/studio).',
};

/** Words that make a question about the studio's work rather than the platform. */
const STUDIO_THING = String.raw`(\b(apps?|website|web ?site|webseite|homepage|videos?|ads?|advert\w*|promo\w*|walk-?on|stage ?screen|logo|design)\b|एप|वेबसाइट|भिडियो|विज्ञापन)`;
const MONEY_WORD = String.raw`(\b(cost|costs|price|prices|pricing|charge|charges|how much|rates?|budget|quote|fees?|kosten|kostet|preis\w*|angebot|kati|parcha|lagcha|lagchha)\b|कति|मूल्य|शुल्क)`;

const TOPICS: { re: RegExp; answer: Answers }[] = [
  {
    // "How much does a website cost?", "video ko kati parcha?" — never a price.
    re: new RegExp(`^(?=.*${MONEY_WORD})(?=.*${STUDIO_THING})`, 'i'),
    answer: STUDIO_COST,
  },
  {
    // "What have you built?", "show me your work", "was habt ihr gemacht?".
    re: /\b(what (have|did) you (built|build|made|make|done|do)|what do you (build|make)|your (work|projects?|portfolio|videos)|examples? of your|portfolio|showreel|studio|was (habt|macht) ihr|eure (arbeit|projekte)|ke ke banau\w*|hamro kaam|tapaiharu ko kaam)\b|हाम्रो काम|के के बनाउ/i,
    answer: WORK,
  },
  {
    // "What is this?" before the studio words, so "what is this website?" is not a request.
    re: /\b(what is (martnepali|this( site| page| app| platform)?|the site|it)|what('s| is) this|what (does|can) (this|the|martnepali)( site| page| app)? do|who are you|tell me about (martnepali|this site)|was ist (martnepali|das|diese seite)|was macht (martnepali|diese seite)|(martnepali|yo|yo site|yo page) ke ho|ke ho yo)\b|के हो|के गर्छ/i,
    answer: ABOUT,
  },
  {
    // "Can you make me an app / a website / a promo video?", "marketing for my event".
    re: /\b(website|web ?site|webseite|homepage|promo ?video|ad ?video|video (for|of) (my|our)|(make|create|design|build|develop) (me |us )?(a |an |my |our )?(own )?(app|video|website|page|poster|ad|advert)|(an? |my |our )app (for|like)|(do|can|could) you (make|build|do|create) (apps?|websites?|videos?)|advert\w*|marketing|werbung|custom (page|design|website|app)|walk-?on|stage ?screen|(video|website|app) bana(u|i)\w*|(video|website|app) chahiyo|(app|website|video) (erstellen|machen|bauen))\b|वेबसाइट|एप बनाउ|भिडियो बनाउ/i,
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
  'MartNepali is a STUDIO for the Nepali community (the homepage): the team makes apps, websites and ad & stage videos. Work so far: this ticketing platform (QR tickets, door scanning, seat maps), a restaurant order-ahead app with a kitchen board, online shops and the bazaar, the NPJOE e.V. association website (Deutsch, English, नेपाली), and for Prakash Saput Live (Frankfurt, 31 Oct 2026) event ads for Reels/TikTok/WhatsApp, walk-on intros and stage-screen loops. Every project and film: /studio.',
  'To ask for an app, a website or a video: /contact?intent=app, /contact?intent=website or /contact?intent=video (or /contact). A real person (Milan) reads every message and replies by email.',
  'Studio cost: NEVER state or estimate a price, rate, quote or package. It is free while we grow — ask them to tell us what they need (/contact).',
  'MartNepali also runs Nepali events (/events) and a bazaar of Nepali shops (/market) in Germany (Berlin, Frankfurt, Munich, Hamburg, Darmstadt and more).',
  'Buyers: find events and buy tickets; order food (momo, sweets), groceries, clothes, jewellery and crafts from shops and collect them with a QR code; a basket can hold items from several shops.',
  'Payment: buyers pay each organizer or shop DIRECTLY (bank transfer with a personal reference and a QR for the banking app, PayPal, or card where the seller offers it). The money never passes through MartNepali.',
  'After paying, QR tickets / collection codes arrive by email and are in the buyer account (/account). Sold-out events have a waitlist. Things not on sale yet can go on a wish list.',
  'Sellers (organizers, shops, restaurants, salons): completely free, no commission. An AI helper builds the page from a few words in a chat (tickets, menus, photos, payment). Features: ticket types, student tickets, table bookings, seat maps, pickup time slots, kitchen screen, door scanner, discount codes, referral rewards, subscribe & save, reviews, insights, pages in English, German and Nepali.',
  'To start selling: try the demo without signing up (/organizers), then apply for a free account (/contact?intent=account) — a person approves it. Seller sign-in: /portal/login.',
].join('\n');

/**
 * "Set up a shop with momo for 30 euro and topi for 20" — not a question about
 * selling but the request itself. The chat hands it to the setup assistant
 * (in a free demo), which builds the page from exactly these words.
 */
export function setupRequest(q: string): { kind: 'event' | 'shop' | 'restaurant' } | null {
  const t = q.toLowerCase();
  // "Make a website / an app / a video for my association" is a studio request
  // (the CUSTOM answer and /contact), not a page to build in the demo.
  if (/\b(website|webseite|web ?site|homepage|apps?|videos?|promo|advert\w*|walk-?on)\b|वेबसाइट|एप|भिडियो/i.test(t)) return null;
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
