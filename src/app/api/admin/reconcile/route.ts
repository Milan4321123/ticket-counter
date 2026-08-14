import { NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/auth';
import { reconcileOrders } from '@/lib/reconcile';
import type { ApiErrorResponse } from '@/lib/types';

export const dynamic = 'force-dynamic';

/** Resolve stuck/abandoned orders against PayPal. Admin-only. */
export async function POST() {
  try {
    if (!(await isAdminRequest())) {
      return NextResponse.json({ error: 'Not signed in.' } satisfies ApiErrorResponse, { status: 401 });
    }
    const result = await reconcileOrders();
    return NextResponse.json(result);
  } catch (e) {
    console.error('POST /api/admin/reconcile failed:', e);
    return NextResponse.json(
      { error: 'Reconciliation failed — check the server logs.' } satisfies ApiErrorResponse,
      { status: 500 }
    );
  }
}
