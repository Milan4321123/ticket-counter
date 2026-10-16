'use client';

// A conversation between people — a meetup's group chat or a one-to-one
// thread about a help post or a profile. Polls for new messages while the
// page is open (every few seconds while visible, rarely when not), keeps the
// newest message in view when the reader is already at the bottom, and never
// pops the keyboard by itself (lib/chatScroll).
//
// Messages are shown as plain text — no links are made clickable, so a
// stranger's message cannot dress a scam link up as a button.
import { useCallback, useEffect, useRef, useState } from 'react';
import { focusUnlessTouch, touchScreen } from '@/lib/chatScroll';
import ReportButton from './ReportButton';

export interface ThreadMessage {
  id: number;
  body: string;
  createdAt: string;
  mine: boolean;
  name?: string;
  handle?: string;
  host?: boolean;
}

interface Props {
  /** GET `${endpoint}?after=<id>` lists newer messages; POST {body} sends, {deleteId} deletes. */
  endpoint: string;
  initial: ThreadMessage[];
  reportType: 'meetup_message' | 'message';
  /** A group chat shows who wrote each message. */
  group: boolean;
  /** Set when nobody can write any more, with the reason. */
  closed?: string;
  placeholder?: string;
  empty?: string;
}

// Times are shown in the READER's clock and locale, which only the browser
// knows — so they are filled in after hydration, never on the server (whose
// clock is UTC on the host and whose locale is not the reader's).
function time(createdAt: string): string {
  const d = new Date(`${createdAt.replace(' ', 'T')}Z`);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function day(createdAt: string): string {
  const d = new Date(`${createdAt.replace(' ', 'T')}Z`);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
}

export default function ChatThread({ endpoint, initial, reportType, group, closed, placeholder = 'Write a message…', empty }: Props) {
  const [messages, setMessages] = useState<ThreadMessage[]>(initial);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLTextAreaElement>(null);
  const lastId = useRef(initial.length ? initial[initial.length - 1].id : 0);
  const atBottom = useRef(true);

  const scrollDown = useCallback((smooth: boolean) => {
    const log = logRef.current;
    if (log) requestAnimationFrame(() => log.scrollTo({ top: log.scrollHeight, behavior: smooth ? 'smooth' : 'auto' }));
  }, []);

  useEffect(() => {
    setMounted(true);
    scrollDown(false);
    focusUnlessTouch(boxRef.current);
  }, [scrollDown]);

  const merge = useCallback(
    (incoming: ThreadMessage[]) => {
      if (!incoming.length) return;
      setMessages((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        const add = incoming.filter((m) => !seen.has(m.id));
        return add.length ? [...prev, ...add] : prev;
      });
      lastId.current = Math.max(lastId.current, ...incoming.map((m) => m.id));
      if (atBottom.current) scrollDown(true);
    },
    [scrollDown]
  );

  // Poll: every 4 s while the tab is visible, every 30 s while it is not.
  useEffect(() => {
    let live = true;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const res = await fetch(`${endpoint}?after=${lastId.current}`, { cache: 'no-store' });
        if (res.ok) {
          const data = (await res.json()) as { messages?: ThreadMessage[] };
          if (live && data.messages) merge(data.messages);
        }
      } catch {
        /* offline for a moment — try again on the next tick */
      }
      if (live) timer = setTimeout(tick, document.visibilityState === 'visible' ? 4000 : 30000);
    };
    timer = setTimeout(tick, 4000);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [endpoint, merge]);

  function onScroll() {
    const log = logRef.current;
    if (log) atBottom.current = log.scrollHeight - log.scrollTop - log.clientHeight < 80;
  }

  async function send() {
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body }) });
      const data = (await res.json().catch(() => ({}))) as { error?: string; message?: ThreadMessage };
      if (!res.ok || !data.message) throw new Error(data.error || 'Not sent — try again.');
      setText('');
      atBottom.current = true;
      merge([data.message]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: number) {
    const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deleteId: id }) });
    if (res.ok) setMessages((prev) => prev.filter((m) => m.id !== id));
  }

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends with a keyboard; on a phone Enter is a new line and the button sends.
    if (e.key === 'Enter' && !e.shiftKey && !touchScreen()) {
      e.preventDefault();
      void send();
    }
  }

  let lastDay = '';
  return (
    <div className="ct">
      <div className="ct-log" ref={logRef} onScroll={onScroll} aria-live="polite">
        {messages.length === 0 && <p className="ct-empty muted">{empty ?? 'No messages yet — say namaste!'}</p>}
        {messages.map((m) => {
          const d = mounted ? day(m.createdAt) : '';
          const divider = d && d !== lastDay ? d : '';
          lastDay = d || lastDay;
          return (
            <div key={m.id}>
              {divider && <p className="ct-day">{divider}</p>}
              <div className={`ct-msg${m.mine ? ' ct-mine' : ''}`}>
                {group && !m.mine && (
                  <p className="ct-name" translate="no">
                    {m.name}
                    {m.host ? <span className="ct-host">host</span> : null}
                  </p>
                )}
                <p className="ct-body">{m.body}</p>
                <div className="ct-meta">
                  <span>{mounted ? time(m.createdAt) : ''}</span>
                  {m.mine ? (
                    <button type="button" className="cm-link-btn" onClick={() => remove(m.id)}>
                      Delete
                    </button>
                  ) : (
                    <ReportButton type={reportType} id={String(m.id)} handle={m.handle} compact />
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {closed ? (
        <p className="ct-closed muted small">{closed}</p>
      ) : (
        <div className="ct-compose">
          <textarea
            ref={boxRef}
            className="input ct-input"
            rows={1}
            maxLength={1500}
            value={text}
            placeholder={placeholder}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKey}
            aria-label="Message"
          />
          <button type="button" className="btn btn-brand ct-send" onClick={send} disabled={busy || !text.trim()}>
            {busy ? '…' : 'Send'}
          </button>
        </div>
      )}
      {error && (
        <p className="notice notice-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
