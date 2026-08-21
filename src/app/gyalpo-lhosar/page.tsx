import { shareImages } from '@/lib/seo';
import FestivalPage from '@/components/FestivalPage';
import { currentOccurrence, getFestival } from '@/lib/festivals';

export const dynamic = 'force-dynamic';

// Same shape as /dashain — see lib/festivals.ts for the dates and the
// once-a-year maintenance note.
const festival = getFestival('gyalpo-lhosar')!;

export function generateMetadata() {
  const o = currentOccurrence(festival);
  const title = o
    ? `Gyalpo Lhosar ${o.year} in Germany — date & events`
    : 'Gyalpo Lhosar in Germany — date & events';
  const description = o
    ? `When is Gyalpo Lhosar ${o.year}? The Sherpa New Year is on ${o.mainDay} (${o.bsYear} BS). ` +
      `The date, and Nepali community events across Germany.`
    : 'Gyalpo Lhosar (Sherpa New Year) dates and Nepali community events across Germany.';
  return {
    title,
    description,
    alternates: { canonical: '/gyalpo-lhosar' },
    openGraph: { type: 'website', title, description, url: '/gyalpo-lhosar', images: shareImages() },
  };
}

export default function GyalpoLhosarPage() {
  return <FestivalPage festival={festival} />;
}
