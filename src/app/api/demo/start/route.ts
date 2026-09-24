import { NextResponse } from 'next/server';
import { getBaseUrl } from '@/lib/config';
import {
  MAX_LIVE_DEMOS,
  createDemoSandbox,
  demoTargetPath,
  isDemoTarget,
  liveDemoCount,
  sweepExpiredDemos,
} from '@/lib/demo';
import {
  ORGANIZER_COOKIE_NAME,
  ORGANIZER_SESSION_TTL_MS,
  createOrganizerSessionToken,
  currentOrganizer,
} from '@/lib/organizers';
import { clientIp, rateLimit } from '@/lib/ratelimit';

export const dynamic = 'force-dynamic';

function back(reason: string, to: string): NextResponse {
  const q = new URLSearchParams({ error: reason });
  if (to) q.set('to', to);
  return NextResponse.redirect(`${getBaseUrl()}/demo?${q.toString()}`, 303);
}

/**
 * Start a try-it-yourself demo (lib/demo.ts): build the visitor their own demo
 * account and sign them in to it.
 *
 * POST only, from the button on /demo. Creating an account and replacing the
 * visitor's session is a state change, so it must never happen from a link, a
 * prefetch or an <img> on another site: the Origin has to be this site, and a
 * visitor signed in to a REAL organizer account is not signed out of it
 * without saying so (the page asks first and sends confirm=1).
 */
export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const rawTo = form?.get('to');
  const to = isDemoTarget(rawTo) ? rawTo : 'portal';

  const origin = req.headers.get('origin');
  if (origin) {
    let sameSite = false;
    try {
      sameSite = new URL(origin).host === new URL(req.url).host || new URL(origin).host === new URL(getBaseUrl()).host;
    } catch {
      sameSite = false;
    }
    if (!sameSite) return new NextResponse('Forbidden', { status: 403 });
  }

  const existing = await currentOrganizer();
  if (existing?.isDemo) {
    return NextResponse.redirect(`${getBaseUrl()}${demoTargetPath(existing.id, to)}`, 303);
  }
  if (existing && form?.get('confirm') !== '1') return back('signed-in', to);

  if (!rateLimit(`demo:start:${clientIp(req)}`, 4, 60 * 60_000)) return back('too-many', to);
  if (!rateLimit('demo:start:all', 120, 60 * 60_000)) return back('busy', to);

  sweepExpiredDemos(true);
  if (liveDemoCount() >= MAX_LIVE_DEMOS) return back('busy', to);

  let organizerId: string;
  try {
    ({ organizerId } = await createDemoSandbox());
  } catch (e) {
    console.error('Creating a demo account failed:', e);
    return back('failed', to);
  }

  let token: string;
  try {
    token = createOrganizerSessionToken(organizerId);
  } catch {
    return back('failed', to);
  }
  const res = NextResponse.redirect(`${getBaseUrl()}${demoTargetPath(organizerId, to)}`, 303);
  res.cookies.set(ORGANIZER_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    maxAge: Math.floor(ORGANIZER_SESSION_TTL_MS / 1000),
  });
  return res;
}
