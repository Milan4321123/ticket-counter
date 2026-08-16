// Client-safe helper shared by the editor's section forms: every section saves
// through the same PATCH-style update route with a partial body.

export interface SavedTier {
  tierKey: string;
  name: string;
  priceCents: number;
  cap: number;
  /** True when this ticket type has no limit — `cap` is then ignored. */
  unlimited: boolean;
  studentOnly: boolean;
  description: string;
}

export interface SaveData {
  slug?: string;
  status?: string;
  tiers?: SavedTier[];
}

export interface SaveResult {
  ok: boolean;
  error?: string;
  data?: SaveData;
}

export async function saveEvent(eventId: string, patch: Record<string, unknown>): Promise<SaveResult> {
  try {
    const res = await fetch(`/api/portal/events/${eventId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const data = (await res.json().catch(() => null)) as (SaveData & { ok?: boolean; error?: string }) | null;
    if (!res.ok) {
      return { ok: false, error: data?.error ?? 'Something went wrong — please try again.' };
    }
    return { ok: true, data: data ?? undefined };
  } catch {
    return { ok: false, error: 'Could not reach the server — please check your connection and try again.' };
  }
}
