import Link from 'next/link';
import DemoNav from '@/components/studio/DemoNav';
import { Cormorant_Garamond, Mukta, Rozha_One } from 'next/font/google';
import { currentLang } from '@/lib/i18nServer';
import WeddingInvite from './WeddingInvite';
import { asInviteLang } from './content';
import './wedding.css';

// Studio demo #1: a Nepali wedding invitation website (lib/projects.ts →
// "Wedding invitation website"). The couple, families and venue are made up;
// the RSVP stays in the visitor's own browser and nothing is sent anywhere.
//
// The thin MartNepali frame — the "Demo project" strip above and the "want one
// like this?" block below — is ordinary site copy (translatable, links into the
// studio); the invitation in between is marked translate="no" and has its
// own English, Deutsch and नेपाली — it starts in the site's language.
//
// No prices, quotes or packages anywhere: the operator is a student and the
// studio is offered free while it grows (see app/studio/page.tsx).

const serif = Cormorant_Garamond({
  weight: ['500', '600', '700'],
  style: ['normal', 'italic'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--wd-serif',
});
const deva = Rozha_One({ weight: '400', subsets: ['devanagari', 'latin'], display: 'swap', variable: '--wd-deva' });
const devaBody = Mukta({ weight: ['400', '600'], subsets: ['devanagari', 'latin'], display: 'swap', variable: '--wd-deva-body' });

const title = 'Wedding invitation website — demo project';
const description =
  'A Nepali wedding invitation website, built by MartNepali as a demo: countdown, programme, venue map, RSVP, add to calendar and WhatsApp sharing — in English, Deutsch and नेपाली.';
const cover = { url: '/media/studio/projects/wedding.jpg', width: 1200, height: 800, alt: 'Aarati & Sujan — a demo wedding invitation website' };

export const metadata = {
  title,
  description,
  alternates: { canonical: '/work/wedding' },
  openGraph: { type: 'website', title, description, url: '/work/wedding', images: [cover] },
  twitter: { card: 'summary_large_image', title, description, images: [cover.url] },
};

export default async function WeddingDemoPage() {
  const lang = asInviteLang(await currentLang());
  return (
    <div className={`wd-page ${serif.variable} ${deva.variable} ${devaBody.variable}`}>
      <div className="wd-frame-top">
        <div className="wd-frame-inner">
          <span className="wd-frame-badge">Demo project</span>
          <span className="wd-frame-text">
            Built by MartNepali · a made-up couple, nothing real is sent
          </span>
          <Link href="/work" className="wd-frame-link">
            ← All demos
          </Link>
        </div>
      </div>

      <WeddingInvite initialLang={lang} />

      <section className="wd-frame-end" aria-labelledby="wd-end-h">
        <div className="wd-frame-end-inner">
          <p className="wd-frame-kicker">MartNepali Studio · Demo project</p>
          <h2 id="wd-end-h">Want an invitation site like this?</h2>
          <p>
            For a Bihe, a Bratabandha, a Pasni or a big birthday: your names, your dates, your languages — with replies
            that tell you who is coming, a calendar button and a link that travels on WhatsApp.
          </p>
          <ul>
            <li>English, नेपाली or Deutsch</li>
            <li>Made for the phone first</li>
            <li>Your own colours and ornaments</li>
          </ul>
          <div className="wd-frame-ctas">
            <Link href="/contact?intent=website" className="btn btn-brand">
              Kura garau — tell us about your day
            </Link>
            <Link href="/studio#projects" className="btn">
              See all our work
            </Link>
          </div>
          <p className="wd-frame-free">Free while we grow.</p>
          <DemoNav current="wedding" />
        </div>
      </section>
    </div>
  );
}
