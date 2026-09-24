import QRCode from 'qrcode';
import sharp from 'sharp';
import { NextResponse } from 'next/server';
import { getEventById, getEventTier } from '@/lib/events';
import { getOrganizer } from '@/lib/organizers';
import { getOrder, getTicketByCode } from '@/lib/orders';
import { platformNameFromEnv } from '@/lib/platform';
import { clientIp, rateLimit } from '@/lib/ratelimit';
import { parseSeatMap, seatForTicket, seatLabel } from '@/lib/seats';

export const dynamic = 'force-dynamic';

const W = 1080;
const H = 1920;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Up to `lines` lines of about `chars` characters, breaking on spaces. */
function wrap(text: string, chars: number, lines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > chars && cur) {
      out.push(cur);
      cur = w;
      if (out.length === lines) break;
    } else cur = (cur + ' ' + w).trim();
  }
  if (out.length < lines && cur) out.push(cur);
  if (out.length === lines && words.join(' ').length > out.join(' ').length) out[lines - 1] = out[lines - 1].replace(/.{0,2}$/, '…');
  return out;
}

/**
 * GET /api/tickets/<code>/pass — a phone-sized PNG of one ticket, for saving
 * to the photo library: the wallet-pass idea without needing an Apple or
 * Google issuer account. The code is the capability, exactly as for the ticket
 * page; only a PAID order's ticket renders.
 */
export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  if (!rateLimit(`ticket-pass:${clientIp(req)}`, 30, 60_000)) {
    return new NextResponse('Too many requests', { status: 429 });
  }
  const { code } = await params;
  const ticket = getTicketByCode(decodeURIComponent(code));
  if (!ticket || ticket.orderStatus !== 'paid') return new NextResponse('Not found', { status: 404 });
  const order = getOrder(ticket.orderId);
  const event = order ? getEventById(order.eventId) : null;
  if (!order || !event) return new NextResponse('Not found', { status: 404 });

  const isShop = event.kind === 'shop';
  const issuer = getOrganizer(event.organizerId)?.name?.trim() || (isShop ? 'the seller' : 'the organizer');
  const tier = getEventTier(event.id, ticket.tierId)?.name ?? ticket.tierId;
  const seat = seatForTicket(order.id, ticket.tierId, ticket.code, parseSeatMap(event.seatMap));
  const when = isShop ? (event.pickupInfo.split('\n').map((l) => l.trim()).find(Boolean) ?? '') : event.dateDisplay;
  const where = [event.venueName, event.city].filter(Boolean).join(', ');

  const qrSvg = await QRCode.toString(ticket.code, { type: 'svg', margin: 0, errorCorrectionLevel: 'M' });
  const qrInner = qrSvg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  const qrViewBox = /viewBox="([^"]+)"/.exec(qrSvg)?.[1] ?? '0 0 33 33';

  const title = wrap(event.name, 22, 2);
  const lines = [when, where].filter(Boolean).flatMap((l) => wrap(l, 36, 2)).slice(0, 3);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3b0a18"/><stop offset="0.55" stop-color="#12051a"/><stop offset="1" stop-color="#050610"/></linearGradient>
    <radialGradient id="glow" cx="0.2" cy="0.1" r="0.7"><stop offset="0" stop-color="#dc143c" stop-opacity="0.45"/><stop offset="1" stop-color="#dc143c" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>
  <rect width="100%" height="100%" fill="url(#glow)"/>
  <text x="90" y="150" font-family="Helvetica Neue, Arial, sans-serif" font-size="34" font-weight="800" letter-spacing="8" fill="#ff8fa5">${esc(isShop ? 'COLLECTION CODE' : 'TICKET')}</text>
  ${title.map((t, i) => `<text x="90" y="${250 + i * 92}" font-family="Helvetica Neue, Arial, sans-serif" font-size="84" font-weight="800" fill="#ffffff">${esc(t)}</text>`).join('\n  ')}
  ${lines.map((t, i) => `<text x="90" y="${250 + title.length * 92 + 20 + i * 52}" font-family="Helvetica Neue, Arial, sans-serif" font-size="40" fill="#c9cddb">${esc(t)}</text>`).join('\n  ')}
  <rect x="90" y="760" width="900" height="900" rx="44" fill="#ffffff"/>
  <svg x="150" y="820" width="780" height="780" viewBox="${qrViewBox}">${qrInner}</svg>
  <text x="${W / 2}" y="1730" text-anchor="middle" font-family="Menlo, monospace" font-size="54" font-weight="700" letter-spacing="6" fill="#ffffff">${esc(ticket.code)}</text>
  <text x="${W / 2}" y="1790" text-anchor="middle" font-family="Helvetica Neue, Arial, sans-serif" font-size="38" font-weight="700" fill="#fbbf24">${esc(seat ? seatLabel(seat) : tier)}</text>
  <text x="${W / 2}" y="1845" text-anchor="middle" font-family="Helvetica Neue, Arial, sans-serif" font-size="30" fill="#9aa1b5">${esc(`${ticket.buyerName} · ${isShop ? 'sold' : 'issued'} by ${issuer}`)}</text>
  <text x="${W / 2}" y="1890" text-anchor="middle" font-family="Helvetica Neue, Arial, sans-serif" font-size="24" fill="#5d6378">${esc(platformNameFromEnv())} · one scan only</text>
</svg>`;

  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return new NextResponse(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Content-Disposition': `inline; filename="${isShop ? 'order' : 'ticket'}-${ticket.code}.png"`,
      'Cache-Control': 'private, max-age=300',
      'X-Robots-Tag': 'noindex',
    },
  });
}
