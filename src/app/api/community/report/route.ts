import { NextResponse } from 'next/server';
import { blockMember, reportContent, unblockMember } from '@/lib/community';
import { memberCall, jsonError } from '@/lib/communityApi';

export const dynamic = 'force-dynamic';

/**
 * Report something, or block / unblock a member.
 *
 * POST {type, id, reason, note?, block?: true} files a report (and, with
 * block, blocks its author in the same step — "report and block" is what
 * someone being harassed wants from one tap). POST {action: 'block' |
 * 'unblock', handle} blocks or unblocks a member directly.
 */
export async function POST(req: Request) {
  const call = await memberCall(req, 'report', 20);
  if (call instanceof NextResponse) return call;
  const { member, body } = call;
  const handle = typeof body.handle === 'string' ? body.handle : '';
  if (body.action === 'block' || body.action === 'unblock') {
    const ok = body.action === 'block' ? blockMember(member.id, handle) : unblockMember(member.id, handle);
    return ok ? NextResponse.json({ ok: true }) : jsonError('That member could not be found.', 404);
  }
  const result = reportContent(member.id, body.type, body.id, body.reason, body.note);
  if (!result.ok) return jsonError(result.error, 400);
  if (body.block === true && handle) blockMember(member.id, handle);
  return NextResponse.json({ ok: true, held: result.held });
}
