// Words for the /work/live dashboard in English and नेपाली. The event, the acts
// and the guests are all made up. Counts of tickets and people only — no money.

import type { Act, Channel, Door, LaneStatus, TicketType } from './sim';

export type LiveLang = 'en' | 'ne';

const NE_DIGITS = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
export function toNeDigits(s: string | number): string {
  return String(s).replace(/[0-9]/g, (d) => NE_DIGITS[Number(d)]);
}
/** A number the way the current language writes it (thousands separated, नेपाली digits). */
export function num(n: number, lang: LiveLang): string {
  const s = Math.round(n).toLocaleString('en-US');
  return lang === 'ne' ? toNeDigits(s) : s;
}
export function digits(s: string, lang: LiveLang): string {
  return lang === 'ne' ? toNeDigits(s) : s;
}

type Copy = {
  title: string;
  intro: string;
  show: string;
  venue: string;
  doors: string;
  simulated: string;
  speed: string;
  pause: string;
  play: string;
  restart: string;
  bigScreen: string;
  exitBig: string;
  escHint: string;
  showOver: string;
  replay: string;

  checkedIn: string;
  ofCapacity: (cap: string) => string;
  inHall: string;
  soldToday: string;
  onlineDoor: (online: string, door: string) => string;
  onlineClosed: string;
  onlineOpen: string;
  soldOf: (sold: string, cap: string) => string;
  perMin: string;
  perMinUnit: string;
  last30: string;
  arrivals: string;
  arrivalsSub: string;
  arrivalsBin: (from: string, to: string, n: string) => string;
  arrivalsNow: string;
  types: string;
  typesSub: string;
  type: Record<TicketType, string>;
  doorsTile: string;
  door: (d: Door) => string;
  waiting: (n: string) => string;
  wait: (m: string) => string;
  noWait: string;
  status: Record<LaneStatus, string>;
  table: string;

  feed: string;
  feedSub: string;
  inLine: (code: string, type: string, door: string) => string;
  dupLine: (code: string, door: string, first: string) => string;
  saleLine: (code: string, type: string) => string;
  channel: Record<Channel, string>;
  noneLine: string;
  you: string;

  scanTitle: string;
  scanSub: string;
  scan: string;
  rescan: string;
  dupsToday: (n: string) => string;
  scanOk: (code: string, door: string) => string;
  scanDup: (code: string) => string;

  wall: string;
  wallSub: string;
  yourName: string;
  yourShout: string;
  namePh: string;
  shoutPh: string;
  post: string;
  guest: string;
  shoutErr: Record<'empty' | 'long' | 'rude' | 'link', string>;
  shoutOk: string;
  local: string;

  programme: string;
  nowOnStage: string;
  changeover: string;
  doorsOpen: string;
  beforeDoors: string;
  nextUp: string;
  inMin: (m: string) => string;
  lastAct: string;
  quiet: { doors: string; change: string; end: string };
  acts: Record<Act['id'], { name: string; what: string }>;
};

export const COPY: Record<LiveLang, Copy> = {
  en: {
    title: 'The night, live: an organizer’s dashboard',
    intro:
      'What an organizer watches on the night of a concert, and what can go up on the hall screen: who is in, which door is busy, what is on stage, and the guests’ shout-outs. The data here is simulated — speed it up to see the whole evening.',
    show: 'Tihar Night Live',
    venue: 'Hall A · Hamburg',
    doors: 'Doors 18:00',
    simulated: 'Simulated data',
    speed: 'Speed',
    pause: 'Pause',
    play: 'Play',
    restart: 'Restart',
    bigScreen: 'Big screen mode',
    exitBig: 'Exit big screen',
    escHint: 'Esc to exit',
    showOver: 'That was the night. Everyone home safe.',
    replay: 'Run the evening again',

    checkedIn: 'Checked in',
    ofCapacity: (cap) => `of ${cap} capacity`,
    inHall: 'in the hall',
    soldToday: 'Tickets sold today',
    onlineDoor: (o, d) => `${o} online · ${d} at the door`,
    onlineClosed: 'Online sales closed at 18:00 — box office open',
    onlineOpen: 'Online sales close at 18:00',
    soldOf: (s, c) => `${s} of ${c} sold in total`,
    perMin: 'Entries per minute',
    perMinUnit: 'per min',
    last30: 'last 30 min',
    arrivals: 'Arrivals per 10 minutes',
    arrivalsSub: 'Tickets scanned at both doors, 18:00–22:00',
    arrivalsBin: (f, t, n) => `${f}–${t} · ${n} arrivals`,
    arrivalsNow: 'now',
    types: 'Ticket types in the hall',
    typesSub: 'Share of checked-in tickets',
    type: { standard: 'Standard', vip: 'VIP', family: 'Family' },
    doorsTile: 'Door lanes',
    door: (d) => `Door ${d}`,
    waiting: (n) => `${n} waiting`,
    wait: (m) => `~${m} min`,
    noWait: 'no wait',
    status: { flowing: 'Flowing', busy: 'Busy', long: 'Long queue' },
    table: 'Show as table',

    feed: 'Live feed',
    feedSub: 'Check-ins and sales as they happen',
    inLine: (c, t, d) => `Ticket #${c} · ${t} · ${d}`,
    dupLine: (c, d, f) => `Already scanned · #${c} · ${d} · first in at ${f}`,
    saleLine: (c, t) => `New ticket #${c} · ${t}`,
    channel: { pre: 'Presale', online: 'Online', door: 'Box office' },
    noneLine: 'Everyone with a ticket is already in',
    you: 'you',

    scanTitle: 'Try the door scanner',
    scanSub: 'The same check MartNepali runs at real doors: every ticket gets in once.',
    scan: 'Scan a ticket',
    rescan: 'Scan the same one again',
    dupsToday: (n) => `${n} duplicate scans stopped tonight`,
    scanOk: (c, d) => `✓ #${c} is in · ${d}`,
    scanDup: (c) => `Already scanned: #${c} — not let in twice`,

    wall: 'Shout-outs',
    wallSub: 'Guests’ messages for the hall screen',
    yourName: 'Your name',
    yourShout: 'Your shout-out',
    namePh: 'e.g. Hamburg Didi',
    shoutPh: 'Happy Tihar, everyone!',
    post: 'Post',
    guest: 'Guest',
    shoutErr: {
      empty: 'Write a few words first.',
      long: 'A bit shorter, please — it has to fit the big screen.',
      rude: 'Let’s keep the hall screen family-friendly.',
      link: 'No links on the hall screen, please.',
    },
    shoutOk: 'On the wall!',
    local: 'Stays in your browser — nothing is sent.',

    programme: 'Programme',
    nowOnStage: 'Now on stage',
    changeover: 'Changeover',
    doorsOpen: 'Doors open',
    beforeDoors: 'Doors open soon',
    nextUp: 'Next up',
    inMin: (m) => `in ${m} min`,
    lastAct: 'Last act of the night',
    quiet: { doors: 'Guests arriving', change: 'Stage change', end: 'Good night!' },
    acts: {
      opening: { name: 'Saathi Sound', what: 'Opening band' },
      deusi: { name: 'Deusi-Bhailo', what: 'Tihar songs with the youth group' },
      star: { name: 'Mitho Sur', what: 'Star of the night' },
      party: { name: 'After party', what: 'DJ Momo Beats' },
    },
  },
  ne: {
    title: 'आजको साँझ, लाइभ: आयोजकको ड्यासबोर्ड',
    intro:
      'कन्सर्टको रात आयोजकले हेर्ने र हलको स्क्रिनमा देखाउन मिल्ने सबै कुरा: को-को भित्र आइसके, कुन ढोकामा भीड छ, स्टेजमा को छ, र पाहुनाहरूका सन्देश। यहाँको डाटा नक्कली हो — पूरा साँझ हेर्न गति बढाउनुहोस्।',
    show: 'तिहार नाइट लाइभ',
    venue: 'हल A · हाम्बुर्ग',
    doors: 'ढोका १८:००',
    simulated: 'नक्कली डाटा',
    speed: 'गति',
    pause: 'रोक्नुहोस्',
    play: 'चलाउनुहोस्',
    restart: 'फेरि सुरु',
    bigScreen: 'ठूलो स्क्रिन',
    exitBig: 'ठूलो स्क्रिन बन्द',
    escHint: 'बन्द गर्न Esc',
    showOver: 'साँझ सकियो। सबै सुरक्षित घर पुगून्।',
    replay: 'साँझ फेरि चलाउनुहोस्',

    checkedIn: 'भित्र आइसकेका',
    ofCapacity: (cap) => `${cap} क्षमतामध्ये`,
    inHall: 'हलभित्र',
    soldToday: 'आज बिक्री भएका टिकट',
    onlineDoor: (o, d) => `${o} अनलाइन · ${d} ढोकामा`,
    onlineClosed: 'अनलाइन बिक्री १८:०० मा बन्द — काउन्टर खुला',
    onlineOpen: 'अनलाइन बिक्री १८:०० मा बन्द हुन्छ',
    soldOf: (s, c) => `जम्मा ${c} मध्ये ${s} बिक्री`,
    perMin: 'प्रति मिनेट प्रवेश',
    perMinUnit: 'प्रति मिनेट',
    last30: 'पछिल्लो ३० मिनेट',
    arrivals: 'प्रत्येक १० मिनेटमा आगमन',
    arrivalsSub: 'दुवै ढोकामा स्क्यान भएका टिकट, १८:००–२२:००',
    arrivalsBin: (f, t, n) => `${f}–${t} · ${n} जना`,
    arrivalsNow: 'अहिले',
    types: 'हलभित्र टिकटका प्रकार',
    typesSub: 'भित्र आएका टिकटको हिस्सा',
    type: { standard: 'साधारण', vip: 'भीआईपी', family: 'परिवार' },
    doorsTile: 'ढोकाका लाइन',
    door: (d) => `ढोका ${d}`,
    waiting: (n) => `${n} जना पर्खिरहेका`,
    wait: (m) => `~${m} मिनेट`,
    noWait: 'पर्खनु पर्दैन',
    status: { flowing: 'सजिलो', busy: 'व्यस्त', long: 'लामो लाइन' },
    table: 'तालिकामा हेर्नुहोस्',

    feed: 'लाइभ फिड',
    feedSub: 'चेक-इन र बिक्री, भइरहँदा',
    inLine: (c, t, d) => `टिकट #${c} · ${t} · ${d}`,
    dupLine: (c, d, f) => `पहिल्यै स्क्यान भएको · #${c} · ${d} · पहिलो पटक ${f}`,
    saleLine: (c, t) => `नयाँ टिकट #${c} · ${t}`,
    channel: { pre: 'अग्रिम', online: 'अनलाइन', door: 'काउन्टर' },
    noneLine: 'टिकट भएका सबै भित्र आइसके',
    you: 'तपाईं',

    scanTitle: 'ढोकाको स्क्यानर चलाउनुहोस्',
    scanSub: 'MartNepali ले साँच्चैको ढोकामा गर्ने जाँच: एउटा टिकटमा एक पटक मात्र प्रवेश।',
    scan: 'टिकट स्क्यान गर्नुहोस्',
    rescan: 'उही टिकट फेरि स्क्यान',
    dupsToday: (n) => `आज राति ${n} दोहोरो स्क्यान रोकियो`,
    scanOk: (c, d) => `✓ #${c} भित्र · ${d}`,
    scanDup: (c) => `पहिल्यै स्क्यान भएको: #${c} — दोस्रो पटक प्रवेश छैन`,

    wall: 'शुभकामना भित्ता',
    wallSub: 'हलको स्क्रिनका लागि पाहुनाका सन्देश',
    yourName: 'तपाईंको नाम',
    yourShout: 'तपाईंको सन्देश',
    namePh: 'जस्तै: हाम्बुर्ग दिदी',
    shoutPh: 'सबैलाई तिहारको शुभकामना!',
    post: 'पठाउनुहोस्',
    guest: 'पाहुना',
    shoutErr: {
      empty: 'पहिले केही शब्द लेख्नुहोस्।',
      long: 'अलि छोटो लेख्नुहोस् — ठूलो स्क्रिनमा अटाउनुपर्छ।',
      rude: 'हलको स्क्रिन परिवारमैत्री राखौँ।',
      link: 'हलको स्क्रिनमा लिङ्क राख्न मिल्दैन।',
    },
    shoutOk: 'भित्तामा पुग्यो!',
    local: 'तपाईंकै ब्राउजरमा मात्र रहन्छ — कतै पठाइँदैन।',

    programme: 'कार्यक्रम',
    nowOnStage: 'अहिले स्टेजमा',
    changeover: 'तयारी हुँदैछ',
    doorsOpen: 'ढोका खुला',
    beforeDoors: 'ढोका छिट्टै खुल्दैछ',
    nextUp: 'अर्को',
    inMin: (m) => `${m} मिनेटमा`,
    lastAct: 'आजको अन्तिम कार्यक्रम',
    quiet: { doors: 'पाहुनाहरू आउँदै', change: 'स्टेज तयार हुँदै', end: 'शुभ रात्रि!' },
    acts: {
      opening: { name: 'साथी साउन्ड', what: 'सुरुवाती ब्यान्ड' },
      deusi: { name: 'देउसी-भैलो', what: 'युवा समूहसँग तिहारका गीत' },
      star: { name: 'मिठो सुर', what: 'आजको मुख्य कलाकार' },
      party: { name: 'आफ्टर पार्टी', what: 'डीजे मोमो बिट्स' },
    },
  },
};
