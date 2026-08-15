'use client';

import { useEffect, useState, type ReactNode } from 'react';

export interface EditorTabDef {
  key: string;
  label: string;
  /** 'done' = green check, 'todo' = amber dot, 'neutral' = optional section. */
  status: 'done' | 'todo' | 'neutral';
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
          </button>
        ))}
      </div>

      {tabs.map((t) => (
        <div
          key={t.key}
          id={`editor-panel-${t.key}`}
          role="tabpanel"
          aria-labelledby={`editor-tab-${t.key}`}
          className={`editor-panel${active === t.key ? '' : ' is-hidden'}`}
        >
          {panels[t.key]}
        </div>
      ))}
    </>
  );
}
