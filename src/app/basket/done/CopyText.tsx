'use client';

// One payment detail with a copy button — IBANs and references are exactly
// the things people mistype.
import { useState } from 'react';

export default function CopyText({ label, value, mono, strong }: { label: string; value: string; mono?: boolean; strong?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="bk-copy">
      <span className="bk-copy-label">{label}</span>
      <span className={`bk-copy-value${mono ? ' mono' : ''}${strong ? ' is-strong' : ''}`}>{value}</span>
      <button
        type="button"
        className="bk-copy-btn"
        onClick={() => {
          void navigator.clipboard?.writeText(value).then(() => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
          });
        }}
        aria-label={`Copy ${label}`}
      >
        {copied ? '✓' : 'Copy'}
      </button>
    </div>
  );
}
