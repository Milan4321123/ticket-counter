// Drawings for the /work/momo demo, all hand-made SVG — no images, no map
// tiles, no map service. The city map is a stylised drawing of the Rhine–Main
// corner (Wiesbaden, Mainz, Darmstadt) on a 360 × 300 grid; the stop positions
// and the truck's curves come from truck.ts so the map and the rules agree.

import type { CSSProperties, ReactNode } from 'react';
import { PLACES, legPath, type Filling, type PlaceId, type Visit } from './truck';

export type IconName =
  | 'truck'
  | 'bell'
  | 'bell-on'
  | 'pin'
  | 'clock'
  | 'bag'
  | 'ticket'
  | 'star'
  | 'map'
  | 'chili'
  | 'leaf'
  | 'sprout'
  | 'plus'
  | 'minus'
  | 'x'
  | 'reset'
  | 'scan'
  | 'pause'
  | 'play'
  | 'tv'
  | 'check'
  | 'arrow'
  | 'sound'
  | 'mute'
  | 'crew'
  | 'phone'
  | 'columns'
  | 'steam'
  | 'flag';

const PATHS: Record<IconName, ReactNode> = {
  truck: (
    <>
      <path d="M2 7h11v9H2z" />
      <path d="M13 10h4l3 3v3h-7z" />
      <circle cx="6" cy="17.5" r="1.8" />
      <circle cx="16.5" cy="17.5" r="1.8" />
    </>
  ),
  bell: (
    <>
      <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </>
  ),
  'bell-on': (
    <>
      <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" fill="currentColor" />
      <path d="M10 20a2 2 0 0 0 4 0" />
      <path d="M3 8a8 8 0 0 1 2.5-4M21 8a8 8 0 0 0-2.5-4" />
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
  bag: (
    <>
      <path d="M5 8h14l-1 12H6z" />
      <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
    </>
  ),
  ticket: (
    <>
      <path d="M3 8a2 2 0 0 0 0 4v0a2 2 0 0 1 0 4v2h18v-2a2 2 0 0 1 0-4 2 2 0 0 0 0-4V6H3z" />
      <path d="M14 6v12" strokeDasharray="2 2" />
    </>
  ),
  star: <path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z" />,
  map: (
    <>
      <path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z" />
      <path d="M9 4v14M15 6v14" />
    </>
  ),
  chili: <path d="M17 5c-1-1-2.5-.8-3 .5C12 10 9 15 5 18.5c4 .8 9.5-1.5 12-6.5 1-2 1.2-4.3 0-7zM17 5c.8-1 1.5-1.6 2.5-1.8" />,
  leaf: (
    <>
      <path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14z" />
      <path d="M5 19l8-8" />
    </>
  ),
  sprout: (
    <>
      <path d="M12 20v-8" />
      <path d="M12 12c0-3-2-5-6-5 0 3 2 5 6 5zM12 11c0-3 2-6 7-6 0 4-2.5 6-7 6z" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  reset: (
    <>
      <path d="M4 12a8 8 0 1 0 2.4-5.7" />
      <path d="M4 4v5h5" />
    </>
  ),
  scan: (
    <>
      <path d="M4 8V5h3M17 5h3v3M20 16v3h-3M7 19H4v-3" />
      <path d="M4 12h16" />
    </>
  ),
  pause: <path d="M8 5v14M16 5v14" />,
  play: <path d="M7 5l12 7-12 7z" />,
  tv: (
    <>
      <rect x="3" y="5" width="18" height="12" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  sound: (
    <>
      <path d="M4 9h4l5-4v14l-5-4H4z" />
      <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" />
    </>
  ),
  mute: (
    <>
      <path d="M4 9h4l5-4v14l-5-4H4z" />
      <path d="M17 9l5 6M22 9l-5 6" />
    </>
  ),
  crew: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6" />
      <circle cx="17" cy="9" r="2.4" />
      <path d="M16 14c3 0 5 2 5 5" />
    </>
  ),
  phone: (
    <>
      <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" />
      <path d="M10.5 18.5h3" />
    </>
  ),
  columns: (
    <>
      <rect x="3" y="4" width="7" height="16" rx="1.5" />
      <rect x="13" y="4" width="8" height="16" rx="1.5" />
    </>
  ),
  steam: <path d="M8 19c-2-2 2-4 0-6s2-4 0-6M13 19c-2-2 2-4 0-6s2-4 0-6M18 19c-2-2 2-4 0-6s2-4 0-6" />,
  flag: (
    <>
      <path d="M5 21V4" />
      <path d="M5 4h11l-2 4 2 4H5" />
    </>
  ),
};

export function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg className={`mt-ic${className ? ` ${className}` : ''}`} viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      {PATHS[name]}
    </svg>
  );
}

/** One momo, pleated on top. `tint` shifts the filling's hue a little so the four kinds read apart. */
export function Momo({ size = 64, tint = 38, fried = false, className }: { size?: number; tint?: number; fried?: boolean; className?: string }) {
  const skin = fried ? `hsl(${tint} 62% 62%)` : `hsl(${tint} 38% 92%)`;
  const shade = fried ? `hsl(${tint - 6} 58% 44%)` : `hsl(${tint} 22% 76%)`;
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <ellipse cx="32" cy="54" rx="22" ry="5" fill="rgba(0,0,0,0.12)" />
      <path d="M8 44c0-14 10-26 24-30 14 4 24 16 24 30 0 6-10 10-24 10S8 50 8 44z" fill={skin} stroke={shade} strokeWidth="1.6" />
      <path d="M32 14c-2 6-4 12-10 18M32 14c2 6 4 12 10 18M32 14v20M26 16c-4 5-9 9-14 14M38 16c4 5 9 9 14 14" fill="none" stroke={shade} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M28 12c1-3 7-3 8 0" fill={skin} stroke={shade} strokeWidth="1.6" />
      <ellipse cx="22" cy="42" rx="5" ry="3" fill="#fff" opacity="0.35" />
    </svg>
  );
}

/** A plate of momo for the menu: three on a plate, jhol in a bowl, C-momo glazed red. */
export function MomoPlate({ filling, style }: { filling: Filling; style: 'steamed' | 'fried' | 'jhol' | 'chilli' }) {
  const tint: Record<Filling, number> = { chicken: 34, veg: 96, paneer: 48, vegan: 150 };
  const t = tint[filling];
  const jhol = style === 'jhol';
  const chilli = style === 'chilli';
  return (
    <svg className="mt-plate" viewBox="0 0 120 84" aria-hidden="true" focusable="false">
      {jhol ? (
        <>
          <ellipse cx="60" cy="58" rx="52" ry="20" fill="#7c2d12" />
          <ellipse cx="60" cy="52" rx="50" ry="17" fill="#ea8a2e" />
          <ellipse cx="60" cy="50" rx="44" ry="13" fill="#f2a24a" />
        </>
      ) : (
        <>
          <ellipse cx="60" cy="62" rx="54" ry="16" fill="#e7dcc6" />
          <ellipse cx="60" cy="59" rx="48" ry="12" fill="#fffaf0" />
        </>
      )}
      <g transform="translate(14 14) scale(0.72)">
        <MomoShape tint={t} style={style} />
      </g>
      <g transform="translate(58 18) scale(0.72)">
        <MomoShape tint={t} style={style} />
      </g>
      <g transform="translate(36 26) scale(0.8)">
        <MomoShape tint={t} style={style} />
      </g>
      {chilli && <path d="M20 58c12 6 60 6 80-2" stroke="#b91c1c" strokeWidth="4" fill="none" strokeLinecap="round" opacity="0.8" />}
      {!jhol && (
        <g>
          <ellipse cx="100" cy="50" rx="10" ry="6" fill="#c2410c" />
          <ellipse cx="100" cy="48.5" rx="8" ry="4" fill={chilli ? '#991b1b' : '#ea580c'} />
        </g>
      )}
      {filling === 'vegan' && <path d="M90 22c0-6 4-9 10-10 0 7-4 10-10 10z" fill="#16a34a" />}
    </svg>
  );
}

function MomoShape({ tint, style }: { tint: number; style: 'steamed' | 'fried' | 'jhol' | 'chilli' }) {
  const fried = style === 'fried';
  const chilli = style === 'chilli';
  const skin = chilli ? 'hsl(4 70% 50%)' : fried ? `hsl(${tint} 62% 60%)` : `hsl(${tint} 36% 93%)`;
  const shade = chilli ? 'hsl(2 70% 34%)' : fried ? `hsl(${tint - 6} 58% 40%)` : `hsl(${tint} 22% 72%)`;
  return (
    <>
      <path d="M8 44c0-14 10-26 24-30 14 4 24 16 24 30 0 6-10 10-24 10S8 50 8 44z" fill={skin} stroke={shade} strokeWidth="1.8" />
      <path d="M32 14c-2 6-4 12-10 18M32 14c2 6 4 12 10 18M32 14v20" fill="none" stroke={shade} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M28 12c1-3 7-3 8 0" fill={skin} stroke={shade} strokeWidth="1.8" />
      <ellipse cx="22" cy="42" rx="5" ry="3" fill="#fff" opacity="0.32" />
    </>
  );
}

/** Rising steam: three wavy lines, animated in CSS (still under reduced motion). */
export function Steam({ className }: { className?: string }) {
  return (
    <svg className={`mt-steam${className ? ` ${className}` : ''}`} viewBox="0 0 40 40" aria-hidden="true" focusable="false">
      <path className="mt-steam-a" d="M10 36c-4-4 4-8 0-12s4-8 0-12" />
      <path className="mt-steam-b" d="M20 36c-4-4 4-8 0-12s4-8 0-12" />
      <path className="mt-steam-c" d="M30 36c-4-4 4-8 0-12s4-8 0-12" />
    </svg>
  );
}

/** The truck: teal body, marigold awning, a momo painted on the side. Drawn facing right. */
export function TruckArt({ className, steam }: { className?: string; steam?: boolean }) {
  return (
    <svg className={className} viewBox="0 0 120 80" aria-hidden="true" focusable="false">
      {steam && (
        <g className="mt-truck-steam" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity="0.85">
          <path className="mt-steam-a" d="M34 18c-4-4 4-6 0-10" />
          <path className="mt-steam-b" d="M44 18c-4-4 4-6 0-10" />
        </g>
      )}
      <ellipse cx="60" cy="74" rx="50" ry="4" fill="rgba(0,0,0,0.18)" />
      <rect x="10" y="20" width="72" height="44" rx="6" fill="#0f766e" />
      <path d="M82 32h16l12 14v18H82z" fill="#0d9488" />
      <path d="M86 36h11l8 10H86z" fill="#cffafe" />
      <path d="M6 24h80l-6 10H12z" fill="#f59e0b" />
      <path d="M12 34h8l-4 4zM28 34h8l-4 4zM44 34h8l-4 4zM60 34h8l-4 4z" fill="#d97706" />
      <rect x="18" y="38" width="46" height="16" rx="3" fill="#fef3c7" />
      <g transform="translate(26 36) scale(0.32)">
        <path d="M8 44c0-14 10-26 24-30 14 4 24 16 24 30 0 6-10 10-24 10S8 50 8 44z" fill="#fffaf0" stroke="#b45309" strokeWidth="4" />
        <path d="M32 14c-2 6-4 12-10 18M32 14c2 6 4 12 10 18M32 14v20" stroke="#b45309" strokeWidth="4" fill="none" />
      </g>
      <text x="58" y="50" textAnchor="middle" fontSize="8" fontWeight="800" fill="#0f766e" fontFamily="var(--mt-display)">
        MOMO
      </text>
      <circle cx="28" cy="66" r="8" fill="#1f2937" />
      <circle cx="28" cy="66" r="3.2" fill="#d1d5db" />
      <circle cx="94" cy="66" r="8" fill="#1f2937" />
      <circle cx="94" cy="66" r="3.2" fill="#d1d5db" />
      <rect x="104" y="52" width="6" height="4" rx="1" fill="#fde68a" />
    </svg>
  );
}

/** The small brand mark: a momo with a wheel. */
export function GaadiMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <rect width="48" height="48" rx="13" fill="#0f766e" />
      <path d="M9 32c0-9 6-16 15-19 9 3 15 10 15 19 0 4-6 6-15 6S9 36 9 32z" fill="#fffaf0" />
      <path d="M24 13c-1 4-3 8-7 11M24 13c1 4 3 8 7 11M24 13v13" stroke="#d97706" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <circle cx="15" cy="38" r="4" fill="#f59e0b" stroke="#0f766e" strokeWidth="2" />
      <circle cx="33" cy="38" r="4" fill="#f59e0b" stroke="#0f766e" strokeWidth="2" />
    </svg>
  );
}

/** A rubber stamp for the loyalty card — a momo in a ring, slightly turned. */
export function StampMark({ n, on }: { n: number; on: boolean }) {
  const rot = ((n * 37) % 30) - 15;
  return (
    <svg className={`mt-stamp${on ? ' is-on' : ''}`} viewBox="0 0 60 60" aria-hidden="true" focusable="false">
      {on ? (
        <g transform={`rotate(${rot} 30 30)`}>
          <circle cx="30" cy="30" r="25" fill="none" stroke="#b91c1c" strokeWidth="3" />
          <circle cx="30" cy="30" r="20" fill="none" stroke="#b91c1c" strokeWidth="1.2" strokeDasharray="2 2" />
          <g transform="translate(14 13) scale(0.5)">
            <path d="M8 44c0-14 10-26 24-30 14 4 24 16 24 30 0 6-10 10-24 10S8 50 8 44z" fill="#b91c1c" opacity="0.85" />
            <path d="M32 14c-2 6-4 12-10 18M32 14c2 6 4 12 10 18M32 14v20" stroke="#fef2f2" strokeWidth="3" fill="none" />
          </g>
        </g>
      ) : (
        <>
          <circle cx="30" cy="30" r="24" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" opacity="0.5" />
          <text x="30" y="35" textAnchor="middle" fontSize="15" fontWeight="700" fill="currentColor" opacity="0.45">
            {n}
          </text>
        </>
      )}
    </svg>
  );
}

/** The "Momo Master" badge. */
export function BadgeArt({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 80 96" aria-hidden="true" focusable="false">
      <path d="M22 54l-8 38 14-8 8 12 6-36zM58 54l8 38-14-8-8 12-6-36z" fill="#b91c1c" />
      <circle cx="40" cy="40" r="34" fill="#f59e0b" />
      <circle cx="40" cy="40" r="28" fill="#fde68a" stroke="#b45309" strokeWidth="2" />
      <g transform="translate(20 18) scale(0.62)">
        <path d="M8 44c0-14 10-26 24-30 14 4 24 16 24 30 0 6-10 10-24 10S8 50 8 44z" fill="#fffaf0" stroke="#b45309" strokeWidth="2.4" />
        <path d="M32 14c-2 6-4 12-10 18M32 14c2 6 4 12 10 18M32 14v20" stroke="#b45309" strokeWidth="2.4" fill="none" />
      </g>
      <path d="M22 62h36" stroke="#b45309" strokeWidth="2" />
    </svg>
  );
}

// ---------------- the city map ----------------

export type MapStop = { k: number; visit: Visit; state: 'left' | 'here' | 'next' | 'later' };

type MapProps = {
  stops: MapStop[];
  truck: { x: number; y: number; angle: number; moving: boolean; open: boolean };
  /** Today's legs: [from, to] place pairs, with how far the truck is along each (0–1). */
  legs: { a: PlaceId; b: PlaceId; done: number }[];
  near: PlaceId | null;
  notify: PlaceId[];
  townLabels: Record<'mainz' | 'wiesbaden' | 'darmstadt', string>;
  label: string;
  numFmt: (n: number) => string;
};

export function CityMap({ stops, truck, legs, near, notify, townLabels, label, numFmt }: MapProps) {
  const flip = Math.abs(truck.angle) > 90;
  const tStyle: CSSProperties = { transform: `translate(${truck.x}px, ${truck.y}px)` };
  return (
    <svg className="mt-map" viewBox="0 0 360 300" role="img" aria-label={label}>
      <defs>
        <pattern id="mt-blocks" width="9" height="9" patternUnits="userSpaceOnUse">
          <rect width="9" height="9" fill="#efe2c4" />
          <rect x="1" y="1" width="6" height="6" rx="1" fill="#e6d4ae" />
        </pattern>
        <pattern id="mt-fields" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
          <rect width="14" height="14" fill="#eef0d6" />
          <path d="M0 7h14" stroke="#e1e6bf" strokeWidth="3" />
        </pattern>
      </defs>
      <rect width="360" height="300" rx="18" fill="url(#mt-fields)" />
      {/* Taunus hills up north */}
      <path d="M0 0h360v26c-30 10-60-6-90 4s-58 2-88-6-60 8-92 0S30 12 0 22z" fill="#cfe0b4" />
      <path d="M0 0h360v14c-34 8-70-4-104 2s-68-2-100 0-70 6-100 0S20 6 0 10z" fill="#b9d29b" />
      {/* Odenwald to the south-east */}
      <path d="M300 300c4-30 20-40 60-50v50z" fill="#b9d29b" />
      {/* towns */}
      <ellipse cx="108" cy="64" rx="48" ry="28" fill="url(#mt-blocks)" />
      <ellipse cx="96" cy="160" rx="40" ry="26" fill="url(#mt-blocks)" />
      <ellipse cx="280" cy="222" rx="42" ry="30" fill="url(#mt-blocks)" />
      {/* parks */}
      <ellipse cx="138" cy="44" rx="12" ry="7" fill="#9fcf8f" />
      <ellipse cx="296" cy="200" rx="11" ry="7" fill="#9fcf8f" />
      {/* motorways (decorative) */}
      <path d="M0 108C80 96 180 100 360 92" stroke="#f5d48a" strokeWidth="5" fill="none" />
      <path d="M0 108C80 96 180 100 360 92" stroke="#fff7e0" strokeWidth="1.4" fill="none" strokeDasharray="5 5" />
      <path d="M210 0C215 90 230 180 236 300" stroke="#f5d48a" strokeWidth="5" fill="none" />
      <path d="M210 0C215 90 230 180 236 300" stroke="#fff7e0" strokeWidth="1.4" fill="none" strokeDasharray="5 5" />
      {/* Rhine from the south, bending west at Mainz; the Main joins from the east */}
      <path d="M170 300C160 250 140 200 124 150C112 120 70 118 0 128" stroke="#7cc4e4" strokeWidth="14" fill="none" strokeLinecap="round" />
      <path d="M360 70C300 86 230 104 196 118C170 128 146 134 128 140" stroke="#7cc4e4" strokeWidth="8" fill="none" strokeLinecap="round" />
      <path d="M170 300C160 250 140 200 124 150C112 120 70 118 0 128" stroke="#a6dbf0" strokeWidth="4" fill="none" strokeLinecap="round" />
      <text x="36" y="134" className="mt-map-river">
        Rhein
      </text>
      <text x="300" y="80" className="mt-map-river" transform="rotate(-12 300 80)">
        Main
      </text>
      <text x="108" y="24" className="mt-map-town" textAnchor="middle">
        {townLabels.wiesbaden}
      </text>
      <text x="74" y="196" className="mt-map-town" textAnchor="middle">
        {townLabels.mainz}
      </text>
      <text x="282" y="268" className="mt-map-town" textAnchor="middle">
        {townLabels.darmstadt}
      </text>
      {/* north arrow */}
      <g transform="translate(334 48)" className="mt-map-north">
        <circle r="11" fill="#fffaf0" stroke="#d6c7a1" />
        <path d="M0-8l4 9h-8z" fill="#b91c1c" />
        <text y="8" textAnchor="middle" fontSize="7" fontWeight="800" fill="#57452a">
          N
        </text>
      </g>
      {/* other stops of the week */}
      {(Object.keys(PLACES) as PlaceId[])
        .filter((p) => !stops.some((s) => s.visit.place === p))
        .map((p) => (
          <circle key={p} cx={PLACES[p].x} cy={PLACES[p].y} r="3.4" className="mt-map-other" />
        ))}
      {/* today's route */}
      {legs.map((l) => {
        const d = legPath(l.a, l.b);
        return (
          <g key={`${l.a}-${l.b}`}>
            <path d={d} className="mt-map-leg" pathLength={100} />
            {l.done > 0 && <path d={d} className="mt-map-leg-done" pathLength={100} strokeDasharray={`${l.done * 100} 100`} />}
          </g>
        );
      })}
      {stops.map((s) => {
        const p = PLACES[s.visit.place];
        return (
          <g key={s.k} className={`mt-map-stop is-${s.state}`} transform={`translate(${p.x} ${p.y})`}>
            {near === s.visit.place && <circle r="15" className="mt-map-near" />}
            <path d="M0 0c-6-8-10-12-10-17a10 10 0 0 1 20 0c0 5-4 9-10 17z" transform="translate(0 -2)" />
            <text y="-15.5" textAnchor="middle">
              {numFmt(s.k + 1)}
            </text>
            {notify.includes(s.visit.place) && (
              <g transform="translate(9 -26) scale(0.5)" className="mt-map-bell">
                <circle cx="12" cy="12" r="11" fill="#fffaf0" />
                <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" fill="#d97706" />
              </g>
            )}
          </g>
        );
      })}
      {near && !stops.some((s) => s.visit.place === near) && <circle cx={PLACES[near].x} cy={PLACES[near].y} r="11" className="mt-map-near" />}
      {/* the truck */}
      <g className={`mt-map-truck${truck.moving ? ' is-moving' : ''}`} style={tStyle}>
        <g transform={`${truck.moving ? 'translate(-17 -17)' : 'translate(5 -14)'} ${flip ? 'translate(35 0) scale(-1 1)' : ''}`}>
          <g transform="scale(0.29)">
            <TruckArt steam={truck.open && !truck.moving} />
          </g>
        </g>
      </g>
    </svg>
  );
}
