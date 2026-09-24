import type { Metadata } from 'next';
import Link from 'next/link';
import { shareImages } from '@/lib/seo';
import ContactBand from '../showcase/ContactBand';
import { FEATURE_COUNT } from '../showcase/features';
import styles from './built.module.css';

const title = 'How it’s built';
const description =
  'The engineering behind the platform: Next.js 15, React 19 and SQLite; one listing engine for events ' +
  'and shops; 446 automated tests; measured performance work; and security built for other people’s money.';

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/built' },
  openGraph: { type: 'website', title, description, url: '/built', images: shareImages() },
};

/*
 * Every number on this page was measured or counted, not estimated:
 *  - TESTS: `npm test` → "ℹ tests 446 / pass 446 / fail 0" (Sep 2026).
 *  - PAGES / API ROUTES / TABLES: counted page.tsx, api route.ts files and
 *    CREATE TABLE statements in src/lib/db.ts.
 *  - PERF rows: before/after measurements recorded when each fix landed.
 * Update them when they change — a stale number on a page about honesty is
 * the one kind of mistake this page cannot afford.
 */
const STATS: { value: string; label: string }[] = [
  { value: '446', label: 'automated tests, all passing' },
  { value: String(FEATURE_COUNT), label: 'features you can try' },
  { value: '55', label: 'pages' },
  { value: '76', label: 'API routes' },
  { value: '€0', label: 'held by the platform, ever' },
];

const STACK: { name: string; why: string }[] = [
  { name: 'Next.js 15 (App Router)', why: 'Server-rendered pages, so a listing loads fast on a phone and reads well to Google.' },
  { name: 'React 19 + TypeScript', why: 'Strict types end to end; `tsc --noEmit` is part of every change.' },
  { name: 'SQLite via better-sqlite3', why: 'One file, synchronous transactions — overselling is blocked atomically, backups are a file copy.' },
  { name: 'sharp', why: 'Every photo is re-encoded and cut to the exact shape of each slot it appears in.' },
  { name: 'nodemailer over SMTP (SendGrid)', why: 'Tickets, payment instructions, reminders and security alerts.' },
  { name: 'PayPal & Stripe REST, plain fetch', why: 'No SDKs — small clients calling each seller’s own account directly.' },
  { name: 'qrcode', why: 'QR tickets, collection codes, GiroCode payment QR and the WhatsApp poster.' },
  { name: 'Gemini + Claude', why: 'Visitor Q&A, the help bot, the AI page designer and voice input — each with fallbacks.' },
];

const PERF: { what: string; before: string; after: string }[] = [
  { what: 'Homepage — SQL statements per request', before: '96', after: '9' },
  { what: 'Phone homepage — autoplay video downloaded on load', before: '10.5 MB', after: '0 bytes' },
  { what: 'Item page — image weight', before: '592 KB', after: '117 KB' },
  { what: 'Returning-buyer query (was quadratic)', before: '1,026 ms', after: '5 ms' },
  { what: 'Portal dashboard, 20 events — SQL statements', before: '243', after: '4' },
  { what: 'Monthly statement — SQL statements', before: '1,988', after: '3' },
];

const SECURITY: string[] = [
  'Two-factor sign-in for organizers: an authenticator app, or a code emailed to the account’s own address.',
  'Changing where money lands asks the organizer to prove it is them again, takes effect only after 24 hours, and sends an alarm email.',
  'Sellers’ own PayPal secrets and Stripe keys are encrypted at rest (AES-256-GCM).',
  'Rate limits on sign-in, code checks and order creation.',
  'Uploads are checked by their real bytes (magic numbers), not their file name — an SVG disguised as a PNG is refused.',
  'Request bodies are capped while they stream in, so an oversized POST is cut off before it is buffered.',
  'Door scanner links are signed and time-limited, and open one event’s check-in and nothing else.',
  'A tenant-isolation review of every portal route: 9 findings, all fixed, with tests that keep them fixed.',
  'A live-exploitable leak of account data on order pages was found and closed with signed per-order access tokens.',
];

const PRIVACY: string[] = [
  'GDPR retention: buyer names and emails are overwritten after the event; counts and revenue survive, the person does not.',
  'Erasure on request, including customer cards and marketing consent.',
  'Marketing is double opt-in only, and every announcement has a one-click unsubscribe.',
  'A consent banner is answered before any analytics loads — and analytics never runs on pages whose URL carries a credential.',
  'Listing pages name the organizer or shop as the one selling (“Presented by”, “Sold by”), so the seller of record is clear under German VAT rules.',
];

const AI: string[] = [
  'Grounded: the event assistant answers only from the organizer’s own page content.',
  'Strict JSON out, validated before use — a malformed reply is treated as no reply.',
  'A confidence gate: when the model is not sure, the question goes to the organizer instead of being guessed.',
  'A model ladder with fallbacks (Gemini, then Claude), and built-in answers when no model is reachable.',
  'The page designer can only choose from the site’s fixed design options — it never writes code or styles into a page.',
];

export default function BuiltPage() {
  return (
    <>
      <section className={`feed-hero ${styles.hero}`}>
        <div className="container">
          <p className="feed-kicker anim-fade-up">Engineering</p>
          <h1 className="anim-fade-up anim-d1">How it&rsquo;s built</h1>
          <p className="feed-hero-sub anim-fade-up anim-d2">
            A production ticketing and marketplace platform. Here is what it runs on, how it is
            tested, and what was measured along the way.
          </p>
          <p className="feed-hero-actions anim-fade-up anim-d3">
            <Link href="/showcase" className="btn btn-green">
              See every feature
            </Link>
            <Link href="/demo" className="btn btn-brand">
              Try the organizer demo
            </Link>
          </p>
        </div>
      </section>

      <div className="container">
        <ul className={styles.stats} aria-label="At a glance">
          {STATS.map((s) => (
            <li key={s.label} className={styles.stat}>
              <span className={styles.statValue}>{s.value}</span>
              <span className={styles.statLabel}>{s.label}</span>
            </li>
          ))}
        </ul>

        <nav className={styles.toc} aria-label="On this page">
          {[
            ['stack', 'Stack'],
            ['architecture', 'Architecture'],
            ['testing', 'Testing'],
            ['performance', 'Performance'],
            ['security', 'Security'],
            ['privacy', 'Privacy'],
            ['ai', 'AI'],
          ].map(([id, label]) => (
            <a key={id} href={`#${id}`} className={styles.tocLink}>
              {label}
            </a>
          ))}
        </nav>

        {/* ---- Stack ---- */}
        <section id="stack" className={styles.block} aria-labelledby="stack-title">
          <p className="feed-kicker">Stack</p>
          <h2 id="stack-title" className="feed-section-title">
            Boring, dependable tools
          </h2>
          <ul className={styles.stackGrid}>
            {STACK.map((s) => (
              <li key={s.name} className={styles.stackItem}>
                <strong>{s.name}</strong>
                <span className="muted small">{s.why}</span>
              </li>
            ))}
          </ul>
          <p className="muted small" style={{ marginTop: 12 }}>
            Eight runtime dependencies in total. No ORM, no payment SDKs, no CSS framework.
          </p>
        </section>

        {/* ---- Architecture ---- */}
        <section id="architecture" className={styles.block} aria-labelledby="arch-title">
          <p className="feed-kicker">Architecture</p>
          <h2 id="arch-title" className="feed-section-title">
            One machine for events and shops
          </h2>
          <p className={styles.lead}>
            A ticket and a plate of momo are the same thing to this system: a <strong>listing</strong>{' '}
            (a page), <strong>priced types with caps</strong> (tiers or items), <strong>orders</strong>,
            a <strong>QR code</strong> per unit and <strong>one scan</strong> to use it. Events and shops
            share every line of that — only the words change.
          </p>

          <div className={styles.diagram} role="img" aria-label="How a sale flows: the buyer opens a listing page, checks out, and pays the seller's own account; the seller confirms or the provider does; QR codes are issued and scanned once at the door or counter. The organizer runs everything from the portal.">
            <div className={styles.lane}>
              <span className={styles.laneLabel}>Buyer</span>
              <div className={styles.flow}>
                <span className={styles.node}>Buyer&rsquo;s phone</span>
                <span className={styles.arrow} aria-hidden="true">→</span>
                <span className={styles.node}>Listing page<small>event or shop</small></span>
                <span className={styles.arrow} aria-hidden="true">→</span>
                <span className={styles.node}>Checkout<small>no account</small></span>
                <span className={styles.arrow} aria-hidden="true">→</span>
                <span className={`${styles.node} ${styles.nodeMoney}`}>
                  Seller&rsquo;s own account<small>IBAN · PayPal · Stripe</small>
                </span>
              </div>
            </div>
            <div className={styles.lane}>
              <span className={styles.laneLabel}>Organizer</span>
              <div className={styles.flow}>
                <span className={`${styles.node} ${styles.nodeBrand}`}>Organizer portal</span>
                <span className={styles.arrow} aria-hidden="true">→</span>
                <span className={styles.node}>Confirm payment<small>or instantly, by PayPal / Stripe</small></span>
                <span className={styles.arrow} aria-hidden="true">→</span>
                <span className={styles.node}>QR codes issued<small>email + order page</small></span>
              </div>
            </div>
            <div className={styles.lane}>
              <span className={styles.laneLabel}>Door</span>
              <div className={styles.flow}>
                <span className={styles.node}>Signed scanner link</span>
                <span className={styles.arrow} aria-hidden="true">→</span>
                <span className={styles.node}>Scan QR</span>
                <span className={styles.arrow} aria-hidden="true">→</span>
                <span className={`${styles.node} ${styles.nodeOk}`}>Used once<small>wrong event rejected</small></span>
              </div>
            </div>
            <p className={styles.diagramNote}>
              The platform is never on the money path: it holds no funds and no card data.
            </p>
          </div>

          <ul className={styles.list}>
            <li>
              <strong>Multi-tenant.</strong> Every portal and API request checks that the organizer owns
              the event, order or photo it touches — enforced on the server, covered by tenancy tests.
            </li>
            <li>
              <strong>Money never touches the platform.</strong> Each seller connects their own IBAN,
              PayPal or Stripe; buyers pay them directly. The platform is software, not a payment service.
            </li>
            <li>
              <strong>Server-side truth.</strong> Prices, caps and seats are enforced inside a database
              transaction, so a browser cannot change a price and a rush cannot oversell.
            </li>
          </ul>
        </section>

        {/* ---- Testing ---- */}
        <section id="testing" className={styles.block} aria-labelledby="testing-title">
          <p className="feed-kicker">Reliability &amp; testing</p>
          <h2 id="testing-title" className="feed-section-title">
            446 tests, and a check that they bite
          </h2>
          <div className={styles.twoCol}>
            <div className={styles.panel}>
              <span className={styles.bigNum}>446</span>
              <p className="muted small" style={{ margin: 0 }}>
                automated tests on Node&rsquo;s built-in test runner, all passing: money maths, orders
                and capacity, payouts, promos and referrals, reviews, tenancy, consent, email, SEO.
              </p>
            </div>
            <div className={styles.panel}>
              <span className={styles.bigNum}>14 / 19</span>
              <p className="muted small" style={{ margin: 0 }}>
                A mutation audit injected 19 deliberate bugs into the code; the suite caught 14. Each of
                the 5 that slipped through then got its own test.
              </p>
            </div>
          </div>
        </section>

        {/* ---- Performance ---- */}
        <section id="performance" className={styles.block} aria-labelledby="perf-title">
          <p className="feed-kicker">Performance</p>
          <h2 id="perf-title" className="feed-section-title">
            Measured before and after
          </h2>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">What</th>
                  <th scope="col">Before</th>
                  <th scope="col">After</th>
                </tr>
              </thead>
              <tbody>
                {PERF.map((p) => (
                  <tr key={p.what}>
                    <th scope="row">{p.what}</th>
                    <td className={styles.before}>{p.before}</td>
                    <td className={styles.after}>{p.after}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ---- Security ---- */}
        <section id="security" className={styles.block} aria-labelledby="security-title">
          <p className="feed-kicker">Security</p>
          <h2 id="security-title" className="feed-section-title">
            Built for other people&rsquo;s money
          </h2>
          <ul className={styles.checkList}>
            {SECURITY.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </section>

        {/* ---- Privacy ---- */}
        <section id="privacy" className={styles.block} aria-labelledby="privacy-title">
          <p className="feed-kicker">Privacy &amp; compliance</p>
          <h2 id="privacy-title" className="feed-section-title">
            Keeps less, for less time
          </h2>
          <ul className={styles.checkList}>
            {PRIVACY.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
          <p className="small" style={{ marginTop: 12 }}>
            <Link href="/privacy" className={styles.inlineLink}>
              Read the privacy notice →
            </Link>
          </p>
        </section>

        {/* ---- AI ---- */}
        <section id="ai" className={styles.block} aria-labelledby="ai-title">
          <p className="feed-kicker">AI</p>
          <h2 id="ai-title" className="feed-section-title">
            Helpful, and allowed to say &ldquo;I don&rsquo;t know&rdquo;
          </h2>
          <ul className={styles.checkList}>
            {AI.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </section>
      </div>

      <ContactBand />
    </>
  );
}
