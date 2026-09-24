import Np from '@/components/Np';
import { shareImages } from '@/lib/seo';
import Link from 'next/link';
import { platformContactEmail, platformNameFromEnv } from '@/lib/platform';
import DashboardMock from '@/components/mockups/DashboardMock';
import PlatformAssistant from '@/components/PlatformAssistant';
import EditorMock from '@/components/mockups/EditorMock';
import EventPageMock from '@/components/mockups/EventPageMock';
import InsightsMock from '@/components/mockups/InsightsMock';
import ShopMock from '@/components/mockups/ShopMock';

// The brand name comes from an env var — read it fresh on every request.
export const dynamic = 'force-dynamic';

/**
 * Generated, not a static object: the brand was once written out by hand, so
 * setting PLATFORM_NAME renamed the site everywhere except the title of the
 * page whose whole job is recruiting organizers.
 */
export async function generateMetadata() {
  // Short enough to survive the " | MartNepali" the layout appends. The brand
  // used to appear twice in one 77-character title, and the half that got cut
  // was the half that said what the page is for.
  const title = 'Sell tickets or open a shop — free for organizers';
  // Under the ~155 characters a search result shows. Of everything this page
  // says, the two facts that make somebody click are "your own bank account"
  // and "free", so those are the two that survive the cut.
  const description =
    'Your own event page with QR tickets, or your own shop in the bazaar. Payments land in ' +
    'your own bank account. Completely free — no fees, no commission.';
  return {
    title,
    description,
    alternates: { canonical: '/organizers' },
    openGraph: { type: 'website', title, description, url: '/organizers', images: shareImages() },
  };
}

const INCLUDED: string[] = [
  'No commission on your sales',
  'Payments straight to your bank',
  'QR tickets & collection codes emailed',
  'Door & counter scanning links',
  'Sales analytics & buyer insights',
  'WhatsApp poster in one tap',
  'Sold-out waitlist',
  'Table & group bookings',
  'Announcements to opted-in fans',
  'Referral rewards you set yourself',
  'AI page designer',
  'AI question assistant, 24/7',
  'Automatic payment reminders',
  'Student tiers with ID checks',
  'Page updates and built-in FAQ',
  // The shop half. Listed here rather than only in its feature row: this band
  // is what somebody screenshots to decide, and a seller reading fourteen
  // ticket features would conclude the goods side is an afterthought.
  'Your own shop page in the bazaar',
  'Item pages with photos & live stock',
  'Found in the bazaar-wide item search',
  'Monthly statements for your books',
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
          <p className="feed-kicker anim-fade-up">For organizers &amp; sellers</p>
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
          {/* The other half of who this page is for, said in the hero rather
              than only two thousand words down. It is a line and a link, not a
              second pitch: the shop row below does the pitching, and a hero
              that argued for both at equal length would sell neither. */}
          <p className="muted small anim-fade-up anim-d3" style={{ marginTop: 10 }}>
            Selling goods rather than staging a night?{' '}
            <a href="#shop" style={{ color: 'var(--brand-text)', fontWeight: 700 }}>
              Open a shop in the bazaar instead &rarr;
            </a>{' '}
            Same toolkit, same price: free.
          </p>
        </div>
      </section>

      {/* ---- See it before applying: the catalog and the sandbox ---- */}
      <section className="container" style={{ marginTop: 8 }}>
        <div
          className="card"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '14px 18px',
          }}
        >
          <p style={{ margin: 0 }}>
            <strong>Want to look around first?</strong>{' '}
            <span className="muted small">Browse every feature, or open a private demo account for 24 hours.</span>
          </p>
          <p style={{ margin: 0, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <Link href="/showcase" className="btn btn-sm btn-green">
              See every feature
            </Link>
            <Link href="/demo" className="btn btn-sm">
              Try the organizer demo
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

          {/* The other door in: sellers, not organizers.
              A full feature row rather than the one-paragraph band this used
              to be. Every mock above it is an EVENT, so someone who could run
              a shop read four screenshots of a thing they are not doing and
              one paragraph asking them to imagine the rest. It sits last, and
              inside the same tour, because everything the rows above showed —
              the page, the orders, the scanning, the numbers — is the same
              machine a shop runs on; this row only says what changes.
              Unflipped, so the left-right rhythm carries on from Insights. */}
          <div className="feat-row" id="shop" style={{ scrollMarginTop: 90 }}>
            <div className="feat-copy anim-fade-up">
              <p className="feed-kicker">Your shop in the bazaar</p>
              <h2 className="feat-title">Selling something rather than staging something?</h2>
              <ul className="feat-points">
                <FeatPoint>
                  <strong>Your own shop page in the bazaar</strong> — filed on a shelf shoppers
                  browse, and everything you sell turns up in the bazaar&rsquo;s item search
                  alongside every other seller&rsquo;s.
                </FeatPoint>
                <FeatPoint>
                  <strong>Items with photos, each on its own page</strong> — a picture, your own
                  write-up, the price and what is left in stock. Momo to pre-order, achar,
                  sweets, spices, crafts, whatever you make.
                </FeatPoint>
                <FeatPoint>
                  <strong>Orders arrive as QR collection codes</strong> — scan the buyer&rsquo;s
                  code at the counter when they pick up, the same way a door scanner works.
                </FeatPoint>
                {/* Three things the bazaar grew that a seller cannot see from
                    outside, and that decide whether their shop is FOUND. They
                    are listed because they are true, and each one names what it
                    actually does rather than what it sounds like: a seller
                    deciding where to spend an afternoon deserves the mechanism,
                    not an adjective. */}
                <FeatPoint>
                  <strong>People find you in the words they think in</strong> — somebody typing
                  &ldquo;cardamom&rdquo; finds your alaichi, &ldquo;dumplings&rdquo; finds your{' '}
                  <Np>मोमो</Np>, and the shelf you pick has its own page that Google indexes. Shoppers
                  filter by town, by price and by what is in stock today.
                </FeatPoint>
                <FeatPoint>
                  <strong>Reviews from people who actually bought</strong> — only a buyer who paid
                  can write one, so a good score cannot be bought or faked. You can reply to any of
                  them in public. You cannot edit or delete them, and neither can we without a
                  reason on the record — which is exactly what makes them worth reading.
                </FeatPoint>
                <FeatPoint>
                  <strong>Your shop shares properly</strong> — pasted into a WhatsApp group it
                  arrives as your photo, your name and your prices, not a grey box. That is how
                  most people here will ever hear of you.
                </FeatPoint>
                <FeatPoint>
                  <strong>Buyers pay you directly</strong> — into your own account. We never hold
                  your money, so there is no payout to wait for.
                </FeatPoint>
                <FeatPoint>
                  <strong>The books kept for you</strong> — live Insights on what is selling, plus
                  a monthly statement you can hand to a tax advisor as it is.
                </FeatPoint>
              </ul>
              <p className="muted small" style={{ margin: '14px 0 0' }}>
                Free while we grow, exactly like the event side: no fees, no commission, nothing
                taken out of a single jar you sell.
              </p>
              <p style={{ margin: '14px 0 0' }}>
                <Link href="/contact?intent=account" className="btn btn-brand btn-lg">
                  Get started
                </Link>
              </p>
            </div>
            <div className="anim-fade-up anim-d1">
              <ShopMock />
            </div>
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
