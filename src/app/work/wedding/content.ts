// Every word of the demo invitation, in English, Deutsch and नेपाली. The couple, the
// families and the venue are made up — this is a studio demo, not anybody's
// real wedding. Dates: 19–20 Feb 2027 = फागुन ७–८, २०८३ (lib/patro).

export type InviteLang = 'en' | 'de' | 'ne';

export const LANGS: { id: InviteLang; label: string; short: string }[] = [
  { id: 'en', label: 'English', short: 'EN' },
  { id: 'de', label: 'Deutsch', short: 'DE' },
  { id: 'ne', label: 'नेपाली', short: 'नेपाली' },
];
export function asInviteLang(v: unknown): InviteLang {
  return v === 'de' || v === 'ne' ? v : 'en';
}

export type ProgrammeItem = {
  id: 'mehendi' | 'janti' | 'bihe' | 'reception';
  /** Start and end in Frankfurt local time (CET, +01:00 in February). */
  start: string;
  end: string;
  place: 'home' | 'hall';
};

export const PROGRAMME: ProgrammeItem[] = [
  { id: 'mehendi', start: '2027-02-19T17:00:00+01:00', end: '2027-02-19T22:00:00+01:00', place: 'home' },
  { id: 'janti', start: '2027-02-20T09:30:00+01:00', end: '2027-02-20T11:00:00+01:00', place: 'hall' },
  { id: 'bihe', start: '2027-02-20T11:00:00+01:00', end: '2027-02-20T15:00:00+01:00', place: 'hall' },
  { id: 'reception', start: '2027-02-20T18:30:00+01:00', end: '2027-02-21T00:30:00+01:00', place: 'hall' },
];

/** The countdown runs to the ceremony itself. */
export const CEREMONY_AT = '2027-02-20T11:00:00+01:00';

export const VENUE = {
  name: 'Rhein-Main Festsaal',
  street: 'Musterstraße 12',
  city: '60311 Frankfurt am Main',
  // A generic map search — there is no real venue behind the demo.
  map: 'https://www.google.com/maps/search/?api=1&query=Frankfurt+am+Main',
};

type Copy = {
  langName: string;
  langLabel: string;
  navLabel: string;
  demo: string;
  invocation: string;
  kicker: string;
  bride: string;
  groom: string;
  invite: string;
  dateLine: string;
  bsLine: string;
  cityLine: string;
  rsvpCta: string;
  scroll: string;
  nav: { programme: string; venue: string; rsvp: string; faq: string };
  welcomeTitle: string;
  welcome: string;
  families: string;
  countdownTitle: string;
  units: [string, string, string, string];
  countdownDone: string;
  programmeTitle: string;
  programmeSub: string;
  events: Record<ProgrammeItem['id'], { name: string; day: string; time: string; text: string }>;
  places: Record<ProgrammeItem['place'], string>;
  addOne: string;
  addAll: string;
  venueTitle: string;
  venueDemo: string;
  venueNotes: string[];
  openMap: string;
  dressTitle: string;
  dressText: string;
  dressAvoid: string;
  dressWarm: string;
  swatches: string[];
  galleryTitle: string;
  gallerySub: string;
  tiles: string[];
  close: string;
  rsvpTitle: string;
  rsvpSub: string;
  rsvpBy: string;
  fName: string;
  fNamePh: string;
  fComing: string;
  yes: string;
  no: string;
  fGuests: string;
  fewer: string;
  more: string;
  fWhich: string;
  fFood: string;
  veg: string;
  nonveg: string;
  fMessage: string;
  fMessagePh: string;
  send: string;
  needName: string;
  demoNote: string;
  thanksYes: (name: string) => string;
  thanksNo: (name: string) => string;
  thanksYesText: string;
  thanksNoText: string;
  summaryGuests: (n: number) => string;
  edit: string;
  faqTitle: string;
  faq: { q: string; a: string }[];
  shareTitle: string;
  shareText: string;
  whatsapp: string;
  copy: string;
  copied: string;
  waMessage: string;
  footer: string;
  icsTitle: string;
};

export const COPY: Record<InviteLang, Copy> = {
  en: {
    langName: 'English',
    langLabel: 'Language',
    navLabel: 'Invitation',
    demo: 'Demo',
    invocation: '॥ श्री गणेशाय नमः ॥',
    kicker: 'Shubha Vivaha · You are invited',
    bride: 'Aarati',
    groom: 'Sujan',
    invite: 'request the joy of your company as they begin their life together',
    dateLine: 'Saturday · 20 February 2027',
    bsLine: 'Falgun 8, 2083 B.S.',
    cityLine: 'Frankfurt am Main',
    rsvpCta: 'Reply to the invitation',
    scroll: 'Scroll',
    nav: { programme: 'Programme', venue: 'Venue', rsvp: 'RSVP', faq: 'FAQ' },
    welcomeTitle: 'Namaste, dear friends',
    welcome:
      'Two families, two cities, one big Nepali celebration. With the blessings of our elders, we would love to have you with us — for the henna, the Janti, the ceremony and a long night of dancing.',
    families: 'With love, the Bhandari & Karki families',
    countdownTitle: 'Until the ceremony',
    units: ['days', 'hours', 'minutes', 'seconds'],
    countdownDone: 'Today we celebrate!',
    programmeTitle: 'Programme',
    programmeSub: 'Two days, four moments. Come to as many as you can.',
    events: {
      mehendi: {
        name: 'Mehendi',
        day: 'Friday, 19 Feb',
        time: '17:00',
        text: 'Henna, songs and dancing with the bride’s side. Come early, stay late.',
      },
      janti: {
        name: 'Swayambar & Janti',
        day: 'Saturday, 20 Feb',
        time: '09:30',
        text: 'The groom’s procession arrives with panche baja, and the garlands are exchanged.',
      },
      bihe: {
        name: 'Bihe — the ceremony',
        day: 'Saturday, 20 Feb',
        time: '11:00',
        text: 'Around the sacred fire: sindoor, pote and the seven steps together.',
      },
      reception: {
        name: 'Reception',
        day: 'Saturday, 20 Feb',
        time: '18:30',
        text: 'Dinner, a few short speeches and a dance floor until late.',
      },
    },
    places: { home: 'Family home · Offenbach (address with your reply)', hall: 'Rhein-Main Festsaal' },
    addOne: 'Add to calendar',
    addAll: 'Add all four to your calendar',
    venueTitle: 'Venue',
    venueDemo: 'Demo venue — the map opens Frankfurt',
    venueNotes: ['5 minutes on foot from the S-Bahn', 'Free parking behind the hall', 'Step-free entrance, lift to the hall'],
    openMap: 'Open in Maps',
    dressTitle: 'Dress code',
    dressText:
      'Festive and colourful: daura-suruwal and dhaka topi, saris, kurtas and lehengas are all welcome — so is your best suit.',
    dressAvoid: 'Please avoid all-white and all-black outfits.',
    dressWarm: 'It is February in Frankfurt — bring a warm shawl for the Janti outside.',
    swatches: ['Sindoor red', 'Marigold', 'Gold', 'Leaf green', 'Rani pink'],
    galleryTitle: 'Gallery',
    gallerySub: 'After the wedding, the photos of the day will appear here.',
    tiles: ['Marigold', 'Dhaka', 'Diya', 'Mandala', 'Himal', 'Pote'],
    close: 'Close',
    rsvpTitle: 'Will you join us?',
    rsvpSub: 'A short reply helps us plan the food, the seats and the dancing.',
    rsvpBy: 'Please reply by 20 January 2027',
    fName: 'Your name',
    fNamePh: 'e.g. Maya Gurung',
    fComing: 'Will you come?',
    yes: 'Joyfully, yes',
    no: 'Sadly, no',
    fGuests: 'How many of you?',
    fewer: 'One guest fewer',
    more: 'One guest more',
    fWhich: 'Which programmes?',
    fFood: 'Food',
    veg: 'Vegetarian',
    nonveg: 'Non-veg',
    fMessage: 'A wish for the couple (optional)',
    fMessagePh: 'Write a few words…',
    send: 'Send my reply',
    needName: 'Please write your name.',
    demoNote: 'Demo: your reply stays in this browser only — nothing is sent anywhere.',
    thanksYes: (n) => `Dhanyabad, ${n}!`,
    thanksNo: (n) => `We will miss you, ${n}`,
    thanksYesText: 'Your place is saved. We can’t wait to celebrate with you.',
    thanksNoText: 'Thank you for letting us know. We will send you photos of the day.',
    summaryGuests: (n) => (n === 1 ? '1 guest' : `${n} guests`),
    edit: 'Change my reply',
    faqTitle: 'Good to know',
    faq: [
      {
        q: 'New to a Nepali wedding — what happens?',
        a: 'Janti is the groom’s procession with music, Swayambar is the exchange of garlands, and the Bihe is the ceremony itself. Just come, eat well and dance — somebody will happily explain the rest.',
      },
      { q: 'Can I bring the children?', a: 'Of course — children are part of every Nepali wedding. Count them in your reply.' },
      {
        q: 'Is there vegetarian food?',
        a: 'Yes: dal bhat, sel roti, aloo dum and plenty more. Choose in your reply and we will make sure there is enough.',
      },
      {
        q: 'What about gifts?',
        a: 'Your presence is the gift. If you wish, a small envelope (shagun) for the couple is a lovely tradition.',
      },
      { q: 'When should I arrive?', a: 'About 15 minutes before each programme — the Janti waits for no one!' },
    ],
    shareTitle: 'Share the invitation',
    shareText: 'Send it to family and friends — it opens on any phone.',
    whatsapp: 'Send on WhatsApp',
    copy: 'Copy link',
    copied: 'Link copied',
    waMessage: 'You are invited! Aarati & Sujan — 20 Feb 2027, Frankfurt (a MartNepali demo invitation):',
    footer: 'With love, Aarati & Sujan',
    icsTitle: 'Aarati & Sujan',
  },
  de: {
    langName: 'Deutsch',
    langLabel: 'Sprache',
    navLabel: 'Einladung',
    demo: 'Demo',
    invocation: '॥ श्री गणेशाय नमः ॥',
    kicker: 'Shubha Vivaha · Du bist eingeladen',
    bride: 'Aarati',
    groom: 'Sujan',
    invite: 'freuen sich von Herzen auf dich, wenn sie ihren gemeinsamen Weg beginnen',
    dateLine: 'Samstag · 20. Februar 2027',
    bsLine: '8. Falgun 2083 (Bikram Sambat)',
    cityLine: 'Frankfurt am Main',
    rsvpCta: 'Auf die Einladung antworten',
    scroll: 'Nach unten',
    nav: { programme: 'Programm', venue: 'Ort', rsvp: 'Zusage', faq: 'FAQ' },
    welcomeTitle: 'Namaste, liebe Freundinnen und Freunde',
    welcome:
      'Zwei Familien, zwei Städte, ein großes nepalesisches Fest. Mit dem Segen unserer Eltern und Großeltern möchten wir dich gern dabeihaben — beim Henna, bei der Janti, bei der Trauung und in einer langen Nacht voller Tanz.',
    families: 'Von Herzen, die Familien Bhandari & Karki',
    countdownTitle: 'Bis zur Trauung',
    units: ['Tage', 'Stunden', 'Minuten', 'Sekunden'],
    countdownDone: 'Heute wird gefeiert!',
    programmeTitle: 'Programm',
    programmeSub: 'Zwei Tage, vier Momente. Komm zu so vielen, wie du kannst.',
    events: {
      mehendi: {
        name: 'Mehendi',
        day: 'Freitag, 19. Feb.',
        time: '17:00',
        text: 'Henna, Lieder und Tanz mit der Familie der Braut. Komm früh, bleib lange.',
      },
      janti: {
        name: 'Swayambar & Janti',
        day: 'Samstag, 20. Feb.',
        time: '09:30',
        text: 'Der Zug des Bräutigams kommt mit Panche Baja an, der traditionellen Hochzeitsmusik, und das Paar tauscht die Blumengirlanden.',
      },
      bihe: {
        name: 'Bihe — die Trauung',
        day: 'Samstag, 20. Feb.',
        time: '11:00',
        text: 'Rund um das heilige Feuer: Sindoor, Pote (die Hochzeitskette) und die sieben gemeinsamen Schritte.',
      },
      reception: {
        name: 'Abendfeier',
        day: 'Samstag, 20. Feb.',
        time: '18:30',
        text: 'Abendessen, ein paar kurze Reden und eine Tanzfläche bis spät in die Nacht.',
      },
    },
    places: { home: 'Elternhaus · Offenbach (Adresse kommt mit deiner Antwort)', hall: 'Rhein-Main Festsaal' },
    addOne: 'In den Kalender',
    addAll: 'Alle vier in den Kalender',
    venueTitle: 'Ort',
    venueDemo: 'Demo-Ort — die Karte öffnet Frankfurt',
    venueNotes: ['5 Minuten zu Fuß von der S-Bahn', 'Parkplätze direkt hinter dem Saal', 'Stufenloser Eingang, Aufzug zum Saal'],
    openMap: 'Karte öffnen',
    dressTitle: 'Dresscode',
    dressText:
      'Festlich und farbenfroh: Daura-Suruwal mit Dhaka-Topi, Saris, Kurtas und Lehengas sind herzlich willkommen — dein schönster Anzug genauso.',
    dressAvoid: 'Bitte nicht ganz in Weiß und nicht ganz in Schwarz.',
    dressWarm: 'Es ist Februar in Frankfurt — bring für die Janti draußen ein warmes Tuch mit.',
    swatches: ['Sindoor-Rot', 'Tagetes', 'Gold', 'Blattgrün', 'Rani-Pink'],
    galleryTitle: 'Galerie',
    gallerySub: 'Nach der Hochzeit erscheinen hier die Fotos vom großen Tag.',
    tiles: ['Tagetes', 'Dhaka', 'Diya', 'Mandala', 'Himal', 'Pote'],
    close: 'Schließen',
    rsvpTitle: 'Feierst du mit uns?',
    rsvpSub: 'Eine kurze Antwort hilft uns beim Planen von Essen, Plätzen und Tanzfläche.',
    rsvpBy: 'Bitte antworte bis zum 20. Januar 2027',
    fName: 'Dein Name',
    fNamePh: 'z. B. Maya Gurung',
    fComing: 'Kommst du?',
    yes: 'Ja, sehr gern',
    no: 'Leider nein',
    fGuests: 'Wie viele seid ihr?',
    fewer: 'Ein Gast weniger',
    more: 'Ein Gast mehr',
    fWhich: 'Zu welchen Programmpunkten?',
    fFood: 'Essen',
    veg: 'Vegetarisch',
    nonveg: 'Mit Fleisch',
    fMessage: 'Ein Wunsch für das Paar (optional)',
    fMessagePh: 'Schreib ein paar Worte…',
    send: 'Antwort senden',
    needName: 'Bitte schreib deinen Namen.',
    demoNote: 'Demo: Deine Antwort bleibt nur in diesem Browser — nichts wird verschickt.',
    thanksYes: (n) => `Dhanyabad, ${n}!`,
    thanksNo: (n) => `Wir werden dich vermissen, ${n}`,
    thanksYesText: 'Dein Platz ist reserviert. Wir freuen uns riesig, mit dir zu feiern.',
    thanksNoText: 'Danke, dass du Bescheid gibst. Wir schicken dir Fotos vom Tag.',
    summaryGuests: (n) => (n === 1 ? '1 Gast' : `${n} Gäste`),
    edit: 'Antwort ändern',
    faqTitle: 'Gut zu wissen',
    faq: [
      {
        q: 'Zum ersten Mal auf einer nepalesischen Hochzeit — was passiert da?',
        a: 'Janti ist der Zug des Bräutigams mit Musik, beim Swayambar werden Blumengirlanden getauscht, und Bihe ist die eigentliche Trauung. Komm einfach, iss gut und tanz mit — den Rest erklärt dir gern jemand.',
      },
      { q: 'Darf ich die Kinder mitbringen?', a: 'Natürlich — Kinder gehören zu jeder nepalesischen Hochzeit. Zähl sie in deiner Antwort einfach mit.' },
      {
        q: 'Gibt es vegetarisches Essen?',
        a: 'Ja: Dal Bhat, Sel Roti, Aloo Dum und vieles mehr. Wähl es in deiner Antwort aus, dann sorgen wir dafür, dass genug da ist.',
      },
      {
        q: 'Und Geschenke?',
        a: 'Dass du da bist, ist das schönste Geschenk. Wenn du magst, ist ein kleiner Umschlag (Shagun) für das Paar eine schöne Tradition.',
      },
      { q: 'Wann sollte ich da sein?', a: 'Etwa 15 Minuten vor jedem Programmpunkt — die Janti wartet auf niemanden!' },
    ],
    shareTitle: 'Einladung teilen',
    shareText: 'Schick sie an Familie und Freunde — sie öffnet sich auf jedem Handy.',
    whatsapp: 'Per WhatsApp senden',
    copy: 'Link kopieren',
    copied: 'Link kopiert',
    waMessage: 'Du bist eingeladen! Aarati & Sujan — 20. Februar 2027, Frankfurt (eine Demo-Einladung von MartNepali):',
    footer: 'Von Herzen, Aarati & Sujan',
    icsTitle: 'Aarati & Sujan',
  },
  ne: {
    langName: 'नेपाली',
    langLabel: 'भाषा',
    navLabel: 'निम्तो',
    demo: 'डेमो',
    invocation: '॥ श्री गणेशाय नमः ॥',
    kicker: 'शुभ विवाह · हार्दिक निमन्त्रणा',
    bride: 'आरती',
    groom: 'सुजन',
    invite: 'हाम्रो शुभ विवाहको पावन अवसरमा तपाईंको गरिमामय उपस्थितिको हार्दिक अनुरोध गर्दछौं',
    dateLine: 'शनिबार · फागुन ८, २०८३',
    bsLine: '२० फेब्रुअरी २०२७',
    cityLine: 'फ्रान्कफर्ट, जर्मनी',
    rsvpCta: 'निम्तोको जवाफ दिनुहोस्',
    scroll: 'तल हेर्नुहोस्',
    nav: { programme: 'कार्यक्रम', venue: 'स्थान', rsvp: 'जवाफ', faq: 'प्रश्नहरू' },
    welcomeTitle: 'नमस्ते, प्रिय आफन्त तथा साथीहरू',
    welcome:
      'दुई परिवार, दुई सहर, एउटै ठूलो नेपाली उत्सव। ठूलाबडाको आशीर्वादसहित हामी तपाईंलाई मेहेन्दी, जन्ती, विवाह संस्कार र रमाइलो साँझमा सँगै पाउन चाहन्छौं।',
    families: 'स्नेहसहित, भण्डारी तथा कार्की परिवार',
    countdownTitle: 'विवाहमा बाँकी समय',
    units: ['दिन', 'घण्टा', 'मिनेट', 'सेकेन्ड'],
    countdownDone: 'आज शुभ दिन!',
    programmeTitle: 'कार्यक्रम',
    programmeSub: 'दुई दिन, चार कार्यक्रम। सकेसम्म सबैमा आउनुहोला।',
    events: {
      mehendi: {
        name: 'मेहेन्दी',
        day: 'शुक्रबार, फागुन ७',
        time: 'साँझ ५ बजे',
        text: 'बेहुलीपक्षसँग मेहेन्दी, गीत र नाचगान। चाँडै आउनुहोस्, ढिलोसम्म बस्नुहोस्।',
      },
      janti: {
        name: 'स्वयम्बर र जन्ती',
        day: 'शनिबार, फागुन ८',
        time: 'बिहान ९:३० बजे',
        text: 'पञ्चे बाजासहित जन्ती आइपुग्छ र वरमाला साटासाट हुन्छ।',
      },
      bihe: {
        name: 'विवाह संस्कार',
        day: 'शनिबार, फागुन ८',
        time: 'बिहान ११ बजे',
        text: 'अग्निको साक्षीमा सिन्दूर, पोते र सप्तपदी।',
      },
      reception: {
        name: 'प्रीतिभोज',
        day: 'शनिबार, फागुन ८',
        time: 'साँझ ६:३० बजे',
        text: 'रात्रिभोज, छोटा शुभकामना मन्तव्य र राति अबेरसम्म नाचगान।',
      },
    },
    places: { home: 'घर · अफेनबाख (ठेगाना जवाफपछि पठाइनेछ)', hall: 'राइन-माइन फेस्टसाल' },
    addOne: 'क्यालेन्डरमा राख्नुहोस्',
    addAll: 'चारवटै कार्यक्रम क्यालेन्डरमा राख्नुहोस्',
    venueTitle: 'कार्यक्रम स्थल',
    venueDemo: 'डेमो स्थल — नक्सामा फ्रान्कफर्ट खुल्छ',
    venueNotes: ['एस-बानबाट पैदल ५ मिनेट', 'हलपछाडि निःशुल्क पार्किङ', 'सिँढीबिनाको प्रवेश, हलसम्म लिफ्ट'],
    openMap: 'नक्सामा खोल्नुहोस्',
    dressTitle: 'पहिरन',
    dressText: 'रङ्गीन र उत्सवमय: दौरा सुरुवाल र ढाका टोपी, सारी, कुर्ता, लेहेंगा — वा तपाईंको राम्रो सुट।',
    dressAvoid: 'कृपया पूरै सेतो वा पूरै कालो पहिरन नलगाउनुहोला।',
    dressWarm: 'फागुनको फ्रान्कफर्ट चिसो हुन्छ — जन्तीका लागि न्यानो सल ल्याउनुहोला।',
    swatches: ['सिन्दूरे रातो', 'सयपत्री', 'सुनौलो', 'हरियो', 'रानी गुलाबी'],
    galleryTitle: 'तस्बिरहरू',
    gallerySub: 'विवाहपछि त्यस दिनका तस्बिरहरू यहाँ देखिनेछन्।',
    tiles: ['सयपत्री', 'ढाका', 'दियो', 'मण्डला', 'हिमाल', 'पोते'],
    close: 'बन्द गर्नुहोस्',
    rsvpTitle: 'तपाईं आउनुहुन्छ?',
    rsvpSub: 'तपाईंको छोटो जवाफले खाना, बस्ने ठाउँ र नाचगानको तयारीमा सहयोग गर्छ।',
    rsvpBy: 'कृपया माघ ६, २०८३ भित्र जवाफ दिनुहोला',
    fName: 'तपाईंको नाम',
    fNamePh: 'जस्तै: माया गुरुङ',
    fComing: 'आउनुहुन्छ?',
    yes: 'अवश्य आउँछु',
    no: 'आउन सक्दिनँ',
    fGuests: 'कति जना?',
    fewer: 'एक जना घटाउनुहोस्',
    more: 'एक जना थप्नुहोस्',
    fWhich: 'कुन कार्यक्रममा?',
    fFood: 'खाना',
    veg: 'शाकाहारी',
    nonveg: 'मांसाहारी',
    fMessage: 'जोडीलाई शुभकामना (ऐच्छिक)',
    fMessagePh: 'केही शब्द लेख्नुहोस्…',
    send: 'जवाफ पठाउनुहोस्',
    needName: 'कृपया आफ्नो नाम लेख्नुहोस्।',
    demoNote: 'डेमो: तपाईंको जवाफ यही ब्राउजरमा मात्र रहन्छ — कतै पठाइँदैन।',
    thanksYes: (n) => `धन्यवाद, ${n}!`,
    thanksNo: (n) => `तपाईंलाई सम्झिनेछौं, ${n}`,
    thanksYesText: 'तपाईंको ठाउँ सुरक्षित भयो। तपाईंसँग खुसी मनाउन हामी उत्सुक छौं।',
    thanksNoText: 'जानकारी दिनुभएकोमा धन्यवाद। त्यस दिनका तस्बिरहरू पठाउनेछौं।',
    summaryGuests: (n) => `${toNeDigits(n)} जना`,
    edit: 'जवाफ बदल्नुहोस्',
    faqTitle: 'जान्नुपर्ने कुरा',
    faq: [
      {
        q: 'नेपाली बिहेमा पहिलो पटक? के-के हुन्छ?',
        a: 'जन्ती भनेको बाजागाजासहित बेहुलापक्षको आगमन हो, स्वयम्बरमा वरमाला साटिन्छ, र बिहे भनेको विवाह संस्कार नै हो। आउनुहोस्, मीठो खानुहोस्, नाच्नुहोस् — बाँकी कुरा कसैले खुसीसाथ बुझाइदिनेछ।',
      },
      { q: 'केटाकेटी ल्याउन मिल्छ?', a: 'अवश्य — केटाकेटी हरेक नेपाली बिहेको रौनक हुन्। जवाफमा उनीहरूलाई पनि गन्नुहोला।' },
      { q: 'शाकाहारी खाना हुन्छ?', a: 'हुन्छ: दाल भात, सेल रोटी, आलु दम र अरू धेरै। जवाफमा छान्नुहोस्, पुग्ने गरी बनाउँछौं।' },
      { q: 'उपहारको के गर्ने?', a: 'तपाईंको उपस्थिति नै उपहार हो। चाहनुहुन्छ भने सानो सगुनको खाम सुन्दर परम्परा हो।' },
      { q: 'कति बजे आइपुग्ने?', a: 'हरेक कार्यक्रमभन्दा करिब १५ मिनेट अगाडि — जन्ती कसैलाई पर्खँदैन!' },
    ],
    shareTitle: 'निम्तो सेयर गर्नुहोस्',
    shareText: 'आफन्त र साथीहरूलाई पठाउनुहोस् — जुनसुकै फोनमा खुल्छ।',
    whatsapp: 'WhatsApp मा पठाउनुहोस्',
    copy: 'लिङ्क कपी गर्नुहोस्',
    copied: 'लिङ्क कपी भयो',
    waMessage: 'हार्दिक निमन्त्रणा! आरती र सुजन — फागुन ८, २०८३, फ्रान्कफर्ट (MartNepali को डेमो निम्तो):',
    footer: 'स्नेहसहित, आरती र सुजन',
    icsTitle: 'आरती र सुजन',
  },
};

const NE_DIGITS = '०१२३४५६७८९';
export function toNeDigits(n: number | string): string {
  return String(n).replace(/[0-9]/g, (d) => NE_DIGITS[Number(d)]);
}
