import { NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/auth';
import { purgeMockOrders } from '@/lib/orders';
import type { ApiErrorResponse } from '@/lib/types';

export const dynamic = 'force-dynamic';

/** Delete all test-mode (mock) orders and tickets. Admin-only. */
export async function POST() {
  try {
    if (!(await isAdminRequest())) {
      return NextResponse.json({ error: 'Not signed in.' } satisfies ApiErrorResponse, { status: 401 });
    }
    const result = purgeMockOrders();
    return NextResponse.json(result);
  } catch (e) {
    console.error('POST /api/admin/purge-mock failed:', e);
    return NextResponse.json(
      { error: 'Could not delete test orders — check the server logs.' } satisfies ApiErrorResponse,
      { status: 500 }
    );
  }
}
