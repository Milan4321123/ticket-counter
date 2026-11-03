// Words for the /work/classes booking app in English, नेपाली and Deutsch.
// The school (Aangan Pathshala, Frankfurt), its teachers, students and address
// are all made up. Classes have no fees — there is no money anywhere in here
// (tests/classBooking.test.ts checks every string for it).

import type { AgeFilter, Level, Room, Subject, TeacherId } from './booking';

export type Lang = 'en' | 'ne' | 'de';
export const LANGS: { id: Lang; label: string }[] = [
  { id: 'en', label: 'EN' },
  { id: 'ne', label: 'नेपाली' },
  { id: 'de', label: 'DE' },
];

const NE_DIGITS = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
export function toNeDigits(s: string | number): string {
  return String(s).replace(/[0-9]/g, (d) => NE_DIGITS[Number(d)]);
}
export function num(n: number | string, lang: Lang): string {
  return lang === 'ne' ? toNeDigits(n) : String(n);
}

export const ADDRESS = 'Am Beispielhof 7, Frankfurt am Main';

type ClassText = { title: string; blurb: string; learn: string[]; bring: string[] };

export type Copy = {
  school: string;
  city: string;
  tagline: string;
  madeUp: string;
  student: string;
  teacher: string;
  langLabel: string;
  tabs: { classes: string; timetable: string; bookings: string; today: string; week: string; notes: string };
  reset: string;
  resetDone: string;
  days: string[];
  daysLong: string[];
  months: string[];
  dateFmt: (wd: string, d: string, m: string) => string;
  rooms: Record<Room, string>;
  subjects: Record<Subject, string>;
  subjectShort: Record<Subject, string>;
  levels: Record<Level, string>;
  ageFilters: Record<AgeFilter, string>;
  ages: (min: string, max: string | null) => string;
  teachers: Record<TeacherId, { name: string; role: string }>;
  classes: Record<string, ClassText>;

  all: string;
  subjectF: string;
  levelF: string;
  dayF: string;
  ageF: string;
  anyLevel: string;
  anyDay: string;
  anyAge: string;
  clear: string;
  count: (n: string) => string;
  none: string;
  spots: (n: string, cap: string) => string;
  oneLeft: string;
  leftShort: (n: string) => string;
  full: string;
  waiting: (n: string) => string;
  minutes: (n: string) => string;
  open: string;

  week: string;
  dayView: string;
  weekView: string;
  ttHint: string;
  now: string;

  learnH: string;
  bringH: string;
  nextH: string;
  noteH: string;
  close: string;
  bookBtn: string;
  waitBtn: string;
  whenH: string;
  trial: string;
  trialSub: string;
  term: string;
  termSub: (n: string) => string;
  pickDate: string;
  yourDates: string;
  termFull: string;
  whoH: string;
  addPerson: string;
  namePh: string;
  nameHelp: string;
  nameErr: string;
  confirmH: string;
  rowClass: string;
  rowWhen: string;
  rowWho: string;
  rowWhere: string;
  confirmBtn: string;
  confirmWait: string;
  back: string;
  next: string;
  step: (n: string, of: string) => string;
  doneH: string;
  doneWait: string;
  waitPos: (n: string) => string;
  waitHelp: string;
  showPass: string;
  addCal: string;
  previewRem: string;
  seeBookings: string;
  dupErr: (who: string, date: string) => string;
  datesErr: string;

  trialTag: string;
  termTag: (n: string) => string;
  waitTag: (n: string) => string;
  checkedIn: string;
  nextLabel: string;
  cancel: string;
  reschedule: string;
  remindBtn: string;
  calBtn: string;
  simulate: string;
  pass: string;
  enlarge: string;
  upcomingH: string;
  notesH: string;
  newBadge: string;
  emptyH: string;
  emptyText: string;
  browse: string;
  cancelledH: string;
  moreDates: (n: string) => string;

  cancelH: string;
  cancelOne: (d: string) => string;
  cancelAll: string;
  cancelTrial: (d: string) => string;
  keep: string;
  cancelYes: string;
  cancelledToast: string;
  reschedH: string;
  reschedOk: (d: string) => string;
  reschedNone: string;

  bookedToast: (who: string, cls: string) => string;
  waitToast: (n: string) => string;
  aheadMoved: string;
  promoted: (who: string, cls: string) => string;
  noteNew: (teacher: string) => string;

  remH: string;
  remSub: string;
  whatsapp: string;
  email: string;
  remChat: string;
  remText: (p: { who: string; cls: string; date: string; time: string; room: string; bring: string; code: string }) => string;
  remNote: (teacher: string, note: string) => string;
  remReply: string;
  emailSubject: (cls: string, time: string) => string;
  emailFrom: string;
  emailTo: string;
  nothingSent: string;

  todayH: string;
  prevDay: string;
  nextDay: string;
  todayBtn: string;
  booked: (n: string, cap: string) => string;
  presentCount: (n: string, m: string) => string;
  waitlistN: (n: string) => string;
  noClasses: string;
  rosterH: string;
  tapHint: string;
  markAll: string;
  scan: string;
  kinds: { term: string; trial: string; guest: string };
  fromYou: string;
  here: string;
  scanH: string;
  scanSub: string;
  scanPasses: string;
  scanNone: string;
  scanOk: (who: string) => string;
  scanAlready: (who: string) => string;
  scanWait: string;
  weekH: string;
  weekSub: string;
  weekTotal: (p: string) => string;
  postH: string;
  notePh: string;
  noteTo: string;
  notePost: string;
  notePosted: (n: string) => string;
  noteErr: string;
  ideas: string;
  ideaList: string[];
  postedH: string;
  seedNotes: Record<string, string>;
  ago: (mins: number) => string;
  footer: string;
};

const EN: Copy = {
  school: 'Aangan Pathshala',
  city: 'Frankfurt',
  tagline: 'Nepali language, dance & music',
  madeUp: 'A made-up school · bookings stay in this browser',
  student: 'Student',
  teacher: 'Teacher view',
  langLabel: 'Language',
  tabs: { classes: 'Classes', timetable: 'Timetable', bookings: 'My bookings', today: 'Today', week: 'Week', notes: 'Notes' },
  reset: 'Reset demo',
  resetDone: 'Demo reset — a fresh week at the school.',
  days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  daysLong: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
  months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  dateFmt: (wd, d, m) => `${wd} ${d} ${m}`,
  rooms: { r1: 'Room 1', r2: 'Room 2', r3: 'Room 3', hall: 'Hall' },
  subjects: { kids: 'Nepali for kids', adults: 'Nepali for adults', dance: 'Dance', madal: 'Madal', harmonium: 'Harmonium' },
  subjectShort: { kids: 'Nepali · kids', adults: 'Nepali · adults', dance: 'Dance', madal: 'Madal', harmonium: 'Harmonium' },
  levels: { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced', all: 'All levels' },
  ageFilters: { kids: 'Kids', teens: 'Teens', adults: 'Adults' },
  ages: (min, max) => (max ? `Ages ${min}–${max}` : `Ages ${min}+`),
  teachers: {
    kamala: { name: 'Kamala Dhakal', role: 'Nepali for kids' },
    ramesh: { name: 'Ramesh Pokharel', role: 'Nepali for adults' },
    anjana: { name: 'Anjana Gurung', role: 'Classical & folk dance' },
    dipesh: { name: 'Dipesh Tamang', role: 'Madal' },
    sushma: { name: 'Sushma Joshi', role: 'Harmonium & singing' },
  },
  classes: {
    'harm-a': {
      title: 'Harmonium for beginners',
      blurb: 'Find the sargam on the keys and play your first bhajan.',
      learn: ['Sa re ga ma on the keys', 'Pumping the bellows evenly', 'A simple bhajan with both hands'],
      bring: ['A notebook', 'A harmonium if you have one (we lend ours)'],
    },
    'adults-a': {
      title: 'Nepali for adults · Beginners',
      blurb: 'Read Devanagari and hold a first conversation — for partners, friends and second-generation Nepalis.',
      learn: ['The Devanagari letters', 'Greetings, family words, numbers', 'Ordering chiya and dal bhat'],
      bring: ['Notebook and pen', 'Nothing else — we hand out the letter chart'],
    },
    classical: {
      title: 'Classical dance',
      blurb: 'Hand gestures, footwork and a short Charya piece from the Kathmandu valley.',
      learn: ['Mudras and what they mean', 'Footwork in taal', 'A short Charya dance'],
      bring: ['Comfortable clothes', 'A scarf (optional)', 'Water'],
    },
    'adults-b': {
      title: 'Nepali conversation',
      blurb: 'Talk more, translate less: everyday Nepali, songs and short news.',
      learn: ['Talking about your week and plans', 'Reading short news and song lyrics', 'Polite forms: tapai, timi, hajur'],
      bring: ['Notebook', 'One question you always wanted to ask in Nepali'],
    },
    'madal-a': {
      title: 'Madal for beginners',
      blurb: 'The heartbeat of Nepali folk music — your first rhythms in four weeks.',
      learn: ['Holding the madal, the basic strokes', 'Jhyaure and Khyali rhythms', 'Playing along with a folk song'],
      bring: ['A madal if you have one (we lend ours)', 'Water'],
    },
    'folk-adults': {
      title: 'Folk dance for adults',
      blurb: 'The steps everyone dances at Dashain and Tihar parties — no experience needed.',
      learn: ['Basic Maruni and Deuda steps', 'Dancing in a circle with others', 'A full dance for the next party'],
      bring: ['Comfortable shoes', 'Water'],
    },
    'kids-a': {
      title: 'Nepali for kids · First letters',
      blurb: 'Letters, songs and stories — Nepali for little ones, through play.',
      learn: ['क ख ग — the first letters, with songs', 'Counting to 20', 'Chatting with hajurba and hajurama'],
      bring: ['Crayons', 'A snack and water'],
    },
    'kids-b': {
      title: 'Nepali for kids · Reading & writing',
      blurb: 'Read short stories and write a first letter to family in Nepal.',
      learn: ['Reading stories aloud', 'Writing simple sentences', 'A short play for the Tihar show'],
      bring: ['Exercise book', 'Pencil case'],
    },
    'folk-kids': {
      title: 'Folk dance for kids',
      blurb: 'Fun steps from across Nepal, for the stage at the school’s Tihar show.',
      learn: ['Steps from hill and Terai dances', 'Moving together as a group', 'A dance for the Tihar show'],
      bring: ['Comfortable clothes', 'Water bottle'],
    },
    'harm-b': {
      title: 'Harmonium & bhajan',
      blurb: 'Sing and play together — bhajans and folk songs for every level.',
      learn: ['Accompanying your own singing', 'Bhajans and well-known folk songs', 'Playing in a small group'],
      bring: ['Your song book if you have one', 'Water'],
    },
    'madal-b': {
      title: 'Madal · Advanced',
      blurb: 'Faster taals, fills and playing with a band.',
      learn: ['Fast and mixed rhythms', 'Fills and endings', 'Playing with harmonium and singers'],
      bring: ['Your own madal', 'Water'],
    },
  },

  all: 'All',
  subjectF: 'Subject',
  levelF: 'Level',
  dayF: 'Day',
  ageF: 'Age',
  anyLevel: 'Any level',
  anyDay: 'Any day',
  anyAge: 'Any age',
  clear: 'Clear filters',
  count: (n) => `${n} classes`,
  none: 'No class matches — try fewer filters.',
  spots: (n, cap) => `${n} of ${cap} spots left`,
  oneLeft: 'Only 1 spot left',
  leftShort: (n) => `${n} left`,
  full: 'Full · waitlist open',
  waiting: (n) => `${n} waiting`,
  minutes: (n) => `${n} min`,
  open: 'Details',

  week: 'This week',
  dayView: 'Day',
  weekView: 'Week',
  ttHint: 'Tap a class for details.',
  now: 'Now',

  learnH: 'What you learn',
  bringH: 'What to bring',
  nextH: 'Next class',
  noteH: 'From the teacher',
  close: 'Close',
  bookBtn: 'Book this class',
  waitBtn: 'Join the waitlist',
  whenH: 'When?',
  trial: 'Trial class',
  trialSub: 'Come once and see',
  term: 'Whole term',
  termSub: (n) => `${n} weeks, same time`,
  pickDate: 'Pick a date',
  yourDates: 'Your dates',
  termFull: 'Some dates are full — you would join the waitlist.',
  whoH: 'Who is coming?',
  addPerson: 'Someone else',
  namePh: 'First name',
  nameHelp: 'A first name is enough. It stays on this device.',
  nameErr: 'Please type a first name (up to 30 letters).',
  confirmH: 'Check and confirm',
  rowClass: 'Class',
  rowWhen: 'When',
  rowWho: 'Who',
  rowWhere: 'Where',
  confirmBtn: 'Confirm booking',
  confirmWait: 'Join the waitlist',
  back: 'Back',
  next: 'Next',
  step: (n, of) => `Step ${n} of ${of}`,
  doneH: 'You’re booked!',
  doneWait: 'You’re on the waitlist',
  waitPos: (n) => `You are number ${n} in line`,
  waitHelp: 'If someone cancels, you move up by yourself — we’ll let you know.',
  showPass: 'Show this pass at the door',
  addCal: 'Add to calendar',
  previewRem: 'Preview reminder',
  seeBookings: 'See my bookings',
  dupErr: (who, date) => `${who} is already booked on ${date}.`,
  datesErr: 'Please pick a date.',

  trialTag: 'Trial',
  termTag: (n) => `Term · ${n} classes`,
  waitTag: (n) => `Waitlist #${n}`,
  checkedIn: 'Checked in',
  nextLabel: 'Next',
  cancel: 'Cancel',
  reschedule: 'Move',
  remindBtn: 'Reminder',
  calBtn: 'Calendar',
  simulate: 'Simulate someone cancelling',
  pass: 'Pass',
  enlarge: 'Show the pass bigger',
  upcomingH: 'Coming up',
  notesH: 'From your teachers',
  newBadge: 'New',
  emptyH: 'No bookings yet',
  emptyText: 'Pick a class and book a trial — it takes four taps.',
  browse: 'Browse classes',
  cancelledH: 'Cancelled',
  moreDates: (n) => `+${n} more`,

  cancelH: 'Cancel the booking?',
  cancelOne: (d) => `Only ${d}`,
  cancelAll: 'The whole term',
  cancelTrial: (d) => `Cancel the trial class on ${d}?`,
  keep: 'Keep it',
  cancelYes: 'Yes, cancel',
  cancelledToast: 'Cancelled. The spot goes to the next person waiting.',
  reschedH: 'Move to another date',
  reschedOk: (d) => `Moved to ${d}.`,
  reschedNone: 'No other date has a free spot right now.',

  bookedToast: (who, cls) => `${who} is booked: ${cls}.`,
  waitToast: (n) => `On the waitlist — you are #${n}.`,
  aheadMoved: 'Someone cancelled — the person ahead of you got the spot. You’re next!',
  promoted: (who, cls) => `Good news! A spot opened — ${who} is now booked for ${cls}.`,
  noteNew: (teacher) => `New note from ${teacher}`,

  remH: 'Reminder preview',
  remSub: 'This goes out the evening before each class.',
  whatsapp: 'WhatsApp',
  email: 'Email',
  remChat: 'Aangan Pathshala',
  remText: (p) =>
    `Namaste! A reminder from Aangan Pathshala: ${p.who} has “${p.cls}” on ${p.date} at ${p.time}, ${p.room}.\n\nPlease bring: ${p.bring}.\n\nPass: ${p.code}`,
  remNote: (teacher, note) => `${teacher} says: “${note}”`,
  remReply: 'Can’t come? Reply CANCEL and the spot goes to someone on the waitlist.',
  emailSubject: (cls, time) => `Tomorrow: ${cls} at ${time}`,
  emailFrom: 'From',
  emailTo: 'To',
  nothingSent: 'Demo preview — nothing is sent.',

  todayH: 'Classes',
  prevDay: 'Previous day',
  nextDay: 'Next day',
  todayBtn: 'Today',
  booked: (n, cap) => `${n}/${cap} booked`,
  presentCount: (n, m) => `${n} of ${m} here`,
  waitlistN: (n) => `${n} on waitlist`,
  noClasses: 'No classes on this day.',
  rosterH: 'Register',
  tapHint: 'Tap a name to mark them present.',
  markAll: 'All present',
  scan: 'Scan QR',
  kinds: { term: 'Term', trial: 'Trial', guest: 'Drop-in' },
  fromYou: 'booked in the student view',
  here: 'Here',
  scanH: 'Scan a pass',
  scanSub: 'Point the camera at a student’s pass.',
  scanPasses: 'Passes from the student view',
  scanNone: 'No pass from the student view for this day. Book this class as a student first, then come back.',
  scanOk: (who) => `${who} is checked in`,
  scanAlready: (who) => `${who} was already checked in`,
  scanWait: 'Hold steady…',
  weekH: 'This week',
  weekSub: 'Who came, out of everyone booked, per day',
  weekTotal: (p) => `${p}% came so far`,
  postH: 'Post a note to a class',
  notePh: 'e.g. Bring your madal on Saturday',
  noteTo: 'To',
  notePost: 'Post note',
  notePosted: (n) => `Posted — ${n} students will see it.`,
  noteErr: 'Write 2–160 characters (no links).',
  ideas: 'Ideas',
  ideaList: ['Bring your madal on Saturday', 'We start 10 minutes later this week', 'This week we meet in Room 2'],
  postedH: 'Notes posted',
  seedNotes: {
    deusi: 'Tihar week: we learn the Deusi song! Please practise the first verse at home.',
    tune: 'Bring your madal on Friday — we tune the straps together before class.',
    bhajan: 'On Sunday we start a new bhajan. Song sheets will be at the door.',
  },
  ago: (m) => (m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.floor(m / 60)} h ago` : `${Math.floor(m / 1440)} d ago`),
  footer: 'Aangan Pathshala is made up for this demo. Everything stays in your browser; nothing is sent.',
};

const NE: Copy = {
  school: 'आँगन पाठशाला',
  city: 'फ्र्याङ्कफर्ट',
  tagline: 'नेपाली भाषा, नाच र संगीत',
  madeUp: 'काल्पनिक पाठशाला · बुकिङ यही ब्राउजरमा रहन्छ',
  student: 'विद्यार्थी',
  teacher: 'शिक्षक भ्यू',
  langLabel: 'भाषा',
  tabs: { classes: 'कक्षाहरू', timetable: 'समय तालिका', bookings: 'मेरो बुकिङ', today: 'आज', week: 'हप्ता', notes: 'सूचना' },
  reset: 'डेमो रिसेट',
  resetDone: 'डेमो सुरुदेखि — पाठशालामा नयाँ हप्ता।',
  days: ['सोम', 'मंगल', 'बुध', 'बिही', 'शुक्र', 'शनि', 'आइत'],
  daysLong: ['सोमबार', 'मंगलबार', 'बुधबार', 'बिहीबार', 'शुक्रबार', 'शनिबार', 'आइतबार'],
  months: ['जनवरी', 'फेब्रुअरी', 'मार्च', 'अप्रिल', 'मे', 'जुन', 'जुलाई', 'अगस्ट', 'सेप्टेम्बर', 'अक्टोबर', 'नोभेम्बर', 'डिसेम्बर'],
  dateFmt: (wd, d, m) => `${wd}, ${m} ${d}`,
  rooms: { r1: 'कोठा १', r2: 'कोठा २', r3: 'कोठा ३', hall: 'हल' },
  subjects: { kids: 'बालबालिकाका लागि नेपाली', adults: 'वयस्कका लागि नेपाली', dance: 'नाच', madal: 'मादल', harmonium: 'हार्मोनियम' },
  subjectShort: { kids: 'नेपाली · बालबालिका', adults: 'नेपाली · वयस्क', dance: 'नाच', madal: 'मादल', harmonium: 'हार्मोनियम' },
  levels: { beginner: 'सुरुवाती', intermediate: 'मध्यम', advanced: 'उच्च', all: 'सबै तह' },
  ageFilters: { kids: 'बालबालिका', teens: 'किशोर', adults: 'वयस्क' },
  ages: (min, max) => (max ? `उमेर ${min}–${max}` : `उमेर ${min}+`),
  teachers: {
    kamala: { name: 'कमला ढकाल', role: 'बालबालिकाका लागि नेपाली' },
    ramesh: { name: 'रमेश पोखरेल', role: 'वयस्कका लागि नेपाली' },
    anjana: { name: 'अञ्जना गुरुङ', role: 'शास्त्रीय र लोक नाच' },
    dipesh: { name: 'दिपेश तामाङ', role: 'मादल' },
    sushma: { name: 'सुष्मा जोशी', role: 'हार्मोनियम र गायन' },
  },
  classes: {
    'harm-a': {
      title: 'हार्मोनियम · सुरुवाती',
      blurb: 'किबोर्डमा सरगम खोज्नुहोस् र पहिलो भजन बजाउनुहोस्।',
      learn: ['किबोर्डमा सा रे ग म', 'धौंकनी बराबर चलाउने', 'दुवै हातले सजिलो भजन'],
      bring: ['एउटा कापी', 'हार्मोनियम भए ल्याउनुहोस् (नभए हामी दिन्छौं)'],
    },
    'adults-a': {
      title: 'वयस्कका लागि नेपाली · सुरुवाती',
      blurb: 'देवनागरी पढ्नुहोस् र पहिलो कुराकानी गर्नुहोस् — जीवनसाथी, साथी र दोस्रो पुस्ताका नेपालीका लागि।',
      learn: ['देवनागरी अक्षर', 'अभिवादन, परिवारका शब्द, अंक', 'चिया र दाल भात मगाउने'],
      bring: ['कापी र कलम', 'अरू केही चाहिँदैन — अक्षर तालिका हामी दिन्छौं'],
    },
    classical: {
      title: 'शास्त्रीय नाच',
      blurb: 'हातका मुद्रा, पाइला र काठमाडौं उपत्यकाको छोटो चर्या नाच।',
      learn: ['मुद्रा र तिनका अर्थ', 'तालमा पाइला', 'छोटो चर्या नाच'],
      bring: ['सजिलो लुगा', 'एउटा पछ्यौरा (चाहे भने)', 'पानी'],
    },
    'adults-b': {
      title: 'नेपाली कुराकानी',
      blurb: 'धेरै बोल्ने, कम अनुवाद गर्ने: दैनिक नेपाली, गीत र छोटा समाचार।',
      learn: ['आफ्नो हप्ता र योजनाबारे कुरा', 'छोटा समाचार र गीतका शब्द पढ्ने', 'आदरका रूप: तपाईं, तिमी, हजुर'],
      bring: ['कापी', 'नेपालीमा सधैं सोध्न मन लागेको एउटा प्रश्न'],
    },
    'madal-a': {
      title: 'मादल · सुरुवाती',
      blurb: 'नेपाली लोक संगीतको मुटुको धड्कन — चार हप्तामा पहिलो ताल।',
      learn: ['मादल समात्ने र आधारभूत थाप', 'झ्याउरे र ख्याली ताल', 'लोकगीतसँगै बजाउने'],
      bring: ['मादल भए ल्याउनुहोस् (नभए हामी दिन्छौं)', 'पानी'],
    },
    'folk-adults': {
      title: 'वयस्कका लागि लोक नाच',
      blurb: 'दशैं-तिहारको रमाइलोमा सबैले नाच्ने पाइला — अनुभव चाहिँदैन।',
      learn: ['मारुनी र देउडाका आधारभूत पाइला', 'घेरामा सबैसँग नाच्ने', 'अर्को रमाइलोका लागि पूरा नाच'],
      bring: ['सजिलो जुत्ता', 'पानी'],
    },
    'kids-a': {
      title: 'बालबालिकाका लागि नेपाली · पहिलो अक्षर',
      blurb: 'अक्षर, गीत र कथा — साना नानीहरूका लागि खेल्दै नेपाली।',
      learn: ['क ख ग — गीतसँगै पहिलो अक्षर', '२० सम्म गन्ती', 'हजुरबा-हजुरआमासँग कुराकानी'],
      bring: ['रङ्गीन पेन्सिल', 'खाजा र पानी'],
    },
    'kids-b': {
      title: 'बालबालिकाका लागि नेपाली · पढाइ र लेखाइ',
      blurb: 'छोटा कथा पढ्नुहोस् र नेपालमा परिवारलाई पहिलो चिठी लेख्नुहोस्।',
      learn: ['कथा ठूलो स्वरले पढ्ने', 'सजिला वाक्य लेख्ने', 'तिहार कार्यक्रमका लागि छोटो नाटक'],
      bring: ['अभ्यास कापी', 'पेन्सिल बाकस'],
    },
    'folk-kids': {
      title: 'बालबालिकाका लागि लोक नाच',
      blurb: 'नेपालभरिका रमाइला पाइला, पाठशालाको तिहार कार्यक्रमको स्टेजका लागि।',
      learn: ['पहाड र तराईका नाचका पाइला', 'समूहमा मिलेर नाच्ने', 'तिहार कार्यक्रमका लागि एउटा नाच'],
      bring: ['सजिलो लुगा', 'पानीको बोतल'],
    },
    'harm-b': {
      title: 'हार्मोनियम र भजन',
      blurb: 'सँगै गाऔं, सँगै बजाऔं — सबै तहका लागि भजन र लोकगीत।',
      learn: ['आफ्नै गायनसँग बजाउने', 'भजन र चर्चित लोकगीत', 'सानो समूहमा बजाउने'],
      bring: ['गीतको किताब भए', 'पानी'],
    },
    'madal-b': {
      title: 'मादल · उच्च',
      blurb: 'छिटा ताल, भराइ र ब्यान्डसँग बजाउने।',
      learn: ['छिटो र मिश्रित ताल', 'भराइ र अन्त्य', 'हार्मोनियम र गायकसँग बजाउने'],
      bring: ['आफ्नै मादल', 'पानी'],
    },
  },

  all: 'सबै',
  subjectF: 'विषय',
  levelF: 'तह',
  dayF: 'दिन',
  ageF: 'उमेर',
  anyLevel: 'जुनसुकै तह',
  anyDay: 'जुनसुकै दिन',
  anyAge: 'जुनसुकै उमेर',
  clear: 'फिल्टर हटाउनुहोस्',
  count: (n) => `${n} कक्षा`,
  none: 'कुनै कक्षा मिलेन — कम फिल्टर लगाएर हेर्नुहोस्।',
  spots: (n, cap) => `${cap} मध्ये ${n} ठाउँ बाँकी`,
  oneLeft: 'एउटा मात्र ठाउँ बाँकी',
  leftShort: (n) => `${n} बाँकी`,
  full: 'भरिएको · प्रतीक्षा सूची खुला',
  waiting: (n) => `${n} जना पर्खिरहेका`,
  minutes: (n) => `${n} मिनेट`,
  open: 'विवरण',

  week: 'यो हप्ता',
  dayView: 'दिन',
  weekView: 'हप्ता',
  ttHint: 'विवरणका लागि कक्षामा ट्याप गर्नुहोस्।',
  now: 'अहिले',

  learnH: 'के सिकिन्छ',
  bringH: 'के ल्याउने',
  nextH: 'अर्को कक्षा',
  noteH: 'शिक्षकको सूचना',
  close: 'बन्द',
  bookBtn: 'यो कक्षा बुक गर्नुहोस्',
  waitBtn: 'प्रतीक्षा सूचीमा नाम लेखाउनुहोस्',
  whenH: 'कहिले?',
  trial: 'परीक्षण कक्षा',
  trialSub: 'एक पटक आएर हेर्नुहोस्',
  term: 'पूरा सत्र',
  termSub: (n) => `${n} हप्ता, उही समय`,
  pickDate: 'मिति छान्नुहोस्',
  yourDates: 'तपाईंका मितिहरू',
  termFull: 'केही मिति भरिएका छन् — तपाईं प्रतीक्षा सूचीमा पर्नुहुनेछ।',
  whoH: 'को आउँदै हुनुहुन्छ?',
  addPerson: 'अरू कोही',
  namePh: 'पहिलो नाम',
  nameHelp: 'पहिलो नाम मात्र पुग्छ। यो यही उपकरणमा रहन्छ।',
  nameErr: 'कृपया पहिलो नाम लेख्नुहोस् (३० अक्षरसम्म)।',
  confirmH: 'जाँचेर पक्का गर्नुहोस्',
  rowClass: 'कक्षा',
  rowWhen: 'कहिले',
  rowWho: 'को',
  rowWhere: 'कहाँ',
  confirmBtn: 'बुकिङ पक्का गर्नुहोस्',
  confirmWait: 'प्रतीक्षा सूचीमा जानुहोस्',
  back: 'पछाडि',
  next: 'अगाडि',
  step: (n, of) => `चरण ${n} / ${of}`,
  doneH: 'बुक भयो!',
  doneWait: 'तपाईं प्रतीक्षा सूचीमा हुनुहुन्छ',
  waitPos: (n) => `लाइनमा तपाईं ${n} नम्बरमा हुनुहुन्छ`,
  waitHelp: 'कसैले रद्द गरे तपाईं आफैँ माथि सर्नुहुन्छ — हामी खबर गर्छौं।',
  showPass: 'ढोकामा यो पास देखाउनुहोस्',
  addCal: 'क्यालेन्डरमा थप्नुहोस्',
  previewRem: 'रिमाइन्डर हेर्नुहोस्',
  seeBookings: 'मेरो बुकिङ हेर्नुहोस्',
  dupErr: (who, date) => `${who} ${date} मा पहिल्यै बुक हुनुहुन्छ।`,
  datesErr: 'कृपया मिति छान्नुहोस्।',

  trialTag: 'परीक्षण',
  termTag: (n) => `सत्र · ${n} कक्षा`,
  waitTag: (n) => `प्रतीक्षा #${n}`,
  checkedIn: 'हाजिर भयो',
  nextLabel: 'अर्को',
  cancel: 'रद्द',
  reschedule: 'सार्नुहोस्',
  remindBtn: 'रिमाइन्डर',
  calBtn: 'क्यालेन्डर',
  simulate: 'कसैले रद्द गरेको देखाउनुहोस्',
  pass: 'पास',
  enlarge: 'पास ठूलो गरी हेर्नुहोस्',
  upcomingH: 'आउँदै गरेका कक्षा',
  notesH: 'शिक्षकहरूबाट',
  newBadge: 'नयाँ',
  emptyH: 'अहिलेसम्म बुकिङ छैन',
  emptyText: 'एउटा कक्षा छानेर परीक्षण बुक गर्नुहोस् — चार ट्याप मात्र।',
  browse: 'कक्षाहरू हेर्नुहोस्',
  cancelledH: 'रद्द गरिएका',
  moreDates: (n) => `+${n} थप`,

  cancelH: 'बुकिङ रद्द गर्ने?',
  cancelOne: (d) => `${d} मात्र`,
  cancelAll: 'पूरा सत्र',
  cancelTrial: (d) => `${d} को परीक्षण कक्षा रद्द गर्ने?`,
  keep: 'राख्नुहोस्',
  cancelYes: 'हो, रद्द गर्नुहोस्',
  cancelledToast: 'रद्द भयो। ठाउँ प्रतीक्षामा रहेका अर्को व्यक्तिलाई जान्छ।',
  reschedH: 'अर्को मितिमा सार्नुहोस्',
  reschedOk: (d) => `${d} मा सारियो।`,
  reschedNone: 'अहिले अरू कुनै मितिमा ठाउँ खाली छैन।',

  bookedToast: (who, cls) => `${who} बुक हुनुभयो: ${cls}।`,
  waitToast: (n) => `प्रतीक्षा सूचीमा — तपाईं #${n} हुनुहुन्छ।`,
  aheadMoved: 'कसैले रद्द गर्नुभयो — तपाईंभन्दा अगाडिकालाई ठाउँ मिल्यो। अब तपाईंकै पालो!',
  promoted: (who, cls) => `खुसीको खबर! ठाउँ खुल्यो — ${who} अब ${cls} मा बुक हुनुभयो।`,
  noteNew: (teacher) => `${teacher} बाट नयाँ सूचना`,

  remH: 'रिमाइन्डरको नमुना',
  remSub: 'हरेक कक्षाको अघिल्लो साँझ यस्तो सन्देश जान्छ।',
  whatsapp: 'WhatsApp',
  email: 'इमेल',
  remChat: 'आँगन पाठशाला',
  remText: (p) =>
    `नमस्ते! आँगन पाठशालाबाट सम्झना: ${p.who} को “${p.cls}” कक्षा ${p.date}, ${p.time} बजे, ${p.room} मा छ।\n\nल्याउनुहोस्: ${p.bring}।\n\nपास: ${p.code}`,
  remNote: (teacher, note) => `${teacher} भन्नुहुन्छ: “${note}”`,
  remReply: 'आउन सक्नुहुन्न? CANCEL लेखेर जवाफ दिनुहोस्, ठाउँ प्रतीक्षामा रहेकालाई जान्छ।',
  emailSubject: (cls, time) => `भोलि: ${cls}, ${time} बजे`,
  emailFrom: 'पठाउने',
  emailTo: 'पाउने',
  nothingSent: 'डेमो नमुना — केही पनि पठाइँदैन।',

  todayH: 'कक्षाहरू',
  prevDay: 'अघिल्लो दिन',
  nextDay: 'अर्को दिन',
  todayBtn: 'आज',
  booked: (n, cap) => `${n}/${cap} बुक`,
  presentCount: (n, m) => `${m} मध्ये ${n} आए`,
  waitlistN: (n) => `${n} प्रतीक्षामा`,
  noClasses: 'यो दिन कक्षा छैन।',
  rosterH: 'हाजिरी',
  tapHint: 'हाजिर गर्न नाममा ट्याप गर्नुहोस्।',
  markAll: 'सबै हाजिर',
  scan: 'QR स्क्यान',
  kinds: { term: 'सत्र', trial: 'परीक्षण', guest: 'एक दिने' },
  fromYou: 'विद्यार्थी भ्यूबाट बुक',
  here: 'हाजिर',
  scanH: 'पास स्क्यान',
  scanSub: 'क्यामेरा विद्यार्थीको पासतिर फर्काउनुहोस्।',
  scanPasses: 'विद्यार्थी भ्यूका पासहरू',
  scanNone: 'यो दिनका लागि विद्यार्थी भ्यूबाट कुनै पास छैन। पहिले विद्यार्थी भएर यो कक्षा बुक गर्नुहोस्।',
  scanOk: (who) => `${who} हाजिर भयो`,
  scanAlready: (who) => `${who} पहिल्यै हाजिर छ`,
  scanWait: 'स्थिर राख्नुहोस्…',
  weekH: 'यो हप्ता',
  weekSub: 'दिनअनुसार, बुक गरेकामध्ये को आए',
  weekTotal: (p) => `अहिलेसम्म ${p}% आए`,
  postH: 'कक्षालाई सूचना पठाउनुहोस्',
  notePh: 'जस्तै: शनिबार मादल ल्याउनुहोस्',
  noteTo: 'कक्षा',
  notePost: 'सूचना पोस्ट गर्नुहोस्',
  notePosted: (n) => `पोस्ट भयो — ${n} विद्यार्थीले देख्नेछन्।`,
  noteErr: '२ देखि १६० अक्षर लेख्नुहोस् (लिङ्क बिना)।',
  ideas: 'सुझाव',
  ideaList: ['शनिबार मादल ल्याउनुहोस्', 'यो हप्ता १० मिनेट ढिलो सुरु हुन्छ', 'यो हप्ता कोठा २ मा भेटौं'],
  postedH: 'पोस्ट गरिएका सूचना',
  seedNotes: {
    deusi: 'तिहारको हप्ता: हामी देउसी गीत सिक्दैछौं! घरमा पहिलो अन्तरा अभ्यास गर्नुहोस्।',
    tune: 'शुक्रबार मादल ल्याउनुहोस् — कक्षाअघि सँगै डोरी मिलाउँछौं।',
    bhajan: 'आइतबार नयाँ भजन सुरु गर्दैछौं। गीतका पाना ढोकामै पाउनुहुनेछ।',
  },
  ago: (m) =>
    m < 1
      ? 'भर्खरै'
      : m < 60
        ? `${toNeDigits(m)} मिनेट अघि`
        : m < 1440
          ? `${toNeDigits(Math.floor(m / 60))} घण्टा अघि`
          : `${toNeDigits(Math.floor(m / 1440))} दिन अघि`,
  footer: 'आँगन पाठशाला यो डेमोका लागि बनाइएको काल्पनिक पाठशाला हो। सबै कुरा तपाईंकै ब्राउजरमा रहन्छ; केही पठाइँदैन।',
};

const DE: Copy = {
  school: 'Aangan Pathshala',
  city: 'Frankfurt',
  tagline: 'Nepali, Tanz & Musik',
  madeUp: 'Eine erfundene Schule · Buchungen bleiben in diesem Browser',
  student: 'Teilnehmende',
  teacher: 'Lehrer-Ansicht',
  langLabel: 'Sprache',
  tabs: { classes: 'Kurse', timetable: 'Stundenplan', bookings: 'Meine Buchungen', today: 'Heute', week: 'Woche', notes: 'Hinweise' },
  reset: 'Demo zurücksetzen',
  resetDone: 'Demo zurückgesetzt — eine frische Woche in der Schule.',
  days: ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'],
  daysLong: ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'],
  months: ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sep.', 'Okt.', 'Nov.', 'Dez.'],
  dateFmt: (wd, d, m) => `${wd}, ${d}. ${m}`,
  rooms: { r1: 'Raum 1', r2: 'Raum 2', r3: 'Raum 3', hall: 'Saal' },
  subjects: { kids: 'Nepali für Kinder', adults: 'Nepali für Erwachsene', dance: 'Tanz', madal: 'Madal', harmonium: 'Harmonium' },
  subjectShort: { kids: 'Nepali · Kinder', adults: 'Nepali · Erwachsene', dance: 'Tanz', madal: 'Madal', harmonium: 'Harmonium' },
  levels: { beginner: 'Anfänger', intermediate: 'Mittelstufe', advanced: 'Fortgeschritten', all: 'Alle Stufen' },
  ageFilters: { kids: 'Kinder', teens: 'Jugendliche', adults: 'Erwachsene' },
  ages: (min, max) => (max ? `${min}–${max} Jahre` : `ab ${min} Jahren`),
  teachers: {
    kamala: { name: 'Kamala Dhakal', role: 'Nepali für Kinder' },
    ramesh: { name: 'Ramesh Pokharel', role: 'Nepali für Erwachsene' },
    anjana: { name: 'Anjana Gurung', role: 'Klassischer & Volkstanz' },
    dipesh: { name: 'Dipesh Tamang', role: 'Madal' },
    sushma: { name: 'Sushma Joshi', role: 'Harmonium & Gesang' },
  },
  classes: {
    'harm-a': {
      title: 'Harmonium für Anfänger',
      blurb: 'Das Sargam auf den Tasten finden und den ersten Bhajan spielen.',
      learn: ['Sa re ga ma auf den Tasten', 'Den Balg gleichmäßig pumpen', 'Ein einfacher Bhajan mit beiden Händen'],
      bring: ['Ein Heft', 'Ein Harmonium, falls vorhanden (sonst leihen wir eins)'],
    },
    'adults-a': {
      title: 'Nepali für Erwachsene · Anfänger',
      blurb: 'Devanagari lesen und ein erstes Gespräch führen — für Partner, Freunde und Nepalis der zweiten Generation.',
      learn: ['Die Devanagari-Buchstaben', 'Begrüßung, Familie, Zahlen', 'Chiya und Dal Bhat bestellen'],
      bring: ['Heft und Stift', 'Sonst nichts — die Buchstabentafel bekommst du von uns'],
    },
    classical: {
      title: 'Klassischer Tanz',
      blurb: 'Handgesten, Fußarbeit und ein kurzes Charya-Stück aus dem Kathmandutal.',
      learn: ['Mudras und ihre Bedeutung', 'Fußarbeit im Taal', 'Ein kurzer Charya-Tanz'],
      bring: ['Bequeme Kleidung', 'Ein Tuch (optional)', 'Wasser'],
    },
    'adults-b': {
      title: 'Nepali-Konversation',
      blurb: 'Mehr sprechen, weniger übersetzen: Alltags-Nepali, Lieder und kurze Nachrichten.',
      learn: ['Über die Woche und Pläne sprechen', 'Kurze Nachrichten und Liedtexte lesen', 'Höflichkeitsformen: tapai, timi, hajur'],
      bring: ['Heft', 'Eine Frage, die du schon immer auf Nepali stellen wolltest'],
    },
    'madal-a': {
      title: 'Madal für Anfänger',
      blurb: 'Der Herzschlag der nepalesischen Volksmusik — erste Rhythmen in vier Wochen.',
      learn: ['Madal halten, die Grundschläge', 'Jhyaure- und Khyali-Rhythmen', 'Zu einem Volkslied mitspielen'],
      bring: ['Eine Madal, falls vorhanden (sonst leihen wir eine)', 'Wasser'],
    },
    'folk-adults': {
      title: 'Volkstanz für Erwachsene',
      blurb: 'Die Schritte, die auf jeder Dashain- und Tihar-Feier getanzt werden — ohne Vorkenntnisse.',
      learn: ['Grundschritte von Maruni und Deuda', 'Im Kreis mit anderen tanzen', 'Ein ganzer Tanz für die nächste Feier'],
      bring: ['Bequeme Schuhe', 'Wasser'],
    },
    'kids-a': {
      title: 'Nepali für Kinder · Erste Buchstaben',
      blurb: 'Buchstaben, Lieder und Geschichten — Nepali für die Kleinen, spielerisch.',
      learn: ['क ख ग — die ersten Buchstaben mit Liedern', 'Zählen bis 20', 'Plaudern mit Hajurba und Hajurama'],
      bring: ['Buntstifte', 'Snack und Wasser'],
    },
    'kids-b': {
      title: 'Nepali für Kinder · Lesen & Schreiben',
      blurb: 'Kurze Geschichten lesen und einen ersten Brief an die Familie in Nepal schreiben.',
      learn: ['Geschichten laut vorlesen', 'Einfache Sätze schreiben', 'Ein kleines Theaterstück für die Tihar-Feier'],
      bring: ['Schulheft', 'Federmäppchen'],
    },
    'folk-kids': {
      title: 'Volkstanz für Kinder',
      blurb: 'Fröhliche Schritte aus ganz Nepal, für die Bühne bei der Tihar-Feier der Schule.',
      learn: ['Schritte aus Berg- und Terai-Tänzen', 'Gemeinsam als Gruppe tanzen', 'Ein Tanz für die Tihar-Feier'],
      bring: ['Bequeme Kleidung', 'Trinkflasche'],
    },
    'harm-b': {
      title: 'Harmonium & Bhajan',
      blurb: 'Gemeinsam singen und spielen — Bhajans und Volkslieder für alle Stufen.',
      learn: ['Den eigenen Gesang begleiten', 'Bhajans und bekannte Volkslieder', 'In einer kleinen Gruppe spielen'],
      bring: ['Dein Liederbuch, falls vorhanden', 'Wasser'],
    },
    'madal-b': {
      title: 'Madal · Fortgeschritten',
      blurb: 'Schnellere Taals, Fills und Spielen mit einer Band.',
      learn: ['Schnelle und gemischte Rhythmen', 'Fills und Schlüsse', 'Mit Harmonium und Gesang spielen'],
      bring: ['Eigene Madal', 'Wasser'],
    },
  },

  all: 'Alle',
  subjectF: 'Fach',
  levelF: 'Stufe',
  dayF: 'Tag',
  ageF: 'Alter',
  anyLevel: 'Jede Stufe',
  anyDay: 'Jeder Tag',
  anyAge: 'Jedes Alter',
  clear: 'Filter löschen',
  count: (n) => `${n} Kurse`,
  none: 'Kein Kurs passt — versuch es mit weniger Filtern.',
  spots: (n, cap) => `${n} von ${cap} Plätzen frei`,
  oneLeft: 'Nur noch 1 Platz frei',
  leftShort: (n) => `${n} frei`,
  full: 'Voll · Warteliste offen',
  waiting: (n) => `${n} warten`,
  minutes: (n) => `${n} Min.`,
  open: 'Details',

  week: 'Diese Woche',
  dayView: 'Tag',
  weekView: 'Woche',
  ttHint: 'Tippe auf einen Kurs für Details.',
  now: 'Jetzt',

  learnH: 'Was du lernst',
  bringH: 'Was du mitbringst',
  nextH: 'Nächster Termin',
  noteH: 'Von der Lehrkraft',
  close: 'Schließen',
  bookBtn: 'Diesen Kurs buchen',
  waitBtn: 'Auf die Warteliste',
  whenH: 'Wann?',
  trial: 'Probestunde',
  trialSub: 'Einmal kommen und schauen',
  term: 'Ganzes Semester',
  termSub: (n) => `${n} Wochen, gleiche Zeit`,
  pickDate: 'Datum wählen',
  yourDates: 'Deine Termine',
  termFull: 'Einige Termine sind voll — du kämst auf die Warteliste.',
  whoH: 'Wer kommt?',
  addPerson: 'Jemand anderes',
  namePh: 'Vorname',
  nameHelp: 'Ein Vorname reicht. Er bleibt auf diesem Gerät.',
  nameErr: 'Bitte einen Vornamen eingeben (bis 30 Zeichen).',
  confirmH: 'Prüfen und bestätigen',
  rowClass: 'Kurs',
  rowWhen: 'Wann',
  rowWho: 'Wer',
  rowWhere: 'Wo',
  confirmBtn: 'Buchung bestätigen',
  confirmWait: 'Auf die Warteliste',
  back: 'Zurück',
  next: 'Weiter',
  step: (n, of) => `Schritt ${n} von ${of}`,
  doneH: 'Gebucht!',
  doneWait: 'Du stehst auf der Warteliste',
  waitPos: (n) => `Du bist Nummer ${n} in der Reihe`,
  waitHelp: 'Sagt jemand ab, rückst du automatisch nach — wir sagen Bescheid.',
  showPass: 'Zeig diesen Pass an der Tür',
  addCal: 'Zum Kalender',
  previewRem: 'Erinnerung ansehen',
  seeBookings: 'Meine Buchungen',
  dupErr: (who, date) => `${who} ist am ${date} schon gebucht.`,
  datesErr: 'Bitte ein Datum wählen.',

  trialTag: 'Probe',
  termTag: (n) => `Semester · ${n} Termine`,
  waitTag: (n) => `Warteliste #${n}`,
  checkedIn: 'Eingecheckt',
  nextLabel: 'Nächster',
  cancel: 'Absagen',
  reschedule: 'Verlegen',
  remindBtn: 'Erinnerung',
  calBtn: 'Kalender',
  simulate: 'Absage simulieren',
  pass: 'Pass',
  enlarge: 'Pass größer zeigen',
  upcomingH: 'Demnächst',
  notesH: 'Von euren Lehrkräften',
  newBadge: 'Neu',
  emptyH: 'Noch keine Buchungen',
  emptyText: 'Such dir einen Kurs aus und buch eine Probestunde — vier Tipps genügen.',
  browse: 'Kurse ansehen',
  cancelledH: 'Abgesagt',
  moreDates: (n) => `+${n} weitere`,

  cancelH: 'Buchung absagen?',
  cancelOne: (d) => `Nur ${d}`,
  cancelAll: 'Das ganze Semester',
  cancelTrial: (d) => `Probestunde am ${d} absagen?`,
  keep: 'Behalten',
  cancelYes: 'Ja, absagen',
  cancelledToast: 'Abgesagt. Der Platz geht an die nächste Person auf der Warteliste.',
  reschedH: 'Auf einen anderen Termin verlegen',
  reschedOk: (d) => `Verlegt auf ${d}.`,
  reschedNone: 'Gerade ist an keinem anderen Termin ein Platz frei.',

  bookedToast: (who, cls) => `${who} ist gebucht: ${cls}.`,
  waitToast: (n) => `Auf der Warteliste — du bist #${n}.`,
  aheadMoved: 'Jemand hat abgesagt — die Person vor dir hat den Platz bekommen. Du bist als Nächstes dran!',
  promoted: (who, cls) => `Gute Nachricht! Ein Platz ist frei geworden — ${who} ist jetzt gebucht: ${cls}.`,
  noteNew: (teacher) => `Neuer Hinweis von ${teacher}`,

  remH: 'Vorschau der Erinnerung',
  remSub: 'Geht am Abend vor jedem Termin raus.',
  whatsapp: 'WhatsApp',
  email: 'E-Mail',
  remChat: 'Aangan Pathshala',
  remText: (p) =>
    `Namaste! Eine Erinnerung von Aangan Pathshala: ${p.who} hat „${p.cls}“ am ${p.date} um ${p.time} Uhr, ${p.room}.\n\nBitte mitbringen: ${p.bring}.\n\nPass: ${p.code}`,
  remNote: (teacher, note) => `${teacher} schreibt: „${note}“`,
  remReply: 'Kein Termin möglich? Antworte ABSAGEN und der Platz geht an die Warteliste.',
  emailSubject: (cls, time) => `Morgen: ${cls} um ${time} Uhr`,
  emailFrom: 'Von',
  emailTo: 'An',
  nothingSent: 'Demo-Vorschau — es wird nichts verschickt.',

  todayH: 'Kurse',
  prevDay: 'Vorheriger Tag',
  nextDay: 'Nächster Tag',
  todayBtn: 'Heute',
  booked: (n, cap) => `${n}/${cap} gebucht`,
  presentCount: (n, m) => `${n} von ${m} da`,
  waitlistN: (n) => `${n} auf Warteliste`,
  noClasses: 'An diesem Tag gibt es keine Kurse.',
  rosterH: 'Anwesenheit',
  tapHint: 'Tippe auf einen Namen, um ihn als anwesend zu markieren.',
  markAll: 'Alle da',
  scan: 'QR scannen',
  kinds: { term: 'Semester', trial: 'Probe', guest: 'Gast' },
  fromYou: 'in der Teilnehmer-Ansicht gebucht',
  here: 'Da',
  scanH: 'Pass scannen',
  scanSub: 'Halte die Kamera auf den Pass.',
  scanPasses: 'Pässe aus der Teilnehmer-Ansicht',
  scanNone: 'Für diesen Tag gibt es keinen Pass aus der Teilnehmer-Ansicht. Buch zuerst diesen Kurs als Teilnehmer.',
  scanOk: (who) => `${who} ist eingecheckt`,
  scanAlready: (who) => `${who} war schon eingecheckt`,
  scanWait: 'Ruhig halten…',
  weekH: 'Diese Woche',
  weekSub: 'Wer da war, von allen Gebuchten, pro Tag',
  weekTotal: (p) => `bisher ${p}% da`,
  postH: 'Hinweis an einen Kurs',
  notePh: 'z. B. Bringt am Samstag eure Madal mit',
  noteTo: 'An',
  notePost: 'Hinweis senden',
  notePosted: (n) => `Gepostet — ${n} Teilnehmende sehen ihn.`,
  noteErr: '2–160 Zeichen, bitte ohne Links.',
  ideas: 'Ideen',
  ideaList: ['Bringt am Samstag eure Madal mit', 'Diese Woche starten wir 10 Minuten später', 'Diese Woche treffen wir uns in Raum 2'],
  postedH: 'Gepostete Hinweise',
  seedNotes: {
    deusi: 'Tihar-Woche: Wir lernen das Deusi-Lied! Bitte übt zu Hause die erste Strophe.',
    tune: 'Bringt am Freitag eure Madal mit — vor dem Kurs stimmen wir gemeinsam die Schnüre.',
    bhajan: 'Am Sonntag beginnen wir einen neuen Bhajan. Die Liedblätter liegen an der Tür.',
  },
  ago: (m) => (m < 1 ? 'gerade eben' : m < 60 ? `vor ${m} Min.` : m < 1440 ? `vor ${Math.floor(m / 60)} Std.` : `vor ${Math.floor(m / 1440)} Tg.`),
  footer: 'Aangan Pathshala ist für diese Demo erfunden. Alles bleibt in deinem Browser; nichts wird verschickt.',
};

export const COPY: Record<Lang, Copy> = { en: EN, ne: NE, de: DE };

/** "Sat 7 Nov" / "शनि, नोभेम्बर ७" / "Sa, 7. Nov." */
export function fmtDate(iso: string, lang: Lang, long = false): string {
  const [y, m, d] = iso.split('-').map(Number);
  const wd = (new Date(y, m - 1, d).getDay() + 6) % 7;
  const t = COPY[lang];
  return t.dateFmt(long ? t.daysLong[wd] : t.days[wd], num(d, lang), t.months[m - 1]);
}
export function fmtTime(min: number, lang: Lang): string {
  const s = `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
  return num(s, lang);
}
