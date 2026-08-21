import { shareImages } from '@/lib/seo';
import FestivalPage from '@/components/FestivalPage';
import { currentOccurrence, getFestival } from '@/lib/festivals';

export const dynamic = 'force-dynamic';

// The one evergreen URL for the biggest search of the community's year.
// Everything it shows lives in lib/festivals.ts and components/FestivalPage.
const festival = getFestival('dashain')!;

export function generateMetadata() {
  const o = currentOccurrence(festival);
  const title = o ? `Dashain ${o.year} in Germany — dates & events` : 'Dashain in Germany — dates & events';
  const description = o
    ? `When is Dashain ${o.year}? Tika (Vijaya Dashami) is on ${o.mainDay} (${o.bsYear} BS). ` +
      `All the days, and Nepali community events across Germany.`
    : 'Dashain dates and Nepali community events across Germany.';
  return {
    title,
    description,
    alternates: { canonical: '/dashain' },
    openGraph: { type: 'website', title, description, url: '/dashain', images: shareImages() },
  };
}

export default function DashainPage() {
  return <FestivalPage festival={festival} />;
}
