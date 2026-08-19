// Server-rendered inline SVG charts for the insights page. No chart library:
// the data is small (days and tiers, not points), the portal is dark-themed,
// and inline SVG picks the page's own CSS variables up for free, so the
// charts restyle themselves with the site.
//
// Hover: every mark carries an SVG <title> on a hit area LARGER than the mark
// itself (a full-height day column, a full-width tier row), so the value is
// reachable without landing a cursor on a 2px line — and readable to screen
// readers, which announce <title> as the mark's name.
import type { DailySales } from '@/lib/analytics';
import { formatMoney } from '@/lib/money';

/** Axis-tick money: "€1.2K" not "€1,234.00" — ticks orient, labels state. */
function compactMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(cents / 100);
}

/** '2026-08-12' → '12 Aug', for axis labels and tooltips. */
function dayLabel(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return day;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

/** A y-axis ceiling that lands on a clean number (1/2/2.5/5 × 10^k). */
function niceCeiling(max: number): number {
  if (max <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(max));
  for (const m of [1, 2, 2.5, 5, 10]) {
    if (m * pow >= max) return m * pow;
  }
  return 10 * pow;
}

/**
 * A bar with a 4px-rounded DATA end and a square BASELINE end — grows to the
 * right from x. Falls back to a plain sliver when the bar is thinner than its
 * own corner radius.
 */
function rightRoundedBar(x: number, y: number, w: number, h: number, r = 4): string {
  if (w <= r) return `M${x},${y} h${Math.max(w, 1)} v${h} h${-Math.max(w, 1)} Z`;
  return `M${x},${y} h${w - r} a${r},${r} 0 0 1 ${r},${r} v${h - 2 * r} a${r},${r} 0 0 1 ${-r},${r} h${-(w - r)} Z`;
}

/* ------------------------------------------------------------------------ */
/* Sales over time: cumulative confirmed revenue, one series                 */
/* ------------------------------------------------------------------------ */

export function SalesOverTimeChart({
  days,
  currency,
  unitsWord,
}: {
  days: DailySales[];
  currency: string;
  /** "bookings" wording differs by kind only in the tooltip's order noun. */
  unitsWord: string;
}) {
  // A continuous day axis from first sale to last, quiet days carried flat —
  // a cumulative line that skips empty days would lie about the pace.
  const first = days[0].day;
  const last = days[days.length - 1].day;
  const byDay = new Map(days.map((d) => [d.day, d]));
  const series: { day: string; cumulative: number; added: number; orders: number }[] = [];
  let running = 0;
  for (
    let t = new Date(`${first}T00:00:00Z`).getTime();
    t <= new Date(`${last}T00:00:00Z`).getTime();
    t += 86_400_000
  ) {
    const day = new Date(t).toISOString().slice(0, 10);
    const row = byDay.get(day);
    running += row?.revenueCents ?? 0;
    series.push({ day, cumulative: running, added: row?.revenueCents ?? 0, orders: row?.ordersPaid ?? 0 });
  }

  const W = 720;
  const H = 240;
  const padL = 54; // room for y tick labels
  const padR = 16;
  const padT = 18; // room for the endpoint label
  const padB = 26; // the x-axis band lives INSIDE the viewBox — never clipped
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const yMax = niceCeiling(running);
  const x = (i: number) => padL + (series.length === 1 ? plotW : (i / (series.length - 1)) * plotW);
  const y = (cents: number) => padT + plotH - (cents / yMax) * plotH;

  const linePath = series.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.cumulative).toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${x(series.length - 1).toFixed(1)},${(padT + plotH).toFixed(1)} L${padL},${(padT + plotH).toFixed(1)} Z`;

  // Recessive grid: baseline, midpoint, top — three hairlines, no more.
  const ticks = [0, yMax / 2, yMax];
  const endX = x(series.length - 1);
  const endY = y(running);
  const colW = series.length === 1 ? plotW : plotW / (series.length - 1);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Cumulative confirmed revenue by day, ${dayLabel(first)} to ${dayLabel(last)}, ending at ${formatMoney(running, currency)}`}
      style={{ width: '100%', height: 'auto', display: 'block' }}
    >
      {ticks.map((t) => (
        <g key={t}>
          <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="var(--border-soft)" strokeWidth={1} />
          <text x={padL - 8} y={y(t) + 3.5} textAnchor="end" fontSize={11} fill="var(--text-dim)">
            {compactMoney(t, currency)}
          </text>
        </g>
      ))}

      {/* The series: a 10%-opacity wash under a 2px line. */}
      <path d={areaPath} fill="var(--accent)" opacity={0.1} />
      <path d={linePath} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

      {/* Endpoint: ≥8px dot with a 2px surface ring, direct-labelled with the
          total in a TEXT token — the one selectively-labelled point. */}
      <circle cx={endX} cy={endY} r={4.5} fill="var(--accent)" stroke="var(--bg-card)" strokeWidth={2} />
      <text
        x={Math.min(endX, W - padR) - 6}
        y={Math.max(endY - 10, 12)}
        textAnchor="end"
        fontSize={12}
        fontWeight={700}
        fill="var(--text)"
      >
        {formatMoney(running, currency)}
      </text>

      {/* x-axis: first and last day carry the reading; the tooltips carry the rest. */}
      <text x={padL} y={H - 8} fontSize={11} fill="var(--text-dim)">
        {dayLabel(first)}
      </text>
      <text x={W - padR} y={H - 8} textAnchor="end" fontSize={11} fill="var(--text-dim)">
        {dayLabel(last)}
      </text>

      {/* Tooltip layer: one full-height invisible column per day — a hit
          target the whole plot tall, not a 2px line to land on. */}
      {series.map((p, i) => (
        <rect
          key={p.day}
          x={x(i) - colW / 2}
          y={padT}
          width={colW}
          height={plotH}
          fill="transparent"
        >
          <title>
            {`${dayLabel(p.day)} — ${formatMoney(p.cumulative, currency)} total${
              p.orders > 0 ? ` · ${p.orders} new ${p.orders === 1 ? unitsWord : `${unitsWord}s`} (+${formatMoney(p.added, currency)})` : ''
            }`}
          </title>
        </rect>
      ))}
    </svg>
  );
}

/* ------------------------------------------------------------------------ */
/* By ticket type: horizontal bars, one series, direct-labelled              */
/* ------------------------------------------------------------------------ */

export interface TierBarDatum {
  name: string;
  sold: number;
  revenueCents: number;
}

export function TierBarsChart({ tiers, currency }: { tiers: TierBarDatum[]; currency: string }) {
  const W = 720;
  const rowH = 44;
  const H = tiers.length * rowH;
  const barH = 16; // thin marks — well under the 24px cap
  const maxSold = Math.max(...tiers.map((t) => t.sold), 1);
  // Reserve the right side for the direct label so it never clips.
  const barMaxW = W - 190;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="Units sold and revenue per type"
      style={{ width: '100%', height: 'auto', display: 'block' }}
    >
      {tiers.map((t, i) => {
        const yTop = i * rowH;
        const w = (t.sold / maxSold) * barMaxW;
        const barY = yTop + 22;
        return (
          <g key={`${t.name}-${i}`}>
            <text x={0} y={yTop + 14} fontSize={12} fill="var(--text)">
              {t.name}
            </text>
            {/* Hairline baseline the bar grows from, so a zero still reads. */}
            <line x1={0} x2={0} y1={barY - 2} y2={barY + barH + 2} stroke="var(--border-soft)" strokeWidth={1} />
            {t.sold > 0 && <path d={rightRoundedBar(0, barY, w, barH)} fill="var(--accent)" />}
            {/* Direct label OUTSIDE the bar end — measured room, never inside. */}
            <text x={Math.max(w, 1) + 10} y={barY + barH - 4} fontSize={12} fill="var(--text-dim)">
              <tspan fill="var(--text)" fontWeight={700}>
                {t.sold} sold
              </tspan>
              {` · ${formatMoney(t.revenueCents, currency)}`}
            </text>
            {/* Row-wide hit target for the tooltip. */}
            <rect x={0} y={yTop} width={W} height={rowH} fill="transparent">
              <title>{`${t.name}: ${t.sold} sold · ${formatMoney(t.revenueCents, currency)}`}</title>
            </rect>
          </g>
        );
      })}
    </svg>
  );
}

/* ------------------------------------------------------------------------ */
/* How people paid: ≤3 categories — one compact stacked bar + labelled chips */
/* ------------------------------------------------------------------------ */

// Validated categorical hexes (dataviz validator, --mode dark, surface
// #161926: lightness band, chroma, CVD ΔE 8.9, normal-vision ΔE 27.6,
// contrast ≥3:1 — all PASS). Order is part of the safety and never changes.
const PAY_COLORS: Record<string, string> = {
  transfer: '#2a78d6',
  paypal: '#e2612e',
  free: '#1baf7a',
};

export interface PaySegment {
  key: 'transfer' | 'paypal' | 'free';
  label: string;
  count: number;
}

export function PaymentSplitBar({ segments }: { segments: PaySegment[] }) {
  const shown = segments.filter((s) => s.count > 0);
  const total = shown.reduce((sum, s) => sum + s.count, 0);
  const W = 720;
  const H = 18;
  const GAP = 2; // surface gap between fills — the separator, not a stroke
  const usable = W - GAP * (shown.length - 1);

  let cursor = 0;
  const rects = shown.map((s, i) => {
    const w = (s.count / total) * usable;
    const x = cursor;
    cursor += w + GAP;
    return { ...s, x, w, first: i === 0, last: i === shown.length - 1 };
  });

  return (
    <div>
      {shown.length > 1 && (
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`Paid orders by payment method: ${shown.map((s) => `${s.label} ${s.count}`).join(', ')}`}
          style={{ width: '100%', height: 'auto', display: 'block' }}
        >
          {rects.map((s) => {
            const rL = s.first ? 4 : 0;
            const rR = s.last ? 4 : 0;
            const d = `M${s.x + rL},0 h${s.w - rL - rR} a${rR},${rR} 0 0 1 ${rR},${rR} v${H - 2 * rR} a${rR},${rR} 0 0 1 ${-rR},${rR} h${-(s.w - rL - rR)} a${rL},${rL} 0 0 1 ${-rL},${-rL} v${-(H - 2 * rL)} a${rL},${rL} 0 0 1 ${rL},${-rL} Z`;
            return (
              <path key={s.key} d={d} fill={PAY_COLORS[s.key]}>
                <title>{`${s.label}: ${s.count} order${s.count === 1 ? '' : 's'}`}</title>
              </path>
            );
          })}
        </svg>
      )}
      {/* Direct labels: a swatch beside TEXT-token text — text never wears
          the data color. These double as the ≥2-series identity channel. */}
      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginTop: shown.length > 1 ? 10 : 0 }}>
        {segments.map((s) => (
          <span key={s.key} className="small" style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
            <span
              aria-hidden
              style={{
                width: 10,
                height: 10,
                borderRadius: 3,
                background: s.count > 0 ? PAY_COLORS[s.key] : 'var(--border)',
                flex: 'none',
              }}
            />
            <span>
              {s.label} — <strong>{s.count}</strong> order{s.count === 1 ? '' : 's'}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
