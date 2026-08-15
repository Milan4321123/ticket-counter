import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { sendEventFeeInstructionsEmail } from '@/lib/email';
import {
  countPaidOrdersForEvent,
  deleteEventCompletely,
  getEventMedia,
  getEventTiers,
  getMediaById,
  makeUniqueSlug,
  newId,
  parseCropRect,
  parsePageDesign,
  quoteEventFee,
  videoEmbedUrl,
} from '@/lib/events';
import { readJsonLimited, BodyTooLargeError } from '@/lib/http';
import { formatMoney } from '@/lib/money';
import { eventFeeReference, platformBank } from '@/lib/platform';
import type { ApiErrorResponse } from '@/lib/types';
import { planGate, requireOrganizerApi, requireOwnedEvent } from '../../auth';

export const dynamic = 'force-dynamic';

/** Friendly, buyer-safe validation failure — message goes straight to the UI. */
class ValidationError extends Error {}

function need(cond: boolean, message: string): asserts cond {
  if (!cond) throw new ValidationError(message);
}

function strField(v: unknown, label: string, max: number): string {
  need(typeof v === 'string', `${label} must be text.`);
  const s = v.trim();
  need(s.length <= max, `${label} can be at most ${max} characters.`);
  return s;
}

function intField(v: unknown, label: string, min: number, max: number): number {
  need(typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max, `${label} must be a whole number between ${min} and ${max}.`);
  return v;
}

const IBAN_RE = /^[A-Z]{2}\d{2}[A-Z0-9]{8,30}$/;
const BIC_RE = /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/;
const TIER_KEY_RE = /^[a-z0-9-]{1,40}$/;
const MAX_TIERS = 20;
/** Keep in sync with the counter in the portal's AssistantPanel. */
const MAX_ASSISTANT_CONTEXT = 4000;

/** Patch field -> column for the three hand-positioned photo slots. */
const CROP_FIELDS = [
  ['coverCrop', 'cover_crop'],
  ['profileCrop', 'profile_crop'],
  ['posterCrop', 'poster_crop'],
] as const;

interface TierPayload {
  tierKey: string | null;
  name: string;
  priceCents: number;
  cap: number;
  studentOnly: boolean;
  description: string;
}

function tierKeyFromName(name: string, taken: Set<string>): string {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'ticket';
  let candidate = base;
  for (let i = 2; taken.has(candidate); i++) candidate = `${base}-${i}`;
  taken.add(candidate);
  return candidate;
}

/**
 * Tickets ever ordered for a tier of this event — in ANY status. Even
 * cancelled/expired orders keep their tier row for history, so a tier that was
 * ever ordered can never be deleted (set its capacity to 0 instead).
 */
function tierHasOrders(eventId: string, tierKey: string): boolean {
  const row = getDb()
    .prepare(
      `SELECT COUNT(*) AS n
       FROM order_items oi JOIN orders o ON o.id = oi.order_id
       WHERE o.event_id = ? AND oi.tier_id = ?`
    )
    .get(eventId, tierKey) as { n: number };
  return row.n > 0;
}

/**
 * Update an event the signed-in organizer owns. The body is a partial patch:
 * only whitelisted fields are ever applied, each one validated. Tiers are
 * replaced as a whole array (existing tier_keys stay stable so past orders
 * keep pointing at the right ticket type). Publishing runs a readiness
 * checklist first. Everything is applied in ONE transaction.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const auth = await requireOrganizerApi();
    if (auth.failure) return auth.failure;
    const { organizer } = auth;

    const blocked = planGate(organizer);
    if (blocked) return blocked;

    const owned = requireOwnedEvent(organizer, id);
    if (owned.failure) return owned.failure;
    const { event } = owned;

    // Archived events are frozen by the platform — no edits of any kind, and
    // in particular no way to flip the status back to draft/published.
    need(
      event.status !== 'archived',
      'This event has been archived by the platform and can no longer be changed.'
    );

    let body: Record<string, unknown>;
    try {
      const parsed = await readJsonLimited(req, 64 * 1024);
      need(Boolean(parsed) && typeof parsed === 'object' && !Array.isArray(parsed), 'Nothing to save.');
      body = parsed as Record<string, unknown>;
    } catch (e) {
      if (e instanceof BodyTooLargeError) {
        return NextResponse.json({ error: 'That request was too large.' } satisfies ApiErrorResponse, { status: 413 });
      }
      if (e instanceof ValidationError) throw e;
      return NextResponse.json({ error: 'Nothing to save.' } satisfies ApiErrorResponse, { status: 400 });
    }

    const db = getDb();
    const sets: string[] = [];
    const args: (string | number | null)[] = [];
    const set = (col: string, val: string | number | null) => {
      sets.push(`${col} = ?`);
      args.push(val);
    };

    // Merged view of the event AFTER this patch — used by the publish checklist.
    const merged = { ...event };

    /**
     * Changing WHICH photo fills a slot throws away the framing that went with
     * it: fractions measured on one picture mean something else entirely on the
     * next, so keeping them would show a slice of the new photo nobody chose.
     *
     * Skipped when the same request also sets that framing — otherwise the
     * column would be assigned twice in one UPDATE, and the organizer's actual
     * choice would be the one at risk of losing.
     */
    const dropFraming = (field: 'coverCrop' | 'profileCrop' | 'posterCrop', column: string) => {
      if (field in body || event[field] === null) return;
      set(column, null);
      merged[field] = null;
    };

    // ---- Details ---------------------------------------------------------
    if ('name' in body) {
      const name = strField(body.name, 'The event name', 120);
      need(name.length > 0, 'The event name cannot be empty.');
      if (name !== event.name) {
        set('name', name);
        merged.name = name;
        // The web address follows the name only while the event is still a
        // draft — once published, links that were shared must keep working.
        if (event.status === 'draft') {
          const slug = makeUniqueSlug(name, event.id);
          set('slug', slug);
          merged.slug = slug;
        }
      }
    }
    if ('artist' in body) {
      const v = strField(body.artist, 'The artist name', 120);
      set('artist', v);
      merged.artist = v;
    }
    if ('description' in body) {
      const v = strField(body.description, 'The description', 8000);
      set('description', v);
      merged.description = v;
    }
    if ('dateDisplay' in body) {
      const v = strField(body.dateDisplay, 'The date text', 120);
      set('date_display', v);
      merged.dateDisplay = v;
    }
    if ('eventDate' in body) {
      const raw = body.eventDate;
      if (raw === null || raw === '') {
        set('event_date', null);
        merged.eventDate = null;
      } else {
        need(typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw), 'The calendar date must look like 2026-10-24.');
        set('event_date', raw);
        merged.eventDate = raw;
      }
    }
    if ('venueName' in body) {
      const v = strField(body.venueName, 'The venue name', 160);
      set('venue_name', v);
      merged.venueName = v;
    }
    if ('address' in body) {
      const v = strField(body.address, 'The address', 240);
      set('address', v);
      merged.address = v;
    }
    if ('city' in body) {
      const v = strField(body.city, 'The city', 80);
      set('city', v);
      merged.city = v;
    }
    if ('totalCapacity' in body) {
      const v = intField(body.totalCapacity, 'The total capacity', 1, 200000);
      set('total_capacity', v);
      merged.totalCapacity = v;
    }
    if ('maxPerOrder' in body) {
      const v = intField(body.maxPerOrder, 'Max tickets per order', 1, 50);
      set('max_per_order', v);
      merged.maxPerOrder = v;
    }
    if ('payWithinDays' in body) {
      const v = intField(body.payWithinDays, 'The payment deadline (days)', 1, 30);
      set('pay_within_days', v);
      merged.payWithinDays = v;
    }
    if ('salesOpen' in body) {
      need(typeof body.salesOpen === 'boolean', 'Sales open must be on or off.');
      set('sales_open', body.salesOpen ? 1 : 0);
      merged.salesOpen = body.salesOpen;
    }

    // ---- Bank details (the ORGANIZER's own account) ----------------------
    if ('bankAccountHolder' in body) {
      const v = strField(body.bankAccountHolder, 'The account holder', 120);
      set('bank_account_holder', v);
      merged.bankAccountHolder = v;
    }
    if ('bankIban' in body) {
      const v = strField(body.bankIban, 'The IBAN', 60);
      const compact = v.replace(/\s+/g, '').toUpperCase();
      need(
        compact === '' || IBAN_RE.test(compact),
        'That does not look like a valid IBAN — it should look like DE89 3704 0044 0532 0130 00.'
      );
      set('bank_iban', v);
      merged.bankIban = v;
    }
    if ('bankBic' in body) {
      const v = strField(body.bankBic, 'The BIC', 20);
      const compact = v.replace(/\s+/g, '').toUpperCase();
      need(compact === '' || BIC_RE.test(compact), 'That does not look like a valid BIC — it is 8 or 11 characters, like COBADEFFXXX.');
      set('bank_bic', v);
      merged.bankBic = v;
    }
    if ('bankName' in body) {
      const v = strField(body.bankName, 'The bank name', 120);
      set('bank_name', v);
      merged.bankName = v;
    }

    // ---- Media / video ---------------------------------------------------
    if ('videoUrl' in body) {
      const v = strField(body.videoUrl, 'The video link', 400);
      need(
        v === '' || videoEmbedUrl(v) !== null,
        'Please paste a YouTube or Vimeo link (or a direct https:// video file ending in .mp4 or .webm).'
      );
      set('video_url', v);
      merged.videoUrl = v;
    }
    if ('posterMediaId' in body) {
      const raw = body.posterMediaId;
      if (raw === null || raw === '') {
        set('poster_media_id', null);
        merged.posterMediaId = null;
      } else {
        need(typeof raw === 'string', 'Invalid poster choice.');
        need(
          getEventMedia(event.id).some((m) => m.id === raw),
          'That photo does not belong to this event.'
        );
        set('poster_media_id', raw);
        merged.posterMediaId = raw;
      }
      if (merged.posterMediaId !== event.posterMediaId) dropFraming('posterCrop', 'poster_crop');
    }
    if ('profileMediaId' in body) {
      const raw = body.profileMediaId;
      if (raw === null || raw === '') {
        set('profile_media_id', null);
        merged.profileMediaId = null;
      } else {
        need(typeof raw === 'string', 'Invalid profile photo choice.');
        need(
          getEventMedia(event.id).some((m) => m.id === raw),
          'That photo does not belong to this event.'
        );
        set('profile_media_id', raw);
        merged.profileMediaId = raw;
      }
      if (merged.profileMediaId !== event.profileMediaId) dropFraming('profileCrop', 'profile_crop');
    }
    // The cover is what people see first — in the feed and at the top of the
    // event page — and unlike the poster it may be a PHOTO or a VIDEO.
    if ('coverMediaId' in body) {
      const raw = body.coverMediaId;
      if (raw === null || raw === '') {
        set('cover_media_id', null);
        merged.coverMediaId = null;
      } else {
        need(typeof raw === 'string', 'Invalid cover choice.');
        const media = getMediaById(raw);
        need(media !== null && media.eventId === event.id, 'That photo or video does not belong to this event.');
        set('cover_media_id', raw);
        merged.coverMediaId = raw;
      }
      if (merged.coverMediaId !== event.coverMediaId) dropFraming('coverCrop', 'cover_crop');
    }

    // Framing: which part of a photo stays in frame in each fixed-shape slot.
    // The repositioning tool sends fractions of the picture; null puts the slot
    // back on the automatic crop. Everything is re-validated through the same
    // parser the renderer uses, and only the parsed rectangle is stored — so a
    // value that could reach sharp with a bad region never gets written at all.
    for (const [field, column] of CROP_FIELDS) {
      if (!(field in body)) continue;
      const raw = body[field];
      if (raw === null) {
        set(column, null);
        merged[field] = null;
        continue;
      }
      need(Boolean(raw) && typeof raw === 'object' && !Array.isArray(raw), 'Invalid photo position.');
      const rect = parseCropRect(JSON.stringify(raw));
      need(
        rect !== null,
        'That photo position does not look right — please drag the photo where you want it and save again.'
      );
      const stored = JSON.stringify(rect);
      set(column, stored);
      merged[field] = stored;
    }

    // ---- Page design (constrained spec, never raw HTML/CSS) --------------
    if ('pageDesign' in body) {
      need(Boolean(body.pageDesign) && typeof body.pageDesign === 'object', 'Invalid page design.');
      const clean = parsePageDesign(JSON.stringify(body.pageDesign));
      set('page_design', JSON.stringify(clean));
      merged.pageDesign = JSON.stringify(clean);
    }

    // ---- What the visitor assistant should know --------------------------
    // Free text the organizer writes for the AI, never shown on the page. Kept
    // short on purpose: it is pasted into every question's prompt.
    if ('assistantContext' in body) {
      const v = strField(body.assistantContext, 'The notes for the assistant', MAX_ASSISTANT_CONTEXT);
      set('assistant_context', v);
      merged.assistantContext = v;
    }

    // ---- Tiers (replace-all, stable keys for existing rows) --------------
    const existingTiers = getEventTiers(event.id);
    let tiersPlan: { keep: (TierPayload & { tierKey: string })[]; removeKeys: string[] } | null = null;
    if ('tiers' in body) {
      need(Array.isArray(body.tiers), 'Invalid ticket types.');
      const rows = body.tiers as unknown[];
      need(rows.length <= MAX_TIERS, `An event can have at most ${MAX_TIERS} ticket types.`);

      const existingKeys = new Set(existingTiers.map((t) => t.tierKey));
      const taken = new Set<string>();
      const keep: (TierPayload & { tierKey: string })[] = [];

      for (const raw of rows) {
        need(Boolean(raw) && typeof raw === 'object', 'Invalid ticket type.');
        const r = raw as Record<string, unknown>;
        const name = strField(r.name, 'Each ticket type name', 80);
        need(name.length > 0, 'Every ticket type needs a name.');
        const priceCents = intField(r.priceCents, `The price of "${name}"`, 0, 5_000_000);
        const cap = intField(r.cap, `The ticket limit of "${name}"`, 0, 200000);
        need(typeof r.studentOnly === 'boolean', 'Student-only must be on or off.');
        const description = strField(r.description ?? '', `The description of "${name}"`, 300);

        // Existing rows keep their key so past orders stay linked; new rows
        // (or rows with a stale/unknown key) get a fresh key from the name.
        let tierKey: string;
        const provided = typeof r.tierKey === 'string' ? r.tierKey : null;
        if (provided && existingKeys.has(provided) && !taken.has(provided) && TIER_KEY_RE.test(provided)) {
          tierKey = provided;
          taken.add(provided);
        } else {
          tierKey = tierKeyFromName(name, taken);
        }
        keep.push({ tierKey, name, priceCents, cap, studentOnly: r.studentOnly, description });
      }

      const keptKeys = new Set(keep.map((t) => t.tierKey));
      const removeKeys = existingTiers.map((t) => t.tierKey).filter((k) => !keptKeys.has(k));
      for (const key of removeKeys) {
        const gone = existingTiers.find((t) => t.tierKey === key)!;
        need(
          !tierHasOrders(event.id, key),
          `“${gone.name}” already has orders, so it can't be removed. Set its ticket limit to 0 to stop new sales instead.`
        );
      }
      tiersPlan = { keep, removeKeys };
    }

    // ---- Publish / unpublish --------------------------------------------
    if ('status' in body) {
      const status = body.status;
      need(status === 'draft' || status === 'published', 'Invalid status.');
      if (status === 'published' && event.status !== 'published') {
        // The platform fee is charged PER EVENT and is the first gate: no
        // transfer, no publishing. The attempt doubles as the trigger for the
        // instructions email, so the IBAN and this event's Verwendungszweck
        // land in the organizer's inbox exactly when they need them.
        if (event.feeStatus !== 'paid') {
          // Quoting here locks the amount, so the mail, the Publish tab, and the
          // owner's confirm screen can never name three different numbers.
          const feeAmount = formatMoney(quoteEventFee(event), 'EUR');
          const bank = platformBank();
          let emailed = false;
          if (bank) {
            const mail = await sendEventFeeInstructionsEmail(
              { name: organizer.name, email: organizer.email },
              { id: event.id, name: event.name },
              { feeLabel: feeAmount, bank, reference: eventFeeReference(event.id) }
            );
            emailed = mail.sent;
          }
          throw new ValidationError(
            `Almost there — this event still needs its ${feeAmount} platform fee. ` +
              (emailed
                ? `We just emailed the transfer details to ${organizer.email}, and they are on this Publish tab too. `
                : 'The transfer details are right here on the Publish tab. ') +
              'Once we see your transfer we unlock publishing — usually within a day.'
          );
        }

        const tierCount = tiersPlan ? tiersPlan.keep.length : existingTiers.length;
        const missing: string[] = [];
        if (!merged.dateDisplay.trim() && !merged.eventDate) missing.push('add a date');
        if (!merged.venueName.trim() || !merged.address.trim()) missing.push('add the venue name and address');
        if (tierCount < 1) missing.push('add at least one ticket type');
        if (!merged.bankIban.trim() || !merged.bankAccountHolder.trim()) {
          missing.push('add your bank account (holder and IBAN)');
        }
        if (!merged.description.trim()) missing.push('write a short description');
        need(missing.length === 0, `Almost there — before publishing, please ${missing.join(', ')}.`);
      }
      if (status !== event.status) {
        set('status', status);
        merged.status = status;
      }
    }

    need(sets.length > 0 || tiersPlan !== null, 'Nothing to save.');

    const tx = db.transaction(() => {
      if (sets.length > 0) {
        db.prepare(`UPDATE events SET ${sets.join(', ')} WHERE id = ?`).run(...args, event.id);
      }
      if (tiersPlan) {
        const del = db.prepare(`DELETE FROM event_tiers WHERE event_id = ? AND tier_key = ?`);
        for (const key of tiersPlan.removeKeys) del.run(event.id, key);
        const upd = db.prepare(
          `UPDATE event_tiers SET name = ?, price_cents = ?, cap = ?, student_only = ?, description = ?, sort = ?
           WHERE event_id = ? AND tier_key = ?`
        );
        const ins = db.prepare(
          `INSERT INTO event_tiers (id, event_id, tier_key, name, price_cents, cap, student_only, description, sort)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        );
        const existingKeys = new Set(existingTiers.map((t) => t.tierKey));
        tiersPlan.keep.forEach((t, sort) => {
          if (existingKeys.has(t.tierKey)) {
            upd.run(t.name, t.priceCents, t.cap, t.studentOnly ? 1 : 0, t.description, sort, event.id, t.tierKey);
          } else {
            ins.run(newId(), event.id, t.tierKey, t.name, t.priceCents, t.cap, t.studentOnly ? 1 : 0, t.description, sort);
          }
        });
      }
    });
    tx();

    return NextResponse.json({
      ok: true,
      slug: merged.slug,
      status: merged.status,
      ...(tiersPlan
        ? {
            tiers: getEventTiers(event.id).map((t) => ({
              tierKey: t.tierKey,
              name: t.name,
              priceCents: t.priceCents,
              cap: t.cap,
              studentOnly: t.studentOnly,
              description: t.description,
            })),
          }
        : {}),
    });
  } catch (e) {
    if (e instanceof ValidationError) {
      return NextResponse.json({ error: e.message } satisfies ApiErrorResponse, { status: 400 });
    }
    console.error(`POST /api/portal/events/${id} failed:`, e);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' } satisfies ApiErrorResponse,
      { status: 500 }
    );
  }
}

/**
 * Delete an event the signed-in organizer owns, with everything on it: ticket
 * types, photos and videos, page content, orders and the tickets themselves.
 * Nothing here can be undone, so three things must line up before a row moves:
 *
 *  1. the event belongs to the caller (someone else's id answers 404),
 *  2. they retyped its exact name — the same gesture the UI asks for, checked
 *     again here so the API cannot be the easy way around it,
 *  3. if any buyer has already paid, they explicitly acknowledged that those
 *     tickets die with the event.
 */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const auth = await requireOrganizerApi();
    if (auth.failure) return auth.failure;
    const { organizer } = auth;

    const blocked = planGate(organizer);
    if (blocked) return blocked;

    const owned = requireOwnedEvent(organizer, id);
    if (owned.failure) return owned.failure;
    const { event } = owned;

    // Archived events are frozen by the platform — the organizer cannot edit
    // one, so they cannot erase one either.
    need(
      event.status !== 'archived',
      'This event has been archived by the platform, so it can no longer be changed or deleted. Get in touch with them if you think that is a mistake.'
    );

    let body: Record<string, unknown>;
    try {
      const parsed = await readJsonLimited(req, 4 * 1024);
      need(
        Boolean(parsed) && typeof parsed === 'object' && !Array.isArray(parsed),
        'Please confirm the event name first.'
      );
      body = parsed as Record<string, unknown>;
    } catch (e) {
      if (e instanceof BodyTooLargeError) {
        return NextResponse.json({ error: 'That request was too large.' } satisfies ApiErrorResponse, { status: 413 });
      }
      if (e instanceof ValidationError) throw e;
      return NextResponse.json(
        { error: 'Please confirm the event name first.' } satisfies ApiErrorResponse,
        { status: 400 }
      );
    }

    const confirmName = typeof body.confirmName === 'string' ? body.confirmName.trim() : '';
    need(
      confirmName === event.name.trim(),
      `To delete this event, please type its name exactly as it appears: ${event.name}`
    );

    const paidOrders = countPaidOrdersForEvent(event.id);
    if (paidOrders > 0 && body.acknowledgePaidOrders !== true) {
      // Nothing is malformed here — the request is simply waiting on a decision
      // only a person should make, so this is a conflict, not a bad request.
      return NextResponse.json(
        {
          error:
            `${paidOrders} ${paidOrders === 1 ? 'buyer has' : 'buyers have'} already paid for this event. ` +
            `Deleting it destroys ${paidOrders === 1 ? 'their ticket' : 'their tickets'} and your record of the money, ` +
            'and they will not be told. Please let them know first — then tick the box to confirm and try again.',
        } satisfies ApiErrorResponse,
        { status: 409 }
      );
    }

    const removed = deleteEventCompletely(event.id);
    // The only trace left of the event: who removed it and how much went with it.
    console.log(
      `Organizer ${organizer.id} deleted event ${event.id} ("${event.name}"): ` +
        `${removed.orders} orders, ${removed.tickets} tickets, ${removed.media} photos/videos.`
    );

    return NextResponse.json({ ok: true, name: event.name });
  } catch (e) {
    if (e instanceof ValidationError) {
      return NextResponse.json({ error: e.message } satisfies ApiErrorResponse, { status: 400 });
    }
    console.error(`DELETE /api/portal/events/${id} failed:`, e);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' } satisfies ApiErrorResponse,
      { status: 500 }
    );
  }
}
