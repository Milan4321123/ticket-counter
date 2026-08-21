'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { isPrivatePath } from '@/lib/analyticsScope';
import { readConsent, setConsent, subscribeConsent } from '@/lib/consent';
import { usePathname } from 'next/navigation';

/**
 * The one question this site asks before it counts anybody.
 *
 * Analytics does not run until this is answered — nothing is loaded, no cookie
 * is set, no request reaches Google. That order matters legally: TTDSG §25 and
 * the GDPR require consent BEFORE anything is stored on or read from a
 * visitor's device, and a banner that appears while the tag is already running
 * is decoration on a breach.
 *
 * WHAT MAKES THIS LAWFUL RATHER THAN JUST PRESENT
 *
 *   · Prior. components/Analytics renders nothing until readConsent() says
 *     'granted', so declining is the state everybody starts in.
 *   · Equally easy to refuse. The two buttons are the same size, the same
 *     weight and the same colour, side by side, on the first layer. No
 *     "Accept all" in green beside a grey "Manage preferences" — that design
 *     is the single most commonly enforced-against pattern in the EU, and it
 *     is not an accident anywhere it appears.
 *   · Informed, before the click and not behind a link: what is collected, who
 *     receives it (Google), where it goes (the United States) and what it is
 *     for are on the banner itself. The link to /privacy adds detail, it does
 *     not carry the disclosure.
 *   · Freely given. Nothing on this site is gated on the answer. Declining
 *     closes the banner and changes nothing else — no reduced service, no
 *     nagging, no second ask.
 *   · Withdrawable as easily as it was given, at any time, from /privacy —
 *     where withdrawing also deletes the cookies Google already set.
 *   · Not a dark pattern in its silence either: an unanswered banner is a
 *     refusal, so a visitor who ignores it forever is never counted.
 *
 * It is also not shown at all when there is nothing to consent to — no
 * NEXT_PUBLIC_GA_ID, or a page analytics would never run on anyway. A site
 * that asks permission it does not need teaches people to click through
 * permission requests, which is a small harm done to every site after it.
 */
export default function ConsentBanner() {
  const measurementId = process.env.NEXT_PUBLIC_GA_ID ?? '';
  const pathname = usePathname();
  // Never rendered on the server: the answer lives in the visitor's own
  // browser, so the markup would otherwise be built from a guess and then
  // contradicted a moment later. See the same note in components/Analytics.
  const [decided, setDecided] = useState<boolean | null>(null);

  useEffect(() => {
    setDecided(readConsent() !== null);
    return subscribeConsent((choice) => setDecided(choice !== null));
  }, []);

  if (!measurementId) return null; // nothing is loaded, so nothing to ask
  if (isPrivatePath(pathname)) return null; // analytics never runs here anyway
  if (decided !== false) return null; // still reading, or already answered

  return (
    /* role="dialog" rather than a bare div so a screen reader announces it as
       the thing it is, and aria-live so somebody who has already tabbed past
       the top of the page is told it appeared. It deliberately does NOT trap
       focus or block the page: this is a question, and the site works whether
       or not it is answered. */
    <div className="consent" role="dialog" aria-live="polite" aria-label="Counting visits">
      <div className="consent-body">
        <p className="consent-text">
          <strong>May we count this visit?</strong> We use Google Analytics to see which pages
          people actually read — nothing else. It stores a cookie on your device and sends the page
          address, your rough location and your browser to Google in the United States. It never
          runs on your order, your tickets or your customer card. Say no and nothing loads at all;
          the site works exactly the same either way.{' '}
          <Link href="/privacy" className="consent-link">
            What we collect
          </Link>
        </p>
        {/* Same size, same weight, same colour, refuse first. If one of these
            ever becomes louder than the other, the consent stops being freely
            given and the analytics data stops being lawfully collected. */}
        <div className="consent-actions">
          <button type="button" className="btn consent-btn" onClick={() => setConsent('denied')}>
            No thanks
          </button>
          <button type="button" className="btn consent-btn" onClick={() => setConsent('granted')}>
            Yes, that&rsquo;s fine
          </button>
        </div>
      </div>
    </div>
  );
}
