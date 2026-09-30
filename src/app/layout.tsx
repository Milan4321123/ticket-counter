import Np from '@/components/Np';
import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import { Sora } from 'next/font/google';
import Analytics from '@/components/Analytics';
import ConsentBanner from '@/components/ConsentBanner';
import ContactBubble from '@/components/ContactBubble';
import Logo from '@/components/Logo';
import LogoMotion from '@/components/LogoMotion';
import { getBaseUrl } from '@/lib/config';
import { OG_HEIGHT, OG_WIDTH } from '@/lib/ogCard';
import { SITE_META_DESCRIPTION, SITE_NAME, jsonLdScript, siteJsonLd } from '@/lib/seo';
import { getPlatformContact } from '@/lib/platformPosts';
import './globals.css';
// The bazaar's marketplace furniture — tiles, rails, facets, stars, reviews.
// After globals.css and never before it: the two files share a handful of
// elements (a search field is `input bz-search-input`, a submit is
// `btn bz-search-btn`), and the bazaar's denser version is meant to win those
// ties. Its own header comment explains why it is a separate file at all.
import './bazaar.css';
import { INSTALL_PROMPT_CATCHER, InstallFooterLink, InstallNudge, ServiceWorkerRegistrar } from '@/components/AppInstall';
import { Suspense } from 'react';
import HeaderNav from '@/components/HeaderNav';
import SignedInToast from '@/components/SignedInToast';
import { currentCustomer } from '@/lib/customers';
import LangSwitch from '@/components/LangSwitch';
import AutoTranslate from '@/components/AutoTranslate';
import { translator } from '@/lib/i18n';
import { currentLang } from '@/lib/i18nServer';

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
  // Installable app: the manifest comes from app/manifest.ts; iPhones read the
  // touch icon and these two tags instead.
  appleWebApp: { capable: true, title: PLATFORM_NAME, statusBarStyle: 'black-translucent' },
  icons: { apple: '/icons/apple-touch-icon-v2.png' },
  title: {
    default: `${PLATFORM_NAME} — Nepali events, tickets & bazaar`,
    // Every page supplies its own short title and gets the brand appended, so a
    // search result reads "Dashain Night 2026 — Tickets | MartNepali" without
    // each page having to remember to say so.
    template: `%s | ${PLATFORM_NAME}`,
  },
  description: SITE_META_DESCRIPTION,
  applicationName: PLATFORM_NAME,
  // The home page is the canonical root; every other page sets its own.
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: PLATFORM_NAME,
    title: `${PLATFORM_NAME} — Nepali events, tickets & bazaar`,
    description: SITE_META_DESCRIPTION,
    url: '/',
    locale: 'en',
    /**
     * The site's default preview picture, inherited by every page that does
     * not set its own — which is most of them: the home page, the bazaar, the
     * festival calendar, the patro, /organizers. Without it a link pasted into
     * a WhatsApp group renders as a grey box, and a forwarded link is how
     * almost everything here travels.
     *
     * An event or an item page overrides this with its OWN photograph, which
     * is always the better card. This is the floor, not the ceiling.
     */
    images: [{ url: '/api/og', width: OG_WIDTH, height: OG_HEIGHT, alt: PLATFORM_NAME }],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${PLATFORM_NAME} — Nepali events, tickets & bazaar`,
    description: SITE_META_DESCRIPTION,
    images: ['/api/og'],
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

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = await currentLang();
  const tr = translator(lang);
  const contact = getPlatformContact();
  return (
    <html lang={lang} className={`${sora.variable}${lang === 'en' ? '' : ' tx-wait'}`}>
      <body>
        {/* First thing in the body: Chrome's install prompt can fire before
            React hydrates, and a late listener never sees it. */}
        <script dangerouslySetInnerHTML={{ __html: INSTALL_PROMPT_CATCHER }} />
        {/* Everything the dictionary does not cover, in the visitor's language. */}
        {lang !== 'en' && <AutoTranslate lang={lang} />}
        <ServiceWorkerRegistrar />
        {/* Stills the waving logo for visitors who asked for less motion. */}
        <LogoMotion />
        {/* Who publishes this site. Site-wide rather than home-page-only so that
            an event page arriving cold from a search result still identifies its
            publisher — that is the link Google needs to attribute a rich result
            to a known organisation rather than an anonymous URL. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={jsonLdScript(siteJsonLd())}
        />
        {/* The first thing a keyboard reaches on every page.
            Without it, somebody navigating by keyboard — or by switch, or by
            voice — tabs through the wordmark and three header buttons before
            they can reach the page they asked for, on every single page. It is
            invisible until focused (see .skip-link in bazaar.css), so it costs
            a mouse user nothing and gives everyone else back four tab stops. */}
        <a href="#main" className="skip-link">
          {tr('skip')}
        </a>
        <header className="site-header gn">
          <div className="container header-inner">
            <Link href="/" className="brand" aria-label={`${PLATFORM_NAME} — home`}>
              <Logo size={22} />
            </Link>
            <HeaderNav
              events={tr('nav.events')}
              bazaar={tr('nav.bazaar.short')}
              organizer={tr('nav.organizer')}
              organizerShort={tr('nav.organizer.short')}
              search={tr('nav.search')}
              account={tr('nav.account')}
              basket={tr('nav.basket')}
              signedIn={Boolean(await currentCustomer())}
              lang={
                <div className="lang-switch-header">
                  <Suspense fallback={null}>
                    <LangSwitch lang={lang} label={tr('nav.language')} />
                  </Suspense>
                </div>
              }
            />
          </div>
        </header>
        <SignedInToast />
        <main id="main" className="anim-fade-up">
          {children}
        </main>
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
                nights, festivals and community events from organizers you know, and a
                bazaar of Nepali sellers: momo to pre-order, sweets, crafts. You pay each
                seller directly, and your QR tickets and collection codes come straight
                to your inbox.
              </p>
              {/* The language switch lives here on phones, where the header has
                  no room for it (see .lang-switch-header in globals.css). */}
              <div className="lang-footer">
                <Suspense fallback={null}>
                  <LangSwitch lang={lang} label={tr('nav.language')} />
                </Suspense>
              </div>
              <InstallFooterLink appName={PLATFORM_NAME} />
            </div>
            <nav aria-label="Footer">
              <p className="footer-heading">Explore</p>
              <ul className="footer-links">
                <li>
                  <Link href="/">Browse events</Link>
                </li>
                <li>
                  <Link href="/digest">
                    <Np>यो हप्ता के छ</Np> · weekly digest
                  </Link>
                </li>
                <li>
                  <Link href="/festivals">Festival calendar</Link>
                </li>
                <li>
                  <Link href="/patro">Nepali patro</Link>
                </li>
                <li>
                  <Link href="/market">The bazaar</Link>
                </li>
                <li>
                  <Link href="/organizers">For organizers</Link>
                </li>
                <li>
                  <Link href="/showcase">Features</Link>
                </li>
                <li>
                  <Link href="/built">How it&rsquo;s built</Link>
                </li>
                <li>
                  <Link href="/contact">Custom page design</Link>
                </li>
                <li>
                  <Link href="/portal/login">Organizer sign-in</Link>
                </li>
                {/* The legal pages. German law wants the Impressum and the
                    Datenschutzerklärung reachable from every page in one
                    click, which is what a site-wide footer is for; the terms
                    and the AVV are here so an organizer can read what they
                    are agreeing to before they sign up. */}
                <li>
                  <Link href="/impressum">Impressum · Legal notice</Link>
                </li>
                <li>
                  <Link href="/privacy">Privacy · Datenschutz</Link>
                </li>
                {/* Withdrawing consent must be as easy as giving it (Art. 7(3)
                    GDPR): one click from every page to the switch, wherever
                    the banner was answered. Only when analytics exists. */}
                {process.env.NEXT_PUBLIC_GA_ID ? (
                  <li>
                    <Link href={`/privacy?v=${lang === 'de' ? 'de' : 'en'}#analytics`}>
                      Cookie-Einstellungen · Cookie settings
                    </Link>
                  </li>
                ) : null}
                <li>
                  <Link href="/terms">Nutzungsbedingungen · Seller terms</Link>
                </li>
                <li>
                  <Link href="/avv">AVV · Data processing agreement</Link>
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
              Made with love for the Nepali community · Tickets and collection codes
              arrive by email as QR codes — see you at the show, or at the counter.
            </p>
          </div>
        </footer>
        {/* Google Analytics, and only where it belongs: the component is inert
            unless NEXT_PUBLIC_GA_ID is set, and it refuses to load on an order
            page, a ticket, a customer card, the scanner, /admin or /portal —
            those URLs carry credentials, and GA reports the URL. */}
        <Analytics />
        {/* Asked before anything is loaded, and only where something would be.
            Analytics above stays inert until this is answered. */}
        <ConsentBanner lang={lang} />
        {/* On phones: offers the app once (the real prompt on Android, the
            exact taps on iPhone). Waits for the question above. */}
        <InstallNudge appName={PLATFORM_NAME} />
      </body>
    </html>
  );
}
