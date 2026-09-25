'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { compressImage, compressVideo, formatMb } from '@/components/mediaCompress';
import type { CropRect } from '@/lib/events';
import CoverCropper from './CoverCropper';
import { saveEvent } from './save';

interface MediaItem {
  id: string;
  url: string;
}

interface Props {
  eventId: string;
  /** Photos, in gallery order. */
  media: MediaItem[];
  /** Uploaded videos, in the same kind of order. */
  videos: MediaItem[];
  posterMediaId: string | null;
  profileMediaId: string | null;
  /** The cover — a photo OR a video id. */
  coverMediaId: string | null;
  /** Framing the organizer already chose for each fixed-shape slot. */
  crops: {
    cover: CropRect | null;
    profile: CropRect | null;
    poster: CropRect | null;
  };
  videoUrl: string;
  maxPhotos: number;
  maxVideos: number;
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // keep in sync with lib/media MAX_IMAGE_BYTES
const MAX_VIDEO_BYTES = 60 * 1024 * 1024; // keep in sync with lib/media MAX_VIDEO_BYTES
const VIDEO_TYPES = ['video/mp4', 'video/webm'];

// Frame shapes, taken straight from the variants the server renders (see
// lib/imageVariants VARIANTS). If these ever drift from those, the preview
// stops being the truth — which is the entire point of it.
const COVER_ASPECT = 1600 / 740;
const CARD_ASPECT = 800 / 1000;

export default function MediaPanel({
  eventId,
  media,
  videos,
  posterMediaId,
  profileMediaId,
  coverMediaId,
  crops,
  videoUrl,
  maxPhotos,
  maxVideos,
}: Props) {
  const router = useRouter();
  // 'photo-compress' | 'upload' | 'video-compress' | 'video-upload' | 'video-remove' | 'video-link' | a media id
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [video, setVideo] = useState(videoUrl);
  const [videoProgress, setVideoProgress] = useState<number | null>(null);
  /** "2 of 5" while several photos go up. */
  const [uploading, setUploading] = useState('');
  /** The photo tapped in the grid — its actions show under the grid. */
  const [selected, setSelected] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const videoFileRef = useRef<HTMLInputElement>(null);

  function resetPhotoInput() {
    if (fileRef.current) fileRef.current.value = '';
  }

  function resetVideoInput() {
    if (videoFileRef.current) videoFileRef.current.value = '';
  }

  async function upload(file: File): Promise<boolean> {
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`/api/portal/events/${eventId}/media`, { method: 'POST', body: form });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok) {
        setError(data?.error ?? 'The photo could not be uploaded — please try again.');
        return false;
      }
      return true;
    } catch {
      setError('Could not reach the server — please check your connection and try again.');
      return false;
    }
  }

  /** Several photos at once (picked or dropped): shrink big phone photos, then upload one by one. */
  async function addPhotos(list: File[]) {
    const files = list.filter((f) => f.type.startsWith('image/')).slice(0, Math.max(0, maxPhotos - media.length));
    if (files.length === 0 || busy) return;
    setError(null);
    setNotice(null);
    let added = 0;
    for (let i = 0; i < files.length; i++) {
      setUploading(files.length > 1 ? `${i + 1} of ${files.length}` : '');
      let ready = files[i];
      if (ready.size > MAX_IMAGE_BYTES) {
        setBusy('photo-compress');
        ready = await compressImage(ready, { maxBytes: MAX_IMAGE_BYTES });
      }
      if (ready.size > MAX_IMAGE_BYTES) {
        setError(
          `A photo is ${formatMb(ready.size)} MB — the limit is ${formatMb(MAX_IMAGE_BYTES)} MB. ` +
            'On your phone, share it at a smaller size (or take a screenshot of it), then try again.'
        );
        continue;
      }
      setBusy('upload');
      if (await upload(ready)) added++;
    }
    setBusy(null);
    setUploading('');
    resetPhotoInput();
    if (added) {
      setNotice(added === 1 ? 'Photo added.' : `${added} photos added.`);
      router.refresh();
    }
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    await addPhotos(Array.from(e.target.files ?? []));
  }

  async function removePhoto(item: MediaItem) {
    if (busy) return;
    if (!window.confirm('Delete this photo? This cannot be undone.')) return;
    setBusy(item.id);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/portal/media/${item.id}`, { method: 'DELETE' });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setError(data?.error ?? 'The photo could not be deleted — please try again.');
        return;
      }
      router.refresh();
    } catch {
      setError('Could not reach the server — please check your connection and try again.');
    } finally {
      setBusy(null);
    }
  }

  /** One saver for all three "pick this one" actions. */
  async function pick(item: MediaItem, patch: Record<string, unknown>, done: string) {
    if (busy) return;
    setBusy(item.id);
    setError(null);
    setNotice(null);
    const result = await saveEvent(eventId, patch);
    setBusy(null);
    if (!result.ok) {
      setError(result.error ?? 'Something went wrong — please try again.');
      return;
    }
    setNotice(done);
    router.refresh();
  }

  const setCover = (item: MediaItem) =>
    pick(item, { coverMediaId: item.id }, 'Cover updated — this is what people see first.');
  const setPoster = (item: MediaItem) =>
    pick(item, { posterMediaId: item.id }, 'Listing photo updated — this is your tile on Browse events.');
  const setProfile = (item: MediaItem) => pick(item, { profileMediaId: item.id }, 'Profile photo updated.');

  /** Hand the listing tile back to the cover — the default for a new event. */
  const clearPoster = (item: MediaItem) =>
    pick(item, { posterMediaId: null }, 'Listing photo cleared — your cover is used on Browse events again.');

  async function onVideoFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || busy) return;
    setError(null);
    setNotice(null);

    if (!VIDEO_TYPES.includes(file.type)) {
      setError('Only MP4 and WebM videos are supported.');
      resetVideoInput();
      return;
    }

    setBusy('video-compress');
    // No real transcoding happens in the browser — this either passes the file
    // through or hands back friendly "make it smaller" guidance.
    const { file: ready, note } = await compressVideo(file, { maxBytes: MAX_VIDEO_BYTES });
    if (note) {
      setError(note);
      setBusy(null);
      resetVideoInput();
      return;
    }
    void uploadVideo(ready);
  }

  async function uploadVideo(file: File) {
    setBusy('video-upload');
    setVideoProgress(0);
    try {
      const form = new FormData();
      form.append('file', file);
      // XMLHttpRequest instead of fetch so we can show real upload progress —
      // a 60 MB file on hotel wifi takes a while.
      const { status, body } = await new Promise<{
        status: number;
        body: { ok?: boolean; error?: string } | null;
      }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `/api/portal/events/${eventId}/video`);
        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) setVideoProgress(Math.round((ev.loaded / ev.total) * 100));
        };
        xhr.onload = () => {
          let parsed: { ok?: boolean; error?: string } | null = null;
          try {
            parsed = JSON.parse(xhr.responseText) as { ok?: boolean; error?: string };
          } catch {
            parsed = null;
          }
          resolve({ status: xhr.status, body: parsed });
        };
        xhr.onerror = () => reject(new Error('network'));
        xhr.send(form);
      });
      if (status < 200 || status >= 300) {
        setError(body?.error ?? 'The video could not be uploaded — please try again.');
        return;
      }
      setNotice('Video uploaded — it now plays on your event page.');
      router.refresh();
    } catch {
      setError('Could not reach the server — please check your connection and try again.');
    } finally {
      setBusy(null);
      setVideoProgress(null);
      resetVideoInput();
    }
  }

  async function removeVideo(item: MediaItem) {
    if (busy) return;
    if (!window.confirm('Remove this video from your event page?')) return;
    setBusy(item.id);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/portal/events/${eventId}/video`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mediaId: item.id }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setError(data?.error ?? 'The video could not be removed — please try again.');
        return;
      }
      setNotice('Video removed.');
      router.refresh();
    } catch {
      setError('Could not reach the server — please check your connection and try again.');
    } finally {
      setBusy(null);
    }
  }

  async function saveVideoLink(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy('video-link');
    setError(null);
    setNotice(null);
    const result = await saveEvent(eventId, { videoUrl: video.trim() });
    setBusy(null);
    if (!result.ok) {
      setError(result.error ?? 'Something went wrong — please try again.');
      return;
    }
    setNotice(video.trim() ? 'Video link saved.' : 'Video link removed.');
    router.refresh();
  }

  const tileStyle = (id: string): React.CSSProperties => ({
    border: id === coverMediaId ? '2px solid var(--accent)' : '1px solid var(--border)',
    borderRadius: 10,
    overflow: 'hidden',
    background: 'var(--bg-elevated)',
    // The cover is the one choice that changes the public page the most, so it
    // reads at a glance across a grid of near-identical thumbnails.
    boxShadow: id === coverMediaId ? '0 0 0 4px var(--accent-soft)' : undefined,
  });

  // Only a PHOTO cover can be repositioned — a video fills its frame as it is.
  const coverPhotoId = coverMediaId && !videos.some((v) => v.id === coverMediaId) ? coverMediaId : null;

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
    gap: 12,
    marginBottom: 16,
  };

  /** Shared "Set as cover" control — identical for photos and videos. */
  function CoverButton({ item }: { item: MediaItem }) {
    if (item.id === coverMediaId) return <span className="badge badge-accent">Cover</span>;
    return (
      <button type="button" className="btn-copy" onClick={() => void setCover(item)} disabled={busy !== null}>
        {busy === item.id ? '…' : 'Set as cover'}
      </button>
    );
  }

  /** Flag sitting on the thumbnail itself, so the cover is spottable mid-grid. */
  function CoverFlag({ id }: { id: string }) {
    if (id !== coverMediaId) return null;
    return (
      <span
        className="badge badge-accent"
        style={{
          position: 'absolute',
          top: 8,
          left: 8,
          zIndex: 2,
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.5)',
        }}
      >
        Cover
      </span>
    );
  }

  /** The same, for the listing tile — opposite corner so the two never overlap. */
  function ListingFlag({ id }: { id: string }) {
    if (id !== posterMediaId) return null;
    return (
      <span
        className="badge badge-accent"
        style={{
          position: 'absolute',
          top: 8,
          right: 8,
          zIndex: 2,
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.5)',
        }}
      >
        Listing
      </span>
    );
  }

  const sel = media.find((m) => m.id === selected) ?? null;
  const roles = (id: string) =>
    [id === coverMediaId && 'Cover', id === posterMediaId && 'Tile', id === profileMediaId && 'Profile'].filter(
      Boolean
    ) as string[];

  return (
    <div className="ks mp">
      {error && (
        <div className="notice notice-error" style={{ margin: 0 }}>
          {error}
        </div>
      )}
      {!error && notice && (
        <div className="notice notice-success" style={{ margin: 0 }}>
          {notice}
        </div>
      )}

      {/* ---- Add ---- */}
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        onChange={(e) => void onFileChange(e)}
        style={{ display: 'none' }}
        aria-label="Upload photos"
      />
      <button
        type="button"
        className={`mp-drop${dragOver ? ' is-over' : ''}`}
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          void addPhotos(Array.from(e.dataTransfer.files));
        }}
        disabled={busy !== null || media.length >= maxPhotos}
      >
        <span className="mp-drop-icon" aria-hidden="true">
          {busy === 'upload' || busy === 'photo-compress' ? <span className="spinner" /> : '＋'}
        </span>
        <strong>
          {busy === 'photo-compress'
            ? 'Shrinking…'
            : busy === 'upload'
              ? `Uploading${uploading ? ` ${uploading}` : ''}…`
              : media.length === 0
                ? 'Add photos'
                : 'Add more photos'}
        </strong>
        <span>
          Pick several at once — or drop them here ·{' '}
          {media.length} of {maxPhotos}
        </span>
      </button>

      {/* ---- Photos: tap one to give it a job ---- */}
      {media.length > 0 && (
        <section className="ks-step">
          <p className="muted small" style={{ margin: 0 }}>
            Tap a photo to make it the <strong>cover</strong> (top of your page), the <strong>tile</strong> on Browse,
            or the round <strong>profile</strong> photo.
          </p>
          <div className="mp-grid">
            {media.map((item) => {
              const r = roles(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`mp-tile${selected === item.id ? ' is-on' : ''}${item.id === coverMediaId ? ' is-cover' : ''}`}
                  onClick={() => setSelected(selected === item.id ? null : item.id)}
                  aria-pressed={selected === item.id}
                >
                  {/* Served by our own /api/media route — next/image is not needed here. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.url} alt="Photo" loading="lazy" />
                  {r.length > 0 && (
                    <span className="mp-roles">
                      {r.map((x) => (
                        <span key={x} className="badge badge-accent">
                          {x}
                        </span>
                      ))}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {sel && (
            <div className="mp-actions" role="toolbar" aria-label="This photo">
              <button
                type="button"
                className={`ks-chip${sel.id === coverMediaId ? ' is-on' : ''}`}
                disabled={busy !== null || sel.id === coverMediaId}
                onClick={() => void setCover(sel)}
              >
                🖼 Cover
              </button>
              <button
                type="button"
                className={`ks-chip${sel.id === posterMediaId ? ' is-on' : ''}`}
                disabled={busy !== null}
                onClick={() => void (sel.id === posterMediaId ? clearPoster(sel) : setPoster(sel))}
              >
                🗂 Tile on Browse
              </button>
              <button
                type="button"
                className={`ks-chip${sel.id === profileMediaId ? ' is-on' : ''}`}
                disabled={busy !== null || sel.id === profileMediaId}
                onClick={() => void setProfile(sel)}
              >
                ◯ Profile
              </button>
              <button
                type="button"
                className="te-remove"
                disabled={busy !== null}
                onClick={() => {
                  setSelected(null);
                  void removePhoto(sel);
                }}
              >
                Delete
              </button>
            </div>
          )}
        </section>
      )}

      {/* ---- Framing ---- */}
      {(coverPhotoId || profileMediaId || posterMediaId) && (
        <details className="ks-step ks-more">
          <summary className="ks-q">
            <span className="ks-num">⤧</span> Adjust the framing <span className="badge">optional</span>
          </summary>
          <p className="muted small" style={{ margin: '0 0 8px' }}>
            Each spot has a fixed shape. Press Reposition and drag to choose what stays in frame — or leave it, we
            pick the part with the subject in it.
          </p>
          <div className="mp-crops">
          {coverPhotoId && (
            <CoverCropper
              key={`cover-${coverPhotoId}`}
              eventId={eventId}
              mediaId={coverPhotoId}
              field="coverCrop"
              variant="cover"
              aspect={COVER_ASPECT}
              maxWidth={440}
              label="Cover"
              hint="The wide band across the top of your event page. Looks best at 1600 × 740 pixels."
              saved={crops.cover}
            />
          )}
          {profileMediaId && (
            <CoverCropper
              key={`profile-${profileMediaId}`}
              eventId={eventId}
              mediaId={profileMediaId}
              field="profileCrop"
              variant="avatar"
              aspect={1}
              maxWidth={150}
              round
              label="Profile"
              hint="The round photo under the cover. Looks best at 400 × 400 pixels."
              saved={crops.profile}
            />
          )}
          {posterMediaId && (
            <CoverCropper
              key={`poster-${posterMediaId}`}
              eventId={eventId}
              mediaId={posterMediaId}
              field="posterCrop"
              variant="card"
              aspect={CARD_ASPECT}
              maxWidth={260}
              label="Listing photo"
              hint="Exactly what your tile looks like on the Browse events page."
              saved={crops.poster}
            />
          )}
          </div>
        </details>
      )}

      {/* ---- Videos ---- */}
      <details className="ks-step ks-more" open={videos.length > 0 || Boolean(videoUrl) || undefined}>
        <summary className="ks-q">
          <span className="ks-num">▶</span> Videos <span className="badge">optional</span>
        </summary>
        <p className="muted small" style={{ margin: '0 0 8px' }}>
          Up to {maxVideos} clips, 60 MB each. A video can be the cover — it plays quietly on a loop.
        </p>
        {videos.length > 0 && (
          <div style={gridStyle}>
            {videos.map((item, i) => (
              <div key={item.id} style={tileStyle(item.id)}>
                <div style={{ position: 'relative' }}>
                  <video
                    src={item.url}
                    controls
                    muted
                    preload="metadata"
                    playsInline
                    style={{ width: '100%', height: 110, objectFit: 'cover', display: 'block', background: '#000' }}
                  />
                  <CoverFlag id={item.id} />
                </div>
                <div style={{ padding: 8, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span className="muted small" style={{ width: '100%' }}>
                    Video {i + 1}
                    {item.id === coverMediaId ? ' · playing as your cover' : ''}
                  </span>
                  <CoverButton item={item} />
                  <button
                    type="button"
                    className="btn-copy"
                    style={{ color: 'var(--red)' }}
                    onClick={() => void removeVideo(item)}
                    disabled={busy !== null}
                  >
                    {busy === item.id ? '…' : 'Delete'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <input
          ref={videoFileRef}
          type="file"
          accept="video/mp4,video/webm"
          onChange={(e) => void onVideoFileChange(e)}
          style={{ display: 'none' }}
          aria-label="Upload a video"
        />
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn"
            onClick={() => videoFileRef.current?.click()}
            disabled={busy !== null || videos.length >= maxVideos}
          >
            {busy === 'video-upload' || busy === 'video-compress' ? <span className="spinner" aria-hidden /> : null}
            {busy === 'video-compress'
              ? 'Checking…'
              : busy === 'video-upload'
                ? videoProgress !== null
                  ? `Uploading… ${videoProgress}%`
                  : 'Uploading…'
                : videos.length > 0
                  ? 'Add another video'
                  : 'Upload video'}
          </button>
          <span className="muted small">
            {videos.length} of {maxVideos} videos · MP4 or WebM, up to 60 MB each
          </span>
        </div>

        {busy === 'video-upload' && videoProgress !== null && (
          <div
            aria-hidden
            style={{
              marginTop: 10,
              maxWidth: 380,
              height: 6,
              borderRadius: 999,
              border: '1px solid var(--border)',
              background: 'var(--bg-elevated)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${videoProgress}%`,
                height: '100%',
                background: 'var(--accent)',
                transition: 'width 0.2s ease',
              }}
            />
          </div>
        )}

        <details style={{ marginTop: 16 }}>
          <summary className="muted small" style={{ cursor: 'pointer' }}>
            Or paste a YouTube/Vimeo link instead
          </summary>
          <form onSubmit={saveVideoLink} style={{ marginTop: 10 }}>
            <div className="field">
              <label htmlFor="ev-video">Video link</label>
              <input
                id="ev-video"
                className="input"
                value={video}
                onChange={(e) => setVideo(e.target.value)}
                maxLength={400}
                spellCheck={false}
                placeholder="https://www.youtube.com/watch?v=…"
              />
              <p className="muted small" style={{ margin: '6px 0 0' }}>
                Paste a YouTube or Vimeo link (or a direct .mp4/.webm link). It only shows on your event page when you
                have not uploaded a video above. Leave empty for none.
              </p>
            </div>
            <button type="submit" className="btn btn-sm" disabled={busy !== null}>
              {busy === 'video-link' ? 'Saving…' : 'Save video link'}
            </button>
          </form>
        </details>
      </details>
    </div>
  );
}
