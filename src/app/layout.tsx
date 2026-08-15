import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import { Sora } from 'next/font/google';
import Logo from '@/components/Logo';
import { getBaseUrl } from '@/lib/config';
import { SITE_DESCRIPTION, SITE_NAME, jsonLdScript, siteJsonLd } from '@/lib/seo';
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
    // search result reads "Dashain Night 2026 — Tickets | NepaliConcert" without
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
              Made for the Nepali community · Tickets are delivered by email as QR codes —
              see you at the show.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
