'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import SpeechInput from '@/components/SpeechInput';
import { saveEvent } from './save';

// Mirrors the PageDesign spec in lib/events (kept local: that lib is server-only).
type Accent = 'violet' | 'sunset' | 'ocean' | 'emerald' | 'gold' | 'crimson';
type Vibe = 'bold' | 'elegant' | 'party' | 'minimal';
type Layout = 'classic' | 'poster' | 'festival' | 'editorial' | 'neon';

interface Design {
  accent?: Accent;
  vibe?: Vibe;
  layout?: Layout;
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

/** The page frames (lib/events PageDesign.layout), each with a tiny drawn preview. */
const LAYOUTS: { key: Layout; label: string; hint: string }[] = [
  { key: 'classic', label: 'Classic', hint: 'Clean, photo behind the title' },
  { key: 'poster', label: 'Poster', hint: 'Your poster as a big card' },
  { key: 'festival', label: 'Festival', hint: 'Colour, kites, countdown' },
  { key: 'editorial', label: 'Editorial', hint: 'Magazine, elegant serif' },
  { key: 'neon', label: 'Neon night', hint: 'Club glow, grid, countdown' },
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
  const [layout, setLayout] = useState<Layout>(initial.layout ?? 'classic');
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
    if (layout !== 'classic') design.layout = layout;
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

  async function generate(wish?: string) {
    if (busy) return;
    const ask = wish ?? notes;
    if (wish !== undefined) setNotes(wish);
    setBusy('generate');
    setError(null);
    setAiNote(null);
    try {
      const res = await fetch(`/api/portal/events/${eventId}/design`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: ask }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; design?: Design; error?: string } | null;
      if (!res.ok || !data?.design) {
        setError(data?.error ?? 'The design could not be generated — please try again.');
        return;
      }
      const d = data.design;
      if (d.accent) setAccent(d.accent);
      if (d.vibe) setVibe(d.vibe);
      if (d.layout) setLayout(d.layout);
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

  const LOOKS = ['Festive and colourful', 'Elegant, dark and gold', 'Bright and family-friendly', 'Clean and simple'];

  return (
    <div className="ks">
      {/* ---- 1. The fast way: one tap ---- */}
      {aiEnabled && (
        <section className="ks-step">
          <h3 className="ks-q">
            <span className="ks-num">✨</span> Let the AI design it
          </h3>
          <div className="ks-presets">
            {LOOKS.map((l) => (
              <button key={l} type="button" className="ks-chip" disabled={busy !== null} onClick={() => void generate(l)}>
                {l}
              </button>
            ))}
          </div>
          <div className="pc-composer">
            <textarea
              className="input"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={2000}
              placeholder="…or say it in your words: dark and moody, gold accents"
              style={{ resize: 'vertical', fontFamily: 'inherit' }}
              aria-label="Your wishes for the page design"
            />
            <div className="pc-bar">
              <SpeechInput
                label="Dictate your design wishes"
                hint="Tap the mic and just talk."
                onStart={() => {
                  notesSpeechBase.current = notes.trim() ? notes.trimEnd() + ' ' : '';
                }}
                onText={(text) => setNotes((notesSpeechBase.current + text).slice(0, 2000))}
              />
              <span style={{ flex: 1 }} />
              <button type="button" className="btn btn-brand btn-sm" onClick={() => void generate()} disabled={busy !== null}>
                {busy === 'generate' ? <span className="spinner" aria-hidden /> : null}
                {busy === 'generate' ? 'Designing…' : 'Design it'}
              </button>
            </div>
          </div>
          {aiNote && (
            <div className="notice notice-success small" style={{ margin: 0 }}>
              {aiNote} Check it below, then Save.
            </div>
          )}
        </section>
      )}

      <form onSubmit={submit} className="ks">
        {error && (
          <div className="notice notice-error" style={{ margin: 0 }}>
            {error}
          </div>
        )}

        {/* ---- 2. Or pick it yourself: the frame, then the colour ---- */}
        <section className="ks-step">
          <h3 className="ks-q">
            <span className="ks-num">🖼</span> Layout
          </h3>
          <div className="lz-grid" role="radiogroup" aria-label="Layout">
            {LAYOUTS.map((l) => (
              <button
                key={l.key}
                type="button"
                role="radio"
                aria-checked={layout === l.key}
                className={`lz-card${layout === l.key ? ' is-on' : ''}`}
                onClick={() => setLayout(l.key)}
              >
                <span className={`lz-thumb lz-${l.key}`} aria-hidden="true">
                  <i />
                  <b />
                  <em />
                </span>
                <strong>{l.label}</strong>
                <span>{l.hint}</span>
              </button>
            ))}
          </div>
        </section>
        <section className="ks-step">
          <h3 className="ks-q">
            <span className="ks-num">🎨</span> {aiEnabled ? 'Or pick it yourself' : 'Pick a look'}
          </h3>
          <div className="dz-swatches">
            {ACCENTS.map((a) => (
              <button
                key={a.key}
                type="button"
                onClick={() => setAccent(accent === a.key ? '' : a.key)}
                aria-pressed={accent === a.key}
                className={`dz-swatch${accent === a.key ? ' is-on' : ''}`}
                style={{ ['--sw' as string]: a.color }}
              >
                <span aria-hidden="true" />
                {a.label}
              </button>
            ))}
          </div>
          <div className="te-seg" role="radiogroup" aria-label="Vibe">
            {VIBES.map((v) => (
              <button
                key={v.key}
                type="button"
                role="radio"
                aria-checked={vibe === v.key}
                className={vibe === v.key ? 'is-on' : ''}
                onClick={() => setVibe(vibe === v.key ? '' : v.key)}
                title={v.hint}
              >
                {v.label}
              </button>
            ))}
          </div>
        </section>

        {/* ---- 3. Words — optional ---- */}
        <details className="ks-step ks-more" open={headline || tagline || aboutTitle || highlights ? true : undefined}>
          <summary className="ks-q">
            <span className="ks-num">Aa</span> Words on the page <span className="badge">optional</span>
          </summary>
          <div className="bf-row">
            <input
              id="design-headline"
              className="input"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              maxLength={90}
              placeholder="Headline (default: the name)"
              aria-label="Headline"
            />
            <input
              id="design-about"
              className="input"
              value={aboutTitle}
              onChange={(e) => setAboutTitle(e.target.value)}
              maxLength={60}
              placeholder='Heading above the description, e.g. "About the night"'
              aria-label="Heading for the description"
            />
          </div>
          <input
            id="design-tagline"
            className="input"
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            maxLength={200}
            placeholder="Tagline — one inviting sentence under the headline"
            aria-label="Tagline"
            style={{ marginTop: 10 }}
          />
          <textarea
            id="design-highlights"
            className="input"
            rows={3}
            value={highlights}
            onChange={(e) => setHighlights(e.target.value)}
            placeholder={'Highlights, one per line (up to 5)\nLive band until midnight\nFree parking'}
            aria-label="Highlights, one per line"
            style={{ resize: 'vertical', fontFamily: 'inherit', marginTop: 10 }}
          />
        </details>

        <div className="ks-save">
          <button type="submit" className="btn btn-brand" disabled={busy !== null}>
            {busy === 'save' ? <span className="spinner" aria-hidden /> : null}
            {busy === 'save' ? 'Saving…' : 'Save'}
          </button>
          {saved && <span className="badge badge-green">Saved ✓</span>}
          <span className="muted small" style={{ marginLeft: 'auto' }}>
            Want us to design it? <a href="/contact" target="_blank" rel="noopener noreferrer">Ask the team</a>
          </span>
        </div>
      </form>
    </div>
  );
}
