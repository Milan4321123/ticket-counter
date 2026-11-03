// Words for /work/card (link page + business card maker) in English, Deutsch
// and नेपाली, and the four starter templates. Every name, handle, number and
// address in the templates is made up (example.com addresses, 000 numbers,
// ".demo" handles). No prices, price lists, packages or "hire" wording in any
// language — tests/cardMaker.test.ts reads every string here.

import { EMPTY_STATE, normalizeState, type ButtonStyle, type CardState, type FontId, type Lang, type LinkType, type ThemeId } from './card';

const NE_DIGITS = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
/** Digits in the visitor's language (Devanagari in नेपाली). */
export function num(n: number | string, lang: Lang): string {
  return lang === 'ne' ? String(n).replace(/[0-9]/g, (d) => NE_DIGITS[Number(d)]) : String(n);
}

export const LANGS: { id: Lang; label: string }[] = [
  { id: 'en', label: 'EN' },
  { id: 'de', label: 'DE' },
  { id: 'ne', label: 'नेपाली' },
];

export type TemplateId = 'momo' | 'tutor' | 'dj' | 'artist';
export const TEMPLATE_IDS: TemplateId[] = ['momo', 'tutor', 'dj', 'artist'];

type TypeText = { name: string; ph: string; def: string };

export type Copy = {
  title: string;
  tagline: string;
  langLabel: string;
  reset: string;
  resetDone: string;
  local: string;
  templatesH: string;
  templatesHint: string;
  templates: Record<TemplateId, string>;
  templateDone: (name: string) => string;
  tabsLabel: string;
  tabs: { page: string; card: string };
  profileH: string;
  nameL: string;
  namePh: string;
  roleL: string;
  rolePh: string;
  bioL: string;
  bioPh: string;
  optional: string;
  photoL: string;
  photoUpload: string;
  photoChange: string;
  photoRemove: string;
  photoNote: string;
  photoError: string;
  initialsL: string;
  initialsHint: string;
  linksH: string;
  linksHint: string;
  linkN: (n: string) => string;
  addH: string;
  typeL: string;
  valueL: string;
  labelL: string;
  labelPh: string;
  add: string;
  full: (n: string) => string;
  types: Record<LinkType, TypeText>;
  errors: { empty: string; scheme: string; invalid: string; email: string; phone: string; hostEvent: string; hostWa: string; hostOther: string };
  moveUp: string;
  moveDown: string;
  remove: string;
  handle: string;
  movedTo: (label: string, pos: string) => string;
  removed: (label: string) => string;
  added: (label: string) => string;
  refused: string;
  notShown: string;
  lookH: string;
  themeL: string;
  themes: Record<ThemeId, string>;
  accentL: string;
  accentAuto: string;
  accentOwn: string;
  buttonL: string;
  buttons: Record<ButtonStyle, string>;
  fontL: string;
  fonts: Record<FontId, string>;
  animL: string;
  animCalm: string;
  publishH: string;
  publishHint: string;
  publishBtn: string;
  publishAgain: string;
  publishedL: string;
  copy: string;
  copied: string;
  open: string;
  publishSim: string;
  droppedAvatar: string;
  droppedLinks: (n: string) => string;
  statsH: string;
  statsSim: string;
  views: string;
  clicks: (n: string) => string;
  statsEmpty: string;
  page: {
    madeWith: string;
    makeOwn: string;
    editCopy: string;
    empty: string;
    previewLabel: string;
    demoNote: string;
  };
  card: {
    h: string;
    label: string;
    flip: string;
    front: string;
    back: string;
    showingFront: string;
    showingBack: string;
    hint: string;
    scan: string;
    showH: string;
    show: { phone: string; email: string; web: string };
    downloadsH: string;
    png: string;
    pngNote: string;
    vcf: string;
    vcfNote: string;
    pass: string;
    passNote: string;
    making: string;
    saved: (file: string) => string;
    qrFull: string;
    qrShort: string;
    passKicker: string;
    passPhone: string;
    passEmail: string;
    passFoot: string;
    noName: string;
  };
  dock: { live: string; see: string };
};

const en: Copy = {
  title: 'Link page & card maker',
  tagline: 'One link for everything — and a card to hand out. Made in a minute.',
  langLabel: 'Language',
  reset: 'Reset demo',
  resetDone: 'Demo reset — back to the start.',
  local: 'Everything stays in this browser. Nothing you type or add is sent anywhere.',
  templatesH: 'Start from a template',
  templatesHint: 'One tap fills in everything — then make it yours.',
  templates: { momo: 'Momo stall', tutor: 'Nepali tutor', dj: 'DJ', artist: 'Artist' },
  templateDone: (n) => `Filled in: ${n}.`,
  tabsLabel: 'What to make',
  tabs: { page: 'Link page', card: 'Business card' },
  profileH: 'You',
  nameL: 'Name',
  namePh: 'Your name or your stall',
  roleL: 'What you do',
  rolePh: 'Momo, Nepali classes, DJ sets…',
  bioL: 'A line about you',
  bioPh: 'Where to find you, what makes you you',
  optional: 'optional',
  photoL: 'Picture',
  photoUpload: 'Choose a photo',
  photoChange: 'Change photo',
  photoRemove: 'Use letters instead',
  photoNote: 'Your photo never leaves this browser: it is made small (256 px) right here and is not uploaded anywhere.',
  photoError: 'That file could not be read as a picture.',
  initialsL: 'Letters',
  initialsHint: 'Up to 3 — leave empty to take them from your name',
  linksH: 'Links',
  linksHint: 'Drag ⋮⋮ to change the order, or use the arrows.',
  linkN: (n) => `Link ${n}`,
  addH: 'Add a link',
  typeL: 'Type',
  valueL: 'Address, handle or number',
  labelL: 'Button text',
  labelPh: 'Empty = the usual words',
  add: 'Add link',
  full: (n) => `That is ${n} links — the most one page holds.`,
  types: {
    website: { name: 'Website', ph: 'yoursite.com', def: 'Website' },
    whatsapp: { name: 'WhatsApp', ph: '+49 151 …', def: 'WhatsApp' },
    instagram: { name: 'Instagram', ph: '@yourname', def: 'Instagram' },
    tiktok: { name: 'TikTok', ph: '@yourname', def: 'TikTok' },
    youtube: { name: 'YouTube', ph: '@yourchannel', def: 'YouTube' },
    facebook: { name: 'Facebook', ph: 'yourpage', def: 'Facebook' },
    email: { name: 'Email', ph: 'you@example.com', def: 'Email' },
    phone: { name: 'Phone', ph: '+49 151 …', def: 'Call' },
    maps: { name: 'Map', ph: 'Street, town — or a map link', def: 'Find us' },
    event: { name: 'Next event on MartNepali', ph: 'martnepali.com/e/…', def: 'Next event' },
    menu: { name: 'Menu', ph: 'yoursite.com/menu', def: 'Menu' },
  },
  errors: {
    empty: 'Type an address first.',
    scheme: 'Only web (https), email and phone links are allowed here.',
    invalid: 'That does not look like a web address.',
    email: 'That does not look like an email address.',
    phone: 'A phone number needs 6 to 15 digits.',
    hostEvent: 'Use a link from martnepali.com for your next event.',
    hostWa: 'Use your number, or a wa.me link.',
    hostOther: 'That link is not from the right site.',
  },
  moveUp: 'Move up',
  moveDown: 'Move down',
  remove: 'Delete',
  handle: 'Drag to change the order',
  movedTo: (l, p) => `${l} moved to place ${p}.`,
  removed: (l) => `${l} deleted.`,
  added: (l) => `${l} added.`,
  refused: 'Not added:',
  notShown: 'Hidden on the page until it is fixed.',
  lookH: 'Look',
  themeL: 'Theme',
  themes: { himalaya: 'Himalaya', dhaka: 'Dhaka', flags: 'Prayer flags', night: 'Night market', minimal: 'Minimal light', neon: 'Neon' },
  accentL: 'Accent colour',
  accentAuto: 'Theme colour',
  accentOwn: 'Your own colour',
  buttonL: 'Buttons',
  buttons: { pill: 'Pill', square: 'Square', outline: 'Outline' },
  fontL: 'Font',
  fonts: { clean: 'Clean', friendly: 'Friendly', classic: 'Classic', type: 'Typewriter' },
  animL: 'Animated background',
  animCalm: 'Your device asks for less motion, so the background stays still on this screen.',
  publishH: 'Publish',
  publishHint: 'Get one link for your Instagram bio, your WhatsApp status or a poster.',
  publishBtn: 'Publish my page',
  publishAgain: 'Publish again with my changes',
  publishedL: 'Your link',
  copy: 'Copy',
  copied: 'Copied',
  open: 'Open it',
  publishSim: 'Simulated: nothing is uploaded — your whole page is packed into the link itself. A real version would give you a short address.',
  droppedAvatar: 'Your photo was too big to fit into a link, so the published page shows your letters instead.',
  droppedLinks: (n) => `${n} link(s) did not fit into the link and were left off.`,
  statsH: 'Stats',
  statsSim: 'Simulated — made-up visitors, to show what you would see. Not real data.',
  views: 'Page views',
  clicks: (n) => `${n} clicks`,
  statsEmpty: 'Add a link to see its clicks.',
  page: {
    madeWith: 'Made with the MartNepali demo',
    makeOwn: 'Make your own →',
    editCopy: 'Edit a copy',
    empty: 'Your links will show up here.',
    previewLabel: 'Live preview of your link page',
    demoNote: 'A demo page — made up, not a real business.',
  },
  card: {
    h: 'Your card',
    label: 'Your business card — press to flip',
    flip: 'Flip card',
    front: 'Front',
    back: 'Back',
    showingFront: 'Showing the front.',
    showingBack: 'Showing the back with the QR code.',
    hint: 'Tap the card to flip it.',
    scan: 'Scan for all my links',
    showH: 'On the front',
    show: { phone: 'Phone', email: 'Email', web: 'Website' },
    downloadsH: 'Downloads',
    png: 'Card picture (PNG)',
    pngNote: 'Front and back, ready to print or send.',
    vcf: 'Contact file (.vcf)',
    vcfNote: 'Opens in Contacts on any phone: name, number, email and your links.',
    pass: 'Wallet-style pass (picture)',
    passNote: 'Just a picture that looks like a wallet pass — not a real Apple or Google Wallet pass.',
    making: 'Making…',
    saved: (f) => `Saved ${f}.`,
    qrFull: 'The QR on the back opens your link page.',
    qrShort: 'Your page is too long for a small QR code, so it opens your first web link instead.',
    passKicker: 'DEMO · NOT A REAL WALLET PASS',
    passPhone: 'Phone',
    passEmail: 'Email',
    passFoot: 'A look-alike picture made with the MartNepali demo',
    noName: 'Your name',
  },
  dock: { live: 'Live preview', see: 'See it' },
};

const de: Copy = {
  title: 'Linkseite & Visitenkarte',
  tagline: 'Ein Link für alles — und eine Karte zum Weitergeben. In einer Minute gemacht.',
  langLabel: 'Sprache',
  reset: 'Demo zurücksetzen',
  resetDone: 'Demo zurückgesetzt — alles wie am Anfang.',
  local: 'Alles bleibt in diesem Browser. Nichts, was du eingibst oder hinzufügst, wird verschickt.',
  templatesH: 'Mit einer Vorlage starten',
  templatesHint: 'Ein Tipp füllt alles aus — dann mach es zu deinem.',
  templates: { momo: 'Momo-Stand', tutor: 'Nepali-Lehrerin', dj: 'DJ', artist: 'Künstlerin' },
  templateDone: (n) => `Ausgefüllt: ${n}.`,
  tabsLabel: 'Was du machst',
  tabs: { page: 'Linkseite', card: 'Visitenkarte' },
  profileH: 'Du',
  nameL: 'Name',
  namePh: 'Dein Name oder dein Stand',
  roleL: 'Was du machst',
  rolePh: 'Momos, Nepali-Kurse, DJ-Sets…',
  bioL: 'Ein Satz über dich',
  bioPh: 'Wo man dich findet, was dich ausmacht',
  optional: 'optional',
  photoL: 'Bild',
  photoUpload: 'Foto wählen',
  photoChange: 'Foto ändern',
  photoRemove: 'Lieber Buchstaben',
  photoNote: 'Dein Foto verlässt diesen Browser nie: Es wird hier auf 256 px verkleinert und nirgendwohin hochgeladen.',
  photoError: 'Diese Datei ließ sich nicht als Bild lesen.',
  initialsL: 'Buchstaben',
  initialsHint: 'Bis zu 3 — leer lassen, dann kommen sie aus deinem Namen',
  linksH: 'Links',
  linksHint: 'Zieh an ⋮⋮, um die Reihenfolge zu ändern, oder nimm die Pfeile.',
  linkN: (n) => `Link ${n}`,
  addH: 'Link hinzufügen',
  typeL: 'Art',
  valueL: 'Adresse, Name oder Nummer',
  labelL: 'Text auf dem Knopf',
  labelPh: 'Leer = die üblichen Worte',
  add: 'Link hinzufügen',
  full: (n) => `Das sind ${n} Links — mehr passen nicht auf eine Seite.`,
  types: {
    website: { name: 'Website', ph: 'deineseite.de', def: 'Website' },
    whatsapp: { name: 'WhatsApp', ph: '+49 151 …', def: 'WhatsApp' },
    instagram: { name: 'Instagram', ph: '@deinname', def: 'Instagram' },
    tiktok: { name: 'TikTok', ph: '@deinname', def: 'TikTok' },
    youtube: { name: 'YouTube', ph: '@deinkanal', def: 'YouTube' },
    facebook: { name: 'Facebook', ph: 'deineseite', def: 'Facebook' },
    email: { name: 'E-Mail', ph: 'du@example.com', def: 'E-Mail' },
    phone: { name: 'Telefon', ph: '+49 151 …', def: 'Anrufen' },
    maps: { name: 'Karte', ph: 'Straße, Ort — oder ein Kartenlink', def: 'So findest du uns' },
    event: { name: 'Nächstes Event auf MartNepali', ph: 'martnepali.com/e/…', def: 'Nächstes Event' },
    menu: { name: 'Speisekarte', ph: 'deineseite.de/karte', def: 'Speisekarte' },
  },
  errors: {
    empty: 'Gib zuerst eine Adresse ein.',
    scheme: 'Hier gehen nur Web- (https), E-Mail- und Telefonlinks.',
    invalid: 'Das sieht nicht nach einer Webadresse aus.',
    email: 'Das sieht nicht nach einer E-Mail-Adresse aus.',
    phone: 'Eine Telefonnummer braucht 6 bis 15 Ziffern.',
    hostEvent: 'Nimm für dein nächstes Event einen Link von martnepali.com.',
    hostWa: 'Nimm deine Nummer oder einen wa.me-Link.',
    hostOther: 'Dieser Link ist nicht von der richtigen Seite.',
  },
  moveUp: 'Nach oben',
  moveDown: 'Nach unten',
  remove: 'Löschen',
  handle: 'Ziehen, um die Reihenfolge zu ändern',
  movedTo: (l, p) => `${l} ist jetzt auf Platz ${p}.`,
  removed: (l) => `${l} gelöscht.`,
  added: (l) => `${l} hinzugefügt.`,
  refused: 'Nicht hinzugefügt:',
  notShown: 'Auf der Seite versteckt, bis er stimmt.',
  lookH: 'Aussehen',
  themeL: 'Thema',
  themes: { himalaya: 'Himalaya', dhaka: 'Dhaka', flags: 'Gebetsfahnen', night: 'Nachtmarkt', minimal: 'Schlicht hell', neon: 'Neon' },
  accentL: 'Akzentfarbe',
  accentAuto: 'Farbe des Themas',
  accentOwn: 'Eigene Farbe',
  buttonL: 'Knöpfe',
  buttons: { pill: 'Pille', square: 'Eckig', outline: 'Umriss' },
  fontL: 'Schrift',
  fonts: { clean: 'Klar', friendly: 'Freundlich', classic: 'Klassisch', type: 'Schreibmaschine' },
  animL: 'Bewegter Hintergrund',
  animCalm: 'Dein Gerät wünscht weniger Bewegung, deshalb bleibt der Hintergrund hier still.',
  publishH: 'Veröffentlichen',
  publishHint: 'Ein Link für deine Instagram-Bio, deinen WhatsApp-Status oder ein Plakat.',
  publishBtn: 'Meine Seite veröffentlichen',
  publishAgain: 'Mit meinen Änderungen neu veröffentlichen',
  publishedL: 'Dein Link',
  copy: 'Kopieren',
  copied: 'Kopiert',
  open: 'Öffnen',
  publishSim: 'Nur simuliert: Nichts wird hochgeladen — deine ganze Seite steckt im Link selbst. Eine echte Version gäbe dir eine kurze Adresse.',
  droppedAvatar: 'Dein Foto war zu groß für einen Link, deshalb zeigt die veröffentlichte Seite deine Buchstaben.',
  droppedLinks: (n) => `${n} Link(s) passten nicht mehr in den Link und wurden weggelassen.`,
  statsH: 'Statistik',
  statsSim: 'Simuliert — erfundene Besucher, damit du siehst, wie es aussähe. Keine echten Daten.',
  views: 'Seitenaufrufe',
  clicks: (n) => `${n} Klicks`,
  statsEmpty: 'Füge einen Link hinzu, um seine Klicks zu sehen.',
  page: {
    madeWith: 'Gemacht mit der MartNepali-Demo',
    makeOwn: 'Mach deine eigene →',
    editCopy: 'Kopie bearbeiten',
    empty: 'Hier erscheinen deine Links.',
    previewLabel: 'Live-Vorschau deiner Linkseite',
    demoNote: 'Eine Demo-Seite — erfunden, kein echtes Geschäft.',
  },
  card: {
    h: 'Deine Karte',
    label: 'Deine Visitenkarte — drücken zum Umdrehen',
    flip: 'Karte umdrehen',
    front: 'Vorderseite',
    back: 'Rückseite',
    showingFront: 'Die Vorderseite ist zu sehen.',
    showingBack: 'Die Rückseite mit dem QR-Code ist zu sehen.',
    hint: 'Tipp auf die Karte, um sie umzudrehen.',
    scan: 'Scannen für alle meine Links',
    showH: 'Auf der Vorderseite',
    show: { phone: 'Telefon', email: 'E-Mail', web: 'Website' },
    downloadsH: 'Downloads',
    png: 'Kartenbild (PNG)',
    pngNote: 'Vorder- und Rückseite, zum Drucken oder Verschicken.',
    vcf: 'Kontaktdatei (.vcf)',
    vcfNote: 'Öffnet sich in den Kontakten jedes Handys: Name, Nummer, E-Mail und deine Links.',
    pass: 'Wallet-Look (Bild)',
    passNote: 'Nur ein Bild, das wie ein Wallet-Pass aussieht — kein echter Apple- oder Google-Wallet-Pass.',
    making: 'Wird erstellt…',
    saved: (f) => `${f} gespeichert.`,
    qrFull: 'Der QR-Code auf der Rückseite öffnet deine Linkseite.',
    qrShort: 'Deine Seite ist zu lang für einen kleinen QR-Code, deshalb öffnet er deinen ersten Weblink.',
    passKicker: 'DEMO · KEIN ECHTER WALLET-PASS',
    passPhone: 'Telefon',
    passEmail: 'E-Mail',
    passFoot: 'Ein nachgemachtes Bild aus der MartNepali-Demo',
    noName: 'Dein Name',
  },
  dock: { live: 'Live-Vorschau', see: 'Ansehen' },
};

const ne: Copy = {
  title: 'लिङ्क पेज र कार्ड मेकर',
  tagline: 'सबै कुराका लागि एउटै लिङ्क — र बाँड्न मिल्ने कार्ड। एक मिनेटमै तयार।',
  langLabel: 'भाषा',
  reset: 'डेमो सुरुबाट',
  resetDone: 'डेमो सुरुबाट — सबै पहिलेजस्तै।',
  local: 'सबै कुरा यही ब्राउजरमा रहन्छ। तपाईंले लेखेको वा थपेको केही पनि कतै पठाइँदैन।',
  templatesH: 'टेम्प्लेटबाट सुरु गर्नुहोस्',
  templatesHint: 'एक ट्याप गर्दा सबै भरिन्छ — त्यसपछि आफ्नो बनाउनुहोस्।',
  templates: { momo: 'मम पसल', tutor: 'नेपाली शिक्षिका', dj: 'डीजे', artist: 'कलाकार' },
  templateDone: (n) => `भरियो: ${n}।`,
  tabsLabel: 'के बनाउने',
  tabs: { page: 'लिङ्क पेज', card: 'बिजनेस कार्ड' },
  profileH: 'तपाईं',
  nameL: 'नाम',
  namePh: 'तपाईंको नाम वा पसलको नाम',
  roleL: 'तपाईं के गर्नुहुन्छ',
  rolePh: 'मम, नेपाली कक्षा, डीजे…',
  bioL: 'आफ्नोबारे एक लाइन',
  bioPh: 'कहाँ भेटिनुहुन्छ, के खास छ',
  optional: 'ऐच्छिक',
  photoL: 'तस्बिर',
  photoUpload: 'फोटो छान्नुहोस्',
  photoChange: 'फोटो बदल्नुहोस्',
  photoRemove: 'अक्षर नै राख्नुहोस्',
  photoNote: 'तपाईंको फोटो यो ब्राउजरबाट कहिल्यै बाहिर जाँदैन: यहीँ सानो (२५६ px) बनाइन्छ र कतै अपलोड हुँदैन।',
  photoError: 'यो फाइल तस्बिरको रूपमा पढ्न सकिएन।',
  initialsL: 'अक्षर',
  initialsHint: '३ सम्म — खाली छोडे नामबाटै लिइन्छ',
  linksH: 'लिङ्कहरू',
  linksHint: 'क्रम बदल्न ⋮⋮ तान्नुहोस्, वा तीर थिच्नुहोस्।',
  linkN: (n) => `लिङ्क ${n}`,
  addH: 'लिङ्क थप्नुहोस्',
  typeL: 'प्रकार',
  valueL: 'ठेगाना, नाम वा नम्बर',
  labelL: 'बटनमा लेख्ने',
  labelPh: 'खाली = सामान्य शब्द',
  add: 'लिङ्क थप्नुहोस्',
  full: (n) => `${n} लिङ्क भइसक्यो — एउटा पेजमा यति नै अटाउँछ।`,
  types: {
    website: { name: 'वेबसाइट', ph: 'yoursite.com', def: 'वेबसाइट' },
    whatsapp: { name: 'व्हाट्सएप', ph: '+49 151 …', def: 'व्हाट्सएप' },
    instagram: { name: 'इन्स्टाग्राम', ph: '@yourname', def: 'इन्स्टाग्राम' },
    tiktok: { name: 'टिकटक', ph: '@yourname', def: 'टिकटक' },
    youtube: { name: 'युट्युब', ph: '@yourchannel', def: 'युट्युब' },
    facebook: { name: 'फेसबुक', ph: 'yourpage', def: 'फेसबुक' },
    email: { name: 'इमेल', ph: 'you@example.com', def: 'इमेल' },
    phone: { name: 'फोन', ph: '+49 151 …', def: 'फोन गर्नुहोस्' },
    maps: { name: 'नक्सा', ph: 'सडक, सहर — वा नक्साको लिङ्क', def: 'हामीलाई भेट्नुहोस्' },
    event: { name: 'MartNepali मा अर्को कार्यक्रम', ph: 'martnepali.com/e/…', def: 'अर्को कार्यक्रम' },
    menu: { name: 'मेनु', ph: 'yoursite.com/menu', def: 'मेनु' },
  },
  errors: {
    empty: 'पहिले ठेगाना लेख्नुहोस्।',
    scheme: 'यहाँ वेब (https), इमेल र फोनका लिङ्क मात्र चल्छन्।',
    invalid: 'यो वेब ठेगानाजस्तो देखिँदैन।',
    email: 'यो इमेल ठेगानाजस्तो देखिँदैन।',
    phone: 'फोन नम्बरमा ६ देखि १५ अङ्क चाहिन्छ।',
    hostEvent: 'अर्को कार्यक्रमका लागि martnepali.com को लिङ्क राख्नुहोस्।',
    hostWa: 'आफ्नो नम्बर वा wa.me लिङ्क राख्नुहोस्।',
    hostOther: 'यो लिङ्क सही साइटको होइन।',
  },
  moveUp: 'माथि सार्नुहोस्',
  moveDown: 'तल सार्नुहोस्',
  remove: 'हटाउनुहोस्',
  handle: 'क्रम बदल्न तान्नुहोस्',
  movedTo: (l, p) => `${l} अब ${p} नम्बरमा।`,
  removed: (l) => `${l} हटाइयो।`,
  added: (l) => `${l} थपियो।`,
  refused: 'थपिएन:',
  notShown: 'नमिलेसम्म पेजमा देखिँदैन।',
  lookH: 'रूप',
  themeL: 'थिम',
  themes: { himalaya: 'हिमालय', dhaka: 'ढाका', flags: 'लुङ्दार', night: 'राति बजार', minimal: 'सादा उज्यालो', neon: 'नियोन' },
  accentL: 'मुख्य रङ',
  accentAuto: 'थिमकै रङ',
  accentOwn: 'आफ्नै रङ',
  buttonL: 'बटन',
  buttons: { pill: 'गोलो', square: 'चारकुने', outline: 'रेखा मात्र' },
  fontL: 'अक्षर शैली',
  fonts: { clean: 'सफा', friendly: 'मिलनसार', classic: 'पुरानो शैली', type: 'टाइपराइटर' },
  animL: 'चल्ने पृष्ठभूमि',
  animCalm: 'तपाईंको उपकरणले कम चाल मागेको छ, त्यसैले यहाँ पृष्ठभूमि स्थिर रहन्छ।',
  publishH: 'प्रकाशित गर्नुहोस्',
  publishHint: 'इन्स्टाग्राम बायो, व्हाट्सएप स्टाटस वा पोस्टरका लागि एउटै लिङ्क।',
  publishBtn: 'मेरो पेज प्रकाशित गर्नुहोस्',
  publishAgain: 'परिवर्तनसहित फेरि प्रकाशित गर्नुहोस्',
  publishedL: 'तपाईंको लिङ्क',
  copy: 'कपी',
  copied: 'कपी भयो',
  open: 'खोल्नुहोस्',
  publishSim: 'नक्कली मात्र: केही अपलोड हुँदैन — तपाईंको पूरा पेज लिङ्कभित्रै राखिएको छ। साँच्चैको संस्करणमा छोटो ठेगाना हुन्थ्यो।',
  droppedAvatar: 'तपाईंको फोटो लिङ्कमा अटाउन धेरै ठूलो भयो, त्यसैले प्रकाशित पेजमा अक्षर देखिन्छ।',
  droppedLinks: (n) => `${n} लिङ्क अटाएन र छोडियो।`,
  statsH: 'तथ्याङ्क',
  statsSim: 'नक्कली — के देखिन्थ्यो भनेर देखाउन बनाइएका आगन्तुक। साँचो डाटा होइन।',
  views: 'पेज हेराइ',
  clicks: (n) => `${n} क्लिक`,
  statsEmpty: 'क्लिक हेर्न लिङ्क थप्नुहोस्।',
  page: {
    madeWith: 'MartNepali डेमोबाट बनाइएको',
    makeOwn: 'आफ्नै बनाउनुहोस् →',
    editCopy: 'कपी सम्पादन गर्नुहोस्',
    empty: 'तपाईंका लिङ्क यहाँ देखिनेछन्।',
    previewLabel: 'तपाईंको लिङ्क पेजको लाइभ झलक',
    demoNote: 'डेमो पेज — काल्पनिक, साँच्चैको व्यवसाय होइन।',
  },
  card: {
    h: 'तपाईंको कार्ड',
    label: 'तपाईंको बिजनेस कार्ड — पल्टाउन थिच्नुहोस्',
    flip: 'कार्ड पल्टाउनुहोस्',
    front: 'अगाडि',
    back: 'पछाडि',
    showingFront: 'अगाडिको भाग देखिँदैछ।',
    showingBack: 'QR कोडसहित पछाडिको भाग देखिँदैछ।',
    hint: 'पल्टाउन कार्डमा ट्याप गर्नुहोस्।',
    scan: 'मेरा सबै लिङ्कका लागि स्क्यान गर्नुहोस्',
    showH: 'अगाडि देखाउने',
    show: { phone: 'फोन', email: 'इमेल', web: 'वेबसाइट' },
    downloadsH: 'डाउनलोड',
    png: 'कार्डको तस्बिर (PNG)',
    pngNote: 'अगाडि र पछाडि, छाप्न वा पठाउन तयार।',
    vcf: 'सम्पर्क फाइल (.vcf)',
    vcfNote: 'जुनसुकै फोनको Contacts मा खुल्छ: नाम, नम्बर, इमेल र तपाईंका लिङ्क।',
    pass: 'वालेटजस्तो पास (तस्बिर)',
    passNote: 'वालेट पासजस्तो देखिने तस्बिर मात्र — साँच्चैको Apple वा Google Wallet पास होइन।',
    making: 'बनाउँदै…',
    saved: (f) => `${f} सेभ भयो।`,
    qrFull: 'पछाडिको QR ले तपाईंको लिङ्क पेज खोल्छ।',
    qrShort: 'तपाईंको पेज सानो QR का लागि लामो भयो, त्यसैले यसले पहिलो वेब लिङ्क खोल्छ।',
    passKicker: 'डेमो · साँच्चैको वालेट पास होइन',
    passPhone: 'फोन',
    passEmail: 'इमेल',
    passFoot: 'MartNepali डेमोबाट बनाइएको नक्कली तस्बिर',
    noName: 'तपाईंको नाम',
  },
  dock: { live: 'लाइभ झलक', see: 'हेर्नुहोस्' },
};

export const COPY: Record<Lang, Copy> = { en, de, ne };

/** The words on a link's button: the visitor's own, else the type's usual words. */
export function buttonText(t: Copy, l: { type: LinkType; label: string }): string {
  return l.label.trim() || t.types[l.type].def;
}

// ---------------- starter templates (all made up) ----------------

type L3 = Record<Lang, string>;
type TemplateDef = {
  name: string;
  initials: string;
  theme: ThemeId;
  accent: string;
  button: ButtonStyle;
  font: FontId;
  animated: boolean;
  role: L3;
  bio: L3;
  links: { type: LinkType; value: string; label: L3 }[];
};

const EVENTS = 'https://www.martnepali.com/events';

export const TEMPLATES: Record<TemplateId, TemplateDef> = {
  momo: {
    name: 'Tato Momo Corner',
    initials: 'TM',
    theme: 'night',
    accent: '',
    button: 'pill',
    font: 'friendly',
    animated: true,
    role: {
      en: 'Steamed, jhol & chilli momo · Saturdays at the market',
      de: 'Gedämpfte, Jhol- & Chili-Momos · samstags auf dem Markt',
      ne: 'स्टिम, झोल र चिली मम · हरेक शनिबार बजारमा',
    },
    bio: {
      en: 'Folded by hand every morning. Follow the steam and the queue.',
      de: 'Jeden Morgen von Hand gefaltet. Folge dem Dampf und der Schlange.',
      ne: 'हरेक बिहान हातैले बेरिएका। बाफ र लाइन देखे हामी त्यहीँ छौं।',
    },
    links: [
      { type: 'menu', value: 'example.com/tato-momo/today', label: { en: 'What’s on today', de: 'Was es heute gibt', ne: 'आज के-के छ' } },
      { type: 'maps', value: 'Marktplatz, Darmstadt', label: { en: 'Find the stall', de: 'Zum Stand', ne: 'पसल कहाँ छ' } },
      { type: 'instagram', value: '@tatomomo.demo', label: { en: '', de: '', ne: '' } },
      { type: 'whatsapp', value: '+49 000 0000 123', label: { en: 'Order ahead on WhatsApp', de: 'Vorbestellen per WhatsApp', ne: 'व्हाट्सएपमा पहिल्यै अर्डर' } },
      { type: 'event', value: EVENTS, label: { en: 'Next momo night on MartNepali', de: 'Nächster Momo-Abend auf MartNepali', ne: 'MartNepali मा अर्को मम साँझ' } },
    ],
  },
  tutor: {
    name: 'Nepali with Asha',
    initials: 'अ',
    theme: 'flags',
    accent: '',
    button: 'square',
    font: 'classic',
    animated: false,
    role: {
      en: 'Nepali reading & writing for kids · online and in Frankfurt',
      de: 'Nepali lesen & schreiben für Kinder · online und in Frankfurt',
      ne: 'बालबालिकाका लागि नेपाली पढाइ-लेखाइ · अनलाइन र फ्रैंकफर्टमा',
    },
    bio: {
      en: 'Small groups, songs and stories — कखरा made fun.',
      de: 'Kleine Gruppen, Lieder und Geschichten — कखरा mit Spaß.',
      ne: 'सानो समूह, गीत र कथा — रमाइलो गरी कखरा।',
    },
    links: [
      { type: 'website', value: 'example.com/nepali-with-asha', label: { en: 'Class times & sign-up', de: 'Kurszeiten & Anmeldung', ne: 'कक्षाको समय र दर्ता' } },
      { type: 'whatsapp', value: '+49 000 0000 456', label: { en: 'Ask on WhatsApp', de: 'Frag per WhatsApp', ne: 'व्हाट्सएपमा सोध्नुहोस्' } },
      { type: 'youtube', value: '@nepaliwithasha.demo', label: { en: 'Lessons on YouTube', de: 'Lektionen auf YouTube', ne: 'युट्युबमा पाठ' } },
      { type: 'email', value: 'asha@example.com', label: { en: '', de: '', ne: '' } },
      { type: 'maps', value: 'Bockenheim, Frankfurt am Main', label: { en: 'Where we meet', de: 'Wo wir uns treffen', ne: 'भेट्ने ठाउँ' } },
      { type: 'phone', value: '+49 000 0000 456', label: { en: '', de: '', ne: '' } },
    ],
  },
  dj: {
    name: 'DJ Saathi Beats',
    initials: 'SB',
    theme: 'neon',
    accent: '',
    button: 'outline',
    font: 'type',
    animated: true,
    role: {
      en: 'Nepali pop, lok dohori remixes & Bollywood · Rhein-Main',
      de: 'Nepali-Pop, Lok-Dohori-Remixe & Bollywood · Rhein-Main',
      ne: 'नेपाली पप, लोक दोहोरी रिमिक्स र बलिउड · राइन-माइन',
    },
    bio: {
      en: 'Dashain parties, weddings and student nights. Let’s make the floor bounce.',
      de: 'Dashain-Partys, Hochzeiten und Studi-Abende. Lass die Tanzfläche beben.',
      ne: 'दशैं पार्टी, बिहे र विद्यार्थी साँझ। डान्स फ्लोर हल्लाऔं।',
    },
    links: [
      { type: 'event', value: EVENTS, label: { en: 'Next night on MartNepali', de: 'Nächste Nacht auf MartNepali', ne: 'MartNepali मा अर्को साँझ' } },
      { type: 'instagram', value: '@saathibeats.demo', label: { en: '', de: '', ne: '' } },
      { type: 'tiktok', value: '@saathibeats.demo', label: { en: '', de: '', ne: '' } },
      { type: 'youtube', value: '@saathibeats.demo', label: { en: 'Mixes on YouTube', de: 'Mixe auf YouTube', ne: 'युट्युबमा मिक्स' } },
      { type: 'whatsapp', value: '+49 000 0000 789', label: { en: 'Say hi on WhatsApp', de: 'Sag Hallo per WhatsApp', ne: 'व्हाट्सएपमा नमस्ते' } },
      { type: 'email', value: 'beats@example.com', label: { en: 'Email me', de: 'Schreib mir', ne: 'इमेल गर्नुहोस्' } },
    ],
  },
  artist: {
    name: 'Studio Kalpana',
    initials: 'SK',
    theme: 'dhaka',
    accent: '',
    button: 'square',
    font: 'classic',
    animated: false,
    role: {
      en: 'Mithila-inspired paintings & paper art · Köln',
      de: 'Mithila-inspirierte Bilder & Papierkunst · Köln',
      ne: 'मिथिला शैलीबाट प्रेरित चित्र र कागज कला · कोलोन',
    },
    bio: {
      en: 'Colours from home on German walls. Open studio on the first Sunday of the month.',
      de: 'Farben von zu Hause an deutschen Wänden. Offenes Atelier am ersten Sonntag im Monat.',
      ne: 'घरका रङ, जर्मन भित्तामा। हरेक महिनाको पहिलो आइतबार खुला स्टुडियो।',
    },
    links: [
      { type: 'website', value: 'example.com/studio-kalpana', label: { en: 'Gallery', de: 'Galerie', ne: 'ग्यालरी' } },
      { type: 'instagram', value: '@studiokalpana.demo', label: { en: '', de: '', ne: '' } },
      { type: 'event', value: EVENTS, label: { en: 'Next exhibition on MartNepali', de: 'Nächste Ausstellung auf MartNepali', ne: 'MartNepali मा अर्को प्रदर्शनी' } },
      { type: 'maps', value: 'Ehrenfeld, Köln', label: { en: 'Open studio', de: 'Offenes Atelier', ne: 'खुला स्टुडियो' } },
      { type: 'facebook', value: 'studiokalpana.demo', label: { en: '', de: '', ne: '' } },
      { type: 'email', value: 'kalpana@example.com', label: { en: 'Write to me', de: 'Schreib mir', ne: 'मलाई लेख्नुहोस्' } },
    ],
  },
};

/** A template, filled in, in the visitor's language. */
export function templateState(id: TemplateId, lang: Lang): CardState {
  const tp = TEMPLATES[id];
  return normalizeState({
    ...EMPTY_STATE,
    name: tp.name,
    role: tp.role[lang],
    bio: tp.bio[lang],
    initials: tp.initials,
    theme: tp.theme,
    accent: tp.accent,
    button: tp.button,
    font: tp.font,
    animated: tp.animated,
    links: tp.links.map((l, i) => ({ id: `l${i + 1}`, type: l.type, value: l.value, label: l.label[lang] })),
  });
}

/** The page frame around the tool (server-rendered, in the cookie's language). */
export const FRAME: Record<
  Lang,
  { badge: string; text: string; all: string; kicker: string; endH: string; endP: string; points: [string, string, string]; talk: string; more: string; free: string }
> = {
  en: {
    badge: 'Demo project',
    text: 'Built by MartNepali · the names and links in the templates are made up',
    all: '← All demos',
    kicker: 'MartNepali Studio · Demo project',
    endH: 'Want your own link page or card?',
    endP: 'A page that is really yours — your colours, your languages, your next event on MartNepali — and a card people keep. For a stall, a class, an artist or a band.',
    points: ['One link for everything', 'QR card and contact file', 'English, Deutsch, नेपाली'],
    talk: 'Kura garau',
    more: 'See all our work',
    free: 'Free while we grow.',
  },
  de: {
    badge: 'Demo-Projekt',
    text: 'Gebaut von MartNepali · Namen und Links in den Vorlagen sind erfunden',
    all: '← Alle Demos',
    kicker: 'MartNepali Studio · Demo-Projekt',
    endH: 'Deine eigene Linkseite oder Karte?',
    endP: 'Eine Seite, die wirklich deine ist — deine Farben, deine Sprachen, dein nächstes Event auf MartNepali — und eine Karte, die man behält. Für einen Stand, einen Kurs, eine Künstlerin oder eine Band.',
    points: ['Ein Link für alles', 'QR-Karte und Kontaktdatei', 'English, Deutsch, नेपाली'],
    talk: 'Kura garau',
    more: 'Alle unsere Arbeiten',
    free: 'Kostenlos, solange wir wachsen.',
  },
  ne: {
    badge: 'डेमो परियोजना',
    text: 'MartNepali ले बनाएको · टेम्प्लेटका नाम र लिङ्क काल्पनिक हुन्',
    all: '← सबै डेमो',
    kicker: 'MartNepali स्टुडियो · डेमो परियोजना',
    endH: 'आफ्नै लिङ्क पेज वा कार्ड चाहिन्छ?',
    endP: 'साँच्चै तपाईंकै पेज — तपाईंका रङ, तपाईंका भाषा, MartNepali मा तपाईंको अर्को कार्यक्रम — र मानिसले राखिराख्ने कार्ड। पसल, कक्षा, कलाकार वा ब्यान्डका लागि।',
    points: ['सबैका लागि एउटै लिङ्क', 'QR कार्ड र सम्पर्क फाइल', 'English, Deutsch, नेपाली'],
    talk: 'Kura garau',
    more: 'हाम्रा सबै काम',
    free: 'हामी बढ्दै गर्दा निःशुल्क।',
  },
};
