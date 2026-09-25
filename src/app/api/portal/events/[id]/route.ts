import { cookies } from 'next/headers';
import { warmListingTranslations } from '@/lib/listingI18n';
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { sendPayoutChangedEmail } from '@/lib/email';
import {
  countPaidOrdersForEvent,
  deleteEventCompletely,
  getEventMedia,
  getEventTiers,
  getMediaById,
  isValidPaypalAccount,
  makeUniqueSlug,
  missingListingDetails,
  newId,
  parseCropRect,
  parsePageDesign,
  videoEmbedUrl,
  type TierStatus,
  FOCUS_RE,
} from '@/lib/events';
import { isShopCategory } from '@/lib/categories';
import { getConnection } from '@/lib/paymentConnections';
import { readJsonLimited, BodyTooLargeError } from '@/lib/http';
import { organizerTotpEnabled } from '@/lib/organizerTotp';
import {
  PAYOUT_DELAY_MS,
  effectivePayout,
  isValidIban,
  payoutChangeIsDelayed,
  payoutNameMatchesOrganizer,
  queuePayoutChange,
  recordPayoutChange,
} from '@/lib/payout';
import {
  PAYOUT_STEP_UP_COOKIE,
  summarisePayoutChange,
  verifyStepUpToken,
} from '@/lib/payoutStepUp';
import { vocabFor } from '@/lib/vocab';
import type { ApiErrorResponse } from '@/lib/types';
import { planGate, requireOrganizerApi, requireOwnedEvent } from '../../auth';
import { payoutStepUpChallenge } from '../../payout/method';
import { isValidWhatsApp, normalizeWhatsApp } from '@/lib/whatsapp';

export const dynamic = 'force-dynamic';

/**
 * Off-switch for the publish-time authenticator requirement.
 *
 * ON by default. It exists because this is a people problem as much as a
 * technical one: an organizer who genuinely cannot run an authenticator app
 * should be unblocked by the platform owner within minutes rather than left
 * unable to sell, and that is better than having no lever at all.
 */
function requireAuthenticatorToPublish(): boolean {
  return process.env.PORTAL_REQUIRE_AUTHENTICATOR !== 'off';
}

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

const BIC_RE = /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/;
const TIER_KEY_RE = /^[a-z0-9-]{1,40}$/;
const MAX_TIERS = 20;
/** Keep in sync with the counter in the portal's AssistantPanel. */
const MAX_ASSISTANT_CONTEXT = 4000;
/** Collection details: a few lines of when and where, not an essay. */
const MAX_PICKUP_INFO = 2000;
/**
 * The long "about this item" prose behind one item's page. Same ceiling as the
 * assistant notes — a page of writing about one product, not a book — and kept
 * in sync with the counter in the portal's TiersEditor.
 */
const MAX_TIER_DETAILS = 4000;
/** The row's short name and its one-line blurb on the listing card. */
const MAX_TIER_NAME = 80;
const MAX_TIER_DESCRIPTION = 300;

/**
 * How big a patch this route will read — DERIVED from the ceilings above
 * rather than picked as a round number.
 *
 * The Tiers tab posts every row in one body, so the cap has to hold what that
 * form itself invites a seller to type: MAX_TIERS rows each carrying a full
 * MAX_TIER_DETAILS write-up. A flat 64 KB did not — twenty full rows measure
 * about 90 KB — so a seller with a twenty-item shop got "That request was too
 * large" on every save of the tab, including a save that only moved one price,
 * while the counter under each box still said characters remained. Deriving it
 * is what stops raising either ceiling from quietly bringing that back.
 *
 * Four bytes per character is the worst an ordinary typed character costs once
 * UTF-8 encoded and JSON escaped, so a seller writing their product pages in
 * Devanagari (three bytes) sits comfortably inside this rather than near the
 * edge. The flat tail covers the rest of the patch — description, collection
 * details, the page design — which no tier count changes.
 */
const MAX_EVENT_BODY_BYTES =
  MAX_TIERS * (MAX_TIER_DETAILS + MAX_TIER_DESCRIPTION + MAX_TIER_NAME) * 4 + 64 * 1024;

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
  /** True when this ticket type is uncapped — `cap` is stored but not used. */
  unlimited: boolean;
  /** Announced, not yet sellable. */
  status: TierStatus;
  studentOnly: boolean;
  description: string;
  /** The long write-up behind this row's item page, or ''. */
  details: string;
  /** One of THIS listing's photo ids, or null. Never another listing's. */
  mediaId: string | null;
  /**
   * Seats one booking of this tier covers (a "Table of 8" is one booking,
   * eight seats, eight QR tickets). 1..20; 1 on every ordinary tier.
   */
  seatsPerUnit: number;
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
      const parsed = await readJsonLimited(req, MAX_EVENT_BODY_BYTES);
      need(Boolean(parsed) && typeof parsed === 'object' && !Array.isArray(parsed), 'Nothing to save.');
      body = parsed as Record<string, unknown>;
    } catch (e) {
      if (e instanceof BodyTooLargeError) {
        return NextResponse.json({ error: 'That request was too large.' } satisfies ApiErrorResponse, { status: 413 });
      }
      if (e instanceof ValidationError) throw e;
      return NextResponse.json({ error: 'Nothing to save.' } satisfies ApiErrorResponse, { status: 400 });
    }

    // ---- The payout account: prove it is still you -----------------------
    //
    // Every other field in this route is reversible. Where the money lands is
    // not — a buyer who has already transferred cannot un-transfer. So this one
    // change, alone in the whole editor, asks a second time.
    //
    // The rules live in lib/payoutStepUp.ts: only the fields that decide the
    // destination, only when the value genuinely moves, and never for the first
    // one set. The check happens BEFORE any validation or writing, so a request
    // that cannot pass it never touches the event at all.
    // Compared against the EFFECTIVE account — the one buyers are being given
    // right now — not the raw columns. A change whose waiting period has already
    // elapsed is the real account even if the row has not been tidied up, and
    // measuring against a stale value would ask for a code to "change" it back.
    const payoutNow = effectivePayout(event);
    const payoutBefore = {
      bankIban: payoutNow.iban,
      bankAccountHolder: payoutNow.holder,
      paypalAccount: payoutNow.paypal,
    };
    const payoutChange = summarisePayoutChange(payoutBefore, body);
    // A try-it-yourself demo (lib/demo.ts) keeps the example account it was
    // given: a demo listing takes no real money, and a real IBAN typed here
    // would only be a way to put somebody's bank details on a page.
    if (organizer.isDemo) {
      const moved =
        payoutChange.changed.length > 0 ||
        ('bankBic' in body && String(body.bankBic ?? '').trim() !== payoutNow.bic.trim()) ||
        ('bankName' in body && String(body.bankName ?? '').trim() !== payoutNow.bankName.trim());
      if (moved) {
        return NextResponse.json(
          {
            error:
              'This is a demo account, so its payment details are fixed. In a real account you enter your own IBAN or PayPal here.',
          } satisfies ApiErrorResponse,
          { status: 403 }
        );
      }
    }
    const stepUpMethod = payoutStepUpChallenge(organizer).method;
    if (payoutChange.changed.length > 0 && !payoutChange.firstTimeOnly) {
      const store = await cookies();
      if (!verifyStepUpToken(store.get(PAYOUT_STEP_UP_COOKIE)?.value ?? null, organizer.id)) {
        return NextResponse.json(
          {
            error: 'Changing where your ticket money is paid needs one more check.',
            stepUp: { required: true, ...payoutStepUpChallenge(organizer) },
          },
          { status: 403 }
        );
      }
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
        // Publishing REQUIRES this date (it starts the clock on the /privacy
        // erasure promise), and that gate only runs on the draft->published
        // transition — so clearing it afterwards would quietly reopen the very
        // hole the gate closes. A published event keeps a date; unpublish first
        // if it genuinely has to change. (merged.status is still the stored
        // status here — the status branch runs later in this handler.)
        need(
          merged.kind === 'shop' || merged.status !== 'published',
          'A published event needs its calendar date — take it offline first if the date must be cleared.'
        );
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
    // Shops only in practice — an event has a date and a venue for this job.
    // Not gated on kind, though: the column is harmless on an event, and a
    // silent refusal to save a field the form showed is worse than a stray one.
    if ('pickupInfo' in body) {
      const v = strField(body.pickupInfo, 'The collection details', MAX_PICKUP_INFO);
      set('pickup_info', v);
      merged.pickupInfo = v;
    }
    // The bazaar shelf a shop sits on. A closed list, not free text: /market
    // groups by this, and grouping only works when the values are shared — so
    // anything not on the list (except '', "not picked", which is always legal)
    // is refused rather than stored. Like pickupInfo above, not gated on kind.
    if ('category' in body) {
      const v = strField(body.category, 'The shop category', 40);
      need(v === '' || isShopCategory(v), 'Please pick a category from the list.');
      set('category', v);
      merged.category = v;
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
    if ('showRemaining' in body) {
      need(typeof body.showRemaining === 'boolean', 'The tickets-left switch must be on or off.');
      const v = body.showRemaining;
      set('show_remaining', v ? 1 : 0);
      merged.showRemaining = v;
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
    if ('whatsappFocus' in body) {
      need(typeof body.whatsappFocus === 'string', 'That focus point does not look right.');
      // Matched against the exact shape, never stored as sent: it is rendered
      // into a style attribute on a public page.
      need(FOCUS_RE.test(body.whatsappFocus as string), 'That focus point does not look right.');
      set('whatsapp_focus', body.whatsappFocus as string);
      merged.whatsappFocus = body.whatsappFocus as string;
    }
    if ('whatsapp' in body) {
      // Stored NORMALISED, never as typed. Everything downstream builds a
      // wa.me link from this column, so the column is where the guarantee that
      // it is nothing but digits has to hold — not at each render site.
      // Typed BEFORE it is coerced. Falling back to '' for a non-string quietly
      // cleared a working number instead of refusing the request — the one
      // outcome an organizer would never have asked for.
      need(typeof body.whatsapp === 'string', 'That WhatsApp number does not look right.');
      const digits = normalizeWhatsApp(body.whatsapp as string);
      need(
        digits === '' || isValidWhatsApp(digits),
        'That WhatsApp number does not look right — include your country code, like +49 170 1234567.'
      );
      set('whatsapp', digits);
      merged.whatsapp = digits;
    }
    if ('whatsappName' in body) {
      need(typeof body.whatsappName === 'string', 'That name does not look right.');
      // Single-line and bounded: it is rendered into the bubble's accessible
      // label as well as its visible text, and a name carrying newlines would
      // break that label into something a screen reader reads as two things.
      const name = (body.whatsappName as string)
        .replace(/[\u0000-\u001F\u007F]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 60);
      set('whatsapp_name', name);
      merged.whatsappName = name;
    }

    // ---- Bank details (the ORGANIZER's own account) ----------------------
    //
    // Gathered into ONE target account rather than five independent columns,
    // because a payout destination is a single thing and, when it has to wait,
    // it has to wait whole. Applying the holder today and the IBAN tomorrow
    // would leave a day in which the two describe different accounts — which is
    // exactly the confusion a buyer cannot be asked to resolve.
    const payoutTarget = { ...payoutNow };
    let payoutTouched = false;

    if ('bankAccountHolder' in body) {
      payoutTarget.holder = strField(body.bankAccountHolder, 'The account holder', 120);
      payoutTouched = true;
    }
    if ('bankIban' in body) {
      const v = strField(body.bankIban, 'The IBAN', 60);
      // A real check now — country length and the mod-97 check digits, not just
      // the shape. The two check digits exist so a mistyped account is caught
      // before anyone sends money to it; validating only the shape meant a
      // transposed pair of digits was stored, printed on every order page and
      // emailed to every buyer, and discovered when the transfers bounced.
      need(
        isValidIban(v),
        'That IBAN is not valid — please check it digit by digit. It should look like DE89 3704 0044 0532 0130 00.'
      );
      payoutTarget.iban = v;
      payoutTouched = true;
    }
    if ('bankBic' in body) {
      const v = strField(body.bankBic, 'The BIC', 20);
      const compact = v.replace(/\s+/g, '').toUpperCase();
      need(compact === '' || BIC_RE.test(compact), 'That does not look like a valid BIC — it is 8 or 11 characters, like COBADEFFXXX.');
      payoutTarget.bic = v;
      payoutTouched = true;
    }
    if ('paypalAccount' in body) {
      const v = strField(body.paypalAccount, 'The PayPal address', 120);
      need(
        isValidPaypalAccount(v),
        'That does not look like a PayPal address — use the email address on your PayPal account, or your PayPal.Me link.'
      );
      payoutTarget.paypal = v;
      payoutTouched = true;
    }
    if ('bankName' in body) {
      payoutTarget.bankName = strField(body.bankName, 'The bank name', 120);
      payoutTouched = true;
    }

    /**
     * Does this change have to wait before buyers are given it?
     *
     * Only once the event could ever have taken money (payout_locked), and only
     * when a DESTINATION actually moves — correcting the bank's display name on
     * a selling event is not worth a day's delay, and gating it would teach
     * organizers that the waiting period is arbitrary.
     *
     * Note this deliberately does NOT spare a first-time set the way the step-up
     * does. On an event that has already sold, adding a bank account where there
     * was only PayPal is a brand-new place for money to go, and "there was
     * nothing here before" is exactly the shape the attack would take.
     */
    const delayPayout = payoutTouched && payoutChange.changed.length > 0 && payoutChangeIsDelayed(event);

    if (payoutTouched && !delayPayout) {
      set('bank_account_holder', payoutTarget.holder);
      set('bank_iban', payoutTarget.iban);
      set('bank_bic', payoutTarget.bic);
      set('bank_name', payoutTarget.bankName);
      set('paypal_account', payoutTarget.paypal);
      merged.bankAccountHolder = payoutTarget.holder;
      merged.bankIban = payoutTarget.iban;
      merged.bankBic = payoutTarget.bic;
      merged.bankName = payoutTarget.bankName;
      merged.paypalAccount = payoutTarget.paypal;
    }
    // When it is delayed, `merged` is left alone on purpose: the publish
    // checklist below asks what buyers can pay TODAY, and today they still get
    // the old account.

    // ---- Which ways to pay this listing offers -----------------------------
    //
    // Three switches, no step-up: none of them moves money to a different
    // account. The transfer route still pays the account above, and an instant
    // route pays the seller's OWN connection (lib/paymentConnections), which is
    // guarded when it is set, not when it is offered. Turning an instant route
    // on without a connection is refused rather than saved as a promise the
    // checkout would silently break.
    if ('payTransfer' in body) {
      need(typeof body.payTransfer === 'boolean', 'That payment option does not look right.');
      set('pay_transfer', body.payTransfer ? 1 : 0);
      merged.payTransfer = body.payTransfer;
    }
    if ('payPaypal' in body) {
      need(typeof body.payPaypal === 'boolean', 'That payment option does not look right.');
      need(
        !body.payPaypal || getConnection(organizer.id, 'paypal') !== null,
        'Connect your PayPal account under Settings → Get paid instantly first.'
      );
      set('pay_paypal', body.payPaypal ? 1 : 0);
      merged.payPaypal = body.payPaypal;
    }
    if ('payStripe' in body) {
      need(typeof body.payStripe === 'boolean', 'That payment option does not look right.');
      need(
        !body.payStripe || getConnection(organizer.id, 'stripe') !== null,
        'Connect your Stripe account under Settings → Get paid instantly first.'
      );
      set('pay_stripe', body.payStripe ? 1 : 0);
      merged.payStripe = body.payStripe;
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
        need(typeof raw === 'string', 'Invalid listing photo choice.');
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
      // The ONLY photos a tier of this listing may point at: its own listing's,
      // and photos rather than videos. Read once, outside the loop. This is the
      // scoping guard — without it a body naming another organizer's media id
      // would render that photo on this page, which is both a leak and a
      // picture whose owner can delete it out from under a live listing.
      const ownPhotoIds = new Set(getEventMedia(event.id).map((m) => m.id));

      for (const raw of rows) {
        need(Boolean(raw) && typeof raw === 'object', 'Invalid ticket type.');
        const r = raw as Record<string, unknown>;
        const name = strField(r.name, 'Each ticket type name', MAX_TIER_NAME);
        need(name.length > 0, 'Every ticket type needs a name.');
        const priceCents = intField(r.priceCents, `The price of "${name}"`, 0, 5_000_000);
        const cap = intField(r.cap, `The ticket limit of "${name}"`, 0, 200000);
        // Absent on bodies from older clients — treated as limited, which is
        // what every event did before this flag existed.
        const unlimited = r.unlimited === true;
        // Whitelisted, and absent means on-sale: a body from an older client
        // must not be able to hide a ticket type an organizer is selling.
        const rawStatus = (r as { status?: unknown }).status;
        const status: TierStatus =
          rawStatus === 'coming-soon' || rawStatus === 'hidden' ? rawStatus : 'on-sale';
        need(typeof r.studentOnly === 'boolean', 'Student-only must be on or off.');
        const description = strField(r.description ?? '', `The description of "${name}"`, MAX_TIER_DESCRIPTION);
        const details = strField(r.details ?? '', `The details of "${name}"`, MAX_TIER_DETAILS);
        // A photo id that is not one of THIS listing's photos becomes no photo,
        // rather than a 400. Both halves are deliberate:
        //  - it is COERCED, not trusted, so the scoping rule is enforced here
        //    and not only where it is rendered;
        //  - it does not refuse the save, because the id most likely to be
        //    stale is one whose photo the organizer deleted in the Photos tab
        //    in another window, and refusing the whole tiers form over a
        //    thumbnail would block a price change behind a picture. Silently
        //    losing the picture is the smaller surprise, and the editor reloads
        //    from the server after every save so they see it immediately.
        const rawMediaId = (r as { mediaId?: unknown }).mediaId;
        const mediaId =
          typeof rawMediaId === 'string' && ownPhotoIds.has(rawMediaId) ? rawMediaId : null;

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

        const prior = existingTiers.find((t) => t.tierKey === tierKey);
        // Absent on bodies from older clients. For an EXISTING row that means
        // "unchanged" — a stale edit tab saving a price tweak must not quietly
        // turn a Table of 8 into a single ticket — and for a new row it means
        // one seat per booking, which is what every tier meant before bundles
        // existed. The 1..20 range is the rule everywhere this column is written.
        const seatsPerUnit =
          r.seatsPerUnit === undefined
            ? prior?.seatsPerUnit ?? 1
            : intField(r.seatsPerUnit, `Seats per booking for "${name}"`, 1, 20);
        // Frozen once anything has sold. Availability, unpaid holds and the QR
        // codes a confirmation mints are all derived from the CURRENT value, so
        // editing it would silently re-weight sold history — freeing phantom
        // seats in a full room, or changing how many tickets a table that was
        // already paid for hands out.
        if (prior && prior.seatsPerUnit !== seatsPerUnit) {
          need(
            !tierHasOrders(event.id, tierKey),
            `“${name}” already has orders, so its ${merged.kind === 'shop' ? 'items' : 'seats'} per booking can't change from ${prior.seatsPerUnit}. Hide it and add a new ${vocabFor(merged.kind).unitType} instead.`
          );
        }
        keep.push({ tierKey, name, priceCents, cap, unlimited, status, studentOnly: r.studentOnly, description, details, mediaId, seatsPerUnit });
      }

      // On a MIXED listing, a free tier must state a number. The room is one
      // shared pool: an unlimited €0 tier beside priced ones lets free RSVPs
      // quietly drain the seats the organizer meant to sell. All-free events
      // keep unlimited — there is no paid inventory to protect there.
      if (keep.some((t) => t.priceCents > 0)) {
        const openEnded = keep.find((t) => t.priceCents === 0 && t.unlimited);
        const units = vocabFor(merged.kind).units;
        need(
          !openEnded,
          openEnded
            ? `“${openEnded.name}” is free with no limit while other ${units} are priced — give it a fixed number, or the free spots can swallow the room the paid ${units} were meant to fill.`
            : ''
        );
      }

      const keptKeys = new Set(keep.map((t) => t.tierKey));
      const removeKeys = existingTiers.map((t) => t.tierKey).filter((k) => !keptKeys.has(k));
      for (const key of removeKeys) {
        const gone = existingTiers.find((t) => t.tierKey === key)!;
        need(
          !tierHasOrders(event.id, key),
          `“${gone.name}” already has orders, so it can't be removed. Set its limit to 0 to stop new sales instead.`
        );
      }
      tiersPlan = { keep, removeKeys };
    }

    // ---- Publish / unpublish --------------------------------------------
    if ('status' in body) {
      const status = body.status;
      need(status === 'draft' || status === 'published', 'Invalid status.');
      if (status === 'published' && event.status !== 'published') {
        // A try-it-yourself demo never goes live. Who can put a page in front
        // of the public is the platform's decision — real accounts are made
        // and approved by hand — so a demo gets a private preview instead.
        need(
          !organizer.isDemo,
          'Demo pages stay private — they can’t go live. Use “Preview my page” to see it; to sell for real, ask for an account.'
        );
        const tierCount = tiersPlan ? tiersPlan.keep.length : existingTiers.length;
        const v = vocabFor(merged.kind);
        // Which details are compulsory depends on the kind, and that rule lives
        // in lib/events beside the editor's progress ticks — a tick that says
        // "done" must never disagree with what this gate accepts.
        const missing = missingListingDetails(merged);
        if (tierCount < 1) missing.push(`add at least one ${v.unitType}`);
        // One working payment route is the requirement, not specifically a
        // bank one — and only when there is something to pay FOR. A free
        // event (every tier at zero) is an RSVP list; demanding an IBAN from
        // the person running a free community evening would block exactly the
        // organizer this platform most wants. The moment a priced tier
        // appears, the requirement comes back.
        const plannedTiers = tiersPlan ? tiersPlan.keep : existingTiers;
        const hasPaidTier = plannedTiers.some((t) => t.priceCents > 0);
        const hasBank = Boolean(merged.bankIban.trim() && merged.bankAccountHolder.trim());
        const hasPaypal = Boolean((merged.paypalAccount ?? '').trim());
        if (hasPaidTier && !hasBank && !hasPaypal) {
          missing.push('add a way to be paid — a bank account (holder and IBAN), or PayPal');
        }
        // Publishing is the moment this account stops being a draft and starts
        // taking strangers' money, so it is where the second factor becomes
        // required rather than encouraged. Demanding it at sign-up would strand
        // anyone without a smartphone before they had any stake; demanding it
        // here asks for it exactly when the stakes appear, alongside the fee and
        // the bank details they are already entering.
        //
        // It also closes a gap in the payout check. That check falls back to the
        // account password when no authenticator is enrolled — the weakest rung,
        // and the one somebody who phished the password can answer. Requiring
        // enrolment BEFORE any money can be taken means a payout change on a
        // selling event always meets the strong factor instead.
        if (requireAuthenticatorToPublish() && !organizerTotpEnabled(organizer.id)) {
          missing.push(`set up your authenticator app in Settings — it is required before you can sell ${v.units}`);
        }
        need(missing.length === 0, `Almost there — before publishing, please ${missing.join(', ')}.`);
      }
      if (status !== event.status) {
        set('status', status);
        merged.status = status;
        // From the first publish onwards this event can take money, so payout
        // changes start having to wait. Monotonic and set here rather than
        // inferred from status, because status can be moved back and
        // "unpublish, change, republish" must not be a way around the delay.
        if (status === 'published') set('payout_locked', 1);
      }
    }

    // A PUBLISHED listing with a priced tier must always have a way to be
    // paid — checked on the merged post-patch state, not only at the moment
    // of publishing. The publish gate alone left a hole: publish everything
    // free (correctly needing no IBAN), then quietly add a price afterwards,
    // and every buyer would hit "payment is not configured" while the
    // organizer heard nothing. This runs on EVERY save that would leave the
    // event published, so the warning lands at the moment the price is typed.
    {
      const plannedTiersNow = tiersPlan ? tiersPlan.keep : existingTiers;
      const hasPaidTierNow = plannedTiersNow.some((t) => t.priceCents > 0);
      const payable =
        Boolean(merged.bankIban.trim() && merged.bankAccountHolder.trim()) ||
        Boolean((merged.paypalAccount ?? '').trim());
      need(
        merged.status !== 'published' || !hasPaidTierNow || payable || organizer.isDemo,
        'This listing is live with a priced ticket, so it needs a way to be paid first — add a bank account (holder and IBAN) or PayPal, then set the price.'
      );
    }

    need(sets.length > 0 || tiersPlan !== null || delayPayout, 'Nothing to save.');

    // Fixed once, before the write, so the row, the record and the email all
    // name the same moment.
    const payoutEffectiveAt = delayPayout ? Date.now() + PAYOUT_DELAY_MS : null;

    const tx = db.transaction(() => {
      if (sets.length > 0) {
        db.prepare(`UPDATE events SET ${sets.join(', ')} WHERE id = ?`).run(...args, event.id);
      }
      if (tiersPlan) {
        const del = db.prepare(`DELETE FROM event_tiers WHERE event_id = ? AND tier_key = ?`);
        for (const key of tiersPlan.removeKeys) del.run(event.id, key);
        const upd = db.prepare(
          `UPDATE event_tiers SET name = ?, price_cents = ?, cap = ?, unlimited = ?, status = ?, student_only = ?, description = ?, details = ?, media_id = ?, sort = ?, seats_per_unit = ?
           WHERE event_id = ? AND tier_key = ?`
        );
        const ins = db.prepare(
          `INSERT INTO event_tiers (id, event_id, tier_key, name, price_cents, cap, unlimited, status, student_only, description, details, media_id, sort, seats_per_unit)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        );
        const existingKeys = new Set(existingTiers.map((t) => t.tierKey));
        tiersPlan.keep.forEach((t, sort) => {
          if (existingKeys.has(t.tierKey)) {
            upd.run(t.name, t.priceCents, t.cap, t.unlimited ? 1 : 0, t.status, t.studentOnly ? 1 : 0, t.description, t.details, t.mediaId, sort, t.seatsPerUnit, event.id, t.tierKey);
          } else {
            ins.run(newId(), event.id, t.tierKey, t.name, t.priceCents, t.cap, t.unlimited ? 1 : 0, t.status, t.studentOnly ? 1 : 0, t.description, t.details, t.mediaId, sort, t.seatsPerUnit);
          }
        });
      }
      // Same transaction as everything else: a queued payout change and the
      // record of it either both happen or neither does. A change that was
      // written but never recorded is the one case the audit trail must not
      // have.
      if (delayPayout) {
        queuePayoutChange(event.id, payoutTarget, payoutEffectiveAt!);
      }
      for (const field of payoutChange.changed) {
        recordPayoutChange({
          eventId: event.id,
          organizerId: organizer.id,
          field,
          oldValue: payoutBefore[field],
          newValue: typeof body[field] === 'string' ? (body[field] as string) : '',
          // Nothing was proved when nothing had to be: a first-time set is not
          // challenged, and the record should say so rather than imply a check
          // that never ran.
          factor: payoutChange.firstTimeOnly ? 'none' : stepUpMethod,
          effectiveAt: delayPayout ? payoutEffectiveAt! : null,
        });
      }
    });
    tx();

    // The alarm. It goes out AFTER the write, because it reports what is now
    // true, and it is awaited so it is on its way before the organizer is told
    // "Saved" — but it can never fail the save: the money already moved, and
    // refusing the response over a mail hiccup would only hide that.
    if (payoutChange.changed.length > 0) {
      await sendPayoutChangedEmail(
        { name: organizer.name, email: organizer.email },
        { id: event.id, name: event.name },
        {
          labels: payoutChange.labels,
          // The TARGET account, not `merged` — on a delayed change `merged`
          // still holds the old details on purpose, and an alarm that described
          // the account being replaced rather than the one replacing it would
          // tell the reader nothing they need.
          bankIban: payoutTarget.iban,
          paypalAccount: payoutTarget.paypal,
          firstTime: payoutChange.firstTimeOnly,
          effectiveAt: payoutEffectiveAt,
          // Reported, never refused. The honest variations on a person's own
          // name are endless, so a strict compare would mostly block real
          // organizers — but an account holder who shares no name at all with
          // the party we approved is the single clearest mule signal there is,
          // and it belongs in front of the one person who can act on it.
          holderName: payoutTarget.holder,
          nameMismatch:
            payoutTarget.holder.trim() !== '' &&
            !payoutNameMatchesOrganizer(organizer.name, payoutTarget.holder),
        }
      );
    }

    // German and Nepali copies of what was just written, in the background.
    void warmListingTranslations(id);

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
              unlimited: t.unlimited,
              status: t.status,
              studentOnly: t.studentOnly,
              description: t.description,
              details: t.details,
              mediaId: t.mediaId,
              seatsPerUnit: t.seatsPerUnit,
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
        `${removed.orders} orders, ${removed.tickets} tickets, ${removed.media} photos/videos, ` +
        `${removed.payoutChanges} payout-audit rows.`
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
