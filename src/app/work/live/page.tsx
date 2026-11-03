import Link from 'next/link';
import DemoNav from '@/components/studio/DemoNav';
import { Mukta } from 'next/font/google';
import LiveDashboard from './LiveDashboard';
import '@/app/studio/studio.css';
import './live.css';

// Studio demo #4: a venue live dashboard (lib/projects.ts → "Live event
// dashboard") — what an organizer watches on the night of a concert and what
// can go up on the hall screen. The evening is simulated in sim.ts and runs in
// the visitor's browser (no server, nothing sent or stored beyond the language
// choice). It shows ticket and people COUNTS only.
//
// Same thin MartNepali frame as the other demos: the "Demo project" strip above
// and "want one like this?" below are ordinary site copy; the dashboard in
// between is translate="no" and switches English / नेपाली itself.
//
// No prices, quotes or packages anywhere: the operator is a student and the
// studio is offered free while it grows (see app/studio/page.tsx).

// Mukta is drawn for Devanagari and Latin alike, so both languages read the
// same at projector size.
const mukta = Mukta({ weight: ['400', '500', '600', '700', '800'], subsets: ['devanagari', 'latin'], display: 'swap', variable: '--lv-font' });

const title = 'Live event dashboard — demo project';
const description =
  'A venue big-screen dashboard for a concert night, built by MartNepali as a demo: live check-ins against capacity, arrivals per 10 minutes, door queues, ticket types, a check-in feed, a shout-out wall and a now-on-stage timeline — in English and नेपाली.';
const cover = {
  url: '/media/studio/projects/live.jpg',
  width: 1200,
  height: 800,
  alt: 'A dark live dashboard for a Tihar concert night: a check-in gauge, arrivals chart, door queues and a wall of guest shout-outs',
};

export const metadata = {
  title,
  description,
  alternates: { canonical: '/work/live' },
  openGraph: { type: 'website', title, description, url: '/work/live', images: [cover] },
  twitter: { card: 'summary_large_image', title, description, images: [cover.url] },
};

export default function LiveDemoPage() {
  return (
    <div className={`lv-page ${mukta.variable}`}>
      <div className="lv-frame-top">
        <div className="lv-frame-inner">
          <span className="lv-frame-badge">Demo project</span>
          <span className="lv-frame-text">Built by MartNepali · the evening is simulated, nothing is sent</span>
          <Link href="/work" className="lv-frame-link">
            ← All demos
          </Link>
        </div>
      </div>

      <LiveDashboard />

      <section className="lv-frame-end" aria-labelledby="lv-end-h">
        <div className="lv-frame-end-inner">
          <p className="lv-frame-kicker">MartNepali Studio · Demo project</p>
          <h2 id="lv-end-h">Want a live dashboard for your event?</h2>
          <p>
            For a concert, a Dashain or Tihar night, a festival or a sports day: your doors, your tickets and your
            programme on one screen for the team, and a wall of guests’ messages for the hall.
          </p>
          <ul>
            <li>Live check-ins and door queues</li>
            <li>A screen for the hall</li>
            <li>English and नेपाली</li>
          </ul>
          <div className="lv-frame-ctas">
            <Link href="/contact?intent=app" className="btn btn-brand">
              Kura garau
            </Link>
            <Link href="/studio#projects" className="btn">
              See all our work
            </Link>
          </div>
          <p className="lv-frame-free">Free while we grow.</p>
          <DemoNav current="live" />
        </div>
      </section>
    </div>
  );
}
