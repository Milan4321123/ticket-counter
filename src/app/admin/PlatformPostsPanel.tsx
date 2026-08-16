'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Post {
  id: string;
  body: string;
  photoUrl: string;
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
  contact: { name: string; role: string; photoUrl: string; focus: string };
}) {
  const router = useRouter();
  const [body, setBody] = useState('');
  const [name, setName] = useState(contact.name);
  const [role, setRole] = useState(contact.role);
  const [photoUrl, setPhotoUrl] = useState(contact.photoUrl);
  // "x% y%" — which part of the photo stays inside the circle.
  const [fx, setFx] = useState(() => Number.parseInt(contact.focus.split(' ')[0], 10) || 50);
  const [fy, setFy] = useState(() => Number.parseInt(contact.focus.split(' ')[1], 10) || 50);
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
              {p.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.photoUrl}
                  alt=""
                  style={{ display: 'block', width: '100%', borderRadius: 8, marginTop: 8 }}
                />
              ) : null}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
                <span className="muted small">{p.createdAt.slice(0, 16)}</span>
                {/* Per post, because each announcement gets its own picture —
                    the file is only saved once a post exists to attach it to. */}
                <label className="btn btn-sm" style={{ cursor: 'pointer' }}>
                  {p.photoUrl ? 'Replace photo' : 'Add a photo'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    style={{ display: 'none' }}
                    disabled={busy}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setBusy(true);
                      setError(null);
                      const form = new FormData();
                      form.append('photo', file);
                      form.append('postId', p.id);
                      const res = await fetch('/api/admin/contact-photo', { method: 'POST', body: form });
                      const data = (await res.json().catch(() => null)) as { error?: string } | null;
                      setBusy(false);
                      if (!res.ok) {
                        setError(data?.error || 'That image could not be uploaded.');
                        return;
                      }
                      router.refresh();
                    }}
                  />
                </label>
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
        <label htmlFor="pc-photo">Your photo</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoUrl}
              alt="Your current photo"
              width={64}
              height={64}
              style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover' }}
            />
          ) : (
            <span
              aria-hidden="true"
              style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '1.5rem',
                color: '#fff',
                background: 'linear-gradient(135deg, var(--brand), var(--pink))',
              }}
            >
              {(name.trim().charAt(0) || '?').toUpperCase()}
            </span>
          )}
          <input
            id="pc-photo"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="input"
            style={{ maxWidth: 280 }}
            disabled={busy}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setBusy(true);
              setError(null);
              const form = new FormData();
              form.append('photo', file);
              const res = await fetch('/api/admin/contact-photo', { method: 'POST', body: form });
              const data = (await res.json().catch(() => null)) as
                | { photoUrl?: string; error?: string }
                | null;
              setBusy(false);
              if (!res.ok || !data?.photoUrl) {
                setError(data?.error || 'That image could not be uploaded.');
                return;
              }
              // Saved server-side already; reflect it here so the preview
              // updates without a reload.
              setPhotoUrl(data.photoUrl);
              router.refresh();
            }}
          />
        </div>
        <p className="muted small" style={{ margin: '8px 0 0' }}>
          Any shape works — the whole photo is kept and shrunk to 512px, then you
          choose which part sits in the circle below. JPEG, PNG or WebP, up to 5 MB.
          With no photo your initial is shown instead, which beats a broken image.
        </p>

        {/* Only useful once there is a photo to move. Two sliders rather than a
            drag surface: the circle is 46px on the real site, so a drag would be
            fighting for single pixels, while a slider lands exactly. */}
        {photoUrl ? (
          <div style={{ marginTop: 14 }}>
            <p className="muted small" style={{ margin: '0 0 8px' }}>
              Move your face into the circle — this is exactly what visitors see:
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photoUrl}
                alt="Preview"
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: '50%',
                  objectFit: 'cover',
                  objectPosition: `${fx}% ${fy}%`,
                  border: '2px solid var(--brand)',
                }}
              />
              <div style={{ display: 'grid', gap: 8, minWidth: 220 }}>
                <label className="small">
                  Left / right
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={fx}
                    onChange={(e) => setFx(Number(e.target.value))}
                    style={{ width: '100%' }}
                  />
                </label>
                <label className="small">
                  Up / down
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={fy}
                    onChange={(e) => setFy(Number(e.target.value))}
                    style={{ width: '100%' }}
                  />
                </label>
              </div>
            </div>
            <p className="muted small" style={{ margin: '8px 0 0' }}>
              Heads usually sit above centre, so try pulling &ldquo;up / down&rdquo; toward
              the left. Press <strong>Save contact card</strong> to keep it.
            </p>
          </div>
        ) : null}
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
