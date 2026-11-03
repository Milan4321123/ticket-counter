import Link from 'next/link';
import DemoNav from '@/components/studio/DemoNav';
import { Mukta } from 'next/font/google';
import { currentLang } from '@/lib/i18nServer';
import RestaurantDemo from './RestaurantDemo';
import '@/app/studio/studio.css';
import './restaurant.css';

// Studio demo #7: QR table ordering (lib/projects.ts → "QR table ordering")
// for a made-up Nepali restaurant in Köln. One page, three synchronized views:
// the guest's phone at table 7 (menu, options, cart, "send to kitchen", a live
// order tracker, call waiter, order summary), the kitchen board (New → Cooking
// → Ready, timers, stations, a bump sound) and the waiter / owner (floor plan
// with alerts, today's counts, sold-out switches, a printable QR sheet). The
// other tables are simulated. Rules in order.ts, words in content.ts; it all
// runs in the visitor's browser and nothing is sent.
//
// The same family as the real restaurant pack on MartNepali (order ahead, the
// kitchen board in the portal, a QR on every table) — but standalone: no server
// code, no database.
//
// Same thin MartNepali frame as the other demos. No prices, totals, tips or
// payments anywhere — the menu says "Prices hidden in this demo" and the "bill"
// is an order summary: the operator is a student and the studio is free while
// it grows.

const mukta = Mukta({ weight: ['400', '500', '600', '700', '800'], subsets: ['devanagari', 'latin'], display: 'swap', variable: '--rq-mukta' });

const title = 'QR table ordering for restaurants — demo project';
const description =
  'QR table ordering for a Nepali restaurant, built by MartNepali as a demo: guests scan the code on their table, order momo and thali from their phone and follow it live; the kitchen board moves every ticket, and the waiter sees the floor plan, calls and sold-out dishes — in English, Deutsch and नेपाली.';
const cover = {
  url: '/media/studio/projects/restaurant-demo.jpg',
  width: 1200,
  height: 800,
  alt: 'QR table ordering for a made-up Nepali restaurant in Köln: a guest phone menu, a kitchen board with tickets and a floor plan of twelve tables',
};

export const metadata = {
  title,
  description,
  alternates: { canonical: '/work/restaurant' },
  openGraph: { type: 'website', title, description, url: '/work/restaurant', images: [cover] },
  twitter: { card: 'summary_large_image', title, description, images: [cover.url] },
};

export default async function RestaurantDemoPage() {
  const lang = await currentLang();
  return (
    <div className={`rq-page ${mukta.variable}`}>
      <div className="rq-frame-top">
        <div className="rq-frame-inner">
          <span className="rq-frame-badge">Demo project</span>
          <span className="rq-frame-text">Built by MartNepali · a made-up restaurant, nothing is sent</span>
          <Link href="/work" className="rq-frame-link">
            ← All demos
          </Link>
        </div>
      </div>

      <RestaurantDemo initialLang={lang} fontClass={mukta.variable} />

      <section className="rq-frame-end" aria-labelledby="rq-end-h">
        <div className="rq-frame-end-inner">
          <p className="rq-frame-kicker">MartNepali Studio · Demo project</p>
          <h2 id="rq-end-h">Want QR ordering for your restaurant?</h2>
          <p>
            For a momo house, a Nepali or Indian restaurant, a café or a festival food stall: your menu in your languages,
            a QR code on every table, a kitchen board on a tablet and the floor plan on the waiter’s phone.
          </p>
          <ul>
            <li>Guests order from the table</li>
            <li>A live kitchen board</li>
            <li>
              English, Deutsch and <span lang="ne">नेपाली</span>
            </li>
          </ul>
          <div className="rq-frame-ctas">
            <Link href="/contact?intent=app" className="btn btn-brand">
              Kura garau
            </Link>
            <Link href="/studio#projects" className="btn">
              See all our work
            </Link>
          </div>
          <p className="rq-frame-free">Free while we grow.</p>
          <DemoNav current="tables" />
        </div>
      </section>
    </div>
  );
}
