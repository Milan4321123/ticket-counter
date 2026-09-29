'use client';

// The two lists on /market/saved: what the shopper put aside, and what they
// have been looking at. Both come out of this browser's own localStorage and
// go nowhere else — see lib/savedItems for why, and for the guards around a
// storage that can be absent, full, or refusing to answer.
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { RECENT_KEY, SAVED_KEY, clearList, readList, toggleSaved } from '@/lib/savedItems';
import type { SavedItem } from '@/lib/savedItems';
import { formatMoney } from '@/lib/money';

/**
 * Said once on the page, and nowhere else on the site.
 *
 * A shopper has no way to see where a list like this is kept, and the two
 * things they would reasonably worry about are opposite: that we are watching
 * what they browse, and that their list will follow them to their phone. One
 * of those is a promise and the other is a limitation, so both are here in the
 * same breath rather than one of them being quietly left out.
 */
const DEVICE_LINE =
  'This list is kept in this browser and nothing about it is ever sent to us — which also ' +
  'means it will not follow you to another device, and clearing your browser data clears it.';

/**
 * One remembered item.
 *
 * Built from the copy stored at save time rather than from a fresh read, so
 * the page renders before anything has been fetched and still renders when the
 * shop behind an entry has been unpublished. The price on it is therefore the
 * price the shopper SAW, which is why the foot of the page says so and why
 * every card is a link to the item's own page, where the live figure is.
 */
function SavedCard({ row }: { row: SavedItem }) {
  const price = row.priceCents === 0 ? 'Free' : formatMoney(row.priceCents, row.currency);
  // The media URL is spelled out rather than imported from lib/events: that
  // module opens the database on import, and pulling it into a client bundle
  // would either fail the build or ship server code to a browser. It is one
  // stable public route — /api/media/<id>?v=card — and the tiles that produced
  // these rows asked for exactly the same 'card' render, so the picture here is
  // already in the shopper's cache.
  const photo = row.photoId ? `/api/media/${encodeURIComponent(row.photoId)}?v=card` : null;
  const spoken = `${row.name} — ${price} — sold by ${row.shopName}${
    row.city ? `, ${row.city}` : ''
  }`;

  return (
    <Link href={row.href} className="bz-tile" aria-label={spoken}>
      <div className="bz-tile-media">
        {photo ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img className="bz-tile-photo" src={photo} alt={`${row.name} — ${row.shopName}`} loading="lazy" />
        ) : (
          <div className="bz-tile-blank" aria-hidden="true">
            <span>{row.name.trim().charAt(0).toUpperCase() || 'M'}</span>
          </div>
        )}
      </div>
      <div className="bz-tile-body">
        <div className="bz-tile-price">{price}</div>
        <div className="bz-tile-name">{row.name}</div>
        {/* The seller, named wherever the price is. Stored alongside it in the
            same record for exactly this reason. */}
        <div className="bz-tile-seller">
          Sold by <strong>{row.shopName}</strong>
          {row.city ? ` · ${row.city}` : ''}
        </div>
      </div>
    </Link>
  );
}

export default function SavedItems() {
  /**
   * null means "we have not looked yet", and it is what keeps this component
   * out of a hydration mismatch. The server renders it too and cannot know
   * what is in somebody's browser; guessing an empty list there would print
   * "Nothing saved yet" into the HTML and then rip it out a frame later, which
   * is both a React warning and, for anyone reading slowly, a lie. Nothing is
   * rendered until the effect below has actually read the storage.
   */
  const [saved, setSaved] = useState<SavedItem[] | null>(null);
  const [recent, setRecent] = useState<SavedItem[] | null>(null);
  /**
   * Which Clear button is currently armed, by key, or ''.
   *
   * Two taps rather than one, because there is no undo behind this: the list
   * only exists in this browser, so a mis-tap on a phone is the whole list
   * gone for good. A native confirm() would do the same job by taking over the
   * screen; a button that changes its own label asks the same question without
   * moving the shopper anywhere.
   */
  const [arming, setArming] = useState('');

  useEffect(() => {
    setSaved(readList(SAVED_KEY));
    setRecent(readList(RECENT_KEY));
  }, []);

  if (saved === null || recent === null) return null;

  /** Re-read after every change rather than patching the array in place, so
      what is on screen is always what is actually in storage — including when
      a write was refused by a full or locked storage. */
  const refresh = () => {
    setSaved(readList(SAVED_KEY));
    setRecent(readList(RECENT_KEY));
  };

  const clearButton = (key: string, label: string) =>
    arming === key ? (
      <button
        type="button"
        className="btn btn-sm btn-danger"
        onClick={() => {
          clearList(key);
          setArming('');
          refresh();
        }}
      >
        Tap again to clear
      </button>
    ) : (
      <button type="button" className="btn btn-sm" onClick={() => setArming(key)}>
        {label}
      </button>
    );

  return (
    <>
      <section>
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}
        >
          <h2 className="feed-section-title" style={{ margin: 0 }}>
            Saved for later
          </h2>
          {saved.length > 0 && clearButton(SAVED_KEY, 'Clear saved')}
        </div>

        {saved.length === 0 ? (
          <div className="bz-empty">
            <p style={{ margin: 0 }}>
              Nothing saved yet. Tap <strong>Save for later</strong> on anything in the bazaar and
              it will be waiting here.
            </p>
            <p className="muted small" style={{ margin: '8px 0 0' }}>
              {DEVICE_LINE}
            </p>
            <p style={{ margin: '16px 0 0' }}>
              <Link className="btn btn-brand" href="/market">
                Browse everything on sale
              </Link>
            </p>
          </div>
        ) : (
          <div className="bz-grid" style={{ marginTop: 14 }}>
            {saved.map((row) => (
              /* The Remove button sits OUTSIDE the tile's link rather than on
                 top of it: a button inside an anchor is invalid markup, and
                 every way of faking it (a click handler that swallows the
                 navigation) breaks middle-click, long-press and the keyboard. */
              <div key={row.href} style={{ display: 'grid', gap: 6, alignContent: 'start' }}>
                <SavedCard row={row} />
                <button
                  type="button"
                  className="btn btn-sm"
                  aria-label={`Remove ${row.name} from your saved list`}
                  onClick={() => {
                    toggleSaved(row);
                    refresh();
                  }}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* No empty state for this one. "Recently viewed" is a convenience the
          shopper never asked for, and an empty box explaining that they have
          not viewed anything is the site talking about itself. */}
      {recent.length > 0 && (
        <section style={{ marginTop: 34 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <h2 className="feed-section-title" style={{ margin: 0 }}>
              Recently viewed
            </h2>
            {clearButton(RECENT_KEY, 'Clear history')}
          </div>
          <p className="muted small" style={{ margin: '6px 0 0' }}>
            Only for this tab — forgotten when you close it.
          </p>
          <div className="bz-grid" style={{ marginTop: 14 }}>
            {recent.map((row) => (
              <SavedCard key={row.href} row={row} />
            ))}
          </div>
        </section>
      )}

      {(saved.length > 0 || recent.length > 0) && (
        <p className="muted small" style={{ margin: '22px 0 0', maxWidth: 640 }}>
          {DEVICE_LINE} The prices above are the ones you were shown when you saved or opened each
          item — the seller&rsquo;s own page has today&rsquo;s, and whether it is still in stock.
        </p>
      )}
    </>
  );
}
