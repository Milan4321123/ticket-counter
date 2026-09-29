'use client';

/**
 * "Print / save as PDF" for the legal pages. A contract someone accepts by
 * clicking should be one they can keep a copy of; the browser's own print
 * dialog also offers "Save as PDF", so one button covers both. Hidden in the
 * printout itself (.no-print, see globals.css).
 */
export default function PrintButton({ label = 'Drucken / als PDF speichern' }: { label?: string }) {
  return (
    <button type="button" className="btn btn-sm no-print" onClick={() => window.print()}>
      {label}
    </button>
  );
}
