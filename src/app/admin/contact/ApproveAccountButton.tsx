'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import CopyButton from '@/components/CopyButton';

interface Props {
  requestId: string;
  name: string;
  email: string;
}

interface ApproveResponse {
  ok?: boolean;
  initialPassword?: string;
  emailed?: boolean;
  organizer?: { email?: string };
  error?: string;
}

interface Created {
  email: string;
  password: string;
  emailed: boolean;
}

/**
 * Turn one application into a real organizer account. The server creates the
 * account, emails the sign-in details, and marks the application handled.
 *
 * The password comes back here too, and stays on screen until the page is left:
 * if the mail did not go out, this is the only copy of it that will ever exist.
 */
export default function ApproveAccountButton({ requestId, name, email }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Created | null>(null);

  async function approve() {
    if (busy) return;
    if (
      !window.confirm(
        `Create an organizer account for ${name}?\n\nThey get an account at ${email} and an email with a temporary password, which they have to change when they first sign in.`
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/contact/${requestId}/approve`, { method: 'POST' });
      const data = (await res.json().catch(() => null)) as ApproveResponse | null;
      if (!res.ok || !data?.ok || !data.initialPassword) {
        // 409 = this application was already approved, or that email already
        // has an account; the server message names it.
        setError(data?.error ?? 'Something went wrong — please try again.');
        return;
      }
      setCreated({
        email: data.organizer?.email ?? email,
        password: data.initialPassword,
        emailed: Boolean(data.emailed),
      });
      router.refresh();
    } catch {
      setError('Could not reach the server — please try again.');
    } finally {
      setBusy(false);
    }
  }

  if (created) {
    return (
      <div className={created.emailed ? 'notice notice-success' : 'notice notice-warn'} style={{ margin: 0 }}>
        <p className="small" style={{ marginTop: 0, marginBottom: 8 }}>
          {created.emailed ? (
            <>
              Account created and the sign-in details were emailed to <strong>{created.email}</strong>.
            </>
          ) : (
            <>
              Account created, but the email did <strong>not</strong> go out. Pass this password to{' '}
              <strong>{created.email}</strong> yourself.
            </>
          )}
        </p>
        <div className="copy-row">
          <span className="mono" style={{ fontWeight: 700, fontSize: '1.05rem' }}>
            {created.password}
          </span>
          <CopyButton value={created.password} />
        </div>
        <p className="muted small" style={{ marginBottom: 0 }}>
          Shown only this once — it is stored hashed and can only be reset, never read again. They
          must change it the moment they sign in.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 170 }}>
      <button type="button" className="btn btn-primary btn-sm" onClick={() => void approve()} disabled={busy}>
        {busy ? 'Creating…' : 'Approve & create account'}
      </button>
      {error && (
        <div className="notice notice-error small" style={{ margin: 0 }}>
          {error}
        </div>
      )}
    </div>
  );
}
