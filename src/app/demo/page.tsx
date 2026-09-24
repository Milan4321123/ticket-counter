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
};

const ERRORS: Record<string, string> = {
  'too-many': 'You have started several demos in the last hour. Please wait a little, or keep using the one you have.',
  busy: 'A lot of people are trying the demo right now. Please try again in a few minutes.',
  failed: 'Something went wrong while building your demo. Please try again.',
};

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

  const brand = platformNameFromEnv();
  const realSession = viewer !== null && !viewer.isDemo;

  return (
    <div className="container container-narrow section">
      <p className="feed-kicker">Try it yourself</p>
      <h1 className="page-title" style={{ marginTop: 4 }}>
        Your own organizer account, ready in a second
      </h1>
      <p className="muted" style={{ maxWidth: 640 }}>
        Press the button and you get a private demo account on {brand}: an upcoming event with four ticket types, a
        shop with six items and photos, three weeks of orders, customers collecting with QR codes, reviews and a
        promo code. Every page works — you are using the real software, not screenshots.
      </p>

      {error === 'signed-in' ? (
        <div className="notice notice-warn">
          You are signed in to a real organizer account. Starting the demo signs you out of it in this browser — you
          can sign back in afterwards.
        </div>
      ) : error && ERRORS[error] ? (
        <div className="notice notice-error">{ERRORS[error]}</div>
      ) : null}

      {viewer?.isDemo ? (
        <p>
          <Link className="btn btn-brand btn-lg" href="/portal">
            Continue your demo →
          </Link>
        </p>
      ) : (
        <form action="/api/demo/start" method="post" style={{ margin: '18px 0 8px' }}>
          <input type="hidden" name="to" value={to} />
          {(realSession || error === 'signed-in') && <input type="hidden" name="confirm" value="1" />}
          <DemoSubmit label={to === 'portal' ? 'Start the demo' : `Start the demo and open ${TARGET_LABEL[to]}`} />
        </form>
      )}

      <ul className="muted small" style={{ margin: '10px 0 28px', paddingLeft: 18, lineHeight: 1.7 }}>
        <li>No sign-up and nothing to pay.</li>
        <li>Only you can see your demo — it never appears on the public site.</li>
        <li>Payments are simulated and no emails are sent, so try anything.</li>
        <li>It deletes itself after 24 hours.</li>
      </ul>

      <h2 className="feed-section-title">Things to try</h2>
      <div className="demo-tour">
        {TOUR.map((step) => (
          <div className="card demo-tour-card" key={step.to}>
            <div className="tier-name">{step.title}</div>
            <p className="muted small" style={{ margin: '4px 0 10px' }}>
              {step.line}
            </p>
            {viewer?.isDemo ? (
              <Link className="inline-link small" href={`/demo?to=${step.to}`}>
                Open →
              </Link>
            ) : (
              <form action="/api/demo/start" method="post">
                <input type="hidden" name="to" value={step.to} />
                {realSession && <input type="hidden" name="confirm" value="1" />}
                <DemoSubmit label="Start here →" className="btn btn-sm" />
              </form>
            )}
          </div>
        ))}
      </div>

      <p className="muted small" style={{ marginTop: 28 }}>
        Want to see everything the platform does first? <Link href="/showcase">Browse all features</Link>.
      </p>
    </div>
  );
}
