// Server-only: tiny in-memory rate limiter (fixed window per key).
// Fine for this single-process deployment; resets on restart by design.

interface Window {
  count: number;
  resetAt: number;
}

const windows = new Map<string, Window>();

const SWEEP_THRESHOLD = 5_000;
const HARD_CAP = 20_000;
const SWEEP_MIN_INTERVAL_MS = 1_000;

let lastSweep = 0;

/**
 * Drop expired windows, and under hostile key cardinality (e.g. rotated
 * spoofed IPs) evict oldest entries so the map can never grow unbounded.
 *
 * The full scan is O(n), so we only run it at most once per second — otherwise
 * a flood that pushes the map past SWEEP_THRESHOLD would make EVERY subsequent
 * request pay an O(n) scan, turning the limiter itself into an amplifier of the
 * very flood it defends against. The HARD_CAP eviction still bounds memory.
 */
function sweep(now: number) {
  if (windows.size < SWEEP_THRESHOLD) return;
  if (now - lastSweep < SWEEP_MIN_INTERVAL_MS && windows.size <= HARD_CAP) return;
  lastSweep = now;
  for (const [key, w] of windows) {
    if (w.resetAt <= now) windows.delete(key);
  }
  if (windows.size > HARD_CAP) {
    let excess = windows.size - HARD_CAP;
    for (const key of windows.keys()) {
      if (excess-- <= 0) break;
      windows.delete(key); // Map iterates in insertion order: oldest first
    }
  }
}

/**
 * Returns true when the call is allowed, false when the key has exceeded
 * `limit` calls within `windowMs`.
 */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  sweep(now);
  const w = windows.get(key);
  if (!w || w.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  w.count += 1;
  return w.count <= limit;
}

/** True when the key is already over its limit — does NOT count an attempt. */
export function isRateLimited(key: string, limit: number): boolean {
  const now = Date.now();
  sweep(now);
  const w = windows.get(key);
  return Boolean(w && w.resetAt > now && w.count >= limit);
}

/** Count one strike against the key (e.g. a failed login). */
export function recordStrike(key: string, windowMs: number): void {
  const now = Date.now();
  sweep(now);
  const w = windows.get(key);
  if (!w || w.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
  } else {
    w.count += 1;
  }
}

/**
 * Best-effort client IP for rate-limit keys.
 *
 * We take the LAST x-forwarded-for entry: that's the one appended by YOUR
 * proxy (Railway/Render/Fly, nginx, caddy — every deployment the README
 * recommends terminates behind one). Earlier entries are client-controlled
 * and trivially spoofable. If the app is exposed directly with no proxy, the
 * header itself is spoofable — which is why every limiter that uses this also
 * keeps a global (key-independent) backstop.
 */
export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) {
    const parts = fwd
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1];
  }
  return req.headers.get('x-real-ip') || 'direct';
}
