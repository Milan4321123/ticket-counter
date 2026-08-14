// Hides the admin area behind a secret "unlock" URL.
//
// When ADMIN_GATE_PATH is set (e.g. "backstage-88907cbe"), every /admin page
// returns a normal 404 unless the browser carries the gate cookie. Visiting
// /<ADMIN_GATE_PATH> once sets that cookie (30 days) and redirects to the
// admin login. The real protection is still the password + emailed code —
// this only keeps the login form invisible to bots and casual visitors.
//
// Deliberately NOT gated: /api/admin/* — those endpoints already require an
// admin session, and door staff use /api/admin/checkin from scanner links
// without ever visiting the unlock URL.
//
// Runs in the Edge runtime: Web Crypto only, no node:crypto / DB imports.
import { NextRequest, NextResponse } from 'next/server';

const GATE_COOKIE = 'admin_gate';
const GATE_MAX_AGE_S = 30 * 24 * 60 * 60; // renewed every time the unlock link is opened

function gatePath(): string | null {
  const raw = (process.env.ADMIN_GATE_PATH ?? '').trim().replace(/^\/+|\/+$/g, '');
  if (!raw) return null;
  // Refuse values that would lock out or shadow real routes.
  if (raw === 'admin' || raw.includes('/')) return null;
  return raw;
}

/** Cookie value: HMAC(APP_SECRET, 'admin-gate') — unforgeable without the secret. */
async function gateCookieValue(gate: string): Promise<string> {
  const secret = process.env.APP_SECRET || `dev-gate:${gate}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode('admin-gate'));
  return Array.from(new Uint8Array(mac), (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function middleware(req: NextRequest) {
  const gate = gatePath();
  if (!gate) return NextResponse.next(); // feature off -> site behaves as before

  const path = req.nextUrl.pathname.replace(/\/+$/, '') || '/';

  if (path === `/${gate}`) {
    const res = NextResponse.redirect(new URL('/admin/login', req.url));
    res.cookies.set(GATE_COOKIE, await gateCookieValue(gate), {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: process.env.NODE_ENV === 'production',
      maxAge: GATE_MAX_AGE_S,
    });
    return res;
  }

  if (path === '/admin' || path.startsWith('/admin/')) {
    const cookie = req.cookies.get(GATE_COOKIE)?.value;
    if (cookie !== (await gateCookieValue(gate))) {
      // Render the site's regular 404 page, indistinguishable from any
      // other missing URL.
      return NextResponse.rewrite(new URL('/gate-hidden-404', req.url), { status: 404 });
    }
  }

  return NextResponse.next();
}

export const config = {
  // Skip Next.js internals and static assets; everything else is cheap no-ops
  // unless it's the unlock path or an /admin page.
  matcher: ['/((?!_next/|favicon.ico).*)'],
};
