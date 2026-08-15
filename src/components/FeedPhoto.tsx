'use client';

import { useState } from 'react';
import MediaLightbox from './MediaLightbox';

export interface FeedPhotoProps {
  src: string;
  alt: string;
}

/**
 * A photo attached to an update post. It looks exactly like the plain image it
 * replaces — tapping it just opens the same full-screen viewer the gallery
 * uses, with this one photo in it.
 */
export default function FeedPhoto({ src, alt }: FeedPhotoProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="feed-photo-btn"
        onClick={() => setOpen(true)}
        aria-label={`Open ${alt} full screen`}
      >
        {/* Served by our own /api/media route — next/image is not needed here. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} loading="lazy" className="event-post-photo" />
      </button>
      {open && (
        <MediaLightbox
          items={[{ id: 'post-photo', kind: 'photo', src, alt }]}
          index={0}
          onIndex={() => undefined}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
