'use client';

// The installable app, on phones as well as laptops.
//
// Three pieces, all reading the same detection:
//   · ServiceWorkerRegistrar — root layout; registers public/sw.js.
//   · InstallNudge — root layout; on a PHONE, a small sheet offers the app
//     once (again only after 14 days if dismissed). Android Chrome gets the
//     real install prompt; everything else gets the exact taps for that
//     browser, because iPhones have no install prompt at all.
//   · InstallAppButton / InstallFooterLink — a button that always works: the
//     prompt where there is one, the same how-to sheet everywhere else.
//
// Why the how-to is browser-specific: "Add to Home Screen" lives in a
// different place in Safari, in Chrome/Edge/Firefox on iPhone, in Samsung
// Internet and in Firefox on Android — and it does not exist at all inside
// Instagram, Facebook or TikTok's in-app browser, which is exactly where most
// people first open an event link. There the only useful advice is "open this
// in your browser first".
import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import { readConsent, subscribeConsent } from '@/lib/consent';
import { isPrivatePath } from '@/lib/analyticsScope';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

declare global {
  interface Window {
    __mnInstallPrompt?: BeforeInstallPromptEvent | null;
  }
}

/** Fired on window when the early catcher (INSTALL_PROMPT_CATCHER) stashes a prompt. */
const PROMPT_EVENT = 'mn-installprompt';

/**
 * Inlined at the top of <body> by the root layout. Chrome fires
 * `beforeinstallprompt` once per page load and often BEFORE React has
 * hydrated, so a listener added in an effect can simply miss it — which is
 * why the old button so often never appeared on Android.
 */
export const INSTALL_PROMPT_CATCHER = `window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__mnInstallPrompt=e;window.dispatchEvent(new Event('${PROMPT_EVENT}'))});window.addEventListener('appinstalled',function(){window.__mnInstallPrompt=null});`;

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

/**
 * On sign-out: delete every page the service worker kept (offline tickets),
 * leaving only the static assets. Done from the page AND by the worker (it
 * also does this itself when it sees the sign-out POST, public/sw.js), because
 * a page can be open without the worker controlling it. Never throws.
 */
export async function forgetPersonalCaches(): Promise<void> {
  try {
    navigator.serviceWorker?.controller?.postMessage({ type: 'mn:forget-personal' });
  } catch {
    /* no worker */
  }
  try {
    const keys = (await globalThis.caches?.keys()) ?? [];
    await Promise.all(
      keys.filter((k) => k.startsWith('mn-') && !k.endsWith('-static')).map((k) => caches.delete(k))
    );
  } catch {
    /* no Cache Storage (private mode, old browser) — nothing was kept */
  }
}

// ---------------------------------------------------------------------------
// Where are we?

type Where =
  | 'ios-safari' // Share (or ••• → Share) → Add to Home Screen
  | 'ios-browser' // Chrome / Edge / Firefox on iPhone: share icon in the address bar
  | 'ios-inapp' // Instagram, Facebook, TikTok… no Add to Home Screen at all
  | 'android-inapp'
  | 'android-samsung'
  | 'android-firefox'
  | 'android-chrome' // Chrome/Edge/Opera on Android without a prompt (yet)
  | 'desktop';

function detect(): { where: Where; phone: boolean; standalone: boolean } {
  const ua = navigator.userAgent;
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  // iPadOS reports itself as a Mac; the touch points give it away.
  const ios = /iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const android = /android/i.test(ua);
  const inApp = /FBAN|FBAV|FB_IAB|Instagram|Line\/|musical_ly|Bytedance|TikTok|Snapchat|Pinterest|LinkedInApp|GSA\//i.test(ua);
  let where: Where = 'desktop';
  if (ios) where = inApp ? 'ios-inapp' : /CriOS|EdgiOS|FxiOS|OPiOS/.test(ua) ? 'ios-browser' : 'ios-safari';
  else if (android) {
    if (inApp || /; wv\)/.test(ua)) where = 'android-inapp';
    else if (/SamsungBrowser/i.test(ua)) where = 'android-samsung';
    else if (/Firefox/i.test(ua)) where = 'android-firefox';
    else where = 'android-chrome';
  }
  const phone = ios || android || window.matchMedia('(pointer: coarse) and (max-width: 820px)').matches;
  return { where, phone, standalone };
}

function useInstall() {
  const [state, setState] = useState<{ where: Where; phone: boolean; standalone: boolean } | null>(null);
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    setState(detect());
    const pick = () => setPrompt(window.__mnInstallPrompt ?? null);
    pick();
    const onInstalled = () => {
      setPrompt(null);
      setState((s) => (s ? { ...s, standalone: true } : s));
    };
    window.addEventListener(PROMPT_EVENT, pick);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener(PROMPT_EVENT, pick);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  /** Shows the browser's own prompt. Resolves true if it was shown. */
  async function runPrompt(): Promise<'accepted' | 'dismissed' | 'none'> {
    if (!prompt) return 'none';
    await prompt.prompt().catch(() => undefined);
    const choice = await prompt.userChoice.catch(() => null);
    // A prompt can only be used once.
    window.__mnInstallPrompt = null;
    setPrompt(null);
    if (choice?.outcome === 'accepted') setState((s) => (s ? { ...s, standalone: true } : s));
    return choice?.outcome ?? 'dismissed';
  }

  return { state, canPrompt: Boolean(prompt), runPrompt };
}

// ---------------------------------------------------------------------------
// The how-to

function ShareIcon() {
  return (
    <svg className="ai-glyph" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3v12M7.5 7.5 12 3l4.5 4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 11H6a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function AddIcon() {
  return (
    <svg className="ai-glyph" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="4" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M12 8.5v7M8.5 12h7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

const K = ({ children }: { children: ReactNode }) => <span className="ai-key">{children}</span>;

function steps(where: Where): { lead?: string; list: ReactNode[] } {
  switch (where) {
    case 'ios-safari':
      return {
        list: [
          <>
            Tap <K><ShareIcon /> Share</K> — at the bottom of Safari, or inside the <K>•••</K> menu.
          </>,
          <>
            Scroll down and tap <K><AddIcon /> Add to Home Screen</K>.
          </>,
          <>
            Tap <K>Add</K>. The app is on your home screen.
          </>,
        ],
      };
    case 'ios-browser':
      return {
        list: [
          <>
            Tap <K><ShareIcon /></K> in the address bar (in Firefox: the <K>☰</K> menu → Share).
          </>,
          <>
            Tap <K><AddIcon /> Add to Home Screen</K> (you may need “More” or “View more”).
          </>,
          <>
            Tap <K>Add</K>.
          </>,
        ],
      };
    case 'ios-inapp':
      return {
        lead: 'You are inside another app’s browser, which cannot add apps to your home screen.',
        list: [
          <>
            Tap <K>•••</K> (top or bottom corner) → <K>Open in Safari</K> or <K>Open in browser</K>.
          </>,
          <>
            In Safari, tap <K><ShareIcon /> Share</K> → <K><AddIcon /> Add to Home Screen</K>.
          </>,
        ],
      };
    case 'android-inapp':
      return {
        lead: 'You are inside another app’s browser, which cannot install apps.',
        list: [
          <>
            Tap <K>⋮</K> (top corner) → <K>Open in Chrome</K> or <K>Open in browser</K>.
          </>,
          <>
            In Chrome, tap <K>⋮</K> → <K>Install app</K> or <K>Add to Home screen</K>.
          </>,
        ],
      };
    case 'android-samsung':
      return {
        list: [
          <>
            Tap the <K>☰</K> menu at the bottom.
          </>,
          <>
            Tap <K><AddIcon /> Add page to</K> → <K>Home screen</K>.
          </>,
        ],
      };
    case 'android-firefox':
      return {
        list: [
          <>
            Tap the <K>⋮</K> menu.
          </>,
          <>
            Tap <K>Install</K> or <K><AddIcon /> Add to Home screen</K>.
          </>,
        ],
      };
    case 'android-chrome':
      return {
        list: [
          <>
            Tap the <K>⋮</K> menu in the top corner.
          </>,
          <>
            Tap <K>Install app</K> or <K><AddIcon /> Add to Home screen</K>.
          </>,
          <>
            Tap <K>Install</K>.
          </>,
        ],
      };
    default:
      return {
        list: [
          <>
            In Chrome or Edge, click the install icon <K>⊕</K> at the right end of the address bar.
          </>,
          <>
            On a phone, open this site in your browser and use <K>Add to Home Screen</K>.
          </>,
        ],
      };
  }
}

function InstallSheet({
  where,
  title,
  sub,
  canPrompt,
  onInstall,
  onClose,
}: {
  where: Where;
  title: string;
  sub: string;
  canPrompt: boolean;
  onInstall: () => void;
  onClose: () => void;
}) {
  const [showSteps, setShowSteps] = useState(!canPrompt);
  const [copied, setCopied] = useState(false);
  const how = steps(where);
  const inApp = where === 'ios-inapp' || where === 'android-inapp';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Portal into <body>: <main> animates with a transform, which would trap a
  // position: fixed sheet inside it.
  return createPortal(
    <div className="ai-sheet" role="dialog" aria-modal="false" aria-labelledby="ai-title">
      <button type="button" className="ai-close" aria-label="Close" onClick={onClose}>
        ×
      </button>
      <div className="ai-head">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192-v2.png" alt="" width={52} height={52} className="ai-icon" />
        <div>
          <p id="ai-title" className="ai-title">
            {title}
          </p>
          <p className="ai-sub">{sub}</p>
        </div>
      </div>

      {canPrompt && !showSteps ? (
        <div className="ai-actions">
          <button type="button" className="btn btn-primary ai-go" onClick={onInstall}>
            Install
          </button>
          <button type="button" className="btn ai-later" onClick={onClose}>
            Not now
          </button>
        </div>
      ) : (
        <>
          {how.lead && <p className="ai-lead">{how.lead}</p>}
          <ol className="ai-steps">
            {how.list.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
          {inApp && (
            <button
              type="button"
              className="btn btn-sm ai-copy"
              onClick={() => {
                void navigator.clipboard
                  ?.writeText(window.location.href)
                  .then(() => setCopied(true))
                  .catch(() => undefined);
              }}
            >
              {copied ? 'Link copied — paste it in your browser' : 'Copy this page’s link'}
            </button>
          )}
          {where === 'ios-safari' && (
            <p className="ai-hint" aria-hidden="true">
              ↓ Share is down here in Safari
            </p>
          )}
        </>
      )}
    </div>,
    document.body
  );
}

// ---------------------------------------------------------------------------
// The nudge (phones only, root layout)

const DISMISS_KEY = 'mn.install.dismissed';
const DISMISS_DAYS = 14;

/** Pages where a sheet would get in the way, or that are not for buyers. */
const NO_NUDGE = [/^\/portal/, /^\/admin/, /^\/scan/, /^\/demo/, /checkout/, /^\/offline/, /^\/c\//, /^\/contact/];

function dismissedRecently(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY) || 0);
    return Date.now() - at < DISMISS_DAYS * 86_400_000;
  } catch {
    return false;
  }
}

function rememberDismiss() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    /* private mode: it will simply ask again next visit */
  }
}

export function InstallNudge({ appName }: { appName: string }) {
  const pathname = usePathname() || '/';
  const { state, canPrompt, runPrompt } = useInstall();
  const [open, setOpen] = useState(false);
  // The analytics question comes first; two sheets at once is one too many.
  const [consentPending, setConsentPending] = useState(true);

  useEffect(() => {
    const gaOn = Boolean(process.env.NEXT_PUBLIC_GA_ID);
    const check = () => setConsentPending(gaOn && !isPrivatePath(pathname) && readConsent() === null);
    check();
    return subscribeConsent(check);
  }, [pathname]);

  const ticketPage = /^\/(order|ticket)\//.test(pathname);
  const blocked = NO_NUDGE.some((r) => r.test(pathname));

  useEffect(() => {
    if (!state || !state.phone || state.standalone || blocked || consentPending) return;
    if (dismissedRecently()) return;
    // Let the page be read first. On a fresh ticket, sooner: that is the
    // moment the app is worth the most.
    const t = window.setTimeout(() => setOpen(true), ticketPage ? 2500 : 9000);
    return () => window.clearTimeout(t);
  }, [state, blocked, consentPending, ticketPage]);

  // Navigating somewhere the sheet does not belong closes it (without
  // counting as a "no").
  useEffect(() => {
    if (blocked) setOpen(false);
  }, [blocked]);

  if (!open || !state || state.standalone) return null;

  const close = () => {
    rememberDismiss();
    setOpen(false);
  };

  return (
    <InstallSheet
      where={state.where}
      canPrompt={canPrompt}
      title={ticketPage ? 'Keep your tickets one tap away' : `Get the ${appName} app`}
      sub={
        ticketPage
          ? 'Add the app to your home screen — your QR codes open even with no signal at the door.'
          : 'Events, the bazaar and your tickets on your home screen. Free, no app store, takes 5 seconds.'
      }
      onInstall={async () => {
        const r = await runPrompt();
        if (r !== 'accepted') rememberDismiss();
        setOpen(false);
      }}
      onClose={close}
    />
  );
}

// ---------------------------------------------------------------------------
// Buttons that always work

function useInstallTrigger(appName: string) {
  const { state, canPrompt, runPrompt } = useInstall();
  const [open, setOpen] = useState(false);
  const trigger = async () => {
    if (canPrompt) {
      const r = await runPrompt();
      if (r !== 'none') return;
    }
    setOpen(true);
  };
  const sheet =
    open && state ? (
      <InstallSheet
        where={state.where}
        canPrompt={false}
        title={`Add ${appName} to your home screen`}
        sub="It opens like an app — full screen, one tap, and your tickets work offline."
        onInstall={() => undefined}
        onClose={() => setOpen(false)}
      />
    ) : null;
  return { state, trigger, sheet };
}

/** "Install the app" — the seller hub home, and anywhere else it helps. */
export default function InstallAppButton({ label = 'Install the app', appName = 'MartNepali' }: { label?: string; appName?: string }) {
  const { state, trigger, sheet } = useInstallTrigger(appName);
  if (!state || state.standalone) return null;
  return (
    <>
      <button type="button" className="btn" onClick={() => void trigger()}>
        📲 {label}
      </button>
      {sheet}
    </>
  );
}

/** A quiet footer link, so a dismissed sheet is never the only way in. */
export function InstallFooterLink({ appName }: { appName: string }) {
  const { state, trigger, sheet } = useInstallTrigger(appName);
  if (!state || state.standalone) return null;
  return (
    <>
      <button type="button" className="footer-install" onClick={() => void trigger()}>
        📲 Get the app
      </button>
      {sheet}
    </>
  );
}
