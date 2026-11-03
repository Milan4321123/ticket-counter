// Words for the /work/samaj association website in English, Deutsch and नेपाली.
// The association (Saathi Samaj Main-Neckar e.V.), its committee, its town,
// its news and its documents are all made up. There is no money anywhere in
// here — no fees, dues, bank details or amounts (tests/samajSite.test.ts checks
// every string for it).

import type { EmblemShape, EventId, EventKind, EventDef, FieldError, Lang, LookId, PollOption, Relation, Rsvp, StepId } from './samaj';

export const LANGS: { id: Lang; label: string; full: string }[] = [
  { id: 'en', label: 'EN', full: 'English' },
  { id: 'de', label: 'DE', full: 'Deutsch' },
  { id: 'ne', label: 'नेपाली', full: 'नेपाली' },
];

const NE_DIGITS = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
export function num(n: number | string, lang: Lang): string {
  return lang === 'ne' ? String(n).replace(/[0-9]/g, (d) => NE_DIGITS[Number(d)]) : String(n);
}

export const EMAIL = 'info@saathi-samaj.example';
export const ADDRESS = 'Musterstraße 12, 64000 Musterstadt';

export type PersonId = 'kamala' | 'rajendra' | 'sabina' | 'dipak' | 'anish' | 'pooja' | 'nabin' | 'laxmi';
export const PEOPLE: { id: PersonId; name: string }[] = [
  { id: 'kamala', name: 'Kamala Shrestha' },
  { id: 'rajendra', name: 'Rajendra Lama' },
  { id: 'sabina', name: 'Sabina Rai' },
  { id: 'dipak', name: 'Dipak Gurung' },
  { id: 'anish', name: 'Anish Magar' },
  { id: 'pooja', name: 'Pooja Tamang' },
  { id: 'nabin', name: 'Nabin Thapa' },
  { id: 'laxmi', name: 'Laxmi Poudel' },
];

export type NewsId = 'website' | 'dashain26' | 'school' | 'sports' | 'agm';
export const NEWS_DATES: Record<NewsId, string> = {
  website: '2026-11-01',
  dashain26: '2026-10-27',
  school: '2026-10-19',
  sports: '2026-10-08',
  agm: '2026-09-30',
};
export const NEWS_ORDER: NewsId[] = ['website', 'dashain26', 'school', 'sports', 'agm'];
export type NewsTag = 'club' | 'festival' | 'school' | 'sports';
export const NEWS_TAG: Record<NewsId, NewsTag> = { website: 'club', dashain26: 'festival', school: 'school', sports: 'sports', agm: 'club' };

export type GalleryId = 'kites' | 'diyo' | 'rangoli' | 'teej' | 'newyear' | 'sports' | 'school' | 'deusi';
export const GALLERY: GalleryId[] = ['kites', 'diyo', 'rangoli', 'teej', 'newyear', 'sports', 'school', 'deusi'];

export type DocId = 'minutes' | 'programme' | 'helpers';
export const DOCS: DocId[] = ['minutes', 'programme', 'helpers'];

type Article = { title: string; excerpt: string; body: string[] };
type Doc = { title: string; meta: string; body: string[] };

export type Copy = {
  langName: string;
  orgName: string;
  orgSub: string;
  kit: {
    label: string;
    hint: string;
    look: string;
    looks: Record<LookId, string>;
    logo: string;
    reset: string;
    resetDone: string;
    lang: string;
  };
  nav: { label: string; home: string; programme: string; news: string; about: string; join: string; members: string; gallery: string; contact: string };
  hero: {
    kicker: string;
    title: string;
    mission: string;
    stats: string[];
    next: string;
    inDays: (n: string) => string;
    today: string;
    details: string;
    quick: string;
    quickJoin: string;
    quickProgramme: string;
    quickMembers: string;
    quickContact: string;
  };
  pillars: { title: string; text: string }[];
  ev: {
    title: string;
    sub: string;
    month: string;
    list: string;
    prev: string;
    next: string;
    tickets: string;
    ticketsNote: string;
    school: string;
    schoolLine: string;
    schoolWhen: string;
    legendEvent: string;
    legendSchool: string;
    nothing: string;
    pick: string;
    kinds: Record<EventKind, string>;
    places: Record<EventDef['place'], string>;
    items: Record<EventId, { title: string; blurb: string }>;
  };
  news: { title: string; sub: string; read: string; back: string; tags: Record<NewsTag, string>; items: Record<NewsId, Article> };
  about: {
    title: string;
    intro: string;
    committee: string;
    committeeNote: string;
    roles: Record<PersonId, { native: string; role: string }>;
    statutes: string;
    statutesNote: string;
    statuteItems: { h: string; p: string }[];
    history: string;
    historyItems: { year: number; text: string }[];
  };
  join: {
    title: string;
    sub: string;
    steps: Record<StepId, string>;
    stepOf: (i: string, n: string) => string;
    first: string;
    last: string;
    email: string;
    phone: string;
    optional: string;
    town: string;
    familyIntro: string;
    familyNone: string;
    familyAdd: string;
    familyMax: string;
    familyName: string;
    familyRelation: string;
    familyBorn: string;
    familyRemove: string;
    relations: Record<Relation, string>;
    consentData: string;
    consentDataMore: string;
    photosQ: string;
    photosYes: string;
    photosNo: string;
    photosMore: string;
    newsletter: string;
    reviewIntro: string;
    edit: string;
    back: string;
    nextStep: string;
    submit: string;
    errors: Record<FieldError, string>;
    fixFirst: string;
    doneTitle: (first: string) => string;
    doneText: string;
    number: string;
    print: string;
    download: string;
    toMembers: string;
    nothingSent: string;
    already: (n: string) => string;
    again: string;
    yes: string;
    no: string;
    joinedOn: string;
    confirmTitle: string;
    consentLine: string;
    welcome: (first: string) => string;
    demoNote: string;
    footer: string;
    newsletterLabel: string;
    photosLabel: string;
  };
  members: {
    title: string;
    sub: string;
    lockedTitle: string;
    lockedText: string;
    login: string;
    loginNote: string;
    logout: string;
    hello: (first: string) => string;
    demoName: string;
    card: string;
    since: (y: string) => string;
    cardHint: string;
    qrLabel: string;
    rsvpTitle: string;
    rsvp: Record<Rsvp, string>;
    people: string;
    fewer: string;
    more: string;
    going: (n: string) => string;
    yourAnswer: Record<Rsvp, (n: string) => string>;
    docsTitle: string;
    open: string;
    downloadTxt: string;
    docs: Record<DocId, Doc>;
    pollTitle: string;
    pollQ: string;
    pollVote: string;
    pollVoted: (o: string) => string;
    pollChange: string;
    pollVotes: (n: string) => string;
    pollLeader: (o: string) => string;
    pollOptions: Record<PollOption, string>;
    pollHint: string;
  };
  gallery: { title: string; sub: string; drawn: string; items: Record<GalleryId, string>; close: string; prev: string; next: string };
  contact: {
    title: string;
    sub: string;
    name: string;
    email: string;
    message: string;
    send: string;
    sent: string;
    where: string;
    whereText: string;
    mailUs: string;
    impressum: string;
    example: string;
    impressumLines: string[];
    privacy: string;
  };
  logo: {
    title: string;
    initials: string;
    initialsHint: string;
    fromName: string;
    ring: string;
    shape: string;
    shapes: Record<EmblemShape, string>;
    colours: string;
    download: string;
    done: string;
    saved: string;
  };
  footer: { line: string; example: string; top: string };
  close: string;
  days: string[];
  daysLong: string[];
  months: string[];
  monthsShort: string[];
  fmtDate: (wd: string, d: string, m: string, y: string) => string;
  fmtShort: (wd: string, d: string, m: string) => string;
  time: (a: string, b: string) => string;
};

const en: Copy = {
  langName: 'English',
  orgName: 'Saathi Samaj Main-Neckar e.V.',
  orgSub: 'Nepali association · since 2012',
  kit: {
    label: 'Website kit',
    hint: 'One kit, any Verein: switch the look, make a logo, change the language.',
    look: 'Look',
    looks: { himalaya: 'Himalaya', dhaka: 'Dhaka', modern: 'Modern' },
    logo: 'Make a logo',
    reset: 'Reset demo',
    resetDone: 'Demo reset — everything is back to the start.',
    lang: 'Language',
  },
  nav: { label: 'Sections', home: 'Home', programme: 'Programme', news: 'News', about: 'About us', join: 'Join', members: 'Members', gallery: 'Gallery', contact: 'Contact' },
  hero: {
    kicker: 'Nepali association · Main-Neckar',
    title: 'A home for Nepali families between Main and Neckar',
    mission:
      'We keep our festivals, our language and our friendships alive — and help everyone who has just arrived find their feet in Germany. Open to every Nepali family and every friend of Nepal.',
    stats: ['Since 2012', '150 households', '9 gatherings a year', 'Nepali school every Saturday'],
    next: 'Next event',
    inDays: (n) => `in ${n} days`,
    today: 'today',
    details: 'See the programme',
    quick: 'Quick links',
    quickJoin: 'Become a member',
    quickProgramme: 'Programme 2027',
    quickMembers: 'Members’ area',
    quickContact: 'Contact us',
  },
  pillars: [
    { title: 'Festivals', text: 'Dashain, Tihar, Teej, Holi and New Year — together, with tika, food and dance.' },
    { title: 'Nepali school', text: 'Every Saturday morning: reading, writing and songs for children from 5 to 14.' },
    { title: 'Sports & youth', text: 'A sports day each summer, football on Sundays and a youth group that plans its own nights.' },
    { title: 'Help for newcomers', text: 'Anmeldung, finding a flat, the first winter — someone who has done it walks with you.' },
  ],
  ev: {
    title: 'Programme 2027',
    sub: 'Our gatherings for the year. Festivals land on the nearest weekend so everyone can come.',
    month: 'Month',
    list: 'List',
    prev: 'Previous month',
    next: 'Next month',
    tickets: 'Tickets on MartNepali →',
    ticketsNote: 'Tickets for our events are sold on MartNepali — in this demo the button opens the real MartNepali events page.',
    school: 'Nepali school',
    schoolLine: 'Nepali language school for children',
    schoolWhen: 'Every Saturday 10:00–12:00 · January to July and September to December · not on festival days',
    legendEvent: 'Event',
    legendSchool: 'Nepali school',
    nothing: 'No event this month — the Nepali school still meets on Saturdays.',
    pick: 'Tap a day with a dot to see what is on.',
    kinds: { festival: 'Festival', sports: 'Sports', school: 'School', meeting: 'Members’ meeting', community: 'Get-together' },
    places: {
      hall: 'Saalbau Lindenhof, Musterstadt',
      club: 'Our club room, Musterstraße 12',
      park: 'Stadtpark Musterstadt, big meadow',
      field: 'Sportplatz am Fluss, Musterstadt',
      tbd: 'Members choose the place in the poll',
    },
    items: {
      maghe: { title: 'Maghe Sankranti get-together', blurb: 'Ghee, chaku and sweet potatoes, songs and a warm room in the middle of January.' },
      agm: { title: 'Annual general meeting', blurb: 'The Jahreshauptversammlung: reports from the committee, the plan for the year and questions from members.' },
      holi: { title: 'Holi in the park', blurb: 'Colours, music and snacks. Wear white clothes you do not mind turning into a painting.' },
      newyear: { title: 'Nepali New Year 2084', blurb: 'Naya Barsha with a cultural programme, the school children’s dance and dinner together.' },
      sports: { title: 'Sports day', blurb: 'Football, volleyball, tug of war, dandi biyo and races for the little ones. Teams from every town.' },
      picnic: { title: 'Summer picnic', blurb: 'Food from every kitchen, games and a long afternoon outside. Where? Members decide in the poll.' },
      teej: { title: 'Teej celebration', blurb: 'Red saris, dar, songs and dancing — the evening belongs to the women of the community.' },
      dashain: { title: 'Dashain milan', blurb: 'Tika and jamara from the elders, a cultural programme, dinner and the year’s biggest hall.' },
      tihar: { title: 'Tihar & Deusi-Bhailo night', blurb: 'Diyo lights, rangoli at the door, deusi-bhailo groups and a dance floor until late.' },
    },
  },
  news: {
    title: 'News',
    sub: 'Announcements from the committee.',
    read: 'Read more',
    back: '← All news',
    tags: { club: 'Association', festival: 'Festival', school: 'Nepali school', sports: 'Sports' },
    items: {
      website: {
        title: 'Our new website is live',
        excerpt: 'Programme, membership and the members’ area — now in English, Deutsch and नेपाली.',
        body: [
          'After many evenings of discussion, Saathi Samaj finally has a website that works on every phone. You will find the whole programme for 2027, the news from the committee and a membership form that takes five minutes.',
          'Members can log in to see their member card, answer invitations, read the minutes of the general meeting and vote in polls — starting with the big question of where this summer’s picnic should be.',
          'Something missing or wrong? Write to the secretary — the site is ours, and we will keep improving it together.',
        ],
      },
      dashain26: {
        title: 'Dhanyabad for a wonderful Dashain',
        excerpt: 'More than 300 guests, 40 volunteers and tika from our elders until late in the evening.',
        body: [
          'Dashain milan 2026 was our biggest gathering yet. The hall was full by six, the elders gave tika and jamara for almost three hours, and the school children opened the programme with a dance they had practised since August.',
          'A huge thank-you to the 40 volunteers in the kitchen, at the door and on the stage, and to everyone who stayed to stack the chairs.',
          'Pictures from the evening are in the gallery. See you at Tihar!',
        ],
      },
      school: {
        title: 'Nepali school: the new term starts on 9 January',
        excerpt: 'Three groups by age, new reading books and a song for New Year.',
        body: [
          'The Saturday school starts again on 9 January 2027, 10:00–12:00 in our club room. This term we teach in three groups: first letters (5–7), reading (8–10) and writing stories (11–14).',
          'New this year: reading books from Kathmandu for every child to keep, and a song the children will sing on stage at New Year.',
          'Parents who would like to help as teachers are very welcome — speak to Laxmi Poudel.',
        ],
      },
      sports: {
        title: 'Sports day 2027: teams wanted',
        excerpt: 'Football, volleyball and tug of war on 26 June — register a team from your town.',
        body: [
          'The sports day is back on 26 June 2027 at the Sportplatz am Fluss. Football and volleyball for teams of six, tug of war for anyone brave enough, and races for the children.',
          'Every town in the region can send a team. Tell Nabin Thapa your team name and a contact person by the end of April.',
        ],
      },
      agm: {
        title: 'Save the date: general meeting on 14 March',
        excerpt: 'Reports, the plan for 2027 and the election of the committee.',
        body: [
          'Our annual general meeting (Jahreshauptversammlung) will be on Sunday, 14 March 2027 at 14:00 in the club room. The invitation with the agenda follows by email four weeks before.',
          'This year the whole committee is elected. If you would like to stand, or want to put a topic on the agenda, write to the secretary by 14 February.',
        ],
      },
    },
  },
  about: {
    title: 'About us',
    intro:
      'Saathi Samaj Main-Neckar e.V. is a registered, non-profit association of Nepali families and friends of Nepal in the region between Main and Neckar. We are run entirely by volunteers, and every member has one voice.',
    committee: 'Our committee',
    committeeNote: 'Elected by the general meeting for two years. Names and faces are made up for this demo.',
    roles: {
      kamala: { native: 'Adhyaksha', role: 'President' },
      rajendra: { native: 'Upadhyaksha', role: 'Vice-president' },
      sabina: { native: 'Sachiv', role: 'Secretary' },
      dipak: { native: 'Koshadhyaksha', role: 'Treasurer' },
      anish: { native: 'Sah-sachiv', role: 'Joint secretary' },
      pooja: { native: 'Sanskritik samyojak', role: 'Culture & festivals' },
      nabin: { native: 'Khelkud samyojak', role: 'Sports & youth' },
      laxmi: { native: 'Pathshala samyojak', role: 'Nepali school' },
    },
    statutes: 'Our statutes in short',
    statutesNote: 'A summary of the Satzung. The full text is in the members’ area.',
    statuteItems: [
      { h: '§1 Name and seat', p: 'The association is called Saathi Samaj Main-Neckar e.V., is registered in the Vereinsregister and has its seat in Musterstadt.' },
      { h: '§2 Purpose', p: 'Keeping Nepali culture and language alive, bringing people together across cultures and helping newcomers settle in. The association is non-profit and politically and religiously neutral.' },
      { h: '§3 Membership', p: 'Anyone who supports the purpose can join, with their family. Membership starts when the committee confirms the application and ends by a written note at any time.' },
      { h: '§4 Bodies', p: 'The general meeting (Mitgliederversammlung) and the committee (Vorstand). The committee is elected every two years.' },
      { h: '§5 General meeting', p: 'Meets once a year, invited four weeks ahead by email. Decisions by simple majority; changes to the statutes need two thirds.' },
      { h: '§6 Data protection', p: 'Members’ data is used only for the association’s work, never passed on, and deleted when the membership ends.' },
      { h: '§7 Dissolution', p: 'Can only be decided by a general meeting with a three-quarters majority.' },
    ],
    history: 'Our story',
    historyItems: [
      { year: 2012, text: 'Nine families celebrate Dashain together in a living room — and decide to meet every month.' },
      { year: 2014, text: 'First Dashain in a hall: 200 guests, one rice cooker too few.' },
      { year: 2016, text: 'The Saturday Nepali school starts with eleven children and one whiteboard.' },
      { year: 2019, text: 'Registered as an association (e.V.) with a statute and an elected committee.' },
      { year: 2020, text: 'Tihar online: deusi-bhailo over video call, sweets delivered to 60 doors.' },
      { year: 2023, text: 'The first sports day: eight teams from five towns.' },
      { year: 2026, text: 'Our own website in three languages, with a members’ area.' },
    ],
  },
  join: {
    title: 'Become a member',
    sub: 'Five minutes, four short steps. Your whole family can join with you.',
    steps: { personal: 'You', family: 'Family', consent: 'Consent', review: 'Check' },
    stepOf: (i, n) => `Step ${i} of ${n}`,
    first: 'First name',
    last: 'Last name',
    email: 'Email',
    phone: 'Phone',
    optional: 'optional',
    town: 'Town',
    familyIntro: 'Add family members who should be members too (up to 6). You can skip this step.',
    familyNone: 'No family members added — that is fine.',
    familyAdd: '+ Add a family member',
    familyMax: 'That is the most this form takes — tell the secretary about more.',
    familyName: 'Name',
    familyRelation: 'Relation',
    familyBorn: 'Year of birth',
    familyRemove: 'Remove',
    relations: { spouse: 'Spouse / partner', child: 'Child', parent: 'Parent', sibling: 'Brother / sister', other: 'Other' },
    consentData:
      'I agree that Saathi Samaj stores my details and those of my family for the association’s work (DSGVO). They are never passed on and are deleted when the membership ends.',
    consentDataMore: 'Required — the association cannot keep a membership without it.',
    photosQ: 'Photos at events',
    photosYes: 'Yes — photos of me and my family may appear in the gallery and on our social media.',
    photosNo: 'No — please keep us out of published photos.',
    photosMore: 'You can change this any time by writing to the secretary.',
    newsletter: 'Send me the programme and news by email (about once a month).',
    reviewIntro: 'Please check everything before you send it to the committee.',
    edit: 'Edit',
    back: '← Back',
    nextStep: 'Next →',
    submit: 'Become a member',
    errors: {
      required: 'Please fill this in.',
      name: 'Letters, spaces and hyphens only.',
      email: 'That does not look like an email address.',
      phone: 'Digits, spaces and + only.',
      year: 'A year like 2015.',
      tooLong: 'That is too long.',
      consent: 'Please agree, or the association cannot keep your membership.',
      choose: 'Please choose one.',
    },
    fixFirst: 'Please fix the marked fields first.',
    doneTitle: (first) => `Swagat chha, ${first}!`,
    doneText: 'Your membership is confirmed. Keep your confirmation — print it or save it as a file.',
    number: 'Member number',
    print: 'Print',
    download: 'Download confirmation',
    toMembers: 'Open the members’ area →',
    nothingSent: 'Nothing was sent — this demo kept everything on your device. On a real site the committee would receive your application.',
    already: (n) => `You are member ${n}.`,
    again: 'Fill in the form again',
    yes: 'Yes',
    no: 'No',
    joinedOn: 'Member since',
    confirmTitle: 'Membership confirmation',
    consentLine: 'You agreed to the storage of your details for the association’s work (DSGVO).',
    welcome: (first) => `Namaste ${first}, welcome to Saathi Samaj Main-Neckar e.V. We are happy to have you and your family with us.`,
    demoNote: 'Demo — this association is made up and nothing was sent anywhere. Built by MartNepali.',
    footer: 'Saathi Samaj Main-Neckar e.V. (example) · Musterstraße 12, 64000 Musterstadt',
    newsletterLabel: 'Programme by email',
    photosLabel: 'Photos at events',
  },
  members: {
    title: 'Members’ area',
    sub: 'Your card, invitations, documents and polls.',
    lockedTitle: 'For members only',
    lockedText: 'Members log in to see their member card, answer invitations, read the minutes and vote in polls.',
    login: 'Log in as demo member',
    loginNote: 'No password needed — this is a demo.',
    logout: 'Log out',
    hello: (first) => `Namaste, ${first}!`,
    demoName: 'Demo Member',
    card: 'Member card',
    since: (y) => `Member since ${y}`,
    cardHint: 'Show the code at the door — the volunteers scan it.',
    qrLabel: 'QR code of your member card',
    rsvpTitle: 'Coming along?',
    rsvp: { yes: 'Going', maybe: 'Maybe', no: 'Can’t come' },
    people: 'People',
    fewer: 'One fewer',
    more: 'One more',
    going: (n) => `${n} members going`,
    yourAnswer: {
      yes: (n) => `You are going with ${n}.`,
      maybe: () => 'You said maybe.',
      no: () => 'You can’t come this time.',
    },
    docsTitle: 'Documents',
    open: 'Open',
    downloadTxt: 'Download (.txt)',
    docs: {
      minutes: {
        title: 'Minutes of the general meeting 2026',
        meta: 'Jahreshauptversammlung · 15 March 2026 · made up for this demo',
        body: [
          'Present: 64 members. Chair: Kamala Shrestha. Minutes: Sabina Rai.',
          '1. Welcome. The president welcomes the members; the meeting was invited in time and has a quorum.',
          '2. Report of the committee. Nine gatherings in 2025, 312 guests at Dashain, a new youth group of 18.',
          '3. Nepali school. 34 children in three groups; four parents now teach as volunteers.',
          '4. Plans for 2026. A website in three languages, a second sports day team from Mannstadt, help desk for newcomers on the first Sunday of each month.',
          '5. Elections. Not due this year (next: 2027).',
          '6. Any other business. Members ask for a summer picnic — the committee will put the place to a poll.',
          'End of meeting: 16:40.',
        ],
      },
      programme: {
        title: 'Programme 2027 (overview)',
        meta: 'All dates · for the fridge door',
        body: [],
      },
      helpers: {
        title: 'Helping at Dashain: who does what',
        meta: 'Volunteer guide · updated September 2026',
        body: [
          'Kitchen (from 12:00): rice, dal, tarkari and achar for 300. Lead: Pooja Tamang.',
          'Door (from 15:30): welcome guests, scan tickets and member cards on the phone. Lead: Anish Magar.',
          'Stage (from 14:00): sound check, the programme running order, the school children’s dance. Lead: Rajendra Lama.',
          'Tika corner: chairs for the elders, jamara, red tika, a quiet place. Lead: Kamala Shrestha.',
          'After 23:00: everyone helps stack chairs — it takes 20 minutes with 30 people.',
        ],
      },
    },
    pollTitle: 'Poll',
    pollQ: 'Where should the summer picnic be?',
    pollVote: 'Vote',
    pollVoted: (o) => `You voted for ${o}. You can change your vote until 30 April.`,
    pollChange: 'Change vote',
    pollVotes: (n) => `${n} votes`,
    pollLeader: (o) => `Leading: ${o}`,
    pollOptions: { riverside: 'Riverside meadow', citypark: 'City park', lake: 'Lake with a beach', forest: 'Forest barbecue hut' },
    pollHint: 'One vote per member. Results update as you vote.',
  },
  gallery: {
    title: 'Gallery',
    sub: 'Moments from our year.',
    drawn: 'Drawn pictures for this demo — no photos of real people.',
    items: {
      kites: 'Dashain kites over the Main',
      diyo: 'Diyo lights at Tihar',
      rangoli: 'Rangoli at the club room door',
      teej: 'Teej evening — red and gold',
      newyear: 'Sunrise for Nepali New Year',
      sports: 'Sports day final',
      school: 'Saturday school: क ख ग',
      deusi: 'Deusi-Bhailo night',
    },
    close: 'Close',
    prev: 'Previous picture',
    next: 'Next picture',
  },
  contact: {
    title: 'Contact',
    sub: 'Questions, ideas, or want to help at the next festival? Write to us.',
    name: 'Your name',
    email: 'Your email',
    message: 'Message',
    send: 'Send',
    sent: 'Nothing was sent — this is a demo. On a real site your message would reach the committee’s inbox.',
    where: 'Where to find us',
    whereText: 'Club room, Musterstraße 12, 64000 Musterstadt · Saturdays 10:00–13:00',
    mailUs: 'Email',
    impressum: 'Impressum',
    example: 'Example — replace with your association’s details',
    impressumLines: [
      'Saathi Samaj Main-Neckar e.V. (example)',
      'Musterstraße 12, 64000 Musterstadt',
      'Vereinsregister: Amtsgericht Musterstadt, VR 0000 (example)',
      'Represented by the committee (§ 26 BGB): Kamala Shrestha, Rajendra Lama (made-up names)',
      'Contact: info@saathi-samaj.example',
    ],
    privacy: 'Privacy: this demo stores nothing on a server. What you type stays in your own browser until you press Reset demo.',
  },
  logo: {
    title: 'Logo maker',
    initials: 'Initials',
    initialsHint: 'Up to 3 letters — Latin or देवनागरी.',
    fromName: 'From the name',
    ring: 'Name on the ring',
    shape: 'Symbol',
    shapes: { peaks: 'Himal', lotus: 'Lotus', sun: 'Sun', star: 'Star' },
    colours: 'The colours follow the look — switch the look to recolour the logo.',
    download: 'Download SVG',
    done: 'Done',
    saved: 'The new logo is in the header now.',
  },
  footer: { line: 'Saathi Samaj Main-Neckar e.V. · Nepali association since 2012', example: 'An example site — the association is made up.', top: 'Back to top ↑' },
  close: 'Close',
  days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  daysLong: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
  months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  monthsShort: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  fmtDate: (wd, d, m, y) => `${wd} ${d} ${m} ${y}`,
  fmtShort: (wd, d, m) => `${wd} ${d} ${m}`,
  time: (a, b) => `${a}–${b}`,
};

const de: Copy = {
  langName: 'Deutsch',
  orgName: 'Saathi Samaj Main-Neckar e.V.',
  orgSub: 'Nepalischer Verein · seit 2012',
  kit: {
    label: 'Website-Baukasten',
    hint: 'Ein Baukasten für jeden Verein: Look wechseln, Logo machen, Sprache umstellen.',
    look: 'Look',
    looks: { himalaya: 'Himalaya', dhaka: 'Dhaka', modern: 'Modern' },
    logo: 'Logo machen',
    reset: 'Demo zurücksetzen',
    resetDone: 'Demo zurückgesetzt — alles ist wieder wie am Anfang.',
    lang: 'Sprache',
  },
  nav: { label: 'Bereiche', home: 'Start', programme: 'Programm', news: 'Neuigkeiten', about: 'Über uns', join: 'Mitglied werden', members: 'Mitglieder', gallery: 'Galerie', contact: 'Kontakt' },
  hero: {
    kicker: 'Nepalischer Verein · Main-Neckar',
    title: 'Ein Zuhause für nepalische Familien zwischen Main und Neckar',
    mission:
      'Wir halten unsere Feste, unsere Sprache und unsere Freundschaften lebendig — und helfen allen, die gerade erst angekommen sind, in Deutschland Fuß zu fassen. Offen für jede nepalische Familie und alle Freundinnen und Freunde Nepals.',
    stats: ['Seit 2012', '150 Haushalte', '9 Treffen im Jahr', 'Nepali-Schule jeden Samstag'],
    next: 'Nächstes Treffen',
    inDays: (n) => `in ${n} Tagen`,
    today: 'heute',
    details: 'Zum Programm',
    quick: 'Schnellzugriff',
    quickJoin: 'Mitglied werden',
    quickProgramme: 'Programm 2027',
    quickMembers: 'Mitgliederbereich',
    quickContact: 'Kontakt',
  },
  pillars: [
    { title: 'Feste', text: 'Dashain, Tihar, Teej, Holi und Neujahr — gemeinsam, mit Tika, Essen und Tanz.' },
    { title: 'Nepali-Schule', text: 'Jeden Samstagvormittag: Lesen, Schreiben und Lieder für Kinder von 5 bis 14.' },
    { title: 'Sport & Jugend', text: 'Ein Sporttag jeden Sommer, sonntags Fußball und eine Jugendgruppe, die ihre eigenen Abende plant.' },
    { title: 'Hilfe für Neue', text: 'Anmeldung, Wohnungssuche, der erste Winter — jemand, der es schon geschafft hat, geht mit.' },
  ],
  ev: {
    title: 'Programm 2027',
    sub: 'Unsere Treffen im Jahr. Feste legen wir aufs nächste Wochenende, damit alle kommen können.',
    month: 'Monat',
    list: 'Liste',
    prev: 'Vorheriger Monat',
    next: 'Nächster Monat',
    tickets: 'Tickets auf MartNepali →',
    ticketsNote: 'Tickets für unsere Veranstaltungen gibt es auf MartNepali — in dieser Demo öffnet der Button die echte Veranstaltungsseite von MartNepali.',
    school: 'Nepali-Schule',
    schoolLine: 'Nepali-Sprachschule für Kinder',
    schoolWhen: 'Jeden Samstag 10:00–12:00 · Januar bis Juli und September bis Dezember · nicht an Festtagen',
    legendEvent: 'Veranstaltung',
    legendSchool: 'Nepali-Schule',
    nothing: 'In diesem Monat kein Treffen — die Nepali-Schule läuft samstags trotzdem.',
    pick: 'Tippe auf einen Tag mit Punkt, um zu sehen, was los ist.',
    kinds: { festival: 'Fest', sports: 'Sport', school: 'Schule', meeting: 'Mitgliederversammlung', community: 'Treffen' },
    places: {
      hall: 'Saalbau Lindenhof, Musterstadt',
      club: 'Unser Vereinsraum, Musterstraße 12',
      park: 'Stadtpark Musterstadt, große Wiese',
      field: 'Sportplatz am Fluss, Musterstadt',
      tbd: 'Den Ort wählen die Mitglieder in der Umfrage',
    },
    items: {
      maghe: { title: 'Maghe-Sankranti-Treffen', blurb: 'Ghee, Chaku und Süßkartoffeln, Lieder und ein warmer Raum mitten im Januar.' },
      agm: { title: 'Jahreshauptversammlung', blurb: 'Berichte des Vorstands, der Plan fürs Jahr und Fragen der Mitglieder.' },
      holi: { title: 'Holi im Park', blurb: 'Farben, Musik und Snacks. Weiße Kleidung anziehen, die ein Kunstwerk werden darf.' },
      newyear: { title: 'Nepalisches Neujahr 2084', blurb: 'Naya Barsha mit Kulturprogramm, dem Tanz der Schulkinder und gemeinsamem Abendessen.' },
      sports: { title: 'Sporttag', blurb: 'Fußball, Volleyball, Tauziehen, Dandi Biyo und Wettläufe für die Kleinen. Teams aus jeder Stadt.' },
      picnic: { title: 'Sommerpicknick', blurb: 'Essen aus jeder Küche, Spiele und ein langer Nachmittag draußen. Wo? Das entscheiden die Mitglieder in der Umfrage.' },
      teej: { title: 'Teej-Fest', blurb: 'Rote Saris, Dar, Lieder und Tanz — der Abend gehört den Frauen der Gemeinschaft.' },
      dashain: { title: 'Dashain Milan', blurb: 'Tika und Jamara von den Älteren, Kulturprogramm, Abendessen und der größte Saal des Jahres.' },
      tihar: { title: 'Tihar- & Deusi-Bhailo-Abend', blurb: 'Diyo-Lichter, Rangoli an der Tür, Deusi-Bhailo-Gruppen und eine Tanzfläche bis spät.' },
    },
  },
  news: {
    title: 'Neuigkeiten',
    sub: 'Mitteilungen des Vorstands.',
    read: 'Weiterlesen',
    back: '← Alle Neuigkeiten',
    tags: { club: 'Verein', festival: 'Fest', school: 'Nepali-Schule', sports: 'Sport' },
    items: {
      website: {
        title: 'Unsere neue Website ist online',
        excerpt: 'Programm, Mitgliedschaft und Mitgliederbereich — jetzt auf Englisch, Deutsch und Nepali.',
        body: [
          'Nach vielen Abenden voller Diskussionen hat Saathi Samaj endlich eine Website, die auf jedem Handy funktioniert. Hier findet ihr das ganze Programm 2027, die Neuigkeiten des Vorstands und ein Mitgliedsformular, das fünf Minuten dauert.',
          'Mitglieder können sich einloggen, ihren Mitgliedsausweis sehen, Einladungen beantworten, das Protokoll der Jahreshauptversammlung lesen und abstimmen — zuerst über die große Frage, wo das Sommerpicknick stattfinden soll.',
          'Fehlt etwas oder stimmt etwas nicht? Schreibt der Schriftführerin — die Seite gehört uns allen, und wir verbessern sie gemeinsam.',
        ],
      },
      dashain26: {
        title: 'Dhanyabad für ein wunderbares Dashain',
        excerpt: 'Über 300 Gäste, 40 Helferinnen und Helfer und Tika von unseren Älteren bis spät am Abend.',
        body: [
          'Dashain Milan 2026 war unser bisher größtes Treffen. Um sechs war der Saal voll, die Älteren gaben fast drei Stunden lang Tika und Jamara, und die Schulkinder eröffneten das Programm mit einem Tanz, den sie seit August geübt hatten.',
          'Ein riesiges Dankeschön an die 40 Helferinnen und Helfer in der Küche, am Eingang und auf der Bühne — und an alle, die zum Stühlestapeln geblieben sind.',
          'Bilder vom Abend sind in der Galerie. Bis zu Tihar!',
        ],
      },
      school: {
        title: 'Nepali-Schule: Das neue Halbjahr beginnt am 9. Januar',
        excerpt: 'Drei Gruppen nach Alter, neue Lesebücher und ein Lied für Neujahr.',
        body: [
          'Die Samstagsschule beginnt wieder am 9. Januar 2027, 10:00–12:00 in unserem Vereinsraum. Dieses Halbjahr unterrichten wir in drei Gruppen: erste Buchstaben (5–7), Lesen (8–10) und Geschichten schreiben (11–14).',
          'Neu in diesem Jahr: Lesebücher aus Kathmandu, die jedes Kind behalten darf, und ein Lied, das die Kinder an Neujahr auf der Bühne singen.',
          'Eltern, die als Lehrkraft mithelfen möchten, sind sehr willkommen — sprecht Laxmi Poudel an.',
        ],
      },
      sports: {
        title: 'Sporttag 2027: Teams gesucht',
        excerpt: 'Fußball, Volleyball und Tauziehen am 26. Juni — meldet ein Team aus eurer Stadt.',
        body: [
          'Der Sporttag ist zurück: am 26. Juni 2027 auf dem Sportplatz am Fluss. Fußball und Volleyball für Sechserteams, Tauziehen für alle Mutigen und Wettläufe für die Kinder.',
          'Jede Stadt der Region kann ein Team schicken. Sagt Nabin Thapa bis Ende April euren Teamnamen und eine Ansprechperson.',
        ],
      },
      agm: {
        title: 'Termin vormerken: Jahreshauptversammlung am 14. März',
        excerpt: 'Berichte, der Plan für 2027 und die Wahl des Vorstands.',
        body: [
          'Unsere Jahreshauptversammlung findet am Sonntag, 14. März 2027 um 14:00 im Vereinsraum statt. Die Einladung mit der Tagesordnung kommt vier Wochen vorher per E-Mail.',
          'Dieses Jahr wird der ganze Vorstand gewählt. Wer kandidieren oder ein Thema auf die Tagesordnung setzen möchte, schreibt bis zum 14. Februar der Schriftführerin.',
        ],
      },
    },
  },
  about: {
    title: 'Über uns',
    intro:
      'Saathi Samaj Main-Neckar e.V. ist ein eingetragener, gemeinnütziger Verein nepalischer Familien und Freundinnen und Freunde Nepals in der Region zwischen Main und Neckar. Wir arbeiten komplett ehrenamtlich, und jedes Mitglied hat eine Stimme.',
    committee: 'Unser Vorstand',
    committeeNote: 'Von der Mitgliederversammlung für zwei Jahre gewählt. Namen und Gesichter sind für diese Demo erfunden.',
    roles: {
      kamala: { native: 'Adhyaksha', role: 'Vorsitzende' },
      rajendra: { native: 'Upadhyaksha', role: 'Stellv. Vorsitzender' },
      sabina: { native: 'Sachiv', role: 'Schriftführerin' },
      dipak: { native: 'Koshadhyaksha', role: 'Schatzmeister' },
      anish: { native: 'Sah-sachiv', role: 'Stellv. Schriftführer' },
      pooja: { native: 'Sanskritik samyojak', role: 'Kultur & Feste' },
      nabin: { native: 'Khelkud samyojak', role: 'Sport & Jugend' },
      laxmi: { native: 'Pathshala samyojak', role: 'Nepali-Schule' },
    },
    statutes: 'Unsere Satzung kurz gefasst',
    statutesNote: 'Eine Zusammenfassung der Satzung. Der volle Text liegt im Mitgliederbereich.',
    statuteItems: [
      { h: '§1 Name und Sitz', p: 'Der Verein heißt Saathi Samaj Main-Neckar e.V., ist im Vereinsregister eingetragen und hat seinen Sitz in Musterstadt.' },
      { h: '§2 Zweck', p: 'Nepalische Kultur und Sprache lebendig halten, Menschen über Kulturen hinweg zusammenbringen und Neuankommenden beim Ankommen helfen. Der Verein ist gemeinnützig sowie parteipolitisch und religiös neutral.' },
      { h: '§3 Mitgliedschaft', p: 'Mitglied werden kann, wer den Zweck unterstützt — mit der Familie. Die Mitgliedschaft beginnt mit der Bestätigung durch den Vorstand und endet jederzeit durch eine schriftliche Erklärung.' },
      { h: '§4 Organe', p: 'Die Mitgliederversammlung und der Vorstand. Der Vorstand wird alle zwei Jahre gewählt.' },
      { h: '§5 Mitgliederversammlung', p: 'Tagt einmal im Jahr, Einladung vier Wochen vorher per E-Mail. Beschlüsse mit einfacher Mehrheit; Satzungsänderungen brauchen zwei Drittel.' },
      { h: '§6 Datenschutz', p: 'Daten der Mitglieder werden nur für die Vereinsarbeit genutzt, nie weitergegeben und mit dem Ende der Mitgliedschaft gelöscht.' },
      { h: '§7 Auflösung', p: 'Kann nur eine Mitgliederversammlung mit Dreiviertelmehrheit beschließen.' },
    ],
    history: 'Unsere Geschichte',
    historyItems: [
      { year: 2012, text: 'Neun Familien feiern Dashain zusammen in einem Wohnzimmer — und beschließen, sich jeden Monat zu treffen.' },
      { year: 2014, text: 'Das erste Dashain im Saal: 200 Gäste, ein Reiskocher zu wenig.' },
      { year: 2016, text: 'Die Nepali-Samstagsschule startet mit elf Kindern und einem Whiteboard.' },
      { year: 2019, text: 'Eintragung als Verein (e.V.) mit Satzung und gewähltem Vorstand.' },
      { year: 2020, text: 'Tihar online: Deusi-Bhailo per Videoanruf, Süßigkeiten an 60 Haustüren.' },
      { year: 2023, text: 'Der erste Sporttag: acht Teams aus fünf Städten.' },
      { year: 2026, text: 'Eine eigene Website in drei Sprachen, mit Mitgliederbereich.' },
    ],
  },
  join: {
    title: 'Mitglied werden',
    sub: 'Fünf Minuten, vier kurze Schritte. Deine ganze Familie kann mit dir eintreten.',
    steps: { personal: 'Du', family: 'Familie', consent: 'Einwilligung', review: 'Prüfen' },
    stepOf: (i, n) => `Schritt ${i} von ${n}`,
    first: 'Vorname',
    last: 'Nachname',
    email: 'E-Mail',
    phone: 'Telefon',
    optional: 'optional',
    town: 'Wohnort',
    familyIntro: 'Füge Familienmitglieder hinzu, die auch Mitglied werden sollen (bis zu 6). Du kannst diesen Schritt überspringen.',
    familyNone: 'Keine Familienmitglieder hinzugefügt — das ist in Ordnung.',
    familyAdd: '+ Familienmitglied hinzufügen',
    familyMax: 'Mehr nimmt dieses Formular nicht — sag der Schriftführerin Bescheid.',
    familyName: 'Name',
    familyRelation: 'Beziehung',
    familyBorn: 'Geburtsjahr',
    familyRemove: 'Entfernen',
    relations: { spouse: 'Ehe- / Lebenspartner·in', child: 'Kind', parent: 'Elternteil', sibling: 'Bruder / Schwester', other: 'Andere' },
    consentData:
      'Ich bin einverstanden, dass Saathi Samaj meine Daten und die meiner Familie für die Vereinsarbeit speichert (DSGVO). Sie werden nie weitergegeben und mit dem Ende der Mitgliedschaft gelöscht.',
    consentDataMore: 'Pflicht — ohne diese Einwilligung kann der Verein keine Mitgliedschaft führen.',
    photosQ: 'Fotos bei Veranstaltungen',
    photosYes: 'Ja — Fotos von mir und meiner Familie dürfen in der Galerie und in unseren sozialen Medien erscheinen.',
    photosNo: 'Nein — bitte keine veröffentlichten Fotos von uns.',
    photosMore: 'Das kannst du jederzeit mit einer Nachricht an die Schriftführerin ändern.',
    newsletter: 'Schickt mir Programm und Neuigkeiten per E-Mail (etwa einmal im Monat).',
    reviewIntro: 'Bitte prüfe alles, bevor du es an den Vorstand schickst.',
    edit: 'Ändern',
    back: '← Zurück',
    nextStep: 'Weiter →',
    submit: 'Mitglied werden',
    errors: {
      required: 'Bitte ausfüllen.',
      name: 'Nur Buchstaben, Leerzeichen und Bindestriche.',
      email: 'Das sieht nicht wie eine E-Mail-Adresse aus.',
      phone: 'Nur Ziffern, Leerzeichen und +.',
      year: 'Eine Jahreszahl wie 2015.',
      tooLong: 'Das ist zu lang.',
      consent: 'Bitte zustimmen, sonst kann der Verein die Mitgliedschaft nicht führen.',
      choose: 'Bitte eine Antwort wählen.',
    },
    fixFirst: 'Bitte zuerst die markierten Felder korrigieren.',
    doneTitle: (first) => `Swagat chha, ${first}!`,
    doneText: 'Deine Mitgliedschaft ist bestätigt. Heb die Bestätigung auf — drucke sie aus oder speichere sie als Datei.',
    number: 'Mitgliedsnummer',
    print: 'Drucken',
    download: 'Bestätigung herunterladen',
    toMembers: 'Zum Mitgliederbereich →',
    nothingSent: 'Nichts wurde verschickt — diese Demo hat alles auf deinem Gerät behalten. Auf einer echten Website bekäme der Vorstand deinen Antrag.',
    already: (n) => `Du bist Mitglied ${n}.`,
    again: 'Formular neu ausfüllen',
    yes: 'Ja',
    no: 'Nein',
    joinedOn: 'Mitglied seit',
    confirmTitle: 'Bestätigung der Mitgliedschaft',
    consentLine: 'Du hast der Speicherung deiner Daten für die Vereinsarbeit zugestimmt (DSGVO).',
    welcome: (first) => `Namaste ${first}, willkommen bei Saathi Samaj Main-Neckar e.V. Wir freuen uns, dich und deine Familie dabeizuhaben.`,
    demoNote: 'Demo — dieser Verein ist erfunden und nichts wurde verschickt. Gebaut von MartNepali.',
    footer: 'Saathi Samaj Main-Neckar e.V. (Beispiel) · Musterstraße 12, 64000 Musterstadt',
    newsletterLabel: 'Programm per E-Mail',
    photosLabel: 'Fotos bei Veranstaltungen',
  },
  members: {
    title: 'Mitgliederbereich',
    sub: 'Dein Ausweis, Einladungen, Dokumente und Umfragen.',
    lockedTitle: 'Nur für Mitglieder',
    lockedText: 'Mitglieder loggen sich ein, um ihren Ausweis zu sehen, Einladungen zu beantworten, Protokolle zu lesen und abzustimmen.',
    login: 'Als Demo-Mitglied einloggen',
    loginNote: 'Kein Passwort nötig — das ist eine Demo.',
    logout: 'Ausloggen',
    hello: (first) => `Namaste, ${first}!`,
    demoName: 'Demo-Mitglied',
    card: 'Mitgliedsausweis',
    since: (y) => `Mitglied seit ${y}`,
    cardHint: 'Zeig den Code am Eingang — die Helfer scannen ihn.',
    qrLabel: 'QR-Code deines Mitgliedsausweises',
    rsvpTitle: 'Bist du dabei?',
    rsvp: { yes: 'Dabei', maybe: 'Vielleicht', no: 'Leider nicht' },
    people: 'Personen',
    fewer: 'Eine Person weniger',
    more: 'Eine Person mehr',
    going: (n) => `${n} Mitglieder dabei`,
    yourAnswer: {
      yes: (n) => `Du kommst mit ${n} Personen.`,
      maybe: () => 'Du hast „vielleicht“ gesagt.',
      no: () => 'Du kannst dieses Mal nicht.',
    },
    docsTitle: 'Dokumente',
    open: 'Öffnen',
    downloadTxt: 'Herunterladen (.txt)',
    docs: {
      minutes: {
        title: 'Protokoll der Jahreshauptversammlung 2026',
        meta: 'Jahreshauptversammlung · 15. März 2026 · für diese Demo erfunden',
        body: [
          'Anwesend: 64 Mitglieder. Leitung: Kamala Shrestha. Protokoll: Sabina Rai.',
          '1. Begrüßung. Die Vorsitzende begrüßt die Mitglieder; die Versammlung wurde fristgerecht eingeladen und ist beschlussfähig.',
          '2. Bericht des Vorstands. Neun Treffen 2025, 312 Gäste an Dashain, eine neue Jugendgruppe mit 18 Jugendlichen.',
          '3. Nepali-Schule. 34 Kinder in drei Gruppen; vier Eltern unterrichten jetzt ehrenamtlich.',
          '4. Pläne für 2026. Eine Website in drei Sprachen, ein zweites Sporttag-Team aus Mannstadt, Sprechstunde für Neue am ersten Sonntag im Monat.',
          '5. Wahlen. Dieses Jahr nicht fällig (nächste: 2027).',
          '6. Verschiedenes. Mitglieder wünschen sich ein Sommerpicknick — der Vorstand stellt den Ort zur Abstimmung.',
          'Ende der Versammlung: 16:40 Uhr.',
        ],
      },
      programme: { title: 'Programm 2027 (Übersicht)', meta: 'Alle Termine · für die Kühlschranktür', body: [] },
      helpers: {
        title: 'Helfen an Dashain: wer macht was',
        meta: 'Helferleitfaden · Stand September 2026',
        body: [
          'Küche (ab 12:00): Reis, Dal, Tarkari und Achar für 300. Leitung: Pooja Tamang.',
          'Eingang (ab 15:30): Gäste begrüßen, Tickets und Mitgliedsausweise mit dem Handy scannen. Leitung: Anish Magar.',
          'Bühne (ab 14:00): Soundcheck, Ablaufplan, Tanz der Schulkinder. Leitung: Rajendra Lama.',
          'Tika-Ecke: Stühle für die Älteren, Jamara, rote Tika, ein ruhiger Platz. Leitung: Kamala Shrestha.',
          'Nach 23:00: Alle helfen beim Stühlestapeln — mit 30 Leuten dauert es 20 Minuten.',
        ],
      },
    },
    pollTitle: 'Umfrage',
    pollQ: 'Wo soll das Sommerpicknick stattfinden?',
    pollVote: 'Abstimmen',
    pollVoted: (o) => `Du hast für „${o}“ gestimmt. Du kannst deine Stimme bis 30. April ändern.`,
    pollChange: 'Stimme ändern',
    pollVotes: (n) => `${n} Stimmen`,
    pollLeader: (o) => `Vorne: ${o}`,
    pollOptions: { riverside: 'Wiese am Fluss', citypark: 'Stadtpark', lake: 'Badesee mit Strand', forest: 'Grillhütte im Wald' },
    pollHint: 'Eine Stimme pro Mitglied. Die Ergebnisse ändern sich, sobald du abstimmst.',
  },
  gallery: {
    title: 'Galerie',
    sub: 'Momente aus unserem Jahr.',
    drawn: 'Gezeichnete Bilder für diese Demo — keine Fotos echter Menschen.',
    items: {
      kites: 'Dashain-Drachen über dem Main',
      diyo: 'Diyo-Lichter an Tihar',
      rangoli: 'Rangoli an der Tür des Vereinsraums',
      teej: 'Teej-Abend — Rot und Gold',
      newyear: 'Sonnenaufgang zum nepalischen Neujahr',
      sports: 'Finale am Sporttag',
      school: 'Samstagsschule: क ख ग',
      deusi: 'Deusi-Bhailo-Abend',
    },
    close: 'Schließen',
    prev: 'Vorheriges Bild',
    next: 'Nächstes Bild',
  },
  contact: {
    title: 'Kontakt',
    sub: 'Fragen, Ideen oder beim nächsten Fest helfen? Schreib uns.',
    name: 'Dein Name',
    email: 'Deine E-Mail',
    message: 'Nachricht',
    send: 'Senden',
    sent: 'Nichts wurde verschickt — das ist eine Demo. Auf einer echten Website käme deine Nachricht im Postfach des Vorstands an.',
    where: 'So findest du uns',
    whereText: 'Vereinsraum, Musterstraße 12, 64000 Musterstadt · samstags 10:00–13:00',
    mailUs: 'E-Mail',
    impressum: 'Impressum',
    example: 'Beispiel — durch die Angaben deines Vereins ersetzen',
    impressumLines: [
      'Saathi Samaj Main-Neckar e.V. (Beispiel)',
      'Musterstraße 12, 64000 Musterstadt',
      'Vereinsregister: Amtsgericht Musterstadt, VR 0000 (Beispiel)',
      'Vertreten durch den Vorstand (§ 26 BGB): Kamala Shrestha, Rajendra Lama (erfundene Namen)',
      'Kontakt: info@saathi-samaj.example',
    ],
    privacy: 'Datenschutz: Diese Demo speichert nichts auf einem Server. Was du eingibst, bleibt in deinem Browser, bis du „Demo zurücksetzen“ drückst.',
  },
  logo: {
    title: 'Logo-Macher',
    initials: 'Initialen',
    initialsHint: 'Bis zu 3 Buchstaben — lateinisch oder देवनागरी.',
    fromName: 'Aus dem Namen',
    ring: 'Name im Ring',
    shape: 'Symbol',
    shapes: { peaks: 'Himal', lotus: 'Lotus', sun: 'Sonne', star: 'Stern' },
    colours: 'Die Farben folgen dem Look — wechsle den Look, um das Logo umzufärben.',
    download: 'SVG herunterladen',
    done: 'Fertig',
    saved: 'Das neue Logo steht jetzt oben im Kopf.',
  },
  footer: { line: 'Saathi Samaj Main-Neckar e.V. · Nepalischer Verein seit 2012', example: 'Eine Beispielseite — der Verein ist erfunden.', top: 'Nach oben ↑' },
  close: 'Schließen',
  days: ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'],
  daysLong: ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'],
  months: ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'],
  monthsShort: ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sep.', 'Okt.', 'Nov.', 'Dez.'],
  fmtDate: (wd, d, m, y) => `${wd}, ${d}. ${m} ${y}`,
  fmtShort: (wd, d, m) => `${wd}, ${d}. ${m}`,
  time: (a, b) => `${a}–${b} Uhr`,
};

const ne: Copy = {
  langName: 'नेपाली',
  orgName: 'साथी समाज माइन-नेकार',
  orgSub: 'नेपाली संस्था · २०१२ देखि',
  kit: {
    label: 'वेबसाइट किट',
    hint: 'एउटै किट, जुनसुकै संस्थाका लागि: रूप बदल्नुहोस्, लोगो बनाउनुहोस्, भाषा फेर्नुहोस्।',
    look: 'रूप',
    looks: { himalaya: 'हिमालय', dhaka: 'ढाका', modern: 'आधुनिक' },
    logo: 'लोगो बनाउनुहोस्',
    reset: 'डेमो रिसेट',
    resetDone: 'डेमो रिसेट भयो — सबै सुरुकै अवस्थामा फर्कियो।',
    lang: 'भाषा',
  },
  nav: { label: 'खण्डहरू', home: 'गृहपृष्ठ', programme: 'कार्यक्रम', news: 'समाचार', about: 'हाम्रो बारेमा', join: 'सदस्य बन्नुहोस्', members: 'सदस्य', gallery: 'ग्यालेरी', contact: 'सम्पर्क' },
  hero: {
    kicker: 'नेपाली संस्था · माइन-नेकार',
    title: 'माइन र नेकारबीचका नेपाली परिवारहरूको आफ्नै घर',
    mission:
      'हामी हाम्रा चाडपर्व, भाषा र मित्रतालाई जीवित राख्छौं — र भर्खरै आइपुगेका सबैलाई जर्मनीमा खुट्टा टेक्न सघाउँछौं। हरेक नेपाली परिवार र नेपालका सबै साथीहरूका लागि खुला।',
    stats: ['२०१२ देखि', '१५० परिवार', 'वर्षमा ९ भेटघाट', 'हरेक शनिबार नेपाली पाठशाला'],
    next: 'अर्को कार्यक्रम',
    inDays: (n) => `${n} दिनपछि`,
    today: 'आज',
    details: 'कार्यक्रम हेर्नुहोस्',
    quick: 'छिटो लिङ्क',
    quickJoin: 'सदस्य बन्नुहोस्',
    quickProgramme: 'कार्यक्रम २०२७',
    quickMembers: 'सदस्य क्षेत्र',
    quickContact: 'सम्पर्क गर्नुहोस्',
  },
  pillars: [
    { title: 'चाडपर्व', text: 'दशैं, तिहार, तीज, होली र नयाँ वर्ष — सँगै, टीका, खाना र नाचसहित।' },
    { title: 'नेपाली पाठशाला', text: 'हरेक शनिबार बिहान: ५ देखि १४ वर्षका बालबालिकाका लागि पढाइ, लेखाइ र गीत।' },
    { title: 'खेलकुद र युवा', text: 'हरेक गर्मीमा खेलकुद दिवस, आइतबार फुटबल र आफ्नै साँझ योजना बनाउने युवा समूह।' },
    { title: 'नयाँ आउनेलाई सहयोग', text: 'आन्मेल्डुङ, कोठा खोज्ने, पहिलो जाडो — यो पार गरिसकेको कोही तपाईंसँगै हिँड्छ।' },
  ],
  ev: {
    title: 'कार्यक्रम २०२७',
    sub: 'वर्षभरिका हाम्रा भेटघाट। सबै आउन सकून् भनेर चाडहरू नजिकैको सप्ताहान्तमा राखिन्छन्।',
    month: 'महिना',
    list: 'सूची',
    prev: 'अघिल्लो महिना',
    next: 'अर्को महिना',
    tickets: 'MartNepali मा टिकट →',
    ticketsNote: 'हाम्रा कार्यक्रमका टिकट MartNepali मा पाइन्छन् — यो डेमोमा बटनले MartNepali को वास्तविक कार्यक्रम पेज खोल्छ।',
    school: 'नेपाली पाठशाला',
    schoolLine: 'बालबालिकाका लागि नेपाली भाषा पाठशाला',
    schoolWhen: 'हरेक शनिबार १०:००–१२:०० · जनवरीदेखि जुलाई र सेप्टेम्बरदेखि डिसेम्बर · चाडका दिन बिदा',
    legendEvent: 'कार्यक्रम',
    legendSchool: 'नेपाली पाठशाला',
    nothing: 'यो महिना कुनै कार्यक्रम छैन — नेपाली पाठशाला भने शनिबार चलिरहन्छ।',
    pick: 'के छ हेर्न थोप्लो भएको दिनमा थिच्नुहोस्।',
    kinds: { festival: 'चाड', sports: 'खेलकुद', school: 'पाठशाला', meeting: 'साधारण सभा', community: 'भेटघाट' },
    places: {
      hall: 'साल्बाउ लिन्डेनहोफ, मुस्टरश्टाट',
      club: 'हाम्रो संस्थाको कोठा, मुस्टरश्ट्रासे १२',
      park: 'श्टाटपार्क मुस्टरश्टाट, ठूलो चौर',
      field: 'नदी किनारको खेल मैदान, मुस्टरश्टाट',
      tbd: 'ठाउँ सदस्यहरूले मतदानमा छान्छन्',
    },
    items: {
      maghe: { title: 'माघे संक्रान्ति भेटघाट', blurb: 'घिउ, चाकु र सखरखण्ड, गीत र जनवरीको जाडोमा न्यानो कोठा।' },
      agm: { title: 'वार्षिक साधारण सभा', blurb: 'समितिको प्रतिवेदन, वर्षभरिको योजना र सदस्यहरूका प्रश्न।' },
      holi: { title: 'पार्कमा होली', blurb: 'रंग, संगीत र खाजा। रंगिन तयार सेतो लुगा लगाएर आउनुहोस्।' },
      newyear: { title: 'नयाँ वर्ष २०८४', blurb: 'सांस्कृतिक कार्यक्रम, पाठशालाका बच्चाहरूको नाच र सँगै बेलुकाको खाना।' },
      sports: { title: 'खेलकुद दिवस', blurb: 'फुटबल, भलिबल, डोरी तानातान, डन्डी बियो र साना बच्चाहरूको दौड। हरेक सहरबाट टिम।' },
      picnic: { title: 'गर्मीको पिकनिक', blurb: 'हरेक भान्साको खाना, खेल र बाहिर लामो दिउँसो। कहाँ? सदस्यहरूले मतदानमा छान्छन्।' },
      teej: { title: 'तीज महोत्सव', blurb: 'रातो साडी, दर, गीत र नाच — यो साँझ समुदायका दिदीबहिनीहरूको।' },
      dashain: { title: 'दशैं मिलन', blurb: 'ठूलाबडाबाट टीका र जमरा, सांस्कृतिक कार्यक्रम, खाना र वर्षकै ठूलो हल।' },
      tihar: { title: 'तिहार र देउसी-भैलो साँझ', blurb: 'दियो, ढोकामा रंगोली, देउसी-भैलो टोली र राति अबेरसम्म नाच।' },
    },
  },
  news: {
    title: 'समाचार',
    sub: 'समितिका सूचनाहरू।',
    read: 'थप पढ्नुहोस्',
    back: '← सबै समाचार',
    tags: { club: 'संस्था', festival: 'चाड', school: 'नेपाली पाठशाला', sports: 'खेलकुद' },
    items: {
      website: {
        title: 'हाम्रो नयाँ वेबसाइट सुरु भयो',
        excerpt: 'कार्यक्रम, सदस्यता र सदस्य क्षेत्र — अब अंग्रेजी, जर्मन र नेपालीमा।',
        body: [
          'धेरै साँझको छलफलपछि साथी समाजसँग अन्ततः हरेक फोनमा चल्ने वेबसाइट भयो। यहाँ २०२७ को पूरा कार्यक्रम, समितिका समाचार र पाँच मिनेटमै भरिने सदस्यता फारम छ।',
          'सदस्यहरू लगइन गरेर आफ्नो सदस्य कार्ड हेर्न, निम्तोको जवाफ दिन, साधारण सभाको माइन्युट पढ्न र मतदान गर्न सक्छन् — सुरुमै यो गर्मीको पिकनिक कहाँ गर्ने भन्ने ठूलो प्रश्नमा।',
          'केही छुट्यो वा गलत छ? सचिवलाई लेख्नुहोस् — यो साइट हामी सबैको हो, सँगै सुधार्दै जानेछौं।',
        ],
      },
      dashain26: {
        title: 'सुन्दर दशैंका लागि धन्यवाद',
        excerpt: '३०० भन्दा बढी पाहुना, ४० स्वयंसेवक र बेलुका अबेरसम्म ठूलाबडाबाट टीका।',
        body: [
          'दशैं मिलन २०२६ अहिलेसम्मकै ठूलो भेटघाट रह्यो। छ बजेसम्म हल भरियो, ठूलाबडाले झन्डै तीन घण्टा टीका र जमरा लगाइदिनुभयो, र पाठशालाका बच्चाहरूले अगस्टदेखि अभ्यास गरेको नाचबाट कार्यक्रम सुरु गरे।',
          'भान्सा, ढोका र मञ्चमा खटिनुभएका ४० स्वयंसेवक र कुर्सी मिलाउन बस्नुभएका सबैलाई हार्दिक धन्यवाद।',
          'साँझका तस्बिरहरू ग्यालेरीमा छन्। तिहारमा भेटौंला!',
        ],
      },
      school: {
        title: 'नेपाली पाठशाला: नयाँ सत्र जनवरी ९ देखि',
        excerpt: 'उमेर अनुसार तीन समूह, नयाँ पाठ्यपुस्तक र नयाँ वर्षका लागि एउटा गीत।',
        body: [
          'शनिबार पाठशाला जनवरी ९, २०२७ देखि फेरि सुरु हुन्छ, बिहान १०:००–१२:०० हाम्रो कोठामा। यो सत्र तीन समूहमा पढाइन्छ: पहिलो अक्षर (५–७), पढाइ (८–१०) र कथा लेखन (११–१४)।',
          'यस वर्ष नयाँ: हरेक बच्चाले राख्न पाउने काठमाडौंबाट ल्याइएका पुस्तक, र नयाँ वर्षमा मञ्चमा गाइने गीत।',
          'शिक्षकका रूपमा सघाउन चाहने अभिभावकलाई हार्दिक स्वागत छ — लक्ष्मी पौडेलसँग कुरा गर्नुहोस्।',
        ],
      },
      sports: {
        title: 'खेलकुद दिवस २०२७: टिम चाहियो',
        excerpt: 'जुन २६ मा फुटबल, भलिबल र डोरी तानातान — आफ्नो सहरको टिम दर्ता गर्नुहोस्।',
        body: [
          'खेलकुद दिवस फेरि आउँदैछ: जुन २६, २०२७ मा नदी किनारको खेल मैदानमा। छ जनाका टिमका लागि फुटबल र भलिबल, साहसीहरूका लागि डोरी तानातान, र बच्चाहरूका लागि दौड।',
          'क्षेत्रका हरेक सहरले टिम पठाउन सक्छन्। अप्रिलको अन्त्यसम्म नवीन थापालाई टिमको नाम र सम्पर्क व्यक्ति बताउनुहोस्।',
        ],
      },
      agm: {
        title: 'मिति सम्झनुहोस्: मार्च १४ मा साधारण सभा',
        excerpt: 'प्रतिवेदन, २०२७ को योजना र समितिको निर्वाचन।',
        body: [
          'हाम्रो वार्षिक साधारण सभा आइतबार, मार्च १४, २०२७ दिउँसो २ बजे संस्थाको कोठामा हुनेछ। कार्यसूचीसहितको निम्तो चार हप्ताअघि इमेलमा आउनेछ।',
          'यस वर्ष पूरा समितिको निर्वाचन हुन्छ। उम्मेदवार बन्न वा कार्यसूचीमा विषय राख्न चाहनुहुन्छ भने फेब्रुअरी १४ सम्म सचिवलाई लेख्नुहोस्।',
        ],
      },
    },
  },
  about: {
    title: 'हाम्रो बारेमा',
    intro:
      'साथी समाज माइन-नेकार e.V. माइन र नेकार नदीबीचको क्षेत्रमा बस्ने नेपाली परिवार र नेपालका साथीहरूको दर्ता भएको, गैरनाफामूलक संस्था हो। यो पूर्ण रूपमा स्वयंसेवकले चलाउँछन्, र हरेक सदस्यको एउटा मत हुन्छ।',
    committee: 'हाम्रो कार्यसमिति',
    committeeNote: 'साधारण सभाले दुई वर्षका लागि चुनेको। यो डेमोका नाम र अनुहार काल्पनिक हुन्।',
    roles: {
      kamala: { native: 'अध्यक्ष', role: 'Adhyaksha' },
      rajendra: { native: 'उपाध्यक्ष', role: 'Upadhyaksha' },
      sabina: { native: 'सचिव', role: 'Sachiv' },
      dipak: { native: 'कोषाध्यक्ष', role: 'Koshadhyaksha' },
      anish: { native: 'सहसचिव', role: 'Sah-sachiv' },
      pooja: { native: 'सांस्कृतिक संयोजक', role: 'चाडपर्व र संस्कृति' },
      nabin: { native: 'खेलकुद संयोजक', role: 'खेलकुद र युवा' },
      laxmi: { native: 'पाठशाला संयोजक', role: 'नेपाली पाठशाला' },
    },
    statutes: 'हाम्रो विधान छोटकरीमा',
    statutesNote: 'विधान (Satzung) को सारांश। पूरा पाठ सदस्य क्षेत्रमा छ।',
    statuteItems: [
      { h: '§१ नाम र ठेगाना', p: 'संस्थाको नाम साथी समाज माइन-नेकार e.V. हो, Vereinsregister मा दर्ता छ र कार्यालय मुस्टरश्टाटमा छ।' },
      { h: '§२ उद्देश्य', p: 'नेपाली संस्कृति र भाषा जोगाउनु, संस्कृतिहरूबीच मानिसलाई जोड्नु र नयाँ आउनेलाई बसोबासमा सघाउनु। संस्था गैरनाफामूलक र राजनीतिक तथा धार्मिक रूपमा तटस्थ छ।' },
      { h: '§३ सदस्यता', p: 'उद्देश्यलाई समर्थन गर्ने जो कोही परिवारसहित सदस्य बन्न सक्छन्। समितिले आवेदन स्वीकार गरेपछि सदस्यता सुरु हुन्छ, र लिखित सूचनाले जुनसुकै बेला अन्त्य हुन्छ।' },
      { h: '§४ अंगहरू', p: 'साधारण सभा र कार्यसमिति। कार्यसमिति हरेक दुई वर्षमा चुनिन्छ।' },
      { h: '§५ साधारण सभा', p: 'वर्षमा एक पटक बस्छ, चार हप्ताअघि इमेलबाट निम्तो। निर्णय साधारण बहुमतले; विधान संशोधनका लागि दुई तिहाइ चाहिन्छ।' },
      { h: '§६ तथ्यांक सुरक्षा', p: 'सदस्यको विवरण संस्थाको कामका लागि मात्र प्रयोग हुन्छ, कसैलाई दिइँदैन, र सदस्यता सकिएपछि मेटाइन्छ।' },
      { h: '§७ विघटन', p: 'तीन चौथाइ बहुमतसहितको साधारण सभाले मात्र निर्णय गर्न सक्छ।' },
    ],
    history: 'हाम्रो कथा',
    historyItems: [
      { year: 2012, text: 'नौ परिवारले एउटा बैठक कोठामा सँगै दशैं मनाए — र हरेक महिना भेट्ने निधो गरे।' },
      { year: 2014, text: 'हलमा पहिलो दशैं: २०० पाहुना, एउटा राइस कुकर कम।' },
      { year: 2016, text: 'एघार बच्चा र एउटा ह्वाइटबोर्डसहित शनिबार नेपाली पाठशाला सुरु।' },
      { year: 2019, text: 'विधान र निर्वाचित समितिसहित संस्था (e.V.) का रूपमा दर्ता।' },
      { year: 2020, text: 'अनलाइन तिहार: भिडियो कलमा देउसी-भैलो, ६० घरमा मिठाई।' },
      { year: 2023, text: 'पहिलो खेलकुद दिवस: पाँच सहरका आठ टिम।' },
      { year: 2026, text: 'सदस्य क्षेत्रसहित तीन भाषामा आफ्नै वेबसाइट।' },
    ],
  },
  join: {
    title: 'सदस्य बन्नुहोस्',
    sub: 'पाँच मिनेट, चार छोटा चरण। तपाईंको पूरै परिवार सँगै सदस्य बन्न सक्छ।',
    steps: { personal: 'तपाईं', family: 'परिवार', consent: 'सहमति', review: 'जाँच' },
    stepOf: (i, n) => `चरण ${i} / ${n}`,
    first: 'पहिलो नाम',
    last: 'थर',
    email: 'इमेल',
    phone: 'फोन',
    optional: 'ऐच्छिक',
    town: 'सहर',
    familyIntro: 'सदस्य बन्ने परिवारका सदस्य थप्नुहोस् (६ जनासम्म)। यो चरण छोड्न पनि सक्नुहुन्छ।',
    familyNone: 'परिवारका सदस्य थपिएका छैनन् — ठीकै छ।',
    familyAdd: '+ परिवारको सदस्य थप्नुहोस्',
    familyMax: 'यो फारमले यति मात्र लिन्छ — थप भए सचिवलाई भन्नुहोस्।',
    familyName: 'नाम',
    familyRelation: 'नाता',
    familyBorn: 'जन्म वर्ष',
    familyRemove: 'हटाउनुहोस्',
    relations: { spouse: 'श्रीमान् / श्रीमती', child: 'छोराछोरी', parent: 'आमा / बुबा', sibling: 'दाजुभाइ / दिदीबहिनी', other: 'अन्य' },
    consentData:
      'साथी समाजले संस्थाको कामका लागि मेरो र मेरो परिवारको विवरण राख्न म सहमत छु (DSGVO)। यो कसैलाई दिइँदैन र सदस्यता सकिएपछि मेटाइन्छ।',
    consentDataMore: 'अनिवार्य — यो सहमति बिना संस्थाले सदस्यता राख्न सक्दैन।',
    photosQ: 'कार्यक्रमका तस्बिर',
    photosYes: 'हुन्छ — मेरो र मेरो परिवारको तस्बिर ग्यालेरी र हाम्रो सामाजिक सञ्जालमा राख्न सकिन्छ।',
    photosNo: 'हुँदैन — प्रकाशित तस्बिरमा हामीलाई नराख्नुहोस्।',
    photosMore: 'सचिवलाई लेखेर यो जुनसुकै बेला बदल्न सक्नुहुन्छ।',
    newsletter: 'कार्यक्रम र समाचार इमेलमा पठाउनुहोस् (महिनामा एक पटकजति)।',
    reviewIntro: 'समितिलाई पठाउनुअघि सबै जाँच्नुहोस्।',
    edit: 'सच्याउनुहोस्',
    back: '← पछाडि',
    nextStep: 'अगाडि →',
    submit: 'सदस्य बन्नुहोस्',
    errors: {
      required: 'कृपया यो भर्नुहोस्।',
      name: 'अक्षर, खाली ठाउँ र हाइफन मात्र।',
      email: 'यो इमेल ठेगाना जस्तो देखिँदैन।',
      phone: 'अंक, खाली ठाउँ र + मात्र।',
      year: '२०१५ जस्तो वर्ष।',
      tooLong: 'यो धेरै लामो भयो।',
      consent: 'कृपया सहमति दिनुहोस्, नत्र संस्थाले सदस्यता राख्न सक्दैन।',
      choose: 'कृपया एउटा छान्नुहोस्।',
    },
    fixFirst: 'पहिले चिन्ह लगाइएका ठाउँ सच्याउनुहोस्।',
    doneTitle: (first) => `स्वागत छ, ${first}!`,
    doneText: 'तपाईंको सदस्यता पक्का भयो। पुष्टि-पत्र राख्नुहोस् — प्रिन्ट गर्नुहोस् वा फाइलमा सेभ गर्नुहोस्।',
    number: 'सदस्य नम्बर',
    print: 'प्रिन्ट',
    download: 'पुष्टि-पत्र डाउनलोड',
    toMembers: 'सदस्य क्षेत्र खोल्नुहोस् →',
    nothingSent: 'केही पनि पठाइएन — यो डेमोले सबै तपाईंकै उपकरणमा राख्यो। वास्तविक साइटमा तपाईंको आवेदन समितिमा पुग्थ्यो।',
    already: (n) => `तपाईं सदस्य ${n} हुनुहुन्छ।`,
    again: 'फारम फेरि भर्नुहोस्',
    yes: 'हो',
    no: 'होइन',
    joinedOn: 'सदस्य भएको मिति',
    confirmTitle: 'सदस्यताको पुष्टि-पत्र',
    consentLine: 'संस्थाको कामका लागि विवरण राख्न तपाईंले सहमति दिनुभयो (DSGVO)।',
    welcome: (first) => `नमस्ते ${first}, साथी समाज माइन-नेकार e.V. मा स्वागत छ। तपाईं र तपाईंको परिवार हामीसँग हुँदा खुसी लाग्यो।`,
    demoNote: 'डेमो — यो संस्था काल्पनिक हो र केही पनि कतै पठाइएन। MartNepali ले बनाएको।',
    footer: 'साथी समाज माइन-नेकार e.V. (उदाहरण) · Musterstraße 12, 64000 Musterstadt',
    newsletterLabel: 'इमेलमा कार्यक्रम',
    photosLabel: 'कार्यक्रमका तस्बिर',
  },
  members: {
    title: 'सदस्य क्षेत्र',
    sub: 'तपाईंको कार्ड, निम्तो, कागजात र मतदान।',
    lockedTitle: 'सदस्यका लागि मात्र',
    lockedText: 'सदस्यहरू लगइन गरेर आफ्नो कार्ड हेर्छन्, निम्तोको जवाफ दिन्छन्, माइन्युट पढ्छन् र मतदान गर्छन्।',
    login: 'डेमो सदस्यका रूपमा लगइन',
    loginNote: 'पासवर्ड चाहिँदैन — यो डेमो हो।',
    logout: 'लगआउट',
    hello: (first) => `नमस्ते, ${first}!`,
    demoName: 'डेमो सदस्य',
    card: 'सदस्य कार्ड',
    since: (y) => `${y} देखि सदस्य`,
    cardHint: 'ढोकामा यो कोड देखाउनुहोस् — स्वयंसेवकले स्क्यान गर्छन्।',
    qrLabel: 'तपाईंको सदस्य कार्डको QR कोड',
    rsvpTitle: 'आउँदै हुनुहुन्छ?',
    rsvp: { yes: 'आउँछु', maybe: 'सायद', no: 'आउन सक्दिनँ' },
    people: 'जना',
    fewer: 'एक जना कम',
    more: 'एक जना थप',
    going: (n) => `${n} सदस्य आउँदै`,
    yourAnswer: {
      yes: (n) => `तपाईं ${n} जना आउँदै हुनुहुन्छ।`,
      maybe: () => 'तपाईंले सायद भन्नुभयो।',
      no: () => 'यस पटक आउन सक्नुहुन्न।',
    },
    docsTitle: 'कागजात',
    open: 'खोल्नुहोस्',
    downloadTxt: 'डाउनलोड (.txt)',
    docs: {
      minutes: {
        title: 'साधारण सभा २०२६ को माइन्युट',
        meta: 'वार्षिक साधारण सभा · मार्च १५, २०२६ · यो डेमोका लागि काल्पनिक',
        body: [
          'उपस्थित: ६४ सदस्य। अध्यक्षता: कमला श्रेष्ठ। माइन्युट: सबिना राई।',
          '१. स्वागत। अध्यक्षले सदस्यहरूलाई स्वागत गर्नुभयो; सभा समयमै बोलाइएको र गणपूरक संख्या पुगेको।',
          '२. समितिको प्रतिवेदन। २०२५ मा नौ भेटघाट, दशैंमा ३१२ पाहुना, १८ जनाको नयाँ युवा समूह।',
          '३. नेपाली पाठशाला। तीन समूहमा ३४ बच्चा; चार अभिभावक अब स्वयंसेवी शिक्षक।',
          '४. २०२६ का योजना। तीन भाषाको वेबसाइट, मानश्टाटबाट दोस्रो खेलकुद टिम, हरेक महिनाको पहिलो आइतबार नयाँ आउनेका लागि सहायता कक्ष।',
          '५. निर्वाचन। यस वर्ष छैन (अर्को: २०२७)।',
          '६. विविध। सदस्यहरूले गर्मीको पिकनिक मागे — समितिले ठाउँ मतदानमा राख्नेछ।',
          'सभा समाप्त: ४:४० बजे।',
        ],
      },
      programme: { title: 'कार्यक्रम २०२७ (सार)', meta: 'सबै मिति · फ्रिजको ढोकाका लागि', body: [] },
      helpers: {
        title: 'दशैंमा सहयोग: कसले के गर्ने',
        meta: 'स्वयंसेवक निर्देशिका · सेप्टेम्बर २०२६ अद्यावधिक',
        body: [
          'भान्सा (१२:०० देखि): ३०० जनाका लागि भात, दाल, तरकारी र अचार। जिम्मेवार: पूजा तामाङ।',
          'ढोका (१५:३० देखि): पाहुनालाई स्वागत, फोनमा टिकट र सदस्य कार्ड स्क्यान। जिम्मेवार: अनिश मगर।',
          'मञ्च (१४:०० देखि): साउन्ड चेक, कार्यक्रमको क्रम, पाठशालाका बच्चाहरूको नाच। जिम्मेवार: राजेन्द्र लामा।',
          'टीका कुना: ठूलाबडाका लागि कुर्सी, जमरा, रातो टीका, शान्त ठाउँ। जिम्मेवार: कमला श्रेष्ठ।',
          '२३:०० पछि: सबैले कुर्सी मिलाउन सघाउने — ३० जना भए २० मिनेट लाग्छ।',
        ],
      },
    },
    pollTitle: 'मतदान',
    pollQ: 'गर्मीको पिकनिक कहाँ गर्ने?',
    pollVote: 'मत दिनुहोस्',
    pollVoted: (o) => `तपाईंले "${o}" लाई मत दिनुभयो। अप्रिल ३० सम्म मत बदल्न सक्नुहुन्छ।`,
    pollChange: 'मत बदल्नुहोस्',
    pollVotes: (n) => `${n} मत`,
    pollLeader: (o) => `अगाडि: ${o}`,
    pollOptions: { riverside: 'नदी किनारको चौर', citypark: 'सहरको पार्क', lake: 'तालको किनार', forest: 'जंगलको बार्बिक्यु घर' },
    pollHint: 'एक सदस्य, एक मत। मत दिनासाथ नतिजा बदलिन्छ।',
  },
  gallery: {
    title: 'ग्यालेरी',
    sub: 'हाम्रो वर्षका क्षणहरू।',
    drawn: 'यो डेमोका लागि कोरिएका चित्र — वास्तविक मानिसका तस्बिर होइनन्।',
    items: {
      kites: 'माइन नदीमाथि दशैंका चंगा',
      diyo: 'तिहारका दियो',
      rangoli: 'संस्थाको ढोकामा रंगोली',
      teej: 'तीजको साँझ — रातो र सुनौलो',
      newyear: 'नयाँ वर्षको सूर्योदय',
      sports: 'खेलकुद दिवसको फाइनल',
      school: 'शनिबार पाठशाला: क ख ग',
      deusi: 'देउसी-भैलो साँझ',
    },
    close: 'बन्द गर्नुहोस्',
    prev: 'अघिल्लो चित्र',
    next: 'अर्को चित्र',
  },
  contact: {
    title: 'सम्पर्क',
    sub: 'प्रश्न, सुझाव, वा अर्को चाडमा सघाउन चाहनुहुन्छ? हामीलाई लेख्नुहोस्।',
    name: 'तपाईंको नाम',
    email: 'तपाईंको इमेल',
    message: 'सन्देश',
    send: 'पठाउनुहोस्',
    sent: 'केही पनि पठाइएन — यो डेमो हो। वास्तविक साइटमा तपाईंको सन्देश समितिको इनबक्समा पुग्थ्यो।',
    where: 'हामीलाई कहाँ भेट्ने',
    whereText: 'संस्थाको कोठा, Musterstraße 12, 64000 Musterstadt · शनिबार १०:००–१३:००',
    mailUs: 'इमेल',
    impressum: 'इम्प्रेसुम (Impressum)',
    example: 'उदाहरण — आफ्नो संस्थाको विवरणले बदल्नुहोस्',
    impressumLines: [
      'Saathi Samaj Main-Neckar e.V. (उदाहरण)',
      'Musterstraße 12, 64000 Musterstadt',
      'Vereinsregister: Amtsgericht Musterstadt, VR 0000 (उदाहरण)',
      'प्रतिनिधि, कार्यसमिति (§ 26 BGB): कमला श्रेष्ठ, राजेन्द्र लामा (काल्पनिक नाम)',
      'सम्पर्क: info@saathi-samaj.example',
    ],
    privacy: 'गोपनीयता: यो डेमोले सर्भरमा केही राख्दैन। तपाईंले लेखेको कुरा "डेमो रिसेट" नथिचेसम्म तपाईंकै ब्राउजरमा रहन्छ।',
  },
  logo: {
    title: 'लोगो बनाउने',
    initials: 'नामका अक्षर',
    initialsHint: '३ अक्षरसम्म — रोमन वा देवनागरी।',
    fromName: 'नामबाट',
    ring: 'घेरामा नाम',
    shape: 'चिन्ह',
    shapes: { peaks: 'हिमाल', lotus: 'कमल', sun: 'सूर्य', star: 'तारा' },
    colours: 'रंग रूपसँगै बदलिन्छ — लोगोको रंग फेर्न रूप बदल्नुहोस्।',
    download: 'SVG डाउनलोड',
    done: 'सकियो',
    saved: 'नयाँ लोगो अब माथि हेडरमा छ।',
  },
  footer: { line: 'साथी समाज माइन-नेकार e.V. · २०१२ देखि नेपाली संस्था', example: 'उदाहरण साइट — यो संस्था काल्पनिक हो।', top: 'माथि जानुहोस् ↑' },
  close: 'बन्द गर्नुहोस्',
  days: ['सोम', 'मंगल', 'बुध', 'बिही', 'शुक्र', 'शनि', 'आइत'],
  daysLong: ['सोमबार', 'मंगलबार', 'बुधबार', 'बिहीबार', 'शुक्रबार', 'शनिबार', 'आइतबार'],
  months: ['जनवरी', 'फेब्रुअरी', 'मार्च', 'अप्रिल', 'मे', 'जुन', 'जुलाई', 'अगस्ट', 'सेप्टेम्बर', 'अक्टोबर', 'नोभेम्बर', 'डिसेम्बर'],
  monthsShort: ['जनवरी', 'फेब्रुअरी', 'मार्च', 'अप्रिल', 'मे', 'जुन', 'जुलाई', 'अगस्ट', 'सेप्टेम्बर', 'अक्टोबर', 'नोभेम्बर', 'डिसेम्बर'],
  fmtDate: (wd, d, m, y) => `${wd}, ${m} ${d}, ${y}`,
  fmtShort: (wd, d, m) => `${wd}, ${m} ${d}`,
  time: (a, b) => `${a}–${b}`,
};

export const COPY: Record<Lang, Copy> = { en, de, ne };

/** Names in Devanagari for the नेपाली page (the people are made up). */
export const PEOPLE_NE: Record<PersonId, string> = {
  kamala: 'कमला श्रेष्ठ',
  rajendra: 'राजेन्द्र लामा',
  sabina: 'सबिना राई',
  dipak: 'दिपक गुरुङ',
  anish: 'अनिश मगर',
  pooja: 'पूजा तामाङ',
  nabin: 'नवीन थापा',
  laxmi: 'लक्ष्मी पौडेल',
};

export function personName(id: PersonId, lang: Lang): string {
  return lang === 'ne' ? PEOPLE_NE[id] : PEOPLE.find((p) => p.id === id)!.name;
}

export function fmtDate(iso: string, lang: Lang, short = false): string {
  const [y, m, d] = iso.split('-').map(Number);
  const t = COPY[lang];
  const wd = (new Date(y, m - 1, d).getDay() + 6) % 7;
  return short
    ? t.fmtShort(t.days[wd], num(d, lang), t.monthsShort[m - 1])
    : t.fmtDate(t.daysLong[wd], num(d, lang), t.months[m - 1], num(y, lang));
}

export function fmtTimeRange(a: string, b: string, lang: Lang): string {
  return COPY[lang].time(num(a, lang), num(b, lang));
}
