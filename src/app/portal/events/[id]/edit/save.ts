// Client-safe helper shared by the editor's section forms: every section saves
// through the same PATCH-style update route with a partial body.

export interface SavedTier {
  tierKey: string;
  name: string;
  priceCents: number;
  cap: number;
  /** True when this ticket type has no limit — `cap` is then ignored. */
  unlimited: boolean;
  /** on-sale | coming-soon | hidden — see lib/events.ts TierStatus. */
  status: 'on-sale' | 'coming-soon' | 'hidden';
  studentOnly: boolean;
  description: string;
}

export interface SaveData {
  slug?: string;
  status?: string;
  tiers?: SavedTier[];
}

/**
 * How the server wants this organizer to re-prove themselves before their
 * payout account moves. Present ONLY on a refusal — see lib/payoutStepUp.ts.
 */
export interface StepUpRequest {
  required: true;
  method: 'authenticator' | 'password';
  hint: string;
  /** True when this account has no authenticator and would be safer with one. */
  urgeEnrolment: boolean;
}

export interface SaveResult {
  ok: boolean;
  error?: string;
  data?: SaveData;
  /** Set when the save was refused pending a payout confirmation. */
  stepUp?: StepUpRequest;
}

export async function saveEvent(eventId: string, patch: Record<string, unknown>): Promise<SaveResult> {
  try {
    const res = await fetch(`/api/portal/events/${eventId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const data = (await res.json().catch(() => null)) as
      | (SaveData & { ok?: boolean; error?: string; stepUp?: StepUpRequest })
      | null;
    if (!res.ok) {
      return {
        ok: false,
        error: data?.error ?? 'Something went wrong — please try again.',
        ...(data?.stepUp?.required ? { stepUp: data.stepUp } : {}),
      };
    }
    return { ok: true, data: data ?? undefined };
  } catch {
    return { ok: false, error: 'Could not reach the server — please check your connection and try again.' };
  }
}
