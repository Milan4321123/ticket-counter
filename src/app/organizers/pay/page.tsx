import Link from 'next/link';
import { redirect } from 'next/navigation';
import Logo from '@/components/Logo';
import { getOrganizer } from '@/lib/organizers';

export const dynamic = 'force-dynamic';

// One signup's welcome page — keep it out of search engines.
//
// The route is still /organizers/pay for a reason that has nothing to do with
// paying: pending organizers are sent here by the sign-in form, and links to
// this URL are sitting in inboxes from when the page really did show payment
// details. The platform is free now, so what the URL shows is simply what
// happens next.
export const metadata = {
  title: 'Your account is ready',
  robots: { index: false, follow: false },
};

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

  return (
    <div className="container container-narrow section">
      <div className="anim-fade-up" style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
        <Logo size={34} />
      </div>
      <h1 className="page-title anim-fade-up" style={{ textAlign: 'center', margin: '0 0 6px' }}>
        Welcome — your account is created
      </h1>
      <p className="muted anim-fade-up" style={{ textAlign: 'center', marginTop: 0 }}>
        <strong>{organizer.name}</strong> is signed up. Everything is <strong>free</strong> — the
        account, publishing, all of it — and there is nothing to pay, today or later. One small
        step left: we switch your account on.
      </p>

      <div className="card anim-fade-up anim-d1" style={{ marginTop: 20 }}>
        <h2 className="card-title">What happens next</h2>
        <ol className="step-list" style={{ margin: 0 }}>
          <li className="step-item">
            <span className="step-num step-num-brand">1</span>
            <div>
              <div className="tier-name">We switch your account on</div>
              <p className="muted small" style={{ margin: '2px 0 0' }}>
                A quick check that you&rsquo;re a real organizer — usually within a day. It costs
                nothing.
              </p>
            </div>
          </li>
          <li className="step-item">
            <span className="step-num step-num-brand">2</span>
            <div>
              <div className="tier-name">You build your event</div>
              <p className="muted small" style={{ margin: '2px 0 0' }}>
                Photos, tickets, your own bank details for ticket sales — take as long as you
                like.
              </p>
            </div>
          </li>
          <li className="step-item">
            <span className="step-num step-num-brand">3</span>
            <div>
              <div className="tier-name">You publish — free</div>
              <p className="muted small" style={{ margin: '2px 0 0' }}>
                Finish the checklist on the Publish tab and press the button. Your page is in the
                public feed right away, and ticket money goes straight to your own bank account —
                we never touch it and never take a cut.
              </p>
            </div>
          </li>
        </ol>
      </div>

      <p className="muted small anim-fade-up anim-d2" style={{ textAlign: 'center' }}>
        No need to bookmark anything — you can{' '}
        <Link href="/portal/login" style={{ color: 'var(--brand-text)', fontWeight: 600 }}>
          sign in
        </Link>{' '}
        with your email and password anytime.
      </p>
    </div>
  );
}
