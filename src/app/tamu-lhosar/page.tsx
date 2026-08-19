import FestivalPage from '@/components/FestivalPage';
import { currentOccurrence, getFestival } from '@/lib/festivals';

export const dynamic = 'force-dynamic';

// Same shape as /dashain — see lib/festivals.ts for the dates and the
// once-a-year maintenance note.
const festival = getFestival('tamu-lhosar')!;

export function generateMetadata() {
  const o = currentOccurrence(festival);
  const title = o
    ? `Tamu Lhosar ${o.year} in Germany — date & events`
    : 'Tamu Lhosar in Germany — date & events';
  const description = o
    ? `When is Tamu Lhosar ${o.year}? The Gurung New Year is on ${o.mainDay} (Poush 15, ` +
      `${o.bsYear} BS). The date, and Nepali community events across Germany.`
    : 'Tamu Lhosar (Gurung New Year) dates and Nepali community events across Germany.';
  return {
    title,
    description,
    alternates: { canonical: '/tamu-lhosar' },
    openGraph: { type: 'website', title, description, url: '/tamu-lhosar' },
  };
}

export default function TamuLhosarPage() {
  return <FestivalPage festival={festival} />;
}
