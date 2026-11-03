// Drawn SVG for the generated sites of /work/instant — no photos, no requests.
// Pure strings (no React) so the preview, the downloaded .html and the tests
// share one picture. Every colour comes from the site's palette (already
// validated hex) or a fixed literal here; no visitor text ever goes into art.
//
// One motif per kind (a bowl of momo, a shop front, mountains with prayer
// flags, a microphone, a book, a stage, a mirror and scissors, a house, a sun
// over hills) drawn in five illustration styles: flat, line, blob, geo, stamp.

import type { KindId } from './instant';

export type Ill = 'flat' | 'line' | 'blob' | 'geo' | 'stamp';
export type IconId =
  | 'leaf'
  | 'bowl'
  | 'people'
  | 'cup'
  | 'bag'
  | 'star'
  | 'chat'
  | 'flag'
  | 'book'
  | 'heart'
  | 'music'
  | 'globe'
  | 'check'
  | 'scissors'
  | 'clock'
  | 'home'
  | 'spark';

export type ArtPal = { primary: string; accent: string; text: string; surface: string; surface2: string; bg: string; muted: string };

function hexMix(a: string, b: string, t: number): string {
  const ch = [1, 3, 5].map((k) => {
    const p = parseInt(a.slice(k, k + 2), 16);
    const q = parseInt(b.slice(k, k + 2), 16);
    return Math.round(p + (q - p) * t)
      .toString(16)
      .padStart(2, '0');
  });
  return `#${ch.join('')}`;
}

type Role = 'main' | 'second' | 'light' | 'ink' | 'soft';
/**
 * p: filled path · c: circle "cx cy r" · r: rect "x y w h rx" · e: ellipse "cx cy rx ry"
 * s: stroke-only path (4th = width) · d: a dot that stays filled even in line mode
 */
type El = [kind: 'p' | 'c' | 'r' | 'e' | 's' | 'd', geom: string, role: Role, width?: string];

function sparkle(cx: number, cy: number, R: number): string {
  return `M${cx} ${cy - R} Q${cx} ${cy} ${cx + R} ${cy} Q${cx} ${cy} ${cx} ${cy + R} Q${cx} ${cy} ${cx - R} ${cy} Q${cx} ${cy} ${cx} ${cy - R} Z`;
}
function star5(cx: number, cy: number, R: number, r: number): string {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const rad = i % 2 === 0 ? R : r;
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    return `${(cx + Math.cos(a) * rad).toFixed(1)} ${(cy + Math.sin(a) * rad).toFixed(1)}`;
  });
  return `M${pts.join(' L')} Z`;
}

const FLAG_AT: [number, number][] = [
  [33, 53],
  [53, 60],
  [74, 65],
  [94, 66],
  [115, 65],
  [135, 60],
  [155, 53],
];
const FLAG_ROLES: Role[] = ['main', 'second', 'light', 'soft', 'main', 'second', 'light'];

/** The kind's motif in a 200 × 200 box. */
const MOTIF: Record<KindId, El[]> = {
  restaurant: [
    ['s', 'M78 62 c-12 -14 12 -22 0 -38', 'ink', '4'],
    ['s', 'M100 56 c-12 -14 12 -22 0 -38', 'ink', '4'],
    ['s', 'M122 62 c-12 -14 12 -22 0 -38', 'ink', '4'],
    ['p', 'M52 106 C52 78 92 78 92 106 Z', 'light'],
    ['p', 'M82 106 C82 70 124 70 124 106 Z', 'light'],
    ['p', 'M114 106 C114 80 150 80 150 106 Z', 'light'],
    ['s', 'M72 86 v12 M103 82 v14 M132 88 v11', 'ink', '2.5'],
    ['r', '22 100 156 14 7', 'second'],
    ['p', 'M30 114 H170 C170 152 140 176 100 176 C60 176 30 152 30 114 Z', 'main'],
    ['r', '74 174 52 10 5', 'main'],
  ],
  shop: [
    ['r', '40 84 120 92 4', 'light'],
    ['r', '34 42 132 24 4', 'main'],
    ['s', 'M70 54 H130', 'light', '4'],
    ['r', '30 66 140 16 2', 'second'],
    ...Array.from({ length: 7 }, (_, i) => ['c', `${40 + i * 20} 84 10`, i % 2 ? 'main' : 'second'] as El),
    ['r', '52 112 40 64 3', 'main'],
    ['d', '84 146 3', 'light'],
    ['r', '106 108 44 34 3', 'soft'],
    ['d', '118 130 6', 'second'],
    ['d', '136 127 7', 'main'],
    ['s', 'M32 177 H168', 'ink', '4'],
  ],
  verein: [
    ['p', 'M14 176 L72 86 L98 122 L134 58 L190 176 Z', 'main'],
    ['p', 'M134 58 L148 82 L140 78 L132 88 L124 80 Z', 'light'],
    ['p', 'M72 86 L82 102 L74 99 L68 106 L63 101 Z', 'light'],
    ['s', 'M16 44 Q100 92 186 36', 'ink', '2.5'],
    ...FLAG_AT.map(([x, y], i) => ['r', `${x - 7} ${y} 14 18 1`, FLAG_ROLES[i]] as El),
  ],
  artist: [
    ['s', 'M100 118 V170 M74 172 H126', 'ink', '5'],
    ['s', 'M68 86 a32 32 0 0 0 64 0', 'ink', '5'],
    ['r', '80 34 40 72 20', 'main'],
    ['s', 'M86 56 H114 M86 68 H114 M86 80 H114', 'light', '2.5'],
    ['s', 'M154 42 V92 M154 42 L176 36 V84', 'ink', '4'],
    ['e', '146 94 10 8', 'second'],
    ['e', '168 86 10 8', 'second'],
    ['s', 'M38 72 V114', 'ink', '4'],
    ['e', '30 116 10 8', 'second'],
  ],
  tutor: [
    ['p', 'M100 74 C80 60 50 60 26 70 V156 C50 146 80 146 100 160 Z', 'light'],
    ['p', 'M100 74 C120 60 150 60 174 70 V156 C150 146 120 146 100 160 Z', 'light'],
    ['s', 'M100 74 V160', 'ink', '3'],
    ['s', 'M40 92 C60 86 76 86 90 92 M40 108 C60 102 76 102 90 108 M40 124 C60 118 76 118 90 124', 'main', '3'],
    ['s', 'M110 92 C124 86 140 86 160 92 M110 108 C124 102 140 102 160 108', 'main', '3'],
    ['p', 'M140 18 L164 42 L108 98 L84 104 L90 80 Z', 'second'],
    ['p', 'M84 104 L90 80 L108 98 Z', 'light'],
    ['d', '86 102 3', 'ink'],
  ],
  event: [
    ['r', '24 150 152 26 4', 'main'],
    ['s', 'M34 150 V80 Q100 22 166 80 V150', 'main', '8'],
    ['s', 'M42 86 Q100 122 158 86', 'ink', '2'],
    ['d', '54 95 5', 'second'],
    ['d', '74 104 5', 'light'],
    ['d', '94 108 5', 'second'],
    ['d', '114 107 5', 'light'],
    ['d', '134 102 5', 'second'],
    ['d', '150 93 5', 'light'],
    ['p', star5(100, 62, 16, 7), 'second'],
    ['c', '82 128 8', 'ink'],
    ['p', 'M70 150 Q82 128 94 150 Z', 'ink'],
    ['c', '118 128 8', 'ink'],
    ['p', 'M106 150 Q118 128 130 150 Z', 'ink'],
  ],
  salon: [
    ['s', 'M70 136 V178 M54 178 H86', 'ink', '6'],
    ['c', '70 86 50', 'main'],
    ['c', '70 86 40', 'light'],
    ['s', 'M48 76 L66 58', 'soft', '5'],
    ['s', 'M132 140 L170 52 M168 140 L130 52', 'ink', '6'],
    ['c', '128 154 12', 'second'],
    ['c', '172 154 12', 'second'],
    ['d', '128 154 5', 'light'],
    ['d', '172 154 5', 'light'],
    ['d', '150 98 4', 'ink'],
  ],
  handy: [
    ['p', 'M30 104 L94 52 L158 104 Z', 'second'],
    ['r', '42 100 104 76 3', 'light'],
    ['r', '80 128 28 48 3', 'main'],
    ['r', '52 114 22 20 2', 'soft'],
    ['r', '116 114 22 20 2', 'soft'],
    ['r', '158 112 26 64 6', 'main'],
    ['p', 'M162 112 L162 98 L180 98 L188 104 L180 104 L180 112 Z', 'second'],
    ['s', 'M192 94 l6 -4 M194 103 h8 M192 112 l6 4', 'ink', '2.5'],
    ['p', sparkle(34, 42, 12), 'second'],
  ],
  other: [
    ['c', '132 70 30', 'second'],
    ['p', 'M10 176 C50 110 90 110 120 150 C140 126 170 120 196 140 V176 Z', 'main'],
    ['p', 'M10 176 C40 146 70 140 100 160 C130 176 160 166 196 168 V176 Z', 'soft'],
    ['p', sparkle(52, 56, 14), 'second'],
    ['p', sparkle(90, 32, 8), 'main'],
  ],
};

type Cols = Record<Role, string>;

function cols(p: ArtPal): Cols {
  return { main: p.primary, second: p.accent, light: '#fff9ef', ink: p.text, soft: p.surface2 };
}

function render(els: El[], ill: Ill, c: Cols): string {
  const line = ill === 'line';
  const outline = ill === 'blob' || ill === 'geo' || ill === 'stamp';
  const sw = outline ? 2.5 : 3;
  return els
    .map(([k, g, role, width]) => {
      const n = g.split(' ').map(Number);
      if (k === 's') return `<path d="${g}" fill="none" stroke="${c[role]}" stroke-width="${width ?? 4}" stroke-linecap="round" stroke-linejoin="round"/>`;
      if (k === 'd') return `<circle cx="${n[0]}" cy="${n[1]}" r="${n[2]}" fill="${c[role]}"/>`;
      const paint = line ? `fill="none" stroke="${c.ink}" stroke-width="${sw}" stroke-linejoin="round"` : outline ? `fill="${c[role]}" stroke="${c.ink}" stroke-width="${sw}" stroke-linejoin="round"` : role === 'light' ? `fill="${c[role]}" stroke="${c.ink}" stroke-width="2" stroke-linejoin="round"` : `fill="${c[role]}"`;
      if (k === 'p') return `<path d="${g}" ${paint}/>`;
      if (k === 'c') return `<circle cx="${n[0]}" cy="${n[1]}" r="${n[2]}" ${paint}/>`;
      if (k === 'e') return `<ellipse cx="${n[0]}" cy="${n[1]}" rx="${n[2]}" ry="${n[3]}" ${paint}/>`;
      return `<rect x="${n[0]}" y="${n[1]}" width="${n[2]}" height="${n[3]}" rx="${n[4] ?? 0}" ${paint}/>`;
    })
    .join('');
}

const BLOB = 'M196 34 C262 26 330 62 346 128 C362 196 322 270 248 288 C176 306 92 286 62 222 C34 162 52 96 104 62 C130 44 162 38 196 34 Z';

function backdrop(ill: Ill, p: ArtPal, w: number, h: number): string {
  const cx = w / 2;
  const cy = h / 2;
  const R = Math.min(w, h) * 0.42;
  switch (ill) {
    case 'flat':
      return (
        `<circle cx="${cx}" cy="${cy}" r="${R}" fill="${p.surface2}"/>` +
        `<circle cx="${w * 0.82}" cy="${h * 0.22}" r="${R * 0.17}" fill="${p.accent}" opacity=".85"/>` +
        `<ellipse cx="${cx}" cy="${h * 0.9}" rx="${R * 0.95}" ry="${R * 0.08}" fill="${p.surface2}"/>`
      );
    case 'line':
      return (
        `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${p.muted}" stroke-opacity=".35" stroke-width="1.5"/>` +
        `<circle cx="${cx}" cy="${cy}" r="${R * 0.78}" fill="none" stroke="${p.accent}" stroke-opacity=".6" stroke-width="1.5" stroke-dasharray="3 7"/>` +
        `<path d="M${w * 0.1} ${h * 0.9} H${w * 0.9}" stroke="${p.muted}" stroke-opacity=".5" stroke-width="2" stroke-dasharray="2 8" stroke-linecap="round"/>`
      );
    case 'blob':
      return (
        `<g transform="scale(${w / 400} ${h / 320})"><path d="${BLOB}" fill="${p.surface2}"/>` +
        `<path d="${BLOB}" fill="${p.accent}" opacity=".22" transform="translate(300 40) scale(.24)"/></g>`
      );
    case 'geo': {
      let dots = '';
      for (let y = 14; y < h; y += 24) for (let x = 14; x < w; x += 24) dots += `<circle cx="${x}" cy="${y}" r="1.8"/>`;
      return (
        `<g fill="${p.muted}" opacity=".3">${dots}</g>` +
        `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${p.accent}" stroke-width="3"/>` +
        `<rect x="${w * 0.08}" y="${h * 0.62}" width="${R * 0.45}" height="${R * 0.45}" fill="none" stroke="${p.primary}" stroke-width="3" transform="rotate(18 ${w * 0.08 + R * 0.22} ${h * 0.62 + R * 0.22})"/>`
      );
    }
    case 'stamp': {
      const rays = Array.from({ length: 24 }, (_, i) => {
        const a = (i * Math.PI) / 12;
        return `M${(cx + Math.cos(a) * R * 1.04).toFixed(1)} ${(cy + Math.sin(a) * R * 1.04).toFixed(1)} L${(cx + Math.cos(a) * R * 1.14).toFixed(1)} ${(cy + Math.sin(a) * R * 1.14).toFixed(1)}`;
      }).join(' ');
      return (
        `<path d="${rays}" stroke="${p.accent}" stroke-width="4" stroke-linecap="round"/>` +
        `<circle cx="${cx}" cy="${cy}" r="${R}" fill="${p.surface2}"/>` +
        `<circle cx="${cx}" cy="${cy}" r="${R * 0.9}" fill="none" stroke="${p.primary}" stroke-width="2" stroke-dasharray="6 5"/>`
      );
    }
  }
}

const SVG_OPEN = (w: number, h: number) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true" focusable="false">`;

/** The hero picture: a backdrop in the style's manner and the kind's motif. */
export function heroArt(kind: KindId, ill: Ill, p: ArtPal): string {
  return `${SVG_OPEN(400, 320)}<rect width="400" height="320" fill="${p.surface}"/>${backdrop(ill, p, 400, 320)}<g transform="translate(90 50) scale(1.1)">${render(MOTIF[kind], ill, cols(p))}</g></svg>`;
}

const TILE_ICONS: Record<KindId, IconId[]> = {
  restaurant: ['bowl', 'cup', 'leaf', 'heart'],
  shop: ['bag', 'leaf', 'cup', 'star'],
  verein: ['flag', 'people', 'heart', 'star'],
  artist: ['music', 'star', 'heart', 'globe'],
  tutor: ['book', 'globe', 'check', 'music'],
  event: ['star', 'music', 'people', 'spark'],
  salon: ['scissors', 'spark', 'heart', 'leaf'],
  handy: ['home', 'check', 'spark', 'clock'],
  other: ['spark', 'heart', 'globe', 'star'],
};

/** One picture in the gallery (300 × 220), varied by its place. */
export function tileArt(kind: KindId, i: number, ill: Ill, p: ArtPal): string {
  const grounds = [p.surface2, hexMix(p.accent, p.surface, 0.72), hexMix(p.primary, p.surface, 0.8)];
  const bg = grounds[i % 3];
  const c = cols(p);
  let inner = '';
  switch (i % 4) {
    case 0:
      inner = `<g transform="translate(80 20) scale(.9)">${render(MOTIF[kind], ill, c)}</g>`;
      break;
    case 1: {
      const icon = TILE_ICONS[kind][(i >> 2) % 4];
      inner =
        `<circle cx="150" cy="110" r="70" fill="${p.surface}" opacity=".8"/>` +
        `<g transform="translate(102 62) scale(4)">${iconPaths(icon, p.primary, 1.6)}</g>` +
        `<circle cx="48" cy="44" r="14" fill="${p.accent}" opacity=".7"/><circle cx="256" cy="182" r="20" fill="${p.primary}" opacity=".35"/>`;
      break;
    }
    case 2:
      inner =
        `<path d="M0 220 V150 Q75 90 150 150 T300 150 V220 Z" fill="${p.primary}" opacity=".85"/>` +
        `<path d="M0 220 V178 Q75 140 150 178 T300 178 V220 Z" fill="${p.accent}" opacity=".7"/>` +
        `<circle cx="226" cy="64" r="26" fill="${p.surface}"/>` +
        `<g transform="translate(36 34) scale(2.4)">${iconPaths(TILE_ICONS[kind][(i + 1) % 4], p.text, 1.6)}</g>`;
      break;
    default: {
      inner = `<g transform="scale(.75)">${backdrop(ill, p, 400, 293)}</g><g transform="translate(100 34) scale(.76)">${render(MOTIF[kind], ill, c)}</g>`;
    }
  }
  return `${SVG_OPEN(300, 220)}<rect width="300" height="220" fill="${bg}"/>${inner}</svg>`;
}

const SKIN = ['#8d5524', '#c68642', '#e0ac69', '#f1c27d', '#a0662f'];
const HAIR = ['#1b1b1b', '#3b2416', '#5a3a22', '#2a1a10'];

/** A friendly drawn face (96 × 96) for the team section; `a` picks the look. */
export function avatarSvg(a: number, p: ArtPal): string {
  const bg = [p.surface2, hexMix(p.primary, p.surface, 0.8), hexMix(p.accent, p.surface, 0.75)][a % 3];
  const skin = SKIN[(a >> 2) % SKIN.length];
  const hair = HAIR[(a >> 3) % HAIR.length];
  const shirt = a % 2 ? p.primary : p.accent;
  const style = (a >> 1) % 4;
  const short = 'M30 40 C30 20 66 20 66 40 C62 31 52 27 44 29 C38 31 33 35 30 40 Z';
  const hairPath =
    style === 0
      ? `<path d="${short}" fill="${hair}"/>`
      : style === 1
        ? `<path d="M28 46 C24 16 72 16 68 46 L70 70 C64 66 62 58 62 48 C58 36 38 36 34 48 C34 58 32 66 26 70 Z" fill="${hair}"/>`
        : style === 2
          ? `<circle cx="48" cy="19" r="8" fill="${hair}"/><path d="${short}" fill="${hair}"/>`
          : `<path d="M30 36 L34 18 H62 L66 36 Z" fill="${p.accent}"/><path d="M38 24 l4 4 4 -4 4 4 4 -4 4 4" fill="none" stroke="${p.surface}" stroke-width="1.6"/>`;
  return (
    `${SVG_OPEN(96, 96)}<rect width="96" height="96" fill="${bg}"/>` +
    `<path d="M16 98 C16 74 30 64 48 64 C66 64 80 74 80 98 Z" fill="${shirt}"/>` +
    `<rect x="42" y="54" width="12" height="14" rx="5" fill="${skin}"/>` +
    `<circle cx="48" cy="42" r="18" fill="${skin}"/>` +
    hairPath +
    `<circle cx="41" cy="44" r="1.9" fill="#1b1b1b"/><circle cx="55" cy="44" r="1.9" fill="#1b1b1b"/>` +
    `<path d="M42 51 Q48 55 54 51" fill="none" stroke="#1b1b1b" stroke-width="1.8" stroke-linecap="round"/>` +
    `</svg>`
  );
}

/** A made-up street map with a pin (no real place, no request). */
export function mapSvg(p: ArtPal): string {
  const block = hexMix(p.surface2, p.text, 0.08);
  const park = hexMix('#3c9a5f', p.surface2, 0.55);
  const river = hexMix(p.accent, p.surface2, 0.6);
  return (
    `${SVG_OPEN(480, 260)}<rect width="480" height="260" fill="${p.surface2}"/>` +
    `<rect x="20" y="20" width="120" height="70" rx="6" fill="${block}"/><rect x="170" y="20" width="110" height="70" rx="6" fill="${park}"/>` +
    `<rect x="310" y="20" width="150" height="70" rx="6" fill="${block}"/><rect x="20" y="120" width="120" height="120" rx="6" fill="${block}"/>` +
    `<rect x="170" y="120" width="110" height="50" rx="6" fill="${block}"/><rect x="310" y="120" width="150" height="120" rx="6" fill="${block}"/>` +
    `<path d="M-10 214 C80 190 150 236 250 206 S420 180 490 200" fill="none" stroke="${river}" stroke-width="18"/>` +
    `<path d="M0 105 H480 M155 0 V260 M295 0 V260" stroke="${p.surface}" stroke-width="14"/>` +
    `<path d="M226 146 c0 -22 32 -22 32 0 c0 16 -16 32 -16 32 s-16 -16 -16 -32 z" fill="${p.primary}" stroke="${p.surface}" stroke-width="3"/>` +
    `<circle cx="242" cy="146" r="6" fill="${p.surface}"/>` +
    `</svg>`
  );
}

const ICON: Record<IconId, string> = {
  leaf: 'M5 19c0-8 6-14 14-14 0 8-6 14-14 14z M5 19l8-8',
  bowl: 'M3 11h18a9 7 0 0 1-18 0z M8 7c-1-1 1-2 0-3 M12 7c-1-1 1-2 0-3 M16 7c-1-1 1-2 0-3',
  people: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6 M16 11a2.5 2.5 0 1 0 0-5 M17 14c2.4.4 4 2.6 4 5',
  cup: 'M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z M16 10h2a2.5 2.5 0 0 1 0 5h-2 M8 3c-1 1 1 2 0 3 M12 3c-1 1 1 2 0 3',
  bag: 'M5 8h14l-1 12H6z M9 8V6a3 3 0 0 1 6 0v2',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
  chat: 'M4 5h16v10H9l-5 4z',
  flag: 'M5 21V4 M5 4h12l-2 4 2 4H5',
  book: 'M4 5c3-1 6-1 8 1v14c-2-2-5-2-8-1z M20 5c-3-1-6-1-8 1v14c2-2 5-2 8-1z',
  heart: 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z',
  music: 'M9 18V5l11-2v13 M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0z M20 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M3 12h18 M12 3c3 3 3 15 0 18 M12 3c-3 3-3 15 0 18',
  check: 'M4 12l5 5L20 6',
  scissors: 'M9 6.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z M9 17.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z M8.5 8L20 18 M8.5 16L20 6',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 7v5l3 2',
  home: 'M3 11l9-7 9 7 M5 10v10h14V10 M10 20v-6h4v6',
  spark: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z M19 3v3 M17.5 4.5h3',
};

function iconPaths(id: IconId, color: string, width = 2): string {
  return `<path d="${ICON[id]}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
}

/** A 24 × 24 line icon. */
export function iconSvg(id: IconId, color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">${iconPaths(id, color)}</svg>`;
}
