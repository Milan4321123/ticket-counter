'use client';

// The live event-day screen: put it on a laptop or TV by the door. Arrivals
// count up in real time, the ring fills, the last few people in scroll past,
// and today's sales tick along beside it. Polls every 5 seconds.
import { useEffect, useRef, useState } from 'react';

interface Live {
  issued: number;
  checkedIn: number;
  perFiveMin: number[];
  recent: { name: string; tier: string; at: string }[];
  byTier: { name: string; issued: number; checkedIn: number }[];
  todayOrders: number;
  todayCents: number;
  remaining: number | null;
}

const money = (cents: number, currency: string) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(cents / 100);

function ago(iso: string): string {
  const s = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  return m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`;
}

export default function LiveBoard({ eventId, name, currency, isShop }: { eventId: string; name: string; currency: string; isShop: boolean }) {
  const [data, setData] = useState<Live | null>(null);
  const [bump, setBump] = useState(false);
  const last = useRef<number | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch(`/api/portal/events/${eventId}/live`, { cache: 'no-store' });
        if (!res.ok) return;
        const d = (await res.json()) as Live;
        if (!alive) return;
        if (last.current !== null && d.checkedIn > last.current) {
          setBump(true);
          setTimeout(() => setBump(false), 900);
        }
        last.current = d.checkedIn;
        setData(d);
      } catch {
        /* keep the last numbers on screen */
      }
    };
    void load();
    const t = setInterval(load, 5000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [eventId]);

  if (!data) return <p className="muted">Loading live numbers…</p>;

  const pct = data.issued > 0 ? Math.round((data.checkedIn / data.issued) * 100) : 0;
  const r = 88;
  const circ = 2 * Math.PI * r;
  const maxBar = Math.max(1, ...data.perFiveMin);
  const lastHour = data.perFiveMin.reduce((a, b) => a + b, 0);

  return (
    <div className="live" ref={boardRef}>
      <div className="live-bar">
        <div>
          <div className="live-kicker">
            <span className="kb-live" aria-hidden="true" /> Live {isShop ? 'collection' : 'door'} screen
          </div>
          <h1 className="live-title">{name}</h1>
        </div>
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => (document.fullscreenElement ? void document.exitFullscreen() : void boardRef.current?.requestFullscreen?.())}
        >
          ⛶ Full screen
        </button>
      </div>

      <div className="live-grid">
        <section className="live-ring-card" aria-label={`${data.checkedIn} of ${data.issued} ${isShop ? 'collected' : 'checked in'}`}>
          <svg viewBox="0 0 220 220" className="live-ring">
            <circle cx="110" cy="110" r={r} className="live-ring-track" />
            <circle
              cx="110"
              cy="110"
              r={r}
              className="live-ring-fill"
              strokeDasharray={circ}
              strokeDashoffset={circ * (1 - pct / 100)}
              transform="rotate(-90 110 110)"
            />
          </svg>
          <div className="live-ring-center">
            <div className={`live-big${bump ? ' live-bump' : ''}`}>{data.checkedIn}</div>
            <div className="live-of">of {data.issued} {isShop ? 'collected' : 'in'}</div>
            <div className="live-pct">{pct}%</div>
          </div>
        </section>

        <section className="live-card">
          <h2>Last hour</h2>
          <div className="live-bars" aria-label={`${lastHour} ${isShop ? 'collections' : 'arrivals'} in the last hour`}>
            {data.perFiveMin.map((n, i) => (
              <span key={i} className="live-barcol">
                <span className="live-barfill" style={{ height: `${(n / maxBar) * 100}%` }} title={`${n}`} />
              </span>
            ))}
          </div>
          <div className="live-axis">
            <span>60 min ago</span>
            <span>now</span>
          </div>
          <p className="live-note">
            <strong>{lastHour}</strong> {isShop ? 'collected' : 'arrived'} in the last hour
          </p>
        </section>

        <section className="live-card">
          <h2>Just {isShop ? 'collected' : 'arrived'}</h2>
          {data.recent.length === 0 ? (
            <p className="live-note">Nobody scanned yet — the first scan appears here.</p>
          ) : (
            <ul className="live-feed">
              {data.recent.map((r, i) => (
                <li key={`${r.at}-${i}`}>
                  <span className="live-feed-name" translate="no">{r.name}</span>
                  <span className="live-feed-tier">{r.tier}</span>
                  <span className="live-feed-at">{ago(r.at)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="live-card">
          <h2>By type</h2>
          <ul className="live-types">
            {data.byTier.map((t) => (
              <li key={t.name}>
                <span>{t.name}</span>
                <span className="live-type-meter">
                  <span style={{ width: `${t.issued ? (t.checkedIn / t.issued) * 100 : 0}%` }} />
                </span>
                <span className="live-type-num">
                  {t.checkedIn}/{t.issued}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="live-card live-sales">
          <h2>Today</h2>
          <div className="live-sales-row">
            <div>
              <strong>{data.todayOrders}</strong>
              <span>orders paid</span>
            </div>
            <div>
              <strong>{money(data.todayCents, currency)}</strong>
              <span>received</span>
            </div>
            {data.remaining !== null && (
              <div>
                <strong>{data.remaining}</strong>
                <span>still for sale</span>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
