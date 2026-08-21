// Whether this visitor agreed to be counted, and nothing else.
//
// Analytics on this site does not run until somebody says yes. That is not a
// courtesy: TTDSG §25 and the GDPR require consent BEFORE anything is stored
// on or read from a visitor's device, and Google Analytics stores a cookie the
// moment it loads. So the decision is made first and the script is loaded
// second — see components/Analytics, which never renders until this says
// 'granted'.
//
// Deliberately NOT a consent-management platform. There is exactly one thing
// to decide here, because there is exactly one thing that would be loaded, and
// a preferences dialogue with four toggles would be inventing choices this
// site does not offer. One question, two equal answers.
//
// The decision lives in localStorage rather than a cookie. A cookie recording
// consent is itself defensible as "strictly necessary", but it would travel to
// the server on every request for no reason, and this codebase already keeps
// the shopper's own state on the shopper's own device (lib/savedItems).
//
// Safe on the client — no database, no server-only imports. Every read is
// guarded: Safari's private mode throws on storage access, and a server render
// has no storage at all, so both answer "no decision yet" rather than crashing.

export type ConsentChoice = 'granted' | 'denied';

/**
 * What is stored: the answer AND when it was given.
 *
 * The timestamp is not decoration. Art. 7(1) GDPR puts the burden of showing
 * that consent was obtained on the controller, and "the visitor's own browser
 * says granted, at this moment, under this version of the key" is the only
 * record a site that stores nothing server-side can hold. It also makes it
 * possible to ask again later if what is being consented to ever changes.
 */
export interface ConsentRecord {
  choice: ConsentChoice;
  /** Unix ms. */
  at: number;
}

/** Versioned: if what is being consented to ever changes, so must the key. */
export const CONSENT_KEY = 'martnepali.consent.v1';

/**
 * Fired on the window whenever the decision changes, so the tag can start or
 * stop within the same page view.
 *
 * Without it, accepting would do nothing visible until the next navigation and
 * withdrawing would leave the script running until a reload — both of which
 * make a visitor doubt the button did anything, which is exactly the doubt a
 * consent control must not create.
 */
export const CONSENT_EVENT = 'martnepali:consent';

function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** The decision, or null when this visitor has not made one yet. */
export function readConsent(): ConsentChoice | null {
  return readConsentRecord()?.choice ?? null;
}

/**
 * The decision with its timestamp, or null.
 *
 * Anything unparseable, unrecognised or hand-edited reads as null — which
 * means "not asked yet", which means nothing loads. Every failure here fails
 * towards not tracking, because the alternative is tracking somebody on the
 * strength of a corrupted string.
 */
export function readConsentRecord(): ConsentRecord | null {
  const store = storage();
  if (!store) return null;
  let raw: string | null = null;
  try {
    raw = store.getItem(CONSENT_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<ConsentRecord>;
    if (parsed?.choice !== 'granted' && parsed?.choice !== 'denied') return null;
    const at = typeof parsed.at === 'number' && Number.isFinite(parsed.at) ? parsed.at : 0;
    return { choice: parsed.choice, at };
  } catch {
    return null;
  }
}

/**
 * Record a decision and tell the page at once.
 *
 * Withdrawing does more than write 'denied': it clears the cookies Google
 * already set. Stopping the script while leaving its identifiers on the device
 * would be a withdrawal in name only — the next site using the same property
 * would still recognise the browser, and the visitor pressed the button
 * precisely so that it would not.
 */
export function setConsent(choice: ConsentChoice, at = Date.now()): void {
  const store = storage();
  try {
    store?.setItem(CONSENT_KEY, JSON.stringify({ choice, at } satisfies ConsentRecord));
  } catch {
    // A browser refusing to remember the choice is not a reason to fail the
    // click: the tag still respects the in-memory answer for this page view,
    // and the visitor will simply be asked again next time.
  }
  if (choice === 'denied') forgetAnalyticsCookies();
  try {
    window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: choice }));
  } catch {
    // No window (a server render). Nothing to notify.
  }
}

/**
 * Delete Google's own cookies — `_ga` and the per-property `_ga_XXXXXXX`.
 *
 * Written for both the bare domain and the dot-prefixed form, because that is
 * how gtag sets them and a cookie is only removable by the exact
 * name/domain/path it was written with. Anything missed simply stays until it
 * expires; nothing here can break by trying.
 */
function forgetAnalyticsCookies(): void {
  try {
    const host = window.location.hostname;
    // "sub.example.com" -> ["sub.example.com", ".sub.example.com", ".example.com"]
    const parts = host.split('.');
    const domains = new Set<string>([host, `.${host}`]);
    if (parts.length > 2) domains.add(`.${parts.slice(-2).join('.')}`);

    for (const entry of document.cookie.split(';')) {
      const name = entry.split('=')[0]?.trim();
      if (!name || !name.startsWith('_ga')) continue;
      for (const domain of domains) {
        document.cookie = `${name}=; Max-Age=0; path=/; domain=${domain}`;
      }
      document.cookie = `${name}=; Max-Age=0; path=/`;
    }
  } catch {
    // Cookie access can throw in a sandboxed frame. The choice is still saved.
  }
}

/**
 * Watch the decision. Returns an unsubscribe function.
 *
 * Listens for the in-page event AND the browser's own `storage` event, so a
 * visitor who withdraws consent in one tab is not still being counted in the
 * three others they left open.
 */
export function subscribeConsent(onChange: (choice: ConsentChoice | null) => void): () => void {
  const handler = () => onChange(readConsent());
  window.addEventListener(CONSENT_EVENT, handler);
  window.addEventListener('storage', handler);
  return () => {
    window.removeEventListener(CONSENT_EVENT, handler);
    window.removeEventListener('storage', handler);
  };
}
