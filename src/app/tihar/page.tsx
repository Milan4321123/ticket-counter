import { shareImages } from '@/lib/seo';
import FestivalPage from '@/components/FestivalPage';
import { currentOccurrence, getFestival } from '@/lib/festivals';

export const dynamic = 'force-dynamic';

// Same shape as /dashain — see lib/festivals.ts for the dates and the
// once-a-year maintenance note.
const festival = getFestival('tihar')!;

export function generateMetadata() {
  const o = currentOccurrence(festival);
  const title = o ? `Tihar ${o.year} in Germany — dates & events` : 'Tihar in Germany — dates & events';
  const description = o
    ? `When is Tihar ${o.year}? Bhai Tika is on ${o.mainDay} (${o.bsYear} BS), Laxmi Puja just before. ` +
      `All five days, and Nepali community events across Germany.`
    : 'Tihar dates and Nepali community events across Germany.';
  return {
    title,
    description,
    alternates: { canonical: '/tihar' },
    openGraph: { type: 'website', title, description, url: '/tihar', images: shareImages() },
  };
}

export default function TiharPage() {
  return <FestivalPage festival={festival} />;
}
