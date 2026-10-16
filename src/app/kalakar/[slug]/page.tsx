import Link from 'next/link';
import { notFound } from 'next/navigation';
import CommunityNav from '@/components/community/CommunityNav';
import ReportButton from '@/components/community/ReportButton';
import { WriteButton } from '@/components/community/TopicActions';
import VideoFacade from '@/components/community/VideoFacade';
import { berlinNow, communityState } from '@/lib/community';
import { videoEmbedUrl } from '@/lib/events';
import { communityUnread } from '@/lib/inbox';
import { readListingName } from '@/lib/exampleShop';
import { talentBySlug, talentKind, upcomingShowsFor } from '@/lib/talent';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = talentBySlug(slug, null);
  if (!p) return { title: 'Profile not found', robots: { index: false, follow: false } };
  const k = talentKind(p.kind);
  const title = `${p.name} — ${k.label} in ${p.city}`;
  const description = p.bio.slice(0, 160);
  return {
    title,
    description,
    alternates: { canonical: `/kalakar/${p.slug}` },
    openGraph: { type: 'profile', title, description, url: `/kalakar/${p.slug}`, ...(p.photoUrl ? { images: [{ url: p.photoUrl }] } : {}) },
  };
}

export default async function TalentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const state = await communityState();
  const member = state.kind === 'member' ? state.member : null;
  const p = talentBySlug(slug, member?.id ?? null);
  if (!p) notFound();
  const k = talentKind(p.kind);
  const video = p.videoUrl ? videoEmbedUrl(p.videoUrl) : null;
  const shows = upcomingShowsFor(p, berlinNow().slice(0, 10));

  return (
    <>
      <CommunityNav active="kalakar" unread={member ? communityUnread(member) : 0} />
      <div className="container container-narrow section kl-page">
        <p className="mu-back">
          <Link href="/kalakar">← Kalakar</Link>
        </p>
        {p.mine && p.status !== 'live' && (
          <p className="notice notice-warn">
            {p.status === 'hidden' ? 'Your profile is hidden — only you can see it.' : `Your profile was taken down: ${p.statusNote || 'it broke the community rules'}.`}
          </p>
        )}
        <header className="kl-head">
          {p.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.photoUrl} alt={p.name} className="kl-avatar" />
          ) : (
            <span className="kl-avatar kl-photo-none" aria-hidden="true">
              {k.emoji}
            </span>
          )}
          <div>
            <p className="feed-kicker">
              {k.emoji} {k.label}
            </p>
            <h1 className="page-title kl-title">
              {p.name}
              {p.verified && (
                <span className="kl-verified kl-verified-big" title="Checked by MartNepali">
                  ✓ verified
                </span>
              )}
            </h1>
            <p className="muted">
              📍 {p.city}
              {p.areas ? ` · ${p.areas}` : ''}
            </p>
          </div>
        </header>

        <div className="kl-actions">
          {p.mine ? (
            <Link href="/kalakar/edit" className="btn btn-brand">
              Edit your profile
            </Link>
          ) : member ? (
            <WriteButton topic="talent" topicId={p.id} label={`Send ${p.name} an enquiry`} />
          ) : state.kind === 'banned' ? null : (
            <Link href={`/account?back=${encodeURIComponent(`/kalakar/${p.slug}`)}`} className="btn btn-brand">
              Sign in to send an enquiry
            </Link>
          )}
          {p.links.map((l) => (
            <a key={l.url} href={l.url} className="btn btn-sm" target="_blank" rel="noopener noreferrer nofollow ugc">
              {l.label} ↗
            </a>
          ))}
        </div>

        <section className="card">
          <h2 className="card-title">About</h2>
          <p className="mu-text">{p.bio}</p>
        </section>

        {video && video.kind !== 'file' && (
          <section className="card">
            <h2 className="card-title">Watch</h2>
            <VideoFacade url={video.url} title={`${p.name} — video`} provider={video.kind} />
          </section>
        )}

        {shows.length > 0 && (
          <section className="card">
            <h2 className="card-title">Upcoming on MartNepali</h2>
            <ul className="pl-list">
              {shows.map((e) => (
                <li key={e.id}>
                  <Link href={`/e/${e.slug}`} className="pl-item ib-row">
                    <span className="pl-thumb pl-emoji" aria-hidden="true">
                      🎟
                    </span>
                    <span className="pl-main">
                      <span className="pl-title">{readListingName(e.name).name}</span>
                      <span className="muted small">
                        {e.dateDisplay || e.eventDate} · {e.city}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="muted small kl-note">
          Profiles are written by the people themselves. {p.verified ? 'This one was checked by MartNepali.' : 'Not yet checked by MartNepali.'} Agree
          fees and details directly — MartNepali takes no part and no cut.
        </p>
        {member && !p.mine && (
          <div className="mu-report">
            <ReportButton type="talent" id={p.id} handle={p.ownerHandle} label="Report this profile" />
          </div>
        )}
      </div>
    </>
  );
}
