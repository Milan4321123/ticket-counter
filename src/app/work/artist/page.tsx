import Link from 'next/link';
import { Mukta, Rozha_One, Syne } from 'next/font/google';
import ArtistPage from './ArtistPage';
import '@/app/studio/studio.css';
import './artist.css';

// Studio demo #2: an artist page / EPK for a touring singer (lib/projects.ts →
// "Artist page & press kit"). The singer, the band, the songs, the venues and
// the press lines are all made up; the melodies are composed and played live
// in the browser, the press kit is drawn on the spot, and the booking form
// sends nothing anywhere.
//
// Same thin MartNepali frame as /work/wedding: the "Demo project" strip above
// and "want one like this?" below are ordinary site copy; the artist page in
// between is translate="no" and switches between English and नेपाली itself.
//
// No prices, quotes or packages anywhere: the operator is a student and the
// studio is offered free while it grows (see app/studio/page.tsx).

const display = Syne({ weight: ['700', '800'], subsets: ['latin'], display: 'swap', variable: '--ar-display' });
const deva = Rozha_One({ weight: '400', subsets: ['devanagari', 'latin'], display: 'swap', variable: '--ar-deva' });
const devaBody = Mukta({ weight: ['400', '600'], subsets: ['devanagari', 'latin'], display: 'swap', variable: '--ar-deva-body' });

const title = 'Artist page & press kit — demo project';
const description =
  'An artist website for a touring Nepali singer, built by MartNepali as a demo: a live music player, tour dates with ticket links, bio and press, a downloadable press kit and a booking form — in English and नेपाली.';
const cover = { url: '/media/studio/projects/artist.jpg', width: 1200, height: 800, alt: 'Rimjhim Tara — a demo artist page with music player and tour dates' };

export const metadata = {
  title,
  description,
  alternates: { canonical: '/work/artist' },
  openGraph: { type: 'website', title, description, url: '/work/artist', images: [cover] },
  twitter: { card: 'summary_large_image', title, description, images: [cover.url] },
};

export default function ArtistDemoPage() {
  return (
    <div className={`ar-page ${display.variable} ${deva.variable} ${devaBody.variable}`}>
      <div className="ar-frame-top">
        <div className="ar-frame-inner">
          <span className="ar-frame-badge">Demo project</span>
          <span className="ar-frame-text">Built by MartNepali · a made-up artist, nothing real is sent</span>
          <Link href="/studio#projects" className="ar-frame-link">
            ← Our work
          </Link>
        </div>
      </div>

      <ArtistPage />

      <section className="ar-frame-end" aria-labelledby="ar-end-h">
        <div className="ar-frame-end-inner">
          <p className="ar-frame-kicker">MartNepali Studio · Demo project</p>
          <h2 id="ar-end-h">Want an artist page like this?</h2>
          <p>
            For a singer, a band or a dance group: your music, your tour dates with ticket links, a press kit promoters can
            download and a way to ask for a show — in your colours and your languages.
          </p>
          <ul>
            <li>English, नेपाली or Deutsch</li>
            <li>Made for the phone first</li>
            <li>Tickets on MartNepali, built in</li>
          </ul>
          <div className="ar-frame-ctas">
            <Link href="/contact?intent=website" className="btn btn-brand">
              Kura garau — tell us about your music
            </Link>
            <Link href="/studio#projects" className="btn">
              See all our work
            </Link>
          </div>
          <p className="ar-frame-free">Free while we grow.</p>
        </div>
      </section>
    </div>
  );
}
