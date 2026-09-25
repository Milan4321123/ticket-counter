// Server-only: the restaurant pack.
//
//   · COLLECTION SLOTS — a shop can say "we hand orders over Tue–Sun, 11:00–
//     20:00, every 30 minutes, at most 6 orders per slot". The buyer picks a
//     slot at checkout; a full slot cannot be picked.
//   · ITEM CHOICES — "Spice: Mild, Medium, Hot". Free choices, never a price:
//     money code (lib/orders createOrder, inventory, statements) is untouched.
//   · TABLE ORDERING — a printed QR code per table opens the shop with
//     ?table=5, and the order carries the table instead of a slot.
//   · THE KITCHEN BOARD — every paid order of the shop, moving New → Cooking →
//     Ready → Handed over. "Ready" emails the buyer.
//
// Times are the shop's wall-clock time in Germany (Europe/Berlin), stored as
// 'YYYY-MM-DDTHH:MM' without a zone — a slot is "Saturday at 12:30 at the
// counter", not an instant, and a buyer abroad must still read 12:30.
import { getDb } from './db';
import { getEventTier, type EventRow, type EventTierRow } from './events';

export const SHOP_TZ = 'Europe/Berlin';

// ---------------- Slot configuration ----------------

export interface SlotConfig {
  enabled: boolean;
  /** Weekdays with slots, 0 = Sunday … 6 = Saturday. */
  days: number[];
  /** 'HH:MM' first slot of the day. */
  start: string;
  /** 'HH:MM' — no slot starts at or after this. */
  end: string;
  /** Minutes between slots. */
  stepMin: number;
  /** Orders per slot; 0 = no limit. */
  perSlot: number;
  /** Earliest slot is at least this many minutes from now (kitchen lead time). */
  leadMin: number;
  /** How many days ahead a buyer may book. */
  daysAhead: number;
  /**
   * What the times are FOR. 'collection' — a buyer picks when to pick up an
   * order (restaurants, bakeries). 'appointment' — a buyer books a time to be
   * seen (a salon chair, a tutor, a puja, a photo shoot); only the wording
   * changes, the machinery is the same.
   */
  purpose: 'collection' | 'appointment';
}

export const DEFAULT_SLOTS: SlotConfig = {
  enabled: false,
  days: [2, 3, 4, 5, 6, 0],
  start: '11:00',
  end: '20:00',
  stepMin: 30,
  perSlot: 6,
  leadMin: 60,
  daysAhead: 7,
  purpose: 'collection',
};

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

function toMin(hhmm: string): number {
  const m = HHMM.exec(hhmm);
  return m ? Number(m[1]) * 60 + Number(m[2]) : -1;
}

function fromMin(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}

/** Read the stored config, falling back field by field to the defaults. */
export function parseSlotConfig(raw: string | null | undefined): SlotConfig {
  if (!raw) return { ...DEFAULT_SLOTS };
  try {
    const v = JSON.parse(raw) as Partial<SlotConfig>;
    return normaliseSlotConfig(v) ?? { ...DEFAULT_SLOTS };
  } catch {
    return { ...DEFAULT_SLOTS };
  }
}

/** Validate a config from the editor. Null when it cannot be made sensible. */
export function normaliseSlotConfig(v: Partial<SlotConfig>): SlotConfig | null {
  const days = Array.isArray(v.days)
    ? Array.from(new Set(v.days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))).sort()
    : DEFAULT_SLOTS.days;
  const start = typeof v.start === 'string' && HHMM.test(v.start) ? v.start : DEFAULT_SLOTS.start;
  const end = typeof v.end === 'string' && HHMM.test(v.end) ? v.end : DEFAULT_SLOTS.end;
  if (toMin(end) <= toMin(start)) return null;
  const stepMin = [10, 15, 20, 30, 45, 60, 90, 120].includes(Number(v.stepMin)) ? Number(v.stepMin) : DEFAULT_SLOTS.stepMin;
  const perSlot = Number.isInteger(v.perSlot) && (v.perSlot as number) >= 0 && (v.perSlot as number) <= 500 ? (v.perSlot as number) : DEFAULT_SLOTS.perSlot;
  const leadMin = Number.isInteger(v.leadMin) && (v.leadMin as number) >= 0 && (v.leadMin as number) <= 7 * 24 * 60 ? (v.leadMin as number) : DEFAULT_SLOTS.leadMin;
  const daysAhead = Number.isInteger(v.daysAhead) && (v.daysAhead as number) >= 1 && (v.daysAhead as number) <= 30 ? (v.daysAhead as number) : DEFAULT_SLOTS.daysAhead;
  const purpose = v.purpose === 'appointment' ? 'appointment' : 'collection';
  return { enabled: Boolean(v.enabled), days, start, end, stepMin, perSlot, leadMin, daysAhead, purpose };
}

// ---------------- Wall-clock time in Germany ----------------

/** Now, as the shop's wall clock reads it: { date: 'YYYY-MM-DD', min: minutes since midnight, weekday }. */
export function shopNow(at: Date = new Date()): { date: string; min: number; weekday: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: SHOP_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    weekday: 'short',
  }).formatToParts(at);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    min: Number(get('hour')) * 60 + Number(get('minute')),
    weekday,
  };
}

function addDays(isoDate: string, days: number): { date: string; weekday: number } {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return { date: d.toISOString().slice(0, 10), weekday: d.getUTCDay() };
}

// ---------------- The slots a buyer can pick ----------------

export interface SlotOption {
  /** 'YYYY-MM-DDTHH:MM' — what is stored on the order. */
  value: string;
  date: string;
  time: string;
  /** Orders already booked into it. */
  taken: number;
  /** Still bookable. */
  open: boolean;
}

export interface SlotDay {
  date: string;
  /** "Today", "Tomorrow", "Sat 27 Sep". */
  label: string;
  slots: SlotOption[];
}

/** Orders that hold a slot: anything alive (reserved, paying, paid). */
function takenBySlot(eventId: string): Map<string, number> {
  const rows = getDb()
    .prepare(
      `SELECT pickup_slot AS slot, COUNT(*) AS n FROM orders
       WHERE event_id = ? AND pickup_slot IS NOT NULL AND status IN ('claimed', 'capturing', 'paid')
       GROUP BY pickup_slot`
    )
    .all(eventId) as { slot: string; n: number }[];
  return new Map(rows.map((r) => [r.slot, r.n]));
}

export function dayLabel(date: string, today: string): string {
  if (date === today) return 'Today';
  if (date === addDays(today, 1).date) return 'Tomorrow';
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

/** The bookable days and their slots, from now to daysAhead. Empty when slots are off. */
export function availableSlots(event: Pick<EventRow, 'id'> & { pickupSlots: string | null }, at: Date = new Date()): SlotDay[] {
  const cfg = parseSlotConfig(event.pickupSlots);
  if (!cfg.enabled || cfg.days.length === 0) return [];
  const now = shopNow(at);
  const taken = takenBySlot(event.id);
  const startMin = toMin(cfg.start);
  const endMin = toMin(cfg.end);
  const out: SlotDay[] = [];
  for (let d = 0; d < cfg.daysAhead; d++) {
    const { date, weekday } = addDays(now.date, d);
    if (!cfg.days.includes(weekday)) continue;
    const slots: SlotOption[] = [];
    for (let m = startMin; m < endMin; m += cfg.stepMin) {
      // Lead time: on today, only slots far enough ahead for the kitchen.
      if (d === 0 && m < now.min + cfg.leadMin) continue;
      const value = `${date}T${fromMin(m)}`;
      const n = taken.get(value) ?? 0;
      slots.push({ value, date, time: fromMin(m), taken: n, open: cfg.perSlot === 0 || n < cfg.perSlot });
    }
    if (slots.length > 0) out.push({ date, label: dayLabel(date, now.date), slots });
  }
  return out;
}

/** Is this exact slot currently offered and not full? The server's word at checkout. */
export function slotIsBookable(event: Pick<EventRow, 'id'> & { pickupSlots: string | null }, value: string): boolean {
  return availableSlots(event).some((day) => day.slots.some((s) => s.value === value && s.open));
}

/** "Sat 27 Sep, 12:30" — how a slot reads on an order. */
export function slotLabel(value: string | null | undefined, today = shopNow().date): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return '';
  const [date, time] = value.split('T');
  return `${dayLabel(date, today)}, ${time}`;
}

// ---------------- Item choices ----------------

export interface ChoiceGroup {
  name: string;
  options: string[];
}

export const MAX_CHOICE_GROUPS = 3;
export const MAX_CHOICE_OPTIONS = 8;

const clean = (s: string, max: number) => s.replace(/[\u0000-\u001F\u007F]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

export function parseChoices(raw: string | null | undefined): ChoiceGroup[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v)) return [];
    return v
      .map((g) => ({
        name: typeof g?.name === 'string' ? clean(g.name, 30) : '',
        options: Array.isArray(g?.options)
          ? (g.options as unknown[]).filter((o): o is string => typeof o === 'string').map((o) => clean(o, 40)).filter(Boolean)
          : [],
      }))
      .filter((g) => g.name && g.options.length >= 2)
      .slice(0, MAX_CHOICE_GROUPS);
  } catch {
    return [];
  }
}

/**
 * The editor's plain-text form, one group per line: "Spice: Mild, Medium, Hot".
 * Returns the groups, or a readable error.
 */
export function choicesFromText(text: string): ChoiceGroup[] | string {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length > MAX_CHOICE_GROUPS) return `At most ${MAX_CHOICE_GROUPS} choices per item (one per line).`;
  const groups: ChoiceGroup[] = [];
  for (const line of lines) {
    const i = line.indexOf(':');
    if (i <= 0) return `Write each choice as "Name: option, option" — e.g. "Spice: Mild, Medium, Hot".`;
    const name = clean(line.slice(0, i), 30);
    const options = Array.from(new Set(line.slice(i + 1).split(',').map((o) => clean(o, 40)).filter(Boolean)));
    if (options.length < 2) return `"${name}" needs at least two options, separated by commas.`;
    if (options.length > MAX_CHOICE_OPTIONS) return `"${name}" can have at most ${MAX_CHOICE_OPTIONS} options.`;
    groups.push({ name, options });
  }
  return groups;
}

export function choicesToText(groups: ChoiceGroup[]): string {
  return groups.map((g) => `${g.name}: ${g.options.join(', ')}`).join('\n');
}

/** What the buyer picked: { tierKey: { groupName: option } }. */
export type PickedChoices = Record<string, Record<string, string>>;

/**
 * Check a checkout's picks against the items' real choices. Every group of every
 * ordered item must have exactly one of its own options; anything else in the
 * request is dropped. Returns the clean picks or a readable error.
 */
export function validatePicks(eventId: string, tierKeys: string[], raw: unknown): PickedChoices | string {
  const input = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const out: PickedChoices = {};
  for (const key of tierKeys) {
    const tier = getEventTier(eventId, key);
    const groups = parseChoices(tier?.choices ?? null);
    if (groups.length === 0) continue;
    const picks = input[key] && typeof input[key] === 'object' ? (input[key] as Record<string, unknown>) : {};
    const clean: Record<string, string> = {};
    for (const g of groups) {
      const v = picks[g.name];
      if (typeof v !== 'string' || !g.options.includes(v)) {
        return `Please choose ${g.name.toLowerCase()} for “${tier?.name ?? key}”.`;
      }
      clean[g.name] = v;
    }
    out[key] = clean;
  }
  return out;
}

export function parsePicks(raw: string | null | undefined): PickedChoices {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw);
    return v && typeof v === 'object' ? (v as PickedChoices) : {};
  } catch {
    return {};
  }
}

/** "Mild · Tomato achar" for one line of an order. */
export function picksLine(picks: PickedChoices, tierKey: string): string {
  const p = picks[tierKey];
  return p ? Object.values(p).join(' · ') : '';
}

// ---------------- Kitchen details on an order ----------------

export interface KitchenDetails {
  pickupSlot: string | null;
  tableLabel: string;
  note: string;
  choices: PickedChoices;
}

export function setOrderKitchenDetails(orderId: string, d: KitchenDetails): void {
  getDb()
    .prepare(`UPDATE orders SET pickup_slot = ?, table_label = ?, order_note = ?, item_choices = ? WHERE id = ?`)
    .run(d.pickupSlot, d.tableLabel, d.note, Object.keys(d.choices).length ? JSON.stringify(d.choices) : null, orderId);
}

export function getOrderKitchenDetails(orderId: string): KitchenDetails & {
  kitchenStatus: KitchenStatus;
  cookingAt: string | null;
  readyAt: string | null;
  handedAt: string | null;
} {
  const row = getDb()
    .prepare(
      `SELECT pickup_slot AS pickupSlot, table_label AS tableLabel, order_note AS note, item_choices AS choices,
              kitchen_status AS kitchenStatus, kitchen_cooking_at AS cookingAt, kitchen_ready_at AS readyAt,
              CASE WHEN kitchen_status = 'done' THEN kitchen_updated_at END AS handedAt
       FROM orders WHERE id = ?`
    )
    .get(orderId) as
    | {
        pickupSlot: string | null;
        tableLabel: string;
        note: string;
        choices: string | null;
        kitchenStatus: string;
        cookingAt: string | null;
        readyAt: string | null;
        handedAt: string | null;
      }
    | undefined;
  return {
    pickupSlot: row?.pickupSlot ?? null,
    tableLabel: row?.tableLabel ?? '',
    note: row?.note ?? '',
    choices: parsePicks(row?.choices),
    cookingAt: row?.cookingAt ?? null,
    readyAt: row?.readyAt ?? null,
    handedAt: row?.handedAt ?? null,
    kitchenStatus: asKitchenStatus(row?.kitchenStatus),
  };
}

/** A table label from ?table= — short, plain, and never markup. */
export function cleanTableLabel(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const v = raw.trim().slice(0, 12);
  return /^[A-Za-z0-9 _-]{1,12}$/.test(v) ? v : '';
}

// ---------------- The kitchen board ----------------

export type KitchenStatus = 'new' | 'cooking' | 'ready' | 'done';
export const KITCHEN_STATUSES: KitchenStatus[] = ['new', 'cooking', 'ready', 'done'];

export function asKitchenStatus(v: unknown): KitchenStatus {
  return v === 'cooking' || v === 'ready' || v === 'done' ? v : 'new';
}

export interface KitchenTicket {
  orderId: string;
  reference: string;
  buyerName: string;
  status: KitchenStatus;
  pickupSlot: string | null;
  slotLabel: string;
  tableLabel: string;
  note: string;
  paidAt: string | null;
  updatedAt: string | null;
  /** When it went into Cooking / Ready (UTC 'YYYY-MM-DD HH:MM:SS'), or null. */
  cookingAt: string | null;
  readyAt: string | null;
  /** When the buyer ordered. */
  createdAt: string;
  items: { name: string; quantity: number; picks: string }[];
  /** Every code of the order has been scanned at the counter. */
  collected: boolean;
}

/**
 * The board: paid orders of this shop that are still in play — due within the
 * next week (or with no slot and paid in the last three days), plus anything
 * handed over in the last three hours so a mis-tap can be undone.
 */
export function listKitchenTickets(event: EventRow, tiers: EventTierRow[]): KitchenTicket[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT o.id, o.buyer_name AS buyerName, o.kitchen_status AS status, o.pickup_slot AS pickupSlot,
              o.table_label AS tableLabel, o.order_note AS note, o.item_choices AS choices,
              o.paid_at AS paidAt, o.kitchen_updated_at AS updatedAt,
              o.kitchen_cooking_at AS cookingAt, o.kitchen_ready_at AS readyAt, o.created_at AS createdAt,
              (SELECT COUNT(*) FROM tickets t WHERE t.order_id = o.id) AS codes,
              (SELECT COUNT(*) FROM tickets t WHERE t.order_id = o.id AND t.checked_in_at IS NOT NULL) AS scanned
       FROM orders o
       WHERE o.event_id = ? AND o.status = 'paid'
         AND (o.paid_at >= datetime('now', '-3 days') OR o.pickup_slot >= ?)
       ORDER BY COALESCE(o.pickup_slot, substr(replace(o.paid_at, ' ', 'T'), 1, 16)) ASC`
    )
    .all(event.id, shopNow().date) as {
    id: string;
    buyerName: string;
    status: string;
    pickupSlot: string | null;
    tableLabel: string;
    note: string;
    choices: string | null;
    paidAt: string | null;
    updatedAt: string | null;
    cookingAt: string | null;
    readyAt: string | null;
    createdAt: string;
    codes: number;
    scanned: number;
  }[];
  const nameOf = new Map(tiers.map((t) => [t.tierKey, t.name]));
  const itemsStmt = db.prepare(`SELECT tier_id AS tierId, quantity FROM order_items WHERE order_id = ? ORDER BY tier_id`);
  const recentDoneCutoff = Date.now() - 3 * 3_600_000;
  const out: KitchenTicket[] = [];
  for (const r of rows) {
    const collected = r.codes > 0 && r.scanned >= r.codes;
    let status = asKitchenStatus(r.status);
    if (collected) status = 'done';
    if (status === 'done') {
      const at = r.updatedAt ? Date.parse(`${r.updatedAt.replace(' ', 'T')}Z`) : 0;
      if (!collected && at < recentDoneCutoff) continue;
      if (collected && !r.updatedAt) continue; // collected long ago
      if (at && at < recentDoneCutoff) continue;
    }
    const picks = parsePicks(r.choices);
    out.push({
      orderId: r.id,
      reference: r.id.slice(0, 4).toUpperCase(),
      buyerName: r.buyerName,
      status,
      pickupSlot: r.pickupSlot,
      slotLabel: slotLabel(r.pickupSlot),
      tableLabel: r.tableLabel,
      note: r.note,
      paidAt: r.paidAt,
      updatedAt: r.updatedAt,
      cookingAt: r.cookingAt,
      readyAt: r.readyAt,
      createdAt: r.createdAt,
      collected,
      items: (itemsStmt.all(r.id) as { tierId: string; quantity: number }[]).map((it) => ({
        name: nameOf.get(it.tierId) ?? it.tierId,
        quantity: it.quantity,
        picks: picksLine(picks, it.tierId),
      })),
    });
  }
  return out;
}

/** Move one order on the board. Only a PAID order of this event moves. */
export function setKitchenStatus(eventId: string, orderId: string, status: KitchenStatus): boolean {
  return (
    getDb()
      .prepare(
        `UPDATE orders SET kitchen_status = @status, kitchen_updated_at = datetime('now'),
           -- The clock of the stage it enters starts now; stages after it are
           -- cleared, so moving a card back and forth never shows a stale time.
           kitchen_cooking_at = CASE @status WHEN 'cooking' THEN datetime('now') WHEN 'new' THEN NULL ELSE kitchen_cooking_at END,
           kitchen_ready_at = CASE @status WHEN 'ready' THEN datetime('now') WHEN 'new' THEN NULL WHEN 'cooking' THEN NULL ELSE kitchen_ready_at END
         WHERE id = @orderId AND event_id = @eventId AND status = 'paid'`
      )
      .run({ status, orderId, eventId }).changes > 0
  );
}

/** Kitchen details for many orders in one read — for the portal's orders list. */
export interface KitchenLine {
  line: string;
  /** "Collect Today, 05:30" / "Appointment …" — '' when none. */
  when?: string;
  /** "3" for Table 3 — '' when none. */
  table?: string;
  /** Per item: "Hot · Timur". */
  picks?: string[];
  /** What the buyer wrote. */
  note?: string;
  /** Kitchen stage and when it started (UTC), for "Cooking · 6 min". */
  stage?: KitchenStatus;
  stageAt?: string | null;
}

export function kitchenDetailsBulk(orderIds: string[], purpose: SlotConfig['purpose'] = 'collection'): Map<string, KitchenLine> {
  const out = new Map<string, KitchenLine>();
  if (orderIds.length === 0) return out;
  const db = getDb();
  for (let i = 0; i < orderIds.length; i += 400) {
    const batch = orderIds.slice(i, i + 400);
    const rows = db
      .prepare(
        `SELECT id, pickup_slot AS slot, table_label AS tableLabel, order_note AS note, item_choices AS choices,
                kitchen_status AS stage, status AS orderStatus, paid_at AS paidAt,
                kitchen_cooking_at AS cookingAt, kitchen_ready_at AS readyAt, kitchen_updated_at AS updatedAt
         FROM orders WHERE id IN (${batch.map(() => '?').join(',')})`
      )
      .all(...batch) as {
      id: string;
      slot: string | null;
      tableLabel: string;
      note: string;
      choices: string | null;
      stage: string;
      orderStatus: string;
      paidAt: string | null;
      cookingAt: string | null;
      readyAt: string | null;
      updatedAt: string | null;
    }[];
    for (const r of rows) {
      const parts: string[] = [];
      if (r.tableLabel) parts.push(`Table ${r.tableLabel}`);
      else if (r.slot) parts.push(`${purpose === 'appointment' ? 'Appointment' : 'Collect'} ${slotLabel(r.slot)}`);
      const picks = parsePicks(r.choices);
      const chosen = Object.values(picks).map((p) => Object.values(p).join(' · ')).filter(Boolean);
      if (chosen.length) parts.push(chosen.join(' | '));
      if (r.note) parts.push(`“${r.note}”`);
      const stage = asKitchenStatus(r.stage);
      const paidOrder = r.orderStatus === 'paid';
      if (parts.length || paidOrder)
        out.set(r.id, {
          stage: paidOrder ? stage : undefined,
          stageAt: !paidOrder ? null : stage === 'new' ? r.paidAt : stage === 'cooking' ? (r.cookingAt ?? r.updatedAt) : stage === 'ready' ? (r.readyAt ?? r.updatedAt) : r.updatedAt,
          line: parts.join(' — '),
          when: !r.tableLabel && r.slot ? `${purpose === 'appointment' ? 'Appointment' : 'Collect'} ${slotLabel(r.slot)}` : '',
          table: r.tableLabel,
          picks: chosen,
          note: r.note,
        });
    }
  }
  return out;
}
