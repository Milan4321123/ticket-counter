// Client-safe: how the assistant panel hands accepted FAQ suggestions to the
// FAQ editor a couple of cards further down the same tab.
//
// Both are separate client islands rendered by a server component, so there is
// no shared parent to lift state into. A browser event keeps them independent
// (either one works on its own) and, more importantly, keeps ONE owner of the
// FAQ list: the suggestions land as ordinary editable rows in the editor, and
// nothing is written until the organizer presses Save FAQ there. Nobody saves
// a half-reviewed list behind their back.

export interface SuggestedFaq {
  question: string;
  answer: string;
}

/** Exported so the editor accordion can open a collapsed FAQ section on it. */
export const FAQ_SUGGESTIONS_EVENT = 'nc:faq-suggestions';

const EVENT_NAME = FAQ_SUGGESTIONS_EVENT;

export function sendFaqSuggestions(rows: SuggestedFaq[]): void {
  window.dispatchEvent(new CustomEvent<SuggestedFaq[]>(EVENT_NAME, { detail: rows }));
}

/** Subscribe; returns the unsubscribe function for the effect's cleanup. */
export function onFaqSuggestions(handler: (rows: SuggestedFaq[]) => void): () => void {
  const listener = (e: Event) => {
    const rows = (e as CustomEvent<SuggestedFaq[]>).detail;
    if (Array.isArray(rows)) handler(rows);
  };
  window.addEventListener(EVENT_NAME, listener);
  return () => window.removeEventListener(EVENT_NAME, listener);
}
