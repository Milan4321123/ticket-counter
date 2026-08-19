import FestivalPage from '@/components/FestivalPage';
import { currentOccurrence, getFestival } from '@/lib/festivals';

export const dynamic = 'force-dynamic';

// Same shape as /dashain — see lib/festivals.ts for the dates and the
// once-a-year maintenance note.
const festival = getFestival('nepali-new-year')!;

export function generateMetadata() {
  const o = currentOccurrence(festival);
  const title = o
    ? `Nepali New Year ${o.year} (${o.bsYear} BS) — date & events in Germany`
    : 'Nepali New Year — date & events in Germany';
  const description = o
    ? `When is Nepali New Year ${o.year}? Baisakh 1, ${o.bsYear} BS falls on ${o.mainDay}. ` +
      `The date, and Nepali community events across Germany.`
    : 'Nepali New Year dates and Nepali community events across Germany.';
  return {
    title,
    description,
    alternates: { canonical: '/nepali-new-year' },
    openGraph: { type: 'website', title, description, url: '/nepali-new-year' },
  };
}

export default function NepaliNewYearPage() {
  return <FestivalPage festival={festival} />;
}
