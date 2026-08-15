'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

interface Props {
  /** Checkout link — the same one the hero button uses. */
  href: string;
  name: string;
  /** "from €20.00", or a plain availability line when there is no price. */
  priceLabel: string;
}

/**
 * The phone-only checkout bar pinned to the bottom of the screen.
 *
 * It stays out of the way while the hero's own "Get tickets" button is on
 * screen: on a phone the hero fills the viewport and its button lands exactly
 * where the bar sits, so the two would cover each other. Once that button
 * scrolls away the bar takes over.
 */
export default function StickyCtaBar({ href, name, priceLabel }: Props) {
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
      <Link href={href} className="btn btn-primary">
        Get tickets
      </Link>
    </div>
  );
}
