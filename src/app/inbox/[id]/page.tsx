import Link from 'next/link';
import { notFound } from 'next/navigation';
import ChatThread from '@/components/community/ChatThread';
import CommunityNav from '@/components/community/CommunityNav';
import Gate from '@/components/community/Gate';
import ReportButton from '@/components/community/ReportButton';
import { communityState } from '@/lib/community';
import { getConversation } from '@/lib/conversations';
import { communityUnread } from '@/lib/inbox';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Conversation', robots: { index: false, follow: false } };

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const state = await communityState();
  if (state.kind !== 'member') {
    return <Gate state={state} back={`/inbox/${id}`} kicker="सन्देश · Inbox" title="Your messages" intro={<p>Sign in to read this conversation.</p>} />;
  }
  const { member } = state;
  const conv = getConversation(member, id);
  if (!conv) notFound();
  const closed = conv.blocked
    ? 'You or they blocked the other, so this conversation is closed.'
    : !conv.topicHref
      ? 'The post or profile this was about is gone, so the conversation is closed.'
      : undefined;

  return (
    <>
      <CommunityNav active="inbox" unread={communityUnread(member)} />
      <div className="container container-narrow section">
        <p className="mu-back">
          <Link href="/inbox">← Inbox</Link>
        </p>
        <header className="ib-head">
          <span className="mu-avatar" aria-hidden="true">
            {conv.otherName.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <h1 className="ib-name" translate="no">
              {conv.otherName}
            </h1>
            <p className="muted small">
              About {conv.topicType === 'help' ? 'the post' : 'the profile'}{' '}
              {conv.topicHref ? <Link href={conv.topicHref}>{conv.topicTitle}</Link> : conv.topicTitle}
              {conv.iAmOwner ? ' (yours)' : ''}
            </p>
          </div>
        </header>
        <section className="card">
          <ChatThread
            endpoint={`/api/community/conversations/${conv.id}/messages`}
            initial={conv.messages}
            reportType="message"
            group={false}
            closed={closed}
            empty={conv.iAmOwner ? 'No messages yet.' : `Say namaste and tell ${conv.otherName} how you can help — or what you need.`}
          />
          <p className="muted small mu-safety">
            🛡️ Share a phone number only once you trust someone. Never send money in advance, and never for a job.
          </p>
        </section>
        {conv.otherHandle && (
          <div className="mu-report">
            <ReportButton type="member" id={conv.otherHandle} handle={conv.otherHandle} label={`Report or block ${conv.otherName}`} />
          </div>
        )}
      </div>
    </>
  );
}
