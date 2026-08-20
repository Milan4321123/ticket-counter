// Safe to import from both server and client components.
export function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);
}

/**
 * What a discount code takes off a basket. Two kinds, one rule each:
 *   - 'fixed'   — a flat amount, capped at the basket (a code worth more than
 *                 the order simply covers it; no change, no carried remainder);
 *   - 'percent' — a share of the ITEMS SUBTOTAL, rounded UP to whole cents.
 *
 * Rounding UP is deliberate: it rounds in the BUYER's favour. A fraction of a
 * cent has to land somewhere, and it must never land on the person who was
 * promised a discount — the seller is giving at most one cent more than the
 * percentage says, which is theirs to give.
 *
 * Lives in this shared module so the checkout's preview and the server that
 * actually writes the discount compute it with the SAME code. A second
 * implementation in the browser is how a page comes to promise one number
 * while the order records another.
 */
export function discountCentsFor(
  code: { kind: 'fixed' | 'percent'; amountCents: number; percent: number },
  subtotalCents: number
): number {
  if (subtotalCents <= 0) return 0;
  const raw =
    code.kind === 'percent'
      ? Math.ceil((subtotalCents * Math.max(0, Math.min(100, code.percent))) / 100)
      : Math.max(0, code.amountCents);
  return Math.max(0, Math.min(raw, subtotalCents));
}
