// The "brief" a visitor brings to /contact from the idea builder (/work/build):
// /contact?intent=app&brief=<text>. Client-safe and pure (tests/ideaBrief.test.ts).
//
// It only ever PREFILLS the chat (components/CreatorChat shows it as an
// unsent, editable message) — the visitor still presses send, and the chat's
// own limits and rate caps apply to it like to anything typed. Because anyone
// can build such a link, the text is cleaned here: one line, no control or
// direction-override characters, no markup, no links except our own sketch
// link, and never longer than the chat's input allows.

/** The chat's input takes 600 characters; a brief never needs more. */
export const BRIEF_MAX = 600;

/** The one kind of link a brief may carry: the builder's own sketch, as a path. */
const OWN_LINK = /^\/work\/build(?:[?#][^\s]*)?$/;

/**
 * A brief from a query string (string, array or nothing) → safe text, or ''.
 * Newlines become " · ", so the brief reads as one message.
 */
export function cleanBrief(raw: unknown, max: number = BRIEF_MAX): string {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (typeof v !== 'string') return '';
  let s = v.normalize('NFC');
  // Line breaks → a separator; every other control character → a space.
  s = s.replace(/\s*[\r\n]+\s*/g, ' · ').replace(/[\u0000-\u001F\u007F-\u009F]+/g, ' ');
  // Invisible direction overrides and zero-width spaces (ZWJ / ZWNJ stay: Devanagari needs them).
  s = s.replace(/[​‎‏‪-‮⁠⁦-⁩﻿]/g, '');
  // No markup.
  s = s.replace(/[<>]/g, '');
  // Links: only our own sketch link (a path) survives; anything else is dropped.
  s = s
    .split(/\s+/)
    .filter((w) => !/^(?:[a-z][a-z0-9+.-]*:\/\/|(?:javascript|data|mailto|tel):|www\.|\/\/)/i.test(w))
    .filter((w) => !/^[\w-]+(?:\.[\w-]+)+\/\S*/.test(w))
    .filter((w) => !w.startsWith('/') || OWN_LINK.test(w))
    .join(' ');
  s = s.replace(/(?:\s*·\s*){2,}/g, ' · ').replace(/\s+/g, ' ').replace(/^[\s·]+|[\s·]+$/g, '');
  const chars = Array.from(s);
  if (chars.length <= max) return s;
  // Too long: cut at the last space that keeps it under the cap, and say so.
  const cut = chars.slice(0, max - 1).join('');
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s·,;:]+$/, '')}…`;
}
