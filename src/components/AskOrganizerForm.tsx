'use client';

import { useState } from 'react';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_QUESTION = 500;

/**
 * "Ask the organizer" — the contact form on an event page.
 *
 * The chat assistant already answers what the organizer has written down, and
 * can pass a question on. But a chat bubble is a thing you have to notice and
 * open, and plenty of people will not talk to a robot about whether their kids
 * can come. This is the plain form for them: visible in the page, no
 * conversation, no account.
 *
 * The email address is OPTIONAL and that is the point. Without one the question
 * is still answered publicly on this page, exactly as before. With one, the
 * answer is also sent to them — because nobody re-opens an event page days
 * later on the chance that the thing they asked has been answered, which meant
 * the answer used to reach everyone except the person who wanted it.
 *
 * Giving an address turns this into personal data, so the consent tick appears
 * only when there is something to consent to, and gates the send.
 */
export default function AskOrganizerForm({
  eventId,
  organizerName,
}: {
  eventId: string;
  organizerName: string;
}) {
  const [question, setQuestion] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [privacyAck, setPrivacyAck] = useState(false);
  // Honeypot — invisible to people, irresistible to form-filling bots. Same
  // trick the contact form uses.
  const [website, setWebsite] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ willEmail: boolean } | null>(null);

  const trimmedEmail = email.trim();
  const emailGiven = trimmedEmail.length > 0;
  const emailOk = !emailGiven || EMAIL_RE.test(trimmedEmail);
  const questionOk = question.trim().length >= 3;
  // The tick is required only when an address was actually typed — demanding
  // consent for data nobody gave would be theatre.
  const consentOk = !emailGiven || privacyAck;
  const ready = questionOk && emailOk && consentOk;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !ready) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/events/${eventId}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: question.trim(),
          // Straight to the organizer, no AI in between: someone who fills in a
          // contact form is asking a person, and answering them with a robot
          // instead is not what they asked for.
          escalate: true,
          askerName: name.trim(),
          askerEmail: trimmedEmail,
          privacyAck,
          website,
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | { kind?: string; message?: string; willEmail?: boolean; error?: string }
        | null;
      if (!res.ok) {
        setError(data?.error ?? 'Something went wrong — please try again.');
        setBusy(false);
        return;
      }
      setSent({ willEmail: Boolean(data?.willEmail) });
      setBusy(false);
    } catch {
      setError('Could not reach the server — please check your connection and try again.');
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="card glow-card" id="ask">
        <div className="card-title">Thanks — that is with {organizerName}</div>
        <p className="muted small" style={{ marginTop: 0, marginBottom: 0 }}>
          {sent.willEmail ? (
            <>
              They will answer it here on this page, and we will <strong>email you their answer</strong> as
              soon as they do. That is the only email we will send you about it.
            </>
          ) : (
            <>
              They will answer it here on this page — check back in a day or so. Next time you can leave
              your email and we will send you the answer instead.
            </>
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="card glow-card" id="ask">
      <div className="card-title">Ask {organizerName} a question</div>
      <p className="muted small" style={{ marginTop: 0 }}>
        Anything the page does not cover — parking, food, whether it suits children, accessibility. It goes
        straight to the organizer, and their answer appears here for everyone.
      </p>

      <form onSubmit={submit}>
        <label className="field-label" htmlFor="ask-question">
          Your question
        </label>
        <textarea
          id="ask-question"
          className="input"
          rows={3}
          maxLength={MAX_QUESTION}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Is there parking nearby? Can I bring my 8-year-old?"
          style={{ resize: 'vertical', fontFamily: 'inherit' }}
        />

        <div className="ask-form-row">
          <div>
            <label className="field-label" htmlFor="ask-name">
              Your name <span className="muted">(optional)</span>
            </label>
            <input
              id="ask-name"
              className="input"
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
          </div>
          <div>
            <label className="field-label" htmlFor="ask-email">
              Email for the answer <span className="muted">(optional)</span>
            </label>
            <input
              id="ask-email"
              className="input"
              type="email"
              value={email}
              maxLength={160}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="you@example.com"
            />
          </div>
        </div>
        <p className="muted small" style={{ margin: '6px 0 0' }}>
          Leave the email blank to ask anonymously — the answer still appears on this page.
        </p>

        {emailGiven && !emailOk && (
          <p className="small" style={{ color: 'var(--red, #f87171)', margin: '8px 0 0' }}>
            That email address does not look right — please check it.
          </p>
        )}

        {/* Appears only once an address has been typed: there is nothing to
            consent to until there is. */}
        {emailGiven && (
          <label className="checkbox-row ask-form-consent">
            <input
              type="checkbox"
              checked={privacyAck}
              onChange={(e) => setPrivacyAck(e.target.checked)}
              disabled={busy}
            />
            <span>
              <strong>I agree</strong> that my name and email may be passed to the organizer so they can
              answer me, and that they are erased after the event.{' '}
              <a href="/privacy" target="_blank" rel="noopener" style={{ color: 'var(--accent)' }}>
                Privacy · Datenschutz
              </a>
            </span>
          </label>
        )}

        <div
          aria-hidden="true"
          style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, overflow: 'hidden' }}
        >
          <label htmlFor="ask-website">Leave this field empty</label>
          <input
            id="ask-website"
            name="website"
            type="text"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            tabIndex={-1}
            autoComplete="off"
          />
        </div>

        {error && (
          <div className="notice notice-error" role="alert" style={{ marginTop: 12 }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          className="btn btn-primary btn-block"
          style={{ marginTop: 14 }}
          disabled={busy || !ready}
        >
          {busy ? (
            <>
              <span className="spinner" aria-hidden /> Sending…
            </>
          ) : (
            'Send my question'
          )}
        </button>
        {!ready && !busy && (
          <p className="muted small" style={{ margin: '8px 0 0', textAlign: 'center' }}>
            {!questionOk
              ? 'Type your question to continue.'
              : !emailOk
                ? 'Check the email address to continue.'
                : 'Tick the box to continue — we cannot take your email without it.'}
          </p>
        )}
      </form>
    </div>
  );
}
