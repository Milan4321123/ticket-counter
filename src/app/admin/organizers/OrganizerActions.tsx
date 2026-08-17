'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import PasswordReveal from './PasswordReveal';

interface Props {
  organizerId: string;
  name: string;
  email: string;
  status: 'active' | 'disabled';
}

type Busy = 'status' | 'reset' | null;

interface UpdateResponse {
  ok?: boolean;
  newPassword?: string;
  emailed?: boolean;
  emailReason?: string;
  error?: string;
}

/**
 * Row actions for one organizer: disable/enable the account and reset the
 * password (the new password is shown exactly once). Accounts never expire —
 * the platform fee is charged per event — so there is no plan date to manage.
 */
export default function OrganizerActions({ organizerId, name, email, status }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState<string | null>(null);
  const [emailed, setEmailed] = useState<{ ok: boolean; reason?: string } | null>(null);

  async function post(body: Record<string, unknown>, kind: Exclude<Busy, null>): Promise<UpdateResponse | null> {
    if (busy !== null) return null;
    setBusy(kind);
    setError(null);
    try {
      const res = await fetch(`/api/admin/organizers/${organizerId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => null)) as UpdateResponse | null;
      if (!res.ok || !data?.ok) {
        setError(data?.error ?? 'Something went wrong — please try again.');
        return null;
      }
      // NOT refreshed while a one-time password is on screen — see the reset
      // handler below. Callers that change nothing visible refresh themselves.
      return data;
    } catch {
      setError('Could not reach the server — please try again.');
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function toggleStatus() {
    const next = status === 'active' ? 'disabled' : 'active';
    if (
      next === 'disabled' &&
      !window.confirm(
        `Disable ${name}?\n\nThey are signed out immediately and can no longer use the portal. Their events, orders, and tickets are kept.`
      )
    ) {
      return;
    }
    const r = await post({ status: next }, 'status');
    if (r) router.refresh();
  }

  async function resetPassword() {
    if (
      !window.confirm(
        `Reset the password for ${name}?\n\nTheir current password stops working immediately. A new one is emailed to ${email}, and shown here once in case it does not arrive.`
      )
    ) {
      return;
    }
    const data = await post({ resetPassword: true }, 'reset');
    if (data?.newPassword) {
      setNewPassword(data.newPassword);
      setEmailed({ ok: Boolean(data.emailed), reason: data.emailReason });
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 260 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          className={status === 'active' ? 'btn btn-danger btn-sm' : 'btn btn-primary btn-sm'}
          onClick={() => void toggleStatus()}
          disabled={busy !== null}
        >
          {busy === 'status'
            ? 'Working…'
            : status === 'active'
              ? 'Disable account'
              : 'Enable account'}
        </button>
        <button type="button" className="btn btn-sm" onClick={() => void resetPassword()} disabled={busy !== null}>
          {busy === 'reset' ? 'Resetting…' : 'Reset password'}
        </button>
      </div>
      {error && (
        <div className="notice notice-error small" style={{ margin: 0 }}>
          {error}
        </div>
      )}
      {emailed && (
        <div className={emailed.ok ? 'notice notice-success small' : 'notice notice-warn small'} style={{ margin: 0 }}>
          {emailed.ok ? (
            <>
              The new sign-in details were emailed to <strong>{email}</strong>. Accepted by the mail
              provider — if it never arrives it was filtered after that, so keep this password until
              they confirm.
            </>
          ) : (
            <>
              The email did <strong>not</strong> go out
              {emailed.reason ? ` (${emailed.reason})` : ''} — pass this password to <strong>{email}</strong>{' '}
              yourself.
            </>
          )}
        </div>
      )}
      {newPassword && <PasswordReveal email={email} password={newPassword} />}
      {newPassword && (
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => {
            setNewPassword(null);
            setEmailed(null);
            router.refresh();
          }}
        >
          Done — I have saved this
        </button>
      )}
    </div>
  );
}
