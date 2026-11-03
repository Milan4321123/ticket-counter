import Link from 'next/link';
import DemoNav from '@/components/studio/DemoNav';
import { Baloo_2 } from 'next/font/google';
import { currentLang } from '@/lib/i18nServer';
import KiteGame from './KiteGame';
import { asKiteLang } from './content';
import '@/app/studio/studio.css';
import './kite.css';

// Studio demo #8: an original browser game (lib/projects.ts → "Changa Chet!").
// Dashain is kite season in Nepal: whole families on the rooftops, strings
// crossing over the valley and a shout of "Chet!" when one is cut. This is a
// small canvas game about that — hold to pull, let go to let the kite spin,
// saw through the other flyers' strings, mind the birds and the power lines.
// Rules in kite.ts (with tests), drawing in draw.ts, sounds made live in
// sound.ts. It runs in the visitor's browser; nothing is sent, the best score
// stays in localStorage.
//
// The name, the art and the rooftop flyers are made up for this page. Same
// thin MartNepali frame as the other demos. No prices, coins, purchases or
// packages anywhere — the operator is a student and the studio is free while
// it grows.

const baloo = Baloo_2({ weight: ['500', '600', '700', '800'], subsets: ['devanagari', 'latin'], display: 'swap', variable: '--kt-baloo' });

const title = 'Changa Chet! — a Dashain kite-fighting game · demo project';
const description =
  'An original browser game built by MartNepali as a demo: fly a kite from a Kathmandu rooftop at Dashain, cross strings with the other flyers and shout “Chet!” — one-tap controls on the phone, keyboard on the laptop, in English, Deutsch and नेपाली.';
const cover = {
  url: '/media/studio/projects/kite.jpg',
  width: 1200,
  height: 800,
  alt: 'Changa Chet!: kites over Kathmandu rooftops at Dashain, a "CHET!" as one string is cut, Himalaya in the distance',
};

export const metadata = {
  title,
  description,
  alternates: { canonical: '/work/kite' },
  openGraph: { type: 'website', title, description, url: '/work/kite', images: [cover] },
  twitter: { card: 'summary_large_image', title, description, images: [cover.url] },
};

export default async function KiteDemoPage() {
  const lang = asKiteLang(await currentLang()) ?? 'en';
  return (
    <div className={`kt-page ${baloo.variable}`}>
      <div className="kt-frame-top">
        <div className="kt-frame-inner">
          <span className="kt-frame-badge">Demo project</span>
          <span className="kt-frame-text">Built by MartNepali · an original game, the flyers are made up</span>
          <Link href="/work" className="kt-frame-link">
            ← All demos
          </Link>
        </div>
      </div>

      <KiteGame initialLang={lang} font={baloo.style.fontFamily} />

      <section className="kt-frame-end" aria-labelledby="kt-end-h">
        <div className="kt-frame-end-inner">
          <p className="kt-frame-kicker">MartNepali Studio · Demo project</p>
          <h2 id="kt-end-h">Want a game like this for your festival or brand?</h2>
          <p>
            A small game people play on their phones and share: for a Dashain or Tihar night, a Nepali New Year stall, a
            school fair or your own brand — your theme, your characters, your languages.
          </p>
          <ul>
            <li>Plays in the browser, no app store</li>
            <li>Touch and keyboard</li>
            <li>Share-your-score pictures</li>
          </ul>
          <div className="kt-frame-ctas">
            <Link href="/contact?intent=app" className="btn btn-brand">
              Kura garau
            </Link>
            <Link href="/studio#projects" className="btn">
              See all our work
            </Link>
          </div>
          <p className="kt-frame-free">Free while we grow.</p>
          <DemoNav current="kite" />
        </div>
      </section>
    </div>
  );
}
