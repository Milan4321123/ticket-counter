'use client';

// The owner dashboard's charts for "Dhaka & Dal" (/work/shop): orders per day
// with the 7-day average and festival notes, horizontal bar lists (top
// products, category share) and the weekday × hour heatmap. Drawn at the
// box's real pixel width (so labels never shrink on a phone), thin marks,
// hairline grid, text in text colours, series colours from the validated
// colour-blind-safe pair (blue / orange) in both dashboard themes, a hover /
// keyboard readout and a "show as table" for each.

import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { count, dayLabel, hhmm, num, type Copy, type Lang } from './content';
import { HEAT_FROM, HEAT_TO, heatLevel, type DayPoint, type FestId } from './shop';

export function useWidth<T extends HTMLElement>(fallback = 600): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const cw = Math.floor(entries[0].contentRect.width);
      if (cw > 0) setW(cw);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

/** A clean axis top and step: 0 / 5 / 10 / 15, 0 / 10 / 20 … — at most five ticks. */
export function niceTicks(max: number): number[] {
  const m = Math.max(1, max);
  const steps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];
  const step = steps.find((s) => Math.ceil(m / s) <= 4) ?? Math.ceil(m / 4);
  const top = Math.ceil(m / step) * step;
  const out: number[] = [];
  for (let v = 0; v <= top; v += step) out.push(v);
  return out;
}

export function ChartCard({ title, sub, children, table, t, id, className = '', legend }: { title: string; sub?: string; children: ReactNode; table?: ReactNode; t: Copy; id: string; className?: string; legend?: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <section className={`dd-card dd-chart ${className}`} aria-labelledby={`${id}-h`}>
      <header className="dd-chart-head">
        <div>
          <h3 id={`${id}-h`}>{title}</h3>
          {sub && <p className="dd-chart-sub">{sub}</p>}
        </div>
        {legend}
      </header>
      {children}
      {table && (
        <>
          <button type="button" className="dd-linkbtn dd-table-toggle" aria-expanded={open} aria-controls={`${id}-t`} onClick={() => setOpen((o) => !o)}>
            {open ? t.hideTable : t.showTable}
          </button>
          <div id={`${id}-t`} hidden={!open} className="dd-table-wrap dd-data-table">
            {open && table}
          </div>
        </>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- orders per day

export function DailyChart({
  points,
  fests,
  ahead,
  today,
  t,
  lang,
}: {
  points: DayPoint[];
  fests: { id: FestId; day: number }[];
  ahead: { id: FestId; day: number } | null;
  today: number;
  t: Copy;
  lang: Lang;
}) {
  const [box, width] = useWidth<HTMLDivElement>(640);
  const [hover, setHover] = useState<number | null>(null);
  const uid = useId().replace(/:/g, '');
  const w = Math.max(280, width);
  const h = w < 520 ? 210 : 250;
  // On a phone a festival note and "Tihar on 8 Nov →" would collide: the second one gets its own line.
  const stack = !!ahead && fests.length > 0 && w < 640;
  const m = { l: 30, r: 12, t: stack ? 42 : 26, b: 26 };
  const pw = w - m.l - m.r;
  const ph = h - m.t - m.b;
  const n = points.length;
  const ticks = niceTicks(Math.max(...points.map((p) => Math.max(p.n, p.avg ?? 0))));
  const top = ticks[ticks.length - 1];
  const x = (i: number) => m.l + (n <= 1 ? pw / 2 : (i * pw) / (n - 1));
  const y = (v: number) => m.t + ph - (v / top) * ph;
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.n).toFixed(1)}`).join('');
  const area = `${line}L${x(n - 1).toFixed(1)} ${y(0)}L${x(0).toFixed(1)} ${y(0)}Z`;
  const avg = points
    .map((p, i) => (p.avg === null ? '' : `${i && points[i - 1].avg !== null ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.avg).toFixed(1)}`))
    .join('');
  // About five date labels, the last one always today.
  const every = Math.max(1, Math.round(n / (w < 520 ? 3 : 5)));
  const xt = points.map((_, i) => i).filter((i) => (n - 1 - i) % every === 0 && (n - 1 - i) / every <= (w < 520 ? 3 : 5));
  const first = points[0]?.day ?? today;

  const pick = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left;
    const i = Math.round(((px - m.l) / pw) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  };
  const key = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      setHover((hv) => Math.max(0, Math.min(n - 1, (hv ?? n - 1) + (e.key === 'ArrowRight' ? 1 : -1))));
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      setHover(e.key === 'Home' ? 0 : n - 1);
    } else if (e.key === 'Escape') setHover(null);
  };
  const hp = hover !== null ? points[hover] : null;
  const tipLeft = hover !== null ? Math.min(Math.max(x(hover), 80), w - 80) : 0;

  return (
    <div className="dd-plot" ref={box}>
      <div className="dd-plot-focus" tabIndex={0} role="group" aria-label={`${t.cDaily}. ${t.cDailySub(num(n, lang))}`} onKeyDown={key} onBlur={() => setHover(null)}>
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" onPointerMove={pick} onPointerDown={pick} onPointerLeave={() => setHover(null)}>
          <defs>
            <clipPath id={`clip-${uid}`}>
              <rect x={m.l} y={m.t - 2} width={pw} height={ph + 4} />
            </clipPath>
          </defs>
          {ticks.map((v) => (
            <g key={v}>
              <line x1={m.l} x2={w - m.r} y1={y(v)} y2={y(v)} className={v === 0 ? 'dd-axis' : 'dd-gridline'} />
              <text x={m.l - 6} y={y(v) + 4} className="dd-tick" textAnchor="end">
                {num(v, lang)}
              </text>
            </g>
          ))}
          {xt.map((i) => (
            <text key={i} x={x(i)} y={h - 6} className="dd-tick" textAnchor={i === n - 1 ? 'end' : i === 0 ? 'start' : 'middle'}>
              {dayLabel(points[i].day, lang, { day: 'numeric', month: 'short' })}
            </text>
          ))}
          {fests.map((f) => {
            const i = f.day - first;
            if (i < 0 || i >= n) return null;
            const fx = x(i);
            const anchor = fx > w - 70 ? 'end' : fx < m.l + 40 ? 'start' : 'middle';
            return (
              <g key={`${f.id}${f.day}`}>
                <line x1={fx} x2={fx} y1={m.t - 6} y2={m.t + ph} className="dd-annot-line" />
                <text x={fx} y={m.t - 10} className="dd-annot" textAnchor={anchor}>
                  {t.fest[f.id]}
                </text>
              </g>
            );
          })}
          {ahead && (
            <text x={w - m.r} y={stack ? 12 : m.t - 10} className="dd-annot" textAnchor="end">
              {t.festAhead(t.fest[ahead.id], dayLabel(ahead.day, lang, { day: 'numeric', month: 'short' }))}
            </text>
          )}
          <g clipPath={`url(#clip-${uid})`}>
            <path d={area} className="dd-s1-area" />
            <path d={line} className="dd-s1-line" />
            <path d={avg} className="dd-s2-line" />
          </g>
          <circle cx={x(n - 1)} cy={y(points[n - 1]?.n ?? 0)} r={4} className="dd-s1-dot" />
          {hp && hover !== null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={m.t} y2={m.t + ph} className="dd-cross" />
              <circle cx={x(hover)} cy={y(hp.n)} r={4.5} className="dd-s1-dot" />
              {hp.avg !== null && <circle cx={x(hover)} cy={y(hp.avg)} r={4.5} className="dd-s2-dot" />}
            </g>
          )}
        </svg>
        {hp && hover !== null && (
          <div className="dd-tip" style={{ left: tipLeft }} aria-live="polite">
            <strong>
              {dayLabel(hp.day, lang)}
              {hp.day === today ? ` · ${t.soFar}` : ''}
            </strong>
            <span>
              <i className="dd-key dd-key-s1" aria-hidden="true" />
              {t.tipOrders(num(hp.n, lang))}
            </span>
            {hp.avg !== null && (
              <span>
                <i className="dd-key dd-key-s2" aria-hidden="true" />
                {t.tipAvg(count(hp.avg, lang))}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function DailyLegend({ t }: { t: Copy }) {
  return (
    <ul className="dd-legend">
      <li>
        <i className="dd-key dd-key-s1" aria-hidden="true" />
        {t.lOrders}
      </li>
      <li>
        <i className="dd-key dd-key-s2 dd-key-line" aria-hidden="true" />
        {t.lAvg}
      </li>
    </ul>
  );
}

export function DailyTable({ points, today, t, lang }: { points: DayPoint[]; today: number; t: Copy; lang: Lang }) {
  return (
    <table>
      <thead>
        <tr>
          <th scope="col">{t.thDay}</th>
          <th scope="col" className="num">
            {t.thOrders}
          </th>
          <th scope="col" className="num">
            {t.thAvg}
          </th>
        </tr>
      </thead>
      <tbody>
        {[...points].reverse().map((p) => (
          <tr key={p.day}>
            <th scope="row">
              {dayLabel(p.day, lang)}
              {p.day === today ? ` (${t.soFar})` : ''}
            </th>
            <td className="num">{num(p.n, lang)}</td>
            <td className="num">{p.avg === null ? '—' : count(p.avg, lang)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ---------------------------------------------------------------- bar lists

export function BarList({ rows, lang, label, unit }: { rows: { key: string; label: ReactNode; value: number; text?: string }[]; lang: Lang; label: string; unit?: (v: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="dd-bars" aria-label={label}>
      {rows.map((r) => (
        <li key={r.key} className="dd-bar-row" title={unit ? unit(r.value) : undefined}>
          <span className="dd-bar-label">{r.label}</span>
          <span className="dd-bar-track">
            <span className="dd-bar" style={{ width: `${Math.max(1.5, (r.value / max) * 100)}%` }} />
            <span className="dd-bar-val">{r.text ?? num(r.value, lang)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------- heatmap

export function Heatmap({ grid, max, t, lang }: { grid: number[][]; max: number; t: Copy; lang: Lang }) {
  const [hover, setHover] = useState<{ r: number; c: number } | null>(null);
  const cols = HEAT_TO - HEAT_FROM + 1;
  const hourText = (c: number) => (c === 0 ? t.heatEarly : c === cols - 1 ? t.heatLate : hhmm((HEAT_FROM + c) * 60, lang));
  const v = hover ? grid[hover.r][hover.c] : null;
  return (
    <div className="dd-heat">
      <p className="dd-heat-readout" aria-live="polite">
        {hover && v !== null ? t.heatTip(t.weekdaysLong[hover.r], hourText(hover.c), num(v, lang)) : ' '}
      </p>
      <div className="dd-heat-scroll">
        <table className="dd-heat-table" onMouseLeave={() => setHover(null)}>
          <caption className="dd-sr">{t.cHeat}</caption>
          <thead>
            <tr>
              <td />
              {Array.from({ length: cols }, (_, c) => (
                <th key={c} scope="col" className="dd-heat-h">
                  <span aria-hidden="true">{c % 3 === 0 || c === cols - 1 ? num(c === 0 ? `≤${HEAT_FROM}` : c === cols - 1 ? `${HEAT_TO}+` : HEAT_FROM + c, lang) : ''}</span>
                  <span className="dd-sr">{hourText(c)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.map((row, r) => (
              <tr key={r}>
                <th scope="row" className="dd-heat-d">
                  <span aria-hidden="true">{t.weekdays[r]}</span>
                  <span className="dd-sr">{t.weekdaysLong[r]}</span>
                </th>
                {row.map((n, c) => (
                  <td key={c} className={`dd-hc dd-hl${heatLevel(n, max)}${hover && hover.r === r && hover.c === c ? ' is-on' : ''}`} onMouseEnter={() => setHover({ r, c })} title={t.heatTip(t.weekdaysLong[r], hourText(c), num(n, lang))}>
                    <span className="dd-sr">{num(n, lang)}</span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="dd-heat-legend" aria-hidden="true">
        <span className="dd-hc dd-hl0" /> {t.heatNone}
        <span className="dd-heat-gap" />
        {t.heatFewer}
        {[1, 2, 3, 4, 5].map((l) => (
          <span key={l} className={`dd-hc dd-hl${l}`} />
        ))}
        {t.heatMore}
      </div>
    </div>
  );
}
