// Every video the studio shows — the homepage "Video work", /studio and the
// project cards all read THIS list (one place to add a film).
// Small web copies (720p for 9:16, 960×540 for 16:9, crf ~27, AAC 96k,
// +faststart) of films made with tools/ad-videos or edited by the team, served
// from public/media/studio with a poster each: nothing downloads until someone
// presses play (preload="none").
//
// The concert song visuals (the artist's own music videos) were taken off the
// site on 8 Nov 2026 — do not add them back without the artist's written OK.

export type StudioVideo = {
  id: string;
  src: string;
  poster: string;
  title: string;
  text: string;
  /** Landscape (16:9) films: stage screens, walk-on intros, promos. Default is 9:16. */
  wide?: boolean;
  /** Silent loops (stage screens): muted, looping. */
  loop?: boolean;
};

export type VideoGroupId = 'brand' | 'event' | 'walkon' | 'stage' | 'web';

export type VideoGroup = {
  id: VideoGroupId;
  /** Short tab label. */
  label: string;
  title: string;
  text: string;
  videos: StudioVideo[];
};

const v = (id: string, title: string, text: string, extra: Partial<StudioVideo> = {}): StudioVideo => ({
  id,
  src: `/media/studio/${id}.mp4`,
  poster: `/media/studio/${id}.jpg`,
  title,
  text,
  ...extra,
});

/** The 16:9 MartNepali stage promo — the homepage showreel. */
export const SHOWREEL: StudioVideo = v(
  'brand-stage',
  'MartNepali — we built this',
  'The stage promo shown at Prakash Saput Live: website, tickets, check-in, videos — built by us.',
  { wide: true }
);

/** MartNepali's own brand ads — 20 s each, every one with its own original music. */
export const BRAND_REELS: StudioVideo[] = [
  v('brand-pov', '10 seconds to live', 'An event goes live in 9.8 seconds — then the whole night, on phones.'),
  v('brand-factory', 'The build factory', 'A clay toy factory builds the app, piece by piece.'),
  v('brand-reel', 'Into the light', 'A 3D fly-through: event page, shop, tickets, door scan.'),
  v('brand-sketch', 'Idea → real', 'A pencil sketch on paper becomes the real, glowing app.'),
  v('brand-globe', 'Nepal to the world', 'A 3D Earth of light — arcs fly out from Kathmandu.'),
  v('brand-type', 'Type in motion', 'Bold type on a grid: events, shops, tickets, scans, sales.'),
];

/** The first MartNepali ads (Oct 2026), in Nepali. */
export const FIRST_ADS: StudioVideo[] = [
  v('ad-4-organizer', 'For organizers · in Nepali', 'Tickets, seat maps, door scanning — in Nepali.'),
  v('ad-3-restaurant', 'For restaurants · in Nepali', 'Order ahead, kitchen board, QR on every table.'),
  v('ad-1-customer', 'For everyone · in Nepali', 'Momo, events and the bazaar — the taste of home.'),
];

/** Ads made for one real show: Prakash Saput Live, Frankfurt, 31 Oct 2026. */
export const SHOW_PROMOS: StudioVideo[] = [
  v('event-desh', '“Missing home?”', 'Prayer flags, the Himalaya, then the show and its supporters — to the artist’s own song.'),
  v('event-npjoe', 'The line-up', 'Opening act, the star, the after party and the supporters — party style.'),
];

export const WALK_ONS: StudioVideo[] = [
  v('stage-walkon', 'Walk-on · Prakash Saput', 'The last seconds before the artist walks on stage — 3D, one warm glow.', { wide: true }),
  v('walkon-untitled', 'Walk-on · The Untitled Nepal', 'The opening band’s entrance: their photos, their city, “Are you ready?”.', { wide: true }),
];

export const STAGE_SCREENS: StudioVideo[] = [
  v('stage-saput', 'Stage screen · Prakash Saput', 'Behind the star: his songs, his honours, the Europe tour.', { wide: true, loop: true }),
  v('stage-untitled-live', 'Stage screen · The Untitled Nepal', 'A live-show look for the opening band.', { wide: true, loop: true }),
  v('stage-bhailo', 'Stage screen · Deusi Bhailo', 'A looping backdrop behind the Deusi–Bhailo group.', { wide: true, loop: true }),
  v('stage-dance', 'Stage screen · Dance', 'Behind the dance performance.', { wide: true, loop: true }),
  v('stage-untitled', 'Stage screen · Opening band', 'For the opening act, The Untitled Nepal.', { wide: true, loop: true }),
  v('stage-dj', 'Stage screen · After party', 'Neon and beat bars for the DJ set.', { wide: true, loop: true }),
];

export const WEB_PROMOS: StudioVideo[] = [
  v('web-npjoe', 'Website promo · NPJOE e.V.', 'One website, everything NPJOE: three languages, programmes, join in minutes.', { wide: true }),
];

/** The video work, by kind — the homepage tabs and /studio both read this. */
export const VIDEO_GROUPS: VideoGroup[] = [
  {
    id: 'brand',
    label: 'MartNepali ads',
    title: 'Our own ads',
    text: 'Reels for TikTok, Instagram and WhatsApp status — each in a different style, with its own music.',
    videos: [...BRAND_REELS, ...FIRST_ADS, SHOWREEL],
  },
  {
    id: 'event',
    label: 'Event ads',
    title: 'Ads that sell a night out',
    text: 'Made for Prakash Saput Live, Frankfurt, 31 Oct 2026 — posted in the groups before the ticket sale.',
    videos: SHOW_PROMOS,
  },
  {
    id: 'walkon',
    label: 'Walk-on intros',
    title: 'Walk-on intros',
    text: 'The lights go down, the screen counts in, the artist walks on.',
    videos: WALK_ONS,
  },
  {
    id: 'stage',
    label: 'Stage screens',
    title: 'Stage screens',
    text: 'Looping backdrops behind every act on the concert screen.',
    videos: [...STAGE_SCREENS],
  },
  {
    id: 'web',
    label: 'Website promos',
    title: 'Website promos',
    text: 'A short film that shows a new website off — for the launch post and the big screen.',
    videos: [...WEB_PROMOS],
  },
];

export const ALL_VIDEOS: StudioVideo[] = VIDEO_GROUPS.flatMap((g) => g.videos);

export function videoById(id: string): StudioVideo | undefined {
  return ALL_VIDEOS.find((x) => x.id === id);
}
