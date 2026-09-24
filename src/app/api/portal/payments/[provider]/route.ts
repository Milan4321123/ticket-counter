import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { BodyTooLargeError, readJsonLimited } from '@/lib/http';
import { sendPaymentConnectionChangedEmail } from '@/lib/email';
import {
  getConnection,
  isInstantProvider,
  removeConnection,
  upsertConnection,
  type InstantProvider,
} from '@/lib/paymentConnections';
import { verifyPaypalCredentials, forgetPaypalToken } from '@/lib/paypal';
import { StripeError, verifyStripeKey } from '@/lib/stripe';
import { PAYOUT_STEP_UP_COOKIE, verifyStepUpToken } from '@/lib/payoutStepUp';
import { clientIp, rateLimit } from '@/lib/ratelimit';
import type { ApiErrorResponse } from '@/lib/types';
import { planGate, requireOrganizerApi } from '../../auth';
import { payoutStepUpChallenge } from '../../payout/method';

export const dynamic = 'force-dynamic';

/**
 * A seller's own PayPal app or Stripe key — set, replace, or remove.
 *
 * The credentials are verified against the provider BEFORE anything is
 * stored: a pair that cannot fetch a PayPal token, or a key Stripe does not
 * recognise, is refused with the provider's own reason, so a seller finds out
 * now rather than from a buyer whose payment failed.
 *
 * REPLACING an existing connection is a change to where money goes, exactly
 * like moving an IBAN, and asks the same second factor (lib/payoutStepUp).
 * Setting the first one is free, on the same first-time-is-free rule the
 * payout account follows. Either way the seller (and the platform owner) get
 * the same alarm email a payout change sends.
 */
export async function POST(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  if (!isInstantProvider(provider)) {
    return NextResponse.json({ error: 'Unknown payment provider.' } satisfies ApiErrorResponse, { status: 404 });
  }
  try {
    const auth = await requireOrganizerApi();
    if (auth.failure) return auth.failure;
    const { organizer } = auth;
    const blocked = planGate(organizer);
    if (blocked) return blocked;

    // Every attempt costs a call to the provider; keep a script from turning
    // this into a credential-stuffing tool against PayPal or Stripe.
    if (!rateLimit(`payments:connect:${clientIp(req)}`, 10, 10 * 60_000)) {
      return NextResponse.json(
        { error: 'Too many attempts — please wait ten minutes and try again.' } satisfies ApiErrorResponse,
        { status: 429 }
      );
    }

    let body: Record<string, unknown>;
    try {
      const parsed = await readJsonLimited(req);
      if (!parsed || typeof parsed !== 'object') throw new Error('bad body');
      body = parsed as Record<string, unknown>;
    } catch (e) {
      if (e instanceof BodyTooLargeError) {
        return NextResponse.json({ error: 'That request was too large.' } satisfies ApiErrorResponse, { status: 413 });
      }
      return NextResponse.json({ error: 'Nothing to save.' } satisfies ApiErrorResponse, { status: 400 });
    }

    const existing = getConnection(organizer.id, provider);
    if (existing) {
      const store = await cookies();
      if (!verifyStepUpToken(store.get(PAYOUT_STEP_UP_COOKIE)?.value ?? null, organizer.id)) {
        return NextResponse.json(
          {
            error: 'Replacing the account your buyers pay into needs one more check.',
            stepUp: { required: true, ...payoutStepUpChallenge(organizer) },
          },
          { status: 403 }
        );
      }
    }

    const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
    let saved;
    if (provider === 'paypal') {
      const clientId = str(body.clientId, 200);
      const clientSecret = str(body.clientSecret, 400);
      const sandbox = body.sandbox === true;
      if (!clientId || !clientSecret) {
        return NextResponse.json(
          { error: 'Paste both the Client ID and the Secret from your PayPal app.' } satisfies ApiErrorResponse,
          { status: 400 }
        );
      }
      try {
        await verifyPaypalCredentials({ clientId, clientSecret, sandbox });
      } catch (e) {
        console.error(`PayPal connection check failed for organizer ${organizer.id}:`, e);
        return NextResponse.json(
          {
            error:
              'PayPal did not accept those credentials. Check that the Client ID and Secret come from the same app ' +
              `and the same environment (${sandbox ? 'Sandbox' : 'Live'}) on developer.paypal.com → Apps & Credentials.`,
          } satisfies ApiErrorResponse,
          { status: 400 }
        );
      }
      saved = upsertConnection({
        organizerId: organizer.id,
        provider,
        publicId: clientId,
        secret: clientSecret,
        accountLabel: sandbox ? 'PayPal sandbox app' : 'PayPal live app',
        sandbox,
      });
      if (existing) forgetPaypalToken({ clientId: existing.publicId, sandbox: existing.sandbox });
    } else {
      const secretKey = str(body.secretKey, 400);
      if (!/^(sk|rk)_(live|test)_[A-Za-z0-9]+$/.test(secretKey)) {
        return NextResponse.json(
          {
            error:
              'That does not look like a Stripe secret key. It starts with sk_live_, sk_test_, rk_live_ or rk_test_ — ' +
              'copy it from dashboard.stripe.com → Developers → API keys.',
          } satisfies ApiErrorResponse,
          { status: 400 }
        );
      }
      let info;
      try {
        info = await verifyStripeKey({ secretKey });
      } catch (e) {
        console.error(`Stripe connection check failed for organizer ${organizer.id}:`, e);
        const reason = e instanceof StripeError && e.status === 401 ? 'Stripe says that key is not valid.' : 'Stripe did not accept that key.';
        return NextResponse.json(
          { error: `${reason} Copy a fresh one from dashboard.stripe.com → Developers → API keys.` } satisfies ApiErrorResponse,
          { status: 400 }
        );
      }
      if (!info.chargesEnabled && !info.test) {
        return NextResponse.json(
          {
            error:
              'That Stripe account cannot take payments yet — finish activating it in the Stripe dashboard ' +
              '(business details, bank account for payouts), then try again.',
          } satisfies ApiErrorResponse,
          { status: 400 }
        );
      }
      saved = upsertConnection({
        organizerId: organizer.id,
        provider,
        publicId: '',
        secret: secretKey,
        accountLabel: info.label,
        sandbox: info.test,
      });
    }

    // The alarm, after the write, never failing the save.
    await sendPaymentConnectionChangedEmail(
      { name: organizer.name, email: organizer.email },
      { provider, action: existing ? 'replaced' : 'connected', accountLabel: saved.accountLabel, sandbox: saved.sandbox }
    );

    return NextResponse.json({ ok: true, connection: saved });
  } catch (e) {
    console.error(`POST /api/portal/payments/${provider} failed:`, e);
    return NextResponse.json({ error: 'Something went wrong — please try again.' } satisfies ApiErrorResponse, { status: 500 });
  }
}

/** Remove a connection. Listings offering that route fall back to the transfer route. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  if (!isInstantProvider(provider)) {
    return NextResponse.json({ error: 'Unknown payment provider.' } satisfies ApiErrorResponse, { status: 404 });
  }
  try {
    const auth = await requireOrganizerApi();
    if (auth.failure) return auth.failure;
    const { organizer } = auth;
    const blocked = planGate(organizer);
    if (blocked) return blocked;

    const existing = getConnection(organizer.id, provider as InstantProvider);
    if (!existing) return NextResponse.json({ ok: true });
    removeConnection(organizer.id, provider);
    if (existing.provider === 'paypal') forgetPaypalToken({ clientId: existing.publicId, sandbox: existing.sandbox });
    await sendPaymentConnectionChangedEmail(
      { name: organizer.name, email: organizer.email },
      { provider, action: 'removed', accountLabel: existing.accountLabel, sandbox: existing.sandbox }
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(`DELETE /api/portal/payments/${provider} failed:`, e);
    return NextResponse.json({ error: 'Something went wrong — please try again.' } satisfies ApiErrorResponse, { status: 500 });
  }
}
