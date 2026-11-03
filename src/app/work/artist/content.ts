// Every word of the demo artist page, in English, Deutsch and नेपाली. The artist, the
// band, the songs, the venues, the numbers and the press lines are all made up
// — this is a studio demo, not a real singer's page. The "songs" are short
// original melodies the browser plays live (see synth.ts); no recording of any
// real song is used.

export type ArtistLang = 'en' | 'de' | 'ne';

export const LANGS: { id: ArtistLang; label: string; short: string }[] = [
  { id: 'en', label: 'English', short: 'EN' },
  { id: 'de', label: 'Deutsch', short: 'DE' },
  { id: 'ne', label: 'नेपाली', short: 'नेपाली' },
];
export function asArtistLang(v: unknown): ArtistLang {
  return v === 'de' || v === 'ne' ? v : 'en';
}

export type TrackId = 'kuhiro' | 'saanjh' | 'taara' | 'ghar';

export type TourStatus = 'onsale' | 'few' | 'soldout';

export type TourStop = {
  id: string;
  /** ISO date of the (made-up) show. */
  date: string;
  status: TourStatus;
};

/** Made-up shows, spring 2027. Names and cities per language are in COPY. */
export const TOUR: TourStop[] = [
  { id: 'berlin', date: '2027-03-12', status: 'onsale' },
  { id: 'hamburg', date: '2027-03-14', status: 'few' },
  { id: 'amsterdam', date: '2027-03-20', status: 'onsale' },
  { id: 'brussels', date: '2027-03-27', status: 'soldout' },
  { id: 'paris', date: '2027-04-03', status: 'few' },
  { id: 'london', date: '2027-04-10', status: 'onsale' },
  { id: 'frankfurt', date: '2027-04-17', status: 'soldout' },
  { id: 'vienna', date: '2027-04-24', status: 'onsale' },
];

export const TRACK_IDS: TrackId[] = ['kuhiro', 'saanjh', 'taara', 'ghar'];

/** A made-up booking address on a reserved test domain — nothing is ever sent to it. */
export const BOOKING_EMAIL = 'booking@example.com';

const NE_DIGITS = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
export function toNeDigits(s: string | number): string {
  return String(s).replace(/[0-9]/g, (d) => NE_DIGITS[Number(d)]);
}
/** "4.2" as each language writes it: "4.2" / "4,2" / "४.२". */
export function fmtNum(s: string, lang: ArtistLang): string {
  return lang === 'ne' ? toNeDigits(s) : lang === 'de' ? s.replace('.', ',') : s;
}

type Stat = { value: number; decimals: number; suffix: string; label: string };

type Copy = {
  langLabel: string;
  demo: string;
  artist: string;
  band: string;
  withBand: string;
  kicker: string;
  oneLine: string;
  listen: string;
  book: string;
  scroll: string;
  nav: { music: string; tour: string; about: string; kit: string; booking: string };
  // player
  musicTitle: string;
  musicSub: string;
  demoMelodies: string;
  nowPlaying: string;
  tapToPlay: string;
  play: string;
  pause: string;
  prev: string;
  next: string;
  seek: string;
  iphoneHint: string;
  noAudio: string;
  tracks: Record<TrackId, { title: string; meaning: string; mood: string }>;
  // tour
  tourTitle: string;
  tourSub: string;
  status: Record<TourStatus, string>;
  stops: Record<string, { city: string; country: string; venue: string }>;
  tickets: string;
  ticketsNote: string;
  ticketsLink: string;
  close: string;
  tourDemo: string;
  months: string[];
  weekdays: string[];
  // about
  aboutTitle: string;
  bio: string[];
  stats: Stat[];
  statsNote: string;
  pressTitle: string;
  press: { line: string; outlet: string }[];
  pressNote: string;
  // videos
  videosTitle: string;
  videosSub: string;
  videoCaptions: [string, string];
  videoTitles: [string, string];
  videoPlay: (title: string) => string;
  // kit
  kitTitle: string;
  kitSub: string;
  kitSheet: string;
  kitSheetText: string;
  kitBio: string;
  kitBioText: string;
  kitCard: string;
  kitCardText: string;
  kitMaking: string;
  kitDone: string;
  kitNote: string;
  sheetTour: string;
  sheetPress: string;
  sheetBooking: string;
  sheetDemo: string;
  // booking
  bookTitle: string;
  bookSub: string;
  fName: string;
  fEmail: string;
  fOrg: string;
  fOrgPh: string;
  fCity: string;
  fCityPh: string;
  fDate: string;
  fType: string;
  types: { concert: string; festival: string; community: string; other: string };
  fSize: string;
  sizes: { s: string; m: string; l: string; xl: string };
  fMessage: string;
  fMessagePh: string;
  send: string;
  optional: string;
  errName: string;
  errEmail: string;
  errCity: string;
  errDate: string;
  errDatePast: string;
  errFix: string;
  thanks: (first: string) => string;
  thanksText: string;
  thanksSummary: string;
  another: string;
  formNote: string;
  footer: string;
};

export const COPY: Record<ArtistLang, Copy> = {
  en: {
    langLabel: 'Language',
    demo: 'demo',
    artist: 'Rimjhim Tara',
    band: 'Kuhiro Collective',
    withBand: 'with the Kuhiro Collective',
    kicker: 'Kuhiro Europe Tour · 2027',
    oneLine: 'Bansuri, madal and a voice from the hills — Nepali folk-pop, on tour across Europe.',
    listen: 'Listen',
    book: 'Book a show',
    scroll: 'Scroll to the music',
    nav: { music: 'Music', tour: 'Tour', about: 'About', kit: 'Press kit', booking: 'Booking' },
    musicTitle: 'Music',
    musicSub: 'Four short pieces from the new album, Kuhiro.',
    demoMelodies:
      'Demo melodies: original tunes made up for this page and played live by your browser — a madal-style drum, a bansuri-style flute and a drone. Not a recording.',
    nowPlaying: 'Now playing',
    tapToPlay: 'Tap play to start the sound',
    play: 'Play',
    pause: 'Pause',
    prev: 'Previous song',
    next: 'Next song',
    seek: 'Position in the song',
    iphoneHint: 'No sound on iPhone? Switch off silent mode.',
    noAudio: 'This browser cannot play the demo melodies.',
    tracks: {
      kuhiro: { title: 'Kuhiro', meaning: 'Fog', mood: 'Slow · a morning in the hills' },
      saanjh: { title: 'Saanjh Bato', meaning: 'Evening road', mood: 'Swaying · 6/8' },
      taara: { title: 'Taara Bagaicha', meaning: 'Garden of stars', mood: 'Dreamy · night sky' },
      ghar: { title: 'Ghar Tira', meaning: 'Towards home', mood: 'Dance · the encore' },
    },
    tourTitle: 'Tour 2027',
    tourSub: 'Eight cities, one band, the hills in every hall.',
    status: { onsale: 'On sale', few: 'Few left', soldout: 'Sold out' },
    stops: {
      berlin: { city: 'Berlin', country: 'Germany', venue: 'Spreehalle Ost' },
      hamburg: { city: 'Hamburg', country: 'Germany', venue: 'Elbkante Saal' },
      amsterdam: { city: 'Amsterdam', country: 'Netherlands', venue: 'De Lichtzaal' },
      brussels: { city: 'Brussels', country: 'Belgium', venue: 'Atelier Midi' },
      paris: { city: 'Paris', country: 'France', venue: 'Salle des Lanternes' },
      london: { city: 'London', country: 'UK', venue: 'Riverside Lantern Hall' },
      frankfurt: { city: 'Frankfurt', country: 'Germany', venue: 'Mainufer Bühne' },
      vienna: { city: 'Vienna', country: 'Austria', venue: 'Donaulicht Saal' },
    },
    tickets: 'Tickets',
    ticketsNote:
      'On a real artist page this button opens the show’s MartNepali event page — tickets, seat map and QR entry at the door. This show is made up, so here it only explains.',
    ticketsLink: 'Browse real events →',
    close: 'Close',
    tourDemo: 'Demo: venues, dates and ticket status are made up.',
    months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    weekdays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    aboutTitle: 'About',
    bio: [
      'Rimjhim Tara grew up between terraced fields and a radio that only played folk songs. She learned the bansuri from her grandfather and the madal from her cousins, and started writing her own songs at fifteen.',
      'With the Kuhiro Collective — five friends from Pokhara, Kathmandu and Berlin — she mixes old hill melodies with warm synths and a dance beat. Kuhiro, the new album, is about fog: the kind that hides the mountains, and the kind that lifts when you finally go home.',
    ],
    stats: [
      { value: 36, decimals: 0, suffix: '', label: 'songs' },
      { value: 4.2, decimals: 1, suffix: 'M', label: 'streams' },
      { value: 2, decimals: 0, suffix: '', label: 'albums' },
      { value: 19, decimals: 0, suffix: '', label: 'cities played' },
    ],
    statsNote: 'Made-up numbers for a made-up artist.',
    pressTitle: 'What they said',
    press: [
      { line: 'A bansuri that sounds like mountain air on a winter night.', outlet: 'Himal Beat Weekly' },
      { line: 'The madal pushes, the voice floats — and the whole hall sang every chorus.', outlet: 'Rhein Folk Notes' },
      { line: 'Nepali folk-pop with the patience of a long road home.', outlet: 'Lantern Radio Europe' },
    ],
    pressNote: 'Demo: the outlets and their words are invented.',
    videosTitle: 'On the big screen',
    videosSub: 'An artist page can carry the stage visuals too.',
    videoCaptions: [
      'Stage visuals we made — the dance backdrop from a real concert night in Frankfurt, Oct 2026.',
      'Stage visuals we made — neon beat bars for the after-party DJ set, same night.',
    ],
    videoTitles: ['Stage screen · Dance', 'Stage screen · After party'],
    videoPlay: (title) => `Play: ${title}`,
    kitTitle: 'Press kit',
    kitSub: 'Everything a promoter or a journalist asks for, ready to download. Made right here in your browser.',
    kitSheet: 'One-sheet',
    kitSheetText: 'A picture with the bio, numbers and tour dates (PNG).',
    kitBio: 'Bio & facts',
    kitBioText: 'Short and long bio as plain text (TXT).',
    kitCard: 'Booking contact',
    kitCardText: 'A contact card for your phone (VCF).',
    kitMaking: 'Making…',
    kitDone: 'Downloaded ✓',
    kitNote: 'Demo files about a made-up artist — nothing is uploaded or sent.',
    sheetTour: 'Kuhiro Europe Tour 2027',
    sheetPress: 'Press',
    sheetBooking: 'Booking',
    sheetDemo: 'DEMO · a made-up artist · built by MartNepali',
    bookTitle: 'Book a show',
    bookSub: 'A festival, a concert, a Dashain or Tihar night for your community — tell the band about it.',
    fName: 'Your name',
    fEmail: 'Email',
    fOrg: 'Organisation',
    fOrgPh: 'Association, festival or venue',
    fCity: 'City',
    fCityPh: 'e.g. Munich',
    fDate: 'Date you have in mind',
    fType: 'Kind of event',
    types: { concert: 'Concert', festival: 'Festival', community: 'Community night', other: 'Something else' },
    fSize: 'Expected audience',
    sizes: { s: 'Up to 200', m: '200–500', l: '500–1,000', xl: 'More than 1,000' },
    fMessage: 'Anything else?',
    fMessagePh: 'The hall, the other acts, the idea for the night…',
    send: 'Send enquiry',
    optional: 'optional',
    errName: 'Please write your name.',
    errEmail: 'Please check the email address.',
    errCity: 'Which city is the show in?',
    errDate: 'Please pick a date.',
    errDatePast: 'That date has already passed.',
    errFix: 'A few things need a look — see the marked fields.',
    thanks: (first) => `Dhanyabad, ${first}!`,
    thanksText:
      'On a real artist page your enquiry would now reach the booking team. This is a demo: nothing was sent and nothing was saved — it never left this page.',
    thanksSummary: 'What you wrote',
    another: 'Write another',
    formNote: 'Demo form: it checks what you type, but sends nothing and saves nothing.',
    footer: 'Rimjhim Tara & the Kuhiro Collective — a made-up artist for a MartNepali demo.',
  },
  de: {
    langLabel: 'Sprache',
    demo: 'Demo',
    artist: 'Rimjhim Tara',
    band: 'Kuhiro Collective',
    withBand: 'mit dem Kuhiro Collective',
    kicker: 'Kuhiro Europa-Tour · 2027',
    oneLine: 'Bansuri-Flöte, Madal-Trommel und eine Stimme aus den Bergen — nepalesischer Folk-Pop, auf Tour durch Europa.',
    listen: 'Reinhören',
    book: 'Auftritt anfragen',
    scroll: 'Weiter zur Musik',
    nav: { music: 'Musik', tour: 'Tour', about: 'Über sie', kit: 'Pressekit', booking: 'Booking' },
    musicTitle: 'Musik',
    musicSub: 'Vier kurze Stücke aus dem neuen Album Kuhiro.',
    demoMelodies:
      'Demo-Melodien: eigene Stücke, nur für diese Seite erfunden und live von deinem Browser gespielt — eine Trommel wie die Madal, eine Flöte wie die Bansuri und ein tiefer Halteton. Keine Aufnahme.',
    nowPlaying: 'Läuft gerade',
    tapToPlay: 'Zum Starten auf ▶ tippen',
    play: 'Abspielen',
    pause: 'Pause',
    prev: 'Vorheriger Song',
    next: 'Nächster Song',
    seek: 'Position im Song',
    iphoneHint: 'Kein Ton auf dem iPhone? Schalte den Stummmodus aus.',
    noAudio: 'Dieser Browser kann die Demo-Melodien nicht abspielen.',
    tracks: {
      kuhiro: { title: 'Kuhiro', meaning: 'Nebel', mood: 'Langsam · ein Morgen in den Bergen' },
      saanjh: { title: 'Saanjh Bato', meaning: 'Abendweg', mood: 'Wiegend · 6/8' },
      taara: { title: 'Taara Bagaicha', meaning: 'Sternengarten', mood: 'Verträumt · Nachthimmel' },
      ghar: { title: 'Ghar Tira', meaning: 'Richtung Heimat', mood: 'Tanz · die Zugabe' },
    },
    tourTitle: 'Tour 2027',
    tourSub: 'Acht Städte, eine Band, die Berge in jedem Saal.',
    status: { onsale: 'Im Verkauf', few: 'Nur noch wenige', soldout: 'Ausverkauft' },
    stops: {
      berlin: { city: 'Berlin', country: 'Deutschland', venue: 'Spreehalle Ost' },
      hamburg: { city: 'Hamburg', country: 'Deutschland', venue: 'Elbkante Saal' },
      amsterdam: { city: 'Amsterdam', country: 'Niederlande', venue: 'De Lichtzaal' },
      brussels: { city: 'Brüssel', country: 'Belgien', venue: 'Atelier Midi' },
      paris: { city: 'Paris', country: 'Frankreich', venue: 'Salle des Lanternes' },
      london: { city: 'London', country: 'Großbritannien', venue: 'Riverside Lantern Hall' },
      frankfurt: { city: 'Frankfurt', country: 'Deutschland', venue: 'Mainufer Bühne' },
      vienna: { city: 'Wien', country: 'Österreich', venue: 'Donaulicht Saal' },
    },
    tickets: 'Tickets',
    ticketsNote:
      'Auf einer echten Künstlerseite öffnet dieser Button die MartNepali-Eventseite der Show — mit Tickets, Saalplan und QR-Einlass an der Tür. Diese Show ist erfunden, darum erklärt er hier nur.',
    ticketsLink: 'Echte Events ansehen →',
    close: 'Schließen',
    tourDemo: 'Demo: Säle, Termine und Ticketstatus sind erfunden.',
    months: ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sept.', 'Okt.', 'Nov.', 'Dez.'],
    weekdays: ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'],
    aboutTitle: 'Über sie',
    bio: [
      'Rimjhim Tara ist zwischen Terrassenfeldern und einem Radio aufgewachsen, das nur Volkslieder spielte. Die Bansuri, eine Bambusflöte, lernte sie von ihrem Großvater, die Madal-Trommel von ihren Cousins und Cousinen — und mit fünfzehn schrieb sie ihre ersten eigenen Songs.',
      'Mit dem Kuhiro Collective — fünf Freunden aus Pokhara, Kathmandu und Berlin — mischt sie alte Melodien aus den Bergen mit warmen Synths und einem tanzbaren Beat. Kuhiro, das neue Album, handelt vom Nebel: von dem, der die Berge versteckt, und von dem, der sich hebt, wenn man endlich nach Hause kommt.',
    ],
    stats: [
      { value: 36, decimals: 0, suffix: '', label: 'Songs' },
      { value: 4.2, decimals: 1, suffix: ' Mio.', label: 'Streams' },
      { value: 2, decimals: 0, suffix: '', label: 'Alben' },
      { value: 19, decimals: 0, suffix: '', label: 'Städte bespielt' },
    ],
    statsNote: 'Erfundene Zahlen für eine erfundene Künstlerin.',
    pressTitle: 'Was die Presse sagt',
    press: [
      { line: 'Eine Bansuri, die klingt wie Bergluft in einer Winternacht.', outlet: 'Himal Beat Weekly' },
      { line: 'Die Madal treibt, die Stimme schwebt — und der ganze Saal sang jeden Refrain mit.', outlet: 'Rhein Folk Notes' },
      { line: 'Nepalesischer Folk-Pop mit der Geduld eines langen Heimwegs.', outlet: 'Lantern Radio Europe' },
    ],
    pressNote: 'Demo: Die Medien und ihre Worte sind erfunden.',
    videosTitle: 'Auf der Leinwand',
    videosSub: 'Eine Künstlerseite kann auch die Bühnenvisuals zeigen.',
    videoCaptions: [
      'Bühnenvisuals von uns — der Tanz-Hintergrund von einem echten Konzertabend in Frankfurt, Okt. 2026.',
      'Bühnenvisuals von uns — Neon-Beat-Balken für das DJ-Set der Aftershow-Party, am selben Abend.',
    ],
    videoTitles: ['Bühnenleinwand · Tanz', 'Bühnenleinwand · Aftershow-Party'],
    videoPlay: (title) => `Abspielen: ${title}`,
    kitTitle: 'Pressekit',
    kitSub: 'Alles, wonach Veranstalter oder Journalistinnen fragen, fertig zum Download. Direkt hier in deinem Browser erstellt.',
    kitSheet: 'One-Sheet',
    kitSheetText: 'Ein Bild mit Bio, Zahlen und Tourdaten (PNG).',
    kitBio: 'Bio & Fakten',
    kitBioText: 'Kurze und lange Bio als reiner Text (TXT).',
    kitCard: 'Booking-Kontakt',
    kitCardText: 'Eine Kontaktkarte für dein Handy (VCF).',
    kitMaking: 'Wird erstellt…',
    kitDone: 'Heruntergeladen ✓',
    kitNote: 'Demo-Dateien über eine erfundene Künstlerin — nichts wird hochgeladen oder verschickt.',
    sheetTour: 'Kuhiro Europa-Tour 2027',
    sheetPress: 'Presse',
    sheetBooking: 'Booking',
    sheetDemo: 'DEMO · eine erfundene Künstlerin · gebaut von MartNepali',
    bookTitle: 'Auftritt anfragen',
    bookSub:
      'Ein Festival, ein Konzert, ein Dashain- oder Tihar-Abend (die großen nepalesischen Feste im Herbst) für deine Community — erzähl der Band davon.',
    fName: 'Dein Name',
    fEmail: 'E-Mail',
    fOrg: 'Organisation',
    fOrgPh: 'Verein, Festival oder Veranstaltungsort',
    fCity: 'Stadt',
    fCityPh: 'z. B. München',
    fDate: 'Wunschtermin',
    fType: 'Art der Veranstaltung',
    types: { concert: 'Konzert', festival: 'Festival', community: 'Community-Abend', other: 'Etwas anderes' },
    fSize: 'Erwartetes Publikum',
    sizes: { s: 'Bis 200', m: '200–500', l: '500–1.000', xl: 'Mehr als 1.000' },
    fMessage: 'Sonst noch etwas?',
    fMessagePh: 'Der Saal, die anderen Acts, die Idee für den Abend…',
    send: 'Anfrage senden',
    optional: 'optional',
    errName: 'Bitte schreib deinen Namen.',
    errEmail: 'Bitte prüf die E-Mail-Adresse.',
    errCity: 'In welcher Stadt ist der Auftritt?',
    errDate: 'Bitte wähl ein Datum.',
    errDatePast: 'Dieses Datum ist schon vorbei.',
    errFix: 'Ein paar Felder brauchen noch einen Blick — sie sind markiert.',
    thanks: (first) => `Dhanyabad, ${first}!`,
    thanksText:
      'Auf einer echten Künstlerseite käme deine Anfrage jetzt beim Booking-Team an. Das hier ist eine Demo: Nichts wurde verschickt und nichts gespeichert — sie hat diese Seite nie verlassen.',
    thanksSummary: 'Was du geschrieben hast',
    another: 'Noch eine schreiben',
    formNote: 'Demo-Formular: Es prüft, was du eingibst, verschickt aber nichts und speichert nichts.',
    footer: 'Rimjhim Tara & das Kuhiro Collective — eine erfundene Künstlerin für eine MartNepali-Demo.',
  },
  ne: {
    langLabel: 'भाषा',
    demo: 'नमुना',
    artist: 'रिमझिम तारा',
    band: 'कुहिरो कलेक्टिभ',
    withBand: 'कुहिरो कलेक्टिभसँग',
    kicker: 'कुहिरो युरोप टुर · २०२७',
    oneLine: 'बाँसुरी, मादल र पहाडको स्वर — नेपाली लोक-पप, युरोपभरि टुरमा।',
    listen: 'सुन्नुहोस्',
    book: 'कार्यक्रम बुक गर्नुहोस्',
    scroll: 'सङ्गीततिर जानुहोस्',
    nav: { music: 'सङ्गीत', tour: 'टुर', about: 'परिचय', kit: 'प्रेस किट', booking: 'बुकिङ' },
    musicTitle: 'सङ्गीत',
    musicSub: 'नयाँ एल्बम «कुहिरो» बाट चार छोटा धुन।',
    demoMelodies:
      'नमुना धुन: यही पेजका लागि बनाइएका आफ्नै धुन, तपाईंकै ब्राउजरले अहिले बजाउँछ — मादलजस्तो ताल, बाँसुरीजस्तो धुन र एउटा सुर। रेकर्डिङ होइन।',
    nowPlaying: 'अहिले बज्दै',
    tapToPlay: 'आवाज सुरु गर्न प्ले थिच्नुहोस्',
    play: 'बजाउनुहोस्',
    pause: 'रोक्नुहोस्',
    prev: 'अघिल्लो गीत',
    next: 'अर्को गीत',
    seek: 'गीतमा कहाँ',
    iphoneHint: 'आइफोनमा आवाज आएन? साइलेन्ट मोड बन्द गर्नुहोस्।',
    noAudio: 'यो ब्राउजरले नमुना धुन बजाउन सक्दैन।',
    tracks: {
      kuhiro: { title: 'कुहिरो', meaning: 'Fog', mood: 'ढिलो · पहाडको बिहान' },
      saanjh: { title: 'साँझ बाटो', meaning: 'Evening road', mood: 'झुम्दै · ६/८' },
      taara: { title: 'तारा बगैंचा', meaning: 'Garden of stars', mood: 'सपनाजस्तो · रातको आकाश' },
      ghar: { title: 'घर तिर', meaning: 'Towards home', mood: 'नाच · अन्तिम गीत' },
    },
    tourTitle: 'टुर २०२७',
    tourSub: 'आठ सहर, एउटा ब्यान्ड, हरेक हलमा पहाड।',
    status: { onsale: 'टिकट उपलब्ध', few: 'थोरै बाँकी', soldout: 'सबै बिक्यो' },
    stops: {
      berlin: { city: 'बर्लिन', country: 'जर्मनी', venue: 'Spreehalle Ost' },
      hamburg: { city: 'ह्याम्बर्ग', country: 'जर्मनी', venue: 'Elbkante Saal' },
      amsterdam: { city: 'एम्स्टर्डम', country: 'नेदरल्यान्ड्स', venue: 'De Lichtzaal' },
      brussels: { city: 'ब्रसेल्स', country: 'बेल्जियम', venue: 'Atelier Midi' },
      paris: { city: 'पेरिस', country: 'फ्रान्स', venue: 'Salle des Lanternes' },
      london: { city: 'लन्डन', country: 'बेलायत', venue: 'Riverside Lantern Hall' },
      frankfurt: { city: 'फ्र्याङ्कफर्ट', country: 'जर्मनी', venue: 'Mainufer Bühne' },
      vienna: { city: 'भियना', country: 'अस्ट्रिया', venue: 'Donaulicht Saal' },
    },
    tickets: 'टिकट',
    ticketsNote:
      'साँच्चैको कलाकार पेजमा यो बटनले कार्यक्रमको MartNepali इभेन्ट पेज खोल्छ — टिकट, सिट नक्सा र ढोकामा QR प्रवेश। यो कार्यक्रम काल्पनिक हो, त्यसैले यहाँ यसले केवल बुझाउँछ।',
    ticketsLink: 'साँच्चैका कार्यक्रम हेर्नुहोस् →',
    close: 'बन्द',
    tourDemo: 'नमुना: हल, मिति र टिकटको अवस्था काल्पनिक हुन्।',
    months: ['जनवरी', 'फेब्रुअरी', 'मार्च', 'अप्रिल', 'मे', 'जुन', 'जुलाई', 'अगस्ट', 'सेप्टेम्बर', 'अक्टोबर', 'नोभेम्बर', 'डिसेम्बर'],
    weekdays: ['आइत', 'सोम', 'मङ्गल', 'बुध', 'बिही', 'शुक्र', 'शनि'],
    aboutTitle: 'परिचय',
    bio: [
      'रिमझिम तारा गराहरू र लोकगीत मात्र बजाउने एउटा रेडियोबीच हुर्किन्। बाँसुरी हजुरबुबाबाट, मादल दाजुभाइ-दिदीबहिनीबाट सिकिन्, र पन्ध्र वर्षको उमेरमा आफ्नै गीत लेख्न थालिन्।',
      'कुहिरो कलेक्टिभ — पोखरा, काठमाडौं र बर्लिनका पाँच साथी — सँग उनी पुराना पहाडी धुनलाई न्यानो सिन्थ र नाच्ने तालसँग मिसाउँछिन्। नयाँ एल्बम «कुहिरो» कुहिरोकै बारेमा हो: हिमाल छोप्ने कुहिरो, र घर फर्कंदा हट्ने कुहिरो।',
    ],
    stats: [
      { value: 36, decimals: 0, suffix: '', label: 'गीत' },
      { value: 42, decimals: 0, suffix: ' लाख', label: 'स्ट्रिम' },
      { value: 2, decimals: 0, suffix: '', label: 'एल्बम' },
      { value: 19, decimals: 0, suffix: '', label: 'सहरमा कार्यक्रम' },
    ],
    statsNote: 'काल्पनिक कलाकारका काल्पनिक अङ्क।',
    pressTitle: 'उनीहरूले भने',
    press: [
      { line: 'जाडोको रातमा हिमालको हावाजस्तो बाँसुरी।', outlet: 'Himal Beat Weekly' },
      { line: 'मादलले धकेल्छ, स्वर उड्छ — र पूरा हलले हरेक कोरस गायो।', outlet: 'Rhein Folk Notes' },
      { line: 'घर फर्कने लामो बाटोजस्तै धैर्य भएको नेपाली लोक-पप।', outlet: 'Lantern Radio Europe' },
    ],
    pressNote: 'नमुना: पत्रिका र तिनका शब्द काल्पनिक हुन्।',
    videosTitle: 'ठूलो पर्दामा',
    videosSub: 'कलाकार पेजमा स्टेजका भिडियो पनि राख्न सकिन्छ।',
    videoCaptions: [
      'हामीले बनाएको स्टेज भिडियो — फ्र्याङ्कफर्टको साँच्चैको कन्सर्ट रात (अक्टोबर २०२६) को नृत्य ब्याकड्रप।',
      'हामीले बनाएको स्टेज भिडियो — सोही रातको आफ्टर-पार्टी DJ सेटका लागि नियोन बिट बार।',
    ],
    videoTitles: ['स्टेज स्क्रिन · नृत्य', 'स्टेज स्क्रिन · आफ्टर-पार्टी'],
    videoPlay: (title) => `बजाउनुहोस्: ${title}`,
    kitTitle: 'प्रेस किट',
    kitSub: 'आयोजक वा पत्रकारले माग्ने सबै कुरा, डाउनलोडका लागि तयार। यहीँ तपाईंको ब्राउजरमा बनिन्छ।',
    kitSheet: 'वान-सिट',
    kitSheetText: 'परिचय, अङ्क र टुरका मितिसहितको तस्बिर (PNG)।',
    kitBio: 'परिचय र तथ्य',
    kitBioText: 'छोटो र लामो परिचय, सादा पाठमा (TXT)।',
    kitCard: 'बुकिङ सम्पर्क',
    kitCardText: 'फोनमा राख्ने सम्पर्क कार्ड (VCF)।',
    kitMaking: 'बनाउँदै…',
    kitDone: 'डाउनलोड भयो ✓',
    kitNote: 'काल्पनिक कलाकारका नमुना फाइल — केही अपलोड वा पठाइँदैन।',
    sheetTour: 'कुहिरो युरोप टुर २०२७',
    sheetPress: 'प्रेस',
    sheetBooking: 'बुकिङ',
    sheetDemo: 'नमुना · काल्पनिक कलाकार · MartNepali ले बनाएको',
    bookTitle: 'कार्यक्रम बुक गर्नुहोस्',
    bookSub: 'फेस्टिभल, कन्सर्ट, वा तपाईंको समुदायको दसैं-तिहार साँझ — ब्यान्डलाई बताउनुहोस्।',
    fName: 'तपाईंको नाम',
    fEmail: 'इमेल',
    fOrg: 'संस्था',
    fOrgPh: 'संस्था, फेस्टिभल वा हल',
    fCity: 'सहर',
    fCityPh: 'जस्तै म्युनिख',
    fDate: 'सोचेको मिति',
    fType: 'कार्यक्रमको किसिम',
    types: { concert: 'कन्सर्ट', festival: 'फेस्टिभल', community: 'सामुदायिक साँझ', other: 'अरू केही' },
    fSize: 'अनुमानित दर्शक',
    sizes: { s: '२०० सम्म', m: '२००–५००', l: '५००–१,०००', xl: '१,००० भन्दा बढी' },
    fMessage: 'अरू केही?',
    fMessagePh: 'हल, अरू कलाकार, साँझको योजना…',
    send: 'सोधपुछ पठाउनुहोस्',
    optional: 'ऐच्छिक',
    errName: 'कृपया आफ्नो नाम लेख्नुहोस्।',
    errEmail: 'कृपया इमेल ठेगाना जाँच्नुहोस्।',
    errCity: 'कार्यक्रम कुन सहरमा हो?',
    errDate: 'कृपया मिति छान्नुहोस्।',
    errDatePast: 'त्यो मिति बितिसक्यो।',
    errFix: 'केही कुरा हेर्नुपर्ने छ — चिन्ह लगाइएका ठाउँ हेर्नुहोस्।',
    thanks: (first) => `धन्यवाद, ${first}!`,
    thanksText:
      'साँच्चैको कलाकार पेजमा तपाईंको सोधपुछ अब बुकिङ टोलीकहाँ पुग्थ्यो। यो नमुना हो: केही पठाइएन, केही सेभ भएन — यो पेजबाहिर गएन।',
    thanksSummary: 'तपाईंले लेख्नुभएको',
    another: 'अर्को लेख्नुहोस्',
    formNote: 'नमुना फारम: तपाईंले लेखेको जाँच्छ, तर केही पठाउँदैन र केही सेभ गर्दैन।',
    footer: 'रिमझिम तारा र कुहिरो कलेक्टिभ — MartNepali नमुनाका लागि काल्पनिक कलाकार।',
  },
};

/**
 * The parts of a show date, from a plain ISO date, plus the whole of it the way
 * each language writes it: "12 Mar 2027" / "12. März 2027" / "१२ मार्च २०२७"
 * (`full`) and without the year (`short`).
 */
export function showDate(
  iso: string,
  lang: ArtistLang
): { day: string; month: string; weekday: string; year: string; short: string; full: string } {
  const [y, m, d] = iso.split('-').map(Number);
  // Noon UTC so the weekday is the same in every time zone.
  const wd = new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay();
  const t = COPY[lang];
  const num = (n: number | string) => (lang === 'ne' ? toNeDigits(n) : String(n));
  const day = num(d);
  const month = t.months[m - 1];
  const short = lang === 'de' ? `${day}. ${month}` : `${day} ${month}`;
  return { day, month, weekday: t.weekdays[wd], year: num(y), short, full: `${short} ${num(y)}` };
}
