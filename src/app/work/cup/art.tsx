// Drawings for the /work/cup demo: procedural team crests (a shield in the
// club's two colours, a pattern, a mountain / star / sun / moon and the
// initials), the Himal Cup trophy, the penalty dots and a few line icons.
// Plain SVG, no images — so a registered team gets a crest the moment it is typed.

import { useId, type ReactNode } from 'react';
import type { Motif, Pattern, Pens } from './cup';

const SHIELD = 'M24 2 L45 8 V27 C45 41 36 50 24 56 C12 50 3 41 3 27 V8 Z';

/** Relative luminance, to pick ink that reads on a colour. */
function lum(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return 0.5;
  const n = parseInt(m[1], 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}
export function inkOn(hex: string): string {
  return lum(hex) > 0.4 ? '#0b1220' : '#ffffff';
}

function MotifShape({ motif, color }: { motif: Motif; color: string }) {
  switch (motif) {
    case 'peak':
      return (
        <g fill={color}>
          <path d="M10 27 L19 14 L24 20 L29 12 L39 27 Z" />
          <path d="M29 12 L32.5 17 L30.5 16.5 L29 18 L27.5 16 Z" fill="#ffffff" opacity="0.9" />
        </g>
      );
    case 'star':
      return <path fill={color} d="M24 9.5 L26.9 16.6 L34.5 17.1 L28.6 22 L30.5 29.4 L24 25.3 L17.5 29.4 L19.4 22 L13.5 17.1 L21.1 16.6 Z" />;
    case 'sun':
      return (
        <g fill={color}>
          <circle cx="24" cy="19" r="5.2" />
          {Array.from({ length: 12 }, (_, i) => {
            const a = (i * Math.PI) / 6;
            const x = 24 + Math.cos(a) * 9;
            const y = 19 + Math.sin(a) * 9;
            const x1 = 24 + Math.cos(a + 0.16) * 6.4;
            const y1 = 19 + Math.sin(a + 0.16) * 6.4;
            const x2 = 24 + Math.cos(a - 0.16) * 6.4;
            const y2 = 19 + Math.sin(a - 0.16) * 6.4;
            return <path key={i} d={`M${x1.toFixed(2)} ${y1.toFixed(2)} L${x.toFixed(2)} ${y.toFixed(2)} L${x2.toFixed(2)} ${y2.toFixed(2)} Z`} />;
          })}
        </g>
      );
    case 'moon':
      return (
        <g fill={color}>
          <path d="M14.5 13 A 9.5 9.5 0 0 0 33.5 13 A 9.5 7 0 0 1 14.5 13 Z" />
          <circle cx="24" cy="22.5" r="3.3" />
          {Array.from({ length: 8 }, (_, i) => {
            const a = (i * Math.PI) / 4;
            return <circle key={i} cx={(24 + Math.cos(a) * 5.4).toFixed(2)} cy={(22.5 + Math.sin(a) * 5.4).toFixed(2)} r="0.9" />;
          })}
        </g>
      );
  }
}

/** A club crest. `initials` sit on a band across the shield's lower half. */
export function Crest({
  colors,
  motif,
  pattern = 'plain',
  initials,
  className = '',
  title,
}: {
  colors: [string, string];
  motif: Motif;
  pattern?: Pattern;
  initials: string;
  className?: string;
  title?: string;
}) {
  const id = useId().replace(/:/g, '');
  const [c0, c1] = colors;
  const text = initials.length > 3 ? initials.slice(0, 3) : initials;
  return (
    <svg className={`cu-crest ${className}`} viewBox="0 0 48 58" role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <defs>
        <clipPath id={`cl${id}`}>
          <path d={SHIELD} />
        </clipPath>
      </defs>
      <path d={SHIELD} fill={c0} />
      <g clipPath={`url(#cl${id})`}>
        {pattern === 'split' && <rect x="24" y="0" width="24" height="58" fill={c1} opacity="0.92" />}
        {pattern === 'stripe' && (
          <>
            <rect x="19" y="0" width="10" height="58" fill={c1} opacity="0.9" />
            <rect x="8" y="0" width="3" height="58" fill={c1} opacity="0.5" />
            <rect x="37" y="0" width="3" height="58" fill={c1} opacity="0.5" />
          </>
        )}
        {pattern === 'chevron' && <path d="M0 30 L24 42 L48 30 L48 38 L24 50 L0 38 Z" fill={c1} opacity="0.9" />}
        <MotifShape motif={motif} color={pattern === 'split' ? inkOn(c0) === '#ffffff' ? '#ffffff' : '#0b1220' : c1} />
        <rect x="0" y="31" width="48" height="13" fill="rgba(8, 12, 24, 0.62)" />
        <text x="24" y="41.2" textAnchor="middle" fontSize={text.length > 2 ? 9.5 : 11} fontWeight="800" fill="#ffffff" letterSpacing="0.6" fontFamily="inherit">
          {text}
        </text>
      </g>
      <path d={SHIELD} fill="none" stroke={c1} strokeWidth="2.4" />
      <path d={SHIELD} fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth="0.8" />
    </svg>
  );
}

/** The Himal Cup: a trophy with a mountain on its face. */
export function Trophy({ className = '' }: { className?: string }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg className={`cu-trophy ${className}`} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id={`tg${id}`} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#fde68a" />
          <stop offset="0.5" stopColor="#f59e0b" />
          <stop offset="1" stopColor="#b45309" />
        </linearGradient>
      </defs>
      <path d="M18 8 H46 V22 C46 32 40 38 32 38 C24 38 18 32 18 22 Z" fill={`url(#tg${id})`} />
      <path d="M18 12 H10 C10 22 14 27 20 28" fill="none" stroke="#f59e0b" strokeWidth="3.4" strokeLinecap="round" />
      <path d="M46 12 H54 C54 22 50 27 44 28" fill="none" stroke="#f59e0b" strokeWidth="3.4" strokeLinecap="round" />
      <rect x="28.5" y="37" width="7" height="10" fill="#d97706" />
      <path d="M21 47 H43 L45 56 H19 Z" fill={`url(#tg${id})`} />
      <rect x="16" y="56" width="32" height="5" rx="1.5" fill="#92400e" />
      <path d="M23 29 L29 20 L32 24 L35 18 L41 29 Z" fill="#fff7ed" opacity="0.9" />
    </svg>
  );
}

/** ✓ / ✗ dots for a shoot-out, one row per side. */
export function PenDots({ pens, side, label }: { pens: Pens; side: 'home' | 'away'; label?: string }) {
  return (
    <span className="cu-pens" aria-label={label}>
      {pens[side].map((ok, i) => (
        <span key={i} className={`cu-pen ${ok ? 'is-in' : 'is-out'}`} aria-hidden="true">
          {ok ? '✓' : '✗'}
        </span>
      ))}
    </span>
  );
}

export type IconName = 'play' | 'pause' | 'reset' | 'tv' | 'whistle' | 'fans' | 'star' | 'starOn' | 'undo' | 'close' | 'plus' | 'minus' | 'robot';
const PATHS: Record<IconName, ReactNode> = {
  play: <path d="M8 5 L19 12 L8 19 Z" fill="currentColor" stroke="none" />,
  pause: (
    <>
      <rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none" />
      <rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none" />
    </>
  ),
  reset: (
    <>
      <path d="M4 12 a8 8 0 1 0 2.4 -5.7" />
      <path d="M4 4 v4.5 h4.5" />
    </>
  ),
  tv: (
    <>
      <rect x="3" y="5" width="18" height="12" rx="2" />
      <path d="M8 21 h8 M12 17 v4" />
    </>
  ),
  whistle: (
    <>
      <circle cx="9" cy="14" r="5" />
      <path d="M13 10 L21 6 V10 L14 13" />
    </>
  ),
  fans: (
    <>
      <circle cx="8" cy="9" r="3" />
      <circle cx="16.5" cy="9" r="3" />
      <path d="M2.5 19 c0.8-3.5 3-5 5.5-5 s4.7 1.5 5.5 5 M11 19 c0.8-3.5 3-5 5.5-5 s4.7 1.5 5.5 5" />
    </>
  ),
  star: <path d="M12 3.5 L14.6 9.1 L20.6 9.6 L16 13.6 L17.5 19.6 L12 16.4 L6.5 19.6 L8 13.6 L3.4 9.6 L9.4 9.1 Z" />,
  starOn: <path d="M12 3.5 L14.6 9.1 L20.6 9.6 L16 13.6 L17.5 19.6 L12 16.4 L6.5 19.6 L8 13.6 L3.4 9.6 L9.4 9.1 Z" fill="currentColor" />,
  undo: (
    <>
      <path d="M9 14 L4 9 L9 4" />
      <path d="M4 9 H15 a5 5 0 0 1 0 10 H11" />
    </>
  ),
  close: <path d="M6 6 L18 18 M18 6 L6 18" />,
  plus: <path d="M12 5 V19 M5 12 H19" />,
  minus: <path d="M5 12 H19" />,
  robot: (
    <>
      <rect x="5" y="8" width="14" height="11" rx="3" />
      <path d="M12 4 V8 M9 13 h0.01 M15 13 h0.01 M9.5 16.5 h5" />
    </>
  ),
};
export function Icon({ name, className = '' }: { name: IconName; className?: string }) {
  return (
    <svg className={`cu-ic ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}
