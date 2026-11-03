// The studio's project list — the homepage "Projects" cards and /studio read
// this. Add a project by adding one entry; nothing else needs to change.
//
// Rules for what goes in here (see app/studio/page.tsx): no prices, quotes or
// paid-service claims, and anything that is an example or a demo says so
// (`example: true` shows an "Example project" badge). Real clients are named
// only by their public name (an association, a band, a public artist) — never a
// private person.

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
  };
  /** A video from lib/studioVideos to play on the card instead of the cover. */
  videoId?: string;
  /** A demo or an example rather than a client's live project. */
  example?: boolean;
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
    cover: { src: '/media/studio/cover-ticketing.jpg', shape: 'wide' },
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
    cover: { src: '/media/studio/cover-restaurant.jpg', shape: 'tall' },
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
    cover: { src: '/media/studio/cover-bazaar.jpg', shape: 'tall' },
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
    cover: { src: '/media/studio/cover-npjoe.jpg', shape: 'wide' },
    videoId: 'web-npjoe',
    links: [{ href: '/studio#v-web-npjoe', label: 'Watch the promo' }],
  },
  {
    id: 'wedding',
    title: 'Wedding invitation website',
    client: 'Aarati & Sujan · a made-up couple · demo',
    tags: ['Website'],
    outcome: 'A Nepali wedding invitation that guests open on any phone — and answer in one tap.',
    points: ['English and नेपाली, one toggle', 'Live countdown and programme', 'RSVP, calendar and venue map', 'Share on WhatsApp'],
    cover: { src: '/media/studio/projects/wedding.jpg', shape: 'wide' },
    example: true,
    links: [
      { href: '/work/wedding', label: 'Open the invitation' },
      { href: '/contact?intent=website', label: 'Want one like this?' },
    ],
  },
  {
    id: 'saput',
    title: 'Prakash Saput Live · Frankfurt',
    client: 'Concert night · 31 Oct 2026',
    tags: ['Video', 'Website'],
    outcome: 'The whole night on screen: ads for the sale, walk-on intros, stage screens and song visuals.',
    points: ['Event ads for Reels and status', 'Walk-on intros for two acts', 'A stage screen for every act', 'Lyric visuals for the songs'],
    cover: { src: '/media/studio/stage-saput.jpg', shape: 'wide' },
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
