'use client';

// The site header's controls: a segmented Events | Bazaar switch with a pill
// that slides to the page you are on, then search and the organizer door.
// One layout for every width — on a phone the organizer label folds into its
// icon, so nothing is dropped and nothing wraps.
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';

interface Props {
  events: string;
  bazaar: string;
  organizer: string;
  organizerShort: string;
  search: string;
  /** The language switch, placed with the other tools on the right. */
  lang?: ReactNode;
  /** "Your account" — the customer's orders (/account). */
  account: string;
  signedIn?: boolean;
}

function sectionOf(path: string): 0 | 1 | -1 {
  if (path === '/' || path.startsWith('/?')) return 0;
  if (path.startsWith('/market')) return 1;
  return -1;
}

export default function HeaderNav({ events, bazaar, organizer, organizerShort, search, lang, account, signedIn = false }: Props) {
  const path = usePathname() ?? '/';
  const [active, setActive] = useState(sectionOf(path));
  // Follow real navigation (back button, links elsewhere on the page).
  useEffect(() => setActive(sectionOf(path)), [path]);

  return (
    <>
      <nav aria-label="Main" className="gn-seg" data-active={active}>
        <span className="gn-seg-pill" aria-hidden="true" />
        <Link href="/" className="gn-seg-item" aria-current={active === 0 ? 'page' : undefined} onClick={() => setActive(0)}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 8.5V6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2.5a2 2 0 0 0 0 4V15a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-2.5a2 2 0 0 0 0-4Z" />
            <path d="M14 5v11" strokeDasharray="2 2" />
          </svg>
          <span>{events}</span>
        </Link>
        <Link href="/market" className="gn-seg-item" aria-current={active === 1 ? 'page' : undefined} onClick={() => setActive(1)}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 8h14l-1 11H6L5 8Z" />
            <path d="M9 10V7a3 3 0 0 1 6 0v3" />
          </svg>
          <span>{bazaar}</span>
        </Link>
      </nav>
      <div className="gn-tools">
        {lang}
        <Link href="/market?focus=search" className="gn-icon" aria-label={search} title={search}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="6.5" />
            <path d="m16 16 4 4" />
          </svg>
        </Link>
        <Link href="/account" className="gn-icon gn-account" aria-label={account} title={account}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="8.5" r="3.5" />
            <path d="M5 19.5a7 7 0 0 1 14 0" />
          </svg>
          {signedIn ? <span className="gn-account-dot" aria-hidden="true" /> : null}
        </Link>
        <Link href="/portal" className="gn-org" aria-label={organizer} title={organizer}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 9.5 5.5 5h13L20 9.5" />
            <path d="M4 9.5a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0" />
            <path d="M5.5 12v7h13v-7M10 19v-4h4v4" />
          </svg>
          <span className="gn-org-label">{organizerShort}</span>
        </Link>
      </div>
    </>
  );
}
