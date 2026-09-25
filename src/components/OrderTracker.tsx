// Where a shop order is right now, for the buyer: ordered → paid → being
// prepared → ready → collected, with the time each happened, how long ago the
// last step was, and where to collect it. Rendered on the server from the
// order's own timestamps (lib/kitchen keeps one per stage); AutoRefresh moves
// it along while the page is open.
import AutoRefresh from './AutoRefresh';

export interface TrackerStep {
  label: string;
  /** UTC 'YYYY-MM-DD HH:MM:SS' when it happened, or null when not yet. */
  at: string | null;
  /** Reached (a step can be reached without a recorded time). */
  done: boolean;
}

const ms = (s: string) => Date.parse(`${s.replace(' ', 'T')}Z`);
const berlin = (s: string) =>
  new Date(ms(s)).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' });

function ago(s: string): string {
  const m = Math.max(0, Math.round((Date.now() - ms(s)) / 60_000));
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h} h ${m % 60} min ago` : `${Math.floor(h / 24)} d ago`;
}

export default function OrderTracker({
  steps,
  place,
  mapsHref,
  headline,
}: {
  steps: TrackerStep[];
  /** "Didi's Momo Kitchen, Rheinstraße 5, Darmstadt" — '' when unknown. */
  place: string;
  mapsHref: string | null;
  headline: string;
}) {
  const current = steps.reduce((i, s, k) => (s.done ? k : i), 0);
  const last = steps[current];
  const finished = current === steps.length - 1;
  return (
    <section className="otr anim-fade-up" aria-label="Your order status">
      <AutoRefresh until={finished} />
      <p className="otr-head">
        <span className={`otr-dot${finished ? ' is-done' : ''}`} aria-hidden="true" />
        <strong>{headline}</strong>
        {last?.at && <span className="otr-ago"> · {ago(last.at)}</span>}
      </p>
      <ol className="otr-steps">
        {steps.map((s, i) => (
          <li key={s.label} className={i < current || finished ? 'is-done' : i === current ? 'is-now' : ''}>
            <span className="otr-mark" aria-hidden="true">
              {i < current || (finished && i === current) ? '✓' : i + 1}
            </span>
            <span className="otr-label">{s.label}</span>
            <span className="otr-at">{s.at && s.done ? berlin(s.at) : ''}</span>
          </li>
        ))}
      </ol>
      {place && (
        <p className="otr-place">
          📍 <span>{place}</span>
          {mapsHref && (
            <a href={mapsHref} target="_blank" rel="noopener" className="otr-map">
              Open in Maps →
            </a>
          )}
        </p>
      )}
    </section>
  );
}
