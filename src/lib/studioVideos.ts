// The videos shown on /studio and in the homepage "Videos we made" rail.
// Small web copies (720p, ~2–4 MB) of the films made with tools/ad-videos,
// served from public/media/studio with a poster each: nothing downloads until
// someone presses play (preload="none").

export type StudioVideo = {
  id: string;
  src: string;
  poster: string;
  title: string;
  text: string;
  /** Landscape (16:9) films: stage screens and walk-on intros. Default is 9:16. */
  wide?: boolean;
  /** Silent loops (stage screens): muted, looping. */
  loop?: boolean;
};

const v = (id: string, title: string, text: string, extra: Partial<StudioVideo> = {}): StudioVideo => ({
  id,
  src: `/media/studio/${id}.mp4`,
  poster: `/media/studio/${id}.jpg`,
  title,
  text,
  ...extra,
});

/** MartNepali's own brand ads — 20 s each, every one with its own original music. */
export const BRAND_REELS: StudioVideo[] = [
  v('brand-pov', '10 seconds to live', 'An event goes live in 9.8 seconds — then the whole night, on phones.'),
  v('brand-factory', 'The build factory', 'A clay toy factory builds the app, piece by piece.'),
  v('brand-reel', 'Into the light', 'A 3D fly-through: event page, shop, tickets, door scan.'),
  v('brand-sketch', 'Idea → real', 'A pencil sketch on paper becomes the real, glowing app.'),
  v('brand-globe', 'Nepal to the world', 'A 3D Earth of light — arcs fly out from Kathmandu.'),
  v('brand-type', 'Type in motion', 'Bold type on a grid: events, shops, tickets, scans, sales.'),
];

/** Made for one real show: Prakash Saput Live, Frankfurt, 31 Oct 2026. */
export const SHOW_PROMOS: StudioVideo[] = [
  v('event-desh', '“Missing home?”', 'Prayer flags, the Himalaya, then the show and its supporters — to the artist’s own song.'),
  v('event-npjoe', 'The line-up', 'Opening act, the star, the after party and the supporters — party style.'),
];

export const SHOW_STAGE: StudioVideo[] = [
  v('stage-walkon', 'Walk-on intro', 'The last seconds before the artist walks on stage.', { wide: true }),
  v('stage-bhailo', 'Stage screen · Deusi Bhailo', 'A looping backdrop behind the Deusi–Bhailo group.', { wide: true, loop: true }),
  v('stage-dance', 'Stage screen · Dance', 'Behind the dance performance.', { wide: true, loop: true }),
  v('stage-untitled', 'Stage screen · Opening band', 'For the opening act, The Untitled Nepal.', { wide: true, loop: true }),
  v('stage-dj', 'Stage screen · After party', 'Neon and beat bars for the DJ set.', { wide: true, loop: true }),
];

/** The first MartNepali ads (Oct 2026), in Nepali. */
export const FIRST_ADS: StudioVideo[] = [
  { id: 'ad-4-organizer', src: '/media/studio/ad-4-organizer.mp4', poster: '/media/studio/ad-4-organizer.jpg', title: 'For organizers', text: 'Tickets, seat maps, door scanning — in Nepali.' },
  { id: 'ad-3-restaurant', src: '/media/studio/ad-3-restaurant.mp4', poster: '/media/studio/ad-3-restaurant.jpg', title: 'For restaurants', text: 'Order ahead, kitchen board, QR on every table.' },
  { id: 'ad-1-customer', src: '/media/studio/ad-1-customer.mp4', poster: '/media/studio/ad-1-customer.jpg', title: 'For everyone', text: 'Momo, events and the bazaar — the taste of home.' },
];
