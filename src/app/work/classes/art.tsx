// Drawn pictures for the class booking demo: the made-up teachers as little
// illustrated portraits (no photos of anyone), the school's mark and a small
// icon per subject. Plain SVG, coloured from the CSS where it can be.

import type { ReactNode } from 'react';
import type { Subject, TeacherId } from './booking';

type Look = {
  bg: string;
  skin: string;
  hair: string;
  top: string;
  style: 'long' | 'bun' | 'short' | 'topi' | 'plait';
  tika?: boolean;
  glasses?: boolean;
  earrings?: boolean;
  flower?: boolean;
};

const LOOKS: Record<TeacherId, Look> = {
  kamala: { bg: '#ffd9b0', skin: '#c98d62', hair: '#2b1a14', top: '#d9472b', style: 'plait', tika: true, earrings: true },
  ramesh: { bg: '#cfe0ff', skin: '#b97f55', hair: '#231815', top: '#2c4a8c', style: 'short', glasses: true },
  anjana: { bg: '#f7cde3', skin: '#d4a07a', hair: '#1d1412', top: '#b13a7a', style: 'bun', flower: true, earrings: true },
  dipesh: { bg: '#c7eadf', skin: '#a8714a', hair: '#1a1210', top: '#1e7a63', style: 'topi' },
  sushma: { bg: '#dcd6ff', skin: '#c08a60', hair: '#2a1b16', top: '#5b4bc4', style: 'long', tika: true, earrings: true },
};

export function TeacherAvatar({ id, size = 40, label }: { id: TeacherId; size?: number; label?: string }) {
  const l = LOOKS[id];
  return (
    <svg
      className="cb-avatar"
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <g>
        <rect width="64" height="64" fill={l.bg} />
        {(l.style === 'long' || l.style === 'plait') && <path d="M17 30 C15 12 49 12 47 30 L49 54 C42 58 22 58 15 54 Z" fill={l.hair} />}
        {l.style === 'plait' && <path d="M44 34 C50 42 46 50 50 60" stroke={l.hair} strokeWidth="5" strokeLinecap="round" fill="none" />}
        <path d="M8 66 C10 50 21 45 32 45 C43 45 54 50 56 66 Z" fill={l.top} />
        <path d="M26 45 L32 52 L38 45" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1.6" />
        <rect x="28" y="36" width="8" height="10" rx="3" fill={l.skin} />
        <ellipse cx="32" cy="29" rx="11.5" ry="13.5" fill={l.skin} />
        {l.style === 'bun' && <circle cx="32" cy="13" r="6.5" fill={l.hair} />}
        {l.style === 'short' && <path d="M20.5 27 C19 13 45 12 43.5 27 C41 20 33 18.5 26 20.5 C23 22 21.5 24 20.5 27 Z" fill={l.hair} />}
        {l.style === 'topi' && (
          <>
            <path d="M21 26 C20 20 22 18 25 18 L41 18 C43 18 44 21 43 26 C39 22 25 22 21 26 Z" fill={l.hair} />
            <path d="M21.5 19.5 L23.5 8.5 L42 10.5 L42.5 20 Z" fill="#7a2e2e" />
            <path d="M22.4 15 L42.2 16.2 M23 12 L42.1 13.4" stroke="#e8b04a" strokeWidth="1.3" />
            <path d="M26 10 l2 6 M31 10.4 l2 6 M36 10.9 l2 6" stroke="#2d6a8f" strokeWidth="1.2" />
          </>
        )}
        {(l.style === 'long' || l.style === 'plait' || l.style === 'bun') && (
          <path d="M20 29 C19 15 45 15 44 29 C42 22 36 19 32 18.5 C29 20.5 24 23 20 29 Z" fill={l.hair} />
        )}
        {l.flower && <circle cx="38.5" cy="11" r="2.6" fill="#ffb3c7" stroke="#e05a86" strokeWidth="1" />}
        <circle cx="27.2" cy="29.5" r="1.35" fill="#2a1d1a" />
        <circle cx="36.8" cy="29.5" r="1.35" fill="#2a1d1a" />
        <path d="M28.4 35.4 Q32 38.4 35.6 35.4" stroke="#6b3324" strokeWidth="1.4" fill="none" strokeLinecap="round" />
        {l.tika && <ellipse cx="32" cy="23.4" rx="1.1" ry="1.6" fill="#d0172b" />}
        {l.glasses && (
          <g fill="none" stroke="#2a1d1a" strokeWidth="1.2">
            <circle cx="27.2" cy="29.5" r="3.6" />
            <circle cx="36.8" cy="29.5" r="3.6" />
            <path d="M30.8 29.4 h2.4" />
          </g>
        )}
        {l.earrings && (
          <>
            <circle cx="20.6" cy="34" r="1.3" fill="#e2b13c" />
            <circle cx="43.4" cy="34" r="1.3" fill="#e2b13c" />
          </>
        )}
      </g>
    </svg>
  );
}

/** A soft initial bubble for a student (no pictures of students at all). */
export function Initial({ name, you }: { name: string; you?: boolean }) {
  const ch = name.trim().charAt(0).toUpperCase() || '?';
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return (
    <span className={`cb-initial${you ? ' is-you' : ''}`} style={{ ['--h' as string]: String(h) }} aria-hidden="true">
      {ch}
    </span>
  );
}

/** The school's mark: a carved Newari-style window arch over "आ". */
export function SchoolMark({ size = 40 }: { size?: number }) {
  return (
    <svg className="cb-mark" width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <rect width="48" height="48" rx="13" fill="var(--cb-red)" />
      <path d="M10 40 V22 C10 13 17 8 24 8 C31 8 38 13 38 22 V40" fill="none" stroke="#ffd58a" strokeWidth="2.4" />
      <path d="M14.5 40 V23 C14.5 16.5 19 12.6 24 12.6 C29 12.6 33.5 16.5 33.5 23 V40" fill="none" stroke="#ffd58a" strokeWidth="1.2" strokeDasharray="1.6 2.2" />
      <text x="24" y="35" textAnchor="middle" fontSize="17" fontWeight="800" fill="#fff" fontFamily="var(--cb-font), system-ui, sans-serif">
        आ
      </text>
    </svg>
  );
}

export function SubjectIcon({ subject }: { subject: Subject }) {
  return (
    <span className={`cb-sicon cb-s-${subject}`} aria-hidden="true">
      {subject === 'kids' && <b>क</b>}
      {subject === 'adults' && <b>अ</b>}
      {subject === 'dance' && (
        <svg viewBox="0 0 24 24">
          <circle cx="12" cy="4.5" r="2.2" fill="currentColor" />
          <path d="M12 7.5 L11 14 L7 21 M11 14 L15.5 20.5 M5 9.5 C8 11 12 10 12 10 C14 9 17 6.5 19 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      {subject === 'madal' && (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
          <ellipse cx="4.5" cy="12" rx="2.2" ry="5" strokeWidth="2" />
          <ellipse cx="19.5" cy="12" rx="2.2" ry="5" strokeWidth="2" />
          <path d="M4.5 7 C9 5.6 15 5.6 19.5 7 M4.5 17 C9 18.4 15 18.4 19.5 17" strokeWidth="2" />
          <path d="M6.5 7.4 L9 16.6 L12 6.6 L15 16.6 L17.5 7.4" strokeWidth="1.3" />
        </svg>
      )}
      {subject === 'harmonium' && (
        <svg viewBox="0 0 24 24">
          <rect x="3" y="6" width="18" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M7 11 V18 M11 11 V18 M15 11 V18 M3 11 H21" stroke="currentColor" strokeWidth="1.4" />
          <path d="M6 11 V14.5 M9.5 11 V14.5 M13.5 11 V14.5 M17 11 V14.5" stroke="currentColor" strokeWidth="2.4" />
        </svg>
      )}
    </span>
  );
}

export function Icon({ name }: { name: 'grid' | 'cal' | 'ticket' | 'today' | 'chart' | 'note' | 'qr' | 'clock' | 'pin' | 'check' | 'bell' | 'x' | 'chev-l' | 'chev-r' | 'reset' | 'users' }) {
  const p: Record<string, ReactNode> = {
    grid: <path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" />,
    cal: <path d="M4 6h16v14H4zM4 10h16M8 3v5M16 3v5" />,
    ticket: <path d="M3 8a2 2 0 0 0 0 4v0a2 2 0 0 1 0 4v2h18v-2a2 2 0 0 1 0-4v0a2 2 0 0 0 0-4V6H3zM14 6v12" />,
    today: <path d="M4 6h16v14H4zM4 10h16M8 3v5M16 3v5M10 14h4v3h-4z" />,
    chart: <path d="M4 20V10M10 20V4M16 20v-8M22 20H2" />,
    note: <path d="M5 4h14v12l-5 5H5zM14 21v-5h5M8 9h8M8 13h5" />,
    qr: <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v2M14 18h2v2M18 18h2v2" />,
    clock: <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2" />,
    pin: <path d="M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12zM12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" />,
    check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
    bell: <path d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0" />,
    x: <path d="M6 6l12 12M18 6L6 18" />,
    'chev-l': <path d="M15 5l-7 7 7 7" />,
    'chev-r': <path d="M9 5l7 7-7 7" />,
    reset: <path d="M4 12a8 8 0 1 0 2.5-5.8M4 4v4.5h4.5" />,
    users: <path d="M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20c.5-3.5 3-5.5 6.5-5.5s6 2 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 6.5M18 14.8c2 .6 3.3 2.3 3.6 5.2" />,
  };
  return (
    <svg className="cb-ico" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {p[name]}
    </svg>
  );
}
