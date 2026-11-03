import Link from 'next/link';
import { demoHref, demoNeighbours } from '@/lib/projects';
import { currentLang } from '@/lib/i18nServer';
import { t, tMaybe } from '@/lib/i18n';
import './demoNav.css';

/**
 * "← previous demo · all demos · next demo →" at the bottom of each /work/*
 * demo, in the order of lib/projects.ts (wrapping round). Each demo's page.tsx
 * puts it in its closing "want one like this?" block; it has its own small
 * stylesheet because not every demo loads studio.css.
 */
export default async function DemoNav({ current }: { current: string }) {
  const around = demoNeighbours(current);
  if (!around) return null;
  const lang = await currentLang();
  const { prev, next } = around;
  return (
    <nav className="dnav" aria-label={t(lang, 'dn.label')}>
      <Link href={demoHref(prev)!} rel="prev" className="dnav-link dnav-prev">
        <span className="dnav-dir">{t(lang, 'dn.prev')}</span>
        <span className="dnav-name">{tMaybe(lang, `pj.${prev.id}`, prev.title)}</span>
      </Link>
      <Link href="/work" className="dnav-all">
        {t(lang, 'dn.all')}
      </Link>
      <Link href={demoHref(next)!} rel="next" className="dnav-link dnav-next">
        <span className="dnav-dir">{t(lang, 'dn.next')}</span>
        <span className="dnav-name">{tMaybe(lang, `pj.${next.id}`, next.title)}</span>
      </Link>
    </nav>
  );
}
