import Link from 'next/link';

/**
 * One other show by the same act, reduced to what a buyer needs to tell the
 * two apart. Built on the server by lib/sameAct.ts; kept as plain data so this
 * component can be rendered by the event page (a server component) and by the
 * checkout (a client one) without either importing the other's world.
 */
export interface OtherShow {
  slug: string;
  city: string;
  /** "Sat 10 Oct", or '' for a listing carrying no machine date. */
  dateLabel: string;
}

export interface OtherCityNoticeProps {
  /** The city the reader is currently looking at, already de-postcoded. */
  city: string;
  shows: OtherShow[];
  /**
   * 'page' is the calm version on the event page — here is the other show,
   * take a look. 'checkout' is the last warning before money moves, so it is
   * amber and it says which city these tickets are for first.
   */
  variant?: 'page' | 'checkout';
}

/**
 * "The same act also plays Lisbon" — the sentence that stops a buyer paying
 * for the wrong country.
 *
 * It names the CURRENT city first and the other one second, because the reader
 * is not confused about the act, they are confused about which page they are
 * on. Nothing here merges the two listings: the other show belongs to another
 * organizer, with its own page, its own bank details and its own buyers, so
 * this is a link and never a picker.
 *
 * Renders nothing when there is nothing to warn about, so every caller can
 * mount it unconditionally.
 */
export default function OtherCityNotice({ city, shows, variant = 'page' }: OtherCityNoticeProps) {
  if (shows.length === 0 || !city) return null;
  const checkout = variant === 'checkout';

  return (
    <div className={`other-city-notice${checkout ? ' other-city-notice-warn' : ''}`}>
      <p className="other-city-lead">
        {checkout ? (
          <>
            These tickets are for <strong>{city}</strong>.
          </>
        ) : (
          <>
            You are looking at the <strong>{city}</strong> show.
          </>
        )}{' '}
        The same act also plays{' '}
        {shows.map((show, i) => (
          <span key={show.slug}>
            {i > 0 ? (i === shows.length - 1 ? ' and ' : ', ') : ''}
            <strong>{show.city}</strong>
            {show.dateLabel ? ` on ${show.dateLabel}` : ''}
          </span>
        ))}
        . Make sure this is the one you want.
      </p>
      <p className="other-city-links">
        {shows.map((show) => (
          <Link key={show.slug} className="other-city-link" href={`/e/${show.slug}`}>
            See the {show.city} show →
          </Link>
        ))}
      </p>
    </div>
  );
}
