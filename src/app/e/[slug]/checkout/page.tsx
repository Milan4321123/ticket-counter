import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPaymentMode } from '@/lib/config';
import { getEventBySlug, getEventTiers, paypalPayee } from '@/lib/events';
import { getAvailability } from '@/lib/inventory';
import { expireOverdueTransferReservations } from '@/lib/orders';
import { effectivePayout } from '@/lib/payout';
import { BUYER_RETENTION_DAYS } from '@/lib/retention';
import CheckoutClient from './CheckoutClient';

// Availability comes from the database — always render fresh.
export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ slug: string }>;
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

export default async function EventCheckoutPage({ params }: Params) {
  const { slug } = await params;
  const event = getEventBySlug(slug);
  if (!event || event.status !== 'published') notFound();

  // Overdue transfer reservations release their seats before we count stock.
  expireOverdueTransferReservations(event.id);
  const availability = getAvailability(event.id);

  if (!event.salesOpen) {
    return (
      <div className="container container-narrow">
        <h1 className="page-title anim-fade-up">Checkout</h1>
        <div className="notice notice-warn anim-fade-up anim-d1">
          Ticket sales are currently closed, so nothing can be booked right now. Check back soon!
        </div>
        <p className="anim-fade-up anim-d2">
          <Link href={`/e/${event.slug}`} className="btn">
            Back to the event page
          </Link>
        </p>
      </div>
    );
  }

  if (!availability.unlimited && availability.totalRemaining === 0) {
    return (
      <div className="container container-narrow">
        <h1 className="page-title anim-fade-up">Checkout</h1>
        <div className="notice notice-error anim-fade-up anim-d1">
          This event is completely sold out — thank you for the incredible interest!
        </div>
        <p className="muted anim-fade-up anim-d2">
          If a reserved order is not paid in time, its seats are released again — so it can be
          worth checking back later.
        </p>
        <p className="anim-fade-up anim-d3">
          <Link href={`/e/${event.slug}`} className="btn">
            Back to the event page
          </Link>
        </p>
      </div>
    );
  }

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
      config={{
        eventName: event.name,
        artist: event.artist,
        dateDisplay: event.dateDisplay,
        venue: [event.venueName, event.city].filter(Boolean).join(', '),
        currency: event.currency,
        maxTicketsPerOrder: event.maxPerOrder,
        tiers: getEventTiers(event.id).map((t) => ({
          id: t.tierKey,
          name: t.name,
          priceCents: t.priceCents,
          studentOnly: t.studentOnly,
          description: t.description,
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
