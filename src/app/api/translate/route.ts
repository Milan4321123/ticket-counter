import { NextResponse } from 'next/server';
import { takeAiQuota } from '@/lib/aiQuota';
import { asLang } from '@/lib/i18n';
import { clientIp, rateLimit } from '@/lib/ratelimit';
import { pageTextsToTranslate, translateTexts } from '@/lib/translate';

export const dynamic = 'force-dynamic';

/**
 * The page translator (components/AutoTranslate) asks here for the German or
 * Nepali of the text it finds on screen. Answers come from the shared cache
 * whenever possible (lib/translate). Anything shaped like contact details or
 * a site code is dropped here as well as in the browser (pageTextsToTranslate).
 */
export async function POST(req: Request) {
  if (!rateLimit(`translate:${clientIp(req)}`, 90, 60_000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }
  const body = (await req.json().catch(() => null)) as { lang?: unknown; texts?: unknown } | null;
  const lang = asLang(body?.lang);
  const texts = pageTextsToTranslate(body?.texts);
  if (lang === 'en' || texts.length === 0) return NextResponse.json({ map: {} });
  // A day's worth of browsing is a few hundred requests; past that, English.
  if (!takeAiQuota([{ key: `translate:ip:${clientIp(req)}`, perDay: 1500 }])) return NextResponse.json({ map: {} });
  try {
    return NextResponse.json({ map: await translateTexts(lang, texts) });
  } catch (e) {
    console.error('POST /api/translate failed:', e);
    return NextResponse.json({ map: {} });
  }
}
