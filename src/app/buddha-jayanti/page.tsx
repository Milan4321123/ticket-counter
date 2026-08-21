import { shareImages } from '@/lib/seo';
import FestivalPage from '@/components/FestivalPage';
import { currentOccurrence, getFestival } from '@/lib/festivals';

export const dynamic = 'force-dynamic';

// Same shape as /dashain — see lib/festivals.ts for the dates and the
// once-a-year maintenance note.
const festival = getFestival('buddha-jayanti')!;

export function generateMetadata() {
  const o = currentOccurrence(festival);
  const title = o
    ? `Buddha Jayanti ${o.year} in Germany — date & events`
    : 'Buddha Jayanti in Germany — date & events';
  const description = o
    ? `When is Buddha Jayanti ${o.year}? Baisakh Purnima is on ${o.mainDay}. ` +
      `The date, and Nepali community events across Germany.`
    : 'Buddha Jayanti (Baisakh Purnima) dates and Nepali community events across Germany.';
  return {
    title,
    description,
    alternates: { canonical: '/buddha-jayanti' },
    openGraph: { type: 'website', title, description, url: '/buddha-jayanti', images: shareImages() },
  };
}

export default function BuddhaJayantiPage() {
  return <FestivalPage festival={festival} />;
}
