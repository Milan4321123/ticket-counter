// Words for /work/build ("Build your idea") in English, Deutsch and नेपाली.
// It is an idea sketch: there are no prices, estimates, budgets, timelines or
// packages anywhere in here (tests/buildIdea.test.ts checks every string).
// The sample names are made up.

import type { BriefWords, FeatureId, KindId, Lang, MakeId } from './idea';

const NE_DIGITS = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
export function num(n: number | string, lang: Lang): string {
  return lang === 'ne' ? String(n).replace(/[0-9]/g, (d) => NE_DIGITS[Number(d)]) : String(n);
}

type FeatureText = { label: string; line: string; tab: string };

export type Copy = {
  kicker: string;
  h1: string;
  sub: string;
  free: string;
  stepsLabel: string;
  steps: { kind: string; name: string; features: string; summary: string };
  stepHint: { kind: string; name: string; features: string; summary: string };
  kinds: Record<KindId, { label: string; sample: string; line: string }>;
  otherLabel: string;
  otherPlaceholder: string;
  makeLabel: string;
  make: Record<MakeId, string>;
  nameLabel: string;
  taglineLabel: string;
  optional: string;
  colourLabel: string;
  colours: Record<'crimson' | 'saffron' | 'green' | 'blue' | 'violet', string>;
  customColour: string;
  emblemLabel: string;
  initialsLabel: string;
  initialsHint: string;
  features: Record<FeatureId, FeatureText>;
  suggested: string;
  seeIt: string;
  on: string;
  off: string;
  added: (f: string) => string;
  removed: (f: string) => string;
  /** Words inside the phone and laptop sketches. */
  mock: {
    home: string;
    welcome: string;
    emptyApp: string;
    sketchLabel: string;
    phoneLabel: string;
    laptopLabel: string;
    showPhone: string;
    showLaptop: string;
    admit: string;
    checkedIn: string;
    dishes: [string, string, string];
    table: string;
    sendKitchen: string;
    products: [string, string];
    pickup: string;
    days: [string, string, string, string, string];
    book: string;
    memberCard: string;
    member: string;
    quizQ: string;
    quizA: [string, string, string, string];
    inside: string;
    chatGuest: string;
    chatReply: string;
    newsText: string;
    getUpdates: string;
    reel: string;
    walkOn: string;
    cta: string;
  };
  summary: {
    title: string;
    sub: string;
    what: string;
    name: string;
    tagline: string;
    colour: string;
    make: string;
    features: string;
    none: string;
    notYet: string;
    copy: string;
    copied: string;
    copyFail: string;
    download: string;
    downloading: string;
    send: string;
    sendHint: string;
    reset: string;
    saved: string;
  };
  bar: (n: string) => string;
  barShow: string;
  image: { title: string; footer: string };
  brief: BriefWords;
};

const en: Copy = {
  kicker: 'MartNepali Studio · Build your idea',
  h1: 'Build your idea — and watch it come together',
  sub: 'Pick what you are, give it a name and a colour, switch on what it should do. The phone sketch builds itself as you go — then send it to us in one tap.',
  free: 'An idea sketch, not a real app yet. Free while we grow — nothing is sent until you press send.',
  stepsLabel: 'Steps',
  steps: { kind: 'What are you?', name: 'Name & colour', features: 'What should it do?', summary: 'Your idea' },
  stepHint: {
    kind: 'Each choice re-themes the sketch.',
    name: 'The sketch changes as you type.',
    features: 'Switch on as many as you like — each one slides into the sketch.',
    summary: 'Keep it, share it, or send it to us.',
  },
  kinds: {
    restaurant: { label: 'Restaurant', sample: 'Himalayan Chulo', line: 'Momo, thali & chiya' },
    shop: { label: 'Shop', sample: 'Dhaka Corner', line: 'Nepali goods, near you' },
    association: { label: 'Association (Verein)', sample: 'Saathi Samaj e.V.', line: 'Together, far from home' },
    artist: { label: 'Artist', sample: 'Rimjhim Tara', line: 'Songs from the hills' },
    organizer: { label: 'Event organizer', sample: 'Dashain Nights', line: 'The biggest night of the year' },
    school: { label: 'School or classes', sample: 'Aangan Pathshala', line: 'Nepali, dance & madal' },
    other: { label: 'Something else', sample: 'Your idea', line: 'Made for our community' },
  },
  otherLabel: 'What are you?',
  otherPlaceholder: 'e.g. a travel group, a cricket club…',
  makeLabel: 'Make it',
  make: { app: '📱 An app', web: '💻 A website', both: '📱💻 Both' },
  nameLabel: 'Name',
  taglineLabel: 'Tagline',
  optional: 'optional',
  colourLabel: 'Colour',
  colours: { crimson: 'Crimson', saffron: 'Saffron', green: 'Green', blue: 'Blue', violet: 'Violet' },
  customColour: 'Your own colour',
  emblemLabel: 'Your emblem',
  initialsLabel: 'Letters',
  initialsHint: 'Up to 3 — empty takes them from the name.',
  features: {
    tickets: { label: 'Tickets & QR check-in', line: 'Tickets by email, scanned at the door on any phone.', tab: 'Tickets' },
    menu: { label: 'Menu & QR table ordering', line: 'Guests order from the table; the kitchen sees it at once.', tab: 'Menu' },
    shop: { label: 'Online shop & pickup codes', line: 'Order online, collect with a code.', tab: 'Shop' },
    booking: { label: 'Class & event booking', line: 'Pick a slot, get a pass, join the waitlist.', tab: 'Book' },
    members: { label: 'Members’ area', line: 'A member card, RSVPs and news for members only.', tab: 'Members' },
    quiz: { label: 'Live quiz', line: 'Questions on the big screen, answers from every phone.', tab: 'Quiz' },
    dashboard: { label: 'Live dashboard', line: 'Who is in, which door is busy — on one screen.', tab: 'Live' },
    lang: { label: 'English · Deutsch · नेपाली', line: 'One toggle, three languages.', tab: 'Language' },
    chat: { label: 'Chat with customers', line: 'Questions answered right in the app.', tab: 'Chat' },
    news: { label: 'Newsletter & WhatsApp updates', line: 'New dates and offers straight to their phone.', tab: 'News' },
    gallery: { label: 'Photo gallery', line: 'Your best nights and dishes, in one place.', tab: 'Photos' },
    video: { label: 'Ad video / reel', line: 'A 9:16 promo for Reels, TikTok and WhatsApp status.', tab: 'Reel' },
    stage: { label: 'Walk-on & stage visuals', line: 'An entrance intro and screens for the stage.', tab: 'Stage' },
  },
  suggested: 'Suggested',
  seeIt: 'See it working →',
  on: 'On',
  off: 'Off',
  added: (f) => `${f} added to the sketch`,
  removed: (f) => `${f} taken out of the sketch`,
  mock: {
    home: 'Home',
    welcome: 'Welcome',
    emptyApp: 'Switch on a feature and it appears here.',
    sketchLabel: 'Live sketch of your idea',
    phoneLabel: 'Phone',
    laptopLabel: 'Laptop',
    showPhone: '📱 App',
    showLaptop: '💻 Website',
    admit: 'Admit one',
    checkedIn: 'Checked in ✓',
    dishes: ['Momo', 'Dal bhat', 'Masala chiya'],
    table: 'Table 7',
    sendKitchen: 'Send to kitchen',
    products: ['Dhaka topi', 'Timur'],
    pickup: 'Pickup code',
    days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    book: 'Book',
    memberCard: 'Member card',
    member: 'Member since 2026',
    quizQ: 'Which festival flies kites?',
    quizA: ['Dashain', 'Tihar', 'Holi', 'Teej'],
    inside: 'Inside now',
    chatGuest: 'Is there a table for 4 tonight?',
    chatReply: 'Yes — see you at 7!',
    newsText: 'New dates are out — save yours!',
    getUpdates: 'Get updates',
    reel: 'Reel · 9:16',
    walkOn: 'Walk-on',
    cta: 'Kura garau',
  },
  summary: {
    title: 'Your idea',
    sub: 'Everything you picked, in one card.',
    what: 'What',
    name: 'Name',
    tagline: 'Tagline',
    colour: 'Colour',
    make: 'Make',
    features: 'Features',
    none: 'None yet',
    notYet: 'Not picked yet',
    copy: 'Copy link',
    copied: 'Link copied ✓',
    copyFail: 'Copy the address bar — it holds your idea',
    download: 'Download as image',
    downloading: 'Drawing…',
    send: 'Send this to us — Kura garau',
    sendHint: 'Opens our chat with your idea written in — you can change it, and nothing is sent until you press send.',
    reset: 'Start over',
    saved: 'Saved on this device · the link holds it too',
  },
  bar: (n) => `${n} features`,
  barShow: 'See sketch ↑',
  image: { title: 'Our idea', footer: 'Sketched at martnepali.com/work/build · free while we grow' },
  brief: {
    make: { app: 'an app', web: 'a website', both: 'an app and a website' },
    forKind: {
      restaurant: 'for my restaurant',
      shop: 'for my shop',
      association: 'for our association',
      artist: 'for my music',
      organizer: 'for my events',
      school: 'for our classes',
      other: '',
    },
    forOther: (what) => `for ${what}`,
    opening: (make, forKind, name, tagline) =>
      `My idea from the builder: ${make}${forKind ? ` ${forKind}` : ''}${name ? ` called “${name}”` : ''}${tagline ? ` (${tagline})` : ''}.`,
    colour: (hex) => `Colour ${hex}.`,
    withList: (list) => `With ${list}.`,
    noFeatures: 'Features still open.',
    sketch: 'Sketch:',
    features: {
      tickets: 'tickets & QR check-in',
      menu: 'menu & QR table ordering',
      shop: 'online shop & pickup codes',
      booking: 'class & event booking',
      members: 'a members’ area',
      quiz: 'a live quiz',
      dashboard: 'a live dashboard',
      lang: 'English/Deutsch/Nepali',
      chat: 'chat with customers',
      news: 'newsletter & WhatsApp updates',
      gallery: 'a photo gallery',
      video: 'an ad video / reel',
      stage: 'walk-on & stage visuals',
    },
  },
};

const de: Copy = {
  kicker: 'MartNepali Studio · Bau deine Idee',
  h1: 'Bau deine Idee — und sieh zu, wie sie entsteht',
  sub: 'Wähle, was du bist, gib ihr einen Namen und eine Farbe, schalte ein, was sie können soll. Die Handy-Skizze baut sich dabei selbst — dann schick sie uns mit einem Tipp.',
  free: 'Eine Ideen-Skizze, noch keine echte App. Kostenlos, solange wir wachsen — nichts wird verschickt, bevor du auf Senden drückst.',
  stepsLabel: 'Schritte',
  steps: { kind: 'Was bist du?', name: 'Name & Farbe', features: 'Was soll sie können?', summary: 'Deine Idee' },
  stepHint: {
    kind: 'Jede Wahl gibt der Skizze einen neuen Look.',
    name: 'Die Skizze ändert sich beim Tippen.',
    features: 'Schalte so viele ein, wie du willst — jede gleitet in die Skizze.',
    summary: 'Behalten, teilen oder an uns schicken.',
  },
  kinds: {
    restaurant: { label: 'Restaurant', sample: 'Himalayan Chulo', line: 'Momo, Thali & Chiya' },
    shop: { label: 'Laden', sample: 'Dhaka Corner', line: 'Nepalesisches, ganz in der Nähe' },
    association: { label: 'Verein', sample: 'Saathi Samaj e.V.', line: 'Gemeinsam, weit weg von zu Hause' },
    artist: { label: 'Künstler:in', sample: 'Rimjhim Tara', line: 'Lieder aus den Bergen' },
    organizer: { label: 'Veranstalter:in', sample: 'Dashain Nights', line: 'Die größte Nacht des Jahres' },
    school: { label: 'Schule oder Kurse', sample: 'Aangan Pathshala', line: 'Nepali, Tanz & Madal' },
    other: { label: 'Etwas anderes', sample: 'Deine Idee', line: 'Gemacht für unsere Community' },
  },
  otherLabel: 'Was bist du?',
  otherPlaceholder: 'z. B. eine Reisegruppe, ein Cricket-Club…',
  makeLabel: 'Was soll es werden?',
  make: { app: '📱 Eine App', web: '💻 Eine Website', both: '📱💻 Beides' },
  nameLabel: 'Name',
  taglineLabel: 'Slogan',
  optional: 'optional',
  colourLabel: 'Farbe',
  colours: { crimson: 'Karminrot', saffron: 'Safran', green: 'Grün', blue: 'Blau', violet: 'Violett' },
  customColour: 'Eigene Farbe',
  emblemLabel: 'Dein Emblem',
  initialsLabel: 'Buchstaben',
  initialsHint: 'Bis zu 3 — leer nimmt sie aus dem Namen.',
  features: {
    tickets: { label: 'Tickets & QR-Einlass', line: 'Tickets per E-Mail, am Eingang mit jedem Handy gescannt.', tab: 'Tickets' },
    menu: { label: 'Speisekarte & QR-Bestellung am Tisch', line: 'Gäste bestellen am Tisch, die Küche sieht es sofort.', tab: 'Karte' },
    shop: { label: 'Online-Shop & Abholcodes', line: 'Online bestellen, mit Code abholen.', tab: 'Shop' },
    booking: { label: 'Kurs- & Eventbuchung', line: 'Termin wählen, Pass bekommen, auf die Warteliste.', tab: 'Buchen' },
    members: { label: 'Mitgliederbereich', line: 'Mitgliedskarte, Zusagen und News nur für Mitglieder.', tab: 'Mitglieder' },
    quiz: { label: 'Live-Quiz', line: 'Fragen auf der Leinwand, Antworten von jedem Handy.', tab: 'Quiz' },
    dashboard: { label: 'Live-Dashboard', line: 'Wer ist drin, welcher Eingang ist voll — auf einem Screen.', tab: 'Live' },
    lang: { label: 'English · Deutsch · नेपाली', line: 'Ein Schalter, drei Sprachen.', tab: 'Sprache' },
    chat: { label: 'Chat mit Kund:innen', line: 'Fragen direkt in der App beantwortet.', tab: 'Chat' },
    news: { label: 'Newsletter & WhatsApp-Updates', line: 'Neue Termine und Neuigkeiten direkt aufs Handy.', tab: 'News' },
    gallery: { label: 'Fotogalerie', line: 'Eure schönsten Abende und Gerichte an einem Ort.', tab: 'Fotos' },
    video: { label: 'Werbevideo / Reel', line: 'Ein 9:16-Promo für Reels, TikTok und WhatsApp-Status.', tab: 'Reel' },
    stage: { label: 'Walk-on & Bühnenvisuals', line: 'Ein Auftritts-Intro und Screens für die Bühne.', tab: 'Bühne' },
  },
  suggested: 'Passt dazu',
  seeIt: 'So sieht es aus →',
  on: 'An',
  off: 'Aus',
  added: (f) => `${f} zur Skizze hinzugefügt`,
  removed: (f) => `${f} aus der Skizze entfernt`,
  mock: {
    home: 'Start',
    welcome: 'Willkommen',
    emptyApp: 'Schalte eine Funktion ein — sie erscheint hier.',
    sketchLabel: 'Live-Skizze deiner Idee',
    phoneLabel: 'Handy',
    laptopLabel: 'Laptop',
    showPhone: '📱 App',
    showLaptop: '💻 Website',
    admit: 'Eintritt für 1',
    checkedIn: 'Eingecheckt ✓',
    dishes: ['Momo', 'Dal Bhat', 'Masala Chiya'],
    table: 'Tisch 7',
    sendKitchen: 'An die Küche',
    products: ['Dhaka Topi', 'Timur'],
    pickup: 'Abholcode',
    days: ['Mo', 'Di', 'Mi', 'Do', 'Fr'],
    book: 'Buchen',
    memberCard: 'Mitgliedskarte',
    member: 'Mitglied seit 2026',
    quizQ: 'An welchem Fest steigen Drachen?',
    quizA: ['Dashain', 'Tihar', 'Holi', 'Teej'],
    inside: 'Gerade drin',
    chatGuest: 'Habt ihr heute einen Tisch für 4?',
    chatReply: 'Ja — bis um 7!',
    newsText: 'Neue Termine sind da — sichere dir deinen!',
    getUpdates: 'Updates bekommen',
    reel: 'Reel · 9:16',
    walkOn: 'Walk-on',
    cta: 'Kura garau',
  },
  summary: {
    title: 'Deine Idee',
    sub: 'Alles, was du gewählt hast, auf einer Karte.',
    what: 'Was',
    name: 'Name',
    tagline: 'Slogan',
    colour: 'Farbe',
    make: 'Wird',
    features: 'Funktionen',
    none: 'Noch keine',
    notYet: 'Noch nicht gewählt',
    copy: 'Link kopieren',
    copied: 'Link kopiert ✓',
    copyFail: 'Kopiere die Adresszeile — sie enthält deine Idee',
    download: 'Als Bild herunterladen',
    downloading: 'Wird gezeichnet…',
    send: 'Schick sie uns — Kura garau',
    sendHint: 'Öffnet unseren Chat mit deiner Idee schon eingetragen — du kannst sie ändern, und nichts wird verschickt, bevor du auf Senden drückst.',
    reset: 'Neu anfangen',
    saved: 'Auf diesem Gerät gespeichert · der Link enthält sie auch',
  },
  bar: (n) => `${n} Funktionen`,
  barShow: 'Skizze ansehen ↑',
  image: { title: 'Unsere Idee', footer: 'Skizziert auf martnepali.com/work/build · kostenlos, solange wir wachsen' },
  brief: {
    make: { app: 'eine App', web: 'eine Website', both: 'eine App und eine Website' },
    forKind: {
      restaurant: 'für mein Restaurant',
      shop: 'für meinen Laden',
      association: 'für unseren Verein',
      artist: 'für meine Musik',
      organizer: 'für meine Events',
      school: 'für unsere Kurse',
      other: '',
    },
    forOther: (what) => `für ${what}`,
    opening: (make, forKind, name, tagline) =>
      `Meine Idee aus dem Baukasten: ${make}${forKind ? ` ${forKind}` : ''}${name ? ` namens „${name}“` : ''}${tagline ? ` (${tagline})` : ''}.`,
    colour: (hex) => `Farbe ${hex}.`,
    withList: (list) => `Mit ${list}.`,
    noFeatures: 'Funktionen noch offen.',
    sketch: 'Skizze:',
    features: {
      tickets: 'Tickets & QR-Einlass',
      menu: 'Speisekarte & QR-Bestellung am Tisch',
      shop: 'Online-Shop & Abholcodes',
      booking: 'Kurs- & Eventbuchung',
      members: 'Mitgliederbereich',
      quiz: 'Live-Quiz',
      dashboard: 'Live-Dashboard',
      lang: 'Englisch/Deutsch/Nepali',
      chat: 'Chat mit Kund:innen',
      news: 'Newsletter & WhatsApp-Updates',
      gallery: 'Fotogalerie',
      video: 'Werbevideo / Reel',
      stage: 'Walk-on & Bühnenvisuals',
    },
  },
};

const ne: Copy = {
  kicker: 'MartNepali स्टुडियो · आफ्नो विचार बनाउनुहोस्',
  h1: 'आफ्नो विचार बनाउनुहोस् — र बन्दै गरेको हेर्नुहोस्',
  sub: 'तपाईं को हुनुहुन्छ छान्नुहोस्, नाम र रङ दिनुहोस्, के-के गर्नुपर्छ त्यो खोल्नुहोस्। फोनको स्केच आफैं बन्दै जान्छ — अनि एक ट्यापमा हामीलाई पठाउनुहोस्।',
  free: 'यो विचारको स्केच हो, अझै साँच्चिकै एप होइन। हामी बढ्दै गर्दा निःशुल्क — तपाईंले पठाउनुहोस् नथिचेसम्म केही पनि पठाइँदैन।',
  stepsLabel: 'चरणहरू',
  steps: { kind: 'तपाईं को हुनुहुन्छ?', name: 'नाम र रङ', features: 'के-के गर्नुपर्छ?', summary: 'तपाईंको विचार' },
  stepHint: {
    kind: 'हरेक छनोटले स्केचको रूप फेर्छ।',
    name: 'लेख्दै जाँदा स्केच बदलिन्छ।',
    features: 'जति चाहनुहुन्छ खोल्नुहोस् — हरेक स्केचभित्र सर्छ।',
    summary: 'राख्नुहोस्, सेयर गर्नुहोस्, वा हामीलाई पठाउनुहोस्।',
  },
  kinds: {
    restaurant: { label: 'रेस्टुरेन्ट', sample: 'हिमालयन चुलो', line: 'मःम, थाली र चिया' },
    shop: { label: 'पसल', sample: 'ढाका कर्नर', line: 'नेपाली सामान, तपाईंको नजिकै' },
    association: { label: 'संस्था (Verein)', sample: 'साथी समाज e.V.', line: 'घरदेखि टाढा, सँगसँगै' },
    artist: { label: 'कलाकार', sample: 'रिमझिम तारा', line: 'पहाडका गीतहरू' },
    organizer: { label: 'कार्यक्रम आयोजक', sample: 'दशैं नाइट्स', line: 'वर्षकै सबैभन्दा ठूलो रात' },
    school: { label: 'स्कुल वा कक्षा', sample: 'आँगन पाठशाला', line: 'नेपाली, नाच र मादल' },
    other: { label: 'अरू केही', sample: 'तपाईंको विचार', line: 'हाम्रो समुदायका लागि बनाइएको' },
  },
  otherLabel: 'तपाईं को हुनुहुन्छ?',
  otherPlaceholder: 'जस्तै: घुम्ने समूह, क्रिकेट क्लब…',
  makeLabel: 'के बनाउने',
  make: { app: '📱 एप', web: '💻 वेबसाइट', both: '📱💻 दुवै' },
  nameLabel: 'नाम',
  taglineLabel: 'नारा',
  optional: 'ऐच्छिक',
  colourLabel: 'रङ',
  colours: { crimson: 'सिमरिक', saffron: 'केसरी', green: 'हरियो', blue: 'नीलो', violet: 'बैजनी' },
  customColour: 'आफ्नै रङ',
  emblemLabel: 'तपाईंको चिह्न',
  initialsLabel: 'अक्षर',
  initialsHint: '३ सम्म — खाली छोडे नामबाट लिइन्छ।',
  features: {
    tickets: { label: 'टिकट र QR चेक-इन', line: 'इमेलमा टिकट, ढोकामा जुनसुकै फोनले स्क्यान।', tab: 'टिकट' },
    menu: { label: 'मेनु र टेबलबाट QR अर्डर', line: 'पाहुनाले टेबलबाटै अर्डर गर्छन्; भान्छाले तुरुन्तै देख्छ।', tab: 'मेनु' },
    shop: { label: 'अनलाइन पसल र पिकअप कोड', line: 'अनलाइन अर्डर, कोड देखाएर लिनुहोस्।', tab: 'पसल' },
    booking: { label: 'कक्षा र कार्यक्रम बुकिङ', line: 'समय छान्नुहोस्, पास पाउनुहोस्, प्रतीक्षा सूचीमा बस्नुहोस्।', tab: 'बुक' },
    members: { label: 'सदस्य खण्ड', line: 'सदस्य कार्ड, सहभागिता र सदस्यका लागि मात्र समाचार।', tab: 'सदस्य' },
    quiz: { label: 'लाइभ क्विज', line: 'ठूलो पर्दामा प्रश्न, हरेक फोनबाट जवाफ।', tab: 'क्विज' },
    dashboard: { label: 'लाइभ ड्यासबोर्ड', line: 'को भित्र छ, कुन ढोकामा भीड — एउटै स्क्रिनमा।', tab: 'लाइभ' },
    lang: { label: 'English · Deutsch · नेपाली', line: 'एउटा बटन, तीन भाषा।', tab: 'भाषा' },
    chat: { label: 'ग्राहकसँग च्याट', line: 'प्रश्नको जवाफ एपभित्रै।', tab: 'च्याट' },
    news: { label: 'न्युजलेटर र WhatsApp अपडेट', line: 'नयाँ मिति र अफर सिधै फोनमा।', tab: 'समाचार' },
    gallery: { label: 'फोटो ग्यालरी', line: 'राम्रा साँझ र परिकार, एकै ठाउँमा।', tab: 'फोटो' },
    video: { label: 'विज्ञापन भिडियो / रिल', line: 'Reels, TikTok र WhatsApp स्टेटसका लागि ९:१६ प्रोमो।', tab: 'रिल' },
    stage: { label: 'वाक-अन र स्टेज भिजुअल', line: 'प्रवेशको इन्ट्रो र स्टेजका स्क्रिन।', tab: 'स्टेज' },
  },
  suggested: 'मिल्ने',
  seeIt: 'चलेको हेर्नुहोस् →',
  on: 'खुला',
  off: 'बन्द',
  added: (f) => `${f} स्केचमा थपियो`,
  removed: (f) => `${f} स्केचबाट हटाइयो`,
  mock: {
    home: 'गृह',
    welcome: 'स्वागत छ',
    emptyApp: 'एउटा सुविधा खोल्नुहोस् — यहाँ देखिन्छ।',
    sketchLabel: 'तपाईंको विचारको लाइभ स्केच',
    phoneLabel: 'फोन',
    laptopLabel: 'ल्यापटप',
    showPhone: '📱 एप',
    showLaptop: '💻 वेबसाइट',
    admit: 'एक जनाका लागि',
    checkedIn: 'चेक-इन भयो ✓',
    dishes: ['मःम', 'दाल भात', 'मसला चिया'],
    table: 'टेबल ७',
    sendKitchen: 'भान्छामा पठाउनुहोस्',
    products: ['ढाका टोपी', 'टिमुर'],
    pickup: 'पिकअप कोड',
    days: ['सोम', 'मंगल', 'बुध', 'बिही', 'शुक्र'],
    book: 'बुक',
    memberCard: 'सदस्य कार्ड',
    member: '२०२६ देखि सदस्य',
    quizQ: 'कुन चाडमा चङ्गा उडाइन्छ?',
    quizA: ['दशैं', 'तिहार', 'होली', 'तीज'],
    inside: 'अहिले भित्र',
    chatGuest: 'आज राति ४ जनाको टेबल छ?',
    chatReply: 'छ — ७ बजे भेटौं!',
    newsText: 'नयाँ मिति आयो — आफ्नो सुरक्षित गर्नुहोस्!',
    getUpdates: 'अपडेट पाउनुहोस्',
    reel: 'रिल · ९:१६',
    walkOn: 'वाक-अन',
    cta: 'कुरा गरौं',
  },
  summary: {
    title: 'तपाईंको विचार',
    sub: 'तपाईंले छानेका सबै, एउटै कार्डमा।',
    what: 'के',
    name: 'नाम',
    tagline: 'नारा',
    colour: 'रङ',
    make: 'बनाउने',
    features: 'सुविधा',
    none: 'अहिलेसम्म छैन',
    notYet: 'अझै छानिएको छैन',
    copy: 'लिंक कपी गर्नुहोस्',
    copied: 'लिंक कपी भयो ✓',
    copyFail: 'ठेगाना पट्टी कपी गर्नुहोस् — त्यसमै तपाईंको विचार छ',
    download: 'तस्बिरको रूपमा डाउनलोड',
    downloading: 'कोर्दै…',
    send: 'हामीलाई पठाउनुहोस् — कुरा गरौं',
    sendHint: 'तपाईंको विचार लेखिएको हाम्रो च्याट खुल्छ — बदल्न सक्नुहुन्छ, र तपाईंले पठाउनुहोस् नथिचेसम्म केही पठाइँदैन।',
    reset: 'फेरि सुरु गर्नुहोस्',
    saved: 'यो डिभाइसमा सुरक्षित · लिंकमा पनि छ',
  },
  bar: (n) => `${n} सुविधा`,
  barShow: 'स्केच हेर्नुहोस् ↑',
  image: { title: 'हाम्रो विचार', footer: 'martnepali.com/work/build मा बनाइएको · हामी बढ्दै गर्दा निःशुल्क' },
  brief: {
    make: { app: 'एप', web: 'वेबसाइट', both: 'एप र वेबसाइट' },
    forKind: {
      restaurant: 'मेरो रेस्टुरेन्टका लागि',
      shop: 'मेरो पसलका लागि',
      association: 'हाम्रो संस्थाका लागि',
      artist: 'मेरो संगीतका लागि',
      organizer: 'मेरा कार्यक्रमका लागि',
      school: 'हाम्रा कक्षाका लागि',
      other: '',
    },
    forOther: (what) => `${what} का लागि`,
    opening: (make, forKind, name, tagline) =>
      `बिल्डरबाट मेरो विचार:${forKind ? ` ${forKind}` : ''}${name ? ` “${name}” नामको` : ''} ${make}${tagline ? ` (${tagline})` : ''}।`,
    colour: (hex) => `रङ ${hex}।`,
    withList: (list) => `सुविधा: ${list}।`,
    noFeatures: 'सुविधा अझै बाँकी।',
    sketch: 'स्केच:',
    features: {
      tickets: 'टिकट र QR चेक-इन',
      menu: 'मेनु र टेबलबाट QR अर्डर',
      shop: 'अनलाइन पसल र पिकअप कोड',
      booking: 'कक्षा र कार्यक्रम बुकिङ',
      members: 'सदस्य खण्ड',
      quiz: 'लाइभ क्विज',
      dashboard: 'लाइभ ड्यासबोर्ड',
      lang: 'English/Deutsch/नेपाली',
      chat: 'ग्राहकसँग च्याट',
      news: 'न्युजलेटर र WhatsApp अपडेट',
      gallery: 'फोटो ग्यालरी',
      video: 'विज्ञापन भिडियो / रिल',
      stage: 'वाक-अन र स्टेज भिजुअल',
    },
  },
};

export const COPY: Record<Lang, Copy> = { en, de, ne };
