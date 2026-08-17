'use client';

/** The event a tab listens for to bring itself to the front. */
export const GOTO_TAB_EVENT = 'nc:goto-tab';

/**
 * A link that switches the editor to another tab.
 *
 * Not an <a href="?tab=basics">: the tab strip only reads `?tab=` once, when it
 * mounts, so a same-page query change would leave the organizer looking at the
 * tab they were already on. A browser event moves them for real, and keeps this
 * button independent of the strip — either works without the other.
 */
export default function GoToTab({ tab, children }: { tab: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      className="btn btn-sm"
      onClick={() => window.dispatchEvent(new CustomEvent<string>(GOTO_TAB_EVENT, { detail: tab }))}
    >
      {children}
    </button>
  );
}
