import {
  defaultStatementMonth,
  isStatementMonth,
  monthlyStatement,
  statementMonths,
  PAYMENT_ROUTE_LABEL,
} from '@/lib/statements';
import { requireOrganizerApi } from '../../auth';

export const dynamic = 'force-dynamic';

/**
 * CSV mechanics copied from the per-event orders export (see
 * ../../events/[id]/orders/export/route.ts, where the full reasoning lives).
 * This file has no buyer-typed columns at all, but tier names ARE typed by the
 * organizer — and a statement gets forwarded to a tax advisor's machine, so the
 * formula-injection guard stays even for the seller's own words.
 */
const FORMULA_LEAD = /^[=+\-@\t\r]/;

function cell(value: string | number | null | undefined): string {
  let text = value === null || value === undefined ? '' : String(value);
  if (FORMULA_LEAD.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const HEADERS = [
  'Month',
  'Listing',
  'Confirmed (UTC)',
  'Reference',
  'What was bought',
  'Amount',
  'Currency',
  'Payment route',
];

/**
 * Download one month's statement as a spreadsheet — the SAME lines the
 * /portal/statements page shows, account-wide, no buyer names (a bookkeeping
 * record must outlive buyer erasure; see lib/statements.ts).
 *
 * Lines only, no subtotal or total rows: a total row baked into the data
 * breaks the first SUM() a bookkeeper writes over the column.
 */
export async function GET(req: Request) {
  try {
    const auth = await requireOrganizerApi();
    if (auth.failure) return auth.failure;
    const { organizer } = auth;

    const requested = new URL(req.url).searchParams.get('month') ?? '';
    const month = isStatementMonth(requested)
      ? requested
      : defaultStatementMonth(statementMonths(organizer.id));

    const statement = monthlyStatement(organizer.id, month);

    const lines = [HEADERS.join(',')];
    for (const section of statement.sections) {
      for (const l of section.lines) {
        lines.push(
          [
            cell(month),
            cell(section.eventName),
            cell(l.confirmedAt),
            cell(l.reference),
            cell(l.itemsSummary),
            // Plain decimal, not a formatted money string: spreadsheets should
            // read this as a number they can sum.
            cell((l.amountCents / 100).toFixed(2)),
            cell(section.currency),
            cell(PAYMENT_ROUTE_LABEL[l.paymentRoute]),
          ].join(',')
        );
      }
    }

    // Excel assumes the local codepage unless a UTF-8 BOM says otherwise, which
    // is what turns Nepali and German tier names into mojibake on an advisor's PC.
    const csv = '﻿' + lines.join('\r\n') + '\r\n';

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="statement-${month}.csv"`,
        'Cache-Control': 'no-store, must-revalidate',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (e) {
    console.error('GET /api/portal/statements/export failed:', e);
    return new Response('Could not build the statement. Please try again.', { status: 500 });
  }
}
