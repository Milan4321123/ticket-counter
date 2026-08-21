import { scriptRuns } from '@/lib/nepaliText';

/**
 * Nepali text, told apart from the English around it.
 *
 * This site mixes scripts in almost every heading — "नेपाली बजार · The bazaar",
 * "यो हप्ता के छ · weekly digest", a shelf called खाजा above the words "Khaja &
 * cooked food". The document is `lang="en"`, so without marking, a screen
 * reader applies English pronunciation rules to Devanagari and produces
 * nonsense — for a Nepali reader using one, the site's own name for a thing is
 * the part they cannot hear. Some browsers also pick an English fallback font
 * for it, which is why marked text renders more cleanly as well.
 *
 * A component rather than a bare `<span lang="ne">` at each site, so there is
 * one place to answer "which tag, which code" and one thing to search for. `ne`
 * is the ISO 639-1 code for Nepali; script is not specified, because these are
 * all Devanagari and BCP 47 says not to add a subtag that adds nothing.
 *
 * It renders a plain inline span with no styling of its own — anything it
 * replaced kept its own classes, and this must not change how a line looks.
 */
export default function Np({ children }: { children: React.ReactNode }) {
  return <span lang="ne">{children}</span>;
}

/**
 * The same marking, applied to text NOBODY can hand-annotate: what a seller
 * typed.
 *
 * Sellers here write in both scripts inside one sentence — "Taplejung ko
 * अलैंची, whole pods" — and there is no editor field where they could mark
 * which half is which, nor should there be. So the runs are found and wrapped
 * on the way out: every unbroken stretch of Devanagari becomes its own
 * lang="ne" span, and everything else is left exactly as it was.
 *
 * Deliberately mechanical. It looks at Unicode blocks, not at words: it cannot
 * tell Nepali from Hindi (both Devanagari, and this is a Nepali site), and it
 * makes no attempt at romanised Nepali — "chiya" is Latin script, a screen
 * reader will say something close enough, and guessing at it from spelling is
 * how you end up pronouncing "chia seeds" as Nepali.
 *
 * Punctuation and spaces BETWEEN two Devanagari runs are kept inside the span
 * rather than splitting it into fragments a screen reader announces
 * separately — "अलैंची, टिमुर" is one phrase, not two labels.
 */
export function MixedScript({ children }: { children: string }) {
  const runs = scriptRuns(children);
  // The common case by far — an all-Latin line — comes back as the string it
  // arrived as, adding no element to the tree at all.
  if (runs.length === 1 && !runs[0].nepali) return <>{children}</>;
  return (
    <>
      {runs.map((run, i) =>
        run.nepali ? (
          <span key={i} lang="ne">
            {run.text}
          </span>
        ) : (
          run.text
        )
      )}
    </>
  );
}
