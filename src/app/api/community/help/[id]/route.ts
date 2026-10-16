import { NextResponse } from 'next/server';
import { memberCall, jsonError } from '@/lib/communityApi';
import { deleteHelpPost, setHelpPostOpen } from '@/lib/helpBoard';

export const dynamic = 'force-dynamic';

/** The author's controls on their post: POST {action: 'close' | 'reopen' | 'delete'}. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const call = await memberCall(req, 'help-edit', 20);
  if (call instanceof NextResponse) return call;
  const { member, body } = call;
  const ok =
    body.action === 'close'
      ? setHelpPostOpen(member, id, false)
      : body.action === 'reopen'
        ? setHelpPostOpen(member, id, true)
        : body.action === 'delete'
          ? deleteHelpPost(member, id)
          : null;
  if (ok === null) return jsonError('Unknown action.', 400);
  return ok ? NextResponse.json({ ok: true }) : jsonError('That could not be changed.', 409);
}
