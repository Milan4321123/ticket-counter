'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onLogout() {
    if (busy) return;
    setBusy(true);
    try {
      await fetch('/api/portal/logout', { method: 'POST' });
    } catch {
      // Even if the request fails, leave the portal.
    }
    router.push('/portal/login');
    router.refresh();
  }

  return (
    <button type="button" className="btn btn-sm" onClick={onLogout} disabled={busy}>
      {busy ? 'Signing out…' : 'Sign out'}
    </button>
  );
}
