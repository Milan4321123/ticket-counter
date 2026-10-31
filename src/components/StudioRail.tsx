import Link from 'next/link';
import StudioPlayer from '@/components/StudioPlayer';
import { BRAND_REELS } from '@/lib/studioVideos';
import '@/app/studio/studio.css';

/**
 * Homepage: the newest ads we made, playable in place (posters only until
 * someone presses play), ending in the way in — "Want a video like this?".
 */
export default function StudioRail() {
  return (
    <section className="section" aria-labelledby="stv-home-title">
      <div className="container">
        <div className="bp-head">
          <div>
            <p className="feed-kicker">New · Videos we made</p>
            <h2 id="stv-home-title" className="feed-section-title">
              Want a video like this?
            </h2>
          </div>
          <div className="bp-nav">
            <Link href="/studio#videos" className="bp-more">
              See all videos →
            </Link>
          </div>
        </div>
      </div>
      <div className="stv-rail" role="region" aria-label="Videos we made" tabIndex={0}>
        {BRAND_REELS.map((v) => (
          <figure key={v.id} className="stv-item">
            <StudioPlayer video={v} />
            <figcaption>
              <strong>{v.title}</strong>
            </figcaption>
          </figure>
        ))}
        <Link href="/contact?intent=video" className="stv-rail-cta">
          <span lang="ne">कुरा गरौं · Kura garau</span>
          <strong>Want one for your event?</strong>
          <span>Promos, walk-on intros, stage screens — free while we grow.</span>
          <em>Talk to us →</em>
        </Link>
      </div>
    </section>
  );
}
