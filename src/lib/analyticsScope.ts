// Which pages analytics is allowed to see, and why the answer is "not those".
//
// This site has a private half, and its privacy does not come from a login —
// it comes from the URL itself being a secret:
//
//   /order/<uuid>?token=<hmac>   the token unlocks the buyer's vouchers, their
//                                card code and their review form
//   /ticket/<code>               the code IS the QR payload, scannable once
//   /c/<code>                    a customer card; the code is the whole
//                                security model (lib/cards)
//   /scan?...                    a signed, time-limited door-scanner link
//   /admin, /portal              back offices whose URLs carry listing and
//                                order ids
//
// Google Analytics reports `page_location`, which is the full URL. A tag on
// any of those pages would therefore hand Google — and anybody with access to
// the property's reports — a working key to a stranger's order, in a report
// nobody can un-send. So the tag is not merely discouraged there; it is not
// loaded at all.
//
// The list lives in its own module for two reasons. It is imported by a
// 'use client' component, so it must not reach anything server-only. And the
// same set of prefixes is written down in two other places — the `no-store`
// rules in next.config.mjs and the OFF_LIMITS list in
// scripts/audit-bazaar.mjs — which means "we remembered all three" is a claim
// worth testing rather than trusting. tests/analyticsScope.test.ts does
// exactly that by reading those two files.
//
// Safe on the client — no database, no server-only imports.

/**
 * Path prefixes analytics must never load on.
 *
 * Prefixes rather than exact paths because every one of these is a family:
 * /order/<id>, /ticket/<code>, /portal/events/<id>/edit. A bare '/admin' or
 * '/scan' is included by the equality arm of isPrivatePath below, so the
 * landing page of each area is covered as well as everything beneath it.
 */
export const ANALYTICS_PRIVATE_PREFIXES: readonly string[] = [
  '/order/',
  '/ticket/',
  '/c/',
  '/scan',
  '/admin',
  '/portal',
  /**
   * The admin gate's rewrite target, and the reason this list has an entry
   * nobody types.
   *
   * When ADMIN_GATE_PATH is set, middleware.ts answers /admin — and everything
   * under it — by REWRITING to /gate-hidden-404 with a 404 status, so a
   * stranger sees an ordinary missing page. A rewrite keeps the browser's URL
   * (/admin) but renders the other route, which means the pathname this
   * component sees while rendering on the SERVER is /gate-hidden-404: a path
   * that is not in this list and looks perfectly public.
   *
   * The effect is caught on the client — usePathname() there reports the real
   * /admin, so no page view is ever sent — but the tag has already been put
   * into the HTML by then, so Google's script loads and may set its cookie on
   * an admin page. Excluding the rewrite target stops it at the source.
   *
   * Found by looking: /admin was the one private path still carrying the tag
   * in a real build.
   */
  '/gate-hidden-404',
];

/**
 * True when this path is part of the private half of the site.
 *
 * Deliberately generous: it matches the area's own landing page as well as
 * everything under it, and it is only ever used to switch something OFF. A
 * false positive costs one page of analytics; a false negative costs somebody
 * their order token.
 */
export function isPrivatePath(pathname: string): boolean {
  return ANALYTICS_PRIVATE_PREFIXES.some(
    (prefix) => pathname === prefix.replace(/\/$/, '') || pathname.startsWith(prefix)
  );
}
