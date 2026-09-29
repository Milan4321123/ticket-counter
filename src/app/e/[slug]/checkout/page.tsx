import type { Metadata } from 'next';
import { listingOpenTo } from '@/lib/demo';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getEventBySlug, getEventMedia, getEventTiers, mediaUrl } from '@/lib/events';
import { getAvailability } from '@/lib/inventory';
import { ticketState, tiersInSaleOrder } from '@/lib/ticketState';
import { cityLabel, otherShowsByAct, shortDateLabel } from '@/lib/sameAct';
import CityCheck from '@/components/CityCheck';
import { vocabFor } from '@/lib/vocab';
import { expireOverdueTransferReservations } from '@/lib/orders';
import { getOrganizer } from '@/lib/organizers';
import { getSellerIdentity } from '@/lib/sellerIdentity';
import SellerBlock from '@/components/legal/SellerBlock';
import { platformName } from '@/lib/platform';
import { paymentOptionsFor } from '@/lib/paymentConnections';
import { subscriptionOffer } from '@/lib/subscriptions';
import { currentCustomer } from '@/lib/customers';
import { basketLineFor, type BasketLineData } from '@/lib/basket';
import { availableSlots, cleanTableLabel, parseChoices, parseSlotConfig } from '@/lib/kitchen';
import { parseSeatMap, takenSeats } from '@/lib/seats';
import { currentLang } from '@/lib/i18nServer';
import { BUYER_RETENTION_DAYS } from '@/lib/retention';
import CheckoutClient from './CheckoutClient';
import { readListingName } from '@/lib/exampleShop';

// Availability comes from the database — always render fresh.
export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const event = getEventBySlug(slug);
  // Never indexed: a half-finished purchase is nobody's search result, and a
  // checkout page competing with the event page for the same query would push
  // searchers into a form instead of onto the page that sells the event.
  return {
    title: event ? `Checkout — ${event.name}` : 'Checkout',
    robots: { index: false, follow: false },
  };
}

export default async function EventCheckoutPage({ params, searchParams }: Params) {
  const { slug } = await params;
  const event = getEventBySlug(slug);
  if (!event || !(await listingOpenTo(event))) notFound();

  // Overdue transfer reservations release their seats before we count stock.
  expireOverdueTransferReservations(event.id);
  const availability = getAvailability(event.id);

  // The same decision the event page and the feed made — see lib/ticketState.ts.
  // Reading only totalRemaining here let a buyer reach a checkout whose every
  // ticket type was exhausted while the room still had space. A separate
  // salesOpen check used to sit in front of this and answered "sales are
  // closed" in the one voice, which on an event the organizer has marked as not
  // yet open said the opposite of what every other page said.
  const state = ticketState(event, getEventTiers(event.id), availability);
  if (!state.buyable) {
    return (
      <div className="container container-narrow">
        <h1 className="page-title anim-fade-up">Checkout</h1>
        <div className={`notice anim-fade-up anim-d1 ${state.kind === 'sold-out' ? 'notice-error' : 'notice-warn'}`}>
          {state.kind === 'coming-soon'
            ? `${vocabFor(event.kind).Units} are not on sale yet — nothing can be booked just now.`
            : state.kind === 'sold-out'
              ? `This ${vocabFor(event.kind).listing} is completely sold out — thank you for the incredible interest!`
              : 'Sales are currently closed, so nothing can be booked right now. Check back soon!'}
        </div>
        {state.kind === 'sold-out' ? (
          <p className="muted anim-fade-up anim-d2">
            If a reserved order is not paid in time, its seats are released again — so it can be
            worth checking back later.
          </p>
        ) : null}
        <p className="anim-fade-up anim-d3">
          <Link href={`/e/${event.slug}`} className="btn">
            Back to the {vocabFor(event.kind).listing} page
          </Link>
        </p>
      </div>
    );
  }

  // ?tier= comes from tapping a ticket card on the event page. Validated here
  // rather than trusted: it reaches the client as a preselected quantity, so a
  // hand-typed value must not be able to preselect a type that is coming soon,
  // hidden, sold out, or belongs to another event. Anything unrecognised is
  // simply ignored — a wrong link should open a normal checkout, not an error.
  const sp = await searchParams;
  const wantTier = sp.tier;
  const wantedKey = Array.isArray(wantTier) ? wantTier[0] : wantTier;
  const preselectTier =
    getEventTiers(event.id).find(
      (t) =>
        t.tierKey === wantedKey &&
        t.status === 'on-sale' &&
        (availability.tiers[t.tierKey]?.remaining ?? 0) > 0
    )?.tierKey ?? null;

  // ?ref= is the referral code from a shared link, carried as a PLAIN query
  // param end to end (no cookie): event page → here → the create-order POST.
  // Only shape-checked at this hop — the orders API is the guard that decides
  // whether it names a real paid order; a wrong code must still check out.
  const wantRef = sp.ref;
  const rawRef = Array.isArray(wantRef) ? wantRef[0] : wantRef;
  const refCode =
    typeof rawRef === 'string' && /^[A-Za-z0-9]{8}$/.test(rawRef.trim())
      ? rawRef.trim().toUpperCase()
      : null;

  // Who the "keep me posted" box is ABOUT. The consent is per-organizer, so
  // the box must name them — a tick about "somebody" is not informed consent.
  // The seller of record names both the box and the block under the form:
  // their legal name once they filled it in, their account name until then.
  const seller = getSellerIdentity(event.organizerId);
  const organizerName = seller?.displayName || getOrganizer(event.organizerId)?.name?.trim() || '';

  // Which ways to pay this listing offers, resolved from the seller's own
  // settings and connections (lib/paymentConnections). Through
  // effectivePayout() underneath, so a payout change still inside its waiting
  // period does not reach a buyer early. Only yes/no answers and a PayPal
  // client id cross to the browser — the seller's bank details belong on the
  // order page, after someone has actually reserved.
  const options = paymentOptionsFor(event);

  // The restaurant pack, shops only: slots, the table from ?table=, choices.
  const tableFromQr = event.kind === 'shop' && event.tableCount > 0 ? cleanTableLabel(sp.table) : '';
  const shopTiers = event.kind === 'shop' ? getEventTiers(event.id) : [];
  const kitchenChoices = Object.fromEntries(
    shopTiers.map((t) => [t.tierKey, parseChoices(t.choices)]).filter(([, g]) => (g as unknown[]).length > 0)
  );
  const kitchenSlots = event.kind === 'shop' ? availableSlots(event) : [];
  // Reserved seating: the hall and what is taken right now (lib/seats).
  const seatMap = event.kind === 'event' ? parseSeatMap(event.seatMap) : null;
  const seating = seatMap?.enabled ? { map: seatMap, taken: Object.fromEntries(takenSeats(event.id)) } : null;
  const kitchen =
    event.kind === 'shop' && (kitchenSlots.length > 0 || tableFromQr || Object.keys(kitchenChoices).length > 0)
      ? {
          purpose: parseSlotConfig(event.pickupSlots).purpose,
          table: tableFromQr,
          choices: kitchenChoices,
          slots: kitchenSlots.map((d) => ({
            date: d.date,
            label: d.label,
            slots: d.slots.map((sl) => ({ value: sl.value, time: sl.time, open: sl.open })),
          })),
        }
      : null;

  const customer = event.isDemo ? null : await currentCustomer();
  // The picks here are mirrored into the cross-seller basket (lib/basket), so
  // leaving and coming back — or shopping elsewhere first — keeps them.
  const sellerName = organizerName || 'the seller';
  const basketLines = Object.fromEntries(
    getEventTiers(event.id)
      .map((t) => [t.tierKey, basketLineFor(event, t, sellerName, t.mediaId ? mediaUrl(t.mediaId, 'card', null) : null)] as const)
      .filter(([, line]) => line !== null)
  ) as Record<string, BasketLineData>;
  const liveMedia = new Set(getEventMedia(event.id).map((m) => m.id));

  const otherCities = otherShowsByAct(event).map((other) => ({
    slug: other.slug,
    city: cityLabel(other.city),
    dateLabel: shortDateLabel(other),
  }));
  return (
    <>
      {/* Every way into paying passes here: "is this the right city?" first,
          when the same act also plays elsewhere (components/CityCheck). */}
      {otherCities.length > 0 && (
        <CityCheck
          lang={await currentLang()}
          mode="gate"
          slug={event.slug}
          city={cityLabel(event.city)}
          dateLabel={shortDateLabel(event)}
          venue={event.venueName}
          act={event.artist}
          others={otherCities}
        />
      )}
    <CheckoutClient
      eventId={event.id}
      preselectTier={preselectTier}
      config={{
        eventName: event.name,
        slug: event.slug,
        artist: event.artist,
        dateDisplay: event.dateDisplay,
        venue: [event.venueName, event.city].filter(Boolean).join(', '),
        // The city alone, and the date in four words: the two things a buyer
        // checks a ticket against, given to the page separately from the
        // address line so it can print them where they will be read.
        city: cityLabel(event.city),
        whenLabel: shortDateLabel(event),
        currency: event.currency,
        maxTicketsPerOrder: event.maxPerOrder,
        kind: event.kind,
        example: readListingName(event.name).isExample,
        wishable: event.status === 'published' && !event.isDemo,
        // Coming-soon types are not offered at checkout at all: a stepper that
        // cannot go above zero is a worse answer than not showing the row.
        // Same order as the grid the buyer just tapped through — what is
        // still available first, what has gone underneath it.
        tiers: tiersInSaleOrder(getEventTiers(event.id), availability)
          .filter((t) => t.status === 'on-sale')
          .map((t) => ({
            id: t.tierKey,
            name: t.name,
            priceCents: t.priceCents,
            studentOnly: t.studentOnly,
            description: t.description,
            seatsPerUnit: t.seatsPerUnit,
            // The item's own photo, for the shop checkout's "add more" grid —
            // only when that picture still exists on this listing.
            image: t.mediaId && liveMedia.has(t.mediaId) ? mediaUrl(t.mediaId, 'card', null) : null,
          })),
      }}
      availability={availability}
      kitchen={kitchen}
      subscribe={tableFromQr ? null : subscriptionOffer(event)}
      customer={customer ? { name: customer.name, email: customer.email } : null}
      basketLines={basketLines}
      lang={await currentLang()}
      seating={seating}
      payment={{
        transfer: options.transfer,
        bank: options.bank,
        paypalMe: options.paypalMe,
        paypal: options.paypal ? { clientId: options.paypal.clientId, sandbox: options.paypal.sandbox } : null,
        stripe: options.stripe !== null,
        mock: options.mock,
      }}
      retentionDays={BUYER_RETENTION_DAYS}
      organizerName={organizerName}
      refCode={refCode}
      otherCities={otherCities}
    />
      {/* Who the buyer is contracting with, before they pay: the seller's
          legal identity (always at least their name), and that the platform is
          only the software. Rendered here rather than inside the client form so
          the seller is named even before any script has run. */}
      <div className="container container-narrow">
        <SellerBlock
          seller={seller}
          kind={event.kind === 'shop' ? 'shop' : 'event'}
          platformName={platformName()}
          fallback
          style={{ margin: '8px 0 32px' }}
        />
      </div>
    </>
  );
}
