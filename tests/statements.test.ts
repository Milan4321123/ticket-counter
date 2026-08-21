/**
 * THE COST OF A PAGE, MEASURED.
 *
 * Half a dozen modules in this repo promise, in comments, that a cross-shop
 * page costs the same number of database round-trips whether the bazaar holds
 * one shop or four hundred — lib/feedSnapshot ("three statements for a whole
 * listing"), lib/marketItems ("FOUR statements, whatever the size"),
 * lib/reviews ("ONE statement for any number of shops"). Those sentences were
 * true when they were written and nothing in the suite held them to it, which
 * is exactly the shape of a claim that quietly stops being true: somebody adds
 * one innocent getX(id) inside a loop, every test still passes, and the
 * homepage silently goes back to costing a query per tile.
 *
 * So this file measures instead of trusting. It counts EXECUTIONS, not
 * preparations — a statement prepared once outside a loop and stepped once per
 * row is the classic N+1 wearing a disguise, and counting prepare() calls
 * would score it as one.
 *
 * The assertions are deliberately of the form "the same for 3 shops as for 30"
 * rather than "at most N". A hard number goes stale the first time somebody
 * legitimately adds a table and then gets bumped without anybody thinking; a
 * SLOPE of zero is the property actually worth defending, and it cannot be
 * satisfied by editing a constant. Where a ceiling is asserted as well it is
 * generous, and it is there to catch a rewrite that made the page cheap per
 * shop but expensive per request.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { db, makeEvent, makeOrganizer, makePaidOrder } from './helpers.ts';
import type { EventRow } from '../src/lib/events.ts';
import { listPublishedEvents } from '../src/lib/events.ts';
import { loadFeedSnapshot } from '../src/lib/feedSnapshot.ts';
import { facetCities, listShopItems, searchSuggestions } from '../src/lib/marketItems.ts';
import { ratingsForItems, writeReview } from '../src/lib/reviews.ts';

/**
 * Run `fn` and report how many times a prepared statement was actually
 * stepped, with the SQL of each — the list is what makes a failure diagnosable
 * rather than just red, because "27 instead of 6" tells you nothing and
 * "26 of them are the same SELECT with a different id" tells you everything.
 *
 * The wrapper is installed on the live handle and removed in a finally, so a
 * throwing measurement cannot leave the rest of the file counting.
 */
function executions<T>(fn: () => T): { result: T; count: number; sql: string[] } {
  const database = db();
  const realPrepare = database.prepare.bind(database);
  const sql: string[] = [];

  const counted = (source: string) => {
    const stmt = realPrepare(source);
    // Only the three methods that touch the file. iterate() is not used
    // anywhere in src/ today; if it ever is, it belongs in this list and this
    // comment is how the next person finds that out.
    for (const method of ['get', 'all', 'run'] as const) {
      const original = stmt[method].bind(stmt);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (stmt as any)[method] = (...args: unknown[]) => {
        sql.push(source.replace(/\s+/g, ' ').trim());
        return (original as (...a: unknown[]) => unknown)(...args);
      };
    }
    return stmt;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (database as any).prepare = counted;
  try {
    return { result: fn(), count: sql.length, sql };
  } finally {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (database as any).prepare = realPrepare;
  }
}

/** The most repeated statement in a measurement — the shape of an N+1. */
function worstRepeat(sql: string[]): { statement: string; times: number } {
  const counts = new Map<string, number>();
  for (const s of sql) counts.set(s, (counts.get(s) ?? 0) + 1);
  let statement = '';
  let times = 0;
  for (const [s, n] of counts) if (n > times) [statement, times] = [s, n];
  return { statement, times };
}

/**
 * A bazaar of `shops` published shops, each selling `itemsPerShop` things, on
 * rotating shelves and in rotating towns so the facet and grouping code has
 * something real to chew on rather than one repeated value.
 */
function stockBazaar(shops: number, itemsPerShop: number): EventRow[] {
  const shelves = ['khaja-food', 'sweets-bakery', 'groceries-spices', 'clothing-fabrics', 'jewellery'];
  const towns = ['Berlin', 'Hamburg', 'München', 'Frankfurt'];
  const out: EventRow[] = [];
  for (let i = 0; i < shops; i++) {
    const seller = makeOrganizer({ name: `Seller ${i}` });
    const shop = makeEvent({
      organizerId: seller.id,
      kind: 'shop',
      name: `Shop ${i}`,
      tiers: Array.from({ length: itemsPerShop }, (_, t) => ({
        tierKey: `item-${t}`,
        name: `Item ${t} of shop ${i}`,
        description: 'Something worth carrying home.',
      })),
    });
    db()
      .prepare(`UPDATE events SET category = ?, city = ? WHERE id = ?`)
      .run(shelves[i % shelves.length], towns[i % towns.length], shop.id);
    out.push(shop);
  }
  return out;
}

test('the goods view costs the same for 30 shops as for 3 — no per-shop read', () => {
  // Every test in this file shares one database, so the fixtures are read as
  // "before and after adding 27 shops" rather than as absolute totals — which
  // is the honest way to measure a slope anyway.
  stockBazaar(3, 4);
  const small = executions(() => listShopItems());

  stockBazaar(27, 4);
  const large = executions(() => listShopItems());

  assert.ok(
    large.result.length >= small.result.length + 108,
    `fixture check: 27 more shops of 4 items should add 108 rows, went from ${small.result.length} to ${large.result.length}`
  );

  assert.equal(
    large.count,
    small.count,
    `the goods view got more expensive with more shops: ${small.count} statements for 3 shops, ` +
      `${large.count} for 30. Most repeated: ${JSON.stringify(worstRepeat(large.sql))}`
  );
  // A generous ceiling, and a second kind of failure: a rewrite that is flat
  // in the number of shops but pays twenty statements per request anyway.
  assert.ok(
    large.count <= 12,
    `the goods view costs ${large.count} statements per request: ${large.sql.join(' | ')}`
  );
});

test('the feed snapshot is flat in the number of listings it is handed', () => {
  stockBazaar(3, 3);
  const few = listPublishedEvents();
  const small = executions(() => loadFeedSnapshot(few));

  stockBazaar(27, 3);
  const many = listPublishedEvents();
  const large = executions(() => loadFeedSnapshot(many));

  assert.ok(many.length >= few.length + 27, 'fixture check: 27 more listings are in the feed');
  assert.equal(
    large.count,
    small.count,
    `loadFeedSnapshot grew with the feed: ${small.count} for 3 listings, ${large.count} for 30. ` +
      `Most repeated: ${JSON.stringify(worstRepeat(large.sql))}`
  );
});

test('ratings for a whole page of items are ONE statement, however many shops', () => {
  const shops = stockBazaar(12, 2);
  // Reviews on a handful of them, through the real writer, so the aggregate
  // has something to fold rather than measuring the cost of returning nothing.
  for (const shop of shops.slice(0, 6)) {
    const { order } = makePaidOrder({ eventId: shop.id, items: [{ tierId: 'item-0', quantity: 1 }] });
    writeReview({ orderId: order.id, tierKey: 'item-0', rating: 5, body: 'Worth the trip.' });
  }

  const one = executions(() => ratingsForItems([shops[0].id]));
  const all = executions(() => ratingsForItems(shops.map((s) => s.id)));

  assert.ok(all.result.size >= 6, 'fixture check: six reviewed items are summarised');
  assert.equal(one.count, 1, `one shop should be one statement, got ${one.sql.join(' | ')}`);
  assert.equal(
    all.count,
    1,
    `twelve shops should still be one statement, got ${all.count}: ${all.sql.join(' | ')}`
  );
});

test('an empty page asks the database nothing it does not need', () => {
  // Nothing published at all — the state every new deployment starts in. The
  // point is not the exact number but that the bulk readers SHORT-CIRCUIT on
  // an empty id list instead of sending SELECT ... IN () to SQLite.
  const empty = executions(() => loadFeedSnapshot([]));
  assert.equal(empty.count, 0, `an empty feed asked ${empty.count} questions: ${empty.sql.join(' | ')}`);

  const noRatings = executions(() => ratingsForItems([]));
  assert.equal(noRatings.count, 0, `an empty rating lookup asked ${noRatings.count} questions`);
});

/**
 * How long the work takes, as a SHAPE rather than a number.
 *
 * The statement counts above prove the bazaar does not ask the database more
 * questions as it grows. They say nothing about the work done afterwards —
 * every item is folded into a search text, sorted, faceted and counted in
 * memory on each request, and one accidental nested loop in any of that is
 * invisible at the 35 items this bazaar holds today and fatal at four hundred
 * shops.
 *
 * So the assertion is about GROWTH, not speed: four times the data may not
 * cost ten times the time. Linear work comes in around 4x and passes with
 * enormous margin; quadratic comes in around 16x and fails. The bound is
 * deliberately loose because a test machine is a shared, noisy thing and a
 * timing test that fails on a busy laptop is a timing test somebody deletes.
 *
 * Measured on this machine when written: 400 items 5.3 ms, 1600 items 23.3 ms,
 * 6400 items 85.6 ms — linear across a sixteen-fold range.
 */
function timeOf(fn: () => unknown, runs = 3): number {
  fn();
  const started = process.hrtime.bigint();
  for (let i = 0; i < runs; i++) fn();
  return Number(process.hrtime.bigint() - started) / 1e6 / runs;
}

test('the bazaar’s in-memory work grows with the bazaar, not with its square', () => {
  stockBazaar(25, 8);
  const small = listShopItems().length;
  const smallMs = timeOf(() => {
    const items = listShopItems();
    facetCities(items, '');
    searchSuggestions(items);
  });

  // Enough shops to roughly quadruple what is already there — every test in
  // this file shares one database, so a fixed number would be a different
  // multiple depending on what ran before it.
  stockBazaar(Math.ceil((small * 3) / 8), 8);
  const large = listShopItems().length;
  const largeMs = timeOf(() => {
    const items = listShopItems();
    facetCities(items, '');
    searchSuggestions(items);
  });

  const dataRatio = large / small;
  assert.ok(dataRatio >= 3, `fixture check: expected roughly 4x the items, got ${dataRatio.toFixed(1)}x`);

  // A generous ceiling on a machine nobody controls. Linear lands near 4;
  // quadratic lands near 16 and is what this exists to catch.
  const timeRatio = largeMs / Math.max(smallMs, 0.2);
  assert.ok(
    timeRatio < 10,
    `${dataRatio.toFixed(1)}x the items cost ${timeRatio.toFixed(1)}x the time ` +
      `(${smallMs.toFixed(1)}ms -> ${largeMs.toFixed(1)}ms). That is the shape of a nested loop.`
  );
});
