// "Make it festival style", "neon look", "the page is boring": the setup
// chat changing how a page LOOKS (lib/events PageDesign.layout and colours),
// without the seller opening the design section.
//
// readLookRequest decides whether a chat message is about the look at all —
// strictly, because the same chat takes page content ("Nepali style momo
// 9€" is an item, not a style) — and which layout it names, if any.
// Client-safe (the setup chat reads requests itself): types only from lib/events.
import type { PageDesign, PageLayout } from './events';

const LAYOUTS: readonly PageLayout[] = ['classic', 'poster', 'festival', 'editorial', 'neon'];

const LAYOUT_WORDS: [PageLayout, RegExp][] = [
  ['festival', /\b(festival|festive|fest|kites?|colou?rful|bunt|mela|chad)\b|चाड|रंगीन/i],
  ['neon', /\b(neon|club|nightclub|glow(ing)?|dj|disco|rave|techno|retro)\b/i],
  ['editorial', /\b(editorial|magazine|elegant|classy|serif|sophisticated|gala|edel|elegante?)\b/i],
  ['poster', /\b(poster|flyer|plakat)\b/i],
  ['classic', /\b(classic|default|normal|plain|original)\b/i],
];
const LAYOUT_NAME = /\b(poster|flyer|festival|festive|colou?rful|editorial|magazine|elegant|classy|neon|club|disco|retro|classic|default)\b/i;
const LOOK_NOUN = /\b(look|looks|style|layout|frame|theme|design|vibe|aussehen|stil|optik)\b/i;
/** "make it look better", "change the colours", "mach die Seite schöner". */
const CHANGE_LOOK =
  /\b(make|change|give|redesign|restyle|improve|switch|try|use|want|mach|ändere|gestalte|banau\w*|ramro)\b.{0,40}\b(look\w*|style|design|layout|frame|theme|colou?rs?|cooler|prettier|nicer|beautiful|fancier|attractive|stylish|aussehen|stil|farben|schöner|hübscher|sundar)\b/i;
/** "the page looks boring". */
const COMPLAINT = /\b(boring|monoton\w*|dull|ugly|langweilig|plain)\b/i;

export interface LookRequest {
  /** The layout they named ("festival look"), if any. */
  layout?: PageLayout;
}

/** Is this chat message asking to change the page's look? Null when not. */
export function readLookRequest(text: string): LookRequest | null {
  const t = text.trim();
  // Prices and dates are page content, however they are worded.
  if (!t || /\d|€/.test(t) || t.split(/\s+/).length > 22) return null;
  const named = LAYOUT_WORDS.find(([, re]) => re.test(t))?.[0];
  const nameAndNoun = LAYOUT_NAME.test(t) && LOOK_NOUN.test(t);
  if (nameAndNoun || CHANGE_LOOK.test(t) || (COMPLAINT.test(t) && /\b(page|site|seite|it|this|looks?)\b/i.test(t))) {
    return named ? { layout: named } : {};
  }
  return null;
}

/**
 * The design to save: the designer's (AI) suggestion if there is one, the
 * layout they named always winning, and — when nothing was named — never the
 * same frame as before, so "make it cooler" visibly changes the page.
 * (The route cleans the result with parsePageDesign before it goes out.)
 */
export function restyledDesign(current: PageDesign, ask: LookRequest, suggested: PageDesign | null): PageDesign {
  const next: PageDesign = { ...current, ...(suggested ?? {}) };
  if (ask.layout) next.layout = ask.layout;
  else if (!suggested?.layout || suggested.layout === (current.layout ?? 'classic')) {
    const now = current.layout ?? 'classic';
    const choices = LAYOUTS.filter((l) => l !== 'classic' && l !== now);
    next.layout = choices[Math.floor(Math.random() * choices.length)];
  }
  if (next.layout === 'classic') delete next.layout;
  return next;
}
