// The organizer's chosen page colour, in one place.
//
// This used to live inside the listing page component, which was fine while the
// listing page was the only thing an organizer's accent coloured. It is not any
// more: an item page is the same shop under a different URL, and a shopper who
// taps from a gold shop into one of its jars must not land on a violet page.
// Shared here so the two cannot drift into two different golds.
import type { PageDesign } from './events';

export type AccentName = NonNullable<PageDesign['accent']>;

/**
 * The six organizer-selectable accents, mapped onto the design system's CSS
 * tokens. Applied as inline CSS variables on a wrapper div, so every existing
 * class (buttons, badges, steps, glows) recolors itself — no raw CSS from
 * organizers ever reaches the page.
 */
export const ACCENT_THEMES = {
  violet: {
    '--accent': '#8b5cf6',
    '--accent-strong': '#7c3aed',
    '--accent-soft': 'rgba(139, 92, 246, 0.14)',
    '--accent-glow': 'rgba(139, 92, 246, 0.45)',
    '--accent-text': '#c4b5fd',
    '--pink': '#ec4899',
    '--pink-soft': 'rgba(236, 72, 153, 0.14)',
    '--pink-text': '#f9a8d4',
  },
  sunset: {
    '--accent': '#f97316',
    '--accent-strong': '#ea580c',
    '--accent-soft': 'rgba(249, 115, 22, 0.14)',
    '--accent-glow': 'rgba(249, 115, 22, 0.45)',
    '--accent-text': '#fdba74',
    '--pink': '#ec4899',
    '--pink-soft': 'rgba(236, 72, 153, 0.14)',
    '--pink-text': '#f9a8d4',
  },
  ocean: {
    '--accent': '#0ea5e9',
    '--accent-strong': '#0284c7',
    '--accent-soft': 'rgba(14, 165, 233, 0.14)',
    '--accent-glow': 'rgba(14, 165, 233, 0.45)',
    '--accent-text': '#7dd3fc',
    '--pink': '#22d3ee',
    '--pink-soft': 'rgba(34, 211, 238, 0.14)',
    '--pink-text': '#a5f3fc',
  },
  emerald: {
    '--accent': '#10b981',
    '--accent-strong': '#059669',
    '--accent-soft': 'rgba(16, 185, 129, 0.14)',
    '--accent-glow': 'rgba(16, 185, 129, 0.45)',
    '--accent-text': '#6ee7b7',
    '--pink': '#2dd4bf',
    '--pink-soft': 'rgba(45, 212, 191, 0.14)',
    '--pink-text': '#99f6e4',
  },
  gold: {
    '--accent': '#f59e0b',
    '--accent-strong': '#d97706',
    '--accent-soft': 'rgba(245, 158, 11, 0.14)',
    '--accent-glow': 'rgba(245, 158, 11, 0.45)',
    '--accent-text': '#fcd34d',
    '--pink': '#f97316',
    '--pink-soft': 'rgba(249, 115, 22, 0.14)',
    '--pink-text': '#fdba74',
  },
  crimson: {
    '--accent': '#ef4444',
    '--accent-strong': '#dc2626',
    '--accent-soft': 'rgba(239, 68, 68, 0.14)',
    '--accent-glow': 'rgba(239, 68, 68, 0.45)',
    '--accent-text': '#fca5a5',
    '--pink': '#f43f5e',
    '--pink-soft': 'rgba(244, 63, 94, 0.14)',
    '--pink-text': '#fda4af',
  },
} satisfies Record<AccentName, Record<string, string>>;
