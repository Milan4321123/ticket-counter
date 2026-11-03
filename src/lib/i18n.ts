// Three languages for the most-used parts of the site: English, Deutsch and
// नेपाली. Client-safe (no server imports) — the server reads the choice from
// the `lang` cookie (lib/i18nServer), client components receive it as a prop.
//
// Scope, stated honestly: the header, footer links, the studio homepage's
// headings and buttons (and /studio's), the events band, the
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
  'nav.studio': { en: 'Studio', de: 'Studio', ne: 'स्टुडियो' },
  'nav.contact': { en: 'Talk to us', de: 'Sprich mit uns', ne: 'कुरा गरौं' },
  'nav.basket': { en: 'Basket', de: 'Warenkorb', ne: 'टोकरी' },
  'nav.account': { en: 'Your account', de: 'Dein Konto', ne: 'तपाईंको खाता' },
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
  'pk.kicker': { en: 'Coming up', de: 'Demnächst', ne: 'आउँदै गरेका' },
  'pk.events': { en: 'events', de: 'Events', ne: 'कार्यक्रम' },
  'qt.bazaar': { en: 'The bazaar', de: 'Der Basar', ne: 'बजार' },
  'qt.bazaarSub': { en: '{n} goods from Nepali shops', de: '{n} Waren aus nepalesischen Läden', ne: 'नेपाली पसलका {n} सामान' },
  'qt.sell': { en: 'Sell with us', de: 'Hier verkaufen', ne: 'यहाँ बेच्नुहोस्' },
  'qt.sellSub': { en: 'Free for organizers & shops', de: 'Kostenlos für Veranstalter & Läden', ne: 'आयोजक र पसलका लागि निःशुल्क' },
  'qt.demo': { en: 'Try the demo', de: 'Demo testen', ne: 'डेमो हेर्नुहोस्' },
  'qt.demoSub': { en: 'See the seller tools', de: 'Die Verkäufer-Tools ansehen', ne: 'विक्रेता उपकरण हेर्नुहोस्' },
  'sr.kicker': { en: 'Order & collect', de: 'Bestellen & abholen', ne: 'अर्डर गर्नुहोस् र लिनुहोस्' },
  'sr.title': { en: 'Shops', de: 'Läden', ne: 'पसलहरू' },
  'sr.items': { en: '{n} items', de: '{n} Artikel', ne: '{n} सामान' },
  'bb.event': { en: 'Event', de: 'Event', ne: 'कार्यक्रम' },
  'bb.bazaar': { en: 'From the bazaar', de: 'Aus dem Basar', ne: 'बजारबाट' },
  'bb.free': { en: 'Free', de: 'Kostenlos', ne: 'निःशुल्क' },
  'bb.from': { en: 'from {price}', de: 'ab {price}', ne: '{price} देखि' },
  'bb.tickets': { en: 'Get tickets', de: 'Tickets holen', ne: 'टिकट लिनुहोस्' },
  'bb.order': { en: 'Order now', de: 'Jetzt bestellen', ne: 'अहिले अर्डर गर्नुहोस्' },

  // the studio homepage (app/page.tsx), /studio and components/studio
  'st.kicker': { en: 'MartNepali Studio', de: 'MartNepali Studio', ne: 'MartNepali स्टुडियो' },
  'st.title1': { en: 'Apps, websites & ad videos —', de: 'Apps, Websites & Werbevideos —', ne: 'एप, वेबसाइट र विज्ञापन भिडियो —' },
  'st.title2': { en: 'made for the Nepali community.', de: 'gemacht für die nepalesische Community.', ne: 'नेपाली समुदायका लागि बनाइएका।' },
  'st.lead': {
    en: 'We built the ticketing platform you are on, a website for a Nepali youth association, and the ads and stage screens for a Frankfurt concert night. Tell us what you need — we make it with you, free while we grow.',
    de: 'Wir haben die Ticket-Plattform gebaut, auf der du gerade bist, eine Website für einen nepalesischen Jugendverein und die Werbung und Bühnen-Screens für einen Konzertabend in Frankfurt. Sag uns, was du brauchst — wir machen es mit dir, kostenlos, solange wir wachsen.',
    ne: 'तपाईं अहिले हेर्दै गरेको टिकटिङ प्लेटफर्म, एउटा नेपाली युवा संस्थाको वेबसाइट, र फ्रैंकफर्टको कन्सर्टका विज्ञापन र स्टेज स्क्रिन हामीले बनाएका हौं। के चाहिन्छ भन्नुहोस् — हामी तपाईंसँगै बनाउँछौं, हामी बढ्दै गर्दा निःशुल्क।',
  },
  'st.cta': { en: 'Kura garau — tell us what you need', de: 'Kura garau — sag uns, was du brauchst', ne: 'कुरा गरौं — के चाहिन्छ भन्नुहोस्' },
  'st.seeWork': { en: 'See our work', de: 'Unsere Arbeit ansehen', ne: 'हाम्रो काम हेर्नुहोस्' },
  'st.recent': { en: 'Recent work', de: 'Aktuelle Arbeiten', ne: 'हालका काम' },
  'st.onPage': { en: 'On this page', de: 'Auf dieser Seite', ne: 'यस पृष्ठमा' },
  'st.make': { en: 'What we make', de: 'Was wir machen', ne: 'हामी के बनाउँछौं' },
  'st.projects': { en: 'Projects', de: 'Projekte', ne: 'परियोजना' },
  'st.videos': { en: 'Videos', de: 'Videos', ne: 'भिडियो' },
  'st.how': { en: 'How it works', de: 'So funktioniert’s', ne: 'कसरी हुन्छ' },
  'st.contact': { en: 'Contact', de: 'Kontakt', ne: 'सम्पर्क' },
  'st.make.title': { en: 'Three things, done properly', de: 'Drei Dinge, richtig gemacht', ne: 'तीन कुरा, राम्ररी' },
  'st.work.title': { en: 'We can make one like this for you', de: 'So etwas machen wir auch für dich', ne: 'यस्तै तपाईंका लागि पनि बनाउन सक्छौं' },
  'st.allWork': { en: 'All our work →', de: 'Alle Arbeiten →', ne: 'हाम्रा सबै काम →' },
  'st.live': { en: 'Live on MartNepali', de: 'Jetzt auf MartNepali', ne: 'MartNepali मा अहिले' },
  'st.allEvents': { en: 'All events →', de: 'Alle Events →', ne: 'सबै कार्यक्रम →' },
  'st.allEventsSub': { en: 'Tickets & the bazaar', de: 'Tickets & der Basar', ne: 'टिकट र बजार' },
  'st.videos.kicker': { en: 'Video work · {n} films', de: 'Videoarbeit · {n} Filme', ne: 'भिडियो काम · {n} फिल्म' },
  'st.videos.title': { en: 'Ads, walk-ons & stage screens', de: 'Werbung, Walk-ons & Bühnen-Screens', ne: 'विज्ञापन, वाक-अन र स्टेज स्क्रिन' },
  'st.seeAll': { en: 'See them all →', de: 'Alle ansehen →', ne: 'सबै हेर्नुहोस् →' },
  'st.videoAsk': { en: 'Want a video like this? Talk to us →', de: 'So ein Video für dich? Sprich mit uns →', ne: 'यस्तो भिडियो चाहिन्छ? हामीसँग कुरा गर्नुहोस् →' },
  'st.how.title': { en: 'From a few lines to live', de: 'Von ein paar Zeilen bis live', ne: 'केही लाइनदेखि लाइभसम्म' },
  'st.also': { en: 'Also on MartNepali', de: 'Außerdem auf MartNepali', ne: 'MartNepali मा अरू पनि' },
  'st.also.eventsSub': { en: 'Concerts & festival nights', de: 'Konzerte & Festabende', ne: 'कन्सर्ट र चाडपर्वका साँझ' },
  'st.also.bazaarSub': { en: 'Nepali shops & kitchens', de: 'Nepalesische Läden & Küchen', ne: 'नेपाली पसल र भान्सा' },
  'st.also.community': { en: 'Community', de: 'Community', ne: 'समुदाय' },
  'st.also.communitySub': { en: 'Meetups & help board', de: 'Treffen & Hilfe-Brett', ne: 'भेटघाट र सहयोग बोर्ड' },
  'st.h1': { en: 'Apps, websites & ad videos', de: 'Apps, Websites & Werbevideos', ne: 'एप, वेबसाइट र विज्ञापन भिडियो' },
  'st.ourWork': { en: 'MartNepali Studio · Our work', de: 'MartNepali Studio · Unsere Arbeit', ne: 'MartNepali स्टुडियो · हाम्रो काम' },
  'st.studioSub': {
    en: '{p} projects and {v} films, made for the Nepali community in Germany. Want one like these? Tell us — free while we grow.',
    de: '{p} Projekte und {v} Filme, gemacht für die nepalesische Community in Deutschland. So etwas für dich? Sag es uns — kostenlos, solange wir wachsen.',
    ne: 'जर्मनीको नेपाली समुदायका लागि बनाइएका {p} परियोजना र {v} फिल्म। यस्तै चाहिन्छ? भन्नुहोस् — हामी बढ्दै गर्दा निःशुल्क।',
  },
  'st.watchVideos': { en: 'Watch the videos', de: 'Videos ansehen', ne: 'भिडियो हेर्नुहोस्' },
  'st.kinds': { en: 'Kinds of video', de: 'Arten von Videos', ne: 'भिडियोका प्रकार' },
  'st.built': { en: 'What we have built', de: 'Was wir gebaut haben', ne: 'हामीले बनाएका' },
  'st.makeAll': { en: 'Apps, websites and videos', de: 'Apps, Websites und Videos', ne: 'एप, वेबसाइट र भिडियो' },
  'mk.apps': { en: 'Apps', de: 'Apps', ne: 'एप' },
  'mk.apps.line': { en: 'For organizers, restaurants and shops.', de: 'Für Veranstalter, Restaurants und Läden.', ne: 'आयोजक, रेस्टुरेन्ट र पसलका लागि।' },
  'mk.apps.cta': { en: 'Talk to us about an app', de: 'Sprich mit uns über eine App', ne: 'एपबारे कुरा गरौं' },
  'mk.websites': { en: 'Websites', de: 'Websites', ne: 'वेबसाइट' },
  'mk.websites.line': { en: 'For associations, businesses and festivals.', de: 'Für Vereine, Unternehmen und Festivals.', ne: 'संस्था, व्यवसाय र महोत्सवका लागि।' },
  'mk.websites.cta': { en: 'Talk to us about a website', de: 'Sprich mit uns über eine Website', ne: 'वेबसाइटबारे कुरा गरौं' },
  'mk.videos': { en: 'Ad & stage videos', de: 'Werbe- & Bühnenvideos', ne: 'विज्ञापन र स्टेज भिडियो' },
  'mk.videos.line': { en: 'For the sale, the stage and the screen.', de: 'Für den Verkauf, die Bühne und den Screen.', ne: 'बिक्री, स्टेज र स्क्रिनका लागि।' },
  'mk.videos.cta': { en: 'Talk to us about a video', de: 'Sprich mit uns über ein Video', ne: 'भिडियोबारे कुरा गरौं' },
  'how.1': { en: 'Tell us', de: 'Erzähl uns davon', ne: 'भन्नुहोस्' },
  'how.1.text': {
    en: 'A few lines in the chat — in Nepali, English or German. What it is for, who it is for, and when you need it.',
    de: 'Ein paar Zeilen im Chat — auf Nepali, Englisch oder Deutsch. Wofür, für wen und bis wann.',
    ne: 'च्याटमा केही लाइन — नेपाली, अंग्रेजी वा जर्मनमा। केका लागि, कसका लागि र कहिलेसम्म चाहिन्छ।',
  },
  'how.2': { en: 'We make it with you', de: 'Wir machen es mit dir', ne: 'हामी तपाईंसँगै बनाउँछौं' },
  'how.2.text': {
    en: 'You see the first screens or the first cut early, and say what to change. Your photos, your songs, your words.',
    de: 'Du siehst früh die ersten Screens oder den ersten Schnitt und sagst, was anders werden soll. Deine Fotos, deine Songs, deine Worte.',
    ne: 'पहिलो स्क्रिन वा पहिलो कट चाँडै देख्नुहुन्छ, र के बदल्ने भन्नुहुन्छ। तपाईंकै फोटो, गीत र शब्द।',
  },
  'how.3': { en: 'It goes live', de: 'Es geht live', ne: 'लाइभ हुन्छ' },
  'how.3.text': {
    en: 'Share it in your groups, on the big screen, on your phone — and we keep improving it with you.',
    de: 'Teile es in deinen Gruppen, auf der großen Leinwand, auf dem Handy — und wir verbessern es weiter mit dir.',
    ne: 'आफ्ना समूहमा, ठूलो स्क्रिनमा, फोनमा सेयर गर्नुहोस् — र हामी तपाईंसँगै सुधार्दै जान्छौं।',
  },
  'cta.title': { en: 'Need an app, a website or an ad video?', de: 'Brauchst du eine App, eine Website oder ein Werbevideo?', ne: 'एप, वेबसाइट वा विज्ञापन भिडियो चाहिन्छ?' },
  'cta.titleMore': { en: 'Want one like these?', de: 'So etwas für dich?', ne: 'यस्तै चाहिन्छ?' },
  'cta.text': {
    en: 'Tell us what you have in mind — we make it with you, free while we grow. A real person reads every message.',
    de: 'Sag uns, was du vorhast — wir machen es mit dir, kostenlos, solange wir wachsen. Jede Nachricht liest ein echter Mensch.',
    ne: 'मनमा के छ भन्नुहोस् — हामी तपाईंसँगै बनाउँछौं, हामी बढ्दै गर्दा निःशुल्क। हरेक सन्देश एक जना मान्छेले पढ्छ।',
  },
  'cta.app': { en: 'An app', de: 'Eine App', ne: 'एप' },
  'cta.website': { en: 'A website', de: 'Eine Website', ne: 'वेबसाइट' },
  'cta.video': { en: 'A video', de: 'Ein Video', ne: 'भिडियो' },
  'cta.note': { en: 'Milan replies by email.', de: 'Milan antwortet per E-Mail.', ne: 'Milan ले इमेलमा जवाफ दिनुहुन्छ।' },
  'reel.watch': { en: 'Watch the showreel', de: 'Showreel ansehen', ne: 'शोरिल हेर्नुहोस्' },
  'reel.sound': { en: '36 s · sound on', de: '36 s · mit Ton', ne: '३६ सेकेन्ड · आवाजसहित' },
  'pj.example': { en: 'Example project', de: 'Beispielprojekt', ne: 'उदाहरण परियोजना' },
  'pj.ticketing': { en: 'MartNepali ticketing platform', de: 'MartNepali Ticket-Plattform', ne: 'MartNepali टिकटिङ प्लेटफर्म' },
  'pj.restaurant': { en: 'Restaurant ordering app', de: 'Bestell-App fürs Restaurant', ne: 'रेस्टुरेन्ट अर्डर एप' },
  'pj.bazaar': { en: 'Online shops & the bazaar', de: 'Online-Shops & der Basar', ne: 'अनलाइन पसल र बजार' },
  'pj.npjoe': { en: 'NPJOE e.V. website', de: 'Website von NPJOE e.V.', ne: 'NPJOE e.V. को वेबसाइट' },
  'pj.community': { en: 'Community features', de: 'Community-Funktionen', ne: 'समुदायका सुविधा' },
  'tag.App': { en: 'App', de: 'App', ne: 'एप' },
  'tag.Website': { en: 'Website', de: 'Website', ne: 'वेबसाइट' },
  'tag.Video': { en: 'Video', de: 'Video', ne: 'भिडियो' },
  'vg.brand': { en: 'MartNepali ads', de: 'MartNepali-Werbung', ne: 'MartNepali विज्ञापन' },
  'vg.event': { en: 'Event ads', de: 'Event-Werbung', ne: 'कार्यक्रम विज्ञापन' },
  'vg.walkon': { en: 'Walk-on intros', de: 'Walk-on-Intros', ne: 'वाक-अन इन्ट्रो' },
  'vg.stage': { en: 'Stage screens & song visuals', de: 'Bühnen-Screens & Song-Visuals', ne: 'स्टेज स्क्रिन र गीत भिजुअल' },
  'vg.web': { en: 'Website promos', de: 'Website-Promos', ne: 'वेबसाइट प्रमो' },
  'pj.wedding': { en: 'Wedding invitation website', de: 'Website für die Hochzeitseinladung', ne: 'विवाह निम्तो वेबसाइट' },
  'pj.artist': { en: 'Artist page & press kit', de: 'Künstlerseite & Pressemappe', ne: 'कलाकार पेज र प्रेस किट' },
  'pj.quiz': { en: 'Live event quiz', de: 'Live-Quiz fürs Event', ne: 'कार्यक्रमको लाइभ क्विज' },
  'pj.live': { en: 'Live event dashboard', de: 'Live-Dashboard fürs Event', ne: 'कार्यक्रमको लाइभ ड्यासबोर्ड' },
  'pj.classes': { en: 'Class booking app', de: 'App zum Kurse-Buchen', ne: 'कक्षा बुकिङ एप' },
  'pj.samaj': { en: 'Association website kit', de: 'Website-Baukasten für Vereine', ne: 'संस्थाका लागि वेबसाइट किट' },
  'pj.tables': { en: 'QR table ordering', de: 'Bestellen per QR am Tisch', ne: 'टेबलबाट QR अर्डर' },
  'pj.kite': { en: 'Changa Chet! — a kite-fighting game', de: 'Changa Chet! — ein Drachenkampf-Spiel', ne: 'चङ्गा चेट! — चङ्गा लडाइँको खेल' },
  'pj.card': { en: 'Link page & business card maker', de: 'Linkseite & Visitenkarte zum Selbermachen', ne: 'लिङ्क पेज र बिजनेस कार्ड मेकर' },
  'pj.booth': { en: 'Event photo booth', de: 'Fotobox fürs Event', ne: 'कार्यक्रमको फोटो बुथ' },
  'pj.momo': { en: 'Momo food-truck app', de: 'App für den Momo-Foodtruck', ne: 'मःम फुड-ट्रक एप' },
  'pj.cup': { en: 'Futsal tournament app', de: 'App fürs Futsal-Turnier', ne: 'फुटसल प्रतियोगिता एप' },
  'pj.abc': { en: 'Kids’ Nepali alphabet app', de: 'Nepali-ABC-App für Kinder', ne: 'बालबालिकाका लागि नेपाली वर्णमाला एप' },
  'pj.radio': { en: 'Nepali radio + podcast site', de: 'Website für Nepali-Radio + Podcast', ne: 'नेपाली रेडियो र पोडकास्ट वेबसाइट' },
  'pj.saput': { en: 'Prakash Saput Live · Frankfurt', de: 'Prakash Saput Live · Frankfurt', ne: 'प्रकाश सपुत लाइभ · फ्रैंकफर्ट' },
  // project badges, the /studio filter, the demo strip, /work and demo prev / next
  'pb.demo': { en: 'Live demo', de: 'Live-Demo', ne: 'लाइभ डेमो' },
  'pb.real': { en: 'Real project', de: 'Echtes Projekt', ne: 'वास्तविक परियोजना' },
  'pf.label': { en: 'Show projects', de: 'Projekte zeigen', ne: 'परियोजना देखाउनुहोस्' },
  'pf.all': { en: 'All', de: 'Alle', ne: 'सबै' },
  'pf.apps': { en: 'Apps', de: 'Apps', ne: 'एप' },
  'pf.websites': { en: 'Websites', de: 'Websites', ne: 'वेबसाइट' },
  'pf.videos': { en: 'Videos', de: 'Videos', ne: 'भिडियो' },
  'pf.demos': { en: 'Live demos', de: 'Live-Demos', ne: 'लाइभ डेमो' },
  'pf.shown': { en: '{n} projects shown', de: '{n} Projekte angezeigt', ne: '{n} परियोजना देखाइएको' },
  'pf.films': { en: 'And {n} films in the video sections below →', de: 'Dazu {n} Filme weiter unten →', ne: 'साथै तलका भिडियो खण्डमा {n} फिल्म →' },
  'pf.gallery': { en: 'All live demos →', de: 'Alle Live-Demos →', ne: 'सबै लाइभ डेमो →' },
  'dm.kicker': { en: 'Try a live demo', de: 'Probier eine Live-Demo', ne: 'लाइभ डेमो चलाएर हेर्नुहोस्' },
  'dm.title': { en: 'Open one and play with it — right in your browser', de: 'Öffne eine und probier sie aus — direkt im Browser', ne: 'एउटा खोल्नुहोस् र चलाएर हेर्नुहोस् — सिधै ब्राउजरमै' },
  'dm.try': { en: 'Try it →', de: 'Ausprobieren →', ne: 'चलाएर हेर्नुहोस् →' },
  'dm.prev': { en: 'Previous demos', de: 'Vorherige Demos', ne: 'अघिल्ला डेमो' },
  'dm.next': { en: 'More demos', de: 'Weitere Demos', ne: 'थप डेमो' },
  'dm.note': {
    en: 'Demos with made-up names — nothing you type is sent anywhere.',
    de: 'Demos mit erfundenen Namen — nichts, was du eingibst, wird verschickt.',
    ne: 'काल्पनिक नामसहितका डेमो — तपाईंले लेखेको केही पनि कतै पठाइँदैन।',
  },
  'dm.want': { en: 'Want one like this?', de: 'So etwas für dich?', ne: 'यस्तै चाहिन्छ?' },
  'wk.kicker': { en: 'MartNepali Studio · Live demos', de: 'MartNepali Studio · Live-Demos', ne: 'MartNepali स्टुडियो · लाइभ डेमो' },
  'wk.h1': { en: 'Live demos you can try', de: 'Live-Demos zum Ausprobieren', ne: 'चलाएर हेर्न मिल्ने लाइभ डेमो' },
  'wk.sub': {
    en: '{n} apps and websites we built to show what is possible. Open one and tap around — free while we grow, and we can make one like it for you.',
    de: '{n} Apps und Websites, die wir gebaut haben, um zu zeigen, was geht. Öffne eine und tippe dich durch — kostenlos, solange wir wachsen, und so etwas machen wir auch für dich.',
    ne: 'के-के सम्भव छ देखाउन हामीले बनाएका {n} एप र वेबसाइट। एउटा खोलेर चलाएर हेर्नुहोस् — हामी बढ्दै गर्दा निःशुल्क, र यस्तै तपाईंका लागि पनि बनाउन सक्छौं।',
  },
  'wk.n': { en: 'Demo {i} of {n}', de: 'Demo {i} von {n}', ne: '{n} मध्ये डेमो {i}' },
  'wk.try': { en: 'What you can try', de: 'Was du ausprobieren kannst', ne: 'के-के चलाएर हेर्न सकिन्छ' },
  'wk.real': {
    en: 'Real projects — the NPJOE e.V. website, Prakash Saput Live and more — are on our work page →',
    de: 'Echte Projekte — die Website von NPJOE e.V., Prakash Saput Live und mehr — findest du bei unserer Arbeit →',
    ne: 'वास्तविक परियोजना — NPJOE e.V. को वेबसाइट, प्रकाश सपुत लाइभ र अरू — हाम्रो काम पेजमा छन् →',
  },
  // the idea builder (/work/build) — its card on /work, /studio and the homepage strip
  'bd.badge': { en: 'Idea builder', de: 'Ideen-Baukasten', ne: 'विचार बिल्डर' },
  'bd.title': { en: 'Build your idea', de: 'Bau deine Idee', ne: 'आफ्नो विचार बनाउनुहोस्' },
  'bd.text': {
    en: 'Pick what you are, a name, a colour and what it should do — a phone sketch builds itself as you go. Then send it to us in one tap.',
    de: 'Wähle, was du bist, einen Namen, eine Farbe und was es können soll — eine Handy-Skizze baut sich dabei selbst. Dann schick sie uns mit einem Tipp.',
    ne: 'तपाईं को हुनुहुन्छ, नाम, रङ र के-के गर्नुपर्छ छान्नुहोस् — फोनको स्केच आफैं बन्दै जान्छ। अनि एक ट्यापमा हामीलाई पठाउनुहोस्।',
  },
  'bd.line': {
    en: 'Sketch your own app or website and watch it build itself.',
    de: 'Skizziere deine eigene App oder Website und sieh zu, wie sie entsteht.',
    ne: 'आफ्नै एप वा वेबसाइटको स्केच बनाउनुहोस् र बन्दै गरेको हेर्नुहोस्।',
  },
  'bd.cta': { en: 'Build your idea →', de: 'Idee bauen →', ne: 'विचार बनाउनुहोस् →' },
  'bd.free': { en: 'Free while we grow · nothing is sent until you say so', de: 'Kostenlos, solange wir wachsen · nichts wird verschickt, bis du es willst', ne: 'हामी बढ्दै गर्दा निःशुल्क · तपाईंले नभनेसम्म केही पठाइँदैन' },
  'dn.label': { en: 'More demos', de: 'Weitere Demos', ne: 'थप डेमो' },
  'dn.prev': { en: '← Previous demo', de: '← Vorherige Demo', ne: '← अघिल्लो डेमो' },
  'dn.next': { en: 'Next demo →', de: 'Nächste Demo →', ne: 'अर्को डेमो →' },
  'dn.all': { en: 'All demos', de: 'Alle Demos', ne: 'सबै डेमो' },

  // bazaar
  'bz.kicker': { en: 'The bazaar', de: 'Der Basar', ne: 'बजार' },
  'bz.title': { en: 'Everything in one bazaar — event tickets, restaurant food and Nepali goods', de: 'Alles in einem Basar — Eventtickets, Essen aus Restaurants und nepalesische Waren', ne: 'सबै एउटै बजारमा — कार्यक्रमका टिकट, रेस्टुरेन्टको खाना र नेपाली सामान' },
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

/**
 * For keys built at run time (`pj.${project.id}`): the phrase when the
 * dictionary has it, `fallback` (usually the English source) when it does not.
 */
export function tMaybe(lang: Lang, key: string, fallback: string): string {
  const entry = (D as Record<string, Record<Lang, string> | undefined>)[key];
  return entry?.[lang] ?? fallback;
}

/** A bound translator: const tr = translator(lang); tr('nav.bazaar'). */
export function translator(lang: Lang) {
  return (key: I18nKey, vars?: Record<string, string | number>) => t(lang, key, vars);
}
