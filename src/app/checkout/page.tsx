import type { Metadata } from 'next';
import Link from 'next/link';
import { getPaymentMode, getPublicConfig, isTransferConfigured } from '@/lib/config';
import { getAvailabilityCached } from '@/lib/inventory';
import { expireOverdueTransferReservationsThrottled } from '@/lib/orders';
import CheckoutClient from './CheckoutClient';

// Availability comes from the database — always render fresh.
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const cfg = getPublicConfig();
  return { title: `Checkout — ${cfg.eventName}` };
}

export default function CheckoutPage() {
  const config = getPublicConfig();
  // Overdue transfer reservations release their seats before we count stock.
  expireOverdueTransferReservationsThrottled();
  const availability = getAvailabilityCached();

  if (!config.salesOpen) {
    return (
      <div className="container container-narrow">
        <h1 className="page-title anim-fade-up">Checkout</h1>
        <div className="notice notice-warn anim-fade-up anim-d1">
          Ticket sales are currently closed, so nothing can be booked right now. Check back soon!
        </div>
        <p className="anim-fade-up anim-d2">
          <Link href="/" className="btn">
            Back to the event page
          </Link>
        </p>
      </div>
    );
  }

  if (availability.totalRemaining === 0) {
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
          <Link href="/" className="btn">
            Back to the event page
          </Link>
        </p>
      </div>
    );
  }

  const mode = getPaymentMode();
  const paypalClientId = process.env.PAYPAL_CLIENT_ID ?? null;

  return (
    <CheckoutClient
      config={config}
      availability={availability}
      mode={mode}
      paypalClientId={paypalClientId}
      transferConfigured={isTransferConfigured()}
    />
  );
}
