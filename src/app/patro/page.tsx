import { shareImages } from '@/lib/seo';
import Np from '@/components/Np';
import Link from 'next/link';
import { FESTIVALS, currentOccurrence } from '@/lib/festivals';
import { adToBs, formatBs, formatBsNe } from '@/lib/patro';
import PatroConverter from './PatroConverter';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Nepali patro — today’s date & BS ↔ AD converter',
  description:
    'Nepali calendar (patro) for the diaspora: today’s Bikram Sambat date, a BS to AD date ' +
    'converter both ways, and the next Nepali festival dates — Dashain, Tihar, Teej and more.',
  alternates: { canonical: '/patro' },
  openGraph: {
    type: 'website',
    title: 'Nepali patro — today’s date & BS ↔ AD converter',
    description:
      'Today’s Bikram Sambat date, a two-way BS ↔ AD converter, and the next Nepali festival dates.',
    url: '/patro', images: shareImages() },
};

/** Today's ISO date in Europe/Berlin — where this site's visitors wake up. */
function todayInBerlin(): string {
  // en-CA formats as YYYY-MM-DD, which is exactly the ISO shape we need.
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date());
}

/** '2026-10-21' -> 'Wed, 21 Oct 2026'. */
function shortDate(iso: string): string {
  return new Date(iso + 'T12:00:00Z').toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export default function PatroPage() {
  const todayIso = todayInBerlin();
  const todayBs = adToBs(todayIso);
  const weekday = new Date(todayIso + 'T12:00:00Z').toLocaleDateString('en-GB', {
    weekday: 'long',
    timeZone: 'UTC',
  });

  // The festival main days still ahead of us, soonest first — the patro's
  // second job after "what date is it" is "what's coming".
  const upcoming = FESTIVALS.map((f) => ({ festival: f, occurrence: currentOccurrence(f) }))
    .filter((r) => r.occurrence && r.occurrence.mainDay >= todayIso)
    .sort((a, b) => a.occurrence!.mainDay.localeCompare(b.occurrence!.mainDay));

  return (
    <>
      <section className="feed-hero" style={{ padding: '64px 0 36px' }}>
        <div className="container">
          <p className="feed-kicker anim-fade-up">
            <Np>नेपाली पात्रो</Np> · Nepali calendar
          </p>
          <h1 className="anim-fade-up anim-d1" style={{ fontSize: 'clamp(1.9rem, 4.4vw, 3rem)' }}>
            {todayBs ? <Np>{formatBsNe(todayBs)}</Np> : 'Nepali patro'}
          </h1>
          <p className="feed-hero-sub anim-fade-up anim-d2" style={{ marginBottom: 0 }}>
            {todayBs ? (
              <>
                Today is <strong>{weekday}, {formatBs(todayBs)} BS</strong> — {shortDate(todayIso)}{' '}
                in the Gregorian calendar, by the clock in Germany.
              </>
            ) : (
              <>Today&rsquo;s Nepali date, and a converter between the two calendars.</>
            )}
          </p>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 20 }}>
        <div className="container container-narrow">
          <PatroConverter todayIso={todayIso} />

          <div className="card anim-fade-up anim-d2" style={{ marginTop: 18 }}>
            <h2 className="card-title">Coming festivals</h2>
            {upcoming.length > 0 ? (
              <div>
                {upcoming.map(({ festival, occurrence }) => (
                  <div className="summary-row" key={festival.slug}>
                    <span>
                      <Link href={`/${festival.slug}`}>
                        {festival.name}{' '}
                        <span className="muted">
                          <Np>{festival.nameNe}</Np>
                        </span>
                      </Link>
                    </span>
                    <span className="muted" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {shortDate(occurrence!.mainDay)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted" style={{ margin: 0 }}>
                Next year&rsquo;s dates are on their way — see the{' '}
                <Link href="/festivals">festival calendar</Link>.
              </p>
            )}
            <p className="muted small" style={{ margin: '10px 0 0' }}>
              The full list, with every festival&rsquo;s days, lives on the{' '}
              <Link href="/festivals">festival calendar</Link>.
            </p>
          </div>

          <p className="muted small anim-fade-up anim-d3" style={{ marginTop: 14 }}>
            Bikram Sambat months are set by observation, not formula, and Nepal&rsquo;s calendar
            committee publishes each year about a year ahead — so far-future dates here are careful
            projections until the official patro for that year is out.
          </p>
        </div>
      </section>
    </>
  );
}
