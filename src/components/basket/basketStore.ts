'use client';

// The basket: goods and tickets from ANY seller, kept in this browser
// (localStorage) and — for a signed-in customer — on their account, so it
// follows them to another device. Checking out places one ordinary order per
// seller (see /basket); nothing here ever handles money.
import { useEffect, useState } from 'react';

export interface BasketLine {
  /** `${eventId}:${tierKey}` */
  key: string;
  eventId: string;
  slug: string;
  tierKey: string;
  name: string;
  priceCents: number;
  currency: string;
  qty: number;
  /** Most of this listing one order may hold. */
  max: number;
  seller: string;
  listing: string;
  kind: 'event' | 'shop';
  image: string | null;
}

const KEY = 'mn_basket_v1';
const EVENT = 'mn-basket-change';

function read(): BasketLine[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as BasketLine[]) : [];
    return Array.isArray(parsed) ? parsed.filter((l) => l && typeof l.key === 'string' && l.qty > 0) : [];
  } catch {
    return [];
  }
}

let syncTimer: number | undefined;

function write(lines: BasketLine[], sync = true) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(lines));
  } catch {
    /* private mode: the basket lives for this page only */
  }
  window.dispatchEvent(new CustomEvent(EVENT));
  if (sync) {
    // Signed in? Keep the account's copy current (quietly — 401 when not).
    window.clearTimeout(syncTimer);
    syncTimer = window.setTimeout(() => {
      void fetch('/api/account/basket', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lines }),
      }).catch(() => undefined);
    }, 400);
  }
}

export function getBasket(): BasketLine[] {
  return typeof window === 'undefined' ? [] : read();
}

/** Add (or top up) lines; quantities are capped at each line's max. */
export function addToBasket(add: BasketLine[]) {
  const lines = read();
  for (const a of add) {
    const found = lines.find((l) => l.key === a.key);
    if (found) found.qty = Math.min(found.max || 99, found.qty + a.qty);
    else lines.push({ ...a, qty: Math.min(a.max || 99, a.qty) });
  }
  write(lines);
}

export function setQty(key: string, qty: number) {
  const lines = read()
    .map((l) => (l.key === key ? { ...l, qty: Math.max(0, Math.min(l.max || 99, qty)) } : l))
    .filter((l) => l.qty > 0);
  write(lines);
}

export function removeLines(keys: string[]) {
  write(read().filter((l) => !keys.includes(l.key)));
}

/**
 * Once per page load: fold the signed-in account's basket into this
 * browser's, so a basket started on the phone is here on the laptop.
 */
let merged = false;
async function mergeFromAccount() {
  if (merged) return;
  merged = true;
  try {
    const r = await fetch('/api/account/basket', { cache: 'no-store' });
    if (!r.ok) return;
    const data = (await r.json()) as { lines?: BasketLine[] };
    const remote = Array.isArray(data.lines) ? data.lines : [];
    const local = read();
    const byKey = new Map(local.map((l) => [l.key, l]));
    for (const r2 of remote) if (!byKey.has(r2.key)) byKey.set(r2.key, r2);
    const mergedLines = [...byKey.values()];
    if (mergedLines.length !== local.length) write(mergedLines);
    else if (remote.length !== mergedLines.length) write(mergedLines);
  } catch {
    /* offline — local basket only */
  }
}

/** The basket, live: re-renders on any change in this tab or another. */
export function useBasket(): BasketLine[] {
  const [lines, setLines] = useState<BasketLine[]>([]);
  useEffect(() => {
    const update = () => setLines(read());
    update();
    void mergeFromAccount();
    window.addEventListener(EVENT, update);
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) update();
    };
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(EVENT, update);
      window.removeEventListener('storage', onStorage);
    };
  }, []);
  return lines;
}
