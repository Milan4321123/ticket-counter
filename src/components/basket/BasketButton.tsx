'use client';

// The basket in the header: an icon with the number of things in it.
import Link from 'next/link';
import { useBasket } from './basketStore';

export default function BasketButton({ label }: { label: string }) {
  const lines = useBasket();
  const count = lines.reduce((n, l) => n + l.qty, 0);
  return (
    <Link href="/basket" className="gn-icon gn-basket" aria-label={count ? `${label} (${count})` : label} title={label}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 8h14l-1.2 11.2a1 1 0 0 1-1 .8H7.2a1 1 0 0 1-1-.8L5 8Z" />
        <path d="M9 10V7a3 3 0 0 1 6 0v3" />
      </svg>
      {count > 0 ? (
        <span className="gn-basket-count" key={count}>
          {count > 99 ? '99+' : count}
        </span>
      ) : null}
    </Link>
  );
}
