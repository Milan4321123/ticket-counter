// Every tool one listing has, in one list: the tool board
// (/portal/events/[id]) shows them as big buttons with a line each, the hub
// sidebar lists them under the open listing, and the tab strip on each tool's
// page links them. One list, so the three can never disagree about what a
// shop or an event can do.
import type { EventRow } from '@/lib/events';
import { parseSlotConfig } from '@/lib/kitchen';
import { vocabFor } from '@/lib/vocab';

export type ToolIcon =
  | 'grid' | 'edit' | 'inbox' | 'chart' | 'cook' | 'calendar' | 'scan' | 'pulse' | 'qr' | 'repeat' | 'seat' | 'eye' | 'tag';

export interface ListingTool {
  key: string;
  href: string;
  label: string;
  /** One short line: what it is for. */
  line: string;
  icon: ToolIcon;
  /** Shown in the sidebar and the tab strip, not only on the board. */
  primary: boolean;
  /** Opens the buyer's page, outside the hub. */
  external?: boolean;
}

export function listingTools(event: Pick<EventRow, 'id' | 'slug' | 'kind' | 'pickupSlots' | 'tableCount' | 'status'>): ListingTool[] {
  const base = `/portal/events/${event.id}`;
  const isShop = event.kind === 'shop';
  const appointments = isShop && parseSlotConfig(event.pickupSlots).purpose === 'appointment';
  const v = vocabFor(event.kind);
  const tools: ListingTool[] = [
    { key: 'overview', href: base, label: 'All tools', line: 'Everything for this listing', icon: 'grid', primary: true },
    { key: 'edit', href: `${base}/edit`, label: 'Edit', line: 'Name, photos, prices, payment, publish', icon: 'edit', primary: true },
    { key: 'orders', href: `${base}/orders`, label: 'Orders', line: 'Every order — confirm bank transfers', icon: 'inbox', primary: true },
    { key: 'insights', href: `${base}/insights`, label: 'Insights', line: isShop ? 'Best sellers, busy days and hours' : 'Sales over time, ticket types, guests', icon: 'chart', primary: true },
  ];
  if (isShop) {
    tools.push({
      key: 'kitchen',
      href: `${base}/kitchen`,
      label: appointments ? 'Bookings' : 'Kitchen',
      line: appointments ? 'Today’s appointments on a board' : 'Live board: New → Cooking → Ready',
      icon: appointments ? 'calendar' : 'cook',
      primary: true,
    });
  }
  tools.push(
    { key: 'checkin', href: `${base}/checkin`, label: v.Redeem, line: isShop ? 'Scan collection codes at the counter' : 'Scan tickets at the door', icon: 'scan', primary: true },
    { key: 'live', href: `${base}/live`, label: 'Live screen', line: 'Arrivals and sales in real time', icon: 'pulse', primary: true },
  );
  if (isShop) {
    tools.push(
      { key: 'kitchen-setup', href: `${base}/edit?tab=kitchen`, label: appointments ? 'Opening times' : 'Collection times', line: appointments ? 'Slots, services and choices' : 'Pickup slots, item choices, tables', icon: 'calendar', primary: false },
      { key: 'subscribe', href: `${base}/edit?tab=subscribe`, label: 'Subscribe & save', line: 'Repeat orders for regulars', icon: 'repeat', primary: false },
    );
    if (event.tableCount > 0) {
      tools.push({ key: 'tables', href: `${base}/tables`, label: 'Table QR codes', line: 'Print a code for every table', icon: 'qr', primary: false });
    }
  } else {
    tools.push({ key: 'seating', href: `${base}/edit?tab=seating`, label: 'Seat map', line: 'Rows, sections and reserved seats', icon: 'seat', primary: false });
  }
  tools.push(
    { key: 'promos', href: '/portal/promos', label: 'Discount codes', line: 'Early-bird, sponsor or group codes', icon: 'tag', primary: false },
    {
      key: 'view',
      href: `/e/${event.slug}`,
      label: event.status === 'published' ? 'View as buyer' : 'Preview',
      line: event.status === 'published' ? 'Your public page' : 'Check the page before publishing',
      icon: 'eye',
      primary: false,
      external: true,
    },
  );
  return tools;
}
