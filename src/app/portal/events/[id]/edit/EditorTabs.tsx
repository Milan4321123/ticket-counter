'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { GOTO_TAB_EVENT } from './GoToTab';

export interface EditorTabDef {
  key: string;
  label: string;
  /** 'done' = green check, 'todo' = amber dot, 'neutral' = optional section. */
  status: 'done' | 'todo' | 'neutral';
  /**
   * A green count on the tab itself — for something waiting on the organizer
   * that a status dot cannot express, like unanswered visitor questions.
   */
  badge?: string;
  /**
   * A window event name that switches TO this tab when it fires.
   *
   * The assistant panel hands accepted FAQ suggestions to the FAQ editor, and
   * the two now live in different tabs — so the hand-off has to bring the
   * organizer with it, or the rows land somewhere they cannot see.
   */
  revealOn?: string;
}

/** One line and an icon per section, for the card view. */
const CARD_INFO: Record<string, { icon: string; line: string }> = {
  basics: { icon: '📝', line: 'Name, date, place and description' },
  tickets: { icon: '🎟', line: 'What you sell, prices and how many' },
  media: { icon: '📸', line: 'Cover photo, gallery and video' },
  design: { icon: '🎨', line: 'Colours, layout and the AI designer' },
  updates: { icon: '📣', line: 'News for everyone who bought' },
  faq: { icon: '❓', line: 'Answers before people ask' },
  questions: { icon: '💬', line: 'Questions visitors sent you' },
  stalls: { icon: '🏪', line: 'Stalls and events together' },
  kitchen: { icon: '🍳', line: 'Pickup times, choices and tables' },
  subscribe: { icon: '↻', line: 'Repeat orders for regulars' },
  seating: { icon: '💺', line: 'Seat map, rows and sections' },
  publish: { icon: '🚀', line: 'Payment details and go live' },
};

/**
 * The event editor as cards. It opens on every section at a glance — done,
 * to do, or optional — with a progress bar across the required ones and the
 * next one to fill gently pulsing. A card opens its section; "All sections"
 * comes back, and the card is ticked once the save lands (the statuses come
 * from the server, refreshed after every save).
 *
 * Every panel stays mounted (hidden with CSS rather than unmounted) so
 * half-typed forms survive switching — an organizer can jump to Tickets to
 * check a price and come back to Basics without losing what they wrote.
 */
export default function EditorTabs({
  tabs,
  panels,
}: {
  tabs: EditorTabDef[];
  panels: Record<string, ReactNode>;
}) {
  // '' = the card overview.
  const [active, setActive] = useState('');

  // Open the section named in ?tab= so a refresh (or a saved link) lands in place.
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get('tab');
    if (wanted && tabs.some((t) => t.key === wanted)) setActive(wanted);
  }, [tabs]);

  // A button anywhere in the editor can send the organizer to a named section.
  useEffect(() => {
    const onGoto = (e: Event) => {
      const key = (e as CustomEvent<string>).detail;
      if (typeof key === 'string' && tabs.some((t) => t.key === key)) {
        setActive(key);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    };
    window.addEventListener(GOTO_TAB_EVENT, onGoto);
    return () => window.removeEventListener(GOTO_TAB_EVENT, onGoto);
  }, [tabs]);

  useEffect(() => {
    const bound = tabs
      .filter((t): t is EditorTabDef & { revealOn: string } => Boolean(t.revealOn))
      .map((t) => {
        const onReveal = () => setActive(t.key);
        window.addEventListener(t.revealOn, onReveal);
        return () => window.removeEventListener(t.revealOn, onReveal);
      });
    return () => bound.forEach((off) => off());
  }, [tabs]);

  function select(key: string) {
    setActive(key);
    const url = new URL(window.location.href);
    if (key) url.searchParams.set('tab', key);
    else url.searchParams.delete('tab');
    window.history.replaceState({}, '', url);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const required = tabs.filter((t) => t.status !== 'neutral');
  const doneCount = required.filter((t) => t.status === 'done').length;
  const pct = required.length ? Math.round((doneCount / required.length) * 100) : 100;
  const nextUp = required.find((t) => t.status === 'todo')?.key ?? null;
  const current = tabs.find((t) => t.key === active);

  return (
    <>
      {/* ---- Overview: every section as a card ---- */}
      {!current && (
        <div className="ed-overview">
          <div className="ed-progress" aria-label={`${doneCount} of ${required.length} required steps done`}>
            <div className="ed-progress-text">
              <strong>
                {doneCount === required.length ? 'Everything required is done ✓' : `${doneCount} of ${required.length} required steps done`}
              </strong>
              <span>{nextUp ? `Next: ${tabs.find((t) => t.key === nextUp)?.label}` : 'Add the optional extras whenever you like'}</span>
            </div>
            <div className="ed-progress-bar">
              <span style={{ width: `${Math.max(pct, 4)}%` }} className={pct === 100 ? 'is-full' : ''} />
            </div>
          </div>

          <div className="ed-cards">
            {tabs.map((t, i) => {
              const info = CARD_INFO[t.key] ?? { icon: '•', line: '' };
              const isNext = t.key === nextUp;
              return (
                <button
                  key={t.key}
                  type="button"
                  className={`ed-card ed-card-${t.status}${isNext ? ' is-next' : ''}`}
                  style={{ ['--i' as string]: String(i) }}
                  onClick={() => select(t.key)}
                >
                  <span className="ed-card-icon" aria-hidden="true">
                    {info.icon}
                  </span>
                  <span className="ed-card-text">
                    <strong>{t.label}</strong>
                    <span>{info.line}</span>
                  </span>
                  <span className="ed-card-chips">
                    {t.badge ? <span className="ed-chip ed-chip-badge">{t.badge}</span> : null}
                    {t.status === 'done' ? (
                      <span className="ed-chip ed-chip-done">✓ Done</span>
                    ) : t.status === 'todo' ? (
                      <span className="ed-chip ed-chip-todo">{isNext ? 'Next' : 'To do'}</span>
                    ) : (
                      <span className="ed-chip ed-chip-opt">Optional</span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ---- One section open ---- */}
      {current && (
        <div className="ed-open-bar">
          <button type="button" className="btn btn-sm" onClick={() => select('')}>
            ← All sections
          </button>
          <span className="ed-open-title">
            <span aria-hidden="true">{CARD_INFO[current.key]?.icon}</span> {current.label}
            {current.status === 'done' ? (
              <span className="ed-chip ed-chip-done">✓ Done</span>
            ) : current.status === 'todo' ? (
              <span className="ed-chip ed-chip-todo">To do</span>
            ) : (
              <span className="ed-chip ed-chip-opt">Optional</span>
            )}
          </span>
          <span className="ed-open-mini" aria-hidden="true">
            <span style={{ width: `${pct}%` }} />
          </span>
        </div>
      )}

      {tabs.map((t, i) => {
        const prev = tabs[i - 1];
        const next = tabs[i + 1];
        return (
          <div
            key={t.key}
            id={`editor-panel-${t.key}`}
            role="region"
            aria-label={t.label}
            className={`editor-panel${active === t.key ? '' : ' is-hidden'}`}
          >
            {panels[t.key]}

            <div className="editor-stepper">
              {prev ? (
                <button type="button" className="btn btn-sm" onClick={() => select(prev.key)}>
                  ← {prev.label}
                </button>
              ) : (
                <span />
              )}
              <button type="button" className="btn btn-sm" onClick={() => select('')}>
                ▦ All sections
              </button>
              {next ? (
                <button type="button" className="btn btn-brand btn-sm" onClick={() => select(next.key)}>
                  Next: {next.label} →
                </button>
              ) : (
                <span />
              )}
            </div>
          </div>
        );
      })}
    </>
  );
}
