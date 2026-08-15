import { redirect } from 'next/navigation';
import { getPrimaryEvent } from '@/lib/events';

// Looks up the current primary event on every hit.
export const dynamic = 'force-dynamic';

/**
 * Legacy single-event checkout URL. Old links and bookmarks land here — send
 * them to the primary (first-ever) event's checkout, or to the feed when no
 * event exists yet.
 */
export default function LegacyCheckoutRedirect() {
  const event = getPrimaryEvent();
  redirect(event ? `/e/${event.slug}/checkout` : '/');
}
