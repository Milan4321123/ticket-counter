import Link from 'next/link';
import { platformContactEmail, platformFeeLabel } from '@/lib/platform';
import ContactForm from './ContactForm';

// Contact address and fee both come from env vars — read them fresh.
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Talk to us about a custom-designed page',
  description:
    'Want something fancier than the self-service event page? Tell our team what you have in mind and we design your event page for you.',
  alternates: { canonical: '/contact' },
  openGraph: {
    type: 'website',
    title: 'Talk to us about a custom-designed page',
    description: 'Want something fancier than the self-service event page? Tell our team what you have in mind and we design your event page for you.',
    url: '/contact',
  },
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
              <p className="feed-hero-sub anim-fade-up anim-d2" style={{ marginTop: 14 }}>
                The account is free. You only pay when you publish an event ({feeLabel}), and never a
                cut of your ticket sales. Nothing to pay to apply, and no payment details to enter.
              </p>

              {/* A way back OUT of the form. Someone who arrived here from a
                  "Get started" button may never have read what they are signing
                  up to, and the form gives them no way to find out without
                  losing their place. Secondary styling on purpose: applying is
                  still the thing this page is for. */}
              <p className="anim-fade-up anim-d2" style={{ marginTop: 18 }}>
                <a href="/organizers#what-you-get" className="btn btn-green">
                  Remind me how it works
                </a>
              </p>
            </>
          ) : (
            <>
              {/* Who this is FOR, first. The bubble that leads here follows
                  every visitor, so ticket buyers arrive too — and a buyer needs
                  nothing from this page. Saying so early costs them one line
                  and saves an enquiry that cannot be answered. */}
              <p className="feed-hero-sub anim-fade-up anim-d2" style={{ marginBottom: 14 }}>
                <strong>For organizers and anyone putting on an event</strong> — a custom event
                page, a bigger festival site, or an app built around how you run things. Buying a
                ticket? You need nothing here: your tickets come by email, and anything about an
                event goes to its own organizer on that event&rsquo;s page.
              </p>
              <p className="feed-hero-sub anim-fade-up anim-d2" style={{ marginBottom: 0 }}>
                Bigger festival? Sponsor logos? A look that is entirely yours? Tell us what you have
                in mind and our team builds the page around your event — you keep every euro of your
                ticket sales, exactly as always.
              </p>

              {/* The honest order of operations, said before the form rather than
                  after it. Most organizers do not need this page at all: the
                  self-service editor is included in the fee they already pay, and
                  it is a better first move than a conversation with a queue in
                  front of it. Sending everyone here would fill the inbox with
                  requests that the editor answers in ten minutes. */}
              <div className="contact-firststep anim-fade-up anim-d2">
                <p style={{ margin: 0 }}>
                  <strong>Build it yourself first — it is already paid for.</strong> Every event
                  comes with a page editor: your own photos and video, ticket types, colours, an
                  FAQ. Most organizers never need more than that, and it takes minutes.
                </p>
                <p style={{ margin: '12px 0 0' }}>
                  <a href="/organizers#editor" className="btn btn-brand">
                    See what you can build yourself
                  </a>
                </p>
              </div>

              <p className="feed-hero-sub anim-fade-up anim-d2" style={{ marginTop: 18 }}>
                <strong>Tried it and want more?</strong> That is what this page is for. Custom pages
                are built for one event rather than picked from a set of themes, so the place to
                start is a conversation — send the form below and Milan comes back to you with ideas
                and a price.
              </p>
            </>
          )}
        </div>
      </section>

      <section className="section" style={{ paddingTop: 28 }}>
        <div className="container container-narrow">
          <div style={{ maxWidth: 560, margin: '0 auto' }}>
            {/* Only when there is a real address. Empty means none is
                configured, and an empty mailto: link is worse than no line at
                all — it looks like a way to reach us and reaches nobody. */}
            {contactEmail && (
              <p className="anim-fade-up" style={{ textAlign: 'center', margin: '0 0 4px' }}>
                Prefer plain email? Write to{' '}
                <a
                  href={`mailto:${contactEmail}`}
                  style={{ color: 'var(--brand-text)', fontWeight: 700 }}
                >
                  {contactEmail}
                </a>
              </p>
            )}
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
