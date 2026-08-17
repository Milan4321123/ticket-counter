import { listEventsForOrganizer } from '@/lib/events';
import { organizerPlanActive } from '@/lib/organizers';
import { organizerTotpEnabled, organizerTotpPending } from '@/lib/organizerTotp';
import { platformFeeRule } from '@/lib/platform';
import { getReminderSettings, recommendedReminderDays } from '@/lib/reminders';
import PlanExpired from '../PlanExpired';
import PortalNav from '../PortalNav';
import { requirePortalOrganizer } from '../guard';
import ChangePasswordForm from './ChangePasswordForm';
import TotpPanel from './TotpPanel';
import RemindersCard from './RemindersCard';

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

  return (
    <>
      <PortalNav active="settings" />
      <div className="container container-narrow section">
        <div className="anim-fade-up" style={{ marginBottom: 20 }}>
          <h1 className="page-title" style={{ margin: 0 }}>
            Settings
          </h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            Your account, payment reminders, and password.
          </p>
        </div>

      <div className="card anim-fade-up">
        <div className="card-title">Your account</div>
        <div className="summary-row">
          <span className="muted">Name</span>
          <span>{organizer.name}</span>
        </div>
        <div className="summary-row">
          <span className="muted">Email</span>
          <span>{organizer.email}</span>
        </div>
        <div className="summary-row">
          <span className="muted">Account</span>
          <span>
            {planActive ? (
              <>
                <span className="badge badge-green">active</span>{' '}
                <span className="muted small">free — no expiry</span>
              </>
            ) : (
              <span className="badge badge-red">disabled</span>
            )}
          </span>
        </div>
        <div className="summary-row">
          <span className="muted">Pricing</span>
          <span>{platformFeeRule()}</span>
        </div>
        <p className="muted small" style={{ margin: '10px 0 0' }}>
          The account costs nothing to keep — you pay per event, when you publish one, and never any
          commission on ticket sales. The fee follows the capacity you set for that event, and the
          exact amount is on its Publish tab. Your email address is managed by the platform team; get
          in touch with them to change it.
        </p>
      </div>

      <div className="card anim-fade-up anim-d1">
        <div className="card-title">You own your own data</div>
        <p className="muted small" style={{ marginTop: 0 }}>
          Ticket money goes straight to the bank account you put on each event — we never hold it,
          so there is no payout to wait for. Your buyers are yours too: every order, with the name
          and email they gave you, is on that event&rsquo;s Orders page and stays searchable. We use
          those details to send their tickets and the payment reminders you switch on below, and for
          nothing else — we don&rsquo;t sell them and we don&rsquo;t market to them. When an event
          is over, you can delete it and its data from the portal yourself, whenever you like.
        </p>
      </div>

      <div className="card anim-fade-up anim-d2">
        <div className="card-title">Payment reminders</div>
        <RemindersCard
          initialEnabled={reminders.enabled}
          initialDays={reminders.days}
          recommended={recommended}
        />
      </div>

      <div className="card anim-fade-up anim-d3">
        <div className="card-title">Change password</div>
        <ChangePasswordForm />

        {/* Sits with the password, because it is the other half of the same
            question: who is allowed into this account. */}
        <TotpPanel enabled={organizerTotpEnabled(organizer.id)} unfinished={organizerTotpPending(organizer.id)} />
      </div>
      </div>
    </>
  );
}
