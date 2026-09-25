// The shop half of Insights (lib/shopInsights): what sells, on which days, at
// what hours, and what goes in the same bag. Server component, plain HTML and
// CSS — no chart library, and it reads the same in light and dark.
import { formatMoney } from '@/lib/money';
import type { ShopInsights } from '@/lib/shopInsights';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function dayLabel(iso: string): { top: string; bottom: string } {
  const d = new Date(`${iso}T12:00:00Z`);
  return {
    top: d.toLocaleDateString('en-GB', { weekday: 'narrow', timeZone: 'UTC' }),
    bottom: String(d.getUTCDate()),
  };
}

export default function ShopInsightsPanel({ data, currency }: { data: ShopInsights; currency: string }) {
  const { grid, items, heat, heatBasis, weekdayTotals, basket } = data;
  const heatMax = Math.max(1, ...heat.flat());
  // Only the hours anyone actually uses, plus one either side — a 24-column
  // grid of mostly empty night hours says nothing.
  const used = heat.flatMap((row) => row.map((n, h) => (n > 0 ? h : -1))).filter((h) => h >= 0);
  const fromHour = used.length ? Math.max(0, Math.min(...used) - 1) : 9;
  const toHour = used.length ? Math.min(23, Math.max(...used) + 1) : 20;
  const hours = Array.from({ length: toHour - fromHour + 1 }, (_, i) => fromHour + i);
  const bestDay = weekdayTotals.indexOf(Math.max(...weekdayTotals));
  const busiest = heat
    .flatMap((row, d) => row.map((n, h) => ({ d, h, n })))
    .sort((a, b) => b.n - a.n)[0];

  return (
    <>
      {/* ---- Basket facts ---- */}
      <div className="si-tiles anim-fade-up">
        <div className="si-tile">
          <span>Average order</span>
          <strong>{formatMoney(basket.averageCents, currency)}</strong>
        </div>
        <div className="si-tile">
          <span>Items per order</span>
          <strong>{basket.itemsPerOrder}</strong>
        </div>
        <div className="si-tile">
          <span>Orders with 2+ kinds</span>
          <strong>{basket.multiPct}%</strong>
        </div>
        <div className="si-tile">
          <span>Best day</span>
          <strong>{weekdayTotals[bestDay] > 0 ? WEEKDAYS[bestDay] : '—'}</strong>
        </div>
      </div>
      {basket.topPair && (
        <p className="muted small anim-fade-up" style={{ margin: '-4px 0 16px' }}>
          Bought together most often: <strong>{basket.topPair.a}</strong> + <strong>{basket.topPair.b}</strong> (
          {basket.topPair.count} orders) — worth a bundle?
        </p>
      )}

      {/* ---- Items × days ---- */}
      <div className="card anim-fade-up">
        <div className="card-title">Items sold per day — last 14 days</div>
        {grid.max === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            No confirmed orders in the last two weeks yet.
          </p>
        ) : (
          <div className="si-scroll">
            <table className="si-grid">
              <thead>
                <tr>
                  <th />
                  {grid.days.map((d) => {
                    const l = dayLabel(d);
                    return (
                      <th key={d} title={d}>
                        <span>{l.top}</span>
                        {l.bottom}
                      </th>
                    );
                  })}
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {grid.rows.map((r) => (
                  <tr key={r.tierKey}>
                    <th scope="row" title={r.name}>
                      {r.name}
                    </th>
                    {r.perDay.map((n, i) => (
                      <td
                        key={i}
                        className="si-cell"
                        style={{ ['--si-a' as string]: n === 0 ? 0 : 0.15 + 0.85 * (n / grid.max) }}
                        title={`${r.name} · ${grid.days[i]}: ${n}`}
                      >
                        {n || ''}
                      </td>
                    ))}
                    <td className="si-total">{r.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ---- Per item ---- */}
      <div className="card anim-fade-up">
        <div className="card-title">Every item</div>
        <div className="si-scroll">
          <table className="table small si-items table-cards">
            <thead>
              <tr>
                <th>Item</th>
                <th>Sold</th>
                <th>Revenue</th>
                <th>Share</th>
                <th>Left</th>
                <th>Collected</th>
                <th>Rating</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.tierKey}>
                  <td data-label="Item" className="tc-head">{it.name}</td>
                  <td data-label="Sold">{it.sold}</td>
                  <td data-label="Revenue">{formatMoney(it.revenueCents, currency)}</td>
                  <td data-label="Share">
                    <span className="si-share">
                      <span style={{ width: `${it.share}%` }} />
                    </span>
                    {it.share}%
                  </td>
                  <td data-label="Left" className={it.left !== null && it.left <= 5 ? 'si-low' : undefined}>
                    {it.left === null ? '∞' : it.left}
                  </td>
                  <td data-label="Collected">{it.collectedPct === null ? '—' : `${it.collectedPct}%`}</td>
                  <td data-label="Rating">{it.rating ? `★ ${it.rating.average.toFixed(1)} (${it.rating.count})` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---- When ---- */}
      <div className="card anim-fade-up">
        <div className="card-title">{heatBasis === 'slot' ? 'Busiest collection times' : 'When people order'}</div>
        {busiest && busiest.n > 0 ? (
          <>
            <p className="muted small" style={{ marginTop: 0 }}>
              {heatBasis === 'slot' ? 'By the collection time buyers chose' : 'By the time the order was confirmed'}
              {' — '}busiest: <strong>{WEEKDAYS[busiest.d]} around {String(busiest.h).padStart(2, '0')}:00</strong>.
              Plan your cooking and staff around it.
            </p>
            <div className="si-scroll">
              <table className="si-heat">
                <thead>
                  <tr>
                    <th />
                    {hours.map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {heat.map((row, d) => (
                    <tr key={d}>
                      <th scope="row">{WEEKDAYS[d]}</th>
                      {hours.map((h) => (
                        <td
                          key={h}
                          className="si-heat-cell"
                          style={{ ['--si-a' as string]: row[h] === 0 ? 0 : 0.18 + 0.82 * (row[h] / heatMax) }}
                          title={`${WEEKDAYS[d]} ${h}:00 — ${row[h]}`}
                        />
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="muted" style={{ margin: 0 }}>
            Appears once orders come in.
          </p>
        )}
      </div>
    </>
  );
}
