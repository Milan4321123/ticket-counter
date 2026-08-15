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
      router.refresh();
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
    await post({ status: next }, 'status');
  }

  async function resetPassword() {
    if (
      !window.confirm(
        `Reset the password for ${name}?\n\nTheir current password stops working immediately. You'll get the new one to hand to them.`
      )
    ) {
      return;
    }
    const data = await post({ resetPassword: true }, 'reset');
    if (data?.newPassword) setNewPassword(data.newPassword);
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
      {newPassword && <PasswordReveal email={email} password={newPassword} />}
    </div>
  );
}
