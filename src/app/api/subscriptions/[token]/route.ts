// The buyer's buttons on /subscription/<token>: skip, pause, resume, cancel.
// The unguessable token in the path IS the authority — it is only ever in the
// buyer's own emails and order page. A plain form POST that redirects back.
import { NextResponse } from 'next/server';
import { actOnSubscription, type SubscriptionAction } from '@/lib/subscriptions';
import { clientIp, rateLimit } from '@/lib/ratelimit';

const ACTIONS: SubscriptionAction[] = ['skip', 'pause', 'resume', 'cancel'];

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const back = new URL(`/subscription/${encodeURIComponent(token)}`, req.url);
  if (!rateLimit(`subscription:${clientIp(req)}`, 30, 60_000)) {
    back.searchParams.set('msg', 'busy');
    return NextResponse.redirect(back, 303);
  }
  const form = await req.formData().catch(() => null);
  const action = String(form?.get('action') ?? '') as SubscriptionAction;
  if (!ACTIONS.includes(action)) {
    back.searchParams.set('msg', 'invalid');
    return NextResponse.redirect(back, 303);
  }
  const result = actOnSubscription(token, action);
  back.searchParams.set('msg', typeof result === 'string' ? 'invalid' : action);
  return NextResponse.redirect(back, 303);
}
