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
  id: 'restaurant' | 'shop' | 'event';
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
    title: 'A Friday evening at a momo kitchen',
    forWho: 'Restaurants & food',
    icon: '🥟',
    src: '/media/stories/restaurant.mp4',
    poster: '/media/stories/restaurant-poster.jpg',
    length: 86,
    chapters: [{"id": "home", "tool": "overview", "chapter": "Open your restaurant", "start": 3.2, "end": 8.11}, {"id": "order", "tool": "buyer", "chapter": "A customer orders", "start": 8.11, "end": 25.06}, {"id": "paid", "tool": "buyer", "chapter": "Paid \u00b7 QR code", "start": 25.06, "end": 33.53}, {"id": "orders", "tool": "orders", "chapter": "New order!", "start": 33.53, "end": 37.66}, {"id": "transfer", "tool": "orders", "chapter": "Confirm a transfer", "start": 37.66, "end": 45.18}, {"id": "kitchen", "tool": "kitchen", "chapter": "Kitchen: cook it", "start": 45.18, "end": 56.42}, {"id": "ready", "tool": "buyer", "chapter": "Customer sees \u201cready\u201d", "start": 56.42, "end": 61.75}, {"id": "collect", "tool": "checkin", "chapter": "Hand it over", "start": 61.75, "end": 67.86}, {"id": "live", "tool": "live", "chapter": "Live screen", "start": 67.86, "end": 73.11}, {"id": "insights", "tool": "insights", "chapter": "Insights", "start": 73.11, "end": 78.44}],
  },
];

export function storyById(id: string): Story | null {
  return STORIES.find((s) => s.id === id) ?? null;
}

/**
 * The story for a listing: a shop that cooks and hands over (pickup times,
 * kitchen) is a restaurant; appointment shops have none yet; events and plain
 * shops get theirs once recorded.
 */
export function storyForListing(kind: 'event' | 'shop', purpose: 'collection' | 'appointment' | null): Story | null {
  if (kind === 'shop' && purpose !== 'appointment') return storyById('restaurant');
  if (kind === 'event') return storyById('event');
  return null;
}

/** The stretch of the story a tool button plays: its chapters, joined. */
export function clipForTool(story: Story, tool: string): { start: number; end: number; label: string } | null {
  const hits = story.chapters.filter((c) => c.tool === tool);
  if (!hits.length) return null;
  const start = Math.min(...hits.map((c) => c.start));
  const end = Math.max(...hits.map((c) => c.end));
  return { start, end, label: hits.map((c) => c.chapter).join(' · ') };
}
