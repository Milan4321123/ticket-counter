import PitchVideo from '@/components/PitchVideo';
import StoryShelf from '@/components/StoryShelf';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { demoTargetPath, isDemoTarget, type DemoTarget } from '@/lib/demo';
import { currentOrganizer } from '@/lib/organizers';
import DemoSubmit from './DemoSubmit';
import { platformNameFromEnv } from '@/lib/platform';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Try the organizer demo',
  description:
    'Open your own demo organizer account with a ready-made event and shop, real orders, insights and check-in — no sign-up, nothing to pay, deleted after 24 hours.',
  alternates: { canonical: '/demo' },
};

/** What the visitor asked to see, in their words, for the button label. */
const TARGET_LABEL: Record<DemoTarget, string> = {
  portal: 'the organizer dashboard',
  event: 'the event editor',
  shop: 'the shop editor',
  orders: 'orders & payment confirmation',
  insights: 'the insights page',
  checkin: 'door & collection check-in',
  statements: 'monthly statements',
  promos: 'promo codes',
  settings: 'settings & instant payments',
  reviews: 'customer reviews',
  'buyer-event': 'the event page as a buyer',
  'buyer-shop': 'the shop page as a buyer',
  checkout: 'the checkout',
  kitchen: 'the live kitchen screen',
  'kitchen-setup': 'kitchen & collection settings',
  live: 'the live door screen',
  appointments: 'today’s appointments',
  'buyer-salon': 'the salon as a customer',
  'tools-event': 'the event organizer demo',
  'tools-shop': 'the restaurant demo',
  'tools-salon': 'the salon demo',
  assistant: 'the AI setup assistant',
  'assistant-event': 'the AI setup assistant',
};

const ERRORS: Record<string, string> = {
  'too-many': 'You have started several demos in the last hour. Please wait a little, or keep using the one you have.',
  busy: 'A lot of people are trying the demo right now. Please try again in a few minutes.',
  failed: 'Something went wrong while building your demo. Please try again.',
};

/** The three ready-made businesses in every demo account (lib/demo). */
const PICKS: { to: DemoTarget; emoji: string; title: string; who: string; points: string[]; tone: string }[] = [
  {
    to: 'tools-shop',
    emoji: '🥟',
    title: 'Restaurant & food shop',
    who: 'Didi’s Momo Kitchen',
    points: ['Online orders with pickup times', 'Kitchen screen: New → Cooking → Ready', 'Order from the table by QR'],
    tone: 'amber',
  },
  {
    to: 'tools-event',
    emoji: '🎶',
    title: 'Event organizer',
    who: 'Dashain Night — Live Music & Dinner',
    points: ['Tickets and a real seat map', 'Confirm payments, scan at the door', 'Live screen and sales insights'],
    tone: 'brand',
  },
  {
    to: 'tools-salon',
    emoji: '💅',
    title: 'Salon & appointments',
    who: 'Glow Threading & Beauty',
    points: ['Customers book a time slot', 'Today’s appointments on a board', 'Services with options'],
    tone: 'violet',
  },
];

const TOUR: { to: DemoTarget; title: string; line: string }[] = [
  { to: 'checkout', title: 'Pick your seats', line: 'A real hall map: VIP front rows and Standard, part-sold. Tap seats, pay (simulated), get QR tickets with your seats.' },
  { to: 'buyer-event', title: 'Buy a ticket', line: 'Open your event as a buyer, pick tickets and pay (simulated). Your QR tickets appear at once.' },
  { to: 'insights', title: 'See the numbers', line: 'Sales over time, money received, ticket types, returning guests and top referrers.' },
  { to: 'orders', title: 'Confirm a payment', line: 'Four orders are waiting for a bank transfer — confirm one and its tickets go out.' },
  { to: 'buyer-shop', title: 'Order from the shop', line: 'Momo, sel roti and achar with photos, stock and reviews — order and get a collection code.' },
  { to: 'kitchen', title: 'Run the kitchen', line: 'Today’s orders on a live board — move them from New to Cooking to Ready, like a restaurant pass.' },
  { to: 'kitchen-setup', title: 'Set collection times', line: 'Opening hours, orders per slot, spice choices, and printable QR codes for every table.' },
  { to: 'buyer-salon', title: 'Book an appointment', line: 'A beauty studio with services and 30-minute slots — pick a time, choose a mehendi design, pay (simulated).' },
  { to: 'appointments', title: 'Run the appointment book', line: 'Today’s bookings on a board: Booked → In progress → Finished, one client per slot.' },
  { to: 'live', title: 'Watch it live', line: 'The screen for a TV by the door: arrivals count up in real time, who just came in, and today’s sales.' },
  { to: 'checkin', title: 'Scan at the counter', line: 'The collection check-in most sellers use on a phone, with who has collected what.' },
  { to: 'event', title: 'Edit the page', line: 'Tickets, photos, the AI page designer, the WhatsApp poster and the publish checklist.' },
  { to: 'promos', title: 'Make a discount code', line: 'DASHAIN10 is already live. Add your own, fixed or percent, capped and dated.' },
  { to: 'statements', title: 'Read the statement', line: 'A monthly record of every sale, ready to print or download.' },
];

export default async function DemoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const rawTo = Array.isArray(sp.to) ? sp.to[0] : sp.to;
  const to: DemoTarget = isDemoTarget(rawTo) ? rawTo : 'portal';
  const error = typeof sp.error === 'string' ? sp.error : '';

  // Already inside a demo: go straight where the link pointed. Only a READ of
  // the session — nothing is created from a GET.
  const viewer = await currentOrganizer();
  if (viewer?.isDemo && rawTo) redirect(demoTargetPath(viewer.id, to));
  // Plain /demo is "Sell with us" now: its Try-the-demo and Create buttons
  // and the story videos. This page stays for the demo's own messages
  // (?error=…) and deep links (?to=…).
  if (!rawTo && !error) redirect('/organizers');

  const brand = platformNameFromEnv();
  const realSession = viewer !== null && !viewer.isDemo;

  const hidden = (target: DemoTarget) => (
    <>
      <input type="hidden" name="to" value={target} />
      {(realSession || error === 'signed-in') && <input type="hidden" name="confirm" value="1" />}
    </>
  );

  return (
    <div className="container section demo-page">
      <header className="demo-head">
        <p className="feed-kicker">Try it yourself · free · no sign-up</p>
        <h1 className="page-title">Pick a demo</h1>
        <p className="muted">
          Your own private seller account on {brand} with real orders already in it. Open one — you can switch to the
          others inside.
        </p>
      </header>

      {error === 'signed-in' ? (
        <div className="notice notice-warn">
          You are signed in to a real organizer account. Starting the demo signs you out of it in this browser — you
          can sign back in afterwards.
        </div>
      ) : error && ERRORS[error] ? (
        <div className="notice notice-error">{ERRORS[error]}</div>
      ) : null}

      {/* Arrived from a link to one feature (e.g. /showcase): that first. */}
      {rawTo && to !== 'portal' && !viewer?.isDemo && (
        <form action="/api/demo/start" method="post" className="demo-direct">
          {hidden(to)}
          <DemoSubmit label={`Open ${TARGET_LABEL[to]} →`} />
          <span className="muted small">or pick a whole demo below</span>
        </form>
      )}

      <PitchVideo caption="Watch first: the whole thing in about a minute." />
      <div className="container">
        <StoryShelf title="Or watch a whole evening" />
      </div>

      <div className="demo-picks">
        {PICKS.map((p) => (
          <div key={p.to} className={`demo-pick demo-pick-${p.tone}`}>
            <span className="demo-pick-emoji" aria-hidden="true">
              {p.emoji}
            </span>
            <h2>{p.title}</h2>
            <p className="demo-pick-who">{p.who}</p>
            <ul>
              {p.points.map((pt) => (
                <li key={pt}>{pt}</li>
              ))}
            </ul>
            {viewer?.isDemo ? (
              <Link className="btn btn-brand demo-pick-go" href={`/demo?to=${p.to}`}>
                Open →
              </Link>
            ) : (
              <form action="/api/demo/start" method="post">
                {hidden(p.to)}
                <DemoSubmit label="Open this demo →" className="btn btn-brand demo-pick-go" />
              </form>
            )}
          </div>
        ))}
      </div>

      <ul className="demo-facts">
        <li>✓ Nothing to pay</li>
        <li>✓ Only you can see it</li>
        <li>✓ Payments are simulated</li>
        <li>✓ Deletes itself after 24 h</li>
      </ul>

      <details className="demo-more">
        <summary>Or jump straight to one feature</summary>
        <div className="demo-tour">
          {TOUR.map((step) => (
            <div className="demo-tour-row" key={step.to}>
              <div>
                <strong>{step.title}</strong>
                <span>{step.line}</span>
              </div>
              {viewer?.isDemo ? (
                <Link className="btn btn-sm" href={`/demo?to=${step.to}`}>
                  Open
                </Link>
              ) : (
                <form action="/api/demo/start" method="post">
                  {hidden(step.to)}
                  <DemoSubmit label="Open" className="btn btn-sm" />
                </form>
              )}
            </div>
          ))}
        </div>
      </details>

      <p className="muted small" style={{ marginTop: 24 }}>
        Want the full list first? <Link href="/showcase">Browse all features</Link>.
      </p>
    </div>
  );
}
