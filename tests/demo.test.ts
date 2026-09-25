// Try-it-yourself demo accounts (lib/demo.ts): the wall around them.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  adoptDemoListing,
  createDemoSandbox,
  deleteDemoAccount,
  demoAddress,
  demoTargetPath,
  keepDemoForApplication,
  sweepExpiredDemos,
} from '../src/lib/demo.ts';
import { getEventById, getEventTiers, listPublishedEvents } from '../src/lib/events.ts';
import { isUndeliverableAddress } from '../src/lib/email.ts';
import { paymentOptionsFor } from '../src/lib/paymentConnections.ts';
import { requestStallLink, StallActionError } from '../src/lib/stalls.ts';
import { getOrganizer, listOrganizers } from '../src/lib/organizers.ts';
import { db, makeEvent, makeOrganizer } from './helpers.ts';

process.env.PAYMENT_MODE = 'transfer';
process.env.APP_SECRET ??= 'test-app-secret-for-demo-accounts-0123456789';

describe('demo accounts', () => {
  it('builds a full sandbox that never reaches a public list', async () => {
    const real = makeEvent({ name: 'A real event' });
    const demo = await createDemoSandbox();
    const event = getEventById(demo.eventId)!;
    const shop = getEventById(demo.shopId)!;

    assert.equal(event.isDemo, true);
    assert.equal(shop.isDemo, true);
    assert.equal(event.status, 'published');
    const listed = listPublishedEvents().map((e) => e.id);
    assert.ok(listed.includes(real.id));
    assert.ok(!listed.includes(demo.eventId) && !listed.includes(demo.shopId), 'demo listings stay out of every public list');
    assert.ok(!listOrganizers().some((o) => o.id === demo.organizerId), 'and out of the admin lists');

    const orders = db().prepare(`SELECT COUNT(*) AS n FROM orders WHERE event_id IN (?, ?)`).get(demo.eventId, demo.shopId) as { n: number };
    assert.ok(orders.n >= 30, 'comes with orders to look at');
    const emails = db()
      .prepare(`SELECT buyer_email AS e FROM orders WHERE event_id IN (?, ?)`)
      .all(demo.eventId, demo.shopId) as { e: string }[];
    assert.ok(emails.every((r) => isUndeliverableAddress(r.e)), 'every seeded buyer address is undeliverable');
    assert.ok(isUndeliverableAddress(getOrganizer(demo.organizerId)!.email));

    assert.match(demoTargetPath(demo.organizerId, 'insights'), new RegExp(`/portal/events/${demo.eventId}/insights`));
    assert.match(demoTargetPath(demo.organizerId, 'buyer-shop'), /^\/e\/demo-/);
  });

  it('takes no real money: only the simulated route, whatever the listing says', async () => {
    const demo = await createDemoSandbox();
    db().prepare(`UPDATE events SET pay_transfer = 1, pay_paypal = 1, pay_stripe = 1 WHERE id = ?`).run(demo.eventId);
    const options = paymentOptionsFor(getEventById(demo.eventId)!);
    assert.deepEqual(
      { transfer: options.transfer, paypal: options.paypal, stripe: options.stripe, mock: options.mock },
      { transfer: false, paypal: null, stripe: null, mock: true }
    );
    // A real listing is unaffected in transfer mode.
    assert.equal(paymentOptionsFor(makeEvent()).mock, false);
  });

  it('cannot link a demo shop to a real event, or a real shop to a demo event', async () => {
    const demo = await createDemoSandbox();
    const realOrg = makeOrganizer();
    const future = new Date(Date.now() + 20 * 86_400_000).toISOString().slice(0, 10);
    const realEvent = makeEvent({ organizerId: realOrg.id, eventDate: future });
    const realShop = makeEvent({ organizerId: realOrg.id, kind: 'shop' });
    assert.throws(() => requestStallLink(demo.organizerId, demo.shopId, realEvent.id, 'hi'), StallActionError);
    assert.throws(() => requestStallLink(realOrg.id, realShop.id, demo.eventId, 'hi'), StallActionError);
  });

  it('deletes itself completely when it expires, and never touches a real account', async () => {
    const demo = await createDemoSandbox();
    db().prepare(`UPDATE organizers SET demo_expires_at = datetime('now', '-1 minute') WHERE id = ?`).run(demo.organizerId);
    assert.ok(sweepExpiredDemos(true) >= 1);
    assert.equal(getOrganizer(demo.organizerId), null);
    assert.equal(getEventById(demo.eventId), null);
    const left = db().prepare(`SELECT COUNT(*) AS n FROM orders WHERE event_id IN (?, ?)`).get(demo.eventId, demo.shopId) as { n: number };
    assert.equal(left.n, 0);

    const real = makeOrganizer();
    assert.throws(() => deleteDemoAccount(real.id), /real organizer/);
    assert.ok(getOrganizer(real.id));
  });

  it('an application keeps the demo, and approval moves its page into the real account as a clean draft', async () => {
    const demo = await createDemoSandbox();
    keepDemoForApplication(demo.organizerId);
    db().prepare(`UPDATE organizers SET demo_expires_at = datetime('now', '-1 minute') WHERE id <> ? AND is_demo = 1`).run(demo.organizerId);
    sweepExpiredDemos(true);
    assert.ok(getEventById(demo.shopId), 'kept past the usual 24 hours');

    const tiersBefore = getEventTiers(demo.shopId).length;
    const real = makeOrganizer();
    assert.equal(adoptDemoListing(demo.shopId, real.id), true);
    const moved = getEventById(demo.shopId)!;
    assert.equal(moved.organizerId, real.id);
    assert.equal(moved.isDemo, false);
    assert.equal(moved.status, 'draft', 'never live on arrival — publishing stays with the new owner');
    assert.equal(moved.bankIban, '', "the demo's example bank account does not come along");
    assert.equal(getEventTiers(demo.shopId).length, tiersBefore, 'the items do');
    const orders = db().prepare(`SELECT COUNT(*) AS n FROM orders WHERE event_id = ?`).get(demo.shopId) as { n: number };
    assert.equal(orders.n, 0, 'simulated orders are gone');

    // A real listing can never be taken this way, nor the same page twice.
    const other = makeEvent({ organizerId: makeOrganizer().id });
    assert.equal(adoptDemoListing(other.id, real.id), false);
    assert.equal(adoptDemoListing(demo.shopId, makeOrganizer().id), false);

    // Sweeping the rest of the demo leaves the moved page alone.
    db().prepare(`UPDATE organizers SET demo_expires_at = datetime('now', '-1 minute') WHERE id = ?`).run(demo.organizerId);
    sweepExpiredDemos(true);
    assert.equal(getEventById(demo.eventId), null);
    assert.ok(getEventById(demo.shopId));
  });

  it('never emails a .invalid address', () => {
    assert.equal(isUndeliverableAddress(demoAddress('buyer')), true);
    assert.equal(isUndeliverableAddress('Someone <x@demo.invalid>'), true);
    assert.equal(isUndeliverableAddress('someone@gmail.com'), false);
  });
});
