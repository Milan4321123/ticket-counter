import Link from 'next/link';
import { redirect } from 'next/navigation';
import { confirmMarketingConsent, getMarketingConsent, verifyConfirmToken } from '@/lib/marketing';
import { getOrganizer } from '@/lib/organizers';

// The confirmation email's button lands here — the second half of double
// opt-in. Ticking "keep me posted" at a checkout only files a request; this
// page is where the address's OWNER proves it was really them, because only
// their inbox received the link.
//
// Like /unsubscribe, the GET is side-effect free and the deed is one button
// press: mail scanners prefetch every link, and a prefetch must not be able
// to create a marketing consent any more than it may destroy one. The token
// bakes in the consented_at stamp of the request it confirms, so an old link
// found later can neither confirm a newer request nor undo an unsubscribe
// that came after it (lib/marketing.ts).
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Confirm your subscription',
  robots: { index: false, follow: false },
};

interface Params {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function SubscribeConfirmPage({ searchParams }: Params) {
  const sp = await searchParams;
  const rawToken = Array.isArray(sp.token) ? sp.token[0] : sp.token;
  const verified = verifyConfirmToken(rawToken);

  if (!verified) {
    return (
      <div className="container container-narrow section">
        <div className="card anim-fade-up">
          <h1 className="card-title">That link did not work</h1>
          <p>
            This confirmation link is incomplete or damaged — that can happen when an email client
            breaks a long address across two lines. Please open the email again and tap the button
            directly, or copy the whole link into your browser in one piece.
          </p>
          <p className="muted small" style={{ marginBottom: 0 }}>
            Nothing has changed — you are not subscribed until a working link is confirmed.
          </p>
        </div>
      </div>
    );
  }

  const organizerName = getOrganizer(verified.organizerId)?.name?.trim() || 'this organizer';
  const consent = getMarketingConsent(verified.organizerId, verified.email);

  // Already on the list — a re-opened link changes nothing.
  if (consent && consent.confirmedAt && !consent.unsubscribedAt) {
    return (
      <div className="container container-narrow section">
        <div className="card anim-fade-up">
          <h1 className="card-title">You are on the list</h1>
          <p>
            <strong translate="no">{verified.email}</strong> will hear when {organizerName} announces something
            new — at most one email per new listing, each with its own unsubscribe button.
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

  // The link must name the request currently on file, made AFTER any
  // unsubscribe — anything else is a retired link that must stay powerless.
  const confirmable =
    consent &&
    consent.consentedAt === verified.consentedAt &&
    (!consent.unsubscribedAt || consent.consentedAt > consent.unsubscribedAt);

  if (!confirmable) {
    return (
      <div className="container container-narrow section">
        <div className="card anim-fade-up">
          <h1 className="card-title">This link has been retired</h1>
          <p>
            It belongs to an older request — that happens when the box was ticked again more
            recently (use the newest email instead) or when this address unsubscribed after the
            email was sent.
          </p>
          <p className="muted small" style={{ marginBottom: 0 }}>
            Nothing has changed. To hear from {organizerName}, tick &ldquo;keep me posted&rdquo; at
            one of their checkouts and confirm from the fresh email that follows.
          </p>
        </div>
      </div>
    );
  }

  // The one press that subscribes. Re-verified server-side: the hidden field
  // is just transport, the HMAC (and the stamp inside it) is the authority.
  async function confirm(formData: FormData) {
    'use server';
    const token = String(formData.get('token') ?? '');
    const v = verifyConfirmToken(token);
    if (v) confirmMarketingConsent(v.organizerId, v.email, v.consentedAt);
    redirect(`/subscribe?token=${encodeURIComponent(token)}`);
  }

  return (
    <div className="container container-narrow section">
      <div className="card anim-fade-up">
        <h1 className="card-title">Hear from {organizerName}?</h1>
        <p>
          One press and <strong translate="no">{verified.email}</strong> gets an email when {organizerName}{' '}
          announces something new — at most one per new listing, each with a one-button
          unsubscribe that works immediately and forever.
        </p>
        <form action={confirm}>
          <input type="hidden" name="token" value={rawToken ?? ''} />
          <button type="submit" className="btn btn-brand">
            Yes, keep me posted
          </button>
        </form>
        <p className="muted small" style={{ margin: '12px 0 0' }}>
          Not you, or changed your mind? Just close the page — nothing is sent until the button is
          pressed.
        </p>
      </div>
    </div>
  );
}
