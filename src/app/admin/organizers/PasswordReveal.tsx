'use client';

import CopyButton from '@/components/CopyButton';

/**
 * One-time password display. The password only exists in this browser tab
 * right now — it is stored hashed and can never be shown again (only reset).
 */
export default function PasswordReveal({ email, password }: { email: string; password: string }) {
  return (
    <div className="notice notice-success" style={{ marginTop: 10 }}>
      <p className="small" style={{ marginTop: 0, marginBottom: 8 }}>
        Password for <strong>{email}</strong> — shown <strong>only this once</strong>:
      </p>
      <div className="copy-row">
        <span className="mono" style={{ fontWeight: 700, fontSize: '1.05rem' }}>
          {password}
        </span>
        <CopyButton value={password} />
      </div>
      <p className="muted small" style={{ marginBottom: 0 }}>
        Copy it now and share it with the organizer over a secure channel — a phone call or an
        end-to-end encrypted chat, not a plain email. It disappears when you leave this page, and
        the portal makes them replace it the first time they sign in.
      </p>
    </div>
  );
}
