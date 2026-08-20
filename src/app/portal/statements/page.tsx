import PrintButton from '@/components/PrintButton';
import { formatMoney } from '@/lib/money';
import { platformNameFromEnv } from '@/lib/platform';
import {
  defaultStatementMonth,
  formatStatementMonth,
  isStatementMonth,
  monthlyStatement,
  statementMonths,
  PAYMENT_ROUTE_LABEL,
} from '@/lib/statements';
import PortalNav from '../PortalNav';
import { requirePortalOrganizer } from '../guard';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Monthly statements — Organizer portal',
  robots: { index: false, follow: false },
};

/** '2026-08-03 18:22:01' (UTC, as SQLite writes it) -> '3 Aug 2026'. */
function statementDate(confirmedAt: string): string {
  const d = new Date(confirmedAt.replace(' ', 'T') + 'Z');
  if (Number.isNaN(d.getTime())) return confirmedAt.slice(0, 10);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export default async function StatementsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string | string[] }>;
}) {
  // Deliberately NOT gated on the plan being active (unlike the dashboard):
  // this page is the record of money that already arrived in the seller's own
  // accounts, and a switched-off account still owes its tax advisor the books.
  // API reads are not plan-gated either, so the two doors agree.
  const organizer = await requirePortalOrganizer();

  const months = statementMonths(organizer.id);
  const monthParam = (await searchParams).month;
  const requested = (Array.isArray(monthParam) ? monthParam[0] : monthParam) ?? '';
  const month =
    isStatementMonth(requested) && months.includes(requested)
      ? requested
      : defaultStatementMonth(months);

  const statement = monthlyStatement(organizer.id, month);
  const monthLabel = formatStatementMonth(month);
  const platform = platformNameFromEnv();

  return (
    <>
      {/* The portal chrome and controls are for the screen; the printed page
          carries its own header below, so a print is just the statement. */}
      <div className="no-print">
        <PortalNav />
      </div>
      <div className="container section">
        <div className="anim-fade-up" style={{ marginBottom: 20 }}>
          <h1 className="page-title" style={{ margin: 0 }}>
            Statement — {monthLabel}
          </h1>
          {/* The printed header: whose books these are, kept by which platform.
              Always visible, because it is just as true on screen. */}
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            Seller: <strong style={{ color: 'var(--text)' }}>{organizer.name}</strong> · Kept on{' '}
            {platform} · Confirmed orders only.
          </p>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            Every euro here arrived in your own account — this is the ledger of it. {platform} never
            holds or moves your money; this page only reports what you confirmed.
          </p>
          {/* Mirrors the comment in lib/statements.ts: erasure-proof on purpose. */}
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            No buyer names here on purpose — this record stays valid after buyer details are erased.
          </p>
        </div>

        <form
          method="get"
          className="no-print anim-fade-up"
          style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 20 }}
        >
          <label htmlFor="statement-month" className="muted small">
            Month
          </label>
          <select id="statement-month" name="month" defaultValue={month} className="input" style={{ width: 'auto' }}>
            {months.map((m) => (
              <option key={m} value={m}>
                {formatStatementMonth(m)}
              </option>
            ))}
          </select>
          <button type="submit" className="btn btn-sm">
            Show
          </button>
          <PrintButton label="Print or save as PDF" />
          {statement.sections.length > 0 && (
            <a className="btn btn-sm" href={`/api/portal/statements/export?month=${month}`} download>
              Download as spreadsheet
            </a>
          )}
        </form>

        {statement.sections.length === 0 ? (
          <div className="card anim-fade-up">
            <div className="card-title">Nothing confirmed in {monthLabel}</div>
            <p className="muted small" style={{ margin: 0 }}>
              No money was confirmed on your listings this month, so there is nothing to book — an
              empty statement is still a true one. Orders waiting on a bank transfer appear in the
              month you confirm them.
            </p>
          </div>
        ) : (
          <>
            {statement.sections.map((section, i) => (
              <div key={section.eventId} className={`card anim-fade-up${i < 4 ? ` anim-d${i + 1}` : ''}`}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <div className="card-title" style={{ margin: 0 }}>
                    {section.eventName}
                  </div>
                  {section.kind === 'shop' && <span className="badge">Shop</span>}
                </div>
                <div className="table-wrap" style={{ marginTop: 10 }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Confirmed</th>
                        <th>Reference</th>
                        <th>What was bought</th>
                        <th>Payment route</th>
                        <th style={{ textAlign: 'right' }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {section.lines.map((line) => (
                        <tr key={line.orderId}>
                          <td>{statementDate(line.confirmedAt)}</td>
                          <td className="small">{line.reference}</td>
                          <td>{line.itemsSummary}</td>
                          <td>{PAYMENT_ROUTE_LABEL[line.paymentRoute]}</td>
                          <td style={{ textAlign: 'right' }}>
                            {formatMoney(line.amountCents, section.currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={4}>
                          <strong>Subtotal — {section.eventName}</strong>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <strong>{formatMoney(section.subtotalCents, section.currency)}</strong>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            ))}

            <div className="card anim-fade-up">
              <div className="card-title">Account total — {monthLabel}</div>
              {/* One line per currency: listings can price in different
                  currencies, and summing across them would be a made-up number. */}
              {statement.totals.map((t) => (
                <p key={t.currency} style={{ margin: '4px 0 0', fontSize: '1.15rem' }}>
                  <strong>{formatMoney(t.cents, t.currency)}</strong>
                </p>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}
