import { NextResponse } from 'next/server';
import { markUnsubscribed, verifyUnsubscribeToken } from '@/lib/marketing';

/**
 * RFC 8058 one-click unsubscribe: the URL every announcement's
 * List-Unsubscribe header points at (with List-Unsubscribe-Post alongside).
 * When a reader presses their MAIL CLIENT's unsubscribe button, the client
 * POSTs here with no page in between — so this endpoint acts immediately.
 *
 * A POST is the whole reason this is safe where a load-bearing GET was not:
 * link-prefetchers and security scanners only issue GETs, so nothing
 * automated ever lands here. The human-visible link in the email body goes
 * to the /unsubscribe PAGE instead, whose GET only shows a button.
 *
 * There is deliberately no GET handler: a scanner following the header URL
 * gets 405 and changes nothing.
 */
export async function POST(req: Request) {
  try {
    const token = new URL(req.url).searchParams.get('token');
    const verified = verifyUnsubscribeToken(token);
    if (!verified) {
      // No redirect and no detail: this is a machine endpoint, and a bad
      // token deserves nothing that helps anyone probe it.
      return new NextResponse(null, { status: 400 });
    }
    markUnsubscribed(verified.organizerId, verified.email);
    return new NextResponse(null, { status: 200 });
  } catch (e) {
    console.error('POST /api/unsubscribe failed:', e);
    return new NextResponse(null, { status: 500 });
  }
}
