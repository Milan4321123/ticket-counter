import Link from 'next/link';
import { LEGAL_TERMS_VERSION } from '@/lib/legal';
import { currentOrganizer, legalStepsMissing } from '@/lib/organizers';

/**
 * "Before you can publish: your legal details / the terms + AVV" — shown on
 * every portal page (through PortalNav) until both steps on /portal/legal are
 * done. The dashboard gets the fuller card; every other page a one-line strip.
 *
 * Renders nothing for demo and example accounts (lib/organizers
 * organizerLegalExempt) and once everything is in place. Live listings are
 * never affected — the copy says so, because "your event goes offline" is the
 * first fear a Verein with a sold-out night would have reading this.
 */
export default async function LegalBanner({ variant = 'strip' }: { variant?: 'strip' | 'card' }) {
  const organizer = await currentOrganizer();
  if (!organizer) return null;
  const steps = legalStepsMissing(organizer);
  if (steps.length === 0) return null;

  const updated = steps.includes('accept') && Boolean(organizer.legalAcceptedVersion);
  const todo = [
    steps.includes('details') ? 'add your legal details (who buyers are buying from)' : null,
    steps.includes('accept')
      ? updated
        ? `accept the updated terms and data processing agreement (version ${LEGAL_TERMS_VERSION})`
        : 'accept the terms and the data processing agreement (AVV)'
      : null,
  ].filter(Boolean) as string[];
  const sentence = todo.join(' and ');

  if (variant === 'card') {
    return (
      <div className="notice notice-warn anim-fade-up" role="status" style={{ margin: 0 }}>
        <strong>One legal step before you publish.</strong> Please {sentence}. It takes two minutes, and it is what
        lets buyers see who they are buying from and who looks after their data. Listings that are already live stay
        live.
        <div style={{ marginTop: 10 }}>
          <Link href="/portal/legal" className="btn btn-brand btn-sm">
            Open the Legal page →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ marginTop: 12 }}>
      <div className="notice notice-warn small" role="status" style={{ margin: 0 }}>
        Before you can publish: {sentence}. <Link href="/portal/legal">Do it now →</Link>
      </div>
    </div>
  );
}
