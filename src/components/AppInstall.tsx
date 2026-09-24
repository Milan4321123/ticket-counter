'use client';

// Registers the service worker (public/sw.js) and, where the browser offers
// it, an "Install the app" button. On iPhone there is no install prompt, so the
// button explains Share → Add to Home Screen instead.
import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function useServiceWorker() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV !== 'production') {
      // In development a worker left over from a production run on the same
      // localhost would serve stale code over hot reload — remove it.
      void navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => void r.unregister()));
      void caches?.keys().then((keys) => keys.filter((k) => k.startsWith('mn-')).forEach((k) => void caches.delete(k)));
      return;
    }
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  }, []);
}

/** Mounted once in the root layout: just the registration. */
export function ServiceWorkerRegistrar() {
  useServiceWorker();
  return null;
}

/** "Install the app" — rendered where it is useful (the seller hub home). */
export default function InstallAppButton({ label = 'Install the app' }: { label?: string }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [help, setHelp] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    setInstalled(standalone);
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (installed || (!deferred && !ios)) return null;

  return (
    <span style={{ display: 'inline-grid', gap: 6 }}>
      <button
        type="button"
        className="btn"
        onClick={async () => {
          if (deferred) {
            await deferred.prompt();
            const choice = await deferred.userChoice.catch(() => null);
            if (choice?.outcome === 'accepted') setInstalled(true);
            setDeferred(null);
          } else {
            setHelp((h) => !h);
          }
        }}
      >
        📲 {label}
      </button>
      {help && (
        <span className="muted small" style={{ maxWidth: 260 }}>
          On iPhone: tap the Share button, then &ldquo;Add to Home Screen&rdquo;.
        </span>
      )}
    </span>
  );
}
