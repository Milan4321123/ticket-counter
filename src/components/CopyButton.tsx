'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Small "Copy" button for payment details (IBAN, reference, amount).
 * Uses the async clipboard API with a hidden-textarea fallback for older
 * browsers / non-secure contexts. Shows a brief "Copied" confirmation.
 */
export default function CopyButton({ value, label = 'Copy' }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function copyWithFallback(): boolean {
    try {
      const ta = document.createElement('textarea');
      ta.value = value;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }

  async function handleCopy() {
    let ok = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        ok = true;
      }
    } catch {
      // Clipboard API blocked — try the legacy fallback below.
    }
    if (!ok) ok = copyWithFallback();
    if (ok) {
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 1600);
    }
  }

  return (
    <button
      type="button"
      className={copied ? 'btn-copy copied' : 'btn-copy'}
      onClick={handleCopy}
      aria-label={copied ? 'Copied to clipboard' : label === 'Copy' ? 'Copy to clipboard' : label}
      aria-live="polite"
    >
      {copied ? 'Copied' : label}
    </button>
  );
}
