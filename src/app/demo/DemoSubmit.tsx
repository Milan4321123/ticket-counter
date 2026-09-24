'use client';

// The demo's start button: a plain form submit (works without JavaScript), plus
// a "building" state so a visitor waiting the few seconds it takes to build
// their account knows something is happening. Listens to its own form's
// submit event — the form posts to a URL, so React's form status never sees it.
import { useEffect, useRef, useState } from 'react';

export default function DemoSubmit({ label, className = 'btn btn-brand btn-lg' }: { label: string; className?: string }) {
  const ref = useRef<HTMLButtonElement | null>(null);
  const [pending, setPending] = useState(false);
  useEffect(() => {
    const form = ref.current?.form;
    if (!form) return;
    const onSubmit = () => setPending(true);
    // Back/forward cache restores the page mid-"building": reset it.
    const onShow = () => setPending(false);
    form.addEventListener('submit', onSubmit);
    window.addEventListener('pageshow', onShow);
    return () => {
      form.removeEventListener('submit', onSubmit);
      window.removeEventListener('pageshow', onShow);
    };
  }, []);
  return (
    <button ref={ref} className={className} type="submit" aria-busy={pending || undefined} style={pending ? { pointerEvents: 'none', opacity: 0.8 } : undefined}>
      {pending ? (
        <>
          <span className="spinner" aria-hidden /> Building your demo…
        </>
      ) : (
        label
      )}
    </button>
  );
}
