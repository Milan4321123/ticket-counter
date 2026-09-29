import type { ReactNode } from 'react';

/**
 * One numbered section of a legal page: a card with an anchor, so the table of
 * contents and a "see section 7" can link straight to it. `tone="notice"`
 * draws the brand-coloured frame used for text the law wants set apart (the
 * Art. 21 objection right must be presented "clearly and separately").
 */
export function LegalSection({
  id,
  title,
  tone,
  children,
}: {
  id: string;
  title: string;
  tone?: 'notice';
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className={tone === 'notice' ? 'card glow-card legal-section' : 'card legal-section'}
      style={
        tone === 'notice'
          ? { borderColor: 'var(--brand, var(--border))', borderWidth: 2, scrollMarginTop: 90 }
          : { scrollMarginTop: 90 }
      }
    >
      <h2 className="card-title">{title}</h2>
      {children}
    </section>
  );
}

export const legalListStyle = { paddingLeft: 20, lineHeight: 1.7 } as const;

/** A small heading inside a section ("Rechtsgrundlage", "Speicherdauer"). */
export function LegalSub({ children }: { children: ReactNode }) {
  return <h3 style={{ fontSize: '0.98rem', fontWeight: 700, margin: '14px 0 4px' }}>{children}</h3>;
}
