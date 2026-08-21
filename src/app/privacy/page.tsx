import { shareImages } from '@/lib/seo';
import Link from 'next/link';
import { platformContactEmail, platformName } from '@/lib/platform';
import { BUYER_RETENTION_DAYS, WAITLIST_NOTIFIED_RETENTION_DAYS } from '@/lib/retention';

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
    url: '/privacy', images: shareImages() },
};

const PLATFORM_NAME = platformName();

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
              {BUYER_RETENTION_DAYS} days after the event&rsquo;s date — or, for a shop order,{' '}
              {BUYER_RETENTION_DAYS} days after you collect it (at the latest a year after you
              paid, even if you never collect) — your name and your email address are overwritten
              in our database automatically. It is not a flag or a hidden row — the old values are
              gone and cannot be brought back.
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
                one reminder. The only exceptions are ones you create yourself: the optional
                &ldquo;keep me posted&rdquo; box at checkout and the customer card you can ask a
                seller to keep — both explained below.
              </li>
            </ul>
          </div>

          <div className="card anim-fade-up anim-d2">
            <h2 className="card-title">The &ldquo;keep me posted&rdquo; box</h2>
            <p>
              At checkout there is an optional box asking whether that event&rsquo;s organizer may
              tell you when they announce something new. It is never pre-ticked, and leaving it empty
              changes nothing — your order works exactly the same either way.
            </p>
            <p>
              Ticking it does not subscribe you by itself — anyone could type anyone&rsquo;s address
              into a checkout. Instead you get a single confirmation email, and only pressing the
              button in it puts you on the list. No press, no subscription, and that confirmation
              request is the only email about it.
            </p>
            <p>
              Once you confirm, we keep your email address — the address alone, not your name — for
              exactly one job: that one organizer&rsquo;s announcements, at most one email per new
              listing, and never anyone else&rsquo;s. Because you asked to hear more, this address
              is the one detail that survives the after-event erasure described above; it stays
              until you unsubscribe.
            </p>
            <p style={{ marginBottom: 0 }}>
              Every announcement carries an unsubscribe link — one button, no sign-in, and it never
              expires. Once you unsubscribe, your address is kept only as a do-not-email record, so
              nothing can quietly add you back; only ticking the box yourself again, and confirming
              it again from your own inbox, would. Want even that record erased entirely? Ask, and
              we will.
            </p>
          </div>

          <div className="card anim-fade-up anim-d2">
            <h2 className="card-title">The customer card, if you ask for one</h2>
            <p>
              After you have paid, the order page offers you a card with that one seller. It is an
              offer and nothing more: buying something does not give you a card, and if you never
              press the button, no card exists. Nothing about your order changes either way.
            </p>
            <p>
              Press it and we store one thing — your email address, filed against that one seller —
              and give you a private page of your own with a QR code on it. The page shows your
              referral code, any discount codes you are holding, and what you have bought{' '}
              <em>from that seller</em>. The QR carries the card&rsquo;s random code and nothing
              else: no name, no email, nothing about you.
            </p>
            <p>
              The card belongs to one seller and stops there. It cannot recognise you at another
              seller&rsquo;s counter, it does not follow you around this site, and there is no
              screen anywhere in {PLATFORM_NAME} that puts your cards side by side — that would be
              a profile built behind your back, which is precisely what this is not. Only the seller
              whose card it is can look the code up, and when they do they see your name, how many
              orders you have placed with them, how long you have held the card and which discount
              codes you have not spent. The door staff scanning tickets cannot: the scanner link a
              seller hands out reads tickets and nothing else.
            </p>
            <p style={{ marginBottom: 0 }}>
              Because you asked for it, this address is — like the &ldquo;keep me posted&rdquo; box
              above — one of the only things that survives the after-event erasure. It survives for
              exactly as long as you want it to: there is a{' '}
              <strong>Close this card</strong> button on the card page itself, no sign-in needed,
              and pressing it deletes the card outright. The QR stops working that second and
              nothing is kept behind, because nothing but you asking again can ever create another.
              Lost the link, or would rather every card you hold went at once? Ask, and we will.
            </p>
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
            <h2 className="card-title">The sold-out waitlist</h2>
            <p style={{ marginBottom: 0 }}>
              When an event has sold out, you can leave your email address to hear if spots free up.
              That address is the only thing we store — no name, no account — and it exists for
              exactly one job: if spots do free up, we send you one email saying so. Everyone on the
              list gets that email at the same moment, spots go to whoever books first, and there is
              no mailing list behind any of it. Once your one email has gone out, your address is
              deleted within {WAITLIST_NOTIFIED_RETENTION_DAYS} days; if the event passes without
              anything freeing up, it is deleted then instead. Want it gone sooner? Ask, and we
              will.
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

          {/* Only when analytics is actually switched on. A privacy notice that
              describes a tracker the deployment does not run is as wrong as
              one that hides a tracker it does: both leave a reader unable to
              trust the rest of the page. The same env var that loads the tag
              writes this section, so the two cannot disagree. */}
          {process.env.NEXT_PUBLIC_GA_ID ? (
            <div className="card glow-card anim-fade-up anim-d3">
              <h2 className="card-title">Counting visits</h2>
              <p>
                We use <strong>Google Analytics</strong> to see which pages people actually read —
                how many opened the bazaar, which shop pages get looked at, whether a festival page
                was worth writing. It is how we decide what to build next, and it is the only
                measurement on this site.
              </p>
              <p>
                What it is told is the <strong>page</strong>: the address without anything after
                the question mark, plus the ordinary things any website sees — roughly where in the
                world you are, what browser you used, which link brought you. Google sets a cookie
                on your device to tell one visit from the next.
              </p>
              <p style={{ marginBottom: 0 }}>
                Where it does <strong>not</strong> run: your order page, your tickets, your
                customer card, the door scanner, and the organizer and admin areas. Those addresses
                contain a code that opens your own order, so no part of them is ever sent anywhere.
                Nothing you typed — your name, your email, what you bought — is sent to Google by
                any page on this site. If you would rather not be counted at all, a browser that
                blocks analytics cookies, or any of the usual blockers, stops it completely and
                nothing else on the site changes.
              </p>
            </div>
          ) : null}

          <div className="card glow-card anim-fade-up anim-d3">
            <h2 className="card-title">Ask us anything</h2>
            <p style={{ marginBottom: 0 }}>
              If you want to know what we hold about you, or you want it gone sooner than{' '}
              {BUYER_RETENTION_DAYS} days,{' '}
              {contactEmail ? (
                <>
                  write to{' '}
                  <a href={`mailto:${contactEmail}`} style={{ color: 'var(--brand-text)', fontWeight: 700 }}>
                    {contactEmail}
                  </a>{' '}
                  and a real person will answer.
                </>
              ) : (
                <>use the contact form and a real person will answer.</>
              )}
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
