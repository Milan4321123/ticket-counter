import Link from 'next/link';
import AvvText from '@/components/legal/AvvText';
import PrintButton from '@/components/PrintButton';
import { LEGAL_TERMS_VERSION, legalDateLabel } from '@/lib/legal';
import {
  LEGAL_LIMITS,
  legalDetailsComplete,
  legalTermsCurrent,
  organizerLegalExempt,
  organizerPlanActive,
} from '@/lib/organizers';
import LegalDetailsForm from '../settings/LegalDetailsForm';
import PlanExpired from '../PlanExpired';
import PortalNav from '../PortalNav';
import { requirePortalOrganizer } from '../guard';
import AcceptTermsForm from './AcceptTermsForm';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Legal — Organizer portal', robots: { index: false, follow: false } };

/**
 * Where an organizer settles the two legal steps before publishing: who they
 * are (the seller buyers are shown, and the controller in the AVV), and the
 * acceptance of the platform terms + Auftragsverarbeitungsvertrag (Art. 28
 * GDPR) in the current version. Their own filled-in AVV is printed below, so
 * they can keep a copy of the contract they concluded.
 */
export default async function PortalLegalPage() {
  const organizer = await requirePortalOrganizer();
  if (!organizerPlanActive(organizer)) return <PlanExpired organizer={organizer} />;

  const exempt = organizerLegalExempt(organizer);
  const detailsDone = legalDetailsComplete(organizer);
  const termsCurrent = legalTermsCurrent(organizer);
  const acceptedOlder = Boolean(organizer.legalAcceptedVersion) && !termsCurrent;
  const versionLabel = legalDateLabel(LEGAL_TERMS_VERSION, 'de');
  const acceptedLabel =
    termsCurrent && organizer.legalAcceptedAt ? legalDateLabel(organizer.legalAcceptedAt, 'en', true) : '';
  const allDone = exempt || (detailsDone && termsCurrent);

  const controller = detailsDone
    ? {
        name: organizer.legalName,
        addressLines: organizer.legalAddress.split('\n').filter(Boolean),
        representative: organizer.legalRepresentative || undefined,
      }
    : null;

  return (
    <>
      <PortalNav active="legal" />
      <div className="container container-narrow section">
        <div className="anim-fade-up no-print" style={{ marginBottom: 20 }}>
          <h1 className="page-title" style={{ margin: 0 }}>
            Legal
          </h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            Two steps before you can publish: tell buyers who they are buying from, and accept the terms and the data
            processing agreement. Listings that are already live stay live either way.
          </p>
        </div>

        {exempt && (
          <div className="notice anim-fade-up no-print">
            This is a demo account, so none of this is needed here. In a real account you fill in your details and
            accept the agreement on this page before your first listing goes live.
          </div>
        )}

        {/* ---- Where things stand ---- */}
        <section className="card anim-fade-up no-print" style={{ marginBottom: 16 }}>
          <div className="card-title">Status</div>
          <div className="summary-row">
            <span className="muted">Legal details</span>
            <span>
              {detailsDone ? (
                <span className="badge badge-green">complete</span>
              ) : (
                <span className="badge badge-amber">missing</span>
              )}
            </span>
          </div>
          <div className="summary-row">
            <span className="muted">Terms + AVV</span>
            <span style={{ textAlign: 'right' }}>
              {termsCurrent ? (
                <>
                  <span className="badge badge-green">accepted</span>
                  <span className="small muted" style={{ display: 'block' }}>
                    version {LEGAL_TERMS_VERSION}
                    {acceptedLabel ? ` · ${acceptedLabel}` : ''}
                  </span>
                </>
              ) : acceptedOlder ? (
                <>
                  <span className="badge badge-amber">updated — please accept again</span>
                  <span className="small muted" style={{ display: 'block' }}>
                    you accepted version {organizer.legalAcceptedVersion}
                  </span>
                </>
              ) : (
                <span className="badge badge-amber">not accepted yet</span>
              )}
            </span>
          </div>
          <p className="muted small" style={{ margin: '10px 0 0' }}>
            Read them first:{' '}
            <Link href="/terms" target="_blank">
              Nutzungsbedingungen (terms)
            </Link>{' '}
            ·{' '}
            <Link href="/avv" target="_blank">
              Auftragsverarbeitungsvertrag (AVV)
            </Link>
            . Your buyers&rsquo; data is yours: you decide what happens with it, and we process it only on your behalf
            to run your sales.
          </p>
          {allDone && !exempt && (
            <div className="notice notice-success" style={{ margin: '12px 0 0' }}>
              All done — you can publish your listings.
            </div>
          )}
        </section>

        {/* ---- Step 1: who you are ---- */}
        <section className="card anim-fade-up no-print" style={{ marginBottom: 16 }}>
          <div className="card-title">1. Legal details shown to buyers / Angaben zum Anbieter</div>
          <LegalDetailsForm
            initial={{
              legalName: organizer.legalName,
              legalAddress: organizer.legalAddress,
              legalRepresentative: organizer.legalRepresentative,
              legalRegister: organizer.legalRegister,
              legalContactEmail: organizer.legalContactEmail,
            }}
            limits={LEGAL_LIMITS}
          />
        </section>

        {/* ---- Step 2: accept ---- */}
        {!exempt && (
          <section className="card anim-fade-up no-print" style={{ marginBottom: 16 }}>
            <div className="card-title">2. Terms and data processing agreement</div>
            {termsCurrent ? (
              <p className="small" style={{ margin: 0 }}>
                You accepted the terms and concluded the AVV in the version of {versionLabel}
                {acceptedLabel ? ` on ${acceptedLabel}` : ''}. Your copy is below — print it or save it as a PDF for
                your records.
              </p>
            ) : (
              <AcceptTermsForm version={LEGAL_TERMS_VERSION} versionLabel={versionLabel} detailsComplete={detailsDone} />
            )}
          </section>
        )}

        {/* ---- Their own contract ---- */}
        <section className="anim-fade-up" style={{ marginTop: 28 }}>
          <div
            className="no-print"
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}
          >
            <h2 style={{ margin: 0, fontSize: '1.1rem' }}>
              {termsCurrent ? 'Your data processing agreement' : 'The agreement you would conclude'}
            </h2>
            <PrintButton label="Print or save as PDF" />
          </div>
          <div style={{ marginTop: 12 }}>
            <AvvText controller={controller} acceptedAt={termsCurrent ? organizer.legalAcceptedAt : null} />
          </div>
        </section>
      </div>
    </>
  );
}
