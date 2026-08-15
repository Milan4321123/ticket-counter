'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

/** 'optional' is polish that is never nagged about; 'none' shows no badge. */
export type SectionStatus = 'done' | 'todo' | 'optional' | 'none';

interface GroupState {
  openId: string | null;
  toggle: (id: string) => void;
  /** Open a section without waiting for a click (see `revealOn` below). */
  reveal: (id: string) => void;
}

const GroupContext = createContext<GroupState | null>(null);

/**
 * Accordion state for one tab: at most one section open at a time, so an
 * organizer sees one job instead of a wall of inputs.
 *
 * `initialOpen` is decided on the server (the first section that still needs
 * work, or null when the whole tab is done) — computed rather than discovered
 * from the children so the first paint is already right, with no flicker and
 * no registration dance between parent and children.
 */
export function EditorSectionGroup({
  initialOpen = null,
  children,
}: {
  initialOpen?: string | null;
  children: ReactNode;
}) {
  const [openId, setOpenId] = useState<string | null>(initialOpen);

  // Stable identities: EditorSection subscribes to `reveal` in an effect.
  const toggle = useCallback((id: string) => setOpenId((cur) => (cur === id ? null : id)), []);
  const reveal = useCallback((id: string) => setOpenId(id), []);
  const value = useMemo<GroupState>(() => ({ openId, toggle, reveal }), [openId, toggle, reveal]);

  return (
    <div className="editor-sections">
      <GroupContext.Provider value={value}>{children}</GroupContext.Provider>
    </div>
  );
}

/**
 * One collapsible job inside a tab: a big tappable header (name, one-line hint,
 * status) over the fields it owns.
 *
 * The body is ALWAYS rendered and merely hidden with CSS when collapsed, the
 * same way EditorTabs hides inactive tabs. These panels hold unsaved local
 * state — a half-typed description, an unsaved FAQ row, a pending crop, a list
 * of AI suggestions — and unmounting would throw all of it away.
 */
export default function EditorSection({
  id,
  title,
  hint,
  status = 'none',
  badge,
  className,
  revealOn,
  children,
}: {
  /** Unique within the page; also builds the header/panel DOM ids. */
  id: string;
  title: string;
  hint: string;
  status?: SectionStatus;
  /**
   * Takes the header's badge slot instead of the status badge, for a count
   * that says more than "To do" does. The header is a three-column grid with
   * the chevron pinned to the last one, so there is room for exactly one badge
   * — this replaces it rather than sitting beside it.
   */
  badge?: ReactNode;
  /** Extra card classes, e.g. the publish card's glow. */
  className?: string;
  /**
   * Window event that should open this section. One panel can hand work to
   * another that is collapsed (the assistant drops accepted FAQ suggestions
   * into the FAQ editor) — without this the organizer would never see them.
   */
  revealOn?: string;
  children: ReactNode;
}) {
  const group = useContext(GroupContext);
  // Standalone (no group) stays open rather than trapping content behind a
  // header that cannot be clicked.
  const open = group ? group.openId === id : true;
  const reveal = group?.reveal;

  const headRef = useRef<HTMLButtonElement>(null);
  const mounted = useRef(false);

  useEffect(() => {
    if (!revealOn || !reveal) return;
    const onReveal = () => reveal(id);
    window.addEventListener(revealOn, onReveal);
    return () => window.removeEventListener(revealOn, onReveal);
  }, [revealOn, reveal, id]);

  // Collapsing a tall section can push the one you just opened off-screen, and
  // a revealed section may be nowhere near the viewport. 'nearest' leaves the
  // page alone when the header is already visible.
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (open) headRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [open]);

  const headId = `editor-section-head-${id}`;
  const panelId = `editor-section-panel-${id}`;

  return (
    <section className={`editor-section${open ? ' is-open' : ''}${className ? ` ${className}` : ''}`}>
      <h3 className="editor-section-h">
        <button
          ref={headRef}
          type="button"
          id={headId}
          className="editor-section-head"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => group?.toggle(id)}
        >
          <span className="card-title">{title}</span>
          {badge ?? (
            <>
              {status === 'done' && <span className="badge badge-green">Done</span>}
              {status === 'todo' && <span className="badge badge-amber">To do</span>}
              {status === 'optional' && <span className="badge editor-section-badge">Optional</span>}
            </>
          )}
          <svg className="editor-section-chevron" viewBox="0 0 20 20" aria-hidden focusable="false">
            <path
              d="M5.5 7.5 10 12l4.5-4.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="card-hint editor-section-hint">{hint}</span>
        </button>
      </h3>

      {/* Never unmounted — see the note above. */}
      <div
        id={panelId}
        role="region"
        aria-labelledby={headId}
        className={`editor-section-body${open ? '' : ' is-hidden'}`}
      >
        {children}
      </div>
    </section>
  );
}
