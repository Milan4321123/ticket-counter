// Server-only: the CUSTOMER CARD — a seller's regulars, held by the buyer.
//
// A buyer who has just paid can ASK one organizer to keep a card for them. The
// card gives them one page (/c/<card_code>) with their own QR, the referral
// code their share links carry, the discount codes they are holding, and their
// history with that ONE seller — and it lets that seller recognise them at the
// counter instead of asking "have you been here before?".
//
// What it is NOT, and what no future change may quietly turn it into:
//  1. NOT a cross-seller identity. Every read in this file is scoped to one
//     organizer_id, and the table's UNIQUE (organizer_id, email) is what makes
//     "my card with this seller" a different object from "my card with that
//     one". Nothing here may ever answer "where else has this address been".
//  2. NOT a profile the platform builds behind anyone's back. A row exists
//     only because its owner pressed a button asking for it — which is also
//     the only reason it is allowed to outlive the after-event buyer erasure
//     in lib/retention.ts, exactly as the marketing consent in lib/marketing.ts
//     does. /privacy says this in the person's own language; keep the two true
//     to each other.
//  3. NOT a store of new personal data. The row holds an address and nothing
//     else. The holder's NAME shown at the counter is read out of their own
//     orders, which the organizer already has — the card copies nothing.
//
// The holder can close their card from the card page with no sign-in, and
// closing DELETES it. The platform owner can erase every card an address holds
// (eraseCustomerCards) for "delete everything about me" requests — the same
// admin path that erases the marketing consent book.
import crypto from 'crypto';
import { getDb } from './db';
import { confirmedReferralSql, listUnredeemedVouchers, referralProgressFor, type ReferralProgress, type VoucherRow } from './referrals';
import type { EventKind } from './types';

export interface CustomerCardRow {
  id: string;
  organizerId: string;
  email: string;
  cardCode: string;
  createdAt: string;
  lastSeenAt: string | null;
  closedAt: string | null;
}

const CARD_COLS = `
  id,
  organizer_id AS organizerId,
  email,
  card_code AS cardCode,
  created_at AS createdAt,
  last_seen_at AS lastSeenAt,
  closed_at AS closedAt
`;

// ---------------- The code, which is the whole secret ----------------

/**
 * Lowercase and unambiguous: no i/l/o/0/1, because a card code is occasionally
 * read off one screen and typed into another at a counter. Deliberately
 * lowercase where ticket and share codes are uppercase — see isCardCode.
 */
const CARD_CODE_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
/** Every card code starts with this, so a human looking at one knows what it is. */
const CARD_CODE_PREFIX = 'card-';
/** Characters of randomness after the prefix. */
const CARD_CODE_LENGTH = 24;

/**
 * Random, unguessable card code like "card-7k3mx2q9v8b6np5rzjt4h".
 *
 * Built the same way as generateShareCode in lib/orders.ts — random bytes
 * indexed into an alphabet — but MUCH longer, and the length is the point.
 * A share code is 8 characters because all it can do is tell an organizer's
 * insights who brought whom; guessing one buys a stranger nothing. This code
 * is the QR payload AND the entire private URL: whoever holds it opens
 * somebody's history with a seller, with no sign-in in the way, and it stays
 * valid for as long as the card exists. That makes it a password, not a label,
 * so it is sized like one — 24 characters of a 31-symbol alphabet is about
 * 119 bits, which is not brute-forceable at any rate the internet can offer.
 */
function generateCardCode(): string {
  const bytes = crypto.randomBytes(CARD_CODE_LENGTH);
  let s = '';
  for (let i = 0; i < CARD_CODE_LENGTH; i++) s += CARD_CODE_ALPHABET[bytes[i] % CARD_CODE_ALPHABET.length];
  return `${CARD_CODE_PREFIX}${s}`;
}

/** Trim and lowercase whatever was scanned, typed, or pasted into a URL. */
export function normalizeCardCode(raw: string): string {
  return (raw || '').trim().toLowerCase();
}

/**
 * Is this a CARD code rather than a TICKET code? The check-in scanner reads
 * both, so the two shapes must be impossible to confuse — and they are, by
 * LENGTH, which is the one thing neither side can drift into:
 *
 *   · a ticket code is exactly 8 characters of an UPPERCASE alphabet, shown
 *     and normalized as XXXX-XXXX (lib/tickets.ts normalizeTicketCode strips
 *     everything but A-Z0-9 and insists on 8);
 *   · a card code is the literal prefix "card-" plus exactly 24 LOWERCASE
 *     characters — 28 alphanumerics once the hyphen is stripped.
 *
 * 8 is not 28, so no string can satisfy both tests, and this holds even for
 * the one string that looks designed to break it: "CARD-7K3M" is a perfectly
 * legal TICKET code (C, A, R, D are all in the ticket alphabet), and it fails
 * here because its body is 4 characters, not 24. The prefix is a courtesy to
 * humans; the length is the guarantee.
 */
export function isCardCode(raw: string): boolean {
  return new RegExp(`^${CARD_CODE_PREFIX}[a-z0-9]{${CARD_CODE_LENGTH}}$`).test(normalizeCardCode(raw));
}

// ---------------- Issue, find, close ----------------

/** The live card (if any) this address holds with this ONE organizer. */
export function getCustomerCard(organizerId: string, email: string): CustomerCardRow | null {
  const address = (email || '').trim();
  if (!address) return null;
  return (
    (getDb()
      .prepare(
        `SELECT ${CARD_COLS} FROM customer_cards
         WHERE organizer_id = ? AND email = ? COLLATE NOCASE AND closed_at IS NULL`
      )
      .get(organizerId, address) as CustomerCardRow | undefined) ?? null
  );
}

/**
 * The card a code names, or null. The resolver behind /c/<code> and behind the
 * counter lookup: a closed card resolves to nothing, so a QR screenshotted
 * before somebody closed their card opens a 404 and not their history.
 *
 * Shape-checked before it touches the database, so a scanned ticket code (or
 * any other junk) can never even become a query.
 */
export function getCardByCode(rawCode: string): CustomerCardRow | null {
  const code = normalizeCardCode(rawCode);
  if (!isCardCode(code)) return null;
  return (
    (getDb()
      .prepare(`SELECT ${CARD_COLS} FROM customer_cards WHERE card_code = ? AND closed_at IS NULL`)
      .get(code) as CustomerCardRow | undefined) ?? null
  );
}

/**
 * Give this address a card with this organizer, because they asked for one.
 *
 * Idempotent on the live card: pressing the button twice (or a double-submit
 * from a slow connection) returns the SAME card rather than minting a second
 * secret for one person — UNIQUE (organizer_id, email) makes that structural
 * rather than hopeful.
 *
 * A CLOSED row is deleted and replaced instead of revived, and the new card
 * gets a NEW code. Somebody who closed their card destroyed that secret on
 * purpose; a QR they had already shared, printed, or lost must not start
 * working again because they later asked for a fresh card.
 *
 * The whole thing is one transaction so the delete and the insert cannot leave
 * the row half-replaced.
 */
export function issueCustomerCard(params: { organizerId: string; email: string }): CustomerCardRow {
  const db = getDb();
  const email = (params.email || '').trim();
  // A card is a card FOR somebody. Without an address there is no holder, and
  // a blank row would be a secret nobody can be shown and nobody can close.
  if (!email) throw new Error('A customer card needs an email address.');
  const tx = db.transaction(() => {
    const live = getCustomerCard(params.organizerId, email);
    if (live) return live;
    db.prepare(
      `DELETE FROM customer_cards WHERE organizer_id = ? AND email = ? COLLATE NOCASE`
    ).run(params.organizerId, email);
    const code = generateCardCode();
    db.prepare(
      `INSERT INTO customer_cards (id, organizer_id, email, card_code) VALUES (?, ?, ?, ?)`
    ).run(crypto.randomUUID(), params.organizerId, email, code);
    return getCardByCode(code)!;
  });
  return tx();
}

/**
 * Close a card from its own page: the row is DELETED, not flagged.
 *
 * Unlike an unsubscribe there is nothing to suppress afterwards — no checkout
 * tick, no import, and no organizer action can hand somebody a card; only the
 * person themselves can ask for one. So "closed" means gone, which is also the
 * only answer that matches what the button promises the holder.
 *
 * Returns true when a card was actually closed, so the page can tell "done"
 * from "that card was already gone".
 */
export function closeCustomerCard(rawCode: string): boolean {
  const code = normalizeCardCode(rawCode);
  if (!isCardCode(code)) return false;
  return getDb().prepare(`DELETE FROM customer_cards WHERE card_code = ?`).run(code).changes > 0;
}

/**
 * Erase every card an address holds, across ALL organizers — the "delete
 * everything about me" half of the /privacy promise, and the twin of
 * eraseMarketingConsent in lib/marketing.ts. Both are called by the platform
 * owner's erase button, because a person asking to be forgotten is asking the
 * platform, not one seller.
 *
 * Nothing references customer_cards, so a plain DELETE is the whole of it.
 * Returns how many cards were erased, so the caller can tell "forgotten" from
 * "never held one".
 */
export function eraseCustomerCards(email: string): number {
  const address = (email || '').trim();
  if (!address) return 0;
  return getDb().prepare(`DELETE FROM customer_cards WHERE email = ? COLLATE NOCASE`).run(address).changes;
}

/**
 * Remember that this card was just shown at a counter. Fire-and-forget on the
 * seller's lookup: it is what turns "a card" into "a regular", and it is the
 * ONLY thing a lookup writes.
 */
export function stampCardSeen(cardId: string): void {
  getDb().prepare(`UPDATE customer_cards SET last_seen_at = datetime('now') WHERE id = ?`).run(cardId);
}

// ---------------- The read model ----------------

/** One line of "what you have bought from this seller". */
export interface CardOrderRow {
  id: string;
  eventId: string;
  eventName: string;
  eventSlug: string;
  eventKind: EventKind;
  whenDisplay: string;
  totalCents: number;
  currency: string;
  createdAt: string;
  paidAt: string | null;
  buyerName: string;
  shareCode: string;
}

/**
 * This card holder's orders with THIS seller, newest first — and with nobody
 * else's, ever: the join runs through the organizer's own events, so an
 * address that also buys from three other sellers still sees only one seller's
 * history here.
 *
 * Confirmed bookings only, by the same confirmedReferralSql rule the referral
 * counting uses, so "your history" cannot disagree with "friends who booked":
 * an abandoned reservation is not something somebody bought, and a test-mode
 * order was never a purchase.
 *
 * Erased orders are excluded rather than shown as blanks. After the retention
 * sweep runs (lib/retention.ts) the buyer_email on those rows is a shared
 * placeholder, so matching on it would show one card holder a crowd of
 * strangers' orders — the exclusion is a correctness rule first and a privacy
 * one second.
 */
export function cardOrders(card: CustomerCardRow, limit = 50): CardOrderRow[] {
  return getDb()
    .prepare(
      `SELECT o.id,
              o.event_id AS eventId,
              e.name AS eventName,
              e.slug AS eventSlug,
              e.kind AS eventKind,
              e.date_display AS whenDisplay,
              o.total_cents AS totalCents,
              o.currency,
              o.created_at AS createdAt,
              o.paid_at AS paidAt,
              o.buyer_name AS buyerName,
              o.share_code AS shareCode
       FROM orders o
       JOIN events e ON e.id = o.event_id
       WHERE e.organizer_id = ?
         AND o.buyer_email = ? COLLATE NOCASE
         AND o.buyer_erased_at IS NULL
         AND ${confirmedReferralSql('o')}
       ORDER BY COALESCE(o.paid_at, o.created_at) DESC
       LIMIT ?`
    )
    .all(card.organizerId, card.email, limit) as CardOrderRow[];
}

/**
 * How many confirmed orders this holder has placed with this seller — the
 * whole number, not the page's worth. cardOrders() takes a LIMIT so a card
 * page never renders a decade of history, and counting its length would quietly
 * tell a ten-year regular they had bought fifty things.
 */
export function cardOrderCount(card: CustomerCardRow): number {
  const row = getDb()
    .prepare(
      `SELECT COUNT(*) AS n
       FROM orders o
       JOIN events e ON e.id = o.event_id
       WHERE e.organizer_id = ?
         AND o.buyer_email = ? COLLATE NOCASE
         AND o.buyer_erased_at IS NULL
         AND ${confirmedReferralSql('o')}`
    )
    .get(card.organizerId, card.email) as { n: number };
  return row.n;
}

/** Everything the card page shows its holder. */
export interface CustomerCardView {
  card: CustomerCardRow;
  /** The seller whose card this is — named on the page, per the disclosed-agent rule. */
  sellerName: string;
  /** Read off their newest order, never stored on the card itself. '' when unknown. */
  holderName: string;
  orders: CardOrderRow[];
  /** Their referral code (their newest order's share code), or null if they have none. */
  referralCode: string | null;
  /** The listing that code points at, so the code is something they can actually share. */
  referralSlug: string | null;
  rewards: ReferralProgress;
  /** Discount codes they are holding and have not spent. */
  vouchers: VoucherRow[];
}

/**
 * Build the card page's read model. Everything on it is per-seller: the orders
 * are this organizer's, the referral progress is this organizer's promise, and
 * the vouchers are this organizer's own discounts on their own prices.
 *
 * The seller's name is passed in rather than looked up, because the caller
 * already holds the organizer row it renders the page from.
 */
export function cardView(card: CustomerCardRow, sellerName: string): CustomerCardView {
  const orders = cardOrders(card);
  // The newest order that actually has a share code. Older orders predate the
  // column and carry '' — lib/orders referralCode returns null for those, and
  // so does this: a code that does not exist must not be printed as one.
  const withCode = orders.find((o) => o.shareCode);
  return {
    card,
    sellerName,
    holderName: orders[0]?.buyerName ?? '',
    orders,
    referralCode: withCode?.shareCode ?? null,
    referralSlug: withCode?.eventSlug ?? null,
    rewards: referralProgressFor(card.organizerId, card.email),
    vouchers: listUnredeemedVouchers(card.organizerId, card.email),
  };
}

/** What the organizer sees when a card is scanned at their counter. */
export interface CardAtCounter {
  cardCode: string;
  /** From their own orders — the card stores no name. '' when every order was erased. */
  holderName: string;
  email: string;
  /** How many confirmed orders they have placed with THIS seller. */
  confirmedOrders: number;
  /** Whole days since the card was issued, so "a regular since March" is sayable. */
  heldForDays: number;
  createdAt: string;
  lastSeenAt: string | null;
  /** Unspent discount codes, so the counter can honour one on the spot. */
  vouchers: VoucherRow[];
  currency: string;
}

/**
 * Recognise a regular. Called only from the ORGANIZER-authenticated lookup —
 * never from a tokenized door-staff scanner link, because a card names a
 * person and lists what they have bought, and door staff are handed a scanner
 * to check codes, not to read a customer's history.
 *
 * Ownership is the caller's to prove: pass the organizer whose session made
 * the request, and this returns null for a card belonging to anybody else.
 * Stamps last_seen_at on a hit, which is the one write a lookup performs.
 */
export function cardAtCounter(rawCode: string, organizerId: string): CardAtCounter | null {
  const card = getCardByCode(rawCode);
  if (!card || card.organizerId !== organizerId) return null;
  // Only the newest order, and only for the name on it — the counter is told
  // who this is and how often they come, never what they bought last time.
  const newest = cardOrders(card, 1);
  const progress = referralProgressFor(card.organizerId, card.email);
  stampCardSeen(card.id);
  const heldMs = Date.now() - new Date(`${card.createdAt.replace(' ', 'T')}Z`).getTime();
  return {
    cardCode: card.cardCode,
    holderName: newest[0]?.buyerName ?? '',
    email: card.email,
    confirmedOrders: cardOrderCount(card),
    // Negative can only come from a clock skew; a card is never held for less
    // than no time at all.
    heldForDays: Number.isFinite(heldMs) ? Math.max(0, Math.floor(heldMs / 86_400_000)) : 0,
    createdAt: card.createdAt,
    lastSeenAt: card.lastSeenAt,
    vouchers: listUnredeemedVouchers(card.organizerId, card.email),
    currency: progress.currency,
  };
}
