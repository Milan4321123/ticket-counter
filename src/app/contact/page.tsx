import Link from 'next/link';
import { platformContactEmail, platformFeeLabel } from '@/lib/platform';
import ContactForm from './ContactForm';

// Contact address and fee both come from env vars — read them fresh.
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Talk to us about a custom-designed page',
  description:
    'Want something fancier than the self-service event page? Tell our team what you have in mind and we design your event page for you.',
};

/**
 * One form, two reasons to arrive here: "Get started" (someone who wants to sell
 * tickets — accounts are set up by hand, so there is no self-service signup) and
 * the custom-design pitch. ?intent=account switches the framing and files the
 * enquiry under its own kind so the two do not blur together in the admin list.
 */
export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ intent?: string | string[] }>;
}) {
  const raw = (await searchParams).intent;
  const wantsAccount = (Array.isArray(raw) ? raw[0] : raw) === 'account';
  const contactEmail = platformContactEmail();
  const feeLabel = platformFeeLabel();

  return (
    <>
      {/* ---- Hero (lite) ---- */}
      <section className="feed-hero" style={{ padding: '64px 0 36px' }}>
        <div className="container">
          <p className="feed-kicker anim-fade-up">
            {wantsAccount ? 'Start selling tickets' : 'Custom page design'}
          </p>
          <h1 className="anim-fade-up anim-d1" style={{ fontSize: 'clamp(1.9rem, 4.4vw, 3rem)' }}>
            {wantsAccount ? 'Tell us about your event' : "We'll design your page for you"}
          </h1>
          {wantsAccount ? (
            <>
              <p className="feed-hero-sub anim-fade-up anim-d2" style={{ marginBottom: 0 }}>
                This is how you get an account — there is no signup button. Tell us what you are
                putting on, a real person reads it, and if it all looks right we set the account up
                and email you your sign-in details.
              </p>
              <p className="feed-hero-sub anim-fade-up anim-d2" style={{ margin: '14px 0 0' }}>
                The account is free. You only pay when you publish an event ({feeLabel}), and never a
                cut of your ticket sales. Nothing to pay to apply, and no payment details to enter.
              </p>
            </>
          ) : (
            <>
              <p className="feed-hero-sub anim-fade-up anim-d2" style={{ marginBottom: 0 }}>
                Bigger festival? Sponsor logos? A look that is entirely yours? Tell us what you have
                in mind and our team builds the page around your event — you keep every euro of your
                ticket sales, exactly as always.
              </p>
              <p className="feed-hero-sub anim-fade-up anim-d2" style={{ margin: '14px 0 0' }}>
                Each one is built for a single event rather than picked from a set of themes, so the
                place to start is a conversation — send the form below and we will come back with
                ideas and a price.
              </p>
            </>
          )}
        </div>
      </section>

      <section className="section" style={{ paddingTop: 28 }}>
        <div className="container container-narrow">
          <div style={{ maxWidth: 560, margin: '0 auto' }}>
            <p className="anim-fade-up" style={{ textAlign: 'center', margin: '0 0 4px' }}>
              Prefer plain email? Write to{' '}
              <a
                href={`mailto:${contactEmail}`}
                style={{ color: 'var(--brand-text)', fontWeight: 700 }}
              >
                {contactEmail}
              </a>
            </p>
            <p
              className="muted small anim-fade-up"
              style={{ textAlign: 'center', margin: '0 0 18px' }}
            >
              {wantsAccount
                ? `Everything below is optional except your name, email, and a few words about the event — a rough answer is better than none. Publishing an event costs ${feeLabel}; the account itself is free.`
                : `The standard self-service page is already included in your normal event fee (${feeLabel}) — this is for when you want more than that.`}
            </p>

            <div className="card glow-card anim-fade-up anim-d1">
              <ContactForm contactEmail={contactEmail} intent={wantsAccount ? 'organizer-account' : 'custom-design'} />
            </div>

            <p className="muted small anim-fade-up anim-d2" style={{ textAlign: 'center', marginTop: 16 }}>
              {wantsAccount ? (
                <>
                  Already have an account?{' '}
                  <Link href="/portal/login" style={{ color: 'var(--brand-text)', fontWeight: 600 }}>
                    Sign in
                  </Link>{' '}
                  ·{' '}
                </>
              ) : (
                <>
                  Just want to start selling?{' '}
                  <Link href="/contact?intent=account" style={{ color: 'var(--brand-text)', fontWeight: 600 }}>
                    Ask for an account
                  </Link>{' '}
                  — we can still redesign your page for you later ·{' '}
                </>
              )}
              <Link href="/organizers" style={{ color: 'var(--brand-text)', fontWeight: 600 }}>
                See what&rsquo;s included
              </Link>
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
