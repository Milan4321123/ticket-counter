// Drawn product pictures for "Dhaka & Dal" (/work/shop) — no photos, no
// brands: a jar, a pouch, a sack, a box, a dhaka topi, a shawl, a singing
// bowl, prayer flags, a lokta notebook, a diyo, incense and a marigold garland,
// each in one of ten colours. Plain SVG, decorative (the product name is
// always written next to it).

import type { ArtColor, ArtKind } from './shop';

export const ART_HEX: Record<ArtColor, { main: string; dark: string; light: string }> = {
  red: { main: '#c0392b', dark: '#7f2018', light: '#f2b8ae' },
  saffron: { main: '#e67e22', dark: '#9a4a0c', light: '#f9d2a8' },
  turmeric: { main: '#e2b11b', dark: '#8f6a06', light: '#f7e3a1' },
  green: { main: '#3f8f3a', dark: '#22561f', light: '#bfe0b6' },
  olive: { main: '#7d7a2c', dark: '#4a4814', light: '#dddaa6' },
  brown: { main: '#8b5a2b', dark: '#553517', light: '#e3c6a4' },
  maroon: { main: '#7b1e2b', dark: '#4a0f19', light: '#e6b3bb' },
  cream: { main: '#d9c79e', dark: '#8a7548', light: '#f6efdc' },
  indigo: { main: '#3b4a8f', dark: '#222c5c', light: '#c3caeb' },
  plum: { main: '#6d3b6b', dark: '#42213f', light: '#dcc0da' },
};

/** The small dhaka weave: diamonds in red, black and white on the colour. */
function DhakaPattern({ id, base }: { id: string; base: string }) {
  return (
    <pattern id={id} width="10" height="10" patternUnits="userSpaceOnUse">
      <rect width="10" height="10" fill={base} />
      <path d="M5 0 L10 5 L5 10 L0 5Z" fill="#1d1b1a" opacity="0.55" />
      <path d="M5 2.5 L7.5 5 L5 7.5 L2.5 5Z" fill="#f4efe6" />
      <path d="M5 4 L6 5 L5 6 L4 5Z" fill="#c0392b" />
    </pattern>
  );
}

export function ProductArt({ kind, color, size = 120, uid }: { kind: ArtKind; color: ArtColor; size?: number; uid: string }) {
  const c = ART_HEX[color] ?? ART_HEX.saffron;
  const pid = `dd-dk-${uid}`;
  return (
    <svg className="dd-art" width={size} height={size} viewBox="0 0 120 120" aria-hidden="true" focusable="false">
      <defs>
        <DhakaPattern id={pid} base={c.main} />
      </defs>
      <ellipse cx="60" cy="108" rx="38" ry="5" fill="#000" opacity="0.12" />
      {kind === 'jar' && (
        <g>
          <rect x="34" y="30" width="52" height="76" rx="12" fill="#f4f1ea" stroke="#b9b2a2" strokeWidth="2" />
          <rect x="37" y="46" width="46" height="57" rx="9" fill={c.main} />
          <circle cx="48" cy="62" r="3" fill={c.light} opacity="0.8" />
          <circle cx="66" cy="76" r="4" fill={c.dark} opacity="0.5" />
          <circle cx="56" cy="90" r="3" fill={c.light} opacity="0.7" />
          <rect x="32" y="18" width="56" height="16" rx="4" fill={c.dark} />
          <rect x="32" y="22" width="56" height="3" fill="#000" opacity="0.15" />
          <rect x="40" y="58" width="40" height="24" rx="3" fill="#fbf7ee" />
          <rect x="45" y="64" width="30" height="3" rx="1.5" fill={c.dark} />
          <rect x="48" y="71" width="24" height="3" rx="1.5" fill={c.main} />
          <path d="M40 38 q-3 30 0 60" stroke="#fff" strokeWidth="4" fill="none" opacity="0.45" strokeLinecap="round" />
        </g>
      )}
      {kind === 'packet' && (
        <g>
          <path d="M32 24 h56 l4 80 q0 4 -4 4 h-56 q-4 0 -4 -4z" fill={c.main} />
          <rect x="32" y="24" width="56" height="10" fill={c.dark} />
          <path d="M34 29 h52" stroke="#fff" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.6" />
          <rect x="40" y="46" width="40" height="34" rx="6" fill="#fbf7ee" />
          <path d="M44 70 q8 -14 16 -2 q8 -14 16 2" stroke={c.main} strokeWidth="3" fill="none" strokeLinecap="round" />
          <circle cx="60" cy="56" r="4" fill={c.dark} />
          <rect x="44" y="88" width="32" height="4" rx="2" fill={c.light} />
          <path d="M84 36 l3 64" stroke="#fff" strokeWidth="3" opacity="0.3" strokeLinecap="round" />
        </g>
      )}
      {kind === 'sack' && (
        <g>
          <path d="M30 44 q-6 30 4 56 q2 6 10 6 h32 q8 0 10 -6 q10 -26 4 -56z" fill="#d8c39a" />
          <path d="M30 44 q-6 30 4 56 q2 6 10 6 h32 q8 0 10 -6 q10 -26 4 -56z" fill="none" stroke="#9b8257" strokeWidth="2" />
          <path d="M36 52 h48 M34 64 h52 M34 76 h52 M36 88 h48" stroke="#b9a274" strokeWidth="1.2" opacity="0.7" />
          <path d="M40 44 q20 -10 40 0 l-4 -18 q-16 6 -32 0z" fill="#d8c39a" stroke="#9b8257" strokeWidth="2" />
          <path d="M42 40 q18 6 36 0" stroke={c.dark} strokeWidth="4" fill="none" strokeLinecap="round" />
          <ellipse cx="60" cy="26" rx="16" ry="5" fill={c.main} />
          <circle cx="54" cy="25" r="2" fill={c.light} />
          <circle cx="62" cy="27" r="2" fill={c.dark} />
          <circle cx="67" cy="24" r="2" fill={c.light} />
          <rect x="42" y="62" width="36" height="22" rx="4" fill={c.main} />
          <rect x="47" y="68" width="26" height="3" rx="1.5" fill="#fbf7ee" />
          <rect x="50" y="75" width="20" height="3" rx="1.5" fill="#fbf7ee" opacity="0.7" />
        </g>
      )}
      {kind === 'box' && (
        <g>
          <path d="M28 46 l32 -14 l32 14 v52 l-32 10 l-32 -10z" fill={c.main} />
          <path d="M28 46 l32 12 l32 -12" fill="none" stroke={c.dark} strokeWidth="2" />
          <path d="M60 58 v50" stroke={c.dark} strokeWidth="2" />
          <path d="M60 58 l32 -12 v52 l-32 10z" fill="#000" opacity="0.14" />
          <path d="M28 46 l32 -14 l32 14 l-32 12z" fill={c.light} />
          <rect x="34" y="66" width="20" height="20" rx="3" fill="#fbf7ee" transform="skewY(20) translate(0 -14)" />
          <circle cx="44" cy="62" r="4" fill={c.dark} />
        </g>
      )}
      {kind === 'topi' && (
        <g>
          <path d="M22 92 q-2 -36 10 -52 q28 -14 58 -4 q10 22 8 56 z" fill={`url(#${pid})`} />
          <path d="M22 92 q-2 -36 10 -52 q28 -14 58 -4 q10 22 8 56 z" fill="none" stroke="#1d1b1a" strokeWidth="2" opacity="0.6" />
          <rect x="20" y="88" width="80" height="12" rx="3" fill="#1d1b1a" />
          <path d="M32 40 q28 -10 58 -4" stroke="#fff" strokeWidth="2" fill="none" opacity="0.4" />
        </g>
      )}
      {kind === 'shawl' && (
        <g>
          <path d="M18 34 h84 v56 h-84z" fill={`url(#${pid})`} />
          <path d="M18 34 h84 v10 h-84z" fill={c.dark} />
          <path d="M18 80 h84 v10 h-84z" fill={c.dark} />
          <path d="M22 90 v12 M30 90 v12 M38 90 v12 M46 90 v12 M54 90 v12 M62 90 v12 M70 90 v12 M78 90 v12 M86 90 v12 M94 90 v12" stroke={c.dark} strokeWidth="2" strokeLinecap="round" />
          <path d="M60 34 q-12 28 0 56" stroke="#000" strokeWidth="6" fill="none" opacity="0.12" />
        </g>
      )}
      {kind === 'bowl' && (
        <g>
          <path d="M22 56 h76 q-4 40 -38 42 q-34 -2 -38 -42z" fill="#b8862e" />
          <path d="M22 56 h76 q-4 40 -38 42 q-34 -2 -38 -42z" fill="none" stroke="#6e4c12" strokeWidth="2" />
          <ellipse cx="60" cy="56" rx="38" ry="8" fill="#e2b35a" stroke="#6e4c12" strokeWidth="2" />
          <ellipse cx="60" cy="57" rx="30" ry="5" fill="#8a611b" />
          <path d="M30 70 q30 10 60 0" stroke="#f3d48c" strokeWidth="2" fill="none" opacity="0.7" />
          <rect x="70" y="18" width="10" height="44" rx="5" fill={c.main} transform="rotate(32 75 40)" />
          <rect x="70" y="18" width="10" height="12" rx="5" fill={c.dark} transform="rotate(32 75 40)" />
          <rect x="40" y="100" width="40" height="6" rx="3" fill={c.dark} />
        </g>
      )}
      {kind === 'flags' && (
        <g>
          <path d="M10 30 q50 22 100 0" stroke="#5b5348" strokeWidth="2" fill="none" />
          {[
            ['#2f6fb5', 14, 33],
            ['#f4f1ea', 34, 39],
            ['#c0392b', 54, 41],
            ['#3f8f3a', 74, 39],
            ['#e2b11b', 94, 33],
          ].map(([fill, x, y]) => (
            <g key={String(x)}>
              <rect x={Number(x) - 8} y={Number(y)} width="17" height="28" fill={String(fill)} stroke="#5b5348" strokeWidth="1" />
              <circle cx={Number(x) + 0.5} cy={Number(y) + 11} r="4" fill="none" stroke="#5b5348" strokeWidth="1" opacity="0.6" />
              <path d={`M${Number(x) - 5} ${Number(y) + 20} h11`} stroke="#5b5348" strokeWidth="1" opacity="0.6" />
            </g>
          ))}
          <path d="M10 70 q50 22 100 0" stroke="#5b5348" strokeWidth="2" fill="none" />
          {[
            ['#e2b11b', 14, 73],
            ['#3f8f3a', 34, 79],
            ['#c0392b', 54, 81],
            ['#f4f1ea', 74, 79],
            ['#2f6fb5', 94, 73],
          ].map(([fill, x, y]) => (
            <rect key={`b${x}`} x={Number(x) - 8} y={Number(y)} width="17" height="24" fill={String(fill)} stroke="#5b5348" strokeWidth="1" />
          ))}
        </g>
      )}
      {kind === 'book' && (
        <g>
          <rect x="30" y="20" width="62" height="84" rx="4" fill={c.main} />
          <rect x="30" y="20" width="10" height="84" rx="3" fill={c.dark} />
          <rect x="88" y="24" width="6" height="76" fill="#efe6d0" />
          <path d="M48 36 h34 M48 44 h28" stroke={c.light} strokeWidth="3" strokeLinecap="round" />
          <path d="M50 64 q10 -16 20 0 q-10 16 -20 0z" fill={c.light} opacity="0.85" />
          <circle cx="60" cy="64" r="3" fill={c.dark} />
          <path d="M92 60 h12 q4 0 2 6 l-4 16" stroke="#7b5a32" strokeWidth="2" fill="none" />
          <path d="M30 60 h64" stroke="#7b5a32" strokeWidth="2" />
          <path d="M42 26 q2 30 0 74" stroke="#000" strokeWidth="1" opacity="0.1" />
        </g>
      )}
      {kind === 'diyo' && (
        <g>
          <path d="M60 22 q-12 18 0 34 q12 -16 0 -34z" fill="#ffb53d" />
          <path d="M60 32 q-6 11 0 21 q6 -10 0 -21z" fill="#fff2b3" />
          <path d="M18 66 q42 -16 84 0 q-6 28 -42 30 q-36 -2 -42 -30z" fill="#b5532a" />
          <path d="M18 66 q42 -16 84 0" fill="none" stroke="#7a2f12" strokeWidth="2" />
          <ellipse cx="60" cy="64" rx="34" ry="6" fill="#7a2f12" />
          <ellipse cx="60" cy="63" rx="28" ry="4" fill={c.main} opacity="0.75" />
          <path d="M60 56 v8" stroke="#3a2a1a" strokeWidth="2" />
          <path d="M28 76 q32 12 64 0" stroke="#e99b6b" strokeWidth="2" fill="none" />
          <circle cx="40" cy="80" r="2" fill="#f6d27a" />
          <circle cx="60" cy="84" r="2" fill="#f6d27a" />
          <circle cx="80" cy="80" r="2" fill="#f6d27a" />
        </g>
      )}
      {kind === 'incense' && (
        <g>
          <path d="M46 16 q6 8 0 16 q-6 8 0 16" stroke="#9aa0a6" strokeWidth="2" fill="none" opacity="0.7" strokeLinecap="round" />
          <path d="M66 10 q-6 8 0 16 q6 8 0 16" stroke="#9aa0a6" strokeWidth="2" fill="none" opacity="0.6" strokeLinecap="round" />
          {[40, 48, 56, 64, 72, 80].map((x, i) => (
            <g key={x}>
              <path d={`M${x} ${48 - (i % 2) * 6} L${x + (i - 2.5) * 1.5} 92`} stroke={c.dark} strokeWidth="3" strokeLinecap="round" />
              <circle cx={x} cy={48 - (i % 2) * 6} r="2.5" fill="#ff7a3d" />
            </g>
          ))}
          <rect x="34" y="72" width="52" height="30" rx="5" fill={c.main} />
          <rect x="34" y="80" width="52" height="8" fill={c.light} opacity="0.8" />
          <path d="M44 84 h32" stroke={c.dark} strokeWidth="2" />
        </g>
      )}
      {kind === 'garland' && (
        <g>
          {Array.from({ length: 13 }, (_, i) => {
            const a = Math.PI * (0.05 + (0.9 * i) / 12);
            const x = 60 - 44 * Math.cos(a);
            const y = 26 + 62 * Math.sin(a);
            return (
              <g key={i}>
                <circle cx={x} cy={y} r="8.5" fill={i % 3 === 1 ? '#e2b11b' : c.main} />
                <circle cx={x} cy={y} r="5" fill={i % 3 === 1 ? '#f7e3a1' : c.light} opacity="0.7" />
                <circle cx={x} cy={y} r="2" fill={c.dark} />
              </g>
            );
          })}
          <path d="M14 26 q46 -10 92 0" stroke="#3f8f3a" strokeWidth="2" fill="none" />
          <path d="M56 22 l4 -8 l4 8" fill="#3f8f3a" />
        </g>
      )}
    </svg>
  );
}

/** The shop's mark: a little dhaka diamond. */
export function ShopMark({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" focusable="false">
      <rect width="40" height="40" rx="10" fill="#7b1e2b" />
      <path d="M20 6 L34 20 L20 34 L6 20Z" fill="#1d1b1a" />
      <path d="M20 11 L29 20 L20 29 L11 20Z" fill="#f4efe6" />
      <path d="M20 15 L25 20 L20 25 L15 20Z" fill="#e67e22" />
      <circle cx="20" cy="20" r="2" fill="#c0392b" />
    </svg>
  );
}

type IconName = 'bag' | 'search' | 'plus' | 'minus' | 'close' | 'check' | 'clock' | 'bike' | 'store' | 'scan' | 'download' | 'sound' | 'mute' | 'sun' | 'moon' | 'edit' | 'trash' | 'star' | 'alert' | 'arrow' | 'box' | 'live' | 'user';

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const p = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="dd-icon">
      {name === 'bag' && (
        <g {...p}>
          <path d="M5 8h14l-1 12H6z" />
          <path d="M9 8V6a3 3 0 0 1 6 0v2" />
        </g>
      )}
      {name === 'search' && (
        <g {...p}>
          <circle cx="11" cy="11" r="6" />
          <path d="m20 20-4.5-4.5" />
        </g>
      )}
      {name === 'plus' && <path {...p} d="M12 5v14M5 12h14" />}
      {name === 'minus' && <path {...p} d="M5 12h14" />}
      {name === 'close' && <path {...p} d="M6 6l12 12M18 6 6 18" />}
      {name === 'check' && <path {...p} d="m5 12 5 5 9-10" />}
      {name === 'clock' && (
        <g {...p}>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 8v4l3 2" />
        </g>
      )}
      {name === 'bike' && (
        <g {...p}>
          <circle cx="6" cy="16" r="3.5" />
          <circle cx="18" cy="16" r="3.5" />
          <path d="M6 16l4-7h5l3 7M10 9l3 7M14 6h3" />
        </g>
      )}
      {name === 'store' && (
        <g {...p}>
          <path d="M4 10h16v10H4zM3 10l2-5h14l2 5" />
          <path d="M10 20v-5h4v5" />
        </g>
      )}
      {name === 'scan' && (
        <g {...p}>
          <path d="M4 8V5h3M17 5h3v3M20 16v3h-3M7 19H4v-3" />
          <path d="M8 12h8" />
        </g>
      )}
      {name === 'download' && <path {...p} d="M12 4v11m-5-5 5 5 5-5M5 20h14" />}
      {name === 'sound' && (
        <g {...p}>
          <path d="M4 10h4l5-4v12l-5-4H4z" />
          <path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" />
        </g>
      )}
      {name === 'mute' && (
        <g {...p}>
          <path d="M4 10h4l5-4v12l-5-4H4z" />
          <path d="m17 10 4 4m0-4-4 4" />
        </g>
      )}
      {name === 'sun' && (
        <g {...p}>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" />
        </g>
      )}
      {name === 'moon' && <path {...p} d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />}
      {name === 'edit' && <path {...p} d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" />}
      {name === 'trash' && <path {...p} d="M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13" />}
      {name === 'star' && <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" fill="currentColor" />}
      {name === 'alert' && (
        <g {...p}>
          <path d="M12 4 3 20h18z" />
          <path d="M12 10v4M12 17v.5" />
        </g>
      )}
      {name === 'arrow' && <path {...p} d="M5 12h14m-5-5 5 5-5 5" />}
      {name === 'box' && (
        <g {...p}>
          <path d="M4 8l8-4 8 4v8l-8 4-8-4z" />
          <path d="M4 8l8 4 8-4M12 12v8" />
        </g>
      )}
      {name === 'live' && (
        <g {...p}>
          <circle cx="12" cy="12" r="2.5" fill="currentColor" />
          <path d="M7.5 7.5a6.4 6.4 0 0 0 0 9M16.5 7.5a6.4 6.4 0 0 1 0 9" />
        </g>
      )}
      {name === 'user' && (
        <g {...p}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 20c1.5-4 4.5-6 8-6s6.5 2 8 6" />
        </g>
      )}
    </svg>
  );
}
