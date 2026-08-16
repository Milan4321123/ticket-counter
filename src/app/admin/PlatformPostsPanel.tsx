'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Post {
  id: string;
  body: string;
  createdAt: string;
}

/**
 * The owner's own voice on the site: announcements for the browse page, and the
 * name, role and face shown on the "talk to us" card.
 *
 * Kept together because they are the same job — deciding what the platform says
 * about itself — and separating them would mean two panels that are each half a
 * thought.
 */
export default function PlatformPostsPanel({
  posts,
  contact,
}: {
  posts: Post[];
  contact: { name: string; role: string; photoUrl: string };
}) {
  const router = useRouter();
  const [body, setBody] = useState('');
  const [name, setName] = useState(contact.name);
  const [role, setRole] = useState(contact.role);
  const [photoUrl, setPhotoUrl] = useState(contact.photoUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function post(payload: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    const res = await fetch('/api/admin/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    setBusy(false);
    if (!res.ok) {
      setError(data?.error || 'Something went wrong — please try again.');
      return false;
    }
    router.refresh();
    return true;
  }

  return (
    <div className="card anim-fade-up">
      <div className="card-title">Post an update to the home page</div>
      <p className="muted small" style={{ marginTop: 0 }}>
        Everyone browsing sees these, above the events. Use it for what the whole
        platform needs to know — a new city, a change to how fees work, a festival
        you are running.
      </p>

      <textarea
        className="input"
        rows={3}
        maxLength={1000}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="We now cover Hamburg and Munich — organizers there can apply today."
        style={{ resize: 'vertical', fontFamily: 'inherit' }}
      />
      <button
        type="button"
        className="btn btn-brand btn-sm"
        style={{ marginTop: 10 }}
        disabled={busy || body.trim().length < 3}
        onClick={async () => {
          if (await post({ body })) setBody('');
        }}
      >
        {busy ? 'Posting…' : 'Post it'}
      </button>

      {posts.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <p className="muted small" style={{ margin: '0 0 8px' }}>
            Live on the home page now:
          </p>
          {posts.map((p) => (
            <div
              key={p.id}
              style={{
                border: '1px solid var(--border)',
                borderRadius: 10,
                padding: 12,
                marginBottom: 8,
              }}
            >
              <div className="small">{p.body}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                <span className="muted small">{p.createdAt.slice(0, 16)}</span>
                <button
                  type="button"
                  className="btn btn-sm"
                  disabled={busy}
                  onClick={() => {
                    if (confirm('Remove this update from the home page?')) {
                      void post({ action: 'delete', id: p.id });
                    }
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '20px 0 16px' }} />

      <div className="card-title" style={{ fontSize: '1rem' }}>
        Who visitors are invited to talk to
      </div>
      <p className="muted small" style={{ marginTop: 0 }}>
        Shown on the home page as a person, not a form. Leave the name blank to hide
        the card entirely.
      </p>
      <div className="field">
        <label htmlFor="pc-name">Name</label>
        <input
          id="pc-name"
          className="input"
          value={name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
          placeholder="Milan Adhikari"
        />
      </div>
      <div className="field">
        <label htmlFor="pc-role">Role</label>
        <input
          id="pc-role"
          className="input"
          value={role}
          maxLength={80}
          onChange={(e) => setRole(e.target.value)}
          placeholder="Designer & founder"
        />
      </div>
      <div className="field">
        <label htmlFor="pc-photo">Photo URL</label>
        <input
          id="pc-photo"
          className="input"
          value={photoUrl}
          maxLength={500}
          onChange={(e) => setPhotoUrl(e.target.value)}
          placeholder="https://…/milan.jpg"
        />
        <p className="muted small" style={{ margin: '6px 0 0' }}>
          A square photo works best. Leave it blank and your initial is shown in a
          circle instead — which is better than a broken image.
        </p>
      </div>
      <button
        type="button"
        className="btn btn-sm"
        disabled={busy}
        onClick={async () => {
          if (await post({ action: 'contact', name, role, photoUrl })) {
            setSaved(true);
            setTimeout(() => setSaved(false), 2500);
          }
        }}
      >
        {busy ? 'Saving…' : saved ? 'Saved ✓' : 'Save contact card'}
      </button>

      {error && (
        <div className="notice notice-error small" style={{ marginTop: 10 }}>
          {error}
        </div>
      )}
    </div>
  );
}
