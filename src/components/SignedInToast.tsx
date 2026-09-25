'use client';

// A short welcome after signing in (the sign-in flow adds ?signedin=1): says
// what the account is for, then clears itself and the flag from the address.
import { useEffect, useState } from 'react';

export default function SignedInToast() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get('signedin') !== '1') return;
    url.searchParams.delete('signedin');
    window.history.replaceState(window.history.state, '', url);
    setShow(true);
    const t = window.setTimeout(() => setShow(false), 5000);
    return () => window.clearTimeout(t);
  }, []);
  if (!show) return null;
  return (
    <div className="signed-toast" role="status">
      <span aria-hidden="true">✓</span>
      <span>
        <strong>Welcome — you’re signed in.</strong> Your orders, tickets and basket are kept on your account.
      </span>
      <button type="button" onClick={() => setShow(false)} aria-label="Close">
        ×
      </button>
    </div>
  );
}
