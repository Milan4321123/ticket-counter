import Link from 'next/link';
import CommunityNav from '@/components/community/CommunityNav';
import SwipeDeck, { type DeckCard } from '@/components/community/SwipeDeck';
import { cityName } from '@/lib/cities';
import { berlinNow, communityState, whenLabel } from '@/lib/community';
import { listPublishedEvents } from '@/lib/events';
import { readListingName } from '@/lib/exampleShop';
import { loadFeedSnapshot } from '@/lib/feedSnapshot';
import { communityUnread } from '@/lib/inbox';
import { listingStillUrl } from '@/lib/listing';
import { listUpcomingMeetups, meetupCategory, upcomingMeetupCount } from '@/lib/meetups';
import { formatMoney } from '@/lib/money';
import { fromPriceCents } from '@/lib/ticketState';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Bhetghat — swipe, meet, belong',
  description:
    'Swipe through Nepali events and small meetups near you — futsal, momo nights, hikes, festival get-togethers. Swipe right and you are in. Free.',
  alternates: { canonical: '/bhetghat' },
};

/** 'YYYY-MM-DD' (+ optional time) → a sortable 'YYYY-MM-DDTHH:MM'. */
function sortKey(date: string, time = '12:00'): string {
  return `${date.slice(0, 10)}T${time}`;
}

export default async function BhetghatPage() {
  const state = await communityState();
  const member = state.kind === 'member' ? state.member : null;
  const today = berlinNow().slice(0, 10);

  // Events: published, not a shop, on or after today. The same rows the
  // homepage shows, read in three statements (lib/feedSnapshot).
  const events = listPublishedEvents().filter((e) => e.kind !== 'shop' && e.eventDate && e.eventDate.slice(0, 10) >= today);
  const snapshot = loadFeedSnapshot(events);
  const eventCards: DeckCard[] = events.map((e) => {
    const tiers = snapshot.tiers.get(e.id) ?? [];
    const from = fromPriceCents(tiers, snapshot.availability.get(e.id));
    const date = e.eventDate!.slice(0, 10);
    const time = /^\d{2}:\d{2}$/.test(e.showTime ?? '') ? e.showTime : '';
    return {
      kind: 'event',
      key: `e:${e.id}`,
      id: e.id,
      title: readListingName(e.name).name,
      when: whenLabel(time ? `${date}T${time}` : date),
      sortAt: sortKey(date, time || '20:00'),
      city: cityName(e.city),
      place: e.venueName,
      image: listingStillUrl(e, snapshot.photos.get(e.id)),
      href: `/e/${e.slug}`,
      price: from !== null && from > 0 ? formatMoney(from, e.currency) : from === 0 ? 'free' : null,
    };
  });

  const meetupCards: DeckCard[] = member
    ? listUpcomingMeetups(member)
        .filter((m) => !m.joined && !m.isHost && !m.requested)
        .map((m) => {
          const cat = meetupCategory(m.category);
          return {
            kind: 'meetup',
            key: `m:${m.id}`,
            id: m.id,
            title: m.title,
            when: whenLabel(m.startsAt),
            sortAt: m.startsAt,
            city: m.city,
            place: m.place,
            emoji: cat.emoji,
            category: cat.key,
            about: m.about,
            going: m.going,
            capacity: m.capacity,
            host: m.hostName,
            href: `/bhetghat/m/${m.id}`,
            ask: m.joinMode === 'ask',
            minPeople: m.minPeople,
            costNote: m.costNote,
          };
        })
    : [];

  const cards = [...eventCards, ...meetupCards].sort((a, b) => a.sortAt.localeCompare(b.sortAt));
  // Not a member yet: the third card says what they are missing — a count,
  // never a title, a place or a name.
  if (!member && state.kind !== 'banned') {
    const teaser: DeckCard = { kind: 'teaser', key: 'teaser', count: upcomingMeetupCount(), signedIn: state.kind !== 'signed-out', sortAt: '', city: '' };
    cards.splice(Math.min(2, cards.length), 0, teaser);
  }

  return (
    <>
      <CommunityNav active="bhetghat" unread={member ? communityUnread(member) : 0} />
      <section className="container bg-head">
        <p className="feed-kicker">
          <span lang="ne">भेटघाट</span> · Bhetghat
        </p>
        <h1 className="page-title">Swipe. Meet. Belong.</h1>
        <p className="muted">
          Nepali events and small meetups near you. Swipe right and you&rsquo;re in — left to skip.
        </p>
        <div className="cm-row bg-tabs">
          <Link href="/bhetghat/plans" className="btn btn-sm">
            My plans
          </Link>
          <Link href="/bhetghat/whats-on" className="btn btn-sm">
            What&rsquo;s on — list
          </Link>
          <Link href={member ? '/bhetghat/new' : '/community'} className="btn btn-sm btn-brand">
            + Start a meetup
          </Link>
        </div>
      </section>
      <section className="container bg-section">
        <SwipeDeck cards={cards} homeCity={member?.city ?? ''} isMember={Boolean(member)} />
      </section>
    </>
  );
}
