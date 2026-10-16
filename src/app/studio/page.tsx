import Link from 'next/link';
import DemoStart from '@/components/DemoStart';
import { shareImages } from '@/lib/seo';

// "What we build" — the work behind MartNepali, shown so that organizers,
// shops and restaurants know they can have it too: the pages and systems, and
// the short videos that fill a hall.
//
// Deliberately no prices and no quotes anywhere on this page: the operator is
// a student whose permit does not allow self-employment, so everything here is
// offered free while the platform grows (see PLATFORM.md). The way in is the
// contact form, never a price list.
//
// The videos are small web copies of the MartNepali brand ads (made with
// tools/ad-videos), served from public/media/studio — they load only when
// pressed (preload="none"), so the page stays light on a phone.

const title = 'What we build — event pages, shops & videos';
const description =
  'Ticket pages with QR check-in, shops and restaurant ordering, and short promo videos for Reels, TikTok and WhatsApp status — built for Nepali organizers and businesses in Germany.';

export const metadata = {
  title,
  description,
  alternates: { canonical: '/studio' },
  openGraph: { type: 'website', title, description, url: '/studio', images: shareImages() },
};

const VIDEOS = [
  { src: '/media/studio/ad-4-organizer.mp4', poster: '/media/studio/ad-4-organizer.jpg', label: 'For organizers', text: 'Tickets, seat maps, door scanning — in Nepali, for Reels and status.' },
  { src: '/media/studio/ad-3-restaurant.mp4', poster: '/media/studio/ad-3-restaurant.jpg', label: 'For restaurants', text: 'Order ahead, kitchen board, QR on every table.' },
  { src: '/media/studio/ad-1-customer.mp4', poster: '/media/studio/ad-1-customer.jpg', label: 'For everyone', text: 'Momo, events and the bazaar — the taste of home.' },
];

const OFFERS = [
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
  {
    emoji: '🎬',
    title: 'Videos that fill the hall',
    points: ['9:16 ads for Reels, TikTok and WhatsApp status', 'Walk-on intros for artists on stage', 'Original music — nothing copyrighted', 'Festival cards with your name on them'],
    link: { href: '/card', text: 'Make a festival card →' },
  },
];

export default function StudioPage() {
  return (
    <>
      <section className="feed-hero st-hero">
        <div className="container">
          <p className="feed-kicker anim-fade-up">MartNepali Studio</p>
          <h1 className="anim-fade-up anim-d1">We build for the Nepali community</h1>
          <p className="feed-hero-sub anim-fade-up anim-d2">
            Event pages with tickets, shops and restaurant ordering, and short videos that sell out your night — made by the
            people behind MartNepali, free while we grow.
          </p>
          <div className="cm-row anim-fade-up anim-d3">
            <Link href="/contact" className="btn btn-brand">
              Tell us what you need
            </Link>
            <DemoStart className="btn">Try the organizer demo</DemoStart>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <h2 className="feed-section-title">Videos we made</h2>
          <p className="muted st-lead">Press play — each is 20 seconds, made for a phone screen.</p>
          <div className="st-videos">
            {VIDEOS.map((v) => (
              <figure key={v.src} className="st-video">
                <video src={v.src} poster={v.poster} controls preload="none" playsInline className="st-player" />
                <figcaption>
                  <strong>{v.label}</strong>
                  <span>{v.text}</span>
                </figcaption>
              </figure>
            ))}
          </div>
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
