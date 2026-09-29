/**
 * THE SHOPPER'S TWO LISTS.
 *
 * "Saved for later" (localStorage) and "recently viewed" (sessionStorage,
 * gone when the tab closes) live on the shopper's own device and never reach
 * the server — which is the whole point
 * of them (no account, no record of what a named person browsed, nothing to
 * retain, export or erase). It also means nothing on the server side can go
 * wrong with them, and so nothing was testing them at all.
 *
 * What CAN go wrong is everything that happens to a string in a browser key:
 * it is edited by hand, it is left over from an older version of the site, it
 * is written by a browser that then refuses the next write because the quota
 * is full, and it is read during a server render where there is no storage at
 * all. Each of those is a real crash waiting in a page that has no error
 * boundary, and each is asserted below.
 *
 * The fake store is deliberately dumb — a Map with the two hooks needed to
 * make it throw — because the interesting behaviour is entirely in how
 * lib/savedItems reacts to a store misbehaving.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

class FakeStorage {
  private data = new Map<string, string>();
  /** Set to make every write throw, the way a full quota does. */
  refuseWrites = false;
  /** Set to make every read throw, the way Safari private mode used to. */
  refuseReads = false;

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
  raw(key: string): string | null {
    return this.data.get(key) ?? null;
  }
}

const store = new FakeStorage();
const session = new FakeStorage();
// Installed before the module is imported, because storage() reads the global
// at call time — but a test that relied on that ordering by accident would be
// a test that breaks when somebody memoises it.
(globalThis as unknown as { localStorage: FakeStorage }).localStorage = store;
(globalThis as unknown as { sessionStorage: FakeStorage }).sessionStorage = session;
// A history left in localStorage by the version before "recently viewed" moved
// to sessionStorage. The first touch of the list must delete it.
store.setItem('martnepali.recent.v1', '[]');

const { MAX_RECENT, MAX_SAVED, RECENT_KEY, SAVED_KEY, clearList, isSaved, readList, remember, toggleSaved } =
  await import('../src/lib/savedItems.ts');

/** An item as a tile would hand it over. */
function item(n: number) {
  return {
    href: `/e/shop/item/thing-${n}`,
    name: `Thing ${n}`,
    shopName: 'Sunita’s Kitchen',
    city: 'Berlin',
    priceCents: 950 + n,
    currency: 'EUR',
    photoId: null,
    at: 1_700_000_000_000 + n,
  };
}

test('recently viewed lives only for the tab: sessionStorage, and the old localStorage copy is deleted', () => {
  assert.notEqual(store.raw(RECENT_KEY), null, 'fixture check: a legacy history is present');
  remember(item(1));
  assert.equal(store.raw(RECENT_KEY), null, 'the legacy localStorage history is gone');
  assert.ok(session.raw(RECENT_KEY)?.includes(item(1).href), 'the new entry is in sessionStorage');
  remember(item(2));
  assert.equal(store.raw(RECENT_KEY), null, 'and nothing is ever written back to localStorage');
  assert.deepEqual(
    readList(RECENT_KEY).map((r) => r.href),
    [item(2).href, item(1).href]
  );
  // Saved-for-later is something the shopper asked to keep, so it stays put.
  clearList(SAVED_KEY);
  toggleSaved(item(5));
  assert.ok(store.raw(SAVED_KEY)?.includes(item(5).href));
  assert.equal(session.raw(SAVED_KEY), null);
});

test('saving is a toggle, and it reports the state it just moved to', () => {
  clearList(SAVED_KEY);
  assert.equal(toggleSaved(item(1)), true, 'first press saves');
  assert.equal(isSaved(item(1).href), true);
  assert.equal(toggleSaved(item(1)), false, 'second press un-saves');
  assert.equal(isSaved(item(1).href), false);
});

test('the same item saved twice is one entry, not two', () => {
  clearList(SAVED_KEY);
  toggleSaved(item(2));
  toggleSaved(item(2)); // off
  toggleSaved(item(2)); // on again
  assert.equal(readList(SAVED_KEY).filter((r) => r.href === item(2).href).length, 1);
});

test('recently viewed is newest first and de-duplicated by the item, not the visit', () => {
  clearList(RECENT_KEY);
  remember(item(1));
  remember(item(2));
  remember(item(1)); // looked at again
  const hrefs = readList(RECENT_KEY).map((r) => r.href);
  assert.deepEqual(hrefs, [item(1).href, item(2).href], 'the one just looked at leads');
  assert.equal(hrefs.filter((h) => h === item(1).href).length, 1, 'and appears once');
});

test('both lists are capped, and the cap is enforced on read as well as write', () => {
  clearList(RECENT_KEY);
  for (let i = 0; i < MAX_RECENT + 10; i++) remember(item(i));
  assert.equal(readList(RECENT_KEY).length, MAX_RECENT);

  // A list left over from a more generous limit shrinks the first time it is
  // looked at, rather than staying oversized until the next save.
  const oversized = Array.from({ length: MAX_SAVED + 25 }, (_, i) => item(1000 + i));
  store.setItem(SAVED_KEY, JSON.stringify(oversized));
  assert.equal(readList(SAVED_KEY).length, MAX_SAVED);
});

test('a hand-edited key cannot put a javascript: link on the page', () => {
  // These strings go straight into an anchor's href. Same-origin paths only.
  store.setItem(
    SAVED_KEY,
    JSON.stringify([{ ...item(1), href: 'javascript:alert(1)' }, { ...item(2), href: 'https://evil.test/x' }, item(3)])
  );
  const hrefs = readList(SAVED_KEY).map((r) => r.href);
  assert.deepEqual(hrefs, [item(3).href], 'only the same-origin path survives');
});

test('rubbish in the key is ignored rather than thrown', () => {
  for (const junk of ['not json at all', '{"not":"an array"}', '[1,2,3]', '[{"href":"/x"}]', '']) {
    store.setItem(SAVED_KEY, junk);
    assert.deepEqual(readList(SAVED_KEY), [], `"${junk.slice(0, 20)}" must read as an empty list`);
  }
});

test('a browser that refuses to write does not break the button', () => {
  clearList(SAVED_KEY);
  toggleSaved(item(1));
  store.refuseWrites = true;
  // The caller has already been told what the new state is; the next read
  // simply returns what is still on disk. What must NOT happen is a throw.
  assert.doesNotThrow(() => toggleSaved(item(2)));
  assert.doesNotThrow(() => remember(item(3)));
  store.refuseWrites = false;
});

test('a browser that refuses to read reads as empty, not as a crash', () => {
  store.refuseReads = true;
  assert.deepEqual(readList(SAVED_KEY), []);
  assert.equal(isSaved('/e/shop/item/thing-1'), false);
  store.refuseReads = false;
});

test('with no storage at all — a server render — every call is a quiet no-op', () => {
  const g = globalThis as unknown as { localStorage?: unknown; sessionStorage?: unknown };
  const real = g.localStorage;
  const realSession = g.sessionStorage;
  delete g.localStorage;
  delete g.sessionStorage;
  try {
    assert.deepEqual(readList(SAVED_KEY), []);
    assert.deepEqual(readList(RECENT_KEY), []);
    assert.equal(isSaved('/x'), false);
    assert.doesNotThrow(() => remember(item(9)));
    assert.doesNotThrow(() => clearList(SAVED_KEY));
    assert.doesNotThrow(() => clearList(RECENT_KEY));
  } finally {
    g.localStorage = real;
    g.sessionStorage = realSession;
  }
});
