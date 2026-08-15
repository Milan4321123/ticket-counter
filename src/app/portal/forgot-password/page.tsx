import Link from 'next/link';
import Logo from '@/components/Logo';
import ForgotPasswordForm from './ForgotPasswordForm';

export const dynamic = 'force-dynamic';

// Nothing here for a search engine to index, and never a page to land on cold.
export const metadata = { title: 'Reset your password', robots: { index: false, follow: false } };

/**
 * "I forgot my password", for organizers. Deliberately does NOT call
 * requirePortalOrganizer(): the people who need it have no session at all, and
 * that guard would bounce them to the sign-in page (or, for an account still on
 * its emailed password, to /portal/change-password) before they could type
 * anything. It does not check for an existing session either — someone signed
 * in on another tab may still be here to fix their password, and the reset
 * stands on the emailed code, not on who is signed in.
 */
export default function PortalForgotPasswordPage() {
  return (
    <div className="container container-narrow section">
      <div className="anim-fade-up" style={{ maxWidth: 460, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
          <Logo size={34} />
        </div>
        <h1 className="page-title" style={{ textAlign: 'center', margin: '0 0 6px' }}>
          Reset your password
        </h1>
        <p className="muted" style={{ textAlign: 'center', marginTop: 0 }}>
          Tell us the address you sign in with and we will email you a code. It only takes a minute,
          and nobody needs to be involved.
        </p>
        <div className="card glow-card">
          <ForgotPasswordForm />
        </div>
        <p className="muted small" style={{ textAlign: 'center', marginTop: 16 }}>
          Remembered it after all? <Link href="/portal/login">Back to sign-in</Link>
        </p>
      </div>
    </div>
  );
}
