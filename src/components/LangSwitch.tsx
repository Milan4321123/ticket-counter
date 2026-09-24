'use client';

// EN · DE · ने — three plain links to /api/lang, which sets the cookie and
// brings the visitor back to the same page.
import { usePathname, useSearchParams } from 'next/navigation';
import { LANGS, type Lang } from '@/lib/i18n';

export default function LangSwitch({ lang, label }: { lang: Lang; label: string }) {
  const path = usePathname() ?? '/';
  const qs = useSearchParams()?.toString();
  const back = encodeURIComponent(qs ? `${path}?${qs}` : path);
  return (
    <nav className="lang-switch" aria-label={label}>
      {LANGS.map((l) => (
        <a
          key={l.code}
          href={`/api/lang?to=${l.code}&back=${back}`}
          className={`lang-link${l.code === lang ? ' lang-link-on' : ''}`}
          aria-current={l.code === lang ? 'true' : undefined}
          lang={l.code}
          title={l.label}
          rel="nofollow"
        >
          {l.short}
        </a>
      ))}
    </nav>
  );
}
