'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import SpeechInput from './SpeechInput';
import { blurOnTouch, focusUnlessTouch, scrollChat } from '@/lib/chatScroll';

const MAX_QUESTION = 500;
const MIN_QUESTION = 3;

/**
 * "Yes, ask them" in the languages this audience actually types.
 *
 * Nepali speakers in Germany answer in romanized Nepali, German or English
 * interchangeably, so all three are here. Matching is deliberately strict —
 * the WHOLE message must be an agreement — because anything looser would eat
 * a real follow-up question that merely starts with "ok".
 */
const AFFIRMATIVE =
  /^(y|ye|yes|yes please|yeah|yep|yup|ok|okay|sure|please|please do|do it|go ahead|send it|send|ja|jo|ho|hos|hunchha|huncha|haan|han|hajur|thik|thik cha|thik chha)[.!]*$/i;

const NEGATIVE = /^(n|no|nope|nah|no thanks|no thank you|nein|hoina|pardaina|chaidaina|never mind|nevermind)[.!]*$/i;

/** Strip punctuation/spacing so "Yes!" and " yes " both match. */
function isAffirmative(text: string): boolean {
  return AFFIRMATIVE.test(text.trim());
}

function isNegative(text: string): boolean {
  return NEGATIVE.test(text.trim());
}

export interface ChatWidgetProps {
  /** Panel heading, also the dialog's accessible name. */
  title: string;
  /** Small line under the heading. */
  subtitle?: string;
  /** Input placeholder. */
  placeholder?: string;
  /** POST target; receives {question, ...extraBody} as JSON. */
  endpoint: string;
  /** Extra JSON fields merged into every request body. */
  extraBody?: Record<string, unknown>;
}

type Tone = 'normal' | 'muted' | 'error';

interface Msg {
  role: 'user' | 'assistant';
  text: string;
  tone?: Tone;
  /**
   * The question this message was a reply to, when the assistant could not
   * answer it. Its presence renders the "send it to the organizer" link —
   * passing a question to a human is the VISITOR's choice, never automatic, so
   * nobody's queue fills with questions nobody actually wanted answered.
   */
  escalatable?: string;
  /** Set once they used that link, so the same one cannot be sent twice. */
  escalated?: boolean;
  /**
   * Where "yes" should take them instead of filing the question here. The event
   * assistant hands questions to the organizer, who answers them in their
   * portal; the platform assistant has no such inbox, so its unanswered
   * questions go to the contact form rather than into a void.
   */
  escalateHref?: string;
  escalateLabel?: string;
  /** Next steps offered under an answer — "Get tickets", "Talk to us". */
  links?: { label: string; href: string }[];
}

function ChatIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8.5 12h.01M12 12h.01M15.5 12h.01"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Floating Siri-style assistant: a small brand-gradient bubble in the corner
 * that expands into a chat panel. One-shot Q&A protocol — each send POSTs
 * {question} to `endpoint` and renders {kind:'answered',answer} directly, or
 * the endpoint's message for unsure/escalated outcomes. Voice input comes
 * free via the browser's Web Speech API (mic hides itself when unsupported).
 */
export default function ChatWidget({ title, subtitle, placeholder, endpoint, extraBody }: ChatWidgetProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Portals need the DOM: only render after the client has mounted.
  useEffect(() => setMounted(true), []);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  // Text that was in the input when dictation started; live transcript is
  // rendered after it so interim words refine in place.
  const speechBase = useRef('');

  useEffect(() => {
    // The keyboard only when they tap the box (lib/chatScroll).
    if (open) focusUnlessTouch(inputRef.current);
  }, [open]);

  // Keep the newest answer in view — from its start, under the question.
  useEffect(() => {
    if (open) scrollChat(bodyRef.current, '.chat-bubble-user', busy, false);
  }, [messages, busy, open]);

  /**
   * The question the assistant just offered to pass on, waiting for a yes.
   * Held here rather than on the message so a plain "yes" typed into the box
   * resolves it — the visitor should be able to answer in the conversation
   * instead of hunting for a control.
   */
  const [pendingAsk, setPendingAsk] = useState<string | null>(null);

  function pushAssistant(text: string, tone: Tone = 'normal', escalatable?: string) {
    setMessages((m) => [...m, { role: 'assistant', text, tone, escalatable }]);
  }

  /** Hand one unanswered question to the organizer, on the visitor's say-so. */
  async function escalate(index: number, question: string) {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, escalate: true, ...(extraBody ?? {}) }),
      });
      const data = (await res.json().catch(() => null)) as { message?: string; error?: string } | null;
      // Retire every outstanding offer either way: one that still looks
      // clickable after a failure invites the visitor to file the same
      // question repeatedly. index -1 means it was answered conversationally.
      setMessages((m) =>
        m.map((msg, i) => (i === index || (index === -1 && msg.escalatable) ? { ...msg, escalated: true } : msg))
      );
      pushAssistant(
        res.ok
          ? (data?.message ?? 'Sent to the organizer.')
          : (data?.error ?? 'That could not be sent — please try again.'),
        res.ok ? 'muted' : 'error',
      );
    } catch {
      pushAssistant('Could not reach the server — please try again.', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    const question = input.trim();
    if (busy || question.length === 0) return;

    // Answering the assistant's "shall I ask the organizer?" — this is a reply,
    // not a new question, so it never reaches the AI. Checked before the length
    // rule, because "y" and "ho" are shorter than any real question.
    if (pendingAsk) {
      if (isAffirmative(question)) {
        setMessages((m) => [...m, { role: 'user', text: question }]);
        setInput('');
        const target = pendingAsk;
        setPendingAsk(null);
        await escalate(-1, target);
        return;
      }
      if (isNegative(question)) {
        setMessages((m) => [...m, { role: 'user', text: question }]);
        setInput('');
        setPendingAsk(null);
        pushAssistant('No problem — ask me anything else about the event.', 'muted');
        return;
      }
      // Anything else is a fresh question; the offer quietly lapses.
      setPendingAsk(null);
    }

    if (question.length < MIN_QUESTION) return;
    setMessages((m) => [...m, { role: 'user', text: question }]);
    setInput('');
    setBusy(true);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, ...(extraBody ?? {}) }),
      });
      const data = (await res.json().catch(() => null)) as {
        kind?: string;
        answer?: string;
        message?: string;
        error?: string;
        canEscalate?: boolean;
        escalateHref?: string;
        escalateLabel?: string;
        links?: { label: string; href: string }[];
      } | null;
      if (!res.ok) {
        pushAssistant(data?.error ?? 'Something went wrong — please try again.', 'error');
      } else if (data?.kind === 'answered' && typeof data.answer === 'string') {
        const answer = data.answer;
        const links = Array.isArray(data.links)
          ? data.links.filter((l) => l && typeof l.label === 'string' && typeof l.href === 'string' && (l.href.startsWith('/') || l.href.startsWith('#'))).slice(0, 3)
          : [];
        setMessages((m) => [...m, { role: 'assistant', text: answer, tone: 'normal', links }]);
      } else if (data?.kind === 'unclear') {
        // Not a question at all — nearly always a typo or a stray keypress.
        // Ask for another go, and do NOT offer to bother a human with it.
        pushAssistant(
          typeof data?.message === 'string' && data.message
            ? data.message
            : 'Sorry, I did not catch that — it looks like a typo. Try asking it again.',
          'muted',
        );
      } else {
        // Understood, but the event details do not cover it. Ask whether they
        // want a human on it, and remember what "yes" would refer to.
        const base =
          typeof data?.message === 'string' && data.message
            ? data.message
            : 'I could not find that in the event details.';
        if (data?.canEscalate && data.escalateHref) {
          // Nothing to file — point them at the form that reaches a human.
          setMessages((m) => [
            ...m,
            {
              role: 'assistant',
              text: base,
              tone: 'muted',
              escalateHref: data.escalateHref,
              escalateLabel: data.escalateLabel ?? 'Ask the team',
            },
          ]);
        } else if (data?.canEscalate) {
          setPendingAsk(question);
          pushAssistant(`${base} Would you like me to ask the organizer? Reply yes and I will send it.`, 'muted', question);
        } else {
          pushAssistant(base, 'muted');
        }
      }
    } catch {
      pushAssistant(
        'Could not reach the server — please check your connection and try again.',
        'error',
      );
    } finally {
      setBusy(false);
    }
  }

  // Rendered through a portal into <body>: a `position: fixed` element is
  // trapped by ANY ancestor with a transform/animation (the page wrappers use
  // fade-up entrances), which made the bubble scroll away instead of floating.
  // As a direct child of <body> it stays pinned to the viewport everywhere.
  if (!mounted) return null;

  if (!open) {
    return createPortal(
      <button
        type="button"
        className="chat-fab no-print"
        aria-label={`Open chat — ${title}`}
        title={title}
        onClick={() => setOpen(true)}
      >
        <ChatIcon />
        {/* Widens on hover and focus to say what it is, exactly like the
            "talk to a person" bubble above it — two circles in a corner tell
            a visitor nothing about which one answers what. Hidden from
            assistive tech: the button's own label already says it. */}
        <span className="chat-fab-label" aria-hidden="true">
          Ask the assistant
        </span>
      </button>,
      document.body
    );
  }

  return createPortal(
    <div
      className="chat-panel no-print"
      role="dialog"
      aria-label={title}
      onKeyDown={(e) => {
        if (e.key === 'Escape') setOpen(false);
      }}
    >
      <div className="chat-head">
        <div style={{ minWidth: 0 }}>
          <div className="chat-head-title">{title}</div>
          {subtitle ? <div className="chat-head-sub">{subtitle}</div> : null}
        </div>
        <button
          type="button"
          className="chat-close"
          aria-label="Close chat"
          onClick={() => setOpen(false)}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M18 6 6 18M6 6l12 12"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      <div className="chat-body" ref={bodyRef} aria-live="polite">
        {messages.length === 0 && !busy && (
          <div className="chat-bubble chat-bubble-assistant chat-bubble-muted">
            Namaste! Ask away — most questions get an instant answer.
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`chat-bubble ${m.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-assistant'}${
              m.tone === 'muted' ? ' chat-bubble-muted' : ''
            }${m.tone === 'error' ? ' chat-bubble-error' : ''}`}
            // The visitor's own words never go to the page translator.
            translate={m.role === 'user' ? 'no' : undefined}
          >
            {m.text}
            {m.links && m.links.length > 0 && (
              <span className="chat-links">
                {m.links.map((l) => (
                  <a
                    key={l.href}
                    href={l.href}
                    className="chat-link-btn"
                    // A jump within the page ("#tickets") closes the chat so
                    // the visitor actually sees where it took them.
                    onClick={() => l.href.startsWith('#') && setOpen(false)}
                  >
                    {l.label} →
                  </a>
                ))}
              </span>
            )}
            {/* Plain text link rather than a button: this is an offer inside a
                sentence, not an action the visitor came here to take. */}
            {m.escalateHref && (
              <>
                {' '}
                <a className="chat-inline-link" href={m.escalateHref}>
                  {m.escalateLabel}
                </a>
                {' — a real person reads it.'}
              </>
            )}
            {m.escalatable && !m.escalated && (
              <>
                {' '}
                <button
                  type="button"
                  className="chat-inline-link"
                  onClick={() => void escalate(i, m.escalatable as string)}
                  disabled={busy}
                >
                  Send this question to the organizer
                </button>
                {' — they will answer it on this page.'}
              </>
            )}
          </div>
        ))}
        {busy && (
          <div
            className="chat-bubble chat-bubble-assistant chat-typing"
            role="status"
            aria-label="Thinking…"
          >
            <span className="chat-typing-dot" />
            <span className="chat-typing-dot" />
            <span className="chat-typing-dot" />
          </div>
        )}
      </div>

      <form
        className="chat-input-row"
        onSubmit={(e) => {
          e.preventDefault();
          blurOnTouch(inputRef.current);
          void send();
        }}
      >
        <input
          ref={inputRef}
          className="input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={MAX_QUESTION}
          placeholder={placeholder ?? 'Type your question…'}
          aria-label="Your question"
        />
        <SpeechInput
          label="Ask by voice"
          onStart={() => {
            speechBase.current = input.trim() ? input.trimEnd() + ' ' : '';
          }}
          onText={(text) => setInput((speechBase.current + text).slice(0, MAX_QUESTION))}
        />
        <button
          type="submit"
          className="btn btn-brand chat-send"
          disabled={busy || input.trim().length < MIN_QUESTION}
          aria-label="Send question"
          title="Send"
        >
          <SendIcon />
        </button>
      </form>
    </div>
  ,
    document.body
  );
}
