import Link from 'next/link';
import CommunityNav from '@/components/community/CommunityNav';
import Gate from '@/components/community/Gate';
import { communityState, whenLabel } from '@/lib/community';
import { listConversations } from '@/lib/conversations';
import { agoLabel } from '@/lib/helpBoard';
import { communityUnread } from '@/lib/inbox';
import { meetupCategory, myMeetups, pendingRequestsFor } from '@/lib/meetups';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Inbox', robots: { index: false, follow: false } };

/**
 * Everything people wrote to a member: private conversations about their help
 * posts and profile (or ones they started), and the group chats of meetups
 * they are going to.
 */
export default async function InboxPage() {
  const state = await communityState();
  if (state.kind !== 'member') {
    return (
      <Gate
        state={state}
        back="/inbox"
        kicker="सन्देश · Inbox"
        title="Your messages"
        intro={<p>Messages about your help posts, your profile and your meetups land here.</p>}
      />
    );
  }
  const { member } = state;
  const conversations = listConversations(member);
  const chats = myMeetups(member).filter((m) => m.status !== 'removed' && m.joined);
  const requests = pendingRequestsFor(member);

  return (
    <>
      <CommunityNav active="inbox" unread={communityUnread(member)} />
      <div className="container container-narrow section">
        <h1 className="page-title">Inbox</h1>

        {requests.length > 0 && (
          <section className="pl-section">
            <h2>Asking to join your meetups</h2>
            <ul className="pl-list">
              {requests.map((r, i) => (
                <li key={`${r.meetupId}-${i}`}>
                  <Link href={`/bhetghat/m/${r.meetupId}`} className="pl-item ib-row ib-unread">
                    <span className="mu-avatar" aria-hidden="true">
                      {r.name.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="pl-main">
                      <span className="pl-title">
                        <span translate="no">{r.name}</span> wants to come
                      </span>
                      <span className="muted small">{r.title} — say yes or no</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="pl-section">
          <h2>Private messages</h2>
          {conversations.length === 0 ? (
            <p className="muted">
              None yet. Answer a post on <Link href="/sahayog">Sahayog</Link>, or put one up — replies come here.
            </p>
          ) : (
            <ul className="pl-list">
              {conversations.map((c) => (
                <li key={c.id}>
                  <Link href={`/inbox/${c.id}`} className={`pl-item ib-row${c.unread ? ' ib-unread' : ''}`}>
                    <span className="mu-avatar" aria-hidden="true">
                      {c.otherName.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="pl-main">
                      <span className="pl-title">
                        <span translate="no">{c.otherName}</span> · <span className="muted">{c.topicType === 'help' ? '🤝' : '🎤'} {c.topicTitle}</span>
                      </span>
                      <span className="muted small ib-last">{c.lastBody || 'No messages yet'}</span>
                    </span>
                    <span className="pl-side">
                      <span className="muted small">{agoLabel(c.lastAt)}</span>
                      {c.unread > 0 && <span className="cm-badge">{c.unread}</span>}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="pl-section">
          <h2>Meetup chats</h2>
          {chats.length === 0 ? (
            <p className="muted">
              Join a meetup in <Link href="/bhetghat">Bhetghat</Link> and its group chat shows up here.
            </p>
          ) : (
            <ul className="pl-list">
              {chats.map((m) => {
                const cat = meetupCategory(m.category);
                return (
                  <li key={m.id}>
                    <Link href={`/bhetghat/m/${m.id}`} className={`pl-item ib-row${m.unread ? ' ib-unread' : ''}`}>
                      <span className={`pl-thumb pl-emoji bg-cat-${cat.key}`} aria-hidden="true">
                        {cat.emoji}
                      </span>
                      <span className="pl-main">
                        <span className="pl-title">{m.title}</span>
                        <span className="muted small">
                          {whenLabel(m.startsAt)} · {m.city}
                          {m.status === 'cancelled' ? ' · cancelled' : ''}
                        </span>
                      </span>
                      <span className="pl-side">{m.unread > 0 && <span className="cm-badge">{m.unread}</span>}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
