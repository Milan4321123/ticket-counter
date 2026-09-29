import { notFound } from 'next/navigation';
import PrintButton from '@/components/PrintButton';
import { getEventById, getEventTier } from '@/lib/events';
import { getOrganizer } from '@/lib/organizers';
import { getSellerIdentity, sellerAddressOneLine } from '@/lib/sellerIdentity';
import { getOrder, getTicketByCode } from '@/lib/orders';
import { ticketQrDataUrl } from '@/lib/tickets';
import { vocabFor } from '@/lib/vocab';
import { parseSeatMap, seatForTicket, seatLabel } from '@/lib/seats';

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

  // The ticket's event carries the name/date/venue printed on it — and its
  // organizer row carries who issued it. That name belongs on the ticket: the
  // organizer is the seller and the one whose door this code opens, while the
  // platform only prints the page. Falls back to a generic word when the row
  // is gone or nameless, because an honest "the organizer" beats silence.
  const order = getOrder(ticket.orderId);
  const event = order ? getEventById(order.eventId) : null;
  const organizer = event ? getOrganizer(event.organizerId) : null;
  // Their legal name and address once they filled them in (the seller of
  // record, printed on what the buyer carries to the door), else the account name.
  const seller = event ? getSellerIdentity(event.organizerId) : null;
  const issuerName =
    seller?.displayName || organizer?.name?.trim() || (event?.kind === 'shop' ? 'the seller' : 'the organizer');
  const issuerAddress = seller ? sellerAddressOneLine(seller) : '';
  const eventVenue = event ? [event.venueName, event.city].filter(Boolean).join(', ') : '';
  const tierName =
    (order ? getEventTier(order.eventId, ticket.tierId)?.name : undefined) ?? ticket.tierId;
  const qr = await ticketQrDataUrl(ticket.code);
  // Reserved seating: the one seat this ticket stands for (lib/seats).
  const seat = order && event ? seatForTicket(order.id, ticket.tierId, ticket.code, parseSeatMap(event.seatMap)) : null;
  // Same code, same scan — what changes is what the holder is being told they
  // hold. An event admits a person; a shop hands over goods.
  const v = vocabFor(event?.kind ?? 'event');
  const isShop = event?.kind === 'shop';
  const whenLine = isShop
    ? (event.pickupInfo.split('\n').map((l) => l.trim()).find(Boolean) ?? '')
    : (event?.dateDisplay ?? '');

  return (
    <div className="container section" style={{ textAlign: 'center' }}>
      <div className="ticket-card anim-fade-up" style={{ maxWidth: 380, margin: '24px auto' }}>
        {event ? (
          <>
            <div style={{ fontWeight: 800, fontSize: '1.2rem', lineHeight: 1.3 }}>{event.name}</div>
            {event.artist ? (
              <div style={{ color: '#555', fontSize: '0.85rem' }}>{event.artist}</div>
            ) : null}
            {whenLine ? (
              <div style={{ color: '#555', fontSize: '0.85rem' }}>{whenLine}</div>
            ) : null}
            {eventVenue ? (
              <div style={{ color: '#555', fontSize: '0.85rem' }}>{eventVenue}</div>
            ) : null}
            <div style={{ color: '#555', fontSize: '0.85rem', marginBottom: 14 }}>
              {isShop ? 'Sold by' : 'Issued by'} <span translate="no">{issuerName}</span>
              {issuerAddress ? (
                <div translate="no" style={{ fontSize: '0.75rem' }}>
                  {issuerAddress}
                </div>
              ) : null}
            </div>
          </>
        ) : null}
        <div
          className="qr-frame"
          style={{ border: '1px solid #e6e6e6', boxShadow: '0 8px 22px -14px rgba(0, 0, 0, 0.4)' }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt={`QR code for ${v.code} ${ticket.code}`} width={260} height={260} />
        </div>
        <div className="ticket-code">{ticket.code}</div>
        <div className="ticket-tier">{tierName}</div>
        {seat ? (
          <div style={{ fontWeight: 800, fontSize: '1.05rem', marginTop: 4 }}>{seatLabel(seat)}</div>
        ) : null}
        <div style={{ color: '#555', fontSize: '0.85rem', marginTop: 8 }}>
          {isShop ? 'Ordered by' : 'Ticket holder'}: <span translate="no">{ticket.buyerName}</span>
        </div>
        <div style={{ marginTop: 12 }}>
          {ticket.checkedInAt ? (
            <span className="badge badge-amber">Already {v.redeemed}</span>
          ) : (
            <span className="badge badge-green">Valid — one scan at {v.where}</span>
          )}
        </div>
      </div>
      <div className="anim-fade-up anim-d1">
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }} className="no-print">
          {/* A phone-sized picture of this ticket, for the photo library — works
              on every phone, with no wallet account needed. */}
          <a
            className="btn btn-brand"
            href={`/api/tickets/${encodeURIComponent(ticket.code)}/pass`}
            download={`${isShop ? 'order' : 'ticket'}-${ticket.code}.png`}
          >
            Save to phone
          </a>
          <PrintButton label={`Print this ${v.code}`} />
        </div>
        <p className="muted small no-print" style={{ marginTop: 12 }}>
          {isShop
            ? 'This QR code covers one item and can only be scanned once.'
            : 'This QR code admits one person and can only be scanned once.'}
        </p>
      </div>
    </div>
  );
}
