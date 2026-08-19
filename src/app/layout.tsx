import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import { Sora } from 'next/font/google';
import ContactBubble from '@/components/ContactBubble';
import Logo from '@/components/Logo';
import { getBaseUrl } from '@/lib/config';
import { SITE_DESCRIPTION, SITE_NAME, jsonLdScript, siteJsonLd } from '@/lib/seo';
import { getPlatformContact } from '@/lib/platformPosts';
import './globals.css';

const sora = Sora({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-display',
  display: 'swap',
});

const PLATFORM_NAME = SITE_NAME;

export const metadata: Metadata = {
  /**
   * metadataBase is what turns every relative image and canonical path in this
   * app into the absolute URL that Open Graph and Google require. Without it,
   * Next emits a relative og:image, and every social preview — WhatsApp, Viber,
   * Facebook — silently falls back to a blank card. It reads the deployed
   * origin from NEXT_PUBLIC_BASE_URL, so this must be set correctly in Render.
   */
  metadataBase: new URL(getBaseUrl()),
  title: {
    default: `${PLATFORM_NAME} — Nepali concerts, cultural nights & events`,
    // Every page supplies its own short title and gets the brand appended, so a
    // search result reads "Dashain Night 2026 — Tickets | MartNepali" without
    // each page having to remember to say so.
    template: `%s | ${PLATFORM_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: PLATFORM_NAME,
  // The home page is the canonical root; every other page sets its own.
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: PLATFORM_NAME,
    title: `${PLATFORM_NAME} — Nepali concerts, cultural nights & events`,
    description: SITE_DESCRIPTION,
    url: '/',
    locale: 'en',
  },
  twitter: {
    card: 'summary_large_image',
    title: `${PLATFORM_NAME} — Nepali concerts, cultural nights & events`,
    description: SITE_DESCRIPTION,
  },
  robots: {
    // Explicit rather than implied: this is the public shell, and the private
    // routes opt OUT individually. Stated here so nobody has to guess whether
    // the default was indexable.
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      // Let Google show a full-size image and any length of text snippet —
      // the defaults are conservative and cost us the picture in rich results.
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  // Google Search Console verification. Set GOOGLE_SITE_VERIFICATION to the
  // token Search Console gives you and the tag appears — without submitting the
  // sitemap there, Google finds this site only by chance.
  ...(process.env.GOOGLE_SITE_VERIFICATION
    ? { verification: { google: process.env.GOOGLE_SITE_VERIFICATION } }
    : {}),
};

export const viewport: Viewport = {
  themeColor: '#0a0b10',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const contact = getPlatformContact();
  return (
    <html lang="en" className={sora.variable}>
      <body>
        {/* Who publishes this site. Site-wide rather than home-page-only so that
            an event page arriving cold from a search result still identifies its
            publisher — that is the link Google needs to attribute a rich result
            to a known organisation rather than an anonymous URL. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={jsonLdScript(siteJsonLd())}
        />
        <header className="site-header">
          <div className="container header-inner">
            <Link href="/" className="brand" aria-label={`${PLATFORM_NAME} — home`}>
              <Logo size={22} />
            </Link>
            <nav aria-label="Main" className="header-nav">
              {/* Two labels per link, one long and one short, swapped by CSS at
                  the width where the long one stops fitting. A phone gets the
                  short one; the accessible name stays the full phrase either
                  way, so nothing is lost to a screen reader. Shortening beats
                  hiding: the visitor asked for BOTH of these to stay visible,
                  and a nav that drops an item on small screens is a nav that
                  hides the thing you were looking for. */}
              <Link href="/" className="btn btn-sm btn-green" aria-label="Browse events">
                <span className="header-label-long">Browse events</span>
                <span className="header-label-short" aria-hidden="true">
                  Browse
                </span>
              </Link>
              {/* Named for what it does. The home page's "For organizers"
                  button goes to the pitch; this one lets an organizer who
                  already works with us get straight in. Both used to say "For
                  organizers" and lead to different places, which is exactly the
                  kind of thing nobody notices until it wastes their time.
                  Deliberately the quieter button too: signing in is a utility,
                  while the brand-coloured call to action belongs to the thing we
                  actually want visitors doing — browsing events. */}
              <Link href="/portal" className="btn btn-sm header-signin" aria-label="Organizer sign in">
                <span className="header-label-long">Organizer sign in</span>
                <span className="header-label-short" aria-hidden="true">
                  {/* NOT "Sign in". Shortened to that, it read as an invitation
                      to whoever was looking — and ticket buyers need no account
                      at all here, so the one thing this label must never do is
                      suggest they do. The audience is the whole message. */}
                  Organizer
                </span>
              </Link>
            </nav>
          </div>
        </header>
        <main className="anim-fade-up">{children}</main>
        {/* Follows the visitor on every public page. The component decides for
            itself where it does not belong (admin, the scanner, /contact). */}
        <ContactBubble
          name={contact.name}
          role={contact.role}
          photoUrl={contact.photoUrl}
          focus={contact.focus}
        />
        <footer className="site-footer">
          <div className="container footer-grid">
            <div>
              <Logo size={30} />
              <p className="footer-about">
                A little corner of Nepal, wherever you have landed — concerts, cultural
                nights, festivals and community events from organizers you know, with QR
                tickets straight to your inbox.
              </p>
            </div>
            <nav aria-label="Footer">
              <p className="footer-heading">Explore</p>
              <ul className="footer-links">
                <li>
                  <Link href="/">Browse events</Link>
                </li>
                <li>
                  <Link href="/digest">यो हप्ता के छ · weekly digest</Link>
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
                <li>
                  <Link href="/privacy">Privacy · Datenschutz</Link>
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
              Made with love for the Nepali community · Tickets arrive by email as QR
              codes — see you at the show.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
