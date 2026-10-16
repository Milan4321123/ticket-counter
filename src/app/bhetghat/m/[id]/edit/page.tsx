import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import CommunityNav from '@/components/community/CommunityNav';
import MeetupForm from '@/components/community/MeetupForm';
import { addDays, berlinNow, communityState } from '@/lib/community';
import { communityUnread } from '@/lib/inbox';
import { MEETUP_CATEGORIES, MEETUP_IDEAS, MEETUP_MAX_DAYS_AHEAD, meetupForEdit } from '@/lib/meetups';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Edit meetup', robots: { index: false, follow: false } };

export default async function EditMeetupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const state = await communityState();
  if (state.kind !== 'member') redirect(`/bhetghat/m/${id}`);
  const initial = meetupForEdit(state.member, id);
  if (!initial) notFound();
  const today = berlinNow().slice(0, 10);
  return (
    <>
      <CommunityNav active="bhetghat" unread={communityUnread(state.member)} />
      <div className="container container-narrow section">
        <p className="mu-back">
          <Link href={`/bhetghat/m/${id}`}>← Back to the meetup</Link>
        </p>
        <h1 className="page-title">Edit meetup</h1>
        <p className="muted">Everyone going sees the change on the meetup page — say what changed in the group chat too.</p>
        <MeetupForm
          categories={MEETUP_CATEGORIES}
          ideas={MEETUP_IDEAS}
          initial={initial}
          minDate={today}
          maxDate={addDays(today, MEETUP_MAX_DAYS_AHEAD)}
        />
      </div>
    </>
  );
}
