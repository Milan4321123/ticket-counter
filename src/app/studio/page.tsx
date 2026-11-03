import Link from 'next/link';
import ProjectGrid from '@/components/studio/ProjectGrid';
import VideoGrid from '@/components/studio/VideoGrid';
import { HowItWorks, StudioCta, WhatWeMake } from '@/components/studio/StudioBlocks';
import { PROJECTS } from '@/lib/projects';
import { ALL_VIDEOS, VIDEO_GROUPS } from '@/lib/studioVideos';
import { jsonLdScript, shareImages, STUDIO_SHARE_CARD, studioServicesJsonLd } from '@/lib/seo';
import { serverT, currentLang } from '@/lib/i18nServer';
import { tMaybe } from '@/lib/i18n';
import './studio.css';

// "Our work" — every project and every video, in full. The homepage shows the
// same lists (lib/projects.ts, lib/studioVideos.ts) in a shorter form; add a
// project or a film THERE and both pages pick it up.
//
// Deliberately no prices and no quotes anywhere on this page: the operator is
// a student whose permit does not allow self-employment, so everything here is
// offered free while the platform grows (see PLATFORM.md). The way in is the
// contact chat, never a price list.
//
// The videos are small web copies served from public/media/studio — they load
// only when pressed (preload="none"), so the page stays light on a phone.

const title = 'Our work — apps · websites · ad videos';
const description =
  'Our work: ticketing with QR check-in, restaurant ordering, online shops, the NPJOE e.V. website, and ads and stage screens for Prakash Saput Live.';

export const metadata = {
  title,
  description,
  alternates: { canonical: '/studio' },
  openGraph: { type: 'website', title, description, url: '/studio', images: shareImages(STUDIO_SHARE_CARD) },
  twitter: { card: 'summary_large_image', title, description, images: [STUDIO_SHARE_CARD.url] },
};

export default async function StudioPage() {
  const lang = await currentLang();
  const tr = await serverT();
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(studioServicesJsonLd())} />
      <section className="feed-hero st-hero">
        <div className="container">
          <p className="feed-kicker anim-fade-up">{tr('st.ourWork')}</p>
          <h1 className="anim-fade-up anim-d1">{tr('st.h1')}</h1>
          <p className="feed-hero-sub anim-fade-up anim-d2">
            {tr('st.studioSub', { p: PROJECTS.length, v: ALL_VIDEOS.length })}
          </p>
          <div className="sh-row-center anim-fade-up anim-d2">
            <Link href="/contact" className="btn btn-brand">
              {tr('st.cta')}
            </Link>
            <a href="#videos" className="btn">
              {tr('st.watchVideos')}
            </a>
          </div>
          <nav className="sh-jump sh-jump-center" aria-label={tr('st.kinds')}>
            <a href="#projects">{tr('st.projects')}</a>
            {VIDEO_GROUPS.map((g) => (
              <a key={g.id} href={`#${g.id}`}>
                {tMaybe(lang, `vg.${g.id}`, g.label)}
              </a>
            ))}
          </nav>
        </div>
      </section>

      <section className="section sh-section" id="projects">
        <div className="container">
          <p className="feed-kicker">{tr('st.projects')}</p>
          <h2 className="sh-h2">{tr('st.built')}</h2>
          <ProjectGrid projects={PROJECTS} lang={lang} />
        </div>
      </section>

      <span id="videos" className="ab-anchor" aria-hidden="true" />
      {VIDEO_GROUPS.map((g) => (
        <section key={g.id} className="section sh-section" id={g.id}>
          <div className="container">
            <p className="feed-kicker">
              {tMaybe(lang, `vg.${g.id}`, g.label)} · {g.videos.length}
            </p>
            <h2 className="sh-h2">{g.title}</h2>
            <p className="muted stv-lead">{g.text}</p>
            <VideoGrid videos={g.videos} />
          </div>
        </section>
      ))}

      <section className="section sh-section" id="make">
        <div className="container">
          <p className="feed-kicker">{tr('st.make')}</p>
          <h2 className="sh-h2">{tr('st.makeAll')}</h2>
          <WhatWeMake lang={lang} />
        </div>
      </section>

      <section className="section sh-section">
        <div className="container">
          <p className="feed-kicker">{tr('st.how')}</p>
          <h2 className="sh-h2">{tr('st.how.title')}</h2>
          <HowItWorks lang={lang} />
        </div>
      </section>

      <section className="section sh-section" id="talk">
        <div className="container">
          <StudioCta more lang={lang} />
        </div>
      </section>
    </>
  );
}
