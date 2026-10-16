import Link from 'next/link';
import { Kalam, Mukta, Rozha_One } from 'next/font/google';
import Np from '@/components/Np';
import { getBaseUrl } from '@/lib/config';
import { cardFestivals, pickCardFestival } from '@/lib/greetingCards';
import { shareImages } from '@/lib/seo';
import CardMaker from './CardMaker';

// The card's own typefaces, all with Devanagari: a display serif for the big
// greeting, a clean sans for the English and the address, a handwritten face
// for the sign-off. Loaded only on this page.
const display = Rozha_One({ weight: '400', subsets: ['devanagari', 'latin'], display: 'swap' });
const body = Mukta({ weight: ['500', '700'], subsets: ['devanagari', 'latin'], display: 'swap' });
const script = Kalam({ weight: '700', subsets: ['devanagari', 'latin'], display: 'swap' });

// Which festivals are offered depends on today's date.
export const dynamic = 'force-dynamic';

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const { f } = await searchParams;
  const chosen = pickCardFestival(cardFestivals(), f);
  const name = chosen?.name ?? 'festival';
  const title = `Make your ${name} card — free greeting cards`;
  const description = `Make a ${name} greeting card with your name and family photo and send it to WhatsApp in seconds. Free, in Nepali and English — your photo never leaves your phone.`;
  return {
    title,
    description,
    alternates: { canonical: chosen ? `/card?f=${chosen.slug}` : '/card' },
    openGraph: { type: 'website', title, description, url: '/card', images: shareImages() },
  };
}

export default async function CardPage({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const { f } = await searchParams;
  const festivals = cardFestivals();
  const chosen = pickCardFestival(festivals, f);

  if (!chosen) {
    return (
      <div className="container container-narrow section">
        <h1 className="page-title">Festival cards</h1>
        <p className="muted">
          No festival is coming up just now — the cards come back with the next one.{' '}
          <Link href="/festivals">See the festival calendar →</Link>
        </p>
      </div>
    );
  }

  return (
    <>
      <section className="feed-hero gc-hero">
        <div className="container">
          <p className="feed-kicker anim-fade-up">
            <Np>शुभकामना कार्ड</Np> · Festival cards
          </p>
          <h1 className="anim-fade-up anim-d1">Make your {chosen.name} card</h1>
          <p className="feed-hero-sub anim-fade-up anim-d2">
            Your name, your family photo, a wish in Nepali — and it&rsquo;s in the family group in a minute. Free.
          </p>
        </div>
      </section>
      <section className="section gc-section">
        <div className="container">
          <CardMaker
            festivals={festivals}
            initialSlug={chosen.slug}
            fonts={{ display: display.style.fontFamily, body: body.style.fontFamily, script: script.style.fontFamily }}
            fontClasses={[display.className, body.className, script.className]}
            siteUrl={getBaseUrl().replace(/\/$/, '')}
          />
          <p className="muted small gc-foot">
            When is it? See <Link href={`/${chosen.slug}`}>{chosen.name} {chosen.year}</Link> and every other date in the{' '}
            <Link href="/festivals">festival calendar</Link>.
          </p>
        </div>
      </section>
    </>
  );
}
