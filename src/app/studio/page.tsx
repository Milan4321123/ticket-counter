import Link from 'next/link';
import ProjectGrid from '@/components/studio/ProjectGrid';
import VideoGrid from '@/components/studio/VideoGrid';
import { HowItWorks, StudioCta, WhatWeMake } from '@/components/studio/StudioBlocks';
import { PROJECTS } from '@/lib/projects';
import { ALL_VIDEOS, VIDEO_GROUPS } from '@/lib/studioVideos';
import { shareImages } from '@/lib/seo';
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

const title = 'Our work — apps, websites & ad videos';
const description =
  'Projects and videos by MartNepali Studio: a ticketing platform with QR check-in, restaurant ordering, online shops, the NPJOE e.V. website, and the ads, walk-on intros, stage screens and song visuals for Prakash Saput Live in Frankfurt.';

export const metadata = {
  title,
  description,
  alternates: { canonical: '/studio' },
  openGraph: { type: 'website', title, description, url: '/studio', images: shareImages() },
};

export default function StudioPage() {
  return (
    <>
      <section className="feed-hero st-hero">
        <div className="container">
          <p className="feed-kicker anim-fade-up">MartNepali Studio · Our work</p>
          <h1 className="anim-fade-up anim-d1">Apps, websites &amp; ad videos</h1>
          <p className="feed-hero-sub anim-fade-up anim-d2">
            {PROJECTS.length} projects and {ALL_VIDEOS.length} films, made for the Nepali community in Germany. Want one
            like these? Tell us — free while we grow.
          </p>
          <div className="sh-row-center anim-fade-up anim-d2">
            <Link href="/contact" className="btn btn-brand">
              Kura garau — tell us what you need
            </Link>
            <a href="#videos" className="btn">
              Watch the videos
            </a>
          </div>
          <nav className="sh-jump sh-jump-center" aria-label="Kinds of video">
            <a href="#projects">Projects</a>
            {VIDEO_GROUPS.map((g) => (
              <a key={g.id} href={`#${g.id}`}>
                {g.label}
              </a>
            ))}
          </nav>
        </div>
      </section>

      <section className="section sh-section" id="projects">
        <div className="container">
          <p className="feed-kicker">Projects</p>
          <h2 className="sh-h2">What we have built</h2>
          <ProjectGrid projects={PROJECTS} />
        </div>
      </section>

      <span id="videos" className="ab-anchor" aria-hidden="true" />
      {VIDEO_GROUPS.map((g) => (
        <section key={g.id} className="section sh-section" id={g.id}>
          <div className="container">
            <p className="feed-kicker">
              {g.label} · {g.videos.length}
            </p>
            <h2 className="sh-h2">{g.title}</h2>
            <p className="muted stv-lead">{g.text}</p>
            <VideoGrid videos={g.videos} />
          </div>
        </section>
      ))}

      <section className="section sh-section" id="make">
        <div className="container">
          <p className="feed-kicker">What we make</p>
          <h2 className="sh-h2">Apps, websites and videos</h2>
          <WhatWeMake />
        </div>
      </section>

      <section className="section sh-section">
        <div className="container">
          <p className="feed-kicker">How it works</p>
          <h2 className="sh-h2">From a few lines to live</h2>
          <HowItWorks />
        </div>
      </section>

      <section className="section sh-section" id="talk">
        <div className="container">
          <StudioCta title="Want one like these?" />
        </div>
      </section>
    </>
  );
}
