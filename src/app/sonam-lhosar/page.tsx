import FestivalPage from '@/components/FestivalPage';
import { currentOccurrence, getFestival } from '@/lib/festivals';

export const dynamic = 'force-dynamic';

// Same shape as /dashain — see lib/festivals.ts for the dates and the
// once-a-year maintenance note.
const festival = getFestival('sonam-lhosar')!;

export function generateMetadata() {
  const o = currentOccurrence(festival);
  const title = o
    ? `Sonam Lhosar ${o.year} in Germany — date & events`
    : 'Sonam Lhosar in Germany — date & events';
  const description = o
    ? `When is Sonam Lhosar ${o.year}? The Tamang New Year is on ${o.mainDay} (${o.bsYear} BS). ` +
      `The date, and Nepali community events across Germany.`
    : 'Sonam Lhosar (Tamang New Year) dates and Nepali community events across Germany.';
  return {
    title,
    description,
    alternates: { canonical: '/sonam-lhosar' },
    openGraph: { type: 'website', title, description, url: '/sonam-lhosar' },
  };
}

export default function SonamLhosarPage() {
  return <FestivalPage festival={festival} />;
}
