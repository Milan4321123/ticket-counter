'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { forgetPersonalCaches } from '@/components/AppInstall';

export default function LogoutButton({ quiet = false }: { quiet?: boolean }) {
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
    // Pages this device kept offline go with the session (public/sw.js).
    await forgetPersonalCaches();
    router.push('/portal/login');
    router.refresh();
  }

  return (
    <button type="button" className={quiet ? 'hub-signout' : 'btn btn-sm'} onClick={onLogout} disabled={busy}>
      {busy ? 'Signing out…' : 'Sign out'}
    </button>
  );
}
