// Drawings for the /work/restaurant demo: every dish is a small SVG (no stock
// photos), plus the line icons. Colours come from the dish's hue so each one
// looks a little different; everything is decorative (aria-hidden) and the
// words around it carry the meaning.

import type { ReactNode } from 'react';
import type { ArtKind } from './order';

const plate = (
  <>
    <ellipse cx="60" cy="80" rx="46" ry="6" fill="rgba(60,30,10,0.12)" />
    <ellipse cx="60" cy="56" rx="50" ry="26" fill="#fffaf2" stroke="#e9dcc6" strokeWidth="1.5" />
    <ellipse cx="60" cy="54" rx="38" ry="18" fill="#f6ecdc" />
  </>
);

function Momo({ h, n = 5 }: { h: number; n?: number }) {
  const spots = [
    [42, 50],
    [60, 46],
    [78, 50],
    [50, 62],
    [70, 62],
  ].slice(0, n);
  return (
    <>
      {plate}
      <ellipse cx="96" cy="44" rx="11" ry="6" fill={`hsl(${h} 30% 92%)`} stroke="#e1cfb5" />
      <ellipse cx="96" cy="43" rx="8" ry="3.5" fill="hsl(12 80% 50%)" />
      {spots.map(([x, y], i) => (
        <g key={i} transform={`translate(${x} ${y})`}>
          <path d="M-11 4 Q-12 -6 0 -9 Q12 -6 11 4 Q0 8 -11 4Z" fill="#fff7ea" stroke="#e5d3b8" strokeWidth="1.2" />
          <path d="M-5 -6 Q-3 -1 0 -9 M0 -9 Q3 -1 5 -6 M-8 -3 Q-5 0 -4 -7 M8 -3 Q5 0 4 -7" stroke="#d9c4a2" strokeWidth="1" fill="none" />
        </g>
      ))}
      <circle cx="34" cy="40" r="2" fill={`hsl(${h} 55% 40%)`} />
      <circle cx="86" cy="62" r="1.8" fill={`hsl(${h} 55% 40%)`} />
    </>
  );
}

function Thali({ h }: { h: number }) {
  return (
    <>
      <ellipse cx="60" cy="80" rx="48" ry="6" fill="rgba(60,30,10,0.12)" />
      <ellipse cx="60" cy="54" rx="52" ry="28" fill="#d9a441" />
      <ellipse cx="60" cy="53" rx="46" ry="23" fill="#e8bd5f" />
      <ellipse cx="52" cy="60" rx="18" ry="9" fill="#fffdf6" />
      <ellipse cx="52" cy="57" rx="12" ry="5" fill="#ffffff" />
      {[
        [30, 44, '#f2b632'],
        [58, 38, `hsl(${h} 65% 38%)`],
        [86, 46, '#4f8a3a'],
      ].map(([x, y, c], i) => (
        <g key={i}>
          <ellipse cx={x as number} cy={(y as number) + 2} rx="11" ry="6" fill="#c38d2e" />
          <ellipse cx={x as number} cy={y as number} rx="10" ry="5" fill={c as string} />
        </g>
      ))}
      <path d="M80 60 q8 -4 14 2 q-6 6 -14 -2z" fill="#c8402a" />
      <circle cx="74" cy="66" r="3" fill="#f0e4c6" />
    </>
  );
}

function Bowl({ h, soup }: { h: number; soup?: boolean }) {
  return (
    <>
      <ellipse cx="60" cy="82" rx="40" ry="5" fill="rgba(60,30,10,0.12)" />
      <path d="M16 44 Q20 80 60 80 Q100 80 104 44Z" fill={`hsl(${h} 45% 45%)`} />
      <path d="M22 56 Q60 66 98 56" stroke="rgba(255,255,255,0.35)" strokeWidth="2" fill="none" />
      <ellipse cx="60" cy="44" rx="44" ry="12" fill={soup ? '#d98a3a' : '#f3d59a'} />
      {[0, 1, 2, 3, 4].map((i) => (
        <path key={i} d={`M${28 + i * 12} ${40 + (i % 2) * 4} q4 -6 8 0 t8 0 t8 0`} stroke="#f7e3b0" strokeWidth="2.6" fill="none" strokeLinecap="round" />
      ))}
      <circle cx="44" cy="40" r="2.4" fill="#4f9a3a" />
      <circle cx="74" cy="46" r="2.4" fill="#4f9a3a" />
      <circle cx="62" cy="38" r="2.2" fill="#e05a2a" />
      {soup ? (
        <path d="M50 26 q-4 -6 0 -12 M62 24 q-4 -6 0 -12 M74 26 q-4 -6 0 -12" stroke="rgba(120,90,60,0.35)" strokeWidth="2" fill="none" strokeLinecap="round" />
      ) : (
        <>
          <line x1="70" y1="10" x2="96" y2="44" stroke="#8a5a2b" strokeWidth="3" strokeLinecap="round" />
          <line x1="78" y1="8" x2="100" y2="42" stroke="#a06a35" strokeWidth="3" strokeLinecap="round" />
        </>
      )}
    </>
  );
}

function Leaf({ h }: { h: number }) {
  return (
    <>
      <ellipse cx="60" cy="80" rx="46" ry="6" fill="rgba(60,30,10,0.12)" />
      <ellipse cx="60" cy="54" rx="50" ry="26" fill="#5b8f3a" />
      <ellipse cx="60" cy="53" rx="45" ry="22" fill="#6fa847" />
      <path d="M60 31 V75 M60 50 L30 40 M60 56 L90 44 M60 62 L34 66 M60 46 L86 36" stroke="#8cc265" strokeWidth="1.2" fill="none" />
      {Array.from({ length: 22 }, (_, i) => (
        <ellipse key={i} cx={34 + (i % 6) * 5 + (i % 2)} cy={46 + Math.floor(i / 6) * 4} rx="2.4" ry="1.4" fill="#f6ecd5" />
      ))}
      {[
        [70, 46],
        [78, 52],
        [72, 56],
      ].map(([x, y], i) => (
        <rect key={i} x={x} y={y} width="7" height="5" rx="1.5" fill={`hsl(${h} 70% 30%)`} />
      ))}
      <ellipse cx="56" cy="64" rx="6" ry="4.5" fill="#fff" />
      <circle cx="56" cy="64" r="2.6" fill="#f3b72c" />
      {[0, 1, 2, 3, 4].map((i) => (
        <circle key={i} cx={78 + (i % 3) * 4} cy={62 + Math.floor(i / 3) * 4} r="1.8" fill="#c9883a" />
      ))}
    </>
  );
}

function Pieces({ h, kind }: { h: number; kind: 'choila' | 'bara' | 'chatamari' }) {
  return (
    <>
      {plate}
      {kind === 'choila' &&
        [
          [44, 50],
          [56, 46],
          [68, 52],
          [52, 58],
          [64, 60],
          [76, 48],
        ].map(([x, y], i) => <rect key={i} x={x} y={y} width="10" height="7" rx="2" transform={`rotate(${i * 23} ${x + 5} ${y + 3})`} fill={`hsl(${h} 72% ${30 + (i % 3) * 5}%)`} />)}
      {kind === 'choila' && <path d="M34 60 q10 -14 22 -12" stroke="#3f8f2e" strokeWidth="3" fill="none" strokeLinecap="round" />}
      {kind === 'bara' &&
        [
          [48, 52],
          [72, 54],
        ].map(([x, y], i) => (
          <g key={i}>
            <ellipse cx={x} cy={y} rx="15" ry="9" fill={`hsl(${h} 60% 42%)`} />
            <ellipse cx={x} cy={y - 1} rx="12" ry="6.5" fill={`hsl(${h} 70% 55%)`} />
            <circle cx={x - 4} cy={y - 2} r="1.2" fill="#7a4a1c" />
            <circle cx={x + 3} cy={y} r="1.2" fill="#7a4a1c" />
          </g>
        ))}
      {kind === 'chatamari' && (
        <>
          <ellipse cx="60" cy="54" rx="30" ry="15" fill="#f5e6c4" stroke="#e1c48c" />
          <ellipse cx="60" cy="54" rx="13" ry="6.5" fill="#fff" />
          <circle cx="60" cy="54" r="4" fill="#f2b632" />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <circle key={i} cx={42 + i * 7} cy={i % 2 ? 46 : 62} r="2" fill={i % 2 ? '#4f9a3a' : '#d9442a'} />
          ))}
        </>
      )}
    </>
  );
}

function Glass({ h, kind }: { h: number; kind: 'tea' | 'lassi' | 'lime' }) {
  if (kind === 'tea')
    return (
      <>
        <ellipse cx="60" cy="82" rx="30" ry="5" fill="rgba(60,30,10,0.12)" />
        <ellipse cx="60" cy="78" rx="28" ry="6" fill="#e9dcc6" />
        <path d="M40 34 L44 76 Q60 82 76 76 L80 34Z" fill="#fffaf2" stroke="#d8c4a4" strokeWidth="1.5" />
        <ellipse cx="60" cy="38" rx="19" ry="4" fill={`hsl(${h} 60% 42%)`} />
        <path d="M80 44 q14 2 10 16 q-3 8 -12 8" stroke="#d8c4a4" strokeWidth="4" fill="none" />
        <path d="M52 26 q-4 -6 0 -12 M62 24 q-4 -6 0 -12 M72 26 q-4 -6 0 -12" stroke="rgba(120,90,60,0.35)" strokeWidth="2" fill="none" strokeLinecap="round" />
      </>
    );
  const fill = kind === 'lassi' ? `hsl(${h} 90% 62%)` : `hsl(${h} 55% 72%)`;
  return (
    <>
      <ellipse cx="60" cy="84" rx="24" ry="4" fill="rgba(60,30,10,0.12)" />
      <path d="M42 18 L48 82 H72 L78 18Z" fill="rgba(255,255,255,0.7)" stroke="#cdd7d9" strokeWidth="1.5" />
      <path d="M44 30 L49 80 H71 L76 30Z" fill={fill} />
      <line x1="66" y1="6" x2="58" y2="70" stroke="#e0453a" strokeWidth="3" strokeLinecap="round" />
      {kind === 'lime' ? (
        <>
          <circle cx="78" cy="22" r="9" fill="#9bd14b" stroke="#6ea42a" strokeWidth="1.5" />
          <path d="M78 13 V31 M69 22 H87 M72 16 L84 28 M84 16 L72 28" stroke="#d8f0a6" strokeWidth="1" />
          <path d="M50 30 q4 -8 10 -6" stroke="#3f8f2e" strokeWidth="3" fill="none" strokeLinecap="round" />
          {[0, 1, 2].map((i) => (
            <circle key={i} cx={54 + i * 6} cy={50 + i * 9} r="1.6" fill="rgba(255,255,255,0.8)" />
          ))}
        </>
      ) : (
        <>
          <ellipse cx="60" cy="30" rx="16" ry="3" fill="#fff6dd" />
          <circle cx="56" cy="30" r="1.2" fill="#6b9a3a" />
        </>
      )}
    </>
  );
}

function Sweet({ h, kind }: { h: number; kind: 'juju' | 'selroti' | 'kheer' }) {
  if (kind === 'juju')
    return (
      <>
        <ellipse cx="60" cy="82" rx="36" ry="5" fill="rgba(60,30,10,0.12)" />
        <path d="M24 44 Q26 80 60 80 Q94 80 96 44Z" fill={`hsl(${h} 55% 42%)`} />
        <path d="M30 60 Q60 70 90 60" stroke="rgba(255,255,255,0.25)" strokeWidth="2" fill="none" />
        <ellipse cx="60" cy="44" rx="36" ry="10" fill={`hsl(${h} 50% 34%)`} />
        <ellipse cx="60" cy="44" rx="31" ry="8" fill="#fff4dc" />
        <ellipse cx="54" cy="42" rx="10" ry="2.5" fill="#f7e2b2" />
      </>
    );
  if (kind === 'selroti')
    return (
      <>
        {plate}
        {[
          [46, 50],
          [74, 50],
          [60, 60],
        ].map(([x, y], i) => (
          <g key={i}>
            <ellipse cx={x} cy={y} rx="17" ry="9" fill="none" stroke={`hsl(${h} 70% 40%)`} strokeWidth="7" />
            <ellipse cx={x} cy={y - 1} rx="17" ry="9" fill="none" stroke={`hsl(${h} 80% 55%)`} strokeWidth="3" />
          </g>
        ))}
      </>
    );
  return (
    <>
      <ellipse cx="60" cy="82" rx="38" ry="5" fill="rgba(60,30,10,0.12)" />
      <path d="M20 46 Q24 80 60 80 Q96 80 100 46Z" fill="#c9b79a" />
      <ellipse cx="60" cy="46" rx="40" ry="11" fill="#fff3dc" />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <ellipse key={i} cx={38 + i * 9} cy={i % 2 ? 43 : 48} rx="3" ry="1.8" fill={i % 3 ? '#e7c98f' : `hsl(${h} 50% 35%)`} />
      ))}
      <circle cx="60" cy="44" r="1.6" fill="#5c9a3a" />
    </>
  );
}

/** A dish's drawing. `size` is the CSS width; the height follows (4:3). */
export function FoodArt({ kind, hue, className }: { kind: ArtKind; hue: number; className?: string }) {
  let body: ReactNode;
  switch (kind) {
    case 'momo':
      body = <Momo h={hue} />;
      break;
    case 'thali':
      body = <Thali h={hue} />;
      break;
    case 'noodles':
      body = <Bowl h={hue} />;
      break;
    case 'thukpa':
      body = <Bowl h={hue} soup />;
      break;
    case 'newari':
      body = <Leaf h={hue} />;
      break;
    case 'choila':
    case 'bara':
    case 'chatamari':
      body = <Pieces h={hue} kind={kind} />;
      break;
    case 'tea':
    case 'lassi':
    case 'lime':
      body = <Glass h={hue} kind={kind} />;
      break;
    default:
      body = <Sweet h={hue} kind={kind} />;
  }
  return (
    <svg className={className} viewBox="0 0 120 90" aria-hidden="true" focusable="false">
      {body}
    </svg>
  );
}

export type IconName =
  | 'search'
  | 'x'
  | 'plus'
  | 'minus'
  | 'bell'
  | 'receipt'
  | 'chef'
  | 'grid'
  | 'phone'
  | 'leaf'
  | 'sprout'
  | 'chili'
  | 'wheat'
  | 'clock'
  | 'check'
  | 'sound'
  | 'mute'
  | 'print'
  | 'reset'
  | 'star'
  | 'qr'
  | 'columns'
  | 'chart'
  | 'bag';

const PATHS: Record<IconName, ReactNode> = {
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4.5 4.5" />
    </>
  ),
  x: <path d="M6 6l12 12M18 6L6 18" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  bell: (
    <>
      <path d="M6 16V11a6 6 0 0112 0v5l1.5 2h-15z" />
      <path d="M10 20a2 2 0 004 0" />
    </>
  ),
  receipt: (
    <>
      <path d="M6 3h12v18l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5L6 21z" />
      <path d="M9 8h6M9 12h6M9 16h3" />
    </>
  ),
  chef: (
    <>
      <path d="M7 14a4 4 0 01-.5-7.9A5 5 0 0117.5 6.1 4 4 0 0117 14" />
      <path d="M7 14v5h10v-5" />
      <path d="M7 16.5h10" />
    </>
  ),
  grid: (
    <>
      <rect x="4" y="4" width="6" height="6" rx="1.5" />
      <rect x="14" y="4" width="6" height="6" rx="1.5" />
      <rect x="4" y="14" width="6" height="6" rx="1.5" />
      <rect x="14" y="14" width="6" height="6" rx="1.5" />
    </>
  ),
  phone: (
    <>
      <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
      <path d="M11 18.5h2" />
    </>
  ),
  leaf: (
    <>
      <path d="M5 19c0-8 5-14 14-14 0 9-6 14-14 14z" />
      <path d="M5 19l8-8" />
    </>
  ),
  sprout: (
    <>
      <path d="M12 21v-9" />
      <path d="M12 12c0-4-3-6-7-6 0 4 3 6 7 6zM12 10c0-3 2.5-5 6.5-5 0 3.5-2.5 5-6.5 5z" />
    </>
  ),
  chili: (
    <>
      <path d="M8.5 9.5C6 15 9 20.5 17.5 20c1.2-.1 1.4-1.2.4-1.6-4.6-1.8-6.1-4.6-6.4-8.4-.2-1.6-2.3-2.1-3-.5z" fill="currentColor" stroke="none" />
      <path d="M10 9c-.2-2 .8-3.6 3-4.5" />
    </>
  ),
  wheat: (
    <>
      <path d="M12 21V8" />
      <path d="M12 12c-2.5 0-4-1.5-4-4 2.5 0 4 1.5 4 4zM12 12c2.5 0 4-1.5 4-4-2.5 0-4 1.5-4 4zM12 8c-2 0-3-1.5-3-3.5 2 0 3 1.5 3 3.5zM12 8c2 0 3-1.5 3-3.5-2 0-3 1.5-3 3.5z" />
      <path d="M4 4l16 16" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  sound: (
    <>
      <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
      <path d="M15.5 9a4 4 0 010 6M18 6.5a7.5 7.5 0 010 11" />
    </>
  ),
  mute: (
    <>
      <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
      <path d="M16 9.5l5 5M21 9.5l-5 5" />
    </>
  ),
  print: (
    <>
      <path d="M7 8V3.5h10V8" />
      <rect x="3.5" y="8" width="17" height="8.5" rx="2" />
      <path d="M7 14h10v6.5H7z" />
    </>
  ),
  reset: (
    <>
      <path d="M4.5 12a7.5 7.5 0 102.2-5.3" />
      <path d="M4 4.5v4h4" />
    </>
  ),
  star: <path d="M12 4l2.4 5 5.4.6-4 3.7 1.1 5.3L12 16l-4.9 2.6 1.1-5.3-4-3.7 5.4-.6z" />,
  qr: (
    <>
      <rect x="4" y="4" width="6" height="6" rx="1" />
      <rect x="14" y="4" width="6" height="6" rx="1" />
      <rect x="4" y="14" width="6" height="6" rx="1" />
      <path d="M14 14h2v2h-2zM18 18h2v2h-2zM14 18h2M18 14h2" />
    </>
  ),
  columns: (
    <>
      <rect x="3.5" y="4.5" width="5" height="15" rx="1.5" />
      <rect x="9.5" y="4.5" width="5" height="15" rx="1.5" />
      <rect x="15.5" y="4.5" width="5" height="15" rx="1.5" />
    </>
  ),
  chart: <path d="M5 20V10M10 20V5M15 20v-7M20 20v-4" />,
  bag: (
    <>
      <path d="M5 8h14l-1.2 12H6.2z" />
      <path d="M9 8a3 3 0 016 0" />
    </>
  ),
};

export function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg className={`rq-ic${className ? ` ${className}` : ''}`} viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {PATHS[name]}
    </svg>
  );
}

/** The restaurant's made-up mark: a clay stove (chulo) with a flame. */
export function ChuloMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 40 40" aria-hidden="true" focusable="false">
      <rect width="40" height="40" rx="11" fill="#b4442a" />
      <path d="M20 8c3 4 6 6 6 10a6 6 0 01-12 0c0-3 2-4 3-7 1 2 2 3 3 3 0-2-1-4 0-6z" fill="#ffc94a" />
      <path d="M8 26h24v3a3 3 0 01-3 3H11a3 3 0 01-3-3z" fill="#f4e2c4" />
      <path d="M12 26a8 4 0 0116 0" fill="#7a2a16" />
    </svg>
  );
}
