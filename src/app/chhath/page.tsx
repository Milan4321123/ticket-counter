import FestivalPage from '@/components/FestivalPage';
import { currentOccurrence, getFestival } from '@/lib/festivals';

export const dynamic = 'force-dynamic';

// Same shape as /dashain — see lib/festivals.ts for the dates and the
// once-a-year maintenance note.
const festival = getFestival('chhath')!;

export function generateMetadata() {
  const o = currentOccurrence(festival);
  const title = o
    ? `Chhath ${o.year} in Germany — dates & events`
    : 'Chhath in Germany — dates & events';
  const description = o
    ? `When is Chhath ${o.year}? Sandhya Arghya is on ${o.mainDay} (${o.bsYear} BS). ` +
      `All four days, and Nepali community events across Germany.`
    : 'Chhath dates and Nepali community events across Germany.';
  return {
    title,
    description,
    alternates: { canonical: '/chhath' },
    openGraph: { type: 'website', title, description, url: '/chhath' },
  };
}

export default function ChhathPage() {
  return <FestivalPage festival={festival} />;
}
