import Link from 'next/link';
import CommunityNav from '@/components/community/CommunityNav';
import { communityState } from '@/lib/community';
import { communityUnread } from '@/lib/inbox';
import { listTalent, talentCities, talentKind, TALENT_KINDS } from '@/lib/talent';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Kalakar — Nepali artists, DJs, pandits & more in Germany',
  description:
    'Find Nepali singers, bands, DJs, dancers, MCs, photographers, makeup artists, caterers and pandits in Germany — and book them directly. Free to list.',
  alternates: { canonical: '/kalakar' },
};

type Search = { k?: string; city?: string };

function href(current: Search, change: Partial<Search>): string {
  const next = { ...current, ...change };
  const q = new URLSearchParams();
  if (next.k) q.set('k', next.k);
  if (next.city) q.set('city', next.city);
  const s = q.toString();
  return s ? `/kalakar?${s}` : '/kalakar';
}

/**
 * The public directory. Anyone can browse it — that is the point of a profile
 * — and only signed-in members can write to someone (lib/conversations).
 */
export default async function KalakarPage({ searchParams }: { searchParams: Promise<Search> }) {
  const search = await searchParams;
  const state = await communityState();
  const member = state.kind === 'member' ? state.member : null;
  const kind = TALENT_KINDS.some((k) => k.key === search.k) ? (search.k as string) : '';
  const profiles = listTalent({ kind, city: search.city });
  const cities = talentCities();

  return (
    <>
      <CommunityNav active="kalakar" unread={member ? communityUnread(member) : 0} />
      <section className="container hb-head">
        <p className="feed-kicker">
          <span lang="ne">कलाकार</span> · Kalakar
        </p>
        <h1 className="page-title">Nepali talent in Germany</h1>
        <p className="muted">
          Singers, DJs, dancers, MCs, photographers, makeup artists, caterers, pandits — find them, and book them directly.
        </p>
        <div className="cm-row hb-cta">
          <Link href="/kalakar/edit" className="btn btn-brand">
            ✨ List yourself — free
          </Link>
        </div>
      </section>

      <section className="container hb-section">
        <div className="chip-row hb-filters hb-scroll" role="group" aria-label="What they do">
          <Link href={href(search, { k: undefined })} className={`chip${!kind ? ' chip-active' : ''}`}>
            Everyone
          </Link>
          {TALENT_KINDS.map((k) => (
            <Link key={k.key} href={href(search, { k: k.key })} className={`chip${kind === k.key ? ' chip-active' : ''}`}>
              {k.emoji} {k.label}
            </Link>
          ))}
        </div>
        {cities.length > 1 && (
          <div className="chip-row hb-filters hb-scroll" role="group" aria-label="Town">
            <Link href={href(search, { city: undefined })} className={`chip${!search.city ? ' chip-active' : ''}`}>
              Everywhere
            </Link>
            {cities.slice(0, 10).map((c) => (
              <Link key={c.key} href={href(search, { city: c.key })} className={`chip${search.city === c.key ? ' chip-active' : ''}`}>
                {c.name} <span className="chip-count">{c.n}</span>
              </Link>
            ))}
          </div>
        )}

        {profiles.length === 0 ? (
          <div className="hb-empty">
            <p className="bg-empty-icon" aria-hidden="true">
              🎤
            </p>
            <p>
              {kind || search.city ? 'Nobody listed here yet.' : 'The directory is brand new.'} Sing, dance, cook, take photos, do
              puja? Put yourself where organizers and families look.
            </p>
            <Link href="/kalakar/edit" className="btn btn-brand">
              Create your profile
            </Link>
          </div>
        ) : (
          <ul className="kl-grid">
            {profiles.map((p) => {
              const k = talentKind(p.kind);
              return (
                <li key={p.id}>
                  <Link href={`/kalakar/${p.slug}`} className="kl-card">
                    {p.photoUrl ? (
                      // Our own route; a fixed square, next/image adds nothing here.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.photoUrl} alt="" className="kl-photo" loading="lazy" />
                    ) : (
                      <span className="kl-photo kl-photo-none" aria-hidden="true">
                        {k.emoji}
                      </span>
                    )}
                    <span className="kl-card-body">
                      <strong className="kl-name">
                        {p.name}
                        {p.verified && (
                          <span className="kl-verified" title="Checked by MartNepali">
                            ✓
                          </span>
                        )}
                      </strong>
                      <span className="muted small">
                        {k.emoji} {k.label}
                      </span>
                      <span className="muted small">📍 {p.city}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
