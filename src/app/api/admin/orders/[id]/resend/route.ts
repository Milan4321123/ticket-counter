import { NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/auth';
import { sendTicketEmail } from '@/lib/email';
import type { ApiErrorResponse } from '@/lib/types';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await isAdminRequest())) {
      return NextResponse.json(
        { error: 'Please sign in to the admin area first.' } satisfies ApiErrorResponse,
        { status: 401 }
      );
    }

    const { id } = await params;
    const result = await sendTicketEmail(id);
    return NextResponse.json(result);
  } catch {
    // sendTicketEmail is documented as never throwing, but stay safe anyway.
    return NextResponse.json({ sent: false, reason: 'The email could not be sent. Please try again.' });
  }
}
