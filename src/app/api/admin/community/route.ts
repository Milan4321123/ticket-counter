import { NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/auth';
import { moderate, REPORT_TARGETS, unbanMember, type ModerationAction, type ReportTarget } from '@/lib/community';
import { getBaseUrl } from '@/lib/config';
import { fromThisSite } from '@/lib/http';
import { setTalentVerified } from '@/lib/talent';

export const dynamic = 'force-dynamic';

const ACTIONS: ModerationAction[] = ['dismiss', 'remove', 'restore', 'ban'];

/**
 * The community's moderation controls, behind the admin session — plain form
 * posts from /admin/community that come back with a short code in ?note=:
 *   op=moderate type=… id=… action=dismiss|remove|restore|ban
 *   op=verify   id=… on=1|0      (a Kalakar profile checked by the platform)
 *   op=unban    handle=…
 */
export async function POST(req: Request) {
  const back = (note: string) => NextResponse.redirect(`${getBaseUrl()}/admin/community?note=${note}`, 303);
  if (!fromThisSite(req, getBaseUrl())) return new NextResponse('Forbidden', { status: 403 });
  if (!(await isAdminRequest())) return new NextResponse('Unauthorized', { status: 401 });
  const form = await req.formData().catch(() => null);
  const get = (k: string) => String(form?.get(k) ?? '').slice(0, 80);
  const op = get('op');
  if (op === 'moderate') {
    const type = get('type') as ReportTarget;
    const action = get('action') as ModerationAction;
    if (!(REPORT_TARGETS as readonly string[]).includes(type) || !ACTIONS.includes(action)) return back('bad');
    return back(moderate(type, get('id'), action) ? action : 'nothing');
  }
  if (op === 'verify') return back(setTalentVerified(get('id'), get('on') === '1') ? 'verified' : 'nothing');
  if (op === 'unban') return back(unbanMember(get('handle')) ? 'unbanned' : 'nothing');
  return back('bad');
}
