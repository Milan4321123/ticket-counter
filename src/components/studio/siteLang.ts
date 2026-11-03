// A studio demo's own EN · DE · नेपाली switch is the site's language switch
// too: it sets the same `lang` cookie the site header sets, so the frame
// around the demo, the header and the next visit all agree. The caller then
// refreshes the server parts (router.refresh()).

export function setSiteLangCookie(lang: 'en' | 'de' | 'ne') {
  try {
    document.cookie = `lang=${lang}; path=/; max-age=${365 * 24 * 3600}; samesite=lax${location.protocol === 'https:' ? '; secure' : ''}`;
  } catch {
    /* cookies off: the demo still switches, the site just forgets */
  }
}
