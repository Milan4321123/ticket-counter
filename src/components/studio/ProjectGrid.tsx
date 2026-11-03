import Link from 'next/link';
import StudioPlayer from '@/components/StudioPlayer';
import { demoHref, projectFilters, type Project } from '@/lib/projects';
import { videoById } from '@/lib/studioVideos';
import { t, tMaybe, type Lang } from '@/lib/i18n';

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
        <img src={p.cover.src} alt="" width={p.cover.width} height={p.cover.height} loading="lazy" decoding="async" />
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  const img = <img src={p.cover.src} alt="" width={p.cover.width} height={p.cover.height} loading="lazy" decoding="async" />;
  const demo = demoHref(p);
  if (demo) {
    // A live demo's picture opens the demo (the first link below says the same
    // thing in words, so this one stays out of the tab order).
    return (
      <Link href={demo} className="sh-pc-cover sh-pc-cover-demo" tabIndex={-1} aria-hidden="true">
        {img}
      </Link>
    );
  }
  return <div className="sh-pc-cover">{img}</div>;
}

/**
 * The project cards (lib/projects.ts). Titles, tags and badges follow the
 * language; the body stays English. `data-f` lists the /studio filters a card
 * belongs to (components/studio/ProjectFilter hides the rest with CSS, so the
 * grid itself stays server-rendered).
 *
 * Badges: "Live demo" for a try-it-yourself /work page, "Example project" for
 * other demos, "Real project" for real client work — never two of those.
 */
export default function ProjectGrid({ projects, lang = 'en' }: { projects: Project[]; lang?: Lang }) {
  return (
    <div className="sh-projects">
      {projects.map((p) => (
        <article key={p.id} id={`p-${p.id}`} className="sh-pc" data-f={projectFilters(p).join(' ')}>
          <Cover p={p} />
          <div className="sh-pc-body">
            <div className="sh-pc-tags">
              {p.tags.map((tag) => (
                <span key={tag} className={`sh-tag sh-tag-${tag.toLowerCase()}`}>
                  {t(lang, `tag.${tag}`)}
                </span>
              ))}
              {demoHref(p) ? (
                <span className="sh-tag sh-tag-demo">{t(lang, 'pb.demo')}</span>
              ) : p.example ? (
                <span className="sh-tag sh-tag-example">{t(lang, 'pj.example')}</span>
              ) : p.real ? (
                <span className="sh-tag sh-tag-real">{t(lang, 'pb.real')}</span>
              ) : null}
            </div>
            <h3>{tMaybe(lang, `pj.${p.id}`, p.title)}</h3>
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
