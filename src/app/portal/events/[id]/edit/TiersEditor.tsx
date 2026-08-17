'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { saveEvent, type SavedTier } from './save';

interface Row {
  tierKey: string | null; // null = new row, key assigned by the server on save
  name: string;
  price: string; // EUR, as typed ("25" or "25,50")
  cap: string;
  unlimited: boolean;
  status: 'on-sale' | 'coming-soon' | 'hidden';
  studentOnly: boolean;
  description: string;
}

interface Props {
  eventId: string;
  initialTiers: SavedTier[];
  /** Tickets sold so far, by tier key — sold tiers can't be removed. */
  soldByTierKey: Record<string, number>;
}

function toRow(t: SavedTier): Row {
  return {
    tierKey: t.tierKey,
    name: t.name,
    price: (t.priceCents / 100).toFixed(2),
    cap: String(t.cap),
    unlimited: Boolean(t.unlimited),
    status: t.status ?? 'on-sale',
    studentOnly: t.studentOnly,
    description: t.description,
  };
}

export default function TiersEditor({ eventId, initialTiers, soldByTierKey }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(initialTiers.map(toRow));
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function patchRow(index: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((prev) => [...prev, { tierKey: null, name: '', price: '', cap: '', unlimited: false, status: 'on-sale', studentOnly: false, description: '' }]);
  }

  function removeRow(index: number) {
    const row = rows[index];
    // Rows that already exist on the server disappear from sale on the next
    // save — make sure that's what the organizer wants.
    if (
      row?.tierKey &&
      !window.confirm(
        `Remove the ticket type "${row.name.trim() || 'Untitled'}"?\n\nIt is taken off sale when you press "Save ticket types".`
      )
    ) {
      return;
    }
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);

    const tiers: {
      tierKey: string | null;
      name: string;
      priceCents: number;
      cap: number;
      unlimited: boolean;
      status: 'on-sale' | 'coming-soon' | 'hidden';
      studentOnly: boolean;
      description: string;
    }[] =
      [];
    for (const row of rows) {
      const name = row.name.trim();
      if (!name) {
        setError('Every ticket type needs a name.');
        return;
      }
      const priceNum = Number(row.price.replace(',', '.'));
      if (!Number.isFinite(priceNum) || priceNum < 0) {
        setError(`Please enter a valid price for "${name}" (e.g. 25 or 25.50).`);
        return;
      }
      // An unlimited tier keeps whatever number is in the box (0 if blank) —
      // it is simply not consulted. Storing it means switching back to limited
      // does not lose the figure the organizer had typed.
      const cap = row.unlimited ? Number(row.cap) || 0 : Number(row.cap);
      if (!row.unlimited && (!Number.isInteger(cap) || cap < 0)) {
        setError(`Please enter a valid ticket limit for "${name}" (0 stops sales for it).`);
        return;
      }
      tiers.push({
        tierKey: row.tierKey,
        name,
        priceCents: Math.round(priceNum * 100),
        cap,
        unlimited: row.unlimited,
        studentOnly: row.studentOnly,
        status: row.status,
        description: row.description.trim(),
      });
    }

    setBusy(true);
    const result = await saveEvent(eventId, { tiers });
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? 'Something went wrong — please try again.');
      return;
    }
    // The server assigns keys to new rows — sync them back so saving twice
    // never duplicates a ticket type.
    if (result.data?.tiers) setRows(result.data.tiers.map(toRow));
    setSaved(true);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaved(false), 2200);
    router.refresh();
  }

  return (
    <form onSubmit={submit}>
      <p className="muted small" style={{ marginTop: 0 }}>
        Price changes only affect <strong>new</strong> orders — anyone who already reserved or paid keeps the price
        from when they booked.
      </p>
      {error && <div className="notice notice-error">{error}</div>}

      {rows.length === 0 && (
        <p className="muted">No ticket types yet — add your first one below (you need at least one to publish).</p>
      )}

      {rows.map((row, i) => {
        const sold = row.tierKey ? (soldByTierKey[row.tierKey] ?? 0) : 0;
        return (
          <div
            key={row.tierKey ?? `new-${i}`}
            style={{
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: 14,
              marginBottom: 12,
              background: 'var(--bg-elevated)',
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                columnGap: 12,
              }}
            >
              <div className="field" style={{ marginBottom: 10 }}>
                <label htmlFor={`tier-name-${i}`}>Name</label>
                <input
                  id={`tier-name-${i}`}
                  className="input"
                  value={row.name}
                  onChange={(e) => patchRow(i, { name: e.target.value })}
                  maxLength={80}
                  placeholder="e.g. General Admission"
                />
              </div>
              <div className="field" style={{ marginBottom: 10 }}>
                <label htmlFor={`tier-price-${i}`}>Price (EUR)</label>
                <input
                  id={`tier-price-${i}`}
                  className="input"
                  inputMode="decimal"
                  value={row.price}
                  onChange={(e) => patchRow(i, { price: e.target.value })}
                  placeholder="25.00"
                />
              </div>
              <div className="field" style={{ marginBottom: 10 }}>
                <label htmlFor={`tier-cap-${i}`}>Ticket limit</label>
                <input
                  id={`tier-cap-${i}`}
                  className="input"
                  type="number"
                  min={0}
                  value={row.unlimited ? '' : row.cap}
                  onChange={(e) => patchRow(i, { cap: e.target.value })}
                  placeholder={row.unlimited ? 'No limit' : '100'}
                  disabled={row.unlimited}
                />
                {/* Right under the box it switches off, so the relationship
                    between the two is impossible to misread. */}
                <label className="checkbox-row" style={{ marginTop: 8 }}>
                  <input
                    type="checkbox"
                    checked={row.unlimited}
                    onChange={(e) => patchRow(i, { unlimited: e.target.checked })}
                  />
                  <span>
                    Unlimited — sell as many as people want
                    <span className="muted small" style={{ display: 'block' }}>
                      No &ldquo;only N left&rdquo; and it never sells out.
                    </span>
                  </span>
                </label>
                {/* One dropdown per ticket type, not a checkbox: an organizer
                    with an early bird, a standard and a student ticket needs to
                    say something DIFFERENT about each, and a yes/no could only
                    ever say two things. Whatever is chosen here is what that row
                    shows on the event page — no event-wide setting overrules it. */}
                <div className="field" style={{ marginTop: 10, marginBottom: 0 }}>
                  <label htmlFor={`tier-status-${i}`} className="small">
                    This ticket is
                  </label>
                  <select
                    id={`tier-status-${i}`}
                    className="input"
                    value={row.status}
                    onChange={(e) =>
                      patchRow(i, {
                        status:
                          e.target.value === 'coming-soon' || e.target.value === 'hidden'
                            ? e.target.value
                            : 'on-sale',
                      })
                    }
                  >
                    <option value="on-sale">On sale — people can buy it now</option>
                    <option value="coming-soon">Coming soon — announced, not on sale yet</option>
                    <option value="hidden">Not available — off the page entirely</option>
                  </select>
                  <p className="muted small" style={{ margin: '6px 0 0' }}>
                    {row.status === 'coming-soon' ? (
                      <>
                        On your page with a green <strong>Coming soon</strong> badge and its price, so
                        people can see what is on the way. Nobody can buy it until you switch this to
                        On sale.
                      </>
                    ) : row.status === 'hidden' ? (
                      <>
                        Not shown to anyone and not buyable. Use this instead of deleting a ticket
                        type you might sell again — deleting one loses the orders attached to it.
                      </>
                    ) : (
                      <>
                        On sale now, up to its limit. Sells out on its own when the limit is reached.
                      </>
                    )}
                  </p>
                </div>
              </div>
            </div>
            <div className="field" style={{ marginBottom: 10 }}>
              <label htmlFor={`tier-desc-${i}`}>Short description</label>
              <input
                id={`tier-desc-${i}`}
                className="input"
                value={row.description}
                onChange={(e) => patchRow(i, { description: e.target.value })}
                maxLength={300}
                placeholder="What does this ticket include?"
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <label className="checkbox-row" style={{ marginBottom: 0 }} htmlFor={`tier-student-${i}`}>
                <input
                  id={`tier-student-${i}`}
                  type="checkbox"
                  checked={row.studentOnly}
                  onChange={(e) => patchRow(i, { studentOnly: e.target.checked })}
                />
                <span>Students only (checked at the door)</span>
              </label>
              <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                {sold > 0 && (
                  <span className="muted small">
                    {sold} sold — can&rsquo;t be removed, set the limit to 0 to stop sales
                  </span>
                )}
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => removeRow(i)}
                  disabled={busy || sold > 0}
                >
                  Remove
                </button>
              </span>
            </div>
          </div>
        );
      })}

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-sm" onClick={addRow} disabled={busy || rows.length >= 20}>
          + Add ticket type
        </button>
        <button type="submit" className="btn btn-brand" disabled={busy}>
          {busy ? <span className="spinner" aria-hidden /> : null}
          {busy ? 'Saving…' : 'Save ticket types'}
        </button>
        {saved && <span className="badge badge-green">Saved ✓</span>}
      </div>
    </form>
  );
}
