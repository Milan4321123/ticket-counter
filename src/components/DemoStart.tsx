'use client';

// A "try the demo" control that starts the demo right away — no picker page
// in between. Starting one creates an account, so it is a POST (never a link
// a crawler or another site could fire). `to` picks where it opens (the
// demo's home by default); `plain` makes it look like a text link.
import { useState, type ReactNode } from 'react';

export default function DemoStart({
  to = 'portal',
  className,
  plain = false,
  children,
}: {
  to?: string;
  className?: string;
  plain?: boolean;
  children: ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <form action="/api/demo/start" method="post" className="demo-start" onSubmit={() => setBusy(true)}>
      <input type="hidden" name="to" value={to} />
      <button type="submit" className={`${plain ? 'demo-start-link' : ''} ${className ?? ''}`.trim()} aria-busy={busy || undefined} disabled={busy}>
        {busy ? (
          <>
            <span className="spinner" aria-hidden="true" /> Building your demo…
          </>
        ) : (
          children
        )}
      </button>
    </form>
  );
}
