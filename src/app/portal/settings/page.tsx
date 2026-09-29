import Link from 'next/link';
import { listEventsForOrganizer } from '@/lib/events';
import {
  LEGAL_LIMITS,
  legalDetailsComplete,
  legalTermsCurrent,
  organizerLegalExempt,
  organizerPlanActive,
} from '@/lib/organizers';
import LegalDetailsForm from './LegalDetailsForm';
import { organizerTotpEnabled, organizerTotpPending } from '@/lib/organizerTotp';

import { getReferralRewardSettings, organizerCurrency } from '@/lib/referrals';
import { getReminderSettings, recommendedReminderDays } from '@/lib/reminders';
import PlanExpired from '../PlanExpired';
import PortalNav from '../PortalNav';
import { requirePortalOrganizer } from '../guard';
import ChangePasswordForm from './ChangePasswordForm';
import TotpPanel from './TotpPanel';
import SettingsRow from './SettingsRow';
import RemindersCard from './RemindersCard';
import ReferralRewardsCard from './ReferralRewardsCard';
import PaymentConnectionsPanel from './PaymentConnectionsPanel';
import { listConnections } from '@/lib/paymentConnections';
import { getEventTiers } from '@/lib/events';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Settings — Organizer portal', robots: { index: false, follow: false } };

export default async function PortalSettingsPage() {
  const organizer = await requirePortalOrganizer();
  const planActive = organizerPlanActive(organizer);
  if (!planActive) return <PlanExpired organizer={organizer} />;

  const reminders = getReminderSettings(organizer.id);
  const maxPayWithin =
    listEventsForOrganizer(organizer.id).reduce((max, e) => Math.max(max, e.payWithinDays), 0) || 5;
  const recommended = recommendedReminderDays(maxPayWithin);
  const referral = getReferralRewardSettings(organizer.id);
  const connections = listConnections(organizer.id).map((c) => ({
    provider: c.provider,
    accountLabel: c.accountLabel,
    sandbox: c.sandbox,
    updatedAt: c.updatedAt,
  }));
  // A typical price of theirs for the fee example — the median of their paid
  // ticket types, or €25 when they have none yet.
  const prices = listEventsForOrganizer(organizer.id)
    .flatMap((e) => getEventTiers(e.id))
    .map((t) => t.priceCents)
    .filter((c) => c > 0)
    .sort((a, b) => a - b);
  const exampleCents = prices.length ? prices[Math.floor(prices.length / 2)] : 2500;

  return (
    <>
      <PortalNav active="settings" />
      <div className="container container-narrow section">
        <div className="anim-fade-up" style={{ marginBottom: 20 }}>
          <h1 className="page-title" style={{ margin: 0 }}>
            Settings
          </h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            Tap a row to change it.
          </p>
        </div>

      <div className="st-list anim-fade-up">
        <SettingsRow
          id="account"
          icon="👤"
          title="Your account"
          status={`${organizer.name} · ${planActive ? 'free, no expiry' : 'switched off'}`}
          tone={planActive ? 'plain' : 'warn'}
        >
          <div className="summary-row">
            <span className="muted">Name</span>
            <span translate="no">{organizer.name}</span>
          </div>
          <div className="summary-row">
            <span className="muted">Email</span>
            <span translate="no">{organizer.email}</span>
          </div>
          <div className="summary-row">
            <span className="muted">Account</span>
            <span>
              {planActive ? <span className="badge badge-green">active</span> : <span className="badge badge-red">disabled</span>}
            </span>
          </div>
          <p className="muted small" style={{ margin: '10px 0 0' }}>
            Free — no fees, no commission; buyers pay you directly. To change your email, ask the platform team.
          </p>
          <p className="muted small" style={{ margin: '8px 0 0' }}>
            Your buyers are yours: every order is on its listing&rsquo;s Orders page. We use their details only to send
            tickets and the reminders you switch on — never to sell or advertise.
          </p>
        </SettingsRow>

        {/* Who the seller legally is — named to buyers on every page, ticket and
            email, and the controller in the AVV (/portal/legal). */}
        <SettingsRow
          id="legal"
          icon="⚖️"
          title="Legal details shown to buyers / Angaben zum Anbieter"
          status={
            legalDetailsComplete(organizer)
              ? `${organizer.legalName}${
                  organizerLegalExempt(organizer) || legalTermsCurrent(organizer) ? '' : ' · terms not accepted yet'
                }`
              : organizerLegalExempt(organizer)
                ? 'Not needed in a demo'
                : 'Missing — needed before you can publish'
          }
          tone={
            organizerLegalExempt(organizer)
              ? 'plain'
              : legalDetailsComplete(organizer) && legalTermsCurrent(organizer)
                ? 'on'
                : 'warn'
          }
        >
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
          <p className="muted small" style={{ margin: '12px 0 0' }}>
            Terms and data processing agreement (AVV):{' '}
            <Link href="/portal/legal">
              {legalTermsCurrent(organizer) ? 'accepted — view or print yours' : 'review and accept them here'}
            </Link>
            .
          </p>
        </SettingsRow>

        <SettingsRow
          id="instant-payments"
          icon="⚡"
          title="Get paid instantly"
          status={
            connections.length
              ? `${connections.map((c) => (c.provider === 'paypal' ? 'PayPal' : 'Stripe')).join(' & ')} connected`
              : 'Not connected — optional'
          }
          tone={connections.length ? 'on' : 'plain'}
        >
          <PaymentConnectionsPanel
            connections={connections}
            currency={organizerCurrency(organizer.id)}
            exampleCents={exampleCents}
          />
        </SettingsRow>

        <SettingsRow
          id="reminders"
          icon="⏰"
          title="Payment reminders"
          status={reminders.enabled ? `On · ${reminders.days.map((d) => `day ${d}`).join(', ') || 'default days'}` : 'Off'}
          tone={reminders.enabled ? 'on' : 'plain'}
        >
          <RemindersCard initialEnabled={reminders.enabled} initialDays={reminders.days} recommended={recommended} />
        </SettingsRow>

        <SettingsRow
          id="referrals"
          icon="🎁"
          title="Thank people who bring friends"
          status={referral.threshold > 0 && referral.rewardCents > 0 ? `On · reward after ${referral.threshold} friends` : 'Off'}
          tone={referral.threshold > 0 && referral.rewardCents > 0 ? 'on' : 'plain'}
        >
          <ReferralRewardsCard
            initialThreshold={referral.threshold}
            initialRewardCents={referral.rewardCents}
            currency={organizerCurrency(organizer.id)}
          />
        </SettingsRow>

        <SettingsRow
          id="security"
          icon="🔒"
          title="Password & sign-in"
          status={organizerTotpEnabled(organizer.id) ? 'Authenticator on' : 'Password only — add an authenticator'}
          tone={organizerTotpEnabled(organizer.id) ? 'on' : 'warn'}
        >
          <ChangePasswordForm />
          {/* The other half of the same question: who may get into this account. */}
          <TotpPanel enabled={organizerTotpEnabled(organizer.id)} unfinished={organizerTotpPending(organizer.id)} />
        </SettingsRow>
      </div>
      </div>
    </>
  );
}
