import { NextResponse } from 'next/server';
import { getEventById } from '@/lib/events';
import { currentOrganizer } from '@/lib/organizers';
import { getOrder } from '@/lib/orders';
import { rateLimit } from '@/lib/ratelimit';
import { remindBuyerNow } from '@/lib/reminders';
import type { ApiErrorResponse } from '@/lib/types';

/**
 * Send the buyer of one unpaid transfer reservation their payment reminder now
 * — the organizer who owns the order's event only, like its neighbours
 * mark-paid and resend. Once per order per day (lib/reminders.ts), and a cap
 * per organizer so the button can never become a way to mail a list.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const organizer = await currentOrganizer();
    const order = organizer ? getOrder(id) : null;
    const event = order ? getEventById(order.eventId) : null;
    if (!organizer || !order || !event || event.organizerId !== organizer.id) {
      return NextResponse.json({ error: 'Please sign in first.' } satisfies ApiErrorResponse, { status: 401 });
    }
    // A demo sends no email at all (lib/demo) — the button says so calmly.
    if (organizer.isDemo) return NextResponse.json({ sent: false, reason: 'demo' });
    if (!rateLimit(`remind-buyer:${organizer.id}`, 60, 60 * 60_000)) {
      return NextResponse.json({ sent: false, reason: 'too-many' }, { status: 429 });
    }

    return NextResponse.json(await remindBuyerNow(id));
  } catch (e) {
    console.error('POST /api/admin/orders/[id]/remind failed:', e);
    return NextResponse.json({ sent: false, reason: 'send-failed' });
  }
}
