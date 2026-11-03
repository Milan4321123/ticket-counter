// The studio's project list — the homepage "Projects" cards and /studio read
// this. Add a project by adding one entry; nothing else needs to change.
//
// Rules for what goes in here (see app/studio/page.tsx): no prices, quotes or
// paid-service claims, and anything that is an example or a demo says so
// (`example: true` shows an "Example project" badge; a project with a /work/*
// link is a try-it-yourself demo and shows a "Live demo" badge instead). Real
// client work says so (`real: true` → "Real project"); a demo is never marked
// real. Real clients are named only by their public name (an association, a
// band, a public artist) — never a private person.
//
// The ORDER matters: /studio, the homepage's demo strip, the /work gallery
// and each demo's prev / next links all follow it.

export type ProjectTag = 'App' | 'Website' | 'Video';

export type ProjectLink = {
  href: string;
  label: string;
};

export type Project = {
  id: string;
  title: string;
  /** Who it was for, or "MartNepali" for our own platform. */
  client: string;
  tags: ProjectTag[];
  /** One line: what it does / what came out of it. */
  outcome: string;
  /** Three or four concrete things it has. */
  points: string[];
  cover: {
    src: string;
    /** 'tall' = a 9:16 picture, shown as a phone on the brand gradient. */
    shape: 'wide' | 'tall';
    /** The picture's own size, so the browser keeps the space before it loads. */
    width?: number;
    height?: number;
  };
  /** A video from lib/studioVideos to play on the card instead of the cover. */
  videoId?: string;
  /** A demo or an example rather than a client's live project. */
  example?: boolean;
  /** Real work for a real client (never on a demo). */
  real?: boolean;
  /** Live demos: one short line — what a visitor can do in it. */
  tryIt?: string;
  links: ProjectLink[];
};

export const PROJECTS: Project[] = [
  {
    id: 'ticketing',
    title: 'MartNepali ticketing platform',
    client: 'MartNepali · our own platform',
    tags: ['App', 'Website'],
    outcome: 'Event pages, QR tickets and door scanning — used for a real concert night in Frankfurt.',
    points: ['Event page in your own style', 'QR tickets by email, seat maps', 'Door scan on any phone', 'Live sales and check-in counts'],
    cover: { src: '/media/studio/cover-ticketing.jpg', shape: 'wide', width: 960, height: 540 },
    links: [
      { href: '/showcase', label: 'See every feature' },
      { href: '/demo?to=tools-event', label: 'Try the demo' },
    ],
  },
  {
    id: 'restaurant',
    title: 'Restaurant ordering app',
    client: 'Example restaurant · demo',
    tags: ['App'],
    outcome: 'Guests order ahead or from the table; the kitchen sees every order on one board.',
    points: ['Menu online, order ahead', 'Pickup times and spice levels', 'Live kitchen board', 'A QR code on every table'],
    cover: { src: '/media/studio/cover-restaurant.jpg', shape: 'tall', width: 540, height: 960 },
    example: true,
    links: [
      { href: '/demo?to=tools-shop', label: 'Try the restaurant demo' },
      { href: '/market?category=khaja-food', label: 'Example menus' },
    ],
  },
  {
    id: 'bazaar',
    title: 'Online shops & the bazaar',
    client: 'Example shops · demo',
    tags: ['App', 'Website'],
    outcome: 'A shop page for every seller, one bazaar to browse them all, collection codes by email.',
    points: ['Your own shop page', 'Photos, stock and categories', 'Pick up with a QR collection code', 'Subscribe & save, promo codes'],
    cover: { src: '/media/studio/cover-bazaar.jpg', shape: 'tall', width: 540, height: 960 },
    example: true,
    links: [
      { href: '/market', label: 'Visit the bazaar' },
      { href: '/demo?to=shop', label: 'Try the shop demo' },
    ],
  },
  {
    id: 'npjoe',
    title: 'NPJOE e.V. website',
    client: 'Nepalesische Progressive Jugendorganisation · Darmstadt',
    tags: ['Website', 'Video'],
    outcome: 'One website for the whole association — in Deutsch, English and नेपाली.',
    points: ['Three languages', 'Programmes, events and gallery', 'Join or volunteer in minutes', 'Made for the phone'],
    cover: { src: '/media/studio/cover-npjoe.jpg', shape: 'wide', width: 960, height: 540 },
    videoId: 'web-npjoe',
    real: true,
    links: [{ href: '/studio#v-web-npjoe', label: 'Watch the promo' }],
  },
  {
    id: 'wedding',
    title: 'Wedding invitation website',
    client: 'Aarati & Sujan · a made-up couple · demo',
    tags: ['Website'],
    outcome: 'A Nepali wedding invitation that guests open on any phone — and answer in one tap.',
    points: ['English and नेपाली, one toggle', 'Live countdown and programme', 'RSVP, calendar and venue map', 'Share on WhatsApp'],
    cover: { src: '/media/studio/projects/wedding.jpg', shape: 'wide', width: 1200, height: 800 },
    example: true,
    tryIt: 'RSVP as a guest, switch to नेपाली and add the day to your calendar.',
    links: [
      { href: '/work/wedding', label: 'Open the invitation' },
      { href: '/contact?intent=website', label: 'Want one like this?' },
    ],
  },
  {
    id: 'artist',
    title: 'Artist page & press kit',
    client: 'Rimjhim Tara · a made-up singer · demo',
    tags: ['Website'],
    outcome: 'One page for a touring artist: music that plays, tour dates with tickets, a press kit to download.',
    points: ['A music player with a live visualizer', 'Tour dates linked to ticket pages', 'Press kit: one-sheet, bio, contact card', 'English and नेपाली, one toggle'],
    cover: { src: '/media/studio/projects/artist.jpg', shape: 'wide', width: 1200, height: 800 },
    example: true,
    tryIt: 'Play the songs, browse the tour dates and download the press kit.',
    links: [
      { href: '/work/artist', label: 'Open the artist page' },
      { href: '/contact?intent=website', label: 'Want one like this?' },
    ],
  },
  {
    id: 'quiz',
    title: 'Live event quiz',
    client: 'Dashain Sanjh Quiz Night · a made-up event · demo',
    tags: ['App'],
    outcome: 'A quiz for the break between acts: questions on the projector, the whole hall answering on their phones.',
    points: ['Join with a QR code and a nickname', 'Countdown, answer chart and live leaderboard', 'Podium with confetti at the end', 'English and नेपाली, one toggle'],
    cover: { src: '/media/studio/projects/quiz.jpg', shape: 'wide', width: 1200, height: 800 },
    example: true,
    tryIt: 'Join as a player and answer against the hall on the big screen.',
    links: [
      { href: '/work/quiz', label: 'Play the quiz' },
      { href: '/contact?intent=app', label: 'Want one like this?' },
    ],
  },
  {
    id: 'live',
    title: 'Live event dashboard',
    client: 'Tihar Night Live · a made-up concert · demo',
    tags: ['App'],
    outcome: 'The night on one screen: who is in, which door is busy, what is on stage — and the guests’ shout-outs for the hall.',
    points: ['Live check-ins against capacity', 'Arrivals chart and door queues', 'Shout-out wall and big screen mode', 'English and नेपाली, one toggle'],
    cover: { src: '/media/studio/projects/live.jpg', shape: 'wide', width: 1200, height: 800 },
    example: true,
    tryIt: 'Watch a concert night fill up, door by door, as it happens.',
    links: [
      { href: '/work/live', label: 'Open the dashboard' },
      { href: '/contact?intent=app', label: 'Want one like this?' },
    ],
  },
  {
    id: 'classes',
    title: 'Class booking app',
    client: 'Aangan Pathshala · a made-up Nepali school · demo',
    tags: ['App'],
    outcome: 'Nepali, dance, madal and harmonium classes booked from the phone — with a waitlist that moves by itself and a register on the teacher’s phone.',
    points: ['Classes, filters and a weekly timetable', 'Trial or term booking with a QR pass', 'Waitlist, reminders and add to calendar', 'Teacher view: register, QR scan, class notes'],
    cover: { src: '/media/studio/projects/classes.jpg', shape: 'wide', width: 1200, height: 800 },
    example: true,
    tryIt: 'Book a trial class, join a waitlist, then take the register as the teacher.',
    links: [
      { href: '/work/classes', label: 'Open the app' },
      { href: '/contact?intent=app', label: 'Want one like this?' },
    ],
  },
  {
    id: 'samaj',
    title: 'Association website kit',
    client: 'Saathi Samaj Main-Neckar e.V. · a made-up association · demo',
    tags: ['Website'],
    outcome: 'A whole website for a Nepali Verein — programme, news, membership and a members’ area — in three looks and three languages.',
    points: ['Programme calendar with tickets on MartNepali', 'Membership form with a printable confirmation', 'Members’ area: QR card, RSVPs, minutes and polls', 'Switch the look and make a logo, live'],
    cover: { src: '/media/studio/projects/samaj.jpg', shape: 'wide', width: 1200, height: 800 },
    example: true,
    tryIt: 'Switch the look, make a logo, become a member and vote in the members’ poll.',
    links: [
      { href: '/work/samaj', label: 'Open the website' },
      { href: '/contact?intent=website', label: 'Want one like this?' },
    ],
  },
  {
    id: 'tables',
    title: 'QR table ordering',
    client: 'Himalayan Chulo, Köln · a made-up restaurant · demo',
    tags: ['App'],
    outcome: 'Guests scan the code on their table and order from the phone; the kitchen board and the waiter see every order the moment it is sent.',
    points: ['Menu with options, allergens and search', 'Live order tracker, call waiter, order summary', 'Kitchen board with timers and stations', 'Floor plan, sold-out switch, table QR codes'],
    cover: { src: '/media/studio/projects/restaurant-demo.jpg', shape: 'wide', width: 1200, height: 800 },
    example: true,
    tryIt: 'Order momo at table 7, cook them on the kitchen board, then call the waiter.',
    links: [
      { href: '/work/restaurant', label: 'Open the restaurant' },
      { href: '/contact?intent=app', label: 'Want one like this?' },
      { href: '/demo?to=tools-shop', label: 'The restaurant pack on MartNepali' },
    ],
  },
  {
    id: 'saput',
    title: 'Prakash Saput Live · Frankfurt',
    client: 'Concert night · 31 Oct 2026',
    tags: ['Video', 'Website'],
    outcome: 'The whole night on screen: ads for the sale, walk-on intros, stage screens and song visuals.',
    points: ['Event ads for Reels and status', 'Walk-on intros for two acts', 'A stage screen for every act', 'Lyric visuals for the songs'],
    cover: { src: '/media/studio/stage-saput.jpg', shape: 'wide', width: 960, height: 540 },
    real: true,
    links: [
      { href: '/studio#videos', label: 'See the video work' },
      { href: '/contact?intent=video', label: 'Want one for your night?' },
    ],
  },
  {
    id: 'community',
    title: 'Community features',
    client: 'MartNepali · for everyone',
    tags: ['App', 'Website'],
    outcome: 'Meetups, a help board and festival cards — Nepalis in Germany, closer to each other.',
    points: ['Bhetghat meetups', 'Sahayog help board: rooms, rides', 'Festival greeting cards', 'Kalakar: Nepali artists'],
    cover: { src: '', shape: 'wide' },
    links: [{ href: '/community', label: 'Open the community' }],
  },
];

// ---- Live demos, filters, prev / next (pure — tests/projects.test.ts) ----

/** The project's try-it-yourself page (/work/<demo>), if it has one. */
export function demoHref(p: Project): string | undefined {
  return p.links.find((l) => l.href.startsWith('/work/'))?.href;
}

export function isLiveDemo(p: Project): boolean {
  return demoHref(p) !== undefined;
}

/** Every live demo, in PROJECTS order (the homepage strip, /work, prev / next). */
export const LIVE_DEMOS: Project[] = PROJECTS.filter(isLiveDemo);

export type ProjectFilter = 'all' | 'apps' | 'websites' | 'videos' | 'demos';
export const PROJECT_FILTERS: ProjectFilter[] = ['all', 'apps', 'websites', 'videos', 'demos'];

const TAG_FILTER: Record<ProjectTag, ProjectFilter> = { App: 'apps', Website: 'websites', Video: 'videos' };

/** The filters a project shows under (besides "all"). */
export function projectFilters(p: Project): ProjectFilter[] {
  const out = p.tags.map((t) => TAG_FILTER[t]);
  if (isLiveDemo(p)) out.push('demos');
  return out;
}

export function filterCounts(projects: Project[]): Record<ProjectFilter, number> {
  const counts: Record<ProjectFilter, number> = { all: projects.length, apps: 0, websites: 0, videos: 0, demos: 0 };
  for (const p of projects) for (const f of projectFilters(p)) counts[f] += 1;
  return counts;
}

/** ?tag= from a URL → a filter. Takes singular and plural ("app", "apps"), anything else is "all". */
export function asProjectFilter(v: unknown): ProjectFilter {
  if (typeof v !== 'string') return 'all';
  const s = v.trim().toLowerCase();
  if (s === 'live' || s === 'demo') return 'demos';
  const plural = (s.endsWith('s') ? s : `${s}s`) as ProjectFilter;
  return PROJECT_FILTERS.includes(plural) ? plural : 'all';
}

/** The demos either side of this one, wrapping round; null when it is not a demo. */
export function demoNeighbours(id: string, demos: Project[] = LIVE_DEMOS): { prev: Project; next: Project } | null {
  const i = demos.findIndex((p) => p.id === id);
  if (i < 0 || demos.length < 2) return null;
  return { prev: demos[(i - 1 + demos.length) % demos.length], next: demos[(i + 1) % demos.length] };
}
