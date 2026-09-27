import type { PageDesign } from '@/lib/events';

/**
 * The hero's moving scene — a few objects floating at different depths behind
 * the title, one set per layout, so every page has its own motion rather than
 * one effect in five colours.
 *
 * Pure markup and CSS (depth.css): it paints on the server, so nothing pops in
 * after load. EventDepth moves the whole scene with the scroll and the mouse
 * through --hp / --mx / --my; each object's own spin is a CSS animation on an
 * inner element, so the two transforms never fight over one node.
 *
 * Events only. A shop's hero stays still — people come to a shop to look at
 * the goods, and floating objects over them are in the way.
 */

type Layout = NonNullable<PageDesign['layout']>;

/** x / y in % of the hero, z = depth (0 far … 1 near), s = size in px. */
interface Piece {
  x: number;
  y: number;
  z: number;
  s: number;
  d?: number;
}

// Laid out mostly on the right half on a laptop, where the title is not.
const TICKETS: Piece[] = [
  { x: 80, y: 18, z: 0.9, s: 112, d: 0 },
  { x: 90, y: 48, z: 0.45, s: 80, d: -5 },
  { x: 75, y: 68, z: 0.7, s: 92, d: -9 },
  { x: 93, y: 8, z: 0.2, s: 58, d: -3 },
  { x: 68, y: 42, z: 0.1, s: 48, d: -12 },
];

const ORBS: Piece[] = [
  { x: 78, y: 24, z: 0.3, s: 220 },
  { x: 60, y: 70, z: 0.6, s: 160 },
];

const CONFETTI: Piece[] = Array.from({ length: 14 }, (_, i) => ({
  x: (i * 37 + 11) % 100,
  y: 0,
  z: ((i * 53) % 10) / 10,
  s: 8 + ((i * 7) % 8),
  d: -((i * 13) % 11),
}));

const SHAPES: Piece[] = [
  { x: 76, y: 22, z: 0.8, s: 96, d: 0 },
  { x: 90, y: 56, z: 0.35, s: 62, d: -6 },
  { x: 60, y: 60, z: 0.55, s: 70, d: -11 },
];

const MOTES: Piece[] = Array.from({ length: 10 }, (_, i) => ({
  x: (i * 29 + 7) % 100,
  y: (i * 41 + 13) % 90,
  z: ((i * 31) % 10) / 10,
  s: 3 + (i % 3),
  d: -((i * 17) % 13),
}));

function pos(p: Piece, extra?: Record<string, string | number>): React.CSSProperties {
  return {
    ['--x' as string]: `${p.x}%`,
    ['--y' as string]: `${p.y}%`,
    ['--z' as string]: p.z,
    ['--s' as string]: `${p.s}px`,
    ['--d' as string]: `${p.d ?? 0}s`,
    ...extra,
  } as React.CSSProperties;
}

export default function HeroDepth({ layout, day }: { layout: Layout; day?: string | null }) {
  return (
    <div className={`dz dz--${layout}`} aria-hidden="true">
      {layout === 'classic' && (
        <>
          {ORBS.map((p, i) => (
            <span key={`o${i}`} className="dz-item dz-orb" style={pos(p)} />
          ))}
          {TICKETS.map((p, i) => (
            <span key={`t${i}`} className="dz-item" style={pos(p)}>
              <span className="dz-spin dz-ticket">
                <span className="dz-ticket-face">
                  <b>ADMIT</b>
                  <i>ONE</i>
                </span>
              </span>
            </span>
          ))}
        </>
      )}

      {layout === 'poster' && (
        <>
          <span className="dz-beam dz-beam-a" />
          <span className="dz-beam dz-beam-b" />
          {MOTES.slice(0, 7).map((p, i) => (
            <span key={i} className="dz-item" style={pos(p)}>
              <span className="dz-spin dz-mote" />
            </span>
          ))}
        </>
      )}

      {layout === 'festival' &&
        CONFETTI.map((p, i) => (
          <span key={i} className="dz-item dz-fall" style={pos(p, { ['--h' as string]: (i * 47) % 360 })}>
            <span className="dz-spin dz-confetti" />
          </span>
        ))}

      {layout === 'neon' && (
        <>
          {SHAPES.map((p, i) => (
            <span key={i} className="dz-item" style={pos(p)}>
              {i === 1 ? (
                <span className="dz-spin dz-ring" />
              ) : (
                <span className={`dz-spin dz-cube${i === 2 ? ' dz-cube-cyan' : ''}`}>
                  {['f', 'b', 'l', 'r', 't', 'u'].map((f) => (
                    <span key={f} className={`dz-face dz-face-${f}`} />
                  ))}
                </span>
              )}
            </span>
          ))}
        </>
      )}

      {layout === 'editorial' && (
        <>
          {day ? (
            <span className="dz-item dz-numeral" style={pos({ x: 70, y: 8, z: 0.25, s: 0 })}>
              {day}
            </span>
          ) : null}
          <span className="dz-rule dz-rule-a" />
          <span className="dz-rule dz-rule-b" />
          {MOTES.map((p, i) => (
            <span key={i} className="dz-item" style={pos(p)}>
              <span className="dz-spin dz-mote dz-mote-gold" />
            </span>
          ))}
        </>
      )}
    </div>
  );
}
