import Link from 'next/link';
import CommunityNav from '@/components/community/CommunityNav';
import CommunitySettings from '@/components/community/CommunitySettings';
import Gate from '@/components/community/Gate';
import { cardFestivalInSeason } from '@/lib/greetingCards';
import { communityState, listBlocked } from '@/lib/community';
import { openHelpPostCount } from '@/lib/helpBoard';
import { communityUnread } from '@/lib/inbox';
import { upcomingMeetupCount } from '@/lib/meetups';
import { listTalent, myTalent } from '@/lib/talent';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Community — Nepalis in Germany, together',
  description:
    'Meetups near you, a help board for rooms, rides and papers, Nepali artists to book, festival cards — the Nepali community in Germany in one place. Free.',
  alternates: { canonical: '/community' },
};

/**
 * The community's front door: what is here, and — for a member — their own
 * corner (name, town, blocked people, leaving). Signed out, it is the pitch
 * and the way in.
 */
export default async function CommunityPage() {
  const state = await communityState();
  const meetups = upcomingMeetupCount();
  const posts = openHelpPostCount();
  const talent = listTalent().length;
  const season = cardFestivalInSeason();

  const doors = (
    <div className="ch-doors">
      <Link href="/bhetghat" className="ch-door ch-door-bg">
        <span className="ch-door-emoji" aria-hidden="true">
          👋
        </span>
        <span className="ch-door-text">
          <span lang="ne" className="ch-door-ne">
            भेटघाट
          </span>
          <strong>Meetups — swipe & go</strong>
          <span>Futsal, momo nights, hikes, festival get-togethers near you{meetups ? ` · ${meetups} coming up` : ''}.</span>
        </span>
      </Link>
      <Link href="/sahayog" className="ch-door ch-door-hb">
        <span className="ch-door-emoji" aria-hidden="true">
          🤝
        </span>
        <span className="ch-door-text">
          <span lang="ne" className="ch-door-ne">
            सहयोग
          </span>
          <strong>Help each other</strong>
          <span>Rooms, rides, luggage to Nepal, papers, jobs{posts ? ` · ${posts} open ${posts === 1 ? 'post' : 'posts'}` : ''}.</span>
        </span>
      </Link>
      <Link href="/kalakar" className="ch-door ch-door-kl">
        <span className="ch-door-emoji" aria-hidden="true">
          🎤
        </span>
        <span className="ch-door-text">
          <span lang="ne" className="ch-door-ne">
            कलाकार
          </span>
          <strong>Nepali talent</strong>
          <span>Singers, DJs, dancers, photographers, caterers, pandits{talent ? ` · ${talent} listed` : ''}.</span>
        </span>
      </Link>
      <Link href={season ? `/card?f=${season.slug}` : '/card'} className="ch-door ch-door-gc">
        <span className="ch-door-emoji" aria-hidden="true">
          {season?.slug === 'tihar' ? '🪔' : '🪁'}
        </span>
        <span className="ch-door-text">
          <span lang="ne" className="ch-door-ne">
            शुभकामना
          </span>
          <strong>{season ? `Make your ${season.name} card` : 'Festival cards'}</strong>
          <span>Your name and family photo on a greeting, ready for WhatsApp.</span>
        </span>
      </Link>
    </div>
  );

  if (state.kind !== 'member') {
    return (
      <>
        <CommunityNav active="home" />
        <section className="container ch-hero">
          <p className="feed-kicker">
            <span lang="ne">हाम्रो समाज</span> · Our community
          </p>
          <h1 className="page-title">Nepalis in Germany, together</h1>
          <p className="muted ch-lead">
            Far from home, closer to each other. Meet people near you, help and get help, find the artists for your next
            programme. Free, and only for members — no strangers, no search engines.
          </p>
        </section>
        <section className="container">{doors}</section>
        {state.kind !== 'banned' ? (
          <Gate
            state={state}
            back="/community"
            kicker="Join free"
            title="Become a member"
            intro={<p>One minute: the name other members see, your town, and the community rules.</p>}
          />
        ) : (
          <Gate state={state} back="/community" kicker="Community" title="Community access" intro={null} />
        )}
      </>
    );
  }

  const { member } = state;
  const profile = myTalent(member);
  const unread = communityUnread(member);
  return (
    <>
      <CommunityNav active="home" unread={unread} />
      <section className="container ch-hero">
        <p className="feed-kicker">
          <span lang="ne">हाम्रो समाज</span> · Our community
        </p>
        <h1 className="page-title">
          Namaste, <span translate="no">{member.name.split(/\s+/)[0]}</span>
        </h1>
        <p className="muted ch-lead">
          {unread > 0 ? (
            <>
              You have <Link href="/inbox">{unread} unread {unread === 1 ? 'message' : 'messages'}</Link>.
            </>
          ) : (
            'What would you like to do today?'
          )}
        </p>
      </section>
      <section className="container">{doors}</section>
      <section className="container container-narrow section">
        <div className="card">
          <h2 className="card-title">Your community profile</h2>
          <CommunitySettings
            name={member.name}
            city={member.city}
            blocked={listBlocked(member.id)}
            profileSlug={profile?.slug ?? null}
          />
        </div>
      </section>
    </>
  );
}
