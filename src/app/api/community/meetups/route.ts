import { NextResponse } from 'next/server';
import { memberCall, jsonError } from '@/lib/communityApi';
import { createMeetup } from '@/lib/meetups';

export const dynamic = 'force-dynamic';

/** Start a meetup: POST {title, about, category, city, place, date, time, capacity}. */
export async function POST(req: Request) {
  const call = await memberCall(req, 'meetup-create', 6);
  if (call instanceof NextResponse) return call;
  const result = createMeetup(call.member, call.body);
  if (!result.ok) return jsonError(result.error, 400);
  return NextResponse.json({ ok: true, id: result.id });
}
