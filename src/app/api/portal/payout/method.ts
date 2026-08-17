// Server-only: HOW an organizer is asked to re-prove themselves before their
// payout account moves. Shared by the verify route and the event-update gate so
// the rule is decided in exactly one place — the two must never disagree about
// which factor is in play.
import { organizerTotpEnabled } from '@/lib/organizerTotp';
import type { OrganizerRow } from '@/lib/organizers';

export type StepUpMethod = 'authenticator' | 'password';

export interface StepUpChallenge {
  method: StepUpMethod;
  /** One sentence naming what to enter, safe to show to a signed-in organizer. */
  hint: string;
  /** True when enrolling an authenticator would make this account safer. */
  urgeEnrolment: boolean;
}

/**
 * The strongest factor this account can actually complete.
 *
 * AUTHENTICATOR whenever it is enrolled, and it is the answer we want everyone
 * to reach. It is the only factor that survives BOTH the attacks that matter
 * here: someone holding a live session they were never meant to have, and
 * someone who has learned the password. It also needs no network, so it keeps
 * working while outbound mail does not.
 *
 * PASSWORD when no authenticator is enrolled. It is weaker and it is not
 * offered as an equal — it is the floor, and the reason there is a floor at all
 * is that "enrol first" would not actually be stronger for these accounts: an
 * attacker sitting in a stolen session could simply enrol THEIR OWN phone and
 * walk through the gate they were just sent to build. Asking for the password
 * is what that attacker cannot do. Enrolment itself is password-guarded for the
 * same reason (see /api/portal/totp).
 *
 * There is deliberately NO emailed-code rung. It was the weakest of the three,
 * and it is the one that does not arrive: until the sending domain is
 * authenticated, mail to some providers is silently dropped, so a factor that
 * depends on it is a lockout wearing a security badge.
 */
export function payoutStepUpChallenge(organizer: OrganizerRow): StepUpChallenge {
  if (organizerTotpEnabled(organizer.id)) {
    return {
      method: 'authenticator',
      hint: 'Open your authenticator app and enter the 6-digit code it shows now.',
      urgeEnrolment: false,
    };
  }
  return {
    method: 'password',
    hint: 'Enter the password you sign in with.',
    urgeEnrolment: true,
  };
}
