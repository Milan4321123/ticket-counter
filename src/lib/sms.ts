// Server-only: send the admin sign-in code by SMS via Twilio.
//
// This is OPTIONAL and additive: if the Twilio env vars are set, the two-step
// login code is texted to ADMIN_PHONE in addition to (or instead of) email.
// With nothing configured, this module quietly reports { sent: false } and the
// login falls back to email — exactly as before.
//
// We call Twilio's REST API with plain fetch so the project needs no extra npm
// dependency. Any Twilio-compatible account works.

/** E.164-ish phone numbers that receive login codes (comma-separated ADMIN_PHONE). */
export function adminPhones(): string[] {
  return (process.env.ADMIN_PHONE || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** True when Twilio credentials + a sender + at least one recipient are all set. */
export function isSmsConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_FROM &&
      adminPhones().length > 0
  );
}

/** "+4915155551234" -> "+49•••••1234" (safe to show pre-login). */
export function maskPhone(phone: string): string {
  const trimmed = phone.trim();
  if (trimmed.length <= 6) return '•••';
  const head = trimmed.slice(0, 3);
  const tail = trimmed.slice(-4);
  return `${head}•••••${tail}`;
}

/**
 * Text the code to every configured admin phone. Never throws — a broken SMS
 * setup must not block sign-in when email also works. A 10-second timeout keeps
 * a slow Twilio call from hanging the login request.
 */
export async function sendOtpSms(code: string, eventName: string): Promise<{ sent: boolean; reason?: string }> {
  try {
    if (!isSmsConfigured()) return { sent: false, reason: 'sms-not-configured' };

    const sid = process.env.TWILIO_ACCOUNT_SID as string;
    const token = process.env.TWILIO_AUTH_TOKEN as string;
    const from = process.env.TWILIO_FROM as string;
    const recipients = adminPhones();
    const body = `${code} is your ${eventName} admin sign-in code. It expires in 10 minutes. If this wasn't you, change your admin password.`;

    const auth = Buffer.from(`${sid}:${token}`).toString('base64');
    const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`;

    // Send to each recipient; count success if at least one text goes out.
    const results = await Promise.all(
      recipients.map(async (to) => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 10_000);
        try {
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: {
              Authorization: `Basic ${auth}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({ To: to, From: from, Body: body }).toString(),
            signal: controller.signal,
          });
          if (!res.ok) {
            const detail = await res.text().catch(() => '');
            console.error(`[sms] Twilio rejected message to ${maskPhone(to)}: ${res.status} ${detail.slice(0, 300)}`);
            return false;
          }
          return true;
        } finally {
          clearTimeout(timer);
        }
      })
    );

    return results.some(Boolean) ? { sent: true } : { sent: false, reason: 'send-failed' };
  } catch (e) {
    console.error('[sms] Sending admin OTP text failed:', e instanceof Error ? e.message : e);
    return { sent: false, reason: 'send-failed' };
  }
}
