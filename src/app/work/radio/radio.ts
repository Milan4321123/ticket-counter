// The rules behind "Dui Kinara Radio" (/work/radio), with no browser in them:
// the weekly programme and what is on now (in station time, across days and
// midnight), the live stream's segments and what each bar of music plays,
// episode waveforms, chapters, seeking and where to resume, the simulated
// listener count, song requests and cleaning what comes back from
// localStorage. tests/radioStation.test.ts pins all of it.
//
// The station is made up, and so is its music: stream.ts plays the bars
// described here with Web Audio. Nothing is fetched and nothing is sent.

export type Lang = 'en' | 'de' | 'ne';

export type ShowId = 'bihani' | 'bhajan' | 'geet' | 'calling' | 'katha' | 'diaspora' | 'sanjh' | 'dohori' | 'request' | 'mix';
export type HostId = 'asha' | 'rojan' | 'sabina' | 'kiran' | 'kamala' | 'dipesh' | 'sunita' | 'nabin';

/** The non-stop music that fills every hour without a show. */
export const FILLER: ShowId = 'mix';

/** The station's clock: Central European time, where most of its listeners live. */
export const STATION_TZ = 'Europe/Berlin';
export const NEPAL_TZ = 'Asia/Kathmandu';

// ---------- small helpers ----------

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a, for seeds from ids. */
export function hash(...parts: (string | number)[]): number {
  let h = 0x811c9dc5;
  const s = parts.join('|');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** 0–1439 minutes → "07:30"; 1440 and up wrap to the next day. */
export function hhmm(min: number): string {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** Seconds → "4:05" or "1:02:09". */
export function clock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`;
}

// ---------- the weekly programme ----------

/** Days are Monday = 0 … Sunday = 6. */
export type SlotDef = { show: ShowId; days: number[]; start: string; end: string };

/**
 * The week, in station time. An end at or before its start runs past
 * midnight into the next day (Friday Night Dohori ends at 00:30 on Saturday).
 * Everything not listed here is the non-stop mix.
 */
export const WEEK: SlotDef[] = [
  { show: 'bihani', days: [0, 1, 2, 3, 4], start: '06:30', end: '09:00' },
  { show: 'bhajan', days: [5, 6], start: '07:00', end: '09:00' },
  { show: 'katha', days: [5, 6], start: '10:00', end: '10:45' },
  { show: 'geet', days: [0, 1, 2, 3, 4, 5, 6], start: '12:00', end: '13:00' },
  { show: 'calling', days: [0, 1, 2, 3, 4], start: '15:00', end: '16:00' },
  { show: 'katha', days: [2], start: '17:00', end: '17:30' },
  { show: 'diaspora', days: [0, 2], start: '19:00', end: '20:00' },
  { show: 'sanjh', days: [1, 3], start: '19:00', end: '21:00' },
  { show: 'sanjh', days: [6], start: '18:00', end: '20:00' },
  { show: 'dohori', days: [4], start: '21:00', end: '00:30' },
  { show: 'request', days: [5], start: '20:00', end: '22:00' },
];

/** A slot on one day; `end` may pass 1440 (it runs on into the next day). */
export type Slot = { show: ShowId; day: number; start: number; end: number; filler: boolean };

const toMin = (s: string) => {
  const [h, m] = s.split(':').map(Number);
  return h * 60 + m;
};

/** The listed (non-filler) slots that start on this day. */
function listed(day: number, week: SlotDef[]): Slot[] {
  const out: Slot[] = [];
  for (const d of week) {
    if (!d.days.includes(day)) continue;
    const start = toMin(d.start);
    let end = toMin(d.end);
    if (end <= start) end += 1440;
    out.push({ show: d.show, day, start, end, filler: false });
  }
  return out.sort((a, b) => a.start - b.start);
}

/**
 * Everything that starts on `day`, in order, with the gaps filled by the mix.
 * The day begins where the previous night's late show ends (so after Friday
 * Night Dohori, Saturday's first slot starts at 00:30).
 */
export function daySlots(day: number, week: SlotDef[] = WEEK): Slot[] {
  const prev = listed((day + 6) % 7, week);
  const spill = Math.max(0, ...prev.map((s) => s.end - 1440));
  const out: Slot[] = [];
  let at = spill;
  for (const s of listed(day, week)) {
    if (s.start > at) out.push({ show: FILLER, day, start: at, end: s.start, filler: true });
    out.push(s);
    at = Math.max(at, s.end);
  }
  if (at < 1440) out.push({ show: FILLER, day, start: at, end: 1440, filler: true });
  return out;
}

export type OnNow = {
  slot: Slot;
  /** Minutes until it ends. */
  left: number;
  /** 0–1 through the slot. */
  progress: number;
  /** The next slot (it may be the mix). */
  next: Slot;
  /** The next real show, skipping the mix. */
  nextShow: Slot;
};

/** What is on air at `minute` (0–1439) of `day`, station time. */
export function onNow(day: number, minute: number, week: SlotDef[] = WEEK): OnNow {
  const m = clamp(minute, 0, 1439.999);
  // Yesterday (its late show may still be running), today and the week ahead,
  // on one line of minutes counted from today's midnight.
  const line: { s: Slot; a: number; b: number }[] = [];
  for (let k = -1; k <= 7; k++) {
    for (const s of daySlots((((day + k) % 7) + 7) % 7, week)) {
      const a = s.start + k * 1440;
      const b = s.end + k * 1440;
      const last = line[line.length - 1];
      // The mix before and after midnight is one stretch of music.
      if (last && last.s.filler && s.filler && last.b === a) {
        last.s = { ...last.s, end: last.s.end + (b - a) };
        last.b = b;
      } else line.push({ s, a, b });
    }
  }
  const i = Math.max(0, line.findIndex((x) => x.a <= m && m < x.b));
  const cur = line[i];
  const ahead = line.slice(i + 1).filter((x) => x.a >= cur.b);
  const next = ahead[0]?.s ?? cur.s;
  const nextShow = ahead.find((x) => !x.s.filler)?.s ?? next;
  const len = cur.b - cur.a;
  return { slot: cur.s, left: cur.b - m, progress: len > 0 ? clamp((m - cur.a) / len, 0, 1) : 0, next, nextShow };
}

/** The listed slots of a show across the week (for "when is it on?"). */
export function showTimes(show: ShowId, week: SlotDef[] = WEEK): Slot[] {
  const out: Slot[] = [];
  for (let d = 0; d < 7; d++) out.push(...listed(d, week).filter((s) => s.show === show));
  return out;
}

// ---------- clocks ----------

const WEEKDAY: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };

/** Day, minute and second of the week at `date` in a time zone. */
export function zonedClock(date: Date, tz: string = STATION_TZ): { day: number; minute: number; second: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '0';
  const h = Number(get('hour')) % 24;
  return { day: WEEKDAY[get('weekday')] ?? 0, minute: h * 60 + Number(get('minute')), second: Number(get('second')) };
}

/** Minutes the zone is ahead of UTC at `date` (Berlin 60 or 120, Kathmandu 345). */
export function tzOffset(date: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'));
  const floored = Math.floor(date.getTime() / 60000) * 60000;
  return Math.round((asUtc - floored) / 60000);
}

/** A station-time minute shown in another zone: "11:45", with a day shift of -1, 0 or +1. */
export function inZone(minute: number, date: Date, tz: string): { label: string; dayShift: number } {
  const diff = tzOffset(date, tz) - tzOffset(date, STATION_TZ);
  const m = minute + diff;
  return { label: hhmm(m), dayShift: Math.floor(m / 1440) };
}

// ---------- the week grid (06:00 to 01:00, half-hour rows) ----------

export const GRID_FROM = 6 * 60;
export const GRID_TO = 25 * 60;
export const GRID_STEP = 30;
export const GRID_ROWS = (GRID_TO - GRID_FROM) / GRID_STEP;

/** CSS grid rows (1-based, end exclusive) for a slot, or null when it is outside 06:00–01:00. */
export function gridRows(slot: Slot): { from: number; to: number } | null {
  const a = clamp(slot.start, GRID_FROM, GRID_TO);
  const b = clamp(slot.end, GRID_FROM, GRID_TO);
  if (b - a < GRID_STEP / 2) return null;
  return { from: Math.round((a - GRID_FROM) / GRID_STEP) + 1, to: Math.round((b - GRID_FROM) / GRID_STEP) + 1 };
}

// ---------- the live stream ----------

/** Each live segment: a short jingle sting, then one tune. */
export const SEGMENT_SEC = 150;
export const STING_SEC = 3.2;

/** The segment playing at `ms` (wall-clock): everyone tuned in hears the same one. */
export function liveSegment(ms: number): { index: number; startMs: number; endMs: number } {
  const len = SEGMENT_SEC * 1000;
  const index = Math.floor(ms / len);
  return { index, startMs: index * len, endMs: (index + 1) * len };
}

export type Style = {
  bpm: number;
  /** Eighth-note steps per bar: 8 (4/4) or 6 (6/8, the dohori lilt). */
  meter: 6 | 8;
  /** MIDI note of the home pitch. */
  root: number;
  /** Pentatonic scale, semitones above the root. */
  scale: number[];
  seed: number;
  /** 0 no drum, 1 light madal, 2 full madal. */
  drums: 0 | 1 | 2;
  /** 0–1: how busy the flute is. */
  lead: number;
  /** A soft pad under talk. */
  pad: boolean;
};

const SCALES = [
  [0, 2, 4, 7, 9], // major pentatonic
  [0, 3, 5, 7, 10], // minor pentatonic
  [0, 2, 5, 7, 9], // the hill mode most folk tunes here use
  [0, 2, 5, 7, 10],
];

/** How each show sounds: tempo, metre, drums, how much flute. */
const FEEL: Record<ShowId, { bpm: [number, number]; meter: 6 | 8; drums: 0 | 1 | 2; lead: number; pad: boolean }> = {
  bihani: { bpm: [84, 96], meter: 8, drums: 1, lead: 0.6, pad: false },
  bhajan: { bpm: [66, 74], meter: 8, drums: 1, lead: 0.5, pad: true },
  geet: { bpm: [100, 116], meter: 6, drums: 2, lead: 0.85, pad: false },
  calling: { bpm: [80, 90], meter: 8, drums: 0, lead: 0.3, pad: true },
  katha: { bpm: [70, 80], meter: 8, drums: 0, lead: 0.45, pad: true },
  diaspora: { bpm: [78, 88], meter: 8, drums: 0, lead: 0.25, pad: true },
  sanjh: { bpm: [86, 100], meter: 8, drums: 2, lead: 0.75, pad: false },
  dohori: { bpm: [118, 132], meter: 6, drums: 2, lead: 0.9, pad: false },
  request: { bpm: [92, 108], meter: 8, drums: 2, lead: 0.8, pad: false },
  mix: { bpm: [76, 92], meter: 8, drums: 1, lead: 0.7, pad: false },
};

/** The style of one live segment for the show on air: same index, same tune. */
export function segmentStyle(index: number, show: ShowId): Style {
  const r = mulberry32(hash('seg', index));
  const f = FEEL[show];
  const meter: 6 | 8 = show === 'mix' && r() < 0.35 ? 6 : f.meter;
  return {
    bpm: Math.round(f.bpm[0] + r() * (f.bpm[1] - f.bpm[0])),
    meter,
    root: 57 + Math.floor(r() * 8),
    scale: SCALES[Math.floor(r() * SCALES.length)],
    seed: hash('tune', index),
    drums: f.drums,
    lead: f.lead,
    pad: f.pad,
  };
}

/** Which of the station's demo tunes a segment plays (an index into content's TUNES). */
export function tuneIndex(index: number, count: number): number {
  return hash('title', index) % count;
}

export type EvKind = 'lead' | 'bass' | 'dhin' | 'ta' | 'tick' | 'chime' | 'pad' | 'bell';
export type Ev = { at: number; dur: number; kind: EvKind; midi: number; vel: number };

/** Seconds per bar for a style. */
export function barSec(s: Style): number {
  return (60 / s.bpm / 2) * s.meter;
}

const CELLS: Record<6 | 8, number[][]> = {
  8: [
    [2, 2, 4],
    [1, 1, 2, 4],
    [3, 1, 2, 2],
    [2, 1, 1, 4],
    [4, 2, 2],
    [2, 2, 2, 2],
  ],
  6: [
    [2, 1, 3],
    [3, 3],
    [1, 1, 1, 3],
    [2, 2, 2],
    [3, 2, 1],
  ],
};
const GROOVES: Record<6 | 8, [string, string, string]> = {
  // one character per eighth: D dhin (low), t ta, k soft tick — light, full, fill
  8: ['D...t...', 'D.tkD.tk', 'DtktDDtt'],
  6: ['D..t..', 'D.tDt.', 'DttDtt'],
};
/** Bar roots in scale degrees, per bar of a four-bar phrase. */
const ROOTS = [
  [0, 0, 3, 0],
  [0, 4, 3, 0],
  [0, -1, 3, 4],
];

/**
 * The notes of one bar, from the style and the bar number alone, so the
 * stream can start or seek anywhere. Phrases go A A′ B A over 16 bars and the
 * motifs change every 32 bars, so a tune keeps its shape but never loops.
 */
export function barEvents(s: Style, bar: number): Ev[] {
  const step = 60 / s.bpm / 2;
  const m = s.meter;
  const n = s.scale.length;
  const deg = (d: number) => s.scale[((d % n) + n) % n] + 12 * Math.floor(d / n);
  const out: Ev[] = [];
  const inPhrase = bar % 4;
  const section = Math.floor(bar / 4) % 4; // A A′ B A
  const era = Math.floor(bar / 32);
  const motif = section === 2 ? 'B' : 'A';
  const rootRow = ROOTS[hash(s.seed, 'roots', era) % ROOTS.length];
  const rootDeg = rootRow[inPhrase];

  // Bass on the bar and the half bar.
  out.push({ at: 0, dur: (m / 2) * step, kind: 'bass', midi: s.root - 24 + deg(rootDeg), vel: 1 });
  out.push({ at: (m / 2 + (m === 6 ? 1 : 0)) * step, dur: (m / 2 - 1) * step, kind: 'bass', midi: s.root - 24 + deg(rootDeg + (bar % 2 ? 2 : 0)), vel: 0.7 });

  if (s.pad && inPhrase % 2 === 0) out.push({ at: 0, dur: 2 * m * step, kind: 'pad', midi: s.root - 12 + deg(rootDeg), vel: 1 });

  // The flute: a seeded walk through the scale, the same for the same motif.
  const r = mulberry32(hash(s.seed, motif, era, inPhrase, section === 1 && inPhrase === 3 ? 'turn' : ''));
  const playsHere = r() < 0.2 + s.lead * 0.8 || inPhrase === 0;
  if (playsHere && s.lead > 0) {
    const cell = CELLS[m][Math.floor(r() * CELLS[m].length)];
    let d = (motif === 'B' ? 7 : 5) + Math.floor(r() * 3) - 1;
    let at = 0;
    cell.forEach((len, i) => {
      const last = inPhrase === 3 && i === cell.length - 1;
      if (last) d = 5;
      else {
        const x = r();
        d += x < 0.35 ? 1 : x < 0.7 ? -1 : x < 0.82 ? 2 : x < 0.94 ? -2 : 0;
        d = clamp(d, 2, 10);
      }
      if (!(i > 0 && !last && r() < 0.18 * (1 - s.lead))) {
        out.push({ at: at * step, dur: len * step, kind: 'lead', midi: s.root + deg(d), vel: 0.85 - (len < 2 ? 0.15 : 0) });
      }
      at += len;
    });
  }

  // The madal.
  if (s.drums > 0) {
    const [light, full, fill] = GROOVES[m];
    const pat = s.drums === 2 ? (inPhrase === 3 && section === 3 ? fill : full) : light;
    [...pat].forEach((c, i) => {
      if (c === 'D') out.push({ at: i * step, dur: step, kind: 'dhin', midi: 0, vel: i === 0 ? 1 : 0.8 });
      else if (c === 't') out.push({ at: i * step, dur: step, kind: 'ta', midi: 0, vel: i % 2 ? 0.7 : 0.9 });
      else if (c === 'k') out.push({ at: i * step, dur: step, kind: 'tick', midi: 0, vel: 0.5 });
    });
  }
  // A small chime at the top of every 8 bars.
  if (bar % 8 === 0) out.push({ at: 0, dur: m * step, kind: 'chime', midi: 0, vel: 0.8 });
  return out.sort((a, b) => a.at - b.at);
}

/** The station jingle: a rising bell arpeggio that ends on a chime. */
export function stingEvents(root = 69): Ev[] {
  const notes = [0, 4, 7, 9, 12, 16];
  const out: Ev[] = notes.map((n, i) => ({ at: i * 0.16, dur: 1.2, kind: 'bell' as const, midi: root + n, vel: 0.7 + i * 0.05 }));
  out.push({ at: notes.length * 0.16 + 0.05, dur: 1.6, kind: 'chime', midi: 0, vel: 1 });
  return out;
}

// ---------- podcast episodes ----------

export type Chapter = { at: number };

/** The bed under an episode: gentle, steady, no fills. */
export function episodeStyle(id: string): Style {
  const r = mulberry32(hash('ep', id));
  return {
    bpm: 76 + Math.floor(r() * 14),
    meter: 8,
    root: 57 + Math.floor(r() * 7),
    scale: SCALES[Math.floor(r() * SCALES.length)],
    seed: hash('epTune', id),
    drums: 1,
    lead: 0.35,
    pad: true,
  };
}

/** Where an episode's music bars begin (after its intro jingle). */
export const EP_INTRO_SEC = 4;

/**
 * A waveform of `n` bars between 0.12 and 1, from the episode id alone: the
 * same id always draws the same shape. Speech-like bumps, quieter edges.
 */
export function waveform(id: string, n = 120): number[] {
  const r = mulberry32(hash('wave', id));
  const out: number[] = [];
  let level = 0.5;
  let phrase = 0;
  for (let i = 0; i < n; i++) {
    if (phrase <= 0) {
      phrase = 3 + Math.floor(r() * 7);
      level = 0.35 + r() * 0.55;
    }
    phrase--;
    const pause = r() < 0.06 ? 0.35 : 1;
    const edge = Math.min(1, (i + 1) / 4, (n - i) / 4);
    const v = (level * (0.75 + r() * 0.5)) * pause * (0.55 + 0.45 * edge);
    out.push(Math.round(clamp(v, 0.12, 1) * 1000) / 1000);
  }
  return out;
}

/** Index of the chapter playing at `pos` seconds (chapters sorted by start). */
export function chapterIndexAt(chapters: Chapter[], pos: number): number {
  let idx = 0;
  for (let i = 0; i < chapters.length; i++) if (pos >= chapters[i].at) idx = i;
  return idx;
}

/** Where a click on chapter `i` seeks to (clamped into the episode). */
export function chapterSeek(chapters: Chapter[], i: number, duration: number): number {
  const c = chapters[clamp(Math.round(i), 0, chapters.length - 1)];
  return c ? clamp(c.at, 0, Math.max(0, duration - 1)) : 0;
}

/** A point on the waveform (0–1 across it) → seconds. */
export function fractionToTime(f: number, duration: number): number {
  if (!Number.isFinite(f)) return 0;
  return Math.round(clamp(f, 0, 1) * duration * 10) / 10;
}

export function timeToFraction(t: number, duration: number): number {
  return duration > 0 ? clamp(t / duration, 0, 1) : 0;
}

/** ±15 s and friends, kept inside the episode. */
export function skipBy(pos: number, delta: number, duration: number): number {
  return clamp(pos + delta, 0, Math.max(0, duration - 0.5));
}

/** "Previous chapter": the start of this one, or the one before if we are within 3 s of its start. */
export function prevChapterSeek(chapters: Chapter[], pos: number, duration: number): number {
  const i = chapterIndexAt(chapters, pos);
  const target = pos - chapters[i].at < 3 && i > 0 ? i - 1 : i;
  return chapterSeek(chapters, target, duration);
}

export function nextChapterSeek(chapters: Chapter[], pos: number, duration: number): number | null {
  const i = chapterIndexAt(chapters, pos);
  return i + 1 < chapters.length ? chapterSeek(chapters, i + 1, duration) : null;
}

export const SPEEDS = [1, 1.25, 1.5] as const;
export type Speed = (typeof SPEEDS)[number];
export function asSpeed(v: unknown): Speed {
  return SPEEDS.includes(v as Speed) ? (v as Speed) : 1;
}
export function nextSpeed(s: Speed): Speed {
  return SPEEDS[(SPEEDS.indexOf(s) + 1) % SPEEDS.length];
}

// ---------- resume where you left off ----------

export type Progress = { pos: number; done: boolean };
export type ProgressMap = Record<string, Progress>;

/** Under this many seconds in, there is nothing worth resuming. */
export const RESUME_MIN = 10;
/** This close to the end counts as finished. */
export const DONE_WITHIN = 20;
/** Resume a little before where you stopped, to pick the thread up again. */
export const RESUME_BACK = 3;

/** Remember where an episode is (or that it is finished). Returns a new map. */
export function recordProgress(map: ProgressMap, id: string, pos: number, duration: number): ProgressMap {
  if (!Number.isFinite(pos) || duration <= 0) return map;
  const p = clamp(pos, 0, duration);
  const done = p >= duration - DONE_WITHIN;
  const was = map[id];
  if (!done && p < RESUME_MIN) {
    // Barely started (or rewound to the start): keep a finished mark, drop the rest.
    if (!was) return map;
    return { ...map, [id]: { pos: 0, done: was.done } };
  }
  return { ...map, [id]: { pos: done ? 0 : Math.round(p), done: done || Boolean(was?.done) } };
}

/** Where pressing play starts: a few seconds before the saved spot, or the top. */
export function resumeFrom(p: Progress | undefined, duration: number): number {
  if (!p || !Number.isFinite(p.pos)) return 0;
  if (p.pos < RESUME_MIN || p.pos >= duration - DONE_WITHIN) return 0;
  return Math.max(0, p.pos - RESUME_BACK);
}

// ---------- the simulated listener count ----------

const AUDIENCE: Record<ShowId, number> = {
  bihani: 940,
  bhajan: 520,
  geet: 760,
  calling: 610,
  katha: 430,
  diaspora: 820,
  sanjh: 880,
  dohori: 1460,
  request: 1180,
  mix: 260,
};

/** A made-up but steady listener count: same moment, same number. */
export function listenersAt(ms: number, show: ShowId): number {
  const slow = 1 + 0.1 * Math.sin(ms / (9 * 60_000)) + 0.05 * Math.sin(ms / (2.3 * 60_000));
  const bucket = Math.floor(ms / 5000);
  const jitter = (mulberry32(hash('ears', bucket))() - 0.5) * 0.03;
  return Math.max(12, Math.round(AUDIENCE[show] * (slow + jitter)));
}

// ---------- song requests and shout-outs (they stay on this device) ----------

export type ReqKind = 'song' | 'shout';
export type Req = { id: string; kind: ReqKind; name: string; town: string; tune: number | null; msg: string; at: number };

export const REQ_LIMITS = { name: 40, town: 40, msg: 200, keep: 12 } as const;

const tidy = (v: unknown, max: number) =>
  typeof v === 'string'
    ? v
        .replace(/[\u0000-\u001f\u007f]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, max)
    : '';

/** A request as typed → a clean one, or why not. A song request needs a tune; a shout-out needs a message. */
export function cleanRequest(
  input: { kind?: unknown; name?: unknown; town?: unknown; tune?: unknown; msg?: unknown },
  tunes: number,
  now: number
): { ok: true; req: Req } | { ok: false; error: 'tune' | 'msg' } {
  const kind: ReqKind = input.kind === 'shout' ? 'shout' : 'song';
  const tuneN = typeof input.tune === 'number' ? input.tune : typeof input.tune === 'string' && input.tune !== '' ? Number(input.tune) : NaN;
  const tune = Number.isInteger(tuneN) && tuneN >= 0 && tuneN < tunes ? tuneN : null;
  const msg = tidy(input.msg, REQ_LIMITS.msg);
  if (kind === 'song' && tune === null) return { ok: false, error: 'tune' };
  if (kind === 'shout' && !msg) return { ok: false, error: 'msg' };
  return {
    ok: true,
    req: {
      id: `r${now.toString(36)}`,
      kind,
      name: tidy(input.name, REQ_LIMITS.name),
      town: tidy(input.town, REQ_LIMITS.town),
      tune: kind === 'song' ? tune : null,
      msg,
      at: now,
    },
  };
}

/** Newest first, a dozen at most. */
export function addRequest(list: Req[], req: Req): Req[] {
  return [req, ...list.filter((r) => r.id !== req.id)].slice(0, REQ_LIMITS.keep);
}

// ---------- the one localStorage key ----------

export const STORE_KEY = 'mn-demo:radio';

export type Saved = { v: 1; vol: number; progress: ProgressMap; reqs: Req[]; remind: ShowId[]; speed: Speed };

export function emptySaved(): Saved {
  return { v: 1, vol: 0.8, progress: {}, reqs: [], remind: [], speed: 1 };
}

const SHOW_IDS: ShowId[] = ['bihani', 'bhajan', 'geet', 'calling', 'katha', 'diaspora', 'sanjh', 'dohori', 'request', 'mix'];
export function isShow(v: unknown): v is ShowId {
  return SHOW_IDS.includes(v as ShowId);
}

/** Whatever came back from localStorage → a valid state (anything odd is dropped). */
export function cleanSaved(raw: unknown, episodeIds: string[], tunes: number): Saved {
  const out = emptySaved();
  if (!raw || typeof raw !== 'object') return out;
  const o = raw as Record<string, unknown>;
  if (typeof o.vol === 'number' && Number.isFinite(o.vol)) out.vol = clamp(o.vol, 0, 1);
  out.speed = asSpeed(o.speed);
  if (o.progress && typeof o.progress === 'object') {
    for (const [id, p] of Object.entries(o.progress as Record<string, unknown>)) {
      if (!episodeIds.includes(id) || !p || typeof p !== 'object') continue;
      const q = p as Record<string, unknown>;
      const pos = typeof q.pos === 'number' && Number.isFinite(q.pos) ? Math.max(0, Math.round(q.pos)) : 0;
      out.progress[id] = { pos, done: q.done === true };
    }
  }
  if (Array.isArray(o.reqs)) {
    for (const r of o.reqs.slice(0, REQ_LIMITS.keep)) {
      if (!r || typeof r !== 'object') continue;
      const q = r as Record<string, unknown>;
      const at = typeof q.at === 'number' && Number.isFinite(q.at) ? q.at : 0;
      const c = cleanRequest(q, tunes, at);
      if (c.ok) out.reqs.push({ ...c.req, id: typeof q.id === 'string' ? q.id.slice(0, 24) : c.req.id });
    }
  }
  if (Array.isArray(o.remind)) out.remind = [...new Set(o.remind.filter(isShow))].filter((s) => s !== FILLER);
  return out;
}
