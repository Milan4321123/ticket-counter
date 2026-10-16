import { NextResponse } from 'next/server';
import { memberCall, jsonError } from '@/lib/communityApi';
import { deleteMeetupMessage, listMeetupMessages, postMeetupMessage } from '@/lib/meetups';

export const dynamic = 'force-dynamic';

/**
 * The meetup's group chat. GET ?after=<id> returns newer messages (the page
 * polls it while the chat is open); POST {body} sends one; POST {deleteId}
 * deletes one of your own.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const call = await memberCall(req, 'chat-read', 40, { readBody: false });
  if (call instanceof NextResponse) return call;
  const after = Number(new URL(req.url).searchParams.get('after') ?? '0');
  const messages = listMeetupMessages(call.member, id, Number.isFinite(after) && after > 0 ? Math.floor(after) : 0);
  if (!messages) return jsonError('Join the meetup to read its chat.', 403);
  return NextResponse.json({ messages }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const call = await memberCall(req, 'chat-write', 20);
  if (call instanceof NextResponse) return call;
  const { member, body } = call;
  if (typeof body.deleteId === 'number') {
    return deleteMeetupMessage(member, body.deleteId) ? NextResponse.json({ ok: true }) : jsonError('Not yours to delete.', 403);
  }
  const result = postMeetupMessage(member, id, body.body);
  if (!result.ok) return jsonError(result.error, 400);
  return NextResponse.json({ ok: true, message: result.message });
}
