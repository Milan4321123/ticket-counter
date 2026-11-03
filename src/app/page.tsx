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
import { jsonLdScript, shareImages, STUDIO_SHARE_CARD, studioServicesJsonLd } from '@/lib/seo';
import { currentLang } from '@/lib/i18nServer';
import { translator } from '@/lib/i18n';
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

const title = 'MartNepali Studio — apps · websites · ad videos for the Nepali community';
// ≤ 155 characters, so a search result shows all of it.
const description =
  'Apps, websites and ad videos for Nepali organizers, associations, restaurants and shops — ticketing, order-ahead, stage screens. Tell us what you need.';

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: { canonical: '/' },
  openGraph: { type: 'website', title, description, url: '/', images: shareImages(STUDIO_SHARE_CARD) },
  twitter: { card: 'summary_large_image', title, description, images: [STUDIO_SHARE_CARD.url] },
};

/** The tabs leave out the showreel — it already plays in the hero. */
const TAB_GROUPS = VIDEO_GROUPS.map((g) => ({ ...g, videos: g.videos.filter((x) => x.id !== SHOWREEL.id) })).filter(
  (g) => g.videos.length > 0
);

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

export default async function HomePage() {
  // The housekeeping the old feed armed on every visit: self-throttled, cheap.
  ensureExampleBazaarOnce();
  void runSubscriptionSweep().catch((e) => console.error('Subscription sweep failed:', e));
  runBuyerDataRetentionSweep();
  const live = liveEvents(listPublishedEvents());
  const lang = await currentLang();
  const tr = translator(lang);

  return (
    <>
      <OldAnchors />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(studioServicesJsonLd())} />

      {/* ---- Hero ---- */}
      <section className="sh-hero">
        <div className="container sh-hero-grid">
          <div className="sh-hero-copy">
            <p className="sh-kicker anim-fade-up">
              {tr('st.kicker')} · <span lang="ne" translate="no">कुरा गरौं</span>
            </p>
            <h1 className="sh-title anim-fade-up anim-d1">
              {tr('st.title1')} <span className="sh-grad">{tr('st.title2')}</span>
            </h1>
            <p className="sh-lead anim-fade-up anim-d2">
              {tr('st.lead')}
            </p>
            <div className="sh-hero-cta anim-fade-up anim-d2">
              <Link href="/contact" className="sh-btn sh-btn-main">
                {tr('st.cta')}
              </Link>
              <a href="#work" className="sh-btn">
                {tr('st.seeWork')}
              </a>
            </div>
            <ul className="sh-made-for anim-fade-up anim-d2" aria-label={tr('st.recent')} data-label={tr('st.recent')}>
              <li>NPJOE e.V.</li>
              <li>Prakash Saput Live</li>
              <li>The Untitled Nepal</li>
            </ul>
          </div>
          <div className="sh-hero-reel anim-fade-up anim-d1">
            <Showreel video={SHOWREEL} lang={lang} />
          </div>
        </div>
      </section>

      <nav className="container sh-jump" aria-label={tr('st.onPage')}>
        <a href="#make">{tr('st.make')}</a>
        <a href="#work">{tr('st.projects')}</a>
        <a href="#videos">{tr('st.videos')}</a>
        <a href="#how">{tr('st.how')}</a>
        <Link href="/contact" className="sh-jump-cta">
          {tr('st.contact')}
        </Link>
      </nav>

      {/* ---- What we make ---- */}
      <section className="section sh-section" id="make" aria-labelledby="make-title">
        <div className="container">
          <p className="feed-kicker">{tr('st.make')}</p>
          <h2 id="make-title" className="sh-h2">
            {tr('st.make.title')}
          </h2>
          <WhatWeMake lang={lang} />
        </div>
      </section>

      {/* ---- Projects ---- */}
      <section className="section sh-section" id="work" aria-labelledby="work-title">
        <div className="container">
          <div className="sh-head">
            <div>
              <p className="feed-kicker">{tr('st.projects')}</p>
              <h2 id="work-title" className="sh-h2">
                {tr('st.work.title')}
              </h2>
            </div>
            <Link href="/studio" className="sh-more">
              {tr('st.allWork')}
            </Link>
          </div>
          <ProjectGrid projects={PROJECTS} lang={lang} />
        </div>
      </section>

      {/* ---- Live on MartNepali (only when there is something live) ---- */}
      {live.length > 0 && (
        <section className="container sh-live" aria-labelledby="live-title">
          <p id="live-title" className="sh-live-title">
            <span className="sh-live-dot" aria-hidden="true" /> {tr('st.live')}
          </p>
          <div className="sh-live-row">
            {live.map((e) => (
              <Link key={e.id} href={`/e/${e.slug}`} className="sh-live-item">
                <strong>{e.name}</strong>
                <span>{[e.dateDisplay, e.city.trim()].filter(Boolean).join(' · ')}</span>
              </Link>
            ))}
            <Link href="/events" className="sh-live-item sh-live-all">
              <strong>{tr('st.allEvents')}</strong>
              <span>{tr('st.allEventsSub')}</span>
            </Link>
          </div>
        </section>
      )}

      {/* ---- Video work ---- */}
      <section className="section sh-section" id="videos" aria-labelledby="videos-title">
        <div className="container">
          <div className="sh-head">
            <div>
              <p className="feed-kicker">{tr('st.videos.kicker', { n: ALL_VIDEOS.length })}</p>
              <h2 id="videos-title" className="sh-h2">
                {tr('st.videos.title')}
              </h2>
            </div>
            <Link href="/studio#videos" className="sh-more">
              {tr('st.seeAll')}
            </Link>
          </div>
          <VideoTabs groups={TAB_GROUPS} lang={lang} />
          <p className="sh-video-ask">
            <Link href="/contact?intent=video">{tr('st.videoAsk')}</Link>
          </p>
        </div>
      </section>

      {/* ---- How it works ---- */}
      <section className="section sh-section" id="how" aria-labelledby="how-title">
        <div className="container">
          <p className="feed-kicker">{tr('st.how')}</p>
          <h2 id="how-title" className="sh-h2">
            {tr('st.how.title')}
          </h2>
          <HowItWorks lang={lang} />
        </div>
      </section>

      {/* ---- Also on MartNepali: the platform itself stays one tap away ---- */}
      <section className="container sh-also" aria-label={tr('st.also')}>
        <Link href="/events" className="sh-also-item">
          <span aria-hidden="true">🎟</span>
          <strong>{tr('nav.events')}</strong>
          <span>{tr('st.also.eventsSub')}</span>
        </Link>
        <Link href="/market" className="sh-also-item">
          <span aria-hidden="true">🛍</span>
          <strong>{tr('nav.bazaar.short')}</strong>
          <span>{tr('st.also.bazaarSub')}</span>
        </Link>
        <Link href="/community" className="sh-also-item">
          <span aria-hidden="true">🤝</span>
          <strong>{tr('st.also.community')}</strong>
          <span>{tr('st.also.communitySub')}</span>
        </Link>
        <Link href="/organizers" className="sh-also-item">
          <span aria-hidden="true">🏪</span>
          <strong>{tr('qt.sell')}</strong>
          <span>{tr('qt.sellSub')}</span>
        </Link>
      </section>

      {/* ---- Final CTA ---- */}
      <section className="section sh-section" id="talk">
        <div className="container">
          <StudioCta lang={lang} />
        </div>
      </section>
    </>
  );
}
