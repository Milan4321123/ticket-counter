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
const CARD_ASPECT = 800 / 500;

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
  const fileRef = useRef<HTMLInputElement>(null);
  const videoFileRef = useRef<HTMLInputElement>(null);

  function resetPhotoInput() {
    if (fileRef.current) fileRef.current.value = '';
  }

  function resetVideoInput() {
    if (videoFileRef.current) videoFileRef.current.value = '';
  }

  async function upload(file: File) {
    setBusy('upload');
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`/api/portal/events/${eventId}/media`, { method: 'POST', body: form });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok) {
        setError(data?.error ?? 'The photo could not be uploaded — please try again.');
        return;
      }
      setNotice('Photo added.');
      router.refresh();
    } catch {
      setError('Could not reach the server — please check your connection and try again.');
    } finally {
      setBusy(null);
      resetPhotoInput();
    }
  }

  /** Shrink oversized phone photos in the browser, then upload. */
  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || busy) return;
    setError(null);
    setNotice(null);

    let ready = file;
    if (file.size > MAX_IMAGE_BYTES) {
      setBusy('photo-compress');
      ready = await compressImage(file, { maxBytes: MAX_IMAGE_BYTES });
    }
    if (ready.size > MAX_IMAGE_BYTES) {
      setError(
        `This photo is ${formatMb(ready.size)} MB — the limit is ${formatMb(MAX_IMAGE_BYTES)} MB. ` +
          'On your phone, share it at a smaller size (or take a screenshot of it), then try again.'
      );
      setBusy(null);
      resetPhotoInput();
      return;
    }
    void upload(ready);
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
  const setPoster = (item: MediaItem) => pick(item, { posterMediaId: item.id }, 'Poster updated.');
  const setProfile = (item: MediaItem) => pick(item, { profileMediaId: item.id }, 'Profile photo updated.');

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

  return (
    <div>
      {error && <div className="notice notice-error">{error}</div>}
      {!error && notice && <div className="notice notice-success">{notice}</div>}

      <p className="muted small" style={{ marginTop: 0 }}>
        Pick one <strong>cover</strong> — a photo or a video. It fills the top of your event page and is the first thing
        people see; a video cover plays by itself, quietly and on a loop. Everything else shows in the gallery below it.
        The <strong>poster</strong> is the thumbnail your event shows in the public listings, and the{' '}
        <strong>profile photo</strong> shows as a round avatar under the cover and next to your updates, like on a social
        page. Each of those three has a fixed shape and is always filled — you choose which part of
        the photo is in frame.
      </p>

      {/* Exactly what visitors get, and the place to change it. Each of these
          frames is a real slot on the site at its real shape, always full — and
          what sits inside the frame is precisely what the server renders, so
          nobody has to imagine the result or accept our guess at it. */}
      {(coverPhotoId || profileMediaId || posterMediaId) && (
        <div
          style={{
            display: 'flex',
            gap: 18,
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            padding: 14,
            marginBottom: 16,
            border: '1px solid var(--border)',
            borderRadius: 10,
            background: 'var(--bg-elevated)',
          }}
        >
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
              label="Poster"
              hint="The tile your event shows in the listings."
              saved={crops.poster}
            />
          )}
          <p className="muted small" style={{ flex: '1 1 100%', margin: 0 }}>
            Any photo works, whatever shape it is. Each space above is a fixed shape and is always
            filled, so press <strong>Reposition</strong> and drag the photo to choose what stays in
            frame. Leave it alone and we pick the part with the subject in it.
          </p>
        </div>
      )}

      <div style={{ fontWeight: 600, marginBottom: 8 }}>Photos</div>

      {media.length > 0 && (
        <div style={gridStyle}>
          {media.map((item) => (
            <div key={item.id} style={tileStyle(item.id)}>
              <div style={{ position: 'relative' }}>
                {/* Served by our own /api/media route — next/image is not needed here. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.url}
                  alt="Event photo"
                  style={{ width: '100%', height: 110, objectFit: 'cover', display: 'block' }}
                />
                <CoverFlag id={item.id} />
              </div>
              <div style={{ padding: 8, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <CoverButton item={item} />
                {item.id === posterMediaId ? (
                  <span className="badge badge-accent">Poster</span>
                ) : (
                  <button
                    type="button"
                    className="btn-copy"
                    onClick={() => void setPoster(item)}
                    disabled={busy !== null}
                  >
                    {busy === item.id ? '…' : 'Set as poster'}
                  </button>
                )}
                {item.id === profileMediaId ? (
                  <span className="badge badge-accent">Profile</span>
                ) : (
                  <button
                    type="button"
                    className="btn-copy"
                    onClick={() => void setProfile(item)}
                    disabled={busy !== null}
                  >
                    {busy === item.id ? '…' : 'Set as profile photo'}
                  </button>
                )}
                <button
                  type="button"
                  className="btn-copy"
                  style={{ color: 'var(--red)' }}
                  onClick={() => void removePhoto(item)}
                  disabled={busy !== null}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 20 }}>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => void onFileChange(e)}
          style={{ display: 'none' }}
          aria-label="Upload a photo"
        />
        <button
          type="button"
          className="btn"
          onClick={() => fileRef.current?.click()}
          disabled={busy !== null || media.length >= maxPhotos}
        >
          {busy === 'upload' || busy === 'photo-compress' ? <span className="spinner" aria-hidden /> : null}
          {busy === 'photo-compress' ? 'Compressing…' : busy === 'upload' ? 'Uploading…' : 'Upload photo'}
        </button>
        <span className="muted small">
          {media.length} of {maxPhotos} photos · JPEG, PNG, or WebP. Big ones are shrunk automatically.
        </span>
        <p className="muted small" style={{ flex: '1 1 100%', margin: 0 }}>
          Gallery photos can be any shape — upload them as they are. For the three spaces above, a
          cover of <strong>1600 × 740</strong> and a profile photo of <strong>400 × 400</strong> fit
          perfectly, but any photo works: pick one and drag it where you want it.
        </p>
      </div>

      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>Videos (optional)</div>
        <p className="muted small" style={{ margin: '0 0 12px' }}>
          Up to {maxVideos} clips, max 60 MB each. Any of them can be the cover — a moving cover really stands out at
          the top of your page. Phones export big files: share/export at 720p, or trim the clip, if one is refused.
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
      </div>
    </div>
  );
}
