'use client';

// The Bhetghat deck: one card at a time — a Nepali event or a members'
// meetup — swipe right for "I'm in", left to skip. Buttons and the arrow keys
// do the same for anyone who does not swipe.
//
// What a swipe does:
//   right on a meetup  → you join it (the server keeps who is going)
//   right on an event  → it goes to My plans, kept in THIS browser only
//   left               → skipped for 30 days, kept in this browser only
// Event likes and skips never reach the server: like the bazaar's saved list
// (lib/savedItems), a record of what someone glanced at is not worth an
// account, a retention rule and a line in the privacy notice.
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cityKey } from '@/lib/cities';

export type DeckCard =
  | {
      kind: 'event';
      key: string;
      id: string;
      title: string;
      when: string;
      sortAt: string;
      city: string;
      place: string;
      image: string | null;
      href: string;
      price: string | null;
    }
  | {
      kind: 'meetup';
      key: string;
      id: string;
      title: string;
      when: string;
      sortAt: string;
      city: string;
      place: string;
      emoji: string;
      category: string;
      about: string;
      going: number;
      capacity: number;
      host: string;
      href: string;
      ask: boolean;
      minPeople: number;
      costNote: string;
    }
  | { kind: 'teaser'; key: string; count: number; signedIn: boolean; sortAt: string; city: string };

export interface PlanEvent {
  title: string;
  when: string;
  city: string;
  href: string;
  image: string | null;
  sortAt: string;
  at: number;
}

interface Store {
  skipped: Record<string, number>;
  liked: Record<string, PlanEvent>;
  city?: string;
}

export const DECK_STORE = 'mn-bhetghat-v1';
const SKIP_MS = 30 * 86_400_000;

export function loadDeckStore(): Store {
  try {
    const raw = window.localStorage.getItem(DECK_STORE);
    const parsed = raw ? (JSON.parse(raw) as Partial<Store>) : {};
    return { skipped: parsed.skipped ?? {}, liked: parsed.liked ?? {}, city: parsed.city };
  } catch {
    return { skipped: {}, liked: {} };
  }
}

export function saveDeckStore(s: Store): void {
  try {
    // Old skips age out instead of piling up forever.
    const now = Date.now();
    const skipped = Object.fromEntries(Object.entries(s.skipped).filter(([, at]) => now - at < SKIP_MS));
    window.localStorage.setItem(DECK_STORE, JSON.stringify({ ...s, skipped }));
  } catch {
    /* private window or storage full — the deck still works for this visit */
  }
}

type Action = { card: DeckCard; dir: 'left' | 'right' };
interface Toast {
  text: string;
  tone: 'ok' | 'error';
  href?: string;
  link?: string;
}

interface Props {
  cards: DeckCard[];
  homeCity: string;
  isMember: boolean;
}

const THRESHOLD = 110;

export default function SwipeDeck({ cards, homeCity, isMember }: Props) {
  const [store, setStore] = useState<Store | null>(null);
  const [gone, setGone] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState<Action[]>([]);
  const [city, setCity] = useState('all');
  const [drag, setDrag] = useState({ x: 0, y: 0, active: false });
  const [flying, setFlying] = useState<{ key: string; dir: 'left' | 'right' } | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const start = useRef<{ x: number; y: number; t: number } | null>(null);
  const moved = useRef(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cities with something on, busiest first.
  const cities = useMemo(() => {
    const counts = new Map<string, { name: string; n: number }>();
    for (const c of cards) {
      if (c.kind === 'teaser' || !c.city) continue;
      const k = cityKey(c.city);
      const row = counts.get(k) ?? { name: c.city, n: 0 };
      row.n += 1;
      counts.set(k, row);
    }
    return [...counts.entries()].sort((a, b) => b[1].n - a[1].n).map(([key, v]) => ({ key, ...v }));
  }, [cards]);

  useEffect(() => {
    const s = loadDeckStore();
    setStore(s);
    const home = cityKey(homeCity);
    if (s.city && (s.city === 'all' || cities.some((c) => c.key === s.city))) setCity(s.city);
    else if (home && cities.some((c) => c.key === home)) setCity(home);
  }, [cities, homeCity]);

  const queue = useMemo(() => {
    if (!store) return [];
    const now = Date.now();
    return cards.filter((c) => {
      if (gone.has(c.key)) return false;
      if (c.kind === 'teaser') return true;
      if (store.liked[c.key]) return false;
      const skippedAt = store.skipped[c.key];
      if (skippedAt && now - skippedAt < SKIP_MS) return false;
      return city === 'all' || cityKey(c.city) === city;
    });
  }, [cards, store, gone, city]);

  const top = queue[0] ?? null;

  const say = useCallback((t: Toast) => {
    setToast(t);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 5000);
  }, []);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  function updateStore(fn: (s: Store) => Store) {
    setStore((prev) => {
      const next = fn(prev ?? { skipped: {}, liked: {} });
      saveDeckStore(next);
      return next;
    });
  }

  function chooseCity(key: string) {
    setCity(key);
    updateStore((s) => ({ ...s, city: key }));
  }

  async function commit(card: DeckCard, dir: 'left' | 'right') {
    setGone((g) => new Set(g).add(card.key));
    setHistory((h) => [...h.slice(-19), { card, dir }]);
    if (card.kind === 'teaser') {
      if (dir === 'right') window.location.href = card.signedIn ? '/community' : '/account?back=%2Fbhetghat';
      return;
    }
    if (dir === 'left') {
      updateStore((s) => ({ ...s, skipped: { ...s.skipped, [card.key]: Date.now() } }));
      return;
    }
    if (card.kind === 'event') {
      const plan: PlanEvent = { title: card.title, when: card.when, city: card.city, href: card.href, image: card.image, sortAt: card.sortAt, at: Date.now() };
      updateStore((s) => ({ ...s, liked: { ...s.liked, [card.key]: plan } }));
      say({ text: `Saved to My plans: ${card.title}`, tone: 'ok', href: card.href, link: 'Get tickets →' });
      return;
    }
    try {
      const res = await fetch(`/api/community/meetups/${card.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'join' }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; requested?: boolean };
      if (!res.ok) throw new Error(data.error || 'Could not join — try again.');
      if (data.requested) say({ text: `Request sent: ${card.title} — the host will say yes or no.`, tone: 'ok', href: '/bhetghat/plans', link: 'My plans →' });
      else say({ text: `You're in! 🎉 ${card.title}`, tone: 'ok', href: card.href, link: 'Say hi in the chat →' });
    } catch (e) {
      say({ text: (e as Error).message, tone: 'error' });
    }
  }

  function fly(dir: 'left' | 'right') {
    if (!top || flying) return;
    setFlying({ key: top.key, dir });
    const card = top;
    setTimeout(() => {
      setFlying(null);
      setDrag({ x: 0, y: 0, active: false });
      void commit(card, dir);
    }, 240);
  }

  async function undo() {
    const last = history[history.length - 1];
    if (!last) return;
    setHistory((h) => h.slice(0, -1));
    const { card, dir } = last;
    if (card.kind === 'event' || card.kind === 'meetup') {
      if (dir === 'left') {
        updateStore((s) => {
          const skipped = { ...s.skipped };
          delete skipped[card.key];
          return { ...s, skipped };
        });
      } else if (card.kind === 'event') {
        updateStore((s) => {
          const liked = { ...s.liked };
          delete liked[card.key];
          return { ...s, liked };
        });
      } else {
        await fetch(`/api/community/meetups/${card.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'leave' }),
        }).catch(() => null);
      }
    }
    setGone((g) => {
      const next = new Set(g);
      next.delete(card.key);
      return next;
    });
    setToast(null);
  }

  function onPointerDown(e: React.PointerEvent) {
    if (e.button !== 0 || flying) return;
    start.current = { x: e.clientX, y: e.clientY, t: performance.now() };
    moved.current = false;
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* a synthetic or already-ended pointer — dragging still works without capture */
    }
    setDrag({ x: 0, y: 0, active: true });
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!start.current) return;
    const x = e.clientX - start.current.x;
    const y = e.clientY - start.current.y;
    if (Math.abs(x) > 6 || Math.abs(y) > 6) moved.current = true;
    setDrag({ x, y, active: true });
  }

  function onPointerUp(e: React.PointerEvent) {
    if (!start.current) return;
    const dx = e.clientX - start.current.x;
    const dt = Math.max(1, performance.now() - start.current.t);
    const v = dx / dt;
    start.current = null;
    if (dx > THRESHOLD || (v > 0.6 && dx > 30)) fly('right');
    else if (dx < -THRESHOLD || (v < -0.6 && dx < -30)) fly('left');
    else setDrag({ x: 0, y: 0, active: false });
  }

  function onPointerCancel() {
    start.current = null;
    setDrag({ x: 0, y: 0, active: false });
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      fly('right');
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      fly('left');
    }
  }

  function openTop() {
    if (moved.current || !top) return;
    if (top.kind === 'teaser') window.location.href = top.signedIn ? '/community' : '/account?back=%2Fbhetghat';
    else window.location.href = top.href;
  }

  function resetSkipped() {
    updateStore((s) => ({ ...s, skipped: {} }));
    setGone(new Set());
    setHistory([]);
  }

  const visible = queue.slice(0, 3);
  const dx = flying ? (flying.dir === 'right' ? 1 : -1) * 700 : drag.x;
  const dy = flying ? drag.y : drag.y * 0.4;
  const rot = dx / 18;
  const yes = Math.max(0, Math.min(1, dx / 100));
  const no = Math.max(0, Math.min(1, -dx / 100));

  return (
    <div className="bg-deck-wrap">
      {cities.length > 1 && (
        <div className="chip-row bg-cities" role="group" aria-label="Town">
          <button type="button" className={`chip${city === 'all' ? ' chip-active' : ''}`} aria-pressed={city === 'all'} onClick={() => chooseCity('all')}>
            Everywhere
          </button>
          {cities.slice(0, 8).map((c) => (
            <button
              type="button"
              key={c.key}
              className={`chip${city === c.key ? ' chip-active' : ''}`}
              aria-pressed={city === c.key}
              onClick={() => chooseCity(c.key)}
            >
              {c.name} <span className="chip-count">{c.n}</span>
            </button>
          ))}
        </div>
      )}

      <div
        className="bg-deck"
        role="region"
        aria-label="Swipe deck — right arrow for I'm in, left arrow to skip"
        tabIndex={0}
        onKeyDown={onKey}
      >
        {!store && <div className="bg-card bg-card-loading" aria-hidden="true" />}
        {store && !top && (
          <div className="bg-empty">
            <p className="bg-empty-icon" aria-hidden="true">
              🙌
            </p>
            <h2>You have seen everything{city !== 'all' ? ' here' : ''}</h2>
            <p className="muted">New meetups and events appear as people post them. Or start one yourself — it takes a minute.</p>
            <div className="cm-row cm-row-center">
              <Link href={isMember ? '/bhetghat/new' : '/community'} className="btn btn-brand">
                Start a meetup
              </Link>
              {city !== 'all' && (
                <button type="button" className="btn" onClick={() => chooseCity('all')}>
                  Everywhere
                </button>
              )}
              <button type="button" className="btn" onClick={resetSkipped}>
                Show skipped again
              </button>
            </div>
          </div>
        )}
        {visible
          .map((card, i) => {
            const isTop = i === 0;
            const style: React.CSSProperties = isTop
              ? {
                  transform: `translate(${dx}px, ${dy}px) rotate(${rot}deg)`,
                  transition: drag.active && !flying ? 'none' : 'transform 0.24s ease-out',
                }
              : { transform: `translateY(${i * 10}px) scale(${1 - i * 0.04})` };
            return (
              <article
                key={card.key}
                className={`bg-card bg-card-${card.kind}`}
                style={style}
                aria-hidden={!isTop}
                onPointerDown={isTop ? onPointerDown : undefined}
                onPointerMove={isTop ? onPointerMove : undefined}
                onPointerUp={isTop ? onPointerUp : undefined}
                onPointerCancel={isTop ? onPointerCancel : undefined}
                onClick={isTop ? openTop : undefined}
              >
                <CardFace card={card} />
                {isTop && (
                  <>
                    <span className="bg-stamp bg-stamp-yes" style={{ opacity: yes }}>
                      I&rsquo;m in
                    </span>
                    <span className="bg-stamp bg-stamp-no" style={{ opacity: no }}>
                      Skip
                    </span>
                  </>
                )}
              </article>
            );
          })
          .reverse()}
      </div>

      <div className="bg-actions">
        <button type="button" className="bg-act bg-act-undo" onClick={undo} disabled={!history.length} aria-label="Undo the last swipe">
          ↺
        </button>
        <button type="button" className="bg-act bg-act-no" onClick={() => fly('left')} disabled={!top} aria-label="Skip">
          ✕
        </button>
        <button type="button" className="bg-act bg-act-yes" onClick={() => fly('right')} disabled={!top} aria-label="I'm in">
          ✓
        </button>
      </div>
      <p className="muted small bg-help">Swipe right for &ldquo;I&rsquo;m in&rdquo;, left to skip. Tap a card for details.</p>

      {toast && (
        <div className={`bg-toast bg-toast-${toast.tone}`} role="status">
          <span>{toast.text}</span>
          {toast.href && (
            <Link href={toast.href} className="bg-toast-link">
              {toast.link}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

function CardFace({ card }: { card: DeckCard }) {
  if (card.kind === 'teaser') {
    return (
      <div className="bg-face bg-face-teaser">
        <p className="bg-big" aria-hidden="true">
          👋
        </p>
        <h3>
          {card.count > 0 ? `${card.count} ${card.count === 1 ? 'meetup' : 'meetups'} by members` : 'Meetups by members'}
        </h3>
        <p>
          Futsal, momo nights, hikes, festival get-togethers — small meetups started by Nepalis near you. Members only:
          {card.signedIn ? ' join the community to see them.' : ' sign in and join to see them.'}
        </p>
        <span className="btn btn-brand bg-teaser-btn">{card.signedIn ? 'Join the community →' : 'Sign in to join →'}</span>
      </div>
    );
  }
  if (card.kind === 'event') {
    return (
      <div className="bg-face bg-face-event">
        {card.image ? (
          // Our own media route; next/image adds nothing on a dragged card.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={card.image} alt="" className="bg-photo" draggable={false} />
        ) : (
          <div className="bg-photo bg-photo-none" aria-hidden="true">
            🎟
          </div>
        )}
        <div className="bg-shade" />
        <div className="bg-info">
          <span className="bg-kind">🎟 Event</span>
          <h3>{card.title}</h3>
          <p className="bg-when">{card.when}</p>
          <p className="bg-where">{[card.place, card.city].filter(Boolean).join(' · ')}</p>
          {card.price && <p className="bg-price">from {card.price}</p>}
        </div>
      </div>
    );
  }
  return (
    <div className={`bg-face bg-face-meetup bg-cat-${card.category}`}>
      <p className="bg-big" aria-hidden="true">
        {card.emoji}
      </p>
      <div className="bg-info">
        <span className="bg-kind">{card.ask ? '✋ Ask to join · members only' : '👋 Meetup · members only'}</span>
        <h3>{card.title}</h3>
        <p className="bg-when">{card.when}</p>
        <p className="bg-where">{[card.place, card.city].filter(Boolean).join(' · ')}</p>
        {card.costNote && <p className="bg-cost">💶 {card.costNote}</p>}
        {card.about && <p className="bg-about">{card.about}</p>}
        <p className="bg-going">
          👥 {card.going} going
          {card.minPeople > card.going ? ` · ${card.minPeople - card.going} more needed` : ''}
          {card.capacity > 0 ? ` · ${Math.max(0, card.capacity - card.going)} spots left` : ''} · hosted by{' '}
          <span translate="no">{card.host}</span>
        </p>
      </div>
    </div>
  );
}
