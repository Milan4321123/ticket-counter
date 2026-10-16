import Link from 'next/link';
import { notFound } from 'next/navigation';
import EventCard from '@/components/EventCard';
import { cityCommunityCounts, cityHub } from '@/lib/cityPages';
import { loadFeedSnapshot } from '@/lib/feedSnapshot';
import { cardFestivalInSeason } from '@/lib/greetingCards';
import { talentKind } from '@/lib/talent';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ city: string }> }) {
  const { city } = await params;
  const hub = cityHub(city);
  if (!hub) return { title: 'Town not found', robots: { index: false, follow: false } };
  const title = `Nepali community in ${hub.name} — events, food & artists`;
  const description = `Nepali events, shops and artists in ${hub.name}: ${hub.events.length} upcoming events, ${hub.shops.length} shops and ${hub.talent.length} artists — plus meetups and a help board for Nepalis living there.`;
  return { title, description, alternates: { canonical: `/nepali-in/${hub.slug}` }, openGraph: { title, description, url: `/nepali-in/${hub.slug}` } };
}

export default async function CityPage({ params }: { params: Promise<{ city: string }> }) {
  const { city } = await params;
  const hub = cityHub(city);
  if (!hub) notFound();
  const snapshot = loadFeedSnapshot([...hub.events, ...hub.shops]);
  const counts = cityCommunityCounts(hub.name);
  const season = cardFestivalInSeason();

  return (
    <>
      <section className="feed-hero" style={{ padding: '56px 0 26px' }}>
        <div className="container">
          <p className="feed-kicker anim-fade-up">
            <span lang="ne">नेपाली</span> · {hub.name}
          </p>
          <h1 className="anim-fade-up anim-d1" style={{ fontSize: 'clamp(1.9rem, 4.4vw, 3rem)' }}>
            Nepalis in {hub.name}
          </h1>
          <p className="feed-hero-sub anim-fade-up anim-d2" style={{ marginBottom: 0 }}>
            {hub.events.length} upcoming {hub.events.length === 1 ? 'event' : 'events'} · {hub.shops.length}{' '}
            {hub.shops.length === 1 ? 'shop' : 'shops'} · {hub.talent.length} {hub.talent.length === 1 ? 'artist' : 'artists'}
            {counts.meetups ? ` · ${counts.meetups} member ${counts.meetups === 1 ? 'meetup' : 'meetups'}` : ''}
          </p>
        </div>
      </section>

      {hub.events.length > 0 && (
        <section className="section">
          <div className="container">
            <h2 className="feed-section-title">What&rsquo;s on in {hub.name}</h2>
            <div className="feed-grid" style={{ marginTop: 18 }}>
              {hub.events.map((e) => (
                <EventCard key={e.id} event={e} snapshot={snapshot} />
              ))}
            </div>
          </div>
        </section>
      )}

      {hub.shops.length > 0 && (
        <section className="section">
          <div className="container">
            <h2 className="feed-section-title">Nepali shops & food in {hub.name}</h2>
            <div className="feed-grid" style={{ marginTop: 18 }}>
              {hub.shops.map((e) => (
                <EventCard key={e.id} event={e} snapshot={snapshot} />
              ))}
            </div>
          </div>
        </section>
      )}

      {hub.talent.length > 0 && (
        <section className="section">
          <div className="container">
            <h2 className="feed-section-title">Artists & services from {hub.name}</h2>
            <ul className="kl-grid">
              {hub.talent.map((p) => {
                const k = talentKind(p.kind);
                return (
                  <li key={p.id}>
                    <Link href={`/kalakar/${p.slug}`} className="kl-card">
                      {p.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.photoUrl} alt="" className="kl-photo" loading="lazy" />
                      ) : (
                        <span className="kl-photo kl-photo-none" aria-hidden="true">
                          {k.emoji}
                        </span>
                      )}
                      <span className="kl-card-body">
                        <strong className="kl-name">{p.name}</strong>
                        <span className="muted small">
                          {k.emoji} {k.label}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      )}

      <section className="section">
        <div className="container container-narrow">
          <div className="card">
            <h2 className="card-title">Living in {hub.name}?</h2>
            <p className="muted">
              Meet Nepalis near you, find a room or a ride, get help with papers — in the community, free.
              {counts.meetups || counts.helpPosts
                ? ` Right now: ${counts.meetups} ${counts.meetups === 1 ? 'meetup' : 'meetups'} and ${counts.helpPosts} help ${counts.helpPosts === 1 ? 'post' : 'posts'} in ${hub.name}, for members.`
                : ''}
            </p>
            <div className="cm-row">
              <Link href="/bhetghat" className="btn btn-brand">
                Meetups near you
              </Link>
              <Link href="/sahayog" className="btn">
                Help board
              </Link>
              {season && (
                <Link href={`/card?f=${season.slug}`} className="btn">
                  Make your {season.name} card
                </Link>
              )}
            </div>
          </div>
          <p className="muted small" style={{ textAlign: 'center', marginTop: 18 }}>
            <Link href="/nepali-in">Other towns →</Link>
          </p>
        </div>
      </section>
    </>
  );
}
