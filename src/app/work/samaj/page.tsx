import Link from 'next/link';
import DemoNav from '@/components/studio/DemoNav';
import { Mukta } from 'next/font/google';
import { currentLang } from '@/lib/i18nServer';
import SamajSite from './SamajSite';
import './samaj.css';

// Studio demo #6: a website kit for a Nepali association (lib/projects.ts →
// "Association website kit"). A whole site for a made-up Verein — Saathi
// Samaj Main-Neckar e.V. — on one page: programme calendar, news, committee
// and statutes, a multi-step membership form with a confirmation built in the
// browser, a members' area (card with QR, RSVPs, minutes, a poll), a gallery
// of drawn festival scenes and contact with an example Impressum. The kit bar
// re-themes it live between three looks and makes a logo, to show that every
// Nepali Verein in Europe can have a site like this. Rules in samaj.ts, words
// in content.ts; it all runs in the visitor's browser and nothing is sent.
//
// Same thin MartNepali frame as the other demos: the "Demo project" strip above
// and "want one like this?" below are ordinary site copy; the association's
// site in between is translate="no" and switches English / Deutsch / नेपाली
// itself (starting in the visitor's site language).
//
// No prices, fees, dues, bank details, quotes or packages anywhere — not even
// for the made-up association: the operator is a student and the studio is
// free while it grows.

const mukta = Mukta({ weight: ['400', '500', '600', '700', '800'], subsets: ['devanagari', 'latin'], display: 'swap', variable: '--sj-mukta' });

const title = 'Association website kit — demo project';
const description =
  'A website for a Nepali association (Verein), built by MartNepali as a demo: programme calendar, news, committee and statutes, a membership form, a members’ area with a QR card, RSVPs and polls, a gallery and contact — three looks, a logo maker, in English, Deutsch and नेपाली.';
const cover = {
  url: '/media/studio/projects/samaj.jpg',
  width: 1200,
  height: 800,
  alt: 'A website for a made-up Nepali association: an emblem with mountains, the next festival and the 2027 programme',
};

export const metadata = {
  title,
  description,
  alternates: { canonical: '/work/samaj' },
  openGraph: { type: 'website', title, description, url: '/work/samaj', images: [cover] },
  twitter: { card: 'summary_large_image', title, description, images: [cover.url] },
};

export default async function SamajDemoPage() {
  const lang = await currentLang();
  return (
    <div className={`sj-page ${mukta.variable}`}>
      <div className="sj-frame-top">
        <div className="sj-frame-inner">
          <span className="sj-frame-badge">Demo project</span>
          <span className="sj-frame-text">Built by MartNepali · a made-up association, nothing is sent</span>
          <Link href="/work" className="sj-frame-link">
            ← All demos
          </Link>
        </div>
      </div>

      <SamajSite initialLang={lang} />

      <section className="sj-frame-end" aria-labelledby="sj-end-h">
        <div className="sj-frame-end-inner">
          <p className="sj-frame-kicker">MartNepali Studio · Demo project</p>
          <h2 id="sj-end-h">Want a website like this for your association?</h2>
          <p>
            For a Samaj, a Verein, a youth group or a cultural society anywhere in Europe: your programme, your
            committee and your members — in your colours, with your logo, in the languages your members read.
          </p>
          <ul>
            <li>Programme, news and gallery</li>
            <li>Membership form and members’ area</li>
            <li>English, Deutsch and नेपाली</li>
          </ul>
          <div className="sj-frame-ctas">
            <Link href="/contact?intent=website" className="btn btn-brand">
              Kura garau
            </Link>
            <Link href="/studio#projects" className="btn">
              See all our work
            </Link>
          </div>
          <p className="sj-frame-free">Free while we grow.</p>
          <DemoNav current="samaj" />
        </div>
      </section>
    </div>
  );
}
