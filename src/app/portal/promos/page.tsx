import { listEventsForOrganizer } from '@/lib/events';
import { organizerPlanActive } from '@/lib/organizers';
import { listPromoCodes } from '@/lib/promos';
import { organizerCurrency } from '@/lib/referrals';
import PlanExpired from '../PlanExpired';
import PortalNav from '../PortalNav';
import { requirePortalOrganizer } from '../guard';
import PromoCodesCard from './PromoCodesCard';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Discount codes — Organizer portal',
  robots: { index: false, follow: false },
};

/**
 * The organizer's own codes: the ones they mint and hand out themselves, as
 * opposed to the thank-you vouchers the referral rewards issue automatically.
 *
 * Its own page rather than another card under Settings: this is a list that
 * grows, with a form on top of it, and it is somewhere an organizer comes back
 * to during a sale — not a setting they choose once.
 */
export default async function PortalPromosPage() {
  const organizer = await requirePortalOrganizer();
  if (!organizerPlanActive(organizer)) return <PlanExpired organizer={organizer} />;

  const codes = listPromoCodes(organizer.id);
  const listings = listEventsForOrganizer(organizer.id).map((e) => ({
    id: e.id,
    name: e.name,
  }));

  return (
    <>
      <PortalNav />
      <div className="container container-narrow section">
        <div className="anim-fade-up" style={{ marginBottom: 20 }}>
          <h1 className="page-title" style={{ margin: 0 }}>
            Discount codes
          </h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            Codes you hand out yourself — an early-bird code, one for a sponsor, one for a WhatsApp
            group. Buyers type them into the same box at checkout as the thank-you vouchers your
            referrers earn.
          </p>
        </div>
        <PromoCodesCard
          initialCodes={codes}
          listings={listings}
          currency={organizerCurrency(organizer.id)}
        />
      </div>
    </>
  );
}
