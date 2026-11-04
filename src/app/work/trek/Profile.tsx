'use client';

// The altitude profile: day on x, metres on y. The line is where you sleep;
// small triangles mark the day's highest point when it is higher (climb high,
// sleep low); days flagged by the acclimatisation rule get a red band and a
// "!" marker. The 3,000 m line is where the rule starts. An image for sighted
// visitors with a full label, plus "show as a table" for everyone.

import { useEffect, useRef, useState } from 'react';
import { COPY, STOP_NAME, count, num, type Lang } from './content';
import { ALT_LINE, type DayInfo, type Warning } from './trek';

const H = 230;
const PAD = { l: 50, r: 14, t: 16, b: 30 };

export default function Profile({
  lang,
  infos,
  warnings,
  tripLabel,
  active,
  onPick,
  compact = false,
}: {
  lang: Lang;
  infos: DayInfo[];
  warnings: Warning[];
  tripLabel: string;
  active: number | null;
  onPick?: (i: number) => void;
  compact?: boolean;
}) {
  const t = COPY[lang];
  const [hover, setHover] = useState<number | null>(null);
  // Drawn at the size it is shown, so the axis text stays readable on a phone.
  const [W, setW] = useState(640);
  const box = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = box.current;
    if (!el || compact) return;
    const measure = () => setW(Math.round(Math.min(760, Math.max(300, el.getBoundingClientRect().width || 640))));
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [compact]);
  const n = infos.length;
  if (!n) return null;
  const maxTop = Math.max(...infos.map((x) => Math.max(x.top, x.sleep)));
  const maxSleep = Math.max(...infos.map((x) => x.sleep));
  const yMax = Math.max(2000, Math.ceil((maxTop + 250) / 1000) * 1000);
  const x = (i: number) => PAD.l + (n === 1 ? (W - PAD.l - PAD.r) / 2 : (i * (W - PAD.l - PAD.r)) / (n - 1));
  const y = (m: number) => PAD.t + (1 - m / yMax) * (H - PAD.t - PAD.b);
  const line = infos.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(d.sleep).toFixed(1)}`).join('');
  const area = `${line}L${x(n - 1).toFixed(1)} ${y(0)}L${x(0).toFixed(1)} ${y(0)}Z`;
  const flagged = new Set(warnings.map((w) => w.day));
  const grid: number[] = [];
  for (let m = 0; m <= yMax; m += yMax > 4000 ? 1000 : 500) grid.push(m);
  const every = Math.max(1, Math.ceil((n * 22) / (W - PAD.l - PAD.r)));
  const shown = hover ?? active;
  const step = n > 1 ? (W - PAD.l - PAD.r) / (n - 1) : W;

  return (
    <figure className={`tk-profile${compact ? ' is-compact' : ''}`} ref={box}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t.profileLabel(tripLabel, count(maxSleep, lang))} onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id={compact ? 'tk-prof-fill-p' : 'tk-prof-fill'} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0f5e63" stopOpacity="0.32" />
            <stop offset="1" stopColor="#0f5e63" stopOpacity="0.03" />
          </linearGradient>
        </defs>
        {grid.map((m) => (
          <g key={m}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(m)} y2={y(m)} className="tk-prof-grid" />
            <text x={PAD.l - 6} y={y(m) + 4} textAnchor="end" className="tk-prof-axis">
              {count(m, lang)}
            </text>
          </g>
        ))}
        {[...flagged].map((i) => (
          <rect key={`f${i}`} x={x(i) - Math.min(14, step / 2)} y={PAD.t} width={Math.min(28, step)} height={H - PAD.t - PAD.b} className="tk-prof-flag" />
        ))}
        {yMax > ALT_LINE && (
          <g>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(ALT_LINE)} y2={y(ALT_LINE)} className="tk-prof-line3000" />
            <text x={PAD.l + 4} y={y(ALT_LINE) - 5} textAnchor="start" className="tk-prof-axis tk-prof-3000">
              {count(ALT_LINE, lang)} m
            </text>
          </g>
        )}
        <path d={area} fill={`url(#${compact ? 'tk-prof-fill-p' : 'tk-prof-fill'})`} />
        <path d={line} className="tk-prof-sleep" />
        {infos.map((d, i) =>
          d.top > d.sleep ? (
            <g key={`t${i}`}>
              <line x1={x(i)} x2={x(i)} y1={y(d.sleep)} y2={y(d.top)} className="tk-prof-climb" />
              <path d={`M${x(i) - 5} ${y(d.top) + 4}L${x(i)} ${y(d.top) - 5}L${x(i) + 5} ${y(d.top) + 4}Z`} className="tk-prof-top" />
            </g>
          ) : null,
        )}
        {infos.map((d, i) => (
          <g key={`p${i}`} onMouseEnter={() => setHover(i)} onClick={() => onPick?.(i)} className="tk-prof-pt">
            <rect x={x(i) - step / 2} y={PAD.t} width={step} height={H - PAD.t - PAD.b} fill="transparent" />
            <circle cx={x(i)} cy={y(d.sleep)} r={shown === i ? 5.5 : 3.6} className={flagged.has(i) ? 'is-flag' : ''} />
            {flagged.has(i) && (
              <g transform={`translate(${x(i)} ${y(Math.max(d.top, d.sleep)) - 16})`}>
                <circle r={7.5} className="tk-prof-warn" />
                <text y={4} textAnchor="middle" className="tk-prof-warn-t">
                  !
                </text>
              </g>
            )}
            {(i % every === 0 || i === n - 1) && (
              <text x={x(i)} y={H - 10} textAnchor="middle" className="tk-prof-axis">
                {num(i + 1, lang)}
              </text>
            )}
          </g>
        ))}
        {shown !== null && infos[shown] && !compact && (
          <g transform={`translate(${Math.min(W - 170, Math.max(PAD.l, x(shown) - 80))} ${PAD.t})`} className="tk-prof-tip" pointerEvents="none">
            <rect width={160} height={38} rx={6} />
            <text x={8} y={15}>
              {t.dayN(num(shown + 1, lang))} · {STOP_NAME[infos[shown].stop][lang]}
            </text>
            <text x={8} y={31}>
              {count(infos[shown].sleep, lang)} m{infos[shown].top > infos[shown].sleep ? ` · ▲ ${count(infos[shown].top, lang)} m` : ''}
            </text>
          </g>
        )}
      </svg>
      {!compact && (
        <figcaption>
          <span className="tk-cap-item">
            <span className="tk-key tk-key-sleep" aria-hidden="true" /> {t.profileSleep}
          </span>
          <span className="tk-cap-item">
            <span className="tk-key tk-key-top" aria-hidden="true" /> {t.profileTop}
          </span>
          {maxTop < 2500 && <span className="tk-prof-low">{t.profileLow}</span>}
        </figcaption>
      )}
      {!compact && (
        <details className="tk-prof-table">
          <summary>{t.profileTable}</summary>
          <table>
            <thead>
              <tr>
                <th scope="col">{t.profileDay}</th>
                <th scope="col">{COPY[lang].addLabel}</th>
                <th scope="col">{t.profileSleep}</th>
                <th scope="col">{t.profileTop}</th>
              </tr>
            </thead>
            <tbody>
              {infos.map((d, i) => (
                <tr key={i} className={flagged.has(i) ? 'is-flag' : ''}>
                  <td>{num(i + 1, lang)}</td>
                  <td>{STOP_NAME[d.stop][lang]}</td>
                  <td>{count(d.sleep, lang)} m</td>
                  <td>{count(Math.max(d.top, d.sleep), lang)} m</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </figure>
  );
}
