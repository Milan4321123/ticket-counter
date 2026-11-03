import Link from 'next/link';
import { Baloo_2 } from 'next/font/google';
import DemoNav from '@/components/studio/DemoNav';
import { currentLang } from '@/lib/i18nServer';
import AbcApp from './AbcApp';
import { FRAME, asAbcLang } from './content';
import '@/app/studio/studio.css';
import './abc.css';

// Studio demo #13 (lib/projects.ts → "Kids' Nepali alphabet app"): "Ka Kha
// Ga", for children of Nepali families growing up in Europe (about 4 to 9)
// who speak German or English every day and want to read and write
// Devanagari. The 13 vowels and 36 consonants with a drawn picture word each,
// spoken by the device's own voice on a tap (or a look-and-say mode when it
// has none), tracing over the real font glyph with 1–3 stars, three small
// games (balloons, picture matching, word building) and a sticker book with
// Habre, an original little red panda. A parent corner behind a
// press-and-hold shows progress, sets the helper language and resets.
//
// Baloo 2 carries the Devanagari (its conjuncts क्ष त्र ज्ञ are proper
// ligatures), and the tracing guide is that same glyph drawn to a canvas.
// Rules in abc.ts (tests/abcLetters.test.ts), helper words in content.ts,
// drawings in art.tsx, voice and chimes in sound.ts.
//
// Child-safe: no account, no data collection, nothing sent, one localStorage
// key. No prices, purchases, coins or ads anywhere — the operator is a
// student and the studio is free while it grows.

const baloo = Baloo_2({ weight: ['500', '600', '700', '800'], subsets: ['devanagari', 'latin'], display: 'swap', variable: '--kk-baloo' });

const title = 'Ka Kha Ga — a kids’ Nepali alphabet app · demo project';
const description =
  'A demo built by MartNepali: a Nepali alphabet app for children growing up in Europe. Every letter with a picture word and sound, tracing with stars, three little games and a sticker book, a parent corner — helper text in English, Deutsch and नेपाली.';
const cover = {
  url: '/media/studio/projects/abc.jpg',
  width: 1200,
  height: 800,
  alt: 'Ka Kha Ga: the Nepali letter grid with picture words, a traced letter with three stars and Habre the red panda',
};

export const metadata = {
  title,
  description,
  alternates: { canonical: '/work/abc' },
  openGraph: { type: 'website', title, description, url: '/work/abc', images: [cover] },
  twitter: { card: 'summary_large_image', title, description, images: [cover.url] },
};

export default async function AbcDemoPage() {
  const lang = asAbcLang(await currentLang()) ?? 'en';
  const f = FRAME[lang];
  return (
    <div className={`kk-page ${baloo.variable}`}>
      <div className="kk-frame-top" translate="no">
        <div className="kk-frame-inner">
          <span className="kk-frame-badge">{f.badge}</span>
          <span className="kk-frame-text">{f.text}</span>
          <Link href="/work" className="kk-frame-link">
            {f.all}
          </Link>
        </div>
      </div>

      <AbcApp initialLang={lang} family={baloo.style.fontFamily} fontClass={baloo.variable} />

      <section className="kk-frame-end" aria-labelledby="kk-end-h" translate="no">
        <div className="kk-frame-end-inner">
          <p className="kk-frame-kicker">{f.kicker}</p>
          <h2 id="kk-end-h">{f.endH}</h2>
          <p>{f.endP}</p>
          <ul>
            {f.points.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
          <div className="kk-frame-ctas">
            <Link href="/contact?intent=app" className="btn btn-brand">
              {f.talk}
            </Link>
            <Link href="/studio#projects" className="btn">
              {f.more}
            </Link>
          </div>
          <p className="kk-frame-pairs">
            <Link href="/work/classes">{f.pairs}</Link>
          </p>
          <p className="kk-frame-free">{f.free}</p>
          <DemoNav current="abc" />
        </div>
      </section>
    </div>
  );
}
