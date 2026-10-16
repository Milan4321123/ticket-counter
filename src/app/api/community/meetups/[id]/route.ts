import { NextResponse } from 'next/server';
import { memberCall, jsonError } from '@/lib/communityApi';
import { approveRequest, cancelMeetup, joinMeetup, JOIN_MESSAGES, leaveMeetup, removeFromMeetup, resetInviteCode, updateMeetup } from '@/lib/meetups';

export const dynamic = 'force-dynamic';

/**
 * Everything one can do TO a meetup, by `action`:
 *   join {code?} · leave        — any member (code: a private meetup's invite)
 *   update {fields} · cancel    — the host
 *   approve · remove {handle}   — the host says yes to a request, or takes
 *                                 someone off / turns a request down
 *   new-link                    — the host retires the invite link
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const call = await memberCall(req, 'meetup', 40);
  if (call instanceof NextResponse) return call;
  const { member, body } = call;
  switch (body.action) {
    case 'join': {
      const outcome = joinMeetup(member, id, body.code);
      if (outcome === 'ok' || outcome === 'already') return NextResponse.json({ ok: true, joined: true });
      if (outcome === 'requested' || outcome === 'pending') return NextResponse.json({ ok: true, requested: true });
      return jsonError(JOIN_MESSAGES[outcome], outcome === 'not-found' ? 404 : 409);
    }
    case 'leave':
      return leaveMeetup(member, id) ? NextResponse.json({ ok: true, joined: false }) : jsonError('You are not on this meetup.', 409);
    case 'update': {
      const result = updateMeetup(member, id, body);
      return result.ok ? NextResponse.json({ ok: true, id }) : jsonError(result.error, 400);
    }
    case 'cancel':
      return cancelMeetup(member, id) ? NextResponse.json({ ok: true }) : jsonError('Only the host can cancel an open meetup.', 403);
    case 'approve': {
      const r = approveRequest(member, id, typeof body.handle === 'string' ? body.handle : '');
      return r === 'ok' ? NextResponse.json({ ok: true }) : jsonError(r === 'full' ? 'The meetup is full — raise the limit first.' : 'That request is gone.', 409);
    }
    case 'new-link':
      return resetInviteCode(member, id) ? NextResponse.json({ ok: true }) : jsonError('Only the host can do that.', 403);
    case 'remove':
      return removeFromMeetup(member, id, typeof body.handle === 'string' ? body.handle : '')
        ? NextResponse.json({ ok: true })
        : jsonError('Could not take them off.', 400);
    default:
      return jsonError('Unknown action.', 400);
  }
}
