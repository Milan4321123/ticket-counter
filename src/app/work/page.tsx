import Link from 'next/link';
import type { Metadata } from 'next';
import { StudioCta } from '@/components/studio/StudioBlocks';
import BuildIdeaCard from '@/components/studio/BuildIdeaCard';
import { LIVE_DEMOS, demoHref } from '@/lib/projects';
import { shareImages, STUDIO_SHARE_CARD } from '@/lib/seo';
import { currentLang } from '@/lib/i18nServer';
import { t, tMaybe } from '@/lib/i18n';
import '@/app/studio/studio.css';

// /work — the gallery of the studio's live demos (/work/wedding, /work/artist,
// …): one big card each with what you can try in it. The list is LIVE_DEMOS
// from lib/projects.ts, so a new demo there shows up here, on the homepage
// strip and in every demo's prev / next links by itself.
//
// Every card is labelled a demo and the names in them are made up; real client
// work (NPJOE e.V., Prakash Saput Live) lives on /studio and is linked from
// here, never mixed in. No prices, quotes or packages anywhere — the operator
// is a student and the studio is free while it grows (see app/studio/page.tsx).

const title = 'Live demos — apps & websites you can try';
const description =
  'Try our demo apps and websites in your browser: a wedding invitation, an artist page, a live event quiz, a venue dashboard, a class booking app, a website kit for associations, QR table ordering for restaurants, a Dashain kite-fighting game, a link page and business card maker, an event photo booth, a momo food-truck app, a futsal tournament app and a kids’ Nepali alphabet app.';

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/work' },
  openGraph: { type: 'website', title, description, url: '/work', images: shareImages(STUDIO_SHARE_CARD) },
  twitter: { card: 'summary_large_image', title, description, images: [STUDIO_SHARE_CARD.url] },
};

export default async function WorkIndex() {
  const lang = await currentLang();
  const n = LIVE_DEMOS.length;
  return (
    <>
      <section className="feed-hero st-hero">
        <div className="container">
          <p className="feed-kicker anim-fade-up">{t(lang, 'wk.kicker')}</p>
          <h1 className="anim-fade-up anim-d1">{t(lang, 'wk.h1')}</h1>
          <p className="feed-hero-sub anim-fade-up anim-d2">{t(lang, 'wk.sub', { n })}</p>
          <p className="wk-note anim-fade-up anim-d2">{t(lang, 'dm.note')}</p>
        </div>
      </section>

      <section className="section sh-section wk-build">
        <div className="container">
          <BuildIdeaCard lang={lang} />
        </div>
      </section>

      <section className="section sh-section">
        <div className="container">
          <ol className="wk-list">
            {LIVE_DEMOS.map((p, i) => {
              const href = demoHref(p)!;
              const talk = p.links.find((l) => l.href.startsWith('/contact'))?.href ?? '/contact';
              const name = tMaybe(lang, `pj.${p.id}`, p.title);
              return (
                <li key={p.id} id={p.id} className="wk-card">
                  <Link href={href} className="wk-cover" tabIndex={-1} aria-hidden="true">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.cover.src}
                      alt=""
                      width={p.cover.width}
                      height={p.cover.height}
                      loading={i === 0 ? 'eager' : 'lazy'}
                      decoding="async"
                    />
                  </Link>
                  <div className="wk-body">
                    <p className="wk-n">{t(lang, 'wk.n', { i: i + 1, n })}</p>
                    <div className="sh-pc-tags">
                      <span className="sh-tag sh-tag-demo">{t(lang, 'pb.demo')}</span>
                      {p.tags.map((tag) => (
                        <span key={tag} className={`sh-tag sh-tag-${tag.toLowerCase()}`}>
                          {t(lang, `tag.${tag}`)}
                        </span>
                      ))}
                    </div>
                    <h2>
                      <Link href={href}>{name}</Link>
                    </h2>
                    <p className="sh-pc-client">{p.client}</p>
                    <p className="wk-outcome">{p.outcome}</p>
                    {p.tryIt && <p className="wk-tryit">{p.tryIt}</p>}
                    <h3 className="wk-try-h">{t(lang, 'wk.try')}</h3>
                    <ul className="sh-pc-points">
                      {p.points.map((x) => (
                        <li key={x}>{x}</li>
                      ))}
                    </ul>
                    <div className="wk-ctas">
                      <Link href={href} className="sh-btn sh-btn-main">
                        {t(lang, 'dm.try')}
                      </Link>
                      <Link href={talk} className="sh-btn">
                        {t(lang, 'dm.want')}
                      </Link>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
          <p className="wk-real">
            <Link href="/studio#projects">{t(lang, 'wk.real')}</Link>
          </p>
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
