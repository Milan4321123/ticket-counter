// The rules behind "Yatri Treks" (/work/trek), a made-up trek & trip planner
// for a made-up Nepal travel agency — no React, no words (those live in
// content.ts), so tests/trekPlanner.test.ts can check every rule without a
// browser.
//
// - Places (STOPS): latitude / longitude / sleeping altitude, region, the
//   usual kind of bed. Altitudes are the commonly quoted round figures (they
//   differ by 10–50 m between sources).
// - Ready trips (TRIPS): day lists. A day carries its own walking figures
//   only while the day before it is still the stop it was written for
//   (`from`); move a day and its figures are estimated from the map instead.
// - The altitude rule (altitudeWarnings) — general guidance, not medical
//   advice: above 3,000 m, (1) don't sleep more than 500 m higher than the
//   night before (counting from 3,000 m) and (2) take a rest day — a night no
//   higher than the one before — at least every third night.
// - Season scores per region, festivals, the packing list, permits (named
//   generically: no fees, no amounts), the map projection and the drawn
//   outline, the .ics calendar file, and what comes back from localStorage.
//
// No prices, fees or costs anywhere: the studio is run by a student and is
// free while it grows.

export type Lang = 'en' | 'de' | 'ne';
export type L = Record<Lang, string>;

export type Region = 'everest' | 'annapurna' | 'langtang' | 'lowland' | 'mustang' | 'rara';
export const REGIONS: Region[] = ['everest', 'annapurna', 'langtang', 'mustang', 'rara', 'lowland'];
export type Lodge = 'hotel' | 'teahouse' | 'homestay' | 'lodge';
export const LODGES: Lodge[] = ['hotel', 'teahouse', 'homestay', 'lodge'];
/** arrive = first day; walk / drive / fly = on the move; rest = a rest or acclimatisation day on a trek; visit = a day in town. */
export type Mode = 'arrive' | 'walk' | 'drive' | 'fly' | 'rest' | 'visit';
/** city / trail = places to sleep; view = a viewpoint or a site you visit and leave (Kala Patthar, Poon Hill, base camp). */
export type StopKind = 'city' | 'trail' | 'view';

export type Stop = {
  lat: number;
  lon: number;
  /** Sleeping (or standing) altitude in metres. */
  alt: number;
  region: Region;
  kind: StopKind;
  lodge: Lodge;
  /** 1 = labelled at every zoom, 2 = from zoom 2.2, 3 = from zoom 4. */
  pri: 1 | 2 | 3;
  /** Has an airport or airstrip nearby. */
  air?: boolean;
  /** No road: reached on foot or by air only. */
  noRoad?: boolean;
};

export const STOPS = {
  // Kathmandu valley, the lowlands, Pokhara
  ktm: { lat: 27.7172, lon: 85.324, alt: 1400, region: 'lowland', kind: 'city', lodge: 'hotel', pri: 1, air: true },
  pkr: { lat: 28.2096, lon: 83.9856, alt: 820, region: 'lowland', kind: 'city', lodge: 'hotel', pri: 1, air: true },
  chitwan: { lat: 27.5786, lon: 84.496, alt: 150, region: 'lowland', kind: 'city', lodge: 'lodge', pri: 1, air: true },
  lumbini: { lat: 27.484, lon: 83.276, alt: 100, region: 'lowland', kind: 'city', lodge: 'hotel', pri: 1, air: true },
  tilaurakot: { lat: 27.5747, lon: 83.0558, alt: 110, region: 'lowland', kind: 'view', lodge: 'hotel', pri: 3 },
  // Everest (Khumbu)
  lukla: { lat: 27.6866, lon: 86.7314, alt: 2860, region: 'everest', kind: 'trail', lodge: 'teahouse', pri: 1, air: true, noRoad: true },
  phakding: { lat: 27.7397, lon: 86.7128, alt: 2610, region: 'everest', kind: 'trail', lodge: 'teahouse', pri: 3, noRoad: true },
  namche: { lat: 27.8047, lon: 86.7139, alt: 3440, region: 'everest', kind: 'trail', lodge: 'teahouse', pri: 2, noRoad: true },
  tengboche: { lat: 27.8361, lon: 86.7644, alt: 3860, region: 'everest', kind: 'trail', lodge: 'teahouse', pri: 3, noRoad: true },
  dingboche: { lat: 27.8923, lon: 86.8314, alt: 4410, region: 'everest', kind: 'trail', lodge: 'teahouse', pri: 3, noRoad: true },
  pheriche: { lat: 27.895, lon: 86.8194, alt: 4240, region: 'everest', kind: 'trail', lodge: 'teahouse', pri: 3, noRoad: true },
  lobuche: { lat: 27.9483, lon: 86.81, alt: 4910, region: 'everest', kind: 'trail', lodge: 'teahouse', pri: 3, noRoad: true },
  gorakshep: { lat: 27.9806, lon: 86.8289, alt: 5160, region: 'everest', kind: 'trail', lodge: 'teahouse', pri: 3, noRoad: true },
  ebc: { lat: 28.0026, lon: 86.8528, alt: 5364, region: 'everest', kind: 'view', lodge: 'teahouse', pri: 1, noRoad: true },
  kalapatthar: { lat: 27.9957, lon: 86.8285, alt: 5644, region: 'everest', kind: 'view', lodge: 'teahouse', pri: 3, noRoad: true },
  // Annapurna: Poon Hill and the sanctuary
  tikhedhunga: { lat: 28.3615, lon: 83.7362, alt: 1540, region: 'annapurna', kind: 'trail', lodge: 'teahouse', pri: 3 },
  ghorepani: { lat: 28.4008, lon: 83.7006, alt: 2860, region: 'annapurna', kind: 'trail', lodge: 'teahouse', pri: 3, noRoad: true },
  poonhill: { lat: 28.4003, lon: 83.6934, alt: 3210, region: 'annapurna', kind: 'view', lodge: 'teahouse', pri: 1, noRoad: true },
  tadapani: { lat: 28.3925, lon: 83.7655, alt: 2630, region: 'annapurna', kind: 'trail', lodge: 'teahouse', pri: 3, noRoad: true },
  ghandruk: { lat: 28.3758, lon: 83.8077, alt: 1940, region: 'annapurna', kind: 'trail', lodge: 'teahouse', pri: 2 },
  chhomrong: { lat: 28.417, lon: 83.819, alt: 2170, region: 'annapurna', kind: 'trail', lodge: 'teahouse', pri: 3, noRoad: true },
  jhinu: { lat: 28.403, lon: 83.827, alt: 1780, region: 'annapurna', kind: 'trail', lodge: 'teahouse', pri: 3 },
  bamboo: { lat: 28.458, lon: 83.852, alt: 2310, region: 'annapurna', kind: 'trail', lodge: 'teahouse', pri: 3, noRoad: true },
  deurali: { lat: 28.49, lon: 83.87, alt: 3230, region: 'annapurna', kind: 'trail', lodge: 'teahouse', pri: 3, noRoad: true },
  mbc: { lat: 28.505, lon: 83.879, alt: 3700, region: 'annapurna', kind: 'trail', lodge: 'teahouse', pri: 3, noRoad: true },
  abc: { lat: 28.53, lon: 83.878, alt: 4130, region: 'annapurna', kind: 'trail', lodge: 'teahouse', pri: 1, noRoad: true },
  dhampus: { lat: 28.3089, lon: 83.8476, alt: 1650, region: 'annapurna', kind: 'trail', lodge: 'homestay', pri: 3 },
  // Langtang
  syabrubesi: { lat: 28.161, lon: 85.34, alt: 1460, region: 'langtang', kind: 'trail', lodge: 'teahouse', pri: 3 },
  lamahotel: { lat: 28.163, lon: 85.433, alt: 2470, region: 'langtang', kind: 'trail', lodge: 'teahouse', pri: 3, noRoad: true },
  langtang: { lat: 28.2147, lon: 85.5206, alt: 3430, region: 'langtang', kind: 'trail', lodge: 'teahouse', pri: 2, noRoad: true },
  kyanjin: { lat: 28.2117, lon: 85.5631, alt: 3870, region: 'langtang', kind: 'trail', lodge: 'teahouse', pri: 1, noRoad: true },
  kyanjinri: { lat: 28.229, lon: 85.571, alt: 4773, region: 'langtang', kind: 'view', lodge: 'teahouse', pri: 3, noRoad: true },
  // Mustang and the far west
  jomsom: { lat: 28.7819, lon: 83.723, alt: 2720, region: 'mustang', kind: 'trail', lodge: 'teahouse', pri: 2, air: true },
  lomanthang: { lat: 29.183, lon: 83.958, alt: 3840, region: 'mustang', kind: 'trail', lodge: 'teahouse', pri: 1 },
  rara: { lat: 29.531, lon: 82.088, alt: 2990, region: 'rara', kind: 'trail', lodge: 'teahouse', pri: 1, air: true },
} satisfies Record<string, Stop>;

export type StopId = keyof typeof STOPS;
export const STOP_IDS = Object.keys(STOPS) as StopId[];
export function stopOf(id: StopId): Stop {
  return STOPS[id];
}
export function isStop(v: unknown): v is StopId {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(STOPS, v);
}
/** The places a visitor can add as a night in "build your own" (not the viewpoints). */
export const ADDABLE: StopId[] = STOP_IDS.filter((id) => STOPS[id].kind !== 'view');

/** Big mountains drawn on the map (names in content.ts). */
export const PEAKS = [
  { id: 'everest', lat: 27.9881, lon: 86.925 },
  { id: 'kangchenjunga', lat: 27.7025, lon: 88.1475 },
  { id: 'makalu', lat: 27.8897, lon: 87.0889 },
  { id: 'choOyu', lat: 28.0942, lon: 86.6608 },
  { id: 'dhaulagiri', lat: 28.6983, lon: 83.4875 },
  { id: 'manaslu', lat: 28.5497, lon: 84.5597 },
  { id: 'annapurna', lat: 28.5961, lon: 83.8203 },
  { id: 'machapuchare', lat: 28.495, lon: 83.949 },
  { id: 'langtangLirung', lat: 28.2561, lon: 85.5189 },
] as const;
export type PeakId = (typeof PEAKS)[number]['id'];

// ---------------------------------------------------------------- the map

/** Pixels per degree of latitude in the map's own units (the SVG viewBox). */
export const PX_PER_DEG = 110;
const LAT0 = 30.55;
const LON0 = 79.95;
/** Longitude degrees shrink with cos(latitude); Nepal sits around 28.3° N. */
const KX = Math.cos((28.3 * Math.PI) / 180);
export const MAP_W = 808;
export const MAP_H = 476;

/** latitude / longitude → x / y in the map's units (an equirectangular projection, scaled for 28.3° N). */
export function project(lat: number, lon: number): { x: number; y: number } {
  return { x: round2((lon - LON0) * PX_PER_DEG * KX), y: round2((LAT0 - lat) * PX_PER_DEG) };
}
export function projectStop(id: StopId): { x: number; y: number } {
  const s = STOPS[id];
  return project(s.lat, s.lon);
}

/**
 * Nepal, drawn by hand from ~70 border points (lon, lat), clockwise from the
 * far-west tip on the Mahakali: along the Himalaya to Kangchenjunga, down the
 * Singalila ridge and the Mechi, then west along the plains. Simplified — a
 * picture, not a survey.
 */
// prettier-ignore
export const NORTH_BORDER: [number, number][] = [
  [80.06, 29.03], [80.25, 29.43], [80.37, 29.62], [80.54, 29.86], [80.83, 30.1], [81.1, 30.2], [81.3, 30.18], [81.52, 30.42],
  [81.98, 30.26], [82.33, 30.12], [82.7, 29.85], [83.1, 29.62], [83.34, 29.47], [83.55, 29.21], [83.72, 29.25], [83.9, 29.33],
  [84.1, 29.27], [84.23, 28.95], [84.45, 28.75], [84.7, 28.62], [85.01, 28.64], [85.16, 28.52], [85.38, 28.28], [85.62, 28.34],
  [85.8, 28.24], [85.96, 27.97], [86.12, 28.08], [86.33, 27.95], [86.55, 28.1], [86.66, 28.094], [86.828, 28.016], [86.875, 28.012],
  [86.925, 27.988], [87.09, 27.89], [87.4, 27.93], [87.75, 27.83], [88.02, 27.9], [88.13, 27.87],
];
// prettier-ignore
export const EAST_BORDER: [number, number][] = [
  [88.147, 27.7], [88.05, 27.45], [88.0, 27.12], [88.1, 26.88], [88.17, 26.66], [88.1, 26.37],
];
/** East → west. */
// prettier-ignore
export const SOUTH_BORDER: [number, number][] = [
  [87.7, 26.4], [87.27, 26.36], [86.75, 26.45], [86.3, 26.62], [85.92, 26.62], [85.6, 26.84], [85.25, 26.75], [84.95, 26.97],
  [84.65, 27.08], [84.3, 27.38], [84.05, 27.45], [83.75, 27.43], [83.46, 27.46], [83.2, 27.4], [82.95, 27.47], [82.72, 27.58],
  [82.45, 27.68], [82.05, 27.86], [81.62, 28.02], [81.3, 28.15], [81.05, 28.42], [80.62, 28.62], [80.25, 28.82],
];
export const OUTLINE: [number, number][] = [...NORTH_BORDER, ...EAST_BORDER, ...SOUTH_BORDER];

/** The main Himalayan crest, west → east, through the big peaks (lon, lat). */
// prettier-ignore
export const CREST: [number, number][] = [
  [80.6, 29.95], [80.93, 29.92], [81.48, 29.89], [82.1, 29.72], [82.6, 29.38], [83.1, 29.0], [83.49, 28.7], [83.82, 28.6],
  [84.2, 28.62], [84.56, 28.55], [85.07, 28.39], [85.52, 28.26], [85.77, 28.17], [86.05, 27.95], [86.33, 27.95], [86.66, 28.04],
  [86.93, 27.96], [87.09, 27.89], [87.5, 27.8], [88.15, 27.7],
];

/** Ray casting against OUTLINE. */
export function insideNepal(lat: number, lon: number): boolean {
  let inside = false;
  const pts = OUTLINE;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function pathOf(pts: [number, number][], close = true): string {
  return (
    pts
      .map(([lon, lat], i) => {
        const p = project(lat, lon);
        return `${i ? 'L' : 'M'}${p.x} ${p.y}`;
      })
      .join('') + (close ? 'Z' : '')
  );
}
export function outlinePath(): string {
  return pathOf(OUTLINE);
}

/** Piecewise-linear latitude of a (lon, lat) line at a longitude (clamped at the ends). */
export function latAt(line: [number, number][], lon: number): number {
  const pts = line[0][0] <= line[line.length - 1][0] ? line : [...line].reverse();
  if (lon <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (lon <= pts[i][0]) {
      const [x0, y0] = pts[i - 1];
      const [x1, y1] = pts[i];
      return y0 + ((y1 - y0) * (lon - x0)) / (x1 - x0 || 1);
    }
  }
  return pts[pts.length - 1][1];
}

/**
 * Relief bands, each a closed path (clip it to the outline): the Terai along
 * the southern border, the snowy crest, the dry trans-Himalaya north of it
 * (Mustang, Dolpo) and the middle hills between. `lo` / `hi` give each edge
 * as a latitude for a longitude.
 */
function bandPath(lo: (lon: number) => number, hi: (lon: number) => number): string {
  const xs: number[] = [];
  for (let lon = 79.9; lon <= 88.4; lon += 0.1) xs.push(Math.round(lon * 100) / 100);
  const top: [number, number][] = xs.map((lon) => [lon, hi(lon)]);
  const bottom: [number, number][] = [...xs].reverse().map((lon) => [lon, lo(lon)]);
  return pathOf([...top, ...bottom]);
}
export function reliefBands(): {
  terai: string;
  hills: string;
  snow: string;
  trans: string;
} {
  const south = (lon: number) => latAt(SOUTH_BORDER, lon);
  const crest = (lon: number) => latAt(CREST, lon);
  return {
    terai: bandPath(
      (lon) => south(lon) - 0.5,
      (lon) => south(lon) + 0.3,
    ),
    hills: bandPath(
      (lon) => crest(lon) - 0.62,
      (lon) => crest(lon) - 0.2,
    ),
    snow: bandPath(
      (lon) => crest(lon) - 0.2,
      (lon) => crest(lon) + 0.12,
    ),
    trans: bandPath(
      (lon) => crest(lon) + 0.12,
      () => 31,
    ),
  };
}

/** Little drawn mountains along the crest: deterministic, so server and browser agree. */
export function ridgeGlyphs(): { x: number; y: number; s: number }[] {
  const out: { x: number; y: number; s: number }[] = [];
  let k = 0;
  for (let lon = 80.7; lon <= 88.05; lon += 0.16) {
    const jitter = ((hash(`r${k}`) % 100) / 100 - 0.5) * 0.16;
    const lat = latAt(CREST, lon) + jitter;
    if (insideNepal(lat, lon)) {
      const p = project(lat, lon);
      out.push({ x: p.x, y: p.y, s: 5 + (hash(`s${k}`) % 5) });
    }
    k++;
  }
  return out;
}

export function distanceKm(a: StopId, b: StopId): number {
  const A = STOPS[a];
  const B = STOPS[b];
  const R = 6371;
  const dLat = ((B.lat - A.lat) * Math.PI) / 180;
  const dLon = ((B.lon - A.lon) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((A.lat * Math.PI) / 180) * Math.cos((B.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** A view box (in map units) for a zoom level and centre, clamped so the map never leaves the frame. */
export type View = { cx: number; cy: number; z: number };
export const Z_MIN = 1;
export const Z_MAX = 12;
export function clampView(v: View): View {
  const z = Math.min(Z_MAX, Math.max(Z_MIN, v.z));
  const w = MAP_W / z;
  const h = MAP_H / z;
  const cx = Math.min(MAP_W - w / 2, Math.max(w / 2, v.cx));
  const cy = Math.min(MAP_H - h / 2, Math.max(h / 2, v.cy));
  return { cx: round2(cx), cy: round2(cy), z: Math.round(z * 1000) / 1000 };
}
export function viewBox(v: View): string {
  const w = MAP_W / v.z;
  const h = MAP_H / v.z;
  return `${round2(v.cx - w / 2)} ${round2(v.cy - h / 2)} ${round2(w)} ${round2(h)}`;
}
export const HOME_VIEW: View = { cx: MAP_W / 2, cy: MAP_H / 2, z: 1 };
/** Zoom by `f` keeping the map point (px, py) under the same spot of the frame. */
export function zoomAt(v: View, f: number, px: number, py: number): View {
  const z = Math.min(Z_MAX, Math.max(Z_MIN, v.z * f));
  const k = v.z / z;
  return clampView({ cx: px + (v.cx - px) * k, cy: py + (v.cy - py) * k, z });
}
/** Pan by a fraction of the visible width / height. */
export function panBy(v: View, fx: number, fy: number): View {
  return clampView({
    cx: v.cx + (fx * MAP_W) / v.z,
    cy: v.cy + (fy * MAP_H) / v.z,
    z: v.z,
  });
}
/** The view that fits these stops (with room around them). */
export function fitView(ids: StopId[]): View {
  if (!ids.length) return HOME_VIEW;
  const ps = ids.map(projectStop);
  const xs = ps.map((p) => p.x);
  const ys = ps.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const w = Math.max(maxX - minX, 24) * 1.5;
  const h = Math.max(maxY - minY, 16) * 1.6;
  const z = Math.min(MAP_W / w, MAP_H / h, 9);
  return clampView({ cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, z });
}

// ---------------------------------------------------------------- days and trips

export type Day = {
  /** Stable key for lists and drag. */
  k: string;
  /** Where you sleep. */
  stop: StopId;
  /** The stop the day was written to start from (null = the first day). Its figures count only while that is still true. */
  from?: StopId | null;
  mode?: Mode;
  /** Kilometres on the move (on foot, by road or the air distance for a flight). */
  km?: number;
  /** Hours walking (walk / rest days) or travelling (drive / fly). */
  h?: number;
  /** Highest point of the day in metres. */
  top?: number;
  /** A place passed on the way (drawn in the route), e.g. Lukla on the way to Phakding. */
  via?: StopId;
  /** A viewpoint visited and left (drawn as a dashed spur), e.g. base camp from Gorakshep. */
  side?: StopId;
  /** Highlight key (content.ts → HL). */
  hl?: string;
  lodge?: Lodge;
};

export type TripId = 'ebc' | 'abc' | 'poon' | 'langtang' | 'family' | 'lumbini';
export const TRIP_IDS: TripId[] = ['ebc', 'abc', 'poon', 'langtang', 'family', 'lumbini'];
export function isTripId(v: unknown): v is TripId {
  return typeof v === 'string' && (TRIP_IDS as string[]).includes(v);
}

type Raw = Omit<Day, 'k'>;
const w = (stop: StopId, from: StopId | null, km: number, h: number, hl: string, more: Partial<Raw> = {}): Raw => ({ stop, from, mode: 'walk', km, h, hl, ...more });

const RAW: Record<TripId, Raw[]> = {
  ebc: [
    { stop: 'ktm', from: null, mode: 'arrive', km: 0, h: 0, hl: 'ebc1' },
    w('phakding', 'ktm', 8, 3, 'ebc2', { via: 'lukla', top: 2860 }),
    w('namche', 'phakding', 11, 6, 'ebc3'),
    { stop: 'namche', from: 'namche', mode: 'rest', km: 5, h: 3, top: 3880, hl: 'ebc4' },
    w('tengboche', 'namche', 10, 5.5, 'ebc5'),
    w('dingboche', 'tengboche', 11, 5, 'ebc6'),
    { stop: 'dingboche', from: 'dingboche', mode: 'rest', km: 5, h: 4, top: 5083, hl: 'ebc7' },
    w('lobuche', 'dingboche', 8, 5, 'ebc8'),
    w('gorakshep', 'lobuche', 15, 7, 'ebc9', { side: 'ebc', top: 5364 }),
    w('pheriche', 'gorakshep', 14, 7, 'ebc10', { side: 'kalapatthar', top: 5644 }),
    w('namche', 'pheriche', 20, 7, 'ebc11'),
    w('lukla', 'namche', 19, 7, 'ebc12'),
    { stop: 'ktm', from: 'lukla', mode: 'fly', km: 136, h: 0.5, hl: 'ebc13', lodge: 'hotel' },
    { stop: 'ktm', from: 'ktm', mode: 'visit', km: 0, h: 0, hl: 'ebc14' },
  ],
  abc: [
    { stop: 'pkr', from: null, mode: 'arrive', km: 0, h: 0, hl: 'abc1' },
    w('ghandruk', 'pkr', 9, 4, 'abc2'),
    w('chhomrong', 'ghandruk', 9, 5, 'abc3'),
    w('bamboo', 'chhomrong', 8, 5, 'abc4'),
    w('deurali', 'bamboo', 9, 5, 'abc5'),
    w('mbc', 'deurali', 5, 3, 'abc6'),
    w('bamboo', 'mbc', 17, 8, 'abc7', { side: 'abc', top: 4130 }),
    w('jhinu', 'bamboo', 11, 6, 'abc8'),
    w('pkr', 'jhinu', 6, 2.5, 'abc9'),
    { stop: 'ktm', from: 'pkr', mode: 'fly', km: 145, h: 0.5, hl: 'abc10' },
  ],
  poon: [
    w('tikhedhunga', null, 9, 4, 'poon1', { via: 'pkr' }),
    w('ghorepani', 'tikhedhunga', 10, 6, 'poon2'),
    w('tadapani', 'ghorepani', 12, 7, 'poon3', { side: 'poonhill', top: 3210 }),
    w('ghandruk', 'tadapani', 7, 3, 'poon4'),
    w('pkr', 'ghandruk', 8, 3, 'poon5'),
  ],
  langtang: [
    { stop: 'syabrubesi', from: null, mode: 'drive', km: 122, h: 7, via: 'ktm', hl: 'lt1' },
    w('lamahotel', 'syabrubesi', 11, 6, 'lt2'),
    w('langtang', 'lamahotel', 14, 6, 'lt3'),
    w('kyanjin', 'langtang', 7, 3.5, 'lt4'),
    { stop: 'kyanjin', from: 'kyanjin', mode: 'rest', km: 6, h: 5, top: 4773, side: 'kyanjinri', hl: 'lt5' },
    w('lamahotel', 'kyanjin', 21, 7, 'lt6'),
    w('syabrubesi', 'lamahotel', 11, 4.5, 'lt7'),
    { stop: 'ktm', from: 'syabrubesi', mode: 'drive', km: 122, h: 7, hl: 'lt8' },
  ],
  family: [
    { stop: 'ktm', from: null, mode: 'arrive', km: 0, h: 0, hl: 'fam1', lodge: 'homestay' },
    { stop: 'ktm', from: 'ktm', mode: 'visit', km: 0, h: 0, hl: 'fam2', lodge: 'homestay' },
    { stop: 'ktm', from: 'ktm', mode: 'visit', km: 0, h: 0, hl: 'fam3', lodge: 'homestay' },
    { stop: 'chitwan', from: 'ktm', mode: 'drive', km: 165, h: 5.5, hl: 'fam4' },
    { stop: 'chitwan', from: 'chitwan', mode: 'visit', km: 0, h: 0, hl: 'fam5' },
    { stop: 'pkr', from: 'chitwan', mode: 'drive', km: 150, h: 5, hl: 'fam6' },
    { stop: 'pkr', from: 'pkr', mode: 'visit', km: 0, h: 0, hl: 'fam7' },
    w('dhampus', 'pkr', 5, 2, 'fam8'),
    w('pkr', 'dhampus', 5, 2, 'fam9'),
    { stop: 'ktm', from: 'pkr', mode: 'fly', km: 145, h: 0.5, hl: 'fam10', lodge: 'homestay' },
    { stop: 'ktm', from: 'ktm', mode: 'visit', km: 0, h: 0, hl: 'fam11', lodge: 'homestay' },
    { stop: 'ktm', from: 'ktm', mode: 'visit', km: 0, h: 0, hl: 'fam12', lodge: 'homestay' },
  ],
  lumbini: [
    { stop: 'ktm', from: null, mode: 'arrive', km: 0, h: 0, hl: 'lum1' },
    { stop: 'ktm', from: 'ktm', mode: 'visit', km: 0, h: 0, hl: 'lum2' },
    { stop: 'lumbini', from: 'ktm', mode: 'fly', km: 200, h: 1.5, hl: 'lum3' },
    { stop: 'lumbini', from: 'lumbini', mode: 'visit', km: 0, h: 0, hl: 'lum4' },
    { stop: 'lumbini', from: 'lumbini', mode: 'visit', km: 50, h: 0, side: 'tilaurakot', hl: 'lum5' },
    { stop: 'ktm', from: 'lumbini', mode: 'fly', km: 200, h: 1.5, hl: 'lum6' },
  ],
};

/** A ready trip as days with keys (`t-ebc-3`). */
export function tripDays(id: TripId): Day[] {
  return RAW[id].map((d, i) => ({ ...d, k: `t-${id}-${i}` }));
}

export type DayInfo = {
  stop: StopId;
  prev: StopId | null;
  mode: Mode;
  km: number;
  h: number;
  /** Sleeping altitude. */
  sleep: number;
  /** Highest point of the day. */
  top: number;
  /** Sleeping altitude minus the night before (0 on the first day). */
  gain: number;
  lodge: Lodge;
  via?: StopId;
  side?: StopId;
  hl?: string;
  /** true = the trip's own figures; false = estimated from the map (the day was moved or added). */
  authored: boolean;
};

const half = (n: number) => Math.max(0.5, Math.round(n * 2) / 2);

/** How a day between two stops is travelled, and roughly how far and how long — when no one wrote it down. */
export function estimateLeg(prev: StopId, stop: StopId): { mode: Mode; km: number; h: number; top: number } {
  const A: Stop = STOPS[prev];
  const B: Stop = STOPS[stop];
  if (prev === stop) return { mode: B.alt >= 2500 ? 'rest' : 'visit', km: 0, h: 0, top: B.alt };
  const d = distanceKm(prev, stop);
  const top = Math.max(A.alt, B.alt);
  const trail = A.kind !== 'city' && B.kind !== 'city' && A.region === B.region && d < 30;
  if (trail) {
    const km = Math.round(d * 1.6);
    const up = Math.max(0, B.alt - A.alt);
    const down = Math.max(0, A.alt - B.alt);
    return { mode: 'walk', km, h: half(km / 3 + up / 400 + down / 800), top };
  }
  const fly = (B.noRoad && B.air && A.air) || (A.noRoad && A.air && B.air) || (A.air && B.air && d > 150);
  if (fly) return { mode: 'fly', km: Math.round(d), h: d > 160 ? 1 : 0.5, top };
  if (A.noRoad || B.noRoad) {
    // On foot to (or from) somewhere without a road, from the nearest road.
    const km = Math.round(Math.min(d, 40) * 1.6);
    return {
      mode: 'walk',
      km,
      h: half(km / 3 + Math.max(0, B.alt - A.alt) / 400),
      top,
    };
  }
  const km = Math.round(d * 1.5);
  return { mode: 'drive', km, h: half(km / 28), top };
}

export function dayInfo(days: Day[], i: number): DayInfo {
  const d = days[i];
  const s = STOPS[d.stop];
  const prev = i > 0 ? days[i - 1].stop : null;
  const prevSleep = i > 0 ? STOPS[days[i - 1].stop].alt : s.alt;
  const authored = d.from !== undefined && d.from === prev;
  const lodge = d.lodge ?? s.lodge;
  if (authored) {
    return {
      stop: d.stop,
      prev,
      mode: d.mode ?? 'walk',
      km: d.km ?? 0,
      h: d.h ?? 0,
      sleep: s.alt,
      top: Math.max(d.top ?? 0, s.alt, d.mode === 'walk' ? prevSleep : 0),
      gain: i > 0 ? s.alt - prevSleep : 0,
      lodge,
      via: d.via,
      side: d.side,
      hl: d.hl,
      authored: true,
    };
  }
  if (prev === null) {
    return { stop: d.stop, prev, mode: 'arrive', km: 0, h: 0, sleep: s.alt, top: s.alt, gain: 0, lodge, authored: false, hl: undefined };
  }
  const e = estimateLeg(prev, d.stop);
  // A moved day keeps its side trip only if it is still at the same place it was written for.
  const keepsSide = d.side && d.stop === (d.from ?? d.stop) ? d.side : undefined;
  return { stop: d.stop, prev, mode: e.mode, km: e.km, h: e.h, sleep: s.alt, top: e.top, gain: s.alt - prevSleep, lodge, side: keepsSide, authored: false };
}

export function dayInfos(days: Day[]): DayInfo[] {
  return days.map((_, i) => dayInfo(days, i));
}

export type Totals = {
  days: number;
  walkDays: number;
  restDays: number;
  walkKm: number;
  walkH: number;
  roadKm: number;
  flights: number;
  maxSleep: number;
  maxTop: number;
  nights: Record<Lodge, number>;
  regions: Record<Region, number>;
};

/** What the itinerary adds up to. The last day counts as a night too (you sleep there before going on). */
export function totals(days: Day[]): Totals {
  const infos = dayInfos(days);
  const nights = Object.fromEntries(LODGES.map((l) => [l, 0])) as Record<Lodge, number>;
  const regions = Object.fromEntries(REGIONS.map((r) => [r, 0])) as Record<Region, number>;
  const t: Totals = { days: days.length, walkDays: 0, restDays: 0, walkKm: 0, walkH: 0, roadKm: 0, flights: 0, maxSleep: 0, maxTop: 0, nights, regions };
  for (const x of infos) {
    if (x.mode === 'walk') {
      t.walkDays++;
      t.walkKm += x.km;
      t.walkH += x.h;
    }
    if (x.mode === 'rest') {
      t.restDays++;
      t.walkKm += x.km;
      t.walkH += x.h;
    }
    if (x.mode === 'drive') t.roadKm += x.km;
    if (x.mode === 'fly') t.flights++;
    t.maxSleep = Math.max(t.maxSleep, x.sleep);
    t.maxTop = Math.max(t.maxTop, x.top);
    nights[x.lodge]++;
    regions[STOPS[x.stop].region]++;
  }
  t.walkH = Math.round(t.walkH * 10) / 10;
  return t;
}

// ---------------------------------------------------------------- the altitude rule

/** Above this sleeping altitude the rule applies. */
export const ALT_LINE = 3000;
/** Most a night may be higher than the one before, counted from ALT_LINE. */
export const MAX_GAIN = 500;
/** Climbing nights in a row above ALT_LINE before a rest day is due (the next one is flagged). */
export const MAX_CLIMBS = 2;

export type Warning = { day: number; kind: 'gain'; gain: number; eased: boolean } | { day: number; kind: 'rest'; streak: number };

/**
 * General guidance, not medical advice:
 *  - gain: sleeping above 3,000 m more than 500 m higher than the night
 *    before (the part below 3,000 m does not count). `eased` = the next night
 *    is no higher, so a rest day follows.
 *  - rest: the third (or later) night in a row that sleeps higher, above
 *    3,000 m, with no rest day (a night no higher than the one before) in
 *    between.
 * The first day counts from sea level.
 */
export function altitudeWarnings(days: Day[]): Warning[] {
  const out: Warning[] = [];
  let streak = 0;
  for (let i = 0; i < days.length; i++) {
    const sleep = STOPS[days[i].stop].alt;
    const before = i > 0 ? STOPS[days[i - 1].stop].alt : 0;
    if (sleep > ALT_LINE) {
      const gain = sleep - Math.max(before, ALT_LINE);
      if (gain > MAX_GAIN) {
        const next = i + 1 < days.length ? STOPS[days[i + 1].stop].alt : null;
        out.push({ day: i, kind: 'gain', gain, eased: next !== null && next <= sleep });
      }
    }
    const climbing = sleep > ALT_LINE && sleep > before;
    streak = climbing ? streak + 1 : 0;
    if (streak > MAX_CLIMBS) out.push({ day: i, kind: 'rest', streak });
  }
  return out;
}

// ---------------------------------------------------------------- editing the list

/** Move one day from `from` to `to` (both indices in the list). Out-of-range moves change nothing. */
export function moveDay(days: Day[], from: number, to: number): Day[] {
  if (from === to || from < 0 || to < 0 || from >= days.length || to >= days.length) return days;
  const out = days.slice();
  const [d] = out.splice(from, 1);
  out.splice(to, 0, d);
  return out;
}
export function removeDay(days: Day[], i: number): Day[] {
  if (i < 0 || i >= days.length || days.length <= 1) return days;
  return days.filter((_, j) => j !== i);
}
export const MAX_DAYS = 30;
export function addStop(days: Day[], stop: StopId, k: string, at = days.length): Day[] {
  if (days.length >= MAX_DAYS || !isStop(stop) || STOPS[stop].kind === 'view') return days;
  const out = days.slice();
  out.splice(Math.max(0, Math.min(at, days.length)), 0, { k, stop });
  return out;
}
/** Another night at the same place, straight after day i. */
export function addRestAfter(days: Day[], i: number, k: string): Day[] {
  if (i < 0 || i >= days.length) return days;
  return addStop(days, days[i].stop, k, i + 1);
}

// ---------------------------------------------------------------- seasons and festivals

/** Trekking / travel conditions per month (Jan … Dec): 0 poor, 1 fair, 2 good, 3 best. */
export const SEASON: Record<Region, number[]> = {
  //          J  F  M  A  M  J  J  A  S  O  N  D
  everest: [1, 1, 2, 3, 3, 0, 0, 0, 1, 3, 3, 2],
  annapurna: [1, 2, 3, 3, 2, 0, 0, 0, 1, 3, 3, 2],
  langtang: [1, 1, 3, 3, 2, 0, 0, 0, 1, 3, 3, 2],
  // The rain shadow behind the Annapurnas: summer is fine, winter is closed and bitter.
  mustang: [0, 0, 1, 2, 3, 3, 2, 2, 3, 3, 2, 0],
  rara: [0, 0, 1, 3, 3, 1, 0, 0, 2, 3, 2, 0],
  // Kathmandu valley, Pokhara, Chitwan, Lumbini: cool and clear Oct–Mar, hot before the rains.
  lowland: [2, 3, 3, 2, 1, 0, 0, 0, 1, 3, 3, 2],
};
export const MONSOON = [6, 7, 8, 9];

/** The trip's month scores: the regions' scores weighted by days spent there, rounded. */
export function seasonScores(days: Day[]): number[] {
  const t = totals(days);
  const n = REGIONS.reduce((s, r) => s + t.regions[r], 0);
  if (!n) return SEASON.lowland.slice();
  return Array.from({ length: 12 }, (_, m) => Math.round(REGIONS.reduce((s, r) => s + SEASON[r][m] * t.regions[r], 0) / n));
}
/** Months (1–12) with the trip's best score. */
export function bestMonths(scores: number[]): number[] {
  const top = Math.max(...scores);
  return scores.map((s, i) => (s === top ? i + 1 : 0)).filter(Boolean);
}

export type FestivalId = 'dashain' | 'tihar' | 'holi' | 'buddha' | 'maniRimdu' | 'tiji';
/** Festivals by the months they usually fall in (they follow the lunar calendar and move every year). */
export const FESTIVALS: {
  id: FestivalId;
  months: number[];
  regions: Region[] | 'all';
}[] = [
  { id: 'dashain', months: [10], regions: 'all' },
  { id: 'tihar', months: [10, 11], regions: 'all' },
  { id: 'holi', months: [3], regions: 'all' },
  { id: 'buddha', months: [5], regions: ['lowland'] },
  { id: 'maniRimdu', months: [10, 11], regions: ['everest'] },
  { id: 'tiji', months: [5], regions: ['mustang'] },
];
export function festivalsFor(days: Day[]): typeof FESTIVALS {
  const t = totals(days);
  return FESTIVALS.filter((f) => f.regions === 'all' || f.regions.some((r) => t.regions[r] > 0));
}

// ---------------------------------------------------------------- packing and permits

export type PackGroup = 'papers' | 'clothes' | 'gear' | 'health' | 'extras';
export const PACK_GROUPS: PackGroup[] = ['papers', 'clothes', 'gear', 'health', 'extras'];
export type PackId =
  | 'passport'
  | 'insurance'
  | 'photos'
  | 'itinerary'
  | 'adapter'
  | 'layers'
  | 'fleece'
  | 'shell'
  | 'down'
  | 'warmhat'
  | 'gloves'
  | 'trousers'
  | 'light'
  | 'sunhat'
  | 'modest'
  | 'neutral'
  | 'quickdry'
  | 'sandals'
  | 'boots'
  | 'poles'
  | 'daypack'
  | 'duffel'
  | 'sleepingbag'
  | 'headtorch'
  | 'bottle'
  | 'raincover'
  | 'umbrella'
  | 'spikes'
  | 'powerbank'
  | 'binoculars'
  | 'softbag'
  | 'firstaid'
  | 'purify'
  | 'sunscreen'
  | 'sunglasses'
  | 'lipbalm'
  | 'altitude'
  | 'repellent'
  | 'leech'
  | 'blister'
  | 'snacks'
  | 'tissue'
  | 'gifts'
  | 'prints'
  | 'slipons';

export type PackInput = { days: Day[]; month: number };

/**
 * The packing list for a trip in a month: what every trip needs, plus what
 * the trip's walking, altitude, jungle, temples, family homes and the
 * season call for. In a fixed order, no duplicates.
 */
export function packingList({ days, month }: PackInput): { id: PackId; group: PackGroup }[] {
  const t = totals(days);
  const stops = new Set(days.map((d) => d.stop));
  const trek = t.walkDays + t.restDays > 0;
  const longTrek = t.walkDays >= 3;
  const high = t.maxSleep >= 3500 || t.maxTop >= 4000;
  const mid = t.maxSleep >= 2500;
  const winter = [12, 1, 2].includes(month);
  const monsoon = MONSOON.includes(month);
  const hot = [4, 5, 6, 7, 8, 9].includes(month) && t.regions.lowland > 0;
  const cold = high || mid || (winter && t.maxSleep >= 1300);
  const jungle = stops.has('chitwan');
  const temples = stops.has('lumbini') || stops.has('ktm');
  const family = t.nights.homestay > 0;
  const lukla = days.some((d, i) => d.stop === 'lukla' || d.via === 'lukla' || (i > 0 && days[i - 1].stop === 'lukla'));
  const want = new Set<PackId>(['passport', 'insurance', 'itinerary', 'adapter', 'bottle', 'purify', 'firstaid', 'sunscreen', 'powerbank', 'tissue']);
  const add = (...ids: PackId[]) => ids.forEach((id) => want.add(id));
  if (trek) add('photos', 'boots', 'daypack', 'layers', 'trousers', 'headtorch', 'blister', 'snacks', 'sunglasses');
  if (longTrek) add('poles', 'duffel');
  if (cold) add('fleece', 'warmhat', 'gloves', 'shell');
  if (high || (winter && mid)) add('down', 'sleepingbag', 'lipbalm');
  if (high) add('altitude');
  if (winter && high) add('spikes');
  if (monsoon) add('raincover', 'umbrella', 'quickdry');
  if (monsoon && (trek || jungle)) add('leech');
  if (hot) add('light', 'sunhat', 'sandals');
  if (!cold && !hot) add('fleece');
  if (jungle) add('neutral', 'repellent', 'binoculars');
  if (monsoon || hot) add('repellent');
  if (temples) add('modest', 'slipons');
  if (family) add('gifts', 'prints');
  if (lukla) add('softbag');
  return ORDER.filter((x) => want.has(x.id));
}
const ORDER: { id: PackId; group: PackGroup }[] = [
  ...(['passport', 'insurance', 'photos', 'itinerary', 'adapter'] as PackId[]).map((id) => ({ id, group: 'papers' as const })),
  ...(['layers', 'trousers', 'fleece', 'shell', 'down', 'warmhat', 'gloves', 'light', 'sunhat', 'quickdry', 'neutral', 'modest', 'sandals'] as PackId[]).map((id) => ({
    id,
    group: 'clothes' as const,
  })),
  ...(['boots', 'poles', 'daypack', 'duffel', 'softbag', 'sleepingbag', 'headtorch', 'bottle', 'raincover', 'umbrella', 'spikes', 'powerbank', 'binoculars'] as PackId[]).map(
    (id) => ({ id, group: 'gear' as const }),
  ),
  ...(['firstaid', 'purify', 'sunscreen', 'sunglasses', 'lipbalm', 'altitude', 'repellent', 'leech', 'blister'] as PackId[]).map((id) => ({ id, group: 'health' as const })),
  ...(['snacks', 'tissue', 'slipons', 'gifts', 'prints'] as PackId[]).map((id) => ({ id, group: 'extras' as const })),
];
export const PACK_IDS: PackId[] = ORDER.map((x) => x.id);

export type PermitId = 'visa' | 'guide' | 'sagarmatha' | 'khumbu' | 'acap' | 'tims' | 'langtangNp' | 'upperMustang' | 'raraNp' | 'chitwanNp' | 'lumbiniSite';
/** The papers a trip touches, named generically (no fees here: the agency checks the current rules for your dates). */
export function permitsFor(days: Day[]): PermitId[] {
  const stops = new Set<StopId>();
  for (const d of days) {
    stops.add(d.stop);
    if (d.side) stops.add(d.side);
    if (d.via) stops.add(d.via);
  }
  const regions = new Set([...stops].map((s) => STOPS[s].region));
  const out = new Set<PermitId>(['visa']);
  const t = totals(days);
  if (regions.has('everest')) out.add('sagarmatha').add('khumbu');
  const acapStops: StopId[] = [
    'tikhedhunga',
    'ghorepani',
    'poonhill',
    'tadapani',
    'ghandruk',
    'chhomrong',
    'jhinu',
    'bamboo',
    'deurali',
    'mbc',
    'abc',
    'dhampus',
    'jomsom',
    'lomanthang',
  ];
  if (acapStops.some((s) => stops.has(s))) out.add('acap');
  if (stops.has('lomanthang')) out.add('upperMustang');
  if (regions.has('langtang')) out.add('langtangNp');
  if (regions.has('annapurna') || regions.has('langtang') || stops.has('jomsom')) out.add('tims');
  if (stops.has('rara')) out.add('raraNp');
  if (stops.has('chitwan')) out.add('chitwanNp');
  if (stops.has('lumbini')) out.add('lumbiniSite');
  // A real trek (three or more days on foot), not a short walk up to a homestay.
  if (t.walkDays + t.restDays >= 3 && [...regions].some((r) => r !== 'lowland')) out.add('guide');
  const order: PermitId[] = ['visa', 'guide', 'sagarmatha', 'khumbu', 'acap', 'upperMustang', 'langtangNp', 'tims', 'raraNp', 'chitwanNp', 'lumbiniSite'];
  return order.filter((p) => out.has(p));
}

// ---------------------------------------------------------------- dates and the .ics file

/** "2027-10-12" + n days. */
export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const t = Date.UTC(y, m - 1, d) + n * 86400000;
  return new Date(t).toISOString().slice(0, 10);
}
export function isDate(v: unknown): v is string {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const t = Date.parse(v + 'T00:00:00Z');
  return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === v;
}
/** Month 1–12 of a date string (October if there is none). */
export function monthOf(date: string | null | undefined): number {
  return isDate(date) ? Number(date.slice(5, 7)) : 10;
}
/** The next 10 October from `now` (the default start: the clear weeks after the monsoon). */
export function defaultStart(now: Date): string {
  const y = now.getUTCFullYear();
  const thisYear = `${y}-10-10`;
  return now.toISOString().slice(0, 10) < addDays(thisYear, -14) ? thisYear : `${y + 1}-10-10`;
}

/** Text in an iCalendar property value: backslash, semicolon, comma and line breaks escaped. */
export function icsEscape(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}
/** Fold a content line at 75 octets (UTF-8), never inside a character; continuation lines start with a space. */
export function icsFold(line: string): string {
  const enc = new TextEncoder();
  const parts: string[] = [];
  let cur = '';
  let bytes = 0;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    const limit = parts.length ? 74 : 75;
    if (bytes + b > limit) {
      parts.push(cur);
      cur = '';
      bytes = 0;
    }
    cur += ch;
    bytes += b;
  }
  parts.push(cur);
  return parts.join('\r\n ');
}
export type IcsEvent = {
  date: string;
  summary: string;
  description: string;
  location?: string;
};
function stamp(now: Date): string {
  return now
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}
/** One all-day event per day. Lines end in CRLF, long lines are folded. */
export function icsCalendar(events: IcsEvent[], name: string, now: Date): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//MartNepali//Yatri Treks demo//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${icsEscape(name)}`];
  const seed = hash(name + events.map((e) => e.date + e.summary).join('|')).toString(36);
  events.forEach((e, i) => {
    lines.push(
      'BEGIN:VEVENT',
      `UID:trek-${seed}-${i + 1}@martnepali.com`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART;VALUE=DATE:${e.date.replace(/-/g, '')}`,
      `DTEND;VALUE=DATE:${addDays(e.date, 1).replace(/-/g, '')}`,
      `SUMMARY:${icsEscape(e.summary)}`,
      `DESCRIPTION:${icsEscape(e.description)}`,
      ...(e.location ? [`LOCATION:${icsEscape(e.location)}`] : []),
      'TRANSP:TRANSPARENT',
      'END:VEVENT',
    );
  });
  lines.push('END:VCALENDAR');
  return lines.map(icsFold).join('\r\n') + '\r\n';
}

// ---------------------------------------------------------------- saved state

export const STORE_KEY = 'mn-demo:trek';
export type Saved = {
  v: 1;
  /** The ready trip the days came from, or 'custom' for "build your own". */
  base: TripId | 'custom';
  /** The visitor's version of the days (null = the ready trip as it is). */
  days: Day[] | null;
  start: string | null;
  packed: PackId[];
  people: number;
};
export function emptySaved(): Saved {
  return { v: 1, base: 'ebc', days: null, start: null, packed: [], people: 2 };
}
function cleanDay(v: unknown, i: number): Day | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  if (!isStop(o.stop)) return null;
  const d: Day = {
    k: typeof o.k === 'string' && o.k.length <= 40 ? o.k : `s-${i}`,
    stop: o.stop,
  };
  if (o.from === null || isStop(o.from)) d.from = o.from as StopId | null;
  const modes: Mode[] = ['arrive', 'walk', 'drive', 'fly', 'rest', 'visit'];
  if (typeof o.mode === 'string' && (modes as string[]).includes(o.mode)) d.mode = o.mode as Mode;
  const n = (x: unknown, max: number) => (typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= max ? x : undefined);
  const km = n(o.km, 2000);
  const h = n(o.h, 24);
  const top = n(o.top, 9000);
  if (km !== undefined) d.km = km;
  if (h !== undefined) d.h = h;
  if (top !== undefined) d.top = top;
  if (isStop(o.via)) d.via = o.via;
  if (isStop(o.side)) d.side = o.side;
  if (typeof o.hl === 'string' && /^[a-z]{2,4}\d{1,2}$/.test(o.hl)) d.hl = o.hl;
  if (typeof o.lodge === 'string' && (LODGES as string[]).includes(o.lodge)) d.lodge = o.lodge as Lodge;
  return d;
}
/** Whatever came back from localStorage, made safe. */
export function cleanSaved(v: unknown): Saved {
  const s = emptySaved();
  if (!v || typeof v !== 'object') return s;
  const o = v as Record<string, unknown>;
  if (o.v !== 1) return s;
  if (o.base === 'custom' || isTripId(o.base)) s.base = o.base as Saved['base'];
  if (Array.isArray(o.days)) {
    const seen = new Set<string>();
    const days = o.days
      .slice(0, MAX_DAYS)
      .map(cleanDay)
      .filter((d): d is Day => d !== null)
      .map((d, i) => (seen.has(d.k) ? { ...d, k: `s-${i}-${d.k}` } : (seen.add(d.k), d)));
    s.days = days.length ? days : null;
  }
  if (s.base === 'custom' && !s.days) s.base = 'ebc';
  if (isDate(o.start)) s.start = o.start;
  if (Array.isArray(o.packed)) s.packed = [...new Set(o.packed.filter((x): x is PackId => typeof x === 'string' && (PACK_IDS as string[]).includes(x)))];
  if (typeof o.people === 'number' && Number.isInteger(o.people) && o.people >= 1 && o.people <= 20) s.people = o.people;
  return s;
}

// ---------------------------------------------------------------- small helpers

export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
