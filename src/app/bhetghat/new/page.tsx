import Link from 'next/link';
import CommunityNav from '@/components/community/CommunityNav';
import Gate from '@/components/community/Gate';
import MeetupForm from '@/components/community/MeetupForm';
import { addDays, berlinNow, communityState } from '@/lib/community';
import { communityUnread } from '@/lib/inbox';
import { MEETUP_CATEGORIES, MEETUP_IDEAS, MEETUP_MAX_DAYS_AHEAD } from '@/lib/meetups';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Start a meetup', robots: { index: false, follow: false } };

export default async function NewMeetupPage() {
  const state = await communityState();
  if (state.kind !== 'member') {
    return (
      <Gate
        state={state}
        back="/bhetghat/new"
        kicker="भेटघाट · Bhetghat"
        title="Start a meetup"
        intro={<p>Futsal, momo, a hike, a festival get-together — put it up in a minute and people near you can swipe in.</p>}
      />
    );
  }
  const today = berlinNow().slice(0, 10);
  return (
    <>
      <CommunityNav active="bhetghat" unread={communityUnread(state.member)} />
      <div className="container container-narrow section">
        <p className="mu-back">
          <Link href="/bhetghat">← Bhetghat</Link>
        </p>
        <h1 className="page-title">Start a meetup</h1>
        <p className="muted">Small and free: a game, a meal, a walk, a festival together. People nearby will see it in their deck.</p>
        <MeetupForm
          categories={MEETUP_CATEGORIES}
          ideas={MEETUP_IDEAS}
          initial={{ title: '', about: '', category: 'food', city: state.member.city, place: '', date: addDays(today, 3), time: '18:00', capacity: 0, joinMode: 'open', minPeople: 0, costNote: '' }}
          minDate={today}
          maxDate={addDays(today, MEETUP_MAX_DAYS_AHEAD)}
        />
      </div>
    </>
  );
}
