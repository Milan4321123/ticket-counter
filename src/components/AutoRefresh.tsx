'use client';

// Re-renders the page from the server every `everyMs` while the tab is
// visible — how the buyer's order tracker moves from "cooking" to "ready"
// without anybody pressing reload. Stops by itself when `until` is true.
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function AutoRefresh({ everyMs = 20_000, until = false }: { everyMs?: number; until?: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (until) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') router.refresh();
    }, everyMs);
    return () => window.clearInterval(id);
  }, [router, everyMs, until]);
  return null;
}
