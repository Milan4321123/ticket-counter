import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getEventTiers } from '@/lib/events';
import { BodyTooLargeError, readJsonLimited } from '@/lib/http';
import { choicesFromText, normaliseSlotConfig, type SlotConfig } from '@/lib/kitchen';
import type { ApiErrorResponse } from '@/lib/types';
import { planGate, requireOrganizerApi, requireOwnedEvent } from '../../../auth';

export const dynamic = 'force-dynamic';

function bad(error: string, status = 400) {
  return NextResponse.json({ error } satisfies ApiErrorResponse, { status });
}

/**
 * Save a shop's kitchen settings (lib/kitchen): collection slots, the number of
 * tables with a QR code, and each item's free choices. Shops only.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireOrganizerApi();
  if (auth.failure) return auth.failure;
  const blocked = planGate(auth.organizer);
  if (blocked) return blocked;
  const owned = requireOwnedEvent(auth.organizer, id);
  if (owned.failure) return owned.failure;
  const event = owned.event;
  if (event.kind !== 'shop') return bad('Kitchen settings are for shops.');

  let body: { slots?: Partial<SlotConfig>; tableCount?: unknown; choices?: Record<string, unknown> };
  try {
    body = ((await readJsonLimited(req)) ?? {}) as typeof body;
  } catch (e) {
    return bad(e instanceof BodyTooLargeError ? 'That request was too large.' : 'Nothing to save.', e instanceof BodyTooLargeError ? 413 : 400);
  }

  const slots = normaliseSlotConfig(body.slots ?? {});
  if (!slots) return bad('The closing time has to be after the first collection time.');
  if (slots.enabled && slots.days.length === 0) return bad('Pick at least one day you hand orders over.');

  const tableCount = Number(body.tableCount ?? 0);
  if (!Number.isInteger(tableCount) || tableCount < 0 || tableCount > 200) return bad('Tables must be between 0 and 200.');

  const tiers = getEventTiers(event.id);
  const updates: { tierKey: string; json: string | null }[] = [];
  for (const [tierKey, raw] of Object.entries(body.choices ?? {})) {
    const tier = tiers.find((t) => t.tierKey === tierKey);
    if (!tier || typeof raw !== 'string') continue;
    const parsed = choicesFromText(raw);
    if (typeof parsed === 'string') return bad(`${tier.name}: ${parsed}`);
    updates.push({ tierKey, json: parsed.length ? JSON.stringify(parsed) : null });
  }

  const db = getDb();
  db.transaction(() => {
    db.prepare(`UPDATE events SET pickup_slots = ?, table_count = ? WHERE id = ?`).run(JSON.stringify(slots), tableCount, event.id);
    const upd = db.prepare(`UPDATE event_tiers SET choices = ? WHERE event_id = ? AND tier_key = ?`);
    for (const u of updates) upd.run(u.json, event.id, u.tierKey);
  })();
  return NextResponse.json({ ok: true });
}
