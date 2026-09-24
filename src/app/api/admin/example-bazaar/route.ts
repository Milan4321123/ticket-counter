import { NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/auth';
import { currentSeedJob, exampleShopCount, startExampleBazaarJob } from '@/lib/exampleBazaar';
import type { ApiErrorResponse } from '@/lib/types';

export const dynamic = 'force-dynamic';

function status() {
  return { shops: exampleShopCount(), job: currentSeedJob() };
}

export async function GET() {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: 'Not signed in.' } satisfies ApiErrorResponse, { status: 401 });
  }
  return NextResponse.json(status());
}

/**
 * Put up or take down the example bazaar from the admin panel — runs
 * scripts/seed-bazaar.mjs in the background (lib/exampleBazaar); the panel
 * polls GET. { action: 'seed' | 'clean' }.
 */
export async function POST(req: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: 'Not signed in.' } satisfies ApiErrorResponse, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as { action?: unknown };
  const action = body.action === 'clean' ? 'clean' : body.action === 'seed' ? 'seed' : null;
  if (!action) return NextResponse.json({ error: 'Unknown action.' } satisfies ApiErrorResponse, { status: 400 });
  if (!startExampleBazaarJob(action)) {
    return NextResponse.json({ error: 'The example bazaar is already being updated — give it a few minutes.' } satisfies ApiErrorResponse, {
      status: 409,
    });
  }
  return NextResponse.json({ ok: true, started: true, ...status() }, { status: 202 });
}
