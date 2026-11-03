// Words for "Dui Kinara Radio" (/work/radio) in English, Deutsch and नेपाली:
// the made-up station, its shows and hosts, the demo tunes, the podcast
// episodes and every line of the interface. The rules (schedule, chapters,
// resume …) live in radio.ts.
//
// Everything here is invented: the station, the hosts (first names only,
// drawn avatars), the tunes (composed live in the browser by stream.ts), the
// listeners and the requests. Nothing here buys, sells or costs anything — the
// only line about it is the frame's "free while we grow" (FRAME.free); see
// tests/radioStation.test.ts and tests/studioWords.test.ts.

import type { HostId, Lang, ShowId } from './radio';

export type { Lang };
export type L = Record<Lang, string>;

export const LANGS: { id: Lang; label: string; short: string }[] = [
  { id: 'en', label: 'English', short: 'EN' },
  { id: 'de', label: 'Deutsch', short: 'DE' },
  { id: 'ne', label: 'नेपाली', short: 'ने' },
];
export function asRadioLang(v: unknown): Lang | null {
  return v === 'en' || v === 'de' || v === 'ne' ? v : null;
}

const NE_DIGITS = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
/** Digits in Devanagari for नेपाली, as they are. */
export function num(s: string | number, lang: Lang): string {
  const v = String(s);
  return lang === 'ne' ? v.replace(/[0-9]/g, (d) => NE_DIGITS[Number(d)]) : v;
}
/** 1234 → "1,234" / "1.234" / "१,२३४". */
export function count(n: number, lang: Lang): string {
  const s = String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, lang === 'de' ? '.' : ',');
  return num(s, lang);
}

export const STATION: L = { en: 'Dui Kinara Radio', de: 'Dui Kinara Radio', ne: 'दुई किनारा रेडियो' };

// ---------- shows and hosts ----------

export type Show = { name: L; hosts: HostId[]; blurb: L; hue: [string, string] };

export const SHOWS: Record<ShowId, Show> = {
  bihani: {
    name: { en: 'Bihani Sandesh', de: 'Bihani Sandesh', ne: 'बिहानी सन्देश' },
    hosts: ['asha'],
    blurb: {
      en: 'The morning show: greetings from listeners, the weather in Europe and Nepal, community notices.',
      de: 'Die Morgensendung: Grüße von Hörer:innen, das Wetter in Europa und Nepal, Neues aus der Community.',
      ne: 'बिहानको कार्यक्रम: श्रोताका शुभकामना, युरोप र नेपालको मौसम, समुदायका सूचना।',
    },
    hue: ['#ffb547', '#c2410c'],
  },
  bhajan: {
    name: { en: 'Shanti Bhajan', de: 'Shanti Bhajan', ne: 'शान्ति भजन' },
    hosts: ['rojan'],
    blurb: {
      en: 'Slow weekend mornings: devotional songs, a drone and a cup of tea.',
      de: 'Ruhige Wochenend-Morgen: Andachtslieder, ein Bordun und eine Tasse Tee.',
      ne: 'बिदाको शान्त बिहान: भजन, तानपुराको धुन र एक कप चिया।',
    },
    hue: ['#fcd34d', '#854d0e'],
  },
  geet: {
    name: { en: 'Lok Geet Hour', de: 'Lok Geet Hour', ne: 'लोकगीतको घण्टा' },
    hosts: ['rojan'],
    blurb: {
      en: 'An hour of folk songs from the hills, with the stories behind them.',
      de: 'Eine Stunde Volkslieder aus den Bergen, mit den Geschichten dahinter.',
      ne: 'पहाडका लोकगीत र तिनका पछाडिका कथासहित एक घण्टा।',
    },
    hue: ['#34d399', '#065f46'],
  },
  calling: {
    name: { en: 'Ghar Ko Khabar', de: 'Ghar Ko Khabar', ne: 'घरको खबर' },
    hosts: ['sabina'],
    blurb: {
      en: 'Word from home: a live line to listeners in Nepal — it is evening there when it is afternoon here.',
      de: 'Nachrichten von zu Hause: eine Live-Leitung zu Hörer:innen in Nepal — dort ist schon Abend, wenn hier Nachmittag ist.',
      ne: 'घरको खबर: नेपालका श्रोतासँग सिधा कुरा — यहाँ दिउँसो हुँदा त्यहाँ साँझ परिसकेको हुन्छ।',
    },
    hue: ['#60a5fa', '#1e3a8a'],
  },
  katha: {
    name: { en: 'Kids’ Katha', de: 'Kids’ Katha', ne: 'बाल कथा' },
    hosts: ['kamala'],
    blurb: {
      en: 'Stories in easy Nepali for children, with a song to sing along.',
      de: 'Geschichten in einfachem Nepali für Kinder, mit einem Lied zum Mitsingen.',
      ne: 'बालबालिकाका लागि सजिलो नेपालीमा कथा, सँगै गाउने गीतसहित।',
    },
    hue: ['#f472b6', '#9d174d'],
  },
  diaspora: {
    name: { en: 'Diaspora Talk', de: 'Diaspora Talk', ne: 'प्रवासी कुराकानी' },
    hosts: ['sabina', 'kiran'],
    blurb: {
      en: 'Life far from home: paperwork, work, family, and keeping Nepali alive at home.',
      de: 'Leben fern der Heimat: Behördengänge, Arbeit, Familie — und Nepali zu Hause lebendig halten.',
      ne: 'घरभन्दा टाढाको जीवन: कागजपत्र, काम, परिवार र घरमा नेपाली भाषा जोगाउने कुरा।',
    },
    hue: ['#a78bfa', '#4c1d95'],
  },
  sanjh: {
    name: { en: 'Saanjh Sangeet', de: 'Saanjh Sangeet', ne: 'साँझ सङ्गीत' },
    hosts: ['nabin'],
    blurb: {
      en: 'Evening music: modern songs, old favourites and new voices from the diaspora.',
      de: 'Abendmusik: moderne Lieder, alte Lieblinge und neue Stimmen aus der Diaspora.',
      ne: 'साँझको सङ्गीत: आधुनिक गीत, पुराना मनपर्ने गीत र प्रवासका नयाँ स्वर।',
    },
    hue: ['#fb923c', '#7c2d12'],
  },
  dohori: {
    name: { en: 'Friday Night Dohori', de: 'Friday Night Dohori', ne: 'शुक्रबार राति दोहोरी' },
    hosts: ['dipesh', 'sunita'],
    blurb: {
      en: 'Question-and-answer songs late into the night, with listeners joining the duel.',
      de: 'Frage-und-Antwort-Lieder bis spät in die Nacht — Hörer:innen machen beim Duell mit.',
      ne: 'राति अबेरसम्म सवाल-जवाफका गीत, श्रोता पनि जुहारीमा सामेल।',
    },
    hue: ['#f87171', '#7f1d1d'],
  },
  request: {
    name: { en: 'Farmaish Night', de: 'Farmaish Night', ne: 'फर्माइस रात' },
    hosts: ['nabin'],
    blurb: {
      en: 'Saturday request night: your songs and shout-outs, read on air.',
      de: 'Wunschabend am Samstag: eure Lieder und Grüße, live vorgelesen.',
      ne: 'शनिबारको फर्माइस रात: तपाईंका गीत र शुभकामना, रेडियोमै पढिन्छ।',
    },
    hue: ['#22d3ee', '#155e75'],
  },
  mix: {
    name: { en: 'Dui Kinara Mix', de: 'Dui Kinara Mix', ne: 'दुई किनारा मिक्स' },
    hosts: [],
    blurb: {
      en: 'Non-stop music between the shows.',
      de: 'Musik ohne Pause zwischen den Sendungen.',
      ne: 'कार्यक्रमका बीचमा नरोकिने सङ्गीत।',
    },
    hue: ['#818cf8', '#312e81'],
  },
};

export type AvatarLook = { skin: string; hair: string; style: 'short' | 'long' | 'bun' | 'curly' | 'cap' | 'braid'; bg: string; extra?: 'glasses' | 'tika' | 'earrings' | 'beard' };

export const HOSTS: Record<HostId, { name: L; look: AvatarLook }> = {
  asha: { name: { en: 'Asha', de: 'Asha', ne: 'आशा' }, look: { skin: '#c68a5e', hair: '#1f1410', style: 'long', bg: '#ffd9a0', extra: 'earrings' } },
  rojan: { name: { en: 'Rojan', de: 'Rojan', ne: 'रोजन' }, look: { skin: '#b97a50', hair: '#231814', style: 'cap', bg: '#bff0d8' } },
  sabina: { name: { en: 'Sabina', de: 'Sabina', ne: 'सबिना' }, look: { skin: '#d49a6a', hair: '#2a1a12', style: 'bun', bg: '#cfe0ff', extra: 'glasses' } },
  kiran: { name: { en: 'Kiran', de: 'Kiran', ne: 'किरण' }, look: { skin: '#a86f48', hair: '#17110e', style: 'short', bg: '#e3d6ff', extra: 'beard' } },
  kamala: { name: { en: 'Kamala Didi', de: 'Kamala Didi', ne: 'कमला दिदी' }, look: { skin: '#c99068', hair: '#3a2a22', style: 'braid', bg: '#ffd1e6', extra: 'tika' } },
  dipesh: { name: { en: 'Dipesh', de: 'Dipesh', ne: 'दिपेश' }, look: { skin: '#b07650', hair: '#120c0a', style: 'curly', bg: '#ffc9c9' } },
  sunita: { name: { en: 'Sunita', de: 'Sunita', ne: 'सुनिता' }, look: { skin: '#c78d63', hair: '#1c120e', style: 'long', bg: '#ffe0b8', extra: 'tika' } },
  nabin: { name: { en: 'Nabin', de: 'Nabin', ne: 'नबिन' }, look: { skin: '#bd8058', hair: '#21160f', style: 'short', bg: '#c4f1f9', extra: 'glasses' } },
};

/** "Asha" · "Sabina & Kiran" · "the house band" for the mix. */
export function hostLine(show: ShowId, lang: Lang): string {
  const hs = SHOWS[show].hosts.map((h) => HOSTS[h].name[lang]);
  if (!hs.length) return COPY[lang].houseBand;
  return hs.join(lang === 'ne' ? ' र ' : lang === 'de' ? ' & ' : ' & ');
}

// ---------- the station's demo tunes (composed live, see radio.ts) ----------

export const TUNES: L[] = [
  { en: 'Pahadi Hawa', de: 'Pahadi Hawa', ne: 'पहाडी हावा' },
  { en: 'Kinara Paari', de: 'Kinara Paari', ne: 'किनारापारि' },
  { en: 'Saanjhko Batti', de: 'Saanjhko Batti', ne: 'साँझको बत्ती' },
  { en: 'Madal ra Megh', de: 'Madal ra Megh', ne: 'मादल र मेघ' },
  { en: 'Lekali Bato', de: 'Lekali Bato', ne: 'लेकाली बाटो' },
  { en: 'Hiundko Ghaam', de: 'Hiundko Ghaam', ne: 'हिउँदको घाम' },
  { en: 'Taara Gandai', de: 'Taara Gandai', ne: 'तारा गन्दै' },
  { en: 'Ghar Tira', de: 'Ghar Tira', ne: 'घरतिर' },
];

// ---------- podcast episodes ----------

export type Episode = {
  id: string;
  show: ShowId;
  n: number;
  /** Published (made up), YYYY-MM-DD. */
  date: string;
  /** Length in seconds. */
  dur: number;
  title: L;
  desc: L;
  notes: L[];
  chapters: { at: number; title: L }[];
};

export const EPISODES: Episode[] = [
  {
    id: 'morning-best',
    show: 'bihani',
    n: 48,
    date: '2026-10-30',
    dur: 1110,
    title: { en: 'The best of the week', de: 'Das Beste der Woche', ne: 'हप्ताका उत्कृष्ट अंश' },
    desc: {
      en: 'Asha’s favourite moments from five mornings: greetings from listeners in five countries, aloo tama on a cold day and the community notice board.',
      de: 'Ashas Lieblingsmomente aus fünf Morgensendungen: Grüße aus fünf Ländern, Aloo Tama an einem kalten Tag und das Schwarze Brett der Community.',
      ne: 'पाँच बिहानका आशाका मनपर्ने क्षण: पाँच देशबाट श्रोताका शुभकामना, जाडो दिनमा आलु तामा र समुदायको सूचना पाटी।',
    },
    notes: [
      { en: 'Greetings from Lisbon, Leipzig, Lyon, Linz and Leuven', de: 'Grüße aus Lissabon, Leipzig, Lyon, Linz und Löwen', ne: 'लिस्बन, लाइपजिग, लियोन, लिन्ज र लुभेनबाट शुभकामना' },
      { en: 'Aloo tama, the way Asha’s neighbour makes it', de: 'Aloo Tama, so wie Ashas Nachbarin es kocht', ne: 'आशाकी छिमेकीले बनाउने तरिकाको आलु तामा' },
      { en: 'Community notices: language classes, a walking group, a lost scarf', de: 'Aus der Community: Sprachkurse, eine Wandergruppe, ein verlorener Schal', ne: 'समुदायका सूचना: भाषा कक्षा, हिँड्ने समूह, हराएको मफलर' },
    ],
    chapters: [
      { at: 0, title: { en: 'Good morning', de: 'Guten Morgen', ne: 'शुभ प्रभात' } },
      { at: 120, title: { en: 'Greetings from five countries', de: 'Grüße aus fünf Ländern', ne: 'पाँच देशबाट शुभकामना' } },
      { at: 420, title: { en: 'Aloo tama on a cold morning', de: 'Aloo Tama an einem kalten Morgen', ne: 'जाडो बिहानको आलु तामा' } },
      { at: 780, title: { en: 'Community notices', de: 'Neues aus der Community', ne: 'समुदायका सूचना' } },
      { at: 1000, title: { en: 'A song for the road', de: 'Ein Lied für unterwegs', ne: 'बाटोको लागि एउटा गीत' } },
    ],
  },
  {
    id: 'home-language',
    show: 'diaspora',
    n: 14,
    date: '2026-10-28',
    dur: 1470,
    title: { en: 'Keeping Nepali at home', de: 'Nepali zu Hause lebendig halten', ne: 'घरमा नेपाली भाषा जोगाउँदै' },
    desc: {
      en: 'Sabina and Kiran talk with three families whose children answer in German: Saturday schools, bedtime stories and video calls with hajurba and hajurama.',
      de: 'Sabina und Kiran sprechen mit drei Familien, deren Kinder auf Deutsch antworten: Samstagsschulen, Gutenachtgeschichten und Videoanrufe mit Hajurba und Hajurama.',
      ne: 'जर्मनमा जवाफ फर्काउने बालबालिका भएका तीन परिवारसँग सबिना र किरणको कुराकानी: शनिबारे विद्यालय, सुत्ने बेलाका कथा र हजुरबा-हजुरआमासँग भिडियो कल।',
    },
    notes: [
      { en: 'Small daily habits do more than big plans', de: 'Kleine tägliche Gewohnheiten bewirken mehr als große Pläne', ne: 'ठूला योजनाभन्दा दैनिकका साना बानीले बढी काम गर्छन्' },
      { en: 'Stories in Nepali, homework in German — both are fine', de: 'Geschichten auf Nepali, Hausaufgaben auf Deutsch — beides ist gut', ne: 'कथा नेपालीमा, गृहकार्य जर्मनमा — दुवै ठीक छ' },
      { en: 'Listener tip: label things around the house in Devanagari', de: 'Tipp aus der Hörerschaft: Dinge im Haus auf Devanagari beschriften', ne: 'श्रोताको सुझाव: घरका सामानमा देवनागरीमा नाम टाँस्नुहोस्' },
    ],
    chapters: [
      { at: 0, title: { en: 'Welcome', de: 'Willkommen', ne: 'स्वागत' } },
      { at: 150, title: { en: 'Why children switch languages', de: 'Warum Kinder die Sprache wechseln', ne: 'बालबालिकाले किन भाषा बदल्छन्' } },
      { at: 520, title: { en: 'Three families, three ways', de: 'Drei Familien, drei Wege', ne: 'तीन परिवार, तीन तरिका' } },
      { at: 980, title: { en: 'Saturday schools and stories', de: 'Samstagsschulen und Geschichten', ne: 'शनिबारे विद्यालय र कथा' } },
      { at: 1310, title: { en: 'Listener tips and goodbye', de: 'Tipps aus der Hörerschaft und Tschüss', ne: 'श्रोताका सुझाव र बिदाइ' } },
    ],
  },
  {
    id: 'frog-rain',
    show: 'katha',
    n: 9,
    date: '2026-10-25',
    dur: 760,
    title: { en: 'The frog who sang for rain', de: 'Der Frosch, der den Regen rief', ne: 'पानी बोलाउने भ्यागुतो' },
    desc: {
      en: 'Kamala Didi tells a new story: a little frog in a dry hill village sings and sings until the monsoon clouds come home.',
      de: 'Kamala Didi erzählt eine neue Geschichte: Ein kleiner Frosch in einem trockenen Bergdorf singt und singt, bis die Monsunwolken heimkehren.',
      ne: 'कमला दिदीको नयाँ कथा: सुख्खा पहाडी गाउँको सानो भ्यागुतो बादल घर नफर्केसम्म गाइरहन्छ।',
    },
    notes: [
      { en: 'For children aged about 4 to 9', de: 'Für Kinder von etwa 4 bis 9', ne: 'करिब ४ देखि ९ वर्षका बालबालिकाका लागि' },
      { en: 'A chorus to sing along: “Paani aau, paani aau!”', de: 'Ein Refrain zum Mitsingen: „Paani aau, paani aau!“', ne: 'सँगै गाउने भाका: “पानी आऊ, पानी आऊ!”' },
      { en: 'New words: बादल (cloud), पोखरी (pond), इन्द्रेणी (rainbow)', de: 'Neue Wörter: बादल (Wolke), पोखरी (Teich), इन्द्रेणी (Regenbogen)', ne: 'नयाँ शब्द: बादल, पोखरी, इन्द्रेणी' },
    ],
    chapters: [
      { at: 0, title: { en: 'Hello, children', de: 'Hallo, Kinder', ne: 'नमस्ते, नानीहरू' } },
      { at: 90, title: { en: 'The dry village', de: 'Das trockene Dorf', ne: 'सुख्खा गाउँ' } },
      { at: 300, title: { en: 'The frog’s song', de: 'Das Lied des Froschs', ne: 'भ्यागुतोको गीत' } },
      { at: 560, title: { en: 'Rain!', de: 'Regen!', ne: 'पानी पर्‍यो!' } },
      { at: 690, title: { en: 'Today’s new words', de: 'Die neuen Wörter von heute', ne: 'आजका नयाँ शब्द' } },
    ],
  },
  {
    id: 'madal-time',
    show: 'geet',
    n: 22,
    date: '2026-10-21',
    dur: 1930,
    title: { en: 'What the madal keeps time for', de: 'Wofür die Madal den Takt hält', ne: 'मादलले कसको ताल समात्छ' },
    desc: {
      en: 'Rojan on the drum at the heart of folk songs: the low stroke and the slapped one, the 6/8 lilt, and how to play along on a kitchen table.',
      de: 'Rojan über die Trommel im Herzen der Volkslieder: der tiefe und der geklatschte Schlag, der 6/8-Schwung — und wie man auf dem Küchentisch mitspielt.',
      ne: 'लोकगीतको मुटु मादलबारे रोजन: गहिरो र थप्पडे बोल, ६/८ को लय, अनि भान्साको टेबलमै कसरी बजाउने।',
    },
    notes: [
      { en: 'Dhin and ta: the two strokes everything is built from', de: 'Dhin und Ta: die zwei Schläge, aus denen alles entsteht', ne: 'धिन र ता: सबै तालको जग बनाउने दुई बोल' },
      { en: 'Why so many hill songs sway in six', de: 'Warum so viele Lieder aus den Bergen in Sechs schwingen', ne: 'धेरै पहाडी गीत किन छ मात्रामा झुम्छन्' },
      { en: 'Three demo tunes from the Dui Kinara house band', de: 'Drei Demo-Stücke der Dui-Kinara-Hausband', ne: 'दुई किनारा हाउस ब्यान्डका तीन डेमो धुन' },
    ],
    chapters: [
      { at: 0, title: { en: 'Intro', de: 'Intro', ne: 'सुरुवात' } },
      { at: 240, title: { en: 'Two strokes: dhin and ta', de: 'Zwei Schläge: Dhin und Ta', ne: 'दुई बोल: धिन र ता' } },
      { at: 700, title: { en: 'The 6/8 lilt', de: 'Der 6/8-Schwung', ne: '६/८ को लय' } },
      { at: 1180, title: { en: 'Play along on a table', de: 'Auf dem Tisch mitspielen', ne: 'टेबलमा सँगै बजाऔँ' } },
      { at: 1650, title: { en: 'Three demo tunes', de: 'Drei Demo-Stücke', ne: 'तीन डेमो धुन' } },
    ],
  },
  {
    id: 'first-winter',
    show: 'diaspora',
    n: 13,
    date: '2026-10-14',
    dur: 1685,
    title: { en: 'First winter in Europe', de: 'Der erste Winter in Europa', ne: 'युरोपमा पहिलो जाडो' },
    desc: {
      en: 'Short days, long nights and what helps: daylight, walks, warm food and calling home at an hour that suits both sides.',
      de: 'Kurze Tage, lange Nächte und was hilft: Tageslicht, Spaziergänge, warmes Essen und Anrufe nach Hause zu einer Uhrzeit, die beiden Seiten passt.',
      ne: 'छोटा दिन, लामा रात र के ले सघाउँछ: घाम, हिँडाइ, तातो खाना र दुवैतिर मिल्ने बेलामा घर फोन।',
    },
    notes: [
      { en: 'Get outside in the first hours of daylight', de: 'In den ersten Stunden Tageslicht nach draußen', ne: 'दिनको पहिलो घाममै बाहिर निस्कनुहोस्' },
      { en: 'Nepal is 4 h 45 min ahead in winter, 3 h 45 min in summer', de: 'Nepal ist im Winter 4 Std. 45 Min. voraus, im Sommer 3 Std. 45 Min.', ne: 'जाडोमा नेपाल ४ घण्टा ४५ मिनेट अगाडि, गर्मीमा ३ घण्टा ४५ मिनेट' },
      { en: 'A soup that tastes like home', de: 'Eine Suppe, die nach Zuhause schmeckt', ne: 'घरको स्वाद आउने झोल' },
    ],
    chapters: [
      { at: 0, title: { en: 'Welcome', de: 'Willkommen', ne: 'स्वागत' } },
      { at: 200, title: { en: 'When the days get short', de: 'Wenn die Tage kurz werden', ne: 'दिन छोटिँदा' } },
      { at: 640, title: { en: 'Food that warms', de: 'Essen, das wärmt', ne: 'न्यानो दिने खाना' } },
      { at: 1080, title: { en: 'Calling home across time zones', de: 'Anrufe nach Hause über Zeitzonen', ne: 'समय क्षेत्र पार गरेर घर फोन' } },
      { at: 1450, title: { en: 'Listener tips', de: 'Tipps aus der Hörerschaft', ne: 'श्रोताका सुझाव' } },
    ],
  },
  {
    id: 'dohori-duel',
    show: 'dohori',
    n: 31,
    date: '2026-10-09',
    dur: 1605,
    title: { en: 'How a dohori duel works', de: 'So funktioniert ein Dohori-Duell', ne: 'दोहोरी जुहारी कसरी चल्छ' },
    desc: {
      en: 'Dipesh and Sunita explain sawal-jawaf: a question in a verse, an answer in rhyme, and a crowd that decides who wins the round.',
      de: 'Dipesh und Sunita erklären Sawal-Jawaf: eine Frage in einer Strophe, eine Antwort im Reim — und das Publikum entscheidet die Runde.',
      ne: 'दिपेश र सुनिताले सवाल-जवाफ बुझाउँछन्: एक अन्तरामा प्रश्न, तुकबन्दीमा उत्तर, र कसले जित्यो दर्शकले छिन्छन्।',
    },
    notes: [
      { en: 'The question, the answer and the rhyme that has to land', de: 'Die Frage, die Antwort und der Reim, der sitzen muss', ne: 'प्रश्न, उत्तर र ठ्याक्कै मिल्नुपर्ने तुकबन्दी' },
      { en: 'How to make up a verse on the spot', de: 'Wie man eine Strophe aus dem Stegreif dichtet', ne: 'तत्कालै अन्तरा कसरी बनाउने' },
      { en: 'A demo round with the house band', de: 'Eine Demo-Runde mit der Hausband', ne: 'हाउस ब्यान्डसँग एक डेमो चरण' },
    ],
    chapters: [
      { at: 0, title: { en: 'Intro', de: 'Intro', ne: 'सुरुवात' } },
      { at: 180, title: { en: 'Question and answer', de: 'Frage und Antwort', ne: 'सवाल र जवाफ' } },
      { at: 560, title: { en: 'Rhyme on the spot', de: 'Reimen aus dem Stegreif', ne: 'तत्कालै तुकबन्दी' } },
      { at: 1000, title: { en: 'The crowd decides', de: 'Das Publikum entscheidet', ne: 'दर्शकको फैसला' } },
      { at: 1380, title: { en: 'A demo round', de: 'Eine Demo-Runde', ne: 'एक डेमो चरण' } },
    ],
  },
];

export function episodeById(id: string | null | undefined): Episode | null {
  return EPISODES.find((e) => e.id === id) ?? null;
}

// ---------- requests already "on air" (made up) ----------

export const SEED_REQUESTS: { id: string; kind: 'song' | 'shout'; name: string; town: L; tune: number | null; msg: L; host: HostId }[] = [
  {
    id: 'seed-1',
    kind: 'song',
    name: 'Sunil',
    town: { en: 'Leipzig', de: 'Leipzig', ne: 'लाइपजिग' },
    tune: 0,
    msg: { en: 'For my aama in Pokhara — she listens every Saturday.', de: 'Für meine Aama in Pokhara — sie hört jeden Samstag zu.', ne: 'पोखरामा हुनुहुने आमाका लागि — उहाँ हरेक शनिबार सुन्नुहुन्छ।' },
    host: 'nabin',
  },
  {
    id: 'seed-2',
    kind: 'shout',
    name: 'Mina',
    town: { en: 'Vienna', de: 'Wien', ne: 'भियना' },
    tune: null,
    msg: {
      en: 'A big shout-out to the Saturday school children — what a dance on Sunday!',
      de: 'Ein großer Gruß an die Kinder der Samstagsschule — was für ein Tanz am Sonntag!',
      ne: 'शनिबारे विद्यालयका नानीहरूलाई धेरै धेरै शुभकामना — आइतबारको नाच कस्तो राम्रो!',
    },
    host: 'asha',
  },
  {
    id: 'seed-3',
    kind: 'song',
    name: 'Rabin & Puja',
    town: { en: 'Lyon', de: 'Lyon', ne: 'लियोन' },
    tune: 5,
    msg: { en: 'Our first winter here. Play us something warm!', de: 'Unser erster Winter hier. Spielt uns etwas Warmes!', ne: 'यहाँ हाम्रो पहिलो जाडो। केही न्यानो धुन बजाइदिनुस्!' },
    host: 'nabin',
  },
];

// ---------- interface copy ----------

type S = (a: string) => string;
type S2 = (a: string, b: string) => string;

export type Copy = {
  tagline: string;
  madeUp: string;
  langLabel: string;
  nav: { live: string; schedule: string; podcasts: string; requests: string };
  navLabel: string;
  houseBand: string;

  liveKicker: string;
  onAir: string;
  withHost: S;
  until: S;
  upNext: string;
  listenLive: string;
  listening: S;
  simulated: string;
  demoAudio: string;
  tunedIn: string;
  nowPlaying: string;
  tuneBy: S;
  jingle: string;
  loadingNow: string;

  // player
  playerLabel: string;
  open: string;
  close: string;
  play: string;
  pause: string;
  volume: string;
  mute: string;
  unmute: string;
  live: string;
  backToLive: string;
  podcast: string;
  back15: string;
  fwd15: string;
  speed: S;
  prevCh: string;
  nextCh: string;
  position: string;
  noAudio: string;
  hiddenStop: string;
  tickerLabel: string;
  requestOnAir: S2;

  // schedule
  schedH: string;
  schedSub: string;
  stationTime: S;
  ktmTime: S;
  yourTime: S;
  today: string;
  onNow: string;
  remind: string;
  reminded: string;
  remindSet: S;
  remindOff: S;
  remindNow: S;
  daysShort: string[];
  daysLong: string[];
  dayTabs: string;
  weekGrid: string;
  nextDay: string;
  prevDay: string;
  ktmShort: string;

  // podcasts
  podH: string;
  podSub: string;
  subscribeH: string;
  subscribe: { rss: string; app: string; music: string; copy: string };
  subscribeNote: string;
  subscribeToast: string;
  epN: S;
  minutes: S;
  resumeAt: S;
  played: string;
  allEpisodes: string;
  playEp: string;
  resumeEp: S;
  pauseEp: string;
  startOver: string;
  aboutEp: string;
  showNotes: string;
  chapters: string;
  hosts: string;
  demoEp: string;
  waveLabel: string;
  playingNow: string;
  months: string[];

  // requests
  reqH: string;
  reqSub: string;
  kindLabel: string;
  kindSong: string;
  kindShout: string;
  yourName: string;
  town: string;
  tune: string;
  tunePick: string;
  msg: string;
  msgSong: string;
  msgShout: string;
  send: string;
  errTune: string;
  errMsg: string;
  sent: string;
  onAirH: string;
  yours: string;
  readBy: S;
  wants: S;
  someone: string;
  nothingSent: string;

  // about + reset
  howH: string;
  how: string[];
  reset: string;
  resetDone: string;
  close2: string;
};

export const COPY: Record<Lang, Copy> = {
  en: {
    tagline: 'Nepali radio in Europe',
    madeUp: 'A made-up station — every show, host and tune here is invented for this demo.',
    langLabel: 'Language',
    nav: { live: 'Live', schedule: 'Schedule', podcasts: 'Podcasts', requests: 'Requests' },
    navLabel: 'Station sections',
    houseBand: 'the house band',

    liveKicker: 'Live now · demo station',
    onAir: 'On air',
    withHost: (h) => `with ${h}`,
    until: (t) => `until ${t}`,
    upNext: 'Up next',
    listenLive: 'Listen live',
    listening: (n) => `${n} listening`,
    simulated: 'simulated',
    demoAudio: 'Demo audio: the music is made live in your browser — no real stream.',
    tunedIn: 'You are tuned in',
    nowPlaying: 'Now playing',
    tuneBy: (t) => `“${t}” · Dui Kinara house band · demo tune`,
    jingle: 'Station jingle',
    loadingNow: 'Checking the programme…',

    playerLabel: 'Radio player',
    open: 'Open the full player',
    close: 'Close the full player',
    play: 'Play',
    pause: 'Pause',
    volume: 'Volume',
    mute: 'Mute',
    unmute: 'Unmute',
    live: 'Live',
    backToLive: 'Back to live radio',
    podcast: 'Podcast',
    back15: 'Back 15 seconds',
    fwd15: 'Forward 15 seconds',
    speed: (s) => `Speed ${s}`,
    prevCh: 'Previous chapter',
    nextCh: 'Next chapter',
    position: 'Position in the episode',
    noAudio: 'This browser cannot play the demo audio (no Web Audio).',
    hiddenStop: 'Paused after a long time in the background.',
    tickerLabel: 'Now playing ticker',
    requestOnAir: (who, what) => `On air: ${who} — ${what}`,

    schedH: 'This week on air',
    schedSub: 'Times are station time (Berlin). Kathmandu time in grey — handy for calling home.',
    stationTime: (t) => `Station time ${t}`,
    ktmTime: (t) => `Kathmandu ${t}`,
    yourTime: (t) => `Your time ${t}`,
    today: 'Today',
    onNow: 'On now',
    remind: 'Remind me',
    reminded: 'Reminder on',
    remindSet: (s) => `Reminder set: we’ll show a note on this page when ${s} starts. Demo — nothing is sent.`,
    remindOff: (s) => `Reminder for ${s} removed.`,
    remindNow: (s) => `${s} is on air now — tap play to listen.`,
    daysShort: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    daysLong: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    dayTabs: 'Pick a day',
    weekGrid: 'The week at a glance',
    nextDay: 'next day',
    prevDay: 'previous day',
    ktmShort: 'KTM',

    podH: 'Podcasts',
    podSub: 'Missed a show? Every episode with chapters, show notes and a waveform you can tap to jump.',
    subscribeH: 'Subscribe',
    subscribe: { rss: 'RSS feed', app: 'Podcast app', music: 'Music app', copy: 'Copy feed link' },
    subscribeNote: 'Demo buttons: they show how it would look and open nothing.',
    subscribeToast: 'Demo: on a real site this opens your podcast app with the feed.',
    epN: (n) => `Episode ${n}`,
    minutes: (n) => `${n} min`,
    resumeAt: (t) => `Resume at ${t}`,
    played: 'Played',
    allEpisodes: 'All episodes',
    playEp: 'Play episode',
    resumeEp: (t) => `Resume from ${t}`,
    pauseEp: 'Pause episode',
    startOver: 'Start over',
    aboutEp: 'About this episode',
    showNotes: 'Show notes',
    chapters: 'Chapters',
    hosts: 'Hosts',
    demoEp: 'Demo episode: a music bed with a chime at each chapter — no voices.',
    waveLabel: 'Episode position — arrow keys skip 15 seconds',
    playingNow: 'Playing',
    months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],

    reqH: 'Request a song or send a shout-out',
    reqSub: 'Nothing is sent: it stays on this device and appears below, as if the host read it on air.',
    kindLabel: 'What would you like?',
    kindSong: 'Song request',
    kindShout: 'Shout-out',
    yourName: 'Your name (optional)',
    town: 'Town (optional)',
    tune: 'Tune',
    tunePick: 'Choose a demo tune',
    msg: 'Message',
    msgSong: 'Who is it for? (optional)',
    msgShout: 'Your shout-out',
    send: 'Send to the studio',
    errTune: 'Please choose a tune.',
    errMsg: 'Please write a short message.',
    sent: 'In the studio! It shows under “Requests on air”. Demo — nothing left this device.',
    onAirH: 'Requests on air',
    yours: 'Yours',
    readBy: (h) => `Read by ${h}`,
    wants: (t) => `asks for “${t}”`,
    someone: 'A listener',
    nothingSent: 'Stays on this device',

    howH: 'How this demo works',
    how: [
      'The station, hosts, tunes, listeners and requests are all made up.',
      'The music is composed and played live in your browser with Web Audio — a madal beat, a drone and a flute line that changes over time.',
      'The schedule runs on station time (Berlin) and works out what is on now from your clock.',
      'Your requests, reminders and where you stopped each episode stay on this device — nothing is sent.',
    ],
    reset: 'Reset demo',
    resetDone: 'Demo reset: requests, reminders and episode progress cleared.',
    close2: 'Close',
  },
  de: {
    tagline: 'Nepalesisches Radio in Europa',
    madeUp: 'Ein erfundener Sender — alle Sendungen, Moderator:innen und Stücke sind für diese Demo ausgedacht.',
    langLabel: 'Sprache',
    nav: { live: 'Live', schedule: 'Programm', podcasts: 'Podcasts', requests: 'Wünsche' },
    navLabel: 'Bereiche des Senders',
    houseBand: 'die Hausband',

    liveKicker: 'Jetzt live · Demo-Sender',
    onAir: 'On Air',
    withHost: (h) => `mit ${h}`,
    until: (t) => `bis ${t}`,
    upNext: 'Danach',
    listenLive: 'Live hören',
    listening: (n) => `${n} hören zu`,
    simulated: 'simuliert',
    demoAudio: 'Demo-Audio: Die Musik entsteht live in deinem Browser — kein echter Stream.',
    tunedIn: 'Du hörst zu',
    nowPlaying: 'Läuft gerade',
    tuneBy: (t) => `„${t}“ · Dui-Kinara-Hausband · Demo-Stück`,
    jingle: 'Sender-Jingle',
    loadingNow: 'Programm wird geladen…',

    playerLabel: 'Radio-Player',
    open: 'Großen Player öffnen',
    close: 'Großen Player schließen',
    play: 'Abspielen',
    pause: 'Pause',
    volume: 'Lautstärke',
    mute: 'Stumm',
    unmute: 'Ton an',
    live: 'Live',
    backToLive: 'Zurück zum Live-Radio',
    podcast: 'Podcast',
    back15: '15 Sekunden zurück',
    fwd15: '15 Sekunden vor',
    speed: (s) => `Tempo ${s}`,
    prevCh: 'Vorheriges Kapitel',
    nextCh: 'Nächstes Kapitel',
    position: 'Position in der Folge',
    noAudio: 'Dieser Browser kann das Demo-Audio nicht abspielen (kein Web Audio).',
    hiddenStop: 'Nach langer Zeit im Hintergrund pausiert.',
    tickerLabel: 'Laufband: was gerade läuft',
    requestOnAir: (who, what) => `On Air: ${who} — ${what}`,

    schedH: 'Diese Woche on air',
    schedSub: 'Zeiten in Senderzeit (Berlin). Kathmandu-Zeit in Grau — praktisch für Anrufe nach Hause.',
    stationTime: (t) => `Senderzeit ${t}`,
    ktmTime: (t) => `Kathmandu ${t}`,
    yourTime: (t) => `Deine Zeit ${t}`,
    today: 'Heute',
    onNow: 'Läuft jetzt',
    remind: 'Erinnern',
    reminded: 'Erinnerung an',
    remindSet: (s) => `Erinnerung gesetzt: Wir zeigen hier einen Hinweis, wenn ${s} beginnt. Demo — nichts wird verschickt.`,
    remindOff: (s) => `Erinnerung für ${s} entfernt.`,
    remindNow: (s) => `${s} läuft jetzt — tippe auf Abspielen.`,
    daysShort: ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'],
    daysLong: ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'],
    dayTabs: 'Tag wählen',
    weekGrid: 'Die Woche auf einen Blick',
    nextDay: 'Folgetag',
    prevDay: 'Vortag',
    ktmShort: 'KTM',

    podH: 'Podcasts',
    podSub: 'Sendung verpasst? Jede Folge mit Kapiteln, Shownotes und einer Wellenform zum Hinspringen.',
    subscribeH: 'Abonnieren',
    subscribe: { rss: 'RSS-Feed', app: 'Podcast-App', music: 'Musik-App', copy: 'Feed-Link kopieren' },
    subscribeNote: 'Demo-Knöpfe: Sie zeigen, wie es aussähe, und öffnen nichts.',
    subscribeToast: 'Demo: Auf einer echten Seite öffnet sich hier deine Podcast-App mit dem Feed.',
    epN: (n) => `Folge ${n}`,
    minutes: (n) => `${n} Min.`,
    resumeAt: (t) => `Weiter bei ${t}`,
    played: 'Gehört',
    allEpisodes: 'Alle Folgen',
    playEp: 'Folge abspielen',
    resumeEp: (t) => `Weiter ab ${t}`,
    pauseEp: 'Folge pausieren',
    startOver: 'Von vorn',
    aboutEp: 'Über diese Folge',
    showNotes: 'Shownotes',
    chapters: 'Kapitel',
    hosts: 'Moderation',
    demoEp: 'Demo-Folge: ein Musikbett mit einem Gong bei jedem Kapitel — keine Stimmen.',
    waveLabel: 'Position in der Folge — Pfeiltasten springen 15 Sekunden',
    playingNow: 'Läuft',
    months: ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sep.', 'Okt.', 'Nov.', 'Dez.'],

    reqH: 'Wünsch dir ein Lied oder sende einen Gruß',
    reqSub: 'Nichts wird verschickt: Es bleibt auf diesem Gerät und erscheint unten, als hätte die Moderation es vorgelesen.',
    kindLabel: 'Was möchtest du?',
    kindSong: 'Liedwunsch',
    kindShout: 'Gruß',
    yourName: 'Dein Name (optional)',
    town: 'Ort (optional)',
    tune: 'Stück',
    tunePick: 'Demo-Stück wählen',
    msg: 'Nachricht',
    msgSong: 'Für wen ist es? (optional)',
    msgShout: 'Dein Gruß',
    send: 'Ans Studio senden',
    errTune: 'Bitte wähle ein Stück.',
    errMsg: 'Bitte schreib eine kurze Nachricht.',
    sent: 'Im Studio angekommen! Es steht unter „Wünsche on air“. Demo — nichts hat dieses Gerät verlassen.',
    onAirH: 'Wünsche on air',
    yours: 'Deiner',
    readBy: (h) => `Vorgelesen von ${h}`,
    wants: (t) => `wünscht sich „${t}“`,
    someone: 'Jemand aus der Hörerschaft',
    nothingSent: 'Bleibt auf diesem Gerät',

    howH: 'So funktioniert diese Demo',
    how: [
      'Sender, Moderation, Stücke, Zuhörerzahlen und Wünsche sind alle erfunden.',
      'Die Musik wird live in deinem Browser mit Web Audio komponiert und gespielt — ein Madal-Beat, ein Bordun und eine Flötenlinie, die sich mit der Zeit ändert.',
      'Das Programm läuft in Senderzeit (Berlin) und berechnet aus deiner Uhr, was gerade läuft.',
      'Deine Wünsche, Erinnerungen und wo du in jeder Folge aufgehört hast, bleiben auf diesem Gerät — nichts wird verschickt.',
    ],
    reset: 'Demo zurücksetzen',
    resetDone: 'Demo zurückgesetzt: Wünsche, Erinnerungen und Fortschritt gelöscht.',
    close2: 'Schließen',
  },
  ne: {
    tagline: 'युरोपमा नेपाली रेडियो',
    madeUp: 'काल्पनिक रेडियो — यहाँका सबै कार्यक्रम, सञ्चालक र धुन यो डेमोका लागि बनाइएका हुन्।',
    langLabel: 'भाषा',
    nav: { live: 'लाइभ', schedule: 'कार्यतालिका', podcasts: 'पोडकास्ट', requests: 'फर्माइस' },
    navLabel: 'रेडियोका खण्ड',
    houseBand: 'हाउस ब्यान्ड',

    liveKicker: 'अहिले लाइभ · डेमो रेडियो',
    onAir: 'प्रसारणमा',
    withHost: (h) => `सञ्चालक: ${h}`,
    until: (t) => `${t} सम्म`,
    upNext: 'त्यसपछि',
    listenLive: 'लाइभ सुन्नुहोस्',
    listening: (n) => `${n} जना सुन्दै`,
    simulated: 'नक्कली गणना',
    demoAudio: 'डेमो अडियो: सङ्गीत तपाईंकै ब्राउजरमा तत्कालै बन्छ — वास्तविक स्ट्रिम होइन।',
    tunedIn: 'तपाईं सुन्दै हुनुहुन्छ',
    nowPlaying: 'अहिले बज्दै',
    tuneBy: (t) => `“${t}” · दुई किनारा हाउस ब्यान्ड · डेमो धुन`,
    jingle: 'रेडियोको जिङ्गल',
    loadingNow: 'कार्यतालिका हेर्दै…',

    playerLabel: 'रेडियो प्लेयर',
    open: 'ठूलो प्लेयर खोल्नुहोस्',
    close: 'ठूलो प्लेयर बन्द गर्नुहोस्',
    play: 'बजाउनुहोस्',
    pause: 'रोक्नुहोस्',
    volume: 'आवाज',
    mute: 'आवाज बन्द',
    unmute: 'आवाज खोल्नुहोस्',
    live: 'लाइभ',
    backToLive: 'लाइभ रेडियोमा फर्कनुहोस्',
    podcast: 'पोडकास्ट',
    back15: '१५ सेकेन्ड पछाडि',
    fwd15: '१५ सेकेन्ड अगाडि',
    speed: (s) => `गति ${s}`,
    prevCh: 'अघिल्लो अध्याय',
    nextCh: 'अर्को अध्याय',
    position: 'एपिसोडमा अहिलेको ठाउँ',
    noAudio: 'यो ब्राउजरले डेमो अडियो बजाउन सक्दैन (Web Audio छैन)।',
    hiddenStop: 'धेरै बेर पृष्ठभूमिमा रहेकाले रोकियो।',
    tickerLabel: 'अहिले के बज्दैछ',
    requestOnAir: (who, what) => `प्रसारणमा: ${who} — ${what}`,

    schedH: 'यो हप्ताको कार्यतालिका',
    schedSub: 'समय रेडियोको (बर्लिन) हो। खैरोमा काठमाडौंको समय — घर फोन गर्न सजिलो।',
    stationTime: (t) => `रेडियोको समय ${t}`,
    ktmTime: (t) => `काठमाडौं ${t}`,
    yourTime: (t) => `तपाईंको समय ${t}`,
    today: 'आज',
    onNow: 'अहिले चल्दै',
    remind: 'सम्झाइदिनुस्',
    reminded: 'सम्झना राखियो',
    remindSet: (s) => `सम्झना राखियो: ${s} सुरु हुँदा यही पृष्ठमा सूचना देखिन्छ। डेमो — केही पठाइँदैन।`,
    remindOff: (s) => `${s} को सम्झना हटाइयो।`,
    remindNow: (s) => `${s} अहिले प्रसारणमा छ — सुन्न बजाउनुहोस् थिच्नुहोस्।`,
    daysShort: ['सोम', 'मङ्गल', 'बुध', 'बिही', 'शुक्र', 'शनि', 'आइत'],
    daysLong: ['सोमबार', 'मङ्गलबार', 'बुधबार', 'बिहीबार', 'शुक्रबार', 'शनिबार', 'आइतबार'],
    dayTabs: 'दिन छान्नुहोस्',
    weekGrid: 'पूरा हप्ता एकै नजरमा',
    nextDay: 'अर्को दिन',
    prevDay: 'अघिल्लो दिन',
    ktmShort: 'काठ.',

    podH: 'पोडकास्ट',
    podSub: 'कार्यक्रम छुट्यो? अध्याय, टिपोट र थिचेर जहाँ पनि पुग्न मिल्ने वेभफर्मसहित हरेक एपिसोड।',
    subscribeH: 'सदस्य बन्नुहोस्',
    subscribe: { rss: 'RSS फिड', app: 'पोडकास्ट एप', music: 'सङ्गीत एप', copy: 'फिड लिङ्क कपी' },
    subscribeNote: 'डेमो बटन: कस्तो देखिन्छ भनेर मात्र देखाउँछन्, केही खोल्दैनन्।',
    subscribeToast: 'डेमो: वास्तविक साइटमा यहाँबाट तपाईंको पोडकास्ट एप खुल्छ।',
    epN: (n) => `एपिसोड ${n}`,
    minutes: (n) => `${n} मिनेट`,
    resumeAt: (t) => `${t} बाट सुरु`,
    played: 'सुनिसकियो',
    allEpisodes: 'सबै एपिसोड',
    playEp: 'एपिसोड बजाउनुहोस्',
    resumeEp: (t) => `${t} बाट सुन्नुहोस्`,
    pauseEp: 'एपिसोड रोक्नुहोस्',
    startOver: 'सुरुदेखि',
    aboutEp: 'यो एपिसोडबारे',
    showNotes: 'टिपोट',
    chapters: 'अध्याय',
    hosts: 'सञ्चालक',
    demoEp: 'डेमो एपिसोड: हरेक अध्यायमा घण्टीसहितको सङ्गीत मात्र — आवाज छैन।',
    waveLabel: 'एपिसोडमा ठाउँ — एरो कीले १५ सेकेन्ड सार्छ',
    playingNow: 'बज्दै',
    months: ['जनवरी', 'फेब्रुअरी', 'मार्च', 'अप्रिल', 'मे', 'जुन', 'जुलाई', 'अगस्ट', 'सेप्टेम्बर', 'अक्टोबर', 'नोभेम्बर', 'डिसेम्बर'],

    reqH: 'गीतको फर्माइस गर्नुहोस् वा शुभकामना पठाउनुहोस्',
    reqSub: 'केही पठाइँदैन: यो यही उपकरणमा रहन्छ र सञ्चालकले रेडियोमा पढेजस्तै तल देखिन्छ।',
    kindLabel: 'के चाहनुहुन्छ?',
    kindSong: 'गीतको फर्माइस',
    kindShout: 'शुभकामना',
    yourName: 'तपाईंको नाम (ऐच्छिक)',
    town: 'सहर (ऐच्छिक)',
    tune: 'धुन',
    tunePick: 'डेमो धुन छान्नुहोस्',
    msg: 'सन्देश',
    msgSong: 'कसका लागि? (ऐच्छिक)',
    msgShout: 'तपाईंको शुभकामना',
    send: 'स्टुडियोमा पठाउनुहोस्',
    errTune: 'कृपया एउटा धुन छान्नुहोस्।',
    errMsg: 'कृपया छोटो सन्देश लेख्नुहोस्।',
    sent: 'स्टुडियोमा पुग्यो! “प्रसारणमा फर्माइस” मा देखिन्छ। डेमो — केही पनि यो उपकरण बाहिर गएन।',
    onAirH: 'प्रसारणमा फर्माइस',
    yours: 'तपाईंको',
    readBy: (h) => `${h} ले पढ्नुभयो`,
    wants: (t) => `“${t}” को फर्माइस`,
    someone: 'एक श्रोता',
    nothingSent: 'यही उपकरणमा रहन्छ',

    howH: 'यो डेमो कसरी चल्छ',
    how: [
      'रेडियो, सञ्चालक, धुन, श्रोता सङ्ख्या र फर्माइस सबै काल्पनिक हुन्।',
      'सङ्गीत तपाईंकै ब्राउजरमा Web Audio ले तत्कालै रचेर बजाउँछ — मादलको ताल, तानपुराको धुन र समयसँगै बदलिने बाँसुरी।',
      'कार्यतालिका रेडियोको समय (बर्लिन) मा चल्छ र तपाईंको घडी हेरेर अहिले के चल्दैछ भनेर निकाल्छ।',
      'तपाईंका फर्माइस, सम्झना र हरेक एपिसोड कहाँसम्म सुन्नुभयो भन्ने कुरा यही उपकरणमा रहन्छ — केही पठाइँदैन।',
    ],
    reset: 'डेमो रिसेट',
    resetDone: 'डेमो रिसेट भयो: फर्माइस, सम्झना र एपिसोडको प्रगति हटाइयो।',
    close2: 'बन्द गर्नुहोस्',
  },
};

/** "28 Oct 2026" / "28. Okt. 2026" / "अक्टोबर २८, २०२६". */
export function dateLabel(iso: string, lang: Lang): string {
  const [y, m, d] = iso.split('-').map(Number);
  const mon = COPY[lang].months[(m || 1) - 1];
  if (lang === 'de') return `${d}. ${mon} ${y}`;
  if (lang === 'ne') return num(`${mon} ${d}, ${y}`, 'ne');
  return `${d} ${mon} ${y}`;
}

// ---------- the MartNepali frame around the demo ----------

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
    text: 'Built by MartNepali · a made-up radio station, nothing is sent',
    all: '← All demos',
    kicker: 'MartNepali Studio · Demo project',
    endH: 'Want a site for your radio or podcast?',
    endP: 'For a community radio, a podcast or a culture group with a weekly show: a live player that keeps playing while people browse, your programme with “on now”, episode pages with chapters, and requests from listeners — in English, Deutsch and नेपाली.',
    points: ['Live player and schedule', 'Episodes with chapters', 'English, Deutsch, नेपाली'],
    talk: 'Kura garau',
    more: 'See all our work',
    pairs: 'Pairs well with the artist page →',
    free: 'Free while we grow.',
  },
  de: {
    badge: 'Demo-Projekt',
    text: 'Gebaut von MartNepali · ein erfundener Radiosender, nichts wird verschickt',
    all: '← Alle Demos',
    kicker: 'MartNepali Studio · Demo-Projekt',
    endH: 'Eine Website für euer Radio oder euren Podcast?',
    endP: 'Für ein Community-Radio, einen Podcast oder einen Kulturverein mit einer wöchentlichen Sendung: ein Live-Player, der beim Stöbern weiterspielt, euer Programm mit „läuft jetzt“, Folgenseiten mit Kapiteln und Wünsche aus der Hörerschaft — auf English, Deutsch und नेपाली.',
    points: ['Live-Player und Programm', 'Folgen mit Kapiteln', 'English, Deutsch, नेपाली'],
    talk: 'Kura garau',
    more: 'Alle unsere Arbeiten',
    pairs: 'Passt gut zur Künstlerseite →',
    free: 'Kostenlos, solange wir wachsen.',
  },
  ne: {
    badge: 'डेमो परियोजना',
    text: 'MartNepali ले बनाएको · काल्पनिक रेडियो, केही पनि पठाइँदैन',
    all: '← सबै डेमो',
    kicker: 'MartNepali स्टुडियो · डेमो परियोजना',
    endH: 'आफ्नो रेडियो वा पोडकास्टका लागि वेबसाइट चाहिन्छ?',
    endP: 'सामुदायिक रेडियो, पोडकास्ट वा साप्ताहिक कार्यक्रम चलाउने सांस्कृतिक समूहका लागि: पेज हेर्दा पनि बजिरहने लाइभ प्लेयर, “अहिले चल्दै” सहितको कार्यतालिका, अध्यायसहितका एपिसोड र श्रोताका फर्माइस — English, Deutsch र नेपालीमा।',
    points: ['लाइभ प्लेयर र कार्यतालिका', 'अध्यायसहितका एपिसोड', 'English, Deutsch, नेपाली'],
    talk: 'Kura garau',
    more: 'हाम्रा सबै काम',
    pairs: 'कलाकार पेजसँग राम्रोसँग मिल्छ →',
    free: 'हामी बढ्दै गर्दा निःशुल्क।',
  },
};
