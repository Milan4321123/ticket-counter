/**
 * "ASK THE ORGANIZER" TAKES AN EMAIL WITHOUT AN "I AGREE" TICK.
 *
 * Emailing the answer back is exactly what somebody who types their address
 * into this form is asking for, so the legal basis is the request itself (Art.
 * 6(1)(b) GDPR) — and a consent that cannot be refused without losing the
 * answer is not a consent. The form now says what happens to the address in a
 * notice; the route used to refuse any address sent without `privacyAck: true`
 * and must not any more. Older copies of the form still send the flag, so it
 * is accepted and ignored either way.
 *
 * In-process, like orders.per-address-ceiling: a plain Request, no server.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { POST } from '../src/app/api/events/[id]/ask/route.ts';
import { listEventQuestions } from '../src/lib/events.ts';
import { makeEvent } from './helpers.ts';

let ipSeq = 0;

async function ask(eventId: string, body: Record<string, unknown>) {
  ipSeq += 1;
  const res = await POST(
    new Request(`http://localhost/api/events/${eventId}/ask`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': `198.51.100.${ipSeq}` },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: eventId }) }
  );
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

test('an escalated question with an email and NO privacy tick is accepted', async () => {
  const event = makeEvent({ status: 'published' });
  const res = await ask(event.id, {
    question: 'Is there parking nearby?',
    escalate: true,
    askerName: 'Sita',
    askerEmail: 'sita@example.test',
  });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.willEmail, true);
  const open = listEventQuestions(event.id, 'open');
  assert.equal(open.length, 1);
  assert.equal(open[0].askerEmail, 'sita@example.test');
});

test('an older form still sending privacyAck (true or false) is accepted too', async () => {
  const event = makeEvent({ status: 'published' });
  for (const privacyAck of [true, false]) {
    const res = await ask(event.id, {
      question: `Can children come? (${privacyAck})`,
      escalate: true,
      askerEmail: 'ram@example.test',
      privacyAck,
    });
    assert.equal(res.status, 200, JSON.stringify(res.body));
  }
  assert.equal(listEventQuestions(event.id, 'open').length, 2);
});

test('a malformed email is still refused', async () => {
  const event = makeEvent({ status: 'published' });
  const res = await ask(event.id, { question: 'Any vegan food?', escalate: true, askerEmail: 'not-an-email' });
  assert.equal(res.status, 400);
  assert.equal(listEventQuestions(event.id, 'open').length, 0);
});
