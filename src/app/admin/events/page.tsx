import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isAdminRequest } from '@/lib/auth';
import { readCapacityLog } from '@/lib/capacity';
import { getEventTiersBulk, listAllEvents } from '@/lib/events';
import { getAvailabilityBulk } from '@/lib/inventory';
import { listOrganizers } from '@/lib/organizers';
import CapacityForm from './CapacityForm';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Ticket limits — Admin',
  robots: { index: false, follow: false },
};

const STATUS_LABEL: Record<string, string> = {
  published: 'Live',
  draft: 'Draft',
  archived: 'Archived',
};

/**
 * Release more tickets for any event on the platform.
 *
 * The organizer can already do this in their own portal, and normally should.
 * This exists for when they cannot or will not: their account is switched off,
 * they are at the venue with the queue outside, or they simply asked. Every
 * change here is recorded per event and shown underneath it, because an admin
 * editing someone else's inventory is reaching into another business's stock.
 */
export default async function AdminEventsPage() {
  if (!(await isAdminRequest())) redirect('/admin/login');

  const organizerName = new Map(listOrganizers().map((o) => [o.id, o.name]));
  // Archived events are frozen by the platform and cannot sell, so a control
  // for releasing more of their tickets would be a button that does nothing.
  const events = listAllEvents().filter((e) => e.status !== 'archived');
  // Every event on the platform is on this page, so read the tiers and the sold
  // counts once for all of them rather than three statements per card.
  const tiersByEvent = getEventTiersBulk(events.map((e) => e.id));
  const availabilityByEvent = getAvailabilityBulk(events, tiersByEvent);

  return (
    <div className="container section">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>
            Ticket limits
          </h1>
          <p className="muted small" style={{ margin: '4px 0 0', maxWidth: 640 }}>
            Release more tickets for any event. Two numbers decide what can be sold — the event
            total and each ticket type&rsquo;s own limit — and the lower one always wins, so both
            are here together. Changes take effect immediately.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link href="/admin" className="btn btn-sm">
            Dashboard
          </Link>
          <Link href="/admin/organizers" className="btn btn-sm">
            Organizers
          </Link>
        </div>
      </div>

      {events.length === 0 ? (
        <p className="muted" style={{ marginTop: 24 }}>
          There are no events yet.
        </p>
      ) : (
        <div style={{ display: 'grid', gap: 16, marginTop: 24 }}>
          {events.map((event) => {
            const availability = availabilityByEvent.get(event.id)!;
            const tiers = (tiersByEvent.get(event.id) ?? []).map((t) => ({
              tierKey: t.tierKey,
              name: t.name,
              cap: t.cap,
              sold: availability.tiers[t.tierKey]?.sold ?? 0,
              // The form needs the weight between this tier's bookings and the
              // room's seats to lift caps in the right denomination.
              seatsPerUnit: t.seatsPerUnit,
            }));
            const log = readCapacityLog(event.id);
            const soldOut = availability.totalRemaining === 0;

            return (
              <div className="card" key={event.id}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                    flexWrap: 'wrap',
                    alignItems: 'baseline',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700 }}>
                      {event.name}{' '}
                      <span className={`badge ${event.status === 'published' ? 'badge-green' : 'badge-amber'}`}>
                        {STATUS_LABEL[event.status] ?? event.status}
                      </span>
                      {soldOut ? (
                        <span className="badge badge-red" style={{ marginLeft: 6 }}>
                          Sold out
                        </span>
                      ) : null}
                    </div>
                    <div className="muted small">
                      {organizerName.get(event.organizerId) ?? 'Unknown organizer'}
                      {event.dateDisplay ? ` · ${event.dateDisplay}` : ''}
                    </div>
                  </div>
                  <div className="mono small muted">
                    {availability.totalSold} sold of {availability.totalCap} ·{' '}
                    <strong style={{ color: soldOut ? 'var(--red)' : 'var(--green)' }}>
                      {availability.totalRemaining} left
                    </strong>
                  </div>
                </div>

                <div style={{ marginTop: 14 }}>
                  <CapacityForm
                    eventId={event.id}
                    totalCapacity={availability.totalCap}
                    totalSold={availability.totalSold}
                    tiers={tiers}
                  />
                </div>

                {log.length > 0 && (
                  <details style={{ marginTop: 12 }}>
                    <summary className="muted small" style={{ cursor: 'pointer' }}>
                      {log.length} admin change{log.length === 1 ? '' : 's'} to this event&rsquo;s limits
                    </summary>
                    <ul className="muted small" style={{ margin: '8px 0 0', paddingLeft: 18 }}>
                      {log.map((entry) => (
                        <li key={entry.at}>
                          <span className="mono">{entry.at}</span> — total {entry.totalFrom} →{' '}
                          {entry.totalTo}
                          {entry.tiers.length
                            ? `; ${entry.tiers.map((t) => `${t.tierKey} ${t.from} → ${t.to}`).join(', ')}`
                            : ''}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
