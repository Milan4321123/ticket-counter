// "See your business running" — a card per story video (lib/stories), for the
// demo and Sell-with-us pages. Each plays the whole story, chapter by chapter.
import { STORIES } from '@/lib/stories';
import StoryPlayer from './StoryPlayer';

export default function StoryShelf({ title = 'See your business running' }: { title?: string }) {
  if (STORIES.length === 0) return null;
  return (
    <section className="ss" aria-label={title}>
      <h2 className="ss-title">{title}</h2>
      <p className="ss-sub">A real day in the app for your kind of business — orders, payments, the counter or the door, insights — every step explained.</p>
      <div className="ss-grid">
        {STORIES.map((s) => (
          <StoryPlayer key={s.id} storyId={s.id} variant="card" />
        ))}
      </div>
    </section>
  );
}
