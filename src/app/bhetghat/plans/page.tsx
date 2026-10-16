import Link from 'next/link';
import CommunityNav from '@/components/community/CommunityNav';
import PlannedEvents from '@/components/community/PlannedEvents';
import { berlinNow, communityState, whenLabel } from '@/lib/community';
import { communityUnread } from '@/lib/inbox';
import { meetupCategory, myMeetups } from '@/lib/meetups';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'My plans', robots: { index: false, follow: false } };

/**
 * Everything someone said yes to: meetups they host or joined (from the
 * server, members only) and events they swiped right on (from this browser).
 */
export default async function PlansPage() {
  const state = await communityState();
  const member = state.kind === 'member' ? state.member : null;
  const meetups = member ? myMeetups(member) : [];
  const now = berlinNow();

  return (
    <>
      <CommunityNav active="bhetghat" unread={member ? communityUnread(member) : 0} />
      <div className="container container-narrow section">
        <p className="mu-back">
          <Link href="/bhetghat">← Bhetghat</Link>
        </p>
        <h1 className="page-title">My plans</h1>

        <section className="pl-section">
          <h2>Meetups</h2>
          {!member ? (
            <p className="muted">
              Meetups are for community members. <Link href="/community">Join free</Link> to see the ones near you.
            </p>
          ) : meetups.length === 0 ? (
            <p className="muted">
              None yet. Swipe right on a meetup in <Link href="/bhetghat">Bhetghat</Link>, or{' '}
              <Link href="/bhetghat/new">start one</Link>.
            </p>
          ) : (
            <ul className="pl-list">
              {meetups.map((m) => {
                const cat = meetupCategory(m.category);
                const done = m.startsAt < now;
                return (
                  <li key={m.id} className={`pl-item${done || m.status !== 'open' ? ' pl-done' : ''}`}>
                    <span className={`pl-thumb pl-emoji bg-cat-${cat.key}`} aria-hidden="true">
                      {cat.emoji}
                    </span>
                    <span className="pl-main">
                      <Link href={`/bhetghat/m/${m.id}`} className="pl-title">
                        {m.title}
                      </Link>
                      <span className="muted small">
                        {whenLabel(m.startsAt)} · {m.place}, {m.city}
                        {m.status === 'cancelled' ? ' · cancelled' : done ? ' · happened' : m.requested ? ' · waiting for a yes' : ''}
                        {m.isHost ? ' · you host' : ''}
                      </span>
                    </span>
                    <span className="pl-side">
                      {m.unread > 0 && <span className="cm-badge">{m.unread}</span>}
                      <Link href={`/bhetghat/m/${m.id}`} className="btn btn-sm">
                        Chat
                      </Link>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="pl-section">
          <h2>Events</h2>
          <PlannedEvents today={now.slice(0, 10)} />
        </section>
      </div>
    </>
  );
}
