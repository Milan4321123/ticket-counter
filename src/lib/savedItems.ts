// The shopper's own two lists — "saved for later" and "recently viewed" — and
// the ONLY place on the site that keeps them.
//
// They live in localStorage, on the shopper's own device, and they never leave
// it. That is a decision, not a shortcut. Saving a jar of achar for Saturday is
// not worth an account, and the moment a list like this is written server-side
// it becomes a record of what a named person was looking at, which then needs a
// retention rule, an export, an erasure path and a line in the privacy notice.
// A key in their own browser needs none of that: they clear it by clearing
// their browser, and there is nothing here for anybody else to read. The saved
// page says so in one line, because a shopper cannot see where a list is kept.
//
// Safe on the client, and safe on the server by accident rather than by luck:
// nothing here imports the database, and every storage access goes through
// storage() below, which returns null when there is no localStorage at all —
// so a stray call during a server render is a no-op instead of a crash.

/**
 * One remembered item. Deliberately a FLAT COPY of what the tile showed rather
 * than a pointer at a row in the database.
 *
 * The alternative — storing an id and re-reading it — means the saved page
 * cannot render at all until the server has looked up every entry, and it means
 * an item whose shop has since been unpublished disappears from the list with
 * no explanation. A copy renders instantly, offline, and can still say what the
 * shopper saved even when the link behind it has gone. The price is that the
 * copy goes stale, which is why the saved page treats these as a shortcut back
 * to the item's own page and never as a basket: the item page is where the
 * live price, the live stock and the buy button are.
 */
export interface SavedItem {
  /** The item's own page — and its identity here. See dedup below. */
  href: string;
  name: string;
  /**
   * The seller, carried so the saved page can name them beside the price.
   * A buyer-facing page that shows a price without naming the seller is what
   * turns the whole order value into this platform's turnover, and the saved
   * page shows prices — so the seller travels WITH the price, in the same
   * record, and cannot be dropped by a careless render.
   */
  shopName: string;
  city: string;
  priceCents: number;
  currency: string;
  /** The item's photo id, for /api/media, or null when it had none. */
  photoId: string | null;
  /** When it was saved or last viewed, ms. Newest first is the whole order. */
  at: number;
}

/**
 * Versioned key names. The `.v1` is not decoration: these keys sit in browsers
 * this code cannot reach, so the day SavedItem gains a required field the old
 * rows are not migrated, they are simply left behind under a name nothing reads
 * any more. Changing the shape without changing the name is how a shopper ends
 * up with a saved list that renders half-empty cards forever.
 */
export const SAVED_KEY = 'martnepali.saved.v1';
export const RECENT_KEY = 'martnepali.recent.v1';

/**
 * Caps, applied on every write.
 *
 * localStorage is a few megabytes shared with everything else this origin
 * keeps, and neither list is improved by being unbounded: "recently viewed"
 * stops meaning anything at four hundred entries, and a saved list nobody can
 * scroll to the end of is a list nobody uses. The oldest entries fall off the
 * end — the shopper is never shown a "your list is full" refusal, because the
 * thing they just did (tapping save) must always appear to have worked.
 */
export const MAX_SAVED = 60;
export const MAX_RECENT = 20;

/**
 * localStorage, or null when there isn't one to be had.
 *
 * Three separate ways this fails, all of them real and all of them silent here:
 *   - a server render has no window at all;
 *   - Safari in private mode, and any browser with site data blocked, throws on
 *     ACCESS to the property, before a single read is attempted;
 *   - an embedded/third-party context throws SecurityError for the same reason.
 * None of those is worth an error boundary. A shopper with storage switched off
 * gets a site where saving quietly does nothing, which is the behaviour they
 * asked their browser for.
 */
function storage(): Storage | null {
  try {
    const store = globalThis.localStorage;
    return store ?? null;
  } catch {
    return null;
  }
}

/** Which cap a key gets. The two lists share every line of code but this. */
function limitFor(key: string): number {
  return key === RECENT_KEY ? MAX_RECENT : MAX_SAVED;
}

/**
 * Is this parsed blob one of ours?
 *
 * Checked field by field rather than trusted, because the contents of a
 * localStorage key are not this code's output — they are whatever is in that
 * browser right now. An older version of the site, a second tab running a
 * deploy from before a rename, an extension, a curious visitor with the
 * console open. One bad row must drop out of the list; it must never throw
 * inside a render and take the page down with it.
 */
function isSavedItem(value: unknown): value is SavedItem {
  if (typeof value !== 'object' || value === null) return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.href === 'string' &&
    row.href.startsWith('/') &&
    typeof row.name === 'string' &&
    typeof row.shopName === 'string' &&
    typeof row.city === 'string' &&
    typeof row.priceCents === 'number' &&
    Number.isFinite(row.priceCents) &&
    typeof row.currency === 'string' &&
    (row.photoId === null || typeof row.photoId === 'string') &&
    typeof row.at === 'number' &&
    Number.isFinite(row.at)
  );
}

/**
 * One list, newest first, already de-duplicated and already capped.
 *
 * The cap is applied on READ as well as on write so that a list left over from
 * an older, more generous limit shrinks the first time it is looked at, rather
 * than staying oversized until the shopper happens to save something.
 *
 * `href.startsWith('/')` above is the one piece of paranoia worth having: these
 * strings are put straight into an anchor's href, and a hand-edited key holding
 * `javascript:` would otherwise be a link this page renders for the person who
 * wrote it. Same-origin paths only, always.
 */
export function readList(key: string): SavedItem[] {
  const store = storage();
  if (!store) return [];
  let raw: string | null = null;
  try {
    raw = store.getItem(key);
  } catch {
    return [];
  }
  if (!raw) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const seen = new Set<string>();
  const out: SavedItem[] = [];
  for (const row of parsed) {
    if (!isSavedItem(row)) continue;
    if (seen.has(row.href)) continue;
    seen.add(row.href);
    out.push(row);
    if (out.length >= limitFor(key)) break;
  }
  return out;
}

/**
 * Write a list back, capped, and give up quietly if the browser refuses.
 *
 * Quota is the interesting failure: it is thrown by setItem, mid-click, and the
 * only sane answer is to keep the newest half and try once more. If that fails
 * too, the click does nothing visible — the caller has already been told what
 * the new state is and the next read simply returns what is still on disk.
 * Throwing here would surface a storage problem as a broken save button.
 */
function writeList(key: string, list: SavedItem[]): void {
  const store = storage();
  if (!store) return;
  const capped = list.slice(0, limitFor(key));
  try {
    store.setItem(key, JSON.stringify(capped));
  } catch {
    try {
      store.setItem(key, JSON.stringify(capped.slice(0, Math.floor(capped.length / 2))));
    } catch {
      // Storage is full or refusing writes. Nothing here is important enough
      // to interrupt a shopper over.
    }
  }
}

/** Is this item on the saved list right now? */
export function isSaved(href: string): boolean {
  return readList(SAVED_KEY).some((row) => row.href === href);
}

/**
 * Save or unsave, and answer with the state the button should now show.
 *
 * The list is re-read rather than kept in a module-level variable on purpose:
 * a shopper can have the bazaar open in two tabs, and the tab that writes last
 * would otherwise flatten whatever the other one saved. Reading immediately
 * before writing makes the loss window a few microseconds instead of a session.
 *
 * Identity is the href — the item's own page. Not the name, which two sellers
 * can share and one seller can edit; not a composite key assembled at the call
 * site, which is a second definition of "the same item" waiting to disagree
 * with this one.
 *
 * The answer is read back off the list rather than assumed from what was just
 * asked for. It costs one more getItem per click and it buys the one thing
 * that matters here: a shopper whose browser refused the write (storage off,
 * storage full) is shown "Save for later" still, instead of a button that says
 * "Saved" about something that will not be there after a reload.
 */
export function toggleSaved(item: SavedItem): boolean {
  const list = readList(SAVED_KEY);
  const without = list.filter((row) => row.href !== item.href);
  writeList(
    SAVED_KEY,
    without.length !== list.length ? without : [{ ...item, at: Date.now() }, ...without]
  );
  return isSaved(item.href);
}

/**
 * Note that this item was just looked at.
 *
 * Re-viewing something MOVES it to the front rather than adding a second row —
 * a "recently viewed" strip showing the same jar of pickle four times is worse
 * than useless, it hides the other three things the shopper looked at. The
 * stored copy is refreshed at the same time, so a price change shows up on the
 * strip the next time the item's page is opened.
 */
export function remember(item: SavedItem): void {
  const list = readList(RECENT_KEY).filter((row) => row.href !== item.href);
  writeList(RECENT_KEY, [{ ...item, at: Date.now() }, ...list]);
}

/** Forget a whole list. Used by the Clear buttons on the saved page. */
export function clearList(key: string): void {
  const store = storage();
  if (!store) return;
  try {
    store.removeItem(key);
  } catch {
    // Same as writeList: a browser that will not let us delete a key is not
    // something to shout at the shopper about.
  }
}
