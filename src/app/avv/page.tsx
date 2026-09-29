import type { Metadata } from 'next';
import Link from 'next/link';
import AvvText from '@/components/legal/AvvText';
import PrintButton from '@/components/legal/PrintButton';
import { LEGAL_TERMS_VERSION, legalDateLabel } from '@/lib/legal';

// The contract quotes the retention constants and the operator's details from
// the environment, so it is rendered per request like /privacy.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Auftragsverarbeitungsvertrag (AVV)',
  description:
    'Der Vertrag über die Verarbeitung personenbezogener Daten im Auftrag (Art. 28 DSGVO) zwischen Veranstaltern bzw. Verkäufern und dem Betreiber der Plattform.',
  alternates: { canonical: '/avv' },
};

/**
 * The public copy of the Auftragsverarbeitungsvertrag, with the controller
 * left generic. Organizers accept it in the portal, where the same component
 * is rendered with their own details filled in; this page is where anyone —
 * an organizer deciding whether to sign up, a Verein's board, a regulator —
 * can read it without an account.
 */
export default function AvvPage() {
  return (
    <>
      <section className="feed-hero" style={{ padding: '64px 0 28px' }}>
        <div className="container container-narrow">
          <p className="feed-kicker anim-fade-up">For organizers and sellers · Für Veranstalter und Verkäufer</p>
          <h1 className="anim-fade-up anim-d1" style={{ fontSize: 'clamp(1.8rem, 4.2vw, 2.8rem)' }}>
            Auftragsverarbeitungsvertrag
          </h1>
          <p className="feed-hero-sub anim-fade-up anim-d2" style={{ marginBottom: 12 }}>
            When you sell on this platform, your buyers&rsquo; details are <em>your</em> data and we
            process them for you. This contract (Art. 28 GDPR) sets out exactly how. It is part of the{' '}
            <Link href="/terms" style={{ color: 'var(--brand-text)', fontWeight: 600 }}>
              organizer terms
            </Link>{' '}
            and you accept it in your seller hub. The German text below is the binding version.
          </p>
          <p className="muted small anim-fade-up anim-d2" style={{ marginBottom: 12 }}>
            Stand: {legalDateLabel(LEGAL_TERMS_VERSION, 'de')} · Version {LEGAL_TERMS_VERSION}
          </p>
          <PrintButton />
        </div>
      </section>

      <section className="section" style={{ paddingTop: 20 }}>
        <div className="container container-narrow">
          <AvvText />
        </div>
      </section>
    </>
  );
}
