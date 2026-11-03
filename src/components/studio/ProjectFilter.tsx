'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { PROJECT_FILTERS, asProjectFilter, type ProjectFilter as Filter } from '@/lib/projects';
import { t, type Lang } from '@/lib/i18n';

/**
 * The chips above /studio's project grid: All · Apps · Websites · Videos ·
 * Live demos. The grid (`children`) is rendered on the server with every card
 * in it; this only sets `data-filter` and CSS hides the cards whose `data-f`
 * does not match (studio.css), so search engines and no-JS visitors get the
 * full list. The choice lives in ?tag= — linkable, and the server reads it for
 * the first paint, so a shared link opens already filtered.
 */
export default function ProjectFilter({
  counts,
  initial,
  films,
  lang = 'en',
  children,
}: {
  counts: Record<Filter, number>;
  initial: Filter;
  /** How many films the video sections below hold (the "Videos" chip points there). */
  films: number;
  lang?: Lang;
  children: ReactNode;
}) {
  const [filter, setFilter] = useState<Filter>(initial);

  // Back / forward between filtered URLs a visitor pasted or opened.
  useEffect(() => {
    const sync = () => setFilter(asProjectFilter(new URL(window.location.href).searchParams.get('tag')));
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);

  const pick = (f: Filter) => {
    setFilter(f);
    const url = new URL(window.location.href);
    if (f === 'all') url.searchParams.delete('tag');
    else url.searchParams.set('tag', f);
    window.history.replaceState(window.history.state, '', url);
  };

  return (
    <div className="sh-filter" data-filter={filter}>
      <div className="sh-filter-bar">
        <div className="sh-filter-chips" role="group" aria-label={t(lang, 'pf.label')}>
          {PROJECT_FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              className={`sh-filter-chip sh-filter-chip-${f}`}
              aria-pressed={filter === f}
              onClick={() => pick(f)}
            >
              {t(lang, `pf.${f}`)}
              <span className="sh-filter-n">{counts[f]}</span>
            </button>
          ))}
        </div>
        <Link href="/work" className="sh-filter-gallery">
          {t(lang, 'pf.gallery')}
        </Link>
      </div>
      <p className="sh-sr" aria-live="polite">
        {t(lang, 'pf.shown', { n: counts[filter] })}
      </p>
      {children}
      {filter === 'videos' && films > 0 && (
        <p className="sh-filter-films">
          <a href="#videos">{t(lang, 'pf.films', { n: films })}</a>
        </p>
      )}
    </div>
  );
}
