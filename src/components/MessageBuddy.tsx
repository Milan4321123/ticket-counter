'use client';

// "Sathi" — the little Nepali character in the corner who carries a message
// to the MartNepali team. Two questions and done: your email, then what you
// want to say. It files a 'general' enquiry through the same POST /api/contact
// as the contact page, so it lands in /admin/contact and the team's inbox.
//
// Where it appears is an ALLOWLIST by exclusion of pages that already have a
// helper in this corner (an event's own chat, the organizer assistant) and
// every page that shows money or credentials. Beside an organizer's IBAN the
// platform's own face would read as the platform vouching for — or holding —
// that money; questions about an order belong to its organizer.
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { blurOnTouch, focusUnlessTouch, touchScreen } from '@/lib/chatScroll';

const HIDDEN_ON = [
  /^\/e\//, // the event's own chat bubble lives here
  /^\/organizers/, // the organizer assistant + "Talk to Milan" bubble
  /^\/portal/,
  /^\/admin/,
  /^\/scan/,
  /^\/checkout/,
  /^\/order/,
  /^\/basket/,
  /^\/ticket/,
  /^\/c\//,
  /^\/contact/,
  /^\/demo/,
  /^\/offline/,
  /^\/inbox/,
  /^\/bhetghat\/m\//, // the meetup's group chat has its own input at the bottom
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_MESSAGE = 10;
const MAX_MESSAGE = 6000;
const GREETED_KEY = 'mn-sathi-greeted';

type Step = 'email' | 'message' | 'sending' | 'sent';
interface Line {
  from: 'sathi' | 'you';
  text: string;
  tone?: 'error';
}

/** The character. Everything that moves is a class the CSS animates. */
function Sathi({ waving = false }: { waving?: boolean }) {
  return (
    <svg className={`sathi${waving ? ' is-waving' : ''}`} viewBox="0 0 64 64" aria-hidden="true">
      {/* body — a daura with its crossed ties */}
      <g className="sathi-body">
        <path d="M14 62c0-12 8-19 18-19s18 7 18 19Z" fill="#f4ecd8" />
        <path d="M32 44 23 54M32 44l9 10" stroke="#c9b892" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M32 44v18" stroke="#dccfae" strokeWidth="1.2" />
        <path d="M24 49c-3 2-4 3-4 5M40 49c3 2 4 3 4 5" stroke="#dc143c" strokeWidth="1.2" strokeLinecap="round" />
      </g>
      {/* the waving hand, and the envelope it sends off */}
      <g className="sathi-arm">
        <path d="M46 52c3-4 5-9 6-14" stroke="#f4ecd8" strokeWidth="6" strokeLinecap="round" fill="none" />
        <circle cx="52.5" cy="36" r="4" fill="#c98d5e" />
      </g>
      <g className="sathi-letter">
        <rect x="47" y="20" width="12" height="8.5" rx="1.6" fill="#fff" />
        <path d="m47.6 20.8 5.4 4.2 5.4-4.2" stroke="#dc143c" strokeWidth="1.3" fill="none" strokeLinejoin="round" />
      </g>
      <g className="sathi-head">
        {/* face */}
        <circle cx="32" cy="30" r="14" fill="#c98d5e" />
        <circle cx="18.6" cy="31" r="2.4" fill="#b97c4f" />
        <circle cx="45.4" cy="31" r="2.4" fill="#b97c4f" />
        {/* Dhaka topi: the tilted cap with its woven triangles */}
        <g className="sathi-topi">
          <path d="M18.5 21.5 21 9.5c7-2.6 15-2.6 22 0l2.5 12c-9-2.2-18-2.2-27 0Z" fill="#1f2a6b" />
          <path
            d="m21.5 18 3-4.6 3 4.6Zm6 0 3-4.6 3 4.6Zm6 0 3-4.6 3 4.6ZM23 12.4l2.4 3 2.4-3Zm6 0 2.4 3 2.4-3Zm6 0 2.4 3 2.4-3Z"
            fill="#dc143c"
          />
          <path d="m24.5 18.6 1.6-2.4 1.6 2.4Zm6 0 1.6-2.4 1.6 2.4Zm6 0 1.6-2.4 1.6 2.4Z" fill="#fbbf24" />
          <path d="M18.5 21.5c9-2.2 18-2.2 27 0" stroke="#11173f" strokeWidth="1.4" fill="none" />
        </g>
        {/* eyes blink, cheeks glow, a small smile */}
        <g className="sathi-eyes" fill="#1b1410">
          <ellipse cx="26.5" cy="30" rx="1.9" ry="2.3" />
          <ellipse cx="37.5" cy="30" rx="1.9" ry="2.3" />
        </g>
        <circle cx="23" cy="35" r="2.4" fill="#ef7a7a" opacity="0.55" />
        <circle cx="41" cy="35" r="2.4" fill="#ef7a7a" opacity="0.55" />
        <path d="M28.5 36.5c2 2.2 5 2.2 7 0" stroke="#5a2e1a" strokeWidth="1.6" strokeLinecap="round" fill="none" />
        {/* tika */}
        <ellipse cx="32" cy="24.6" rx="1.1" ry="1.7" fill="#dc143c" />
      </g>
    </svg>
  );
}

export default function MessageBuddy({ brand }: { brand: string }) {
  const pathname = usePathname() || '';
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [greet, setGreet] = useState(false);
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [input, setInput] = useState('');
  const [website, setWebsite] = useState(''); // honeypot
  const [lines, setLines] = useState<Line[]>([]);
  const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  const hidden = HIDDEN_ON.some((re) => re.test(pathname));

  useEffect(() => setMounted(true), []);

  // Says namaste once per visit, a few seconds in, then goes quiet again.
  useEffect(() => {
    if (hidden || open) return;
    let seen = false;
    try {
      seen = sessionStorage.getItem(GREETED_KEY) === '1';
    } catch {
      /* private mode: greet anyway, it is harmless */
    }
    if (seen) return;
    const show = window.setTimeout(() => {
      setGreet(true);
      try {
        sessionStorage.setItem(GREETED_KEY, '1');
      } catch {
        /* ignore */
      }
    }, 3500);
    const hide = window.setTimeout(() => setGreet(false), 11000);
    return () => {
      window.clearTimeout(show);
      window.clearTimeout(hide);
    };
  }, [hidden, open]);

  // Close on navigation to a page where it does not belong.
  useEffect(() => {
    if (hidden) setOpen(false);
  }, [hidden]);

  useEffect(() => {
    if (!open) return;
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' });
  }, [lines, open, step]);

  useEffect(() => {
    if (open && (step === 'email' || step === 'message')) focusUnlessTouch(inputRef.current);
  }, [open, step]);

  if (!mounted || hidden) return null;

  function start() {
    setGreet(false);
    setOpen(true);
    if (lines.length === 0) {
      setLines([
        { from: 'sathi', text: `Namaste! 🙏 I'm Sathi from ${brand}. I'll pass your message to the team.` },
        { from: 'sathi', text: 'First — what is your email, so they can write back to you?' },
      ]);
    }
  }

  function say(...add: Line[]) {
    setLines((l) => [...l, ...add]);
  }

  function submitEmail() {
    const value = input.trim();
    if (!EMAIL_RE.test(value) || value.length > 200) {
      say({ from: 'sathi', text: 'Hmm, that does not look like an email. Try again? (like name@gmail.com)', tone: 'error' });
      return;
    }
    setEmail(value);
    setInput('');
    say({ from: 'you', text: value }, { from: 'sathi', text: 'Dhanyabad! Now write your message — anything at all.' });
    setStep('message');
  }

  async function submitMessage() {
    const message = input.trim();
    if (message.length < MIN_MESSAGE) {
      say({ from: 'sathi', text: 'A little more, please — one sentence is enough.', tone: 'error' });
      return;
    }
    say({ from: 'you', text: message });
    setInput('');
    setStep('sending');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'general', email, message, website }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || 'Could not send — please try again.');
      say({ from: 'sathi', text: `Sent! ✉️ The team will reply to ${email}. Pheri bhetaula!` });
      setStep('sent');
    } catch (e) {
      say({ from: 'sathi', text: e instanceof Error ? e.message : 'Could not send — please try again.', tone: 'error' });
      setInput(message);
      setStep('message');
    }
  }

  function restart() {
    setLines([{ from: 'sathi', text: 'Another message? Write it below.' }]);
    setStep('message');
  }

  if (!open) {
    return createPortal(
      <div className="sathi-dock no-print">
        {greet && (
          <button type="button" className="sathi-greet" onClick={start}>
            Namaste! 🙏 <strong>Message us?</strong>
          </button>
        )}
        <button
          type="button"
          className="sathi-fab"
          aria-label={`Send a message to the ${brand} team`}
          title="Message us"
          onClick={start}
        >
          <Sathi waving={greet} />
        </button>
      </div>,
      document.body
    );
  }

  const typing = step === 'email' || step === 'message';
  return createPortal(
    <div
      className="chat-panel sathi-panel no-print"
      role="dialog"
      aria-label={`Message the ${brand} team`}
      onKeyDown={(e) => {
        if (e.key === 'Escape') setOpen(false);
      }}
    >
      <div className="chat-head sathi-head-row">
        <span className="sathi-avatar">
          <Sathi />
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="chat-head-title">Sathi · message us</div>
          <div className="chat-head-sub">A real person replies by email</div>
        </div>
        <button type="button" className="chat-close" aria-label="Close" onClick={() => setOpen(false)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="chat-body" ref={bodyRef} aria-live="polite">
        {lines.map((l, i) => (
          <div
            key={i}
            className={`chat-bubble ${l.from === 'you' ? 'chat-bubble-user' : 'chat-bubble-assistant'}${
              l.tone === 'error' ? ' chat-bubble-error' : ''
            } sathi-line`}
            translate={l.from === 'you' ? 'no' : undefined}
          >
            {l.text}
          </div>
        ))}
        {step === 'sending' && (
          <div className="chat-bubble chat-bubble-assistant chat-typing" role="status" aria-label="Sending…">
            <span className="chat-typing-dot" />
            <span className="chat-typing-dot" />
            <span className="chat-typing-dot" />
          </div>
        )}
        {step === 'sent' && (
          <button type="button" className="chat-inline-link sathi-again" onClick={restart}>
            Send another message
          </button>
        )}
      </div>

      {typing && (
        <form
          className="chat-input-row sathi-input-row"
          // Our own friendly "that does not look like an email" instead of the
          // browser's tooltip.
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (step === 'email') submitEmail();
            else {
              blurOnTouch(inputRef.current);
              void submitMessage();
            }
          }}
        >
          {/* Honeypot: off-screen, out of the tab order; only bots fill it. */}
          <input
            className="sathi-hp"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            name="website"
          />
          {step === 'email' ? (
            <input
              ref={inputRef}
              className="input"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="you@example.com"
              aria-label="Your email"
              maxLength={200}
            />
          ) : (
            <textarea
              ref={inputRef}
              className="input sathi-textarea"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !touchScreen()) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
              placeholder="Write your message…"
              aria-label="Your message"
              maxLength={MAX_MESSAGE}
              rows={2}
            />
          )}
          <button
            type="submit"
            className="btn btn-brand chat-send"
            aria-label={step === 'email' ? 'Next' : 'Send message'}
            title={step === 'email' ? 'Next' : 'Send'}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </form>
      )}
      {/* Information, not an "I agree" tick: answering is what they asked for
          (Art. 6(1)(b) GDPR) — same note as the contact form. */}
      <p className="sathi-privacy">
        Only the team reads it, only to answer you — no mailing list.{' '}
        <a href="/privacy" target="_blank" rel="noopener">
          Privacy
        </a>
      </p>
    </div>,
    document.body
  );
}
