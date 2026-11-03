// Words for /work/kite ("Changa Chet!") in English, Deutsch and नेपाली.
// The flyers on the other rooftops are made-up nicknames ("big brother from
// Thamel") — no real people. Nothing here buys, sells or costs anything:
// tests/kiteGame.test.ts checks every string for money words.

import type { Pattern } from './kite';

export type Lang = 'en' | 'de' | 'ne';
export const LANGS: { id: Lang; label: string }[] = [
  { id: 'en', label: 'EN' },
  { id: 'de', label: 'DE' },
  { id: 'ne', label: 'नेपाली' },
];
export function asKiteLang(v: unknown): Lang | null {
  return v === 'en' || v === 'de' || v === 'ne' ? v : null;
}

const NE_DIGITS = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
/** 1234 → "1,234" (or Devanagari digits in नेपाली). */
export function num(n: number, lang: Lang): string {
  const s = Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, lang === 'de' ? '.' : ',');
  return lang === 'ne' ? s.replace(/[0-9]/g, (d) => NE_DIGITS[Number(d)]) : s;
}
export function clock(sec: number, lang: Lang): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  const t = `${m}:${String(s).padStart(2, '0')}`;
  return lang === 'ne' ? t.replace(/[0-9]/g, (d) => NE_DIGITS[Number(d)]) : t;
}

/** Made-up rooftop nicknames: a neighbourhood and a family word. */
export const FLYERS: Record<Lang, string[]> = {
  en: ['Thamel Dai', 'Patan Kanchha', 'Asan Didi', 'Kirtipur Kanchi', 'Bhaktapur Bhai', 'Boudha Maila', 'Kalimati Kaka', 'Chabahil Saila', 'Lazimpat Bahini', 'Dhobighat Dada'],
  de: ['Thamel Dai', 'Patan Kanchha', 'Asan Didi', 'Kirtipur Kanchi', 'Bhaktapur Bhai', 'Boudha Maila', 'Kalimati Kaka', 'Chabahil Saila', 'Lazimpat Bahini', 'Dhobighat Dada'],
  ne: ['ठमेल दाइ', 'पाटन कान्छा', 'असन दिदी', 'कीर्तिपुर कान्छी', 'भक्तपुर भाइ', 'बौद्ध माइला', 'कालिमाटी काका', 'चाबहिल साइला', 'लाजिम्पाट बहिनी', 'धोबीघाट दादा'],
};

/** Colours for your kite. */
export const PALETTE = ['#e23d3d', '#ff7a1a', '#f2b705', '#14a37f', '#1f7ae0', '#3b3fb6', '#e84393', '#f5f0e6', '#2d3436'];

export type KiteCopy = {
  title: string;
  tagline: string;
  langLabel: string;
  calm: string;
  calmHint: string;
  sound: string;
  soundOff: string;
  pause: string;
  resume: string;
  restart: string;
  menu: string;
  play: string;
  playAgain: string;
  paused: string;
  yourKite: string;
  done: string;
  colour: string;
  accent: string;
  pattern: string;
  patterns: Record<Pattern, string>;
  colourName: (i: number) => string;
  howTitle: string;
  how: [string, string, string];
  keys: string;
  best: (n: string) => string;
  newBest: string;
  score: string;
  time: string;
  kites: string;
  string: string;
  combo: string;
  cuts: string;
  loot: string;
  bestCombo: string;
  timeUp: string;
  outOfKites: string;
  bonus: (n: string) => string;
  share: string;
  sharing: string;
  saved: string;
  shareText: (score: string, cuts: string) => string;
  chet: string;
  lootPop: string;
  you: string;
  wind: string;
  canvasLabel: string;
  description: string;
  say: {
    start: string;
    cut: (name: string, pts: string) => string;
    lost: (name: string | null, left: string) => string;
    bird: string;
    wire: string;
    loot: string;
    over: (score: string) => string;
  };
  stageLabel: string;
};

const EN: KiteCopy = {
  title: 'Changa Chet!',
  tagline: 'A Dashain kite fight on the rooftops',
  langLabel: 'Language',
  calm: 'Calm mode',
  calmHint: 'Slower spin, no shaking',
  sound: 'Sound on',
  soundOff: 'Sound off',
  pause: 'Pause',
  resume: 'Resume',
  restart: 'Restart',
  menu: 'Menu',
  play: 'Fly!',
  playAgain: 'Fly again',
  paused: 'Paused',
  yourKite: 'Your kite',
  done: 'Done',
  colour: 'Colour',
  accent: 'Second colour',
  pattern: 'Pattern',
  patterns: { stripes: 'Stripes', eye: 'Eye', sunmoon: 'Sun & moon', mandala: 'Mandala' },
  colourName: (i) => ['Red', 'Orange', 'Marigold', 'Green', 'Blue', 'Indigo', 'Pink', 'Cream', 'Charcoal'][i] ?? 'Colour',
  howTitle: 'How to fly',
  how: [
    'Hold — the kite darts the way its nose points.',
    'Let go — it spins slowly and drifts with the wind.',
    'Pull your string across another and saw — Chet! Grab falling kites for a bonus.',
  ],
  keys: 'Keyboard: hold Space or ↑ to pull · P to pause · M for sound',
  best: (n) => `Best: ${n}`,
  newBest: 'New best!',
  score: 'Score',
  time: 'Time',
  kites: 'Kites',
  string: 'String',
  combo: 'Combo',
  cuts: 'Kites cut',
  loot: 'Kites caught',
  bestCombo: 'Best combo',
  timeUp: 'Time’s up!',
  outOfKites: 'Out of kites!',
  bonus: (n) => `+${n} for kites still flying`,
  share: 'Share score',
  sharing: 'Making your picture…',
  saved: 'Picture saved',
  shareText: (score, cuts) => `I cut ${cuts} kites and scored ${score} in Changa Chet! — a Dashain rooftop kite fight. Can you beat it?`,
  chet: 'CHET!',
  lootPop: 'LOOT!',
  you: 'You',
  wind: 'Wind',
  canvasLabel: 'Changa Chet! — a rooftop kite fight. Your kite flies from the middle roof.',
  description:
    'Fly your kite from a Kathmandu rooftop during Dashain. Hold (mouse, touch, Space or the up arrow) to pull: the kite darts the way it points. Let go and it spins slowly and drifts with the wind. Cross your string over another kite’s string while pulling to cut it. Watch out for birds and power lines; you have three kites and 75 seconds.',
  say: {
    start: 'Round started. Hold to pull.',
    cut: (name, pts) => `Chet! You cut ${name}’s kite. Plus ${pts}.`,
    lost: (name, left) => (name ? `${name} cut your kite. ${left} left.` : `Your string snapped. ${left} left.`),
    bird: 'A bird hit your kite.',
    wire: 'Your kite hit the power line.',
    loot: 'You caught a falling kite.',
    over: (score) => `Round over. Score ${score}.`,
  },
  stageLabel: 'Game area — hold Space to pull the string',
};

const DE: KiteCopy = {
  title: 'Changa Chet!',
  tagline: 'Ein Dashain-Drachenkampf über den Dächern',
  langLabel: 'Sprache',
  calm: 'Ruhiger Modus',
  calmHint: 'Langsameres Drehen, kein Wackeln',
  sound: 'Ton an',
  soundOff: 'Ton aus',
  pause: 'Pause',
  resume: 'Weiter',
  restart: 'Neu starten',
  menu: 'Menü',
  play: 'Los!',
  playAgain: 'Nochmal',
  paused: 'Pausiert',
  yourKite: 'Dein Drachen',
  done: 'Fertig',
  colour: 'Farbe',
  accent: 'Zweite Farbe',
  pattern: 'Muster',
  patterns: { stripes: 'Streifen', eye: 'Auge', sunmoon: 'Sonne & Mond', mandala: 'Mandala' },
  colourName: (i) => ['Rot', 'Orange', 'Ringelblume', 'Grün', 'Blau', 'Indigo', 'Pink', 'Creme', 'Anthrazit'][i] ?? 'Farbe',
  howTitle: 'So fliegst du',
  how: [
    'Halten — der Drachen saust dorthin, wohin seine Spitze zeigt.',
    'Loslassen — er dreht sich langsam und treibt mit dem Wind.',
    'Zieh deine Schnur über eine andere und säge — Chet! Fang fallende Drachen für Bonuspunkte.',
  ],
  keys: 'Tastatur: Leertaste oder ↑ halten zum Ziehen · P für Pause · M für Ton',
  best: (n) => `Bestwert: ${n}`,
  newBest: 'Neuer Bestwert!',
  score: 'Punkte',
  time: 'Zeit',
  kites: 'Drachen',
  string: 'Schnur',
  combo: 'Kombo',
  cuts: 'Gekappt',
  loot: 'Gefangen',
  bestCombo: 'Beste Kombo',
  timeUp: 'Zeit um!',
  outOfKites: 'Keine Drachen mehr!',
  bonus: (n) => `+${n} für Drachen in der Luft`,
  share: 'Punkte teilen',
  sharing: 'Bild wird erstellt …',
  saved: 'Bild gespeichert',
  shareText: (score, cuts) => `${cuts} Drachen gekappt, ${score} Punkte in Changa Chet! — ein Dashain-Drachenkampf über den Dächern. Schaffst du mehr?`,
  chet: 'CHET!',
  lootPop: 'GEFANGEN!',
  you: 'Du',
  wind: 'Wind',
  canvasLabel: 'Changa Chet! — ein Drachenkampf über den Dächern. Dein Drachen startet vom mittleren Dach.',
  description:
    'Lass deinen Drachen an Dashain von einem Dach in Kathmandu steigen. Halten (Maus, Finger, Leertaste oder Pfeil nach oben) zieht die Schnur: Der Drachen saust in die Richtung, in die er zeigt. Loslassen: Er dreht sich langsam und treibt mit dem Wind. Kreuze beim Ziehen die Schnur eines anderen Drachens, um sie zu kappen. Achte auf Vögel und Stromleitungen; du hast drei Drachen und 75 Sekunden.',
  say: {
    start: 'Runde gestartet. Halten zum Ziehen.',
    cut: (name, pts) => `Chet! Du hast den Drachen von ${name} gekappt. Plus ${pts}.`,
    lost: (name, left) => (name ? `${name} hat deinen Drachen gekappt. Noch ${left}.` : `Deine Schnur ist gerissen. Noch ${left}.`),
    bird: 'Ein Vogel hat deinen Drachen getroffen.',
    wire: 'Dein Drachen hat die Stromleitung berührt.',
    loot: 'Du hast einen fallenden Drachen gefangen.',
    over: (score) => `Runde vorbei. ${score} Punkte.`,
  },
  stageLabel: 'Spielfeld — Leertaste halten zum Ziehen',
};

const NE: KiteCopy = {
  title: 'चङ्गा चेट!',
  tagline: 'दशैंमा छतमाथिको चङ्गा लडाइँ',
  langLabel: 'भाषा',
  calm: 'शान्त मोड',
  calmHint: 'बिस्तारै घुम्ने, नहल्लिने',
  sound: 'आवाज खुला',
  soundOff: 'आवाज बन्द',
  pause: 'रोक्नुहोस्',
  resume: 'जारी राख्नुहोस्',
  restart: 'सुरुदेखि',
  menu: 'मेनु',
  play: 'उडाऔं!',
  playAgain: 'फेरि उडाऔं',
  paused: 'रोकिएको छ',
  yourKite: 'तपाईंको चङ्गा',
  done: 'भयो',
  colour: 'रङ',
  accent: 'दोस्रो रङ',
  pattern: 'बुट्टा',
  patterns: { stripes: 'धर्सा', eye: 'आँखा', sunmoon: 'घाम-जून', mandala: 'मण्डला' },
  colourName: (i) => ['रातो', 'सुन्तले', 'सयपत्री', 'हरियो', 'निलो', 'गाढा निलो', 'गुलाबी', 'क्रिम', 'कालो'][i] ?? 'रङ',
  howTitle: 'कसरी उडाउने',
  how: [
    'थिचिराख्नुहोस् — चङ्गा जता फर्केको छ उतै हुइँकिन्छ।',
    'छोड्नुहोस् — चङ्गा बिस्तारै घुम्छ र हावासँगै बग्छ।',
    'तान्दै अरूको धागोमाथि आफ्नो धागो काट्नुहोस् — चेट! खस्दै गरेको चङ्गा समात्दा बोनस।',
  ],
  keys: 'किबोर्ड: तान्न Space वा ↑ थिचिराख्नुहोस् · रोक्न P · आवाज M',
  best: (n) => `उत्कृष्ट: ${n}`,
  newBest: 'नयाँ रेकर्ड!',
  score: 'अंक',
  time: 'समय',
  kites: 'चङ्गा',
  string: 'धागो',
  combo: 'कम्बो',
  cuts: 'चेट गरिएका',
  loot: 'समातिएका',
  bestCombo: 'उत्कृष्ट कम्बो',
  timeUp: 'समय सकियो!',
  outOfKites: 'चङ्गा सकियो!',
  bonus: (n) => `उडिरहेका चङ्गाका लागि +${n}`,
  share: 'स्कोर सेयर गर्नुहोस्',
  sharing: 'तस्बिर बन्दैछ…',
  saved: 'तस्बिर सेभ भयो',
  shareText: (score, cuts) => `मैले चङ्गा चेट! मा ${cuts} चङ्गा काटें र ${score} अंक ल्याएँ — दशैंको छतमाथिको चङ्गा लडाइँ। तपाईं कति ल्याउनुहुन्छ?`,
  chet: 'चेट!',
  lootPop: 'लुट!',
  you: 'तपाईं',
  wind: 'हावा',
  canvasLabel: 'चङ्गा चेट! — छतमाथिको चङ्गा लडाइँ। तपाईंको चङ्गा बीचको छतबाट उड्छ।',
  description:
    'दशैंमा काठमाडौंको छतबाट चङ्गा उडाउनुहोस्। धागो तान्न थिचिराख्नुहोस् (माउस, औंला, Space वा माथिको तीर): चङ्गा जता फर्केको छ उतै हुइँकिन्छ। छोड्दा चङ्गा बिस्तारै घुम्छ र हावासँगै बग्छ। तान्दै अरूको धागोमाथि आफ्नो धागो पुर्‍याएर काट्नुहोस्। चरा र बिजुलीको तारबाट जोगिनुहोस्; तपाईंसँग तीनवटा चङ्गा र ७५ सेकेन्ड छन्।',
  say: {
    start: 'खेल सुरु भयो। तान्न थिचिराख्नुहोस्।',
    cut: (name, pts) => `चेट! तपाईंले ${name}को चङ्गा काट्नुभयो। +${pts}।`,
    lost: (name, left) => (name ? `${name}ले तपाईंको चङ्गा काटे। ${left} बाँकी।` : `तपाईंको धागो चुँडियो। ${left} बाँकी।`),
    bird: 'चराले तपाईंको चङ्गामा ठोक्कियो।',
    wire: 'तपाईंको चङ्गा बिजुलीको तारमा ठोक्कियो।',
    loot: 'तपाईंले खस्दै गरेको चङ्गा समात्नुभयो।',
    over: (score) => `खेल सकियो। अंक ${score}।`,
  },
  stageLabel: 'खेल्ने ठाउँ — तान्न Space थिचिराख्नुहोस्',
};

export const COPY: Record<Lang, KiteCopy> = { en: EN, de: DE, ne: NE };
