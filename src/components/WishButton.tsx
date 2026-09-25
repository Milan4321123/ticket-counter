'use client';

// "♡ Wish list" — for things that cannot be bought yet: an example shop's
// goods, a "Coming soon" ticket or dish, a checkout that cannot take payment.
// One tap tells the seller (and us) that somebody wants it (lib/wishes), and
// keeps it on the shopper's own saved list when a copy of the item is given.
//
// The device is a random token made up here, in this browser; the server keeps
// only its hash, so a wish is a count, never a person.
import { useEffect, useState } from 'react';
import { isSaved, toggleSaved, type SavedItem } from '@/lib/savedItems';

const DEVICE_KEY = 'martnepali.device.v1';
const WISHED_KEY = 'martnepali.wished.v1';

function device(): string {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id || !/^[a-z0-9]{16,64}$/i.test(id)) {
      id = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return '';
  }
}

function wishedSet(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(WISHED_KEY) || '[]') as string[]);
  } catch {
    return new Set();
  }
}

function remember(key: string, on: boolean) {
  try {
    const s = wishedSet();
    if (on) s.add(key);
    else s.delete(key);
    localStorage.setItem(WISHED_KEY, JSON.stringify([...s].slice(-300)));
  } catch {
    // No storage: the server still counted it.
  }
}

export async function sendWish(eventId: string, tierKey: string, on: boolean): Promise<number | null> {
  const id = device();
  if (!id) return null;
  const res = await fetch('/api/wishes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventId, tierKey, device: id, on }),
  }).catch(() => null);
  const d = (await res?.json().catch(() => null)) as { count?: number } | null;
  if (!res?.ok || typeof d?.count !== 'number') return null;
  remember(`${eventId}:${tierKey}`, on);
  return d.count;
}

export default function WishButton({
  eventId,
  tierKey,
  count: initial = 0,
  item,
  size = 'md',
}: {
  eventId: string;
  tierKey: string;
  /** How many already want it (server-rendered). */
  count?: number;
  /** A copy for the shopper's own saved list (shops only — see SaveButton). */
  item?: SavedItem;
  size?: 'sm' | 'md';
}) {
  const key = `${eventId}:${tierKey}`;
  // null until this browser's own list is read — see SaveButton on hydration.
  const [on, setOn] = useState<boolean | null>(null);
  const [count, setCount] = useState(initial);
  const [busy, setBusy] = useState(false);

  useEffect(() => setOn(wishedSet().has(key)), [key]);

  async function toggle(e: React.MouseEvent) {
    // Inside a card that is itself a link: the tap is for the wish only.
    e.preventDefault();
    e.stopPropagation();
    if (busy || on === null) return;
    setBusy(true);
    const next = !on;
    const n = await sendWish(eventId, tierKey, next);
    if (n !== null) {
      setOn(next);
      setCount(n);
      if (item && isSaved(item.href) !== next) toggleSaved(item);
    }
    setBusy(false);
  }

  return (
    <button
      type="button"
      className={`wish-btn wish-${size}${on ? ' is-on' : ''}`}
      onClick={toggle}
      disabled={busy || on === null}
      aria-pressed={on ?? false}
    >
      <span className="wish-heart" aria-hidden="true">
        {on ? '♥' : '♡'}
      </span>
      {on ? 'On your wish list' : 'Add to wish list'}
      {count > 0 && <span className="wish-count">{count} want{count === 1 ? 's' : ''} this</span>}
    </button>
  );
}

/**
 * The end of a checkout that cannot take an order (an example shop, a listing
 * with no payment details): instead of a dead end, wish for what was picked.
 */
export function WishPanel({
  eventId,
  items,
  example,
  unit,
}: {
  eventId: string;
  items: { tierKey: string; name: string }[];
  example: boolean;
  unit: string;
}) {
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const keys = items.map((i) => i.tierKey).join('|');
  useEffect(() => {
    const s = wishedSet();
    const list = keys ? keys.split('|') : [];
    setDone(list.length > 0 && list.every((k) => s.has(`${eventId}:${k}`)));
  }, [eventId, keys]);

  async function wishAll() {
    if (busy || !items.length) return;
    setBusy(true);
    const results = await Promise.all(items.map((i) => sendWish(eventId, i.tierKey, true)));
    setDone(results.every((r) => r !== null));
    setBusy(false);
  }

  return (
    <div className="wish-panel">
      <p className="wish-panel-title">
        {example ? 'This is an example shop — it cannot take orders.' : `This listing cannot take payment yet, so no order can be placed.`}
      </p>
      <p className="wish-panel-text">
        {example
          ? `Would you buy this? Put it on your wish list — it shows us which ${unit}s people want, so real Nepali sellers can offer them here.`
          : `Put it on your wish list — the seller sees how many people want it. Nothing is reserved and nothing is charged.`}
      </p>
      {done ? (
        <p className="wish-panel-done">♥ On your wish list — thank you!</p>
      ) : (
        <button type="button" className="btn btn-primary btn-lg btn-block" onClick={wishAll} disabled={busy || !items.length}>
          {busy ? 'Adding…' : items.length > 1 ? `♡ Add all ${items.length} to my wish list` : '♡ Add to my wish list'}
        </button>
      )}
      {items.length === 0 && <p className="muted small">Pick something above first.</p>}
    </div>
  );
}
