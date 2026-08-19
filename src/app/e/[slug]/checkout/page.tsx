import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPaymentMode } from '@/lib/config';
import { getEventBySlug, getEventTiers, paypalPayee } from '@/lib/events';
import { getAvailability } from '@/lib/inventory';
import { ticketState } from '@/lib/ticketState';
import { vocabFor } from '@/lib/vocab';
import { expireOverdueTransferReservations } from '@/lib/orders';
import { effectivePayout } from '@/lib/payout';
import { BUYER_RETENTION_DAYS } from '@/lib/retention';
import CheckoutClient from './CheckoutClient';

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
  if (!event || event.status !== 'published') notFound();

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
  const wantTier = (await searchParams).tier;
  const wantedKey = Array.isArray(wantTier) ? wantTier[0] : wantTier;
  const preselectTier =
    getEventTiers(event.id).find(
      (t) =>
        t.tierKey === wantedKey &&
        t.status === 'on-sale' &&
        (availability.tiers[t.tierKey]?.remaining ?? 0) > 0
    )?.tierKey ?? null;

  const mode = getPaymentMode();
  const paypalClientId = process.env.PAYPAL_CLIENT_ID ?? null;
  // Per-event bank details: transfers only work once the organizer filled them
  // in. Through effectivePayout(), so a payout change that is still inside its
  // waiting period does not reach a buyer early — until it matures, this page
  // keeps offering the account the organizer has been selling on all along.
  const payout = effectivePayout(event);
  const transferConfigured = Boolean(payout.iban.trim() && payout.holder.trim());
  // Whether this organizer ALSO takes PayPal. Only a yes/no crosses to the
  // browser — the address itself belongs on the order page, after someone has
  // actually reserved, not on a public page for anyone to scrape.
  const paypalOffered = paypalPayee({ paypalAccount: payout.paypal }) !== null;

  return (
    <CheckoutClient
      eventId={event.id}
      preselectTier={preselectTier}
      config={{
        eventName: event.name,
        artist: event.artist,
        dateDisplay: event.dateDisplay,
        venue: [event.venueName, event.city].filter(Boolean).join(', '),
        currency: event.currency,
        maxTicketsPerOrder: event.maxPerOrder,
        kind: event.kind,
        // Coming-soon types are not offered at checkout at all: a stepper that
        // cannot go above zero is a worse answer than not showing the row.
        tiers: getEventTiers(event.id)
          .filter((t) => t.status === 'on-sale')
          .map((t) => ({
            id: t.tierKey,
            name: t.name,
            priceCents: t.priceCents,
            studentOnly: t.studentOnly,
            description: t.description,
            seatsPerUnit: t.seatsPerUnit,
          })),
      }}
      availability={availability}
      mode={mode}
      paypalClientId={paypalClientId}
      transferConfigured={transferConfigured}
      paypalOffered={paypalOffered}
      retentionDays={BUYER_RETENTION_DAYS}
    />
  );
}
