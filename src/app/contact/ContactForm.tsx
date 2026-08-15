'use client';

import { useState } from 'react';

interface Props {
  /** Shown in the success state so people know where to follow up. */
  contactEmail: string;
  /**
   * What this visitor came for. 'organizer-account' is someone who wants to
   * sell tickets here (the "Get started" path); the default is someone asking
   * for a custom-designed page. It only changes the prompt and how the enquiry
   * is filed — the form itself is the same.
   */
  intent?: 'custom-design' | 'organizer-account';
}

interface ContactResponse {
  ok?: boolean;
  error?: string;
}

/** Off-screen but still focusable-by-bots honeypot field. */
const HONEYPOT_STYLE: React.CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clipPath: 'inset(50%)',
  whiteSpace: 'nowrap',
  border: 0,
};

/**
 * "Design my page for me" enquiry form. Posts to /api/contact, which stores the
 * request and emails both us and the sender. On success the whole form is
 * replaced by a thank-you so nobody sends the same thing twice.
 */
export default function ContactForm({ contactEmail, intent = 'custom-design' }: Props) {
  const wantsAccount = intent === 'organizer-account';
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [organization, setOrganization] = useState('');
  const [message, setMessage] = useState('');
  // Account applications only: what the owner needs to judge one without a
  // round of emails first. Every one of them is optional.
  const [phone, setPhone] = useState('');
  const [eventKind, setEventKind] = useState('');
  const [eventWhen, setEventWhen] = useState('');
  const [eventWhere, setEventWhere] = useState('');
  const [expectedPeople, setExpectedPeople] = useState('');
  const [website, setWebsite] = useState(''); // honeypot — must stay empty
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const nameValue = name.trim();
    const emailValue = email.trim();
    const messageValue = message.trim();
    if (!nameValue || !emailValue) {
      setError('Please fill in your name and email so we can reply.');
      return;
    }
    if (messageValue.length < 10) {
      setError('Please tell us a bit more about what you would like — a sentence or two is plenty.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: nameValue,
          email: emailValue,
          organization: organization.trim(),
          message: messageValue,
          kind: intent,
          ...(wantsAccount
            ? {
                phone: phone.trim(),
                eventKind: eventKind.trim(),
                eventWhen: eventWhen.trim(),
                eventWhere: eventWhere.trim(),
                expectedPeople: expectedPeople.trim(),
              }
            : {}),
          website,
        }),
      });
      const data = (await res.json().catch(() => null)) as ContactResponse | null;
      if (res.ok && data?.ok) {
        setSent(true);
        return;
      }
      setError(data?.error || 'Something went wrong. Please try again.');
      setBusy(false);
    } catch {
      setError('Could not reach the server. Please check your connection and try again.');
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="anim-fade-up" style={{ textAlign: 'center', padding: '10px 0' }}>
        <div className="badge badge-green" style={{ marginBottom: 12 }}>
          Message sent
        </div>
        <h2 className="card-title" style={{ margin: '0 0 6px' }}>
          Thanks — we&rsquo;ll be in touch
        </h2>
        <p className="muted small" style={{ margin: '0 auto', maxWidth: 380 }}>
          {wantsAccount ? (
            <>
              A real person reads every application. If it all looks right we set your account up
              and email your sign-in details to <strong>{email.trim()}</strong> — usually within a
              couple of days.
            </>
          ) : (
            <>
              Your request landed with our team and a real person will reply to{' '}
              <strong>{email.trim()}</strong> within a couple of days.
            </>
          )}{' '}
          Anything to add in the meantime? Write to{' '}
          <a href={`mailto:${contactEmail}`} style={{ color: 'var(--brand-text)', fontWeight: 600 }}>
            {contactEmail}
          </a>
          .
        </p>
      </div>
    );
  }

  return (
    <form className="anim-fade-up" onSubmit={submit}>
      {error && <div className="notice notice-error">{error}</div>}

      <div className="field">
        <label htmlFor="contact-name">Your name</label>
        <input
          id="contact-name"
          className="input"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={120}
          autoComplete="name"
          placeholder="e.g. Sabina Gurung"
        />
      </div>

      <div className="field">
        <label htmlFor="contact-email">Email</label>
        <input
          id="contact-email"
          className="input"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          maxLength={200}
          autoComplete="email"
          spellCheck={false}
          placeholder="you@example.com"
        />
        <p className="muted small" style={{ margin: '6px 0 0' }}>
          This is where our reply goes — we don&rsquo;t add you to any mailing list.
        </p>
      </div>

      <div className="field">
        <label htmlFor="contact-org">
          Organization or promoter <span className="muted">(optional)</span>
        </label>
        <input
          id="contact-org"
          className="input"
          type="text"
          value={organization}
          onChange={(e) => setOrganization(e.target.value)}
          maxLength={160}
          autoComplete="organization"
          placeholder="e.g. Himalayan Nights Events"
        />
      </div>

      {wantsAccount && (
        <>
          <div className="field">
            <label htmlFor="contact-phone">
              Phone <span className="muted">(optional)</span>
            </label>
            <input
              id="contact-phone"
              className="input"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={60}
              autoComplete="tel"
              placeholder="e.g. +49 170 1234567"
            />
            <p className="muted small" style={{ margin: '6px 0 0' }}>
              Only if you would rather we called than wrote — email works fine too.
            </p>
          </div>

          <div className="field">
            <label htmlFor="contact-event-kind">
              What kind of event <span className="muted">(optional)</span>
            </label>
            <input
              id="contact-event-kind"
              className="input"
              type="text"
              value={eventKind}
              onChange={(e) => setEventKind(e.target.value)}
              maxLength={160}
              placeholder="e.g. Nepali cultural night"
            />
          </div>

          <div
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', columnGap: 16 }}
          >
            <div className="field">
              <label htmlFor="contact-event-when">
                When <span className="muted">(optional)</span>
              </label>
              <input
                id="contact-event-when"
                className="input"
                type="text"
                value={eventWhen}
                onChange={(e) => setEventWhen(e.target.value)}
                maxLength={160}
                placeholder="e.g. Saturday 8 November 2026"
              />
            </div>
            <div className="field">
              <label htmlFor="contact-expected-people">
                How many people <span className="muted">(optional)</span>
              </label>
              <input
                id="contact-expected-people"
                className="input"
                type="text"
                value={expectedPeople}
                onChange={(e) => setExpectedPeople(e.target.value)}
                maxLength={60}
                placeholder="e.g. about 300"
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="contact-event-where">
              Where <span className="muted">(optional)</span>
            </label>
            <input
              id="contact-event-where"
              className="input"
              type="text"
              value={eventWhere}
              onChange={(e) => setEventWhere(e.target.value)}
              maxLength={200}
              placeholder="e.g. Kulturhaus Mitte, Berlin"
            />
            <p className="muted small" style={{ margin: '6px 0 0' }}>
              A rough answer is fine everywhere here — nothing is fixed by writing it down, and you
              can change it all later in your portal.
            </p>
          </div>
        </>
      )}

      <div className="field">
        <label htmlFor="contact-message">
          {wantsAccount ? 'Tell us about your event' : 'What would you like?'}
        </label>
        <textarea
          id="contact-message"
          className="input"
          rows={6}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={2000}
          placeholder={
            wantsAccount
              ? 'For example: we run a Nepali cultural night in Frankfurt twice a year and we want to sell tickets online instead of collecting cash at the door. We usually have two singers and a dance group, tickets around €20, and a student price. This is our fourth one.'
              : 'For example: a custom-designed event page for our autumn concert, a landing page for a two-day festival, sponsor logos across the top, help importing our photos and videos…'
          }
          style={{ resize: 'vertical', fontFamily: 'inherit' }}
        />
        <p className="muted small" style={{ margin: '6px 0 0' }}>
          {wantsAccount
            ? 'Who you are, what you are putting on, and anything that helps us see it is real — a few sentences is plenty. A person reads this, and if it all looks right we set your account up and email you the sign-in details.'
            : 'Dates, budget, and a link to anything you like the look of all help — but a couple of sentences is a perfectly good start.'}
        </p>
      </div>

      {/* Honeypot: invisible to people, irresistible to bots. */}
      <div style={HONEYPOT_STYLE} aria-hidden="true">
        <label htmlFor="contact-website">Leave this field empty</label>
        <input
          id="contact-website"
          name="website"
          type="text"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <button type="submit" className="btn btn-brand btn-block btn-lg" disabled={busy}>
        {busy ? <span className="spinner" aria-hidden /> : null}
        {busy ? 'Sending…' : wantsAccount ? 'Send your application' : 'Send your request'}
      </button>
    </form>
  );
}
