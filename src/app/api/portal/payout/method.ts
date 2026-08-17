// Server-only: HOW an organizer is asked to re-prove themselves before their
// payout account moves. Shared by the challenge and verify routes so the ladder
// is decided in exactly one place — the two must never disagree about which
// factor is in play.
import { isEmailConfigured } from '@/lib/email';
import { organizerTotpEnabled } from '@/lib/organizerTotp';
import { maskEmail } from '@/lib/otp';
import type { OrganizerRow } from '@/lib/organizers';

export type StepUpMethod = 'authenticator' | 'email' | 'password';

export interface StepUpChallenge {
  method: StepUpMethod;
  /** One sentence naming where the code comes from, safe to show signed-in. */
  hint: string;
}

/**
 * The strongest factor this account can actually complete, in order.
 *
 * 1. AUTHENTICATOR, whenever it is enrolled. It needs no network, so it is the
 *    only rung that keeps working while outbound mail is unreliable — which,
 *    with no authenticated SendGrid domain, it currently is.
 * 2. EMAIL, when the platform has a working mail configuration. Weaker, and on
 *    some providers the message is silently dropped, which is why it is second.
 * 3. PASSWORD, when neither is available. It is the weakest of the three and
 *    still worth having: the threat is a session someone else is holding — a
 *    borrowed laptop, a cookie that was never signed out — and a session does
 *    not carry the password. Above all it means nobody is ever locked out of
 *    their own payout details by a mail path they do not control.
 */
export function payoutStepUpChallenge(organizer: OrganizerRow): StepUpChallenge {
  if (organizerTotpEnabled(organizer.id)) {
    return {
      method: 'authenticator',
      hint: 'Open your authenticator app and enter the current 6-digit code.',
    };
  }
  if (isEmailConfigured()) {
    return {
      method: 'email',
      hint: `We sent a 6-digit code to ${maskEmail(organizer.email)}. It expires in 10 minutes.`,
    };
  }
  return {
    method: 'password',
    hint: 'Enter your account password to confirm this change.',
  };
}
