import { NextResponse } from 'next/server';
import { memberCall, jsonError } from '@/lib/communityApi';
import { deleteTalent, saveTalent, setTalentVisible } from '@/lib/talent';

export const dynamic = 'force-dynamic';

/**
 * The member's own Kalakar profile, by `action`:
 *   save {name, kind, city, areas, bio, links[], videoUrl} · hide · show · delete
 */
export async function POST(req: Request) {
  const call = await memberCall(req, 'talent', 15);
  if (call instanceof NextResponse) return call;
  const { member, body } = call;
  switch (body.action) {
    case 'save': {
      const result = saveTalent(member, body);
      return result.ok ? NextResponse.json({ ok: true, slug: result.slug }) : jsonError(result.error, 400);
    }
    case 'hide':
    case 'show':
      return setTalentVisible(member, body.action === 'show') ? NextResponse.json({ ok: true }) : jsonError('Nothing to change.', 409);
    case 'delete':
      return deleteTalent(member) ? NextResponse.json({ ok: true }) : jsonError('You have no profile.', 404);
    default:
      return jsonError('Unknown action.', 400);
  }
}
