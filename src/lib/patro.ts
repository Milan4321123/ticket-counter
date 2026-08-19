// The Nepali patro — a hand-embedded Bikram Sambat table, and deliberately so.
//
// BS month lengths are set by astronomical observation and published by Nepal's
// Panchang Nirnayak Samiti roughly one year ahead; no formula in this codebase
// should pretend to compute them. What lives here is a lookup table of month
// lengths for 2080–2095 BS anchored at 2080-01-01 BS = 2023-04-14 AD, verified
// (August 2026) against live Hamro Patro month pages and four independent
// converter datasets, with disagreeing stale rows rejected by the live checks.
//
// Honest confidence tiers, so nobody trusts this further than it deserves:
//   2080–2083 — CERTAIN: unanimous across sources and verified at every month
//     start against live Hamro Patro.
//   2084–2086 — HIGH: three independent datasets agree exactly and live Hamro
//     Patro matches every month start through Mangsir 2087.
//   Poush 2087 onward — PROJECTION, ±1 day: sources genuinely diverge there
//     (Hamro Patro runs +1 day vs this table from that point; Ashesh runs 0/−1)
//     and the official calendar simply has not been published that far ahead.
//   Re-sync this table against official data around BS 2086.
//
// Client-safe on purpose: pure data and arithmetic, no db or server imports —
// the /patro converter runs it in the browser.

/** First BS year in the table. */
const FIRST_YEAR = 2080;
/** Last BS year in the table (inclusive). */
const LAST_YEAR = 2095;

/** 2080-01-01 BS fell on this Gregorian date. Everything is an offset from here. */
const ANCHOR_AD = '2023-04-14';

/** Month lengths (Baisakh…Chaitra) per BS year, FIRST_YEAR..LAST_YEAR in order. */
const MONTH_LENGTHS: number[][] = [
  [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30], // 2080
  [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31], // 2081
  [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30], // 2082
  [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30], // 2083
  [31, 31, 32, 31, 31, 30, 30, 30, 29, 30, 30, 30], // 2084
  [31, 32, 31, 32, 30, 31, 30, 30, 29, 30, 30, 30], // 2085
  [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 30], // 2086
  [31, 31, 32, 31, 31, 31, 30, 29, 30, 30, 30, 30], // 2087
  [30, 31, 32, 32, 30, 31, 30, 30, 29, 30, 30, 30], // 2088
  [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 30], // 2089
  [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 30], // 2090
  [31, 31, 32, 31, 31, 31, 30, 30, 29, 30, 30, 30], // 2091
  [30, 31, 32, 32, 31, 30, 30, 30, 29, 30, 30, 30], // 2092
  [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 30], // 2093
  [31, 31, 32, 31, 31, 30, 30, 30, 29, 30, 30, 30], // 2094
  [31, 31, 32, 31, 31, 31, 30, 29, 30, 30, 30, 30], // 2095
];

/** BS months in calendar order, with the Devanagari the diaspora reads. */
export const BS_MONTHS: { name: string; nameNe: string }[] = [
  { name: 'Baisakh', nameNe: 'बैशाख' },
  { name: 'Jestha', nameNe: 'जेठ' },
  { name: 'Asar', nameNe: 'असार' },
  { name: 'Shrawan', nameNe: 'साउन' },
  { name: 'Bhadra', nameNe: 'भदौ' },
  { name: 'Ashwin', nameNe: 'असोज' },
  { name: 'Kartik', nameNe: 'कार्तिक' },
  { name: 'Mangsir', nameNe: 'मंसिर' },
  { name: 'Poush', nameNe: 'पुष' },
  { name: 'Magh', nameNe: 'माघ' },
  { name: 'Falgun', nameNe: 'फागुन' },
  { name: 'Chaitra', nameNe: 'चैत' },
];

export interface BsDate {
  year: number;
  /** 1-based: 1 = Baisakh … 12 = Chaitra. */
  month: number;
  day: number;
}

/** The years the table can answer for — useful for form bounds on /patro. */
export const BS_RANGE = { first: FIRST_YEAR, last: LAST_YEAR } as const;

function lengthsFor(year: number): number[] | null {
  if (year < FIRST_YEAR || year > LAST_YEAR) return null;
  return MONTH_LENGTHS[year - FIRST_YEAR];
}

/** Days in the given BS month, or null outside the table's range. */
export function bsMonthLength(year: number, month: number): number | null {
  const months = lengthsFor(year);
  if (!months || month < 1 || month > 12) return null;
  return months[month - 1];
}

/**
 * Gregorian ISO date -> BS date, or null when the date falls outside
 * 2080-01-01..2095-12-30 BS. Walks the table day by month — no formula,
 * because there is none; see the header comment.
 */
export function adToBs(isoDate: string): BsDate | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return null;
  const anchor = new Date(ANCHOR_AD + 'T00:00:00Z');
  const target = new Date(isoDate + 'T00:00:00Z');
  if (Number.isNaN(target.getTime())) return null;
  let remaining = Math.round((target.getTime() - anchor.getTime()) / 86_400_000);
  if (remaining < 0) return null;
  for (let year = FIRST_YEAR; year <= LAST_YEAR; year++) {
    for (let month = 1; month <= 12; month++) {
      const len = MONTH_LENGTHS[year - FIRST_YEAR][month - 1];
      if (remaining < len) return { year, month, day: remaining + 1 };
      remaining -= len;
    }
  }
  return null;
}

/**
 * BS date -> Gregorian ISO date, or null when the year is outside 2080–2095
 * or the day does not exist in that month (Baisakh 32 in a 31-day year).
 */
export function bsToAd(bsYear: number, month: number, day: number): string | null {
  const len = bsMonthLength(bsYear, month);
  if (len === null || !Number.isInteger(day) || day < 1 || day > len) return null;
  let offset = 0;
  for (let year = FIRST_YEAR; year < bsYear; year++) {
    offset += MONTH_LENGTHS[year - FIRST_YEAR].reduce((a, b) => a + b, 0);
  }
  for (let m = 1; m < month; m++) {
    offset += MONTH_LENGTHS[bsYear - FIRST_YEAR][m - 1];
  }
  offset += day - 1;
  const d = new Date(ANCHOR_AD + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

const DEVANAGARI_DIGITS = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];

/** 2083 -> '२०८३' — for showing the date the way the patro on the wall does. */
export function toDevanagariDigits(n: number): string {
  return String(n)
    .split('')
    .map((c) => (c >= '0' && c <= '9' ? DEVANAGARI_DIGITS[Number(c)] : c))
    .join('');
}

/** 'Bhadra 4, 2083' — the Latin-script reading of a BS date. */
export function formatBs(bs: BsDate): string {
  return `${BS_MONTHS[bs.month - 1].name} ${bs.day}, ${bs.year}`;
}

/** 'भदौ ४, २०८३' — the same date as the patro prints it. */
export function formatBsNe(bs: BsDate): string {
  return `${BS_MONTHS[bs.month - 1].nameNe} ${toDevanagariDigits(bs.day)}, ${toDevanagariDigits(bs.year)}`;
}
