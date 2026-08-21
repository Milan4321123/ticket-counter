/**
 * THE OTHER HALF OF THIS PRODUCT.
 *
 * Half of what MartNepali actually delivers arrives by email: the payment
 * instructions a stranger reads before transferring real money to a stranger's
 * IBAN, and the QR codes that are the thing they bought. Nothing was testing
 * any of it. A page renders wrong and somebody reloads; an email renders wrong
 * and it is in a thousand inboxes, unrecallable, and the first you hear of it
 * is a buyer who cannot find their ticket.
 *
 * The failures worth catching are not subtle ones — they are the embarrassing
 * ones that a person would spot instantly and a machine never looks for:
 *
 *   · "undefined" or "NaN" in a sentence, from a field that was empty;
 *   · a relative link, which is dead in every mail client there is;
 *   · a buyer's mail quoting a price without saying whose it is — the same
 *     disclosure rule the pages are held to, and MORE important here, because
 *     this is the message somebody acts on with their banking app open;
 *   · a shop's buyer told to turn up at "the door" of an event, or an event's
 *     buyer told to collect an order.
 *
 * Emails are rendered here, never sent: nodemailer's transport is replaced
 * before lib/email is loaded, so what the assertions read is exactly the
 * message that would have gone out.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import nodemailer from 'nodemailer';
import { makeEvent, makeOrganizer, makePaidOrder, makeOrder, db } from './helpers.ts';

/** Every message the code under test tried to send, in order. */
const sent: { to?: string; subject?: string; html?: string; text?: string }[] = [];

// Replace the transport on the module object itself, before lib/email is
// imported: it calls nodemailer.createTransport() at send time, so the two see
// the same object and no send ever reaches a socket.
(nodemailer as unknown as { createTransport: unknown }).createTransport = () => ({
  sendMail: async (message: { to?: string; subject?: string; html?: string; text?: string }) => {
    sent.push(message);
    return { messageId: 'test' };
  },
});

// The master switch every send checks first, plus a From address per audience.
process.env.SMTP_HOST = 'smtp.test';
process.env.EMAIL_FROM = 'MartNepali <hello@test.invalid>';
process.env.NEXT_PUBLIC_BASE_URL = 'https://martnepali.test';
// Signs the order access token, which is the entire right to write a review —
// and, on a deployment without it, the reason the invitation is not sent.
process.env.APP_SECRET = 'a-long-enough-secret-for-tests-only-0123456789';

const {
  sendOrganizerCredentialsEmail,
  sendPayoutChangedEmail,
  sendSignInAlertEmail,
  sendTicketEmail,
  sendTransferInstructionsEmail,
} = await import('../src/lib/email.ts');

/** Both bodies of the last mail, as one string to search. */
function lastBody(): string {
  const mail = sent[sent.length - 1];
  assert.ok(mail, 'no mail was sent');
  return `${mail.html ?? ''}\n${mail.text ?? ''}`;
}

/**
 * Run a send and return its body, having first proved the send HAPPENED.
 *
 * Without this, a sender that bails early — no From address for that audience,
 * an unconfigured switch, a guard that changed — leaves lastBody() reading the
 * PREVIOUS test's mail, and every "must not contain" assertion passes for
 * free. That is the exact shape of a test suite that goes green while the
 * thing it guards has stopped happening, so the count is checked too: this
 * call must have added exactly one message.
 */
async function bodyOf(send: () => Promise<{ sent: boolean; reason?: string }>): Promise<string> {
  return (await bodiesOf(send)).join('\n');
}

/**
 * Every message ONE call produced, separately — because some calls produce
 * more than one and the difference matters.
 *
 * sendPayoutChangedEmail is the reason this exists: it tells the organizer AND
 * the platform owner that the account taking the money has moved. A test that
 * only read the last message was quietly checking the admin's copy and saying
 * nothing at all about the one that goes to the person who may have just been
 * robbed. Anything asserted about "the mail" should hold for all of them.
 */
async function bodiesOf(send: () => Promise<{ sent: boolean; reason?: string }>): Promise<string[]> {
  const before = sent.length;
  const result = await send();
  assert.equal(result.sent, true, `the mail was not sent: ${JSON.stringify(result)}`);
  assert.ok(sent.length > before, 'the send reported success and handed the transport nothing');
  return sent.slice(before).map((m) => `${m.html ?? ''}\n${m.text ?? ''}`);
}

const seller = makeOrganizer({ name: 'Sunita Rai', email: 'sunita@test.invalid' });

function makeShopWithOrder() {
  const shop = makeEvent({
    organizerId: seller.id,
    kind: 'shop',
    name: 'Sunita’s Home Kitchen',
    tiers: [{ tierKey: 'momo', name: 'Chicken momo · 10 pcs', priceCents: 950 }],
  });
  db()
    .prepare(`UPDATE events SET pickup_info = ?, city = ?, bank_iban = ?, bank_account_holder = ? WHERE id = ?`)
    .run('Collect Saturdays 3–7pm, Neukölln.', 'Berlin', 'DE02120300000000202051', 'Sunita Rai', shop.id);
  const { order } = makePaidOrder({ eventId: shop.id, items: [{ tierId: 'momo', quantity: 2 }] });
  return { shop, order };
}

test('a shop’s collection email says nothing a person would not', async () => {
  const { order } = makeShopWithOrder();
  const result = await sendTicketEmail(order.id);
  assert.equal(result.sent, true, `the mail must actually be built: ${JSON.stringify(result)}`);

  const body = lastBody();
  for (const slip of ['undefined', 'NaN', '[object Object]', 'Invalid Date']) {
    assert.ok(!body.includes(slip), `"${slip}" reached a buyer's inbox`);
  }
  assert.ok(sent[sent.length - 1].subject?.trim(), 'a mail with no subject reads as spam');
});

test('every link in a buyer’s mail is absolute — a relative one is dead in an inbox', async () => {
  const { order } = makeShopWithOrder();
  await bodyOf(() => sendTicketEmail(order.id));
  const html = sent[sent.length - 1].html ?? '';
  const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(hrefs.length > 0, 'fixture check: the mail has links');
  for (const href of hrefs) {
    assert.ok(
      /^(https?:|mailto:|tel:)/.test(href),
      `"${href}" is relative — an inbox has no origin to resolve it against`
    );
  }
});

test('a shop’s buyer is told about collection, never about a door', async () => {
  const { order } = makeShopWithOrder();
  const body = (await bodyOf(() => sendTicketEmail(order.id))).toLowerCase();
  assert.ok(body.includes('collect'), 'a shop order is collected');
  assert.ok(!/at the door/.test(body), 'nobody is turning up at a door for a jar of achar');
});

test('the collection email invites a review, and links straight to the form', async () => {
  // Nothing else on the site ever asks. The link carries the order's access
  // token, which is the entire right to write one, and lands on the panel
  // rather than the top of a long page.
  const { order } = makeShopWithOrder();
  const body = await bodyOf(() => sendTicketEmail(order.id));
  assert.match(body, /say how it was/i);
  assert.match(body, /#review/, 'it must land on the panel, not the top of the order page');
  assert.match(body, /token=/, 'and carry the token that is the right to write one');
});

test('with no APP_SECRET there is no token, so the invitation is not made at all', async () => {
  // The form on the order page appears only for a reader holding the token.
  // Without a signing secret there is no token, so asking somebody to review
  // would land them on a page with nothing to fill in.
  const secret = process.env.APP_SECRET;
  delete process.env.APP_SECRET;
  try {
    const { order } = makeShopWithOrder();
    await sendTicketEmail(order.id);
    const body = lastBody();
    assert.ok(!/say how it was/i.test(body), 'a promise the page cannot keep must not be made');
    assert.ok(!body.includes('#review'));
  } finally {
    process.env.APP_SECRET = secret;
  }
});

test('an EVENT’s buyer is told about the door, and never asked to review a night out', async () => {
  const event = makeEvent({
    organizerId: seller.id,
    name: 'Dashain Night 2026',
    tiers: [{ tierKey: 'entry', name: 'Standard entry', priceCents: 1500 }],
  });
  const { order } = makePaidOrder({ eventId: event.id, items: [{ tierId: 'entry', quantity: 1 }] });
  const body = await bodyOf(() => sendTicketEmail(order.id));
  assert.ok(!/say how it was/i.test(body), 'there is no item here to review');
  assert.match(body.toLowerCase(), /door|scanned/);
});

test('the payment instructions name the seller whose account the money goes to', async () => {
  // The one message somebody reads with their banking app already open. A mail
  // that quotes an amount and an IBAN without saying whose they are is the
  // exact shape of a scam, and it is also the VAT rule the whole platform
  // structure depends on.
  const shop = makeEvent({
    organizerId: seller.id,
    kind: 'shop',
    name: 'Sunita’s Home Kitchen',
    tiers: [{ tierKey: 'momo', name: 'Chicken momo · 10 pcs', priceCents: 950 }],
  });
  db()
    .prepare(`UPDATE events SET pickup_info = ?, bank_iban = ?, bank_account_holder = ?, bank_name = ? WHERE id = ?`)
    .run('Collect Saturdays 3–7pm.', 'DE02120300000000202051', 'Sunita Rai', 'Test Bank', shop.id);
  const order = makeOrder({ eventId: shop.id, items: [{ tierId: 'momo', quantity: 1 }], paymentMode: 'transfer' });

  const result = await sendTransferInstructionsEmail(order.id);
  assert.equal(result.sent, true, `the mail must be built: ${JSON.stringify(result)}`);

  const body = lastBody();
  assert.match(body, /Sunita Rai/, 'the account holder is named');
  assert.match(body, /DE02\s?1203|DE02120300000000202051/, 'the IBAN they must type is there');
  for (const slip of ['undefined', 'NaN', '[object Object]']) {
    assert.ok(!body.includes(slip), `"${slip}" reached a buyer about to move money`);
  }
});

// ---------------------------------------------------------------------------
// THE ORGANIZER'S MAIL
// ---------------------------------------------------------------------------
//
// Three of these are security messages, and two of them go to an address
// nobody can be certain is still in the right hands — that is the whole reason
// they are sent. What they must NOT contain is therefore as important as what
// they must.

const ORGANIZER = { name: 'Sunita Rai', email: 'sunita@sellers.test' };

test('the credentials mail carries the one-time password, and says it is one', () => {
  // The single message that turns an approved application into an account. If
  // the password does not survive the template, the seller cannot get in and
  // has no way to find out why.
  return bodyOf(() => sendOrganizerCredentialsEmail(ORGANIZER, 'correct-horse-battery-staple')).then((body) => {
    assert.match(body, /correct-horse-battery-staple/, 'the password must actually be in it');
    assert.match(body, /portal\/login/, 'and somewhere to use it');
    assert.match(body.toLowerCase(), /one-time|temporary|change/, 'and it must say the password is temporary');
    for (const slip of ['undefined', 'NaN', '[object Object]']) {
      assert.ok(!body.includes(slip), `"${slip}" is in the mail that sets up an account`);
    }
  });
});

test('the payout alarm shows only the last four digits — never the whole account', () => {
  // This mail goes to somebody who may have just been robbed. Printing the new
  // IBAN in full would hand the attacker's account number to the victim and the
  // victim's to the attacker, and help neither.
  const IBAN = 'DE02120300000000202051';
  return bodiesOf(() =>
    sendPayoutChangedEmail(
      ORGANIZER,
      { id: 'ev1', name: 'Dashain Night 2026' },
      { labels: ['your IBAN'], bankIban: IBAN, paypalAccount: '', firstTime: false, effectiveAt: null }
    )
  ).then((bodies) => {
    // This call sends TWO messages — the organizer's and the platform owner's
    // — and the rule holds for both. Reading only the last one was checking
    // the admin's copy and saying nothing about the one that goes to the
    // person who may have just been robbed.
    assert.ok(bodies.length >= 1, 'fixture check: something was sent');
    for (const body of bodies) {
      assert.ok(!body.includes(IBAN), 'the full IBAN must never appear in an alert');
      assert.ok(!body.includes('120300000000'), 'nor any usable middle of it');
      assert.match(body, /2051/, 'the last four are enough to recognise your own account');
      assert.match(body, /Dashain Night 2026/, 'and it must say which listing changed');
    }
  });
});

test('the payout alarm says how long there is to stop it, when there is a window', () => {
  // A warning worth little if it does not say the reader can still act. The
  // window is the entire reason the change is delayed rather than instant.
  const inTwoDays = Date.now() + 2 * 24 * 60 * 60 * 1000;
  return bodiesOf(() =>
    sendPayoutChangedEmail(
      ORGANIZER,
      { id: 'ev1', name: 'Dashain Night 2026' },
      { labels: ['your IBAN'], bankIban: 'DE02120300000000202051', paypalAccount: '', firstTime: false, effectiveAt: inTwoDays }
    )
  ).then((bodies) => {
    for (const body of bodies) {
      assert.ok(
        /still|until|before|stop|cancel/i.test(body),
        'an alarm that does not say what to do is a receipt'
      );
    }
  });
});

test('the sign-in alert names when, and gives somewhere to go — without a secret in it', () => {
  return bodyOf(() =>
    sendSignInAlertEmail(ORGANIZER, { device: 'Chrome on macOS', when: new Date('2026-08-21T19:30:00Z') })
  ).then((body) => {
    assert.match(body, /Chrome on macOS/);
    assert.match(body, /2026|August/, 'a sign-in alert with no time is unactionable');
    // Nothing that would let a reader of this mailbox get in.
    assert.ok(!/token=|password/i.test(body) || !/token=[A-Za-z0-9]{16}/.test(body), 'no credential rides along');
    for (const slip of ['undefined', 'NaN', 'Invalid Date']) {
      assert.ok(!body.includes(slip), `"${slip}" is in a security alert`);
    }
  });
});

test('every organizer mail links absolutely, exactly like a buyer’s', () => {
  // An inbox has no origin to resolve a relative href against — the rule does
  // not care whose inbox it is.
  return bodyOf(() => sendOrganizerCredentialsEmail(ORGANIZER, 'temp-password-123')).then(() => {
    const html = sent[sent.length - 1].html ?? '';
    for (const m of html.matchAll(/href="([^"]+)"/g)) {
      assert.ok(/^(https?:|mailto:|tel:)/.test(m[1]), `"${m[1]}" is relative`);
    }
  });
});
