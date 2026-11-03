import Link from 'next/link';
import { Baloo_2, Mukta } from 'next/font/google';
import DemoNav from '@/components/studio/DemoNav';
import { currentLang } from '@/lib/i18nServer';
import MomoTruck from './MomoTruck';
import { FRAME } from './content';
import '@/app/studio/studio.css';
import './momo.css';

// Studio demo #11 (lib/projects.ts → "Momo food-truck app"): a made-up Nepali
// momo truck, "Momo Gaadi", touring Mainz, Wiesbaden and Darmstadt. The
// customer's phone shows where the truck is right now on a drawn map (no map
// service), the week's stops with "tell me when it arrives", ordering ahead
// into 10-minute pickup slots that fill up, a pickup number with a QR code and
// a live queue position, the "your momo are ready!" moment and a stamp card
// that earns a Momo Master badge. The crew's tablet has the queue board, three
// steamers, a simulated scanner, pause / sold-out / slot-size switches, "move
// to next stop" and a full-screen "Now serving" display for the truck window.
//
// Client-side only: other customers are simulated (capped), the day runs 12×
// faster and pauses while the tab is hidden, and everything stays in
// localStorage under one key ("Reset demo"). Rules in truck.ts (with tests),
// words in content.ts, drawings in art.tsx.
//
// No prices, payments, discounts or "hire" wording anywhere — the menu says
// "Prices hidden in this demo" and the stamp card gives a badge, nothing with a
// value: the operator is a student and the studio is free while it grows.

const mukta = Mukta({ weight: ['400', '500', '600', '700', '800'], subsets: ['devanagari', 'latin'], display: 'swap', variable: '--mt-mukta-f' });
const baloo = Baloo_2({ weight: ['600', '700', '800'], subsets: ['devanagari', 'latin'], display: 'swap', variable: '--mt-baloo-f' });

const title = 'Momo food-truck app · demo project';
const description =
  'A demo built by MartNepali: an app for a momo food truck. See where the truck is today on a live route map, get a note when it reaches your stop, order ahead into a pickup slot, follow your number in the queue — and the crew’s tablet with the queue board, steamers and a “Now serving” screen. In English, Deutsch and नेपाली.';
const cover = {
  url: '/media/studio/projects/momo.jpg',
  width: 1200,
  height: 800,
  alt: 'The Momo Gaadi demo app: a drawn map of Mainz, Wiesbaden and Darmstadt with the truck on its route, a pickup number with a QR code and the crew’s queue board',
};

export const metadata = {
  title,
  description,
  alternates: { canonical: '/work/momo' },
  openGraph: { type: 'website', title, description, url: '/work/momo', images: [cover] },
  twitter: { card: 'summary_large_image', title, description, images: [cover.url] },
};

export default async function MomoDemoPage() {
  const lang = await currentLang();
  const f = FRAME[lang];
  const fonts = `${mukta.variable} ${baloo.variable}`;
  return (
    <div className={`mt-page ${fonts}`}>
      <div className="mt-frame-top" translate="no">
        <div className="mt-frame-inner">
          <span className="mt-frame-badge">{f.badge}</span>
          <span className="mt-frame-text">{f.text}</span>
          <Link href="/work" className="mt-frame-link">
            {f.all}
          </Link>
        </div>
      </div>

      <MomoTruck initialLang={lang} fontClass={fonts} />

      <section className="mt-frame-end" aria-labelledby="mt-end-h" translate="no">
        <div className="mt-frame-end-inner">
          <p className="mt-frame-kicker">{f.kicker}</p>
          <h2 id="mt-end-h">{f.endH}</h2>
          <p>{f.endP}</p>
          <ul>
            {f.points.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          <div className="mt-frame-ctas">
            <Link href="/contact?intent=app" className="btn btn-brand">
              {f.talk}
            </Link>
            <Link href="/studio#projects" className="btn">
              {f.more}
            </Link>
          </div>
          <p className="mt-frame-free">{f.free}</p>
          <DemoNav current="momo" />
        </div>
      </section>
    </div>
  );
}
