'use client';

// The seller hub's navigation: a sidebar on a laptop, a bottom tab bar on a
// phone. The portal used to be a single row of text links above every page,
// which a seller in the middle of a Saturday rush had to read to find
// anything. Icons, a fixed place, and the seller's own listings one tap away.
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import Logo from '@/components/Logo';
import LogoutButton from './LogoutButton';
import { translator, type Lang } from '@/lib/i18n';
import { IconExternal, IconGear, IconHome, IconPlus, IconReceipt, IconShop, IconStar, IconTag, IconTicket, ToolIconView } from './HubIcons';
import type { ToolIcon } from './listingTools';

export interface HubListing {
  id: string;
  name: string;
  kind: 'event' | 'shop';
  status: string;
  tools: { key: string; href: string; label: string; icon: ToolIcon }[];
}

interface Props {
  name: string;
  listings: HubListing[];
  isDemo: boolean;
  lang?: Lang;
}

interface NavItem {
  href: string;
  label: string;
  short: string;
  icon: ReactNode;
  /** Does this pathname belong to the item? */
  match: (path: string) => boolean;
}

function items(tr: ReturnType<typeof translator>): NavItem[] {
  return [
    { href: '/portal', label: tr('hub.home'), short: tr('hub.home'), icon: <IconHome />, match: (p) => p === '/portal' || p.startsWith('/portal/events') },
    { href: '/portal/reviews', label: tr('hub.reviews'), short: tr('hub.reviews'), icon: <IconStar />, match: (p) => p.startsWith('/portal/reviews') },
    { href: '/portal/promos', label: tr('hub.codes'), short: tr('hub.codes.short'), icon: <IconTag />, match: (p) => p.startsWith('/portal/promos') },
    { href: '/portal/statements', label: tr('hub.statements'), short: tr('hub.money'), icon: <IconReceipt />, match: (p) => p.startsWith('/portal/statements') },
    { href: '/portal/settings', label: tr('hub.settings'), short: tr('hub.settings'), icon: <IconGear />, match: (p) => p.startsWith('/portal/settings') },
  ];
}

function initials(name: string): string {
  const parts = name.replace(/\(.*?\)/g, '').trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || 'M';
}

export default function HubSidebar({ name, listings, isDemo, lang = 'en' }: Props) {
  const tr = translator(lang);
  const ITEMS = items(tr);
  const path = usePathname() ?? '/portal';
  const activeListing = listings.find((l) => path.startsWith(`/portal/events/${l.id}`))?.id;

  return (
    <>
      <aside className="hub-side" aria-label="Seller hub">
        <div className="hub-side-top">
          <Link href="/portal" className="hub-brand" aria-label="Seller hub home">
            <Logo size={18} />
          </Link>
          <div className="hub-account">
            <span className="hub-avatar" aria-hidden="true">
              {initials(name)}
            </span>
            <span className="hub-account-text">
              <span className="hub-account-name">{name}</span>
              <span className="hub-account-role">{isDemo ? `Demo · ${tr('hub.role')}` : tr('hub.role')}</span>
            </span>
          </div>
        </div>

        <nav className="hub-nav" aria-label="Main">
          {ITEMS.map((item) => {
            const on = item.match(path) && !(item.href === '/portal' && activeListing);
            return (
              <Link key={item.href} href={item.href} className={`hub-link${on ? ' hub-link-on' : ''}`} aria-current={on ? 'page' : undefined}>
                {item.icon}
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="hub-section">
          <div className="hub-section-head">
            <span>{tr('hub.listings')}</span>
            <Link href="/portal#new" className="hub-add" aria-label="Create a new event or shop">
              <IconPlus />
            </Link>
          </div>
          {listings.length === 0 ? (
            <p className="hub-empty">Nothing yet — create your first event or shop.</p>
          ) : (
            <ul className="hub-listings">
              {listings.map((l) => (
                <li key={l.id}>
                  <Link
                    href={`/portal/events/${l.id}`}
                    className={`hub-listing${activeListing === l.id ? ' hub-link-on' : ''}`}
                    title={l.name}
                  >
                    {l.kind === 'shop' ? <IconShop /> : <IconTicket />}
                    <span className="hub-listing-name">{l.name}</span>
                    <span
                      className={`hub-dot hub-dot-${l.status === 'published' ? 'live' : l.status === 'draft' ? 'draft' : 'off'}`}
                      aria-label={l.status === 'published' ? 'Live' : l.status === 'draft' ? 'Draft' : 'Archived'}
                    />
                  </Link>
                  {/* The open listing unfolds into its tools, so Insights,
                      Kitchen, Check-in… are one tap away from anywhere. */}
                  {activeListing === l.id && (
                    <ul className="hub-subtools">
                      {l.tools.map((t) => {
                        const on = t.key === 'overview' ? path === t.href : path.startsWith(t.href.split('?')[0]);
                        return (
                          <li key={t.key}>
                            <Link href={t.href} className={`hub-subtool${on ? ' hub-subtool-on' : ''}`} aria-current={on ? 'page' : undefined}>
                              <ToolIconView icon={t.icon} />
                              <span>{t.label}</span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="hub-side-foot">
          <Link href="/market" className="hub-link hub-link-quiet">
            <IconExternal />
            <span>{tr('hub.viewBazaar')}</span>
          </Link>
          <LogoutButton />
        </div>
      </aside>

      {/* Phone: the same five places as a bottom tab bar. */}
      <nav className="hub-tabbar" aria-label="Seller hub">
        {ITEMS.map((item) => {
          const on = item.match(path);
          return (
            <Link key={item.href} href={item.href} className={`hub-tab${on ? ' hub-tab-on' : ''}`} aria-current={on ? 'page' : undefined}>
              {item.icon}
              <span>{item.short}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
