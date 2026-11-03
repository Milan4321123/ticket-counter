// Words for /work/booth (event photo booth) in English, Deutsch and नेपाली,
// and the made-up example events each frame starts with. Every event, place
// and couple here is invented. No prices, packages or "hire" wording in any
// language — tests/photoBooth.test.ts reads every string here.

import type { BoothText, FilterId, FrameId, Lang, LayoutId, StickerKind } from './booth';

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

/** The festive line each frame carries (part of the art, always in Nepali). */
export const GREETING: Record<FrameId, string> = {
  dashain: 'शुभ दशैं',
  tihar: 'शुभ दीपावली',
  teej: 'तीजको शुभकामना',
  newyear: 'नयाँ वर्षको शुभकामना',
  concert: 'लाइभ कन्सर्ट',
  wedding: 'शुभ विवाह',
};

/** The made-up event each frame starts with. */
export const DEFAULT_TEXT: Record<FrameId, Record<Lang, BoothText>> = {
  dashain: {
    en: { title: 'Dashain Milan · Frankfurt', date: 'Sat 10 Oct 2026', tag: '#DashainMilan' },
    de: { title: 'Dashain Milan · Frankfurt', date: 'Sa., 10. Okt. 2026', tag: '#DashainMilan' },
    ne: { title: 'दशैं मिलन · फ्र्याङ्कफर्ट', date: 'असोज २४, २०८३', tag: '#DashainMilan' },
  },
  tihar: {
    en: { title: 'Deusi Bhailo Night · Köln', date: 'Sun 8 Nov 2026', tag: '#TiharTogether' },
    de: { title: 'Deusi-Bhailo-Abend · Köln', date: 'So., 8. Nov. 2026', tag: '#TiharTogether' },
    ne: { title: 'देउसी भैलो साँझ · कोलोन', date: 'कात्तिक २२, २०८३', tag: '#TiharTogether' },
  },
  teej: {
    en: { title: 'Teej Utsav · Berlin', date: 'Sun 13 Sep 2026', tag: '#TeejUtsav' },
    de: { title: 'Teej-Fest · Berlin', date: 'So., 13. Sep. 2026', tag: '#TeejUtsav' },
    ne: { title: 'तीज उत्सव · बर्लिन', date: 'भदौ २८, २०८३', tag: '#TeejUtsav' },
  },
  newyear: {
    en: { title: 'Naya Barsa 2084 · München', date: 'Wed 14 Apr 2027', tag: '#NayaBarsa2084' },
    de: { title: 'Naya Barsa 2084 · München', date: 'Mi., 14. Apr. 2027', tag: '#NayaBarsa2084' },
    ne: { title: 'नयाँ वर्ष २०८४ · म्युनिख', date: 'वैशाख १, २०८४', tag: '#NayaBarsa2084' },
  },
  concert: {
    en: { title: 'Tihar Night Live', date: 'Sat 14 Nov 2026 · Hamburg', tag: '#TiharNightLive' },
    de: { title: 'Tihar Night Live', date: 'Sa., 14. Nov. 2026 · Hamburg', tag: '#TiharNightLive' },
    ne: { title: 'तिहार नाइट लाइभ', date: 'कात्तिक २८, २०८३ · ह्याम्बर्ग', tag: '#TiharNightLive' },
  },
  wedding: {
    en: { title: 'Asha & Bikash', date: '6 February 2027', tag: '#AshaWedsBikash' },
    de: { title: 'Asha & Bikash', date: '6. Februar 2027', tag: '#AshaWedsBikash' },
    ne: { title: 'आशा र विकास', date: 'माघ २३, २०८३', tag: '#AshaWedsBikash' },
  },
};

export type Copy = {
  title: string;
  tagline: string;
  langLabel: string;
  reset: string;
  resetDone: string;
  privacy: string;
  roleLabel: string;
  roles: { guest: string; organizer: string };
  soundOn: string;
  soundOff: string;
  stageLabel: string;
  canvasLabel: (frame: string, layout: string) => string;
  canvasHelp: string;
  formatsLabel: string;
  formats: Record<LayoutId, string>;
  formatSub: Record<LayoutId, string>;
  stepPhoto: string;
  sourceCamera: string;
  sourceFile: string;
  sourceSample: string;
  modeLabel: string;
  modes: { single: string; strip: string };
  stripHint: string;
  fileHintStrip: string;
  cellEmpty: (i: string) => string;
  sampleDone: string;
  photoDone: (n: string) => string;
  fileError: string;
  cameraStarting: string;
  cameraBlocked: string;
  cameraNone: string;
  cameraFail: string;
  cameraVideo: string;
  shutter: string;
  shutterStrip: string;
  cancel: string;
  flip: string;
  shotOf: (i: string, n: string) => string;
  captured: string;
  stepFrame: string;
  frames: Record<FrameId, string>;
  stepText: string;
  titleL: string;
  dateL: string;
  tagL: string;
  textHint: string;
  stepStickers: string;
  stickers: Record<StickerKind, string>;
  addSticker: (name: string) => string;
  onPhoto: string;
  noStickers: string;
  stickerKeys: string;
  bigger: string;
  smaller: string;
  turnLeft: string;
  turnRight: string;
  forward: string;
  backward: string;
  remove: string;
  deselect: string;
  selected: (name: string) => string;
  stickerAdded: (name: string) => string;
  stickerRemoved: (name: string) => string;
  stickersFull: string;
  stepLook: string;
  filters: Record<FilterId, string>;
  brightnessL: string;
  zoomL: string;
  zoomHint: string;
  saveH: string;
  savePng: string;
  saveJpg: string;
  share: string;
  saving: string;
  saved: (name: string) => string;
  shareFail: string;
  quota: string;
  orgH: string;
  orgIntro: string;
  eventH: string;
  defaultFrameL: string;
  logoL: string;
  logoUpload: string;
  logoChange: string;
  logoRemove: string;
  logoNote: string;
  logoError: string;
  linkL: string;
  linkHint: string;
  copy: string;
  copied: string;
  posterH: string;
  posterHint: string;
  posterAlt: string;
  posterDownload: string;
  posterScan: string;
  posterSteps: [string, string, string];
  posterFoot: string;
  wallH: string;
  wallHint: string;
  wallEmpty: string;
  wallClear: string;
  wallCount: (n: string) => string;
  wallAlt: (i: string) => string;
  presetBanner: (title: string) => string;
  presetDismiss: string;
  backToGuest: string;
};

export const COPY: Record<Lang, Copy> = {
  en: {
    title: 'Event photo booth',
    tagline: 'Scan at the door, take a selfie, get it in a festive frame — ready to share.',
    langLabel: 'Language',
    reset: 'Reset demo',
    resetDone: 'Demo reset. Everything is back to the start.',
    privacy: 'Your photos never leave your phone in this demo — nothing is uploaded. The camera only starts when you tap it.',
    roleLabel: 'Who are you?',
    roles: { guest: 'I’m a guest', organizer: 'I’m organizing' },
    soundOn: 'Sound on',
    soundOff: 'Sound off',
    stageLabel: 'Your framed photo',
    canvasLabel: (frame, layout) => `Framed photo: ${frame}, ${layout}. Tap a sticker to pick it, drag to move it, pinch or use the corner handle to turn and resize it.`,
    canvasHelp: 'Drag stickers around · pinch or use the round handle to turn and resize · drag the photo to move it.',
    formatsLabel: 'Size',
    formats: { square: 'Square', story: 'Story', print: 'Print 4×6', strip: 'Photo strip' },
    formatSub: { square: '1080 × 1080', story: '1080 × 1920', print: '1200 × 1800', strip: '720 × 2160' },
    stepPhoto: '1 · Your photo',
    sourceCamera: 'Use camera',
    sourceFile: 'Choose a photo',
    sourceSample: 'Use a sample',
    modeLabel: 'Shots',
    modes: { single: 'One photo', strip: 'Photo strip (3)' },
    stripHint: 'A strip takes three shots in a row, like a real booth.',
    fileHintStrip: 'Pick up to three photos for the strip.',
    cellEmpty: (i) => `Shot ${i}`,
    sampleDone: 'Sample photo in. Now pick a frame and add stickers.',
    photoDone: (n) => (n === '1' ? 'Photo in.' : `${n} photos in.`),
    fileError: 'That file could not be opened as a picture. Try a JPG or PNG.',
    cameraStarting: 'Starting the camera…',
    cameraBlocked: 'The camera is blocked for this page. No problem — choose a photo or use the sample instead. (You can allow the camera in your browser’s site settings.)',
    cameraNone: 'No camera found on this device. Choose a photo or use the sample instead.',
    cameraFail: 'The camera didn’t start. Choose a photo or use the sample instead.',
    cameraVideo: 'Camera preview (mirrored, like a mirror)',
    shutter: 'Take the photo',
    shutterStrip: 'Take 3 shots',
    cancel: 'Close camera',
    flip: 'Switch camera',
    shotOf: (i, n) => `Shot ${i} of ${n}`,
    captured: 'Got it! The camera is off again.',
    stepFrame: '2 · Frame',
    frames: { dashain: 'Dashain', tihar: 'Tihar', teej: 'Teej', newyear: 'Nepali New Year', concert: 'Concert night', wedding: 'Wedding' },
    stepText: '3 · Words on the frame',
    titleL: 'Event name',
    dateL: 'Date',
    tagL: 'Hashtag',
    textHint: 'English and नेपाली both work — the text shrinks to fit.',
    stepStickers: '4 · Stickers',
    stickers: { topi: 'Dhaka topi', shades: 'Sunglasses', momo: 'Momo', flags: 'Prayer flags', woho: '“Wo-ho!”', heart: 'Heart', tika: 'Tika' },
    addSticker: (n) => `Add ${n}`,
    onPhoto: 'On the photo',
    noStickers: 'No stickers yet — tap one above.',
    stickerKeys: 'Keyboard: pick a sticker, then arrows move it (Shift = further), + / − resize, [ ] turn, Delete removes it.',
    bigger: 'Bigger',
    smaller: 'Smaller',
    turnLeft: 'Turn left',
    turnRight: 'Turn right',
    forward: 'Bring forward',
    backward: 'Send back',
    remove: 'Delete',
    deselect: 'Done',
    selected: (n) => `${n} picked.`,
    stickerAdded: (n) => `${n} added to the photo.`,
    stickerRemoved: (n) => `${n} removed.`,
    stickersFull: 'That’s plenty of stickers for one photo.',
    stepLook: '5 · Look',
    filters: { none: 'Natural', warm: 'Warm', mono: 'Mono', glow: 'Festival glow' },
    brightnessL: 'Brightness',
    zoomL: 'Zoom photo',
    zoomHint: 'Drag the photo on the frame to move it.',
    saveH: 'Save and share',
    savePng: 'Download PNG',
    saveJpg: 'Download JPG',
    share: 'Share…',
    saving: 'Making your picture…',
    saved: (n) => `Saved as ${n}.`,
    shareFail: 'Sharing didn’t work here — download it instead.',
    quota: 'This browser’s storage is full, so the oldest wall pictures were dropped.',
    orgH: 'Set up the booth for your event',
    orgIntro: 'Pick the frame and words your guests start with, add your logo, then print the QR poster for the door.',
    eventH: 'Your event',
    defaultFrameL: 'Frame guests start with',
    logoL: 'Your logo',
    logoUpload: 'Add a logo',
    logoChange: 'Change logo',
    logoRemove: 'Remove',
    logoNote: 'Made small right here and kept in this browser only. It goes on the frame and the poster — not into the QR link.',
    logoError: 'That file could not be used as a logo. Try a PNG or JPG.',
    linkL: 'Booth link for guests',
    linkHint: 'Opens this booth with your frame and words.',
    copy: 'Copy link',
    copied: 'Link copied.',
    posterH: 'QR poster for the door',
    posterHint: 'A4, ready to print. Put it at the entrance or on the tables.',
    posterAlt: 'Preview of the A4 poster with a QR code that opens the photo booth',
    posterDownload: 'Download poster (PNG)',
    posterScan: 'Scan for the photo booth',
    posterSteps: ['Scan the code', 'Smile!', 'Share your photo'],
    posterFoot: 'Photos stay on your phone · made with the MartNepali demo',
    wallH: 'Live wall (preview)',
    wallHint: 'The photos saved in this browser, as they could appear on a screen at the venue. Only yours — nothing is uploaded.',
    wallEmpty: 'Nothing on the wall yet. Download or share a photo and it appears here.',
    wallClear: 'Clear the wall',
    wallCount: (n) => (n === '1' ? '1 photo' : `${n} photos`),
    wallAlt: (i) => `Booth photo ${i}`,
    presetBanner: (t) => `Booth set up by the organizer${t ? `: ${t}` : ''}.`,
    presetDismiss: 'Hide',
    backToGuest: 'Try it as a guest',
  },
  de: {
    title: 'Fotobox fürs Event',
    tagline: 'QR-Code am Eingang scannen, Selfie machen, im festlichen Rahmen teilen.',
    langLabel: 'Sprache',
    reset: 'Demo zurücksetzen',
    resetDone: 'Demo zurückgesetzt. Alles ist wieder wie am Anfang.',
    privacy: 'Deine Fotos verlassen in dieser Demo nie dein Handy — nichts wird hochgeladen. Die Kamera startet erst, wenn du tippst.',
    roleLabel: 'Wer bist du?',
    roles: { guest: 'Ich bin Gast', organizer: 'Ich veranstalte' },
    soundOn: 'Ton an',
    soundOff: 'Ton aus',
    stageLabel: 'Dein Foto im Rahmen',
    canvasLabel: (frame, layout) => `Foto im Rahmen: ${frame}, ${layout}. Tippe einen Sticker an, um ihn zu wählen, zieh ihn zum Verschieben, drehe und skaliere ihn mit zwei Fingern oder dem Eck-Griff.`,
    canvasHelp: 'Sticker verschieben · mit zwei Fingern oder dem runden Griff drehen und skalieren · Foto ziehen, um es zu verschieben.',
    formatsLabel: 'Format',
    formats: { square: 'Quadrat', story: 'Story', print: 'Druck 10×15', strip: 'Fotostreifen' },
    formatSub: { square: '1080 × 1080', story: '1080 × 1920', print: '1200 × 1800', strip: '720 × 2160' },
    stepPhoto: '1 · Dein Foto',
    sourceCamera: 'Kamera nutzen',
    sourceFile: 'Foto auswählen',
    sourceSample: 'Beispielbild',
    modeLabel: 'Aufnahmen',
    modes: { single: 'Ein Foto', strip: 'Fotostreifen (3)' },
    stripHint: 'Ein Streifen macht drei Fotos hintereinander, wie in einer echten Fotobox.',
    fileHintStrip: 'Wähle bis zu drei Fotos für den Streifen.',
    cellEmpty: (i) => `Foto ${i}`,
    sampleDone: 'Beispielbild ist drin. Jetzt Rahmen wählen und Sticker setzen.',
    photoDone: (n) => (n === '1' ? 'Foto ist drin.' : `${n} Fotos sind drin.`),
    fileError: 'Diese Datei ließ sich nicht als Bild öffnen. Versuch es mit JPG oder PNG.',
    cameraStarting: 'Kamera startet…',
    cameraBlocked: 'Die Kamera ist für diese Seite gesperrt. Kein Problem — wähle ein Foto oder nimm das Beispielbild. (Du kannst die Kamera in den Website-Einstellungen deines Browsers erlauben.)',
    cameraNone: 'Auf diesem Gerät wurde keine Kamera gefunden. Wähle ein Foto oder nimm das Beispielbild.',
    cameraFail: 'Die Kamera ist nicht gestartet. Wähle ein Foto oder nimm das Beispielbild.',
    cameraVideo: 'Kamera-Vorschau (gespiegelt wie ein Spiegel)',
    shutter: 'Foto aufnehmen',
    shutterStrip: '3 Fotos aufnehmen',
    cancel: 'Kamera schließen',
    flip: 'Kamera wechseln',
    shotOf: (i, n) => `Foto ${i} von ${n}`,
    captured: 'Geschafft! Die Kamera ist wieder aus.',
    stepFrame: '2 · Rahmen',
    frames: { dashain: 'Dashain', tihar: 'Tihar', teej: 'Teej', newyear: 'Nepalesisches Neujahr', concert: 'Konzertabend', wedding: 'Hochzeit' },
    stepText: '3 · Text auf dem Rahmen',
    titleL: 'Name des Events',
    dateL: 'Datum',
    tagL: 'Hashtag',
    textHint: 'Deutsch, Englisch und नेपाली gehen — der Text wird passend verkleinert.',
    stepStickers: '4 · Sticker',
    stickers: { topi: 'Dhaka-Topi', shades: 'Sonnenbrille', momo: 'Momo', flags: 'Gebetsfahnen', woho: '„Wo-ho!“', heart: 'Herz', tika: 'Tika' },
    addSticker: (n) => `${n} hinzufügen`,
    onPhoto: 'Auf dem Foto',
    noStickers: 'Noch keine Sticker — tippe oben einen an.',
    stickerKeys: 'Tastatur: Sticker wählen, dann Pfeiltasten zum Verschieben (Umschalt = weiter), + / − Größe, [ ] drehen, Entf löscht.',
    bigger: 'Größer',
    smaller: 'Kleiner',
    turnLeft: 'Nach links drehen',
    turnRight: 'Nach rechts drehen',
    forward: 'Nach vorne',
    backward: 'Nach hinten',
    remove: 'Löschen',
    deselect: 'Fertig',
    selected: (n) => `${n} gewählt.`,
    stickerAdded: (n) => `${n} aufs Foto gesetzt.`,
    stickerRemoved: (n) => `${n} entfernt.`,
    stickersFull: 'Das sind genug Sticker für ein Foto.',
    stepLook: '5 · Look',
    filters: { none: 'Natürlich', warm: 'Warm', mono: 'Schwarzweiß', glow: 'Festglanz' },
    brightnessL: 'Helligkeit',
    zoomL: 'Foto zoomen',
    zoomHint: 'Zieh das Foto im Rahmen, um es zu verschieben.',
    saveH: 'Speichern und teilen',
    savePng: 'PNG herunterladen',
    saveJpg: 'JPG herunterladen',
    share: 'Teilen…',
    saving: 'Dein Bild wird erstellt…',
    saved: (n) => `Gespeichert als ${n}.`,
    shareFail: 'Teilen hat hier nicht geklappt — lade das Bild stattdessen herunter.',
    quota: 'Der Speicher dieses Browsers ist voll, deshalb wurden die ältesten Wandbilder entfernt.',
    orgH: 'Richte die Fotobox für dein Event ein',
    orgIntro: 'Wähle Rahmen und Text, mit denen deine Gäste starten, füge dein Logo hinzu und drucke das QR-Plakat für den Eingang.',
    eventH: 'Dein Event',
    defaultFrameL: 'Startrahmen für Gäste',
    logoL: 'Dein Logo',
    logoUpload: 'Logo hinzufügen',
    logoChange: 'Logo ändern',
    logoRemove: 'Entfernen',
    logoNote: 'Wird hier verkleinert und nur in diesem Browser gespeichert. Es kommt auf Rahmen und Plakat — nicht in den QR-Link.',
    logoError: 'Diese Datei ging nicht als Logo. Versuch es mit PNG oder JPG.',
    linkL: 'Fotobox-Link für Gäste',
    linkHint: 'Öffnet diese Fotobox mit deinem Rahmen und Text.',
    copy: 'Link kopieren',
    copied: 'Link kopiert.',
    posterH: 'QR-Plakat für den Eingang',
    posterHint: 'A4, druckfertig. Häng es an den Eingang oder leg es auf die Tische.',
    posterAlt: 'Vorschau des A4-Plakats mit einem QR-Code, der die Fotobox öffnet',
    posterDownload: 'Plakat herunterladen (PNG)',
    posterScan: 'Scannen für die Fotobox',
    posterSteps: ['Code scannen', 'Lächeln!', 'Foto teilen'],
    posterFoot: 'Fotos bleiben auf deinem Handy · gemacht mit der MartNepali-Demo',
    wallH: 'Live-Wand (Vorschau)',
    wallHint: 'Die in diesem Browser gespeicherten Fotos, so wie sie auf einem Bildschirm vor Ort erscheinen könnten. Nur deine — nichts wird hochgeladen.',
    wallEmpty: 'Noch nichts an der Wand. Lade ein Foto herunter oder teile es, dann erscheint es hier.',
    wallClear: 'Wand leeren',
    wallCount: (n) => (n === '1' ? '1 Foto' : `${n} Fotos`),
    wallAlt: (i) => `Fotobox-Bild ${i}`,
    presetBanner: (t) => `Fotobox eingerichtet von den Veranstaltenden${t ? `: ${t}` : ''}.`,
    presetDismiss: 'Ausblenden',
    backToGuest: 'Als Gast ausprobieren',
  },
  ne: {
    title: 'कार्यक्रमको फोटो बुथ',
    tagline: 'ढोकामा QR स्क्यान गर्नुहोस्, सेल्फी खिच्नुहोस्, चाडपर्वको फ्रेममा राखेर सेयर गर्नुहोस्।',
    langLabel: 'भाषा',
    reset: 'डेमो रिसेट',
    resetDone: 'डेमो रिसेट भयो। सबै सुरुमै फर्कियो।',
    privacy: 'यो डेमोमा तपाईंका फोटो फोनबाट कतै जाँदैनन् — केही पनि अपलोड हुँदैन। तपाईंले थिचेपछि मात्र क्यामेरा खुल्छ।',
    roleLabel: 'तपाईं को हो?',
    roles: { guest: 'म पाहुना हुँ', organizer: 'म आयोजक हुँ' },
    soundOn: 'आवाज खुला',
    soundOff: 'आवाज बन्द',
    stageLabel: 'फ्रेममा तपाईंको फोटो',
    canvasLabel: (frame, layout) => `फ्रेममा फोटो: ${frame}, ${layout}। स्टिकर छान्न थिच्नुहोस्, सार्न तान्नुहोस्, घुमाउन र सानो-ठूलो पार्न दुई औंला वा कुनाको ह्यान्डल चलाउनुहोस्।`,
    canvasHelp: 'स्टिकर तानेर सार्नुहोस् · दुई औंला वा गोलो ह्यान्डलले घुमाउनुहोस् र सानो-ठूलो पार्नुहोस् · फोटो तानेर मिलाउनुहोस्।',
    formatsLabel: 'साइज',
    formats: { square: 'वर्गाकार', story: 'स्टोरी', print: 'प्रिन्ट ४×६', strip: 'फोटो स्ट्रिप' },
    formatSub: { square: '१०८० × १०८०', story: '१०८० × १९२०', print: '१२०० × १८००', strip: '७२० × २१६०' },
    stepPhoto: '१ · तपाईंको फोटो',
    sourceCamera: 'क्यामेरा चलाउनुहोस्',
    sourceFile: 'फोटो छान्नुहोस्',
    sourceSample: 'नमुना फोटो',
    modeLabel: 'कति फोटो',
    modes: { single: 'एउटा फोटो', strip: 'फोटो स्ट्रिप (३)' },
    stripHint: 'स्ट्रिपले साँच्चैको बुथजस्तै लगातार तीन फोटो खिच्छ।',
    fileHintStrip: 'स्ट्रिपका लागि तीनवटासम्म फोटो छान्नुहोस्।',
    cellEmpty: (i) => `फोटो ${i}`,
    sampleDone: 'नमुना फोटो राखियो। अब फ्रेम छान्नुहोस् र स्टिकर थप्नुहोस्।',
    photoDone: (n) => `${n} फोटो राखियो।`,
    fileError: 'यो फाइल फोटोको रूपमा खुलेन। JPG वा PNG प्रयोग गर्नुहोस्।',
    cameraStarting: 'क्यामेरा खुल्दैछ…',
    cameraBlocked: 'यो पेजका लागि क्यामेरा रोकिएको छ। केही छैन — फोटो छान्नुहोस् वा नमुना प्रयोग गर्नुहोस्। (ब्राउजरको साइट सेटिङमा क्यामेरा खोल्न सकिन्छ।)',
    cameraNone: 'यो उपकरणमा क्यामेरा भेटिएन। फोटो छान्नुहोस् वा नमुना प्रयोग गर्नुहोस्।',
    cameraFail: 'क्यामेरा खुलेन। फोटो छान्नुहोस् वा नमुना प्रयोग गर्नुहोस्।',
    cameraVideo: 'क्यामेराको झलक (ऐनाजस्तै उल्टो)',
    shutter: 'फोटो खिच्नुहोस्',
    shutterStrip: '३ फोटो खिच्नुहोस्',
    cancel: 'क्यामेरा बन्द',
    flip: 'क्यामेरा बदल्नुहोस्',
    shotOf: (i, n) => `${n} मध्ये फोटो ${i}`,
    captured: 'खिचियो! क्यामेरा फेरि बन्द भयो।',
    stepFrame: '२ · फ्रेम',
    frames: { dashain: 'दशैं', tihar: 'तिहार', teej: 'तीज', newyear: 'नेपाली नयाँ वर्ष', concert: 'कन्सर्ट साँझ', wedding: 'विवाह' },
    stepText: '३ · फ्रेमका शब्द',
    titleL: 'कार्यक्रमको नाम',
    dateL: 'मिति',
    tagL: 'ह्यासट्याग',
    textHint: 'नेपाली र English दुवै चल्छ — अक्षर आफैं मिलेर सानो हुन्छ।',
    stepStickers: '४ · स्टिकर',
    stickers: { topi: 'ढाका टोपी', shades: 'चस्मा', momo: 'मःम', flags: 'लुङदार', woho: '“वो-हो!”', heart: 'मुटु', tika: 'टीका' },
    addSticker: (n) => `${n} थप्नुहोस्`,
    onPhoto: 'फोटोमा भएका',
    noStickers: 'अहिलेसम्म स्टिकर छैन — माथि एउटा थिच्नुहोस्।',
    stickerKeys: 'किबोर्ड: स्टिकर छानेपछि एरोले सार्छ (Shift = धेरै), + / − ले सानो-ठूलो, [ ] ले घुमाउँछ, Delete ले हटाउँछ।',
    bigger: 'ठूलो',
    smaller: 'सानो',
    turnLeft: 'बायाँ घुमाउनुहोस्',
    turnRight: 'दायाँ घुमाउनुहोस्',
    forward: 'अगाडि ल्याउनुहोस्',
    backward: 'पछाडि पठाउनुहोस्',
    remove: 'हटाउनुहोस्',
    deselect: 'भयो',
    selected: (n) => `${n} छानियो।`,
    stickerAdded: (n) => `${n} फोटोमा थपियो।`,
    stickerRemoved: (n) => `${n} हटाइयो।`,
    stickersFull: 'एउटा फोटोका लागि यति स्टिकर धेरै भयो।',
    stepLook: '५ · रूप',
    filters: { none: 'प्राकृतिक', warm: 'न्यानो', mono: 'कालो-सेतो', glow: 'चाडको चमक' },
    brightnessL: 'उज्यालो',
    zoomL: 'फोटो जुम',
    zoomHint: 'फोटो मिलाउन फ्रेमभित्र तान्नुहोस्।',
    saveH: 'सेभ र सेयर',
    savePng: 'PNG डाउनलोड',
    saveJpg: 'JPG डाउनलोड',
    share: 'सेयर…',
    saving: 'तपाईंको फोटो बन्दैछ…',
    saved: (n) => `${n} नाममा सेभ भयो।`,
    shareFail: 'यहाँ सेयर भएन — बरु डाउनलोड गर्नुहोस्।',
    quota: 'ब्राउजरको भण्डारण भरियो, त्यसैले भित्तामा सबैभन्दा पुराना फोटो हटाइए।',
    orgH: 'आफ्नो कार्यक्रमका लागि बुथ मिलाउनुहोस्',
    orgIntro: 'पाहुनाले सुरुमा देख्ने फ्रेम र शब्द छान्नुहोस्, आफ्नो लोगो थप्नुहोस्, अनि ढोकाका लागि QR पोस्टर प्रिन्ट गर्नुहोस्।',
    eventH: 'तपाईंको कार्यक्रम',
    defaultFrameL: 'पाहुनाको सुरुको फ्रेम',
    logoL: 'तपाईंको लोगो',
    logoUpload: 'लोगो थप्नुहोस्',
    logoChange: 'लोगो बदल्नुहोस्',
    logoRemove: 'हटाउनुहोस्',
    logoNote: 'यहीँ सानो बनाइन्छ र यही ब्राउजरमा मात्र रहन्छ। फ्रेम र पोस्टरमा देखिन्छ — QR लिङ्कमा जाँदैन।',
    logoError: 'यो फाइल लोगोको रूपमा चलेन। PNG वा JPG प्रयोग गर्नुहोस्।',
    linkL: 'पाहुनाका लागि बुथ लिङ्क',
    linkHint: 'तपाईंको फ्रेम र शब्दसहित यो बुथ खोल्छ।',
    copy: 'लिङ्क कपी',
    copied: 'लिङ्क कपी भयो।',
    posterH: 'ढोकाका लागि QR पोस्टर',
    posterHint: 'A4, प्रिन्ट गर्न तयार। प्रवेशद्वारमा टाँस्नुहोस् वा टेबलमा राख्नुहोस्।',
    posterAlt: 'फोटो बुथ खोल्ने QR कोडसहितको A4 पोस्टरको झलक',
    posterDownload: 'पोस्टर डाउनलोड (PNG)',
    posterScan: 'फोटो बुथका लागि स्क्यान गर्नुहोस्',
    posterSteps: ['कोड स्क्यान गर्नुहोस्', 'मुस्कुराउनुहोस्!', 'फोटो सेयर गर्नुहोस्'],
    posterFoot: 'फोटो तपाईंकै फोनमा रहन्छ · MartNepali डेमोबाट बनेको',
    wallH: 'लाइभ भित्ता (झलक)',
    wallHint: 'यो ब्राउजरमा सेभ भएका फोटो, कार्यक्रमस्थलको स्क्रिनमा देखिनेजस्तै। तपाईंका मात्र — केही अपलोड हुँदैन।',
    wallEmpty: 'भित्तामा अहिले केही छैन। फोटो डाउनलोड वा सेयर गरेपछि यहाँ देखिन्छ।',
    wallClear: 'भित्ता खाली गर्नुहोस्',
    wallCount: (n) => `${n} फोटो`,
    wallAlt: (i) => `बुथ फोटो ${i}`,
    presetBanner: (t) => `आयोजकले मिलाएको बुथ${t ? `: ${t}` : ''}।`,
    presetDismiss: 'लुकाउनुहोस्',
    backToGuest: 'पाहुनाको रूपमा चलाउनुहोस्',
  },
};

/** The page frame around the tool (server-rendered, in the cookie's language). */
export const FRAME: Record<
  Lang,
  { badge: string; text: string; all: string; kicker: string; endH: string; endP: string; points: [string, string, string]; talk: string; more: string; free: string }
> = {
  en: {
    badge: 'Demo project',
    text: 'Built by MartNepali · the events and names in the frames are made up',
    all: '← All demos',
    kicker: 'MartNepali Studio · Demo project',
    endH: 'Want a photo booth for your event?',
    endP: 'Your frame, your logo, your hashtag — a QR code at the door and every guest leaves with a picture worth posting. For a Dashain milan, a Tihar night, a concert or a wedding.',
    points: ['Selfie or photo, in a festive frame', 'QR poster for the door', 'English, Deutsch, नेपाली'],
    talk: 'Kura garau',
    more: 'See all our work',
    free: 'Free while we grow.',
  },
  de: {
    badge: 'Demo-Projekt',
    text: 'Gebaut von MartNepali · Events und Namen in den Rahmen sind erfunden',
    all: '← Alle Demos',
    kicker: 'MartNepali Studio · Demo-Projekt',
    endH: 'Eine Fotobox für dein Event?',
    endP: 'Dein Rahmen, dein Logo, dein Hashtag — ein QR-Code am Eingang, und alle Gäste gehen mit einem Bild nach Hause, das sie gern posten. Für ein Dashain-Milan, einen Tihar-Abend, ein Konzert oder eine Hochzeit.',
    points: ['Selfie oder Foto im festlichen Rahmen', 'QR-Plakat für den Eingang', 'English, Deutsch, नेपाली'],
    talk: 'Kura garau',
    more: 'Alle unsere Arbeiten',
    free: 'Kostenlos, solange wir wachsen.',
  },
  ne: {
    badge: 'डेमो परियोजना',
    text: 'MartNepali ले बनाएको · फ्रेमका कार्यक्रम र नाम काल्पनिक हुन्',
    all: '← सबै डेमो',
    kicker: 'MartNepali स्टुडियो · डेमो परियोजना',
    endH: 'आफ्नो कार्यक्रमका लागि फोटो बुथ चाहिन्छ?',
    endP: 'तपाईंकै फ्रेम, लोगो र ह्यासट्याग — ढोकामा एउटा QR कोड, र हरेक पाहुना पोस्ट गर्न लायक फोटो लिएर फर्किन्छन्। दशैं मिलन, तिहार साँझ, कन्सर्ट वा विवाहका लागि।',
    points: ['सेल्फी वा फोटो, चाडको फ्रेममा', 'ढोकाका लागि QR पोस्टर', 'English, Deutsch, नेपाली'],
    talk: 'Kura garau',
    more: 'हाम्रा सबै काम',
    free: 'हामी बढ्दै गर्दा निःशुल्क।',
  },
};

