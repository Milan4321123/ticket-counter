// What buyers said about one item, at the bottom of that item's own page: the
// score, how the scores are spread, and every published thing anybody wrote.
//
// Server component, and it stays one. Both halves of what it prints — the
// summary and the list — are already in memory before this renders, because
// the item page reads them once in two statements and hands them down. There
// is nothing here to fetch after paint, nothing to hydrate, and no reason to
// ship a kilobyte of JavaScript to a phone in order to print somebody's
// sentence about a jar of achar. The only client component anywhere near a
// review is the form the buyer types it into, and that lives behind the token
// in their own order email.
//
// It owns the #reviews anchor itself rather than being dropped inside a
// <section id="reviews"> the page declares. Every star cluster in the bazaar
// links to #reviews — the tiles on /market, the rating under this item's own
// title — and an anchor that lives in one file while the thing it points at
// lives in another survives exactly until somebody rearranges the page.
//
// Nothing in here is ever synthesised. An item nobody has reviewed gets a
// sentence saying why the space is empty, never a row of grey outlines: five
// empty stars are read as a bad score by everybody who has ever used a review
// site, and "nobody has bought this yet" is not the same fact as "everybody
// hated it". That is the same rule ratingForItem() enforces by returning null
// instead of a zero, one layer up.
import Stars from '@/components/Stars';
import type { RatingSummary, ReviewRow } from '@/lib/reviews';

export interface ItemReviewsProps {
  /** The aggregate, or null when nobody has reviewed this item yet. */
  rating: RatingSummary | null;
  /** The published reviews, newest first, exactly as listReviewsForItem gives them. */
  reviews: ReviewRow[];
  /** The item's own name — used in the empty state, which has to name what is empty. */
  itemName: string;
  /**
   * The disclosed seller, so a reply can be attributed to the person who wrote
   * it. A reply in nobody's name reads as the platform speaking, and this
   * platform never speaks for a seller.
   */
  sellerName: string;
}

/**
 * "14 Aug 2026", plus the machine-readable stamp a <time> element wants — or
 * null when the column holds something that is not a date.
 *
 * created_at is written by SQLite's datetime('now'): UTC, with a space where
 * ISO 8601 wants a T and no zone marker at all. Parsed as it stands, some
 * engines read it as local time and some as UTC, which moves a review's date
 * by a day for anybody reading it in the evening. The replace-and-stamp is
 * what the rest of the codebase does with these columns (lib/marketItems,
 * lib/reminders, lib/cards), and the reader is pinned to UTC for the matching
 * reason: two shoppers in two time zones should be shown one date for one
 * review, not the date it happened to be where they are standing.
 *
 * The null case is not defensive padding. An operator can hand-edit a row, and
 * a byline reading "Invalid Date" beside somebody's honest paragraph looks
 * like the review itself is broken; no date at all is the smaller loss.
 */
function reviewDate(stamp: string): { iso: string; label: string } | null {
  const ms = Date.parse(`${(stamp || '').replace(' ', 'T')}Z`);
  if (Number.isNaN(ms)) return null;
  const at = new Date(ms);
  return {
    iso: at.toISOString(),
    label: at.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    }),
  };
}

/**
 * The five bars: how many people gave five stars, how many gave four, and so
 * on down.
 *
 * Read straight off RatingSummary.stars rather than counted from `reviews`,
 * and that matters more than it looks: the summary is aggregated over every
 * published row in one grouped statement, so it stays correct on the day this
 * list is paginated or capped. Counting the rendered rows instead would make
 * the chart quietly describe the page rather than the item.
 *
 * A rating with nobody at three stars renders as an empty track — no hairline
 * of colour, no rounding up to something visible — because an empty track is
 * the honest picture of nobody having said that.
 */
function Bars({ rating }: { rating: RatingSummary }) {
  return (
    <div className="bz-rev-bars">
      {[5, 4, 3, 2, 1].map((stars) => {
        const n = rating.stars[stars - 1];
        return (
          <div className="bz-rev-bar" key={stars}>
            <span>
              {stars} star{stars === 1 ? '' : 's'}
            </span>
            {/* The bar is a picture of the number printed at the end of the
                same row, so it is hidden from the ear: a screen reader hears
                "5 stars, 9" and is not made to sit through a graphic that
                repeats it. */}
            <span className="bz-rev-bar-track" aria-hidden="true">
              <span
                className="bz-rev-bar-fill"
                style={{ width: `${Math.round((n / rating.count) * 100)}%` }}
              />
            </span>
            <span>{n}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function ItemReviews({ rating, reviews, itemName, sellerName }: ItemReviewsProps) {
  return (
    <section className="section bz-reviews" id="reviews" aria-labelledby="item-reviews-title">
      <h2 className="page-title" id="item-reviews-title" style={{ margin: '0 0 14px' }}>
        Reviews
      </h2>

      {rating ? (
        <div className="bz-rev-summary">
          <div className="bz-rev-avg">
            {/* The figure at headline size for the eye, and hidden from the
                ear — the star cluster under it already carries the whole
                sentence ("4.6 out of 5 from 12 reviews") as its accessible
                name, so leaving this visible would announce the score twice
                before a single review had been read. */}
            <span className="bz-rev-avg-num" aria-hidden="true">
              {rating.average.toFixed(1)}
            </span>
            {/* The wrapper is what makes these the big stars. .bz-stars-md is
                a descendant selector in bazaar.css, and Stars does not put the
                class on its own root — see the note in the item page's report;
                until it does, the ancestor here is what the CSS needs to find. */}
            <span className="bz-stars-md">
              <Stars rating={rating} size="md" />
            </span>
          </div>
          <Bars rating={rating} />
        </div>
      ) : (
        <div className="bz-empty">
          {/* The honest empty state, and the reason it is worth a whole
              paragraph rather than the usual "no reviews yet": what is being
              explained is not that this shelf is quiet, it is that there is no
              other door in. Nobody can buy a review here, the seller cannot
              write one about their own goods, and neither can this site — the
              only thing that produces a row is a paid order for this exact
              item. Said plainly, an empty block stops reading as a shop nobody
              liked and starts reading as a shop nobody has bought from YET. */}
          <p style={{ margin: 0 }}>
            Nobody has reviewed {itemName} yet.
          </p>
          <p className="small" style={{ margin: '8px 0 0' }}>
            A review here can only be written by somebody who ordered this item and paid for it —
            there is no other way in, and neither the seller nor we can add one — so a new shelf
            starts empty and stays that way until a real buyer has something to say.
          </p>
        </div>
      )}

      {reviews.length > 0 && (
        <div style={{ marginTop: 18 }}>
          {reviews.map((review) => {
            const written = reviewDate(review.createdAt);
            const replied = review.sellerReply ? reviewDate(review.sellerReplyAt ?? '') : null;
            return (
              /* An <article> each, because one review is a complete, quotable
                 thing by a named person rather than a row of a table. Keyed on
                 the review id and never on the order id — the order id is the
                 capability that opens that buyer's own order page, and it must
                 not reach the markup even as a key. */
              <article className="bz-rev" key={review.id}>
                <div className="bz-rev-head">
                  {/* The score this one person gave, drawn with the same
                      component every other rating on the site uses. A second
                      hand-rolled row of stars here would be a second spelling
                      of "four out of five" waiting to drift out of step with
                      the summary above it. */}
                  <Stars rating={{ count: 1, average: review.rating, stars: starsOf(review.rating) }} />
                  <span className="bz-rev-author">{review.authorName}</span>
                  {/* On every row, and it is a fact rather than a flourish: a
                      row in item_reviews exists only because writeReview()
                      found a PAID order for this exact item behind it. There
                      is no unverified review for this pill to distinguish it
                      from — if one could ever exist, this is the line that
                      would have to become conditional. */}
                  <span className="bz-rev-verified">Verified order</span>
                  {written && (
                    <time className="bz-rev-date" dateTime={written.iso}>
                      {written.label}
                    </time>
                  )}
                </div>

                {/* Plenty of people rate and write nothing, which is a
                    complete review — the stars were the opinion. An empty
                    paragraph would leave a gap that reads as text that failed
                    to load. */}
                {review.body && <p className="bz-rev-body">{review.body}</p>}

                {review.sellerReply && (
                  /* The seller's answer, under the review it answers and
                      visibly attached to it. Attributed by name, dated where
                      there is a date, and never dressed as a review of its
                      own: the seller has no rating here and cannot acquire one
                      by replying to somebody who does. */
                  <div className="bz-rev-reply">
                    <p style={{ margin: 0 }}>
                      <strong>Reply from {sellerName}</strong>
                      {replied && (
                        <>
                          {' · '}
                          <time className="muted" dateTime={replied.iso}>
                            {replied.label}
                          </time>
                        </>
                      )}
                    </p>
                    <p className="bz-rev-body">{review.sellerReply}</p>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

/**
 * One review's score as the five-slot distribution RatingSummary is made of.
 *
 * Stars takes a summary rather than a number, which is right — it is the
 * component every average on the site goes through — so a single review has to
 * be handed to it as the summary it is: one person, that many stars, and a
 * count of exactly one. Nothing is invented; the shape is just the shape the
 * shared component speaks.
 */
function starsOf(rating: number): [number, number, number, number, number] {
  const out: [number, number, number, number, number] = [0, 0, 0, 0, 0];
  if (Number.isInteger(rating) && rating >= 1 && rating <= 5) out[rating - 1] = 1;
  return out;
}
