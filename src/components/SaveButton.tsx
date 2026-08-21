'use client';

// Save for later, on the item's own page. The only state it touches is a key
// in this browser's localStorage — see lib/savedItems for why the list is not
// kept anywhere else.
import { useEffect, useState } from 'react';
import { isSaved, toggleSaved } from '@/lib/savedItems';
import type { SavedItem } from '@/lib/savedItems';

export interface SaveButtonProps {
  /** The flat copy that goes on the list. Built by the page from live data. */
  item: SavedItem;
}

export default function SaveButton({ item }: SaveButtonProps) {
  /**
   * Three states, not two: saved, not saved, and NOT YET KNOWN.
   *
   * The third one is what keeps this out of a hydration mismatch. The server
   * renders this component too, and the server cannot know what is in a
   * shopper's browser — so if it guessed `false` and the shopper had already
   * saved the item, React would find "Save for later" in the markup and
   * "Saved" in the tree and either patch it with a warning or, on a streamed
   * page, throw the subtree away. Starting from null means the server and the
   * browser's first pass agree on the only honest answer: nothing rendered.
   * The real state arrives one effect later, which is a frame the shopper does
   * not see.
   */
  const [saved, setSaved] = useState<boolean | null>(null);

  useEffect(() => {
    setSaved(isSaved(item.href));
  }, [item.href]);

  if (saved === null) return null;

  return (
    <button
      type="button"
      className={`btn bz-save${saved ? ' bz-save-on' : ''}`}
      /* A toggle, so aria-pressed — not a label that changes and leaves a
         screen reader to work out that the change WAS the feedback. */
      aria-pressed={saved}
      onClick={() => setSaved(toggleSaved(item))}
    >
      {saved ? 'Saved' : 'Save for later'}
    </button>
  );
}
