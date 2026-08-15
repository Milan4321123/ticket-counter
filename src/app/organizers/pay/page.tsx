import Link from 'next/link';
import { redirect } from 'next/navigation';
import CopyButton from '@/components/CopyButton';
import Logo from '@/components/Logo';
import { getOrganizer } from '@/lib/organizers';
import { eventFeeAmount, platformBank, platformFeeRule, signupReference } from '@/lib/platform';

export const dynamic = 'force-dynamic';

// Payment details for one signup — keep it out of search engines.
export const metadata = {
  title: 'Your account is ready',
  robots: { index: false, follow: false },
};

// Fixed-width labels keep the .copy-row values aligned.
const rowLabelStyle = { minWidth: 130 } as const;

export default async function OrganizerPayPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  const organizer = id ? getOrganizer(id) : null;
  // Only a signup that is still waiting to be switched on sees this page —
  // everyone else (active, disabled, unknown id) belongs at the sign-in.
  if (!organizer || organizer.status !== 'pending') redirect('/portal/login');

  const bank = platformBank();
  // No event exists yet, so there is no amount to quote — show the rule, and one
  // familiar size to make it concrete.
  const feeRule = platformFeeRule();
  const feeExample = eventFeeAmount(500);
  const reference = signupReference(organizer.id);

  return (
    <div className="container container-narrow section">
      <div className="anim-fade-up" style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
        <Logo size={34} />
      </div>
      <h1 className="page-title anim-fade-up" style={{ textAlign: 'center', margin: '0 0 6px' }}>
        Welcome — your account is created
      </h1>
      <p className="muted anim-fade-up" style={{ textAlign: 'center', marginTop: 0 }}>
        <strong>{organizer.name}</strong> is signed up, and the account itself is{' '}
        <strong>free</strong>. You pay per event — only when you publish one — and the fee follows
        your venue: {feeExample} for a 500-person event. Here is where that transfer goes
        (we&rsquo;ve emailed you the same details).
      </p>

      {bank ? (
        <div className="bank-box anim-fade-up anim-d1" style={{ margin: '20px 0 16px' }}>
          <div className="card-title">Where the event fee goes</div>
          <div className="copy-row">
            <span className="muted small" style={rowLabelStyle}>
              Per event
            </span>
            <strong>{feeRule}</strong>
          </div>
          <div className="copy-row">
            <span className="muted small" style={rowLabelStyle}>
              Account holder
            </span>
            <span>{bank.accountHolder}</span>
          </div>
          <div className="copy-row">
            <span className="muted small" style={rowLabelStyle}>
              IBAN
            </span>
            <span className="mono">{bank.iban}</span>
            <CopyButton value={bank.iban} />
          </div>
          {bank.bic ? (
            <div className="copy-row">
              <span className="muted small" style={rowLabelStyle}>
                BIC
              </span>
              <span className="mono">{bank.bic}</span>
            </div>
          ) : null}
          {bank.bankName ? (
            <div className="copy-row">
              <span className="muted small" style={rowLabelStyle}>
                Bank
              </span>
              <span>{bank.bankName}</span>
            </div>
          ) : null}
          <div
            className="copy-row"
            style={{
              borderColor: 'rgba(220, 20, 60, 0.6)',
              background: 'rgba(220, 20, 60, 0.08)',
            }}
          >
            <span className="muted small" style={rowLabelStyle}>
              Account reference
            </span>
            <span
              className="mono"
              style={{ fontWeight: 800, fontSize: '1.1rem', letterSpacing: '0.05em' }}
            >
              {reference}
            </span>
            <CopyButton value={reference} />
          </div>
          <p className="muted small" style={{ margin: '12px 0 0' }}>
            Nothing to pay today. Every event you build gets its <strong>own</strong> reference
            (it starts with <span className="mono">EVENT-</span> and is shown on that
            event&rsquo;s Publish tab) — use that one in your transfer&rsquo;s purpose line, and
            we&rsquo;ll know exactly which event the money unlocks.
          </p>
        </div>
      ) : (
        <div className="notice notice-warn anim-fade-up anim-d1" style={{ marginTop: 20 }}>
          The payment details aren&rsquo;t set up yet. Please contact us and we&rsquo;ll get your
          account switched on.
        </div>
      )}

      <div className="card anim-fade-up anim-d2">
        <h2 className="card-title">What happens next</h2>
        <ol className="step-list" style={{ margin: 0 }}>
          <li className="step-item">
            <span className="step-num step-num-brand">1</span>
            <div>
              <div className="tier-name">We switch your account on</div>
              <p className="muted small" style={{ margin: '2px 0 0' }}>
                A quick check that you&rsquo;re a real organizer — usually within a day.
                It costs nothing.
              </p>
            </div>
          </li>
          <li className="step-item">
            <span className="step-num step-num-brand">2</span>
            <div>
              <div className="tier-name">You build your event</div>
              <p className="muted small" style={{ margin: '2px 0 0' }}>
                Photos, tickets, your own bank details for ticket sales — take as long as
                you like, drafts are free.
              </p>
            </div>
          </li>
          <li className="step-item">
            <span className="step-num step-num-brand">3</span>
            <div>
              <div className="tier-name">You send that event&rsquo;s fee and publish</div>
              <p className="muted small" style={{ margin: '2px 0 0' }}>
                Its Publish tab shows the exact amount for the capacity you set, plus the
                event&rsquo;s own reference — and we email you both. Transfers take 1–2 business
                days; publishing unlocks the moment we see the money.
              </p>
            </div>
          </li>
        </ol>
      </div>

      <p className="muted small anim-fade-up anim-d3" style={{ textAlign: 'center' }}>
        No need to bookmark anything — you can{' '}
        <Link href="/portal/login" style={{ color: 'var(--brand-text)', fontWeight: 600 }}>
          sign in
        </Link>{' '}
        with your email and password anytime to see these details again.
      </p>
    </div>
  );
}
