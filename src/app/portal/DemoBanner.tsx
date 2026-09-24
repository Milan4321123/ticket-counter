import Link from 'next/link';
import { currentOrganizer } from '@/lib/organizers';
import { demoExpiresAt } from '@/lib/demo';

/**
 * The strip across the top of every portal page in a try-it-yourself demo
 * account (lib/demo.ts). Says plainly what is real and what is not, and offers
 * the two things a demo visitor most wants next: the buyer's side, and the
 * list of everything else to try. Renders nothing in a real account.
 */
export default async function DemoBanner() {
  const organizer = await currentOrganizer();
  if (!organizer?.isDemo) return null;
  const expires = demoExpiresAt(organizer.id);
  const hoursLeft = expires ? Math.max(1, Math.round((expires - Date.now()) / 3_600_000)) : 24;
  return (
    <div className="demo-banner" role="status">
      <div className="container demo-banner-inner">
        <span className="badge badge-amber">Demo account</span>
        <span className="demo-banner-text demo-banner-long">
          Everything here works for real — but payments are simulated, no emails are sent, and only you can see
          it. It deletes itself in about {hoursLeft} {hoursLeft === 1 ? 'hour' : 'hours'}.
        </span>
        <span className="demo-banner-text demo-banner-short">
          Simulated payments · no emails · {hoursLeft}h left
        </span>
        <span className="demo-banner-links">
          <Link href="/demo?to=buyer-event">See it as a buyer</Link>
          <Link href="/showcase">All features</Link>
        </span>
      </div>
    </div>
  );
}
