// Server-only: the one rule for building `WHERE x IN (...)` lists.
//
// Batch readers replace a query-per-row with a single query over a list of
// ids, which is the whole point of them — but SQLite binds a finite number of
// parameters per statement, and a feed that outgrows that limit would fail at
// exactly the scale the batch reader exists for. So the list is cut into
// batches and the caller loops. 500 is far under any SQLite build's ceiling
// (the old default was 999) and still turns any realistic feed into one query.
const MAX_PARAMS = 500;

/** `ids` split into batches small enough to bind in one statement. */
export function chunkIds<T>(ids: T[]): T[][] {
  if (ids.length <= MAX_PARAMS) return ids.length ? [ids] : [];
  const out: T[][] = [];
  for (let i = 0; i < ids.length; i += MAX_PARAMS) out.push(ids.slice(i, i + MAX_PARAMS));
  return out;
}
