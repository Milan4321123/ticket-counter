import Link from 'next/link';
import CommunityNav from '@/components/community/CommunityNav';
import Gate from '@/components/community/Gate';
import { cityKey, cityName } from '@/lib/cities';
import { communityState } from '@/lib/community';
import { dayLabel } from '@/lib/helpBoard';
import { communityUnread } from '@/lib/inbox';
import { listUpcomingMeetups, MEETUP_CATEGORIES, meetupCategory } from '@/lib/meetups';

export const dynamic = 'force-dynamic';
export const metadata = { title: "What's on — invitations near you", robots: { index: false, follow: false } };

type Search = { c?: string; city?: string };

function href(current: Search, change: Partial<Search>): string {
  const next = { ...current, ...change };
  const q = new URLSearchParams();
  if (next.c) q.set('c', next.c);
  if (next.city) q.set('city', next.city);
  const s = q.toString();
  return s ? `/bhetghat/whats-on?${s}` : '/bhetghat/whats-on';
}

/**
 * Every listed invitation as a plain list, day by day — the same meetups as
 * the swipe deck (open and ask-to-join; never private ones), for people who
 * would rather scan than swipe, or want to see the whole weekend at once.
 */
export default async function WhatsOnPage({ searchParams }: { searchParams: Promise<Search> }) {
  const search = await searchParams;
  const state = await communityState();
  if (state.kind !== 'member') {
    return (
      <Gate
        state={state}
        back="/bhetghat/whats-on"
        kicker="भेटघाट · What's on"
        title="Karaoke, laser tag, futsal, momo nights…"
        intro={<p>Invitations from Nepalis near you. Join the community free to see them — and to start your own.</p>}
      />
    );
  }
  const { member } = state;
  const all = listUpcomingMeetups(member);
  const towns = new Map<string, { name: string; n: number }>();
  for (const m of all) {
    const k = cityKey(m.city);
    const t = towns.get(k) ?? { name: cityName(m.city), n: 0 };
    t.n += 1;
    towns.set(k, t);
  }
  const shown = all.filter((m) => (!search.c || m.category === search.c) && (!search.city || cityKey(m.city) === search.city));
  const days = new Map<string, typeof shown>();
  for (const m of shown) {
    const d = m.startsAt.slice(0, 10);
    days.set(d, [...(days.get(d) ?? []), m]);
  }

  return (
    <>
      <CommunityNav active="bhetghat" unread={communityUnread(member)} />
      <section className="container hb-head">
        <p className="feed-kicker">
          <span lang="ne">भेटघाट</span> · What&rsquo;s on
        </p>
        <h1 className="page-title">Invitations near you</h1>
        <p className="muted">Karaoke, laser tag, futsal, momo nights — tap one to see who is coming and join.</p>
        <div className="cm-row hb-cta">
          <Link href="/bhetghat/new" className="btn btn-brand">
            + Invite people
          </Link>
          <Link href="/bhetghat" className="btn">
            Swipe instead
          </Link>
        </div>
      </section>
      <section className="container hb-section">
        {towns.size > 1 && (
          <div className="chip-row hb-filters hb-scroll" role="group" aria-label="Town">
            <Link href={href(search, { city: undefined })} className={`chip${!search.city ? ' chip-active' : ''}`}>
              Everywhere
            </Link>
            {[...towns.entries()]
              .sort((a, b) => b[1].n - a[1].n)
              .map(([k, t]) => (
                <Link key={k} href={href(search, { city: k })} className={`chip${search.city === k ? ' chip-active' : ''}`}>
                  {t.name} <span className="chip-count">{t.n}</span>
                </Link>
              ))}
          </div>
        )}
        <div className="chip-row hb-filters hb-scroll" role="group" aria-label="Kind">
          <Link href={href(search, { c: undefined })} className={`chip${!search.c ? ' chip-active' : ''}`}>
            Everything
          </Link>
          {MEETUP_CATEGORIES.map((c) => (
            <Link key={c.key} href={href(search, { c: c.key })} className={`chip${search.c === c.key ? ' chip-active' : ''}`}>
              {c.emoji} {c.label}
            </Link>
          ))}
        </div>

        {shown.length === 0 ? (
          <div className="hb-empty">
            <p className="bg-empty-icon" aria-hidden="true">
              🎤
            </p>
            <p>Nothing here yet. Start the first one — karaoke, laser tag, a game of futsal — and people near you will see it.</p>
            <Link href="/bhetghat/new" className="btn btn-brand">
              Invite people
            </Link>
          </div>
        ) : (
          [...days.entries()].map(([day, list]) => (
            <div key={day} className="wo-day">
              <h2 className="wo-date">{dayLabel(day)}</h2>
              <ul className="hb-list">
                {list.map((m) => {
                  const cat = meetupCategory(m.category);
                  return (
                    <li key={m.id}>
                      <Link href={`/bhetghat/m/${m.id}`} className="hb-post">
                        <span className={`hb-emoji bg-cat-${cat.key}`} aria-hidden="true">
                          {cat.emoji}
                        </span>
                        <span className="hb-main">
                          <span className="hb-tags">
                            <span className={`hb-kind ${m.joinMode === 'ask' ? 'hb-kind-ask' : 'hb-kind-offer'}`}>
                              {m.joined || m.isHost ? "You're in" : m.requested ? 'Asked' : m.joinMode === 'ask' ? 'Ask to join' : 'Open'}
                            </span>
                            <span className="muted small">{m.startsAt.slice(11, 16)}</span>
                          </span>
                          <strong className="hb-title">{m.title}</strong>
                          <span className="muted small">
                            📍 {m.place}, {m.city} · 👥 {m.going}
                            {m.minPeople > m.going ? ` (${m.minPeople - m.going} more needed)` : ''}
                            {m.costNote ? ` · 💶 ${m.costNote}` : ''}
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </section>
    </>
  );
}
