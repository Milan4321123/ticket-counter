import Link from 'next/link';
import { Barlow_Condensed, Mukta } from 'next/font/google';
import DemoNav from '@/components/studio/DemoNav';
import { currentLang } from '@/lib/i18nServer';
import CupApp from './CupApp';
import { FRAME } from './content';
import '@/app/studio/studio.css';
import './cup.css';

// Studio demo #12 (lib/projects.ts → "Futsal tournament app"): "Himal Cup
// 2027", a made-up one-day futsal cup for Nepali community clubs in Germany,
// in a hall in Offenbach. Eight invented teams in two groups, semi-finals, a
// match for third place and a final on two pitches. Fans get simulated live
// scores (minute clock, goals, cards, subs; 1× / 10× / 60×, pause), group
// tables that sort themselves with every tie-breaker, the bracket filling in
// (shoot-outs as ✓ ✗ dots), top scorers and fair play, fixtures by pitch,
// "follow a team" with in-page goal notes and a team registration form. The
// referee desk takes a match over (goals with a scorer, cards, the whistle,
// undo) and the hall TV gets a full-screen big screen (Escape exits).
//
// Client-side only: the simulation is seeded, pauses while the tab is hidden,
// and everything stays in localStorage under one key ("Reset demo"). Rules in
// cup.ts (tests/futsalCup.test.ts), words in content.ts, drawings in art.tsx.
//
// No entry fees, prizes with a value, bets, odds or "hire" wording anywhere —
// a trophy and medals only: the operator is a student and the studio is free
// while it grows.

const mukta = Mukta({ weight: ['400', '500', '600', '700', '800'], subsets: ['devanagari', 'latin'], display: 'swap', variable: '--cu-mukta-f' });
const barlow = Barlow_Condensed({ weight: ['600', '700', '800'], subsets: ['latin'], display: 'swap', variable: '--cu-barlow-f' });

const title = 'Futsal tournament app · demo project';
const description =
  'A demo built by MartNepali: an app for a community futsal tournament. Live scores with a minute clock, group tables that sort themselves, the knockout bracket filling in, top scorers, a referee desk with goal and card buttons and a big screen for the hall TV. In English, Deutsch and नेपाली.';
const cover = {
  url: '/media/studio/projects/cup.jpg',
  width: 1200,
  height: 800,
  alt: 'The Himal Cup 2027 demo app: two live futsal matches with their events, both group tables and the knockout bracket',
};

export const metadata = {
  title,
  description,
  alternates: { canonical: '/work/cup' },
  openGraph: { type: 'website', title, description, url: '/work/cup', images: [cover] },
  twitter: { card: 'summary_large_image', title, description, images: [cover.url] },
};

export default async function CupDemoPage() {
  const lang = await currentLang();
  const f = FRAME[lang];
  const fonts = `${mukta.variable} ${barlow.variable}`;
  return (
    <div className={`cu-page ${fonts}`}>
      <div className="cu-frame-top" translate="no">
        <div className="cu-frame-inner">
          <span className="cu-frame-badge">{f.badge}</span>
          <span className="cu-frame-text">{f.text}</span>
          <Link href="/work" className="cu-frame-link">
            {f.all}
          </Link>
        </div>
      </div>

      <CupApp initialLang={lang} fontClass={fonts} />

      <section className="cu-frame-end" aria-labelledby="cu-end-h" translate="no">
        <div className="cu-frame-end-inner">
          <p className="cu-frame-kicker">{f.kicker}</p>
          <h2 id="cu-end-h">{f.endH}</h2>
          <p>{f.endP}</p>
          <ul>
            {f.points.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          <div className="cu-frame-ctas">
            <Link href="/contact?intent=app" className="btn btn-brand">
              {f.talk}
            </Link>
            <Link href="/studio#projects" className="btn">
              {f.more}
            </Link>
          </div>
          <p className="cu-frame-free">{f.free}</p>
          <DemoNav current="cup" />
        </div>
      </section>
    </div>
  );
}
