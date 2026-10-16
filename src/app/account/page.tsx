import Link from 'next/link';
import { currentCustomer, googleSignInConfigured, ordersForCustomer, subscriptionsForCustomer } from '@/lib/customers';
import { formatMoney } from '@/lib/money';
import { orderUrlForBuyerEmail } from '@/lib/orders';
import { readListingName } from '@/lib/exampleShop';
import { everyLabel } from '@/lib/subscriptions';
import { BUYER_RETENTION_DAYS, CUSTOMER_INACTIVE_DAYS, UNDATED_ORDER_RETENTION_DAYS } from '@/lib/retention';
import { getMember } from '@/lib/community';
import { communityUnread } from '@/lib/inbox';
import SignInForm from './SignInForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Your account', robots: { index: false, follow: false } };

const ERRORS: Record<string, string> = {
  'google-off': 'Google sign-in is not switched on here yet — use your email instead.',
  'google-state': 'That Google sign-in took too long or came from another tab — please try again.',
  'google-token': 'Google did not confirm the sign-in — please try again.',
  'google-email': 'Your Google account has no verified email address.',
};

function statusLabel(status: string, mode: string): { text: string; tone: string } {
  if (status === 'paid') return { text: 'Paid', tone: 'green' };
  if (mode === 'transfer') return { text: 'Waiting for payment', tone: 'amber' };
  return { text: 'In progress', tone: 'amber' };
}

/**
 * The customer's own page: every order made with their (verified) email,
 * their Subscribe & save subscriptions, and sign-out. Signed out, it is the
 * sign-in card — a code by email, or Google.
 */
export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string; back?: string; deleted?: string; delete?: string }>;
}) {
  const { error, saved, back: rawBack, deleted, delete: deleteAsk } = await searchParams;
  // Where to go after signing in: a same-site path the link asked for (e.g.
  // the checkout), otherwise the homepage.
  const back = rawBack && rawBack.startsWith('/') && !rawBack.startsWith('//') ? rawBack : '/';
  const customer = await currentCustomer();

  if (!customer) {
    return (
      <div className="container section acc">
        <div className="acc-card anim-fade-up">
          <p className="feed-kicker">Your account</p>
          <h1 className="page-title">Sign in</h1>
          <p className="muted">
            See every order and ticket in one place, manage subscriptions, and check out faster. No password — we send
            you a code.
          </p>
          {error && ERRORS[error] && <div className="notice notice-error">{ERRORS[error]}</div>}
          {deleted && (
            <div className="notice notice-success" role="status">
              Your account is deleted, with your saved basket, and you are signed out. Your orders stay with
              the sellers you bought from until they are erased automatically — to have that happen sooner,{' '}
              <Link href="/contact">write to us</Link>.
            </div>
          )}
          <SignInForm google={googleSignInConfigured()} back={back} />
          <p className="muted small acc-seller">
            Selling here? <Link href="/portal/login">Organizer sign-in →</Link>
          </p>
        </div>
      </div>
    );
  }

  const orders = ordersForCustomer(customer.email);
  const member = getMember(customer.id);
  const unread = member ? communityUnread(member) : 0;
  const subs = subscriptionsForCustomer(customer.email);
  const first = customer.name.split(/\s+/)[0] || '';

  return (
    <div className="container section acc">
      <header className="acc-head anim-fade-up">
        <div>
          <p className="feed-kicker">Your account</p>
          <h1 className="page-title">
            {first ? (
              <>
                Namaste, <span translate="no">{first}</span>
              </>
            ) : (
              'Your orders'
            )}
          </h1>
          <p className="muted" translate="no">
            {customer.email}
          </p>
        </div>
        <form method="post" action="/api/account/logout">
          <button className="btn btn-sm">Sign out</button>
        </form>
      </header>

      {/* Where a signed-in customer goes next — the same tiles as the homepage. */}
      <nav className="qt acc-go" aria-label="Go shopping">
        <Link href="/" className="qt-tile qt-events">
          <span className="qt-icon" aria-hidden="true">
            🎟
          </span>
          <span className="qt-text">
            <strong>Browse events</strong>
            <span>Tickets for what is coming up</span>
          </span>
        </Link>
        <Link href="/market" className="qt-tile qt-bazaar">
          <span className="qt-icon" aria-hidden="true">
            🛍
          </span>
          <span className="qt-text">
            <strong>The bazaar</strong>
            <span>Goods from Nepali shops</span>
          </span>
        </Link>
        <Link href="/basket" className="qt-tile qt-org">
          <span className="qt-icon" aria-hidden="true">
            🧺
          </span>
          <span className="qt-text">
            <strong>Your basket</strong>
            <span>Everything you picked, ready to order</span>
          </span>
        </Link>
      </nav>

      {saved && <div className="notice notice-success">Saved.</div>}

      <section className="acc-section anim-fade-up anim-d1">
        <h2>Orders &amp; tickets</h2>
        {orders.length === 0 ? (
          <div className="acc-empty">
            <p>
              Nothing yet. Orders you place with <span translate="no">{customer.email}</span> show up here.
            </p>
            <p>
              <Link href="/" className="btn btn-sm">
                Browse events
              </Link>{' '}
              <Link href="/market" className="btn btn-sm">
                Shop the bazaar
              </Link>
            </p>
          </div>
        ) : (
          <ul className="acc-orders">
            {orders.map((o) => {
              const st = statusLabel(o.status, o.paymentMode);
              return (
                <li key={o.id}>
                  <a href={orderUrlForBuyerEmail(o.id)} className="acc-order">
                    <span className="acc-order-icon" aria-hidden="true">
                      {o.kind === 'shop' ? '🛍' : '🎟'}
                    </span>
                    <span className="acc-order-main">
                      <strong>{readListingName(o.eventName).name}</strong>
                      <span>
                        {o.items} {o.kind === 'shop' ? (o.items === 1 ? 'item' : 'items') : o.items === 1 ? 'ticket' : 'tickets'}
                        {o.kind !== 'shop' && o.dateDisplay ? ` · ${o.dateDisplay}` : ''} · {o.createdAt.slice(0, 10)}
                      </span>
                    </span>
                    <span className="acc-order-side">
                      <b>{formatMoney(o.totalCents, o.currency)}</b>
                      <span className={`badge badge-${st.tone}`}>{st.text}</span>
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {subs.length > 0 && (
        <section className="acc-section anim-fade-up anim-d2">
          <h2>Subscribe &amp; save</h2>
          <ul className="acc-orders">
            {subs.map((s) => (
              <li key={s.token}>
                <Link href={`/subscription/${s.token}`} className="acc-order">
                  <span className="acc-order-icon" aria-hidden="true">
                    ↻
                  </span>
                  <span className="acc-order-main">
                    <strong>{readListingName(s.eventName).name}</strong>
                    <span>
                      {everyLabel(s.everyDays)} · {s.discountPct}% off · {s.status === 'active' ? `next ${s.nextOn}` : s.status}
                    </span>
                  </span>
                  <span className="acc-order-side">
                    <span className="acc-manage">Manage →</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="acc-section anim-fade-up anim-d2">
        <h2>Community</h2>
        {member ? (
          <p className="muted small">
            You are a member as <strong translate="no">{member.name}</strong> ({member.city}).{' '}
            <Link href="/community">Your community page</Link> · <Link href="/inbox">Inbox{unread ? ` (${unread})` : ''}</Link> ·{' '}
            <Link href="/bhetghat/plans">My plans</Link>
          </p>
        ) : (
          <p className="muted small">
            Meetups near you, a help board for rooms, rides and papers, and Nepali artists to book — free, members only.{' '}
            <Link href="/community">Join the community →</Link>
          </p>
        )}
      </section>

      <section className="acc-section anim-fade-up anim-d2">
        <h2>Your name at checkout</h2>
        <form method="post" action="/api/account/name" className="acc-name">
          <input name="name" defaultValue={customer.name} placeholder="Your name" maxLength={120} aria-label="Your name" />
          <button className="btn btn-sm">Save</button>
        </form>
      </section>

      {/* Art. 15 / 20 GDPR: everything held about this (verified) address, as
          one file. lib/erasure.collectPersonalData reads the same tables the
          admin's erase tool writes, so the two cannot drift. */}
      <section className="acc-section anim-fade-up anim-d2" id="data">
        <h2>Your data</h2>
        <p className="muted small">
          Download everything held under <span translate="no">{customer.email}</span> — your account, orders
          with their items and tickets, subscriptions, reviews, customer cards, keep-me-posted choices,
          waitlists, messages and your community posts — as one file (JSON), with how long each is kept.
        </p>
        <a href="/api/account/export" className="btn btn-sm" download>
          Download my data
        </a>
      </section>

      {/* Art. 17 GDPR: the account is the customer's own, and so is deleting it. */}
      <section className="acc-section anim-fade-up anim-d2" id="delete">
        <h2>Delete my account</h2>
        <p className="muted small">
          This deletes your account, your saved basket, any sign-in code and everything you did in the community
          (meetups, posts, messages, your Kalakar profile), and signs you out. Your{' '}
          <strong>orders are not part of your account</strong>: each one is the seller&rsquo;s record of a sale
          and stays with them until it is erased automatically — {BUYER_RETENTION_DAYS} days after the event
          (for shops, after collection; for listings without a date, {UNDATED_ORDER_RETENTION_DAYS} days after
          the order). To have them erased sooner, <Link href="/contact">write to us</Link>. Accounts nobody
          signs in to for {CUSTOMER_INACTIVE_DAYS} days are deleted automatically.
        </p>
        {deleteAsk === 'confirm' && (
          <div className="notice notice-error small" role="alert">
            Type DELETE in the box to confirm — nothing was deleted.
          </div>
        )}
        <form method="post" action="/api/account/delete" className="acc-name">
          <input
            name="confirm"
            placeholder="Type DELETE"
            aria-label="Type DELETE to confirm"
            autoComplete="off"
            required
            pattern="[Dd][Ee][Ll][Ee][Tt][Ee]"
          />
          <button className="btn btn-sm btn-danger">Delete my account</button>
        </form>
      </section>
    </div>
  );
}
