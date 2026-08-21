import { shareImages } from '@/lib/seo';
import FestivalPage from '@/components/FestivalPage';
import { currentOccurrence, getFestival } from '@/lib/festivals';

export const dynamic = 'force-dynamic';

// Same shape as /dashain — see lib/festivals.ts for the dates and the
// once-a-year maintenance note.
const festival = getFestival('teej')!;

export function generateMetadata() {
  const o = currentOccurrence(festival);
  const title = o ? `Teej ${o.year} in Germany — dates & events` : 'Teej in Germany — dates & events';
  const description = o
    ? `When is Teej ${o.year}? Haritalika Teej is on ${o.mainDay} (${o.bsYear} BS), with Dar Khane ` +
      `Din the day before. All the days, and Nepali community events across Germany.`
    : 'Teej dates and Nepali community events across Germany.';
  return {
    title,
    description,
    alternates: { canonical: '/teej' },
    openGraph: { type: 'website', title, description, url: '/teej', images: shareImages() },
  };
}

export default function TeejPage() {
  return <FestivalPage festival={festival} />;
}
