import Link from 'next/link';
import DemoStart from '@/components/DemoStart';
import StudioPlayer from '@/components/StudioPlayer';
import { shareImages } from '@/lib/seo';
import { BRAND_REELS, FIRST_ADS, SHOW_PROMOS, SHOW_STAGE, type StudioVideo } from '@/lib/studioVideos';
import './studio.css';

// "What we build" — the work behind MartNepali, shown so that organizers,
// shops and restaurants know they can have it too: the pages and systems, and
// the videos that fill a hall.
//
// Deliberately no prices and no quotes anywhere on this page: the operator is
// a student whose permit does not allow self-employment, so everything here is
// offered free while the platform grows (see PLATFORM.md). The way in is the
// contact chat, never a price list.
//
// The videos are small web copies of films made with tools/ad-videos (list in
// lib/studioVideos.ts), served from public/media/studio — they load only when
// pressed (preload="none"), so the page stays light on a phone.

const title = 'What we build — videos, event pages & shops';
const description =
  'Promo videos for Reels, TikTok and WhatsApp status, walk-on intros and stage-screen visuals — plus ticket pages with QR check-in, shops and restaurant ordering, built for Nepali organizers and businesses in Germany.';

export const metadata = {
  title,
  description,
  alternates: { canonical: '/studio' },
  openGraph: { type: 'website', title, description, url: '/studio', images: shareImages() },
};

const OFFERS = [
  {
    emoji: '🎬',
    title: 'Videos that fill the hall',
    points: ['9:16 ads for Reels, TikTok and WhatsApp status', 'Walk-on intros for artists on stage', 'A screen loop for every act of the night', 'Music made for you — or your artist’s own songs'],
    link: { href: '/contact?intent=video', text: 'Talk to us about a video →' },
  },
  {
    emoji: '🎟',
    title: 'Event pages & tickets',
    points: ['Your own event page in your style', 'QR tickets by email, early bird and seat maps', 'Door scanning on any phone, live counts', 'Money straight to your own account'],
    link: { href: '/showcase', text: 'See every feature →' },
  },
  {
    emoji: '🛍',
    title: 'Shops & restaurants',
    points: ['A shop in the bazaar, or a menu to order ahead', 'Collection times, kitchen board, table QR codes', 'Subscriptions, promo codes, customer cards', 'Insights: what sells, and when'],
    link: { href: '/market', text: 'Visit the bazaar →' },
  },
];

function Grid({ videos, wide = false }: { videos: StudioVideo[]; wide?: boolean }) {
  return (
    <div className={`stv-grid${wide ? ' stv-grid-wide' : ''}`}>
      {videos.map((v) => (
        <figure key={v.id} id={`v-${v.id}`} className="stv-item">
          <StudioPlayer video={v} />
          <figcaption>
            <strong>{v.title}</strong>
            <span>{v.text}</span>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

export default function StudioPage() {
  return (
    <>
      <section className="feed-hero st-hero">
        <div className="container">
          <p className="feed-kicker anim-fade-up">MartNepali Studio</p>
          <h1 className="anim-fade-up anim-d1">We build for the Nepali community</h1>
          <p className="feed-hero-sub anim-fade-up anim-d2">
            Videos that sell out your night, event pages with tickets, shops and restaurant ordering — made by the people
            behind MartNepali, free while we grow.
          </p>
          <div className="cm-row anim-fade-up anim-d3">
            <a href="#videos" className="btn btn-brand">
              Watch the videos
            </a>
            <Link href="/contact?intent=video" className="btn">
              Want a video? Talk to us
            </Link>
            <DemoStart className="btn">Try the organizer demo</DemoStart>
          </div>
        </div>
      </section>

      <section className="section" id="videos">
        <div className="container">
          <p className="feed-kicker">New · 20 seconds each</p>
          <h2 className="feed-section-title">Our own ads — six different styles</h2>
          <p className="muted stv-lead">
            Each one tells the same story a different way, with its own music made from scratch. Made for a phone: press
            play, sound on.
          </p>
          <Grid videos={BRAND_REELS} />
        </div>
      </section>

      <section className="section" id="show">
        <div className="container">
          <div className="stv-show-head">
            <p className="feed-kicker" style={{ margin: 0 }}>
              Made for a real show
            </p>
            <span className="stv-badge">Prakash Saput Live · Frankfurt · 31 Oct 2026</span>
          </div>
          <h2 className="feed-section-title">Everything one concert night needed</h2>
          <p className="muted stv-lead">
            The ads for the ticket sale, the intro for the walk-on, and a looping screen behind every act on stage.
          </p>
          <h3 className="stv-sub">Ads for Reels &amp; WhatsApp status</h3>
          <Grid videos={SHOW_PROMOS} />
          <h3 className="stv-sub">On the stage screen</h3>
          <Grid videos={SHOW_STAGE} wide />
        </div>
      </section>

      <section className="section" id="talk">
        <div className="container">
          <div className="stv-cta">
            <p className="stv-cta-kicker">
              <span lang="ne">कुरा गरौं</span> · Kura garau
            </p>
            <h2>Want a video like this?</h2>
            <p>Tell us about your event, your shop or your artist — we make the video with you, free while we grow.</p>
            <ul className="stv-chips">
              <li>
                <span aria-hidden="true">🎬</span> Promo for Reels, TikTok &amp; status
              </li>
              <li>
                <span aria-hidden="true">🎤</span> Walk-on intro for your artist
              </li>
              <li>
                <span aria-hidden="true">🖥</span> Visuals for the stage screen
              </li>
              <li>
                <span aria-hidden="true">🪧</span> Poster &amp; roll-up banner
              </li>
            </ul>
            <div className="stv-cta-row">
              <Link href="/contact?intent=video" className="stv-cta-btn">
                Talk to us about a video
              </Link>
              <span className="stv-cta-note">A real person reads every message — Milan replies by email.</span>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <p className="feed-kicker">In Nepali</p>
          <h2 className="feed-section-title">Our first ads</h2>
          <Grid videos={FIRST_ADS} />
        </div>
      </section>

      <section className="section">
        <div className="container">
          <h2 className="feed-section-title">What we can build for you</h2>
          <div className="st-offers">
            {OFFERS.map((o) => (
              <article key={o.title} className="card st-offer">
                <p className="st-emoji" aria-hidden="true">
                  {o.emoji}
                </p>
                <h3>{o.title}</h3>
                <ul>
                  {o.points.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
                <Link href={o.link.href}>{o.link.text}</Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container container-narrow">
          <div className="card st-steps">
            <h2 className="card-title">How it goes</h2>
            <ol>
              <li>
                <strong>Tell us</strong> about your event, shop or restaurant — a few lines is enough.
              </li>
              <li>
                <strong>We set it up with you</strong>: the page, the tickets or menu, and a video if you want one.
              </li>
              <li>
                <strong>You share it</strong> in your groups — and see every ticket and order come in.
              </li>
            </ol>
            <p style={{ margin: 0 }}>
              <Link href="/contact" className="btn btn-brand">
                Talk to us
              </Link>
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
