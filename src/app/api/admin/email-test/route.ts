import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { isAdminRequest } from '@/lib/auth';
import { isEmailConfigured } from '@/lib/email';
import { adminEmails } from '@/lib/otp';
import { bareAddress, emailFromOrganizers, platformNameFromEnv } from '@/lib/platform';
import { rateLimit } from '@/lib/ratelimit';
import type { ApiErrorResponse } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * Send one test message and report exactly what the mail server said.
 *
 * This exists because every email failure looks identical from the outside — no
 * message arrives — while the causes are completely different and only
 * distinguishable by the SMTP reply: wrong credentials, an unverified sender, a
 * blocked port, or sending never attempted at all. Working that out meant
 * reading server logs, and an evening went on exactly that.
 *
 * It deliberately reports the raw error rather than a friendly summary. "Could
 * not send" is what the owner already knows; "535 Authentication failed" and
 * "550 does not match a verified Sender Identity" point at two completely
 * different fixes, and only the server ever sees the difference.
 *
 * Admin-only and rate limited: it is a button that makes the server send mail,
 * so it must not become one that makes the server send a lot of it.
 */
export async function POST() {
  try {
    if (!(await isAdminRequest())) {
      return NextResponse.json(
        { error: 'Please sign in to the admin area first.' } satisfies ApiErrorResponse,
        { status: 401 }
      );
    }

    if (!rateLimit('admin-email-test', 6, 60 * 60_000)) {
      return NextResponse.json(
        { error: 'Several tests already sent — please wait a while before trying again.' } satisfies ApiErrorResponse,
        { status: 429 }
      );
    }

    const to = adminEmails()[0];
    if (!to) {
      return NextResponse.json({ ok: false, detail: 'ADMIN_EMAIL is not set, so there is nowhere to send a test.' });
    }
    if (!isEmailConfigured()) {
      return NextResponse.json({
        ok: false,
        detail: 'Email is switched off: SMTP_HOST is missing, or no From address of any kind is set.',
      });
    }

    const from = emailFromOrganizers();
    const host = process.env.SMTP_HOST ?? '';
    const port = Number(process.env.SMTP_PORT || 587);
    const user = process.env.SMTP_USER ?? '';

    // Built here rather than reusing lib/email's transporter so the raw error can
    // be returned. Every sender in lib/email swallows failures by design — a
    // ticket must not fail because a mail server did — which is exactly what
    // makes them useless for diagnosis.
    const transport = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: user ? { user, pass: process.env.SMTP_PASS || '' } : undefined,
      connectionTimeout: 15_000,
      greetingTimeout: 15_000,
      socketTimeout: 20_000,
    });

    try {
      const info = await transport.sendMail({
        from,
        to,
        replyTo: bareAddress(from),
        subject: `${platformNameFromEnv()} — email test`,
        text:
          `This is a test from your admin panel.\n\n` +
          `If you are reading it, sending works and this is the address your ` +
          `organizers and buyers will see:\n\n  ${from}\n\n` +
          `Check the message headers too: "signed-by" should be your own domain, ` +
          `not your mail provider's.`,
      });
      return NextResponse.json({
        ok: true,
        to,
        from,
        host,
        detail: (info.response || 'accepted').slice(0, 200),
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error('[email] admin test send failed:', message);
      return NextResponse.json({ ok: false, to, from, host, detail: message.slice(0, 400) });
    }
  } catch (e) {
    console.error('POST /api/admin/email-test failed:', e);
    return NextResponse.json(
      { error: 'Could not run the test. Please try again.' } satisfies ApiErrorResponse,
      { status: 500 }
    );
  }
}
