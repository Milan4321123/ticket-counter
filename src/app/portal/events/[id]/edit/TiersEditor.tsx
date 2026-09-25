'use client';

import { useRef, useState } from 'react';
import type { EventKind } from '@/lib/types';
import { vocabFor } from '@/lib/vocab';
import { useRouter } from 'next/navigation';
import GoToTab from './GoToTab';
import { saveEvent, type SavedTier } from './save';

/**
 * Long "about this item" prose. Kept in sync with MAX_TIER_DETAILS in the
 * portal's update route — the counter under the box has to promise what the
 * server will actually accept.
 */
const MAX_DETAILS = 4000;

interface Row {
  tierKey: string | null; // null = new row, key assigned by the server on save
  name: string;
  price: string; // EUR, as typed ("25" or "25,50")
  cap: string;
  unlimited: boolean;
  status: 'on-sale' | 'coming-soon' | 'hidden';
  studentOnly: boolean;
  description: string;
  details: string;
  /** One of the listing's photo ids, or null for "no picture". */
  mediaId: string | null;
  seatsPerUnit: string; // as typed; blank means 1 (an ordinary single ticket)
}

/** One of the listing's uploaded photos, as the picker shows it. */
export interface TierPhotoOption {
  id: string;
  url: string;
  label: string;
}

interface Props {
  eventId: string;
  /** Event or shop — decides whether these rows are ticket types or items. */
  kind: EventKind;
  initialTiers: SavedTier[];
  /**
   * The listing's own photos, in gallery order. An item's picture is CHOSEN
   * from these rather than uploaded here: the photos are already uploaded,
   * quota-counted and cleaned up per listing, and a second upload path hanging
   * off this form would be the one place on the site where deleting a photo
   * left a file nobody swept.
   */
  photos: TierPhotoOption[];
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
    details: t.details ?? '',
    mediaId: t.mediaId ?? null,
    seatsPerUnit: String(t.seatsPerUnit ?? 1),
  };
}

export default function TiersEditor({ eventId, kind, initialTiers, photos, soldByTierKey }: Props) {
  const router = useRouter();
  const v = vocabFor(kind);
  const [rows, setRows] = useState<Row[]>(initialTiers.map(toRow));
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** The one row opened for editing; the rest stay one-line summaries. */
  const [openIdx, setOpenIdx] = useState<number | null>(() =>
    initialTiers.length === 0 ? null : initialTiers.length === 1 && !initialTiers[0].name ? 0 : null
  );
  const isShop = kind === 'shop';

  function patchRow(index: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function addRow(preset: Partial<Row> = {}) {
    setOpenIdx(rows.length);
    setRows((prev) => [
      ...prev,
      { tierKey: null, name: '', price: '', cap: isShop ? '20' : '100', unlimited: false, status: 'on-sale', studentOnly: false, description: '', details: '', mediaId: null, seatsPerUnit: '1', ...preset },
    ]);
  }

  function removeRow(index: number) {
    const row = rows[index];
    // Rows that already exist on the server disappear from sale on the next
    // save — make sure that's what the organizer wants.
    if (
      row?.tierKey &&
      !window.confirm(
        `Remove the ${v.unitType} "${row.name.trim() || 'Untitled'}"?\n\nIt is taken off sale when you press "Save ${v.unitTypes}".`
      )
    ) {
      return;
    }
    setRows((prev) => prev.filter((_, i) => i !== index));
    setOpenIdx(null);
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
      details: string;
      mediaId: string | null;
      seatsPerUnit: number;
    }[] =
      [];
    for (const row of rows) {
      const name = row.name.trim();
      if (!name) {
        setError(`Every ${v.unitType} needs a name.`);
        setOpenIdx(rows.indexOf(row));
        return;
      }
      const priceNum = Number(row.price.replace(',', '.'));
      if (!Number.isFinite(priceNum) || priceNum < 0) {
        setError(`Please enter a valid price for "${name}" (e.g. 25 or 25.50).`);
        setOpenIdx(rows.indexOf(row));
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
      // Blank means an ordinary single ticket — nobody should have to think
      // about this field unless they are selling tables or bundles.
      const seatsPerUnit = row.seatsPerUnit.trim() === '' ? 1 : Number(row.seatsPerUnit);
      if (!Number.isInteger(seatsPerUnit) || seatsPerUnit < 1 || seatsPerUnit > 20) {
        setError(`Seats per booking for "${name}" must be a whole number between 1 and 20.`);
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
        details: row.details.trim(),
        // A photo the organizer deleted in the Photos tab since this form was
        // opened is dropped here rather than sent: the server would coerce it
        // to null anyway, and sending it would make the "Saved" that comes back
        // disagree with the thumbnail still showing in this row.
        mediaId: row.mediaId && photos.some((p) => p.id === row.mediaId) ? row.mediaId : null,
        seatsPerUnit,
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
    setOpenIdx(null);
    setSaved(true);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaved(false), 2200);
    router.refresh();
  }

  const STATUS: { key: Row['status']; label: string; hint: string }[] = [
    { key: 'on-sale', label: 'On sale', hint: 'People can buy it now, until it sells out.' },
    { key: 'coming-soon', label: 'Coming soon', hint: 'Shown with its price, not buyable yet.' },
    { key: 'hidden', label: 'Hidden', hint: 'Off the page — use this instead of deleting.' },
  ];
  const STOCK = isShop ? [10, 20, 50, 100] : [50, 100, 200, 500];
  const STARTERS = [
    { name: 'Early bird', price: '15' },
    { name: 'Standard', price: '20' },
    { name: 'VIP', price: '40' },
    { name: 'Student', price: '12', studentOnly: true },
    { name: 'Table for 4', price: '80', seatsPerUnit: '4' },
  ];
  const photoOf = (id: string | null) => (id ? photos.find((p) => p.id === id)?.url : undefined);

  return (
    <form onSubmit={submit} className="ks te">
      {error && (
        <div className="notice notice-error" style={{ margin: 0 }}>
          {error}
        </div>
      )}

      {rows.length === 0 && (
        <p className="muted" style={{ margin: 0 }}>
          No {v.unitTypes} yet — add your first one (you need at least one to publish).
        </p>
      )}

      <div className="te-list">
        {rows.map((row, i) => {
          const sold = row.tierKey ? (soldByTierKey[row.tierKey] ?? 0) : 0;
          const open = openIdx === i;
          const thumb = photoOf(row.mediaId);
          const priceShown = row.price.trim() ? `€${row.price.replace('.', ',')}` : '€ —';
          const stockShown = row.unlimited ? 'No limit' : `${row.cap || 0} ${isShop ? 'in stock' : 'tickets'}`;
          return (
            <div key={row.tierKey ?? `new-${i}`} className={`te-row${open ? ' is-open' : ''}`}>
              <button type="button" className="te-sum" onClick={() => setOpenIdx(open ? null : i)} aria-expanded={open}>
                <span className="te-thumb" aria-hidden="true">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {thumb ? <img src={thumb} alt="" /> : isShop ? '🛍' : '🎟'}
                </span>
                <span className="te-sum-text">
                  <strong>{row.name.trim() || `New ${v.unitType}`}</strong>
                  <span>
                    {priceShown} · {stockShown}
                    {sold > 0 ? ` · ${sold} sold` : ''}
                  </span>
                </span>
                {row.status !== 'on-sale' && (
                  <span className={`badge${row.status === 'coming-soon' ? ' badge-green' : ''}`}>
                    {row.status === 'coming-soon' ? 'Coming soon' : 'Hidden'}
                  </span>
                )}
                <span className="te-chev" aria-hidden="true">
                  ▾
                </span>
              </button>

              {open && (
                <div className="te-body">
                  <div className="te-main">
                    <div className="field" style={{ margin: 0 }}>
                      <label htmlFor={`tier-name-${i}`}>Name</label>
                      <input
                        id={`tier-name-${i}`}
                        className="input"
                        value={row.name}
                        onChange={(e) => patchRow(i, { name: e.target.value })}
                        maxLength={80}
                        placeholder={isShop ? 'e.g. Chicken momo (10 pcs)' : 'e.g. Standard'}
                        autoFocus={!row.tierKey && !row.name}
                      />
                    </div>
                    <div className="field" style={{ margin: 0 }}>
                      <label htmlFor={`tier-price-${i}`}>Price</label>
                      <div className="te-money">
                        <span aria-hidden="true">€</span>
                        <input
                          id={`tier-price-${i}`}
                          className="input"
                          inputMode="decimal"
                          value={row.price}
                          onChange={(e) => patchRow(i, { price: e.target.value })}
                          placeholder="0 = free"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="bf-label">{isShop ? 'How many do you have?' : 'How many tickets?'}</div>
                    <div className="ks-presets">
                      {STOCK.map((n) => (
                        <button
                          key={n}
                          type="button"
                          className={`ks-chip${!row.unlimited && row.cap === String(n) ? ' is-on' : ''}`}
                          onClick={() => patchRow(i, { cap: String(n), unlimited: false })}
                        >
                          {n}
                        </button>
                      ))}
                      <button
                        type="button"
                        className={`ks-chip${row.unlimited ? ' is-on' : ''}`}
                        onClick={() => patchRow(i, { unlimited: true })}
                      >
                        ∞ No limit
                      </button>
                      {!row.unlimited && (
                        <input
                          id={`tier-cap-${i}`}
                          className="input bf-num"
                          type="number"
                          inputMode="numeric"
                          min={0}
                          value={row.cap}
                          onChange={(e) => patchRow(i, { cap: e.target.value })}
                          aria-label={isShop ? 'How many you have' : 'Ticket limit'}
                        />
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="bf-label">Status</div>
                    <div className="te-seg" role="radiogroup" aria-label={`This ${v.unit} is`}>
                      {STATUS.map((st) => (
                        <button
                          key={st.key}
                          type="button"
                          role="radio"
                          aria-checked={row.status === st.key}
                          className={row.status === st.key ? 'is-on' : ''}
                          onClick={() => patchRow(i, { status: st.key })}
                        >
                          {st.label}
                        </button>
                      ))}
                    </div>
                    <p className="muted small" style={{ margin: '6px 0 0' }}>
                      {STATUS.find((st) => st.key === row.status)?.hint}
                    </p>
                  </div>

                  <div className="field" style={{ margin: 0 }}>
                    <label htmlFor={`tier-desc-${i}`}>One line about it</label>
                    <input
                      id={`tier-desc-${i}`}
                      className="input"
                      value={row.description}
                      onChange={(e) => patchRow(i, { description: e.target.value })}
                      maxLength={300}
                      placeholder={isShop ? 'What is in it?' : 'What does this ticket include?'}
                    />
                  </div>

                  <div>
                    <div className="bf-label">Photo</div>
                    {photos.length === 0 ? (
                      <p className="muted small" style={{ margin: 0 }}>
                        Add photos first, then pick one here. <GoToTab tab="media">Go to Photos →</GoToTab>
                      </p>
                    ) : (
                      <div className="tier-photo-picker">
                        <button
                          type="button"
                          className={`tier-photo-option tier-photo-none${row.mediaId === null ? ' is-selected' : ''}`}
                          onClick={() => patchRow(i, { mediaId: null })}
                          aria-pressed={row.mediaId === null}
                        >
                          None
                        </button>
                        {photos.map((photo) => (
                          <button
                            type="button"
                            key={photo.id}
                            className={`tier-photo-option${row.mediaId === photo.id ? ' is-selected' : ''}`}
                            onClick={() => patchRow(i, { mediaId: photo.id })}
                            aria-pressed={row.mediaId === photo.id}
                            title={photo.label}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={photo.url} alt={photo.label} loading="lazy" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <details className="bf-inline" open={row.details || row.studentOnly || row.seatsPerUnit !== '1' ? true : undefined}>
                    <summary>+ More: longer write-up, {isShop ? 'bundles' : 'tables & student tickets'}</summary>
                    <div style={{ display: 'grid', gap: 12 }}>
                      <div className="field" style={{ margin: 0 }}>
                        <label htmlFor={`tier-details-${i}`}>About this {v.unit}</label>
                        <textarea
                          id={`tier-details-${i}`}
                          className="input"
                          rows={4}
                          value={row.details}
                          onChange={(e) => patchRow(i, { details: e.target.value.slice(0, MAX_DETAILS) })}
                          maxLength={MAX_DETAILS}
                          placeholder={
                            isShop
                              ? 'How it is made, how much is in it, how long it keeps…'
                              : 'What this ticket gets you, who it is for…'
                          }
                          style={{ resize: 'vertical', fontFamily: 'inherit' }}
                        />
                        {MAX_DETAILS - row.details.length < 200 && (
                          <p className="muted small" style={{ margin: '6px 0 0', color: 'var(--red)' }}>
                            {MAX_DETAILS - row.details.length} characters left.
                          </p>
                        )}
                      </div>
                      <div className="field" style={{ margin: 0, maxWidth: 260 }}>
                        <label htmlFor={`tier-seats-${i}`}>{isShop ? 'Items per order (bundle)' : 'Seats per booking (tables)'}</label>
                        <input
                          id={`tier-seats-${i}`}
                          className="input"
                          type="number"
                          inputMode="numeric"
                          min={1}
                          max={20}
                          value={row.seatsPerUnit}
                          onChange={(e) => patchRow(i, { seatsPerUnit: e.target.value })}
                          placeholder="1"
                          disabled={sold > 0}
                        />
                        <p className="muted small" style={{ margin: '6px 0 0' }}>
                          {sold > 0
                            ? `Locked — ${sold} already sold at this size.`
                            : isShop
                              ? 'One order gives this many collection codes.'
                              : 'One booking gives this many QR tickets.'}
                        </p>
                      </div>
                      {!isShop && (
                        <label className="bf-switch" htmlFor={`tier-student-${i}`} style={{ marginTop: 0 }}>
                          <input
                            id={`tier-student-${i}`}
                            type="checkbox"
                            checked={row.studentOnly}
                            onChange={(e) => patchRow(i, { studentOnly: e.target.checked })}
                          />
                          <span>
                            <strong>Students only</strong>
                            <span className="muted small">Student ID checked at the door.</span>
                          </span>
                        </label>
                      )}
                    </div>
                  </details>

                  <div className="te-foot">
                    <button type="button" className="btn btn-sm" onClick={() => setOpenIdx(null)}>
                      Done
                    </button>
                    {sold > 0 ? (
                      <span className="muted small">{sold} sold — set it to Hidden to stop selling</span>
                    ) : (
                      <button type="button" className="te-remove" onClick={() => removeRow(i)} disabled={busy}>
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="ks-presets">
        <button type="button" className="btn btn-sm" onClick={() => addRow()} disabled={busy || rows.length >= 20}>
          + Add {v.unitType}
        </button>
        {!isShop &&
          STARTERS.filter((st) => !rows.some((r) => r.name.trim().toLowerCase() === st.name.toLowerCase())).map((st) => (
            <button
              key={st.name}
              type="button"
              className="ks-chip ks-chip-sm"
              disabled={busy || rows.length >= 20}
              onClick={() => addRow(st)}
            >
              + {st.name}
            </button>
          ))}
      </div>

      <p className="muted small" style={{ margin: 0 }}>
        Price changes only apply to new orders.
      </p>

      <div className="ks-save">
        <button type="submit" className="btn btn-brand" disabled={busy}>
          {busy ? <span className="spinner" aria-hidden /> : null}
          {busy ? 'Saving…' : `Save ${v.unitTypes}`}
        </button>
        {saved && <span className="badge badge-green">Saved ✓</span>}
      </div>
    </form>
  );
}
