import type { OrganizerRow } from '@/lib/organizers';
import LogoutButton from './LogoutButton';

/**
 * Friendly full-page notice shown instead of any portal page when an account
 * can't be used. Accounts never expire (the platform fee is charged per event),
 * so this only appears for an account the platform has switched off — their
 * published events and ticket sales keep running either way.
 */
export default function PlanExpired({ organizer }: { organizer: OrganizerRow }) {
  const pending = organizer.status === 'pending';
  return (
    <div className="container container-narrow section">
      <div className="anim-fade-up" style={{ maxWidth: 560, margin: '0 auto' }}>
        <h1 className="page-title">
          {pending ? 'Your account is almost ready' : 'Your account is switched off'}
        </h1>
        <div className="card">
          <div className="notice notice-warn">
            {pending
              ? 'We are still switching your account on — it only takes a quick look from our side.'
              : 'The platform team has paused this account.'}
          </div>
          <p>
            Don&rsquo;t worry — anything you already published stays online and ticket sales keep running.
            You just can&rsquo;t make changes here for the moment.
          </p>
          <p className="muted">
            {pending
              ? 'Nothing to pay for the account itself — it is free. Once it is switched on, this page opens by itself.'
              : 'Get in touch with the platform team that set up your account. As soon as they switch it back on, this page opens by itself.'}
          </p>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <LogoutButton />
            <span className="muted small">Signed in as <span translate="no">{organizer.email}</span></span>
          </div>
        </div>
      </div>
    </div>
  );
}
