// The strip of tabs across the community pages: the three places, and the
// inbox once someone has conversations. Server component — the counts are
// passed in by the page that already knows them.
import Link from 'next/link';

type Tab = 'home' | 'bhetghat' | 'sahayog' | 'kalakar' | 'inbox';

const TABS: { key: Tab; href: string; label: string; ne: string }[] = [
  { key: 'home', href: '/community', label: 'Community', ne: 'समाज' },
  { key: 'bhetghat', href: '/bhetghat', label: 'Meetups', ne: 'भेटघाट' },
  { key: 'sahayog', href: '/sahayog', label: 'Help', ne: 'सहयोग' },
  { key: 'kalakar', href: '/kalakar', label: 'Artists', ne: 'कलाकार' },
  { key: 'inbox', href: '/inbox', label: 'Inbox', ne: 'सन्देश' },
];

export default function CommunityNav({ active, unread = 0 }: { active: Tab; unread?: number }) {
  return (
    <nav className="cm-nav" aria-label="Community">
      <div className="container cm-nav-inner">
        {TABS.map((t) => (
          <Link key={t.key} href={t.href} className="cm-nav-item" aria-current={t.key === active ? 'page' : undefined}>
            <span lang="ne" className="cm-nav-ne">
              {t.ne}
            </span>
            <span>{t.label}</span>
            {t.key === 'inbox' && unread > 0 && <span className="cm-badge">{unread > 99 ? '99+' : unread}</span>}
          </Link>
        ))}
      </div>
    </nav>
  );
}
