// Drawn pictures for "Ka Kha Ga": Habre, an original little red panda (हाब्रे
// is the Nepali name for the animal), his twelve stickers, and one small
// picture per example word. Plain SVG, made for this page — no clip art, no
// existing characters.

import type { ReactNode } from 'react';
import type { PicId, StickerId } from './abc';

// ---------- Habre the red panda ----------

const FUR = '#d65a1f';
const FUR_DARK = '#a8410f';
const BELLY = '#3b2117';
const CREAM = '#fff6ea';

type Pose = 'stand' | 'wave' | 'cheer' | 'hold';

export function Mascot({
  size = 96,
  pose = 'stand',
  sleepy = false,
  label,
  className,
}: {
  size?: number;
  pose?: Pose;
  sleepy?: boolean;
  label?: string;
  className?: string;
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 120 120"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <HabreBody pose={pose} sleepy={sleepy} />
    </svg>
  );
}

function HabreBody({ pose, sleepy }: { pose: Pose; sleepy?: boolean }) {
  return (
    <g>
      {/* striped tail */}
      <path d="M78 96 C100 98 112 84 106 66 C103 58 96 60 98 68 C101 80 92 88 76 86 Z" fill={FUR} />
      <path d="M103 64 C99 62 97 66 98 68 L104 70 C106 68 106 65 103 64 Z M101 77 L107 79 M95 86 L101 90 M87 90 L90 95" stroke={FUR_DARK} strokeWidth="4.5" strokeLinecap="round" fill="none" />
      {/* body and legs */}
      <ellipse cx="60" cy="90" rx="25" ry="21" fill={FUR} />
      <ellipse cx="60" cy="96" rx="15" ry="14" fill={BELLY} />
      <ellipse cx="47" cy="110" rx="8" ry="6" fill={BELLY} />
      <ellipse cx="73" cy="110" rx="8" ry="6" fill={BELLY} />
      {/* arms */}
      {pose === 'wave' ? (
        <>
          <path d="M38 84 C30 76 26 66 28 58" stroke={BELLY} strokeWidth="10" strokeLinecap="round" fill="none" />
          <circle cx="28" cy="56" r="6.5" fill={BELLY} />
          <path d="M82 84 C86 92 84 98 80 100" stroke={BELLY} strokeWidth="10" strokeLinecap="round" fill="none" />
        </>
      ) : pose === 'cheer' ? (
        <>
          <path d="M38 84 C30 74 26 64 26 56" stroke={BELLY} strokeWidth="10" strokeLinecap="round" fill="none" />
          <path d="M82 84 C90 74 94 64 94 56" stroke={BELLY} strokeWidth="10" strokeLinecap="round" fill="none" />
          <circle cx="26" cy="54" r="6.5" fill={BELLY} />
          <circle cx="94" cy="54" r="6.5" fill={BELLY} />
        </>
      ) : pose === 'hold' ? (
        <>
          <path d="M38 84 C40 92 46 96 52 96" stroke={BELLY} strokeWidth="10" strokeLinecap="round" fill="none" />
          <path d="M82 84 C80 92 74 96 68 96" stroke={BELLY} strokeWidth="10" strokeLinecap="round" fill="none" />
        </>
      ) : (
        <>
          <path d="M38 84 C34 92 36 98 40 100" stroke={BELLY} strokeWidth="10" strokeLinecap="round" fill="none" />
          <path d="M82 84 C86 92 84 98 80 100" stroke={BELLY} strokeWidth="10" strokeLinecap="round" fill="none" />
        </>
      )}
      {/* ears */}
      <path d="M24 38 C20 18 30 12 44 22 Z" fill={FUR} />
      <path d="M96 38 C100 18 90 12 76 22 Z" fill={FUR} />
      <path d="M27 33 C25 21 31 18 40 24 Z" fill={CREAM} />
      <path d="M93 33 C95 21 89 18 80 24 Z" fill={CREAM} />
      <path d="M29 31 C28 24 32 22 37 25 Z" fill={BELLY} />
      <path d="M91 31 C92 24 88 22 83 25 Z" fill={BELLY} />
      {/* head */}
      <ellipse cx="60" cy="50" rx="35" ry="28" fill={FUR} />
      {/* white face patches */}
      <ellipse cx="41" cy="62" rx="13" ry="10" fill={CREAM} />
      <ellipse cx="79" cy="62" rx="13" ry="10" fill={CREAM} />
      <ellipse cx="60" cy="64" rx="12" ry="10" fill={CREAM} />
      <ellipse cx="45" cy="38" rx="6" ry="3.6" fill={CREAM} transform="rotate(-14 45 38)" />
      <ellipse cx="75" cy="38" rx="6" ry="3.6" fill={CREAM} transform="rotate(14 75 38)" />
      {/* tear marks */}
      <path d="M45 53 C44 59 46 66 50 70" stroke={FUR_DARK} strokeWidth="3.4" strokeLinecap="round" fill="none" />
      <path d="M75 53 C76 59 74 66 70 70" stroke={FUR_DARK} strokeWidth="3.4" strokeLinecap="round" fill="none" />
      {/* eyes */}
      {sleepy ? (
        <>
          <path d="M41 50 C44 53 49 53 52 50" stroke={BELLY} strokeWidth="3" strokeLinecap="round" fill="none" />
          <path d="M68 50 C71 53 76 53 79 50" stroke={BELLY} strokeWidth="3" strokeLinecap="round" fill="none" />
        </>
      ) : (
        <>
          <circle cx="47" cy="49" r="5" fill={BELLY} />
          <circle cx="73" cy="49" r="5" fill={BELLY} />
          <circle cx="48.6" cy="47.2" r="1.7" fill="#fff" />
          <circle cx="74.6" cy="47.2" r="1.7" fill="#fff" />
        </>
      )}
      {/* nose, mouth, cheeks */}
      <ellipse cx="60" cy="58" rx="4.2" ry="3" fill={BELLY} />
      <path d="M60 61 L60 64 M54 64 C56 67 59 67 60 64 C61 67 64 67 66 64" stroke={BELLY} strokeWidth="2" strokeLinecap="round" fill="none" />
      <circle cx="36" cy="60" r="3.6" fill="#ff8f8f" opacity="0.55" />
      <circle cx="84" cy="60" r="3.6" fill="#ff8f8f" opacity="0.55" />
    </g>
  );
}

// ---------- stickers ----------

const STICKER_BG: Record<StickerId, string> = {
  hello: '#ffe08a',
  topi: '#bfe3ff',
  kite: '#c9f2d4',
  book: '#ffd3e2',
  momo: '#fff0c7',
  star: '#d9d2ff',
  madal: '#ffd9b8',
  balloon: '#c7ecff',
  garland: '#ffe3a3',
  mountain: '#d6ecff',
  moon: '#28305e',
  crown: '#fff3b0',
};

const POSE: Partial<Record<StickerId, Pose>> = {
  hello: 'wave',
  kite: 'wave',
  book: 'hold',
  momo: 'hold',
  star: 'cheer',
  madal: 'hold',
  balloon: 'wave',
  crown: 'cheer',
};

function StickerBack({ id }: { id: StickerId }): ReactNode {
  switch (id) {
    case 'mountain':
      return (
        <>
          <path d="M-2 92 L30 40 L52 70 L74 30 L122 92 Z" fill="#8fb3d9" />
          <path d="M30 40 L38 53 L33 51 L28 56 L24 50 Z M74 30 L84 46 L78 44 L72 50 L67 42 Z" fill="#fff" />
        </>
      );
    case 'moon':
      return (
        <>
          <path d="M98 14 A14 14 0 1 0 108 36 A11 11 0 1 1 98 14 Z" fill="#ffe28a" />
          <circle cx="18" cy="20" r="1.8" fill="#fff" />
          <circle cx="30" cy="10" r="1.3" fill="#fff" />
          <circle cx="86" cy="50" r="1.4" fill="#fff" />
          <text x="18" y="46" fontSize="13" fontWeight="800" fill="#fff" fontFamily="sans-serif">
            z z
          </text>
        </>
      );
    case 'kite':
      return (
        <>
          <path d="M92 6 L108 22 L92 38 L76 22 Z" fill="#e23d3d" />
          <path d="M92 6 L92 38 M76 22 L108 22" stroke="#fff" strokeWidth="1.6" />
          <path d="M92 38 C86 46 60 40 30 58" stroke="#5a4a3a" strokeWidth="1.3" fill="none" />
          <path d="M92 38 l-3 6 l5 0 z" fill="#f2b705" />
        </>
      );
    case 'balloon':
      return (
        <>
          <path d="M28 56 L18 30 M28 56 L32 24 M28 56 L44 32" stroke="#5a4a3a" strokeWidth="1.2" fill="none" />
          <ellipse cx="17" cy="22" rx="9" ry="11" fill="#e84393" />
          <ellipse cx="33" cy="15" rx="9" ry="11" fill="#1f7ae0" />
          <ellipse cx="47" cy="24" rx="9" ry="11" fill="#f2b705" />
        </>
      );
    case 'star':
      return <path d="M96 8 L101 20 L114 21 L104 29 L107 42 L96 35 L85 42 L88 29 L78 21 L91 20 Z" fill="#f5b70a" stroke="#c98a00" strokeWidth="1.5" strokeLinejoin="round" />;
    default:
      return null;
  }
}

function StickerFront({ id }: { id: StickerId }): ReactNode {
  switch (id) {
    case 'topi':
      return (
        <>
          <path d="M34 28 L38 8 L84 10 L86 28 C70 22 50 22 34 28 Z" fill="#7a2e2e" />
          <path d="M36 21 L85 22 M37 15 L84 16" stroke="#e8b04a" strokeWidth="2.2" />
          <path d="M44 10 l3 11 M54 10 l3 11 M64 10.5 l3 11 M74 11 l3 11" stroke="#2d6a8f" strokeWidth="2" />
        </>
      );
    case 'book':
      return (
        <>
          <path d="M34 86 L60 92 L86 86 L86 108 L60 114 L34 108 Z" fill="#fff" stroke="#3b3fb6" strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M60 92 L60 114" stroke="#3b3fb6" strokeWidth="2.5" />
          <text x="40" y="106" fontSize="12" fontWeight="800" fill="#e23d3d" fontFamily="sans-serif">
            क
          </text>
          <text x="66" y="106" fontSize="12" fontWeight="800" fill="#1f7ae0" fontFamily="sans-serif">
            ख
          </text>
        </>
      );
    case 'momo':
      return (
        <>
          <ellipse cx="60" cy="104" rx="28" ry="8" fill="#fff" stroke="#c9b28a" strokeWidth="2" />
          {[44, 60, 76].map((x) => (
            <g key={x}>
              <path d={`M${x - 9} 102 C${x - 9} 90 ${x + 9} 90 ${x + 9} 102 Z`} fill="#fbf3e0" stroke="#d8c39a" strokeWidth="1.5" />
              <path d={`M${x - 4} 93 C${x - 2} 96 ${x + 2} 96 ${x + 4} 93`} stroke="#d8c39a" strokeWidth="1.3" fill="none" />
            </g>
          ))}
        </>
      );
    case 'madal':
      return (
        <>
          <path d="M30 92 C30 84 90 84 90 92 L90 104 C90 112 30 112 30 104 Z" fill="#8a4b22" />
          <ellipse cx="30" cy="98" rx="5" ry="10" fill="#3b2117" />
          <ellipse cx="90" cy="98" rx="5" ry="10" fill="#3b2117" />
          <path d="M38 88 L52 108 M52 88 L66 108 M66 88 L80 108" stroke="#f2d39a" strokeWidth="1.6" />
        </>
      );
    case 'garland':
      return (
        <>
          {Array.from({ length: 9 }, (_, i) => {
            const a = Math.PI * (0.12 + (0.76 * i) / 8);
            return <circle key={i} cx={60 - 26 * Math.cos(a)} cy={74 + 16 * Math.sin(a)} r="5" fill={i % 2 ? '#ff9f1a' : '#f2b705'} stroke="#c96a00" strokeWidth="1" />;
          })}
        </>
      );
    case 'crown':
      return (
        <>
          <path d="M36 26 L38 6 L49 16 L60 2 L71 16 L82 6 L84 26 Z" fill="#f5b70a" stroke="#c98a00" strokeWidth="2" strokeLinejoin="round" />
          <circle cx="60" cy="18" r="6" fill="#e23d3d" />
        </>
      );
    default:
      return null;
  }
}

export function Sticker({ id, size = 110, locked = false, label }: { id: StickerId; size?: number; locked?: boolean; label?: string }) {
  if (locked)
    return (
      <svg width={size} height={size} viewBox="0 0 120 120" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
        <circle cx="60" cy="60" r="56" fill="#eef0f6" stroke="#c9cee0" strokeWidth="3" strokeDasharray="8 7" />
        <text x="60" y="75" textAnchor="middle" fontSize="44" fontWeight="800" fill="#a4abc4" fontFamily="sans-serif">
          ?
        </text>
      </svg>
    );
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <defs>
        <clipPath id={`abst-${id}`}>
          <circle cx="60" cy="60" r="54" />
        </clipPath>
      </defs>
      <circle cx="60" cy="60" r="58" fill="#fff" />
      <g clipPath={`url(#abst-${id})`}>
        <rect width="120" height="120" fill={STICKER_BG[id]} />
        <StickerBack id={id} />
        <g transform="translate(6 10) scale(0.9)">
          <HabreBody pose={POSE[id] ?? 'stand'} sleepy={id === 'moon'} />
          <StickerFront id={id} />
        </g>
      </g>
      <circle cx="60" cy="60" r="56" fill="none" stroke="rgba(0,0,0,0.12)" strokeWidth="2" />
    </svg>
  );
}

// ---------- word pictures ----------

const K = '#2b2440';
const sw = { stroke: K, strokeWidth: 2.2, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };

const PICS: Record<PicId, ReactNode> = {
  pomegranate: (
    <>
      <circle cx="32" cy="36" r="20" fill="#d7263d" {...sw} />
      <path d="M26 17 L28 12 L32 16 L36 12 L38 17" fill="#a3172b" {...sw} />
      <circle cx="26" cy="32" r="4" fill="#fff" opacity="0.35" />
    </>
  ),
  mango: (
    <>
      <path d="M18 40 C14 22 32 12 44 18 C56 26 50 50 34 52 C26 53 20 48 18 40 Z" fill="#ffb627" {...sw} />
      <path d="M40 18 C42 12 46 10 50 10" fill="none" {...sw} />
      <path d="M44 14 C52 8 58 14 56 18 C50 20 46 18 44 14 Z" fill="#3fa34d" {...sw} />
      <path d="M24 30 C26 26 30 24 32 24" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity="0.6" fill="none" />
    </>
  ),
  well: (
    <>
      <path d="M14 22 L32 10 L50 22 Z" fill="#c0392b" {...sw} />
      <path d="M18 22 L18 40 M46 22 L46 40" fill="none" {...sw} />
      <path d="M32 22 L32 32" fill="none" stroke={K} strokeWidth="1.5" />
      <rect x="28" y="32" width="8" height="7" fill="#8a5a2b" {...sw} />
      <path d="M12 40 L52 40 L50 56 L14 56 Z" fill="#b8b0a2" {...sw} />
      <path d="M14 46 L50 46 M22 40 L22 46 M34 40 L34 46 M44 40 L44 46 M28 46 L28 56 M40 46 L40 56" stroke={K} strokeWidth="1.4" />
    </>
  ),
  lamp: (
    <>
      <path d="M32 10 C38 18 38 26 32 30 C26 26 26 18 32 10 Z" fill="#ffb627" {...sw} />
      <path d="M32 18 C34 22 34 25 32 27 C30 25 30 22 32 18 Z" fill="#fff3b0" />
      <path d="M12 36 C14 50 50 50 52 36 Z" fill="#c8682a" {...sw} />
      <path d="M12 36 L52 36" {...sw} />
      <path d="M22 41 L42 41" stroke="#f2d39a" strokeWidth="2" />
    </>
  ),
  owl: (
    <>
      <path d="M16 20 L22 12 L28 18 L36 18 L42 12 L48 20 C52 34 50 52 32 54 C14 52 12 34 16 20 Z" fill="#9b6b43" {...sw} />
      <circle cx="25" cy="27" r="7" fill="#fff" {...sw} />
      <circle cx="39" cy="27" r="7" fill="#fff" {...sw} />
      <circle cx="25" cy="27" r="3" fill={K} />
      <circle cx="39" cy="27" r="3" fill={K} />
      <path d="M30 34 L34 34 L32 38 Z" fill="#ffb627" {...sw} />
      <path d="M24 44 C28 47 36 47 40 44" fill="none" stroke="#f3dcc0" strokeWidth="2.4" strokeLinecap="round" />
    </>
  ),
  wool: (
    <>
      <circle cx="30" cy="34" r="18" fill="#e84393" {...sw} />
      <path d="M16 26 C24 30 36 30 44 22 M14 36 C24 40 40 38 47 30 M18 46 C26 48 38 46 46 38 M24 18 C22 30 24 42 30 52" fill="none" stroke="#a51f63" strokeWidth="1.8" />
      <path d="M46 44 C52 48 56 52 52 58" fill="none" {...sw} />
    </>
  ),
  sage: (
    <>
      <circle cx="32" cy="24" r="12" fill="#e2a878" {...sw} />
      <path d="M20 22 C20 8 44 8 44 22 C40 16 24 16 20 22 Z" fill="#fff" {...sw} />
      <path d="M22 28 C22 44 42 44 42 28 C38 34 26 34 22 28 Z" fill="#fff" {...sw} />
      <circle cx="27" cy="23" r="1.6" fill={K} />
      <circle cx="37" cy="23" r="1.6" fill={K} />
      <path d="M14 58 C14 44 22 40 32 40 C42 40 50 44 50 58 Z" fill="#f28c28" {...sw} />
      <path d="M30 6 L32 2 L34 6" fill="none" stroke="#e23d3d" strokeWidth="2" />
    </>
  ),
  one: (
    <>
      <rect x="12" y="12" width="40" height="40" rx="9" fill="#fff" {...sw} />
      <circle cx="32" cy="32" r="6" fill="#e23d3d" />
    </>
  ),
  six: (
    <>
      <rect x="12" y="12" width="40" height="40" rx="9" fill="#fff" {...sw} />
      {[22, 42].map((x) => [21, 32, 43].map((y) => <circle key={`${x}-${y}`} cx={x} cy={y} r="4" fill={K} />))}
    </>
  ),
  mirror: (
    <>
      <ellipse cx="32" cy="26" rx="16" ry="19" fill="#e8b04a" {...sw} />
      <ellipse cx="32" cy="26" rx="11" ry="14" fill="#cfeeff" stroke={K} strokeWidth="1.5" />
      <path d="M26 20 L32 14 M26 28 L36 18" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
      <rect x="29" y="44" width="6" height="14" rx="3" fill="#e8b04a" {...sw} />
    </>
  ),
  walnut: (
    <>
      <ellipse cx="32" cy="34" rx="17" ry="20" fill="#b07a45" {...sw} />
      <path d="M32 14 L32 54" fill="none" stroke={K} strokeWidth="1.8" />
      <path d="M22 24 C26 28 22 32 26 36 C22 40 26 44 22 46 M42 24 C38 28 42 32 38 36 C42 40 38 44 42 46" fill="none" stroke="#6e4522" strokeWidth="1.6" />
    </>
  ),
  ring: (
    <>
      <circle cx="32" cy="40" r="14" fill="none" stroke="#e8b04a" strokeWidth="6" />
      <circle cx="32" cy="40" r="14" fill="none" stroke={K} strokeWidth="1" />
      <path d="M24 22 L32 12 L40 22 L32 30 Z" fill="#5bc0eb" {...sw} />
      <path d="M28 20 L32 15" stroke="#fff" strokeWidth="1.6" />
    </>
  ),
  grapes: (
    <>
      <path d="M32 12 L32 18 M32 14 C38 8 46 10 46 14" fill="none" {...sw} />
      {[
        [24, 22],
        [34, 22],
        [44, 22],
        [28, 31],
        [38, 31],
        [24, 40],
        [34, 40],
        [30, 49],
      ].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x - 2} cy={y + 2} r="6" fill="#7b3fa0" {...sw} />
      ))}
    </>
  ),
  lotus: (
    <>
      <path d="M32 14 C40 22 40 36 32 46 C24 36 24 22 32 14 Z" fill="#ff8fb8" {...sw} />
      <path d="M32 46 C22 44 14 34 14 24 C24 26 30 34 32 46 Z" fill="#ffb3cf" {...sw} />
      <path d="M32 46 C42 44 50 34 50 24 C40 26 34 34 32 46 Z" fill="#ffb3cf" {...sw} />
      <path d="M10 50 C20 46 44 46 54 50 C44 56 20 56 10 50 Z" fill="#3fa34d" {...sw} />
    </>
  ),
  rabbit: (
    <>
      <ellipse cx="25" cy="16" rx="4.5" ry="12" fill="#fff" {...sw} />
      <ellipse cx="38" cy="16" rx="4.5" ry="12" fill="#fff" {...sw} />
      <ellipse cx="25" cy="17" rx="1.8" ry="7" fill="#ffb3cf" />
      <ellipse cx="38" cy="17" rx="1.8" ry="7" fill="#ffb3cf" />
      <ellipse cx="32" cy="46" rx="16" ry="12" fill="#fff" {...sw} />
      <circle cx="31" cy="32" r="11" fill="#fff" {...sw} />
      <circle cx="27" cy="30" r="1.8" fill={K} />
      <circle cx="35" cy="30" r="1.8" fill={K} />
      <path d="M29.5 35 L32.5 35 L31 37 Z" fill="#ff8fb8" />
    </>
  ),
  pot: (
    <>
      <path d="M22 26 C18 16 24 10 28 18 M32 26 L32 10 M42 26 C46 16 40 10 36 18" fill="none" stroke="#3fa34d" strokeWidth="3" strokeLinecap="round" />
      <circle cx="32" cy="9" r="4.5" fill="#ff5d73" {...sw} />
      <path d="M14 26 L50 26 L50 32 L14 32 Z" fill="#c8682a" {...sw} />
      <path d="M17 32 L47 32 L43 56 L21 56 Z" fill="#e07b39" {...sw} />
    </>
  ),
  house: (
    <>
      <path d="M8 32 L32 10 L56 32 Z" fill="#e23d3d" {...sw} />
      <rect x="14" y="31" width="36" height="25" fill="#ffe2b8" {...sw} />
      <rect x="27" y="40" width="10" height="16" fill="#8a4b22" {...sw} />
      <rect x="17" y="36" width="7" height="7" fill="#5bc0eb" {...sw} />
      <rect x="40" y="36" width="7" height="7" fill="#5bc0eb" {...sw} />
    </>
  ),
  fan: (
    <>
      <circle cx="32" cy="26" r="18" fill="#e9f6ff" {...sw} />
      <path d="M32 26 C26 14 32 10 36 12 C38 18 36 22 32 26 Z M32 26 C44 24 46 30 44 34 C38 34 34 30 32 26 Z M32 26 C26 36 20 34 18 30 C22 26 28 26 32 26 Z" fill="#1f7ae0" {...sw} />
      <circle cx="32" cy="26" r="3" fill={K} />
      <path d="M32 44 L32 54 M22 56 L42 56" fill="none" {...sw} strokeWidth={3} />
    </>
  ),
  bird: (
    <>
      <ellipse cx="30" cy="36" rx="17" ry="13" fill="#1f9ad6" {...sw} />
      <circle cx="44" cy="26" r="9" fill="#1f9ad6" {...sw} />
      <path d="M52 25 L59 27 L52 30 Z" fill="#ffb627" {...sw} />
      <circle cx="46" cy="24" r="1.8" fill={K} />
      <path d="M14 32 L4 28 L10 38 Z" fill="#1f9ad6" {...sw} />
      <path d="M22 34 C28 28 34 30 36 36 C30 40 26 40 22 34 Z" fill="#7fd0f5" {...sw} />
      <path d="M28 49 L26 56 M34 49 L34 56" fill="none" {...sw} />
    </>
  ),
  umbrella: (
    <>
      <path d="M8 32 C8 14 56 14 56 32 C52 28 46 28 44 32 C40 28 36 28 32 32 C28 28 24 28 20 32 C18 28 12 28 8 32 Z" fill="#e84393" {...sw} />
      <path d="M32 18 L32 50 C32 56 24 56 24 50" fill="none" {...sw} strokeWidth={2.6} />
    </>
  ),
  plane: (
    <>
      <path d="M8 34 C8 30 12 28 18 28 L50 28 C56 28 58 32 58 34 C58 36 56 38 50 38 L18 38 C12 38 8 36 8 34 Z" fill="#fff" {...sw} />
      <path d="M28 30 L40 12 L46 12 L40 30 Z M30 38 L40 54 L46 54 L40 38 Z" fill="#1f7ae0" {...sw} />
      <path d="M10 30 L8 20 L14 20 L20 28" fill="#e23d3d" {...sw} />
      <path d="M48 31 L53 31" stroke={K} strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  bag: (
    <>
      <path d="M22 26 C22 10 42 10 42 26" fill="none" {...sw} strokeWidth={3} />
      <path d="M12 24 L52 24 L48 56 L16 56 Z" fill="#14a37f" {...sw} />
      <path d="M16 34 L48 34" stroke="#f2b705" strokeWidth="3" />
      <path d="M17 42 L47 42" stroke="#e23d3d" strokeWidth="3" />
    </>
  ),
  glove: (
    <>
      <path d="M18 56 L18 34 C14 30 10 26 12 22 C16 20 20 24 22 28 L22 16 C22 12 27 12 27 16 L27 26 L27 12 C27 8 32 8 32 12 L32 26 L32 14 C32 10 37 10 37 14 L37 28 L37 20 C37 16 42 16 42 20 L42 40 C42 48 40 52 40 56 Z" fill="#f28c28" {...sw} />
      <path d="M18 50 L40 50" stroke="#fff" strokeWidth="2.4" />
    </>
  ),
  tomato: (
    <>
      <path d="M10 34 C10 20 22 16 32 16 C42 16 54 20 54 34 C54 48 44 56 32 56 C20 56 10 48 10 34 Z" fill="#e23d3d" {...sw} />
      <path d="M24 16 L28 20 L32 12 L36 20 L42 16 L38 22 L26 22 Z" fill="#3fa34d" {...sw} />
      <ellipse cx="22" cy="30" rx="4" ry="6" fill="#fff" opacity="0.35" />
    </>
  ),
  cart: (
    <>
      <path d="M8 22 L48 22 L46 40 L12 40 Z" fill="#f2b705" {...sw} />
      <path d="M48 22 L56 14" fill="none" {...sw} strokeWidth={3} />
      <circle cx="20" cy="48" r="7" fill="#fff" {...sw} />
      <circle cx="40" cy="48" r="7" fill="#fff" {...sw} />
      <circle cx="20" cy="48" r="2" fill={K} />
      <circle cx="40" cy="48" r="2" fill={K} />
      <circle cx="20" cy="18" r="5" fill="#ff7a1a" {...sw} />
      <circle cx="32" cy="17" r="5" fill="#3fa34d" {...sw} />
    </>
  ),
  damaru: (
    <>
      <path d="M14 10 L50 10 L36 32 L50 54 L14 54 L28 32 Z" fill="#e8a24a" {...sw} />
      <path d="M14 10 L50 10 M14 54 L50 54" stroke="#8a4b22" strokeWidth="5" strokeLinecap="round" />
      <path d="M28 32 L36 32" stroke="#e23d3d" strokeWidth="4" />
      <path d="M36 32 C44 32 48 38 52 36" fill="none" stroke={K} strokeWidth="1.5" />
      <circle cx="54" cy="36" r="3" fill="#e23d3d" {...sw} />
    </>
  ),
  dhol: (
    <>
      <path d="M12 22 C12 14 52 14 52 22 L52 44 C52 52 12 52 12 44 Z" fill="#c0392b" {...sw} />
      <ellipse cx="32" cy="22" rx="20" ry="7" fill="#f6e7c8" {...sw} />
      <path d="M14 26 L24 46 L34 26 L44 46 L50 32" fill="none" stroke="#ffd36e" strokeWidth="2" />
      <path d="M40 8 L52 18" fill="none" {...sw} strokeWidth={3} />
    </>
  ),
  arrow: (
    <>
      <path d="M10 54 L50 14" fill="none" {...sw} strokeWidth={3.4} />
      <path d="M50 14 L38 16 L48 26 Z" fill="#7a8696" {...sw} />
      <path d="M10 54 L10 44 M10 54 L20 54 M14 50 L14 42 M14 50 L22 50" fill="none" stroke="#e23d3d" strokeWidth="3" strokeLinecap="round" />
    </>
  ),
  scales: (
    <>
      <path d="M32 12 L32 54 M22 56 L42 56 M12 18 L52 18" fill="none" {...sw} strokeWidth={3} />
      <path d="M12 18 L6 36 M12 18 L18 36 M52 18 L46 36 M52 18 L58 36" fill="none" stroke={K} strokeWidth="1.4" />
      <path d="M4 36 L20 36 C20 42 4 42 4 36 Z M44 36 L60 36 C60 42 44 42 44 36 Z" fill="#e8b04a" {...sw} />
      <circle cx="32" cy="12" r="3" fill="#e8b04a" {...sw} />
    </>
  ),
  plate: (
    <>
      <ellipse cx="32" cy="36" rx="26" ry="16" fill="#d8dde6" {...sw} />
      <ellipse cx="32" cy="36" rx="19" ry="11" fill="#eef1f6" stroke={K} strokeWidth="1.2" />
      <ellipse cx="26" cy="34" rx="8" ry="5" fill="#fff" stroke="#c9b28a" strokeWidth="1.2" />
      <ellipse cx="39" cy="36" rx="5" ry="4" fill="#f2b705" />
      <ellipse cx="34" cy="41" rx="5" ry="3" fill="#3fa34d" />
    </>
  ),
  tooth: (
    <>
      <path d="M14 18 C14 8 26 8 32 12 C38 8 50 8 50 18 C50 28 46 32 44 42 C42 52 38 56 36 50 C34 42 30 42 28 50 C26 56 22 52 20 42 C18 32 14 28 14 18 Z" fill="#fff" {...sw} />
      <circle cx="25" cy="22" r="1.8" fill={K} />
      <circle cx="39" cy="22" r="1.8" fill={K} />
      <path d="M27 28 C29 31 35 31 37 28" fill="none" stroke={K} strokeWidth="1.8" strokeLinecap="round" />
    </>
  ),
  bow: (
    <>
      <path d="M22 8 C48 18 48 46 22 56" fill="none" stroke="#8a4b22" strokeWidth="4.5" strokeLinecap="round" />
      <path d="M22 8 L22 56" fill="none" stroke={K} strokeWidth="1.4" />
    </>
  ),
  coconut: (
    <>
      <circle cx="32" cy="36" r="19" fill="#8a5a2b" {...sw} />
      <path d="M14 34 C22 30 42 30 50 34" fill="none" stroke="#5e3a17" strokeWidth="1.6" />
      <circle cx="27" cy="24" r="2.2" fill="#3b2117" />
      <circle cx="35" cy="24" r="2.2" fill="#3b2117" />
      <circle cx="31" cy="30" r="2.2" fill="#3b2117" />
    </>
  ),
  butterfly: (
    <>
      <path d="M32 24 C24 8 6 10 10 24 C12 32 22 32 32 30 Z" fill="#ff7a1a" {...sw} />
      <path d="M32 24 C40 8 58 10 54 24 C52 32 42 32 32 30 Z" fill="#ff7a1a" {...sw} />
      <path d="M32 32 C22 34 12 44 20 50 C26 52 30 44 32 36 Z" fill="#f2b705" {...sw} />
      <path d="M32 32 C42 34 52 44 44 50 C38 52 34 44 32 36 Z" fill="#f2b705" {...sw} />
      <path d="M32 18 L32 48" {...sw} strokeWidth={3.4} />
      <path d="M32 18 C30 12 26 10 24 10 M32 18 C34 12 38 10 40 10" fill="none" stroke={K} strokeWidth="1.5" />
      <circle cx="18" cy="20" r="3" fill="#fff" />
      <circle cx="46" cy="20" r="3" fill="#fff" />
    </>
  ),
  flower: (
    <>
      <path d="M32 36 L32 58 M32 50 C38 44 44 46 46 48 C40 52 36 52 32 50" fill="#3fa34d" stroke="#2c7a37" strokeWidth="3" strokeLinecap="round" />
      {[0, 72, 144, 216, 288].map((a) => (
        <ellipse key={a} cx="32" cy="15" rx="7" ry="10" fill="#ff5d73" {...sw} transform={`rotate(${a} 32 26)`} />
      ))}
      <circle cx="32" cy="26" r="6" fill="#f2b705" {...sw} />
    </>
  ),
  cat: (
    <>
      <path d="M14 16 L20 30 L12 30 Z M50 16 L44 30 L52 30 Z" fill="#9aa3b2" {...sw} />
      <ellipse cx="32" cy="36" rx="20" ry="17" fill="#9aa3b2" {...sw} />
      <circle cx="25" cy="34" r="2.4" fill={K} />
      <circle cx="39" cy="34" r="2.4" fill={K} />
      <path d="M30 40 L34 40 L32 42 Z" fill="#ff8fb8" />
      <path d="M14 40 L24 41 M14 45 L24 43 M50 40 L40 41 M50 45 L40 43" stroke={K} strokeWidth="1.2" />
    </>
  ),
  bear: (
    <>
      <circle cx="16" cy="18" r="7" fill="#7a4b2a" {...sw} />
      <circle cx="48" cy="18" r="7" fill="#7a4b2a" {...sw} />
      <circle cx="32" cy="34" r="20" fill="#7a4b2a" {...sw} />
      <ellipse cx="32" cy="41" rx="9" ry="7" fill="#d9a87a" />
      <circle cx="25" cy="30" r="2.4" fill={K} />
      <circle cx="39" cy="30" r="2.4" fill={K} />
      <ellipse cx="32" cy="38" rx="3.5" ry="2.5" fill={K} />
    </>
  ),
  fish: (
    <>
      <path d="M8 32 C16 16 40 16 46 32 C40 48 16 48 8 32 Z" fill="#ff7a1a" {...sw} />
      <path d="M46 32 L58 22 L58 42 Z" fill="#ff7a1a" {...sw} />
      <circle cx="18" cy="29" r="2.4" fill={K} />
      <path d="M26 24 C30 28 30 36 26 40 M34 24 C38 28 38 36 34 40" fill="none" stroke="#c9520a" strokeWidth="1.8" />
    </>
  ),
  yak: (
    <>
      <path d="M12 22 C6 18 6 10 12 8 C10 14 14 18 18 20 Z M52 22 C58 18 58 10 52 8 C54 14 50 18 46 20 Z" fill="#f2ead8" {...sw} />
      <path d="M14 22 C14 14 50 14 50 22 L52 40 C52 54 12 54 12 40 Z" fill="#3b2a22" {...sw} />
      <path d="M18 46 L16 56 M26 48 L25 57 M38 48 L39 57 M46 46 L48 56" stroke="#3b2a22" strokeWidth="3.4" strokeLinecap="round" />
      <ellipse cx="32" cy="38" rx="10" ry="7" fill="#6b5446" />
      <circle cx="24" cy="28" r="2.4" fill="#fff" />
      <circle cx="40" cy="28" r="2.4" fill="#fff" />
      <path d="M28 18 C30 22 34 22 36 18" stroke="#e23d3d" strokeWidth="2.4" fill="none" strokeLinecap="round" />
    </>
  ),
  tree: (
    <>
      <rect x="28" y="38" width="8" height="18" fill="#8a4b22" {...sw} />
      <circle cx="32" cy="26" r="14" fill="#3fa34d" {...sw} />
      <circle cx="20" cy="32" r="9" fill="#3fa34d" {...sw} />
      <circle cx="44" cy="32" r="9" fill="#3fa34d" {...sw} />
      <circle cx="26" cy="22" r="2.2" fill="#e23d3d" />
      <circle cx="40" cy="28" r="2.2" fill="#e23d3d" />
    </>
  ),
  top: (
    <>
      <path d="M32 6 L32 14" {...sw} strokeWidth={3.4} />
      <path d="M12 26 C12 18 52 18 52 26 C52 36 40 46 32 58 C24 46 12 36 12 26 Z" fill="#1f7ae0" {...sw} />
      <path d="M13 28 C24 34 40 34 51 28" fill="none" stroke="#f2b705" strokeWidth="3" />
      <path d="M18 38 C26 42 38 42 46 38" fill="none" stroke="#e23d3d" strokeWidth="3" />
    </>
  ),
  forest: (
    <>
      <path d="M16 8 L28 32 L4 32 Z M16 22 L30 46 L2 46 Z" fill="#2f8f46" {...sw} />
      <path d="M44 4 L58 30 L30 30 Z M44 18 L60 46 L28 46 Z" fill="#3fa34d" {...sw} />
      <rect x="14" y="46" width="4" height="10" fill="#8a4b22" />
      <rect x="42" y="46" width="4" height="10" fill="#8a4b22" />
    </>
  ),
  conch: (
    <>
      <path d="M10 40 C8 24 24 12 40 16 C52 20 58 30 54 36 L44 38 C40 48 26 54 14 50 Z" fill="#fff2e2" {...sw} />
      <path d="M44 38 C38 32 30 30 22 34 M40 22 C34 26 30 32 30 40 M50 26 L44 38" fill="none" stroke="#e0a77a" strokeWidth="2" />
      <path d="M10 40 L4 46 L14 50" fill="#ffd3b0" {...sw} />
    </>
  ),
  hexagon: <path d="M32 8 L53 20 L53 44 L32 56 L11 44 L11 20 Z" fill="#7b5cd6" {...sw} strokeWidth={3} />,
  sun: (
    <>
      {Array.from({ length: 8 }, (_, i) => (
        <path key={i} d="M32 4 L32 13" stroke="#f5a300" strokeWidth="4" strokeLinecap="round" transform={`rotate(${i * 45} 32 32)`} />
      ))}
      <circle cx="32" cy="32" r="14" fill="#ffc93c" {...sw} />
      <circle cx="27" cy="30" r="1.8" fill={K} />
      <circle cx="37" cy="30" r="1.8" fill={K} />
      <path d="M27 36 C29 39 35 39 37 36" fill="none" stroke={K} strokeWidth="1.8" strokeLinecap="round" />
    </>
  ),
  elephant: (
    <>
      <ellipse cx="34" cy="34" rx="20" ry="16" fill="#9aa8bd" {...sw} />
      <path d="M14 30 C6 32 6 46 10 54 L16 54 C12 46 14 40 18 38" fill="#9aa8bd" {...sw} />
      <ellipse cx="26" cy="30" rx="8" ry="10" fill="#b8c4d6" {...sw} />
      <circle cx="18" cy="28" r="2" fill={K} />
      <path d="M22 48 L22 56 M32 50 L32 57 M42 50 L42 57 M50 46 L50 55" stroke="#9aa8bd" strokeWidth="5" strokeLinecap="round" />
      <path d="M54 32 L58 36" stroke={K} strokeWidth="1.8" strokeLinecap="round" />
    </>
  ),
  horizon: (
    <>
      <rect x="4" y="8" width="56" height="30" rx="4" fill="#ffd9b8" />
      <path d="M18 38 A14 14 0 0 1 46 38 Z" fill="#ff7a1a" {...sw} />
      <rect x="4" y="38" width="56" height="18" rx="4" fill="#3fa34d" {...sw} />
      <path d="M4 38 L60 38" {...sw} strokeWidth={2.6} />
    </>
  ),
  trident: (
    <>
      <path d="M32 8 L32 58" {...sw} strokeWidth={3.6} />
      <path d="M16 12 C14 26 22 30 32 30 C42 30 50 26 48 12" fill="none" {...sw} strokeWidth={3.2} />
      <path d="M32 4 L28 12 L36 12 Z M16 8 L13 14 L19 14 Z M48 8 L45 14 L51 14 Z" fill="#c0c7d2" {...sw} />
      <path d="M28 36 L36 36" stroke="#e23d3d" strokeWidth="4" strokeLinecap="round" />
    </>
  ),
  book: (
    <>
      <path d="M6 16 L32 22 L58 16 L58 50 L32 56 L6 50 Z" fill="#fff" {...sw} />
      <path d="M32 22 L32 56" {...sw} />
      <path d="M12 28 L26 31 M12 35 L26 38 M38 31 L52 28 M38 38 L52 35" stroke="#9aa3b2" strokeWidth="2" strokeLinecap="round" />
      <path d="M44 4 L46 9 L51 9 L47 12 L49 17 L44 14 L39 17 L41 12 L37 9 L42 9 Z" fill="#f5b70a" stroke="#c98a00" strokeWidth="1" />
    </>
  ),
  namaste: (
    <>
      <path d="M32 8 C26 14 24 30 24 40 L22 52 L32 54 Z" fill="#e2a878" {...sw} />
      <path d="M32 8 C38 14 40 30 40 40 L42 52 L32 54 Z" fill="#d6996a" {...sw} />
      <path d="M18 56 L46 56" stroke="#e84393" strokeWidth="5" strokeLinecap="round" />
    </>
  ),
};

export function Pic({ id, size = 48, label, className }: { id: PicId; size?: number; label?: string; className?: string }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {PICS[id]}
    </svg>
  );
}

// ---------- small icons ----------

export function Icon({ name, size = 22 }: { name: 'speaker' | 'mute' | 'star' | 'flame' | 'pencil' | 'balloon' | 'puzzle' | 'blocks' | 'book' | 'grid' | 'back' | 'left' | 'right' | 'close' | 'lock'; size?: number }) {
  const p = { fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  const body: Record<typeof name, ReactNode> = {
    speaker: (
      <>
        <path d="M4 9 L8 9 L13 5 L13 19 L8 15 L4 15 Z" {...p} fill="currentColor" />
        <path d="M16 9 C17.5 10.5 17.5 13.5 16 15 M19 6.5 C22 9.5 22 14.5 19 17.5" {...p} />
      </>
    ),
    mute: (
      <>
        <path d="M4 9 L8 9 L13 5 L13 19 L8 15 L4 15 Z" {...p} fill="currentColor" />
        <path d="M17 9 L22 15 M22 9 L17 15" {...p} />
      </>
    ),
    star: <path d="M12 3 L14.6 9 L21 9.5 L16 13.6 L17.6 20 L12 16.6 L6.4 20 L8 13.6 L3 9.5 L9.4 9 Z" fill="currentColor" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />,
    flame: <path d="M12 3 C14 7 18 9 18 14 C18 18 15 21 12 21 C9 21 6 18 6 14 C6 11 8 9 9 8 C9 11 10 12 11 12 C11 9 11 6 12 3 Z" fill="currentColor" />,
    pencil: <path d="M4 20 L5 15 L16 4 L20 8 L9 19 Z M14 6 L18 10" {...p} />,
    balloon: (
      <>
        <ellipse cx="12" cy="9" rx="6" ry="7" {...p} />
        <path d="M12 16 L11 18 L13 18 Z M12 18 C10 20 14 21 12 23" {...p} />
      </>
    ),
    puzzle: <path d="M4 8 L9 8 C9 5 13 5 13 8 L18 8 L18 12 C21 12 21 16 18 16 L18 20 L4 20 L4 16 C7 16 7 12 4 12 Z" {...p} />,
    blocks: (
      <>
        <rect x="3" y="12" width="8" height="8" rx="1.5" {...p} />
        <rect x="13" y="12" width="8" height="8" rx="1.5" {...p} />
        <rect x="8" y="3" width="8" height="8" rx="1.5" {...p} />
      </>
    ),
    book: <path d="M3 5 L12 7 L21 5 L21 19 L12 21 L3 19 Z M12 7 L12 21" {...p} />,
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1.5" {...p} />
        <rect x="14" y="3" width="7" height="7" rx="1.5" {...p} />
        <rect x="3" y="14" width="7" height="7" rx="1.5" {...p} />
        <rect x="14" y="14" width="7" height="7" rx="1.5" {...p} />
      </>
    ),
    back: <path d="M15 5 L8 12 L15 19" {...p} />,
    left: <path d="M15 5 L8 12 L15 19" {...p} />,
    right: <path d="M9 5 L16 12 L9 19" {...p} />,
    close: <path d="M6 6 L18 18 M18 6 L6 18" {...p} />,
    lock: (
      <>
        <rect x="5" y="11" width="14" height="10" rx="2" {...p} />
        <path d="M8 11 L8 8 C8 4 16 4 16 8 L16 11" {...p} />
      </>
    ),
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {body[name]}
    </svg>
  );
}
