import { NextResponse } from 'next/server';
import { getPublicConfig, getPaymentMode } from '@/lib/config';
import { getAvailabilityCached } from '@/lib/inventory';
import type { ApiErrorResponse } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json({
      config: getPublicConfig(),
      availability: getAvailabilityCached(),
      mode: getPaymentMode(),
      paypalClientId: process.env.PAYPAL_CLIENT_ID ?? null,
    });
  } catch (e) {
    console.error('GET /api/config failed:', e);
    return NextResponse.json<ApiErrorResponse>(
      { error: 'Something went wrong loading the event details. Please refresh and try again.', code: 'INTERNAL' },
      { status: 500 }
    );
  }
}
