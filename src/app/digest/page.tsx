import CopyButton from '@/components/CopyButton';
import { digestText } from '@/lib/digest';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'यो हप्ता के छ — the weekly WhatsApp digest',
  description:
    'Everything on this week, as one message ready to paste into your community WhatsApp group.',
  alternates: { canonical: '/digest' },
};

// One page, one job: hand a human the message. The digest is deliberately
// delivered by PEOPLE pasting it into their own groups (see lib/digest.ts for
// why), so this page optimises for the eight seconds that takes — the text is
// visible in full, the copy button is at the top, and nothing else competes.
export default function DigestPage() {
  const text = digestText();

  return (
    <div className="container container-narrow section">
      <div className="anim-fade-up" style={{ marginBottom: 18 }}>
        <h1 className="page-title" style={{ margin: 0 }}>
          यो हप्ता के छ?
        </h1>
        <p className="muted small" style={{ margin: '4px 0 0' }}>
          This week&rsquo;s events as one WhatsApp-ready message. Copy it, paste it into your
          community group, done — the <strong>*asterisks*</strong> become bold in WhatsApp.
        </p>
      </div>

      <div className="card glow-card anim-fade-up anim-d1">
        <div
          className="card-title"
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}
        >
          <span>The message</span>
          <CopyButton value={text} label="Copy for WhatsApp" />
        </div>
        <pre
          style={{
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            fontFamily: 'inherit',
            fontSize: '0.95rem',
            lineHeight: 1.55,
            margin: 0,
          }}
        >
          {text}
        </pre>
      </div>

      <p className="muted small anim-fade-up anim-d2" style={{ marginTop: 14 }}>
        Updated automatically from what is published right now — come back any week, the message is
        already written. Group admins: pasting this weekly makes you the person who always knows
        what&rsquo;s on. That is the whole idea.
      </p>
    </div>
  );
}
