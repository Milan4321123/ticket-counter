import Link from 'next/link';
import DemoRail from './DemoRail';
import { LIVE_DEMOS, demoHref } from '@/lib/projects';
import { t, tMaybe, type Lang } from '@/lib/i18n';

/**
 * The homepage's "Try a live demo" strip: every /work demo from lib/projects
 * (cover, one line, "Try it →") in a swipeable row. Demos only — each card says
 * "Live demo", and the line under the row says the names are made up.
 */
export default function DemoStrip({ lang = 'en' }: { lang?: Lang }) {
  return (
    <DemoRail
      label={t(lang, 'pf.demos')}
      prevLabel={t(lang, 'dm.prev')}
      nextLabel={t(lang, 'dm.next')}
      head={
        <div className="sh-dr-title">
          <p className="feed-kicker">{t(lang, 'dm.kicker')}</p>
          <h2 id="demos-title" className="sh-h2">
            {t(lang, 'dm.title')}
          </h2>
        </div>
      }
    >
      {LIVE_DEMOS.map((p) => (
        <li key={p.id} className="sh-dr-item">
          <Link href={demoHref(p)!} className="sh-dr-card">
            <span className="sh-dr-cover">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.cover.src} alt="" width={p.cover.width} height={p.cover.height} loading="lazy" decoding="async" />
              <span className="sh-tag sh-tag-demo">{t(lang, 'pb.demo')}</span>
            </span>
            <span className="sh-dr-body">
              <strong>{tMaybe(lang, `pj.${p.id}`, p.title)}</strong>
              <span className="sh-dr-line">{p.tryIt ?? p.outcome}</span>
              <span className="sh-dr-try">{t(lang, 'dm.try')}</span>
            </span>
          </Link>
        </li>
      ))}
    </DemoRail>
  );
}
