import { cookies } from 'next/headers';
import { SCAN_COOKIE_NAME, verifyScanToken } from '@/lib/auth';
import { getEventById } from '@/lib/events';
import ScanClient from './ScanClient';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Door check-in' };

/**
 * Door-staff scanner page. Opened via a time-limited scanner link created in
 * the admin panel or organizer portal (/scan#k=...) — no admin sign-in, no
 * admin navigation. The event name shown is the one the scanner cookie is
 * scoped to; on a fresh link (key still in the URL fragment, no cookie yet)
 * the client learns the name from the session-exchange response instead.
 */
export default async function ScanPage() {
  const store = await cookies();
  const scan = verifyScanToken(store.get(SCAN_COOKIE_NAME)?.value ?? null);
  const event = scan ? getEventById(scan.eventId) : null;
  return <ScanClient eventName={event?.name ?? null} />;
}
