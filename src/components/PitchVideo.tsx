'use client';

// The pitch video (public/media/pitch.mp4): the real app, a finger
// tapping through setting up a shop, getting orders and paid.
//
//   · "inline" — a phone-shaped player that plays silently on a loop while it
//     is on screen (as a feed does) and restarts WITH sound on one tap.
//   · "button" — a small "▶ How it works" chip that opens it full screen,
//     with sound, for pages that should stay uncluttered (the demo home).
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const SRC = '/media/pitch.mp4';
const POSTER = '/media/pitch-poster.jpg';

export default function PitchVideo({ variant = 'inline', caption }: { variant?: 'inline' | 'button'; caption?: string }) {
  return variant === 'button' ? <PitchButton /> : <PitchInline caption={caption} />;
}

function PitchInline({ caption }: { caption?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [sound, setSound] = useState(false);

  // Play only while visible — a looping video off screen is battery for nothing.
  useEffect(() => {
    const v = ref.current;
    if (!v || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) void v.play().catch(() => {});
        else v.pause();
      },
      { threshold: 0.35 }
    );
    io.observe(v);
    return () => io.disconnect();
  }, []);

  return (
    <figure className="pv">
      <div className="pv-phone">
        <video
          ref={ref}
          className="pv-video"
          src={SRC}
          poster={POSTER}
          muted={!sound}
          loop={!sound}
          playsInline
          preload="metadata"
          controls={sound}
          aria-label="A short video of the app: setting up a shop with the AI helper, getting orders and getting paid"
        />
        {!sound && (
          <button
            type="button"
            className="pv-sound"
            onClick={() => {
              const v = ref.current;
              setSound(true);
              if (v) {
                v.muted = false;
                v.currentTime = 0;
                void v.play().catch(() => {});
              }
            }}
          >
            🔊 Tap for sound
          </button>
        )}
      </div>
      {caption && <figcaption className="pv-cap">{caption}</figcaption>}
    </figure>
  );
}

function PitchButton() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <button type="button" className="pv-chip" onClick={() => setOpen(true)}>
        <span className="pv-chip-play" aria-hidden="true">
          ▶
        </span>
        How it works <span className="pv-chip-len">1:20</span>
      </button>
      {open &&
        createPortal(
          <div className="pv-modal" role="dialog" aria-modal="true" aria-label="How it works" onClick={() => setOpen(false)}>
            <div className="pv-modal-box" onClick={(e) => e.stopPropagation()}>
              <button type="button" className="pv-x" aria-label="Close" onClick={() => setOpen(false)}>
                ✕
              </button>
              {/* Opened by a tap, so it may play with sound straight away. */}
              <video className="pv-video" src={SRC} poster={POSTER} autoPlay controls playsInline />
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
