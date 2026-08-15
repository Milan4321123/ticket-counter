'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const MAX_ANSWER = 1000;

interface OpenQuestion {
  id: string;
  question: string;
  askedAt: string;
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
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setErrors((e) => ({ ...e, [questionId]: data?.error ?? 'Something went wrong — please try again.' }));
        setBusyId(null);
        return;
      }
      setDoneIds((d) => ({ ...d, [questionId]: done }));
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
        The assistant could not answer these from your event details. Publish an answer and it appears in the
        Questions section of your event page — and the assistant learns it, so the next person who asks gets an
        instant answer.
      </p>
      {open.map((q) => (
        <div key={q.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 14 }}>
          <div style={{ fontWeight: 700 }}>{q.question}</div>
          <div className="muted small" style={{ marginTop: 2 }}>
            Asked {q.askedAt.slice(0, 10)}
          </div>
          <textarea
            className="input"
            rows={3}
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
