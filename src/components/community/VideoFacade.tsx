'use client';

// A video that loads only when pressed. Until then nothing is fetched from
// YouTube or Vimeo — no request, no cookie, no IP address handed over — and
// the page stays light. One tap and the real player appears, already playing.
import { useState } from 'react';

export default function VideoFacade({ url, title, provider }: { url: string; title: string; provider: 'youtube' | 'vimeo' }) {
  const [on, setOn] = useState(false);
  if (on) {
    const src = `${url}${url.includes('?') ? '&' : '?'}autoplay=1`;
    return (
      <div className="event-embed">
        <iframe src={src} title={title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
      </div>
    );
  }
  return (
    <button type="button" className="kl-facade" onClick={() => setOn(true)}>
      <span className="kl-play" aria-hidden="true">
        ▶
      </span>
      <span>
        Play video
        <small>Loads from {provider === 'youtube' ? 'YouTube' : 'Vimeo'} when you press play</small>
      </span>
    </button>
  );
}
