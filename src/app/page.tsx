import Link from 'next/link';
import EventBillboard from '@/components/EventBillboard';
import EventCard from '@/components/EventCard';
import EventCarousel from '@/components/EventCarousel';
import EventRail from '@/components/EventRail';
import Logo from '@/components/Logo';
import PlatformAssistant from '@/components/PlatformAssistant';
import { listPublishedEvents, paypalPayee } from '@/lib/events';
import type { EventRow } from '@/lib/events';
import { loadFeedSnapshot } from '@/lib/feedSnapshot';
import { BUYER_RETENTION_DAYS, runBuyerDataRetentionSweep } from '@/lib/retention';
import { eventListJsonLd, faqJsonLd, jsonLdScript } from '@/lib/seo';
import { listPlatformPosts } from '@/lib/platformPosts';
import type { PlatformPostRow } from '@/lib/platformPosts';
import { platformNameFromEnv } from '@/lib/platform';

// The feed reflects live availability — always render fresh.
export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// What a buyer needs to know before they trust this page with a night out.
//
// Every claim below is one this codebase can back: reserving really does take
// no account and no card (see the checkout), the money really does go to the
// organizer's own IBAN (see the order page), and the erasure window really is
// enforced (see lib/retention). Nothing here is aspirational copy — if a rule
// changes in the code, it has to change here too.
// ---------------------------------------------------------------------------

function howItWorks(anyPaypal: boolean) {
  return [
  {
    title: 'Reserve your seats',
    body: 'Pick your tickets and they are held for you on the spot. No account to create, no password to invent, no card number to dig out — just your name and an email, so the ticket knows who it belongs to.',
  },
  {
    title: anyPaypal ? 'Pay by bank transfer or PayPal' : 'Pay by bank transfer',
    body: anyPaypal
      ? 'You get the organizer’s payment details and a reference that belongs to your order alone. Open your banking app wherever you are and send a normal transfer — or, where the organizer offers it, pay by PayPal. Either way, the reference goes in the message: it is how your payment finds its way back to your seats.'
      : 'You get the organizer’s bank details and a payment reference that belongs to your order alone. Open your banking app wherever you are and send a normal transfer with that reference in the purpose line — it is how your payment finds its way back to your seats.',
  },
  {
    title: 'The organizer confirms',
    body: anyPaypal
      ? 'PayPal lands in minutes; a bank transfer travels at bank speed, usually 1–2 business days. Your part is already done — your seats wait for you the whole time, and there is nothing to refresh and nobody to chase.'
      : 'A bank transfer travels at bank speed — usually 1–2 business days. Your part is already done: your seats wait for you the whole time, and there is nothing to refresh and nobody to chase.',
  },
  {
    title: 'Your QR tickets arrive',
    body: 'Then the good part: your QR tickets land in your inbox, and stay on your order page where they cannot get lost. At the door, show the code on your phone — one scan per ticket and you are in.',
  },
  ];
}

function assurances(anyPaypal: boolean) {
  return [
  {
    title: 'The money goes straight to the organizer',
    body: anyPaypal
      ? 'You are buying from the people actually putting on the show, and your payment lands in their account — their bank account or their own PayPal. It never passes through us. No card fees skimmed off along the way, and nobody sitting on your money.'
      : 'You are buying from the people actually putting on the show, and your transfer lands in their account — it never passes through us. No card fees skimmed off along the way, and nobody sitting on your payment.',
  },
  {
    title: 'Your seats are held while you pay',
    body: 'Reserving holds them immediately. You get a few days to send the transfer — the exact deadline is printed on your order page — and a transfer sent in time never loses your seats, even if the banks take the scenic route.',
  },
  {
    title: 'A ticket you cannot misplace',
    body: 'Ticket emails get buried under newsletters; order pages don’t. Your QR tickets arrive by email and live on your order page for good — bookmark it, and at the door you need nothing but your phone.',
  },
  {
    title: 'A name and an email. That is all',
    body: `We never ask for card or bank details — there is nothing here that needs them. Your name and email go to that event’s organizer so they can issue your ticket, and ${BUYER_RETENTION_DAYS} days after the event they are erased from our system for good.`,
  },
  ];
}

function faqs(anyPaypal: boolean) {
  return [
  {
    question: 'Do I need an account to buy tickets?',
    answer:
      'No. Choose your tickets, enter your name and email, and reserve — your seats are held straight away. There is no sign-up, no password and no card number anywhere in the process.',
  },
  {
    question: 'How do I pay?',
    answer: anyPaypal
      ? 'By ordinary bank transfer (Überweisung) from any banking app, and some organizers also accept PayPal. The moment you reserve, you get that organizer’s payment details and a reference that belongs to your order. Put that reference in the transfer’s purpose line, or in PayPal’s message field — it is how your payment is matched to your tickets. Pay one way or the other, never both.'
      : 'By ordinary bank transfer (Überweisung), from any banking app. The moment you reserve, you get the organizer’s bank details and a payment reference that belongs to your order. Put that reference in the transfer’s purpose line — it is how your payment is matched to your tickets.',
  },
  {
    question: 'Why is there no card payment?',
    answer: anyPaypal
      ? 'Because paying the organizer directly keeps it simple and honest: by bank transfer or by PayPal, the money goes from your account straight to theirs. It never passes through us, there is no card fee taken out of it, and every euro reaches the people putting on the show.'
      : 'Because bank transfer keeps it simple and honest: the money goes from your account straight to the organizer’s. It never passes through us, there is no card fee taken out of it, and every euro reaches the people putting on the show.',
  },
  {
    question: 'When do my tickets arrive?',
    answer: anyPaypal
      ? 'As soon as the organizer sees your payment land — usually minutes for PayPal, 1–2 business days for a bank transfer. Your QR tickets are emailed to you and appear on your order page at the same moment.'
      : 'As soon as the organizer sees your transfer land — normally 1–2 business days. Your QR tickets are emailed to you and appear on your order page at the same moment.',
  },
  {
    question: 'How long do I have to pay?',
    answer:
      'A few days. The exact deadline is shown on your order page and in your confirmation email. If nothing arrives by then the reservation is released so someone else can take the seats — but a transfer you sent in time will not lose them, even if it is still travelling.',
  },
  {
    question: 'The event I want is sold out. Is there any hope?',
    answer:
      'Sometimes, yes. A sold-out event page lets you leave your email on a waitlist. If seats free up — a reservation expires unpaid, or the organizer opens more — everyone on the list gets one email, and the seats go to whoever books first. That single heads-up is the only thing your address is used for.',
  },
  {
    question: 'I cannot find my ticket email. What now?',
    answer:
      'Check the order page you were sent when you reserved — your tickets live there permanently, which is why it is worth bookmarking. If you cannot find that either, contact the organizer of the event: they issued your ticket and can send it again.',
  },
  {
    question: 'Do I need to print my ticket?',
    answer:
      'No. Show the QR code on your phone at the door and it gets scanned once per ticket. Paper works just as well if you would rather bring it printed.',
  },
  {
    question: 'Can I order food or goods here, not just tickets?',
    answer:
      'Yes — alongside the events there is a bazaar of shops run by Nepali sellers: momo to pre-order, sweets, crafts and more. Ordering works just like tickets: pick what you want, pay that seller directly with your personal reference, and a QR collection code arrives by email. Show it when you pick your order up — one scan, and the goods are yours. Browse every shop by category at /market.',
  },
  {
    question: 'Who am I actually buying from?',
    answer:
      `The organizer of that particular event. They set the prices, receive the payment in their own account, issue the tickets and run the door. ${platformNameFromEnv()} is the platform they use to sell — every event page names the organizer behind it.`,
  },
  {
    question: 'What happens if an event is cancelled or I cannot come?',
    answer:
      'Refunds and changes are handled by the organizer of that event, since they hold the money. Contact them with your order ID — it is on your order page and in every email about your booking — and they will sort it out with you directly.',
  },
  ];
}

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

/** Today, as the same 'YYYY-MM-DD' shape the event_date column stores. */
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Is this event already over?
 *
 * Only the machine date can answer — dateDisplay is free text. An event with no
 * date is never treated as past: it is unscheduled, not finished, and hiding it
 * would quietly drop an organizer's event off the site.
 */
function isPast(event: EventRow, today: string): boolean {
  const date = event.eventDate?.slice(0, 10);
  return !!date && /^\d{4}-\d{2}-\d{2}$/.test(date) && date < today;
}

/** One row of the browse page. */
interface Row {
  key: string;
  kicker: string;
  title: string;
  events: EventRow[];
  past?: boolean;
  /** A quiet "see all of these" link beside the heading, for rows that are a
      taste of a fuller page rather than the whole list. */
  more?: { href: string; label: string };
}

/**
 * Slice the events into rows.
 *
 * Two rules keep this from turning into a wall of near-identical shelves:
 * a row is only worth its own heading if it is a real cut of the listing
 * (curation, not a duplicate of "everything"), and every event has to land in
 * at least one row. "All events" is that guarantee — it is always last and
 * always complete, so nothing can be lost between the curated rows above it.
 */
function buildRows(listings: EventRow[]): Row[] {
  const today = todayIso();
  // Shops are pulled out before anything else. Every row below is built around
  // a date — soonest first, near you, already happened — and a shop has none;
  // dropped into those rows it would sink to the bottom of the undated tail and
  // never be seen. It gets a shelf of its own instead, which is also the more
  // honest heading: "what's on" and "what you can order" are different questions.
  const shops = listings.filter((e) => e.kind === 'shop');
  const events = listings.filter((e) => e.kind !== 'shop');
  const upcoming = events.filter((e) => !isPast(e, today));
  const past = events.filter((e) => isPast(e, today));
  const rows: Row[] = [];

  // The soonest dated events get the top row — but only when that row says
  // something the catch-all row below does not. With a handful of events the
  // two would open with the identical tiles under two different headings,
  // which reads as a rendering fault rather than as curation.
  const dated = upcoming.filter((e) => e.eventDate);
  const soon = upcoming.length >= 4 && dated.length >= 2 ? dated.slice(0, 8) : [];
  if (soon.length > 0) {
    rows.push({ key: 'soon', kicker: 'Don’t miss', title: 'Happening soon', events: soon });
  }

  // City shelves, once there is enough on the site for "events near me" to be
  // a real question. Biggest cities first, and never more than three — past
  // that the page is scrolling through shelves rather than events.
  //
  // Three events is the floor for a shelf, not two: a row holding two tiles
  // leaves most of its width empty, which reads as a section that failed to
  // load rather than as a short list.
  if (upcoming.length >= 8) {
    const byCity = new Map<string, EventRow[]>();
    for (const event of upcoming) {
      const city = event.city.trim();
      if (!city) continue;
      const list = byCity.get(city);
      if (list) list.push(event);
      else byCity.set(city, [event]);
    }
    const cities = [...byCity.entries()]
      .filter(([, list]) => list.length >= 3)
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 3);
    for (const [city, list] of cities) {
      rows.push({ key: `city-${city}`, kicker: 'Near you', title: `In ${city}`, events: list });
    }
  }

  // The guarantee: whatever the rows above did or did not pick up, everything
  // still on sale ends up on the page exactly once between here and the top
  // row. City shelves may repeat an event, but their heading explains why —
  // two catch-all rows holding the same tiles would not.
  const soonIds = new Set(soon.map((e) => e.id));
  const remaining = upcoming.filter((e) => !soonIds.has(e.id));
  if (remaining.length > 0) {
    rows.push({
      key: 'all',
      kicker: 'Explore',
      title: soon.length > 0 ? 'More events' : 'What’s on',
      events: remaining,
    });
  }

  // Above the archive, below what is on: a shop is live and orderable today,
  // so it belongs with the present, not filed after events that have finished.
  if (shops.length > 0) {
    rows.push({
      key: 'shops',
      kicker: 'Order & collect',
      title: 'Buy from local sellers',
      events: shops,
      // The rail shows whatever is published; the bazaar page is the full
      // directory, sorted by category, so the row points at it rather than
      // pretending to be it.
      more: { href: '/market', label: 'Browse the whole bazaar →' },
    });
  }

  // Kept, not hidden: someone who was at the show still follows the link from a
  // photo or a message, and a page that quietly deletes its past looks smaller
  // than it is. Last, and labelled, so it can never be mistaken for what is on.
  if (past.length > 0) {
    rows.push({ key: 'past', kicker: 'The archive', title: 'Already happened', events: past, past: true });
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Icons — small, single-stroke, and the same weight everywhere.
// ---------------------------------------------------------------------------

function TicketIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1.2a2.8 2.8 0 0 0 0 5.6V16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-1.2a2.8 2.8 0 0 0 0-5.6Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path d="M14 6.5v11" stroke="currentColor" strokeWidth="1.7" strokeDasharray="2 2.6" />
    </svg>
  );
}

function BankIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3.5 9.5 12 5l8.5 4.5" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M5.5 10v7M10 10v7M14 10v7M18.5 10v7M3.5 19.5h17" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="5.5" width="18" height="13" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="m4.5 8 6.4 4.6a2 2 0 0 0 2.2 0L19.5 8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function heroChips(anyPaypal: boolean) {
  return [
    { icon: <TicketIcon />, label: 'No account needed' },
    { icon: <BankIcon />, label: anyPaypal ? 'Bank transfer or PayPal' : 'Pay by bank transfer' },
    { icon: <MailIcon />, label: 'QR tickets by email' },
  ];
}

// ---------------------------------------------------------------------------

export default function HomePage() {
  // The feed is the busiest page on the site, so it is where the erasure sweep
  // is armed: it self-throttles and swallows its own errors, so this costs a
  // clock comparison on all but one render an hour. See lib/retention.ts.
  runBuyerDataRetentionSweep();
  const events = listPublishedEvents();
  // Tiers, photos and availability for every tile on the page, in three
  // statements rather than five per tile. See lib/feedSnapshot for why this is
  // a per-request read and not a cache.
  const snapshot = loadFeedSnapshot(events);
  const platformPosts = listPlatformPosts(3);
  const rows = buildRows(events);
  // Whether ANY live event actually takes PayPal. This page speaks for the whole
  // platform, so it must not advertise a payment route no organizer on it offers
  // — nor stay silent about one that several of them do.
  const anyPaypal = events.some((e) => paypalPayee(e) !== null);
  const steps = howItWorks(anyPaypal);
  const assuranceCards = assurances(anyPaypal);
  const faqItems = faqs(anyPaypal);

  // Everything still to come gets a turn in the billboard, dated or not.
  //
  // This used to require a machine date, on the reasoning that calling an
  // undated event "next up" is a guess. The reasoning was right and the filter
  // was wrong: an organizer who never set the calendar field — the event
  // imported from event.config.json has no event_date at all — vanished from
  // the feature entirely rather than merely losing the claim about timing. The
  // claim is what gets dropped now (see `leading` below), not the event.
  //
  // listPublishedEvents already orders these soonest-first with the undated
  // last, so the front of this list is genuinely the front. Capped at five:
  // past that it stops being a feature and becomes a second listing nobody
  // swipes to the end of.
  const today = todayIso();
  const featured = events.filter((e) => !isPast(e, today)).slice(0, 5);

  const cities = new Set(events.map((e) => e.city.trim()).filter(Boolean));

  return (
    <>
      {/* Tells Google this page is a LIST of these specific events. Without it a
          feed of ten events reads to a crawler as one long article, and none of
          the individual events get discovered from here. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLdScript(eventListJsonLd(events))}
      />
      {/* Every one of these answers is printed on this page below — see the FAQ
          section. Marking up answers a visitor cannot read is what gets
          structured data thrown out site-wide. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(faqJsonLd(faqItems))} />

      <section className="feed-hero">
        <div className="container">
          <div className="feed-hero-logo anim-fade-up">
            <Logo size={44} />
          </div>
          <h1 className="anim-fade-up anim-d1">Nepali concerts &amp; events, near you</h1>
          <p className="feed-hero-sub anim-fade-up anim-d2">
            It starts the same way every time: a poster lands in the family group chat, and
            suddenly Saturday has a plan. This is where that poster leads — concerts, cultural
            nights and parties from Nepali organizers. Reserve your tickets in one click,
            pay {anyPaypal ? 'by bank transfer or PayPal' : 'by bank transfer'}, and your QR
            tickets arrive by email before you have picked what to wear — and between the
            shows, the bazaar stays open: momo to pre-order, sweets and crafts from Nepali
            sellers, paid straight to them and collected with a QR code.
          </p>
          <p className="feed-hero-actions anim-fade-up anim-d2">
            <a href="#events" className="btn btn-brand btn-lg">
              Browse events
            </a>
            {/* The pitch, not the sign-in door: someone who does not have an
                account yet needs the price and the explanation first. Green
                rather than outlined: side by side with the crimson button, an
                outline reads as a caption, and half the audience for this page
                is the organizer who needs to see a second door. */}
            <Link href="/organizers" className="btn btn-green btn-lg">
              For organizers
            </Link>
          </p>
          {/* Reassurance, not a third row of buttons. These were pill-shaped
              chips sitting ABOVE the call to action, which put three things
              that look pressable in front of the two that are — so nobody
              could tell which was which. They read as a caption now, and they
              read it after the buttons rather than instead of them. */}
          <ul className="feed-trust anim-fade-up anim-d3" aria-label="How buying works here">
            {heroChips(anyPaypal).map((chip) => (
              <li className="feed-trust-item" key={chip.label}>
                {chip.icon}
                {chip.label}
              </li>
            ))}
          </ul>
          {events.length > 0 && (
            <p className="feed-hero-count anim-fade-up anim-d3">
              {events.length} {events.length === 1 ? 'event' : 'events'} on sale
              {cities.size > 1 ? ` across ${cities.size} cities` : ''}
            </p>
          )}
        </div>
      </section>

      {/* The platform's own voice, AFTER the listing. Above the events it was
          the first thing between a visitor and the reason they came, and news
          about the site is never that. Someone who has scrolled the whole
          listing is the one it is actually for. */}
      <div id="events">
        {events.length === 0 ? (
          <section className="section">
            <div className="container">
              <div
                className="card anim-fade-up"
                style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center', padding: 36 }}
              >
                <h2 className="card-title" style={{ fontSize: '1.3rem' }}>
                  The stage is being set
                </h2>
                <p className="muted">
                  New events appear here the very moment an organizer presses publish —
                  check back soon, or be the reason everyone else does.
                </p>
                <p style={{ margin: 0 }}>
                  <Link href="/portal" className="btn btn-brand">
                    Organizing an event? Get started
                  </Link>
                </p>
              </div>
            </div>
          </section>
        ) : (
          <>
            {featured.length > 0 && (
              <section className="section billboard-section">
                <div className="container">
                  <EventCarousel label="Featured events" count={featured.length}>
                    {featured.map((event, i) => (
                      <div className="ecar-slide" data-index={i} key={event.id}>
                        {/* Only the first slide may call itself what is next, and
                            only if it actually knows when it is. */}
                        <EventBillboard event={event} leading={i === 0} snapshot={snapshot} />
                      </div>
                    ))}
                  </EventCarousel>
                </div>
              </section>
            )}

            {rows.map((row) => (
              <section className="section rail-section" key={row.key}>
                <div className="container">
                  <div className="rail-head anim-fade-up">
                    <p className="feed-kicker">{row.kicker}</p>
                    <h2 className="feed-section-title">{row.title}</h2>
                    {row.more && (
                      <p className="muted small" style={{ margin: '4px 0 0' }}>
                        <Link href={row.more.href} className="inline-link">
                          {row.more.label}
                        </Link>
                      </p>
                    )}
                  </div>
                  <div className="rail-bleed">
                    <EventRail label={row.title}>
                      {row.events.map((event, i) => (
                        <div className="rail-item" key={event.id}>
                          <EventCard
                            event={event}
                            past={row.past}
                            delayClass={['', ' anim-d1', ' anim-d2', ' anim-d3'][i % 4]}
                            snapshot={snapshot}
                          />
                        </div>
                      ))}
                    </EventRail>
                  </div>
                </div>
              </section>
            ))}
          </>
        )}
      </div>

      {platformPosts.length > 0 && (
        <section className="section">
          <div className="container">
            <p className="section-kicker">From the team</p>
            <div className="platform-posts">
              {platformPosts.map((post: PlatformPostRow) => (
                <article className="platform-post anim-fade-up" key={post.id}>
                  <p>{post.body}</p>
                  {post.photoUrl ? (
                    // Served from our own route; next/image adds nothing here.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={post.photoUrl} alt="" className="platform-post-photo" />
                  ) : null}
                  <time className="muted small" dateTime={post.createdAt.replace(' ', 'T') + 'Z'}>
                    {post.createdAt.slice(0, 10)}
                  </time>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ---- How buying a ticket here works ---- */}
      <section className="section info-section" id="how-it-works">
        <div className="container">
          <p className="feed-kicker anim-fade-up">Buying a ticket</p>
          <h2 className="feed-section-title anim-fade-up">Four steps, and no card required</h2>
          <p className="info-lede anim-fade-up">
            {anyPaypal
              ? 'No app to install, no account to open, no card to dig out of a coat pocket. You pay the way you already pay for everything else — a normal bank transfer, or PayPal where the organizer offers it. Here is the whole journey, start to finish, so nothing surprises you.'
              : 'No app to install, no account to open, no card to dig out of a coat pocket. You pay the way you already pay for everything else — a normal bank transfer. Here is the whole journey, start to finish, so nothing surprises you.'}
          </p>
          <ol className="how-grid">
            {steps.map((step, i) => (
              <li className="how-card anim-fade-up" key={step.title}>
                <span className="how-num" aria-hidden="true">
                  {i + 1}
                </span>
                <h3 className="how-title">{step.title}</h3>
                <p className="how-body">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---- The reassurance that belongs next to a price ---- */}
      <section className="section info-section">
        <div className="container">
          <p className="feed-kicker anim-fade-up">Good to know</p>
          <h2 className="feed-section-title anim-fade-up">What you are agreeing to</h2>
          <div className="assurance-grid">
            {assuranceCards.map((item) => (
              <div className="assurance-card anim-fade-up" key={item.title}>
                <h3 className="assurance-title">{item.title}</h3>
                <p className="assurance-body">{item.body}</p>
              </div>
            ))}
          </div>
          <p className="muted small assurance-foot">
            The full detail is in our{' '}
            <Link href="/privacy" className="inline-link">
              privacy note
            </Link>
            .
          </p>
        </div>
      </section>

      {/* ---- FAQ ---- */}
      <section className="section info-section" id="faq">
        <div className="container container-narrow">
          <p className="feed-kicker anim-fade-up">Questions</p>
          <h2 className="feed-section-title anim-fade-up">Before you book</h2>
          <div className="anim-fade-up">
            {faqItems.map((faq) => (
              <details className="faq-item" key={faq.question}>
                <summary>{faq.question}</summary>
                <p className="faq-answer">{faq.answer}</p>
              </details>
            ))}
          </div>
          <p className="muted small" style={{ marginTop: 16 }}>
            Still wondering something? Tap the chat bubble in the corner — it answers questions
            about how this site works, and anything about a particular event goes to the
            organizer running it.
          </p>
        </div>
      </section>

      {/* ---- Closing invitation for the other half of the audience ---- */}
      <section className="section">
        <div className="container">
          <div className="cta-band anim-fade-up">
            <div>
              <h2 className="cta-band-title">Putting on an event yourself?</h2>
              {/* "Free while we grow", not "one fee per event": the fee machinery
                  was deliberately deleted (see lib/platform.ts) and this band was
                  the last place still charging for it. */}
              <p className="cta-band-body">
                You know the other way: the poster in three group chats, the payment
                screenshots, the guest list in a note on your phone. Build your event page
                instead — tickets sell straight into your own bank account, and you scan
                guests in at the door. Free while we grow: no fee, no commission, nothing.
              </p>
            </div>
            <p className="cta-band-actions">
              <Link href="/organizers" className="btn btn-brand btn-lg">
                See how it works
              </Link>
              <Link href="/portal/login" className="btn btn-lg">
                Organizer sign in
              </Link>
            </p>
          </div>
        </div>
      </section>

      <PlatformAssistant brand={platformNameFromEnv()} />
    </>
  );
}
