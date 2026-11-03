import Link from 'next/link';
import DemoNav from '@/components/studio/DemoNav';
import { Baloo_2 } from 'next/font/google';
import { currentLang } from '@/lib/i18nServer';
import QuizGame from './QuizGame';
import { asQuizLang } from './content';
import '@/app/studio/studio.css';
import './quiz.css';

// Studio demo #3: a live event quiz (lib/projects.ts → "Live event quiz") — the
// kind of game a Nepali community night runs between acts. A projector view
// for the hall and a phone for each player, side by side; the other players
// are simulated and everything runs in the visitor's browser (no server, no
// sockets, nothing sent or stored beyond a nickname in localStorage).
//
// Same thin MartNepali frame as /work/wedding and /work/artist: the "Demo
// project" strip above and "want one like this?" below are ordinary site copy;
// the quiz in between is translate="no" and has its own English, Deutsch and
// नेपाली — it starts in the site's language.
//
// No prices, quotes or packages anywhere: the operator is a student and the
// studio is offered free while it grows (see app/studio/page.tsx).

// Baloo 2 is drawn for Devanagari and Latin alike, so every language shares one
// round, game-show face (and its Devanagari digits are real ones).
const baloo = Baloo_2({ weight: ['500', '600', '700', '800'], subsets: ['devanagari', 'latin'], display: 'swap', variable: '--qz-font' });

const title = 'Live event quiz — demo project';
const description =
  'A live quiz for a community night, built by MartNepali as a demo: a big-screen host view with a QR code to join, players answering on their phones, countdowns, answer charts, an animated leaderboard and a podium — in English, Deutsch and नेपाली.';
const cover = { url: '/media/studio/projects/quiz.jpg', width: 1200, height: 800, alt: 'A live quiz demo: a big screen with a Nepali culture question beside a phone with four answer buttons' };

export const metadata = {
  title,
  description,
  alternates: { canonical: '/work/quiz' },
  openGraph: { type: 'website', title, description, url: '/work/quiz', images: [cover] },
  twitter: { card: 'summary_large_image', title, description, images: [cover.url] },
};

export default async function QuizDemoPage() {
  const lang = asQuizLang(await currentLang());
  return (
    <div className={`qz-page ${baloo.variable}`}>
      <div className="qz-frame-top">
        <div className="qz-frame-inner">
          <span className="qz-frame-badge">Demo project</span>
          <span className="qz-frame-text">Built by MartNepali · the other players are simulated, nothing is sent</span>
          <Link href="/work" className="qz-frame-link">
            ← All demos
          </Link>
        </div>
      </div>

      <QuizGame initialLang={lang} />

      <section className="qz-frame-end" aria-labelledby="qz-end-h">
        <div className="qz-frame-end-inner">
          <p className="qz-frame-kicker">MartNepali Studio · Demo project</p>
          <h2 id="qz-end-h">Want a quiz like this for your event?</h2>
          <p>
            For a Dashain night, a Teej programme, a student association or a school: your own questions, the room joining
            with one QR code, and a leaderboard on the projector between the acts.
          </p>
          <ul>
            <li>Your questions, your languages</li>
            <li>Players join with a QR code</li>
            <li>Big screen + phones</li>
          </ul>
          <div className="qz-frame-ctas">
            <Link href="/contact?intent=app" className="btn btn-brand">
              Kura garau
            </Link>
            <Link href="/studio#projects" className="btn">
              See all our work
            </Link>
          </div>
          <p className="qz-frame-free">Free while we grow.</p>
          <DemoNav current="quiz" />
        </div>
      </section>
    </div>
  );
}
