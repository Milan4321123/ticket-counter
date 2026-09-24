import { NextResponse } from 'next/server';
import { getBaseUrl } from '@/lib/config';
import { asLang, LANG_COOKIE } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

/**
 * GET /api/lang?to=de&back=/market — set the language cookie and go back.
 * A plain link, so the switcher works without JavaScript. `back` must be a
 * path on this site (never an absolute URL), so this cannot redirect away.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const lang = asLang(url.searchParams.get('to'));
  const backRaw = url.searchParams.get('back') ?? '/';
  const back = backRaw.startsWith('/') && !backRaw.startsWith('//') ? backRaw : '/';
  const res = NextResponse.redirect(`${getBaseUrl()}${back}`, 303);
  res.cookies.set(LANG_COOKIE, lang, { path: '/', sameSite: 'lax', maxAge: 365 * 24 * 3600 });
  return res;
}
