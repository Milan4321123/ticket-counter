import type { Metadata } from 'next';
import Link from 'next/link';
import { shareImages } from '@/lib/seo';
import ContactBand from './ContactBand';
import { FEATURE_COUNT, FEATURE_GROUPS } from './features';
import styles from './showcase.module.css';
import DemoStart from '@/components/DemoStart';

const title = 'Everything this platform does';
const description =
  `${FEATURE_COUNT} working features — event pages, QR tickets, a bazaar of shops, instant ` +
  'payments to the seller’s own account, door scanning, insights and AI helpers. See each one live.';

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/showcase' },
  openGraph: { type: 'website', title, description, url: '/showcase', images: shareImages() },
};

export default function ShowcasePage() {
  return (
    <>
      <section className={`feed-hero ${styles.hero}`}>
        <div className="container">
          <p className="feed-kicker anim-fade-up">Feature tour</p>
          <h1 className="anim-fade-up anim-d1">Everything this platform does</h1>
          <p className="feed-hero-sub anim-fade-up anim-d2">
            {FEATURE_COUNT} features that work today, for buyers, organizers and shops. Open each one
            on a live page, or in a private demo account of your own.
          </p>
          <p className="feed-hero-actions anim-fade-up anim-d3">
            <DemoStart className="btn btn-brand">
              Try the organizer demo
            </DemoStart>
            <Link href="/built" className="btn btn-green">
              How it&rsquo;s built
            </Link>
            <Link href="/studio" className="btn">
              Videos &amp; custom builds
            </Link>
          </p>
        </div>
      </section>

      <nav className={styles.chipBar} aria-label="Feature groups">
        <div className={`container ${styles.chipRow}`}>
          {FEATURE_GROUPS.map((g) => (
            <a key={g.id} href={`#${g.id}`} className={styles.chip}>
              {g.label}
              <span className={styles.chipCount}>{g.features.length}</span>
            </a>
          ))}
        </div>
      </nav>

      <div className="container">
        <p className={`muted small ${styles.legend}`}>
          <span className={styles.legendLive}>See it live</span> opens a public page.{' '}
          <span className={styles.legendDemo}>Try it in the demo</span> opens your own private
          organizer account for 24 hours — nothing you do there is public.
        </p>

        {FEATURE_GROUPS.map((g) => (
          <section key={g.id} id={g.id} className={styles.group} aria-labelledby={`${g.id}-title`}>
            <div className={styles.groupHead}>
              <h2 id={`${g.id}-title`} className="feed-section-title" style={{ margin: 0 }}>
                {g.label}
              </h2>
              <p className="muted small" style={{ margin: 0 }}>
                {g.intro}
              </p>
            </div>
            <ul className={styles.grid}>
              {g.features.map((f) => (
                <li key={f.title} className={styles.card}>
                  <h3 className={styles.cardTitle}>{f.title}</h3>
                  <p className={styles.cardBody}>{f.benefit}</p>
                  <p className={styles.cardLinks}>
                    {f.links.map((l) =>
                      l.kind === 'demo' ? (
                        // Starts the demo on that very page — no picker in between.
                        <DemoStart
                          key={l.href + l.label}
                          to={new URLSearchParams(l.href.split('?')[1] ?? '').get('to') ?? 'portal'}
                          plain
                          className={styles.linkDemo}
                        >
                          {l.label} →
                        </DemoStart>
                      ) : (
                        <Link key={l.href + l.label} href={l.href} className={styles.linkLive}>
                          {l.label} →
                        </Link>
                      )
                    )}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <ContactBand />
    </>
  );
}
