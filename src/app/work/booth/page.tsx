import Link from 'next/link';
import { Baloo_2, Mukta } from 'next/font/google';
import DemoNav from '@/components/studio/DemoNav';
import { currentLang } from '@/lib/i18nServer';
import PhotoBooth from './PhotoBooth';
import { FRAME } from './content';
import '@/app/studio/studio.css';
import './booth.css';

// Studio demo #10 (lib/projects.ts → "Event photo booth"): what an organizer
// puts on a QR code at the door. Guests take a selfie (or pick a photo, or use
// the drawn sample), put it in a festive frame — Dashain, Tihar, Teej, Nepali
// New Year, a concert night, a wedding — add stickers and a filter, and save
// or share it as a square, story, 4×6 print or a three-shot photo strip. The
// organizer side sets the frame, words and logo and makes an A4 QR poster.
//
// Client-side only: the camera starts after a tap and stops right after the
// shots; photos are never uploaded; thumbnails for the "live wall" stay in
// localStorage under one key ("Reset demo"). Rules in booth.ts (with tests),
// words in content.ts, every picture drawn in draw.ts — no bundled images.
//
// The demo (and its localized frame) is translate="no": it carries its own
// English / Deutsch / नेपाली, and what a visitor types into it — the event name, a greeting, a hashtag —
// must never reach the site's auto-translator (components/AutoTranslate →
// /api/translate). tools/qa/translate-leak.mjs checks every /work route.
//
// No prices, packages or "hire" wording anywhere — the operator is a student
// and the studio is free while it grows.

const mukta = Mukta({ weight: ['400', '500', '600', '700', '800'], subsets: ['devanagari', 'latin'], display: 'swap', variable: '--pb-mukta-f' });
const baloo = Baloo_2({ weight: ['600', '700', '800'], subsets: ['devanagari', 'latin'], display: 'swap', variable: '--pb-baloo-f' });

const title = 'Event photo booth · demo project';
const description =
  'A demo built by MartNepali: a photo booth for your event’s QR code. Take a selfie or pick a photo, put it in a Dashain, Tihar, Teej, New Year, concert or wedding frame, add stickers, and share it — square, story, 4×6 print or a photo strip. In English, Deutsch and नेपाली; photos never leave your phone.';
const cover = {
  url: '/media/studio/projects/booth.jpg',
  width: 1200,
  height: 800,
  alt: 'The MartNepali photo booth: a festival photo in a Dashain frame with a dhaka topi, a “Wo-ho!” bubble and the size chips square, story and print',
};

export const metadata = {
  title,
  description,
  alternates: { canonical: '/work/booth' },
  openGraph: { type: 'website', title, description, url: '/work/booth', images: [cover] },
  twitter: { card: 'summary_large_image', title, description, images: [cover.url] },
};

export default async function BoothDemoPage() {
  const lang = await currentLang();
  const f = FRAME[lang];
  return (
    <div className={`pb-page ${mukta.variable} ${baloo.variable}`}>
      <div className="pb-frame-top" translate="no">
        <div className="pb-frame-inner">
          <span className="pb-frame-badge">{f.badge}</span>
          <span className="pb-frame-text">{f.text}</span>
          <Link href="/work" className="pb-frame-link">
            {f.all}
          </Link>
        </div>
      </div>

      <PhotoBooth initialLang={lang} fonts={{ mukta: mukta.style.fontFamily, baloo: baloo.style.fontFamily }} />

      <section className="pb-frame-end" aria-labelledby="pb-end-h" translate="no">
        <div className="pb-frame-end-inner">
          <p className="pb-frame-kicker">{f.kicker}</p>
          <h2 id="pb-end-h">{f.endH}</h2>
          <p>{f.endP}</p>
          <ul>
            {f.points.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          <div className="pb-frame-ctas">
            <Link href="/contact?intent=app" className="btn btn-brand">
              {f.talk}
            </Link>
            <Link href="/studio#projects" className="btn">
              {f.more}
            </Link>
          </div>
          <p className="pb-frame-free">{f.free}</p>
          <DemoNav current="booth" />
        </div>
      </section>
    </div>
  );
}
