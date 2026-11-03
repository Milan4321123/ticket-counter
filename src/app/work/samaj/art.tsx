// Drawn pictures for the association demo: the made-up committee as little
// illustrated portraits (no photos of anyone), the gallery's festival scenes
// and a few icons. Plain SVG; the gallery scenes use their own festival
// colours, everything else takes the current look from CSS variables.

import type { ReactNode } from 'react';
import type { GalleryId, PersonId } from './content';

type Face = {
  bg: string;
  skin: string;
  hair: string;
  top: string;
  style: 'long' | 'bun' | 'short' | 'topi' | 'plait' | 'bob';
  tika?: boolean;
  glasses?: boolean;
  earrings?: boolean;
  flower?: boolean;
  beard?: boolean;
};

const FACES: Record<PersonId, Face> = {
  kamala: { bg: '#ffd9b0', skin: '#c98d62', hair: '#2b1a14', top: '#c0392b', style: 'bun', tika: true, earrings: true },
  rajendra: { bg: '#cfe0ff', skin: '#b97f55', hair: '#231815', top: '#2c4a8c', style: 'topi' },
  sabina: { bg: '#f7cde3', skin: '#d4a07a', hair: '#1d1412', top: '#8e3a7a', style: 'bob', glasses: true, earrings: true },
  dipak: { bg: '#c7eadf', skin: '#a8714a', hair: '#1a1210', top: '#1e7a63', style: 'short', beard: true },
  anish: { bg: '#e2ddff', skin: '#c08a60', hair: '#2a1b16', top: '#4b3fb0', style: 'short', glasses: true },
  pooja: { bg: '#ffe2c4', skin: '#cf9a70', hair: '#21140f', top: '#d35400', style: 'long', flower: true, earrings: true },
  nabin: { bg: '#d4ecff', skin: '#b07850', hair: '#17100d', top: '#0e6ba8', style: 'short' },
  laxmi: { bg: '#e9d8ff', skin: '#c48f66', hair: '#241712', top: '#7b3f9e', style: 'plait', tika: true, earrings: true },
};

export function Avatar({ id, size = 64 }: { id: PersonId; size?: number }) {
  const l = FACES[id];
  return (
    <svg className="sj-avatar" width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" fill={l.bg} />
      {(l.style === 'long' || l.style === 'plait') && <path d="M17 30 C15 12 49 12 47 30 L49 54 C42 58 22 58 15 54 Z" fill={l.hair} />}
      {l.style === 'bob' && <path d="M18 31 C15 12 49 12 46 31 L46 42 C40 44 24 44 18 42 Z" fill={l.hair} />}
      {l.style === 'plait' && <path d="M44 34 C50 42 46 50 50 60" stroke={l.hair} strokeWidth="5" strokeLinecap="round" fill="none" />}
      <path d="M8 66 C10 50 21 45 32 45 C43 45 54 50 56 66 Z" fill={l.top} />
      <path d="M26 45 L32 52 L38 45" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1.6" />
      <rect x="28" y="36" width="8" height="10" rx="3" fill={l.skin} />
      <ellipse cx="32" cy="29" rx="11.5" ry="13.5" fill={l.skin} />
      {l.style === 'bun' && <circle cx="32" cy="13" r="6.5" fill={l.hair} />}
      {l.style === 'short' && <path d="M20.5 27 C19 13 45 12 43.5 27 C41 20 33 18.5 26 20.5 C23 22 21.5 24 20.5 27 Z" fill={l.hair} />}
      {l.style === 'topi' && (
        <>
          <path d="M21 26 C20 20 22 18 25 18 L41 18 C43 18 44 21 43 26 C39 22 25 22 21 26 Z" fill={l.hair} />
          <path d="M21.5 19.5 L23.5 8.5 L42 10.5 L42.5 20 Z" fill="#7a2e2e" />
          <path d="M22.4 15 L42.2 16.2 M23 12 L42.1 13.4" stroke="#e8b04a" strokeWidth="1.3" />
          <path d="M26 10 l2 6 M31 10.4 l2 6 M36 10.9 l2 6" stroke="#2d6a8f" strokeWidth="1.2" />
        </>
      )}
      {(l.style === 'long' || l.style === 'plait' || l.style === 'bun' || l.style === 'bob') && (
        <path d="M20 29 C19 15 45 15 44 29 C42 22 36 19 32 18.5 C29 20.5 24 23 20 29 Z" fill={l.hair} />
      )}
      {l.beard && <path d="M22 32 C23 42 29 44 32 44 C35 44 41 42 42 32 C39 37 25 37 22 32 Z" fill={l.hair} opacity="0.85" />}
      {l.flower && <circle cx="38.5" cy="12" r="2.6" fill="#ffb3c7" stroke="#e05a86" strokeWidth="1" />}
      <circle cx="27.2" cy="29.5" r="1.35" fill="#2a1d1a" />
      <circle cx="36.8" cy="29.5" r="1.35" fill="#2a1d1a" />
      <path d="M28.4 35.4 Q32 38.4 35.6 35.4" stroke="#6b3324" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      {l.tika && <ellipse cx="32" cy="23.4" rx="1.1" ry="1.6" fill="#d0172b" />}
      {l.glasses && (
        <g fill="none" stroke="#2a1d1a" strokeWidth="1.2">
          <circle cx="27.2" cy="29.5" r="3.6" />
          <circle cx="36.8" cy="29.5" r="3.6" />
          <path d="M30.8 29.4 h2.4" />
        </g>
      )}
      {l.earrings && (
        <>
          <circle cx="20.6" cy="34" r="1.3" fill="#e2b13c" />
          <circle cx="43.4" cy="34" r="1.3" fill="#e2b13c" />
        </>
      )}
    </svg>
  );
}

// ---------- gallery scenes (400 × 300) ----------

function Kites() {
  const kite = (x: number, y: number, s: number, a: string, b: string, r: number) => (
    <g transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`}>
      <path d="M0 -30 L22 0 L0 30 L-22 0 Z" fill={a} />
      <path d="M0 -30 L0 30 M-22 0 L22 0" stroke={b} strokeWidth="2" />
      <path d="M0 30 C6 46 -6 56 4 72" stroke={b} strokeWidth="1.5" fill="none" />
    </g>
  );
  return (
    <>
      <defs>
        <linearGradient id="g-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7ec8ff" />
          <stop offset="1" stopColor="#d9f0ff" />
        </linearGradient>
      </defs>
      <rect width="400" height="300" fill="url(#g-sky)" />
      <circle cx="330" cy="62" r="26" fill="#ffe28a" />
      <path d="M0 250 Q100 225 200 245 T400 240 V300 H0 Z" fill="#4c8f6a" />
      <path d="M0 272 Q120 258 240 270 T400 266 V300 H0 Z" fill="#2f6f8f" />
      <g stroke="#55606e" strokeWidth="1" fill="none" opacity="0.6">
        <path d="M120 120 Q90 200 60 262" />
        <path d="M250 80 Q260 180 300 262" />
        <path d="M190 160 Q175 210 160 262" />
      </g>
      {kite(120, 110, 1.3, '#e53950', '#7a1020', -12)}
      {kite(250, 70, 1, '#ffc23d', '#8a5a00', 10)}
      {kite(190, 150, 0.8, '#3f7fff', '#16357a', -4)}
    </>
  );
}

function Diyo() {
  return (
    <>
      <rect width="400" height="300" fill="#1a1030" />
      {Array.from({ length: 30 }, (_, i) => (
        <circle key={i} cx={(i * 137) % 400} cy={(i * 53) % 140} r={i % 3 === 0 ? 1.6 : 1} fill="#fff6d0" opacity="0.7" />
      ))}
      <rect y="210" width="400" height="90" fill="#3a2214" />
      {[50, 130, 210, 290, 370].map((x, i) => (
        <g key={x} transform={`translate(${x} ${200 + (i % 2) * 18})`}>
          <ellipse cx="0" cy="-34" rx="30" ry="36" fill="#ffb347" opacity="0.18" />
          <path d="M0 -40 C8 -28 6 -16 0 -12 C-6 -16 -8 -28 0 -40 Z" fill="#ffd34d" />
          <path d="M0 -32 C3 -26 3 -19 0 -16 C-3 -19 -3 -26 0 -32 Z" fill="#fff4c2" />
          <path d="M-24 -10 Q0 18 24 -10 Z" fill="#b5542a" />
          <path d="M-24 -10 H24" stroke="#e07b45" strokeWidth="3" strokeLinecap="round" />
        </g>
      ))}
    </>
  );
}

function Rangoli() {
  const ring = (r: number, n: number, color: string, petal: number) =>
    Array.from({ length: n }, (_, i) => (
      <ellipse key={`${r}-${i}`} cx="200" cy={150 - r} rx={petal * 0.45} ry={petal} fill={color} transform={`rotate(${(360 / n) * i} 200 150)`} />
    ));
  return (
    <>
      <rect width="400" height="300" fill="#c9a77c" />
      <rect x="20" y="20" width="360" height="260" fill="#d8b98f" rx="8" />
      {ring(92, 16, '#2f8f6a', 20)}
      {ring(66, 12, '#e8482f', 22)}
      {ring(42, 8, '#ffcc33', 18)}
      {ring(20, 8, '#7a3fd0', 10)}
      <circle cx="200" cy="150" r="12" fill="#fff" />
      <circle cx="200" cy="150" r="6" fill="#e8482f" />
    </>
  );
}

function Teej() {
  return (
    <>
      <rect width="400" height="300" fill="#8e0f1f" />
      <g opacity="0.25" stroke="#ffd36b" strokeWidth="2" fill="none">
        {Array.from({ length: 7 }, (_, i) => (
          <path key={i} d={`M${-40 + i * 70} 300 Q${i * 70} 160 ${40 + i * 70} 300`} />
        ))}
      </g>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <ellipse key={i} cx="200" cy={110 + i * 9} rx={70 - i * 2} ry="22" fill="none" stroke={i % 2 ? '#ffd36b' : '#2fa86a'} strokeWidth="7" />
      ))}
      <g fill="#ffd36b">
        <circle cx="90" cy="70" r="4" />
        <circle cx="320" cy="60" r="5" />
        <circle cx="330" cy="230" r="4" />
        <circle cx="70" cy="230" r="5" />
      </g>
      <path d="M150 230 C170 205 230 205 250 230 C230 255 170 255 150 230 Z" fill="#2fa86a" />
      <path d="M200 212 V248" stroke="#1b6b43" strokeWidth="2" />
    </>
  );
}

function NewYear() {
  return (
    <>
      <defs>
        <linearGradient id="g-dawn" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a2a6e" />
          <stop offset="0.55" stopColor="#ff8a5c" />
          <stop offset="1" stopColor="#ffd59a" />
        </linearGradient>
      </defs>
      <rect width="400" height="300" fill="url(#g-dawn)" />
      <circle cx="200" cy="200" r="46" fill="#fff2b8" />
      <path d="M0 230 L80 130 L130 180 L200 90 L270 170 L320 120 L400 220 V300 H0 Z" fill="#41456e" />
      <path d="M200 90 L222 118 L210 114 L200 126 L190 114 L178 118 Z M80 130 L94 148 L84 146 L76 154 Z M320 120 L333 136 L322 134 L314 140 Z" fill="#f4f6ff" />
      <path d="M0 260 L110 200 L190 245 L280 205 L400 255 V300 H0 Z" fill="#2a2d4d" />
    </>
  );
}

function Sports() {
  return (
    <>
      <rect width="400" height="300" fill="#3f9b52" />
      {Array.from({ length: 8 }, (_, i) => (
        <rect key={i} x={i * 50} width="25" height="300" fill="#48a85b" />
      ))}
      <g stroke="#ecfff0" strokeWidth="3" fill="none" opacity="0.9">
        <rect x="20" y="20" width="360" height="260" />
        <path d="M200 20 V280" />
        <circle cx="200" cy="150" r="42" />
        <rect x="20" y="95" width="50" height="110" />
        <rect x="330" y="95" width="50" height="110" />
      </g>
      <g transform="translate(252 178)">
        <circle r="20" fill="#fff" stroke="#222" strokeWidth="2" />
        <path d="M0 -8 L7.6 -2.5 L4.7 6.5 H-4.7 L-7.6 -2.5 Z" fill="#222" />
      </g>
      <g transform="translate(120 70)">
        <path d="M-10 0 L-16 -26 M10 0 L16 -26" stroke="#c0392b" strokeWidth="6" />
        <circle cy="14" r="16" fill="#ffcc33" stroke="#b8860b" strokeWidth="3" />
        <path d="M0 6 l3 6 6 1 -4.5 4 1 6 -5.5 -3 -5.5 3 1 -6 -4.5 -4 6 -1 Z" fill="#b8860b" />
      </g>
    </>
  );
}

function School() {
  return (
    <>
      <rect width="400" height="300" fill="#b7895a" />
      <rect x="30" y="30" width="340" height="200" rx="6" fill="#24463a" stroke="#6b4a2a" strokeWidth="10" />
      <text x="200" y="150" textAnchor="middle" fontFamily="Mukta, 'Noto Sans Devanagari', sans-serif" fontSize="78" fontWeight="700" fill="#f3f7ee">
        क ख ग
      </text>
      <path d="M70 190 q20 -10 40 0 t40 0" stroke="#f3f7ee" strokeWidth="3" fill="none" opacity="0.7" />
      <rect x="250" y="236" width="40" height="10" rx="3" fill="#fff" />
      <rect x="300" y="238" width="30" height="8" rx="3" fill="#ffd34d" />
      <rect x="40" y="250" width="320" height="10" fill="#6b4a2a" />
    </>
  );
}

function Deusi() {
  return (
    <>
      <rect width="400" height="300" fill="#122a4a" />
      {Array.from({ length: 22 }, (_, i) => (
        <path
          key={i}
          d="M0 -5 L1.5 -1.5 L5 0 L1.5 1.5 L0 5 L-1.5 1.5 L-5 0 L-1.5 -1.5 Z"
          transform={`translate(${(i * 89) % 400} ${(i * 47) % 160}) scale(${i % 3 === 0 ? 1.4 : 0.9})`}
          fill="#ffe9a8"
        />
      ))}
      <g transform="translate(200 205) rotate(-8)">
        <rect x="-90" y="-34" width="180" height="68" rx="34" fill="#8a4b22" />
        <ellipse cx="-90" cy="0" rx="18" ry="34" fill="#e8d2a6" stroke="#5a2f12" strokeWidth="4" />
        <ellipse cx="90" cy="0" rx="18" ry="34" fill="#e8d2a6" stroke="#5a2f12" strokeWidth="4" />
        <g stroke="#e8d2a6" strokeWidth="3">
          {[-60, -30, 0, 30, 60].map((x) => (
            <path key={x} d={`M${x - 15} -32 L${x + 15} 32`} />
          ))}
        </g>
      </g>
      <g fill="#ff6b5e">
        <circle cx="70" cy="110" r="10" />
        <circle cx="330" cy="100" r="12" />
        <circle cx="300" cy="140" r="7" fill="#ffd34d" />
        <circle cx="96" cy="150" r="7" fill="#ffd34d" />
      </g>
    </>
  );
}

const SCENES: Record<GalleryId, () => ReactNode> = {
  kites: Kites,
  diyo: Diyo,
  rangoli: Rangoli,
  teej: Teej,
  newyear: NewYear,
  sports: Sports,
  school: School,
  deusi: Deusi,
};

export function Scene({ id, label }: { id: GalleryId; label?: string }) {
  const Draw = SCENES[id];
  return (
    <svg className="sj-scene" viewBox="0 0 400 300" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} preserveAspectRatio="xMidYMid slice">
      <Draw />
    </svg>
  );
}

type IconName = 'cal' | 'news' | 'users' | 'join' | 'lock' | 'image' | 'mail' | 'pin' | 'clock' | 'ticket' | 'chev-l' | 'chev-r' | 'x' | 'doc' | 'check' | 'palette' | 'reset' | 'list' | 'grid' | 'print' | 'download';

const PATHS: Record<IconName, ReactNode> = {
  cal: (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" />
    </>
  ),
  news: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <path d="M7 9h10M7 12.5h10M7 16h6" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="9" r="3.2" />
      <path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5" />
      <circle cx="16.5" cy="8" r="2.6" />
      <path d="M15.5 13.2c2.6-.3 4.6 1.4 5 4.3" />
    </>
  ),
  join: (
    <>
      <circle cx="10" cy="8.5" r="3.5" />
      <path d="M3.5 19.5c.7-3.5 3.2-5.5 6.5-5.5 1.2 0 2.3.3 3.2.8M18 13v6M15 16h6" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="2" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </>
  ),
  image: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <path d="M3.5 16l5-5 4 4 3-3 5 5" />
      <circle cx="15.5" cy="8.5" r="1.5" />
    </>
  ),
  mail: (
    <>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
      <path d="M4 7l8 6 8-6" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11z" />
      <circle cx="12" cy="10" r="2.3" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  ticket: <path d="M4 7.5h16v3a1.8 1.8 0 0 0 0 3.5v3H4v-3a1.8 1.8 0 0 0 0-3.5z M14 7.5v9.5" />,
  'chev-l': <path d="M14.5 6l-6 6 6 6" />,
  'chev-r': <path d="M9.5 6l6 6-6 6" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  doc: (
    <>
      <path d="M6.5 3.5h7l4 4v13h-11z" />
      <path d="M13.5 3.5v4h4M9 12h6M9 15.5h6" />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  palette: (
    <>
      <path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.2 0 1.8-.8 1.5-1.8-.4-1.2.4-2.2 1.6-2.2H17a3.5 3.5 0 0 0 3.5-3.5c0-5.2-3.8-9.5-8.5-9.5z" />
      <circle cx="7.8" cy="11" r="1.2" />
      <circle cx="10.5" cy="7.3" r="1.2" />
      <circle cx="15" cy="7.8" r="1.2" />
    </>
  ),
  reset: <path d="M5 12a7 7 0 1 0 2.1-5M5 4.5V8h3.5" />,
  list: <path d="M8 7h12M8 12h12M8 17h12M4 7h.01M4 12h.01M4 17h.01" />,
  grid: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M4 9.5h16M4 14.5h16M9.5 4v16M14.5 4v16" />
    </>
  ),
  print: (
    <>
      <path d="M7 9V4h10v5" />
      <rect x="4" y="9" width="16" height="7.5" rx="1.8" />
      <path d="M7 14h10v6H7z" />
    </>
  ),
  download: <path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19.5h14" />,
};

export function Icon({ name }: { name: IconName }) {
  return (
    <svg className="sj-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}
