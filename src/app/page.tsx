import Link from 'next/link';
import { getPaymentMode, getPublicConfig } from '@/lib/config';
import { getAvailabilityCached } from '@/lib/inventory';
import { formatMoney } from '@/lib/money';

// Availability comes from the database — always render fresh.
export const dynamic = 'force-dynamic';

interface Step {
  step: number;
  title: string;
  desc: string;
}

function howItWorks(mode: ReturnType<typeof getPaymentMode>): Step[] {
  const steps =
    mode === 'transfer'
      ? [
          {
            title: 'Reserve your tickets',
            desc: 'Pick your tickets at checkout and reserve them in one click — no account needed, and your seats are held for you right away.',
          },
          {
            title: 'Transfer the amount with your personal reference',
            desc: 'You get our bank details and a personal payment reference. Send a normal bank transfer from any bank app — no fees, just remember to include the reference.',
          },
          {
            title: 'We confirm and email your QR tickets',
            desc: 'As soon as your transfer arrives (usually 1–2 business days), we confirm it and your QR-code tickets land in your inbox.',
          },
          {
            title: 'Show the QR code at the door',
            desc: 'Bring your QR codes on your phone or on paper. One quick scan per ticket and you are in — enjoy the show!',
          },
        ]
      : [
          {
            title: 'Pick your tickets',
            desc: 'Choose your ticket types and quantities at checkout.',
          },
          {
            title: 'Pay securely',
            desc: 'Complete your purchase with PayPal or a debit/credit card. You are only charged once you approve the payment.',
          },
          {
            title: 'Get your QR tickets',
            desc: 'Your QR-code tickets appear on screen right away and are emailed to you.',
          },
          {
            title: 'Show the QR code at the door',
            desc: 'Bring your QR codes on your phone or on paper. One quick scan per ticket and you are in — enjoy the show!',
          },
        ];
  return steps.map((item, i) => ({ ...item, step: i + 1 }));
}

export default function HomePage() {
  const cfg = getPublicConfig();
  const steps = howItWorks(getPaymentMode());
  const availability = getAvailabilityCached();
  const { totalRemaining } = availability;
  const soldOut = totalRemaining === 0;

  return (
    <>
      <section className="hero">
        <div className="container">
          <p className="hero-kicker anim-fade-up">Live in concert</p>
          <h1 className="anim-fade-up anim-d1">{cfg.eventName}</h1>
          <p className="hero-meta anim-fade-up anim-d2">
            <strong>{cfg.artist}</strong>
            <br />
            {cfg.dateDisplay}
            <br />
            {cfg.venue}
          </p>
          {cfg.salesOpen ? (
            <div>
              {!soldOut && (
                <p className="anim-fade-up anim-d3">
                  <Link href="/checkout" className="btn btn-primary btn-lg">
                    Buy tickets
                  </Link>
                </p>
              )}
              <p className="anim-fade-up anim-d4">
                {soldOut ? (
                  <span className="badge badge-red">Sold out</span>
                ) : totalRemaining <= 50 ? (
                  <span className="badge badge-amber">Only {totalRemaining} tickets left</span>
                ) : (
                  <span className="badge badge-green">Tickets available</span>
                )}
              </p>
            </div>
          ) : (
            <div
              className="notice notice-warn anim-fade-up anim-d3"
              style={{ display: 'inline-block' }}
            >
              Ticket sales are currently closed — check back soon.
            </div>
          )}
        </div>
      </section>

      <section className="section">
        <div className="container">
          <h2 className="page-title">Tickets</h2>
          <div className="tier-grid">
            {cfg.tiers.map((tier) => {
              const remaining = availability.tiers[tier.id]?.remaining ?? 0;
              return (
                <div className="tier-card glow-card" key={tier.id}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {remaining === 0 ? (
                      <span className="badge badge-red">Sold out</span>
                    ) : remaining <= 25 ? (
                      <span className="badge badge-amber">Only {remaining} left</span>
                    ) : (
                      <span className="badge badge-green">Available</span>
                    )}
                    {tier.studentOnly && <span className="badge badge-student">Student</span>}
                  </div>
                  <div className="tier-name">{tier.name}</div>
                  <div className="tier-price">{formatMoney(tier.priceCents, cfg.currency)}</div>
                  <p className="tier-desc">{tier.description}</p>
                  {tier.studentOnly && (
                    <p className="small muted" style={{ margin: 0 }}>
                      Bring a valid student ID — it&rsquo;s checked at the entrance.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
          <p className="muted small">Up to {cfg.maxTicketsPerOrder} tickets per order.</p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <h2 className="page-title">How it works</h2>
          <ol className="step-list" style={{ maxWidth: 680 }}>
            {steps.map((item) => (
              <li className="step-item" key={item.step}>
                <span className="step-num">{item.step}</span>
                <div>
                  <div className="tier-name">{item.title}</div>
                  <p className="tier-desc" style={{ margin: '2px 0 0' }}>
                    {item.desc}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <h2 className="page-title">About the event</h2>
          <p className="muted" style={{ maxWidth: 680 }}>
            {cfg.description}
          </p>
          {cfg.salesOpen && !soldOut && (
            <p style={{ marginTop: 24 }}>
              <Link href="/checkout" className="btn btn-primary btn-lg">
                Get your tickets
              </Link>
            </p>
          )}
          {!cfg.salesOpen && (
            <div className="notice notice-warn" style={{ display: 'inline-block' }}>
              Ticket sales are currently closed.
            </div>
          )}
        </div>
      </section>
    </>
  );
}
