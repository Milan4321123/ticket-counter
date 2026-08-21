// The star rating, wherever one is shown: on a tile, under an item's title, at
// the head of its reviews. Server component — it renders a number somebody else
// already counted and has nothing to do after paint.
import Link from 'next/link';
import type { RatingSummary } from '@/lib/reviews';

export interface StarsProps {
  /**
   * The summary, or null when nobody has reviewed this item.
   *
   * null is the ordinary case on a young bazaar, not an error, and it renders
   * NOTHING AT ALL — no five grey stars, no "0.0", no "(0)". Empty stars are
   * read as a bad score by everyone who has ever seen a review site, so a shelf
   * that nobody has bought from yet would look like a shelf everybody hated.
   * The item page says the honest thing in words instead, once, where there is
   * room for the reason.
   */
  rating: RatingSummary | null;
  /** 'sm' on tiles, 'md' under a heading. Only the drawn size changes. */
  size?: 'sm' | 'md';
  /** When given, the whole cluster becomes a link — usually to '#reviews'. */
  href?: string;
}

/**
 * What a screen reader hears: "4.6 out of 5 from 12 reviews".
 *
 * Exported because the tile puts the same sentence inside its own single
 * accessible name, and two spellings of one rating is exactly the kind of
 * detail that drifts apart over a year of edits.
 */
export function ratingLabel(rating: RatingSummary): string {
  const reviews = rating.count === 1 ? '1 review' : `${rating.count} reviews`;
  return `${rating.average.toFixed(1)} out of 5 from ${reviews}`;
}

/**
 * One star. Inline SVG rather than a text character or an icon package: the
 * black-star glyph is a different shape and a different weight in every font on
 * every platform, which is very visible when five of them sit in a row, and a
 * package for one path would be a dependency the whole site then carries.
 */
function Star({ on, px }: { on: boolean; px: number }) {
  return (
    <svg
      className={on ? 'bz-star bz-star-on' : 'bz-star'}
      width={px}
      height={px}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M12 2.6l2.9 5.9 6.5.95-4.7 4.58 1.11 6.47L12 17.45 6.19 20.5l1.11-6.47L2.6 9.45l6.5-.95z"
        fill={on ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Stars({ rating, size = 'sm', href }: StarsProps) {
  if (!rating || rating.count === 0) return null;

  const px = size === 'md' ? 17 : 13;
  // The DRAWN stars are rounded to the nearest whole one, and the average is
  // printed beside them to one decimal so the rounding never has to be trusted.
  // Half-star clipping was the alternative; it costs a mask per star and still
  // cannot show the difference between 4.3 and 4.4, which the number can.
  const filled = Math.round(rating.average);
  const label = ratingLabel(rating);

  const body = (
    <>
      {[0, 1, 2, 3, 4].map((i) => (
        <Star key={i} on={i < filled} px={px} />
      ))}
      {/* The figure, printed for the eye and hidden from the ear: whichever
          wrapper is chosen below already carries the whole sentence as its
          accessible name, so leaving this visible to a screen reader would
          make every tile announce its rating twice. */}
      <span className="bz-rating-count" aria-hidden="true">
        {rating.average.toFixed(1)} ({rating.count})
      </span>
    </>
  );

  // A link when there is somewhere to go, a plain image when there is not, and
  // ONE accessible name either way. Five separate SVGs otherwise reach a screen
  // reader as five silent graphics with a bare number after them.
  //
  // role="img" is deliberately not put on the anchor: an element cannot be both
  // a link and a picture, and the anchor's own aria-label does the same job
  // without taking the link semantics away from anybody navigating by link.
  return href ? (
    <Link href={href} className="bz-stars" aria-label={`${label}. Read them`}>
      {body}
    </Link>
  ) : (
    <span className="bz-stars" role="img" aria-label={label}>
      {body}
    </span>
  );
}
