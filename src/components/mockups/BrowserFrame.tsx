import type { ReactNode } from 'react';

/**
 * Decorative browser chrome (traffic lights + centered url pill) around a
 * pure-CSS product "screenshot". Everything inside is sized in em against a
 * container-query font-size on .mock-browser, so the whole shot scales with
 * the column it sits in.
 */
export default function BrowserFrame({
  url,
  children,
}: {
  url: string;
  children: ReactNode;
}) {
  return (
    <div className="mock-browser">
      <div className="mock-browser-bar">
        <span className="mock-dots">
          <span className="mock-dot mock-dot-r" />
          <span className="mock-dot mock-dot-y" />
          <span className="mock-dot mock-dot-g" />
        </span>
        <span className="mock-url">{url}</span>
      </div>
      <div className="mock-browser-body">{children}</div>
    </div>
  );
}
