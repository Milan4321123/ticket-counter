import { getEventConfig } from '@/lib/config';
import ScanClient from './ScanClient';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Door check-in' };

/**
 * Door-staff scanner page. Opened via a time-limited scanner link created in
 * the admin panel (/scan#k=...) — no admin sign-in, no admin navigation.
 */
export default function ScanPage() {
  const cfg = getEventConfig();
  return <ScanClient eventName={cfg.eventName} />;
}
