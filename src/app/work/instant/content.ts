// Words for /work/instant ("Your website in 10 seconds") — the tool around the
// generated site, in English, Deutsch and नेपाली. The words INSIDE the
// generated sites live in templates.ts. No prices, quotes, packages or "hire"
// anywhere (tests/studioWords.test.ts reads every string here).

import type { BriefWords, KindId, Lang, SectionId, StepKey, StyleId } from './instant';

export type { Lang };

export const LANGS: { id: Lang; label: string; short: string }[] = [
  { id: 'en', label: 'English', short: 'EN' },
  { id: 'de', label: 'Deutsch', short: 'DE' },
  { id: 'ne', label: 'नेपाली', short: 'ने' },
];

export function asLang(v: unknown): Lang | null {
  return v === 'en' || v === 'de' || v === 'ne' ? v : null;
}

export type Copy = {
  langLabel: string;
  kicker: string;
  h1: string;
  sub: string;
  nameLabel: string;
  namePh: string;
  kindLabel: string;
  kinds: Record<KindId, string>;
  kindIcons: Record<KindId, string>;
  cityLabel: string;
  cityPh: string;
  optional: string;
  go: string;
  goAgain: string;
  needName: string;
  tryLabel: string;
  examples: { name: string; kind: KindId; city: string }[];
  steps: Record<StepKey, string>;
  skip: string;
  replay: string;
  progressLabel: string;
  previewH: string;
  previewP: string;
  frameTitle: string;
  beforeFrameTitle: string;
  deviceLabel: string;
  devices: { desktop: string; tablet: string; phone: string };
  shuffleStyle: string;
  shuffleWords: string;
  styleNow: (name: string, i: number, n: number) => string;
  styles: Record<StyleId, string>;
  remixH: string;
  colourH: string;
  colourStyle: string;
  colourCustom: string;
  colourFitted: string;
  swatch: (hex: string) => string;
  sectionsH: string;
  sectionsHint: string;
  sectionNames: Record<SectionId, string>;
  show: (s: string) => string;
  moveUp: (s: string) => string;
  moveDown: (s: string) => string;
  dragHandle: (s: string) => string;
  wordsH: string;
  wordsHint: string;
  editHeadline: string;
  editSub: string;
  editHeading: (s: string) => string;
  clearEdits: string;
  baH: string;
  baP: string;
  before: string;
  after: string;
  baSlider: string;
  mock: { page: string; likes: string; follow: string; message: string; about: string; noPosts: string; posts: string };
  outH: string;
  outP: string;
  share: string;
  copied: string;
  copyFail: string;
  linkLabel: string;
  download: string;
  downloadHint: string;
  real: string;
  realHint: string;
  appInstead: string;
  reset: string;
  resetHint: string;
  said: {
    style: (s: string) => string;
    words: string;
    on: (s: string) => string;
    off: (s: string) => string;
    moved: (s: string, i: number) => string;
    colour: string;
    device: (d: string) => string;
    reset: string;
    done: string;
  };
  brief: BriefWords;
};

const ICONS: Record<KindId, string> = {
  restaurant: '🍛',
  shop: '🛍️',
  verein: '🏔️',
  artist: '🎤',
  tutor: '📚',
  event: '🎉',
  salon: '✂️',
  handy: '🧹',
  other: '✨',
};

const en: Copy = {
  langLabel: 'Language',
  kicker: 'Demo project · MartNepali Studio',
  h1: 'Your website in 10 seconds',
  sub: 'Type a name, pick what you are — and watch a whole website write, draw and lay itself out. Then shuffle the style, move sections around and take it with you.',
  nameLabel: 'Your name or your business’s name',
  namePh: 'e.g. Chiya Ghar',
  kindLabel: 'What are you?',
  kinds: {
    restaurant: 'Restaurant',
    shop: 'Shop',
    verein: 'Verein',
    artist: 'Artist / band',
    tutor: 'Tutor / school',
    event: 'Event',
    salon: 'Salon / beauty',
    handy: 'Cleaning / handyman',
    other: 'Something else',
  },
  kindIcons: ICONS,
  cityLabel: 'City',
  cityPh: 'e.g. Mainz',
  optional: 'optional',
  go: 'Build my website',
  goAgain: 'Build it again',
  needName: 'Type a name first — anything you like.',
  tryLabel: 'Or try one:',
  examples: [
    { name: 'Pahelo Pani', kind: 'restaurant', city: 'Mainz' },
    { name: 'Saathi Samaj', kind: 'verein', city: 'Kassel' },
    { name: 'Lali Guras Salon', kind: 'salon', city: '' },
  ],
  steps: {
    palette: 'Picking colours from the Himalaya…',
    logo: 'Drawing your logo…',
    welcome: 'Writing your welcome…',
    about: 'Telling your story…',
    menu: 'Laying out your menu…',
    products: 'Filling the shelves…',
    services: 'Listing what you do…',
    hours: 'Unlocking the door: opening hours…',
    gallery: 'Hanging up the pictures…',
    team: 'Introducing the team…',
    timetable: 'Planning the week…',
    events: 'Putting dates in the calendar…',
    testimonials: 'Collecting kind words…',
    faq: 'Answering the usual questions…',
    contact: 'Putting you on the map…',
    done: 'Done — your website is ready.',
  },
  skip: 'Skip',
  replay: 'Watch it build again',
  progressLabel: 'Building your website',
  previewH: 'Your website',
  previewP: 'A real page, not a picture: switch the width and watch it reflow. Links inside work like on any website.',
  frameTitle: 'Preview of your generated website',
  beforeFrameTitle: 'Your generated website, for the before and after comparison',
  deviceLabel: 'Screen width',
  devices: { desktop: 'Desktop', tablet: 'Tablet', phone: 'Phone' },
  shuffleStyle: 'Shuffle style',
  shuffleWords: 'Shuffle words',
  styleNow: (name, i, n) => `Style ${i} of ${n}: ${name}`,
  styles: {
    himalaya: 'Himalaya',
    chiya: 'Chiya house',
    night: 'Night bazaar',
    garden: 'Garden',
    editorial: 'Editorial',
    bazaar: 'Bazaar poster',
    studio: 'Studio mono',
    dusk: 'Dusk',
  },
  remixH: 'Make it yours',
  colourH: 'Colour',
  colourStyle: 'The style’s own',
  colourCustom: 'Your own colour',
  colourFitted: 'Darkened a little so text stays easy to read.',
  swatch: (hex) => `Colour ${hex}`,
  sectionsH: 'Sections',
  sectionsHint: 'Switch sections on or off. Drag them, or use the arrows, to change the order.',
  sectionNames: {
    about: 'About',
    menu: 'Menu',
    products: 'Shop shelf',
    services: 'Services',
    hours: 'Opening hours',
    gallery: 'Gallery',
    team: 'Team',
    timetable: 'Timetable',
    events: 'Dates',
    testimonials: 'Kind words',
    faq: 'Questions',
    contact: 'Contact & map',
  },
  show: (s) => `Show ${s}`,
  moveUp: (s) => `Move ${s} up`,
  moveDown: (s) => `Move ${s} down`,
  dragHandle: (s) => `Drag ${s}`,
  wordsH: 'Headings',
  wordsHint: 'Write your own — leave a field empty to keep the generated words.',
  editHeadline: 'Big headline',
  editSub: 'Line under it',
  editHeading: (s) => `${s} heading`,
  clearEdits: 'Back to the generated words',
  baH: 'Before and after',
  baP: 'A plain social-media page next to your own website. Drag the handle.',
  before: 'Before',
  after: 'After',
  baSlider: 'Compare before and after',
  mock: { page: 'Page', likes: '12 likes', follow: 'Follow', message: 'Message', about: 'About', noPosts: 'No posts yet', posts: 'Posts' },
  outH: 'Take it with you',
  outP: 'Everything stays in this browser until you share it.',
  share: 'Copy share link',
  copied: 'Link copied',
  copyFail: 'Copy the link from the box below',
  linkLabel: 'Share link',
  download: 'Download .html',
  downloadHint: 'One file, works offline, no scripts. Marked “Demo by MartNepali”.',
  real: 'Make it real — Kura garau',
  realHint: 'Opens our chat with your draft written in. Nothing is sent until you press send.',
  appInstead: 'Want an app instead? Build your idea →',
  reset: 'Reset',
  resetHint: 'Forget this site and start fresh',
  said: {
    style: (s) => `Style: ${s}`,
    words: 'New words',
    on: (s) => `${s} shown`,
    off: (s) => `${s} hidden`,
    moved: (s, i) => `${s} is now number ${i}`,
    colour: 'Colour changed',
    device: (d) => `Showing the ${d} width`,
    reset: 'Reset — type a new name',
    done: 'Your website is ready',
  },
  brief: {
    opening: (kind, name, city) => `Hi! I’d like a real website for ${kind} “${name}”${city ? ` in ${city}` : ''}.`,
    kinds: {
      restaurant: 'my restaurant',
      shop: 'my shop',
      verein: 'our Verein',
      artist: 'my music',
      tutor: 'my classes',
      event: 'our event',
      salon: 'my salon',
      handy: 'my cleaning / handyman work',
      other: 'my project',
    },
    style: (s) => `I made a 10-second draft in the “${s}” style.`,
    sections: (list) => `Sections: ${list}.`,
    colour: (hex) => `Colour ${hex}.`,
    draft: 'My draft:',
  },
};

const de: Copy = {
  langLabel: 'Sprache',
  kicker: 'Demo-Projekt · MartNepali Studio',
  h1: 'Deine Website in 10 Sekunden',
  sub: 'Gib einen Namen ein, wähle, was du bist — und schau zu, wie sich eine ganze Website schreibt, zeichnet und aufbaut. Dann misch den Stil, verschieb Abschnitte und nimm sie mit.',
  nameLabel: 'Dein Name oder der Name deines Geschäfts',
  namePh: 'z. B. Chiya Ghar',
  kindLabel: 'Was bist du?',
  kinds: {
    restaurant: 'Restaurant',
    shop: 'Laden',
    verein: 'Verein',
    artist: 'Musik / Band',
    tutor: 'Nachhilfe / Schule',
    event: 'Veranstaltung',
    salon: 'Salon / Beauty',
    handy: 'Reinigung / Handwerk',
    other: 'Etwas anderes',
  },
  kindIcons: ICONS,
  cityLabel: 'Stadt',
  cityPh: 'z. B. Mainz',
  optional: 'optional',
  go: 'Website bauen',
  goAgain: 'Nochmal bauen',
  needName: 'Gib zuerst einen Namen ein — egal welchen.',
  tryLabel: 'Oder probier:',
  examples: [
    { name: 'Pahelo Pani', kind: 'restaurant', city: 'Mainz' },
    { name: 'Saathi Samaj', kind: 'verein', city: 'Kassel' },
    { name: 'Lali Guras Salon', kind: 'salon', city: '' },
  ],
  steps: {
    palette: 'Farben aus dem Himalaya aussuchen…',
    logo: 'Dein Logo zeichnen…',
    welcome: 'Deine Begrüßung schreiben…',
    about: 'Deine Geschichte erzählen…',
    menu: 'Die Speisekarte setzen…',
    products: 'Die Regale füllen…',
    services: 'Aufschreiben, was du machst…',
    hours: 'Die Tür aufschließen: Öffnungszeiten…',
    gallery: 'Die Bilder aufhängen…',
    team: 'Das Team vorstellen…',
    timetable: 'Die Woche planen…',
    events: 'Termine in den Kalender tragen…',
    testimonials: 'Liebe Worte sammeln…',
    faq: 'Die üblichen Fragen beantworten…',
    contact: 'Dich auf die Karte setzen…',
    done: 'Fertig — deine Website steht.',
  },
  skip: 'Überspringen',
  replay: 'Nochmal zuschauen',
  progressLabel: 'Deine Website entsteht',
  previewH: 'Deine Website',
  previewP: 'Eine echte Seite, kein Bild: Wechsel die Breite und schau, wie sie sich neu anordnet. Links darin funktionieren wie auf jeder Website.',
  frameTitle: 'Vorschau deiner erzeugten Website',
  beforeFrameTitle: 'Deine erzeugte Website, für den Vorher-nachher-Vergleich',
  deviceLabel: 'Bildschirmbreite',
  devices: { desktop: 'Desktop', tablet: 'Tablet', phone: 'Handy' },
  shuffleStyle: 'Stil mischen',
  shuffleWords: 'Texte mischen',
  styleNow: (name, i, n) => `Stil ${i} von ${n}: ${name}`,
  styles: {
    himalaya: 'Himalaya',
    chiya: 'Chiya-Haus',
    night: 'Nachtbasar',
    garden: 'Garten',
    editorial: 'Magazin',
    bazaar: 'Basar-Plakat',
    studio: 'Studio Mono',
    dusk: 'Abendrot',
  },
  remixH: 'Mach sie zu deiner',
  colourH: 'Farbe',
  colourStyle: 'Die des Stils',
  colourCustom: 'Deine eigene Farbe',
  colourFitted: 'Etwas abgedunkelt, damit der Text gut lesbar bleibt.',
  swatch: (hex) => `Farbe ${hex}`,
  sectionsH: 'Abschnitte',
  sectionsHint: 'Schalte Abschnitte an oder aus. Zieh sie oder nutze die Pfeile, um die Reihenfolge zu ändern.',
  sectionNames: {
    about: 'Über uns',
    menu: 'Speisekarte',
    products: 'Ladenregal',
    services: 'Leistungen',
    hours: 'Öffnungszeiten',
    gallery: 'Galerie',
    team: 'Team',
    timetable: 'Stundenplan',
    events: 'Termine',
    testimonials: 'Liebe Worte',
    faq: 'Fragen',
    contact: 'Kontakt & Karte',
  },
  show: (s) => `${s} zeigen`,
  moveUp: (s) => `${s} nach oben`,
  moveDown: (s) => `${s} nach unten`,
  dragHandle: (s) => `${s} ziehen`,
  wordsH: 'Überschriften',
  wordsHint: 'Schreib deine eigenen — ein leeres Feld behält den erzeugten Text.',
  editHeadline: 'Große Überschrift',
  editSub: 'Zeile darunter',
  editHeading: (s) => `Überschrift ${s}`,
  clearEdits: 'Zurück zu den erzeugten Texten',
  baH: 'Vorher und nachher',
  baP: 'Eine schlichte Social-Media-Seite neben deiner eigenen Website. Zieh am Griff.',
  before: 'Vorher',
  after: 'Nachher',
  baSlider: 'Vorher und nachher vergleichen',
  mock: { page: 'Seite', likes: '12 Likes', follow: 'Folgen', message: 'Nachricht', about: 'Info', noPosts: 'Noch keine Beiträge', posts: 'Beiträge' },
  outH: 'Nimm sie mit',
  outP: 'Alles bleibt in diesem Browser, bis du es teilst.',
  share: 'Link kopieren',
  copied: 'Link kopiert',
  copyFail: 'Kopier den Link aus dem Feld unten',
  linkLabel: 'Link zum Teilen',
  download: '.html herunterladen',
  downloadHint: 'Eine Datei, läuft offline, ohne Skripte. Markiert mit „Demo von MartNepali“.',
  real: 'Mach sie echt — Kura garau',
  realHint: 'Öffnet unseren Chat mit deinem Entwurf. Nichts wird verschickt, bevor du auf Senden drückst.',
  appInstead: 'Lieber eine App? Bau deine Idee →',
  reset: 'Zurücksetzen',
  resetHint: 'Diese Website vergessen und neu anfangen',
  said: {
    style: (s) => `Stil: ${s}`,
    words: 'Neue Texte',
    on: (s) => `${s} sichtbar`,
    off: (s) => `${s} ausgeblendet`,
    moved: (s, i) => `${s} ist jetzt an Stelle ${i}`,
    colour: 'Farbe geändert',
    device: (d) => `Breite: ${d}`,
    reset: 'Zurückgesetzt — gib einen neuen Namen ein',
    done: 'Deine Website ist fertig',
  },
  brief: {
    opening: (kind, name, city) => `Hallo! Ich hätte gern eine echte Website für ${kind} „${name}“${city ? ` in ${city}` : ''}.`,
    kinds: {
      restaurant: 'mein Restaurant',
      shop: 'meinen Laden',
      verein: 'unseren Verein',
      artist: 'meine Musik',
      tutor: 'meinen Unterricht',
      event: 'unsere Veranstaltung',
      salon: 'meinen Salon',
      handy: 'meine Reinigung / mein Handwerk',
      other: 'mein Projekt',
    },
    style: (s) => `Ich habe einen 10-Sekunden-Entwurf im Stil „${s}“ gemacht.`,
    sections: (list) => `Abschnitte: ${list}.`,
    colour: (hex) => `Farbe ${hex}.`,
    draft: 'Mein Entwurf:',
  },
};

const ne: Copy = {
  langLabel: 'भाषा',
  kicker: 'डेमो परियोजना · MartNepali स्टुडियो',
  h1: '१० सेकेन्डमा तपाईंको वेबसाइट',
  sub: 'नाम लेख्नुहोस्, आफू के हो छान्नुहोस् — अनि पूरै वेबसाइट आफैँ लेखिँदै, कोरिँदै र मिलिँदै गरेको हेर्नुहोस्। त्यसपछि शैली फेर्नुहोस्, खण्ड सार्नुहोस् र साथमा लैजानुहोस्।',
  nameLabel: 'तपाईंको वा तपाईंको व्यवसायको नाम',
  namePh: 'जस्तै: Chiya Ghar',
  kindLabel: 'तपाईं के हो?',
  kinds: {
    restaurant: 'रेस्टुरेन्ट',
    shop: 'पसल',
    verein: 'संस्था (Verein)',
    artist: 'कलाकार / ब्यान्ड',
    tutor: 'ट्युसन / विद्यालय',
    event: 'कार्यक्रम',
    salon: 'सैलुन / सौन्दर्य',
    handy: 'सरसफाइ / मर्मत',
    other: 'अरू केही',
  },
  kindIcons: ICONS,
  cityLabel: 'सहर',
  cityPh: 'जस्तै: Mainz',
  optional: 'ऐच्छिक',
  go: 'मेरो वेबसाइट बनाउनुहोस्',
  goAgain: 'फेरि बनाउनुहोस्',
  needName: 'पहिले कुनै नाम लेख्नुहोस् — जे मन लाग्छ।',
  tryLabel: 'वा यो हेर्नुहोस्:',
  examples: [
    { name: 'Pahelo Pani', kind: 'restaurant', city: 'Mainz' },
    { name: 'Saathi Samaj', kind: 'verein', city: 'Kassel' },
    { name: 'Lali Guras Salon', kind: 'salon', city: '' },
  ],
  steps: {
    palette: 'हिमालबाट रङ छान्दै…',
    logo: 'तपाईंको लोगो कोर्दै…',
    welcome: 'स्वागतका शब्द लेख्दै…',
    about: 'तपाईंको कथा भन्दै…',
    menu: 'मेनु मिलाउँदै…',
    products: 'दराज भर्दै…',
    services: 'तपाईं के गर्नुहुन्छ लेख्दै…',
    hours: 'ढोका खोल्दै: खुल्ने समय…',
    gallery: 'तस्बिर झुण्ड्याउँदै…',
    team: 'टिम चिनाउँदै…',
    timetable: 'हप्ताको योजना बनाउँदै…',
    events: 'पात्रोमा मिति राख्दै…',
    testimonials: 'मीठा शब्द बटुल्दै…',
    faq: 'सधैँका प्रश्नको उत्तर दिँदै…',
    contact: 'तपाईंलाई नक्सामा राख्दै…',
    done: 'सकियो — तपाईंको वेबसाइट तयार छ।',
  },
  skip: 'छाड्नुहोस्',
  replay: 'फेरि बनेको हेर्नुहोस्',
  progressLabel: 'तपाईंको वेबसाइट बन्दैछ',
  previewH: 'तपाईंको वेबसाइट',
  previewP: 'तस्बिर होइन, साँचो पेज: चौडाइ फेर्नुहोस् र मिलिएको हेर्नुहोस्। भित्रका लिङ्क अरू वेबसाइटमा जस्तै चल्छन्।',
  frameTitle: 'तपाईंको बनेको वेबसाइटको पूर्वावलोकन',
  beforeFrameTitle: 'पहिले र पछिको तुलनाका लागि तपाईंको वेबसाइट',
  deviceLabel: 'स्क्रिनको चौडाइ',
  devices: { desktop: 'डेस्कटप', tablet: 'ट्याब्लेट', phone: 'मोबाइल' },
  shuffleStyle: 'शैली फेर्नुहोस्',
  shuffleWords: 'शब्द फेर्नुहोस्',
  styleNow: (name, i, n) => `शैली ${String(i).replace(/[0-9]/g, (d) => '०१२३४५६७८९'[Number(d)])}/${String(n).replace(/[0-9]/g, (d) => '०१२३४५६७८९'[Number(d)])}: ${name}`,
  styles: {
    himalaya: 'हिमालय',
    chiya: 'चिया पसल',
    night: 'राति बजार',
    garden: 'बगैँचा',
    editorial: 'पत्रिका',
    bazaar: 'बजार पोस्टर',
    studio: 'स्टुडियो मोनो',
    dusk: 'साँझ',
  },
  remixH: 'आफ्नै बनाउनुहोस्',
  colourH: 'रङ',
  colourStyle: 'शैलीकै रङ',
  colourCustom: 'आफ्नै रङ',
  colourFitted: 'अक्षर सजिलै पढिन अलिकति गाढा बनाइयो।',
  swatch: (hex) => `रङ ${hex}`,
  sectionsH: 'खण्डहरू',
  sectionsHint: 'खण्ड देखाउनुहोस् वा लुकाउनुहोस्। क्रम बदल्न तान्नुहोस् वा तीर थिच्नुहोस्।',
  sectionNames: {
    about: 'बारेमा',
    menu: 'मेनु',
    products: 'पसलको दराज',
    services: 'सेवा',
    hours: 'खुल्ने समय',
    gallery: 'तस्बिर',
    team: 'टिम',
    timetable: 'तालिका',
    events: 'मितिहरू',
    testimonials: 'मीठा शब्द',
    faq: 'प्रश्न',
    contact: 'सम्पर्क र नक्सा',
  },
  show: (s) => `${s} देखाउनुहोस्`,
  moveUp: (s) => `${s} माथि सार्नुहोस्`,
  moveDown: (s) => `${s} तल सार्नुहोस्`,
  dragHandle: (s) => `${s} तान्नुहोस्`,
  wordsH: 'शीर्षकहरू',
  wordsHint: 'आफ्नै लेख्नुहोस् — खाली छाडे बनेका शब्द नै रहन्छन्।',
  editHeadline: 'ठूलो शीर्षक',
  editSub: 'त्यसमुनिको हरफ',
  editHeading: (s) => `${s}को शीर्षक`,
  clearEdits: 'बनेका शब्दमै फर्कनुहोस्',
  baH: 'पहिले र पछि',
  baP: 'साधारण सामाजिक सञ्जालको पेज र तपाईंको आफ्नै वेबसाइट। बीचको ह्यान्डल तान्नुहोस्।',
  before: 'पहिले',
  after: 'पछि',
  baSlider: 'पहिले र पछि तुलना गर्नुहोस्',
  mock: { page: 'पेज', likes: '१२ लाइक', follow: 'फलो', message: 'सन्देश', about: 'बारेमा', noPosts: 'अहिलेसम्म कुनै पोस्ट छैन', posts: 'पोस्ट' },
  outH: 'साथमा लैजानुहोस्',
  outP: 'तपाईंले नबाँडेसम्म सबै यही ब्राउजरमा रहन्छ।',
  share: 'बाँड्ने लिङ्क कपी गर्नुहोस्',
  copied: 'लिङ्क कपी भयो',
  copyFail: 'तलको बाकसबाट लिङ्क कपी गर्नुहोस्',
  linkLabel: 'बाँड्ने लिङ्क',
  download: '.html डाउनलोड गर्नुहोस्',
  downloadHint: 'एउटै फाइल, अफलाइन चल्छ, कुनै स्क्रिप्ट छैन। “MartNepali को डेमो” लेखिएको।',
  real: 'साँचो बनाऔँ — Kura garau',
  realHint: 'तपाईंको मस्यौदा लेखिएको हाम्रो च्याट खुल्छ। तपाईंले पठाउनुहोस् नथिचेसम्म केही पठाइँदैन।',
  appInstead: 'एप चाहियो? आफ्नो विचार बनाउनुहोस् →',
  reset: 'सुरुबाट',
  resetHint: 'यो वेबसाइट बिर्सेर नयाँ सुरु गर्नुहोस्',
  said: {
    style: (s) => `शैली: ${s}`,
    words: 'नयाँ शब्द',
    on: (s) => `${s} देखाइयो`,
    off: (s) => `${s} लुकाइयो`,
    moved: (s, i) => `${s} अब ${String(i).replace(/[0-9]/g, (d) => '०१२३४५६७८९'[Number(d)])} नम्बरमा`,
    colour: 'रङ फेरियो',
    device: (d) => `${d}को चौडाइ`,
    reset: 'सुरुबाट — नयाँ नाम लेख्नुहोस्',
    done: 'तपाईंको वेबसाइट तयार छ',
  },
  brief: {
    opening: (kind, name, city) => `नमस्ते! ${city ? `${city}मा ` : ''}${kind} “${name}”का लागि साँचो वेबसाइट चाहियो।`,
    kinds: {
      restaurant: 'मेरो रेस्टुरेन्ट',
      shop: 'मेरो पसल',
      verein: 'हाम्रो संस्था',
      artist: 'मेरो सङ्गीत',
      tutor: 'मेरो कक्षा',
      event: 'हाम्रो कार्यक्रम',
      salon: 'मेरो सैलुन',
      handy: 'मेरो सरसफाइ / मर्मतको काम',
      other: 'मेरो परियोजना',
    },
    style: (s) => `मैले “${s}” शैलीमा १० सेकेन्डको मस्यौदा बनाएँ।`,
    sections: (list) => `खण्डहरू: ${list}।`,
    colour: (hex) => `रङ ${hex}।`,
    draft: 'मेरो मस्यौदा:',
  },
};

export const COPY: Record<Lang, Copy> = { en, de, ne };

export type Frame = {
  badge: string;
  text: string;
  all: string;
  kicker: string;
  endH: string;
  endP: string;
  points: string[];
  talk: string;
  more: string;
  app: string;
  free: string;
};

export const FRAME: Record<Lang, Frame> = {
  en: {
    badge: 'Demo project',
    text: 'Built by MartNepali · runs in your browser, nothing is sent',
    all: '← All demos',
    kicker: 'MartNepali Studio · Demo project',
    endH: 'Liked your 10-second website?',
    endP: 'This is a draft from templates. A real website gets your own photos, your own words, your real menu, hours and map — and it can grow into bookings, tickets or a shop when you need them.',
    points: ['Your photos and your words', 'English, Deutsch and नेपाली', 'Made for phones first', 'Easy for you to update'],
    talk: 'Kura garau',
    more: 'See all our work',
    app: 'Want an app instead? Build your idea →',
    free: 'Free while we grow.',
  },
  de: {
    badge: 'Demo-Projekt',
    text: 'Gebaut von MartNepali · läuft in deinem Browser, nichts wird verschickt',
    all: '← Alle Demos',
    kicker: 'MartNepali Studio · Demo-Projekt',
    endH: 'Gefällt dir deine 10-Sekunden-Website?',
    endP: 'Das ist ein Entwurf aus Vorlagen. Eine echte Website bekommt deine eigenen Fotos, deine eigenen Worte, deine echte Karte, Zeiten und Anfahrt — und kann zu Reservierungen, Tickets oder einem Shop wachsen, wenn du sie brauchst.',
    points: ['Deine Fotos und deine Worte', 'English, Deutsch und नेपाली', 'Zuerst fürs Handy gemacht', 'Leicht selbst zu pflegen'],
    talk: 'Kura garau',
    more: 'Alle unsere Arbeiten',
    app: 'Lieber eine App? Bau deine Idee →',
    free: 'Kostenlos, solange wir wachsen.',
  },
  ne: {
    badge: 'डेमो परियोजना',
    text: 'MartNepali ले बनाएको · तपाईंकै ब्राउजरमा चल्छ, केही पठाइँदैन',
    all: '← सबै डेमो',
    kicker: 'MartNepali स्टुडियो · डेमो परियोजना',
    endH: '१० सेकेन्डको वेबसाइट मन पर्यो?',
    endP: 'यो टेम्प्लेटबाट बनेको मस्यौदा हो। साँचो वेबसाइटमा तपाईंकै तस्बिर, तपाईंकै शब्द, साँचो मेनु, समय र नक्सा हुन्छ — र चाहिएको बेला बुकिङ, टिकट वा पसलसम्म बढ्न सक्छ।',
    points: ['तपाईंकै तस्बिर र शब्द', 'English, Deutsch र नेपाली', 'पहिले मोबाइलका लागि', 'आफैँ सजिलै अपडेट गर्न मिल्ने'],
    talk: 'Kura garau',
    more: 'हाम्रा सबै काम',
    app: 'एप चाहियो? आफ्नो विचार बनाउनुहोस् →',
    free: 'हामी बढ्दै गर्दा निःशुल्क।',
  },
};
