// The story videos (tools/story-videos): one business's day on MartNepali per
// video, chapter by chapter, with an explanation beside the phone. A tool
// button's "See how" plays just its chapters of the story that fits the
// listing; the demo and Sell-with-us pages play the whole thing.
//
// Chapter times are the rendered video's own (tools/story-videos/out/<id>/
// chapters.json) — re-render a story, paste its chapters here.
// Safe on the client: data only.

export interface StoryChapter {
  id: string;
  /** The tool button that plays this chapter ('buyer' / 'overview' = none). */
  tool: string;
  chapter: string;
  start: number;
  end: number;
}

export interface Story {
  id: 'restaurant' | 'shop' | 'event' | 'customer';
  /** Who watches it: sellers (demo, Sell-with-us, tool buttons) or buyers (homepage, the Ask chat). */
  audience: 'seller' | 'buyer';
  title: string;
  /** Who it is for, in two or three words. */
  forWho: string;
  icon: string;
  src: string;
  poster: string;
  /** Whole seconds, for the label. */
  length: number;
  chapters: StoryChapter[];
}

export const STORIES: Story[] = [
  {
    id: 'restaurant',
    audience: 'seller',
    title: 'A Friday evening at a momo kitchen',
    forWho: 'Restaurants & food',
    icon: '🥟',
    src: '/media/stories/restaurant.mp4',
    poster: '/media/stories/restaurant-poster.jpg',
    length: 86,
    chapters: [{"id": "home", "tool": "overview", "chapter": "Open your restaurant", "start": 3.2, "end": 8.11}, {"id": "order", "tool": "buyer", "chapter": "A customer orders", "start": 8.11, "end": 25.06}, {"id": "paid", "tool": "buyer", "chapter": "Paid \u00b7 QR code", "start": 25.06, "end": 33.53}, {"id": "orders", "tool": "orders", "chapter": "New order!", "start": 33.53, "end": 37.66}, {"id": "transfer", "tool": "orders", "chapter": "Confirm a transfer", "start": 37.66, "end": 45.18}, {"id": "kitchen", "tool": "kitchen", "chapter": "Kitchen: cook it", "start": 45.18, "end": 56.42}, {"id": "ready", "tool": "buyer", "chapter": "Customer sees \u201cready\u201d", "start": 56.42, "end": 61.75}, {"id": "collect", "tool": "checkin", "chapter": "Hand it over", "start": 61.75, "end": 67.86}, {"id": "live", "tool": "live", "chapter": "Live screen", "start": 67.86, "end": 73.11}, {"id": "insights", "tool": "insights", "chapter": "Insights", "start": 73.11, "end": 78.44}],
  },
  {
    id: 'shop',
    audience: 'seller',
    title: 'A week at a grocery shop',
    forWho: 'Shops & goods',
    icon: '🛍',
    src: '/media/stories/shop.mp4',
    poster: '/media/stories/shop-poster.jpg',
    length: 69,
    chapters: [{"id": "home", "tool": "overview", "chapter": "Open your shop", "start": 3.2, "end": 7.86}, {"id": "order", "tool": "buyer", "chapter": "A customer orders", "start": 7.86, "end": 26.59}, {"id": "paid", "tool": "buyer", "chapter": "Paid · pickup code", "start": 26.59, "end": 35.93}, {"id": "orders", "tool": "orders", "chapter": "New order!", "start": 35.93, "end": 39.93}, {"id": "transfer", "tool": "orders", "chapter": "Confirm a transfer", "start": 39.93, "end": 47.35}, {"id": "collect", "tool": "checkin", "chapter": "Hand it over", "start": 47.35, "end": 53.26}, {"id": "wishes", "tool": "overview", "chapter": "What people want", "start": 53.26, "end": 56.64}, {"id": "insights", "tool": "insights", "chapter": "Insights", "start": 56.64, "end": 62}],
  },
  {
    id: 'event',
    audience: 'seller',
    title: 'Dashain Night, from first ticket to a full hall',
    forWho: 'Event organizers',
    icon: '🎟',
    src: '/media/stories/event.mp4',
    poster: '/media/stories/event-poster.jpg',
    length: 77,
    chapters: [{"id": "home", "tool": "overview", "chapter": "Tickets on sale", "start": 3.2, "end": 8.01}, {"id": "order", "tool": "buyer", "chapter": "A guest picks seats", "start": 8.01, "end": 24.34}, {"id": "paid", "tool": "buyer", "chapter": "QR tickets", "start": 24.34, "end": 35.18}, {"id": "orders", "tool": "orders", "chapter": "New booking", "start": 35.18, "end": 39.25}, {"id": "transfer", "tool": "orders", "chapter": "Confirm a transfer", "start": 39.25, "end": 46.84}, {"id": "insights", "tool": "insights", "chapter": "Sales day by day", "start": 46.84, "end": 53.66}, {"id": "door", "tool": "checkin", "chapter": "Scan at the door", "start": 53.66, "end": 64}, {"id": "live", "tool": "live", "chapter": "Live screen", "start": 64, "end": 69.58}],
  },
  {
    id: 'customer',
    audience: 'buyer',
    title: 'Find it, ask for it, order it',
    forWho: 'For customers',
    icon: '🧡',
    src: '/media/stories/customer-v2.mp4',
    poster: '/media/stories/customer-v2-poster.jpg',
    length: 108,
    chapters: [{"id": "home", "tool": "home", "chapter": "Discover", "start": 3.2, "end": 10.66}, {"id": "ask", "tool": "ask", "chapter": "Ask anything", "start": 10.66, "end": 35.18}, {"id": "bazaar", "tool": "bazaar", "chapter": "The bazaar", "start": 35.18, "end": 46.97}, {"id": "order", "tool": "order", "chapter": "Order ahead", "start": 46.97, "end": 64.57}, {"id": "ready", "tool": "order", "chapter": "Watch it get ready", "start": 64.57, "end": 73.04}, {"id": "tickets", "tool": "tickets", "chapter": "Tickets for a night out", "start": 73.04, "end": 95.39}, {"id": "wish", "tool": "wish", "chapter": "Wish list", "start": 95.39, "end": 100.95}],
  },
];

export function storyById(id: string): Story | null {
  return STORIES.find((s) => s.id === id) ?? null;
}

/**
 * The story for a listing: a shop that cooks to a pickup time (the kitchen
 * pack) is a restaurant, any other shop sells goods over the counter, an event
 * is an event. Appointment shops (salons) have none yet.
 */
export function storyForListing(
  kind: 'event' | 'shop',
  slots: { enabled: boolean; purpose: 'collection' | 'appointment' } | null
): Story | null {
  if (kind === 'event') return storyById('event');
  if (slots?.purpose === 'appointment') return null;
  return storyById(slots?.enabled ? 'restaurant' : 'shop') ?? storyById('restaurant');
}

/** The stretch of the story a tool button plays: its chapters, joined. */
export function clipForTool(story: Story, tool: string): { start: number; end: number; label: string } | null {
  const hits = story.chapters.filter((c) => c.tool === tool);
  if (!hits.length) return null;
  const start = Math.min(...hits.map((c) => c.start));
  const end = Math.max(...hits.map((c) => c.end));
  return { start, end, label: hits.map((c) => c.chapter).join(' · ') };
}
