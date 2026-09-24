// Server-only: which language this request is in (the `lang` cookie, set by
// /api/lang). Falls back to English.
import { cookies } from 'next/headers';
import { asLang, LANG_COOKIE, translator, type Lang } from './i18n';

export async function currentLang(): Promise<Lang> {
  try {
    return asLang((await cookies()).get(LANG_COOKIE)?.value);
  } catch {
    return 'en';
  }
}

export async function serverT() {
  return translator(await currentLang());
}
