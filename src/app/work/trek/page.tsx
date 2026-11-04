import Link from 'next/link';
import { Mukta } from 'next/font/google';
import DemoNav from '@/components/studio/DemoNav';
import { currentLang } from '@/lib/i18nServer';
import TrekPlanner from './TrekPlanner';
import { FRAME, asLang } from './content';
import '@/app/studio/studio.css';
import './trek.css';

// Studio demo #17 (lib/projects.ts → "Nepal trek & trip planner"): "Yatri
// Treks", a made-up travel agency for diaspora families visiting home and
// European trekkers. Ready trips (Everest Base Camp, Annapurna Base Camp,
// Poon Hill, Langtang, a family visit with Chitwan and Pokhara, a Lumbini
// pilgrimage) or build your own; day cards you can reorder; the route on a
// hand-drawn map of Nepal (pan / zoom by pointer, wheel, buttons, keyboard);
// an altitude profile with a simple acclimatisation rule (general guidance,
// not medical advice); best season with festivals; a packing list; permits
// named generically; an enquiry that is only a summary on screen; print and
// .ics.
//
// No prices, fees or costs anywhere — the studio's operator is a student and
// the studio is free while it grows. Rules in trek.ts
// (tests/trekPlanner.test.ts), words in content.ts. Client-side only, one
// localStorage key; the demo and its frame are translate="no" so nothing
// typed here reaches the site's auto-translator.

const mukta = Mukta({
  weight: ['400', '600', '800'],
  subsets: ['devanagari', 'latin'],
  display: 'swap',
  variable: '--tk-mukta',
});

const title = 'Yatri Treks — a Nepal trek & trip planner · demo project';
const description =
  'A demo built by MartNepali: a made-up Nepal travel agency’s trip planner. Ready treks to Everest Base Camp, Annapurna Base Camp, Poon Hill and Langtang, a family visit with Chitwan and Pokhara, a Lumbini pilgrimage — or build your own on a drawn map, with an altitude profile, best season, packing list and a calendar file — in English, Deutsch and नेपाली.';
const cover = {
  url: '/media/studio/projects/trek.jpg',
  width: 1200,
  height: 800,
  alt: 'Yatri Treks trip planner: the Everest Base Camp route on a drawn map of Nepal, the altitude profile and the first day cards',
};

export const metadata = {
  title,
  description,
  alternates: { canonical: '/work/trek' },
  openGraph: {
    type: 'website',
    title,
    description,
    url: '/work/trek',
    images: [cover],
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
    images: [cover.url],
  },
};

export default async function TrekPage() {
  const lang = asLang(await currentLang()) ?? 'en';
  const f = FRAME[lang];
  return (
    <div className={`tk-page ${mukta.variable}`}>
      <div className="tk-frame-top" translate="no">
        <div className="tk-frame-inner">
          <span className="tk-frame-badge">{f.badge}</span>
          <span className="tk-frame-text">{f.text}</span>
          <Link href="/work" className="tk-frame-link">
            {f.all}
          </Link>
        </div>
      </div>

      <TrekPlanner initialLang={lang} />

      <section className="tk-frame-end" aria-labelledby="tk-end-h" translate="no">
        <div className="tk-frame-end-inner">
          <p className="tk-frame-kicker">{f.kicker}</p>
          <h2 id="tk-end-h">{f.endH}</h2>
          <p>{f.endP}</p>
          <ul>
            {f.points.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
          <div className="tk-frame-ctas">
            <Link href="/contact?intent=website" className="btn btn-brand">
              {f.talk}
            </Link>
            <Link href="/studio#projects" className="btn">
              {f.more}
            </Link>
          </div>
          <p className="tk-frame-pairs">
            <Link href="/work/instant">{f.pairs}</Link>
          </p>
          <p className="tk-frame-free">{f.free}</p>
          <DemoNav current="trek" />
        </div>
      </section>
    </div>
  );
}
