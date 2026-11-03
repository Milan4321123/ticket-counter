import Link from 'next/link';
import { Mukta } from 'next/font/google';
import DemoNav from '@/components/studio/DemoNav';
import { currentLang } from '@/lib/i18nServer';
import RadioApp from './RadioApp';
import { FRAME, asRadioLang } from './content';
import '@/app/studio/studio.css';
import './radio.css';

// Studio demo #14 (lib/projects.ts → "Nepali radio + podcast site"): "Dui
// Kinara Radio" — a made-up Nepali community radio in Europe (dui kinara =
// two shores). A live player that stays at the bottom of the page while you
// browse, with an ON AIR show, a now-playing ticker, a visualizer and
// lock-screen controls; the week's programme with what is on now (station
// time, Kathmandu time beside it); podcast episodes with chapters, a
// waveform to tap, 1×/1.25×/1.5×, ±15 s and resume; song requests and
// shout-outs; generic subscribe buttons.
//
// The audio is ORIGINAL and generative (stream.ts, from the bars radio.ts
// describes) — no stream, no recordings, nothing fetched. Hosts are made-up
// first names with drawn avatars. Rules in radio.ts
// (tests/radioStation.test.ts), words in content.ts, drawings in art.tsx.
//
// Nothing is sent: requests, reminders and episode progress live in one
// localStorage key. The app and its frame are translate="no", so the site's
// AutoTranslate never sends what a visitor types (or a shout-out shown back)
// anywhere. No prices, ads or donations anywhere — the operator is a student
// and the studio is free while it grows.

const mukta = Mukta({ weight: ['400', '600', '800'], subsets: ['devanagari', 'latin'], display: 'swap', variable: '--rd-mukta' });

const title = 'Dui Kinara Radio — a Nepali radio + podcast site · demo project';
const description =
  'A demo built by MartNepali: a made-up Nepali community radio in Europe. A live player that keeps playing while you browse, the week’s programme with what is on now, podcast episodes with chapters and resume, song requests — in English, Deutsch and नेपाली.';
const cover = {
  url: '/media/studio/projects/radio.jpg',
  width: 1200,
  height: 800,
  alt: 'Dui Kinara Radio: the full live player with the show on air, the weekly programme and the podcast episodes',
};

export const metadata = {
  title,
  description,
  alternates: { canonical: '/work/radio' },
  openGraph: { type: 'website', title, description, url: '/work/radio', images: [cover] },
  twitter: { card: 'summary_large_image', title, description, images: [cover.url] },
};

export default async function RadioDemoPage() {
  const lang = asRadioLang(await currentLang()) ?? 'en';
  const f = FRAME[lang];
  return (
    <div className={`rd-page ${mukta.variable}`}>
      <div className="rd-frame-top" translate="no">
        <div className="rd-frame-inner">
          <span className="rd-frame-badge">{f.badge}</span>
          <span className="rd-frame-text">{f.text}</span>
          <Link href="/work" className="rd-frame-link">
            {f.all}
          </Link>
        </div>
      </div>

      <RadioApp initialLang={lang} />

      <section className="rd-frame-end" aria-labelledby="rd-end-h" translate="no">
        <div className="rd-frame-end-inner">
          <p className="rd-frame-kicker">{f.kicker}</p>
          <h2 id="rd-end-h">{f.endH}</h2>
          <p>{f.endP}</p>
          <ul>
            {f.points.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
          <div className="rd-frame-ctas">
            <Link href="/contact?intent=website" className="btn btn-brand">
              {f.talk}
            </Link>
            <Link href="/studio#projects" className="btn">
              {f.more}
            </Link>
          </div>
          <p className="rd-frame-pairs">
            <Link href="/work/artist">{f.pairs}</Link>
          </p>
          <p className="rd-frame-free">{f.free}</p>
          <DemoNav current="radio" />
        </div>
      </section>
    </div>
  );
}
