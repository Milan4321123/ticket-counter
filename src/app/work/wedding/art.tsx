// The invitation's ornaments, all drawn in SVG: marigolds (sayapatri), the
// toran garland, a mandala, the dhaka weave, a diya, an arch, and the art
// tiles that stand in for photos. No pictures of people, no image files —
// the whole demo is a few kilobytes of shapes.

import type { CSSProperties } from 'react';

/** Shared symbols and gradients — rendered once, used by every <use> below. */
export function ArtDefs() {
  const outer = Array.from({ length: 14 }, (_, i) => i * (360 / 14));
  const inner = Array.from({ length: 10 }, (_, i) => i * 36 + 18);
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="wd-g-mari" cx="50%" cy="45%" r="60%">
          <stop offset="0" stopColor="#ffd34d" />
          <stop offset="0.55" stopColor="#f7a21b" />
          <stop offset="1" stopColor="#d9640e" />
        </radialGradient>
        <radialGradient id="wd-g-mari2" cx="50%" cy="45%" r="60%">
          <stop offset="0" stopColor="#fff1a6" />
          <stop offset="0.6" stopColor="#ffc93c" />
          <stop offset="1" stopColor="#ef9a12" />
        </radialGradient>
        <linearGradient id="wd-g-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f6dd8f" />
          <stop offset="0.5" stopColor="#c8962e" />
          <stop offset="1" stopColor="#f0cf6e" />
        </linearGradient>
        <radialGradient id="wd-g-flame" cx="50%" cy="70%" r="60%">
          <stop offset="0" stopColor="#fff7c2" />
          <stop offset="0.5" stopColor="#ffb52e" />
          <stop offset="1" stopColor="#e5491b" stopOpacity="0" />
        </radialGradient>
        <symbol id="wd-marigold" viewBox="-12 -12 24 24">
          {outer.map((a) => (
            <ellipse key={a} cx="0" cy="-7.4" rx="3.1" ry="4.6" fill="url(#wd-g-mari)" transform={`rotate(${a})`} />
          ))}
          {inner.map((a) => (
            <ellipse key={a} cx="0" cy="-4.2" rx="2.4" ry="3.4" fill="url(#wd-g-mari2)" transform={`rotate(${a})`} />
          ))}
          <circle r="2.6" fill="#e9861a" />
          <circle r="1.2" fill="#b4500c" />
        </symbol>
        <symbol id="wd-leaf" viewBox="-6 -10 12 20">
          <path d="M0 -9 C 5 -4 5 4 0 9 C -5 4 -5 -4 0 -9 Z" fill="#3f7a3a" />
          <path d="M0 -8 L0 8" stroke="#2c5a28" strokeWidth="0.8" />
        </symbol>
        <symbol id="wd-bell" viewBox="-6 -8 12 16">
          <path d="M-5 5 C -5 -2 -3 -6 0 -6 C 3 -6 5 -2 5 5 Z" fill="url(#wd-g-gold)" />
          <circle cy="6" r="1.6" fill="#c8962e" />
        </symbol>
      </defs>
    </svg>
  );
}

/** One hanging strand of the toran: marigolds on a thread, a bell at the end. */
function Strand({ count, delay }: { count: number; delay: number }) {
  const h = count * 20 + 22;
  return (
    <span className="wd-strand" style={{ '--d': `${delay}s` } as CSSProperties}>
      <svg viewBox={`0 0 24 ${h}`} width="24" height={h} aria-hidden="true">
        <line x1="12" y1="0" x2="12" y2={h - 10} stroke="#7a3b10" strokeWidth="1" />
        {Array.from({ length: count }, (_, i) => (
          <use key={i} href="#wd-marigold" x="1" y={4 + i * 20} width="22" height="22" />
        ))}
        <use href="#wd-bell" x="6" y={h - 16} width="12" height="16" />
      </svg>
    </span>
  );
}

/** The toran across the top of the hero: a swag rope with strands of different lengths. */
export function Toran() {
  const lengths = [3, 5, 4, 6, 3, 5, 7, 5, 3, 6, 4, 5, 3, 6, 4, 5, 3];
  return (
    <div className="wd-toran" aria-hidden="true">
      <div className="wd-toran-rope">
        {Array.from({ length: 40 }, (_, i) => (
          <svg key={i} viewBox="0 0 24 24" width="24" height="24">
            <use href={i % 3 === 1 ? '#wd-leaf' : '#wd-marigold'} x="2" y="2" width="20" height="20" />
          </svg>
        ))}
      </div>
      <div className="wd-toran-strands">
        {lengths.map((n, i) => (
          <Strand key={i} count={n} delay={(i % 5) * 0.37} />
        ))}
      </div>
    </div>
  );
}

/** A lotus mandala: rings of petals and dots. */
export function Mandala({ className, stroke = '#e8c873' }: { className?: string; stroke?: string }) {
  const petals16 = Array.from({ length: 16 }, (_, i) => i * 22.5);
  const petals8 = Array.from({ length: 8 }, (_, i) => i * 45);
  const dots = Array.from({ length: 32 }, (_, i) => i * 11.25);
  return (
    <svg className={className} viewBox="-100 -100 200 200" aria-hidden="true" fill="none" stroke={stroke} strokeWidth="1">
      <circle r="96" />
      <circle r="90" strokeDasharray="2 4" />
      {dots.map((a) => (
        <circle key={a} cx="0" cy="-84" r="2" fill={stroke} stroke="none" transform={`rotate(${a})`} />
      ))}
      {petals16.map((a) => (
        <path key={a} d="M0 -78 C 12 -64 12 -50 0 -40 C -12 -50 -12 -64 0 -78 Z" transform={`rotate(${a})`} />
      ))}
      <circle r="40" />
      {petals8.map((a) => (
        <path key={a} d="M0 -38 C 14 -26 12 -14 0 -8 C -12 -14 -14 -26 0 -38 Z" transform={`rotate(${a + 22.5})`} />
      ))}
      {petals8.map((a) => (
        <path key={a} d="M0 -30 C 7 -22 6 -14 0 -10 C -6 -14 -7 -22 0 -30 Z" transform={`rotate(${a})`} />
      ))}
      <circle r="8" />
      <circle r="3" fill={stroke} />
    </svg>
  );
}

/** A clay diya with a flickering flame. */
export function Diya({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 60 60" aria-hidden="true">
      <ellipse className="wd-flame-glow" cx="30" cy="22" rx="16" ry="18" fill="url(#wd-g-flame)" />
      <path className="wd-flame" d="M30 8 C 36 18 36 26 30 30 C 24 26 24 18 30 8 Z" fill="#ffc23d" />
      <path d="M30 16 C 33 22 33 26 30 28 C 27 26 27 22 30 16 Z" fill="#fff4c4" />
      <path d="M6 34 C 10 50 50 50 54 34 C 44 38 16 38 6 34 Z" fill="#b5541c" />
      <path d="M6 34 C 16 38 44 38 54 34 C 48 31 12 31 6 34 Z" fill="#e0823a" />
      <path d="M14 42 C 24 46 36 46 46 42" stroke="#f3c26b" strokeWidth="1.2" fill="none" />
    </svg>
  );
}

/** The scalloped arch that frames the names (wedding.css unveils it bottom-up). */
export function Arch() {
  return (
    <svg className="wd-arch" viewBox="0 0 300 380" aria-hidden="true" fill="none" preserveAspectRatio="none">
      <path
        d="M10 375 V150 C10 110 40 90 70 80 C100 70 120 50 130 25 C138 12 145 8 150 4 C155 8 162 12 170 25 C180 50 200 70 230 80 C260 90 290 110 290 150 V375"
        stroke="url(#wd-g-gold)"
        strokeWidth="2.2"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M22 375 V156 C22 122 48 104 76 94 C106 83 128 62 139 36 C143 28 147 23 150 20 C153 23 157 28 161 36 C172 62 194 83 224 94 C252 104 278 122 278 156 V375"
        stroke="#e8c873"
        strokeOpacity="0.55"
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/** Small icons for the four programmes. */
export function ProgrammeIcon({ id }: { id: 'mehendi' | 'janti' | 'bihe' | 'reception' }) {
  const common = { viewBox: '0 0 48 48', 'aria-hidden': true, fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  if (id === 'mehendi')
    return (
      <svg {...common}>
        <path d="M24 6 C 34 14 38 24 30 34 C 26 39 18 38 16 32 C 14 26 22 22 26 26 C 28 28 26 31 23 30" />
        <circle cx="12" cy="12" r="2" />
        <circle cx="36" cy="40" r="2" />
        <path d="M8 26 c3 -2 5 -2 7 0" />
      </svg>
    );
  if (id === 'janti')
    return (
      <svg {...common}>
        <ellipse cx="24" cy="18" rx="14" ry="5" />
        <path d="M10 18 V30 C10 34 16 36 24 36 C32 36 38 34 38 30 V18" />
        <path d="M14 22 L20 33 M24 23 V36 M34 22 L28 33" />
        <path d="M6 8 L14 14 M42 8 L34 14" />
      </svg>
    );
  if (id === 'bihe')
    return (
      <svg {...common}>
        <path d="M24 8 C 30 16 31 22 24 27 C 17 22 18 16 24 8 Z" />
        <path d="M24 16 C 26 19 26 22 24 24 C 22 22 22 19 24 16 Z" />
        <path d="M10 30 H38 L34 40 H14 Z" />
        <path d="M14 30 L18 26 M34 30 L30 26" />
      </svg>
    );
  return (
    <svg {...common}>
      <path d="M16 6 V12 M32 6 V12" />
      <path d="M11 12 H21 L19 26 C18 30 14 30 13 26 Z" />
      <path d="M27 12 H37 L35 26 C34 30 30 30 29 26 Z" />
      <path d="M16 29 V40 M32 29 V40 M12 40 H20 M28 40 H36" />
      <path d="M22 4 l1 2 M26 4 l-1 2" />
    </svg>
  );
}

/** An abstract little map: the Main river, a few streets and a pin. */
export function MiniMap() {
  return (
    <svg className="wd-map" viewBox="0 0 320 200" aria-hidden="true">
      <rect width="320" height="200" fill="#f3e4c6" />
      <g stroke="#e6d0a6" strokeWidth="10" strokeLinecap="round">
        <path d="M-10 60 L330 40" />
        <path d="M-10 120 L330 150" />
        <path d="M70 -10 L110 210" />
        <path d="M220 -10 L200 210" />
      </g>
      <g stroke="#fffaf0" strokeWidth="3" strokeLinecap="round" opacity="0.8">
        <path d="M-10 92 L330 96" />
        <path d="M150 -10 L160 210" />
      </g>
      <path d="M-10 170 C 60 150 110 190 170 176 C 230 162 270 186 330 172 L330 210 L-10 210 Z" fill="#a9cbd6" />
      <rect x="120" y="66" width="56" height="34" rx="4" fill="#e7c98c" />
      <rect x="226" y="62" width="40" height="28" rx="4" fill="#e7c98c" />
      <rect x="20" y="70" width="38" height="40" rx="4" fill="#e7c98c" />
      <circle cx="252" cy="128" r="16" fill="#cfe0b8" />
      <g className="wd-pin">
        <path d="M160 92 C 160 92 142 70 142 58 C 142 48 150 40 160 40 C 170 40 178 48 178 58 C 178 70 160 92 160 92 Z" fill="#9b1b1e" />
        <circle cx="160" cy="58" r="7" fill="#fbf4e6" />
      </g>
      <ellipse cx="160" cy="96" rx="8" ry="2.5" fill="#000" opacity="0.18" />
    </svg>
  );
}

/** The six art tiles that hold the gallery's place until the photos come. */
export function TileArt({ i }: { i: number }) {
  if (i === 0)
    return (
      <svg viewBox="0 0 120 120" aria-hidden="true">
        {[
          [30, 34, 30],
          [74, 28, 34],
          [52, 66, 38],
          [90, 76, 28],
          [22, 86, 26],
        ].map(([x, y, s], k) => (
          <use key={k} href="#wd-marigold" x={x - s / 2} y={y - s / 2} width={s} height={s} />
        ))}
        <use href="#wd-leaf" x="44" y="90" width="14" height="24" transform="rotate(-30 51 102)" />
        <use href="#wd-leaf" x="102" y="40" width="12" height="20" transform="rotate(40 108 50)" />
      </svg>
    );
  if (i === 1) return <div className="wd-dhaka-fill" aria-hidden="true" />;
  if (i === 2) return <Diya className="wd-tile-diya" />;
  if (i === 3) return <Mandala className="wd-tile-mandala" stroke="#9b1b1e" />;
  if (i === 4)
    return (
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="86" cy="34" r="12" fill="#ffcf5a" />
        <path d="M0 96 L28 50 L42 68 L62 30 L86 72 L100 56 L120 86 V120 H0 Z" fill="#7d2a2e" />
        <path d="M62 30 L54 44 L60 42 L64 48 L70 40 Z M28 50 L22 60 L28 58 L32 62 Z" fill="#fbf4e6" />
        <path d="M0 104 C 30 96 60 112 120 100 V120 H0 Z" fill="#5c0f14" />
      </svg>
    );
  return (
    <svg viewBox="0 0 120 120" aria-hidden="true">
      <path d="M18 24 C 22 80 98 80 102 24" fill="none" stroke="#c8962e" strokeWidth="1.5" />
      {Array.from({ length: 23 }, (_, k) => {
        const t = k / 22;
        // Rounded so the server and the browser print the same numbers.
        const x = Math.round((18 + t * 84) * 100) / 100;
        const y = Math.round((24 + Math.sin(t * Math.PI) * 42) * 100) / 100;
        return <circle key={k} cx={x} cy={y} r="3.2" fill={k === 11 ? 'url(#wd-g-gold)' : '#1f7a3e'} />;
      })}
      <path d="M54 70 L60 92 L66 70 Z" fill="url(#wd-g-gold)" />
    </svg>
  );
}
