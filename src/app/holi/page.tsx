import { shareImages } from '@/lib/seo';
import FestivalPage from '@/components/FestivalPage';
import { currentOccurrence, getFestival } from '@/lib/festivals';

export const dynamic = 'force-dynamic';

// Same shape as /dashain — see lib/festivals.ts for the dates and the
// once-a-year maintenance note.
const festival = getFestival('holi')!;

export function generateMetadata() {
  const o = currentOccurrence(festival);
  const title = o ? `Holi ${o.year} in Germany — dates & events` : 'Holi in Germany — dates & events';
  const description = o
    ? `When is Holi ${o.year}? Fagu Purnima is on ${o.mainDay} in the hills and Kathmandu Valley, ` +
      `one day later in the Terai. Both dates, and Nepali community events across Germany.`
    : 'Holi (Fagu Purnima) dates and Nepali community events across Germany.';
  return {
    title,
    description,
    alternates: { canonical: '/holi' },
    openGraph: { type: 'website', title, description, url: '/holi', images: shareImages() },
  };
}

export default function HoliPage() {
  return <FestivalPage festival={festival} />;
}
