import { redirect } from 'next/navigation';
import Logo from '@/components/Logo';
import { currentOrganizer } from '@/lib/organizers';
import LogoutButton from '../LogoutButton';
import FirstPasswordForm from './FirstPasswordForm';

export const dynamic = 'force-dynamic';

// Nothing here for a search engine, and it is only ever reachable signed in.
export const metadata = { title: 'Choose your password', robots: { index: false, follow: false } };

/**
 * The one-way door into the portal for an account whose password was picked by
 * us and sent by email. It calls currentOrganizer() rather than the portal
 * guard on purpose: the guard redirects must-change accounts HERE, so going
 * through it would be a loop. Once the flag is cleared there is nothing left to
 * do on this page, so it hands them straight on to the portal.
 */
export default async function PortalChangePasswordPage() {
  const organizer = await currentOrganizer();
  if (!organizer) redirect('/portal/login');
  if (!organizer.mustChangePassword) redirect('/portal');

  return (
    <div className="container container-narrow section">
      <div className="anim-fade-up" style={{ maxWidth: 460, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
          <Logo size={34} />
        </div>
        <h1 className="page-title" style={{ textAlign: 'center', margin: '0 0 6px' }}>
          Choose your password
        </h1>
        <p className="muted" style={{ textAlign: 'center', marginTop: 0 }}>
          Welcome, {organizer.name}. The password we emailed you was only ever meant to get you in
          once — pick one that only you know, and the portal is yours.
        </p>
        <div className="card glow-card">
          <FirstPasswordForm />
        </div>
        <p className="muted small" style={{ textAlign: 'center', marginTop: 16 }}>
          Signed in as <span translate="no">{organizer.email}</span>. Not you? <LogoutButton />
        </p>
      </div>
    </div>
  );
}
