import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isAdminRequest } from '@/lib/auth';
import { listAllEvents } from '@/lib/events';
import { listOrganizers } from '@/lib/organizers';
import { signupReference } from '@/lib/platform';
import AddOrganizerForm from './AddOrganizerForm';
import ConfirmSignup from './ConfirmSignup';
import OrganizerActions from './OrganizerActions';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Organizers — Admin', robots: { index: false, follow: false } };

export default async function AdminOrganizersPage() {
  if (!(await isAdminRequest())) redirect('/admin/login');

  const organizers = listOrganizers();
  const events = listAllEvents();
  const eventCounts = new Map<string, number>();
  for (const e of events) eventCounts.set(e.organizerId, (eventCounts.get(e.organizerId) ?? 0) + 1);
  const pending = organizers.filter((o) => o.status === 'pending');

  return (
    <div className="container section">
      <div
        className="anim-fade-up"
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 20,
        }}
      >
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>
            Organizers
          </h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            Your organizers — each account runs its own events in the portal. Accounts are free and
            never expire, and publishing costs nothing: the platform is free while it grows.
          </p>
        </div>
        <Link href="/admin" className="btn btn-sm">
          ← Dashboard
        </Link>
      </div>

      {/* ---- Self-service signups waiting to be switched on ---- */}
      {pending.length > 0 && (
        <div className="card action-card anim-fade-up">
          <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="pulse-dot" aria-hidden />
            {pending.length} new signup{pending.length === 1 ? '' : 's'} to switch on
          </div>
          <p className="muted small" style={{ marginTop: 0 }}>
            These organizers signed up themselves. The account is free and so is publishing,
            so this is just a check that they look real. Click <strong>Activate account</strong> and
            type the last 4 characters of their reference to let them in.
          </p>
          <div>
            {pending.map((o) => (
              <div key={o.id} className="action-row">
                <div className="action-row-who">
                  <div style={{ fontWeight: 700 }}>{o.name}</div>
                  <div className="muted small">
                    {o.email} · signed up {o.createdAt.slice(0, 10)}
                  </div>
                </div>
                <div className="action-row-amount">free</div>
                <span className="mono small" style={{ whiteSpace: 'nowrap' }}>
                  <strong>{signupReference(o.id)}</strong>
                </span>
                <ConfirmSignup organizerId={o.id} name={o.name} reference={signupReference(o.id)} />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card glow-card anim-fade-up anim-d1">
        <div className="card-title">Add an organizer</div>
        <p className="muted small" style={{ marginTop: 0 }}>
          For organizers you onboard yourself — the account is free, and so is publishing.
          You&rsquo;ll get their sign-in password to pass on — it is shown only once.
        </p>
        <AddOrganizerForm />
      </div>

      <div className="card anim-fade-up anim-d2">
        <div className="card-title">All organizers</div>
        {organizers.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            No organizers yet — add the first one above.
          </p>
        ) : (
          <div className="table-wrap">
            <table className="table table-hover">
              <thead>
                <tr>
                  <th>Organizer</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Events</th>
                  <th>Created</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {organizers.map((o) => (
                  <tr key={o.id}>
                    <td style={{ fontWeight: 600 }}>{o.name}</td>
                    <td className="small">{o.email}</td>
                    <td>
                      <span
                        className={`badge ${
                          o.status === 'active'
                            ? 'badge-green'
                            : o.status === 'pending'
                              ? 'badge-amber'
                              : 'badge-red'
                        }`}
                      >
                        {o.status === 'pending' ? 'not activated yet' : o.status}
                      </span>
                    </td>
                    <td>{eventCounts.get(o.id) ?? 0}</td>
                    <td className="mono small">{o.createdAt.slice(0, 10)}</td>
                    <td>
                      {o.status === 'pending' ? (
                        <span className="muted small" style={{ whiteSpace: 'nowrap' }}>
                          Activate them above · ref{' '}
                          <span className="mono">{signupReference(o.id)}</span>
                        </span>
                      ) : (
                        <OrganizerActions
                          organizerId={o.id}
                          name={o.name}
                          email={o.email}
                          status={o.status}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
