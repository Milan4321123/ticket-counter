import Link from 'next/link';
import { Mukta } from 'next/font/google';
import DemoNav from '@/components/studio/DemoNav';
import { currentLang } from '@/lib/i18nServer';
import ShopDemo from './ShopDemo';
import { FRAME, asShopLang } from './content';
import '@/app/studio/studio.css';
import './shop.css';

// Studio demo #15 (lib/projects.ts → "Online shop + owner dashboard"): "Dhaka &
// Dal" — a made-up Nepali grocery and crafts shop in Leipzig. Two sides with a
// switch: the customer's storefront (categories, search, sizes, stock badges,
// bag, pickup or delivery slot, a pickup code as a QR) and the owner's
// dashboard (KPI counts, orders per day with a 7-day average and the rush
// before Dashain and Tihar, top products, a weekday × hour heatmap, category
// share, the orders table with New → Packed → Ready → Collected and a code
// scan, stock with reorder levels, a restock reminder and CSV export,
// customers, a product editor, live orders trickling in).
//
// COUNTS ONLY: no prices, no revenue, no payment step (the shop says both are
// hidden in this demo). The operator of the studio is a student and the studio
// is free while it grows. Products, customers and orders are invented, drawn
// art only. Rules in shop.ts (tests/shopDemo.test.ts), words in content.ts.
// Nothing is sent: one localStorage key. The demo and its frame are
// translate="no", so nothing typed here reaches the site's auto-translator.

const mukta = Mukta({ weight: ['400', '600', '800'], subsets: ['devanagari', 'latin'], display: 'swap', variable: '--dd-mukta' });

const title = 'Dhaka & Dal — an online shop with an owner dashboard · demo project';
const description =
  'A demo built by MartNepali: a made-up Nepali grocery and crafts shop in Leipzig. A phone-first storefront with pickup codes and delivery slots, and an owner dashboard with orders, charts, stock and reorder levels, customers and a product editor — in English, Deutsch and नेपाली.';
const cover = {
  url: '/media/studio/projects/shop.jpg',
  width: 1200,
  height: 800,
  alt: 'Dhaka & Dal owner dashboard: order counts, orders per day with the rush before Dashain and Tihar, and the latest orders',
};

export const metadata = {
  title,
  description,
  alternates: { canonical: '/work/shop' },
  openGraph: { type: 'website', title, description, url: '/work/shop', images: [cover] },
  twitter: { card: 'summary_large_image', title, description, images: [cover.url] },
};

export default async function ShopDemoPage() {
  const lang = asShopLang(await currentLang()) ?? 'en';
  const f = FRAME[lang];
  return (
    <div className={`dd-page ${mukta.variable}`}>
      <div className="dd-frame-top" translate="no">
        <div className="dd-frame-inner">
          <span className="dd-frame-badge">{f.badge}</span>
          <span className="dd-frame-text">{f.text}</span>
          <Link href="/work" className="dd-frame-link">
            {f.all}
          </Link>
        </div>
      </div>

      <ShopDemo initialLang={lang} />

      <section className="dd-frame-end" aria-labelledby="dd-end-h" translate="no">
        <div className="dd-frame-end-inner">
          <p className="dd-frame-kicker">{f.kicker}</p>
          <h2 id="dd-end-h">{f.endH}</h2>
          <p>{f.endP}</p>
          <ul>
            {f.points.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
          <div className="dd-frame-ctas">
            <Link href="/contact?intent=app" className="btn btn-brand">
              {f.talk}
            </Link>
            <Link href="/studio#projects" className="btn">
              {f.more}
            </Link>
          </div>
          <p className="dd-frame-pairs">
            <Link href="/work/restaurant">{f.pairs}</Link>
          </p>
          <p className="dd-frame-free">{f.free}</p>
          <DemoNav current="shop" />
        </div>
      </section>
    </div>
  );
}
