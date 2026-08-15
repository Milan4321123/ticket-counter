import { notFound } from 'next/navigation';
import PrintButton from '@/components/PrintButton';
import { getEventById, getEventTier } from '@/lib/events';
import { getOrder, getTicketByCode } from '@/lib/orders';
import { ticketQrDataUrl } from '@/lib/tickets';

export const dynamic = 'force-dynamic';

// A ticket page is a private capability (its QR admits someone) — keep it out
// of search engines.
export const metadata = { robots: { index: false, follow: false } };

export default async function TicketPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  let raw = code;
  try {
    raw = decodeURIComponent(code);
  } catch {
    // Malformed escape sequence — fall back to the raw param.
  }
  const ticket = getTicketByCode(raw);
  if (!ticket || ticket.orderStatus !== 'paid') notFound();

  // The ticket's event carries the name/date/venue printed on it.
  const order = getOrder(ticket.orderId);
  const event = order ? getEventById(order.eventId) : null;
  const eventVenue = event ? [event.venueName, event.city].filter(Boolean).join(', ') : '';
  const tierName =
    (order ? getEventTier(order.eventId, ticket.tierId)?.name : undefined) ?? ticket.tierId;
  const qr = await ticketQrDataUrl(ticket.code);

  return (
    <div className="container section" style={{ textAlign: 'center' }}>
      <div className="ticket-card anim-fade-up" style={{ maxWidth: 380, margin: '24px auto' }}>
        {event ? (
          <>
            <div style={{ fontWeight: 800, fontSize: '1.2rem', lineHeight: 1.3 }}>{event.name}</div>
            {event.artist ? (
              <div style={{ color: '#555', fontSize: '0.85rem' }}>{event.artist}</div>
            ) : null}
            {event.dateDisplay ? (
              <div style={{ color: '#555', fontSize: '0.85rem' }}>{event.dateDisplay}</div>
            ) : null}
            <div style={{ color: '#555', fontSize: '0.85rem', marginBottom: 14 }}>{eventVenue}</div>
          </>
        ) : null}
        <div
          className="qr-frame"
          style={{ border: '1px solid #e6e6e6', boxShadow: '0 8px 22px -14px rgba(0, 0, 0, 0.4)' }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt={`QR code for ticket ${ticket.code}`} width={260} height={260} />
        </div>
        <div className="ticket-code">{ticket.code}</div>
        <div className="ticket-tier">{tierName}</div>
        <div style={{ color: '#555', fontSize: '0.85rem', marginTop: 8 }}>
          Ticket holder: {ticket.buyerName}
        </div>
        <div style={{ marginTop: 12 }}>
          {ticket.checkedInAt ? (
            <span className="badge badge-amber">Already checked in</span>
          ) : (
            <span className="badge badge-green">Valid — one scan at the door</span>
          )}
        </div>
      </div>
      <div className="anim-fade-up anim-d1">
        <PrintButton label="Print or save this ticket" />
        <p className="muted small no-print" style={{ marginTop: 12 }}>
          This QR code admits one person and can only be scanned once.
        </p>
      </div>
    </div>
  );
}
