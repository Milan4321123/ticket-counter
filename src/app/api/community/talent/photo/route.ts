import { NextResponse } from 'next/server';
import { jsonError, memberCall, readBytesLimited } from '@/lib/communityApi';
import { setTalentPhoto, TALENT_PHOTO_MAX_BYTES } from '@/lib/talent';

export const dynamic = 'force-dynamic';

/** Upload the profile photo: the raw image bytes as the body (the browser has already squared and shrunk it). */
export async function POST(req: Request) {
  const call = await memberCall(req, 'talent-photo', 6, { readBody: false });
  if (call instanceof NextResponse) return call;
  const bytes = await readBytesLimited(req, TALENT_PHOTO_MAX_BYTES);
  if (!bytes) return jsonError('That photo is too big or empty.', 413);
  const result = setTalentPhoto(call.member, bytes);
  return result.ok ? NextResponse.json({ ok: true, url: result.url }) : jsonError(result.error, 400);
}
