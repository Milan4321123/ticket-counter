'use client';

import { useRef, useState } from 'react';
import { paypalLinkFor } from '@/lib/paypalLink';

/**
 * "I only have the QR code from my PayPal app." The organizer picks the
 * screenshot, and the link inside it is read HERE, in the browser, with jsQR
 * (the door scanner's reader). The picture itself is never uploaded: only the
 * link goes into the PayPal field, and the buyer's page draws its own QR from
 * it. Nothing to store, and no image work on the server.
 */
export default function PaypalQrUpload({ onFound }: { onFound: (link: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function read(file: File) {
    setBusy(true);
    setError(null);
    try {
      const text = await decodeQr(file);
      if (!text) {
        setError('No QR code found in that picture. Try a screenshot where the code is sharp and not cut off.');
        return;
      }
      const link = paypalLinkFor(text);
      if (!link) {
        setError('That QR code is not a PayPal one. In the PayPal app, open the QR code screen and take a screenshot of “Your code”.');
        return;
      }
      onFound(link);
    } catch {
      setError('That picture could not be opened. Try a PNG or JPEG screenshot.');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  return (
    <div style={{ marginTop: 8 }}>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void read(file);
        }}
      />
      <button type="button" className="btn btn-sm" disabled={busy} onClick={() => input.current?.click()}>
        {busy ? 'Reading…' : '📷 Use a screenshot of my PayPal QR code'}
      </button>
      {error ? (
        <p className="small" style={{ margin: '6px 0 0', color: 'var(--red)' }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** The text in the first QR code jsQR finds, or null. Tries a couple of sizes. */
async function decodeQr(file: File): Promise<string | null> {
  const { default: jsQR } = await import('jsqr');
  const bitmap = await createImageBitmap(file);
  try {
    for (const maxEdge of [1600, 800]) {
      const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
      const w = Math.max(1, Math.round(bitmap.width * scale));
      const h = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return null;
      ctx.drawImage(bitmap, 0, 0, w, h);
      const hit = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'attemptBoth' });
      if (hit?.data) return hit.data.trim();
    }
    return null;
  } finally {
    bitmap.close();
  }
}
