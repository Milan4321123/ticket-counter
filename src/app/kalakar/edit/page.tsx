import Link from 'next/link';
import CommunityNav from '@/components/community/CommunityNav';
import Gate from '@/components/community/Gate';
import TalentForm from '@/components/community/TalentForm';
import { communityState } from '@/lib/community';
import { communityUnread } from '@/lib/inbox';
import { myTalent, TALENT_KINDS } from '@/lib/talent';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Your Kalakar profile', robots: { index: false, follow: false } };

export default async function EditTalentPage() {
  const state = await communityState();
  if (state.kind !== 'member') {
    return (
      <Gate
        state={state}
        back="/kalakar/edit"
        kicker="कलाकार · Kalakar"
        title="List yourself — free"
        intro={<p>Singers, DJs, dancers, photographers, caterers, pandits: put yourself where organizers and families look for you.</p>}
      />
    );
  }
  const mine = myTalent(state.member);
  return (
    <>
      <CommunityNav active="kalakar" unread={communityUnread(state.member)} />
      <div className="container container-narrow section">
        <p className="mu-back">
          <Link href="/kalakar">← Kalakar</Link>
          {mine && (
            <>
              {' · '}
              <Link href={`/kalakar/${mine.slug}`}>See your profile</Link>
            </>
          )}
        </p>
        <h1 className="page-title">{mine ? 'Your profile' : 'Create your profile'}</h1>
        <TalentForm
          kinds={TALENT_KINDS}
          initial={{
            name: mine?.name ?? '',
            kind: mine?.kind ?? '',
            city: mine?.city ?? state.member.city,
            areas: mine?.areas ?? '',
            bio: mine?.bio ?? '',
            links: mine?.links.map((l) => l.url) ?? [],
            videoUrl: mine?.videoUrl ?? '',
            photoUrl: mine?.photoUrl ?? null,
            status: mine?.status ?? null,
            slug: mine?.slug ?? null,
          }}
        />
      </div>
    </>
  );
}
