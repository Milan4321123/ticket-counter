'use client';

// A hall, drawn: the stage at the top, then each section as rows of seats.
// One component for three jobs — the buyer picking seats at checkout, the
// organizer blocking seats in the editor, and a read-only "what has sold" view.
// Client-safe: it takes the map as plain data (the server shape from lib/seats,
// redeclared here so no server module is imported).

export interface SeatMapSection {
  id: string;
  name: string;
  tierKey: string;
  rows: number;
  seatsPerRow: number;
  firstRow: string;
  aislesAfter: number[];
  blocked: string[];
}

export interface SeatMapData {
  enabled: boolean;
  stageLabel: string;
  sections: SeatMapSection[];
}

const ROW_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

export function rowLabelOf(firstRow: string, index: number): string {
  const start = Math.max(0, ROW_LETTERS.indexOf(firstRow.toUpperCase()));
  const n = start + index;
  return n < ROW_LETTERS.length
    ? ROW_LETTERS[n]
    : `${ROW_LETTERS[Math.floor(n / ROW_LETTERS.length) - 1]}${ROW_LETTERS[n % ROW_LETTERS.length]}`;
}

export type SeatState = 'free' | 'held' | 'sold' | 'blocked' | 'mine';

interface Props {
  map: SeatMapData;
  /** Seats someone else holds or has bought. */
  taken?: Record<string, 'held' | 'sold'>;
  /** The seats this person has picked (checkout) — or blocked (editor). */
  selected?: Set<string>;
  mode: 'pick' | 'block' | 'view';
  onToggle?: (seatId: string, tierKey: string) => void;
  /** Section colour / price legend, by tier key. */
  legend?: Record<string, { label: string; price?: string }>;
  disabled?: boolean;
}

const HUES = ['#f59e0b', '#8b5cf6', '#22d3ee', '#34d399', '#f472b6', '#60a5fa'];

export default function SeatMapView({ map, taken = {}, selected = new Set(), mode, onToggle, legend, disabled }: Props) {
  const tierHue = new Map<string, string>();
  map.sections.forEach((s) => {
    if (!tierHue.has(s.tierKey)) tierHue.set(s.tierKey, HUES[tierHue.size % HUES.length]);
  });

  return (
    <div className="seatmap">
      <div className="seatmap-stage">{map.stageLabel}</div>
      <div className="seatmap-scroll">
        {map.sections.map((section) => {
          const blocked = new Set(section.blocked);
          const hue = tierHue.get(section.tierKey) ?? HUES[0];
          return (
            <div className="seatmap-section" key={section.id} style={{ ['--seat-hue' as string]: hue }}>
              <div className="seatmap-section-name">
                {section.name}
                {legend?.[section.tierKey]?.price ? <span> · {legend[section.tierKey].price}</span> : null}
              </div>
              {Array.from({ length: section.rows }, (_, r) => {
                const row = rowLabelOf(section.firstRow, r);
                return (
                  <div className="seatmap-row" key={row}>
                    <span className="seatmap-rowlabel">{row}</span>
                    {Array.from({ length: section.seatsPerRow }, (_, i) => {
                      const n = i + 1;
                      const id = `${section.id}-${row}-${n}`;
                      const isBlocked = blocked.has(id);
                      const isMine = selected.has(id);
                      const other = taken[id];
                      let state: SeatState = 'free';
                      if (mode === 'block') state = isMine ? 'blocked' : other ? other : 'free';
                      else if (isBlocked) state = 'blocked';
                      else if (isMine) state = 'mine';
                      else if (other) state = other;
                      const aisle = section.aislesAfter.includes(n);
                      const clickable =
                        !disabled &&
                        ((mode === 'pick' && (state === 'free' || state === 'mine')) ||
                          (mode === 'block' && !other));
                      const label = `Row ${row}, seat ${n}${
                        state === 'sold' ? ' — sold' : state === 'held' ? ' — reserved' : state === 'blocked' ? ' — not for sale' : state === 'mine' ? ' — yours' : ''
                      }`;
                      return (
                        <span key={id} className="seatmap-cell" style={aisle ? { marginRight: 10 } : undefined}>
                          {state === 'blocked' && mode !== 'block' ? (
                            <span className="seat seat-gap" aria-hidden="true" />
                          ) : (
                            <button
                              type="button"
                              className={`seat seat-${state}`}
                              aria-label={label}
                              aria-pressed={mode !== 'view' ? isMine : undefined}
                              title={label}
                              disabled={!clickable}
                              onClick={() => onToggle?.(id, section.tierKey)}
                            >
                              {state === 'mine' ? '✓' : n}
                            </button>
                          )}
                        </span>
                      );
                    })}
                    <span className="seatmap-rowlabel">{row}</span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      <div className="seatmap-key">
        {legend &&
          map.sections
            .map((s) => s.tierKey)
            .filter((k, i, a) => a.indexOf(k) === i)
            .map((k) => (
              <span key={k} className="seatmap-key-item">
                <span className="seat seat-free seat-key" style={{ ['--seat-hue' as string]: tierHue.get(k) }} />
                {legend[k]?.label ?? k}
                {legend[k]?.price ? ` · ${legend[k].price}` : ''}
              </span>
            ))}
        <span className="seatmap-key-item">
          <span className="seat seat-mine seat-key" /> {mode === 'block' ? 'Not for sale' : 'Your seats'}
        </span>
        <span className="seatmap-key-item">
          <span className="seat seat-sold seat-key" /> Taken
        </span>
      </div>
    </div>
  );
}
