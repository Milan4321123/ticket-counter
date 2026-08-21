import { shareImages } from '@/lib/seo';
import Np from '@/components/Np';
import Link from 'next/link';
import { FESTIVALS, currentOccurrence } from '@/lib/festivals';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Nepali festival calendar — dates for Germany',
  description:
    'When is Dashain, Tihar, Teej, Chhath, Holi, the Lhosars and more? Every Nepali festival ' +
    'with its next date, on one page — the Nepali festival calendar for Germany.',
  alternates: { canonical: '/festivals' },
  openGraph: {
    type: 'website',
    title: 'Nepali festival calendar — dates for Germany',
    description:
      'Every Nepali festival with its next date, on one page — Dashain, Tihar, Teej, Chhath, ' +
      'Holi, the Lhosars and more.',
    url: '/festivals', images: shareImages() },
};

// One line per festival for the index card — the 'about' texts on the festival
// pages run two or three sentences, and a calendar row has room for one.
// Hand-kept beside the table it summarises, same philosophy as the dates.
const ONE_LINERS: Record<string, string> = {
  dashain: 'The biggest festival of the year — fifteen days of family, blessings and Tika.',
  tihar: 'The festival of lights, ending with Bhai Tika, the year’s warmest family day.',
  teej: 'Nepali women’s festival of songs, dance and fasting, dressed in red.',
  chhath: 'Four days of gratitude to the sun, offered standing at the water’s edge.',
  'nepali-new-year': 'Baisakh 1 — the first day of the Bikram Sambat year, mid-April.',
  holi: 'The spring festival of colours — abir, water and music, two days across Nepal.',
  'sonam-lhosar': 'The Tamang New Year, with damphu drums and sel roti.',
  'tamu-lhosar': 'The Gurung New Year on Poush 15, just before the western one.',
  'gyalpo-lhosar': 'The Sherpa New Year of the high Himalaya — Tashi Delek!',
  'saraswati-puja': 'Shree Panchami — spring’s first day, when books and pens are blessed.',
  'buddha-jayanti': 'The full moon of Buddha’s birth in Lumbini, lit by butter lamps.',
};

/** '2026-10-21' -> 'Wed, 21 Oct 2026' — a calendar row needs the year. */
function shortDate(iso: string): string {
  return new Date(iso + 'T12:00:00Z').toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export default function FestivalsPage() {
  // Soonest main day first — the visitor's question is "what's coming up?".
  // A festival with no occurrence on file yet still gets its row (the page it
  // links to explains), sorted to the end.
  const rows = FESTIVALS.map((f) => ({ festival: f, occurrence: currentOccurrence(f) })).sort(
    (a, b) => {
      if (!a.occurrence) return 1;
      if (!b.occurrence) return -1;
      return a.occurrence.mainDay.localeCompare(b.occurrence.mainDay);
    }
  );

  return (
    <>
      <section className="feed-hero" style={{ padding: '64px 0 36px' }}>
        <div className="container">
          <p className="feed-kicker anim-fade-up">
            <Np>चाडपर्वको पात्रो</Np> · festival calendar
          </p>
          <h1 className="anim-fade-up anim-d1" style={{ fontSize: 'clamp(1.9rem, 4.4vw, 3rem)' }}>
            The Nepali festival calendar
          </h1>
          <p className="feed-hero-sub anim-fade-up anim-d2" style={{ marginBottom: 0 }}>
            Every festival the community asks about, with its next date — bookmark it, share it
            in your group, and open any festival for the full days and the events around it.
          </p>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 20 }}>
        <div className="container container-narrow">
          <div className="card anim-fade-up">
            {rows.map(({ festival, occurrence }) => (
              <div className="summary-row" key={festival.slug}>
                <span>
                  <Link href={`/${festival.slug}`} style={{ fontWeight: 600 }}>
                    {festival.name}{' '}
                    <span className="muted">
                      <Np>{festival.nameNe}</Np>
                    </span>
                  </Link>
                  <br />
                  <span className="muted small">{ONE_LINERS[festival.slug] ?? ''}</span>
                </span>
                <span className="muted small" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {occurrence ? (
                    <>
                      {shortDate(occurrence.mainDay)}
                      <br />
                      {occurrence.mainDayName}
                    </>
                  ) : (
                    'dates coming soon'
                  )}
                </span>
              </div>
            ))}
          </div>
          <p className="muted small anim-fade-up anim-d1" style={{ marginTop: 14 }}>
            Dates follow the Nepali panchang and were checked against multiple sources; where
            traditions differ by a day, each festival&rsquo;s own page says so. Looking for
            today&rsquo;s Nepali date? See the <Link href="/patro">Nepali patro</Link>.
          </p>
        </div>
      </section>
    </>
  );
}
