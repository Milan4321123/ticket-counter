'use client';

// "Talk to the creator" — /contact as a conversation instead of a form. The
// assistant (api/contact/chat) asks one short question at a time; beside the
// chat the request fills itself in, line by line. When it is complete, one
// tap (with the privacy tick) sends it to Milan with the conversation — the
// same record and emails the form makes. The form stays below as a fallback.
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
  { key: 'budget', label: 'Budget / timing', icon: '💶' },
  { key: 'looks', label: 'Looks you like', icon: '🎨' },
  { key: 'name', label: 'Your name', icon: '🙂' },
  { key: 'email', label: 'Email', icon: '✉️' },
];
const STORE = 'creator:chat:v1';

export default function CreatorChat({ owner = 'Milan' }: { owner?: string }) {
  const [turns, setTurns] = useState<Turn[]>([{ from: 'bot', text: HELLO }]);
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [ready, setReady] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [consent, setConsent] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [openCard, setOpenCard] = useState(false);
  const log = useRef<HTMLDivElement>(null);
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
    if (!ready || !consent || busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/contact/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: turns, fields, send: true, consent: true }),
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
          <label className="cc-consent">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>
              I agree that these details and this conversation are stored and used to answer my request (read only by the team, no
              mailing list; delete any time). <a href="/privacy" target="_blank" rel="noopener">Privacy</a>
            </span>
          </label>
          <button type="button" className="btn btn-brand btn-lg btn-block" onClick={() => void send()} disabled={!consent || busy}>
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
        <div className="cc-log" ref={log}>
          {turns.map((m, i) => (
            <div key={i} className={`cc-msg cc-${m.from}`}>
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
        {openCard && <div className="cc-card-mobile">{card}</div>}
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
      <div className="cc-card-desk">{card}</div>
    </div>
  );
}
