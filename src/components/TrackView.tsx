'use client';

// Renders nothing. Drops the item the shopper is currently looking at onto the
// "recently viewed" list in their own browser, and does nothing else — no
// beacon, no fetch, no id sent anywhere. See lib/savedItems.
import { useEffect, useRef } from 'react';
import { remember } from '@/lib/savedItems';
import type { SavedItem } from '@/lib/savedItems';

export interface TrackViewProps {
  item: SavedItem;
}

export default function TrackView({ item }: TrackViewProps) {
  /**
   * Which href this instance has already written.
   *
   * Guards two different repeats with one check. In development React mounts
   * every component twice on purpose, and the parent re-renders for reasons
   * that have nothing to do with the item (a search param changing, a client
   * navigation back to the same page) — and `item` is a fresh object literal
   * on each of those, so an effect keyed on it alone would fire again. Writing
   * twice is not harmful (remember() moves rather than duplicates) but it
   * rewrites the whole list for nothing, on a page that has just started
   * painting images.
   */
  const written = useRef('');

  useEffect(() => {
    if (written.current === item.href) return;
    written.current = item.href;
    // In the effect rather than during render: a render is not allowed to have
    // side effects, and on the server there is no storage to have them in.
    remember(item);
  }, [item]);

  return null;
}
