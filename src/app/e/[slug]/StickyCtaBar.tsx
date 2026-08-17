'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

interface Props {
  /** Checkout link — the same one the hero button uses. */
  href: string;
  name: string;
  /** "from €20.00", or a plain availability line when there is no price. */
  priceLabel: string;
  /** False when nothing can be bought: the bar stays, the link does not. */
  buyable?: boolean;
  /** What the button says — "Get tickets", "Coming soon", "Sold out". */
  cta?: string;
}

/**
 * The phone-only checkout bar pinned to the bottom of the screen.
 *
 * It stays out of the way while the hero's own "Get tickets" button is on
 * screen: on a phone the hero fills the viewport and its button lands exactly
 * where the bar sits, so the two would cover each other. Once that button
 * scrolls away the bar takes over.
 */
export default function StickyCtaBar({ href, name, priceLabel, buyable = true, cta = 'Get tickets' }: Props) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    const heroCta = document.querySelector('.event-hero-actions');
    // No hero button to clash with (sales closed): the bar is safe right away.
    if (!heroCta) {
      setArmed(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => setArmed(!entries[entries.length - 1].isIntersecting),
      { threshold: 0 }
    );
    io.observe(heroCta);
    return () => io.disconnect();
  }, []);

  return (
    <div className={`event-cta-bar no-print${armed ? ' is-on' : ''}`}>
      <div className="event-cta-info">
        <div className="event-cta-name">{name}</div>
        <div className="event-cta-price">{priceLabel}</div>
      </div>
      {/* The bar used to be dropped entirely whenever nothing was on sale, so
          the one control a phone always had in reach disappeared exactly when
          a visitor most needed telling why. It stays and says so. */}
      {buyable ? (
        <Link href={href} className="btn btn-primary">
          {cta}
        </Link>
      ) : (
        <span className="btn" aria-disabled="true" style={{ opacity: 0.65, pointerEvents: 'none' }}>
          {cta}
        </span>
      )}
    </div>
  );
}
