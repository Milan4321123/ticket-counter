'use client';

import { useRef, useState } from 'react';

/**
 * Choose which part of the photo sits in a round bubble, by SEEING it.
 *
 * Shared by the platform's own contact bubble (admin) and each organizer's
 * WhatsApp bubble (portal). Both are the same problem — a circle showing part of
 * a rectangle — so both get the same control rather than two that drift.
 *
 * The first version was two sliders and a small preview. That tells you the
 * numbers and shows you the result, but never the relationship between them —
 * you cannot see how much of the photo is being left out, or which way to push
 * to bring a face in. Framing a picture is a spatial job and it needs a spatial
 * control.
 *
 * So this shows the WHOLE photo, dimmed, with a bright circle over the part
 * that will actually appear. Drag the circle where you want it. What is inside
 * the ring is exactly what the bubble shows — same maths, not an approximation:
 *
 *   the bubble is a circle with object-fit: cover, so the visible region of the
 *   source is the largest SQUARE that fits inside it, and object-position
 *   slides that square across the leftover axis. The ring below is that square,
 *   drawn on the photo at display scale.
 */
export default function ContactPhotoFramer({
  photoUrl,
  fx,
  fy,
  onChange,
}: {
  photoUrl: string;
  fx: number;
  fy: number;
  onChange: (fx: number, fy: number) => void;
}) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const dragging = useRef(false);

  // The displayed photo's box. Until it has loaded there is nothing to frame.
  const w = size?.w ?? 0;
  const h = size?.h ?? 0;
  const side = Math.min(w, h); // the square the circle is inscribed in
  const left = ((w - side) * fx) / 100;
  const top = ((h - side) * fy) / 100;

  /** Turn a pointer position into the focus percentages it implies. */
  function moveTo(clientX: number, clientY: number) {
    const box = boxRef.current?.getBoundingClientRect();
    if (!box || !size) return;
    const freeX = size.w - side;
    const freeY = size.h - side;
    // Centre the ring on the pointer, then clamp so it cannot leave the photo.
    const nx = freeX > 0 ? ((clientX - box.left - side / 2) / freeX) * 100 : 50;
    const ny = freeY > 0 ? ((clientY - box.top - side / 2) / freeY) * 100 : 50;
    onChange(
      Math.max(0, Math.min(100, Math.round(nx))),
      Math.max(0, Math.min(100, Math.round(ny)))
    );
  }

  return (
    <div>
      <div
        ref={boxRef}
        onPointerDown={(e) => {
          dragging.current = true;
          (e.target as Element).setPointerCapture?.(e.pointerId);
          moveTo(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (dragging.current) moveTo(e.clientX, e.clientY);
        }}
        onPointerUp={() => {
          dragging.current = false;
        }}
        style={{
          position: 'relative',
          display: 'inline-block',
          lineHeight: 0,
          cursor: 'grab',
          touchAction: 'none', // let a finger drag the ring, not scroll the page
          borderRadius: 12,
          overflow: 'hidden',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photoUrl}
          alt="Your photo, with the part that will be shown"
          style={{ display: 'block', maxWidth: 260, maxHeight: 260, userSelect: 'none' }}
          draggable={false}
          onLoad={(e) => {
            const el = e.currentTarget;
            setSize({ w: el.clientWidth, h: el.clientHeight });
          }}
        />

        {size ? (
          <>
            {/* Everything OUTSIDE the ring, dimmed. A ring alone reads as
                decoration; darkening the rest is what makes it obvious that the
                dark part is the bit being thrown away. */}
            <div
              aria-hidden
              style={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(0,0,0,0.55)',
                // A circular hole punched through the dimming.
                WebkitMaskImage: `radial-gradient(circle ${side / 2}px at ${left + side / 2}px ${top + side / 2}px, transparent 99%, #000 100%)`,
                maskImage: `radial-gradient(circle ${side / 2}px at ${left + side / 2}px ${top + side / 2}px, transparent 99%, #000 100%)`,
                pointerEvents: 'none',
              }}
            />
            <div
              aria-hidden
              style={{
                position: 'absolute',
                left,
                top,
                width: side,
                height: side,
                borderRadius: '50%',
                border: '2px solid var(--brand, #e11d48)',
                boxShadow: '0 0 0 1px rgba(0,0,0,0.5)',
                pointerEvents: 'none',
              }}
            />
          </>
        ) : null}
      </div>

      <p className="muted small" style={{ margin: '8px 0 0' }}>
        Drag the circle over your face — whatever is inside the ring is exactly what visitors
        see. The darkened part is left out.
      </p>
    </div>
  );
}
