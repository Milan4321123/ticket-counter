// Where Nepali stops and English starts, inside one line.
//
// This site mixes scripts everywhere — a heading reading "नेपाली बजार · The
// bazaar", a seller writing "Taplejung ko अलैंची, whole pods" in a description
// field that has no second box for the Nepali half. The document is lang="en",
// so a screen reader meeting Devanagari inside it applies English
// pronunciation rules and produces noise: the one word written for a Nepali
// reader is the word a Nepali reader using a screen reader cannot hear.
//
// Headings the site writes itself are marked by hand (components/Np). Text a
// SELLER typed cannot be, and asking sellers to tag their own sentences would
// be absurd — so it is segmented on the way out and each Devanagari run is
// wrapped in its own lang="ne" span by <MixedScript>.
//
// The logic lives here rather than beside the component so it can be tested
// without a renderer: what matters is entirely WHERE THE CUTS FALL, and a test
// that has to mount React to see them is a test nobody writes.
//
// Safe on the client — no database, no server-only imports.

/**
 * One stretch of one script. Joined back together, the runs are exactly the
 * string that went in — nothing is dropped, reordered or normalised.
 */
export interface ScriptRun {
  text: string;
  /** True for a Devanagari stretch, which is what gets marked as Nepali. */
  nepali: boolean;
}

/**
 * Split a line into Devanagari runs and everything else.
 *
 * Deliberately mechanical: it looks at Unicode blocks, not at words. It cannot
 * tell Nepali from Hindi — both are Devanagari, and this is a Nepali site —
 * and it makes no attempt at ROMANISED Nepali. "chiya" and "momo" are Latin
 * script and stay Latin, because guessing at them from spelling is how you end
 * up announcing "chia seeds" in Nepali.
 *
 * Punctuation and spaces BETWEEN two Devanagari words stay inside the run:
 * "मोमो, टिमुर" is one phrase, and splitting it at the comma would make a
 * screen reader announce two labels with a language switch in between.
 */
export function scriptRuns(text: string): ScriptRun[] {
  // The capture group is what makes split() keep the separators, so an odd
  // index is always a Devanagari run and an even one is always everything
  // else. A line with no Devanagari splits to a single part and comes back
  // untouched — which is nearly every line on the site, and it costs one
  // regex and allocates nothing else.
  const parts = text.split(/([ऀ-ॿ][ऀ-ॿ\s।॥.,;:!?()'"-]*[ऀ-ॿ]|[ऀ-ॿ])/);
  return parts
    .map((part, i) => ({ text: part, nepali: i % 2 === 1 }))
    .filter((run) => run.text !== '');
}

/** True when a line has any Nepali in it at all — one pass, no allocation. */
export function hasNepali(text: string): boolean {
  return /[ऀ-ॿ]/.test(text);
}
