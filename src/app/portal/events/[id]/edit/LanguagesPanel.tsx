'use client';

// The listing in German and Nepali (lib/listingI18n). Every line the seller
// wrote is translated automatically after each save; here they can read the
// translation next to their English, fix any line in their own words, or have
// the lot translated again. Names (listing, artist, venue) stay as written.
import { useState } from 'react';

interface Row {
  field: string;
  label: string;
  english: string;
  text: string;
  manual: boolean;
  current: boolean;
}

const LANGS = [
  { code: 'de', label: 'Deutsch' },
  { code: 'ne', label: 'नेपाली' },
] as const;

export default function LanguagesPanel({ eventId, initial }: { eventId: string; initial: { de: Row[]; ne: Row[] } }) {
  const [rows, setRows] = useState(initial);
  const [lang, setLang] = useState<'de' | 'ne'>('de');
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<'save' | 'again' | null>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  const list = rows[lang];
  const missing = list.filter((r) => !r.text).length;
  const changed = Object.keys(edits).length;

  async function post(body: Record<string, unknown>, kind: 'save' | 'again') {
    setBusy(kind);
    setNote(null);
    try {
      const res = await fetch(`/api/portal/events/${eventId}/translations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => null)) as { de?: Row[]; ne?: Row[]; error?: string } | null;
      if (!res.ok || !data?.de || !data.ne) {
        setNote({ ok: false, text: data?.error ?? 'Something went wrong — please try again.' });
        return;
      }
      setRows({ de: data.de, ne: data.ne });
      setEdits({});
      setNote({ ok: true, text: kind === 'save' ? 'Saved — your wording is used on the page.' : 'Translated again.' });
    } catch {
      setNote({ ok: false, text: 'Could not reach the server — please try again.' });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="ks">
      <p className="muted small" style={{ margin: 0 }}>
        Visitors who pick Deutsch or नेपाली see your page in that language. It is translated automatically after
        every save — read it here and fix any line in your own words.
      </p>

      <div className="te-seg" role="radiogroup" aria-label="Language" style={{ justifySelf: 'start' }}>
        {LANGS.map((l) => (
          <button
            key={l.code}
            type="button"
            role="radio"
            aria-checked={lang === l.code}
            className={lang === l.code ? 'is-on' : ''}
            onClick={() => setLang(l.code)}
          >
            {l.label}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <p className="muted small" style={{ margin: 0 }}>
          Nothing to translate yet — add a description and your {''}items first.
        </p>
      ) : (
        <>
          {missing > 0 && (
            <p className="ks-preview is-bad" style={{ margin: 0 }}>
              {missing} line{missing === 1 ? ' is' : 's are'} still being translated — tap “Translate again” if it
              takes more than a minute.
            </p>
          )}
          <div className="lg-rows">
            {list.map((r) => (
              <div key={r.field} className="lg-row">
                <div className="lg-head">
                  <strong>{r.label}</strong>
                  {r.manual && <span className="badge badge-green">your wording</span>}
                </div>
                <p className="lg-en" lang="en">
                  {r.english}
                </p>
                <textarea
                  className="input"
                  lang={lang}
                  rows={Math.min(8, Math.max(1, Math.ceil((edits[r.field] ?? r.text ?? r.english).length / 70)))}
                  value={edits[r.field] ?? r.text}
                  placeholder="Being translated…"
                  onChange={(e) => setEdits((x) => ({ ...x, [r.field]: e.target.value }))}
                  aria-label={`${r.label} in ${LANGS.find((l) => l.code === lang)?.label}`}
                />
              </div>
            ))}
          </div>
        </>
      )}

      {note && (
        <p className="small" style={{ margin: 0, color: note.ok ? '#6ee7b7' : '#fca5a5' }} role="status">
          {note.text}
        </p>
      )}

      <div className="ks-save">
        <button
          type="button"
          className="btn btn-brand"
          disabled={busy !== null || changed === 0}
          onClick={() => void post({ lang, edits }, 'save')}
        >
          {busy === 'save' ? 'Saving…' : changed ? `Save ${changed} change${changed === 1 ? '' : 's'}` : 'Save'}
        </button>
        <button
          type="button"
          className="btn"
          disabled={busy !== null || list.length === 0}
          onClick={() => void post({ retranslate: true }, 'again')}
        >
          {busy === 'again' ? 'Translating…' : '✨ Translate again'}
        </button>
      </div>
    </div>
  );
}
