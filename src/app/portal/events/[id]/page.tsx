import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getEventById } from '@/lib/events';
import { formatMoney } from '@/lib/money';
import { getStats } from '@/lib/orders';
import { organizerPlanActive } from '@/lib/organizers';
import { readListingName } from '@/lib/exampleShop';
import { vocabFor } from '@/lib/vocab';
import PlanExpired from '../../PlanExpired';
import PortalNav from '../../PortalNav';
import { requirePortalOrganizer } from '../../guard';
import { ToolIconView } from '../../HubIcons';
import { listingTools } from '../../listingTools';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Tools — Organizer portal', robots: { index: false, follow: false } };

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
  const v = vocabFor(event.kind);
  const stats = getStats(event.id);
  const tools = listingTools(event).filter((t) => t.key !== 'overview');
  const main = tools.filter((t) => t.primary);
  const more = tools.filter((t) => !t.primary);
  const published = event.status === 'published';
  const { name } = readListingName(event.name);

  const badge: Record<string, string> = {};
  if (stats.awaitingTransferOrders > 0) badge.orders = `${stats.awaitingTransferOrders} to confirm`;
  if (!published) badge.edit = 'Finish & publish';

  return (
    <>
      <PortalNav
        event={{ id: event.id, name: event.name, slug: event.slug, published, kind: event.kind }}
        tab="overview"
      />
      <div className="container section hub-board">
        <header className="hub-board-head anim-fade-up">
          <p className="feed-kicker">{isShop ? 'Your shop' : 'Your event'}</p>
          <h1 className="page-title" style={{ margin: '2px 0 6px' }}>
            {name}
          </h1>
          <p className="muted" style={{ margin: 0 }}>
            {published ? 'Live on the site.' : 'Not published yet — only you can see it.'} Pick a tool below; “All tools”
            at the top of every page brings you back here.
          </p>
        </header>

        <div className="hub-board-stats anim-fade-up anim-d1">
          <div>
            <strong>{stats.ticketsSold}</strong>
            <span>{isShop ? 'items sold' : 'tickets sold'}</span>
          </div>
          <div>
            <strong>{formatMoney(stats.revenueCents, event.currency)}</strong>
            <span>received</span>
          </div>
          <div className={stats.awaitingTransferOrders > 0 ? 'hub-board-stat-warn' : undefined}>
            <strong>{stats.awaitingTransferOrders}</strong>
            <span>to confirm</span>
          </div>
          <div>
            <strong>{stats.checkedIn}</strong>
            <span>{isShop ? 'collected' : 'checked in'}</span>
          </div>
        </div>

        <h2 className="hub-board-title">Run it</h2>
        <div className="hub-board-grid anim-fade-up anim-d1">
          {main.map((t) => (
            <Link key={t.key} href={t.href} className={`hub-board-tool hub-board-${t.key}`}>
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
          ))}
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
        <p className="muted small" style={{ marginTop: 18 }}>
          {v.Redeem} and the live screen work best on a phone or tablet at the {isShop ? 'counter' : 'door'}.
        </p>
      </div>
    </>
  );
}
