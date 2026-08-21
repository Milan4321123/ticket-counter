// Server-only: what people who actually bought a thing said about it.
//
// Every other "rating" on the internet is a claim the site makes about itself.
// This one is a claim about an ORDER, and the order is the only door in: a row
// in item_reviews can exist only because somebody paid a shop for that exact
// item. Nothing else — no account, no sign-up, no "verified purchase" flag a
// script could set — decides who may write here.
//
// The eligibility rules therefore live in THIS file rather than in the route
// that calls it. A route is one caller; there will be more (the order page's
// panel, an eventual "review from your email" link, whatever the portal grows
// next), and a rule enforced in one caller is a rule the second caller forgets.
// writeReview() re-reads the order, the shop and the order's lines every time
// and refuses on its own, so the worst a broken caller can do is produce an
// error message instead of a row.
//
// Two things this deliberately does NOT do:
//
//   1. It never scores an item nobody has reviewed. ratingForItem() returns
//      null at zero reviews rather than 0.0, because a tile printing "0.0" or
//      five empty stars reads as "people rated this badly" and not as "nobody
//      has rated this yet". Every caller has to handle null, which is the
//      point — the honest empty state is unavoidable.
//   2. It never lets a seller edit or bury an opinion of their own goods.
//      setSellerReply() is the seller's whole power here; hiding is the
//      platform's, and it takes a written reason.
import crypto from 'crypto';
import { getDb } from './db';
import { getEventById, getEventTiers } from './events';
import { getOrder, getOrderItems } from './orders';
import { ANONYMOUS_BUYER_NAME, isErasedBuyer } from './retention';
import { chunkIds } from './sqlIn';

/** One person's opinion of one item, already resolved for rendering. */
export interface ReviewRow {
  id: string;
  eventId: string;
  tierKey: string;
  /**
   * The paid order this review came out of. It is the entire trust model, and
   * it is also why nothing on a public page may ever print it: it is a
   * capability — /order/<id> plus the token in the buyer's email — and a
   * review page that leaked it would hand a stranger somebody's order.
   */
  orderId: string;
  /** 1..5, whole stars. Never 0: a review with no rating is not a review. */
  rating: number;
  /** What they wrote, trimmed. '' is normal — plenty of people only rate. */
  body: string;
  /** "Sunita T.", or the anonymous label once the buyer has been erased. */
  authorName: string;
  createdAt: string;
  status: 'published' | 'hidden';
  /** Why the platform hid it, in the platform's own words. '' when published. */
  hiddenReason: string;
  /** The seller's public answer, or ''. The seller's only power over a review. */
  sellerReply: string;
  sellerReplyAt: string | null;
}

/**
 * How an item's reviews add up.
 *
 * `stars` is the count per rating, index 0 = one star through index 4 = five
 * stars — the five bars on the item page read straight off it, so no screen
 * has to re-derive a distribution from a list it may have paginated.
 *
 * `average` is already rounded to one decimal. Rounding HERE rather than in
 * each caller is what stops the tile saying 4.6 while the item page says 4.55
 * about the same jar.
 */
export interface RatingSummary {
  count: number;
  average: number;
  stars: [number, number, number, number, number];
}

/**
 * How much a buyer may write. Generous — somebody explaining that the achar is
 * hotter than they expected and that the jar arrived intact is doing the next
 * shopper a real favour, and cutting them off mid-sentence to save a kilobyte
 * would be absurd. It is a ceiling against pasted spam, not an editorial rule.
 */
export const MAX_REVIEW_CHARS = 1200;

/**
 * How much of a SELLER's reply is kept. The same ceiling: a reply is answering
 * a review, so it has no business being longer than one.
 */
const MAX_REPLY_CHARS = MAX_REVIEW_CHARS;

/**
 * How long a shortened author name may get before it is cut.
 *
 * "First L." is short by construction, but buyerName is free text a person
 * typed at checkout and nothing bounds it — a pasted paragraph would otherwise
 * become a byline that breaks every tile it lands on.
 */
const MAX_AUTHOR_CHARS = 60;

const REVIEW_COLS = `
  id,
  event_id AS eventId,
  tier_key AS tierKey,
  order_id AS orderId,
  rating,
  body,
  author_name AS authorName,
  created_at AS createdAt,
  status,
  hidden_reason AS hiddenReason,
  seller_reply AS sellerReply,
  seller_reply_at AS sellerReplyAt
`;

/**
 * The same columns again, qualified, for the two joined readers below.
 *
 * Spelled out rather than derived from REVIEW_COLS by string surgery: the
 * derivation would be four lines of clever that nobody reading the SQL could
 * check by eye, and the two lists have to stay identical or the portal and the
 * item page would map the same row into two different objects. Change one,
 * change the other — that is the whole maintenance burden.
 */
const REVIEW_COLS_R = `
  r.id,
  r.event_id AS eventId,
  r.tier_key AS tierKey,
  r.order_id AS orderId,
  r.rating,
  r.body,
  r.author_name AS authorName,
  r.created_at AS createdAt,
  r.status,
  r.hidden_reason AS hiddenReason,
  r.seller_reply AS sellerReply,
  r.seller_reply_at AS sellerReplyAt
`;

/**
 * Newest first, and then by id.
 *
 * created_at is SQLite's datetime('now') — whole seconds — so two reviews
 * written in the same second have no order at all unless one is given. Without
 * the tie-break the same list comes back in whatever sequence the planner felt
 * like, which is invisible in production and is exactly the kind of thing that
 * makes a test flap once a year.
 */
const NEWEST_FIRST = `ORDER BY created_at DESC, id DESC`;

// ---------------- The name a review is signed with ----------------

/**
 * The buyer's name as a review may print it: "Sunita T.".
 *
 * A first name and an initial is the most a public page gets, and it is a
 * deliberate loss of information rather than a formatting choice. The buyer
 * typed their name to collect an order, not to be published; a full surname
 * beside a town and a shop is enough to identify somebody in a community this
 * small, and the email — which is what most review systems quietly key on —
 * never comes near this file.
 *
 * The result is FROZEN into the row at write time rather than resolved on
 * every read, because the buyer's own row in `orders` is overwritten by the
 * retention sweep (lib/retention.ts) long before this review stops being
 * useful to a shopper. The sweep rewrites this column too, to the anonymous
 * label; it is the review's TEXT that survives, not its byline.
 *
 * A one-word name is printed whole: there is no surname to hold back, and
 * inventing an initial for a person called "Sunita" would be inventing data.
 * A name that turns out to be nothing at all falls back to the anonymous
 * label, because an empty byline reads as a bug rather than as a person.
 */
export function shortAuthorName(fullName: string): string {
  const words = (fullName || '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
  if (words.length === 0) return ANONYMOUS_BUYER_NAME;

  const first = words[0].slice(0, MAX_AUTHOR_CHARS);
  if (words.length === 1) return first;

  // Array.from, not [0]: a name in Devanagari (or anything else outside the
  // basic plane) would otherwise be cut through the middle of a code point and
  // printed as a replacement character.
  const initial = Array.from(words[words.length - 1])[0] ?? '';
  return initial ? `${first} ${initial}.` : first;
}

/** The byline this order has earned — erased buyers lose theirs, not their words. */
function authorNameForOrder(order: { buyerName: string; buyerEmail: string; buyerErasedAt: string | null }): string {
  if (isErasedBuyer(order)) return ANONYMOUS_BUYER_NAME;
  return shortAuthorName(order.buyerName);
}

// ---------------- Writing one ----------------

/**
 * The items on this order that its buyer is allowed to review, with whatever
 * they have already written about each.
 *
 * Returns [] — not an error — for every order that may not review anything:
 * unpaid, not a shop, or simply gone. The order page renders the panel from
 * this list, so an empty list is the whole answer and no caller has to repeat
 * the eligibility rules to decide whether to show it.
 *
 * An item whose tier its seller has since DELETED drops off the list: there is
 * no name left to print beside a star input, and a review of a row that no
 * longer exists could never be shown to anybody. Merely hidden or sold-out
 * tiers stay — the buyer bought the thing, and whether it is still on sale is
 * not their business.
 */
export function reviewableItems(orderId: string): { tierKey: string; name: string; existing: ReviewRow | null }[] {
  const order = getOrder(orderId);
  if (!order || order.status !== 'paid') return [];
  const shop = getEventById(order.eventId);
  if (!shop || shop.kind !== 'shop') return [];

  const tiers = new Map(getEventTiers(shop.id).map((t) => [t.tierKey, t]));
  const mine = new Map(
    (
      getDb()
        .prepare(`SELECT ${REVIEW_COLS} FROM item_reviews WHERE order_id = ?`)
        .all(orderId) as ReviewRow[]
    ).map((r) => [r.tierKey, r])
  );

  const out: { tierKey: string; name: string; existing: ReviewRow | null }[] = [];
  for (const line of getOrderItems(orderId)) {
    const tier = tiers.get(line.tierId);
    if (!tier) continue;
    out.push({ tierKey: tier.tierKey, name: tier.name, existing: mine.get(tier.tierKey) ?? null });
  }
  return out;
}

/**
 * Write (or rewrite) one buyer's review of one item they paid for.
 *
 * Throws on every refusal, with a message written for the person who will read
 * it on a screen — the API route passes it straight back. It is deliberately
 * not a boolean: "no" here always has a reason, and a caller that got `false`
 * would have to guess which of six rules it broke in order to say anything
 * useful to the buyer.
 *
 * THE RULES, all re-checked from the database on every call:
 *   · the order exists and its status is 'paid' — a reservation nobody has
 *     paid for is a promise, not a purchase, and cancelled orders stay out;
 *   · its listing is a SHOP. An event's ticket tiers are not goods, and a
 *     star rating under "Standard ticket" would be a review of somebody's
 *     evening rather than of a thing that was sold;
 *   · the order genuinely contains this tier. Without this check the token in
 *     one order's link would let its holder review every item in the shop;
 *   · the rating is a whole 1..5, and the body fits.
 *
 * Note that NONE of these is the authentication: proving the caller is that
 * buyer is the route's job (verifyOrderAccessToken, which only the emailed
 * link carries). These rules say what a review may be ABOUT; the token says
 * who is speaking. Both are needed, and neither substitutes for the other.
 */
export function writeReview(p: { orderId: string; tierKey: string; rating: number; body: string }): ReviewRow {
  const order = getOrder(p.orderId);
  if (!order) throw new Error('That order could not be found.');
  if (order.status !== 'paid') {
    throw new Error('Reviews can only be written once the order has been paid.');
  }

  const shop = getEventById(order.eventId);
  if (!shop) throw new Error('That order could not be found.');
  if (shop.kind !== 'shop') {
    throw new Error('Only things bought from a shop can be reviewed.');
  }

  const tierKey = (p.tierKey || '').trim();
  if (!getOrderItems(p.orderId).some((line) => line.tierId === tierKey)) {
    throw new Error('That item is not on this order.');
  }

  if (!Number.isInteger(p.rating) || p.rating < 1 || p.rating > 5) {
    throw new Error('Please choose between one and five stars.');
  }

  const body = (p.body || '').trim();
  if (body.length > MAX_REVIEW_CHARS) {
    // Refused rather than silently cut: a review that lost its last sentence
    // without anybody being told is worse than a review that was not saved.
    throw new Error(`Please keep it under ${MAX_REVIEW_CHARS} characters.`);
  }

  const authorName = authorNameForOrder(order);
  const db = getDb();

  // One row per (order, tier), enforced by the table's own UNIQUE — so this is
  // an upsert rather than a select-then-insert, and two submissions racing each
  // other end as one row rather than as a constraint error on the second.
  //
  // What the update deliberately does NOT touch:
  //   · status and hidden_reason. A review the platform hid stays hidden; if
  //     editing it republished it, anything hidden could be brought back by
  //     its author pressing submit again.
  //   · seller_reply. The seller wrote those words in public and nobody else
  //     gets to delete them — not even by editing the review they answer.
  //   · created_at. The date on the page is when this opinion was first
  //     formed; updated_at records that it was revisited.
  //
  // author_name IS rewritten, because a buyer erased between the two writes
  // must not have their name reinstated by their own edit — authorNameForOrder
  // has already degraded it above.
  db.prepare(
    `INSERT INTO item_reviews (id, event_id, tier_key, order_id, rating, body, author_name)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (order_id, tier_key) DO UPDATE SET
       rating = excluded.rating,
       body = excluded.body,
       author_name = excluded.author_name,
       updated_at = datetime('now')`
  ).run(crypto.randomUUID(), shop.id, tierKey, order.id, p.rating, body, authorName);

  return db
    .prepare(`SELECT ${REVIEW_COLS} FROM item_reviews WHERE order_id = ? AND tier_key = ?`)
    .get(order.id, tierKey) as ReviewRow;
}

// ---------------- Reading them ----------------

/** One item's published reviews, newest first. Hidden rows are not returned. */
export function listReviewsForItem(eventId: string, tierKey: string): ReviewRow[] {
  return getDb()
    .prepare(
      `SELECT ${REVIEW_COLS} FROM item_reviews
       WHERE event_id = ? AND tier_key = ? AND status = 'published'
       ${NEWEST_FIRST}`
    )
    .all(eventId, tierKey) as ReviewRow[];
}

/**
 * Fold per-rating counts into a summary, or null when there is nothing to fold.
 *
 * The null is the honest empty state and every caller has to deal with it —
 * see the note at the top of this file about why a zero average may never
 * reach a screen.
 */
function summarize(counts: { rating: number; n: number }[]): RatingSummary | null {
  const stars: [number, number, number, number, number] = [0, 0, 0, 0, 0];
  let count = 0;
  let total = 0;
  for (const row of counts) {
    // A rating outside 1..5 cannot be written by writeReview, so this only
    // guards against a hand-edited row; it is dropped rather than allowed to
    // pull an average nobody could explain.
    if (!Number.isInteger(row.rating) || row.rating < 1 || row.rating > 5) continue;
    stars[row.rating - 1] += row.n;
    count += row.n;
    total += row.rating * row.n;
  }
  if (count === 0) return null;
  return { count, average: Math.round((total / count) * 10) / 10, stars };
}

/** One item's rating, or null when nobody has reviewed it. Published rows only. */
export function ratingForItem(eventId: string, tierKey: string): RatingSummary | null {
  const rows = getDb()
    .prepare(
      `SELECT rating, COUNT(*) AS n FROM item_reviews
       WHERE event_id = ? AND tier_key = ? AND status = 'published'
       GROUP BY rating`
    )
    .all(eventId, tierKey) as { rating: number; n: number }[];
  return summarize(rows);
}

/**
 * Every rated item across MANY shops, keyed `${eventId}:${tierKey}`.
 *
 * The batch companion to ratingForItem, and the only one the bazaar-wide pages
 * are allowed to use: /market, /market/items and every rail hold hundreds of
 * tiles, and a ratingForItem() inside that loop is the N+1 that lib/sqlIn.ts
 * and loadFeedSnapshot exist to prevent. One statement covers the whole page —
 * or one per 500 shops once the bazaar outgrows a single IN-list, exactly as
 * getEventTiersBulk chunks.
 *
 * Grouped by rating as well as by item so the five-bar distribution comes back
 * from the same read as the average; a second query for the bars would put
 * back half the trips this saves.
 *
 * An item nobody has reviewed is ABSENT from the map rather than present with
 * a zero — `map.get(key) ?? null` is then already the honest answer, and no
 * caller can accidentally render an empty summary as a bad score.
 */
export function ratingsForItems(eventIds: string[]): Map<string, RatingSummary> {
  const perItem = new Map<string, { rating: number; n: number }[]>();

  for (const batch of chunkIds(eventIds)) {
    const rows = getDb()
      .prepare(
        `SELECT event_id AS eventId, tier_key AS tierKey, rating, COUNT(*) AS n
         FROM item_reviews
         WHERE status = 'published' AND event_id IN (${batch.map(() => '?').join(',')})
         GROUP BY event_id, tier_key, rating`
      )
      .all(...batch) as { eventId: string; tierKey: string; rating: number; n: number }[];
    for (const r of rows) {
      const key = `${r.eventId}:${r.tierKey}`;
      const list = perItem.get(key);
      if (list) list.push({ rating: r.rating, n: r.n });
      else perItem.set(key, [{ rating: r.rating, n: r.n }]);
    }
  }

  const out = new Map<string, RatingSummary>();
  for (const [key, counts] of perItem) {
    const summary = summarize(counts);
    if (summary) out.set(key, summary);
  }
  return out;
}

/**
 * A whole shop's rating — every published review of everything it sells.
 *
 * Deliberately NOT an average of its items' averages: that would give a jar
 * nobody but one person has bought the same weight as the momo fifty people
 * have, and a seller could lift their shop's score by listing a well-reviewed
 * item twice. Every review counts once, which is the only arithmetic a seller
 * can neither game nor be surprised by.
 */
export function ratingForShop(eventId: string): RatingSummary | null {
  const rows = getDb()
    .prepare(
      `SELECT rating, COUNT(*) AS n FROM item_reviews
       WHERE event_id = ? AND status = 'published'
       GROUP BY rating`
    )
    .all(eventId) as { rating: number; n: number }[];
  return summarize(rows);
}

/**
 * Everything written about one seller's goods, across all of their shops.
 *
 * INCLUDES hidden rows, unlike every public reader above: this is the seller's
 * own screen, and a review that vanished from it without explanation would
 * leave them arguing with a score they cannot see the cause of. The row
 * carries its status and hidden_reason so the page can say which it is.
 *
 * eventName is the RAW listing name, mark and all — the portal renders it
 * through readListingName() like every other listing name, and stripping it
 * here would leave that page unable to show the Example shop badge.
 *
 * tierName falls back to the tier key for an item whose row has since been
 * deleted: the seller can still see what was said, and a blank where the
 * product name should be would look like a bug in the page.
 */
export function listReviewsForOrganizer(
  organizerId: string
): (ReviewRow & { eventName: string; eventSlug: string; tierName: string })[] {
  return getDb()
    .prepare(
      `SELECT ${REVIEW_COLS_R},
        e.name AS eventName,
        e.slug AS eventSlug,
        COALESCE(t.name, r.tier_key) AS tierName
       FROM item_reviews r
       JOIN events e ON e.id = r.event_id
       LEFT JOIN event_tiers t ON t.event_id = r.event_id AND t.tier_key = r.tier_key
       WHERE e.organizer_id = ?
       ORDER BY r.created_at DESC, r.id DESC`
    )
    .all(organizerId) as (ReviewRow & { eventName: string; eventSlug: string; tierName: string })[];
}

/** Newest reviews on the whole platform, hidden ones included — admin only. */
export function listAllReviews(limit = 200): (ReviewRow & { eventName: string; eventSlug: string })[] {
  const capped = Number.isInteger(limit) && limit > 0 ? Math.min(limit, 1000) : 200;
  return getDb()
    .prepare(
      `SELECT ${REVIEW_COLS_R},
        e.name AS eventName,
        e.slug AS eventSlug
       FROM item_reviews r
       JOIN events e ON e.id = r.event_id
       ORDER BY r.created_at DESC, r.id DESC
       LIMIT ${capped}`
    )
    .all() as (ReviewRow & { eventName: string; eventSlug: string })[];
}

// ---------------- Answering and moderating ----------------

/**
 * The seller's public answer to a review of their own goods.
 *
 * Ownership is a condition of the UPDATE rather than a check before it: with a
 * separate "does this organizer own it?" read there are two statements and a
 * gap between them, and the whole guard depends on the caller remembering to
 * run the first one. Here a reviewId belonging to somebody else's shop simply
 * matches no row and the function returns false.
 *
 * An empty reply RETRACTS: the seller may take their own words back down (the
 * stamp goes with them), which is the one deletion anybody is allowed here.
 * They still cannot touch the review itself — /portal/reviews says so plainly.
 */
export function setSellerReply(reviewId: string, organizerId: string, reply: string): boolean {
  const text = (reply || '').trim().slice(0, MAX_REPLY_CHARS);
  return (
    getDb()
      .prepare(
        `UPDATE item_reviews
         SET seller_reply = ?, seller_reply_at = ${text ? "datetime('now')" : 'NULL'}
         WHERE id = ?
           AND event_id IN (SELECT id FROM events WHERE organizer_id = ?)`
      )
      .run(text, reviewId, organizerId).changes > 0
  );
}

/**
 * Hide or restore a review. The PLATFORM's power, not the seller's — the whole
 * point of reviews is that the person being reviewed cannot make them go away,
 * so this lives behind the admin session and nowhere else.
 *
 * Hiding takes a reason and keeps it on the row: a moderation decision nobody
 * wrote down is a decision nobody can defend later, and the reason is what the
 * seller and the buyer are told if either asks. Restoring clears it, because a
 * published review carrying an old "hidden because…" note would be read as a
 * warning about a review that is, in fact, fine.
 *
 * Nothing is ever deleted. A hidden row still counts as that order's review,
 * so its author cannot slip a second one past the UNIQUE by being moderated.
 */
export function setReviewStatus(reviewId: string, status: 'published' | 'hidden', reason: string): boolean {
  const text = status === 'hidden' ? (reason || '').trim().slice(0, MAX_REPLY_CHARS) : '';
  return (
    getDb()
      .prepare(`UPDATE item_reviews SET status = ?, hidden_reason = ? WHERE id = ?`)
      .run(status, text, reviewId).changes > 0
  );
}

/**
 * Take the author's name off every review this order produced, leaving the
 * reviews themselves exactly as they were.
 *
 * Called for a single order on the "erase everything about me" path; the
 * nightly sweep in lib/retention.ts does the same thing set-wise for every
 * order it erases. Both halves must agree, and both say the same thing in
 * their comments: what is being removed is the PERSON, not what they observed
 * about a jar of achar. The next shopper deciding whether it is too hot for
 * them is owed that sentence whether or not its author is still identifiable,
 * and the seller's score would otherwise quietly improve every time somebody
 * was erased.
 *
 * Idempotent: a second run touches no row, because the name is already the
 * label it would be set to.
 */
export function anonymizeReviewsForOrder(orderId: string): void {
  getDb()
    .prepare(`UPDATE item_reviews SET author_name = ? WHERE order_id = ? AND author_name <> ?`)
    .run(ANONYMOUS_BUYER_NAME, orderId, ANONYMOUS_BUYER_NAME);
}
