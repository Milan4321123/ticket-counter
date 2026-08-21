import Np from '@/components/Np';
import Link from 'next/link';
import EventCard from '@/components/EventCard';
import { listPublishedEvents } from '@/lib/events';
import { loadFeedSnapshot } from '@/lib/feedSnapshot';
import { currentOccurrence, festivalMatch, type Festival } from '@/lib/festivals';

// The evergreen festival page: /dashain, /tihar. One URL per festival,
// forever — the YEAR is content, not address, so the link people paste into
// their WhatsApp group this year is the same one that works next year, and
// whatever search standing the page earns compounds instead of resetting.
//
// It must be worth opening with ZERO events listed, because that is the state
// it launches in: the date table is the answer to a question ("Dashain kahile
// ho?") the community genuinely asks every year, and the events below are the
// bonus, not the point.

/** '2026-10-21' -> 'Wednesday, October 21' — no year; the heading carries it. */
function humanDate(iso: string): string {
  return new Date(iso + 'T12:00:00Z').toLocaleDateString('en-GB', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export default function FestivalPage({ festival }: { festival: Festival }) {
  const occurrence = currentOccurrence(festival);
  // Events only, never shops (a momo shop is not "a Dashain event" however apt
  // its dates), and never events already over — a festival page is a "what's
  // on" surface, and a card for last weekend answers the wrong question.
  const today = new Date().toISOString().slice(0, 10);
  const candidates = occurrence
    ? listPublishedEvents().filter(
        (e) => e.kind !== 'shop' && (!e.eventDate || e.eventDate.slice(0, 10) >= today)
      )
    : [];
  // Two grades, two headings — see festivalMatch for why they must not blur.
  const named = occurrence
    ? candidates.filter((e) => festivalMatch(festival, occurrence, e) === 'named')
    : [];
  const nearby = occurrence
    ? candidates.filter((e) => festivalMatch(festival, occurrence, e) === 'nearby')
    : [];
  // One read for both grids — see lib/feedSnapshot.
  const snapshot = loadFeedSnapshot([...named, ...nearby]);

  return (
    <>
      <section className="feed-hero" style={{ padding: '64px 0 36px' }}>
        <div className="container">
          <p className="feed-kicker anim-fade-up">
            <Np>{festival.nameNe}</Np> ·{' '}
            {occurrence ? `${festival.name} ${occurrence.year}` : festival.name}
          </p>
          <h1 className="anim-fade-up anim-d1" style={{ fontSize: 'clamp(1.9rem, 4.4vw, 3rem)' }}>
            {occurrence
              ? `${festival.name} ${occurrence.year} in Germany`
              : `${festival.name} in Germany`}
          </h1>
          <p className="feed-hero-sub anim-fade-up anim-d2" style={{ marginBottom: 0 }}>
            {occurrence ? (
              <>
                <strong>
                  {occurrence.mainDayName} is {humanDate(occurrence.mainDay)}, {occurrence.year}
                </strong>{' '}
                ({occurrence.bsYear} BS). <Np>{festival.greetingNe}</Np>
              </>
            ) : (
              <>
                  Dates for the coming year are on their way. <Np>{festival.greetingNe}</Np>
                </>
            )}
          </p>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 20 }}>
        <div className="container container-narrow">
          {/* A one-day festival's whole story is already in the hero line, so a
              "The days" table with a single row would be scaffolding around
              nothing — skip it, keeping only the dateNote when there is one. */}
          {occurrence && (occurrence.days.length > 1 || occurrence.dateNote) && (
            <div className="card anim-fade-up">
              {occurrence.days.length > 1 && (
                <>
                  <h2 className="card-title">The days</h2>
                  <div>
                    {occurrence.days.map((d) => (
                      <div className="summary-row" key={d.date}>
                        <span className="muted" style={{ whiteSpace: 'nowrap' }}>
                          {humanDate(d.date)}
                        </span>
                        <span style={{ textAlign: 'right' }}>{d.name}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {occurrence.dateNote && (
                <p
                  className="muted small"
                  style={{ margin: occurrence.days.length > 1 ? '10px 0 0' : 0 }}
                >
                  {occurrence.dateNote}
                </p>
              )}
            </div>
          )}

          <div className="card anim-fade-up anim-d1">
            <h2 className="card-title">
              What is {festival.name}? <span className="muted">
                  <Np>{festival.nameNe} के हो?</Np>
                </span>
            </h2>
            <p style={{ marginBottom: 0 }}>{festival.about}</p>
          </div>
        </div>

        <div className="container" style={{ marginTop: 28 }}>
          <h2 className="feed-section-title anim-fade-up" style={{ textAlign: 'center' }}>
            {named.length > 0
              ? `${festival.name} events on now`
              : `Celebrating ${festival.name} here?`}
          </h2>
          {named.length > 0 ? (
            <div className="feed-grid" style={{ marginTop: 18 }}>
              {named.map((e) => (
                <EventCard key={e.id} event={e} snapshot={snapshot} />
              ))}
            </div>
          ) : (
            <p className="muted anim-fade-up" style={{ textAlign: 'center', maxWidth: 520, margin: '10px auto 0' }}>
              No {festival.name} events are listed yet. Putting one on — a cultural night, a
              community dinner, a deusi round? List it here free and this page sends people to it.
            </p>
          )}
          {nearby.length > 0 && (
            <>
              <h2
                className="feed-section-title anim-fade-up"
                style={{ textAlign: 'center', marginTop: 32 }}
              >
                Also on around {festival.name}
              </h2>
              <div className="feed-grid" style={{ marginTop: 18 }}>
                {nearby.map((e) => (
                  <EventCard key={e.id} event={e} snapshot={snapshot} />
                ))}
              </div>
            </>
          )}
          <p className="anim-fade-up" style={{ textAlign: 'center', marginTop: 22 }}>
            <Link href="/organizers" className="btn btn-brand">
              List your {festival.name} event — free
            </Link>{' '}
            <Link href="/" className="btn" style={{ marginLeft: 8 }}>
              All events →
            </Link>
          </p>
        </div>
      </section>
    </>
  );
}
