'use client';

import Script from 'next/script';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { isPrivatePath } from '@/lib/analyticsScope';
import { readConsent, subscribeConsent } from '@/lib/consent';

/**
 * Google Analytics 4, on the public half of the site only.
 *
 * Off entirely unless NEXT_PUBLIC_GA_ID is set, so a fork, a local dev server
 * and anybody's checkout stay untagged — the measurement ID is inlined at
 * BUILD time (that is what NEXT_PUBLIC_ means), so setting it is a deliberate
 * act by whoever builds the deployment.
 *
 * ---------------------------------------------------------------------------
 * TWO THINGS THIS DELIBERATELY DOES NOT DO
 * ---------------------------------------------------------------------------
 *
 * 1. IT NEVER LOADS ON A PRIVATE PAGE. Not a preference — a necessity. An
 *    order page's URL is `/order/<uuid>?token=<hmac>`, and that token IS the
 *    credential: it is what unlocks the buyer's vouchers, their card code and
 *    their review form. GA4 reports `page_location` as the full URL including
 *    the query string, so a tag on that page would hand Google a working key
 *    to a stranger's order, in a report the operator cannot un-send. The same
 *    goes for /ticket/<code> (the QR payload), /c/<code> (a customer card,
 *    where the code is the entire security model), and the signed scanner
 *    links under /scan. /admin and /portal are excluded too: nothing about an
 *    operator's own back office belongs in an analytics property, and the
 *    URLs there carry listing and order ids.
 *
 *    The list lives in lib/analyticsScope, and it is the same one
 *    next.config.mjs marks `no-store` and scripts/audit-bazaar.mjs refuses to
 *    crawl. If a new private area is added it belongs in all three — and
 *    tests/analyticsScope.test.ts reads those two files to check it does.
 *
 * 2. IT NEVER SENDS A QUERY STRING. Belt to the braces above: page_location is
 *    set explicitly to origin + pathname, so even on a public page a `?ref=`
 *    share code or a `?token=` somebody pasted into the wrong place cannot
 *    ride along. Analytics wants to know which PAGE was read; the parameters
 *    on it are this site's business.
 *
 * ---------------------------------------------------------------------------
 * CONSENT COMES FIRST
 * ---------------------------------------------------------------------------
 * Nothing here loads until the visitor has said yes — see lib/consent and
 * components/ConsentBanner. TTDSG §25 and the GDPR require consent BEFORE
 * anything is stored on or read from a device, and GA4 sets a cookie the
 * moment its script runs, so the order is: ask, then load. Not asked yet, or
 * refused, or unreadable, all mean the same thing here — no script, no
 * cookie, no request to Google.
 */

export default function Analytics() {
  const measurementId = process.env.NEXT_PUBLIC_GA_ID ?? '';
  const pathname = usePathname();
  /**
   * Nothing is rendered on the server. Ever.
   *
   * This is not a hydration nicety — it is the fix for a real leak found in a
   * real build. Next PRERENDERS the not-found page at build time, and the
   * admin gate answers /admin by rewriting to a 404. So the tag was baked into
   * one static HTML file at build time and then served for every 404 on the
   * site, including the hidden admin gate's — putting Google's script on an
   * admin page no matter what any path check said, because the check had run
   * once, at build time, against a path nobody had visited yet.
   *
   * Waiting for mount means the path this component tests is the path the
   * visitor is actually on. It costs the tag a few hundred milliseconds, which
   * for counting page views is nothing, and it makes the exclusion list true
   * for rewrites, static pages and anything else the framework does between
   * the URL and the render.
   */
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  /**
   * Whether this visitor said yes. Starts as null — which is not 'granted' —
   * so the state everybody begins in is "not counted", including the first
   * moments of a page load and any browser where the answer cannot be read.
   *
   * Subscribed rather than read once, so pressing a button on the banner
   * starts the tag immediately and withdrawing consent on /privacy stops it
   * within the same page view. A control that only takes effect after a reload
   * makes a visitor doubt it did anything at all.
   */
  const [consent, setConsentState] = useState<string | null>(null);
  useEffect(() => {
    setConsentState(readConsent());
    return subscribeConsent((choice) => setConsentState(choice));
  }, []);

  const off = !measurementId || isPrivatePath(pathname) || consent !== 'granted';

  /**
   * EVERY page view, including the first.
   *
   * gtag's own automatic view is switched off in the config below, and this
   * sends them all instead. Two reasons for doing it by hand:
   *
   *   · this site navigates without reloading, so gtag's one-view-on-load
   *     would count a visitor who read the feed and then four shops as a
   *     single page view;
   *   · doing it in one place means one definition of what a "page" is —
   *     pathname, no query string — rather than one for the first view and a
   *     different one for the rest.
   *
   * Written into dataLayer rather than through window.gtag because the library
   * loads afterInteractive: on a first paint this effect usually runs BEFORE
   * the script arrives, and calling a function that does not exist yet would
   * silently lose the landing page — the single most valuable view there is.
   * dataLayer is a queue the library replays when it loads, so an early push
   * is not a lost push.
   *
   * The guard is inside the effect rather than around it because hooks cannot
   * be conditional; on a private page it simply does nothing.
   */
  useEffect(() => {
    if (off) return;
    const w = window as unknown as { dataLayer?: unknown[] };
    w.dataLayer = w.dataLayer || [];
    // eslint-disable-next-line prefer-rest-params
    function gtag() {
      // The exact shape gtag.js pushes: an Arguments object, not an array.
      // eslint-disable-next-line prefer-rest-params
      w.dataLayer!.push(arguments);
    }
    (gtag as (...a: unknown[]) => void)('event', 'page_view', {
      page_path: pathname,
      page_location: `${window.location.origin}${pathname}`,
    });
  }, [off, pathname]);

  if (off || !mounted) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
      />
      <Script id="ga-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${measurementId}', {
            // The pathname only — never the query string. See the note above:
            // a share code or an order token must not reach a report.
            page_location: window.location.origin + window.location.pathname,
            // OFF. The effect above sends every view, the first one included;
            // leaving this on would count the landing page twice.
            send_page_view: false
          });
        `}
      </Script>
    </>
  );
}
