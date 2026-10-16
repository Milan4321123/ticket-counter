'use client';

// The member's Kalakar profile: what they do, where, a few lines, links, a
// video, and a photo. The photo is cut to a square and shrunk right here in
// the browser — what reaches the server is a small JPEG with no camera data.
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { KNOWN_CITIES } from '@/lib/cities';

interface Kind {
  key: string;
  label: string;
  emoji: string;
}

interface Initial {
  name: string;
  kind: string;
  city: string;
  areas: string;
  bio: string;
  links: string[];
  videoUrl: string;
  photoUrl: string | null;
  status: string | null;
  slug: string | null;
}

const PHOTO_SIZE = 640;

/** Centre-crop to a square, PHOTO_SIZE across, as a JPEG blob. */
async function squarePhoto(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const sx = (img.naturalWidth - side) / 2;
    const sy = Math.max(0, (img.naturalHeight - side) * 0.35);
    const canvas = document.createElement('canvas');
    canvas.width = PHOTO_SIZE;
    canvas.height = PHOTO_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no canvas');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, PHOTO_SIZE, PHOTO_SIZE);
    ctx.drawImage(img, sx, sy, side, side, 0, 0, PHOTO_SIZE, PHOTO_SIZE);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.86));
    if (!blob) throw new Error('no blob');
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function TalentForm({ kinds, initial }: { kinds: Kind[]; initial: Initial }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [links, setLinks] = useState<string[]>(initial.links.length ? initial.links : ['']);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(initial.photoUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [askDelete, setAskDelete] = useState(false);
  const set = <K extends keyof Initial>(k: K, value: Initial[K]) => setV((prev) => ({ ...prev, [k]: value }));

  async function pickPhoto(file: File | undefined) {
    if (!file) return;
    setError('');
    try {
      const blob = await squarePhoto(file);
      setPhoto(blob);
      setPreview(URL.createObjectURL(blob));
    } catch {
      setError('That photo could not be opened — try another one.');
    }
  }

  async function post(body: unknown): Promise<{ ok: boolean; data: Record<string, unknown> }> {
    const res = await fetch('/api/community/talent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { ok: res.ok, data: (await res.json().catch(() => ({}))) as Record<string, unknown> };
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await post({ action: 'save', ...v, links: links.filter((l) => l.trim()) });
      if (!r.ok) throw new Error((r.data.error as string) || 'Could not save.');
      if (photo) {
        const up = await fetch('/api/community/talent/photo', { method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: photo });
        const data = (await up.json().catch(() => ({}))) as { error?: string };
        if (!up.ok) throw new Error(data.error || 'The profile is saved, but the photo did not upload — try it again.');
      }
      router.push(`/kalakar/${r.data.slug as string}`);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  async function control(action: 'hide' | 'show' | 'delete') {
    setBusy(true);
    const r = await post({ action });
    setBusy(false);
    if (!r.ok) return setError((r.data.error as string) || 'That did not work.');
    if (action === 'delete') router.push('/kalakar');
    router.refresh();
  }

  return (
    <form className="mu-form" onSubmit={save}>
      <div className="kl-photo-pick">
        {preview ? (
          // A blob: URL or our own route.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="kl-avatar" />
        ) : (
          <span className="kl-avatar kl-photo-none" aria-hidden="true">
            📷
          </span>
        )}
        <div>
          <input id="kl-photo" type="file" accept="image/*" className="sr-only" onChange={(e) => pickPhoto(e.target.files?.[0])} />
          <label htmlFor="kl-photo" className="btn btn-sm">
            {preview ? 'Change photo' : 'Add a photo'}
          </label>
          <p className="muted small">A clear photo of you, your group or your work. It becomes a square.</p>
        </div>
      </div>

      <div className="field">
        <label htmlFor="kl-name">Name people know you by</label>
        <input id="kl-name" className="input" value={v.name} maxLength={60} required onChange={(e) => set('name', e.target.value)} placeholder="e.g. Sunita Gurung, Himalayan Beats, Pandit Ram Sharma" />
      </div>

      <fieldset className="gc-group">
        <legend>What you do</legend>
        <div className="chip-row">
          {kinds.map((k) => (
            <button type="button" key={k.key} className={`chip${v.kind === k.key ? ' chip-active' : ''}`} aria-pressed={v.kind === k.key} onClick={() => set('kind', k.key)}>
              {k.emoji} {k.label}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="mu-two">
        <div className="field">
          <label htmlFor="kl-city">Based in</label>
          <input id="kl-city" className="input" value={v.city} list="kl-cities" maxLength={60} required onChange={(e) => set('city', e.target.value)} />
          <datalist id="kl-cities">
            {KNOWN_CITIES.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <div className="field">
          <label htmlFor="kl-areas">Travels to (optional)</label>
          <input id="kl-areas" className="input" value={v.areas} maxLength={80} onChange={(e) => set('areas', e.target.value)} placeholder="e.g. All Germany, Hessen & NRW" />
        </div>
      </div>

      <div className="field">
        <label htmlFor="kl-bio">About you</label>
        <textarea
          id="kl-bio"
          className="input"
          rows={6}
          maxLength={1500}
          value={v.bio}
          required
          onChange={(e) => set('bio', e.target.value)}
          placeholder="What you do, where you have performed or worked, languages, what kind of events you take…"
        />
      </div>

      <fieldset className="gc-group">
        <legend>Links (optional)</legend>
        {links.map((l, i) => (
          <input
            key={i}
            className="input kl-link"
            value={l}
            maxLength={300}
            inputMode="url"
            placeholder="instagram.com/yourname, youtube.com/@channel, your website…"
            onChange={(e) => setLinks((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))}
            aria-label={`Link ${i + 1}`}
          />
        ))}
        {links.length < 5 && (
          <button type="button" className="cm-link-btn" onClick={() => setLinks((prev) => [...prev, ''])}>
            + another link
          </button>
        )}
      </fieldset>

      <div className="field">
        <label htmlFor="kl-video">A video (optional)</label>
        <input id="kl-video" className="input" value={v.videoUrl} maxLength={300} inputMode="url" onChange={(e) => set('videoUrl', e.target.value)} placeholder="A YouTube or Vimeo link" />
      </div>

      {error && (
        <p className="notice notice-error" role="alert">
          {error}
        </p>
      )}
      <button className="btn btn-brand" disabled={busy || !v.kind}>
        {busy ? 'Saving…' : initial.slug ? 'Save changes' : 'Publish my profile'}
      </button>
      <p className="muted small">
        Your profile is public — anyone can find it, including Google. Your email and member name are never shown; enquiries come to
        your inbox here.
      </p>

      {initial.slug && (
        <div className="kl-danger">
          {initial.status === 'live' && (
            <button type="button" className="btn btn-sm" disabled={busy} onClick={() => control('hide')}>
              Hide my profile
            </button>
          )}
          {initial.status === 'hidden' && (
            <button type="button" className="btn btn-sm" disabled={busy} onClick={() => control('show')}>
              Show my profile again
            </button>
          )}
          {askDelete ? (
            <>
              <button type="button" className="btn btn-sm mu-danger" disabled={busy} onClick={() => control('delete')}>
                Yes, delete it for good
              </button>
              <button type="button" className="btn btn-sm" onClick={() => setAskDelete(false)}>
                Keep it
              </button>
            </>
          ) : (
            <button type="button" className="btn btn-sm" onClick={() => setAskDelete(true)}>
              Delete my profile
            </button>
          )}
        </div>
      )}
    </form>
  );
}
