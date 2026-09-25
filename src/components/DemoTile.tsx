'use client';

// The homepage's "Try the demo" tile. Starting a demo creates an account, so
// it is a POST (never a link a crawler or another site could fire); it lands
// straight on the demo's home, where the visitor picks a business.
import { useRef, useState, type ReactNode } from 'react';

export default function DemoTile({ title, sub, icon }: { title: string; sub: string; icon: ReactNode }) {
  const [busy, setBusy] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  return (
    <form ref={form} action="/api/demo/start" method="post" className="qt-form" onSubmit={() => setBusy(true)}>
      <input type="hidden" name="to" value="portal" />
      <button type="submit" className="qt-tile qt-demo" aria-busy={busy || undefined} disabled={busy}>
        <span className="qt-icon" aria-hidden="true">
          {busy ? <span className="spinner" /> : icon}
        </span>
        <span className="qt-text">
          <strong>{title}</strong>
          <span>{busy ? 'Building your demo…' : sub}</span>
        </span>
      </button>
    </form>
  );
}
