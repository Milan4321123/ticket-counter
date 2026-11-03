// Words for the /work/cup demo in English, Deutsch and नेपाली. "Himal Cup 2027"
// is a made-up futsal tournament; its teams, players and results are invented.
// Club names stay as they are in every language (that is what clubs do).
//
// No money anywhere: no entry fees, prizes with a value, bets or odds — a
// trophy and medals only. The single exception is the frame's honest "free
// while we grow" (`FRAME.free`); tests/futsalCup.test.ts checks every other
// string in all three languages.

import type { EventKind, GroupId, Motif, RegError, Stage } from './cup';

export type Lang = 'en' | 'de' | 'ne';
export const LANGS: { id: Lang; label: string }[] = [
  { id: 'en', label: 'EN' },
  { id: 'de', label: 'DE' },
  { id: 'ne', label: 'नेपाली' },
];

const NE_DIGITS = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
export function num(n: number | string, lang: Lang): string {
  return lang === 'ne' ? String(n).replace(/[0-9]/g, (d) => NE_DIGITS[Number(d)]) : String(n);
}

export type Mode = 'fans' | 'ref';
export type Tab = 'live' | 'fixtures' | 'tables' | 'bracket' | 'stats' | 'join';
type S = (a: string) => string;
type S2 = (a: string, b: string) => string;
type S3 = (a: string, b: string, c: string) => string;

export type Copy = {
  name: string;
  tagline: string;
  madeUp: string;
  hallClock: S;
  speedLabel: string;
  pause: string;
  play: string;
  paused: string;
  langLabel: string;
  reset: string;
  resetDone: string;
  modesLabel: string;
  modes: Record<Mode, string>;
  bigScreen: string;
  bigExit: string;
  followLabel: string;
  followNone: string;
  followHint: string;
  followOn: S;
  followOff: string;
  followBtn: S;
  unfollowBtn: S;
  tabsLabel: string;
  tabs: Record<Tab, string>;

  group: S;
  stage: Record<Stage, string>;
  pitch: S;
  kickoffAt: S;
  live: string;
  ht: string;
  ft: string;
  pens: string;
  penWin: S3;
  firstHalf: string;
  secondHalf: string;
  ev: Record<EventKind, string>;
  secondYellow: string;
  subText: S2;
  noEvents: string;
  nowPlaying: string;
  nextUp: string;
  justEnded: string;
  nothingLive: S;
  waitingKo: string;
  dayOver: string;
  vs: string;

  tablesH: string;
  cols: { pos: string; team: string; p: string; w: string; d: string; l: string; gf: string; ga: string; gd: string; pts: string };
  colsLong: { p: string; w: string; d: string; l: string; gf: string; ga: string; gd: string; pts: string };
  qualify: string;
  liveRow: string;
  by: { h2h: string; fairplay: string; lots: string };
  tieNote: S3;
  tieRules: string;

  bracketH: string;
  semis: string;
  finalH: string;
  thirdH: string;
  groupPlace: (g: GroupId, pos: 1 | 2) => string;
  sfWinner: S;
  sfLoser: S;
  championLabel: string;
  championH: S;
  championSub: string;
  playAgain: string;

  fixturesH: string;
  fixturesAll: string;
  fixturesMine: string;
  fixturesPickTeam: string;

  scorersH: string;
  playerCol: string;
  goalsCol: string;
  noGoals: string;
  fairH: string;
  fairNote: string;
  yellowCol: string;
  redCol: string;
  fpCol: string;

  refH: string;
  refSub: string;
  refPick: string;
  refLiveNow: string;
  refStart: string;
  refHt: string;
  refSecond: string;
  refFt: string;
  refGoal: string;
  refMinus: string;
  refYellow: string;
  refRed: string;
  refUndo: string;
  refAuto: string;
  refManual: string;
  refAutoNote: string;
  refScorer: S;
  refCardFor: S2;
  refCancel: string;
  refFlow: string;
  refWaiting: string;
  refBusy: string;
  refClosed: string;
  refLog: string;
  refByRef: string;
  refNothing: string;
  refDone: string;

  goalToast: (team: string, score: string, who: string, min: string) => string;
  cardToast: S3;
  ftToast: S2;
  champToast: S;

  joinH: string;
  joinSub: string;
  nameLabel: string;
  namePh: string;
  captainLabel: string;
  captainPh: string;
  colorsLabel: string;
  color1: string;
  color2: string;
  motifLabel: string;
  motifs: Record<Motif, string>;
  preview: string;
  submit: string;
  regOk: string;
  regErr: Record<RegError, string>;
  registeredH: string;
  registeredBy: S;
  regNone: string;
};

export const COPY: Record<Lang, Copy> = {
  en: {
    name: 'Himal Cup 2027',
    tagline: 'Futsal · Offenbach · one day, two pitches',
    madeUp: 'A made-up tournament: teams, players and results are invented, nothing is sent anywhere.',
    hallClock: (t) => `Hall clock ${t}`,
    speedLabel: 'Speed',
    pause: 'Pause',
    play: 'Play',
    paused: 'Paused',
    langLabel: 'Language',
    reset: 'Reset demo',
    resetDone: 'A fresh tournament — kick-off at 10:00.',
    modesLabel: 'View',
    modes: { fans: 'Fans', ref: 'Referee desk' },
    bigScreen: 'Big screen',
    bigExit: 'Exit (Esc)',
    followLabel: 'Follow a team',
    followNone: 'No team',
    followHint: 'You get a note on this page when they score.',
    followOn: (t) => `Following ${t} — you will see their goals here.`,
    followOff: 'Not following a team any more.',
    followBtn: (t) => `Follow ${t}`,
    unfollowBtn: (t) => `Stop following ${t}`,
    tabsLabel: 'Sections',
    tabs: { live: 'Live', fixtures: 'Fixtures', tables: 'Tables', bracket: 'Knockout', stats: 'Scorers', join: 'Register' },

    group: (g) => `Group ${g}`,
    stage: { group: 'Group', sf: 'Semi-final', third: '3rd place', final: 'Final' },
    pitch: (n) => `Pitch ${n}`,
    kickoffAt: (t) => `Kick-off ${t}`,
    live: 'Live',
    ht: 'Half-time',
    ft: 'Full-time',
    pens: 'Penalties',
    penWin: (team, a, b) => `${team} go through ${a}–${b} on penalties`,
    firstHalf: '1st half',
    secondHalf: '2nd half',
    ev: { goal: 'Goal', yellow: 'Yellow card', red: 'Red card', sub: 'Sub' },
    secondYellow: 'second yellow',
    subText: (on, off) => `${on} on, ${off} off`,
    noEvents: 'No goals or cards yet.',
    nowPlaying: 'On the pitches now',
    nextUp: 'Next up',
    justEnded: 'Just finished',
    nothingLive: (t) => `Nothing on right now — next kick-off ${t}.`,
    waitingKo: 'The knockout teams are set when the groups finish.',
    dayOver: 'All sixteen matches played.',
    vs: 'vs',

    tablesH: 'Group tables',
    cols: { pos: '#', team: 'Team', p: 'P', w: 'W', d: 'D', l: 'L', gf: 'GF', ga: 'GA', gd: 'GD', pts: 'Pts' },
    colsLong: { p: 'Played', w: 'Won', d: 'Drawn', l: 'Lost', gf: 'Goals for', ga: 'Goals against', gd: 'Goal difference', pts: 'Points' },
    qualify: 'Top two reach the semi-finals',
    liveRow: 'playing now — the table counts the live score',
    by: { h2h: 'head-to-head', fairplay: 'fair play', lots: 'drawing of lots' },
    tieNote: (a, b, how) => `${a} above ${b} on ${how}`,
    tieRules: 'Level teams: points → goal difference → goals scored → head-to-head → fair play → drawing of lots.',

    bracketH: 'Knockout',
    semis: 'Semi-finals',
    finalH: 'Final',
    thirdH: 'Match for 3rd place',
    groupPlace: (g, pos) => `${pos === 1 ? 'Winner' : 'Runner-up'} Group ${g}`,
    sfWinner: (n) => `Winner SF ${n}`,
    sfLoser: (n) => `Loser SF ${n}`,
    championLabel: 'Champions',
    championH: (t) => `${t} win the Himal Cup 2027!`,
    championSub: 'Trophy and medals at the closing ceremony in the hall.',
    playAgain: 'Play the day again',

    fixturesH: 'Fixtures by time and pitch',
    fixturesAll: 'All matches',
    fixturesMine: 'My team',
    fixturesPickTeam: 'Follow a team to see only its matches.',

    scorersH: 'Top scorers',
    playerCol: 'Player',
    goalsCol: 'Goals',
    noGoals: 'No goals yet.',
    fairH: 'Fair play',
    fairNote: 'Yellow 1 · red 3 · fewest on top',
    yellowCol: 'Yellow',
    redCol: 'Red',
    fpCol: 'Score',

    refH: 'Referee desk',
    refSub: 'For the match table at the side of the pitch: the score, cards and whistle — everyone’s phone and the hall TV follow.',
    refPick: 'Match',
    refLiveNow: 'Live now',
    refStart: 'Kick off',
    refHt: 'Half-time',
    refSecond: 'Start 2nd half',
    refFt: 'Full-time',
    refGoal: 'Goal',
    refMinus: 'Take back a goal',
    refYellow: 'Yellow',
    refRed: 'Red',
    refUndo: 'Undo last',
    refAuto: 'Hand back to the simulation',
    refManual: 'You have the whistle — the simulation stays out of this match.',
    refAutoNote: 'The simulation runs this match until you press something.',
    refScorer: (t) => `Who scored for ${t}?`,
    refCardFor: (c, t) => `${c} for which ${t} player?`,
    refCancel: 'Cancel',
    refFlow: 'Every press shows up in the tables and the bracket straight away.',
    refWaiting: 'Waiting for its teams',
    refBusy: 'The pitch is still in use',
    refClosed: 'Full-time — this match is closed.',
    refLog: 'Match log',
    refByRef: 'desk',
    refNothing: 'Nothing logged yet.',
    refDone: 'Saved',

    goalToast: (team, sc, who, min) => `⚽ Goal for ${team}! ${sc} — ${who} ${min}'`,
    cardToast: (c, who, team) => `${c}: ${who} (${team})`,
    ftToast: (a, b) => `Full-time: ${a} — ${b}`,
    champToast: (t) => `🏆 ${t} are the champions!`,

    joinH: 'Register a team',
    joinSub: 'For next year’s cup. A demo form: it stays in this browser, nothing is sent.',
    nameLabel: 'Team name',
    namePh: 'e.g. Machhapuchhre FC Mainz',
    captainLabel: 'Captain’s first name',
    captainPh: 'e.g. Sushil',
    colorsLabel: 'Club colours',
    color1: 'Shirt',
    color2: 'Trim',
    motifLabel: 'Crest',
    motifs: { peak: 'Mountain', star: 'Star', sun: 'Sun', moon: 'Moon' },
    preview: 'Crest preview',
    submit: 'Register team',
    regOk: 'Registered (demo, nothing sent)',
    regErr: {
      nameShort: 'Give the team a name.',
      nameLong: 'That name is a bit long — 32 letters at most.',
      nameTaken: 'A team with that name is already in.',
      captainShort: 'Who is the captain? A first name is enough.',
      captainLong: 'Just the first name, please.',
      colorsSame: 'Pick two different colours.',
      full: 'This demo holds four registrations — reset the demo to try again.',
    },
    registeredH: 'Registered in this browser',
    registeredBy: (c) => `Captain ${c}`,
    regNone: 'No team registered yet.',
  },

  de: {
    name: 'Himal Cup 2027',
    tagline: 'Futsal · Offenbach · ein Tag, zwei Felder',
    madeUp: 'Ein erfundenes Turnier: Teams, Spieler und Ergebnisse sind ausgedacht, nichts wird verschickt.',
    hallClock: (t) => `Hallenuhr ${t}`,
    speedLabel: 'Tempo',
    pause: 'Pause',
    play: 'Weiter',
    paused: 'Pausiert',
    langLabel: 'Sprache',
    reset: 'Demo zurücksetzen',
    resetDone: 'Ein neues Turnier — Anpfiff um 10:00.',
    modesLabel: 'Ansicht',
    modes: { fans: 'Fans', ref: 'Kampfgericht' },
    bigScreen: 'Hallen-TV',
    bigExit: 'Schließen (Esc)',
    followLabel: 'Team folgen',
    followNone: 'Kein Team',
    followHint: 'Du bekommst hier einen Hinweis, wenn es trifft.',
    followOn: (t) => `Du folgst ${t} — ihre Tore erscheinen hier.`,
    followOff: 'Du folgst keinem Team mehr.',
    followBtn: (t) => `${t} folgen`,
    unfollowBtn: (t) => `${t} nicht mehr folgen`,
    tabsLabel: 'Bereiche',
    tabs: { live: 'Live', fixtures: 'Spielplan', tables: 'Tabellen', bracket: 'K.-o.-Runde', stats: 'Torjäger', join: 'Anmelden' },

    group: (g) => `Gruppe ${g}`,
    stage: { group: 'Gruppe', sf: 'Halbfinale', third: 'Platz 3', final: 'Finale' },
    pitch: (n) => `Feld ${n}`,
    kickoffAt: (t) => `Anpfiff ${t}`,
    live: 'Live',
    ht: 'Halbzeit',
    ft: 'Abpfiff',
    pens: 'Sechsmeterschießen',
    penWin: (team, a, b) => `${team} weiter mit ${a}:${b} im Sechsmeterschießen`,
    firstHalf: '1. Halbzeit',
    secondHalf: '2. Halbzeit',
    ev: { goal: 'Tor', yellow: 'Gelbe Karte', red: 'Rote Karte', sub: 'Wechsel' },
    secondYellow: 'Gelb-Rot',
    subText: (on, off) => `${on} kommt, ${off} geht`,
    noEvents: 'Noch keine Tore oder Karten.',
    nowPlaying: 'Jetzt auf den Feldern',
    nextUp: 'Als Nächstes',
    justEnded: 'Gerade abgepfiffen',
    nothingLive: (t) => `Gerade kein Spiel — nächster Anpfiff ${t}.`,
    waitingKo: 'Die K.-o.-Paarungen stehen fest, sobald die Gruppen fertig sind.',
    dayOver: 'Alle sechzehn Spiele sind gespielt.',
    vs: 'gegen',

    tablesH: 'Gruppentabellen',
    cols: { pos: '#', team: 'Team', p: 'Sp', w: 'S', d: 'U', l: 'N', gf: 'T', ga: 'GT', gd: 'Diff', pts: 'Pkt' },
    colsLong: { p: 'Spiele', w: 'Siege', d: 'Unentschieden', l: 'Niederlagen', gf: 'Tore', ga: 'Gegentore', gd: 'Tordifferenz', pts: 'Punkte' },
    qualify: 'Die ersten zwei kommen ins Halbfinale',
    liveRow: 'spielt gerade — die Tabelle zählt den Live-Stand',
    by: { h2h: 'direktem Vergleich', fairplay: 'Fairplay', lots: 'Losentscheid' },
    tieNote: (a, b, how) => `${a} vor ${b} nach ${how}`,
    tieRules: 'Bei Gleichstand: Punkte → Tordifferenz → Tore → direkter Vergleich → Fairplay → Los.',

    bracketH: 'K.-o.-Runde',
    semis: 'Halbfinale',
    finalH: 'Finale',
    thirdH: 'Spiel um Platz 3',
    groupPlace: (g, pos) => `${pos === 1 ? 'Sieger' : 'Zweiter'} Gruppe ${g}`,
    sfWinner: (n) => `Sieger HF ${n}`,
    sfLoser: (n) => `Verlierer HF ${n}`,
    championLabel: 'Turniersieger',
    championH: (t) => `${t} gewinnt den Himal Cup 2027!`,
    championSub: 'Pokal und Medaillen bei der Siegerehrung in der Halle.',
    playAgain: 'Den Tag noch mal spielen',

    fixturesH: 'Spielplan nach Zeit und Feld',
    fixturesAll: 'Alle Spiele',
    fixturesMine: 'Mein Team',
    fixturesPickTeam: 'Folge einem Team, um nur seine Spiele zu sehen.',

    scorersH: 'Torjäger',
    playerCol: 'Spieler',
    goalsCol: 'Tore',
    noGoals: 'Noch keine Tore.',
    fairH: 'Fairplay',
    fairNote: 'Gelb 1 · Rot 3 · die wenigsten oben',
    yellowCol: 'Gelb',
    redCol: 'Rot',
    fpCol: 'Wertung',

    refH: 'Kampfgericht',
    refSub: 'Für den Tisch am Spielfeldrand: Spielstand, Karten und Pfiff — alle Handys und das Hallen-TV ziehen mit.',
    refPick: 'Spiel',
    refLiveNow: 'Gerade live',
    refStart: 'Anpfiff',
    refHt: 'Halbzeit',
    refSecond: '2. Halbzeit starten',
    refFt: 'Abpfiff',
    refGoal: 'Tor',
    refMinus: 'Tor zurücknehmen',
    refYellow: 'Gelb',
    refRed: 'Rot',
    refUndo: 'Letztes rückgängig',
    refAuto: 'Wieder der Simulation überlassen',
    refManual: 'Du hast die Pfeife — die Simulation hält sich aus diesem Spiel raus.',
    refAutoNote: 'Die Simulation spielt dieses Spiel, bis du etwas drückst.',
    refScorer: (t) => `Wer hat für ${t} getroffen?`,
    refCardFor: (c, t) => `${c} für wen bei ${t}?`,
    refCancel: 'Abbrechen',
    refFlow: 'Jeder Druck steht sofort in den Tabellen und im Turnierbaum.',
    refWaiting: 'Die Teams stehen noch nicht fest',
    refBusy: 'Das Feld ist noch belegt',
    refClosed: 'Abgepfiffen — dieses Spiel ist abgeschlossen.',
    refLog: 'Spielbericht',
    refByRef: 'Tisch',
    refNothing: 'Noch nichts eingetragen.',
    refDone: 'Gespeichert',

    goalToast: (team, sc, who, min) => `⚽ Tor für ${team}! ${sc} — ${who} ${min}.`,
    cardToast: (c, who, team) => `${c}: ${who} (${team})`,
    ftToast: (a, b) => `Abpfiff: ${a} — ${b}`,
    champToast: (t) => `🏆 ${t} ist Turniersieger!`,

    joinH: 'Team anmelden',
    joinSub: 'Für den Cup im nächsten Jahr. Ein Demo-Formular: Es bleibt in diesem Browser, nichts wird verschickt.',
    nameLabel: 'Teamname',
    namePh: 'z. B. Machhapuchhre FC Mainz',
    captainLabel: 'Vorname der Kapitänin / des Kapitäns',
    captainPh: 'z. B. Sushil',
    colorsLabel: 'Vereinsfarben',
    color1: 'Trikot',
    color2: 'Akzent',
    motifLabel: 'Wappen',
    motifs: { peak: 'Berg', star: 'Stern', sun: 'Sonne', moon: 'Mond' },
    preview: 'Wappen-Vorschau',
    submit: 'Team anmelden',
    regOk: 'Angemeldet (Demo, nichts verschickt)',
    regErr: {
      nameShort: 'Gib dem Team einen Namen.',
      nameLong: 'Der Name ist etwas lang — höchstens 32 Zeichen.',
      nameTaken: 'Ein Team mit diesem Namen ist schon dabei.',
      captainShort: 'Wer ist Kapitän? Der Vorname reicht.',
      captainLong: 'Bitte nur den Vornamen.',
      colorsSame: 'Wähle zwei verschiedene Farben.',
      full: 'Diese Demo nimmt vier Anmeldungen — setze die Demo zurück, um es noch mal zu probieren.',
    },
    registeredH: 'In diesem Browser angemeldet',
    registeredBy: (c) => `Kapitän: ${c}`,
    regNone: 'Noch kein Team angemeldet.',
  },

  ne: {
    name: 'हिमाल कप २०२७',
    tagline: 'फुटसल · ओफेनबाख · एक दिन, दुई मैदान',
    madeUp: 'काल्पनिक प्रतियोगिता: टिम, खेलाडी र नतिजा सबै बनावटी हुन्, केही पनि पठाइँदैन।',
    hallClock: (t) => `हलको घडी ${t}`,
    speedLabel: 'गति',
    pause: 'रोक्नुहोस्',
    play: 'चलाउनुहोस्',
    paused: 'रोकिएको',
    langLabel: 'भाषा',
    reset: 'डेमो सुरुबाट',
    resetDone: 'नयाँ प्रतियोगिता — किक-अफ १०:०० बजे।',
    modesLabel: 'हेर्ने तरिका',
    modes: { fans: 'दर्शक', ref: 'रेफ्री डेस्क' },
    bigScreen: 'ठूलो स्क्रिन',
    bigExit: 'बन्द (Esc)',
    followLabel: 'टिम फलो गर्नुहोस्',
    followNone: 'कुनै टिम छैन',
    followHint: 'उनीहरूले गोल गर्दा यही पेजमा सूचना आउँछ।',
    followOn: (t) => `${t} फलो गर्दै हुनुहुन्छ — उनीहरूका गोल यहाँ देखिन्छन्।`,
    followOff: 'अब कुनै टिम फलो गरिएको छैन।',
    followBtn: (t) => `${t} फलो गर्नुहोस्`,
    unfollowBtn: (t) => `${t} फलो गर्न छोड्नुहोस्`,
    tabsLabel: 'खण्डहरू',
    tabs: { live: 'लाइभ', fixtures: 'तालिका', tables: 'अंक तालिका', bracket: 'नकआउट', stats: 'गोलकर्ता', join: 'दर्ता' },

    group: (g) => `समूह ${g}`,
    stage: { group: 'समूह', sf: 'सेमिफाइनल', third: 'तेस्रो स्थान', final: 'फाइनल' },
    pitch: (n) => `मैदान ${n}`,
    kickoffAt: (t) => `किक-अफ ${t}`,
    live: 'लाइभ',
    ht: 'हाफ टाइम',
    ft: 'खेल सकियो',
    pens: 'पेनाल्टी',
    penWin: (team, a, b) => `${team} पेनाल्टीमा ${a}–${b} ले अघि`,
    firstHalf: 'पहिलो हाफ',
    secondHalf: 'दोस्रो हाफ',
    ev: { goal: 'गोल', yellow: 'पहेँलो कार्ड', red: 'रातो कार्ड', sub: 'खेलाडी परिवर्तन' },
    secondYellow: 'दोस्रो पहेँलो',
    subText: (on, off) => `${on} भित्र, ${off} बाहिर`,
    noEvents: 'अहिलेसम्म गोल वा कार्ड छैन।',
    nowPlaying: 'अहिले मैदानमा',
    nextUp: 'अर्को खेल',
    justEnded: 'भर्खरै सकिएका',
    nothingLive: (t) => `अहिले कुनै खेल छैन — अर्को किक-अफ ${t}।`,
    waitingKo: 'समूह चरण सकिएपछि नकआउटका टिम तय हुन्छन्।',
    dayOver: 'सबै सोह्र खेल सकिए।',
    vs: 'बनाम',

    tablesH: 'समूहको अंक तालिका',
    cols: { pos: '#', team: 'टिम', p: 'खे', w: 'जि', d: 'ब', l: 'हा', gf: 'गो', ga: 'खा', gd: 'फरक', pts: 'अंक' },
    colsLong: { p: 'खेलेको', w: 'जितेको', d: 'बराबरी', l: 'हारेको', gf: 'गोल गरेको', ga: 'गोल खाएको', gd: 'गोल फरक', pts: 'अंक' },
    qualify: 'पहिलो दुई टिम सेमिफाइनलमा',
    liveRow: 'अहिले खेल्दै — तालिकामा लाइभ स्कोर गनिएको छ',
    by: { h2h: 'आपसी खेल', fairplay: 'फेयर प्ले', lots: 'गोला प्रथा' },
    tieNote: (a, b, how) => `${how}का आधारमा ${a} ${b} भन्दा माथि`,
    tieRules: 'बराबर भए: अंक → गोल फरक → गोल संख्या → आपसी खेल → फेयर प्ले → गोला प्रथा।',

    bracketH: 'नकआउट',
    semis: 'सेमिफाइनल',
    finalH: 'फाइनल',
    thirdH: 'तेस्रो स्थानको खेल',
    groupPlace: (g, pos) => `समूह ${g} ${pos === 1 ? 'विजेता' : 'उपविजेता'}`,
    sfWinner: (n) => `सेमि ${n} विजेता`,
    sfLoser: (n) => `सेमि ${n} पराजित`,
    championLabel: 'च्याम्पियन',
    championH: (t) => `${t} हिमाल कप २०२७ को च्याम्पियन!`,
    championSub: 'समापन समारोहमा हलमै ट्रफी र पदक।',
    playAgain: 'दिन फेरि खेलाउनुहोस्',

    fixturesH: 'समय र मैदान अनुसार खेल तालिका',
    fixturesAll: 'सबै खेल',
    fixturesMine: 'मेरो टिम',
    fixturesPickTeam: 'आफ्नो टिमका खेल मात्र हेर्न टिम फलो गर्नुहोस्।',

    scorersH: 'शीर्ष गोलकर्ता',
    playerCol: 'खेलाडी',
    goalsCol: 'गोल',
    noGoals: 'अहिलेसम्म गोल छैन।',
    fairH: 'फेयर प्ले',
    fairNote: 'पहेँलो १ · रातो ३ · कम हुने माथि',
    yellowCol: 'पहेँलो',
    redCol: 'रातो',
    fpCol: 'अंक',

    refH: 'रेफ्री डेस्क',
    refSub: 'मैदान छेउको टेबलका लागि: स्कोर, कार्ड र सिट्ठी — सबैको फोन र हलको टिभी सँगै बदलिन्छ।',
    refPick: 'खेल',
    refLiveNow: 'अहिले लाइभ',
    refStart: 'किक-अफ',
    refHt: 'हाफ टाइम',
    refSecond: 'दोस्रो हाफ सुरु',
    refFt: 'खेल सकियो',
    refGoal: 'गोल',
    refMinus: 'गोल फिर्ता',
    refYellow: 'पहेँलो',
    refRed: 'रातो',
    refUndo: 'अन्तिम फिर्ता',
    refAuto: 'फेरि सिमुलेसनलाई दिनुहोस्',
    refManual: 'सिट्ठी तपाईंको हातमा — यो खेलमा सिमुलेसन चल्दैन।',
    refAutoNote: 'तपाईंले केही नथिचेसम्म यो खेल सिमुलेसनले चलाउँछ।',
    refScorer: (t) => `${t} का लागि कसले गोल गर्‍यो?`,
    refCardFor: (c, t) => `${t} को कुन खेलाडीलाई ${c}?`,
    refCancel: 'रद्द',
    refFlow: 'हरेक थिचाइ तुरुन्तै अंक तालिका र नकआउटमा देखिन्छ।',
    refWaiting: 'टिम तय भइसकेका छैनन्',
    refBusy: 'मैदान अझै खाली छैन',
    refClosed: 'खेल सकियो — यो खेल बन्द भयो।',
    refLog: 'खेलको विवरण',
    refByRef: 'डेस्क',
    refNothing: 'अहिलेसम्म केही लेखिएको छैन।',
    refDone: 'सेभ भयो',

    goalToast: (team, sc, who, min) => `⚽ ${team} को गोल! ${sc} — ${who} ${min}'`,
    cardToast: (c, who, team) => `${c}: ${who} (${team})`,
    ftToast: (a, b) => `खेल सकियो: ${a} — ${b}`,
    champToast: (t) => `🏆 ${t} च्याम्पियन!`,

    joinH: 'टिम दर्ता',
    joinSub: 'अर्को वर्षको कपका लागि। डेमो फारम: यही ब्राउजरमा रहन्छ, केही पनि पठाइँदैन।',
    nameLabel: 'टिमको नाम',
    namePh: 'जस्तै: Machhapuchhre FC Mainz',
    captainLabel: 'कप्तानको पहिलो नाम',
    captainPh: 'जस्तै: सुशील',
    colorsLabel: 'क्लबका रङ',
    color1: 'जर्सी',
    color2: 'किनारा',
    motifLabel: 'चिन्ह',
    motifs: { peak: 'हिमाल', star: 'तारा', sun: 'सूर्य', moon: 'चन्द्रमा' },
    preview: 'चिन्हको झलक',
    submit: 'टिम दर्ता गर्नुहोस्',
    regOk: 'दर्ता भयो (डेमो, केही पठाइएन)',
    regErr: {
      nameShort: 'टिमको नाम लेख्नुहोस्।',
      nameLong: 'नाम अलि लामो भयो — बढीमा ३२ अक्षर।',
      nameTaken: 'यही नामको टिम पहिल्यै छ।',
      captainShort: 'कप्तान को हो? पहिलो नाम मात्र भए पुग्छ।',
      captainLong: 'पहिलो नाम मात्र लेख्नुहोस्।',
      colorsSame: 'दुई फरक रङ छान्नुहोस्।',
      full: 'यो डेमोमा चार दर्ता मात्र — फेरि प्रयास गर्न डेमो सुरुबाट गर्नुहोस्।',
    },
    registeredH: 'यो ब्राउजरमा दर्ता भएका',
    registeredBy: (c) => `कप्तान ${c}`,
    regNone: 'अहिलेसम्म कुनै टिम दर्ता भएको छैन।',
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
  free: string;
};

export const FRAME: Record<Lang, Frame> = {
  en: {
    badge: 'Demo project',
    text: 'Built by MartNepali · a made-up futsal tournament, nothing is sent',
    all: '← All demos',
    kicker: 'MartNepali Studio · Demo project',
    endH: 'Want an app for your tournament or club?',
    endP: 'For a futsal cup, a football weekend or a volleyball day: the schedule by pitch, live scores from the referee’s table, tables that sort themselves, the knockout bracket and a big screen for the hall — in your languages.',
    points: ['Live scores and tables', 'Referee desk and hall TV', 'English, Deutsch, नेपाली'],
    talk: 'Kura garau',
    more: 'See all our work',
    free: 'Free while we grow.',
  },
  de: {
    badge: 'Demo-Projekt',
    text: 'Gebaut von MartNepali · ein erfundenes Futsal-Turnier, nichts wird verschickt',
    all: '← Alle Demos',
    kicker: 'MartNepali Studio · Demo-Projekt',
    endH: 'Eine App für dein Turnier oder deinen Verein?',
    endP: 'Für einen Futsal-Cup, ein Fußball-Wochenende oder einen Volleyball-Tag: der Spielplan nach Feldern, Live-Stände vom Kampfgericht, Tabellen, die sich selbst sortieren, der Turnierbaum und ein großer Bildschirm für die Halle — in deinen Sprachen.',
    points: ['Live-Stände und Tabellen', 'Kampfgericht und Hallen-TV', 'English, Deutsch, नेपाली'],
    talk: 'Kura garau',
    more: 'Alle unsere Arbeiten',
    free: 'Kostenlos, solange wir wachsen.',
  },
  ne: {
    badge: 'डेमो परियोजना',
    text: 'MartNepali ले बनाएको · काल्पनिक फुटसल प्रतियोगिता, केही पनि पठाइँदैन',
    all: '← सबै डेमो',
    kicker: 'MartNepali स्टुडियो · डेमो परियोजना',
    endH: 'आफ्नो प्रतियोगिता वा क्लबका लागि एप चाहिन्छ?',
    endP: 'फुटसल कप, फुटबल सप्ताहान्त वा भलिबल दिवसका लागि: मैदान अनुसार खेल तालिका, रेफ्री टेबलबाट लाइभ स्कोर, आफैँ मिलिने अंक तालिका, नकआउट र हलका लागि ठूलो स्क्रिन — तपाईंकै भाषामा।',
    points: ['लाइभ स्कोर र अंक तालिका', 'रेफ्री डेस्क र हलको टिभी', 'English, Deutsch, नेपाली'],
    talk: 'Kura garau',
    more: 'हाम्रा सबै काम',
    free: 'हामी बढ्दै गर्दा निःशुल्क।',
  },
};
