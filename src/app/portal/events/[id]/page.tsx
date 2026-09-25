import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getEventById } from '@/lib/events';
import { getStats } from '@/lib/orders';
import { organizerPlanActive } from '@/lib/organizers';
import { readListingName } from '@/lib/exampleShop';
import { listWishTotals } from '@/lib/wishes';
import { parseSlotConfig } from '@/lib/kitchen';
import { clipForTool, storyForListing } from '@/lib/stories';
import StoryPlayer from '@/components/StoryPlayer';
import PlanExpired from '../../PlanExpired';
import PortalNav from '../../PortalNav';
import { requirePortalOrganizer } from '../../guard';
import { ToolIconView } from '../../HubIcons';
import { listingTools } from '../../listingTools';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Tools — Organizer portal',
  robots: { index: false, follow: false },
};

/**
 * One listing's tool board: its four numbers, then every tool it has as a big
 * button with one line saying what it is for. The sidebar's listing links land
 * here, and every tool page's "All tools" tab comes back here — so a seller
 * never has to remember where anything lives: open, pick, go, come back.
 */
export default async function ListingToolsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const organizer = await requirePortalOrganizer();
  if (!organizerPlanActive(organizer)) return <PlanExpired organizer={organizer} />;
  const event = getEventById(id);
  if (!event || event.organizerId !== organizer.id) redirect('/portal');

  const isShop = event.kind === 'shop';
  const stats = getStats(event.id);
  const tools = listingTools(event).filter((t) => t.key !== 'overview');
  const main = tools.filter((t) => t.primary);
  const more = tools.filter((t) => !t.primary);
  const published = event.status === 'published';
  const { name } = readListingName(event.name);
  // "Add to wish list" taps on this listing's items (lib/wishes) — mostly
  // "Coming soon" rows: how many would buy each the day it opens.
  const wishes = listWishTotals(organizer.id).filter((w) => w.eventId === event.id);
  // The story video for this kind of business: each tool plays its chapter.
  const story = storyForListing(event.kind, isShop ? parseSlotConfig(event.pickupSlots) : null);

  const badge: Record<string, string> = {};
  if (stats.awaitingTransferOrders > 0) badge.orders = `${stats.awaitingTransferOrders} to confirm`;
  if (!published) badge.edit = 'Finish & publish';

  return (
    <>
      <PortalNav
        event={{
          id: event.id,
          name: event.name,
          slug: event.slug,
          published,
          kind: event.kind,
        }}
        tab="overview"
      />
      <div className="container section hub-board">
        <header className="hub-board-head anim-fade-up">
          <p className="feed-kicker">{isShop ? 'Your shop' : 'Your event'}</p>
          <h1 className="page-title" style={{ margin: '2px 0 0' }}>
            {name}
            {!published && <span className="badge badge-amber hub-board-draft">Not published</span>}
          </h1>
          {story && (
            <p style={{ margin: '10px 0 0' }}>
              <StoryPlayer storyId={story.id} label={`Watch how it works · ${Math.round(story.length / 60)} min`} />
            </p>
          )}
        </header>

        {wishes.length > 0 && (
          <section className="wish-board anim-fade-up">
            <h2 className="hub-board-title" style={{ marginTop: 0 }}>
              ♥ On buyers&rsquo; wish lists
            </h2>
            <ul>
              {wishes.map((w) => (
                <li key={w.tierKey}>
                  <span>
                    {w.tierName}
                    {w.tierStatus === 'coming-soon' && <span className="badge badge-green">Coming soon</span>}
                  </span>
                  <strong>
                    {w.wishes} {w.wishes === 1 ? 'wants' : 'want'} it
                  </strong>
                </li>
              ))}
            </ul>
            <p className="muted small" style={{ margin: 0 }}>
              People tapped &ldquo;Add to wish list&rdquo; on these. Put a coming-soon {isShop ? 'item' : 'ticket'} on
              sale in <Link href={`/portal/events/${event.id}/edit`}>the editor</Link> when you are ready.
            </p>
          </section>
        )}

        <h2 className="hub-board-title">Run it</h2>
        <div className="hub-board-grid anim-fade-up anim-d1">
          {main.map((t) => {
            const clip = story ? clipForTool(story, t.key) : null;
            return (
              <div key={t.key} className="hub-board-cell">
                <Link href={t.href} className={`hub-board-tool hub-board-${t.key}`}>
                  <span className="hub-board-icon">
                    <ToolIconView icon={t.icon} />
                  </span>
                  <span className="hub-board-text">
                    <strong>{t.label}</strong>
                    <span>{t.line}</span>
                  </span>
                  {badge[t.key] ? <span className="hub-board-badge">{badge[t.key]}</span> : null}
                  <span className="hub-board-go" aria-hidden="true">
                    →
                  </span>
                </Link>
                {/* This tool's chapter of the story video, beside its button. */}
                {clip && story && (
                  <span className="hub-board-see">
                    <StoryPlayer
                      storyId={story.id}
                      start={clip.start}
                      end={clip.end}
                      label={clip.label}
                      variant="mini"
                    />
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <h2 className="hub-board-title">Set up &amp; share</h2>
        <div className="hub-board-grid hub-board-grid-small anim-fade-up anim-d2">
          {more.map((t) => (
            <Link
              key={t.key}
              href={t.href}
              className="hub-board-tool"
              {...(t.external ? { target: '_blank', rel: 'noopener' } : {})}
            >
              <span className="hub-board-icon">
                <ToolIconView icon={t.icon} />
              </span>
              <span className="hub-board-text">
                <strong>{t.label}</strong>
                <span>{t.line}</span>
              </span>
              <span className="hub-board-go" aria-hidden="true">
                {t.external ? '↗' : '→'}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
