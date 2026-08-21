'use client';

import { Fragment, useId, useState } from 'react';
import type { ReviewRow } from '@/lib/reviews';

/**
 * One buyer rating one thing they paid for, on their own order page.
 *
 * A client component because it is the only part of the bazaar that WRITES,
 * and a five-star input is the one control on the site where a page reload per
 * click would be absurd. Everything else people do while shopping — search,
 * filter, sort, page — stays a plain GET form that works with JavaScript off.
 *
 * Two decisions worth knowing before editing:
 *
 *   · MAX_REVIEW_CHARS arrives as a PROP rather than being imported. It lives
 *     in lib/reviews.ts, which reaches the database three imports down, and a
 *     'use client' file that imports it would drag better-sqlite3 into the
 *     browser bundle. The order page imports the real constant and hands it
 *     down, so there is still exactly one number and the server is still the
 *     one that enforces it. (The ReviewRow import above is `import type`,
 *     which the compiler erases entirely — no runtime edge to it.)
 *   · The form stays a form after it saves. Somebody who already wrote a
 *     review is shown what they wrote, in the same boxes, ready to change —
 *     not a grey "you have already reviewed this item" wall. They are allowed
 *     to change their mind for as long as their emailed link works, so being
 *     told the door is shut would be untrue as well as unkind.
 */
export interface ReviewFormProps {
  orderId: string;
  /**
   * The token out of the buyer's confirmation email. Transport only — the
   * route re-checks it against APP_SECRET and would refuse a made-up one, so
   * rendering it here grants nothing that opening this page did not already.
   */
  token: string;
  tierKey: string;
  /** The item's own name, for the legend and the accessible names. */
  itemName: string;
  /** What this buyer has already said about it, or null. */
  existing: ReviewRow | null;
  /** MAX_REVIEW_CHARS, passed down from the server — see the note above. */
  maxChars: number;
}

/** What POST /api/reviews answers with when it saved something. */
interface SavedReview {
  authorName: string;
  status: 'published' | 'hidden';
}

const STAR_VALUES = [1, 2, 3, 4, 5] as const;

/** How the five choices read to a screen reader, and on hover. */
const STAR_WORDS: Record<number, string> = {
  1: '1 star — poor',
  2: '2 stars — not great',
  3: '3 stars — fine',
  4: '4 stars — good',
  5: '5 stars — excellent',
};

/**
 * One star, drawn rather than typed.
 *
 * The path is the same one Stars.tsx draws, copied rather than shared because
 * that file exports the finished rating cluster and not the single glyph, and
 * these five sit directly under a page that renders those. Two different star
 * SHAPES in one column would look like a mistake, so if that path is ever
 * changed it has to be changed in both places — which is the whole reason this
 * comment exists.
 *
 * Sized in `em` so the stylesheet's font-size on the label is what decides how
 * big it is, and filled with currentColor so the lit and unlit states are one
 * colour change in CSS rather than two variants here.
 */
function StarGlyph() {
  return (
    <svg width="1em" height="1em" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M12 2.6l2.9 5.9 6.5.95-4.7 4.58 1.11 6.47L12 17.45 6.19 20.5l1.11-6.47L2.6 9.45l6.5-.95z"
        fill="currentColor"
      />
    </svg>
  );
}

export default function ReviewForm({
  orderId,
  token,
  tierKey,
  itemName,
  existing,
  maxChars,
}: ReviewFormProps) {
  // Unique per instance: an order with six items renders six of these, and six
  // radio groups called "rating" with six inputs called "rating-3" would be one
  // group of thirty and one very confused label.
  const uid = useId();
  const [rating, setRating] = useState<number | null>(existing?.rating ?? null);
  const [text, setText] = useState(existing?.body ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedReview | null>(null);

  // Counted on the TRIMMED text, because that is the string writeReview
  // measures and stores. Counting the raw box instead would let the form say
  // "1201 characters, too long" over a review that fits perfectly well once
  // the two blank lines at the end come off — the buyer would be sent hunting
  // for a sentence to cut that was never the problem.
  const trimmed = text.trim();
  const over = trimmed.length - maxChars;
  const tooLong = over > 0;
  const ready = rating !== null && !tooLong;

  // What the buyer is looking at RIGHT NOW: whatever they just saved, or what
  // was already on the record when the page was built. The distinction matters
  // for one sentence only — whether a hidden review is still hidden — and
  // getting it from the last answer the server gave is the only way to be sure
  // the page is not describing a state it has since left.
  const current: SavedReview | null =
    saved ?? (existing ? { authorName: existing.authorName, status: existing.status } : null);
  const hidden = current?.status === 'hidden';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !ready) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, token, tierKey, rating, body: trimmed }),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; authorName?: string; status?: string; error?: string }
        | null;
      if (!res.ok || !data?.ok) {
        setError(data?.error ?? 'That could not be saved — please try again.');
        setBusy(false);
        return;
      }
      setSaved({
        authorName: typeof data.authorName === 'string' ? data.authorName : '',
        // Anything other than the word the server actually uses is read as
        // published: this decides one reassuring sentence, and a typo in a
        // response should not be able to tell somebody their review is hidden.
        status: data.status === 'hidden' ? 'hidden' : 'published',
      });
      setBusy(false);
    } catch {
      setError('Could not reach the server — please check your connection and try again.');
      setBusy(false);
    }
  }

  return (
    <form className="bz-rev-form" onSubmit={submit}>
      <div className="card-title" style={{ margin: 0 }}>
        {itemName}
      </div>

      {/* A real fieldset: the five radios are one control, and without the
          group name a screen reader announces "1 star, radio, 3 of 5" with no
          indication of which of the six items on this order it belongs to.
          Native radios also mean the arrow keys already work — nothing here
          re-implements keyboard handling, because anything that did would get
          it slightly wrong. */}
      <fieldset className="bz-stars-input">
        <legend
          style={{
            padding: 0,
            marginBottom: 6,
            fontSize: '0.8rem',
            fontWeight: 600,
            color: 'var(--text-dim)',
          }}
        >
          Your rating
        </legend>
        {/* Fragment, not a wrapper element: the stylesheet fills every star up
            to the chosen one with `label:nth-of-type(-n + 4)`, and nth-of-type
            counts among SIBLINGS. Give each input/label pair a box of its own
            and every label becomes the first label in its parent, so picking
            three stars would light all five. */}
        {STAR_VALUES.map((n) => (
          <Fragment key={n}>
            {/* Input first, label second, as siblings: the stylesheet lights
                the chosen star through `input:checked + label` as well as
                through :has(), and the sibling order is what the first of
                those needs. The input is off-screen, not hidden — it is still
                focusable, still in the tab order, still announced.

                The name it is announced by is the aria-label, because the
                label element beside it holds nothing but a drawn star: without
                this, a screen reader would reach five unnamed radios. It says
                which ITEM as well as how many stars, since an order with six
                things on it puts six of these groups on one page. */}
            <input
              type="radio"
              id={`${uid}-star-${n}`}
              name={`${uid}-rating`}
              value={n}
              checked={rating === n}
              onChange={() => setRating(n)}
              disabled={busy}
              aria-label={`${STAR_WORDS[n]} for ${itemName}`}
            />
            <label htmlFor={`${uid}-star-${n}`} title={STAR_WORDS[n]}>
              <StarGlyph />
            </label>
          </Fragment>
        ))}
      </fieldset>

      <div>
        <label className="field-label" htmlFor={`${uid}-body`}>
          What should the next shopper know? <span className="muted">(optional)</span>
        </label>
        <textarea
          id={`${uid}-body`}
          className="input"
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={busy}
          placeholder="How was it? Anything you wish you had known before ordering."
          style={{ resize: 'vertical', fontFamily: 'inherit' }}
        />
        {/* Deliberately NOT a maxLength on the textarea. A hard cap silently
            swallows the end of a pasted paragraph, and the writer finds out by
            reading their own review back later with its last sentence missing.
            The count says where they are, the button waits, and nothing they
            typed is thrown away without them being told — the same reasoning
            writeReview() gives for refusing an over-long body rather than
            trimming it. */}
        {/* No aria-live on the count itself: it changes on every keystroke, and
            a live region that re-announces a number per letter typed makes the
            box unusable with a screen reader on. The one thing worth hearing is
            the CROSSING of the limit, which is announced once by the submit
            hint at the foot of the form. */}
        <p
          className="small"
          style={{ margin: '6px 0 0', color: tooLong ? 'var(--red, #f87171)' : 'var(--text-dim)' }}
        >
          {tooLong
            ? `${over} character${over === 1 ? '' : 's'} too many — please shorten it a little.`
            : `${trimmed.length} of ${maxChars} characters`}
        </p>
      </div>

      {error && (
        <div className="notice notice-error" role="alert">
          {error}
        </div>
      )}

      {saved && !error && (
        <div className="notice notice-success" role="status">
          {hidden ? (
            <>
              Saved. This one is <strong>not showing</strong> on the shop page at the moment — the site
              has hidden it, and saving again does not put it back.{' '}
              <a href="/contact" style={{ color: 'var(--accent)' }}>
                Tell us
              </a>{' '}
              if you think that is wrong.
            </>
          ) : saved.authorName ? (
            <>
              Saved — thank you. It appears on the shop page signed{' '}
              <strong>{saved.authorName}</strong>.
            </>
          ) : (
            <>Saved — thank you.</>
          )}
        </div>
      )}

      {/* The standing state of an existing review, shown before anything is
          submitted this visit. It says the door is open, not that it is shut. */}
      {!saved && existing && (
        <p className="muted small" style={{ margin: 0 }}>
          {hidden ? (
            <>
              You wrote this one already. It is <strong>not showing</strong> on the shop page — the site
              has hidden it, and editing it does not put it back.
            </>
          ) : (
            <>
              You wrote this one already, signed <strong>{existing.authorName}</strong>. Change whatever
              you like and save again — the shop page will show the new version.
            </>
          )}
        </p>
      )}

      <button type="submit" className="btn btn-primary" disabled={busy || !ready}>
        {busy ? (
          <>
            <span className="spinner" aria-hidden /> Saving…
          </>
        ) : existing || saved ? (
          'Save changes'
        ) : (
          'Post my review'
        )}
      </button>
      {/* Why the button is waiting, said in words. role="status" rather than a
          live count, because this sentence only changes when the form crosses
          from postable to not — once, which is exactly how often it is worth
          hearing. */}
      {!ready && !busy && (
        <p className="muted small" role="status" style={{ margin: 0 }}>
          {rating === null ? 'Pick a star rating to post.' : 'Shorten the text to post.'}
        </p>
      )}
    </form>
  );
}
