/**
 * ASKING BEFORE COUNTING.
 *
 * Analytics on this site is lawful only because of the order things happen in:
 * the visitor is asked, and the script is loaded second. TTDSG §25 and the
 * GDPR require consent BEFORE anything is stored on or read from a device, and
 * GA4 sets a cookie the moment it runs — so every default in this module has
 * to fail towards "not counted".
 *
 * That is what is asserted here, and it is asserted from the awkward angles:
 * no storage at all, storage that throws, a hand-edited value, a half-written
 * record. Every one of them must read as "no consent", because the alternative
 * — one of them reading as consent — means tracking somebody who never agreed.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

class FakeStorage {
  private data = new Map<string, string>();
  refuseReads = false;
  refuseWrites = false;
  getItem(key: string): string | null {
    if (this.refuseReads) throw new Error('SecurityError');
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    if (this.refuseWrites) throw new Error('QuotaExceededError');
    this.data.set(key, value);
  }
  removeItem(key: string): void {
    this.data.delete(key);
  }
}

const store = new FakeStorage();
const listeners = new Map<string, ((e: unknown) => void)[]>();

(globalThis as unknown as Record<string, unknown>).localStorage = store;
(globalThis as unknown as Record<string, unknown>).window = {
  location: { hostname: 'martnepali.test' },
  dispatchEvent: (e: { type: string }) => {
    for (const fn of listeners.get(e.type) ?? []) fn(e);
    return true;
  },
  addEventListener: (type: string, fn: (e: unknown) => void) => {
    listeners.set(type, [...(listeners.get(type) ?? []), fn]);
  },
  removeEventListener: (type: string, fn: (e: unknown) => void) => {
    listeners.set(type, (listeners.get(type) ?? []).filter((f) => f !== fn));
  },
};
(globalThis as unknown as Record<string, unknown>).document = { cookie: '' };
class FakeCustomEvent {
  type: string;
  detail: unknown;
  constructor(type: string, init?: { detail?: unknown }) {
    this.type = type;
    this.detail = init?.detail;
  }
}
(globalThis as unknown as Record<string, unknown>).CustomEvent = FakeCustomEvent;

const { CONSENT_KEY, readConsent, readConsentRecord, setConsent, subscribeConsent } = await import(
  '../src/lib/consent.ts'
);

test('a visitor who has not been asked is not consented', () => {
  store.removeItem(CONSENT_KEY);
  assert.equal(readConsent(), null, 'null is not "granted", and nothing loads for it');
  assert.equal(readConsentRecord(), null);
});

test('saying yes and saying no are both remembered, with when', () => {
  setConsent('granted', 1_700_000_000_000);
  assert.equal(readConsent(), 'granted');
  assert.equal(readConsentRecord()?.at, 1_700_000_000_000, 'Art. 7(1) puts the burden of showing consent on us');

  setConsent('denied', 1_700_000_001_000);
  assert.equal(readConsent(), 'denied');
});

test('anything unrecognised in the key reads as NOT consented', () => {
  // A hand-edited value, an older format, a truncated write. Every one of them
  // has to mean "do not track", because the only other option is tracking
  // somebody on the strength of a corrupted string.
  for (const junk of [
    'granted',            // the bare string of an older shape
    'yes',
    '{}',
    '{"choice":"maybe"}',
    '{"choice":"granted"',  // truncated
    'null',
    '[]',
    '',
  ]) {
    store.setItem(CONSENT_KEY, junk);
    assert.notEqual(readConsent(), 'granted', `"${junk}" must not be read as consent`);
  }
});

test('a browser that refuses to read storage is treated as not consented', () => {
  setConsent('granted', 1_700_000_000_000);
  store.refuseReads = true;
  assert.equal(readConsent(), null, 'unreadable must never mean granted');
  store.refuseReads = false;
});

test('a browser that refuses to WRITE does not silently become consented', () => {
  store.removeItem(CONSENT_KEY);
  store.refuseWrites = true;
  assert.doesNotThrow(() => setConsent('granted'), 'the click must not throw in the visitor’s face');
  store.refuseWrites = false;
  assert.notEqual(readConsent(), 'granted', 'nothing was stored, so nothing is remembered');
});

test('with no storage at all the answer is no', () => {
  const real = (globalThis as unknown as Record<string, unknown>).localStorage;
  delete (globalThis as unknown as Record<string, unknown>).localStorage;
  try {
    assert.equal(readConsent(), null);
    assert.doesNotThrow(() => setConsent('granted'));
  } finally {
    (globalThis as unknown as Record<string, unknown>).localStorage = real;
  }
});

test('withdrawing deletes the cookies Google already set', () => {
  // Stopping the script but leaving _ga on the device would be a withdrawal in
  // name only — the identifier would still be there to recognise the browser.
  (globalThis as unknown as { document: { cookie: string } }).document.cookie =
    '_ga=GA1.1.123.456; _ga_2VMKXHYBJQ=GS1.1.789; other=keep';
  const written: string[] = [];
  Object.defineProperty((globalThis as unknown as { document: object }).document, 'cookie', {
    get: () => '_ga=GA1.1.123.456; _ga_2VMKXHYBJQ=GS1.1.789; other=keep',
    set: (v: string) => written.push(v),
    configurable: true,
  });

  setConsent('denied');

  assert.ok(written.some((c) => c.startsWith('_ga=') && /Max-Age=0/.test(c)), '_ga must be cleared');
  assert.ok(written.some((c) => c.startsWith('_ga_2VMKXHYBJQ=')), 'the per-property cookie too');
  assert.ok(!written.some((c) => c.startsWith('other=')), 'and nothing that is not Google’s');
});

test('a change is announced, so the tag stops within the same page view', () => {
  // A control that only takes effect after a reload makes a visitor doubt it
  // did anything — which for a privacy choice is the worst possible outcome.
  const seen: (string | null)[] = [];
  const unsubscribe = subscribeConsent((c) => seen.push(c));
  setConsent('granted', 1_700_000_002_000);
  setConsent('denied', 1_700_000_003_000);
  unsubscribe();
  setConsent('granted', 1_700_000_004_000);

  assert.deepEqual(seen, ['granted', 'denied'], 'both changes announced, and none after unsubscribing');
});
