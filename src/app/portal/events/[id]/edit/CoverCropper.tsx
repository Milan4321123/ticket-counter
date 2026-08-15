'use client';

// Repositioning tool for the slots that are a FIXED SHAPE on the public site:
// the cover, the round profile photo, the listing poster.
//
// Those frames are always completely filled, so part of any photo that is not
// exactly that shape is cut away. Nothing important needs to be lost to that —
// the organizer says which part stays, by dragging the photo inside a frame of
// the real shape and zooming in. What they see inside the frame here is exactly
// the rectangle the server extracts (lib/imageVariants), so the preview is not
// an impression of the result, it IS the result.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { CropRect } from '@/lib/events';
import { saveEvent } from './save';

interface Props {
  eventId: string;
  /** The photo being framed. Parents pass this as `key` too, so switching photos starts clean. */
  mediaId: string;
  /** Event field this frame writes to. */
  field: 'coverCrop' | 'profileCrop' | 'posterCrop';
  /** The rendered shape this slot serves — used for the automatic preview. */
  variant: 'cover' | 'avatar' | 'card';
  /** Frame proportions (width / height). MUST match the variant's own. */
  aspect: number;
  label: string;
  /** One plain sentence: what this photo is for, and the size that suits it. */
  hint: string;
  /** The framing already saved for this slot, or null for automatic. */
  saved: CropRect | null;
  /** Profile photos are round on the page, so the frame is round here too. */
  round?: boolean;
  /** Cap on the frame's width — a 2.17:1 cover would otherwise dominate the panel. */
  maxWidth?: number;
}

const MAX_ZOOM = 3;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * The biggest rectangle of the frame's shape that fits inside this photo — the
 * whole picture at zoom 1, with only the overflow on one axis given up.
 */
function maxRect(imageAspect: number, aspect: number): { w: number; h: number } {
  if (imageAspect > aspect) return { w: aspect / imageAspect, h: 1 };
  return { w: 1, h: imageAspect / aspect };
}

/**
 * Put a rectangle of this size around a centre point, pushed back inside the
 * photo if it would hang over an edge. This is the whole "no gap can ever
 * appear in the frame" rule: the visible rectangle is not allowed to leave the
 * image, at any zoom, from a drag or from zooming back out.
 */
function place(cx: number, cy: number, w: number, h: number): CropRect {
  return {
    x: clamp(cx - w / 2, 0, Math.max(0, 1 - w)),
    y: clamp(cy - h / 2, 0, Math.max(0, 1 - h)),
    w,
    h,
  };
}

/** Four decimals is ~0.5px on a 4000px photo, and keeps the stored JSON short. */
function round4(rect: CropRect): CropRect {
  return {
    x: Number(rect.x.toFixed(4)),
    y: Number(rect.y.toFixed(4)),
    w: Number(rect.w.toFixed(4)),
    h: Number(rect.h.toFixed(4)),
  };
}

export default function CoverCropper({
  eventId,
  mediaId,
  field,
  variant,
  aspect,
  label,
  hint,
  saved,
  round = false,
  maxWidth,
}: Props) {
  const router = useRouter();
  const frameRef = useRef<HTMLDivElement>(null);
  // Pointer id + where the drag started, in one object: a drag is either fully
  // in progress or not at all, and splitting it across state let a stray
  // pointermove act on half a gesture.
  const dragRef = useRef<{ pointerId: number; x: number; y: number; rect: CropRect } | null>(null);

  const [manual, setManual] = useState(saved !== null);
  const [rect, setRect] = useState<CropRect | null>(saved);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [frameWidth, setFrameWidth] = useState(0);
  const [busy, setBusy] = useState<'save' | 'reset' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveNote, setSaveNote] = useState<string | null>(null);

  // The frame's rendered width drives the drag maths (pixels -> fractions), and
  // it changes with the panel, the window, and phone rotation.
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const measure = () => setFrameWidth(el.getBoundingClientRect().width);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [manual]);

  /**
   * The photo's own pixel dimensions, which every rectangle here is a fraction
   * of. Read from the element rather than waited for: this same photo is
   * already on screen in the gallery above, so by the time the organizer
   * presses Reposition the browser usually has it cached and finishes it before
   * React can attach a load listener — and a `load` that never fires left the
   * tool showing the photo at full size and refusing to be dragged.
   */
  const noteNatural = useCallback((el: HTMLImageElement | null) => {
    if (!el || !el.complete || !el.naturalWidth || !el.naturalHeight) return;
    setNatural((current) =>
      current && current.w === el.naturalWidth && current.h === el.naturalHeight
        ? current
        : { w: el.naturalWidth, h: el.naturalHeight }
    );
  }, []);

  const limits = natural ? maxRect(natural.w / natural.h, aspect) : null;

  // Entering manual mode with nothing saved: start from the whole photo,
  // centred. Also the repair path for a stored rectangle that no longer fits
  // the photo (it was replaced, or the slot's shape changed).
  useEffect(() => {
    if (!manual || !limits) return;
    setRect((current) => {
      if (current && current.w <= limits.w + 0.001 && current.h <= limits.h + 0.001) return current;
      return place(0.5, 0.5, limits.w, limits.h);
    });
  }, [manual, limits?.w, limits?.h]); // eslint-disable-line react-hooks/exhaustive-deps

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!rect || busy) return;
      dragRef.current = { pointerId: e.pointerId, x: e.clientX, y: e.clientY, rect };
      // Capture, so a finger or cursor that leaves the frame mid-drag keeps
      // driving it instead of the photo sticking halfway. Best effort: browsers
      // throw here for a pointer they no longer consider active, and losing the
      // capture only costs the part of the drag that leaves the frame — it must
      // never take the whole gesture down with it.
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Drag on without capture.
      }
    },
    [rect, busy]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== e.pointerId || !frameWidth) return;
      const frameHeight = frameWidth / aspect;
      // Dragging the photo right shows more of its LEFT side, so the visible
      // rectangle moves the opposite way to the pointer.
      const nextX = drag.rect.x - ((e.clientX - drag.x) * drag.rect.w) / frameWidth;
      const nextY = drag.rect.y - ((e.clientY - drag.y) * drag.rect.h) / frameHeight;
      setRect({
        x: clamp(nextX, 0, Math.max(0, 1 - drag.rect.w)),
        y: clamp(nextY, 0, Math.max(0, 1 - drag.rect.h)),
        w: drag.rect.w,
        h: drag.rect.h,
      });
      setSaveNote(null);
    },
    [frameWidth, aspect]
  );

  const endDrag = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== e.pointerId) return;
    dragRef.current = null;
  }, []);

  function onZoom(value: number) {
    if (!rect || !limits) return;
    const zoom = clamp(value, 1, MAX_ZOOM);
    // Zoom about the middle of what is on screen, so the subject the organizer
    // just centred stays centred.
    setRect(place(rect.x + rect.w / 2, rect.y + rect.h / 2, limits.w / zoom, limits.h / zoom));
    setSaveNote(null);
  }

  async function save() {
    if (!rect || busy) return;
    setBusy('save');
    setError(null);
    setSaveNote(null);
    const result = await saveEvent(eventId, { [field]: round4(rect) });
    setBusy(null);
    if (!result.ok) {
      setError(result.error ?? 'Something went wrong — please try again.');
      return;
    }
    setSaveNote('Saved — this is what people will see.');
    router.refresh();
  }

  async function reset() {
    if (busy) return;
    setBusy('reset');
    setError(null);
    setSaveNote(null);
    const result = await saveEvent(eventId, { [field]: null });
    setBusy(null);
    if (!result.ok) {
      setError(result.error ?? 'Something went wrong — please try again.');
      return;
    }
    setRect(null);
    setManual(false);
    setNatural(null);
    router.refresh();
  }

  const frameStyle: React.CSSProperties = {
    position: 'relative',
    width: '100%',
    aspectRatio: String(aspect),
    overflow: 'hidden',
    borderRadius: round ? '50%' : 10,
    // An INSET shadow, not a border: a border sits inside the element's own
    // box, so the frame's content area would be 2px narrower than the box we
    // measure and give the photo the wrong shape by half a percent. This draws
    // the same hairline and takes up no space at all.
    boxShadow: 'inset 0 0 0 1px var(--border)',
    background: 'var(--bg-elevated)',
    // Without this a touch drag scrolls the page instead of moving the photo.
    touchAction: 'none',
    cursor: manual && rect ? 'grab' : 'default',
    userSelect: 'none',
  };

  // The photo, scaled and offset so that exactly `rect` fills the frame — the
  // browser's version of the server's extract-then-resize.
  const imageStyle: React.CSSProperties | undefined =
    rect && frameWidth
      ? {
          position: 'absolute',
          left: -(rect.x / rect.w) * frameWidth,
          top: -(rect.y / rect.h) * (frameWidth / aspect),
          width: frameWidth / rect.w,
          height: frameWidth / aspect / rect.h,
          maxWidth: 'none',
          display: 'block',
          pointerEvents: 'none',
        }
      : undefined;

  const zoom = rect && limits ? limits.w / rect.w : 1;

  const width = maxWidth ?? 260;

  return (
    <div style={{ flex: `1 1 ${width}px`, maxWidth: width, minWidth: 0 }}>
      <div style={{ fontWeight: 600, marginBottom: 2 }}>{label}</div>
      <p className="muted small" style={{ margin: '0 0 8px' }}>
        {hint}
      </p>

      <div
        ref={frameRef}
        style={frameStyle}
        onPointerDown={manual ? onPointerDown : undefined}
        onPointerMove={manual ? onPointerMove : undefined}
        onPointerUp={manual ? endDrag : undefined}
        onPointerCancel={manual ? endDrag : undefined}
      >
        {manual ? (
          /* The ORIGINAL photo, not a rendered variant: the organizer has to be
             able to reach every part of it, including the parts a variant
             already cropped away. */
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={`/api/media/${mediaId}`}
            alt={`Drag to choose the part of this photo shown as your ${label.toLowerCase()}`}
            draggable={false}
            ref={noteNatural}
            onLoad={(e) => noteNatural(e.currentTarget)}
            style={imageStyle ?? { opacity: 0 }}
          />
        ) : (
          /* Automatic: show the very copy the site serves, so "as people will
             see it" stays true before anyone has repositioned anything. */
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={`/api/media/${mediaId}?v=${variant}`}
            alt={`Your ${label.toLowerCase()}, as people will see it`}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
            }}
          />
        )}
      </div>

      {manual ? (
        <div style={{ marginTop: 10 }}>
          <label
            htmlFor={`zoom-${field}`}
            className="muted small"
            style={{ display: 'block', marginBottom: 2 }}
          >
            Drag the photo to move it. Zoom in to fill more of the frame.
          </label>
          <input
            id={`zoom-${field}`}
            type="range"
            min={1}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            disabled={!rect || busy !== null}
            onChange={(e) => onZoom(Number(e.target.value))}
            style={{ width: '100%', height: 44, accentColor: 'var(--accent)' }}
          />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              type="button"
              className="btn btn-sm btn-primary"
              style={{ minHeight: 44 }}
              onClick={() => void save()}
              disabled={!rect || busy !== null}
            >
              {busy === 'save' ? 'Saving…' : 'Save framing'}
            </button>
            <button
              type="button"
              className="btn btn-sm"
              style={{ minHeight: 44 }}
              onClick={() => void reset()}
              disabled={busy !== null}
            >
              {busy === 'reset' ? 'Resetting…' : 'Reset'}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="btn btn-sm"
          style={{ marginTop: 10, minHeight: 44 }}
          onClick={() => setManual(true)}
        >
          Reposition
        </button>
      )}

      {error && (
        <p className="small" style={{ color: 'var(--red)', margin: '8px 0 0' }}>
          {error}
        </p>
      )}
      {!error && saveNote && (
        <p className="muted small" style={{ margin: '8px 0 0' }}>
          {saveNote}
        </p>
      )}
    </div>
  );
}
