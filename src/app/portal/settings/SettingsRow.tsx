'use client';

// One row of the settings list: icon, title and what it is set to now, and
// the whole form underneath once tapped — like a phone's settings. A link to
// /portal/settings#<id> opens that row by itself.
import { useEffect, useRef, type ReactNode } from 'react';

export default function SettingsRow({
  id,
  icon,
  title,
  status,
  tone = 'plain',
  children,
}: {
  id: string;
  icon: string;
  title: string;
  /** What it is set to right now, in a few words. */
  status: string;
  tone?: 'plain' | 'on' | 'warn';
  children: ReactNode;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const open = () => {
      if (window.location.hash === `#${id}` && ref.current) {
        ref.current.open = true;
        ref.current.scrollIntoView({ block: 'start', behavior: 'smooth' });
      }
    };
    open();
    window.addEventListener('hashchange', open);
    return () => window.removeEventListener('hashchange', open);
  }, [id]);

  return (
    <details ref={ref} id={id} className="st-row">
      <summary>
        <span className="st-icon" aria-hidden="true">
          {icon}
        </span>
        <span className="st-text">
          <strong>{title}</strong>
          <span className={`st-status st-${tone}`}>{status}</span>
        </span>
        <span className="st-chev" aria-hidden="true">
          ›
        </span>
      </summary>
      <div className="st-body">{children}</div>
    </details>
  );
}
