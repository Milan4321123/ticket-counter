import FestivalPage from '@/components/FestivalPage';
import { currentOccurrence, getFestival } from '@/lib/festivals';

export const dynamic = 'force-dynamic';

// Same shape as /dashain — see lib/festivals.ts for the dates and the
// once-a-year maintenance note.
const festival = getFestival('saraswati-puja')!;

export function generateMetadata() {
  const o = currentOccurrence(festival);
  const title = o
    ? `Saraswati Puja ${o.year} in Germany — date & events`
    : 'Saraswati Puja in Germany — date & events';
  const description = o
    ? `When is Saraswati Puja ${o.year}? Shree Panchami is on ${o.mainDay} (${o.bsYear} BS). ` +
      `The date, and Nepali community events across Germany.`
    : 'Saraswati Puja (Shree Panchami) dates and Nepali community events across Germany.';
  return {
    title,
    description,
    alternates: { canonical: '/saraswati-puja' },
    openGraph: { type: 'website', title, description, url: '/saraswati-puja' },
  };
}

export default function SaraswatiPujaPage() {
  return <FestivalPage festival={festival} />;
}
