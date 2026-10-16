// The community (lib/community, meetups, helpBoard, conversations, talent,
// communityData): who may join, who may see and do what, and that a person's
// community data really goes when they do.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cityKey, cityName, citySlug } from '../src/lib/cities.ts';
import {
  addDays,
  berlinNow,
  blockMember,
  getMember,
  joinCommunity,
  moderate,
  reportContent,
  type Member,
} from '../src/lib/community.ts';
import { communityExport, runCommunityRetention } from '../src/lib/communityData.ts';
import {
  getConversation,
  listConversations,
  sendConversationMessage,
  startConversation,
  unreadConversations,
} from '../src/lib/conversations.ts';
import { deleteCustomer, upsertCustomer } from '../src/lib/customers.ts';
import { getDb } from '../src/lib/db.ts';
import { cardFestivals } from '../src/lib/greetingCards.ts';
import { createHelpPost, getHelpPost, listHelpPosts, setHelpPostOpen } from '../src/lib/helpBoard.ts';
import {
  approveRequest,
  cancelMeetup,
  createMeetup,
  getMeetupForMember,
  joinMeetup,
  leaveMeetup,
  listMeetupMessages,
  listUpcomingMeetups,
  postMeetupMessage,
  removeFromMeetup,
} from '../src/lib/meetups.ts';
import { checkLinks, saveTalent, talentBySlug } from '../src/lib/talent.ts';

let n = 0;
/** A fresh member in the given town. */
function member(name = 'Sita S.', city = 'Darmstadt'): Member {
  n += 1;
  const c = upsertCustomer(`member${n}@example.de`, { name });
  const r = joinCommunity(c.id, { name, city, age: true, rules: true });
  assert.ok(r.ok, 'joined');
  return r.member;
}

function meetupInput(extra: Record<string, unknown> = {}) {
  return {
    title: 'Sunday futsal',
    about: 'All levels',
    category: 'sports',
    city: 'Darmstadt',
    place: 'Herrngarten',
    date: addDays(berlinNow(), 3),
    time: '18:00',
    capacity: 0,
    ...extra,
  };
}

describe('joining the community', () => {
  it('needs both ticks, a real name and a town', () => {
    const c = upsertCustomer('joiner@example.de', { name: 'Joiner' });
    assert.equal(joinCommunity(c.id, { name: 'Ram', city: 'Berlin', age: false, rules: true }).ok, false);
    assert.equal(joinCommunity(c.id, { name: 'Ram', city: 'Berlin', age: true, rules: 'yes' }).ok, false, 'rules must be literally true');
    assert.equal(joinCommunity(c.id, { name: 'ram@example.de', city: 'Berlin', age: true, rules: true }).ok, false, 'no emails as names');
    assert.equal(joinCommunity(c.id, { name: 'Ram', city: '', age: true, rules: true }).ok, false);
    assert.equal(getMember(c.id), null, 'nothing saved by a refused join');
    const ok = joinCommunity(c.id, { name: 'Ram K.', city: 'munich', age: true, rules: true });
    assert.ok(ok.ok);
    assert.match(ok.member.handle, /^[a-z0-9]{8}$/);
    assert.equal(ok.member.city, 'München', 'town names are folded to one spelling');
  });
});

describe('cities', () => {
  it('folds the ways one town is written', () => {
    assert.equal(cityKey('Frankfurt am Main'), cityKey('frankfurt'));
    assert.equal(cityKey('60311 Frankfurt'), 'frankfurt');
    assert.equal(cityKey('München'), cityKey('Muenchen'));
    assert.equal(cityKey('Munich'), cityKey('München'));
    assert.equal(cityName('koeln'), 'Köln');
    assert.equal(citySlug('Freiburg im Breisgau'), 'freiburg');
    assert.equal(cityName('Halle (Saale)'), 'Halle');
  });
});

describe('meetups', () => {
  it('refuses a meetup in the past', () => {
    const host = member();
    const r = createMeetup(host, meetupInput({ date: addDays(berlinNow(), -1) }));
    assert.equal(r.ok, false);
  });

  it('host is going; a full meetup refuses the next person', () => {
    const host = member();
    const r = createMeetup(host, meetupInput({ capacity: 2 }));
    assert.ok(r.ok);
    const id = (r as { id: string }).id;
    const a = member('Asha');
    const b = member('Bina');
    assert.equal(joinMeetup(a, id), 'ok');
    assert.equal(joinMeetup(a, id), 'already');
    assert.equal(joinMeetup(b, id), 'full');
    assert.equal(leaveMeetup(host, id), false, 'the host cancels, never leaves');
    assert.equal(leaveMeetup(a, id), true);
    assert.equal(joinMeetup(b, id), 'ok', 'a freed spot can be taken');
  });

  it('a person the host took off cannot come back', () => {
    const host = member();
    const id = (createMeetup(host, meetupInput()) as { id: string }).id;
    const guest = member('Guest');
    joinMeetup(guest, id);
    assert.equal(removeFromMeetup(host, id, guest.handle), true);
    assert.equal(joinMeetup(guest, id), 'removed');
    assert.equal(listUpcomingMeetups(guest).some((m) => m.id === id), false, 'and it leaves their deck');
  });

  it('blocks hide meetups both ways and stop joining', () => {
    const host = member();
    const id = (createMeetup(host, meetupInput()) as { id: string }).id;
    const other = member('Other');
    assert.ok(listUpcomingMeetups(other).some((m) => m.id === id));
    assert.ok(blockMember(host.id, other.handle));
    assert.equal(listUpcomingMeetups(other).some((m) => m.id === id), false);
    assert.equal(joinMeetup(other, id), 'blocked');
    assert.equal(getMeetupForMember(other, id), null);
  });

  it('only people going can read or write the chat; a cancelled one closes', () => {
    const host = member();
    const id = (createMeetup(host, meetupInput()) as { id: string }).id;
    const outsider = member('Outsider');
    assert.equal(listMeetupMessages(outsider, id), null);
    assert.equal(postMeetupMessage(outsider, id, 'hi').ok, false);
    assert.ok(postMeetupMessage(host, id, 'Namaste!').ok);
    joinMeetup(outsider, id);
    assert.deepEqual(listMeetupMessages(outsider, id)?.map((m) => m.body), ['Namaste!']);
    assert.ok(cancelMeetup(host, id));
    assert.equal(postMeetupMessage(outsider, id, 'still on?').ok, false);
  });
});

describe('invitations: ask to join and private', () => {
  it('ask-to-join: a request until the host says yes, and no guest list before', () => {
    const host = member('Host');
    const id = (createMeetup(host, meetupInput({ joinMode: 'ask', title: 'Karaoke night', category: 'nightout', minPeople: 4 })) as { id: string }).id;
    const guest = member('Guest');
    assert.equal(joinMeetup(guest, id), 'requested');
    assert.equal(joinMeetup(guest, id), 'pending');
    const seen = getMeetupForMember(guest, id)!;
    assert.equal(seen.requested, true);
    assert.deepEqual(seen.people, [], 'who is going stays hidden until you are in');
    assert.equal(seen.going, 1);
    assert.equal(listMeetupMessages(guest, id), null, 'no chat while waiting');
    assert.equal(getMeetupForMember(host, id)!.requests.length, 1);
    assert.equal(approveRequest(host, id, guest.handle), 'ok');
    const after = getMeetupForMember(guest, id)!;
    assert.equal(after.joined, true);
    assert.equal(after.people.length, 2);
    assert.equal(after.minPeople, 4);
  });

  it('a "no" cannot be re-sent', () => {
    const host = member('Host2');
    const id = (createMeetup(host, meetupInput({ joinMode: 'ask' })) as { id: string }).id;
    const guest = member('Guest2');
    joinMeetup(guest, id);
    assert.ok(removeFromMeetup(host, id, guest.handle));
    assert.equal(joinMeetup(guest, id), 'removed');
  });

  it('private: invisible without the link, the link lets you in', () => {
    const host = member('Party host');
    const id = (createMeetup(host, meetupInput({ joinMode: 'private', title: 'Laser tag', category: 'nightout' })) as { id: string }).id;
    const friend = member('Friend');
    assert.equal(listUpcomingMeetups(friend).some((m) => m.id === id), false, 'never in the deck');
    assert.equal(getMeetupForMember(friend, id), null);
    assert.equal(joinMeetup(friend, id), 'not-found');
    assert.equal(joinMeetup(friend, id, 'wrong-code-xyz'), 'not-found');
    const code = getMeetupForMember(host, id)!.inviteCode!;
    assert.ok(getMeetupForMember(friend, id, code));
    assert.equal(joinMeetup(friend, id, code), 'ok');
    assert.ok(getMeetupForMember(friend, id), 'once in, no code needed');
    assert.equal(getMeetupForMember(friend, id)!.inviteCode, null, 'only the host hands out a private link');
  });
});

describe('reports and moderation', () => {
  it('three reports hold a meetup; dismissing puts it back', () => {
    const host = member();
    const id = (createMeetup(host, meetupInput()) as { id: string }).id;
    assert.equal(reportContent(host.id, 'meetup', id, 'spam', '').ok, false, 'not your own');
    for (let i = 0; i < 2; i++) assert.deepEqual(reportContent(member().id, 'meetup', id, 'spam', ''), { ok: true, held: false });
    assert.deepEqual(reportContent(member().id, 'meetup', id, 'scam', 'asks for money'), { ok: true, held: true });
    const viewer = member('Viewer');
    assert.equal(listUpcomingMeetups(viewer).some((m) => m.id === id), false, 'held = off the deck');
    assert.ok(moderate('meetup', id, 'dismiss'));
    assert.ok(listUpcomingMeetups(viewer).some((m) => m.id === id), 'back up after review');
  });

  it('a ban takes the author out and everything they had up down', () => {
    const bad = member('Spammer');
    const id = (createMeetup(bad, meetupInput()) as { id: string }).id;
    const post = createHelpPost(bad, { kind: 'offer', category: 'jobs', city: 'Berlin', title: 'Easy money job, pay fee first' });
    assert.ok(post.ok);
    reportContent(member().id, 'meetup', id, 'scam', '');
    assert.ok(moderate('meetup', id, 'ban'));
    assert.equal(getMember(bad.id), null, 'no longer a member');
    const viewer = member('Viewer2');
    assert.equal(getHelpPost(viewer, (post as { id: string }).id), null);
    assert.equal(joinCommunity(bad.id, { name: 'New name', city: 'Berlin', age: true, rules: true }).ok, false, 'cannot rejoin');
  });
});

describe('help board and conversations', () => {
  it('a ride needs its day and leaves the board after it', () => {
    const a = member('Driver', 'Mannheim');
    assert.equal(createHelpPost(a, { kind: 'offer', category: 'rides', city: 'Mannheim', title: 'Mannheim → Frankfurt' }).ok, false);
    const r = createHelpPost(a, { kind: 'offer', category: 'rides', city: 'Mannheim', title: 'Mannheim → Frankfurt', whenDate: addDays(berlinNow(), 2) });
    assert.ok(r.ok);
    const id = (r as { id: string }).id;
    const row = getDb().prepare(`SELECT expires_on FROM help_posts WHERE id = ?`).get(id) as { expires_on: string };
    assert.equal(row.expires_on, addDays(berlinNow(), 3));
    const reader = member('Reader', 'Frankfurt');
    assert.ok(listHelpPosts(reader, { category: 'rides' }).some((p) => p.id === id));
    assert.ok(setHelpPostOpen(a, id, false));
    assert.equal(listHelpPosts(reader, {}).some((p) => p.id === id), false, 'closed = off the board');
  });

  it('answers are private, one thread per person, and count as unread', () => {
    const owner = member('Owner');
    const id = (createHelpPost(owner, { kind: 'ask', category: 'room', city: 'Darmstadt', title: 'Room from December' }) as { id: string }).id;
    assert.equal(startConversation(owner, 'help', id).ok, false, 'not with yourself');
    const helper = member('Helper');
    const c1 = startConversation(helper, 'help', id);
    const c2 = startConversation(helper, 'help', id);
    assert.ok(c1.ok && c2.ok);
    assert.equal((c1 as { id: string }).id, (c2 as { id: string }).id);
    const conv = (c1 as { id: string }).id;
    assert.ok(sendConversationMessage(helper, conv, 'I have a room in Bessungen').ok);
    assert.equal(unreadConversations(owner), 1);
    const stranger = member('Stranger');
    assert.equal(getConversation(stranger, conv), null, 'a third person sees nothing');
    assert.equal(getConversation(owner, conv)?.messages.length, 1);
    assert.equal(unreadConversations(owner), 0, 'reading marks it read');
    assert.equal(listConversations(owner).length, 1);
    blockMember(owner.id, helper.handle);
    assert.equal(sendConversationMessage(helper, conv, 'hello?').ok, false, 'a block closes the thread');
  });
});

describe('kalakar profiles', () => {
  it('checks links and video, and keeps the URL when the name changes', () => {
    assert.deepEqual(checkLinks(['instagram.com/sugam', 'https://example.com']), [
      { label: 'Instagram', url: 'https://instagram.com/sugam' },
      { label: 'Website', url: 'https://example.com/' },
    ]);
    assert.ok('error' in (checkLinks(['javascript:alert(1)']) as object));
    const m = member('Artist');
    const bio = 'Lok and modern songs with a live band, weddings and cultural nights.';
    assert.equal(saveTalent(m, { name: 'Sunita', kind: 'singer', city: 'Berlin', bio, videoUrl: 'https://evil.example/x.mp4' }).ok, false);
    const r = saveTalent(m, { name: 'Sunita Gurung', kind: 'singer', city: 'Berlin', bio, links: ['instagram.com/sunita'] });
    assert.ok(r.ok);
    const slug = (r as { slug: string }).slug;
    assert.equal(slug, 'sunita-gurung');
    const again = saveTalent(m, { name: 'Sunita G. Live', kind: 'singer', city: 'Berlin', bio });
    assert.equal((again as { slug: string }).slug, slug);
    assert.equal(talentBySlug(slug, null)?.name, 'Sunita G. Live', 'public');
    const other = member('Other artist');
    const second = saveTalent(other, { name: 'Sunita Gurung', kind: 'dancer', city: 'Hamburg', bio });
    assert.equal((second as { slug: string }).slug, 'sunita-gurung-2');
  });
});

describe('erasure and retention', () => {
  it('deleting the account deletes every community row of it', () => {
    const m = member('Leaver');
    const meetup = (createMeetup(m, meetupInput()) as { id: string }).id;
    postMeetupMessage(m, meetup, 'bye');
    const post = (createHelpPost(m, { kind: 'ask', category: 'papers', city: 'Berlin', title: 'Anmeldung help?' }) as { id: string }).id;
    const other = member('Stays');
    const conv = (startConversation(other, 'help', post) as { id: string }).id;
    sendConversationMessage(other, conv, 'I can help');
    saveTalent(m, { name: 'Leaver Band', kind: 'band', city: 'Berlin', bio: 'A band that plays at weddings and festivals.' });
    blockMember(other.id, m.handle);
    assert.ok(Object.keys(communityExport(getDb(), m.id).helpPosts).length > 0);
    assert.ok(deleteCustomer(m.id));
    const db = getDb();
    const count = (sql: string, ...args: string[]) => (db.prepare(sql).get(...args) as { n: number }).n;
    assert.equal(count(`SELECT COUNT(*) AS n FROM meetups WHERE host_id = ?`, m.id), 0);
    assert.equal(count(`SELECT COUNT(*) AS n FROM meetup_messages WHERE meetup_id = ?`, meetup), 0);
    assert.equal(count(`SELECT COUNT(*) AS n FROM help_posts WHERE author_id = ?`, m.id), 0);
    assert.equal(count(`SELECT COUNT(*) AS n FROM conversations WHERE id = ?`, conv), 0);
    assert.equal(count(`SELECT COUNT(*) AS n FROM conversation_messages WHERE conversation_id = ?`, conv), 0);
    assert.equal(count(`SELECT COUNT(*) AS n FROM talent_profiles WHERE owner_id = ?`, m.id), 0);
    assert.equal(count(`SELECT COUNT(*) AS n FROM community_blocks WHERE blocked_id = ?`, m.id), 0);
  });

  it('the sweep removes old meetups and the rows of accounts deleted by plain SQL', () => {
    const m = member('Old host');
    const id = (createMeetup(m, meetupInput()) as { id: string }).id;
    const db = getDb();
    db.prepare(`UPDATE meetups SET starts_at = ? WHERE id = ?`).run(`${addDays(berlinNow(), -40)}T18:00`, id);
    const ghost = member('Ghost');
    createHelpPost(ghost, { kind: 'ask', category: 'other', city: 'Berlin', title: 'A question for everyone' });
    db.prepare(`DELETE FROM customers WHERE id = ?`).run(ghost.id);
    const r = runCommunityRetention(db, { meetupDays: 30, helpPostDays: 30, conversationDays: 365, reportDays: 180 });
    assert.ok(r.meetups >= 1);
    assert.ok(r.orphans >= 1);
    assert.equal((db.prepare(`SELECT COUNT(*) AS n FROM meetups WHERE id = ?`).get(id) as { n: number }).n, 0);
    assert.equal((db.prepare(`SELECT COUNT(*) AS n FROM help_posts WHERE author_id = ?`).get(ghost.id) as { n: number }).n, 0);
  });
});

describe('festival cards', () => {
  it('offers what is on now first, and Dashain with its own looks', () => {
    const list = cardFestivals(new Date('2026-10-15T12:00:00Z'));
    assert.equal(list[0].slug, 'dashain');
    assert.deepEqual(list[0].looks.map((l) => l.id), ['kites', 'tika', 'classic']);
    assert.ok(list[0].wishes.some((w) => w.ne.includes('२०८३')), 'the BS year in Devanagari');
    const tihar = list.find((f) => f.slug === 'tihar');
    assert.ok(tihar?.looks.some((l) => l.id === 'bhaitika'));
  });
});
