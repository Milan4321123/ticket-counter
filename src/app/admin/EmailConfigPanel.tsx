import { isEmailConfigured } from '@/lib/email';
import {
  bareAddress,
  emailFromBuyers,
  emailFromOrganizers,
  platformContactEmail,
  replyToBuyers,
  replyToOrganizers,
} from '@/lib/platform';
import { getBaseUrl } from '@/lib/config';

/**
 * What the RUNNING server thinks its email settings are.
 *
 * This exists because an evening was lost to a question that should have taken
 * ten seconds: is the address in the environment the address actually being
 * used? Every symptom — mail rejected outright, mail accepted then filtered,
 * mail not attempted at all — looks identical from the outside, and the only way
 * to tell them apart was reading server logs.
 *
 * Server-rendered inside the admin area, so it is only ever visible to the owner
 * and reads live process.env rather than a build-time copy. Deliberately shows
 * no API key or password — the presence of the SMTP host is all that is needed
 * to know whether sending is switched on.
 */
export default function EmailConfigPanel() {
  const configured = isEmailConfigured();
  const buyers = emailFromBuyers();
  const organizers = emailFromOrganizers();

  /** The domain the site itself runs on, for comparison with the senders. */
  let siteDomain = '';
  try {
    siteDomain = new URL(getBaseUrl()).hostname.replace(/^www\./, '');
  } catch {
    siteDomain = '';
  }

  const domainOf = (addr: string) => (bareAddress(addr).split('@')[1] ?? '').toLowerCase();

  /**
   * A sender at a domain the platform does not own is the single most common
   * cause of mail failing, and the most invisible: the display name reads
   * correctly while the address underneath belongs to Gmail. Providers reject or
   * distrust it, and no amount of DNS on your own domain helps.
   */
  const rows = [
    { label: 'Buyer mail — From', value: buyers, checkDomain: true },
    { label: 'Buyer mail — Reply-To', value: replyToBuyers(), checkDomain: false },
    { label: 'Organizer mail — From', value: organizers, checkDomain: true },
    { label: 'Organizer mail — Reply-To', value: replyToOrganizers(), checkDomain: false },
    { label: 'Published contact address', value: platformContactEmail(), checkDomain: false },
  ];

  const mismatched = rows.filter(
    (r) => r.checkDomain && r.value && siteDomain && domainOf(r.value) !== siteDomain
  );

  return (
    <div className="card">
      <div className="card-title">Email configuration</div>

      {!configured ? (
        <div className="notice notice-error small">
          <strong>Email is switched off.</strong> No SMTP host, or no From address of any kind, is
          set — so nothing is even attempted: no tickets, no sign-in codes, no payout alarms. Set
          SMTP_HOST and at least one of EMAIL_FROM, EMAIL_FROM_BUYERS or EMAIL_FROM_ORGANIZERS.
        </div>
      ) : (
        <p className="muted small" style={{ marginTop: 0 }}>
          Sending is on. These are the addresses this server is using right now — if one of them is
          not what you set, the change has not reached this deploy yet.
        </p>
      )}

      <div className="table-wrap">
        <table className="table">
          <tbody>
            {rows.map((r) => {
              const bad = r.checkDomain && r.value && siteDomain && domainOf(r.value) !== siteDomain;
              return (
                <tr key={r.label}>
                  <td className="small" style={{ whiteSpace: 'nowrap' }}>
                    {r.label}
                  </td>
                  <td className="mono small" style={{ wordBreak: 'break-word' }}>
                    {r.value || <span className="muted">(not set)</span>}
                    {bad ? <span className="badge badge-amber" style={{ marginLeft: 8 }}>not your domain</span> : null}
                  </td>
                </tr>
              );
            })}
            <tr>
              <td className="small" style={{ whiteSpace: 'nowrap' }}>
                Site domain
              </td>
              <td className="mono small">{siteDomain || <span className="muted">(NEXT_PUBLIC_BASE_URL not set)</span>}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {mismatched.length > 0 && (
        <div className="notice notice-warn small" style={{ marginBottom: 0 }}>
          <strong>A sender is not at your own domain.</strong> Mail providers judge the part inside
          the angle brackets, never the name in front of it — so a From that reads correctly can
          still be refused outright, or accepted and then filtered. Authenticating your domain does
          nothing for an address that is not at it. Point these at addresses on{' '}
          <strong>{siteDomain}</strong>.
        </div>
      )}
    </div>
  );
}
