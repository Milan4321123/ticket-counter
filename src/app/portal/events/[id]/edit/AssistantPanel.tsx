'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import SpeechInput from '@/components/SpeechInput';
import { sendFaqSuggestions, type SuggestedFaq } from './faqBridge';
import { saveEvent } from './save';

interface Props {
  eventId: string;
  /** False when no AI provider is configured: the panel still saves notes. */
  aiEnabled: boolean;
  initial: string;
}

/** Matches the cap the update route enforces. */
const MAX_CONTEXT = 4000;

/** A suggestion in the review list: the text, plus whether it is ticked. */
interface ReviewRow extends SuggestedFaq {
  keep: boolean;
}

const PLACEHOLDER = [
  'Doors open at 19:00, the support act starts at 20:00.',
  'Parking: the Marktplatz garage is 3 minutes away, €4 for the evening.',
  'Food and drinks: two bars, plus momo and samosa stands. Card and cash both fine.',
  'Age: 16+, under 18 need a parent along.',
  'There is a free cloakroom next to the entrance — no big backpacks in the hall.',
  'Wheelchair users: step-free entrance on the side, please message us so we can keep a spot.',
  'No professional cameras, no outside drinks.',
].join('\n');

/**
 * "What the assistant should know": the organizer's own notes for the AI that
 * answers visitor questions on their event page. Everything the page has no
 * field for lives here — and the same notes feed the FAQ suggester below.
 */
export default function AssistantPanel({ eventId, aiEnabled, initial }: Props) {
  const router = useRouter();
  const [text, setText] = useState(initial);
  /** What the server has. The suggester reads the SAVED notes, not this box. */
  const [savedText, setSavedText] = useState(initial);
  const [busy, setBusy] = useState<'save' | 'suggest' | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [rows, setRows] = useState<ReviewRow[] | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The text as it was when dictation started; the live transcript is appended
  // after it, so interim words refine in place instead of stacking up.
  const speechBase = useRef('');

  const remaining = MAX_CONTEXT - text.length;
  const keptCount = rows ? rows.filter((r) => r.keep).length : 0;

  /** Returns false when the save failed (the error is already on screen). */
  async function persist(): Promise<boolean> {
    const result = await saveEvent(eventId, { assistantContext: text });
    if (!result.ok) {
      setError(result.error ?? 'Something went wrong — please try again.');
      return false;
    }
    setSavedText(text);
    router.refresh();
    return true;
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy('save');
    setError(null);
    setNotice(null);
    const ok = await persist();
    setBusy(null);
    if (!ok) return;
    setSaved(true);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaved(false), 2200);
  }

  /**
   * Ask for draft FAQ entries. They arrive as a review list — ticked, editable,
   * and going nowhere near the event page until the organizer sends them down
   * to the FAQ editor and saves there.
   */
  async function suggest() {
    if (busy) return;
    setBusy('suggest');
    setError(null);
    setNotice(null);
    try {
      // The route reads the notes from the database, so anything still in the
      // box would be invisible to it — save it first rather than quietly
      // suggesting from an older version of the notes.
      if (text !== savedText && !(await persist())) return;
      const res = await fetch(`/api/portal/events/${eventId}/faq-suggest`, { method: 'POST' });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; faqs?: SuggestedFaq[]; error?: string }
        | null;
      if (!res.ok || !Array.isArray(data?.faqs) || data.faqs.length === 0) {
        setError(data?.error ?? 'No suggestions came back — please try again.');
        return;
      }
      setRows(data.faqs.map((f) => ({ question: f.question, answer: f.answer, keep: true })));
      setNotice('Here is what the AI came up with. Untick what you do not want, fix any wording, then add them.');
    } catch {
      setError('Could not reach the server — please check your connection and try again.');
    } finally {
      setBusy(null);
    }
  }

  function setRowField(index: number, field: 'question' | 'answer', value: string) {
    setRows((prev) => (prev ? prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)) : prev));
  }

  function toggleRow(index: number) {
    setRows((prev) => (prev ? prev.map((r, i) => (i === index ? { ...r, keep: !r.keep } : r)) : prev));
  }

  /** Hand the ticked rows to the FAQ editor below; it owns the saving. */
  function addKept() {
    if (!rows) return;
    const kept = rows
      .filter((r) => r.keep && r.question.trim() && r.answer.trim())
      .map((r) => ({ question: r.question.trim(), answer: r.answer.trim() }));
    if (kept.length === 0) {
      setError('Tick at least one suggestion first (and make sure it has both a question and an answer).');
      return;
    }
    sendFaqSuggestions(kept);
    setRows(null);
    setError(null);
    setNotice(
      `Added ${kept.length} ${kept.length === 1 ? 'question' : 'questions'} to the FAQ editor in the next card — ` +
        'have a last look there and press Save FAQ to put them on your page.'
    );
  }

  return (
    <div>
      {error && <div className="notice notice-error">{error}</div>}
      {!error && notice && <div className="notice notice-success">{notice}</div>}

      <form onSubmit={save}>
        <p className="muted small" style={{ marginTop: 0 }}>
          The assistant on your event page already knows your date, venue, prices, updates and FAQ. Everything else it
          has to hear from you — parking, food, age limits, dress code, the cloakroom, when the doors really open.
          Write it here like you would tell a friend. Visitors never see this text; it only helps the assistant answer
          them instead of passing the question to you.
        </p>

        <div className="field">
          <label htmlFor="assistant-context">What else should it know?</label>
          <textarea
            id="assistant-context"
            className="input"
            rows={12}
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, MAX_CONTEXT))}
            maxLength={MAX_CONTEXT}
            placeholder={PLACEHOLDER}
            style={{ resize: 'vertical', fontFamily: 'inherit' }}
          />
          <div className="speech-row">
            <SpeechInput
              label="Dictate your notes for the assistant"
              hint="Tap the mic and just talk — speak, then fix anything it misheard."
              onStart={() => {
                speechBase.current = text.trim() ? text.trimEnd() + ' ' : '';
              }}
              onText={(spoken) => setText((speechBase.current + spoken).slice(0, MAX_CONTEXT))}
            />
          </div>
          <p className="muted small" style={{ margin: '6px 0 0', ...(remaining < 200 ? { color: 'var(--red)' } : {}) }}>
            {remaining} characters left. Whatever you dictate lands in the box above and stays yours to edit.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="submit" className="btn btn-brand" disabled={busy !== null}>
            {busy === 'save' ? <span className="spinner" aria-hidden /> : null}
            {busy === 'save' ? 'Saving…' : 'Save notes'}
          </button>
          {saved && <span className="badge badge-green">Saved ✓</span>}
          {aiEnabled && (
            <button type="button" className="btn btn-sm" onClick={() => void suggest()} disabled={busy !== null}>
              {busy === 'suggest' ? <span className="spinner" aria-hidden /> : null}
              {busy === 'suggest' ? 'Writing…' : 'Suggest FAQ answers'}
            </button>
          )}
        </div>

        <p className="muted small" style={{ margin: '10px 0 0' }}>
          {aiEnabled
            ? 'The AI can turn these notes into ready-made FAQ entries (it saves them first). You review every one before anything goes on your page.'
            : 'The AI assistant is not switched on for this server, so there are no automatic FAQ suggestions — your notes are still saved, and the FAQ below is yours to write.'}
        </p>
      </form>

      {rows && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 20 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Suggestions — nothing is saved yet</div>
          <p className="muted small" style={{ marginTop: 0 }}>
            Edit anything that is not quite right. When you are happy, they move into the FAQ editor in the next card,
            where you press Save FAQ.
          </p>

          {rows.map((row, i) => (
            <div
              key={i}
              style={{
                border: '1px solid var(--border)',
                borderRadius: 10,
                padding: '12px 14px 4px',
                marginBottom: 10,
                background: 'var(--bg-elevated)',
                opacity: row.keep ? 1 : 0.55,
              }}
            >
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={row.keep} onChange={() => toggleRow(i)} />
                <span className="small">{row.keep ? 'Keep this one' : 'Skipped'}</span>
              </label>
              <div className="field">
                <label htmlFor={`ap-sug-q-${i}`}>Question</label>
                <input
                  id={`ap-sug-q-${i}`}
                  className="input"
                  value={row.question}
                  onChange={(e) => setRowField(i, 'question', e.target.value)}
                  maxLength={200}
                />
              </div>
              <div className="field">
                <label htmlFor={`ap-sug-a-${i}`}>Answer</label>
                <textarea
                  id={`ap-sug-a-${i}`}
                  className="input"
                  rows={2}
                  value={row.answer}
                  onChange={(e) => setRowField(i, 'answer', e.target.value)}
                  maxLength={1000}
                  style={{ resize: 'vertical', fontFamily: 'inherit' }}
                />
              </div>
            </div>
          ))}

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-brand" onClick={addKept} disabled={keptCount === 0}>
              Add {keptCount} {keptCount === 1 ? 'question' : 'questions'} to my FAQ
            </button>
            <button type="button" className="btn btn-sm" onClick={() => setRows(null)}>
              Discard suggestions
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
