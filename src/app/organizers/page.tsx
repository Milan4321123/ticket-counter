import Link from 'next/link';
import { platformContactEmail, platformNameFromEnv } from '@/lib/platform';
import DashboardMock from '@/components/mockups/DashboardMock';
import PlatformAssistant from '@/components/PlatformAssistant';
import EditorMock from '@/components/mockups/EditorMock';
import EventPageMock from '@/components/mockups/EventPageMock';
import InsightsMock from '@/components/mockups/InsightsMock';

// The brand name comes from an env var — read it fresh on every request.
export const dynamic = 'force-dynamic';

/**
 * Generated, not a static object: the brand was once written out by hand, so
 * setting PLATFORM_NAME renamed the site everywhere except the title of the
 * page whose whole job is recruiting organizers.
 */
export async function generateMetadata() {
  const brand = platformNameFromEnv();
  const title = `Sell tickets on ${brand} — for organizers`;
  const description =
    `Your own beautiful event page, QR tickets, door scanning — or a shop in the bazaar with QR ` +
    `collection codes. Every payment lands straight in your own bank account. Completely free — ` +
    `no fees, no commission on your sales.`;
  return {
    title,
    description,
    alternates: { canonical: '/organizers' },
    openGraph: { type: 'website', title, description, url: '/organizers' },
  };
}

const INCLUDED: string[] = [
  'No commission on ticket sales',
  'Payments straight to your bank',
  'QR tickets emailed automatically',
  'Door scanning links for staff',
  'Sales analytics & guest insights',
  'WhatsApp poster in one tap',
  'Sold-out waitlist',
  'Table & group bookings',
  'Announcements to opted-in fans',
  'Referral rewards you set yourself',
  'AI page designer',
  'AI question assistant, 24/7',
  'Automatic payment reminders',
  'Student tiers with ID checks',
  'Event page updates and built-in FAQ',
  'Free account, free publishing',
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
            You already know the hard way: the poster forwarded through three group chats,
            the &ldquo;how do I pay?&rdquo; messages at midnight, payment screenshots to
            match up, a guest list living in a note on your phone. This replaces all of it —
            a beautiful event page, QR tickets, door scanning — and every payment lands
            straight in your own bank account. Completely free while we grow: no fees, no
            commission, nothing.
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
                    days. We email you a sign-in — an email address and a one-time password — and
                    that is what gets you in. Nothing to pay, and no card to enter.
                  </p>
                </div>
              </li>
              <li className="step-item">
                <span className="step-num step-num-brand" aria-hidden>2</span>
                <div>
                  <strong>Sign in, and your event page is yours to build</strong>
                  <p className="muted small" style={{ margin: 0 }}>
                    The first thing it asks for is a new password of your own — the one we emailed
                    is single-use, and the portal stays locked until you have replaced it, so a
                    password sitting in an inbox is never the one protecting your ticket money.
                    After that you are in your organizer portal. Inside it is an editor for your
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
                  <strong>Publish — it&rsquo;s free</strong>
                  <p className="muted small" style={{ margin: 0 }}>
                    Finish the checklist on the Publish tab and press the button. No fee, no
                    waiting for anything to be confirmed — your page is in the public feed the
                    moment you publish, and we never take a cut of your sales.
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

          {/* Insights. Last of the rows on purpose: dashboard, editor and
              event page answer "can I run a sale at all?", and this one is
              the reason to stay once the first event has sold — flipped to
              keep the left-right rhythm going. */}
          <div className="feat-row feat-row-flip">
            <div className="feat-copy anim-fade-up">
              <p className="feed-kicker">Your numbers</p>
              <h2 className="feat-title">See who is coming — and who brought them</h2>
              <ul className="feat-points">
                <FeatPoint>
                  <strong>Sales &amp; check-in analytics, live</strong> — money, tickets
                  sold and door rate, with a spreadsheet download.
                </FeatPoint>
                <FeatPoint>
                  <strong>Every guest&rsquo;s history at a glance</strong> — bookings,
                  tickets, check-ins, and who keeps coming back.
                </FeatPoint>
                <FeatPoint>
                  <strong>The referral chain, name by name</strong> — open a referrer and
                  see the bookings they brought, each one saying how many that guest went on
                  to bring in turn.
                </FeatPoint>
                <FeatPoint>
                  <strong>Your fan list</strong> — everyone who opted in to hear about your
                  next event.
                </FeatPoint>
              </ul>
            </div>
            <div className="anim-fade-up anim-d1">
              <InsightsMock />
            </div>
          </div>
        </div>
      </section>

      {/* ---- The other door in: sellers, not organizers ----
           Right after the feature tour, because everything it just showed — the
           page, the orders, the scanning, the numbers — is the same machine a
           shop runs on. Compact on purpose: a full pitch would repeat the page. */}
      <section className="section">
        <div className="container">
          <div className="cta-band anim-fade-up">
            <div>
              <h2 className="cta-band-title">Not putting on an event? Open a shop.</h2>
              <p className="cta-band-body">
                The same toolkit sells goods: your own shop page in the bazaar — momo to
                pre-order, sweets, crafts, whatever you make — with orders that arrive as QR
                collection codes you scan when the buyer picks up. Buyers pay you directly, so
                the money lands straight in your own account, and we keep the books for you:
                live Insights, plus a monthly statement you can hand to a tax advisor as it is.
              </p>
            </div>
            <p className="cta-band-actions">
              <Link href="/contact?intent=account" className="btn btn-brand btn-lg">
                Get started
              </Link>
            </p>
          </div>
        </div>
      </section>

      {/* ---- Reward the people who bring friends ----
           The feature tour shows referrals as something to LOOK at; this is the
           half an organizer can switch on, and it was previously mentioned
           nowhere on the page they read before applying. Placed here, after the
           tour, because it only makes sense once you know what a listing and an
           order are — and it is the one feature on this page where the word
           "discount" appears, so it says whose money it is in the first line. */}
      <section className="section">
        <div className="container container-narrow">
          <p className="feed-kicker anim-fade-up">Word of mouth</p>
          <h2 className="feed-section-title anim-fade-up">Reward the people who bring friends</h2>
          <p className="muted anim-fade-up" style={{ marginTop: -6 }}>
            Every buyer gets their own share link. If you want to thank the ones whose link
            actually brings people, switch rewards on and say what the thank-you is — it is your
            own discount on your own prices, and we take nothing out of it.
          </p>
          <div className="card anim-fade-up anim-d1">
            <ul className="check-list" style={{ margin: 0 }}>
              <li className="check-item">
                <span className="check-dot check-dot-done">&#10003;</span>
                <span>
                  <strong>You set two numbers.</strong> How many confirmed, paid bookings someone
                  has to bring, and what one voucher is worth. Nothing else to configure — and
                  leaving <em>both</em> empty switches the whole thing off again.
                </span>
              </li>
              <li className="check-item">
                <span className="check-dot check-dot-done">&#10003;</span>
                <span>
                  <strong>It is your discount, on your prices.</strong> A voucher means that buyer
                  transfers you less next time. No money moves through us, we never fund a voucher
                  and we never take a cut of one — the platform is free, and it stays out of this
                  entirely.
                </span>
              </li>
              <li className="check-item">
                <span className="check-dot check-dot-done">&#10003;</span>
                <span>
                  <strong>Only real bookings count.</strong> A booking counts once you have
                  confirmed the payment — a reservation waiting for money, a test order, a free
                  reservation and a booking one of your own codes already part-paid never earn
                  anyone the next voucher. Nobody can loop a voucher into another voucher.
                </span>
              </li>
              <li className="check-item">
                <span className="check-dot check-dot-done">&#10003;</span>
                <span>
                  <strong>Your buyers see the offer where they are looking.</strong> Switch it on
                  and the offer appears on your listing page in your own numbers, so people
                  browsing know about it before they book. After they book, their own link, their
                  progress and their vouchers are on their order page — and we email them the
                  moment one is earned.
                </span>
              </li>
              <li className="check-item">
                <span className="check-dot check-dot-done">&#10003;</span>
                <span>
                  <strong>Counted across your listings, from the day you promise it.</strong>{' '}
                  Someone who brought two friends to one night and three to the next has brought
                  five. Referrals from before you switched rewards on do not suddenly owe anybody a
                  pile of vouchers, and a voucher already earned is never taken away.
                </span>
              </li>
              <li className="check-item">
                <span className="check-dot check-dot-done">&#10003;</span>
                <span>
                  <strong>The switch lives in your portal, under Settings.</strong> Change the
                  numbers or turn it off whenever you like. Vouchers are typed into the same
                  discount-code box at checkout, each works once, and none of them expires.
                </span>
              </li>
            </ul>
            <p className="muted small" style={{ margin: '14px 0 0' }}>
              One honest limit: a listing where nothing costs money never shows the offer, because
              a free reservation can never be a booking that was &ldquo;actually paid for&rdquo; —
              so there would be no way to earn the voucher we had just promised.
            </p>
          </div>
        </div>
      </section>

      {/* ---- Everything included ---- */}
      <section className="section">
        <div className="container">
          <div className="included-band anim-fade-up">
            <p className="feed-kicker">Everything included</p>
            <h2 className="feed-section-title" style={{ marginBottom: 8 }}>
              Free, the whole toolkit
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
            We build the tools; the show is yours. The event, the money and the people who
            come to it never stop being yours.
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
                  <strong>Free, and no cut of your sales.</strong> Publishing costs nothing, and
                  there is never a percentage. Every euro a buyer pays is yours.
                </span>
              </li>
            </ul>
          </div>
        </div>
      </section>


      {/* ---- Your account, your rules ----
           Sits after "you own your own data" because it is the same promise
           looked at from the other side: that section says what we will not do
           with the account, this one says what only YOU can do to it. */}
      <section className="section">
        <div className="container container-narrow">
          <p className="feed-kicker anim-fade-up">Your account</p>
          <h2 className="feed-section-title anim-fade-up">Locked to you, and easy to run</h2>
          <p className="muted anim-fade-up" style={{ marginTop: -6 }}>
            You get your own sign-in the day we set you up. Everything below is yours to change,
            from your phone, without asking us.
          </p>
          <div className="card anim-fade-up anim-d1">
            <ul className="check-list" style={{ margin: 0 }}>
              <li className="check-item">
                <span className="check-dot check-dot-done">&#10003;</span>
                <span>
                  <strong>Change your password whenever you want.</strong> The one we send you is
                  temporary — the portal asks you to replace it the first time you sign in, and you
                  can change it again any time from Settings. Forgotten it? Ask for a reset and a
                  code comes to your own email.
                </span>
              </li>
              <li className="check-item">
                <span className="check-dot check-dot-done">&#10003;</span>
                <span>
                  <strong>Add an authenticator app for a second lock.</strong> A free app on your
                  phone shows a 6-digit code, and signing in asks for it as well as your password —
                  so a stolen password on its own is not enough to get in. It works offline and
                  takes about a minute to set up. We ask you to turn it on before you publish,
                  because from that moment real people are sending you real money.
                </span>
              </li>
              <li className="check-item">
                <span className="check-dot check-dot-done">&#10003;</span>
                <span>
                  <strong>Nobody can quietly change where your money goes.</strong> Moving the bank
                  account on a selling event needs that code, then waits a day before buyers are
                  given the new details — and we email you the moment it is requested. If it was not
                  you, one click cancels it and nothing has moved.
                </span>
              </li>
              <li className="check-item">
                <span className="check-dot check-dot-done">&#10003;</span>
                <span>
                  <strong>And if any of that sounds like hard work — it isn&rsquo;t, and we&rsquo;ll
                  show you.</strong> Write to us and a real person walks you through setting up your
                  page, your tickets and your security. We&rsquo;re happy to do it on a video call
                  and share screens, so you end up running it yourself rather than depending on us.
                </span>
              </li>
            </ul>
            <p className="muted small" style={{ margin: '14px 0 0' }}>
              No jargon, no charge, and no obligation to use the custom design service &mdash; this
              is just help getting started.
            </p>
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
              Free. Really.
            </h2>
            <div className="card glow-card anim-fade-up anim-d1" style={{ textAlign: 'center' }}>
              <div className="tier-price" style={{ fontSize: '2.4rem' }}>
                €0
                <span className="muted" style={{ fontSize: '1rem', fontWeight: 600 }}>
                  {' '}
                  / event
                </span>
              </div>
              <p className="muted small" style={{ margin: '2px 0 0' }}>
                The platform is free while we grow — the account, publishing, every feature. No
                fee, no commission on ticket sales, and nothing to settle afterwards. If pricing
                is ever introduced later, it will be announced first, and events already published
                stay as they are.
              </p>

              <ul className="check-list" style={{ textAlign: 'left', margin: '14px 0 18px' }}>
                <li className="check-item">
                  <span className="check-dot check-dot-done">&#10003;</span>
                  <span>
                    <strong>No commission</strong> — every euro your buyers pay is yours
                  </span>
                </li>
                <li className="check-item">
                  <span className="check-dot check-dot-done">&#10003;</span>
                  <span>Free account, unlimited drafts, free publishing</span>
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
            {contactEmail && (
              <p className="small" style={{ margin: '0 0 14px' }}>
                Or email us at{' '}
                <a
                  href={`mailto:${contactEmail}`}
                  style={{ color: 'var(--brand-text)', fontWeight: 700 }}
                >
                  {contactEmail}
                </a>
              </p>
            )}
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
            Somewhere out there is the poster you have not made yet, and the crowd waiting
            to see it. Tell us about your event, build your page, and publish when
            you&rsquo;re ready — completely free. Most organizers are live within the week.
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
      <PlatformAssistant brand={platformNameFromEnv()} />
    </>
  );
}
