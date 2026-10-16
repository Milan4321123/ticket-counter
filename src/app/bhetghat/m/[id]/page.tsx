import Link from 'next/link';
import { notFound } from 'next/navigation';
import ChatThread from '@/components/community/ChatThread';
import CommunityNav from '@/components/community/CommunityNav';
import Gate from '@/components/community/Gate';
import MeetupActions, { InviteLink, RemovePerson, RequestControls } from '@/components/community/MeetupActions';
import ReportButton from '@/components/community/ReportButton';
import { communityState, whenLabel } from '@/lib/community';
import { getBaseUrl } from '@/lib/config';
import { communityUnread } from '@/lib/inbox';
import { getMeetupForMember, listMeetupMessages, meetupCategory } from '@/lib/meetups';

export const dynamic = 'force-dynamic';

// Members only, and so are link previews: a meetup link forwarded to a
// WhatsApp group shows this generic card, never the meetup's title or place.
export const metadata = {
  title: 'An invitation on Bhetghat',
  description: 'Someone in the Nepali community invited you. Join free to see what, where and who is coming.',
  robots: { index: false, follow: false },
};

const MODE_LABEL = { open: '🌍 Open to members', ask: '✋ Ask to join', private: '🔒 Private — invite only' } as const;

export default async function MeetupPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ code?: string }> }) {
  const { id } = await params;
  const { code } = await searchParams;
  const here = `/bhetghat/m/${id}${code ? `?code=${encodeURIComponent(code)}` : ''}`;
  const state = await communityState();
  if (state.kind !== 'member') {
    return (
      <Gate
        state={state}
        back={here}
        kicker="भेटघाट · Bhetghat"
        title="You are invited"
        intro={<p>Invitations are for community members only. Join free in a minute to see what, where and who is coming.</p>}
      />
    );
  }
  const { member } = state;
  const m = getMeetupForMember(member, id, code);
  if (!m) notFound();
  const cat = meetupCategory(m.category);
  const canChat = m.joined || m.isHost;
  const messages = canChat ? (listMeetupMessages(member, id, 0) ?? []) : [];
  const full = m.capacity > 0 && m.going >= m.capacity;
  const open = m.status === 'open' && !m.past;
  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${m.place}, ${m.city}`)}`;
  const needed = m.minPeople > 0 ? Math.max(0, m.minPeople - m.going) : 0;
  const inviteUrl = m.inviteCode ? `${getBaseUrl().replace(/\/$/, '')}/bhetghat/m/${m.id}?code=${m.inviteCode}` : null;

  return (
    <>
      <CommunityNav active="bhetghat" unread={communityUnread(member)} />
      <div className="container section mu">
        <p className="mu-back">
          <Link href="/bhetghat">← Bhetghat</Link> · <Link href="/bhetghat/plans">My plans</Link>
        </p>
        <header className={`mu-head bg-cat-${cat.key}`}>
          <p className="mu-emoji" aria-hidden="true">
            {cat.emoji}
          </p>
          <div>
            <p className="feed-kicker">
              {cat.label} · {m.city}
            </p>
            <h1 className="page-title">{m.title}</h1>
            <p className="mu-when">{whenLabel(m.startsAt)}</p>
            <p className="mu-where">
              📍 {m.place}, {m.city} ·{' '}
              <a href={mapsHref} target="_blank" rel="noopener noreferrer">
                Map
              </a>
            </p>
            <p className="mu-tags">
              <span>{MODE_LABEL[m.joinMode]}</span>
              {m.costNote && <span>💶 {m.costNote}</span>}
            </p>
          </div>
        </header>

        {m.status === 'cancelled' && <p className="notice notice-warn">This meetup was cancelled by the host.</p>}
        {m.status === 'removed' && <p className="notice notice-error">This meetup was taken down: {m.statusNote || 'it broke the community rules'}.</p>}
        {m.removedMe && !m.isHost && <p className="notice notice-warn">The host did not add you to this one.</p>}
        {m.past && m.status === 'open' && <p className="notice">This meetup has happened — the chat stays open for a while for thank-yous and photos.</p>}

        <div className="mu-grid">
          <div className="mu-main">
            {m.minPeople > 0 && open && (
              <section className="card mu-min">
                <p className="mu-min-line">
                  {needed > 0 ? (
                    <>
                      <strong>
                        {m.going} of {m.minPeople}
                      </strong>{' '}
                      — {needed} more {needed === 1 ? 'person' : 'people'} needed for it to happen
                    </>
                  ) : (
                    <strong>✓ It&rsquo;s happening — {m.going} going</strong>
                  )}
                </p>
                <div className="mu-bar" aria-hidden="true">
                  <span style={{ width: `${Math.min(100, (m.going / m.minPeople) * 100)}%` }} />
                </div>
              </section>
            )}
            {m.about && (
              <section className="card mu-about">
                <h2 className="card-title">About</h2>
                <p className="mu-text">{m.about}</p>
              </section>
            )}
            <section className="card">
              {!m.removedMe && (
                <MeetupActions
                  id={m.id}
                  joined={m.joined}
                  requested={m.requested}
                  isHost={m.isHost}
                  open={open}
                  full={full}
                  joinMode={m.joinMode}
                  code={code}
                />
              )}
              <p className="muted small mu-safety">
                🛡️ Meet in a public place, tell a friend where you are going, and never send money to someone you met
                here.
              </p>
            </section>

            {m.isHost && m.requests.length > 0 && (
              <section className="card">
                <h2 className="card-title">Asking to join · {m.requests.length}</h2>
                <ul className="mu-people">
                  {m.requests.map((p) => (
                    <li key={p.handle}>
                      <span className="mu-avatar" aria-hidden="true">
                        {p.name.slice(0, 1).toUpperCase()}
                      </span>
                      <span translate="no">{p.name}</span>
                      <RequestControls id={m.id} handle={p.handle} name={p.name} />
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {inviteUrl && open && (
              <section className="card">
                <h2 className="card-title">{m.joinMode === 'private' ? 'Your invite link' : 'Bring friends'}</h2>
                <InviteLink id={m.id} url={inviteUrl} title={m.title} isHost={m.isHost} isPrivate={m.joinMode === 'private'} />
              </section>
            )}

            <section className="card mu-chat">
              <h2 className="card-title">Group chat</h2>
              {canChat ? (
                <ChatThread
                  endpoint={`/api/community/meetups/${m.id}/messages`}
                  initial={messages}
                  reportType="meetup_message"
                  group
                  closed={m.status === 'cancelled' ? 'This meetup was cancelled, so its chat is closed.' : undefined}
                  empty="No messages yet — say namaste and ask anything about the plan."
                />
              ) : (
                <p className="muted">
                  {m.requested ? 'Once the host says yes, you can chat with everyone going.' : 'Join to chat with everyone going.'}
                </p>
              )}
            </section>
          </div>

          <aside className="mu-side">
            <section className="card">
              <h2 className="card-title">
                Going · {m.going}
                {m.capacity > 0 ? ` of ${m.capacity}` : ''}
              </h2>
              {m.people.length > 0 ? (
                <ul className="mu-people">
                  {m.people.map((p) => (
                    <li key={p.handle}>
                      <span className="mu-avatar" aria-hidden="true">
                        {p.name.slice(0, 1).toUpperCase()}
                      </span>
                      <span translate="no">{p.name}</span>
                      {p.isHost && <span className="ct-host">host</span>}
                      {p.isMe && <span className="muted small">(you)</span>}
                      {m.isHost && !p.isHost && <RemovePerson id={m.id} handle={p.handle} name={p.name} />}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted small">
                  Hosted by <span translate="no">{m.hostName}</span> — you see who else is coming once you are in.
                </p>
              )}
            </section>
            {!m.isHost && (
              <section className="mu-report">
                <ReportButton type="meetup" id={m.id} handle={m.hostHandle} label="Report this meetup" />
              </section>
            )}
          </aside>
        </div>
      </div>
    </>
  );
}
