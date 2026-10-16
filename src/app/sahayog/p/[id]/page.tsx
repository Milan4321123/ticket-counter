import Link from 'next/link';
import { notFound } from 'next/navigation';
import CommunityNav from '@/components/community/CommunityNav';
import Gate from '@/components/community/Gate';
import ReportButton from '@/components/community/ReportButton';
import { HelpPostControls, WriteButton } from '@/components/community/TopicActions';
import { berlinNow, communityState } from '@/lib/community';
import { conversationCountFor } from '@/lib/conversations';
import { agoLabel, dayLabel, getHelpPost, helpCategory } from '@/lib/helpBoard';
import { communityUnread } from '@/lib/inbox';

export const dynamic = 'force-dynamic';

// Members only — the link preview says so and nothing more.
export const metadata = {
  title: 'A post on Sahayog',
  description: 'Someone in the Nepali community is asking for — or offering — help. Join free to see it.',
  robots: { index: false, follow: false },
};

export default async function HelpPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const state = await communityState();
  if (state.kind !== 'member') {
    return (
      <Gate
        state={state}
        back={`/sahayog/p/${id}`}
        kicker="सहयोग · Sahayog"
        title="Someone shared a help post with you"
        intro={<p>Help posts are for community members only. Join free to see it and answer privately.</p>}
      />
    );
  }
  const { member } = state;
  const post = getHelpPost(member, id);
  if (!post) notFound();
  const cat = helpCategory(post.category);
  const today = berlinNow().slice(0, 10);
  const offBoard = post.status !== 'open' || post.expiresOn < today;
  const writers = post.mine ? conversationCountFor('help', post.id) : 0;

  return (
    <>
      <CommunityNav active="sahayog" unread={communityUnread(member)} />
      <div className="container container-narrow section">
        <p className="mu-back">
          <Link href="/sahayog">← Sahayog</Link>
        </p>
        <article className="card hb-full">
          <p className="hb-tags">
            <span className={`hb-kind hb-kind-${post.kind}`}>{post.kind === 'ask' ? 'Asking for help' : 'Offering help'}</span>
            <span className="muted small">
              {cat.emoji} {cat.label}
            </span>
          </p>
          <h1 className="page-title hb-full-title">{post.title}</h1>
          <p className="muted">
            📍 {post.city}
            {post.whenDate ? ` · 📅 ${dayLabel(post.whenDate)}` : ''} · posted {agoLabel(post.createdAt)} by{' '}
            <span translate="no">{post.authorName}</span>
            {post.mine ? ' (you)' : ''}
          </p>
          {post.body && <p className="mu-text hb-body">{post.body}</p>}
          {post.status === 'removed' && <p className="notice notice-error">Taken down: {post.statusNote || 'it broke the community rules'}.</p>}
          {post.status === 'closed' && <p className="notice">{post.mine ? 'You closed this post.' : 'This post is closed — it was solved.'}</p>}
          {post.status === 'open' && post.expiresOn < today && <p className="notice">This post has left the board — its date has passed.</p>}
          <p className="hb-tip">🛡️ {cat.tip}</p>

          {post.mine ? (
            <>
              <p className="muted">
                {writers === 0 ? 'Nobody has written to you yet.' : `${writers} ${writers === 1 ? 'person has' : 'people have'} written to you — `}
                {writers > 0 && <Link href="/inbox">open your inbox</Link>}
              </p>
              <HelpPostControls id={post.id} status={post.status} canReopen={!post.whenDate || post.whenDate >= today} />
            </>
          ) : offBoard ? null : (
            <div className="hb-write">
              <WriteButton topic="help" topicId={post.id} label={post.kind === 'ask' ? 'I can help — write privately' : 'Yes please — write privately'} />
              <p className="muted small">Only {post.authorName} sees what you write.</p>
            </div>
          )}
        </article>
        {!post.mine && (
          <div className="mu-report">
            <ReportButton type="help_post" id={post.id} handle={post.authorHandle} label="Report this post" />
          </div>
        )}
      </div>
    </>
  );
}
