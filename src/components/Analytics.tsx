'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { analyticsCommands, isPrivatePath } from '@/lib/analyticsScope';
import { readConsent, subscribeConsent } from '@/lib/consent';

/**
 * Google Analytics 4, on the public half of the site, after consent.
 *
 * Off entirely unless NEXT_PUBLIC_GA_ID is set, so a fork, a local dev server
 * and anybody's checkout stay untagged — the measurement ID is inlined at
 * BUILD time (that is what NEXT_PUBLIC_ means), so setting it is a deliberate
 * act by whoever builds the deployment.
 *
 * ---------------------------------------------------------------------------
 * CONSENT COMES FIRST
 * ---------------------------------------------------------------------------
 * Nothing here loads until the visitor has said yes — see lib/consent and
 * components/ConsentBanner. TTDSG §25 and the GDPR require consent BEFORE
 * anything is stored on or read from a device, and GA4 sets a cookie the
 * moment its script runs, so the order is: ask, then load. Not asked yet, or
 * refused, or unreadable all mean the same thing here — no script, no cookie,
 * no request to Google.
 *
 * Withdrawal takes more than unmounting. Once gtag.js is in the page it stays,
 * and this property has enhanced measurement switched on, so left alone it
 * would carry on reporting scrolls and outbound clicks by itself.
 * `window['ga-disable-<ID>']` is Google's own kill switch, and it goes up the
 * moment consent goes away.
 *
 * ---------------------------------------------------------------------------
 * TWO THINGS THIS DELIBERATELY DOES NOT DO
 * ---------------------------------------------------------------------------
 *
 * 1. IT NEVER LOADS ON A PRIVATE PAGE. Not a preference — a necessity. An
 *    order page's URL is `/order/<uuid>?token=<hmac>`, and that token IS the
 *    credential: it unlocks the buyer's vouchers, their card code and their
 *    review form. GA4 reports `page_location` as the full URL including the
 *    query string, so a tag there would hand Google a working key to a
 *    stranger's order, in a report the operator cannot un-send. The same goes
 *    for /ticket/<code> (the QR payload), /c/<code> (a customer card, where
 *    the code is the entire security model), and the signed scanner links
 *    under /scan. /admin and /portal are excluded too.
 *
 *    The list lives in lib/analyticsScope, and it is the same one
 *    next.config.mjs marks `no-store` and scripts/audit-bazaar.mjs refuses to
 *    crawl. If a new private area is added it belongs in all three — and
 *    tests/analyticsScope.test.ts reads those two files to check it does.
 *
 * 2. IT NEVER SENDS A QUERY STRING. Belt to the braces above: page_location is
 *    always origin + pathname, so even on a public page a `?ref=` share code
 *    or a `?token=` somebody pasted into the wrong place cannot ride along.
 *
 * ---------------------------------------------------------------------------
 * WHY THE SCRIPT IS INJECTED BY HAND RATHER THAN WITH next/script
 * ---------------------------------------------------------------------------
 * Because the ORDER matters and next/script does not guarantee it.
 *
 * gtag.js reads dataLayer in the order things were pushed, and it DROPS an
 * event that arrives before there is a `config` for its measurement ID. The
 * first version of this component used <Script strategy="afterInteractive">
 * for the config and a useEffect for the page view — and afterInteractive
 * defers injection while a useEffect fires on commit, so the page view was
 * pushed first and thrown away. With send_page_view off, the property received
 * nothing at all, ever, and looked exactly like a tag nobody had installed.
 * It took a live deployment reporting "No data received" to see it.
 *
 * Doing it here takes the framework's scheduling out of the question: one
 * effect, pushing `js`, then `config`, and only on LATER navigations a
 * `page_view`. The first view is left to `config` itself, which is the one
 * ordering gtag actually guarantees.
 */
export default function Analytics() {
  const measurementId = process.env.NEXT_PUBLIC_GA_ID ?? '';
  const pathname = usePathname();

  /**
   * The answer, watched rather than read once, so the banner's button takes
   * effect in the same page view. Starts as null — which is not 'granted' — so
   * the state everybody begins in is "not counted".
   */
  const [consent, setConsentState] = useState<string | null>(null);
  useEffect(() => {
    setConsentState(readConsent());
    return subscribeConsent(setConsentState);
  }, []);

  const off = !measurementId || isPrivatePath(pathname) || consent !== 'granted';

  /** Whether gtag has been configured in this page. Survives navigations. */
  const configured = useRef(false);

  useEffect(() => {
    const w = window as unknown as Record<string, unknown> & { dataLayer?: unknown[] };

    if (off) {
      if (measurementId) w[`ga-disable-${measurementId}`] = true;
      return;
    }
    w[`ga-disable-${measurementId}`] = false;

    w.dataLayer = w.dataLayer || [];
    function gtag() {
      // The exact shape gtag.js pushes: an Arguments object, not an array.
      // eslint-disable-next-line prefer-rest-params
      (w.dataLayer as unknown[]).push(arguments);
    }
    const send = gtag as unknown as (...args: unknown[]) => void;

    // WHAT to send, and in what order, is decided in lib/analyticsScope and
    // tested there — see the note beside analyticsCommands about the ordering
    // rule this component once got wrong in production.
    const wasConfigured = configured.current;
    for (const command of analyticsCommands({
      measurementId,
      pathname,
      origin: window.location.origin,
      configured: wasConfigured,
    })) {
      send(...command);
    }

    if (!wasConfigured) {
      configured.current = true;
      const script = document.createElement('script');
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
      document.head.appendChild(script);
    }
  }, [off, measurementId, pathname]);

  // Nothing is rendered, on the server or the client: the effect above is the
  // only place that knows the real path and the real answer.
  return null;
}
