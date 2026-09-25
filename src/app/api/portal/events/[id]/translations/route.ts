import { NextResponse } from 'next/server';
import { takeAiQuota } from '@/lib/aiQuota';
import { BodyTooLargeError, readJsonLimited } from '@/lib/http';
import { listingTranslationRows, saveManualTranslations, warmListingTranslations } from '@/lib/listingI18n';
import type { ApiErrorResponse } from '@/lib/types';
import { planGate, requireOrganizerApi, requireOwnedEvent } from '../../../auth';

export const dynamic = 'force-dynamic';

const bad = (error: string, status = 400) => NextResponse.json({ error } satisfies ApiErrorResponse, { status });
const asLang = (v: unknown) => (v === 'de' || v === 'ne' ? v : null);

/**
 * The editor's Languages section: the German and Nepali copies of a listing's
 * own words (lib/listingI18n). POST { lang, edits } keeps the organizer's own
 * wording for those fields; POST { retranslate: true } makes the machine copies
 * again (a hand-edited line is left as it is).
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireOrganizerApi();
  if (auth.failure) return auth.failure;
  const gate = planGate(auth.organizer);
  if (gate) return gate;
  const owned = requireOwnedEvent(auth.organizer, id);
  if (owned.failure) return owned.failure;

  let body: { lang?: unknown; edits?: unknown; retranslate?: unknown };
  try {
    body = ((await readJsonLimited(req, 128 * 1024)) ?? {}) as typeof body;
  } catch (e) {
    return bad(e instanceof BodyTooLargeError ? 'That is too much text at once.' : 'Nothing to save.');
  }

  if (body.retranslate === true) {
    if (!takeAiQuota([{ key: `retranslate:org:${auth.organizer.id}`, perDay: 15 }])) {
      return bad('That is enough re-translating for today — try again tomorrow.', 429);
    }
    await warmListingTranslations(id, { force: true });
  } else {
    const lang = asLang(body.lang);
    if (!lang) return bad('Pick German or Nepali.');
    if (!body.edits || typeof body.edits !== 'object') return bad('Nothing to save.');
    saveManualTranslations(id, lang, body.edits as Record<string, string>);
  }
  return NextResponse.json({ ok: true, de: listingTranslationRows(id, 'de'), ne: listingTranslationRows(id, 'ne') });
}
