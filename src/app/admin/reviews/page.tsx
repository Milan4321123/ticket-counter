import Link from 'next/link';
import { redirect } from 'next/navigation';
import Stars from '@/components/Stars';
import { isAdminRequest } from '@/lib/auth';
import { readListingName } from '@/lib/exampleShop';
import { MAX_REVIEW_CHARS, listAllReviews } from '@/lib/reviews';
import type { RatingSummary } from '@/lib/reviews';

// Moderation: every review on the platform, and the one control a review has.
//
// This screen exists because the seller's screen deliberately does not have
// it. A shop cannot bury an opinion of its own goods — that is the whole
// reason a star on this site is worth anything — so the power to take one down
// has to live somewhere else, behind the admin session, used by a person who
// has no stake in the score.
//
// It is a list of cards rather than the table the other admin pages use, and
// that is a considered break: a row here is a paragraph somebody wrote, often
// with a seller's paragraph answering it underneath, and a table cell turns
// both into a squeezed column of wrapped text. The decision being made is
// "read this and judge it", which needs the words legible more than it needs
// the columns aligned.
//
// Both sides of the conversation are shown, the seller's reply included, and
// on purpose: a review that reads as unfair on its own quite often turns out
// to have been answered perfectly well already, and hiding it after that would
// take the seller's answer off the page with it.
//
// ONE statement feeds the page — listAllReviews joins the shop in, so nothing
// in the loop below goes near the database.
export const dynamic = 'force-dynamic';

export const metadata = { title: 'Reviews — Admin', robots: { index: false, follow: false } };

/**
 * How many are loaded. The newest few hundred is what moderation is ever
 * about: a complaint arrives about something written this week, not in March.
 *
 * The number matters to the page and not only to the query — the count printed
 * below has to say "the newest 200" rather than "200 reviews" the moment the
 * list is full, because the second one is a total this page never counted.
 */
const LIMIT = 200;

/**
 * What the API route told us, in words. The route sends back a short code in
 * ?note= and this turns it into a sentence; prose passed through a query
 * string is prose any stranger can put on this page with a crafted link.
 */
const NOTES: Record<string, { tone: 'success' | 'error'; text: string }> = {
  // Plain strings, so the apostrophes are the real character rather than the
  // HTML entity the JSX below can use — React prints these as text.
  hidden: {
    tone: 'success',
    text: 'Taken down. Shoppers no longer see it and it no longer counts towards the item’s stars — the seller sees it on their own page, with your reason.',
  },
  shown: {
    tone: 'success',
    text: 'Back up. It counts towards the item’s stars again and the old reason has been cleared off the row.',
  },
  noreason: {
    tone: 'error',
    text: 'Nothing was changed: a review only comes down with a written reason. It is what the seller and the buyer are told if either asks.',
  },
  notfound: {
    tone: 'error',
    text: 'We could not find that review. Reload this page and try again.',
  },
  toolong: {
    tone: 'error',
    text: `That reason was too long — keep it under ${MAX_REVIEW_CHARS} characters.`,
  },
  invalid: {
    tone: 'error',
    text: 'That did not reach us. Reload this page and try again.',
  },
  failed: {
    tone: 'error',
    text: 'Something went wrong at our end. Nothing was changed — please try again.',
  },
};

/** '2026-08-19 21:04:11' (UTC, as SQLite writes it) -> '19 Aug 2026'. */
function reviewDate(stamp: string): string {
  const d = new Date(stamp.replace(' ', 'T') + 'Z');
  if (Number.isNaN(d.getTime())) return stamp.slice(0, 10);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/**
 * One review's own score, in the shape the shared <Stars> speaks.
 *
 * Stars takes a RatingSummary rather than a number because every average on
 * the site goes through it, so a single review is handed to it as the summary
 * it genuinely is: one person, that many stars, a count of one. Nothing is
 * invented, and a review being judged here is drawn exactly as the shopper who
 * complained about it saw it. ItemReviews builds the same shape for the same
 * reason.
 */
function oneReview(rating: number): RatingSummary {
  const stars: [number, number, number, number, number] = [0, 0, 0, 0, 0];
  if (Number.isInteger(rating) && rating >= 1 && rating <= 5) stars[rating - 1] = 1;
  return { count: 1, average: rating, stars };
}

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ note?: string | string[] }>;
}) {
  if (!(await isAdminRequest())) redirect('/admin/login');

  const reviews = listAllReviews(LIMIT);
  const noteParam = (await searchParams).note;
  const note = NOTES[(Array.isArray(noteParam) ? noteParam[0] : noteParam) ?? ''] ?? null;

  const hidden = reviews.filter((r) => r.status === 'hidden').length;
  const full = reviews.length === LIMIT;

  return (
    <div className="container section">
      <div
        className="anim-fade-up"
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 20,
        }}
      >
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>
            Reviews
          </h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            Everything buyers wrote about the goods in the bazaar, newest first. Sellers can only
            reply to these — taking one down is your decision and nobody else&rsquo;s.
          </p>
        </div>
        <Link href="/admin" className="btn btn-sm">
          ← Dashboard
        </Link>
      </div>

      {note && <div className={`notice notice-${note.tone}`}>{note.text}</div>}

      <div className="card anim-fade-up">
        <div className="card-title">Before you hide one</div>
        <p style={{ marginTop: 0 }}>
          A hidden review stays in the database forever — it is only taken off the item page, out
          of the item&rsquo;s stars, and out of the shop&rsquo;s. Its author cannot write a
          replacement, because their order has already had its one review. Publishing it again
          undoes all of that.
        </p>
        <p className="muted small" style={{ marginBottom: 0 }}>
          Every review here is attached to a paid order for that exact item, so &ldquo;this one is
          fake&rdquo; is not a thing that can happen. What does happen is abuse, somebody&rsquo;s
          personal details, and messages that turn out to be about a delivery argument rather than
          about the goods. Whatever you decide, the reason you type is kept on the row and is what
          both the seller and the buyer are told if either one asks.
        </p>
      </div>

      {reviews.length === 0 ? (
        <div className="card anim-fade-up">
          <p style={{ margin: 0 }}>
            Nothing has been reviewed yet. Reviews appear the moment a buyer opens the link in
            their own order email and writes one about something they paid a shop for.
          </p>
        </div>
      ) : (
        <>
          <p className="muted small" style={{ margin: '0 0 12px' }}>
            {full ? `The newest ${LIMIT} reviews` : `${reviews.length} review${reviews.length === 1 ? '' : 's'}`}
            {hidden > 0 ? ` · ${hidden} currently hidden` : ' · none hidden'}
            {full ? ' — older ones are not loaded on this page.' : ''}
          </p>

          {reviews.map((r) => {
            const shop = readListingName(r.eventName);
            const itemHref = `/e/${encodeURIComponent(r.eventSlug)}/item/${encodeURIComponent(r.tierKey)}`;
            return (
              <div key={r.id} id={`r-${r.id}`} className="card anim-fade-up">
                <div className="bz-rev-head">
                  <span className="bz-rev-author">{r.authorName}</span>
                  <Stars rating={oneReview(r.rating)} />
                  {r.status === 'hidden' ? (
                    <span className="badge badge-red">Hidden</span>
                  ) : (
                    <span className="badge badge-green">Live</span>
                  )}
                  <span className="bz-rev-date">{reviewDate(r.createdAt)}</span>
                </div>

                {/* The shop, then the item. The tier KEY rather than its name:
                    listAllReviews does not join event_tiers, and a key in mono
                    is at least honestly a key — see the note in the report. The
                    link goes to the page a shopper would see. */}
                <p className="muted small" style={{ margin: '6px 0 0' }}>
                  {shop.name}{' '}
                  {shop.isExample && <span className="badge badge-amber">Example shop</span>} ·{' '}
                  <Link href={itemHref} style={{ color: 'var(--accent)' }}>
                    <span className="mono">{r.tierKey}</span>
                  </Link>
                </p>

                {r.body ? (
                  <p className="bz-rev-body">{r.body}</p>
                ) : (
                  <p className="muted small" style={{ margin: '7px 0 0' }}>
                    Stars only — nothing written.
                  </p>
                )}

                {r.sellerReply && (
                  <div className="bz-rev-reply">
                    <p style={{ margin: 0 }}>
                      <strong>The seller answered</strong>
                      {r.sellerReplyAt ? (
                        <span className="muted small"> · {reviewDate(r.sellerReplyAt)}</span>
                      ) : null}
                    </p>
                    <p style={{ margin: '4px 0 0', whiteSpace: 'pre-line' }}>{r.sellerReply}</p>
                  </div>
                )}

                {/* Plain forms, posting and coming back. Two of them rather
                    than one with a toggle, because each direction is a
                    different decision with a different button on it: hiding
                    demands a reason, publishing again just undoes it. */}
                {r.status === 'hidden' ? (
                  <form method="post" action="/api/admin/reviews" className="bz-rev-form" style={{ marginTop: 12 }}>
                    <input type="hidden" name="reviewId" value={r.id} />
                    <input type="hidden" name="status" value="published" />
                    <p className="small" style={{ margin: 0 }}>
                      <strong>Hidden because:</strong> {r.hiddenReason || 'no reason was recorded.'}
                    </p>
                    <button type="submit" className="btn btn-sm" style={{ alignSelf: 'flex-start' }}>
                      Put it back up
                    </button>
                    <p className="muted small" style={{ margin: 0 }}>
                      It returns to the item page and starts counting towards the stars again. The
                      reason above is cleared off the row.
                    </p>
                  </form>
                ) : (
                  <form method="post" action="/api/admin/reviews" className="bz-rev-form" style={{ marginTop: 12 }}>
                    <input type="hidden" name="reviewId" value={r.id} />
                    <input type="hidden" name="status" value="hidden" />
                    <div className="field" style={{ margin: 0 }}>
                      <label htmlFor={`reason-${r.id}`}>Why it is coming down</label>
                      <input
                        id={`reason-${r.id}`}
                        name="reason"
                        className="input"
                        required
                        maxLength={MAX_REVIEW_CHARS}
                        placeholder="Names another customer and repeats their phone number."
                      />
                    </div>
                    <button type="submit" className="btn btn-danger btn-sm" style={{ alignSelf: 'flex-start' }}>
                      Hide it
                    </button>
                  </form>
                )}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
