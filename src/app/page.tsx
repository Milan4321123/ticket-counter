import Link from 'next/link';
import type { Metadata } from 'next';
import Showreel from '@/components/studio/Showreel';
import OldAnchors from '@/components/studio/OldAnchors';
import ProjectGrid from '@/components/studio/ProjectGrid';
import VideoTabs from '@/components/studio/VideoTabs';
import { HowItWorks, StudioCta, WhatWeMake } from '@/components/studio/StudioBlocks';
import { PROJECTS } from '@/lib/projects';
import { ALL_VIDEOS, SHOWREEL, VIDEO_GROUPS } from '@/lib/studioVideos';
import { listPublishedEvents } from '@/lib/events';
import type { EventRow } from '@/lib/events';
import { readListingName } from '@/lib/exampleShop';
import { ensureExampleBazaarOnce } from '@/lib/exampleBazaar';
import { runSubscriptionSweep } from '@/lib/subscriptions';
import { runBuyerDataRetentionSweep } from '@/lib/retention';
import { shareImages } from '@/lib/seo';
import '@/app/studio/studio.css';

// The homepage: MartNepali as a STUDIO — apps, websites and ad videos for the
// Nepali community, with our own work as the examples. The events and the
// bazaar moved to /events and /market (still in the header); the Ask chat's
// old "/#events"-style links are forwarded there (components/studio/OldAnchors).
//
// No prices, quotes, rates or "packages" anywhere: the operator is a student
// whose permit does not allow self-employment, so the way in is always a
// conversation (/contact), "free while we grow". Demo and example work says so.

// The small "Live on MartNepali" strip reads the published events.
export const dynamic = 'force-dynamic';

const title = 'MartNepali Studio — apps, websites & ad videos for the Nepali community';
const description =
  'We build apps, websites and advertisement videos for Nepali organizers, associations, restaurants and shops — ticketing with QR check-in, order-ahead, association websites, event ads, walk-on intros and stage screens. Kura garau: tell us what you need.';

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: { canonical: '/' },
  openGraph: { type: 'website', title, description, url: '/', images: shareImages() },
  twitter: { card: 'summary_large_image', title, description },
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Real, upcoming events (never the example shops or a past night). */
function liveEvents(events: EventRow[]): EventRow[] {
  const today = todayIso();
  return events
    .filter((e) => {
      if (e.kind === 'shop' || readListingName(e.name).isExample) return false;
      const d = e.eventDate?.slice(0, 10);
      return !(d && /^\d{4}-\d{2}-\d{2}$/.test(d) && d < today);
    })
    .slice(0, 4);
}

export default function HomePage() {
  // The housekeeping the old feed armed on every visit: self-throttled, cheap.
  ensureExampleBazaarOnce();
  void runSubscriptionSweep().catch((e) => console.error('Subscription sweep failed:', e));
  runBuyerDataRetentionSweep();
  const live = liveEvents(listPublishedEvents());

  return (
    <>
      <OldAnchors />

      {/* ---- Hero ---- */}
      <section className="sh-hero">
        <div className="container sh-hero-grid">
          <div className="sh-hero-copy">
            <p className="sh-kicker anim-fade-up">
              MartNepali Studio · <span lang="ne">कुरा गरौं</span>
            </p>
            <h1 className="sh-title anim-fade-up anim-d1">
              Apps, websites &amp; ad videos — <span className="sh-grad">made for the Nepali community.</span>
            </h1>
            <p className="sh-lead anim-fade-up anim-d2">
              We built the ticketing platform you are on, a website for a Nepali youth association, and the ads and stage
              screens for a Frankfurt concert night. Tell us what you need — we make it with you, free while we grow.
            </p>
            <div className="sh-hero-cta anim-fade-up anim-d2">
              <Link href="/contact" className="sh-btn sh-btn-main">
                Kura garau — tell us what you need
              </Link>
              <a href="#work" className="sh-btn">
                See our work
              </a>
            </div>
            <ul className="sh-made-for anim-fade-up anim-d2" aria-label="Recent work">
              <li>NPJOE e.V.</li>
              <li>Prakash Saput Live</li>
              <li>The Untitled Nepal</li>
            </ul>
          </div>
          <div className="sh-hero-reel anim-fade-up anim-d1">
            <Showreel video={SHOWREEL} />
          </div>
        </div>
      </section>

      <nav className="container sh-jump" aria-label="On this page">
        <a href="#make">What we make</a>
        <a href="#work">Projects</a>
        <a href="#videos">Videos</a>
        <a href="#how">How it works</a>
        <Link href="/contact" className="sh-jump-cta">
          Contact
        </Link>
      </nav>

      {/* ---- What we make ---- */}
      <section className="section sh-section" id="make" aria-labelledby="make-title">
        <div className="container">
          <p className="feed-kicker">What we make</p>
          <h2 id="make-title" className="sh-h2">
            Three things, done properly
          </h2>
          <WhatWeMake />
        </div>
      </section>

      {/* ---- Projects ---- */}
      <section className="section sh-section" id="work" aria-labelledby="work-title">
        <div className="container">
          <div className="sh-head">
            <div>
              <p className="feed-kicker">Projects</p>
              <h2 id="work-title" className="sh-h2">
                We can make one like this for you
              </h2>
            </div>
            <Link href="/studio" className="sh-more">
              All our work →
            </Link>
          </div>
          <ProjectGrid projects={PROJECTS} />
        </div>
      </section>

      {/* ---- Live on MartNepali (only when there is something live) ---- */}
      {live.length > 0 && (
        <section className="container sh-live" aria-labelledby="live-title">
          <p id="live-title" className="sh-live-title">
            <span className="sh-live-dot" aria-hidden="true" /> Live on MartNepali
          </p>
          <div className="sh-live-row">
            {live.map((e) => (
              <Link key={e.id} href={`/e/${e.slug}`} className="sh-live-item">
                <strong>{e.name}</strong>
                <span>{[e.dateDisplay, e.city.trim()].filter(Boolean).join(' · ')}</span>
              </Link>
            ))}
            <Link href="/events" className="sh-live-item sh-live-all">
              <strong>All events →</strong>
              <span>Tickets &amp; the bazaar</span>
            </Link>
          </div>
        </section>
      )}

      {/* ---- Video work ---- */}
      <section className="section sh-section" id="videos" aria-labelledby="videos-title">
        <div className="container">
          <div className="sh-head">
            <div>
              <p className="feed-kicker">Video work · {ALL_VIDEOS.length} films</p>
              <h2 id="videos-title" className="sh-h2">
                Ads, walk-ons &amp; stage screens
              </h2>
            </div>
            <Link href="/studio#videos" className="sh-more">
              See them all →
            </Link>
          </div>
          <VideoTabs groups={VIDEO_GROUPS} />
          <p className="sh-video-ask">
            <Link href="/contact?intent=video">Want a video like this? Talk to us →</Link>
          </p>
        </div>
      </section>

      {/* ---- How it works ---- */}
      <section className="section sh-section" id="how" aria-labelledby="how-title">
        <div className="container">
          <p className="feed-kicker">How it works</p>
          <h2 id="how-title" className="sh-h2">
            From a few lines to live
          </h2>
          <HowItWorks />
        </div>
      </section>

      {/* ---- Also on MartNepali: the platform itself stays one tap away ---- */}
      <section className="container sh-also" aria-label="Also on MartNepali">
        <Link href="/events" className="sh-also-item">
          <span aria-hidden="true">🎟</span>
          <strong>Events</strong>
          <span>Concerts &amp; festival nights</span>
        </Link>
        <Link href="/market" className="sh-also-item">
          <span aria-hidden="true">🛍</span>
          <strong>Bazaar</strong>
          <span>Nepali shops &amp; kitchens</span>
        </Link>
        <Link href="/community" className="sh-also-item">
          <span aria-hidden="true">🤝</span>
          <strong>Community</strong>
          <span>Meetups &amp; help board</span>
        </Link>
        <Link href="/organizers" className="sh-also-item">
          <span aria-hidden="true">🏪</span>
          <strong>Sell with us</strong>
          <span>Free for organizers &amp; shops</span>
        </Link>
      </section>

      {/* ---- Final CTA ---- */}
      <section className="section sh-section" id="talk">
        <div className="container">
          <StudioCta />
        </div>
      </section>
    </>
  );
}
