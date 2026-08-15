import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isAdminRequest } from '@/lib/auth';
import { listContactRequests, type ContactRequestRow } from '@/lib/contact';
import { platformContactEmail, platformFeeLabel } from '@/lib/platform';
import ApproveAccountButton from './ApproveAccountButton';
import MarkHandledButton from './MarkHandledButton';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Applications & page requests — Admin', robots: { index: false, follow: false } };

/** The optional application details, in the order they are asked for. */
function applicationDetails(r: ContactRequestRow): [string, string][] {
  return (
    [
      ['Phone', r.phone],
      ['Event', r.eventKind],
      ['When', r.eventWhen],
      ['Where', r.eventWhere],
      ['People', r.expectedPeople],
    ] as [string, string][]
  ).filter(([, value]) => value !== '');
}

/** Name, email, organization — the same three lines in both tables. */
function WhoCells({ request }: { request: ContactRequestRow }) {
  return (
    <>
      <td style={{ fontWeight: 600 }}>{request.name}</td>
      <td className="small">
        <a href={`mailto:${request.email}`} style={{ color: 'var(--accent)' }}>
          {request.email}
        </a>
      </td>
      <td className="small">{request.organization || <span className="muted">—</span>}</td>
    </>
  );
}

export default async function AdminContactPage() {
  if (!(await isAdminRequest())) redirect('/admin/login');

  const requests = listContactRequests(); // newest first
  const applications = requests.filter((r) => r.kind === 'organizer-account');
  const enquiries = requests.filter((r) => r.kind !== 'organizer-account');
  const newApplications = applications.filter((r) => r.status === 'new').length;
  const newEnquiries = enquiries.filter((r) => r.status === 'new').length;
  const contactEmail = platformContactEmail();

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
            Applications &amp; page requests
          </h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            Everything sent from{' '}
            <Link href="/contact" style={{ color: 'var(--accent)' }}>
              /contact
            </Link>
            : people asking for an organizer account, and organizers who want us to design their
            page. Every one is also emailed to{' '}
            <a href={`mailto:${contactEmail}`} style={{ color: 'var(--accent)' }}>
              {contactEmail}
            </a>
            .
          </p>
        </div>
        <Link href="/admin" className="btn btn-sm">
          ← Dashboard
        </Link>
      </div>

      {/* ---- Account applications: the only way an account is created ---- */}
      <div className={`card${newApplications > 0 ? ' action-card' : ''} anim-fade-up`}>
        <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {newApplications > 0 && <span className="pulse-dot" aria-hidden />}
          {newApplications > 0
            ? `${newApplications} account application${newApplications === 1 ? '' : 's'} waiting`
            : 'Account applications'}
        </div>
        <p className="muted small" style={{ marginTop: 0 }}>
          Nobody can create their own account — this is where they are made. Read what they wrote,
          and if it looks like a real organizer, approve it: that creates the account and emails them
          a temporary password they have to change on their first sign-in. Not convinced? Reply by
          email and mark it handled instead — nothing is created.
        </p>

        {applications.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            No applications yet — they&rsquo;ll appear here the moment someone applies.
          </p>
        ) : (
          <div className="table-wrap">
            <table className="table table-hover">
              <thead>
                <tr>
                  <th>Received (UTC)</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Organization</th>
                  <th>Their event</th>
                  <th>What they wrote</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {applications.map((r) => {
                  const details = applicationDetails(r);
                  return (
                    <tr key={r.id}>
                      <td className="mono small" style={{ whiteSpace: 'nowrap' }}>
                        {r.createdAt.slice(0, 16)}
                      </td>
                      <WhoCells request={r} />
                      <td className="small" style={{ minWidth: 180 }}>
                        {details.length === 0 ? (
                          <span className="muted">They didn&rsquo;t say</span>
                        ) : (
                          details.map(([label, value]) => (
                            <div key={label} style={{ marginBottom: 2 }}>
                              <span className="muted">{label}: </span>
                              {value}
                            </div>
                          ))
                        )}
                      </td>
                      <td className="small" style={{ minWidth: 240, maxWidth: 420 }}>
                        <span style={{ whiteSpace: 'pre-wrap' }}>{r.message}</span>
                      </td>
                      <td>
                        {r.organizerId ? (
                          <span className="badge badge-green">approved</span>
                        ) : (
                          <span className={`badge ${r.status === 'new' ? 'badge-amber' : 'badge-green'}`}>
                            {r.status === 'new' ? 'new' : 'handled'}
                          </span>
                        )}
                      </td>
                      <td>
                        {r.organizerId ? (
                          <span className="muted small">Account created</span>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 170 }}>
                            <ApproveAccountButton requestId={r.id} name={r.name} email={r.email} />
                            {r.status === 'new' && <MarkHandledButton requestId={r.id} />}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ---- Custom-design leads: no account, no money, just a conversation ---- */}
      <div className={`card${newEnquiries > 0 ? ' action-card' : ''} anim-fade-up anim-d1`}>
        <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {newEnquiries > 0 && <span className="pulse-dot" aria-hidden />}
          {newEnquiries > 0
            ? `${newEnquiries} page request${newEnquiries === 1 ? '' : 's'} waiting for a reply`
            : 'Custom page requests'}
        </div>
        <p className="muted small" style={{ marginTop: 0 }}>
          These are leads, not orders — nothing is charged and no account is created. A self-service
          page is already covered by the standard event fee ({platformFeeLabel()}); what these
          organizers are asking for is design work on top of it. Reply by email, then mark it handled
          here.
        </p>

        {enquiries.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            No requests yet — they&rsquo;ll appear here the moment someone uses the contact form.
          </p>
        ) : (
          <div className="table-wrap">
            <table className="table table-hover">
              <thead>
                <tr>
                  <th>Received (UTC)</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Organization</th>
                  <th>What they want</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {enquiries.map((r) => (
                  <tr key={r.id}>
                    <td className="mono small" style={{ whiteSpace: 'nowrap' }}>
                      {r.createdAt.slice(0, 16)}
                    </td>
                    <WhoCells request={r} />
                    <td className="small" style={{ minWidth: 260, maxWidth: 460 }}>
                      <span style={{ whiteSpace: 'pre-wrap' }}>{r.message}</span>
                      {r.kind !== 'custom-design' && (
                        <span className="badge" style={{ marginLeft: 6 }}>
                          {r.kind}
                        </span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${r.status === 'new' ? 'badge-amber' : 'badge-green'}`}>
                        {r.status === 'new' ? 'new' : 'handled'}
                      </span>
                    </td>
                    <td>
                      {r.status === 'new' ? (
                        <MarkHandledButton requestId={r.id} />
                      ) : (
                        <span className="muted small">Done</span>
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
