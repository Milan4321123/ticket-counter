import { NextResponse } from 'next/server';
import { isScanRequest } from '@/lib/auth';
import { checkInTicket } from '@/lib/orders';
import type { ApiErrorResponse, CheckinRequest, CheckinResponse } from '@/lib/types';

export async function POST(req: Request) {
  try {
    // Full admin session OR a door-scanner cookie from a valid scanner link.
    if (!(await isScanRequest())) {
      return NextResponse.json(
        { error: 'Please sign in to the admin area first, or open a valid scanner link.' } satisfies ApiErrorResponse,
        { status: 401 }
      );
    }

    let code = '';
    try {
      const body = (await req.json()) as CheckinRequest;
      if (typeof body?.code === 'string') code = body.code.trim().slice(0, 64);
    } catch {
      // Malformed body -> empty code -> not_found below.
    }

    if (!code) {
      return NextResponse.json({ result: 'not_found' } satisfies CheckinResponse);
    }

    return NextResponse.json(checkInTicket(code) satisfies CheckinResponse);
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' } satisfies ApiErrorResponse,
      { status: 500 }
    );
  }
}
