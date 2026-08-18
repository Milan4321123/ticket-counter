import { NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/auth';
import { CapacityError, setEventCapacity } from '@/lib/capacity';
import { getEventById } from '@/lib/events';
import { getAvailability } from '@/lib/inventory';
import type { ApiErrorResponse } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * The platform owner releases more tickets for an event they do not own.
 *
 * Unlike the fee confirmation next door this needs no typed confirmation: it
 * cannot destroy anything. Every limit is guarded against dropping below what
 * has already been sold (see lib/capacity), so the worst a stray click can do
 * is change a number that the same screen shows and can change back — and the
 * change is recorded either way.
 *
 * Body: { totalCapacity: number, tierCaps?: { [tierKey: string]: number } }
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    if (!(await isAdminRequest())) {
      return NextResponse.json(
        { error: 'Please sign in to the admin area first.' } satisfies ApiErrorResponse,
        { status: 401 }
      );
    }

    if (!getEventById(id)) {
      return NextResponse.json(
        { error: 'That event no longer exists.' } satisfies ApiErrorResponse,
        { status: 404 }
      );
    }

    let body: { totalCapacity?: unknown; tierCaps?: unknown } | null = null;
    try {
      body = (await req.json()) as { totalCapacity?: unknown; tierCaps?: unknown };
    } catch {
      // handled below
    }

    const totalCapacity = Number(body?.totalCapacity);
    if (!Number.isFinite(totalCapacity)) {
      return NextResponse.json(
        { error: 'Enter a number for the total capacity.' } satisfies ApiErrorResponse,
        { status: 400 }
      );
    }

    // Only whole-number entries survive; anything else is dropped rather than
    // coerced, so a typo can never quietly become a limit.
    const tierCaps: Record<string, number> = {};
    const raw = body?.tierCaps;
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
        const n = Number(value);
        if (Number.isFinite(n)) tierCaps[key] = Math.trunc(n);
      }
    }

    const change = setEventCapacity(id, Math.trunc(totalCapacity), tierCaps);
    const availability = getAvailability(id);

    return NextResponse.json({
      ok: true,
      changed: change !== null,
      totalCap: availability.totalCap,
      totalSold: availability.totalSold,
      totalRemaining: availability.totalRemaining,
    });
  } catch (e) {
    if (e instanceof CapacityError) {
      return NextResponse.json({ error: e.message } satisfies ApiErrorResponse, { status: 400 });
    }
    console.error(`POST /api/admin/events/${id}/capacity failed:`, e);
    return NextResponse.json(
      { error: 'Could not update the ticket limits. Please try again.' } satisfies ApiErrorResponse,
      { status: 500 }
    );
  }
}
