'use client';

import { useEffect, useState, type ReactNode } from 'react';

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

/**
 * Category tabs for the event editor. Every panel stays mounted (hidden with
 * CSS rather than unmounted) so half-typed forms survive a tab switch — an
 * organizer can jump to Tickets to check a price and come back to Basics
 * without losing what they wrote.
 */
export default function EditorTabs({
  tabs,
  panels,
}: {
  tabs: EditorTabDef[];
  panels: Record<string, ReactNode>;
}) {
  const [active, setActive] = useState(tabs[0]?.key ?? '');

  // Restore the tab from ?tab= so a refresh (or a saved link) lands in place.
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get('tab');
    if (wanted && tabs.some((t) => t.key === wanted)) setActive(wanted);
  }, [tabs]);

  // Bound once per tab that asks for it; the switch is the whole behaviour, so
  // there is nothing to clean up beyond the listener itself.
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
    url.searchParams.set('tab', key);
    window.history.replaceState({}, '', url);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <>
      <div className="editor-tabs" role="tablist" aria-label="Event editor sections">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            id={`editor-tab-${t.key}`}
            aria-selected={active === t.key}
            aria-controls={`editor-panel-${t.key}`}
            className={`editor-tab${active === t.key ? ' is-active' : ''}`}
            onClick={() => select(t.key)}
          >
            {t.status !== 'neutral' && (
              <span
                className={`editor-tab-dot${t.status === 'done' ? ' is-done' : ''}`}
                aria-label={t.status === 'done' ? 'Done' : 'Still needs something'}
              >
                {t.status === 'done' ? '✓' : ''}
              </span>
            )}
            {t.label}
            {t.badge ? <span className="badge badge-green editor-tab-badge">{t.badge}</span> : null}
          </button>
        ))}
      </div>

      {tabs.map((t, i) => {
        const prev = tabs[i - 1];
        const next = tabs[i + 1];
        return (
          <div
            key={t.key}
            id={`editor-panel-${t.key}`}
            role="tabpanel"
            aria-labelledby={`editor-tab-${t.key}`}
            className={`editor-panel${active === t.key ? '' : ' is-hidden'}`}
          >
            {panels[t.key]}

            {/* Where to go once this section is filled in. The next section is
                named rather than called "Next", so it reads as a plan instead
                of a mystery — and the count tells someone how much is left,
                which the tabs alone never did. */}
            <div className="editor-stepper">
              {prev ? (
                <button type="button" className="btn btn-sm" onClick={() => select(prev.key)}>
                  ← {prev.label}
                </button>
              ) : (
                <span />
              )}
              <span className="editor-stepper-count">
                Step {i + 1} of {tabs.length}
              </span>
              {next ? (
                <button
                  type="button"
                  className="btn btn-brand btn-sm"
                  onClick={() => select(next.key)}
                >
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
