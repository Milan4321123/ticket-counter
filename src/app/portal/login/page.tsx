import Link from 'next/link';
import { redirect } from 'next/navigation';
import Logo from '@/components/Logo';
import { currentOrganizer } from '@/lib/organizers';
import LoginForm from './LoginForm';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Organizer sign-in' };

export default async function PortalLoginPage() {
  if (await currentOrganizer()) redirect('/portal');

  return (
    <div className="container container-narrow section">
      <div className="anim-fade-up" style={{ maxWidth: 460, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
          <Logo size={34} />
        </div>
        <h1 className="page-title" style={{ textAlign: 'center', margin: '0 0 6px' }}>
          Organizer sign-in
        </h1>
        <p className="muted" style={{ textAlign: 'center', marginTop: 0 }}>
          Your events, orders, and door check-in — all in one place.
        </p>
        <div className="card glow-card">
          <LoginForm />
        </div>
        {/* Two real buttons, not a sentence with links buried in it: someone
            without an account needs an obvious next step, and "see it" and
            "ask for it" are the only two things they can usefully do here. */}
        <div style={{ marginTop: 22, textAlign: 'center' }}>
          <p className="muted small" style={{ margin: '0 0 10px' }}>
            No account yet?
          </p>
          <div
            style={{
              display: 'flex',
              gap: 10,
              justifyContent: 'center',
              flexWrap: 'wrap',
            }}
          >
            <Link href="/organizers" className="btn btn-green">
              See how it works
            </Link>
            <Link href="/contact?intent=account" className="btn btn-brand">
              Request an account
            </Link>
          </div>
          <p className="muted small" style={{ margin: '10px 0 0' }}>
            Tell us about your event and a real person sets your account up, then emails you the
            sign-in details.
          </p>
        </div>
      </div>
    </div>
  );
}
