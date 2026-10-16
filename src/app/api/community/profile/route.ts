import { NextResponse } from 'next/server';
import { joinCommunity, leaveCommunity } from '@/lib/community';
import { memberCall, jsonError } from '@/lib/communityApi';
import { eraseCommunityRows, unlinkTalentPhotos } from '@/lib/communityData';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * A member's own community settings. POST {action: 'update', name, city} to
 * change the name others see or the home town; POST {action: 'leave',
 * confirm: 'LEAVE'} to leave the community — everything they posted is
 * deleted, and the customer account itself stays.
 */
export async function POST(req: Request) {
  const call = await memberCall(req, 'profile', 10);
  if (call instanceof NextResponse) return call;
  const { member, body } = call;
  if (body.action === 'leave') {
    if (body.confirm !== 'LEAVE') return jsonError('Type LEAVE to confirm.', 400);
    const photos: string[] = [];
    leaveCommunity(member.id, (id) => photos.push(...eraseCommunityRows(getDb(), id).photos));
    unlinkTalentPhotos(photos);
    return NextResponse.json({ ok: true, left: true });
  }
  const result = joinCommunity(member.id, { name: body.name, city: body.city }, { requireConsent: false });
  if (!result.ok) return jsonError(result.error, 400);
  return NextResponse.json({ ok: true, name: result.member.name, city: result.member.city });
}
