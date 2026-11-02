import Link from 'next/link';

// The studio's shared blocks — the homepage and /studio both use them, so the
// wording lives in one place. No prices, quotes or "packages" anywhere: the
// way in is always a conversation (/contact), framed as free while we grow
// (see app/studio/page.tsx for why).

const MAKE = [
  {
    id: 'apps',
    icon: (
      <svg viewBox="0 0 24 24">
        <rect x="6" y="2.5" width="12" height="19" rx="2.5" />
        <path d="M10.5 18.5h3" />
      </svg>
    ),
    title: 'Apps',
    line: 'For organizers, restaurants and shops.',
    points: ['Tickets with QR codes and door scanning', 'Order-ahead and a live kitchen board', 'Shops with collection codes', 'Works on any phone — in English, Deutsch and नेपाली'],
    href: '/contact?intent=app',
    cta: 'Talk to us about an app',
  },
  {
    id: 'websites',
    icon: (
      <svg viewBox="0 0 24 24">
        <rect x="2.5" y="4" width="19" height="15" rx="2.5" />
        <path d="M2.5 8.5h19M6 6.3h.01M8.5 6.3h.01" />
      </svg>
    ),
    title: 'Websites',
    line: 'For associations, businesses and festivals.',
    points: ['Association and club sites, like NPJOE e.V.', 'Event and festival pages', 'Three languages from day one', 'Programmes, gallery, sign-up forms'],
    href: '/contact?intent=website',
    cta: 'Talk to us about a website',
  },
  {
    id: 'videos',
    icon: (
      <svg viewBox="0 0 24 24">
        <rect x="2.5" y="5" width="14" height="14" rx="2.5" />
        <path d="m16.5 10 5-3v10l-5-3" />
      </svg>
    ),
    title: 'Ad & stage videos',
    line: 'For the sale, the stage and the screen.',
    points: ['9:16 ads for Reels, TikTok and WhatsApp status', 'Walk-on intros for artists', 'Stage-screen loops and song visuals', 'Promo films for a new website or app'],
    href: '/contact?intent=video',
    cta: 'Talk to us about a video',
  },
];

export function WhatWeMake() {
  return (
    <div className="sh-make">
      {MAKE.map((m) => (
        <article key={m.id} className={`sh-make-card sh-make-${m.id}`}>
          <span className="sh-make-icon" aria-hidden="true">
            {m.icon}
          </span>
          <h3>{m.title}</h3>
          <p className="sh-make-line">{m.line}</p>
          <ul>
            {m.points.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          <Link href={m.href} className="sh-make-cta">
            {m.cta} →
          </Link>
        </article>
      ))}
    </div>
  );
}

const STEPS = [
  { n: '1', title: 'Tell us', text: 'A few lines in the chat — in Nepali, English or German. What it is for, who it is for, and when you need it.' },
  { n: '2', title: 'We make it with you', text: 'You see the first screens or the first cut early, and say what to change. Your photos, your songs, your words.' },
  { n: '3', title: 'It goes live', text: 'Share it in your groups, on the big screen, on your phone — and we keep improving it with you.' },
];

export function HowItWorks() {
  return (
    <ol className="sh-steps">
      {STEPS.map((s) => (
        <li key={s.n} className="sh-step">
          <span className="sh-step-n" aria-hidden="true">
            {s.n}
          </span>
          <h3>{s.title}</h3>
          <p>{s.text}</p>
        </li>
      ))}
    </ol>
  );
}

/** The big "Kura garau" band at the bottom of the studio pages. */
export function StudioCta({ title = 'Need an app, a website or an ad video?' }: { title?: string }) {
  return (
    <div className="stv-cta sh-cta">
      <p className="stv-cta-kicker">
        <span lang="ne">कुरा गरौं</span> · Kura garau
      </p>
      <h2>{title}</h2>
      <p>Tell us what you have in mind — we make it with you, free while we grow. A real person reads every message.</p>
      <div className="sh-cta-pick">
        <Link href="/contact?intent=app">
          <span aria-hidden="true">📱</span> An app
        </Link>
        <Link href="/contact?intent=website">
          <span aria-hidden="true">🌐</span> A website
        </Link>
        <Link href="/contact?intent=video">
          <span aria-hidden="true">🎬</span> A video
        </Link>
      </div>
      <div className="stv-cta-row">
        <Link href="/contact" className="stv-cta-btn">
          Kura garau — tell us what you need
        </Link>
        <span className="stv-cta-note">Milan replies by email.</span>
      </div>
    </div>
  );
}
