'use client';

// The live kitchen board. Polls the shop's paid orders every few seconds and
// lays them out as New → Cooking → Ready, the way a restaurant's ticket rail
// does. Built for a tablet leaning on the pass: big type, big buttons, a
// full-screen mode, and a chime when a new order lands.
import { useCallback, useEffect, useRef, useState } from 'react';

type Status = 'new' | 'cooking' | 'ready' | 'done';

interface Ticket {
  orderId: string;
  reference: string;
  buyerName: string;
  status: Status;
  pickupSlot: string | null;
  slotLabel: string;
  tableLabel: string;
  note: string;
  paidAt: string | null;
  items: { name: string; quantity: number; picks: string }[];
  collected: boolean;
}

const POLL_MS = 6000;

const KITCHEN_COLUMNS: { key: Status; title: string; action: string; next: Status }[] = [
  { key: 'new', title: 'New', action: 'Start cooking', next: 'cooking' },
  { key: 'cooking', title: 'Cooking', action: 'Mark ready', next: 'ready' },
  { key: 'ready', title: 'Ready', action: 'Handed over', next: 'done' },
];

/** The same board for a salon, tutor or puja: bookings move through the day. */
const APPOINTMENT_COLUMNS: { key: Status; title: string; action: string; next: Status }[] = [
  { key: 'new', title: 'Booked', action: 'Start', next: 'cooking' },
  { key: 'cooking', title: 'In progress', action: 'Finish', next: 'ready' },
  { key: 'ready', title: 'Finished', action: 'Close', next: 'done' },
];

const PREV: Record<Status, Status | null> = { new: null, cooking: 'new', ready: 'cooking', done: 'ready' };

function chime() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const notes = [880, 1320];
    notes.forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = f;
      o.type = 'sine';
      g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.18);
      g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + i * 0.18 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.18 + 0.35);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + i * 0.18);
      o.stop(ctx.currentTime + i * 0.18 + 0.4);
    });
    setTimeout(() => void ctx.close(), 1200);
  } catch {
    /* no audio — the flash is enough */
  }
}

export default function KitchenBoard({
  eventId,
  shopName,
  mode = 'collection',
}: {
  eventId: string;
  shopName: string;
  mode?: 'collection' | 'appointment';
}) {
  const COLUMNS = mode === 'appointment' ? APPOINTMENT_COLUMNS : KITCHEN_COLUMNS;
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [offline, setOffline] = useState(false);
  const [sound, setSound] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [clock, setClock] = useState('');
  const known = useRef<Set<string> | null>(null);
  const soundRef = useRef(sound);
  soundRef.current = sound;
  const boardRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/portal/events/${eventId}/kitchen`, { cache: 'no-store' });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { tickets: Ticket[] };
      setOffline(false);
      setTickets(data.tickets);
      const ids = new Set(data.tickets.map((t) => t.orderId));
      if (known.current) {
        const arrived = data.tickets.filter((t) => t.status === 'new' && !known.current!.has(t.orderId)).map((t) => t.orderId);
        if (arrived.length > 0) {
          setFresh((prev) => new Set([...prev, ...arrived]));
          if (soundRef.current) chime();
          setTimeout(() => setFresh((prev) => new Set([...prev].filter((id) => !arrived.includes(id)))), 8000);
        }
      }
      known.current = ids;
      setLoaded(true);
    } catch {
      setOffline(true);
    }
  }, [eventId]);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    const tick = () =>
      setClock(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' }));
    tick();
    const t = setInterval(tick, 15_000);
    return () => clearInterval(t);
  }, []);

  async function move(ticket: Ticket, status: Status) {
    setBusy(ticket.orderId);
    // Move it on screen at once; the next poll confirms or corrects it.
    setTickets((prev) => prev.map((t) => (t.orderId === ticket.orderId ? { ...t, status } : t)));
    try {
      await fetch(`/api/portal/events/${eventId}/kitchen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: ticket.orderId, status }),
      });
    } finally {
      setBusy(null);
      void load();
    }
  }

  function fullScreen() {
    const el = boardRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.();
  }

  const done = tickets.filter((t) => t.status === 'done');

  return (
    <div className="kb" ref={boardRef}>
      <div className="kb-bar">
        <div className="kb-bar-title">
          <span className="kb-live" aria-hidden="true" />
          <strong>{shopName}</strong>
          <span className="kb-clock">{clock}</span>
          {offline && <span className="badge badge-red">Reconnecting…</span>}
        </div>
        <div className="kb-bar-actions">
          <button
            type="button"
            className={`btn btn-sm${sound ? ' btn-green' : ''}`}
            onClick={() => {
              setSound((s) => !s);
              if (!sound) chime();
            }}
            aria-pressed={sound}
          >
            {sound ? '🔔 Sound on' : '🔕 Sound off'}
          </button>
          <button type="button" className="btn btn-sm" onClick={fullScreen}>
            ⛶ Full screen
          </button>
        </div>
      </div>

      {!loaded ? (
        <p className="muted">Loading orders…</p>
      ) : (
        <div className="kb-cols">
          {COLUMNS.map((col) => {
            const list = tickets.filter((t) => t.status === col.key);
            return (
              <section key={col.key} className={`kb-col kb-col-${col.key}`} aria-label={col.title}>
                <header className="kb-col-head">
                  <span>{col.title}</span>
                  <span className="kb-count">{list.length}</span>
                </header>
                {list.length === 0 && <p className="kb-empty">Nothing here</p>}
                {list.map((t) => (
                  <article key={t.orderId} className={`kb-card${fresh.has(t.orderId) ? ' kb-card-fresh' : ''}`}>
                    <div className="kb-card-top">
                      <span className="kb-when">
                        {t.tableLabel ? `Table ${t.tableLabel}` : t.slotLabel || (mode === 'appointment' ? 'No time chosen' : 'As soon as ready')}
                      </span>
                      <span className="kb-ref">#{t.reference}</span>
                    </div>
                    <div className="kb-name">{t.buyerName}</div>
                    <ul className="kb-items">
                      {t.items.map((it) => (
                        <li key={it.name}>
                          <span className="kb-qty">{it.quantity}×</span>
                          <span>
                            {it.name}
                            {it.picks && <em>{it.picks}</em>}
                          </span>
                        </li>
                      ))}
                    </ul>
                    {t.note && <p className="kb-note">“{t.note}”</p>}
                    <div className="kb-actions">
                      {PREV[t.status] && (
                        <button
                          type="button"
                          className="btn btn-sm kb-back"
                          onClick={() => void move(t, PREV[t.status]!)}
                          disabled={busy === t.orderId}
                          aria-label="Move back"
                        >
                          ←
                        </button>
                      )}
                      <button
                        type="button"
                        className={`btn ${col.key === 'ready' ? 'btn-green' : 'btn-brand'} kb-go`}
                        onClick={() => void move(t, col.next)}
                        disabled={busy === t.orderId}
                      >
                        {col.action}
                      </button>
                    </div>
                  </article>
                ))}
              </section>
            );
          })}
        </div>
      )}

      {done.length > 0 && (
        <details className="kb-done">
          <summary>
            {mode === 'appointment' ? 'Closed' : 'Handed over'} in the last few hours ({done.length})
          </summary>
          <ul>
            {done.map((t) => (
              <li key={t.orderId}>
                <span>
                  #{t.reference} · {t.buyerName} · {t.items.map((i) => `${i.quantity}× ${i.name}`).join(', ')}
                  {t.collected ? ' · code scanned' : ''}
                </span>
                {!t.collected && (
                  <button type="button" className="btn btn-sm" onClick={() => void move(t, 'ready')}>
                    Undo
                  </button>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
