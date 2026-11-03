// Drawings for "Dui Kinara Radio": the station mark (two shores and a wave
// between them), the made-up hosts' avatars, show covers and generic icons
// (no real brand logos anywhere — the subscribe buttons use plain podcast,
// music, feed and link symbols).

import { useId, type CSSProperties, type ReactNode } from 'react';
import { HOSTS, SHOWS, type AvatarLook } from './content';
import type { HostId, ShowId } from './radio';

/** An id safe for url(#…) references, unique per drawing. */
function useSvgId(prefix: string): string {
  return `${prefix}${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
}

export function StationMark({ className, size = 40 }: { className?: string; size?: number }) {
  const gid = useSvgId('rd-mark');
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffb547" />
          <stop offset="1" stopColor="#e2416b" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="#1b1638" />
      {/* two shores */}
      <path d="M4 44 L16 30 L24 38 L30 32 L30 52 L4 52 Z" fill={`url(#${gid})`} />
      <path d="M60 44 L48 28 L40 38 L34 33 L34 52 L60 52 Z" fill={`url(#${gid})`} opacity="0.85" />
      {/* the wave between them */}
      <path d="M10 22 Q16 14 22 22 T34 22 T46 22 T58 22" fill="none" stroke="#fff3df" strokeWidth="3.4" strokeLinecap="round" />
      <circle cx="32" cy="10" r="3" fill="#fff3df" />
    </svg>
  );
}

function Hair({ look }: { look: AvatarLook }) {
  const c = look.hair;
  switch (look.style) {
    case 'long':
      return (
        <>
          <path d="M18 34 C16 16 30 9 40 10 C52 11 62 20 60 38 L62 66 L54 66 L54 34 C46 30 36 26 28 22 C26 30 24 40 26 66 L16 66 Z" fill={c} />
        </>
      );
    case 'bun':
      return (
        <>
          <circle cx="40" cy="9" r="8" fill={c} />
          <path d="M20 34 C18 18 30 12 40 12 C52 12 62 20 60 34 C54 26 44 22 32 22 C26 24 22 28 20 34 Z" fill={c} />
        </>
      );
    case 'braid':
      return (
        <>
          <path d="M20 34 C18 18 30 12 40 12 C52 12 62 20 60 34 C54 25 44 21 31 22 C25 24 22 29 20 34 Z" fill={c} />
          <path d="M58 30 C64 40 62 52 58 62" stroke={c} strokeWidth="6" strokeLinecap="round" fill="none" />
        </>
      );
    case 'curly':
      return (
        <g fill={c}>
          {[22, 30, 38, 46, 54, 26, 50].map((x, i) => (
            <circle key={i} cx={x} cy={i < 5 ? 17 + (i % 2) * 2 : 24} r="7" />
          ))}
          <circle cx="20" cy="28" r="5" />
          <circle cx="58" cy="28" r="5" />
        </g>
      );
    case 'cap':
      return (
        <>
          <path d="M19 30 C19 16 30 11 40 11 C51 11 61 17 61 30 Z" fill="#2563eb" />
          <path d="M40 30 L70 30 C70 34 64 35 58 34 L40 33 Z" fill="#1d4ed8" />
          <circle cx="40" cy="12" r="2.4" fill="#93c5fd" />
          <path d="M21 31 C21 36 22 38 23 40 L24 31 Z M59 31 C59 36 58 38 57 40 L56 31 Z" fill={c} />
        </>
      );
    default:
      return <path d="M20 32 C18 17 30 11 40 11 C52 11 62 18 60 32 C56 24 48 20 40 21 C32 20 24 24 20 32 Z" fill={c} />;
  }
}

/** A made-up host, drawn: round head on a coloured disc, headphones on. */
export function Avatar({ host, size = 56, className }: { host: HostId; size?: number; className?: string }) {
  const look = HOSTS[host].look;
  const id = useSvgId(`rd-av-${host}`);
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 80 80" aria-hidden="true">
      <defs>
        <clipPath id={id}>
          <circle cx="40" cy="40" r="40" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id})`}>
        <rect width="80" height="80" fill={look.bg} />
        {/* shoulders */}
        <path d="M8 80 C10 62 24 56 40 56 C56 56 70 62 72 80 Z" fill="#2b2457" />
        <path d="M33 56 L40 66 L47 56 Z" fill="#fff3df" />
        {/* neck + head */}
        <rect x="34" y="44" width="12" height="14" rx="5" fill={look.skin} />
        <ellipse cx="40" cy="34" rx="19" ry="21" fill={look.skin} />
        <Hair look={look} />
        {/* face */}
        <circle cx="33" cy="35" r="2.1" fill="#1d1430" />
        <circle cx="47" cy="35" r="2.1" fill="#1d1430" />
        <path d="M34 44 Q40 49 46 44" stroke="#1d1430" strokeWidth="2" fill="none" strokeLinecap="round" />
        <circle cx="29" cy="41" r="3" fill="#e2416b" opacity="0.22" />
        <circle cx="51" cy="41" r="3" fill="#e2416b" opacity="0.22" />
        {look.extra === 'glasses' && (
          <g stroke="#1d1430" strokeWidth="1.8" fill="none">
            <circle cx="33" cy="35" r="5.4" />
            <circle cx="47" cy="35" r="5.4" />
            <path d="M38.4 35 L41.6 35" />
          </g>
        )}
        {look.extra === 'tika' && <ellipse cx="40" cy="25" rx="1.8" ry="2.6" fill="#d61f45" />}
        {look.extra === 'earrings' && (
          <g fill="#f5b70a">
            <circle cx="21" cy="42" r="2.2" />
            <circle cx="59" cy="42" r="2.2" />
          </g>
        )}
        {look.extra === 'beard' && <path d="M24 38 C26 54 34 56 40 56 C46 56 54 54 56 38 C52 46 46 47 40 47 C34 47 28 46 24 38 Z" fill={look.hair} opacity="0.85" />}
        {/* headphones */}
        <path d="M18 36 C18 18 28 10 40 10 C52 10 62 18 62 36" stroke="#1b1638" strokeWidth="4" fill="none" />
        <rect x="13" y="31" width="9" height="15" rx="4" fill="#1b1638" />
        <rect x="58" y="31" width="9" height="15" rx="4" fill="#1b1638" />
      </g>
    </svg>
  );
}

/** Hosts side by side (a show can have two); the mix shows the station mark. */
export function HostFaces({ show, size = 48, className }: { show: ShowId; size?: number; className?: string }) {
  const hosts = SHOWS[show].hosts;
  if (!hosts.length) return <StationMark className={className} size={size} />;
  return (
    <span className={`rd-faces ${className ?? ''}`} style={{ '--rd-face': `${size}px` } as CSSProperties}>
      {hosts.map((h) => (
        <Avatar key={h} host={h} size={size} />
      ))}
    </span>
  );
}

/** Square cover for a show or an episode: its colours, a sound wave, the hosts. */
export function ShowCover({ show, className, seed = 0 }: { show: ShowId; className?: string; seed?: number }) {
  const [a, b] = SHOWS[show].hue;
  const gid = useSvgId(`rd-cov-${show}`);
  // Rounded: Math.sin may differ in the last digit between the server and the browser.
  const bars = Array.from({ length: 14 }, (_, i) => Math.round(8 + Math.abs(Math.sin(i * 1.7 + seed)) * 26 + (i % 3) * 3));
  const hosts = SHOWS[show].hosts;
  return (
    <svg className={className} viewBox="0 0 120 120" aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={a} />
          <stop offset="1" stopColor={b} />
        </linearGradient>
      </defs>
      <rect width="120" height="120" rx="18" fill={`url(#${gid})`} />
      <g fill="#fff" opacity="0.28">
        {bars.map((h, i) => (
          <rect key={i} x={8 + i * 7.6} y={60 - h / 2} width="4" height={h} rx="2" />
        ))}
      </g>
      {hosts.length === 0 ? (
        <path d="M24 92 Q36 80 48 92 T72 92 T96 92" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
      ) : (
        hosts.map((h, i) => (
          <g key={h} transform={`translate(${hosts.length === 1 ? 38 : 18 + i * 40} 64)`}>
            <Avatar host={h} size={44} />
          </g>
        ))
      )}
    </svg>
  );
}

// ---------- generic icons ----------

type I = { className?: string };
const icon = (d: ReactNode) =>
  function Icon({ className }: I) {
    return (
      <svg className={className} width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {d}
      </svg>
    );
  };

export const IconPlay = ({ className }: I) => (
  <svg className={className} width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="currentColor" d="M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" />
  </svg>
);
export const IconPause = ({ className }: I) => (
  <svg className={className} width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
    <rect x="6" y="5" width="4.2" height="14" rx="1.2" fill="currentColor" />
    <rect x="13.8" y="5" width="4.2" height="14" rx="1.2" fill="currentColor" />
  </svg>
);
export const IconUp = icon(<path d="M6 15l6-6 6 6" />);
export const IconDown = icon(<path d="M6 9l6 6 6-6" />);
export const IconBack15 = icon(
  <>
    <path d="M4 12a8 8 0 1 0 2.4-5.7" />
    <path d="M4 4v4h4" />
    <text x="12" y="15.5" fontSize="7.5" textAnchor="middle" fill="currentColor" stroke="none" fontWeight="700">
      15
    </text>
  </>
);
export const IconFwd15 = icon(
  <>
    <path d="M20 12a8 8 0 1 1-2.4-5.7" />
    <path d="M20 4v4h-4" />
    <text x="12" y="15.5" fontSize="7.5" textAnchor="middle" fill="currentColor" stroke="none" fontWeight="700">
      15
    </text>
  </>
);
export const IconPrev = icon(
  <>
    <path d="M18 6l-8 6 8 6z" fill="currentColor" />
    <path d="M6 6v12" />
  </>
);
export const IconNext = icon(
  <>
    <path d="M6 6l8 6-8 6z" fill="currentColor" />
    <path d="M18 6v12" />
  </>
);
export const IconVolume = icon(
  <>
    <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
    <path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11" />
  </>
);
export const IconMuted = icon(
  <>
    <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
    <path d="M17 9l5 6M22 9l-5 6" />
  </>
);
export const IconBell = icon(
  <>
    <path d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4z" />
    <path d="M10 20a2 2 0 0 0 4 0" />
  </>
);
export const IconRadio = icon(
  <>
    <rect x="3" y="8" width="18" height="12" rx="2" />
    <path d="M7 8l10-5" />
    <circle cx="15" cy="14" r="3" />
    <path d="M6 12h3M6 15h3" />
  </>
);
export const IconBack = icon(<path d="M15 6l-6 6 6 6" />);
/** Generic feed symbol (a dot and two arcs). */
export const IconFeed = icon(
  <>
    <circle cx="6" cy="18" r="1.6" fill="currentColor" />
    <path d="M4 11a9 9 0 0 1 9 9M4 4a16 16 0 0 1 16 16" />
  </>
);
/** Generic podcast app: a microphone with signal arcs. */
export const IconPodApp = icon(
  <>
    <rect x="9.5" y="6" width="5" height="9" rx="2.5" />
    <path d="M12 15v4M9 20h6" />
    <path d="M6.5 8.5a7 7 0 0 0 0 7M17.5 8.5a7 7 0 0 1 0 7" />
  </>
);
/** Generic music app: two notes. */
export const IconMusic = icon(
  <>
    <path d="M9 17V6l10-2v11" />
    <circle cx="7" cy="17" r="2.2" fill="currentColor" />
    <circle cx="17" cy="15" r="2.2" fill="currentColor" />
  </>
);
export const IconLink = icon(
  <>
    <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
    <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
  </>
);
