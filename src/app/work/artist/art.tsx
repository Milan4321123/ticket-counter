// Drawn artwork for the demo artist page — no photos of anybody. The portrait
// is a silhouette of a made-up singer against a stage light; the covers are
// small landscapes. The portrait SVG is self-contained (its own gradients and
// filter, plain attributes) so the press-kit one-sheet can draw it onto a
// canvas as an image.

import type { TrackId } from './content';

/** The singer: a profile silhouette at a microphone, rim-lit from behind. */
export function Portrait({ className, id = 'ar-portrait' }: { className?: string; id?: string }) {
  return (
    <svg id={id} className={className} viewBox="0 0 400 500" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Illustrated silhouette of the singer at a microphone">
      <defs>
        <radialGradient id="ar-spot" cx="52%" cy="34%" r="58%">
          <stop offset="0" stopColor="#ffe3a6" />
          <stop offset="0.22" stopColor="#ffb347" />
          <stop offset="0.55" stopColor="#c2417a" stopOpacity="0.75" />
          <stop offset="1" stopColor="#1a1240" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="ar-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#140d26" />
          <stop offset="1" stopColor="#07050f" />
        </linearGradient>
        <linearGradient id="ar-floor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ff6f91" stopOpacity="0" />
          <stop offset="1" stopColor="#ff6f91" stopOpacity="0.35" />
        </linearGradient>
        <filter id="ar-rim" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3.2" />
        </filter>
        <g id="ar-fig">
          {/* torso */}
          <path d="M70 500C76 410 104 340 160 312C180 302 196 296 204 286L230 286C240 296 262 304 282 316C320 340 336 410 340 500Z" />
          {/* neck */}
          <path d="M200 292L205 214L238 214L233 292Z" />
          {/* face in profile, singing to the right */}
          <path d="M176 104C196 86 236 88 248 116C252 126 252 136 251 144L262 166C263 169 260 171 254 172C255 176 256 180 253 183C256 186 254 191 250 192C251 200 248 210 240 214C232 220 220 222 210 222C186 222 166 200 162 168C158 140 162 116 176 104Z" />
          {/* hair, falling down the back */}
          <path d="M168 100C194 76 242 80 252 112C238 104 222 104 212 112C206 130 204 150 202 172C200 204 206 238 216 272C192 292 160 302 132 298C148 270 144 238 148 206C138 176 144 128 168 100Z" />
          {/* bun */}
          <circle cx="164" cy="106" r="24" />
          {/* microphone on its stand */}
          <path d="M293 210L352 500" stroke="#07050f" strokeWidth="6" strokeLinecap="round" fill="none" />
          <rect x="268" y="184" width="40" height="18" rx="9" transform="rotate(-24 288 193)" />
        </g>
      </defs>

      <rect width="400" height="500" fill="#0d0a22" />
      <circle cx="210" cy="170" r="190" fill="url(#ar-spot)" />
      {/* a slow mandala of light behind the head */}
      <g className="ar-halo" transform="translate(210 160)" fill="none" stroke="#ffe3a6" strokeOpacity="0.38">
        <circle r="92" strokeWidth="1.2" />
        <circle r="118" strokeWidth="0.8" strokeDasharray="2 7" />
        {Array.from({ length: 24 }, (_, i) => (
          <path key={i} d="M0 -96 C10 -110 10 -124 0 -136 C-10 -124 -10 -110 0 -96Z" transform={`rotate(${i * 15})`} strokeWidth="1" />
        ))}
      </g>
      {/* haze beams */}
      <path d="M60 0L170 500H120L0 40Z" fill="#ffd28a" opacity="0.07" />
      <path d="M340 0L260 500H310L400 60Z" fill="#c69bff" opacity="0.08" />
      <rect y="380" width="400" height="120" fill="url(#ar-floor)" />

      {/* rim light: the figure in warm light, blurred, just behind the dark figure */}
      <use href="#ar-fig" fill="#ffc46b" stroke="#ffc46b" strokeWidth="5" filter="url(#ar-rim)" transform="translate(-3 -2)" />
      <use href="#ar-fig" fill="url(#ar-body)" />
      {/* lali gurans in her hair */}
      <g transform="translate(150 86)">
        {Array.from({ length: 5 }, (_, i) => (
          <ellipse key={i} cx="0" cy="-7" rx="5" ry="8" fill="#ff4f7b" transform={`rotate(${i * 72})`} />
        ))}
        <circle r="3.4" fill="#ffd27a" />
      </g>
      {/* glint on the microphone grille */}
      <rect x="288" y="186" width="16" height="12" rx="6" fill="#ffe3a6" opacity="0.5" transform="rotate(-24 288 193)" />
    </svg>
  );
}

/** Layered hills for the bottom of the hero. */
export function Hills({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 1440 260" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0 150L120 92L220 130L330 48L450 120L560 70L700 140L820 40L940 118L1060 66L1180 128L1300 58L1440 112V260H0Z" fill="#2a1c5c" opacity="0.65" />
      {/* snow on the three high peaks */}
      <path
        d="M330 48L366 70L352 67L341 75L328 65L313 73L297 73ZM820 40L856 63L842 60L831 68L818 58L802 67L784 70ZM1300 58L1342 74L1328 71L1316 78L1301 70L1284 78L1264 79Z"
        fill="#e8e4ff"
        opacity="0.55"
      />
      <path d="M0 190L160 140L300 182L470 128L620 186L780 136L930 190L1100 140L1260 184L1440 150V260H0Z" fill="#1a1240" />
      <path d="M0 230L200 200L420 232L640 204L880 236L1120 206L1440 232V260H0Z" fill="#0d0a22" />
    </svg>
  );
}

/** A small landscape per song for the player and the track list. */
export function Cover({ id, hue }: { id: TrackId; hue: [string, string] }) {
  const g = `ar-cv-${id}`;
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className="ar-cover-svg">
      <defs>
        <linearGradient id={g} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor={hue[0]} />
          <stop offset="1" stopColor={hue[1]} />
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill={`url(#${g})`} />
      {id === 'kuhiro' && (
        <g>
          <path d="M0 70L22 44L36 58L56 30L78 56L100 40V100H0Z" fill="#1d1b4f" opacity="0.85" />
          <path d="M56 30L62.6 37.8L59 36.6L56.6 39.6L53.6 36.8L50 38.4Z" fill="#fff" opacity="0.75" />
          {[52, 62, 72, 82].map((y, i) => (
            <rect key={y} x={i % 2 ? 10 : -6} y={y} width="90" height="3" rx="1.5" fill="#fff" opacity={0.28 - i * 0.04} />
          ))}
        </g>
      )}
      {id === 'saanjh' && (
        <g>
          <circle cx="50" cy="56" r="20" fill="#ffe08a" />
          <path d="M0 62L30 50L50 60L72 46L100 58V100H0Z" fill="#4a1a33" />
          <path d="M46 100L50 62L54 100Z" fill="#ffb347" opacity="0.6" />
        </g>
      )}
      {id === 'taara' && (
        <g fill="#fff">
          {[
            [18, 20, 1.6],
            [40, 12, 1],
            [70, 22, 1.8],
            [84, 40, 1.1],
            [28, 44, 1.2],
            [58, 36, 2.4],
            [12, 64, 1],
            [90, 70, 1.4],
          ].map(([x, y, r], i) => (
            <circle key={i} cx={x} cy={y} r={r} opacity="0.85" />
          ))}
          <path d="M0 84Q50 66 100 84V100H0Z" fill="#120f33" />
          <path d="M58 30L59.2 34.8L64 36L59.2 37.2L58 42L56.8 37.2L52 36L56.8 34.8Z" fill="#ffe3a6" />
        </g>
      )}
      {id === 'ghar' && (
        <g>
          <path d="M0 76L40 56L100 74V100H0Z" fill="#2a0e3a" />
          <path d="M34 60L50 46L66 60V80H34Z" fill="#170823" />
          <rect x="45" y="64" width="10" height="10" fill="#ffd27a" />
          <circle cx="78" cy="24" r="9" fill="#fff4d6" opacity="0.9" />
          <circle cx="82" cy="21" r="8" fill="#ff6f91" />
        </g>
      )}
    </svg>
  );
}
