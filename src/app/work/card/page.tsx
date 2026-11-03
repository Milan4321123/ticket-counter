import Link from 'next/link';
import { Baloo_2, Mukta } from 'next/font/google';
import DemoNav from '@/components/studio/DemoNav';
import { currentLang } from '@/lib/i18nServer';
import CardMaker from './CardMaker';
import { FRAME } from './content';
import '@/app/studio/studio.css';
import './card.css';

// Studio demo #9 (lib/projects.ts → "Link page & business card maker"): a
// "one link for everything" page and a digital business card for a momo
// stall, a tutor, a DJ or an artist, made in a minute with a live phone
// preview. Rules in card.ts (with tests), words and the made-up starter
// templates in content.ts, the downloadable pictures in draw.ts.
//
// It all runs in the visitor's browser: the state lives in localStorage
// (one key, "Reset demo"), a photo is made small on a canvas and never
// uploaded, and "Publish" is simulated — it packs the page into the link's
// #hash, and opening that link shows the page read-only.
//
// The demo (and its localized frame) is translate="no": it carries its own
// English / Deutsch / नेपाली, and what a visitor types into it — a name, a bio, link titles —
// must never reach the site's auto-translator (components/AutoTranslate →
// /api/translate). tools/qa/translate-leak.mjs checks every /work route.
//
// No prices, packages or "hire" wording anywhere — the operator is a student
// and the studio is free while it grows.

const mukta = Mukta({ weight: ['400', '500', '600', '700', '800'], subsets: ['devanagari', 'latin'], display: 'swap', variable: '--cm-mukta-f' });
const baloo = Baloo_2({ weight: ['600', '700', '800'], subsets: ['devanagari', 'latin'], display: 'swap', variable: '--cm-baloo-f' });

const title = 'Link page & business card maker · demo project';
const description =
  'A demo built by MartNepali: make a “one link for everything” page and a digital business card for a momo stall, a Nepali tutor, a DJ or an artist — live phone preview, six themes, a flipping QR card, a contact file, in English, Deutsch and नेपाली. Everything stays in your browser.';
const cover = {
  url: '/media/studio/projects/card.jpg',
  width: 1200,
  height: 800,
  alt: 'The MartNepali link page maker: an editor with links, a phone showing a momo stall’s link page, and a business card flipped to its QR code',
};

export const metadata = {
  title,
  description,
  alternates: { canonical: '/work/card' },
  openGraph: { type: 'website', title, description, url: '/work/card', images: [cover] },
  twitter: { card: 'summary_large_image', title, description, images: [cover.url] },
};

export default async function CardDemoPage() {
  const lang = await currentLang();
  const f = FRAME[lang];
  return (
    <div className={`cm-page ${mukta.variable} ${baloo.variable}`}>
      <div className="cm-frame-top" translate="no">
        <div className="cm-frame-inner">
          <span className="cm-frame-badge">{f.badge}</span>
          <span className="cm-frame-text">{f.text}</span>
          <Link href="/work" className="cm-frame-link">
            {f.all}
          </Link>
        </div>
      </div>

      <CardMaker initialLang={lang} fonts={{ mukta: mukta.style.fontFamily, baloo: baloo.style.fontFamily }} />

      <section className="cm-frame-end" aria-labelledby="cm-end-h" translate="no">
        <div className="cm-frame-end-inner">
          <p className="cm-frame-kicker">{f.kicker}</p>
          <h2 id="cm-end-h">{f.endH}</h2>
          <p>{f.endP}</p>
          <ul>
            {f.points.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          <div className="cm-frame-ctas">
            <Link href="/contact?intent=website" className="btn btn-brand">
              {f.talk}
            </Link>
            <Link href="/studio#projects" className="btn">
              {f.more}
            </Link>
          </div>
          <p className="cm-frame-free">{f.free}</p>
          <DemoNav current="card" />
        </div>
      </section>
    </div>
  );
}
