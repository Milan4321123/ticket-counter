import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isAdminRequest } from '@/lib/auth';
import { readListingName } from '@/lib/exampleShop';
import { formatMoney } from '@/lib/money';
import { listWishTotals, type WishTotal } from '@/lib/wishes';

// Every item somebody put on a wish list (lib/wishes), most wanted first:
// the example bazaar's goods tell us what real Nepali sellers could offer
// here, "Coming soon" rows show sellers what to open next.
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Wish list — Admin', robots: { index: false, follow: false } };

function why(w: WishTotal): { label: string; tone: string } {
  if (readListingName(w.eventName).isExample) return { label: 'Example shop', tone: 'badge-amber' };
  if (w.tierStatus === 'coming-soon') return { label: 'Coming soon', tone: 'badge-green' };
  if (!w.salesOpen) return { label: 'Not selling', tone: '' };
  return { label: 'On sale', tone: 'badge-accent' };
}

export default async function AdminWishes() {
  if (!(await isAdminRequest())) redirect('/admin/login');
  const rows = listWishTotals();
  const total = rows.reduce((n, r) => n + r.wishes, 0);
  const example = rows.filter((r) => readListingName(r.eventName).isExample).reduce((n, r) => n + r.wishes, 0);

  return (
    <div className="container section">
      <p className="small">
        <Link href="/admin">← Admin</Link>
      </p>
      <h1>Wish list</h1>
      <p className="muted">
        What people wanted but could not buy — example-shop goods, “Coming soon” tickets and dishes, and checkouts without
        payment. One wish per item per device; nothing personal is kept.
      </p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '14px 0 20px' }}>
        <span className="badge badge-accent">{total} wishes</span>
        <span className="badge badge-amber">{example} on example shops</span>
        <span className="badge badge-green">{rows.length} items</span>
      </div>
      {rows.length === 0 ? (
        <p className="muted">No wishes yet. They appear here as soon as somebody taps “Add to wish list”.</p>
      ) : (
        <table className="table table-cards">
          <thead>
            <tr>
              <th>Item</th>
              <th>Listing</th>
              <th>Why</th>
              <th>Price</th>
              <th>Want it</th>
              <th>Last wish</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const w = why(r);
              return (
                <tr key={`${r.eventId}:${r.tierKey}`}>
                  <td data-label="Item" className="tc-head">
                    <strong>{r.tierName}</strong>
                  </td>
                  <td data-label="Listing">
                    <Link href={`/e/${r.eventSlug}`}>{readListingName(r.eventName).name}</Link>
                  </td>
                  <td data-label="Why">
                    <span className={`badge ${w.tone}`}>{w.label}</span>
                  </td>
                  <td data-label="Price">{formatMoney(r.priceCents, r.currency)}</td>
                  <td data-label="Want it">
                    <strong>♥ {r.wishes}</strong>
                  </td>
                  <td data-label="Last wish" className="muted small">
                    {r.last.slice(0, 16).replace('T', ' ')}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
