import Link from 'next/link';
import { platformContactEmail } from '@/lib/platform';
import { BUYER_RETENTION_DAYS } from '@/lib/retention';

// The retention window is read from the same constant the erasure sweep uses,
// so this page cannot promise one thing while the server does another.
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Your details, and what happens to them',
  description:
    'What we ask for when you book a ticket, why we need it, who it goes to, and when it is erased.',
  alternates: { canonical: '/privacy' },
  openGraph: {
    type: 'website',
    title: 'Your details, and what happens to them',
    description: 'What we ask for when you book a ticket, why we need it, who it goes to, and when it is erased.',
    url: '/privacy',
  },
};

const PLATFORM_NAME = process.env.PLATFORM_NAME || 'NepaliConcert';

export default function PrivacyPage() {
  const contactEmail = platformContactEmail();

  return (
    <>
      <section className="feed-hero" style={{ padding: '64px 0 32px' }}>
        <div className="container container-narrow">
          <p className="feed-kicker anim-fade-up">Privacy · Datenschutz</p>
          <h1 className="anim-fade-up anim-d1" style={{ fontSize: 'clamp(1.9rem, 4.4vw, 3rem)' }}>
            Your details, and what happens to them
          </h1>
          <p className="feed-hero-sub anim-fade-up anim-d2" style={{ marginBottom: 0 }}>
            The short version: your name and email go to the organizer putting on the event you are
            booking, because they are the ones who issue your ticket. Your money goes straight to
            their bank account and never passes through us. And {BUYER_RETENTION_DAYS} days after
            the event, your name and email are erased for good.
          </p>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 20 }}>
        <div className="container container-narrow">
          <div className="card anim-fade-up">
            <h2 className="card-title">When you book a ticket</h2>
            <p>
              We ask for two things: your name and your email address. Both go to the organizer of
              that event, and we keep them for three reasons — only three.
            </p>
            <ul style={{ paddingLeft: 20, lineHeight: 1.7 }}>
              <li>
                <strong>To send you your ticket.</strong> It arrives by email as a QR code, so an
                email address is the only way it can reach you.
              </li>
              <li>
                <strong>To send it again</strong> if the first one goes missing in a spam folder.
              </li>
              <li>
                <strong>To match your payment.</strong> Your reservation gets a short reference like{' '}
                <span className="mono">TICKETS-AB12CD34</span>. When the organizer sees it on their
                bank statement they know which reservation just got paid — that reference is how
                your money finds your tickets.
              </li>
            </ul>
            <p style={{ marginBottom: 0 }}>
              The QR code on the ticket itself carries a random eight-character code and nothing
              else. Not your name, not your email, nothing about you. Anyone who scans it at the
              door learns only that the ticket is real and has not been used yet.
            </p>
          </div>

          <div className="card anim-fade-up anim-d1">
            <h2 className="card-title">Your money does not pass through us</h2>
            <p style={{ marginBottom: 0 }}>
              Events here are paid by bank transfer, and the account you transfer to is the
              organizer&rsquo;s own. The money goes from your bank to theirs and {PLATFORM_NAME} is
              never in the middle of it — we take no cut of your ticket. Nothing on this site ever
              asks you for a card number, your IBAN or a bank login, and none of those things exists
              anywhere in our database. Where an organizer offers PayPal instead, that payment
              happens inside PayPal&rsquo;s own window — again, no card details are typed into this
              site or stored by it.
            </p>
          </div>

          <div className="card anim-fade-up anim-d1">
            <h2 className="card-title">When your details are erased</h2>
            <p>
              {BUYER_RETENTION_DAYS} days after the event&rsquo;s date, your name and your email
              address are overwritten in our database automatically. It is not a flag or a hidden
              row — the old values are gone and cannot be brought back.
            </p>
            <p style={{ marginBottom: 0 }}>
              What survives is arithmetic. The organizer keeps their ticket count, their takings and
              their record of who came through the door, so their books still add up — but the
              person behind the booking is no longer in there to find.
            </p>
          </div>

          <div className="card anim-fade-up anim-d2">
            <h2 className="card-title">Who can see what</h2>
            <ul style={{ paddingLeft: 20, lineHeight: 1.7, marginBottom: 0 }}>
              <li>
                <strong>The organizer of your event</strong> sees your name, your email and what you
                booked. They need all three to get you your ticket and let you in.
              </li>
              <li>
                <strong>We do not.</strong> The platform side of {PLATFORM_NAME} shows how many
                tickets an event sold and for how much — counts and money, not people. There is no
                screen here that lists buyers, and no export that produces one.
              </li>
              <li>
                <strong>Nobody else.</strong> We do not sell or share any of it, and booking a ticket
                does not put you on a mailing list. The only emails we send a buyer are your ticket,
                your transfer instructions, and — if your transfer has not arrived after a few days —
                one reminder.
              </li>
            </ul>
          </div>

          <div className="card anim-fade-up anim-d2">
            <h2 className="card-title">When you write to us</h2>
            <p style={{ marginBottom: 0 }}>
              The{' '}
              <Link href="/contact" style={{ color: 'var(--brand-text)', fontWeight: 600 }}>
                contact form
              </Link>{' '}
              asks for your name, your email and what you would like — plus a few optional details
              about your event if you are asking for an organizer account. We store it so your
              message cannot be lost to a mail outage, and email it to our own team. It is used to
              answer you and for nothing else. Want it deleted once we are done? Ask, and we will.
            </p>
          </div>

          <div className="card anim-fade-up anim-d3">
            <h2 className="card-title">The question box on event pages</h2>
            <p style={{ marginBottom: 0 }}>
              You can ask a question about an event without signing in or giving a name, and we do
              not attach one. But if the organizer answers it, the question and the answer are
              published on that event&rsquo;s page for everyone to read — so write it as though it
              will be public, because it may well be.
            </p>
          </div>

          <div className="card anim-fade-up anim-d3">
            <h2 className="card-title">The microphone button</h2>
            <p style={{ marginBottom: 0 }}>
              Wherever you see a mic, using it is entirely your choice — every one of those boxes
              can be typed into instead, and nothing is recorded until you tap it. When you do, the
              recording is sent to Google&rsquo;s Gemini service, which turns it into text and sends
              the text back. That is the only thing the audio is used for: we do not save the
              recording to disk, we do not keep it in our database, and we do not log it. It exists
              for the few seconds the request takes and is then gone — only the words you can see
              and edit remain.
            </p>
          </div>

          <div className="card glow-card anim-fade-up anim-d3">
            <h2 className="card-title">Ask us anything</h2>
            <p style={{ marginBottom: 0 }}>
              If you want to know what we hold about you, or you want it gone sooner than{' '}
              {BUYER_RETENTION_DAYS} days, write to{' '}
              <a href={`mailto:${contactEmail}`} style={{ color: 'var(--brand-text)', fontWeight: 700 }}>
                {contactEmail}
              </a>{' '}
              and a real person will answer.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
