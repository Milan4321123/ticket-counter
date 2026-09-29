import Link from 'next/link';
import Stars from '@/components/Stars';
import { readListingName } from '@/lib/exampleShop';
import { organizerPlanActive } from '@/lib/organizers';
import { MAX_REVIEW_CHARS, listReviewsForOrganizer } from '@/lib/reviews';
import type { RatingSummary } from '@/lib/reviews';
import PortalNav from '../PortalNav';
import { requirePortalOrganizer } from '../guard';

// What buyers said about this seller's goods, and the one thing the seller may
// do about it: answer.
//
// The page is as much a statement of the rules as it is a list. A seller
// arriving here for the first time after a three-star review will look for the
// delete button, and the honest thing is to tell them plainly, at the top,
// that there isn't one and why — rather than let them hunt, find nothing, and
// conclude the site is broken or that we are hiding the control somewhere.
// The argument that actually lands is the one written in the card below: stars
// a seller can edit are stars nobody believes, so the limit protects the good
// reviews as much as it exposes the bad ones.
//
// Hidden reviews ARE shown here, which is deliberate and is the reason this
// page reads listReviewsForOrganizer() rather than the public reader. A review
// that quietly disappeared from a seller's own screen would leave them arguing
// with a score whose cause they cannot see. They get the row, the platform's
// written reason, and a line saying it counts towards nothing.
//
// ONE statement feeds the whole page — listReviewsForOrganizer joins the shop
// and the item name in, so nothing in the loop below touches the database. A
// seller with two hundred reviews costs the same read as a seller with two.
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Reviews — Organizer portal',
  robots: { index: false, follow: false },
};

/**
 * What the API route told us, in words written for the seller.
 *
 * The route sends a short CODE back in ?note= and this is where it becomes a
 * sentence, rather than the route passing prose through the query string. A
 * message carried in a URL is a message any stranger can put on this page by
 * sending the seller a link, and "Your shop has been suspended, call this
 * number" is exactly the sentence somebody would choose.
 */
const NOTES: Record<string, { tone: 'success' | 'error'; text: string }> = {
  replied: {
    tone: 'success',
    text: 'Your reply is live — it sits under that review on the item page.',
  },
  cleared: {
    tone: 'success',
    text: 'Your reply has been taken down. The review it answered is untouched.',
  },
  notfound: {
    tone: 'error',
    text: 'We could not find that review on any of your shops. Reload this page and try again.',
  },
  toolong: {
    tone: 'error',
    text: `That reply was too long — it can be at most ${MAX_REVIEW_CHARS} characters.`,
  },
  off: {
    tone: 'error',
    text: 'This account is switched off, so replies are paused. Your shops and everything you have already replied to stay exactly as they are.',
  },
  invalid: {
    tone: 'error',
    text: 'That reply did not reach us. Reload this page and try again.',
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
 * invented, and the seller sees a review drawn here exactly as a shopper sees
 * the same review on the item page — which is the point of not hand-rolling a
 * second row of stars for the portal. ItemReviews does the identical thing
 * for the identical reason.
 */
function oneReview(rating: number): RatingSummary {
  const stars: [number, number, number, number, number] = [0, 0, 0, 0, 0];
  if (Number.isInteger(rating) && rating >= 1 && rating <= 5) stars[rating - 1] = 1;
  return { count: 1, average: rating, stars };
}

export default async function PortalReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ note?: string | string[] }>;
}) {
  // Deliberately NOT behind <PlanExpired/> like the promos page: this is a
  // record of what other people said, not a tool for changing anything, and a
  // seller whose account has been switched off still has live shops with live
  // reviews on them. What the switch-off actually stops is the WRITE, so the
  // reply boxes come off below and the API route refuses one anyway — the two
  // doors agree, which is the property that matters.
  const organizer = await requirePortalOrganizer();
  const canReply = organizerPlanActive(organizer);

  const reviews = listReviewsForOrganizer(organizer.id);
  const noteParam = (await searchParams).note;
  const note = NOTES[(Array.isArray(noteParam) ? noteParam[0] : noteParam) ?? ''] ?? null;

  const hidden = reviews.filter((r) => r.status === 'hidden').length;

  return (
    <>
      <PortalNav active="reviews" />
      <div className="container container-narrow section">
        <div className="anim-fade-up" style={{ marginBottom: 20 }}>
          <h1 className="page-title" style={{ margin: 0 }}>
            Reviews
          </h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            What buyers wrote about the things you sold them, newest first, across every shop on
            your account.
          </p>
        </div>

        {note && (
          <div className={`notice notice-${note.tone}`}>{note.text}</div>
        )}

        <div className="card anim-fade-up">
          <div className="card-title">What you can do here</div>
          <p style={{ marginTop: 0 }}>
            You can reply to any review, and you can take your own reply back down by clearing the
            box and saving it empty. That is all of it: you cannot edit a review, and you cannot
            hide one.
          </p>
          <p className="muted small">
            The limit is doing your shop a favour as well as the shopper. Stars a seller can edit
            are stars nobody has any reason to believe — and the moment people work that out, your
            good reviews stop counting too. Only somebody who paid for that exact item can write
            one, from the link in their own order email, so nothing here came from a competitor or
            a passer-by.
          </p>
          <p className="muted small" style={{ marginBottom: 0 }}>
            If something here breaks the rules — abuse, somebody&rsquo;s personal details, or a
            message that is not about the goods at all —{' '}
            <Link href="/contact" style={{ color: 'var(--accent)' }}>
              tell us
            </Link>{' '}
            and the platform will look at it. Taking a review down is our decision, not yours, and
            if we do it the reason is written down and shows up on this page.
          </p>
        </div>

        {!canReply && reviews.length > 0 && (
          <div className="notice notice-warn">
            This account is switched off, so the reply boxes are off with it. Your shops and your
            existing replies stay online, and everything below is still yours to read.
          </div>
        )}

        {reviews.length === 0 ? (
          <div className="card anim-fade-up">
            <p style={{ marginTop: 0 }}>Nobody has reviewed anything you sell yet.</p>
            <p className="muted small" style={{ marginBottom: 0 }}>
              A review can only be written by somebody who has ordered and paid for that exact
              item, using the link in their own order email — so a new shelf starts empty and
              fills up at the speed you actually sell. There is nothing to set up here, and
              nothing you need to ask anyone for.
            </p>
          </div>
        ) : (
          <>
            <p className="muted small" style={{ margin: '0 0 12px' }}>
              {reviews.length} review{reviews.length === 1 ? '' : 's'}
              {hidden > 0
                ? ` · ${hidden} taken down by the platform, shown below with the reason`
                : ''}
            </p>

            {reviews.map((r) => {
              const shop = readListingName(r.eventName);
              const itemHref = `/e/${encodeURIComponent(r.eventSlug)}/item/${encodeURIComponent(r.tierKey)}`;
              return (
                <div key={r.id} id={`r-${r.id}`} className="card anim-fade-up">
                  <div className="bz-rev-head">
                    <span className="bz-rev-author" translate="no">
                      {r.authorName}
                    </span>
                    <Stars rating={oneReview(r.rating)} />
                    {r.status === 'hidden' && <span className="badge badge-red">Taken down</span>}
                    <span className="bz-rev-date">{reviewDate(r.createdAt)}</span>
                  </div>

                  {/* Which of your things they are talking about. The shop is
                      named as well as the item because an organizer can run
                      several, and "3 stars" with no shop on it is a puzzle for
                      anybody with two. */}
                  <p className="muted small" style={{ margin: '6px 0 0' }}>
                    <Link href={itemHref} style={{ color: 'var(--accent)' }}>
                      {r.tierName}
                    </Link>{' '}
                    · {shop.name}{' '}
                    {shop.isExample && <span className="badge badge-amber">Example shop</span>}
                  </p>

                  {r.body ? (
                    // A review the platform took down is no longer published text.
                    <p className="bz-rev-body" translate={r.status === 'hidden' ? 'no' : undefined}>
                      {r.body}
                    </p>
                  ) : (
                    <p className="muted small" style={{ margin: '7px 0 0' }}>
                      They rated it and left it there — no words.
                    </p>
                  )}

                  {r.status === 'hidden' && (
                    <div className="notice notice-warn small" style={{ marginTop: 10 }}>
                      <strong>Taken down by the platform.</strong>{' '}
                      {r.hiddenReason || 'No reason was recorded.'} Shoppers do not see it, and it
                      counts towards nothing — your stars are worked out from the reviews that are
                      still up.
                    </div>
                  )}

                  {r.sellerReply && (
                    <div className="bz-rev-reply">
                      <p style={{ margin: 0 }}>
                        <strong>Your reply</strong>
                        {r.sellerReplyAt ? (
                          <span className="muted small"> · {reviewDate(r.sellerReplyAt)}</span>
                        ) : null}
                      </p>
                      <p style={{ margin: '4px 0 0', whiteSpace: 'pre-line' }}>{r.sellerReply}</p>
                    </div>
                  )}

                  {canReply && (
                    // A plain form, posting and coming back. No JavaScript is
                    // involved anywhere in it, which is what makes it work on
                    // the phone of a seller standing in a market with one bar
                    // of signal — the case this whole site is built for.
                    <form method="post" action="/api/portal/reviews" className="bz-rev-form" style={{ marginTop: 12 }}>
                      <input type="hidden" name="reviewId" value={r.id} />
                      <div className="field" style={{ margin: 0 }}>
                        <label htmlFor={`reply-${r.id}`}>
                          {r.sellerReply ? 'Change your reply' : 'Reply in public'}
                        </label>
                        <textarea
                          id={`reply-${r.id}`}
                          name="reply"
                          className="input"
                          rows={3}
                          maxLength={MAX_REVIEW_CHARS}
                          defaultValue={r.sellerReply}
                          placeholder="Thanks for saying so — the achar is made in small batches, so the heat does vary a little between jars."
                          style={{ resize: 'vertical', fontFamily: 'inherit' }}
                        />
                      </div>
                      <button type="submit" className="btn btn-brand btn-sm" style={{ alignSelf: 'flex-start' }}>
                        {r.sellerReply ? 'Save reply' : 'Post reply'}
                      </button>
                      {/* Two different true sentences, because a taken-down
                          review is a genuinely different situation and the card
                          would otherwise contradict itself: the panel a few
                          lines up says shoppers do not see this one, and this
                          line used to promise, underneath it, that anyone
                          reading the item page does. They do not —
                          listReviewsForItem returns published rows only, so a
                          hidden review takes its reply off the page with it.

                          The byline is the SELLER's name, not the shop's, and
                          this line has to say the one that actually appears:
                          ItemReviews prints "Reply from <organizer name>" —
                          the same name the item page discloses under the price
                          as who the buyer is buying from. Somebody running
                          three shops off one account needs to know their own
                          name is what goes out, before they write in a voice
                          that assumes the shop's. */}
                      <p className="muted small" style={{ margin: 0 }}>
                        {r.status === 'hidden' ? (
                          <>
                            Nobody can read this one for as long as the review it answers is down.
                            It is kept, and it appears on the item page signed{' '}
                            <strong>{organizer.name}</strong> if that review ever goes back up.
                          </>
                        ) : (
                          <>
                            Anyone reading the item page sees this under their review, signed{' '}
                            <strong>{organizer.name}</strong>.
                          </>
                        )}
                        {r.sellerReply ? ' Empty the box and save to take it down again.' : ''}
                      </p>
                    </form>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>
    </>
  );
}
