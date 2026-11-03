// Everything the demo quiz says, in English and नेपाली: the questions (with the
// right answer and a short "did you know"), the made-up players in the room and
// the copy of the big screen, the phone and the host bar.
//
// The questions stay on safe, well-known ground — festivals, food, mountains,
// instruments, the script, life abroad — and every fact here is one you can
// check in any encyclopedia. The players are invented nicknames, not people.

export type QuizLang = 'en' | 'ne';

export type Question = {
  /** Index (0–3) of the right answer — the same in both languages. */
  correct: number;
  /** 0 = everyone knows it, 1 = only the quiz nerd at the back does. Steers the simulated players. */
  difficulty: number;
  en: { cat: string; q: string; a: [string, string, string, string]; fact: string };
  ne: { cat: string; q: string; a: [string, string, string, string]; fact: string };
};

export const QUESTIONS: Question[] = [
  {
    correct: 1,
    difficulty: 0.1,
    en: {
      cat: 'Festivals',
      q: 'Tika and jamara are the blessings of which festival?',
      a: ['Tihar', 'Dashain', 'Holi', 'Teej'],
      fact: 'On Vijaya Dashami, elders give tika and jamara — barley shoots grown since the first day, Ghatasthapana.',
    },
    ne: {
      cat: 'चाडपर्व',
      q: 'टीका र जमरा कुन चाडको आशीर्वाद हो?',
      a: ['तिहार', 'दशैँ', 'होली', 'तीज'],
      fact: 'विजया दशमीमा ठूलाबडाले टीका र घटस्थापनादेखि उमारिएको जमरा लगाइदिनुहुन्छ।',
    },
  },
  {
    correct: 3,
    difficulty: 0.35,
    en: {
      cat: 'Festivals',
      q: 'On the second day of Tihar, which animal gets a garland and a feast?',
      a: ['Crow', 'Cow', 'Ox', 'Dog'],
      fact: 'Kag Tihar honours crows, Kukur Tihar dogs — then come cows, oxen and Bhai Tika.',
    },
    ne: {
      cat: 'चाडपर्व',
      q: 'तिहारको दोस्रो दिन कुन जनावरलाई माला लगाएर मीठो खाना दिइन्छ?',
      a: ['काग', 'गाई', 'गोरु', 'कुकुर'],
      fact: 'काग तिहारमा कागको, कुकुर तिहारमा कुकुरको पूजा हुन्छ — त्यसपछि गाई, गोरु र भाइटीका।',
    },
  },
  {
    correct: 2,
    difficulty: 0.15,
    en: {
      cat: 'Geography',
      q: 'What is Mount Everest called in Nepali?',
      a: ['Annapurna', 'Kanchenjunga', 'Sagarmatha', 'Machhapuchhre'],
      fact: 'Sagarmatha is 8,848.86 m tall — the height Nepal and China announced together in 2020.',
    },
    ne: {
      cat: 'भूगोल',
      q: 'संसारको सबैभन्दा अग्लो हिमाललाई नेपालीमा के भनिन्छ?',
      a: ['अन्नपूर्ण', 'कञ्चनजङ्घा', 'सगरमाथा', 'माछापुच्छ्रे'],
      fact: 'सगरमाथाको उचाइ ८,८४८.८६ मिटर — नेपाल र चीनले सन् २०२० मा सँगै घोषणा गरेका।',
    },
  },
  {
    correct: 0,
    difficulty: 0.1,
    en: {
      cat: 'Music',
      q: 'What kind of instrument is the madal?',
      a: ['A hand drum', 'A bamboo flute', 'A string instrument', 'Brass cymbals'],
      fact: 'The two-headed madal keeps the beat of Nepali folk songs — and you play it with your hands.',
    },
    ne: {
      cat: 'सङ्गीत',
      q: 'मादल कस्तो बाजा हो?',
      a: ['हातले बजाउने ढोल', 'बाँसको बाँसुरी', 'तारवाला बाजा', 'पित्तलको झ्याली'],
      fact: 'दुवैतिर छाला भएको मादल हातले बजाइन्छ — नेपाली लोकगीतको ताल यसैले दिन्छ।',
    },
  },
  {
    correct: 2,
    difficulty: 0.15,
    en: {
      cat: 'Symbols',
      q: 'What makes Nepal’s flag one of a kind?',
      a: ['It has five stars', 'It is green and gold', 'It is not a rectangle', 'It is perfectly square'],
      fact: 'Two stacked pennants with a moon and a sun: the only national flag that is not a rectangle.',
    },
    ne: {
      cat: 'राष्ट्रिय प्रतीक',
      q: 'नेपालको झण्डा संसारमै किन अनौठो छ?',
      a: ['यसमा पाँचवटा तारा छन्', 'यो हरियो र सुनौलो छ', 'यो आयताकार होइन', 'यो पूरै वर्गाकार छ'],
      fact: 'चन्द्र र सूर्य भएका दुई त्रिकोण एकमाथि अर्को — आयताकार नभएको एक मात्र राष्ट्रिय झण्डा।',
    },
  },
  {
    correct: 0,
    difficulty: 0.3,
    en: {
      cat: 'Food',
      q: 'What is gundruk?',
      a: ['Fermented, dried leafy greens', 'A rice-flour ring bread', 'Hard yak-milk cheese', 'Sweet rice pudding'],
      fact: 'Mustard or radish leaves, fermented and dried in the sun — gundruk soup with rice is pure comfort.',
    },
    ne: {
      cat: 'खानपान',
      q: 'गुन्द्रुक के हो?',
      a: ['कुहाएर सुकाइएको सागपात', 'चामलको पीठोको गोलो रोटी', 'चौँरीको दूधको कडा चिज', 'दूध र चामलको गुलियो परिकार'],
      fact: 'तोरी वा मुलाको पात कुहाएर घाममा सुकाइन्छ — भातसँग गुन्द्रुकको झोल कति मीठो!',
    },
  },
  {
    correct: 3,
    difficulty: 0.1,
    en: {
      cat: 'Language',
      q: 'Which script is Nepali written in?',
      a: ['Latin', 'Arabic', 'Cyrillic', 'Devanagari'],
      fact: 'Devanagari — the same script Hindi, Marathi and Sanskrit are written in.',
    },
    ne: {
      cat: 'भाषा',
      q: 'नेपाली भाषा कुन लिपिमा लेखिन्छ?',
      a: ['रोमन', 'अरबी', 'सिरिलिक', 'देवनागरी'],
      fact: 'देवनागरी — हिन्दी, मराठी र संस्कृत पनि यही लिपिमा लेखिन्छन्।',
    },
  },
  {
    correct: 1,
    difficulty: 0.55,
    en: {
      cat: 'Geography',
      q: 'Which is the largest lake in Nepal?',
      a: ['Phewa', 'Rara', 'Tilicho', 'Begnas'],
      fact: 'Rara Lake in Mugu covers about 10.8 km², nearly 3,000 m above the sea.',
    },
    ne: {
      cat: 'भूगोल',
      q: 'नेपालको सबैभन्दा ठूलो ताल कुन हो?',
      a: ['फेवा', 'रारा', 'तिलिचो', 'बेगनास'],
      fact: 'मुगुको रारा ताल करिब १०.८ वर्ग किलोमिटरमा फैलिएको छ, झन्डै ३,००० मिटरको उचाइमा।',
    },
  },
  {
    correct: 3,
    difficulty: 0.35,
    en: {
      cat: 'Music',
      q: 'How do you play a Nepali sarangi?',
      a: ['With two sticks', 'By blowing into it', 'With your feet on pedals', 'With a bow'],
      fact: 'Carved from a single piece of wood and played with a bow — the instrument of the Gandharva singers.',
    },
    ne: {
      cat: 'सङ्गीत',
      q: 'नेपाली सारङ्गी कसरी बजाइन्छ?',
      a: ['दुईवटा लौरोले ठोकेर', 'फुकेर', 'खुट्टाले पेडल चलाएर', 'गजले रेटेर'],
      fact: 'एउटै काठ खोपेर बनाइने सारङ्गी गजले बजाइन्छ — गन्धर्व गायकहरूको बाजा।',
    },
  },
  {
    correct: 2,
    difficulty: 0.25,
    en: {
      cat: 'Life abroad',
      q: 'Your German colleague asks when Dashain is. It usually falls in…',
      a: ['March – April', 'June – July', 'September – October', 'December – January'],
      fact: 'Dashain follows the lunar calendar, so the date moves every year — but it always lands in autumn.',
    },
    ne: {
      cat: 'प्रवास',
      q: 'जर्मन सहकर्मीले दशैँ कहिले हो भनेर सोध्छन्। दशैँ प्रायः कुन महिनामा पर्छ?',
      a: ['मार्च – अप्रिल', 'जुन – जुलाई', 'सेप्टेम्बर – अक्टोबर', 'डिसेम्बर – जनवरी'],
      fact: 'दशैँ तिथि अनुसार पर्ने भएकाले मिति हरेक वर्ष सर्छ — तर सधैँ शरद ऋतुमै पर्छ।',
    },
  },
];

/** The simulated room: invented nicknames, an emoji avatar, a colour and how often they get it right. */
export type BotSeed = { id: string; name: string; avatar: string; hue: number; skill: number };

export const BOTS: BotSeed[] = [
  { id: 'b1', name: 'MomoKing', avatar: '🥟', hue: 12, skill: 0.82 },
  { id: 'b2', name: 'DalBhatPower', avatar: '🍛', hue: 38, skill: 0.72 },
  { id: 'b3', name: 'Frankfurt Didi', avatar: '🥨', hue: 330, skill: 0.78 },
  { id: 'b4', name: 'Berlin Bhai', avatar: '🐻', hue: 210, skill: 0.55 },
  { id: 'b5', name: 'KiteFighter', avatar: '🪁', hue: 190, skill: 0.62 },
  { id: 'b6', name: 'ChiyaBreak', avatar: '☕', hue: 25, skill: 0.5 },
  { id: 'b7', name: 'AcharAunty', avatar: '🌶️', hue: 355, skill: 0.68 },
  { id: 'b8', name: 'Schengen Sathi', avatar: '🚆', hue: 260, skill: 0.45 },
  { id: 'b9', name: 'SelRotiQueen', avatar: '🍩', hue: 300, skill: 0.7 },
];

/** Avatars the visitor can cycle through on the phone. */
export const MY_AVATARS = ['🐯', '🦚', '🏔️', '🐘', '🪷', '🥁', '🎈', '🦋'];
export const MY_HUE = 150;

const NE_DIGITS = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
export function toNeDigits(s: string | number): string {
  return String(s).replace(/[0-9]/g, (d) => NE_DIGITS[Number(d)]);
}
/** A number the way the current language writes it (thousands separated, नेपाली digits). */
export function num(n: number, lang: QuizLang): string {
  const s = Math.round(n).toLocaleString('en-US');
  return lang === 'ne' ? toNeDigits(s) : s;
}

export const COPY = {
  en: {
    eventName: 'Dashain Sanjh · Quiz Night',
    demoTitle: 'Quiz night: a big screen and everyone’s phone',
    intro:
      'Press Start under the big screen and answer on the phone. Everyone else in the room is simulated — play a whole game in about four minutes.',
    views: { big: 'Big screen', phone: 'Phone', both: 'Both side by side' },
    viewLabel: 'What to show',
    scan: 'Scan to play',
    room: 'Room',
    waiting: 'Waiting for players…',
    players: (n: string) => `${n} players`,
    hostControls: 'Host controls',
    start: 'Start',
    next: 'Next',
    pause: 'Pause',
    resume: 'Resume',
    restart: 'Restart',
    soundOn: 'Sound on',
    soundOff: 'Sound off',
    hostHint: 'Rounds move on by themselves — Next skips ahead.',
    hostHintLobby: 'Join on the phone, then press Start.',
    hostHintEnd: 'Game over — Restart for another round.',
    questionOf: (i: string, n: string) => `Question ${i} of ${n}`,
    qShort: (i: string, n: string) => `${i}/${n}`,
    getReady: 'Get ready…',
    answersIn: 'answers',
    timeUp: 'Time’s up!',
    didYouKnow: 'Did you know?',
    leaderboard: 'Leaderboard',
    afterQ: (i: string) => `after question ${i}`,
    podium: 'And the winners are…',
    thanks: 'Thanks for playing!',
    paused: 'Paused',
    pts: 'pts',
    you: 'you',
    shapes: ['Triangle', 'Diamond', 'Circle', 'Square'],
    // phone
    phoneApp: 'Quiz Night',
    nickLabel: 'Your nickname',
    nickPh: 'e.g. ChiyaLover',
    avatarHint: 'Tap the face to change it',
    join: 'Join the game',
    youreIn: 'You’re in!',
    seeYourName: 'Look up — your name is on the big screen.',
    startNow: 'Start the game',
    hostToo: 'In this demo you are the host too.',
    started: 'The game is on',
    locked: 'Answer locked in!',
    waitOthers: 'Waiting for the others…',
    correct: 'Correct!',
    wrong: 'Not this time',
    tooSlow: 'Too slow!',
    answerWas: 'The answer was',
    yourRank: 'Your place',
    of: (n: string) => `of ${n}`,
    behind: (pts: string, name: string) => `${pts} pts behind ${name}`,
    leading: 'You’re in the lead!',
    thisRound: 'this round',
    finished: 'You finished',
    totalScore: 'Total score',
    playAgain: 'Play again',
    guest: 'Guest',
  },
  ne: {
    eventName: 'दशैँ साँझ · क्विज नाइट',
    demoTitle: 'क्विज नाइट: ठूलो पर्दा र सबैको फोन',
    intro:
      'ठूलो पर्दामुनि “सुरु” थिच्नुहोस् र फोनबाट उत्तर दिनुहोस्। कोठाका अरू खेलाडी डेमोका लागि बनाइएका हुन् — पूरा खेल करिब चार मिनेटमा सकिन्छ।',
    views: { big: 'ठूलो पर्दा', phone: 'फोन', both: 'दुवै सँगै' },
    viewLabel: 'के देखाउने',
    scan: 'खेल्न स्क्यान गर्नुहोस्',
    room: 'कोठा',
    waiting: 'खेलाडी पर्खँदै…',
    players: (n: string) => `${n} खेलाडी`,
    hostControls: 'होस्टको नियन्त्रण',
    start: 'सुरु',
    next: 'अर्को',
    pause: 'रोक्नुहोस्',
    resume: 'चलाउनुहोस्',
    restart: 'फेरि सुरु',
    soundOn: 'आवाज खोल्नुहोस्',
    soundOff: 'आवाज बन्द गर्नुहोस्',
    hostHint: 'चरणहरू आफैँ अगाडि बढ्छन् — “अर्को” ले छिटो लैजान्छ।',
    hostHintLobby: 'फोनबाट सामेल हुनुहोस्, अनि “सुरु” थिच्नुहोस्।',
    hostHintEnd: 'खेल सकियो — अर्को पटकका लागि “फेरि सुरु” थिच्नुहोस्।',
    questionOf: (i: string, n: string) => `प्रश्न ${i} / ${n}`,
    qShort: (i: string, n: string) => `${i}/${n}`,
    getReady: 'तयार हुनुहोस्…',
    answersIn: 'उत्तर',
    timeUp: 'समय सकियो!',
    didYouKnow: 'थाहा छ?',
    leaderboard: 'अंक तालिका',
    afterQ: (i: string) => `प्रश्न ${i} पछि`,
    podium: 'अनि विजेता हुन्…',
    thanks: 'खेल्नुभएकोमा धन्यवाद!',
    paused: 'रोकिएको छ',
    pts: 'अंक',
    you: 'तपाईं',
    shapes: ['त्रिकोण', 'हीरा', 'गोलो', 'वर्ग'],
    phoneApp: 'क्विज नाइट',
    nickLabel: 'तपाईंको उपनाम',
    nickPh: 'जस्तै: ChiyaLover',
    avatarHint: 'अनुहार फेर्न थिच्नुहोस्',
    join: 'खेलमा सामेल हुनुहोस्',
    youreIn: 'तपाईं सामेल हुनुभयो!',
    seeYourName: 'माथि हेर्नुहोस् — ठूलो पर्दामा तपाईंको नाम छ।',
    startNow: 'खेल सुरु गर्नुहोस्',
    hostToo: 'यो डेमोमा होस्ट पनि तपाईं नै हो।',
    started: 'खेल सुरु भयो',
    locked: 'उत्तर पठाइयो!',
    waitOthers: 'अरूलाई पर्खँदै…',
    correct: 'सही!',
    wrong: 'यसपटक मिलेन',
    tooSlow: 'ढिलो भयो!',
    answerWas: 'सही उत्तर',
    yourRank: 'तपाईंको स्थान',
    of: (n: string) => `${n} जनामध्ये`,
    behind: (pts: string, name: string) => `${name} भन्दा ${pts} अंक पछाडि`,
    leading: 'तपाईं सबैभन्दा अगाडि हुनुहुन्छ!',
    thisRound: 'यो चरणमा',
    finished: 'तपाईंको अन्तिम स्थान',
    totalScore: 'जम्मा अंक',
    playAgain: 'फेरि खेल्नुहोस्',
    guest: 'पाहुना',
  },
} as const;

export type QuizCopy = (typeof COPY)[QuizLang];
