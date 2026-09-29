import { NextResponse } from 'next/server';
import { currentCustomer } from '@/lib/customers';
import { customerDataExport } from '@/lib/erasure';

export const dynamic = 'force-dynamic';

/**
 * "Download my data" (Art. 15 and 20 GDPR): everything held about the signed-in
 * customer's VERIFIED address, as one JSON file — the account and basket, every
 * order under the address with its items, tickets and status, subscriptions,
 * reviews, customer cards, keep-me-posted consents, waitlist entries,
 * questions, referral vouchers and contact messages, plus the retention rules
 * that apply to each.
 *
 * Only for a signed-in customer: the account is a proven mailbox, which is the
 * only thing that makes it safe to hand over what sits under an address
 * (orders.buyer_email alone is never verified — see lib/buyerAccount.ts).
 * A GET, so it downloads from a plain link; another site can make the browser
 * fetch it but never read the answer.
 */
export async function GET() {
  const customer = await currentCustomer();
  if (!customer) {
    return NextResponse.json({ error: 'Please sign in first.' }, { status: 401 });
  }
  const data = customerDataExport(customer);
  const day = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="my-data-${day}.json"`,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
