// How every chat on the site behaves on a phone, the way chat apps do: the
// keyboard comes up only when the visitor taps the box (never by itself), it
// goes away after sending so the answer can be read, and once the answer is
// in, the log shows it from its START — the visitor's own question at the top
// of the screen — rather than jumping to the end of a long reply.

/** A phone or tablet: its on-screen keyboard covers half of any chat. */
export const touchScreen = () => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;

/** Put the cursor in the box — with a mouse only; on a phone that would open the keyboard. */
export function focusUnlessTouch(el: HTMLElement | null | undefined) {
  if (el && !touchScreen()) el.focus({ preventScroll: true });
}

/** After sending: on a phone, close the keyboard so the answer has the screen. */
export function blurOnTouch(el: HTMLElement | null | undefined) {
  if (el && touchScreen()) el.blur();
}

/**
 * Scroll a chat log: to the end while waiting for an answer, and to the
 * visitor's last message once the answer is in.
 */
export function scrollChat(log: HTMLElement | null, mineSelector: string, waiting: boolean, smooth = true) {
  if (!log) return;
  const mine = log.querySelectorAll<HTMLElement>(mineSelector);
  const lastMine = mine[mine.length - 1];
  const top =
    lastMine && !waiting ? log.scrollTop + lastMine.getBoundingClientRect().top - log.getBoundingClientRect().top - 12 : log.scrollHeight;
  requestAnimationFrame(() => log.scrollTo({ top, behavior: smooth ? 'smooth' : 'auto' }));
}

/**
 * Show what just arrived from its start (`first`) — unless that leaves the
 * newest message (`last`) below the screen; then enough above `last` for
 * context, with `last` itself in view.
 */
export function scrollToArrival(log: HTMLElement, first: HTMLElement, last: HTMLElement) {
  requestAnimationFrame(() => {
    const base = log.getBoundingClientRect().top - log.scrollTop;
    const firstTop = first.getBoundingClientRect().top - base - 12;
    const lastTop = last.getBoundingClientRect().top - base;
    log.scrollTo({ top: Math.max(firstTop, lastTop - log.clientHeight * 0.45), behavior: 'smooth' });
  });
}
