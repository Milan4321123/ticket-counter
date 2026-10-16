import Link from 'next/link';
import CommunityNav from '@/components/community/CommunityNav';
import Gate from '@/components/community/Gate';
import { communityState } from '@/lib/community';
import { agoLabel, dayLabel, HELP_CATEGORIES, helpCategory, helpPostCities, listHelpPosts, openHelpPostCount } from '@/lib/helpBoard';
import { communityUnread } from '@/lib/inbox';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Sahayog — the Nepali help board',
  description:
    'Rooms, rides, luggage space to Nepal, help with papers and jobs — Nepalis in Germany helping each other. Members only, free.',
  alternates: { canonical: '/sahayog' },
};

type Search = { k?: string; c?: string; city?: string };

function href(current: Search, change: Partial<Search>): string {
  const next = { ...current, ...change };
  const q = new URLSearchParams();
  if (next.k) q.set('k', next.k);
  if (next.c) q.set('c', next.c);
  if (next.city) q.set('city', next.city);
  const s = q.toString();
  return s ? `/sahayog?${s}` : '/sahayog';
}

export default async function SahayogPage({ searchParams }: { searchParams: Promise<Search> }) {
  const search = await searchParams;
  const state = await communityState();
  if (state.kind !== 'member') {
    const n = openHelpPostCount();
    return (
      <Gate
        state={state}
        back="/sahayog"
        kicker="सहयोग · Sahayog"
        title="Nepalis in Germany, helping each other"
        intro={
          <>
            <p>
              A room in Frankfurt, a ride to the Dashain night, 5 kg free on a flight to Kathmandu, someone who has done the
              Anmeldung before — ask, or offer a hand.
            </p>
            {n > 0 && (
              <p>
                <strong>
                  {n} {n === 1 ? 'post is' : 'posts are'} up right now.
                </strong>
              </p>
            )}
          </>
        }
      />
    );
  }
  const { member } = state;
  const kind = search.k === 'ask' || search.k === 'offer' ? search.k : '';
  const cat = HELP_CATEGORIES.some((c) => c.key === search.c) ? (search.c as string) : '';
  const posts = listHelpPosts(member, { kind, category: cat, city: search.city });
  const cities = helpPostCities();

  return (
    <>
      <CommunityNav active="sahayog" unread={communityUnread(member)} />
      <section className="container hb-head">
        <p className="feed-kicker">
          <span lang="ne">सहयोग</span> · Sahayog
        </p>
        <h1 className="page-title">Help each other</h1>
        <p className="muted">Rooms, rides, luggage to Nepal, papers, jobs — ask for a hand, or offer one. Answers are private.</p>
        <div className="cm-row hb-cta">
          <Link href="/sahayog/new?kind=ask" className="btn btn-brand">
            🙋 I need help
          </Link>
          <Link href="/sahayog/new?kind=offer" className="btn">
            🤝 I can help
          </Link>
        </div>
      </section>

      <section className="container hb-section">
        <div className="chip-row hb-filters" role="group" aria-label="Asks or offers">
          {[
            ['', 'Everything'],
            ['ask', '🙋 People asking'],
            ['offer', '🤝 People offering'],
          ].map(([k, label]) => (
            <Link key={k} href={href(search, { k: k || undefined })} className={`chip${kind === k ? ' chip-active' : ''}`} aria-current={kind === k ? 'true' : undefined}>
              {label}
            </Link>
          ))}
        </div>
        <div className="chip-row hb-filters hb-scroll" role="group" aria-label="Category">
          <Link href={href(search, { c: undefined })} className={`chip${!cat ? ' chip-active' : ''}`}>
            All kinds
          </Link>
          {HELP_CATEGORIES.map((c) => (
            <Link key={c.key} href={href(search, { c: c.key })} className={`chip${cat === c.key ? ' chip-active' : ''}`}>
              {c.emoji} {c.label}
            </Link>
          ))}
        </div>
        {cities.length > 1 && (
          <div className="chip-row hb-filters hb-scroll" role="group" aria-label="Town">
            <Link href={href(search, { city: undefined })} className={`chip${!search.city ? ' chip-active' : ''}`}>
              Everywhere
            </Link>
            {cities.slice(0, 10).map((c) => (
              <Link key={c.key} href={href(search, { city: c.key })} className={`chip${search.city === c.key ? ' chip-active' : ''}`}>
                {c.name} <span className="chip-count">{c.n}</span>
              </Link>
            ))}
          </div>
        )}

        {posts.length === 0 ? (
          <div className="hb-empty">
            <p className="bg-empty-icon" aria-hidden="true">
              🤝
            </p>
            <p>Nothing here yet{kind || cat || search.city ? ' with these filters' : ''}. Be the first — someone near you is looking for exactly that.</p>
            <Link href="/sahayog/new?kind=ask" className="btn btn-brand">
              Put up a post
            </Link>
          </div>
        ) : (
          <ul className="hb-list">
            {posts.map((p) => {
              const c = helpCategory(p.category);
              return (
                <li key={p.id}>
                  <Link href={`/sahayog/p/${p.id}`} className="hb-post">
                    <span className="hb-emoji" aria-hidden="true">
                      {c.emoji}
                    </span>
                    <span className="hb-main">
                      <span className="hb-tags">
                        <span className={`hb-kind hb-kind-${p.kind}`}>{p.kind === 'ask' ? 'Asking' : 'Offering'}</span>
                        <span className="muted small">{c.label}</span>
                      </span>
                      <strong className="hb-title">{p.title}</strong>
                      <span className="muted small">
                        📍 {p.city}
                        {p.whenDate ? ` · 📅 ${dayLabel(p.whenDate)}` : ''} · {agoLabel(p.createdAt)} · <span translate="no">{p.authorName}</span>
                        {p.mine ? ' (you)' : ''}
                      </span>
                      {p.body && <span className="hb-excerpt">{p.body}</span>}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
