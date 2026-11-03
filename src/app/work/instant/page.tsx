import Link from 'next/link';
import { Mukta } from 'next/font/google';
import DemoNav from '@/components/studio/DemoNav';
import { currentLang } from '@/lib/i18nServer';
import InstantSite from './InstantSite';
import { FRAME, asLang } from './content';
import '@/app/studio/studio.css';
import './instant.css';

// Studio demo #16 (lib/projects.ts → "Your website in 10 seconds"): type a
// name, pick what you are — restaurant, shop, Verein, artist, tutor, event,
// salon, cleaning / handyman or something else — and a city if you like, and
// a whole landing page writes, draws and lays itself out in a framed browser.
// Then remix it (eight styles with checked contrast, new words, a colour,
// sections on / off / reordered, your own headings), switch desktop / tablet /
// phone widths, compare it with a plain social page, share it as a link,
// download it as one offline .html, or take it to the contact chat.
//
// It complements /work/build (an idea sketch of an app's FEATURES on a phone):
// this one is a real full-width website, generated. Rules in instant.ts
// (tests/instantSite.test.ts), site words in templates.ts, drawings in
// art.ts, the tool's words in content.ts. No prices anywhere — not even in the
// generated menus. Client-side only, one localStorage key; the demo and its
// frame are translate="no" so nothing typed here reaches the translator.

const mukta = Mukta({ weight: ['400', '600', '800'], subsets: ['devanagari', 'latin'], display: 'swap', variable: '--in-mukta' });

const title = 'Your website in 10 seconds — type a name, watch it build · demo project';
const description =
  'A demo built by MartNepali: type a name, pick what you are — a restaurant, a shop, a Verein, an artist, a school, an event, a salon — and watch a complete website write and draw itself. Shuffle eight styles, reorder sections, switch phone and desktop widths, then share it or download it — in English, Deutsch and नेपाली.';
const cover = {
  url: '/media/studio/projects/instant.jpg',
  width: 1200,
  height: 800,
  alt: 'A generated restaurant website in a browser frame, with buttons to shuffle the style and switch between desktop, tablet and phone',
};

export const metadata = {
  title,
  description,
  alternates: { canonical: '/work/instant' },
  openGraph: { type: 'website', title, description, url: '/work/instant', images: [cover] },
  twitter: { card: 'summary_large_image', title, description, images: [cover.url] },
};

export default async function InstantPage() {
  const lang = asLang(await currentLang()) ?? 'en';
  const f = FRAME[lang];
  return (
    <div className={`in-page ${mukta.variable}`}>
      <div className="in-frame-top" translate="no">
        <div className="in-frame-inner">
          <span className="in-frame-badge">{f.badge}</span>
          <span className="in-frame-text">{f.text}</span>
          <Link href="/work" className="in-frame-link">
            {f.all}
          </Link>
        </div>
      </div>

      <InstantSite initialLang={lang} />

      <section className="in-frame-end" aria-labelledby="in-end-h" translate="no">
        <div className="in-frame-end-inner">
          <p className="in-frame-kicker">{f.kicker}</p>
          <h2 id="in-end-h">{f.endH}</h2>
          <p>{f.endP}</p>
          <ul>
            {f.points.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
          <div className="in-frame-ctas">
            <Link href="/contact?intent=website" className="btn btn-brand">
              {f.talk}
            </Link>
            <Link href="/studio#projects" className="btn">
              {f.more}
            </Link>
          </div>
          <p className="in-frame-pairs">
            <Link href="/work/build">{f.app}</Link>
          </p>
          <p className="in-frame-free">{f.free}</p>
          <DemoNav current="instant" />
        </div>
      </section>
    </div>
  );
}
