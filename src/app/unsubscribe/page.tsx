import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getMarketingConsent, markUnsubscribed, verifyUnsubscribeToken } from '@/lib/marketing';
import { getOrganizer } from '@/lib/organizers';

// The link in every announcement email lands here. It must work with no
// sign-in and forever — an unsubscribe request is never too late — so the
// token in the URL is the whole authorization: an HMAC over the organizer and
// the address (lib/marketing.ts), which nobody can forge or enumerate.
//
// The GET is deliberately side-effect free: corporate mail scanners and
// link-prefetchers open every URL in every email, and the very first automated
// fetch of a load-bearing GET would silently destroy a consent its owner never
// meant to give up. So this page only SHOWS the state and offers one button;
// the unsubscribe itself is the POST that button (or a mail client's RFC 8058
// one-click, see /api/unsubscribe) sends — one press, nothing else to do.
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Unsubscribe',
  robots: { index: false, follow: false },
};

interface Params {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function UnsubscribePage({ searchParams }: Params) {
  const sp = await searchParams;
  const rawToken = Array.isArray(sp.token) ? sp.token[0] : sp.token;
  const verified = verifyUnsubscribeToken(rawToken);

  if (!verified) {
    return (
      <div className="container container-narrow section">
        <div className="card anim-fade-up">
          <h1 className="card-title">That link did not work</h1>
          <p>
            This unsubscribe link is incomplete or damaged — that can happen when an email client
            breaks a long address across two lines. Please open the email again and tap the
            unsubscribe link directly, or copy the whole link into your browser in one piece.
          </p>
          <p className="muted small" style={{ marginBottom: 0 }}>
            Nothing has changed yet — you are still subscribed until a working link is opened.
          </p>
        </div>
      </div>
    );
  }

  const organizerName = getOrganizer(verified.organizerId)?.name?.trim() || 'this organizer';
  const consent = getMarketingConsent(verified.organizerId, verified.email);

  // Already off the list — either they pressed the button before, or they were
  // never on it. Both render the same closure so the page stays idempotent.
  if (!consent || consent.unsubscribedAt) {
    return (
      <div className="container container-narrow section">
        <div className="card anim-fade-up">
          <h1 className="card-title">You are unsubscribed</h1>
          <p>
            <strong>{verified.email}</strong> will not hear about {organizerName}&rsquo;s new
            listings — there is nothing more to do, and it never expires.
          </p>
          <p>
            {consent
              ? 'We keep your address only as a do-not-email record, so nothing can accidentally add you back — only ticking the “keep me posted” box yourself at a future checkout, and confirming it from your inbox, would.'
              : 'This address is not on the list at all — no record, no emails.'}{' '}
            If you would rather we erase every trace, ask via our{' '}
            <Link href="/contact" style={{ color: 'var(--brand-text)', fontWeight: 600 }}>
              contact form
            </Link>{' '}
            and we will.
          </p>
          <p style={{ marginBottom: 0 }}>
            <Link href="/" className="btn">
              Browse events
            </Link>
          </p>
        </div>
      </div>
    );
  }

  // The one press that does it. Re-verified server-side: the hidden field is
  // just transport, the HMAC is the authority.
  async function unsubscribe(formData: FormData) {
    'use server';
    const token = String(formData.get('token') ?? '');
    const v = verifyUnsubscribeToken(token);
    if (v) markUnsubscribed(v.organizerId, v.email);
    redirect(`/unsubscribe?token=${encodeURIComponent(token)}`);
  }

  return (
    <div className="container container-narrow section">
      <div className="card anim-fade-up">
        <h1 className="card-title">Unsubscribe from {organizerName}?</h1>
        <p>
          One press and <strong>{verified.email}</strong> will not hear about {organizerName}
          &rsquo;s new listings again — it works immediately, needs no sign-in, and never expires.
        </p>
        <form action={unsubscribe}>
          <input type="hidden" name="token" value={rawToken ?? ''} />
          <button type="submit" className="btn btn-brand">
            Unsubscribe me
          </button>
        </form>
        <p className="muted small" style={{ margin: '12px 0 0' }}>
          Opened this by accident? Just close the page — nothing changes until the button is
          pressed.
        </p>
      </div>
    </div>
  );
}
