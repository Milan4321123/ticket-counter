// Helper words for "Ka Kha Ga" (/work/abc) in English, Deutsch and नेपाली.
// The letters and their example words live in abc.ts; this is the grown-up
// text around them. Nothing here buys, sells or costs anything — the only line
// about it is the frame's "free while we grow" (FRAME.free), and
// tests/abcLetters.test.ts checks every other string in all three languages.

import type { GameId, Lang, StickerId } from './abc';

export type { Lang };
export const LANGS: { id: Lang; label: string }[] = [
  { id: 'en', label: 'English' },
  { id: 'de', label: 'Deutsch' },
  { id: 'ne', label: 'नेपाली' },
];
export function asAbcLang(v: unknown): Lang | null {
  return v === 'en' || v === 'de' || v === 'ne' ? v : null;
}

const NE_DIGITS = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
export function num(n: number, lang: Lang): string {
  return lang === 'ne' ? String(n).replace(/[0-9]/g, (d) => NE_DIGITS[Number(d)]) : String(n);
}

export type Tab = 'letters' | 'trace' | 'games' | 'stickers';
type S = (a: string) => string;
type S2 = (a: string, b: string) => string;

export type Copy = {
  name: string;
  tagline: string;
  mascot: string;
  langLabel: string;
  soundOn: string;
  soundOff: string;
  starsLabel: S;
  streakLabel: S;
  tabsLabel: string;
  tabs: Record<Tab, string>;
  hello: S;
  helloNobody: string;

  vowels: string;
  consonants: string;
  tapHint: string;
  noVoice: string;
  noSpeech: string;
  hiVoice: string;
  sayTogether: string;
  listen: string;
  traceIt: string;
  close: string;
  prev: string;
  next: string;
  insideNote: S;
  meaning: S;
  starsOf: S;

  traceH: string;
  traceSub: string;
  pickLetter: string;
  clear: string;
  showMe: string;
  done: string;
  drawHere: S;
  traceResult: Record<0 | 1 | 2 | 3, string>;
  hintMore: string;
  hintInside: string;
  tryAgain: string;
  nextLetter: string;
  coverage: S2;

  gamesH: string;
  gamesSub: string;
  games: Record<GameId, { name: string; how: string }>;
  back: string;
  round: S2;
  findAsk: string;
  voiceH: string;
  voice: Record<'ne' | 'hi' | 'none' | 'unsupported' | 'unknown', string>;
  findListen: string;
  matchAsk: string;
  matchTapHint: string;
  matched: string;
  buildAsk: string;
  buildTapHint: string;
  buildUndo: string;
  buildWrong: string;
  wellDone: string;
  wellDoneName: S;
  roundWon: S;
  playAgain: string;
  otherGames: string;
  wrongTry: string;

  stickersH: string;
  stickersSub: string;
  stickerNext: S;
  stickerFull: string;
  stickerNew: string;
  stickerNames: Record<StickerId, string>;
  locked: string;

  parentBtn: string;
  parentHold: string;
  parentH: string;
  parentSub: string;
  childName: string;
  childNameHint: string;
  helperLang: string;
  progressH: string;
  statLetters: S;
  statStars: S;
  statStickers: S;
  statStreak: S;
  statGames: S;
  letterTable: string;
  privacy: string;
  resetH: string;
  resetBtn: string;
  resetSure: string;
  resetDone: string;
};

export const COPY: Record<Lang, Copy> = {
  en: {
    name: 'Ka Kha Ga',
    tagline: 'Learn to read and write Nepali letters',
    mascot: 'Habre the red panda',
    langLabel: 'Helper language',
    soundOn: 'Sound on',
    soundOff: 'Sound off',
    starsLabel: (n) => `${n} stars`,
    streakLabel: (n) => `${n} days in a row`,
    tabsLabel: 'Parts of the app',
    tabs: { letters: 'Letters', trace: 'Trace', games: 'Games', stickers: 'Stickers' },
    hello: (n) => `Namaste, ${n}!`,
    helloNobody: 'Namaste!',

    vowels: 'Vowels · स्वर',
    consonants: 'Consonants · व्यञ्जन',
    tapHint: 'Tap a letter to hear it.',
    noVoice: 'Your device has no Nepali voice — look at the letter and say it together.',
    noSpeech: 'This browser cannot speak — look at the letter and say it together.',
    hiVoice: 'Using a Hindi voice (same letters, close sounds).',
    sayTogether: 'Say it together:',
    listen: 'Hear it again',
    traceIt: 'Trace it',
    close: 'Close',
    prev: 'Previous letter',
    next: 'Next letter',
    insideNote: (c) => `No word starts with ${c} — find it inside the word.`,
    meaning: (m) => `means “${m}”`,
    starsOf: (n) => `${n} of 3 stars`,

    traceH: 'Trace it',
    traceSub: 'Draw over the letter with your finger.',
    pickLetter: 'Choose a letter',
    clear: 'Clear',
    showMe: 'Show me',
    done: 'Done',
    drawHere: (c) => `Tracing area for the letter ${c}`,
    traceResult: { 0: 'Let’s try that one more time!', 1: 'Good start!', 2: 'Very good!', 3: 'Wonderful!' },
    hintMore: 'Go over more of the letter.',
    hintInside: 'Try to stay on the letter.',
    tryAgain: 'Try again',
    nextLetter: 'Next letter',
    coverage: (c, o) => `On the letter: ${c}% · outside: ${o}%`,

    gamesH: 'Games',
    gamesSub: 'Three little games. Every round you finish fills the sticker book.',
    games: {
      find: { name: 'Find the letter', how: 'Pop the balloon with the right letter.' },
      match: { name: 'Match the picture', how: 'Drag each letter to its picture — or tap one, then the other.' },
      build: { name: 'Build a word', how: 'Put the pieces in order to make the word.' },
    },
    back: 'Back to games',
    round: (a, b) => `${a} of ${b}`,
    findAsk: 'Find this letter:',
    voiceH: 'Voice on this device',
    voice: { ne: 'Nepali', hi: 'Hindi (no Nepali voice found)', none: 'none — look-and-say mode', unsupported: 'this browser cannot speak — look-and-say mode', unknown: 'not checked yet' },
    findListen: 'Hear the letter',
    matchAsk: 'Which picture starts with this letter?',
    matchTapHint: 'Tap a letter, then its picture.',
    matched: 'Matched!',
    buildAsk: 'Make the word:',
    buildTapHint: 'Tap the pieces in order. Tap a placed piece to take it back.',
    buildUndo: 'Take back',
    buildWrong: 'Not quite — try another order.',
    wellDone: 'Well done!',
    wellDoneName: (n) => `Well done, ${n}!`,
    roundWon: (n) => `+${n} for your sticker book`,
    playAgain: 'Play again',
    otherGames: 'Other games',
    wrongTry: 'Try another one',

    stickersH: 'Sticker book',
    stickersSub: 'Stars from tracing and finished game rounds bring Habre’s stickers.',
    stickerNext: (n) => `${n} more to the next sticker`,
    stickerFull: 'The whole book is full — amazing!',
    stickerNew: 'A new sticker!',
    stickerNames: {
      hello: 'Namaste!',
      topi: 'Dhaka topi',
      kite: 'Kite day',
      book: 'Reading time',
      momo: 'Momo lunch',
      star: 'Star pupil',
      madal: 'Madal beat',
      balloon: 'Balloon ride',
      garland: 'Marigold garland',
      mountain: 'Up the mountain',
      moon: 'Good night',
      crown: 'Letter champion',
    },
    locked: 'Not yet',

    parentBtn: 'Parents',
    parentHold: 'Press and hold for 2 seconds',
    parentH: 'Parent corner',
    parentSub: 'Everything stays on this device. Nothing is sent, there is no account.',
    childName: 'Child’s first name (optional)',
    childNameHint: 'Only used to say “Well done” — kept on this device.',
    helperLang: 'Helper language for the words around the letters',
    progressH: 'Progress',
    statLetters: (n) => `${n} of 49 letters traced`,
    statStars: (n) => `${n} tracing stars`,
    statStickers: (n) => `${n} of 12 stickers`,
    statStreak: (n) => `${n} days in a row`,
    statGames: (n) => `${n} game rounds finished`,
    letterTable: 'Stars per letter',
    privacy: 'Speech uses only voices built into this device. No data collection, no tracking in this app.',
    resetH: 'Start again',
    resetBtn: 'Reset all progress',
    resetSure: 'Tap again to reset',
    resetDone: 'Progress reset.',
  },
  de: {
    name: 'Ka Kha Ga',
    tagline: 'Nepalische Buchstaben lesen und schreiben lernen',
    mascot: 'Habre, der kleine Panda',
    langLabel: 'Hilfssprache',
    soundOn: 'Ton an',
    soundOff: 'Ton aus',
    starsLabel: (n) => `${n} Sterne`,
    streakLabel: (n) => `${n} Tage am Stück`,
    tabsLabel: 'Bereiche der App',
    tabs: { letters: 'Buchstaben', trace: 'Nachfahren', games: 'Spiele', stickers: 'Sticker' },
    hello: (n) => `Namaste, ${n}!`,
    helloNobody: 'Namaste!',

    vowels: 'Vokale · स्वर',
    consonants: 'Konsonanten · व्यञ्जन',
    tapHint: 'Drück auf einen Buchstaben, dann hörst du ihn.',
    noVoice: 'Dein Gerät hat keine nepalische Stimme — schaut euch den Buchstaben an und sprecht ihn zusammen.',
    noSpeech: 'Dieser Browser kann nicht sprechen — schaut euch den Buchstaben an und sprecht ihn zusammen.',
    hiVoice: 'Mit einer Hindi-Stimme (gleiche Schrift, ähnliche Laute).',
    sayTogether: 'Sprecht zusammen:',
    listen: 'Noch mal hören',
    traceIt: 'Nachfahren',
    close: 'Schließen',
    prev: 'Voriger Buchstabe',
    next: 'Nächster Buchstabe',
    insideNote: (c) => `Kein Wort beginnt mit ${c} — finde ihn im Wort.`,
    meaning: (m) => `heißt „${m}“`,
    starsOf: (n) => `${n} von 3 Sternen`,

    traceH: 'Nachfahren',
    traceSub: 'Fahre den Buchstaben mit dem Finger nach.',
    pickLetter: 'Buchstaben wählen',
    clear: 'Löschen',
    showMe: 'Zeig mal',
    done: 'Fertig',
    drawHere: (c) => `Malfläche für den Buchstaben ${c}`,
    traceResult: { 0: 'Komm, wir probieren es noch einmal!', 1: 'Guter Anfang!', 2: 'Sehr gut!', 3: 'Wunderbar!' },
    hintMore: 'Fahr noch mehr vom Buchstaben nach.',
    hintInside: 'Versuch, auf dem Buchstaben zu bleiben.',
    tryAgain: 'Noch mal',
    nextLetter: 'Nächster Buchstabe',
    coverage: (c, o) => `Auf dem Buchstaben: ${c} % · daneben: ${o} %`,

    gamesH: 'Spiele',
    gamesSub: 'Drei kleine Spiele. Jede geschaffte Runde füllt das Stickerbuch.',
    games: {
      find: { name: 'Finde den Buchstaben', how: 'Lass den Ballon mit dem richtigen Buchstaben platzen.' },
      match: { name: 'Bild und Buchstabe', how: 'Zieh jeden Buchstaben zu seinem Bild — oder drück erst auf den einen, dann auf das andere.' },
      build: { name: 'Bau ein Wort', how: 'Leg die Teile in die richtige Reihenfolge.' },
    },
    back: 'Zurück zu den Spielen',
    round: (a, b) => `${a} von ${b}`,
    findAsk: 'Finde diesen Buchstaben:',
    voiceH: 'Stimme auf diesem Gerät',
    voice: { ne: 'Nepalisch', hi: 'Hindi (keine nepalische Stimme gefunden)', none: 'keine — Anschauen-und-Sprechen', unsupported: 'dieser Browser kann nicht sprechen — Anschauen-und-Sprechen', unknown: 'noch nicht geprüft' },
    findListen: 'Buchstaben hören',
    matchAsk: 'Welches Bild beginnt mit diesem Buchstaben?',
    matchTapHint: 'Drück auf einen Buchstaben, dann auf sein Bild.',
    matched: 'Passt!',
    buildAsk: 'Bau das Wort:',
    buildTapHint: 'Drück die Teile der Reihe nach. Drückst du ein gelegtes Teil, kommt es zurück.',
    buildUndo: 'Zurücknehmen',
    buildWrong: 'Noch nicht ganz — probier eine andere Reihenfolge.',
    wellDone: 'Super gemacht!',
    wellDoneName: (n) => `Super gemacht, ${n}!`,
    roundWon: (n) => `+${n} für dein Stickerbuch`,
    playAgain: 'Noch eine Runde',
    otherGames: 'Andere Spiele',
    wrongTry: 'Probier einen anderen',

    stickersH: 'Stickerbuch',
    stickersSub: 'Sterne vom Nachfahren und geschaffte Spielrunden bringen Habres Sticker.',
    stickerNext: (n) => `Noch ${n} bis zum nächsten Sticker`,
    stickerFull: 'Das ganze Buch ist voll — toll!',
    stickerNew: 'Ein neuer Sticker!',
    stickerNames: {
      hello: 'Namaste!',
      topi: 'Dhaka-Topi',
      kite: 'Drachentag',
      book: 'Lesezeit',
      momo: 'Momos zum Mittag',
      star: 'Sternschüler',
      madal: 'Madal-Trommel',
      balloon: 'Ballonfahrt',
      garland: 'Ringelblumenkette',
      mountain: 'Auf den Berg',
      moon: 'Gute Nacht',
      crown: 'Buchstaben-Champion',
    },
    locked: 'Noch nicht',

    parentBtn: 'Eltern',
    parentHold: '2 Sekunden gedrückt halten',
    parentH: 'Elternecke',
    parentSub: 'Alles bleibt auf diesem Gerät. Nichts wird verschickt, es gibt keine Anmeldung.',
    childName: 'Vorname des Kindes (freiwillig)',
    childNameHint: 'Nur für „Super gemacht“ — bleibt auf diesem Gerät.',
    helperLang: 'Hilfssprache für die Wörter rund um die Buchstaben',
    progressH: 'Fortschritt',
    statLetters: (n) => `${n} von 49 Buchstaben nachgefahren`,
    statStars: (n) => `${n} Sterne vom Nachfahren`,
    statStickers: (n) => `${n} von 12 Stickern`,
    statStreak: (n) => `${n} Tage am Stück`,
    statGames: (n) => `${n} Spielrunden geschafft`,
    letterTable: 'Sterne pro Buchstabe',
    privacy: 'Die Sprachausgabe nutzt nur Stimmen, die auf dem Gerät eingebaut sind. Keine Datensammlung, kein Tracking in dieser App.',
    resetH: 'Neu anfangen',
    resetBtn: 'Fortschritt zurücksetzen',
    resetSure: 'Zum Zurücksetzen noch mal drücken',
    resetDone: 'Fortschritt zurückgesetzt.',
  },
  ne: {
    name: 'क ख ग',
    tagline: 'नेपाली अक्षर पढ्न र लेख्न सिकौँ',
    mascot: 'हाब्रे (रातो पाण्डा)',
    langLabel: 'सहायक भाषा',
    soundOn: 'आवाज खुला',
    soundOff: 'आवाज बन्द',
    starsLabel: (n) => `${n} तारा`,
    streakLabel: (n) => `लगातार ${n} दिन`,
    tabsLabel: 'एपका भागहरू',
    tabs: { letters: 'अक्षर', trace: 'लेखौँ', games: 'खेल', stickers: 'स्टिकर' },
    hello: (n) => `नमस्ते, ${n}!`,
    helloNobody: 'नमस्ते!',

    vowels: 'स्वर',
    consonants: 'व्यञ्जन',
    tapHint: 'सुन्न अक्षरमा थिच।',
    noVoice: 'तपाईंको उपकरणमा नेपाली आवाज छैन — अक्षर हेरेर सँगै भन्नुहोस्।',
    noSpeech: 'यो ब्राउजर बोल्न सक्दैन — अक्षर हेरेर सँगै भन्नुहोस्।',
    hiVoice: 'हिन्दी आवाज प्रयोग हुँदैछ (उही लिपि, मिल्दोजुल्दो उच्चारण)।',
    sayTogether: 'सँगै भनौँ:',
    listen: 'फेरि सुन',
    traceIt: 'लेखौँ',
    close: 'बन्द',
    prev: 'अघिल्लो अक्षर',
    next: 'अर्को अक्षर',
    insideNote: (c) => `${c} बाट कुनै शब्द सुरु हुँदैन — शब्दभित्र खोज।`,
    meaning: () => '',
    starsOf: (n) => `३ मध्ये ${n} तारा`,

    traceH: 'लेखौँ',
    traceSub: 'औँलाले अक्षरमाथि लेख।',
    pickLetter: 'अक्षर छान',
    clear: 'मेटाऊ',
    showMe: 'देखाऊ',
    done: 'सकियो',
    drawHere: (c) => `${c} अक्षर लेख्ने ठाउँ`,
    traceResult: { 0: 'एक पटक फेरि गरौँ!', 1: 'राम्रो सुरुवात!', 2: 'धेरै राम्रो!', 3: 'स्याबास!' },
    hintMore: 'अक्षरको अझ धेरै भागमा लेख।',
    hintInside: 'अक्षरमाथि नै रहने कोसिस गर।',
    tryAgain: 'फेरि गरौँ',
    nextLetter: 'अर्को अक्षर',
    coverage: (c, o) => `अक्षरमाथि: ${c}% · बाहिर: ${o}%`,

    gamesH: 'खेल',
    gamesSub: 'तीनवटा सानो खेल। हरेक पूरा चरणले स्टिकर किताब भर्छ।',
    games: {
      find: { name: 'अक्षर खोज', how: 'सही अक्षर भएको बेलुन फुटाऊ।' },
      match: { name: 'चित्र मिलाऊ', how: 'हरेक अक्षरलाई त्यसको चित्रमा तान — वा एउटा थिचेर अर्को थिच।' },
      build: { name: 'शब्द बनाऊ', how: 'टुक्राहरू क्रमैसँग राखेर शब्द बनाऊ।' },
    },
    back: 'खेलहरूमा फर्क',
    round: (a, b) => `${b} मध्ये ${a}`,
    findAsk: 'यो अक्षर खोज:',
    voiceH: 'यो उपकरणको आवाज',
    voice: { ne: 'नेपाली', hi: 'हिन्दी (नेपाली आवाज भेटिएन)', none: 'छैन — हेरेर भन्ने तरिका', unsupported: 'यो ब्राउजर बोल्न सक्दैन — हेरेर भन्ने तरिका', unknown: 'अझै जाँचिएको छैन' },
    findListen: 'अक्षर सुन',
    matchAsk: 'कुन चित्र यो अक्षरबाट सुरु हुन्छ?',
    matchTapHint: 'पहिले अक्षर, अनि त्यसको चित्र थिच।',
    matched: 'मिल्यो!',
    buildAsk: 'यो शब्द बनाऊ:',
    buildTapHint: 'टुक्राहरू क्रमैसँग थिच। राखिसकेको टुक्रा थिचे फिर्ता आउँछ।',
    buildUndo: 'फिर्ता',
    buildWrong: 'अझै मिलेन — अर्को क्रममा राखेर हेर।',
    wellDone: 'स्याबास!',
    wellDoneName: (n) => `स्याबास, ${n}!`,
    roundWon: (n) => `स्टिकर किताबका लागि +${n}`,
    playAgain: 'फेरि खेलौँ',
    otherGames: 'अरू खेल',
    wrongTry: 'अर्को प्रयास गर',

    stickersH: 'स्टिकर किताब',
    stickersSub: 'लेखेर पाएका तारा र पूरा गरेका खेलले हाब्रेका स्टिकर ल्याउँछन्।',
    stickerNext: (n) => `अर्को स्टिकरसम्म अझै ${n}`,
    stickerFull: 'पूरै किताब भरियो — गजब!',
    stickerNew: 'नयाँ स्टिकर!',
    stickerNames: {
      hello: 'नमस्ते!',
      topi: 'ढाका टोपी',
      kite: 'चङ्गा उडाऔँ',
      book: 'पढ्ने बेला',
      momo: 'मःमको खाना',
      star: 'तारा विद्यार्थी',
      madal: 'मादलको ताल',
      balloon: 'बेलुन यात्रा',
      garland: 'सयपत्रीको माला',
      mountain: 'हिमाल चढौँ',
      moon: 'शुभरात्रि',
      crown: 'अक्षर च्याम्पियन',
    },
    locked: 'अझै छैन',

    parentBtn: 'अभिभावक',
    parentHold: '२ सेकेन्ड थिचिराख्नुहोस्',
    parentH: 'अभिभावक कुना',
    parentSub: 'सबै कुरा यही उपकरणमा रहन्छ। केही पठाइँदैन, खाता छैन।',
    childName: 'बच्चाको पहिलो नाम (ऐच्छिक)',
    childNameHint: '“स्याबास” भन्नका लागि मात्र — यही उपकरणमा रहन्छ।',
    helperLang: 'अक्षर वरिपरिका शब्दहरूको सहायक भाषा',
    progressH: 'प्रगति',
    statLetters: (n) => `४९ मध्ये ${n} अक्षर लेखियो`,
    statStars: (n) => `लेखेर पाएका ${n} तारा`,
    statStickers: (n) => `१२ मध्ये ${n} स्टिकर`,
    statStreak: (n) => `लगातार ${n} दिन`,
    statGames: (n) => `${n} खेल चरण पूरा`,
    letterTable: 'अक्षरअनुसार तारा',
    privacy: 'बोली यही उपकरणमा भएका आवाज मात्र प्रयोग गर्छ। यो एपमा कुनै डेटा सङ्कलन वा ट्र्याकिङ छैन।',
    resetH: 'फेरि सुरु',
    resetBtn: 'सबै प्रगति मेटाउनुहोस्',
    resetSure: 'मेटाउन फेरि थिच्नुहोस्',
    resetDone: 'प्रगति मेटाइयो।',
  },
};

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
  pairs: string;
  free: string;
};

export const FRAME: Record<Lang, Frame> = {
  en: {
    badge: 'Demo project',
    text: 'Built by MartNepali · a demo learning app, nothing is sent',
    all: '← All demos',
    kicker: 'MartNepali Studio · Demo project',
    endH: 'Want a learning app for your school or language class?',
    endP: 'For a Nepali Saturday school, a language class or a culture group: letters with pictures and sound, tracing with stars, little games and a sticker book — in the helper languages your families speak at home.',
    points: ['Tracing with stars', 'Games and a sticker book', 'English, Deutsch, नेपाली'],
    talk: 'Kura garau',
    more: 'See all our work',
    pairs: 'Pairs well with the class booking app →',
    free: 'Free while we grow.',
  },
  de: {
    badge: 'Demo-Projekt',
    text: 'Gebaut von MartNepali · eine Demo-Lern-App, nichts wird verschickt',
    all: '← Alle Demos',
    kicker: 'MartNepali Studio · Demo-Projekt',
    endH: 'Eine Lern-App für eure Schule oder euren Sprachkurs?',
    endP: 'Für eine nepalische Samstagsschule, einen Sprachkurs oder einen Kulturverein: Buchstaben mit Bild und Ton, Nachfahren mit Sternen, kleine Spiele und ein Stickerbuch — in den Hilfssprachen, die eure Familien zu Hause sprechen.',
    points: ['Nachfahren mit Sternen', 'Spiele und Stickerbuch', 'English, Deutsch, नेपाली'],
    talk: 'Kura garau',
    more: 'Alle unsere Arbeiten',
    pairs: 'Passt gut zur App für Kursbuchungen →',
    free: 'Kostenlos, solange wir wachsen.',
  },
  ne: {
    badge: 'डेमो परियोजना',
    text: 'MartNepali ले बनाएको · डेमो सिकाइ एप, केही पनि पठाइँदैन',
    all: '← सबै डेमो',
    kicker: 'MartNepali स्टुडियो · डेमो परियोजना',
    endH: 'आफ्नो विद्यालय वा भाषा कक्षाका लागि सिकाइ एप चाहिन्छ?',
    endP: 'शनिबार चल्ने नेपाली विद्यालय, भाषा कक्षा वा सांस्कृतिक समूहका लागि: चित्र र आवाजसहित अक्षर, तारासहित लेखाइ, साना खेल र स्टिकर किताब — परिवारले घरमा बोल्ने सहायक भाषामा।',
    points: ['तारासहित लेखाइ', 'खेल र स्टिकर किताब', 'English, Deutsch, नेपाली'],
    talk: 'Kura garau',
    more: 'हाम्रा सबै काम',
    pairs: 'कक्षा बुकिङ एपसँग राम्रोसँग मिल्छ →',
    free: 'हामी बढ्दै गर्दा निःशुल्क।',
  },
};
