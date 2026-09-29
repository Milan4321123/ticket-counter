'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { forgetPersonalCaches } from '@/components/AppInstall';

export default function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onLogout() {
    if (busy) return;
    setBusy(true);
    try {
      await fetch('/api/admin/logout', { method: 'POST' });
    } catch {
      // Even if the request fails, leave the admin area.
    }
    // Pages this device kept offline go with the session (public/sw.js).
    await forgetPersonalCaches();
    router.push('/');
    router.refresh();
  }

  return (
    <button type="button" className="btn btn-sm" onClick={onLogout} disabled={busy}>
      {busy ? 'Signing out…' : 'Sign out'}
    </button>
  );
}
