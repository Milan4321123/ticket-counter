'use client';

// "Add to basket" on an item page: puts it in the cross-seller basket and
// says so, with a way to the basket or back to shopping.
import Link from 'next/link';
import { useState } from 'react';
import { addToBasket, type BasketLine } from './basketStore';

export default function AddToBasket({ line }: { line: Omit<BasketLine, 'qty'> }) {
  const [added, setAdded] = useState(false);
  return (
    <>
      <button
        type="button"
        className={`btn btn-lg basket-add${added ? ' is-added' : ''}`}
        // Asked "is this the right city?" first where that question exists (CityCheck).
        data-city-check
        onClick={() => {
          addToBasket([{ ...line, qty: 1 }]);
          setAdded(true);
          window.setTimeout(() => setAdded(false), 2400);
        }}
      >
        {added ? '✓ Added' : '＋ Add to basket'}
      </button>
      {added && (
        <span className="basket-toast" role="status">
          In your basket — <Link href="/basket">view basket</Link> or keep shopping.
        </span>
      )}
    </>
  );
}
