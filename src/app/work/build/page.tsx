import Link from 'next/link';
import { Mukta } from 'next/font/google';
import { currentLang } from '@/lib/i18nServer';
import { t } from '@/lib/i18n';
import BuildIdea from './BuildIdea';
import { COPY } from './content';
import '@/app/studio/studio.css';
import './build.css';

// /work/build — "Build your idea": a playful configurator, not a demo
// project. A visitor picks what they are, a name, a colour and what it should
// do; a phone (and a laptop, for a website) assembles itself live; the idea
// fits in a link, downloads as a picture, and opens the contact chat with it
// written in (never sent by itself — see components/CreatorChat).
//
// It is a tool, so it is not in lib/projects.ts (that list is projects and
// their demos); /work, /studio and the homepage's demo strip link to it
// through components/studio/BuildIdeaCard and DemoStrip.
//
// The builder is translate="no": it carries its own English / Deutsch /
// नेपाली, and the idea's name and tagline a visitor types must never reach
// the site's auto-translator (components/AutoTranslate → /api/translate).
// tools/qa/translate-leak.mjs checks every /work route.
//
// An idea sketch only: no prices, estimates, budgets, timelines or packages
// anywhere — the operator is a student and the studio is free while it grows.

const mukta = Mukta({ weight: ['400', '500', '600', '700', '800'], subsets: ['devanagari', 'latin'], display: 'swap', variable: '--bd-mukta' });

const title = 'Build your idea — sketch your app or website';
const description =
  'Pick what you are — a restaurant, a shop, a Verein, an artist, an organizer or a school — name it, choose a colour and switch on features. Watch a phone and a laptop sketch build themselves, then send the idea to MartNepali in one tap. Free while we grow.';
const cover = {
  url: '/media/studio/projects/build.jpg',
  width: 1200,
  height: 800,
  alt: 'The MartNepali idea builder: a phone sketch of a restaurant app with a menu, QR table ordering and a chat, beside the steps to build it',
};

export const metadata = {
  title,
  description,
  alternates: { canonical: '/work/build' },
  openGraph: { type: 'website', title, description, url: '/work/build', images: [cover] },
  twitter: { card: 'summary_large_image', title, description, images: [cover.url] },
};

export default async function BuildPage() {
  const lang = await currentLang();
  const c = COPY[lang];
  return (
    <div className={`bd-page ${mukta.variable}`}>
      <section className="bd-hero-top">
        <div className="container">
          <p className="feed-kicker anim-fade-up">{c.kicker}</p>
          <h1 className="anim-fade-up anim-d1">{c.h1}</h1>
          <p className="bd-lead anim-fade-up anim-d2">{c.sub}</p>
        </div>
      </section>
      <div className="container">
        <BuildIdea initialLang={lang} font={mukta.style.fontFamily} />
      </div>
      <section className="section sh-section bd-end">
        <div className="container">
          <p className="wk-real">
            <Link href="/work">{t(lang, 'pf.gallery')}</Link>
            {' · '}
            <Link href="/studio#projects">{t(lang, 'st.allWork')}</Link>
          </p>
        </div>
      </section>
    </div>
  );
}
