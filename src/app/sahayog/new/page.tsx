import Link from 'next/link';
import CommunityNav from '@/components/community/CommunityNav';
import Gate from '@/components/community/Gate';
import HelpForm from '@/components/community/HelpForm';
import { addDays, berlinNow, communityState } from '@/lib/community';
import { HELP_CATEGORIES } from '@/lib/helpBoard';
import { communityUnread } from '@/lib/inbox';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Put up a help post', robots: { index: false, follow: false } };

export default async function NewHelpPostPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const { kind } = await searchParams;
  const state = await communityState();
  if (state.kind !== 'member') {
    return (
      <Gate
        state={state}
        back="/sahayog/new"
        kicker="सहयोग · Sahayog"
        title="Ask for help, or offer it"
        intro={<p>Rooms, rides, luggage to Nepal, papers, jobs. Members answer you privately.</p>}
      />
    );
  }
  const today = berlinNow().slice(0, 10);
  return (
    <>
      <CommunityNav active="sahayog" unread={communityUnread(state.member)} />
      <div className="container container-narrow section">
        <p className="mu-back">
          <Link href="/sahayog">← Sahayog</Link>
        </p>
        <h1 className="page-title">{kind === 'offer' ? 'Offer a hand' : 'Ask for help'}</h1>
        <HelpForm
          categories={HELP_CATEGORIES}
          initialKind={kind === 'offer' ? 'offer' : 'ask'}
          initialCity={state.member.city}
          minDate={today}
          maxDate={addDays(today, 365)}
        />
      </div>
    </>
  );
}
