import { NextResponse } from 'next/server';
import { asLang } from '@/lib/i18n';
import { clientIp, rateLimit } from '@/lib/ratelimit';
import { MAX_BATCH, MAX_TEXT_LEN, translateTexts } from '@/lib/translate';

export const dynamic = 'force-dynamic';

/**
 * The page translator (components/AutoTranslate) asks here for the German or
 * Nepali of the text it finds on screen. Answers come from the shared cache
 * whenever possible (lib/translate).
 */
export async function POST(req: Request) {
  if (!rateLimit(`translate:${clientIp(req)}`, 90, 60_000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }
  const body = (await req.json().catch(() => null)) as { lang?: unknown; texts?: unknown } | null;
  const lang = asLang(body?.lang);
  const texts = Array.isArray(body?.texts)
    ? body.texts.filter((t): t is string => typeof t === 'string' && t.length > 0 && t.length <= MAX_TEXT_LEN).slice(0, MAX_BATCH)
    : [];
  if (lang === 'en' || texts.length === 0) return NextResponse.json({ map: {} });
  try {
    return NextResponse.json({ map: await translateTexts(lang, texts) });
  } catch (e) {
    console.error('POST /api/translate failed:', e);
    return NextResponse.json({ map: {} });
  }
}
