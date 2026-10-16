'use client';

// "Report" on anything a member posted: pick a reason, optionally say more,
// optionally block the person in the same step. Three reports from different
// members take the thing down until it has been looked at (lib/community).
import { useState } from 'react';

const REASONS: [string, string][] = [
  ['scam', 'Scam, or asking for money'],
  ['hate', 'Hate, insults or bullying'],
  ['unsafe', 'Feels unsafe'],
  ['spam', 'Spam or advertising'],
  ['fake', 'Fake, or pretending to be someone'],
  ['private', "Shares someone's private details"],
  ['other', 'Something else'],
];

interface Props {
  type: 'meetup' | 'meetup_message' | 'help_post' | 'message' | 'talent' | 'member';
  id: string;
  /** The author's handle, so "block them too" can work. */
  handle?: string;
  label?: string;
  compact?: boolean;
}

export default function ReportButton({ type, id, handle, label = 'Report', compact = false }: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [block, setBlock] = useState(false);
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');
  const [error, setError] = useState('');

  async function send() {
    setState('busy');
    setError('');
    try {
      const res = await fetch('/api/community/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, id, reason, note, block, handle }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || 'Could not send the report.');
      setState('done');
    } catch (e) {
      setError((e as Error).message);
      setState('idle');
    }
  }

  if (state === 'done') {
    return (
      <p className="cm-reported" role="status">
        Thank you — we will look at it.{block ? ' You will not see them any more.' : ''}
      </p>
    );
  }

  return (
    <div className={`cm-report${compact ? ' cm-report-compact' : ''}`}>
      <button type="button" className="cm-link-btn" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {compact ? '⚑' : `⚑ ${label}`}
        {compact && <span className="sr-only">{label}</span>}
      </button>
      {open && (
        <div className="cm-report-box">
          <p className="cm-report-title">What is wrong?</p>
          <div className="cm-report-reasons">
            {REASONS.map(([key, text]) => (
              <label key={key} className="cm-radio">
                <input type="radio" name={`reason-${type}-${id}`} value={key} checked={reason === key} onChange={() => setReason(key)} />
                <span>{text}</span>
              </label>
            ))}
          </div>
          <textarea
            className="input"
            rows={2}
            maxLength={500}
            placeholder="Anything we should know? (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          {handle && (
            <label className="cm-check">
              <input type="checkbox" checked={block} onChange={(e) => setBlock(e.target.checked)} />
              <span>Also block this person — you will not see each other any more</span>
            </label>
          )}
          {error && <p className="notice notice-error">{error}</p>}
          <div className="cm-row">
            <button type="button" className="btn btn-sm btn-brand" disabled={!reason || state === 'busy'} onClick={send}>
              {state === 'busy' ? 'Sending…' : 'Send report'}
            </button>
            <button type="button" className="btn btn-sm" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
