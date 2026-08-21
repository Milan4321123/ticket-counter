/**
 * THE ORDERS LIST READ MODEL — lib/orders' withItemsSummary(), through the two
 * exported readers that use it (listOrders and listAwaitingTransferOrders).
 *
 * Every orders SCREEN and the CSV export render this one object: the portal's
 * orders page, the admin list, the awaiting-transfer worklist, and
 * GET /api/portal/events/[id]/orders/export. It was re-batched into one
 * getOrderItemsBulk() + one getEventTiersBulk(), and `paymentReference` — the
 * string a buyer types into their banking app and the organizer matches on a
 * bank statement — is now settled onto the row here instead of being derived
 * per screen.
 *
 * That makes three claims worth pinning, because all three break QUIETLY: a
 * wrong summary still reads like a sentence, a wrong ticket count still reads
 * like a number, and a wrong reference still looks exactly like a reference.
 * Nothing throws, no screen goes blank, and the first person to notice is an
 * organizer who cannot find a payment.
 *
 * So every test below drives the real readers and compares against the
 * UNTOUCHED single-order functions (paymentReference, getOrderItems) or
 * against a literal. A test that rebuilt the summary the way withItemsSummary
 * builds it would agree with a broken one for ever.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { db, makeEvent, makeOrder, makeOrganizer, makePaidOrder } from './helpers.ts';
import { claimInventory } from '../src/lib/inventory.ts';
import {
  getOrderItems,
  getOrderItemsBulk,
  listAwaitingTransferOrders,
  listOrders,
  paymentReference,
  type OrderListRow,
} from '../src/lib/orders.ts';
import {
  ANONYMOUS_BUYER_NAME,
  ERASED_BUYER_EMAIL,
  ERASED_BUYER_NAME,
  runBuyerDataRetentionSweep,
} from '../src/lib/retention.ts';

/** The one row for this order, or a failure naming the order that went missing. */
function rowFor(rows: OrderListRow[], orderId: string): OrderListRow {
  const found = rows.filter((r) => r.id === orderId);
  assert.equal(found.length, 1, `expected exactly one list row for ${orderId}, got ${found.length}`);
  return found[0];
}

// ---------------------------------------------------------------------------
// The reference
// ---------------------------------------------------------------------------

test('every row carries exactly the reference paymentReference() would give', () => {
  // The student prefix is the part that can go wrong without looking wrong.
  // TICKETS-S- is what tells the organizer this transfer is the reduced price,
  // and it is decided by whether ANY line on the order is a student-only tier
  // — a fact withItemsSummary now works out from its own batched tier map
  // instead of from the three reads paymentReference() makes.
  const event = makeEvent({
    tiers: [
      { tierKey: 'full', name: 'Full price', priceCents: 2000 },
      { tierKey: 'student', name: 'Student', priceCents: 1000, studentOnly: true },
    ],
  });
  const withStudent = makePaidOrder({ eventId: event.id, items: [{ tierId: 'full', quantity: 1 }, { tierId: 'student', quantity: 1 }] }).order;
  const withoutStudent = makePaidOrder({ eventId: event.id, items: [{ tierId: 'full', quantity: 2 }] }).order;

  const rows = listOrders({ eventId: event.id });

  const studentRow = rowFor(rows, withStudent.id);
  assert.equal(studentRow.paymentReference, paymentReference(withStudent.id));
  // Spelled out as a literal too: an equality against paymentReference() alone
  // would still hold if BOTH sides lost the prefix.
  assert.equal(studentRow.paymentReference, `TICKETS-S-${withStudent.id.slice(0, 8).toUpperCase()}`);

  const plainRow = rowFor(rows, withoutStudent.id);
  assert.equal(plainRow.paymentReference, paymentReference(withoutStudent.id));
  assert.equal(plainRow.paymentReference, `TICKETS-${withoutStudent.id.slice(0, 8).toUpperCase()}`);
  assert.ok(
    !plainRow.paymentReference.startsWith('TICKETS-S-'),
    'an order with no student line must never be handed the reduced-price reference'
  );
});

// ---------------------------------------------------------------------------
// The summary, and the order of its lines
// ---------------------------------------------------------------------------

test('a multi-line order reads the same, in the same sequence, through both readers', () => {
  // The two readers have to agree on ORDER, not just on content: the summary
  // on the list screens is built from getOrderItemsBulk (ORDER BY order_id,
  // tier_id) while the order page, the emails and the support re-send build
  // the same sentence from getOrderItems. Until getOrderItems was given an
  // explicit ORDER BY the two agreed only because SQLite happened to answer
  // the single-order lookup from sqlite_autoindex_order_items_1.
  //
  // The tier keys are deliberately REVERSE-LEXICAL to their insertion order,
  // so a reader that fell back to rowid (insertion) order produces a visibly
  // different sentence rather than the same one.
  const event = makeEvent({
    tiers: [
      { tierKey: 'zzz-standard', name: 'Standard', priceCents: 1000 },
      { tierKey: 'aaa-vip', name: 'VIP', priceCents: 5000 },
    ],
  });
  const { order } = makePaidOrder({
    eventId: event.id,
    items: [
      { tierId: 'zzz-standard', quantity: 2 },
      { tierId: 'aaa-vip', quantity: 1 },
    ],
  });

  assert.deepEqual(
    getOrderItems(order.id).map((it) => it.tierId),
    ['aaa-vip', 'zzz-standard'],
    'the single-order reader sorts by tier_id, whatever order the lines were written in'
  );
  assert.deepEqual(
    (getOrderItemsBulk([order.id]).get(order.id) ?? []).map((it) => it.tierId),
    ['aaa-vip', 'zzz-standard'],
    'and the batch reader sorts identically — this is the agreement the summary rests on'
  );

  const row = rowFor(listOrders({ eventId: event.id }), order.id);
  assert.equal(row.itemsSummary, '1× VIP, 2× Standard');
});

test('ticketCount counts PEOPLE, so a bundle tier multiplies by its seats', () => {
  // "2× Table of 8" is two bookings and sixteen QR codes, and every surface
  // that prints ticketCount labels it as tickets/codes. Counting bookings here
  // would tell a door team to expect three people where seventeen turn up.
  const event = makeEvent({
    tiers: [
      { tierKey: 'table', name: 'Table of 8', priceCents: 40000, seatsPerUnit: 8, cap: 5 },
      { tierKey: 'single', name: 'Standard', priceCents: 5000 },
    ],
    totalCapacity: 200,
  });
  const { order, tickets } = makePaidOrder({
    eventId: event.id,
    items: [
      { tierId: 'table', quantity: 2 },
      { tierId: 'single', quantity: 1 },
    ],
  });

  const row = rowFor(listOrders({ eventId: event.id }), order.id);
  assert.equal(row.ticketCount, 17);
  // The same number the sale actually minted — the list is describing real
  // codes, not its own arithmetic.
  assert.equal(tickets.length, 17);
});

test('a tier deleted after the sale degrades all three fields, and never throws', () => {
  // Deleting a tier is a normal thing for an organizer to do once a listing is
  // over, and the orders that bought it stay on the screen for ever. All three
  // derived fields must degrade the way getEventTier()'s null used to: the key
  // stands in for the missing name, the row weighs one seat per booking, and
  // the reference reads as a full-price one because nothing can prove the line
  // was a student ticket any more.
  const event = makeEvent({
    tiers: [
      { tierKey: 'stud-table', name: 'Student table of 4', priceCents: 8000, seatsPerUnit: 4, cap: 10, studentOnly: true },
    ],
    totalCapacity: 200,
  });
  const { order } = makePaidOrder({ eventId: event.id, items: [{ tierId: 'stud-table', quantity: 3 }] });

  const before = rowFor(listOrders({ eventId: event.id }), order.id);
  assert.equal(before.itemsSummary, '3× Student table of 4');
  assert.equal(before.ticketCount, 12);
  assert.equal(before.paymentReference, `TICKETS-S-${order.id.slice(0, 8).toUpperCase()}`);

  // RAW SQL: tiers have no lib deleter — PATCH /api/portal/events/[id] runs
  // this exact statement inline when a row is removed from the editor.
  db().prepare(`DELETE FROM event_tiers WHERE event_id = ? AND tier_key = ?`).run(event.id, 'stud-table');

  const after = rowFor(listOrders({ eventId: event.id }), order.id);
  assert.equal(after.itemsSummary, '3× stud-table', 'the key stands in for the name that is gone');
  assert.equal(after.ticketCount, 3, 'one seat per booking — the bundle size died with the tier');
  assert.equal(after.paymentReference, `TICKETS-${order.id.slice(0, 8).toUpperCase()}`);
  // And the untouched single-order path degrades to exactly the same string,
  // so a buyer quoting the reference from their order page and an organizer
  // reading it off the list are still talking about the same transfer.
  assert.equal(after.paymentReference, paymentReference(order.id));
});

// ---------------------------------------------------------------------------
// Two events, one tier key
// ---------------------------------------------------------------------------

test('the tier map is keyed by (event, tier key) — one seller\'s product never lands on another\'s row', () => {
  // The batched map is one Map for the WHOLE list, and the platform-wide
  // awaiting-transfer worklist spans every organizer on the machine. Tier keys
  // are organizer-typed and short: 'vip', 'standard', 'table' collide between
  // strangers constantly. A map keyed by tier key alone would print Beta's
  // product name on Alpha's order — a leak of one seller's catalogue onto
  // another seller's screen — and would size Alpha's booking with Beta's
  // seats. Both events use the key 'vip' and nothing else about them matches.
  const alpha = makeEvent({
    organizerId: makeOrganizer().id,
    tiers: [{ tierKey: 'vip', name: 'Alpha Gala Table', priceCents: 20000, seatsPerUnit: 8, cap: 5 }],
    totalCapacity: 200,
  });
  const beta = makeEvent({
    organizerId: makeOrganizer().id,
    tiers: [{ tierKey: 'vip', name: 'Beta Bazaar Crate', priceCents: 3000, seatsPerUnit: 3, cap: 5 }],
    totalCapacity: 200,
  });
  const alphaOrder = makeOrder({ eventId: alpha.id, items: [{ tierId: 'vip', quantity: 1 }] });
  const betaOrder = makeOrder({ eventId: beta.id, items: [{ tierId: 'vip', quantity: 1 }] });
  claimInventory(alphaOrder.id);
  claimInventory(betaOrder.id);

  // No eventId: the platform-wide worklist, both organizers in one list.
  const rows = listAwaitingTransferOrders();

  const alphaRow = rowFor(rows, alphaOrder.id);
  assert.equal(alphaRow.itemsSummary, '1× Alpha Gala Table');
  assert.equal(alphaRow.ticketCount, 8);

  const betaRow = rowFor(rows, betaOrder.id);
  assert.equal(betaRow.itemsSummary, '1× Beta Bazaar Crate');
  assert.equal(betaRow.ticketCount, 3);
});

// ---------------------------------------------------------------------------
// The chunk boundary
// ---------------------------------------------------------------------------

test('a list longer than one chunkIds() batch keeps every row, once, and in order', () => {
  // getOrderItemsBulk binds its ids 500 at a time (lib/sqlIn's MAX_PARAMS), so
  // 501 orders is the first list that loops. The failure this guards is not a
  // crash: a bulk map built from the last batch only, or from the first, still
  // returns a full-length list — the orders past the boundary just quietly
  // lose their lines and print an empty summary, a ticketCount of 0 and a
  // full-price reference. Every row therefore carries a signal derived from
  // its OWN tier, so a row served from the wrong batch is visible.
  const event = makeEvent({
    tiers: [
      { tierKey: 'aaa-plain', name: 'Plain', priceCents: 1000, cap: 1000 },
      { tierKey: 'zzz-group', name: 'Group of 5', priceCents: 4000, seatsPerUnit: 5, cap: 1000, studentOnly: true },
    ],
    totalCapacity: 100000,
  });

  const TOTAL = 501;
  const expected = new Map<string, { summary: string; count: number; reference: string }>();
  for (let i = 0; i < TOTAL; i++) {
    const group = i % 2 === 1;
    const tierId = group ? 'zzz-group' : 'aaa-plain';
    // Pending is enough: listOrders' 'all' bucket is every status, and 501
    // trips through claimInventory would only be slower.
    const order = makeOrder({ eventId: event.id, items: [{ tierId, quantity: 1 }] });
    expected.set(order.id, {
      summary: group ? '1× Group of 5' : '1× Plain',
      count: group ? 5 : 1,
      reference: `TICKETS-${group ? 'S-' : ''}${order.id.slice(0, 8).toUpperCase()}`,
    });
  }

  const rows = listOrders({ eventId: event.id, limit: 1000 });
  assert.equal(rows.length, TOTAL, 'every order, and no order twice');
  assert.equal(new Set(rows.map((r) => r.id)).size, TOTAL, 'and no id repeated');

  for (const row of rows) {
    const want = expected.get(row.id);
    assert.ok(want, `list returned an order this test never created: ${row.id}`);
    assert.equal(row.itemsSummary, want.summary, `wrong summary on ${row.id}`);
    assert.equal(row.ticketCount, want.count, `wrong ticket count on ${row.id}`);
    assert.equal(row.paymentReference, want.reference, `wrong reference on ${row.id}`);
  }

  // "In order" means the read model hands rows back in the ORDER THE QUERY
  // CHOSE — newest first — rather than in whatever order its internal map
  // happens to iterate. It is asserted against the ids the same query returns
  // because created_at has one-second resolution: 501 orders written in the
  // same second have no total order of their own to assert against, and a
  // literal expectation here would be a coin flip, not a test.
  const ids = db()
    .prepare(`SELECT id FROM orders WHERE event_id = ? ORDER BY created_at DESC LIMIT 1000`)
    .all(event.id) as { id: string }[];
  assert.deepEqual(rows.map((r) => r.id), ids.map((r) => r.id));
});

// ---------------------------------------------------------------------------
// Erasure. Last in the file: the sweep is global.
// ---------------------------------------------------------------------------

test('an erased buyer reaches the list as the anonymous label, never the placeholder', () => {
  // withItemsSummary is the choke point every orders screen passes through, so
  // it is where the erased buyer stops being printable. 'Erased after event' /
  // 'erased@erased.invalid' exist only to keep the columns non-null; in a
  // "Buyer" column they read as a person's name and address, which is the one
  // thing the retention promise says must never appear.
  //
  // The event is dated in the past because that is what makes the order due —
  // and this test sits last because runBuyerDataRetentionSweep walks the whole
  // database. Every other event in this file is left dateless, which the sweep
  // can never reach.
  const event = makeEvent({
    eventDate: '2020-01-01',
    tiers: [{ tierKey: 'plain', name: 'Standard', priceCents: 1000 }],
  });
  const { order } = makePaidOrder({
    eventId: event.id,
    items: [{ tierId: 'plain', quantity: 1 }],
    buyerName: 'Ida Buyer',
    buyerEmail: 'ida@buyers.test',
  });

  assert.equal(runBuyerDataRetentionSweep(true).erased, 1, 'the past listing, and nothing else in this file');

  const row = rowFor(listOrders({ eventId: event.id }), order.id);
  assert.equal(row.buyerName, ANONYMOUS_BUYER_NAME);
  assert.equal(row.buyerEmail, '', 'no address exists any more, and a deliverable-looking one is worse than a blank');
  assert.notEqual(row.buyerName, ERASED_BUYER_NAME);
  assert.notEqual(row.buyerEmail, ERASED_BUYER_EMAIL);
  assert.ok(row.buyerErasedAt, 'the stamp stays on the row, so a screen can still say "erased" rather than "unnamed"');
  // The money and the count are the seller's bookkeeping and survive untouched.
  assert.equal(row.itemsSummary, '1× Standard');
  assert.equal(row.ticketCount, 1);
  assert.equal(row.paymentReference, paymentReference(order.id));
});
