'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { compressImage, compressVideo, formatMb } from '@/components/mediaCompress';
import { onFaqSuggestions } from './faqBridge';

interface MediaOption {
  id: string;
  url: string;
  label: string;
  /** Photos and videos both attach to an update — they just render differently. */
  kind: 'photo' | 'video';
}

interface PostItem {
  id: string;
  body: string;
  mediaId: string | null;
  createdAt: string; // 'YYYY-MM-DD HH:MM:SS' (UTC, from SQLite)
}

interface FaqItem {
  question: string;
  answer: string;
}

interface Props {
  eventId: string;
  media: MediaOption[];
  posts: PostItem[];
  faqs: FaqItem[];
  /** Which half to render — the two live in separate editor tabs. */
  show: 'updates' | 'faq';
  /** The event's gallery caps — an update's upload counts against them too. */
  maxPhotos: number;
  maxVideos: number;
  /** Event or shop — picks the quick-start texts and common questions. */
  kind?: 'event' | 'shop';
}

const MAX_FAQS = 12;

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // keep in sync with lib/media MAX_IMAGE_BYTES
const MAX_VIDEO_BYTES = 60 * 1024 * 1024; // keep in sync with lib/media MAX_VIDEO_BYTES
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const VIDEO_TYPES = ['video/mp4', 'video/webm'];
const ACCEPT_TYPES = [...IMAGE_TYPES, ...VIDEO_TYPES].join(',');

interface UploadResponse {
  ok?: boolean;
  error?: string;
  media?: { id: string; url: string };
}

/**
 * POST one file to an upload route. XMLHttpRequest instead of fetch so the
 * organizer sees real progress — a phone video on hotel wifi takes a while.
 */
function sendFile(
  url: string,
  file: File,
  onProgress: (percent: number) => void
): Promise<{ status: number; body: UploadResponse | null }> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('file', file);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) onProgress(Math.round((ev.loaded / ev.total) * 100));
    };
    xhr.onload = () => {
      let parsed: UploadResponse | null = null;
      try {
        parsed = JSON.parse(xhr.responseText) as UploadResponse;
      } catch {
        parsed = null;
      }
      resolve({ status: xhr.status, body: parsed });
    };
    xhr.onerror = () => reject(new Error('network'));
    xhr.send(form);
  });
}

/** Deterministic date text (UTC) — safe for server + client rendering. */
function postDate(createdAt: string): string {
  const ts = Date.parse(createdAt.replace(' ', 'T') + 'Z');
  if (Number.isNaN(ts)) return createdAt;
  return new Date(ts).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * Organizer-facing page content: update posts (a mini feed shown publicly on
 * the event page) and the FAQ list. Both talk to their own portal routes.
 *
 * `show` picks which half to render. They used to be one long scroll under a
 * single "Updates & FAQ" heading, which buried the update composer — the thing
 * an organizer comes back to weekly — under a form they fill in once. Each half
 * is its own tab now; the component stays one file because they share the
 * upload plumbing and the same busy/error/notice state.
 */
export default function PageContentPanel({
  eventId,
  media,
  posts,
  faqs,
  maxPhotos,
  maxVideos,
  show,
  kind = 'event',
}: Props) {
  const router = useRouter();
  // 'post' | 'faqs' | 'compress' | 'upload' | post id
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // ---- Posts composer ----
  const [draft, setDraft] = useState('');
  const [draftMediaId, setDraftMediaId] = useState('');
  /** Just uploaded from here — previewable before the page data comes back. */
  const [uploaded, setUploaded] = useState<MediaOption | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const draftAttachment = draftMediaId
    ? (media.find((m) => m.id === draftMediaId) ??
      (uploaded && uploaded.id === draftMediaId ? uploaded : undefined))
    : undefined;

  // An update's upload joins the event's gallery, so it lives under the same caps.
  const photoCount = media.filter((m) => m.kind === 'photo').length;
  const videoCount = media.length - photoCount;
  const photosFull = photoCount >= maxPhotos;
  const videosFull = videoCount >= maxVideos;

  // ---- FAQ editor ----
  const [faqRows, setFaqRows] = useState<FaqItem[]>(faqs.length > 0 ? faqs : [{ question: '', answer: '' }]);
  const faqFormRef = useRef<HTMLFormElement>(null);

  /**
   * FAQ entries the organizer accepted in the assistant panel arrive here as
   * ordinary rows — still unsaved, still editable, and still needing Save FAQ.
   * Empty leftover rows are reused so a fresh event does not keep a blank one
   * sitting above the suggestions.
   */
  useEffect(
    () =>
      show !== 'faq'
        ? undefined
        : onFaqSuggestions((incoming) => {
            setFaqRows((prev) => {
              const kept = prev.filter((r) => r.question.trim() !== '' || r.answer.trim() !== '');
              const room = MAX_FAQS - kept.length;
              return room <= 0 ? kept : [...kept, ...incoming.slice(0, room)];
            });
            setError(null);
            setNotice('Suggestions added below — have a last look, then press Save FAQ to put them on your page.');
            faqFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }),
    [show]
  );

  function resetFileInput() {
    if (fileRef.current) fileRef.current.value = '';
  }

  /** Unpin the attachment. The uploaded file itself stays in the gallery. */
  function clearAttachment() {
    setDraftMediaId('');
    setUploaded(null);
  }

  /**
   * One picker for both kinds: photos are shrunk in the browser first, videos
   * are only checked (browsers cannot transcode) and refused with guidance
   * when they are over the cap. Each kind then goes to its own upload route.
   */
  async function onAttachmentPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || busy) return;
    setError(null);
    setNotice(null);

    const isImage = IMAGE_TYPES.includes(file.type);
    const isVideo = VIDEO_TYPES.includes(file.type);
    if (!isImage && !isVideo) {
      // .mov/.avi/.mkv are the common misses. We deliberately do NOT accept
      // them: they refuse to play in Chrome and Firefox, so the update would
      // look broken to most visitors. Say what to do instead of just "no".
      const looksLikeVideo = file.type.startsWith('video/');
      setError(
        looksLikeVideo
          ? 'That video format will not play for everyone, so we cannot use it. Save or export it as MP4 ' +
              '(on an iPhone: Settings › Camera › Formats › Most Compatible, then re-record or re-export), and try again.'
          : 'Pick a JPEG, PNG or WebP photo, or an MP4 or WebM video.'
      );
      resetFileInput();
      return;
    }
    if (isImage && photosFull) {
      setError(
        `You already have ${maxPhotos} photos. Delete one in the Photos & videos tab, then try again — ` +
          'or attach one you have already uploaded.'
      );
      resetFileInput();
      return;
    }
    if (isVideo && videosFull) {
      setError(
        `You already have ${maxVideos} videos. Delete one in the Photos & videos tab, then try again — ` +
          'or attach one you have already uploaded.'
      );
      resetFileInput();
      return;
    }

    let ready = file;
    if (isImage) {
      if (file.size > MAX_IMAGE_BYTES) {
        setBusy('compress');
        ready = await compressImage(file, { maxBytes: MAX_IMAGE_BYTES });
      }
      if (ready.size > MAX_IMAGE_BYTES) {
        setError(
          `This photo is ${formatMb(ready.size)} MB — the limit is ${formatMb(MAX_IMAGE_BYTES)} MB. ` +
            'On your phone, share it at a smaller size (or take a screenshot of it), then try again.'
        );
        setBusy(null);
        resetFileInput();
        return;
      }
    } else {
      setBusy('compress');
      // Nothing is re-encoded here — this either passes the file through or
      // hands back friendly "make it smaller" guidance.
      const checked = await compressVideo(file, { maxBytes: MAX_VIDEO_BYTES });
      if (checked.note) {
        setError(checked.note);
        setBusy(null);
        resetFileInput();
        return;
      }
      ready = checked.file;
    }

    await uploadAttachment(ready, isVideo ? 'video' : 'photo');
  }

  async function uploadAttachment(file: File, kind: 'photo' | 'video') {
    setBusy('upload');
    setProgress(0);
    try {
      const endpoint =
        kind === 'video'
          ? `/api/portal/events/${eventId}/video`
          : `/api/portal/events/${eventId}/media`;
      const { status, body } = await sendFile(endpoint, file, setProgress);
      if (status < 200 || status >= 300 || !body?.media) {
        setError(body?.error ?? `The ${kind} could not be uploaded — please try again.`);
        return;
      }
      setUploaded({
        id: body.media.id,
        url: body.media.url,
        label: kind === 'video' ? 'New video' : 'New photo',
        kind,
      });
      setDraftMediaId(body.media.id);
      setNotice(
        kind === 'video'
          ? 'Video added — write your update and post it.'
          : 'Photo added — write your update and post it.'
      );
      // It also joins the Photos & videos gallery: refresh the counts and picker.
      router.refresh();
    } catch {
      setError('Could not reach the server — please check your connection and try again.');
    } finally {
      setBusy(null);
      setProgress(null);
      resetFileInput();
    }
  }

  async function publishPost(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setNotice(null);
    if (!draft.trim()) {
      setError('Write something first — the update text is empty.');
      return;
    }
    setBusy('post');
    try {
      const res = await fetch(`/api/portal/events/${eventId}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: draft.trim(), ...(draftMediaId ? { mediaId: draftMediaId } : {}) }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok) {
        setError(data?.error ?? 'Something went wrong — please try again.');
        return;
      }
      setDraft('');
      clearAttachment();
      setNotice('Update posted — it is live on your event page.');
      router.refresh();
    } catch {
      setError('Could not reach the server — please check your connection and try again.');
    } finally {
      setBusy(null);
    }
  }

  async function deletePost(post: PostItem) {
    if (busy) return;
    if (!window.confirm('Delete this update? It disappears from your event page right away.')) return;
    setBusy(post.id);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/portal/events/${eventId}/posts`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: post.id }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok) {
        setError(data?.error ?? 'Something went wrong — please try again.');
        return;
      }
      setNotice('Update deleted.');
      router.refresh();
    } catch {
      setError('Could not reach the server — please check your connection and try again.');
    } finally {
      setBusy(null);
    }
  }

  function setFaqField(index: number, field: keyof FaqItem, value: string) {
    setFaqRows((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  }

  function addFaqRow(question = '') {
    setFaqRows((prev) => {
      if (prev.length >= MAX_FAQS) return prev;
      // Fill an empty row first rather than leaving a blank one above.
      const blank = prev.findIndex((r) => !r.question.trim() && !r.answer.trim());
      if (blank >= 0) return prev.map((r, i) => (i === blank ? { question, answer: '' } : r));
      return [...prev, { question, answer: '' }];
    });
  }

  const isShop = kind === 'shop';
  const STARTERS = isShop
    ? ['Fresh batch ready for Saturday! ', 'Only a few left — order now. ', 'New on the menu: ', 'Thank you for all your orders! ']
    : ['Doors open at ', 'Only a few tickets left! ', 'Special guest announced: ', 'Thank you for coming! '];
  const COMMON_QS = isShop
    ? ['Is it vegetarian?', 'How long does it keep?', 'Can I pay cash when I collect?', 'Do you deliver?', 'Can I order for a party?']
    : ['Is there parking?', 'Is there an age limit?', 'Can I buy tickets at the door?', 'Is food available?', 'Is it wheelchair accessible?'];

  function removeFaqRow(index: number) {
    setFaqRows((prev) => prev.filter((_, i) => i !== index));
  }

  async function saveFaqs(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setNotice(null);

    // Fully-empty rows are just leftover editors — quietly drop them.
    const rows = faqRows
      .map((r) => ({ question: r.question.trim(), answer: r.answer.trim() }))
      .filter((r) => r.question !== '' || r.answer !== '');
    for (const row of rows) {
      if (!row.question || !row.answer) {
        setError('Every FAQ needs both a question and an answer — remove unfinished rows or fill them in.');
        return;
      }
    }

    setBusy('faqs');
    try {
      const res = await fetch(`/api/portal/events/${eventId}/faqs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ faqs: rows }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok) {
        setError(data?.error ?? 'Something went wrong — please try again.');
        return;
      }
      setFaqRows(rows.length > 0 ? rows : [{ question: '', answer: '' }]);
      setNotice(rows.length > 0 ? 'FAQ saved — it is live on your event page.' : 'FAQ cleared.');
      router.refresh();
    } catch {
      setError('Could not reach the server — please check your connection and try again.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      {error && <div className="notice notice-error">{error}</div>}
      {!error && notice && <div className="notice notice-success">{notice}</div>}

      {/* ---------------- Updates (posts) ---------------- */}
      {show === 'updates' && (
      <>
      <form onSubmit={publishPost} className="pc-composer">
        <div className="ks-presets" style={{ marginBottom: 8 }}>
          {STARTERS.map((st) => (
            <button
              key={st}
              type="button"
              className="ks-chip ks-chip-sm"
              onClick={() => {
                setDraft((d) => (d.trim() ? d : st));
                document.getElementById('pc-post')?.focus();
              }}
            >
              {st.trim()}
            </button>
          ))}
        </div>
        <div className="field" style={{ margin: 0 }}>
          <textarea
            id="pc-post"
            className="input"
            rows={4}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={2000}
            placeholder={isShop ? 'What is new? e.g. Fresh momo this Saturday…' : 'What is new? e.g. Doors now open at 18:30…'}
            aria-label="New update"
            style={{ resize: 'vertical', fontFamily: 'inherit' }}
          />
        </div>
        {/* Upload straight from the composer — no detour via the media tab. */}
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPT_TYPES}
          onChange={(e) => void onAttachmentPick(e)}
          style={{ display: 'none' }}
          aria-label="Add a photo or a short video to this update"
        />
        <div className="pc-bar">
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => fileRef.current?.click()}
            disabled={busy !== null || (photosFull && videosFull)}
          >
            {busy === 'upload' || busy === 'compress' ? <span className="spinner" aria-hidden /> : null}
            {busy === 'compress'
              ? 'Getting it ready…'
              : busy === 'upload'
                ? progress !== null
                  ? `Uploading… ${progress}%`
                  : 'Uploading…'
                : '📷 Photo / video'}
          </button>
          {media.length > 0 && (
            <select
              className="input pc-pick"
              aria-label="Attach something you already uploaded"
              value={draftMediaId}
              onChange={(e) => setDraftMediaId(e.target.value)}
            >
              <option value="">…or one you uploaded</option>
              {media.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          )}
          <span style={{ flex: 1 }} />
          <button type="submit" className="btn btn-brand btn-sm" disabled={busy !== null || !draft.trim()}>
            {busy === 'post' ? <span className="spinner" aria-hidden /> : null}
            {busy === 'post' ? 'Posting…' : 'Post'}
          </button>
        </div>

        {busy === 'upload' && progress !== null && (
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
                width: `${progress}%`,
                height: '100%',
                background: 'var(--accent)',
                transition: 'width 0.2s ease',
              }}
            />
          </div>
        )}

        {(photosFull || videosFull) && (
          <p className="muted small" style={{ margin: '8px 0 0' }}>
            {photosFull && videosFull
              ? `You are at ${maxPhotos} photos and ${maxVideos} videos — delete one in the Photos & videos tab to upload more. You can still attach anything already uploaded.`
              : photosFull
                ? `You are at ${maxPhotos} photos — videos can still be uploaded. Delete a photo in the Photos & videos tab to add another.`
                : `You are at ${maxVideos} videos — photos can still be uploaded. Delete a video in the Photos & videos tab to add another.`}
          </p>
        )}

        {/* What the chosen attachment actually looks like. */}
        {draftAttachment && (
          <div style={{ marginTop: 10 }}>
            {draftAttachment.kind === 'video' ? (
              <video
                src={draftAttachment.url}
                controls
                muted
                preload="metadata"
                playsInline
                style={{
                  width: '100%',
                  maxWidth: 240,
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: '#000',
                  display: 'block',
                }}
              />
            ) : (
              // Served by our own /api/media route — next/image is not needed here.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={draftAttachment.url}
                alt=""
                style={{
                  width: '100%',
                  maxWidth: 240,
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  display: 'block',
                }}
              />
            )}
            <div
              style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 6 }}
            >
              <span className="muted small">{draftAttachment.label} will be attached to this update.</span>
              <button
                type="button"
                className="btn-copy"
                style={{ color: 'var(--red)' }}
                onClick={clearAttachment}
                disabled={busy !== null}
              >
                Remove
              </button>
            </div>
            <p className="muted small" style={{ margin: '4px 0 0' }}>
              Removing it here only takes it off this update — the file stays in Photos &amp; videos.
            </p>
          </div>
        )}

      </form>

      {posts.length > 0 && (
        <div style={{ marginTop: 16, display: 'grid', gap: 10 }}>
          {posts.map((post) => {
            const attached = post.mediaId ? media.find((m) => m.id === post.mediaId) : undefined;
            return (
              <div
                key={post.id}
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  background: 'var(--bg-elevated)',
                  padding: '12px 14px',
                  display: 'flex',
                  gap: 12,
                  alignItems: 'flex-start',
                }}
              >
                {attached &&
                  (attached.kind === 'video' ? (
                    <video
                      src={attached.url}
                      muted
                      preload="metadata"
                      playsInline
                      style={{
                        width: 56,
                        height: 56,
                        objectFit: 'cover',
                        borderRadius: 8,
                        flex: 'none',
                        background: '#000',
                      }}
                    />
                  ) : (
                    // Served by our own /api/media route — next/image is not needed here.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={attached.url}
                      alt=""
                      style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8, flex: 'none' }}
                    />
                  ))}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="muted small">{postDate(post.createdAt)}</div>
                  <p style={{ margin: '2px 0 0', whiteSpace: 'pre-line' }}>{post.body}</p>
                </div>
                <button
                  type="button"
                  className="btn-copy"
                  style={{ color: 'var(--red)', flex: 'none' }}
                  onClick={() => void deletePost(post)}
                  disabled={busy !== null}
                >
                  {busy === post.id ? '…' : 'Delete'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      </>
      )}

      {/* ---------------- FAQ ---------------- */}
      {show === 'faq' && (
      <form ref={faqFormRef} onSubmit={saveFaqs} className="pc-faq">
        <div className="ks-presets" style={{ marginBottom: 10 }}>
          <span className="muted small">Tap to add:</span>
          {COMMON_QS.filter((q) => !faqRows.some((r) => r.question.trim().toLowerCase() === q.toLowerCase())).map((q) => (
            <button
              key={q}
              type="button"
              className="ks-chip ks-chip-sm"
              disabled={busy !== null || faqRows.filter((r) => r.question.trim()).length >= MAX_FAQS}
              onClick={() => addFaqRow(q)}
            >
              + {q}
            </button>
          ))}
        </div>

        {faqRows.map((row, i) => (
          <div key={i} className="pc-faq-row">
            <button
              type="button"
              className="pc-faq-x"
              aria-label={`Remove question ${i + 1}`}
              onClick={() => removeFaqRow(i)}
              disabled={busy !== null}
            >
              ✕
            </button>
            <div className="field" style={{ margin: 0 }}>
              <input
                aria-label={`Question ${i + 1}`}
                id={`pc-faq-q-${i}`}
                className="input"
                value={row.question}
                onChange={(e) => setFaqField(i, 'question', e.target.value)}
                maxLength={200}
                placeholder="Question, e.g. Is there an age limit?"
              />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <textarea
                aria-label={`Answer ${i + 1}`}
                id={`pc-faq-a-${i}`}
                className="input"
                rows={2}
                value={row.answer}
                onChange={(e) => setFaqField(i, 'answer', e.target.value)}
                maxLength={1000}
                placeholder="Answer — short and friendly."
                style={{ resize: 'vertical', fontFamily: 'inherit' }}
              />
            </div>
          </div>
        ))}

        <div className="ks-save">
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => addFaqRow()}
            disabled={busy !== null || faqRows.length >= MAX_FAQS}
          >
            + Add a question
          </button>
          <button type="submit" className="btn btn-brand" disabled={busy !== null}>
            {busy === 'faqs' ? <span className="spinner" aria-hidden /> : null}
            {busy === 'faqs' ? 'Saving…' : 'Save FAQ'}
          </button>
        </div>
      </form>
      )}
    </div>
  );
}
