import Link from 'next/link';
import { IDEA_BUILDER } from '@/lib/projects';
import { t, type Lang } from '@/lib/i18n';

/**
 * "Build your idea" — the way into /work/build, at the top of /work and next
 * to the projects on /studio. A tool, not a demo project (lib/projects.ts →
 * IDEA_BUILDER), so it has its own card rather than a place in the grid.
 */
export default function BuildIdeaCard({ lang = 'en', className = '' }: { lang?: Lang; className?: string }) {
  return (
    <div className={`bi-card ${className}`.trim()}>
      <div className="bi-body">
        <span className="bi-badge">✨ {t(lang, 'bd.badge')}</span>
        <h2 className="bi-title">
          <Link href={IDEA_BUILDER.href}>{t(lang, 'bd.title')}</Link>
        </h2>
        <p className="bi-text">{t(lang, 'bd.text')}</p>
        <div className="bi-ctas">
          <Link href={IDEA_BUILDER.href} className="sh-btn sh-btn-main">
            {t(lang, 'bd.cta')}
          </Link>
        </div>
        <p className="bi-free">{t(lang, 'bd.free')}</p>
      </div>
      <Link href={IDEA_BUILDER.href} className="bi-cover" tabIndex={-1} aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={IDEA_BUILDER.cover.src} alt="" width={IDEA_BUILDER.cover.width} height={IDEA_BUILDER.cover.height} loading="lazy" decoding="async" />
      </Link>
    </div>
  );
}
