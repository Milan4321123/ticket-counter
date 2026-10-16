import Link from 'next/link';
import { cityHubs } from '@/lib/cityPages';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Nepali communities in Germany — by town',
  description: 'Find Nepali events, shops, food and artists in your town — Berlin, Munich, Frankfurt, Hamburg, Cologne and more.',
  alternates: { canonical: '/nepali-in' },
};

export default function CitiesPage() {
  const hubs = cityHubs();
  return (
    <div className="container container-narrow section">
      <p className="feed-kicker">
        <span lang="ne">हाम्रो सहर</span> · Our towns
      </p>
      <h1 className="page-title">Nepalis in Germany, town by town</h1>
      <p className="muted">Events, shops and artists wherever the community is.</p>
      {hubs.length === 0 ? (
        <p className="muted">Nothing listed yet.</p>
      ) : (
        <ul className="pl-list" style={{ marginTop: 18 }}>
          {hubs.map((h) => (
            <li key={h.slug}>
              <Link href={`/nepali-in/${h.slug}`} className="pl-item ib-row">
                <span className="pl-thumb pl-emoji" aria-hidden="true">
                  📍
                </span>
                <span className="pl-main">
                  <span className="pl-title">{h.name}</span>
                  <span className="muted small">
                    {h.events.length} events · {h.shops.length} shops · {h.talent.length} artists
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
