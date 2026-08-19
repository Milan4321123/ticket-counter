// The words a listing is described in, chosen by its kind.
//
// An event and a shop run on identical machinery: a page, priced types with a
// cap, an order, a QR code, and someone scanning that code when the buyer
// turns up. What separates them is almost entirely LANGUAGE — "3 tickets,
// checked in at the door" against "3 items, collected from the counter".
//
// Keeping that language in one table means the difference is a lookup at the
// point of display, not an `isShop` branch in every component that ever says
// the word "ticket". Anything that reads the same for both kinds does not
// belong here: add a word only when the two genuinely differ.
//
// Safe on the client — no database, no server-only imports.
import type { EventKind } from './types';

export interface Vocab {
  /** What the listing itself is called: "event" / "shop". */
  listing: string;
  Listing: string;
  /** What is being sold, one of them: "ticket" / "item". */
  unit: string;
  Unit: string;
  /** More than one: "tickets" / "items". */
  units: string;
  Units: string;
  /** One row in the editor's list of things to sell: "ticket type" / "item". */
  unitType: string;
  UnitType: string;
  unitTypes: string;
  UnitTypes: string;
  /** The thing the buyer is emailed and shows on arrival. */
  code: string;
  Code: string;
  codes: string;
  Codes: string;
  /** Scanning it: the noun ("check-in" / "collection")… */
  redeem: string;
  Redeem: string;
  /** …and what it has become once scanned ("checked in" / "collected"). */
  redeemed: string;
  Redeemed: string;
  /** The heading over the practical details: when and where to turn up. */
  logistics: string;
  /** How many there are to sell: "capacity" / "stock". */
  capacity: string;
  Capacity: string;
  /** The button a visitor presses on the public page. */
  cta: string;
  /** Where the scanning happens: "the door" / "the counter". */
  where: string;
  /** What gets paused or closed: "Ticket sales" / "Orders". */
  Sales: string;
}

const EVENT: Vocab = {
  listing: 'event',
  Listing: 'Event',
  unit: 'ticket',
  Unit: 'Ticket',
  units: 'tickets',
  Units: 'Tickets',
  unitType: 'ticket type',
  UnitType: 'Ticket type',
  unitTypes: 'ticket types',
  UnitTypes: 'Ticket types',
  code: 'ticket',
  Code: 'Ticket',
  codes: 'tickets',
  Codes: 'Tickets',
  redeem: 'check-in',
  Redeem: 'Check-in',
  redeemed: 'checked in',
  Redeemed: 'Checked in',
  logistics: 'When & where',
  capacity: 'capacity',
  Capacity: 'Capacity',
  cta: 'Get tickets',
  where: 'the door',
  Sales: 'Ticket sales',
};

const SHOP: Vocab = {
  listing: 'shop',
  Listing: 'Shop',
  unit: 'item',
  Unit: 'Item',
  units: 'items',
  Units: 'Items',
  unitType: 'item',
  UnitType: 'Item',
  unitTypes: 'items',
  UnitTypes: 'Items',
  // Not "ticket": what the buyer is sent proves they have paid for something
  // they have not received yet, and it is spent by handing goods over.
  code: 'collection code',
  Code: 'Collection code',
  codes: 'collection codes',
  Codes: 'Collection codes',
  redeem: 'collection',
  Redeem: 'Collection',
  redeemed: 'collected',
  Redeemed: 'Collected',
  logistics: 'How to collect',
  capacity: 'stock',
  Capacity: 'Stock',
  cta: 'Order',
  where: 'the counter',
  Sales: 'Orders',
};

export function vocabFor(kind: EventKind): Vocab {
  return kind === 'shop' ? SHOP : EVENT;
}
