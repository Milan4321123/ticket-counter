// Server-only: reserved seating.
//
// An event can carry a SEAT MAP: a stage and a few sections, each a block of
// rows × seats, each sold as one ticket type (VIP front rows, Standard behind).
// A buyer then picks exact seats at checkout instead of a quantity, and every
// seat can be held by exactly one live order.
//
// How it stays correct without touching the money code:
//   · The ticket type is still what is priced, capped and counted. Picking
//     seats simply SETS the quantity per type; createOrder, inventory and the
//     capture/confirm paths are unchanged.
//   · A seat is taken while the order holding it is alive (pending, claimed,
//     capturing, paid). A seat held by a dead order (failed, cancelled,
//     expired) is free again with nothing to clean up — see takenSeats().
//   · seat_holds has UNIQUE(event_id, seat_id), so two checkouts racing for
//     one seat cannot both win: the loser's insert fails and its order is
//     cancelled before anything is paid.
//   · Saving a map sets each seated type's cap to its number of seats, so the
//     ordinary capacity rules and the map can never disagree.
import { getDb } from './db';
import type { EventTierRow } from './events';

export interface SeatSection {
  id: string;
  name: string;
  /** The ticket type every seat in this section is sold as. */
  tierKey: string;
  rows: number;
  seatsPerRow: number;
  /** Row letter of the first row ('A' by default); sections continue lettering. */
  firstRow: string;
  /** Seat numbers after which there is an aisle gap, e.g. [5, 15]. */
  aislesAfter: number[];
  /** Seat ids that do not exist or are never sold (a pillar, the sound desk). */
  blocked: string[];
}

export interface SeatMap {
  enabled: boolean;
  stageLabel: string;
  sections: SeatSection[];
}

export const MAX_SECTIONS = 6;
export const MAX_ROWS = 30;
export const MAX_SEATS_PER_ROW = 40;

const ROW_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I or O, like most halls

export function rowLabel(firstRow: string, index: number): string {
  const start = Math.max(0, ROW_LETTERS.indexOf(firstRow.toUpperCase()));
  const n = start + index;
  return n < ROW_LETTERS.length ? ROW_LETTERS[n] : `${ROW_LETTERS[Math.floor(n / ROW_LETTERS.length) - 1]}${ROW_LETTERS[n % ROW_LETTERS.length]}`;
}

/** 'VIP-C-7' — section id, row, seat number. Stable across edits of other sections. */
export function seatId(sectionId: string, row: string, seat: number): string {
  return `${sectionId}-${row}-${seat}`;
}

/** "Row C, seat 7" for people. */
export function seatLabel(id: string, map?: SeatMap): string {
  const parts = id.split('-');
  if (parts.length < 3) return id;
  const seat = parts.pop();
  const row = parts.pop();
  const section = map?.sections.find((s) => s.id === parts.join('-'));
  return `${section && map && map.sections.length > 1 ? `${section.name} · ` : ''}Row ${row}, seat ${seat}`;
}

export function parseSeatMap(raw: string | null | undefined): SeatMap | null {
  if (!raw) return null;
  try {
    return normaliseSeatMap(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** Validate a map from the editor or the database. Null when it is unusable. */
export function normaliseSeatMap(v: unknown, tierKeys?: string[]): SeatMap | null {
  if (!v || typeof v !== 'object') return null;
  const m = v as Partial<SeatMap>;
  const sections: SeatSection[] = [];
  const ids = new Set<string>();
  for (const [i, raw] of (Array.isArray(m.sections) ? m.sections : []).slice(0, MAX_SECTIONS).entries()) {
    const s = raw as Partial<SeatSection>;
    const id = (typeof s.id === 'string' && /^[A-Za-z0-9]{1,8}$/.test(s.id) ? s.id : `S${i + 1}`).toUpperCase();
    if (ids.has(id)) continue;
    const rows = Math.floor(Number(s.rows));
    const seatsPerRow = Math.floor(Number(s.seatsPerRow));
    if (!(rows >= 1 && rows <= MAX_ROWS && seatsPerRow >= 1 && seatsPerRow <= MAX_SEATS_PER_ROW)) continue;
    const tierKey = typeof s.tierKey === 'string' ? s.tierKey : '';
    if (!tierKey || (tierKeys && !tierKeys.includes(tierKey))) continue;
    const firstRow = typeof s.firstRow === 'string' && ROW_LETTERS.includes(s.firstRow.toUpperCase()) ? s.firstRow.toUpperCase() : 'A';
    const aislesAfter = Array.isArray(s.aislesAfter)
      ? Array.from(new Set(s.aislesAfter.map((n) => Math.floor(Number(n))).filter((n) => n >= 1 && n < seatsPerRow))).sort((a, b) => a - b)
      : [];
    const blocked = Array.isArray(s.blocked)
      ? s.blocked.filter((b): b is string => typeof b === 'string' && b.startsWith(`${id}-`)).slice(0, 400)
      : [];
    const name = typeof s.name === 'string' && s.name.trim() ? s.name.trim().slice(0, 30) : `Section ${i + 1}`;
    ids.add(id);
    sections.push({ id, name, tierKey, rows, seatsPerRow, firstRow, aislesAfter, blocked });
  }
  if (sections.length === 0) return null;
  const stageLabel = typeof m.stageLabel === 'string' && m.stageLabel.trim() ? m.stageLabel.trim().slice(0, 30) : 'Stage';
  return { enabled: Boolean(m.enabled), stageLabel, sections };
}

/** Every sellable seat of a section, row by row. */
export function sectionSeats(section: SeatSection): { id: string; row: string; seat: number }[] {
  const out: { id: string; row: string; seat: number }[] = [];
  const blocked = new Set(section.blocked);
  for (let r = 0; r < section.rows; r++) {
    const row = rowLabel(section.firstRow, r);
    for (let n = 1; n <= section.seatsPerRow; n++) {
      const id = seatId(section.id, row, n);
      if (!blocked.has(id)) out.push({ id, row, seat: n });
    }
  }
  return out;
}

/** Seats per ticket type — what each seated type's cap becomes. */
export function seatCountsByTier(map: SeatMap): Map<string, number> {
  const out = new Map<string, number>();
  for (const s of map.sections) out.set(s.tierKey, (out.get(s.tierKey) ?? 0) + sectionSeats(s).length);
  return out;
}

/** The ticket type a seat is sold as, or null for a seat that is not on the map. */
export function tierOfSeat(map: SeatMap, id: string): string | null {
  for (const s of map.sections) {
    if (!id.startsWith(`${s.id}-`)) continue;
    return sectionSeats(s).some((x) => x.id === id) ? s.tierKey : null;
  }
  return null;
}

// ---------------- Who holds what ----------------

const ALIVE = `('pending', 'claimed', 'capturing', 'paid')`;

/** Seat id → 'held' | 'sold' for every seat an alive order is holding. */
export function takenSeats(eventId: string): Map<string, 'held' | 'sold'> {
  const rows = getDb()
    .prepare(
      `SELECT h.seat_id AS seatId, o.status FROM seat_holds h JOIN orders o ON o.id = h.order_id
       WHERE h.event_id = ? AND o.status IN ${ALIVE}`
    )
    .all(eventId) as { seatId: string; status: string }[];
  return new Map(rows.map((r) => [r.seatId, r.status === 'paid' ? 'sold' : 'held']));
}

export class SeatTakenError extends Error {
  constructor() {
    super('One of those seats was just taken — please pick again.');
    this.name = 'SeatTakenError';
  }
}

/**
 * Hold these seats for this order. Atomic: all or none. A seat still recorded
 * against a DEAD order is reclaimed; one held by a live order throws.
 */
export function holdSeats(eventId: string, orderId: string, seatIds: string[]): void {
  const db = getDb();
  db.transaction(() => {
    const existing = db.prepare(
      `SELECT h.order_id AS orderId, o.status FROM seat_holds h LEFT JOIN orders o ON o.id = h.order_id
       WHERE h.event_id = ? AND h.seat_id = ?`
    );
    const del = db.prepare(`DELETE FROM seat_holds WHERE event_id = ? AND seat_id = ?`);
    const ins = db.prepare(`INSERT INTO seat_holds (event_id, seat_id, order_id) VALUES (?, ?, ?)`);
    for (const id of seatIds) {
      const row = existing.get(eventId, id) as { orderId: string; status: string | null } | undefined;
      if (row) {
        if (row.orderId !== orderId && row.status && ['pending', 'claimed', 'capturing', 'paid'].includes(row.status)) {
          throw new SeatTakenError();
        }
        del.run(eventId, id);
      }
      ins.run(eventId, id, orderId);
    }
  })();
}

/** The seats an order holds, in a stable order. */
export function seatsForOrder(orderId: string): string[] {
  return (
    getDb().prepare(`SELECT seat_id AS seatId FROM seat_holds WHERE order_id = ? ORDER BY seat_id`).all(orderId) as {
      seatId: string;
    }[]
  ).map((r) => r.seatId);
}

/** Seats for many orders at once — the portal's orders list. */
export function seatsForOrders(orderIds: string[]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  if (orderIds.length === 0) return out;
  const db = getDb();
  for (let i = 0; i < orderIds.length; i += 400) {
    const batch = orderIds.slice(i, i + 400);
    const rows = db
      .prepare(`SELECT order_id AS orderId, seat_id AS seatId FROM seat_holds WHERE order_id IN (${batch.map(() => '?').join(',')}) ORDER BY seat_id`)
      .all(...batch) as { orderId: string; seatId: string }[];
    for (const r of rows) out.set(r.orderId, [...(out.get(r.orderId) ?? []), r.seatId]);
  }
  return out;
}

/**
 * Check a checkout's seats: each on the map, not taken, and — per ticket type —
 * exactly as many as the quantity ordered. Returns the clean list or an error.
 */
export function validateSeatPicks(
  eventId: string,
  map: SeatMap,
  items: { tierId: string; quantity: number }[],
  raw: unknown
): string[] | string {
  const seated = new Set(map.sections.map((s) => s.tierKey));
  const wanted = items.filter((it) => seated.has(it.tierId));
  if (wanted.length === 0) return [];
  const picks = Array.isArray(raw) ? Array.from(new Set(raw.filter((x): x is string => typeof x === 'string'))) : [];
  const taken = takenSeats(eventId);
  const perTier = new Map<string, number>();
  for (const id of picks) {
    const tier = tierOfSeat(map, id);
    if (!tier) return 'One of those seats does not exist — please pick again.';
    if (taken.has(id)) return 'One of those seats was just taken — please pick again.';
    perTier.set(tier, (perTier.get(tier) ?? 0) + 1);
  }
  for (const it of wanted) {
    if ((perTier.get(it.tierId) ?? 0) !== it.quantity) return 'Please pick a seat for every ticket.';
  }
  if ([...perTier.keys()].some((t) => !wanted.some((it) => it.tierId === t))) {
    return 'Please pick a seat for every ticket.';
  }
  return picks;
}

/** Keep every seated type's cap equal to its seats — called when a map is saved. */
export function syncSeatedCaps(eventId: string, map: SeatMap, tiers: EventTierRow[]): void {
  const counts = seatCountsByTier(map);
  const db = getDb();
  const upd = db.prepare(`UPDATE event_tiers SET cap = ?, unlimited = 0 WHERE event_id = ? AND tier_key = ?`);
  for (const t of tiers) {
    const n = counts.get(t.tierKey);
    if (n !== undefined && map.enabled) upd.run(n, eventId, t.tierKey);
  }
}

/**
 * Seats as people read them, grouped and in number order:
 * "VIP front rows: row B, seats 9–10 · Standard: row F, seat 3".
 */
export function seatSummary(ids: string[], map?: SeatMap | null): string {
  const groups = new Map<string, { section: string; row: string; seats: number[] }>();
  for (const id of ids) {
    const parts = id.split('-');
    if (parts.length < 3) continue;
    const seat = Number(parts.pop());
    const row = parts.pop() as string;
    const sectionId = parts.join('-');
    const key = `${sectionId}|${row}`;
    const g = groups.get(key) ?? { section: sectionId, row, seats: [] };
    g.seats.push(seat);
    groups.set(key, g);
  }
  const multi = (map?.sections.length ?? 0) > 1;
  return [...groups.values()]
    .sort((a, b) => a.section.localeCompare(b.section) || a.row.localeCompare(b.row))
    .map((g) => {
      const seats = g.seats.sort((a, b) => a - b);
      const consecutive = seats.every((n, i) => i === 0 || n === seats[i - 1] + 1);
      const list = seats.length > 2 && consecutive ? `${seats[0]}–${seats[seats.length - 1]}` : seats.join(', ');
      const name = multi ? `${map?.sections.find((s) => s.id === g.section)?.name ?? g.section}: ` : '';
      return `${name}row ${g.row}, ${seats.length === 1 ? 'seat' : 'seats'} ${list}`;
    })
    .join(' · ');
}

/**
 * Which seat ONE ticket stands for. Seats are held per order; the order's
 * tickets of a seated type are paired with that type's seats in a stable order
 * (both sorted), so every ticket prints the same seat every time.
 */
export function seatForTicket(orderId: string, tierKey: string, code: string, map: SeatMap | null): string | null {
  if (!map) return null;
  const db = getDb();
  const codes = (
    db.prepare(`SELECT code FROM tickets WHERE order_id = ? AND tier_id = ? ORDER BY code`).all(orderId, tierKey) as { code: string }[]
  ).map((r) => r.code);
  const seats = seatsForOrder(orderId)
    .filter((id) => tierOfSeat(map, id) === tierKey)
    .sort((a, b) => {
      const [ra, na] = a.split('-').slice(-2);
      const [rb, nb] = b.split('-').slice(-2);
      return ra.localeCompare(rb) || Number(na) - Number(nb);
    });
  const i = codes.indexOf(code);
  return i >= 0 && seats[i] ? seats[i] : null;
}
