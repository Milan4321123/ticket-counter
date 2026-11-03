import Link from 'next/link';
import { t, type Lang } from '@/lib/i18n';

// The studio's shared blocks — the homepage and /studio both use them. The
// headings, lines and buttons are in lib/i18n (st.*, mk.*, how.*, cta.*) in
// English, Deutsch and नेपाली; the bullet points stay English here (the
// site's AutoTranslate covers them). No prices, quotes or "packages" anywhere:
// the way in is always a conversation (/contact), framed as free while we
// grow (see app/studio/page.tsx for why).

const MAKE = [
  {
    id: 'apps',
    key: 'mk.apps' as const,
    icon: (
      <svg viewBox="0 0 24 24">
        <rect x="6" y="2.5" width="12" height="19" rx="2.5" />
        <path d="M10.5 18.5h3" />
      </svg>
    ),
    points: ['Tickets with QR codes and door scanning', 'Order-ahead and a live kitchen board', 'Shops with collection codes', 'Works on any phone — in English, Deutsch and नेपाली'],
    href: '/contact?intent=app',
  },
  {
    id: 'websites',
    key: 'mk.websites' as const,
    icon: (
      <svg viewBox="0 0 24 24">
        <rect x="2.5" y="4" width="19" height="15" rx="2.5" />
        <path d="M2.5 8.5h19M6 6.3h.01M8.5 6.3h.01" />
      </svg>
    ),
    points: ['Association and club sites, like NPJOE e.V.', 'Event and festival pages', 'Three languages from day one', 'Programmes, gallery, sign-up forms'],
    href: '/contact?intent=website',
  },
  {
    id: 'videos',
    key: 'mk.videos' as const,
    icon: (
      <svg viewBox="0 0 24 24">
        <rect x="2.5" y="5" width="14" height="14" rx="2.5" />
        <path d="m16.5 10 5-3v10l-5-3" />
      </svg>
    ),
    points: ['9:16 ads for Reels, TikTok and WhatsApp status', 'Walk-on intros for artists', 'Stage-screen loops and song visuals', 'Promo films for a new website or app'],
    href: '/contact?intent=video',
  },
];

export function WhatWeMake({ lang = 'en' }: { lang?: Lang }) {
  return (
    <div className="sh-make">
      {MAKE.map((m) => (
        <article key={m.id} className={`sh-make-card sh-make-${m.id}`}>
          <span className="sh-make-icon" aria-hidden="true">
            {m.icon}
          </span>
          <h3>{t(lang, m.key)}</h3>
          <p className="sh-make-line">{t(lang, `${m.key}.line`)}</p>
          <ul>
            {m.points.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          <Link href={m.href} className="sh-make-cta">
            {t(lang, `${m.key}.cta`)} →
          </Link>
        </article>
      ))}
    </div>
  );
}

const STEPS = ['1', '2', '3'] as const;

export function HowItWorks({ lang = 'en' }: { lang?: Lang }) {
  return (
    <ol className="sh-steps">
      {STEPS.map((n) => (
        <li key={n} className="sh-step">
          <span className="sh-step-n" aria-hidden="true">
            {n}
          </span>
          <h3>{t(lang, `how.${n}`)}</h3>
          <p>{t(lang, `how.${n}.text`)}</p>
        </li>
      ))}
    </ol>
  );
}

/** The big "Kura garau" band at the bottom of the studio pages. */
export function StudioCta({ more = false, lang = 'en' }: { more?: boolean; lang?: Lang }) {
  return (
    <div className="stv-cta sh-cta">
      <p className="stv-cta-kicker">
        <span lang="ne" translate="no">कुरा गरौं</span> · <span translate="no">Kura garau</span>
      </p>
      <h2>{t(lang, more ? 'cta.titleMore' : 'cta.title')}</h2>
      <p>{t(lang, 'cta.text')}</p>
      <div className="sh-cta-pick">
        <Link href="/contact?intent=app">
          <span aria-hidden="true">📱</span> {t(lang, 'cta.app')}
        </Link>
        <Link href="/contact?intent=website">
          <span aria-hidden="true">🌐</span> {t(lang, 'cta.website')}
        </Link>
        <Link href="/contact?intent=video">
          <span aria-hidden="true">🎬</span> {t(lang, 'cta.video')}
        </Link>
      </div>
      <div className="stv-cta-row">
        <Link href="/contact" className="stv-cta-btn">
          {t(lang, 'st.cta')}
        </Link>
        <span className="stv-cta-note">{t(lang, 'cta.note')}</span>
      </div>
    </div>
  );
}
