'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const MAX_ANSWER = 1000;

/**
 * Anything that looks like a link or an address a stranger wants you to visit.
 *
 * Visitor questions are written by anyone on the internet and are read by the
 * organizer in their signed-in portal — the ideal place to put "your account is
 * suspended, confirm at ...". React escapes the text so nothing is clickable,
 * which stops the easy version, but the words are still persuasive on their own
 * and the organizer can retype a URL by hand.
 *
 * So questions carrying one are flagged rather than silently trusted. They are
 * NOT blocked: "is it the venue on hauptstrasse.de?" is a perfectly real
 * question, and refusing it would train people that the form is broken.
 */
const LINKY = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|io|co|de|info|xyz|ru|top|link)\b)/i;

interface OpenQuestion {
  id: string;
  question: string;
  askedAt: string;
  /** '' when asked anonymously — then answering publishes to the page only. */
  askerName: string;
  askerEmail: string;
}

interface Props {
  eventId: string;
  questions: OpenQuestion[];
  answeredCount: number;
}

/**
 * The organizer's inbox for visitor questions the AI assistant could not
 * answer. Publishing an answer puts it in the Questions section of the public
 * event page AND teaches the assistant, so the next visitor who asks the same
 * thing gets an instant answer.
 */
export default function QuestionsPanel({ eventId, questions, answeredCount }: Props) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [doneIds, setDoneIds] = useState<Record<string, 'answered' | 'dismissed'>>({});
  // Whether the answer actually reached the asker. null = there was nobody to
  // email. false = there WAS, and the send failed — which the organizer has to
  // be told, or they walk away believing someone was answered when nobody was.
  const [emailed, setEmailed] = useState<Record<string, boolean | null>>({});

  async function send(questionId: string, payload: Record<string, unknown>, done: 'answered' | 'dismissed') {
    if (busyId !== null) return;
    setBusyId(questionId);
    setErrors((e) => ({ ...e, [questionId]: '' }));
    try {
      const res = await fetch(`/api/portal/events/${eventId}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId, ...payload }),
      });
      const data = (await res.json().catch(() => null)) as
        | { error?: string; emailed?: boolean | null }
        | null;
      if (!res.ok) {
        setErrors((e) => ({ ...e, [questionId]: data?.error ?? 'Something went wrong — please try again.' }));
        setBusyId(null);
        return;
      }
      setDoneIds((d) => ({ ...d, [questionId]: done }));
      setEmailed((m) => ({ ...m, [questionId]: data?.emailed ?? null }));
      setBusyId(null);
      router.refresh();
    } catch {
      setErrors((e) => ({ ...e, [questionId]: 'Could not reach the server — please try again.' }));
      setBusyId(null);
    }
  }

  function publish(q: OpenQuestion) {
    const answer = (drafts[q.id] ?? '').trim();
    if (!answer) {
      setErrors((e) => ({ ...e, [q.id]: 'Write an answer first — it is empty.' }));
      return;
    }
    void send(q.id, { answer }, 'answered');
  }

  function dismiss(q: OpenQuestion) {
    if (
      !window.confirm(
        `Dismiss this question?\n\n“${q.question}”\n\nIt disappears without an answer and the visitor is not notified.`
      )
    ) {
      return;
    }
    void send(q.id, { dismiss: true }, 'dismissed');
  }

  const open = questions.filter((q) => !doneIds[q.id]);
  const justAnswered = Object.values(doneIds).filter((d) => d === 'answered').length;

  if (open.length === 0) {
    return (
      <div>
        {justAnswered > 0 && (
          <p className="small" style={{ margin: '0 0 8px' }}>
            <span className="badge badge-green">
              {justAnswered} answer{justAnswered === 1 ? '' : 's'} published ✓
            </span>
            {Object.values(emailed).some((v) => v === true) && (
              <span className="badge badge-green" style={{ marginLeft: 6 }}>
                asker emailed ✓
              </span>
            )}
            {/* Loud on purpose: the answer is live but the person who asked
                for it was never told, and only the organizer can fix that. */}
            {Object.values(emailed).some((v) => v === false) && (
              <span className="badge badge-amber" style={{ marginLeft: 6 }}>
                published, but the email could not be sent
              </span>
            )}
          </p>
        )}
        <p className="muted small" style={{ margin: 0 }}>
          No open questions — the AI assistant answers most questions automatically.
          {answeredCount > 0
            ? ` ${answeredCount} answered question${answeredCount === 1 ? ' is' : 's are'} live on your event page.`
            : ''}
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <p className="muted small" style={{ margin: 0 }}>
        Answer once — it goes on your page and the assistant learns it for the next person.
      </p>
      {open.map((q) => (
        <div key={q.id} className="qa-card">
          <div className="qa-bubble">{q.question}</div>
          {LINKY.test(q.question) && (
            <div className="notice notice-warn small" style={{ margin: '8px 0 0' }}>
              <strong>This question contains a link or a web address.</strong> Anyone on the internet
              can send you one of these. Do not open it, and do not enter your password anywhere it
              asks you to — we will never ask you to confirm your account through a visitor question.
              If it is not a real question, dismiss it.
            </div>
          )}
          <div className="muted small" style={{ marginTop: 2 }}>
            Asked {q.askedAt.slice(0, 10)}
            {q.askerName ? ` by ${q.askerName}` : ''}
          </div>
          {/* Whether an answer will travel changes how you write it — a reply
              going to one person's inbox reads differently from one published
              to a page of strangers. Say which before they start typing. */}
          <div className="small" style={{ marginTop: 6 }}>
            {q.askerEmail ? (
              <span className="badge badge-green">
                Your answer is emailed to {q.askerEmail}
              </span>
            ) : (
              <span className="badge">Asked anonymously — answer appears on your page only</span>
            )}
          </div>
          <textarea
            className="input qa-answer"
            rows={2}
            maxLength={MAX_ANSWER}
            style={{ marginTop: 10, resize: 'vertical' }}
            placeholder="Write your answer…"
            value={drafts[q.id] ?? ''}
            onChange={(e) => setDrafts((d) => ({ ...d, [q.id]: e.target.value }))}
            disabled={busyId !== null}
            aria-label={`Your answer to: ${q.question}`}
          />
          {errors[q.id] ? (
            <div className="notice notice-error small" style={{ margin: '10px 0 0' }}>
              {errors[q.id]}
            </div>
          ) : null}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 10 }}>
            <button
              type="button"
              className="btn btn-brand btn-sm"
              onClick={() => publish(q)}
              disabled={busyId !== null || (drafts[q.id] ?? '').trim().length === 0}
            >
              {busyId === q.id ? 'Publishing…' : 'Publish answer'}
            </button>
            <button type="button" className="btn btn-sm" onClick={() => dismiss(q)} disabled={busyId !== null}>
              Dismiss
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
