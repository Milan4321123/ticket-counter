import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isAdminRequest } from '@/lib/auth';
import { communityCounts, listReportGroups, REPORT_REASONS } from '@/lib/community';
import { listAllTalentForAdmin, talentKind } from '@/lib/talent';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Community — Admin', robots: { index: false, follow: false } };

const NOTES: Record<string, string> = {
  dismiss: 'Dismissed — nothing wrong. Anything that was held after reports is back up.',
  remove: 'Taken down. The author sees that it was removed.',
  restore: 'Put back up.',
  ban: 'The author is out of the community: everything they had up is down, and they cannot post again.',
  verified: 'Profile updated.',
  unbanned: 'Ban lifted. Their old posts stay down; they can post again.',
  nothing: 'Nothing changed — it may already have been handled.',
  bad: 'That request did not make sense.',
};

const TYPE_LABEL: Record<string, string> = {
  meetup: 'Meetup',
  meetup_message: 'Meetup chat message',
  help_post: 'Help post',
  message: 'Private message',
  talent: 'Kalakar profile',
  member: 'Member',
};

/**
 * Moderation for the community: open reports grouped by what was reported
 * (most-reported first), with the thing itself shown so a decision is made on
 * the words, not on the count; and every Kalakar profile, with the one control
 * the platform has over them — "verified".
 */
export default async function AdminCommunityPage({ searchParams }: { searchParams: Promise<{ note?: string }> }) {
  if (!(await isAdminRequest())) redirect('/admin/login');
  const { note } = await searchParams;
  const counts = communityCounts();
  const groups = listReportGroups();
  const profiles = listAllTalentForAdmin();

  return (
    <div className="container section">
      <p className="mu-back">
        <Link href="/admin">← Admin</Link>
      </p>
      <h1 className="page-title">Community</h1>
      <p className="muted">
        {counts.members} members · {counts.meetups} open meetups · {counts.helpPosts} help posts · {counts.profiles} Kalakar profiles ·{' '}
        <strong>{counts.openReports} open reports</strong>
      </p>
      {note && NOTES[note] && <p className="notice notice-success">{NOTES[note]}</p>}

      <h2 className="cs-h">Reports</h2>
      {groups.length === 0 ? (
        <p className="muted">Nothing reported. 🙏</p>
      ) : (
        <div className="am-list">
          {groups.map((g) => (
            <article key={`${g.targetType}:${g.targetId}`} className="card am-item">
              <p className="hb-tags">
                <span className="hb-kind hb-kind-ask">
                  {g.count} {g.count === 1 ? 'report' : 'reports'}
                </span>
                <span className="muted small">
                  {TYPE_LABEL[g.targetType]} · {g.preview.state} · by {g.preview.author || '—'}
                </span>
              </p>
              <h3 className="am-title">
                {g.preview.link ? <Link href={g.preview.link}>{g.preview.title}</Link> : g.preview.title}
              </h3>
              {g.preview.body && <p className="mu-text am-body">{g.preview.body}</p>}
              <ul className="am-reasons">
                {g.reasons.map((r, i) => (
                  <li key={i}>
                    <strong>{REPORT_REASONS[r.reason] ?? r.reason}</strong>
                    {r.note ? ` — “${r.note}”` : ''} <span className="muted small">{r.createdAt.slice(0, 16)}</span>
                  </li>
                ))}
              </ul>
              <div className="cm-row">
                {(['dismiss', 'remove', 'ban'] as const).map((action) => (
                  <form key={action} method="post" action="/api/admin/community">
                    <input type="hidden" name="op" value="moderate" />
                    <input type="hidden" name="type" value={g.targetType} />
                    <input type="hidden" name="id" value={g.targetId} />
                    <input type="hidden" name="action" value={action} />
                    <button className={`btn btn-sm${action === 'ban' ? ' mu-danger' : ''}`}>
                      {action === 'dismiss' ? 'Nothing wrong' : action === 'remove' ? 'Take it down' : 'Ban the author'}
                    </button>
                  </form>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}

      <h2 className="cs-h">Kalakar profiles</h2>
      {profiles.length === 0 ? (
        <p className="muted">No profiles yet.</p>
      ) : (
        <ul className="pl-list">
          {profiles.map((p) => (
            <li key={p.id} className="pl-item">
              <span className="pl-main">
                <Link href={`/kalakar/${p.slug}`} className="pl-title">
                  {p.name} {p.verified ? '✓' : ''}
                </Link>
                <span className="muted small">
                  {talentKind(p.kind).label} · {p.city} · {p.status} · member “{p.ownerName}”
                </span>
              </span>
              <form method="post" action="/api/admin/community" className="pl-side">
                <input type="hidden" name="op" value="verify" />
                <input type="hidden" name="id" value={p.id} />
                <input type="hidden" name="on" value={p.verified ? '0' : '1'} />
                <button className="btn btn-sm">{p.verified ? 'Unverify' : 'Mark verified'}</button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
