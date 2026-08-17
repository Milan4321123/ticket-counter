import Link from 'next/link';
import { formatMoney } from '@/lib/money';
import {
  eventFeeAmount,
  platformContactEmail,
  platformFeeBaseAmount,
  platformFeePerTicketAmount,
} from '@/lib/platform';
import DashboardMock from '@/components/mockups/DashboardMock';
import PlatformAssistant from '@/components/PlatformAssistant';
import EditorMock from '@/components/mockups/EditorMock';
import EventPageMock from '@/components/mockups/EventPageMock';

// The fee comes from env vars — read them fresh on every request.
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Sell tickets on NepaliConcert — for organizers',
  description:
    'Your own beautiful event page, QR tickets, door scanning, and ticket money straight to your bank account. €50 for a 500-person event, no commission on ticket sales.',
  alternates: { canonical: '/organizers' },
  openGraph: {
    type: 'website',
    title: 'Sell tickets on NepaliConcert — for organizers',
    description: 'Your own beautiful event page, QR tickets, door scanning, and ticket money straight to your bank account. €50 for a 500-person event, no commission on ticket sales.',
    url: '/organizers',
  },
};

/** The venue size the headline price is quoted for. */
const HEADLINE_CAPACITY = 500;

/** Example venue sizes for the pricing table — small room first, so the minimum shows. */
const EXAMPLE_CAPACITIES = [100, 150, 300, 500, 1000];

const INCLUDED: string[] = [
  'No commission on ticket sales',
  'Payments straight to your bank',
  'QR tickets emailed automatically',
  'Door scanning links for staff',
  'AI page designer',
  'AI question assistant, 24/7',
  'Automatic payment reminders',
  'Student tiers with ID checks',
  'Announcements and built-in FAQ',
  'Free account — you pay per event',
];

function FeatPoint({ children }: { children: React.ReactNode }) {
  return (
    <li className="feat-point">
      <span className="feat-dot" aria-hidden>
        &#10003;
      </span>
      <span>{children}</span>
    </li>
  );
}

export default function OrganizersPage() {
  const fee = eventFeeAmount(HEADLINE_CAPACITY);
  const baseFee = platformFeeBaseAmount();
  const perTicketFee = platformFeePerTicketAmount();
  const contactEmail = platformContactEmail();

  return (
    <>
      {/* ---- Hero ---- */}
      <section className="feed-hero">
        <div className="container">
          <p className="feed-kicker anim-fade-up">For event organizers</p>
          <h1 className="anim-fade-up anim-d1">
            Sell tickets for your event — the easy way
          </h1>
          <p className="feed-hero-sub anim-fade-up anim-d2">
            A beautiful event page, QR tickets, door scanning — and every payment lands
            straight in your own bank account. {fee} for a {HEADLINE_CAPACITY}-person event, no
            commission — the account itself is free.
          </p>
          <p className="feed-hero-actions anim-fade-up anim-d3">

            {/* Kept on THIS page on purpose. "Get started" opens an
                application form, and someone who has not read the page yet does
                not know what they are applying for — they click the only
                confident-looking button and end up filling in a form about an
                account they cannot picture. This one answers the question first,
                without leaving. */}
            {/* The explainer leads, and in green. "Get started" opens an
                application form, so putting it first asks someone to commit
                before they have been told what to. Green reads as "go and look",
                red as "do the thing" — and looking is the right first move for
                almost everyone arriving here. */}
            <a href="#what-you-get" className="btn btn-green btn-lg">
              See how it works
            </a>
            <Link href="/contact?intent=account" className="btn btn-brand btn-lg">
              Get started
            </Link>
            <Link href="/" className="btn btn-lg">
              See a live event page
            </Link>
          </p>
        </div>
      </section>

      {/* ---- Feature rows: mockup + three punchy points each ---- */}
      <section className="section">
        <div className="container">
          {/* Where "See how it works first" lands. scroll-margin-top keeps the
              heading clear of the sticky header instead of under it. */}
          <div id="what-you-get" style={{ scrollMarginTop: 90 }}>
            <p className="feed-kicker anim-fade-up">How it works</p>
            <h2 className="feat-title anim-fade-up" style={{ marginTop: 4 }}>
              Apply once, then everything is yours to run
            </h2>
            <ol className="step-list anim-fade-up" style={{ maxWidth: 720, marginTop: 14 }}>
              <li className="step-item">
                <span className="step-num step-num-brand" aria-hidden>1</span>
                <div>
                  <strong>Tell us about your event</strong>
                  <p className="muted small" style={{ margin: 0 }}>
                    A real person reads it and sets your account up, usually within a couple of
                    days. We email you a sign-in — an email address and a password — and that is
                    what gets you in. Nothing to pay, and no card to enter.
                  </p>
                </div>
              </li>
              <li className="step-item">
                <span className="step-num step-num-brand" aria-hidden>2</span>
                <div>
                  <strong>Sign in, and your event page is yours to build</strong>
                  <p className="muted small" style={{ margin: 0 }}>
                    That sign-in opens your organizer portal. Inside it is an editor for your
                    event page — the cover photo people see in the listing, your gallery and
                    video, the text, the colours, your ticket types and prices, and the bank
                    account the money goes to. You change it, you press save, and that is what
                    visitors see. Nobody has to build it for you, and you can preview the whole
                    page privately before anyone else can open it.
                  </p>
                </div>
              </li>
              <li className="step-item">
                <span className="step-num step-num-brand" aria-hidden>3</span>
                <div>
                  <strong>Pay that event's fee and publish</strong>
                  <p className="muted small" style={{ margin: 0 }}>
                    The Publish tab shows the exact amount for your capacity, with the bank
                    details and payment reference. The moment your transfer lands, publishing
                    unlocks. One fee per event — never a cut of your sales.
                  </p>
                </div>
              </li>
              <li className="step-item">
                <span className="step-num step-num-brand" aria-hidden>4</span>
                <div>
                  <strong>Sell straight to your own bank account</strong>
                  <p className="muted small" style={{ margin: 0 }}>
                    Buyers pay you directly — by transfer or PayPal. Confirm a payment and the QR
                    tickets go out on their own; on the night, scan them at the door.
                  </p>
                </div>
              </li>
            </ol>
          </div>

          {/* Dashboard */}
          <div className="feat-row">
            <div className="feat-copy anim-fade-up">
              <p className="feed-kicker">Your dashboard</p>
              <h2 className="feat-title">See every sale the moment it lands</h2>
              <ul className="feat-points">
                <FeatPoint>
                  <strong>Money at a glance</strong> — received and awaiting, per event.
                </FeatPoint>
                <FeatPoint>
                  <strong>Confirm a transfer</strong> and the QR tickets email themselves.
                </FeatPoint>
                <FeatPoint>
                  <strong>Automatic reminders</strong> nudge buyers who haven&rsquo;t paid yet.
                </FeatPoint>
              </ul>
            </div>
            <div className="anim-fade-up anim-d1">
              <DashboardMock />
            </div>
          </div>

          {/* Editor. Anchored: the custom-design page sends people straight
              here to answer "what could I build myself?" before paying anyone
              to build it for them. scroll-margin keeps the heading clear of the
              sticky header. */}
          <div className="feat-row feat-row-flip" id="editor" style={{ scrollMarginTop: 90 }}>
            <div className="feat-copy anim-fade-up">
              <p className="feed-kicker">The editor</p>
              <h2 className="feat-title">Build your page in minutes — no tech skills</h2>
              <ul className="feat-points">
                <FeatPoint>
                  <strong>Seven short steps</strong> — details, photos, tickets, publish.
                </FeatPoint>
                <FeatPoint>
                  <strong>AI page designer</strong> — describe the vibe, get colors and a
                  headline.
                </FeatPoint>
                <FeatPoint>
                  <strong>Edit anytime</strong> — changes go live the moment you save.
                </FeatPoint>
              </ul>
            </div>
            <div className="anim-fade-up anim-d1">
              <EditorMock />
            </div>
          </div>

          {/* Public event page */}
          <div className="feat-row">
            <div className="feat-copy anim-fade-up">
              <p className="feed-kicker">Your event page</p>
              <h2 className="feat-title">A page fans actually share</h2>
              <ul className="feat-points">
                <FeatPoint>
                  <strong>Photos, video, your story</strong> — a page that feels like the
                  night itself.
                </FeatPoint>
                <FeatPoint>
                  <strong>AI assistant</strong> answers fan questions 24/7 from your event
                  details.
                </FeatPoint>
                <FeatPoint>
                  <strong>Student tickets</strong> flagged at the door with a check-ID
                  reminder.
                </FeatPoint>
              </ul>
            </div>
            <div className="anim-fade-up anim-d1">
              <EventPageMock />
            </div>
          </div>
        </div>
      </section>

      {/* ---- Everything included ---- */}
      <section className="section">
        <div className="container">
          <div className="included-band anim-fade-up">
            <p className="feed-kicker">Everything included</p>
            <h2 className="feed-section-title" style={{ marginBottom: 8 }}>
              One fee per event, the whole toolkit
            </h2>
            <ul className="included-grid check-list" style={{ margin: 0 }}>
              {INCLUDED.map((item) => (
                <li key={item} className="included-item">
                  <span className="check-dot check-dot-brand" aria-hidden>
                    &#10003;
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ---- You own your own data ---- */}
      <section className="section">
        <div className="container container-narrow">
          <p className="feed-kicker anim-fade-up">Yours, not ours</p>
          <h2 className="feed-section-title anim-fade-up">You own your own data</h2>
          <p className="muted anim-fade-up" style={{ marginTop: -6 }}>
            We build the tools. The event, the money and the people who come to it stay yours.
          </p>
          <div className="card anim-fade-up anim-d1">
            <ul className="check-list" style={{ margin: 0 }}>
              <li className="check-item">
                <span className="check-dot check-dot-done">&#10003;</span>
                <span>
                  <strong>Your money lands in your bank.</strong> Buyers transfer straight to the
                  account you put on your event. We never hold your ticket money, so there is nothing
                  to pay out and nothing to wait for.
                </span>
              </li>
              <li className="check-item">
                <span className="check-dot check-dot-done">&#10003;</span>
                <span>
                  <strong>Your buyers are your buyers.</strong> Every order — name, email, what they
                  bought, what they paid — sits in your portal and you can search it any time. We use
                  those details to send their tickets and the payment reminders you turn on. Nothing
                  else. We don&rsquo;t sell them and we don&rsquo;t market to them.
                </span>
              </li>
              <li className="check-item">
                <span className="check-dot check-dot-done">&#10003;</span>
                <span>
                  <strong>You can delete it.</strong> When you&rsquo;re done with an event, delete it
                  and its data from your portal. No email to write, no notice period.
                </span>
              </li>
              <li className="check-item">
                <span className="check-dot check-dot-done">&#10003;</span>
                <span>
                  <strong>One fee per event, no cut of your sales.</strong> You pay once when you
                  publish — {baseFee} plus {perTicketFee} for every ticket your venue holds. Never a
                  percentage. Every euro a buyer pays is yours.
                </span>
              </li>
            </ul>
          </div>
        </div>
      </section>


      {/* ---- Pricing ---- */}
      <section className="section">
        <div className="container">
          <div style={{ maxWidth: 440, margin: '0 auto' }}>
            <p className="feed-kicker anim-fade-up" style={{ textAlign: 'center' }}>
              Simple pricing
            </p>
            <h2 className="feed-section-title anim-fade-up" style={{ textAlign: 'center' }}>
              {fee} for a {HEADLINE_CAPACITY}-person event.
            </h2>
            <div className="card glow-card anim-fade-up anim-d1" style={{ textAlign: 'center' }}>
              <div className="tier-price" style={{ fontSize: '2.4rem' }}>
                {fee}
                <span className="muted" style={{ fontSize: '1rem', fontWeight: 600 }}>
                  {' '}
                  / {HEADLINE_CAPACITY}-person event
                </span>
              </div>
              <p className="muted small" style={{ margin: '2px 0 0' }}>
                You pay {baseFee} to publish, plus {perTicketFee} for every ticket your venue
                holds. Small room, small fee. One transfer before you publish — no yearly fee, no
                commission on ticket sales, and nothing to settle afterwards.
              </p>

              <div className="table-wrap" style={{ margin: '14px 0 4px' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Your venue holds</th>
                      <th>You pay, once</th>
                    </tr>
                  </thead>
                  <tbody>
                    {EXAMPLE_CAPACITIES.map((capacity) => (
                      <tr key={capacity}>
                        <td>{capacity} people</td>
                        <td style={{ fontWeight: 700 }}>
                          {eventFeeAmount(capacity)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <ul className="check-list" style={{ textAlign: 'left', margin: '14px 0 18px' }}>
                <li className="check-item">
                  <span className="check-dot check-dot-done">&#10003;</span>
                  <span>
                    <strong>No commission</strong> — every euro your buyers pay is yours
                  </span>
                </li>
                <li className="check-item">
                  <span className="check-dot check-dot-done">&#10003;</span>
                  <span>Free account, unlimited drafts — you pay per published event</span>
                </li>
                <li className="check-item">
                  <span className="check-dot check-dot-done">&#10003;</span>
                  <span>Ticket money goes straight to your own bank account</span>
                </li>
                <li className="check-item">
                  <span className="check-dot check-dot-done">&#10003;</span>
                  <span>AI designer, assistant, scanner links, reminders — all in</span>
                </li>
              </ul>
              <Link href="/contact?intent=account" className="btn btn-brand btn-block btn-lg">
                Get started
              </Link>
            </div>
          </div>

          {/* ---- Upsell: we design it for you ---- */}
          <div
            className="card anim-fade-up anim-d2"
            style={{ maxWidth: 560, margin: '18px auto 0', textAlign: 'center' }}
          >
            <div className="card-title">Want something more custom?</div>
            <p className="muted small" style={{ marginTop: 0 }}>
              Bigger festival? Sponsor logos? A look that&rsquo;s entirely yours? Our team can design
              your page for you — tell us what you have in mind and we&rsquo;ll come back with ideas
              and a price.
            </p>
            <p className="small" style={{ margin: '0 0 14px' }}>
              Or email us at{' '}
              <a
                href={`mailto:${contactEmail}`}
                style={{ color: 'var(--brand-text)', fontWeight: 700 }}
              >
                {contactEmail}
              </a>
            </p>
            <p className="muted small" style={{ margin: '0 0 14px' }}>
              Every page is designed for the one event, so there is nothing to browse — tell us about
              your night and we will show you what we would build for it.
            </p>
            <Link href="/contact" className="btn btn-brand">
              Talk to our design team
            </Link>
          </div>
        </div>
      </section>

      {/* ---- Final CTA ---- */}
      <section className="section" style={{ paddingBottom: 56 }}>
        <div className="container" style={{ textAlign: 'center' }}>
          <h2 className="feed-section-title anim-fade-up" style={{ marginBottom: 10 }}>
            Your next event could be live tonight
          </h2>
          <p className="muted anim-fade-up" style={{ maxWidth: 520, margin: '0 auto 22px' }}>
            Tell us about it, build your page, send your event&rsquo;s fee when you&rsquo;re ready
            to publish — {fee} for a {HEADLINE_CAPACITY}-person night. Most organizers are live
            within the week.
          </p>
          <p className="anim-fade-up anim-d1" style={{ margin: 0 }}>
            <Link href="/contact?intent=account" className="btn btn-brand btn-lg">
              Get started
            </Link>
          </p>
          <p className="muted small anim-fade-up anim-d2" style={{ marginTop: 14 }}>
            Already have an account?{' '}
            <Link href="/portal/login" style={{ color: 'var(--brand-text)', fontWeight: 600 }}>
              Sign in to your portal
            </Link>
          </p>
        </div>
      </section>
      {/* The platform's own assistant, on the page that asks organizers to
          commit. Everything they are weighing up here — the fee, how they get
          paid, what an account costs — is exactly what it is briefed on, and
          leaving it off meant this page had the "talk to Milan" bubble and an
          empty space beside it where the quick answer should be. */}
      <PlatformAssistant />
    </>
  );
}
