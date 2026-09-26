import { platformWordmark } from '@/lib/platform';

/**
 * The logo lockup: Nepal's double pennant, flying from a pole, next to the
 * two-tone wordmark.
 *
 * The mark is drawn as an object rather than a flat icon: the crimson face is
 * lit from the top left and falls into shadow, the deep-blue border is
 * bevelled, a darker copy behind it gives the cloth thickness, and it hangs on
 * a metal pole with a gold finial. It moves the way a flag does: the pennant's
 * outline waves (SVG path morphing, so it runs without JavaScript and in every
 * browser), a sheen sweeps across it now and then, and the sun's rays turn
 * slowly. The moon and sun are the flag's own symbols, not dots. Visitors
 * who asked for reduced motion get it still (components/LogoMotion).
 *
 * The wordmark comes from the same splitter the email masthead uses, so
 * PLATFORM_NAME renames the logo along with everything else.
 *
 * Every call site is a server component, so reading the environment here is
 * fine; if one ever becomes a client component this needs to arrive as a prop.
 */

// The pennant's outline in four poses of the wind. Every pose has the same
// commands in the same order, which is what lets the browser morph between
// them. Hoist (the pole edge, x=4) never moves; the tips and edges do.
const POSES = [
  'M4 1.5 Q14 7.2 24 13 Q17.7 13 11.5 13 Q18.8 21 26 29 Q15 29 4 29 Z',
  'M4 1.5 Q13 5.3 24.3 14.1 Q17.6 12.2 11.5 13.5 Q19.6 19.6 26.2 29.9 Q15 30.7 4 29 Z',
  'M4 1.5 Q14 7.2 24 13 Q17.7 13 11.5 13 Q18.8 21 26 29 Q15 29 4 29 Z',
  'M4 1.5 Q15 8.7 23.7 12.2 Q17.8 14 11.5 12.7 Q18 22.5 25.8 28.2 Q15 27.5 4 29 Z',
];
const WAVE = [...POSES, POSES[0]].join(';');
const WAVE_TIMES = '0;0.25;0.5;0.75;1';
const WAVE_EASE = '0.45 0 0.55 1;0.45 0 0.55 1;0.45 0 0.55 1;0.45 0 0.55 1';
const WAVE_DUR = '4.6s';

/** A star-shaped sun or moon glow: `points` rays between two radii. */
function rays(cx: number, cy: number, outer: number, inner: number, points: number): string {
  const out: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI * i) / points - Math.PI / 2;
    out.push(`${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`);
  }
  return out.join(' ');
}

const SUN = rays(10.5, 22.4, 3.2, 1.95, 12);
const MOON_GLOW = rays(10, 8.6, 1.55, 0.8, 8);
// Horns up: the deeper lower arc, back along a shallower one.
const CRESCENT = 'M7.4 8.4 A2.6 2.6 0 0 0 12.6 8.4 A2.75 2.75 0 0 1 7.4 8.4 Z';

export default function Logo({ size = 24 }: { size?: number }) {
  const { head, accent } = platformWordmark();
  const markWidth = Math.round((size * 28) / 32);
  // Gradient ids must be unique per drawing; a page shows the logo at most
  // once per size (header, footer), and same-size copies are identical.
  const id = (name: string) => `mn${size}${name}`;
  const url = (name: string) => `url(#${id(name)})`;
  return (
    <span className="logo-lockup" style={{ gap: Math.max(6, Math.round(size * 0.3)) }}>
      <svg className="logo-mark" width={markWidth} height={size} viewBox="0 0 28 32" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id={id('face')} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ff5c78" />
            <stop offset="0.42" stopColor="#dc143c" />
            <stop offset="1" stopColor="#860a26" />
          </linearGradient>
          <linearGradient id={id('edge')} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#4d7ff0" />
            <stop offset="0.5" stopColor="#0a3a9e" />
            <stop offset="1" stopColor="#001a52" />
          </linearGradient>
          <linearGradient id={id('pole')} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#6b6b7c" />
            <stop offset="0.35" stopColor="#f4f4fa" />
            <stop offset="1" stopColor="#50505e" />
          </linearGradient>
          <radialGradient id={id('gold')} cx="0.35" cy="0.3" r="0.8">
            <stop offset="0" stopColor="#fff4c2" />
            <stop offset="0.5" stopColor="#f5b700" />
            <stop offset="1" stopColor="#8a5a00" />
          </radialGradient>
          <linearGradient id={id('sheen')} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset="0.5" stopColor="#fff" stopOpacity="0.6" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={id('gloss')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0.32" />
            <stop offset="0.45" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <clipPath id={id('cloth')}>
            <path d={POSES[0]}>
              <animate attributeName="d" values={WAVE} keyTimes={WAVE_TIMES} keySplines={WAVE_EASE} calcMode="spline" dur={WAVE_DUR} repeatCount="indefinite" />
            </path>
          </clipPath>
        </defs>

        {/* The pole and its gold finial. */}
        <rect x="1.35" y="1.2" width="1.7" height="30.4" rx="0.85" fill={url('pole')} />
        <circle cx="2.2" cy="1.25" r="1.2" fill={url('gold')} />

        {/* The cloth's thickness: a darker copy, a step behind. */}
        <path d={POSES[0]} transform="translate(0.9 1.1)" fill="#3d0512" opacity="0.9">
          <animate attributeName="d" values={WAVE} keyTimes={WAVE_TIMES} keySplines={WAVE_EASE} calcMode="spline" dur={WAVE_DUR} repeatCount="indefinite" />
        </path>

        {/* The face: lit crimson, bevelled blue border. */}
        <path d={POSES[0]} fill={url('face')} stroke={url('edge')} strokeWidth="1.5" strokeLinejoin="round">
          <animate attributeName="d" values={WAVE} keyTimes={WAVE_TIMES} keySplines={WAVE_EASE} calcMode="spline" dur={WAVE_DUR} repeatCount="indefinite" />
        </path>

        <g clipPath={url('cloth')}>
          {/* Light on the top of the cloth, and the sheen that sweeps across. */}
          <rect x="0" y="0" width="28" height="32" fill={url('gloss')} />
          <rect x="-12" y="-2" width="7" height="36" fill={url('sheen')} transform="skewX(-18)">
            <animate attributeName="x" values="-12;-12;34" keyTimes="0;0.62;1" dur="5.2s" repeatCount="indefinite" />
          </rect>
        </g>

        {/* Moon and sun, embossed, riding the wave with the cloth. */}
        <g>
          <animateTransform
            attributeName="transform"
            type="translate"
            values="0 0;0.25 0.45;0 0;0.2 -0.35;0 0"
            keyTimes={WAVE_TIMES}
            keySplines={WAVE_EASE}
            calcMode="spline"
            dur={WAVE_DUR}
            repeatCount="indefinite"
          />
          <g transform="translate(0.35 0.45)" fill="#5a0617" opacity="0.55">
            <path d={CRESCENT} />
            <polygon points={MOON_GLOW} />
            <polygon points={SUN} />
          </g>
          <g fill="#fff">
            <path d={CRESCENT} />
            <polygon points={MOON_GLOW} />
            <g>
              <animateTransform attributeName="transform" type="rotate" from="0 10.5 22.4" to="360 10.5 22.4" dur="26s" repeatCount="indefinite" />
              <polygon points={SUN} />
            </g>
            <circle cx="10.5" cy="22.4" r="1.45" fill="#fff6f7" />
          </g>
        </g>
      </svg>
      <span className="logo-word" style={{ fontSize: Math.round(size * 0.84) }}>
        <span className="logo-word-np">{head}</span>
        {accent && <span className="logo-word-co">{accent}</span>}
      </span>
    </span>
  );
}
