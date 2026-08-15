import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import { Sora } from 'next/font/google';
import Logo from '@/components/Logo';
import './globals.css';

const sora = Sora({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-display',
  display: 'swap',
});

const PLATFORM_NAME = process.env.PLATFORM_NAME || 'NepaliConcert';

export const metadata: Metadata = {
  title: `${PLATFORM_NAME} — Nepali concerts & events`,
  description:
    'Discover Nepali concerts, cultural nights and community events near you. Reserve tickets in one click, pay by bank transfer, and get your QR tickets by email.',
};

export const viewport: Viewport = {
  themeColor: '#0a0b10',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={sora.variable}>
      <body>
        <header className="site-header">
          <div className="container header-inner">
            <Link href="/" className="brand" aria-label={`${PLATFORM_NAME} — home`}>
              <Logo size={22} />
            </Link>
            <nav
              aria-label="Main"
              style={{ display: 'flex', alignItems: 'center', gap: 18 }}
            >
              <Link
                href="/"
                className="small"
                style={{ color: 'var(--text-dim)', fontWeight: 600 }}
              >
                Browse events
              </Link>
              {/* Named for what it does. The home page's "For organizers"
                  button goes to the pitch; this one lets an organizer who
                  already works with us get straight in. Both used to say "For
                  organizers" and lead to different places, which is exactly the
                  kind of thing nobody notices until it wastes their time.
                  Deliberately the quieter button too: signing in is a utility,
                  while the brand-coloured call to action belongs to the thing we
                  actually want visitors doing — browsing events. */}
              <Link href="/portal" className="btn btn-sm">
                Organizer sign in
              </Link>
            </nav>
          </div>
        </header>
        <main className="anim-fade-up">{children}</main>
        <footer className="site-footer">
          <div className="container footer-grid">
            <div>
              <Logo size={30} />
              <p className="footer-about">
                The home of Nepali live music and culture abroad — concerts, cultural
                nights and community events from organizers you know, with QR tickets
                straight to your inbox.
              </p>
            </div>
            <nav aria-label="Footer">
              <p className="footer-heading">Explore</p>
              <ul className="footer-links">
                <li>
                  <Link href="/">Browse events</Link>
                </li>
                <li>
                  <Link href="/organizers">For organizers</Link>
                </li>
                <li>
                  <Link href="/contact">Custom page design</Link>
                </li>
                <li>
                  <Link href="/portal/login">Organizer sign-in</Link>
                </li>
                {/* No public link to /scan. The scanner is reached ONLY through
                    the signed, time-limited link an organizer generates for
                    their door staff — advertising it in the footer invited
                    strangers to a page that is none of their business, and put
                    a door-security surface one click from every visitor. */}
              </ul>
            </nav>
          </div>
          <div className="container footer-bottom">
            <p className="footer-main">{PLATFORM_NAME} — find your next night out</p>
            <p className="footer-sub">
              Made for the Nepali community · Tickets are delivered by email as QR codes —
              see you at the show.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
