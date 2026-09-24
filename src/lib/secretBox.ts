// Server-only: encryption at rest for the few secrets the platform keeps on
// behalf of sellers — their own PayPal client secret or Stripe API key.
//
// These are not the platform's credentials, they are the seller's, and a
// database backup or a stray `sqlite3 .dump` must not hand them out in the
// clear. AES-256-GCM with a key derived from APP_SECRET: the same secret every
// other signed thing on the site already depends on, so there is no second
// key to lose, and rotating APP_SECRET is the (documented) way to invalidate
// every stored credential at once.
//
// Format: `v1.<iv b64url>.<ciphertext b64url>.<tag b64url>`. The version
// prefix is what lets a future key derivation change read old rows.
import crypto from 'crypto';
import { getSigningSecret } from './auth';

const VERSION = 'v1';

function key(): Buffer {
  const secret = getSigningSecret();
  if (!secret) throw new Error('Cannot store payment credentials: APP_SECRET is not configured');
  // HKDF so the encryption key is not literally the signing secret: a leak of
  // one derived key says nothing about tokens signed with the other.
  return Buffer.from(crypto.hkdfSync('sha256', secret, 'martnepali:secret-box', 'payment-connections', 32));
}

function b64u(buf: Buffer): string {
  return buf.toString('base64url');
}

/** Encrypt a secret for storage. Throws when APP_SECRET is missing. */
export function sealSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [VERSION, b64u(iv), b64u(enc), b64u(cipher.getAuthTag())].join('.');
}

/**
 * Decrypt a stored secret. Returns null — never throws — when the value is
 * malformed, was sealed under a different APP_SECRET, or was tampered with;
 * callers treat null as "this connection no longer works, re-enter it".
 */
export function openSecret(sealed: string): string | null {
  try {
    const [version, ivB, encB, tagB] = sealed.split('.');
    if (version !== VERSION || !ivB || !encB || !tagB) return null;
    const decipher = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(ivB, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagB, 'base64url'));
    const out = Buffer.concat([decipher.update(Buffer.from(encB, 'base64url')), decipher.final()]);
    return out.toString('utf8');
  } catch {
    return null;
  }
}
