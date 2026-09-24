'use client';

// The bazaar's search box, updating the results AS YOU TYPE.
//
// It stays an ordinary input inside the page's plain GET form, so pressing
// Enter or Search still works with JavaScript off. With JavaScript on, every
// pause in typing (a quarter of a second) rewrites the address to what the
// form would submit right now and asks the server for that page — the same
// server-side filtering, facets and counts as a real submit, nothing
// duplicated in the browser. `replace`, not `push`: forty keystrokes must not
// become forty steps of the back button.
//
// Partial words already match — the server's search is a substring match — so
// "mom" finds momo before the word is finished.
import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

const DEBOUNCE_MS = 250;

interface Props {
  defaultValue: string;
  placeholder: string;
  ariaLabel: string;
  listId?: string;
}

export default function LiveSearchInput({ defaultValue, placeholder, ariaLabel, listId }: Props) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);
  // The header's search icon lands here with ?focus=search: put the cursor in
  // the box so the visitor can type straight away.
  const boxRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('focus') === 'search') boxRef.current?.focus();
  }, []);
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSent = useRef(defaultValue.trim());

  // Back/forward or a chip click changes the query under us: follow it,
  // unless the shopper is mid-word (their own typing wins).
  useEffect(() => {
    if (!timer.current) {
      setValue(defaultValue);
      lastSent.current = defaultValue.trim();
    }
  }, [defaultValue]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function schedule(input: HTMLInputElement, next: string) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      const trimmed = next.trim();
      if (trimmed === lastSent.current) return;
      lastSent.current = trimmed;

      // Exactly what the form would submit now: the hidden fields carrying the
      // shelf, town, shop, price band and sort, plus this box. No page number,
      // so a new search always starts on page one.
      const params = new URLSearchParams();
      const form = input.form;
      if (form) {
        for (const [k, v] of new FormData(form).entries()) {
          if (typeof v === 'string' && v.trim() !== '' && k !== 'q') params.set(k, v);
        }
      }
      if (trimmed) params.set('q', trimmed);
      const qs = params.toString();
      startTransition(() => {
        router.replace(qs ? `/market?${qs}` : '/market', { scroll: false });
      });
    }, DEBOUNCE_MS);
  }

  return (
    <>
      <input
        ref={boxRef}
        className="bz-search-input"
        type="search"
        name="q"
        list={listId}
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          schedule(e.target, e.target.value);
        }}
        placeholder={placeholder}
        autoComplete="off"
        enterKeyHint="search"
        aria-busy={pending || undefined}
      />
      {/* A thin bar under the box while new results load — enough to say
          "working" without jumping the layout. */}
      <span className={`bz-search-progress${pending ? ' bz-search-progress-on' : ''}`} aria-hidden="true" />
    </>
  );
}
