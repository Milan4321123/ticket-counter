import Link from 'next/link';
import StudioPlayer from '@/components/StudioPlayer';
import type { Project } from '@/lib/projects';
import { videoById } from '@/lib/studioVideos';

function Cover({ p }: { p: Project }) {
  const video = p.videoId ? videoById(p.videoId) : undefined;
  if (video) {
    // The project's own film, playable right on the card (poster = the cover).
    return (
      <div className="sh-pc-cover sh-pc-cover-video">
        <StudioPlayer video={{ ...video, poster: p.cover.src || video.poster }} />
      </div>
    );
  }
  if (!p.cover.src) {
    // No picture: a small composition of what is inside.
    return (
      <div className="sh-pc-cover sh-pc-art" aria-hidden="true">
        <span>👋</span>
        <span>🤝</span>
        <span>🪔</span>
        <span>🎤</span>
      </div>
    );
  }
  if (p.cover.shape === 'tall') {
    return (
      <div className="sh-pc-cover sh-pc-phone">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={p.cover.src} alt="" loading="lazy" decoding="async" />
      </div>
    );
  }
  return (
    <div className="sh-pc-cover">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={p.cover.src} alt="" loading="lazy" decoding="async" />
    </div>
  );
}

/** The project cards (lib/projects.ts). */
export default function ProjectGrid({ projects }: { projects: Project[] }) {
  return (
    <div className="sh-projects">
      {projects.map((p) => (
        <article key={p.id} id={`p-${p.id}`} className="sh-pc">
          <Cover p={p} />
          <div className="sh-pc-body">
            <div className="sh-pc-tags">
              {p.tags.map((t) => (
                <span key={t} className={`sh-tag sh-tag-${t.toLowerCase()}`}>
                  {t}
                </span>
              ))}
              {p.example && <span className="sh-tag sh-tag-example">Example project</span>}
            </div>
            <h3>{p.title}</h3>
            <p className="sh-pc-client">{p.client}</p>
            <p className="sh-pc-outcome">{p.outcome}</p>
            <ul className="sh-pc-points">
              {p.points.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
            <div className="sh-pc-links">
              {p.links.map((l, i) => (
                <Link key={l.href} href={l.href} className={i === 0 ? 'sh-pc-link sh-pc-link-main' : 'sh-pc-link'}>
                  {l.label} →
                </Link>
              ))}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
