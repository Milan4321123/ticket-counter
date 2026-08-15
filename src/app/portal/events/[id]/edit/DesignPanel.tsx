'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import SpeechInput from '@/components/SpeechInput';
import { saveEvent } from './save';

// Mirrors the PageDesign spec in lib/events (kept local: that lib is server-only).
type Accent = 'violet' | 'sunset' | 'ocean' | 'emerald' | 'gold' | 'crimson';
type Vibe = 'bold' | 'elegant' | 'party' | 'minimal';

interface Design {
  accent?: Accent;
  vibe?: Vibe;
  headline?: string;
  tagline?: string;
  highlights?: string[];
  aboutTitle?: string;
}

interface Props {
  eventId: string;
  aiEnabled: boolean;
  initial: Design;
}

const ACCENTS: { key: Accent; color: string; label: string }[] = [
  { key: 'violet', color: '#8b5cf6', label: 'Violet' },
  { key: 'sunset', color: '#f97316', label: 'Sunset' },
  { key: 'ocean', color: '#0ea5e9', label: 'Ocean' },
  { key: 'emerald', color: '#34d399', label: 'Emerald' },
  { key: 'gold', color: '#fbbf24', label: 'Gold' },
  { key: 'crimson', color: '#ef4444', label: 'Crimson' },
];

const VIBES: { key: Vibe; label: string; hint: string }[] = [
  { key: 'bold', label: 'Bold', hint: 'big and loud' },
  { key: 'elegant', label: 'Elegant', hint: 'refined and calm' },
  { key: 'party', label: 'Party', hint: 'colorful and playful' },
  { key: 'minimal', label: 'Minimal', hint: 'clean and simple' },
];

export default function DesignPanel({ eventId, aiEnabled, initial }: Props) {
  const router = useRouter();
  const [accent, setAccent] = useState<Accent | ''>(initial.accent ?? '');
  const [vibe, setVibe] = useState<Vibe | ''>(initial.vibe ?? '');
  const [headline, setHeadline] = useState(initial.headline ?? '');
  const [tagline, setTagline] = useState(initial.tagline ?? '');
  const [aboutTitle, setAboutTitle] = useState(initial.aboutTitle ?? '');
  const [highlights, setHighlights] = useState((initial.highlights ?? []).join('\n'));
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState<'save' | 'generate' | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Notes text as it was when dictation started; the live transcript is
  // appended after it, so interim words refine in place.
  const notesSpeechBase = useRef('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy('save');
    setError(null);
    const design: Design = {};
    if (accent) design.accent = accent;
    if (vibe) design.vibe = vibe;
    if (headline.trim()) design.headline = headline.trim();
    if (tagline.trim()) design.tagline = tagline.trim();
    if (aboutTitle.trim()) design.aboutTitle = aboutTitle.trim();
    const hl = highlights
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 5);
    if (hl.length) design.highlights = hl;

    const result = await saveEvent(eventId, { pageDesign: design });
    setBusy(null);
    if (!result.ok) {
      setError(result.error ?? 'Something went wrong — please try again.');
      return;
    }
    setAiNote(null);
    setSaved(true);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaved(false), 2200);
    router.refresh();
  }

  async function generate() {
    if (busy) return;
    setBusy('generate');
    setError(null);
    setAiNote(null);
    try {
      const res = await fetch(`/api/portal/events/${eventId}/design`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; design?: Design; error?: string } | null;
      if (!res.ok || !data?.design) {
        setError(data?.error ?? 'The design could not be generated — please try again.');
        return;
      }
      const d = data.design;
      if (d.accent) setAccent(d.accent);
      if (d.vibe) setVibe(d.vibe);
      if (typeof d.headline === 'string') setHeadline(d.headline);
      if (typeof d.tagline === 'string') setTagline(d.tagline);
      if (typeof d.aboutTitle === 'string') setAboutTitle(d.aboutTitle);
      if (Array.isArray(d.highlights)) setHighlights(d.highlights.join('\n'));
      setAiNote('Done — the suggestion is filled in below. Adjust anything you like, then hit Save.');
    } catch {
      setError('Could not reach the server — please check your connection and try again.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      {aiEnabled ? (
        <div
          style={{
            border: '1px solid var(--border)',
            borderRadius: 10,
            padding: 14,
            marginBottom: 18,
            background: 'var(--bg-elevated)',
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Generate with AI</div>
          <p className="muted small" style={{ marginTop: 0 }}>
            Describe the look you want in your own words — the AI suggests colors and text from your event details.
            Nothing is saved until you review and hit Save.
          </p>
          <div className="field" style={{ marginBottom: 10 }}>
            <textarea
              className="input"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={2000}
              placeholder="e.g. dark and moody, gold accents, aimed at an indie-rock crowd"
              style={{ resize: 'vertical', fontFamily: 'inherit' }}
              aria-label="Your wishes for the page design"
            />
            <div className="speech-row">
              <SpeechInput
                label="Dictate your design wishes"
                hint="Tap the mic and just talk — you can edit the text after."
                onStart={() => {
                  notesSpeechBase.current = notes.trim() ? notes.trimEnd() + ' ' : '';
                }}
                onText={(text) => setNotes((notesSpeechBase.current + text).slice(0, 2000))}
              />
            </div>
          </div>
          <button type="button" className="btn btn-sm" onClick={() => void generate()} disabled={busy !== null}>
            {busy === 'generate' ? <span className="spinner" aria-hidden /> : null}
            {busy === 'generate' ? 'Designing…' : 'Generate suggestion'}
          </button>
          {aiNote && (
            <div className="notice notice-success small" style={{ marginTop: 10, marginBottom: 0 }}>
              {aiNote}
            </div>
          )}
        </div>
      ) : (
        <p className="muted small" style={{ marginTop: 0 }}>
          The AI designer is not switched on for this server — pick your colors and text below instead.
        </p>
      )}

      <form onSubmit={submit}>
        {error && <div className="notice notice-error">{error}</div>}

        <div className="field">
          <label>Accent color</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {ACCENTS.map((a) => (
              <button
                key={a.key}
                type="button"
                onClick={() => setAccent(accent === a.key ? '' : a.key)}
                aria-pressed={accent === a.key}
                title={a.label}
                style={{
                  position: 'relative',
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  cursor: 'pointer',
                  background: a.color,
                  border: accent === a.key ? '3px solid var(--text)' : '1px solid var(--border)',
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    width: 1,
                    height: 1,
                    overflow: 'hidden',
                    clipPath: 'inset(50%)',
                  }}
                >
                  {a.label}
                </span>
              </button>
            ))}
          </div>
          <p className="muted small" style={{ margin: '6px 0 0' }}>
            {accent ? `Accent: ${ACCENTS.find((a) => a.key === accent)?.label}` : 'No accent picked — the default look is used.'}
          </p>
        </div>

        <div className="field">
          <label>Vibe</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {VIBES.map((v) => (
              <button
                key={v.key}
                type="button"
                className={`chip${vibe === v.key ? ' chip-active' : ''}`}
                onClick={() => setVibe(vibe === v.key ? '' : v.key)}
                aria-pressed={vibe === v.key}
                style={{ cursor: 'pointer' }}
              >
                {v.label}
                <span className="muted small">· {v.hint}</span>
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', columnGap: 16 }}>
          <div className="field">
            <label htmlFor="design-headline">Headline</label>
            <input
              id="design-headline"
              className="input"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              maxLength={90}
              placeholder="Defaults to the event name"
            />
          </div>
          <div className="field">
            <label htmlFor="design-about">Heading for the description</label>
            <input
              id="design-about"
              className="input"
              value={aboutTitle}
              onChange={(e) => setAboutTitle(e.target.value)}
              maxLength={60}
              placeholder='e.g. "About the night"'
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor="design-tagline">Tagline</label>
          <input
            id="design-tagline"
            className="input"
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            maxLength={200}
            placeholder="One inviting sentence under the headline"
          />
        </div>
        <div className="field">
          <label htmlFor="design-highlights">Highlights (one per line, up to 5)</label>
          <textarea
            id="design-highlights"
            className="input"
            rows={4}
            value={highlights}
            onChange={(e) => setHighlights(e.target.value)}
            placeholder={'Live band until midnight\nStreet-food trucks\nFree parking'}
            style={{ resize: 'vertical', fontFamily: 'inherit' }}
          />
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button type="submit" className="btn btn-brand" disabled={busy !== null}>
            {busy === 'save' ? <span className="spinner" aria-hidden /> : null}
            {busy === 'save' ? 'Saving…' : 'Save page design'}
          </button>
          {saved && <span className="badge badge-green">Saved ✓</span>}
        </div>
      </form>

      <p className="muted small" style={{ margin: '18px 0 0' }}>
        Prefer us to design it for you?{' '}
        <a
          href="/contact"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'var(--brand-text)', fontWeight: 600 }}
        >
          Talk to the team
        </a>
        .
      </p>
    </div>
  );
}
