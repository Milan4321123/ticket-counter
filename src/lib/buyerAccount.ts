// Server-only: what an order page may show about the ADDRESS on the order,
// as opposed to about the order itself.
//
// The distinction this module exists to enforce:
//
//   · ORDER-level data — the tickets, the total, the payment reference — is
//     protected by the order id, which is a random UUID. Whoever holds it
//     created the order or was given the link by someone who did, and the
//     worst it shows them is the thing they already bought.
//
//   · ACCOUNT-level data — the referral vouchers this address holds with this
//     seller, and the customer card code that is the SOLE secret guarding
//     /c/<cardCode> and the whole history behind it — belongs to the MAILBOX,
//     not to the order. And orders.buyer_email is an unverified claim:
//     POST /api/orders only format-checks it and hands the new order id
//     straight back, so anyone can mint an order carrying anyone's address.
//
// Which is why every account-level read on the order page goes through this
// one function, and this one function opens only for a valid order access
// token (lib/orders.ts) — a secret that exists only inside email sent TO that
// address. If a future page wants to show a buyer something keyed off their
// email, add it to the view below rather than reading it at the call site;
// that is what keeps "an unverified address unlocks nothing" checkable in one
// place, and tested in tests/buyerAccount.test.ts.
import { getCustomerCard, issueCustomerCard, type CustomerCardRow } from './cards';
import { getEventById, getEventTiers } from './events';
import { referralProgressFor, referralRewardsReachable, type ReferralProgress } from './referrals';
import { getOrder, verifyOrderAccessToken, type OrderRow } from './orders';

export interface BuyerAccountView {
  /**
   * True when the reader proved they can read the order's mailbox. The page
   * uses it to explain the absence of the panels below rather than leaving a
   * legitimate buyer wondering where their rewards went.
   */
  mailboxProven: boolean;
  /**
   * This address's referral progress and unredeemed voucher codes with this
   * seller — null unless the mailbox was proven AND the seller's rewards can
   * actually be earned on this listing.
   */
  rewards: ReferralProgress | null;
  /** The live card this address holds with this seller, code and all. */
  card: CustomerCardRow | null;
  /**
   * Whether a card could exist for this address at all (a paid order whose
   * buyer has not been erased). Says nothing about whether one does — it is
   * what lets the page offer the button, or explain the missing panel,
   * without reading anything that belongs to the address.
   */
  cardPossible: boolean;
}

const SHUT: BuyerAccountView = { mailboxProven: false, rewards: null, card: null, cardPossible: false };

/**
 * Everything the order page is allowed to show about the buyer's account with
 * this seller, given whatever token came in on the URL.
 *
 * Fails closed on every axis: no token, a token for a different order, an
 * unpaid order, an order whose buyer has been erased by the retention sweep
 * (its address is then a shared placeholder, so anything keyed off it would be
 * a crowd of strangers), or a listing that no longer exists.
 */
export function buyerAccountForOrder(
  order: OrderRow,
  token: string | null | undefined
): BuyerAccountView {
  // Only a settled order has an account side at all — everything below is a
  // thank-you for a completed purchase, and the page's other states never
  // reach here.
  if (order.status !== 'paid' || order.buyerErasedAt || !order.buyerEmail.trim()) return SHUT;
  const event = getEventById(order.eventId);
  if (!event) return SHUT;

  const cardPossible = true;
  if (!verifyOrderAccessToken(order.id, token)) return { ...SHUT, cardPossible };

  // Rewards only where the promise can actually come true: this buyer's share
  // link points at THIS listing, and a referral is counted on the order it
  // brings here — so where nothing on sale costs money, no booking it brings
  // can ever be "actually paid for". Same function the public listing page
  // asks, so the offer somebody read before booking and the progress they read
  // after it are decided by one rule.
  const rewards = referralRewardsReachable(getEventTiers(event.id))
    ? referralProgressFor(event.organizerId, order.buyerEmail)
    : null;

  return {
    mailboxProven: true,
    rewards,
    card: getCustomerCard(event.organizerId, order.buyerEmail),
    cardPossible,
  };
}

/**
 * Issue the customer card the buyer pressed the button for — the ONLY path by
 * which the order page creates one, and the write-side twin of the read above.
 *
 * The order id in the form is transport, not authority: everything the card is
 * made from is re-read here from the order itself. The TOKEN is the authority,
 * and it is checked here rather than trusted because a form was rendered.
 * Without that check a stranger who typed a victim's address into a checkout
 * could conjure a card in that person's name — one they never asked for, and
 * one that would replace a card they had deliberately closed (issueCustomerCard
 * mints a NEW code over a closed row). lib/cards.ts opens by promising that a
 * card exists only because its owner asked for it; this is what keeps that
 * promise true rather than hopeful.
 *
 * Returns the card, or null when nothing was issued.
 */
export function issueCardForOrder(
  orderId: string,
  token: string | null | undefined
): CustomerCardRow | null {
  if (!verifyOrderAccessToken(orderId, token)) return null;
  const order = getOrder(orderId);
  if (!order || order.status !== 'paid' || order.buyerErasedAt || !order.buyerEmail.trim()) return null;
  const event = getEventById(order.eventId);
  if (!event) return null;
  return issueCustomerCard({ organizerId: event.organizerId, email: order.buyerEmail });
}
