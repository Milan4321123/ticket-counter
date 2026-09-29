'use client';

// "Talk to the creator" — /contact as a conversation instead of a form. The
// assistant (api/contact/chat) asks one short question at a time; beside the
// chat the request fills itself in, line by line. When it is complete, one
// tap sends it to Milan — the same record and emails the form makes. The form
// stays below as a fallback.
//
// Privacy, in the order the visitor meets it: a line above the chat says,
// before anything is typed, whether answers come from an AI and asks for no
// sensitive details; what they type is marked translate="no" so the page
// translator never sends it anywhere; and the send step INFORMS (Art. 13
// GDPR) rather than asking for a tick — answering a request someone sent us
// rests on Art. 6(1)(b)/(f), and a mandatory "I agree" box would pretend it
// were consent.
import { useEffect, useRef, useState } from 'react';
import SpeechInput from './SpeechInput';

interface Turn {
  from: 'me' | 'bot';
  text: string;
}
interface Fields {
  kind: string;
  summary: string;
  eventName: string;
  eventWhen: string;
  eventWhere: string;
  expectedPeople: string;
  budget: string;
  looks: string;
  name: string;
  email: string;
  organization: string;
  phone: string;
}

const EMPTY: Fields = {
  kind: 'custom-design',
  summary: '',
  eventName: '',
  eventWhen: '',
  eventWhere: '',
  expectedPeople: '',
  budget: '',
  looks: '',
  name: '',
  email: '',
  organization: '',
  phone: '',
};

const HELLO =
  'Namaste 🙏 I am Milan’s assistant. What would you like us to make — a custom page for your event, a festival website, an app, or something else? Just tell me, in any language.';
const IDEAS = ['A custom page for my event', 'A website for our festival', 'An app for my shop or restaurant', 'Something else'];
const ROWS: { key: keyof Fields; label: string; icon: string }[] = [
  { key: 'summary', label: 'What you want', icon: '✨' },
  { key: 'eventName', label: 'Event or business', icon: '🎪' },
  { key: 'eventWhen', label: 'When', icon: '📅' },
  { key: 'eventWhere', label: 'Where', icon: '📍' },
  { key: 'expectedPeople', label: 'How many people', icon: '👥' },
  { key: 'budget', label: 'Timing / deadline', icon: '🗓' },
  { key: 'looks', label: 'Looks you like', icon: '🎨' },
  { key: 'name', label: 'Your name', icon: '🙂' },
  { key: 'email', label: 'Email', icon: '✉️' },
];
const STORE = 'creator:chat:v1';

export default function CreatorChat({ owner = 'Milan', ai = false }: { owner?: string; /** Whether replies come from Gemini on this server (lib/gemini, personal). */ ai?: boolean }) {
  const [turns, setTurns] = useState<Turn[]>([{ from: 'bot', text: HELLO }]);
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [ready, setReady] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [openCard, setOpenCard] = useState(false);
  const log = useRef<HTMLDivElement>(null);
  const mobileCard = useRef<HTMLDivElement>(null);
  const speechBase = useRef('');

  // The conversation survives a reload in this tab.
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORE) || 'null') as { turns: Turn[]; fields: Fields; ready: boolean } | null;
      if (saved?.turns?.length) {
        setTurns(saved.turns);
        setFields({ ...EMPTY, ...saved.fields });
        setReady(Boolean(saved.ready));
      }
    } catch {
      /* private mode: start fresh */
    }
  }, []);
  useEffect(() => {
    try {
      sessionStorage.setItem(STORE, JSON.stringify({ turns: turns.slice(-40), fields, ready }));
    } catch {
      /* fine */
    }
  }, [turns, fields, ready]);
  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight, behavior: 'smooth' });
  }, [turns, busy]);
  // Phone: the opened request sits BELOW the chat, full height — bring its top
  // into view so the visitor sees it arrive, with the send button under it.
  useEffect(() => {
    if (!openCard) return;
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    mobileCard.current?.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' });
  }, [openCard]);

  async function talk(text: string) {
    const said = text.trim();
    if (!said || busy || sent) return;
    const next = [...turns, { from: 'me' as const, text: said }];
    setTurns(next);
    setDraft('');
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/contact/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next, fields }),
      });
      const d = (await res.json().catch(() => null)) as { reply?: string; fields?: Fields; ready?: boolean; error?: string } | null;
      if (d?.fields) setFields({ ...EMPTY, ...d.fields });
      setReady(Boolean(d?.ready));
      setTurns((t) => [...t, { from: 'bot', text: d?.reply ?? d?.error ?? 'Sorry — that did not go through. Try again in a moment.' }]);
    } catch {
      setTurns((t) => [...t, { from: 'bot', text: 'Sorry — no connection. Try again in a moment.' }]);
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    if (!ready || busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/contact/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: turns, fields, send: true }),
      });
      const d = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (d?.ok) {
        setSent(true);
        try {
          sessionStorage.removeItem(STORE);
        } catch {
          /* fine */
        }
      } else setError(d?.error ?? 'That did not go through — please try again.');
    } catch {
      setError('No connection — please try again.');
    } finally {
      setBusy(false);
    }
  }

  const filled = ROWS.filter((r) => fields[r.key].trim()).length;
  const pct = Math.round((filled / ROWS.length) * 100);

  const card = (
    <aside className={`cc-card${ready ? ' is-ready' : ''}`} aria-label="Your request">
      <header className="cc-card-head">
        <span className="cc-ring" style={{ ['--p' as string]: `${pct}%` }} aria-hidden="true">
          <span>{filled}</span>
        </span>
        <div>
          <strong>Your request</strong>
          <span className="cc-card-sub">{sent ? `Sent to ${owner} ✓` : ready ? 'Ready to send' : 'Fills in as you chat'}</span>
        </div>
      </header>
      <ul className="cc-rows">
        {ROWS.map((r) => {
          const v = fields[r.key].trim();
          return (
            <li key={r.key} className={v ? 'is-set' : ''}>
              <span className="cc-row-icon" aria-hidden="true">
                {v ? '✓' : r.icon}
              </span>
              <span className="cc-row-text">
                <span className="cc-row-label">{r.label}</span>
                {v && <span className="cc-row-value" translate="no">{v}</span>}
              </span>
            </li>
          );
        })}
      </ul>
      {sent ? (
        <p className="cc-sent">
          🎉 Sent! {owner} reads every request himself and replies to <strong translate="no">{fields.email}</strong> — usually within a
          day or two.
        </p>
      ) : ready ? (
        <div className="cc-send">
          <p className="cc-info" style={{ margin: 0, fontSize: '0.8rem', opacity: 0.85 }}>
            Sending passes these details to {owner}, who uses them only to answer your request (Art. 6(1)(b) and (f) GDPR) — no
            mailing list, and you can have them deleted any time.{' '}
            <a href="/privacy" target="_blank" rel="noopener">
              Privacy
            </a>
          </p>
          <button type="button" className="btn btn-brand btn-lg btn-block" onClick={() => void send()} disabled={busy}>
            {busy ? 'Sending…' : `Send to ${owner} →`}
          </button>
          {error && <p className="cc-error">{error}</p>}
        </div>
      ) : null}
    </aside>
  );

  return (
    <div className="cc">
      <div className="cc-aurora" aria-hidden="true" />
      <section className="cc-chat" aria-label={`Talk to ${owner}'s assistant`}>
        <header className="cc-chat-head">
          <span className="cc-avatar" aria-hidden="true">
            M
          </span>
          <div>
            <strong>Talk to the creator</strong>
            <span className="cc-online">
              <i aria-hidden="true" /> {owner}’s assistant · replies instantly
            </span>
          </div>
          {turns.length > 1 && !sent && (
            <button
              type="button"
              className="cc-new"
              onClick={() => {
                setTurns([{ from: 'bot', text: HELLO }]);
                setFields(EMPTY);
                setReady(false);
              }}
            >
              ＋ New
            </button>
          )}
        </header>
        <p
          className="cc-notice"
          style={{ margin: 0, padding: '8px 16px', fontSize: '0.78rem', opacity: 0.75, borderBottom: '1px solid rgba(255, 255, 255, 0.07)' }}
        >
          {ai ? 'Answers in this chat come from an AI (Google Gemini).' : 'Answers in this chat are automated.'} Please
          don&rsquo;t type sensitive personal details.{' '}
          <a href="/privacy" target="_blank" rel="noopener">
            Privacy
          </a>
        </p>
        <div className="cc-log" ref={log}>
          {turns.map((m, i) => (
            // What the visitor typed — and any reply that may echo it — is never
            // sent to the page translator. Only the opening greeting is ours.
            <div key={i} className={`cc-msg cc-${m.from}`} translate={i === 0 && m.from === 'bot' ? undefined : 'no'}>
              {m.text}
            </div>
          ))}
          {busy && !sent && (
            <div className="cc-msg cc-bot cc-typing" aria-label="…">
              <i />
              <i />
              <i />
            </div>
          )}
          {turns.length === 1 && (
            <div className="cc-ideas">
              {IDEAS.map((idea) => (
                <button key={idea} type="button" onClick={() => void talk(idea)}>
                  {idea}
                </button>
              ))}
            </div>
          )}
        </div>
        {/* Phone: the request as a strip that opens. */}
        <button type="button" className="cc-strip" onClick={() => setOpenCard((o) => !o)} aria-expanded={openCard}>
          <span className="cc-ring cc-ring-sm" style={{ ['--p' as string]: `${pct}%` }} aria-hidden="true" />
          Your request · {filled}/{ROWS.length}
          {ready && !sent ? ' · ready to send' : ''} {openCard ? '▴' : '▾'}
        </button>
        {!sent && (
          <form
            className="cc-input"
            onSubmit={(e) => {
              e.preventDefault();
              void talk(draft);
            }}
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Type your answer…"
              maxLength={600}
              aria-label="Your message"
              disabled={busy}
            />
            <SpeechInput
              label="Speak"
              onStart={() => (speechBase.current = draft.trim() ? draft.trimEnd() + ' ' : '')}
              onText={(t) => setDraft(speechBase.current + t)}
            />
            <button type="submit" className="cc-send-btn" disabled={busy || !draft.trim()} aria-label="Send">
              ↑
            </button>
          </form>
        )}
      </section>
      {/* Phone: the opened request, below the chat rather than squeezed inside
          it — the chat has a fixed height, and a card nested in it had to be
          scrolled in a sliver of screen to reach its send button. */}
      {openCard && (
        <div className="cc-card-mobile" ref={mobileCard}>
          {card}
        </div>
      )}
      <div className="cc-card-desk">{card}</div>
    </div>
  );
}
