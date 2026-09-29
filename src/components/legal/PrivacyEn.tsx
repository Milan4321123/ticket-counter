/**
 * The privacy policy — English. The German twin (PrivacyDe.tsx) is binding;
 * this one says the same thing from the same facts (privacyFacts.ts), section
 * for section. Change a section here, change it there.
 */
import Link from 'next/link';
import ConsentControl from '@/components/ConsentControl';
import { TRANSFER_BASIS_EN, geminiMayProcessPersonalData } from '@/lib/legal';
import { LegalSection as Sec, LegalSub as Sub, legalListStyle as ul } from './LegalSection';
import type { PrivacyFacts } from './privacyFacts';

const linkStyle = { color: 'var(--brand-text)', fontWeight: 600 } as const;

export const PRIVACY_TOC_EN: { id: string; title: string }[] = [
  { id: 'verantwortlicher', title: '1. Controller and contact' },
  { id: 'rollen', title: '2. Who is responsible for what?' },
  { id: 'hosting', title: '3. Visiting the site, hosting and security' },
  { id: 'cookies', title: '4. Cookies and storage on your device' },
  { id: 'bestellung', title: '5. Tickets and orders' },
  { id: 'zahlung', title: '6. Payment' },
  { id: 'kundenkonto', title: '7. Customer account' },
  { id: 'mitteilungen', title: '8. “Keep me posted” – a seller’s announcements' },
  { id: 'kundenkarte', title: '9. Customer card' },
  { id: 'abonnements', title: '10. Subscribe & save (standing orders)' },
  { id: 'empfehlungen', title: '11. Referrals and vouchers' },
  { id: 'bewertungen', title: '12. Reviews' },
  { id: 'warteliste', title: '13. Sold-out waitlist' },
  { id: 'fragen', title: '14. Questions to sellers, the AI helper, the Ask bar and the help bot' },
  { id: 'mikrofon', title: '15. Voice input (microphone)' },
  { id: 'kontakt', title: '16. Contact form and contact chat' },
  { id: 'uebersetzung', title: '17. Automatic translation' },
  { id: 'ki', title: '18. How we use AI services' },
  { id: 'analytics', title: '19. Counting visits (Google Analytics)' },
  { id: 'app', title: '20. Installable app and offline tickets' },
  { id: 'fotos', title: '21. Sellers’ photos and videos' },
  { id: 'anbieter', title: '22. Information for organizers and sellers' },
  { id: 'empfaenger', title: '23. Recipients and transfers outside the EU' },
  { id: 'speicherdauer', title: '24. Storage periods at a glance' },
  { id: 'pflicht', title: '25. What you must provide; no automated decisions' },
  { id: 'rechte', title: '26. Your rights' },
  { id: 'widerspruch', title: '27. Right to object' },
  { id: 'beschwerde', title: '28. Right to complain' },
  { id: 'aenderungen', title: '29. Changes to this policy' },
];

function ContactLine({ f }: { f: PrivacyFacts }) {
  return (
    <>
      {f.operator.email ? (
        <>
          by email to{' '}
          <a href={`mailto:${f.operator.email}`} style={linkStyle}>
            {f.operator.email}
          </a>{' '}
          or through the{' '}
        </>
      ) : (
        <>through the </>
      )}
      <Link href="/contact" style={linkStyle}>
        contact form
      </Link>
    </>
  );
}

export default function PrivacyEn({ f }: { f: PrivacyFacts }) {
  const d = f.days;
  const s = f.sessions;
  const gaEnabled = Boolean(process.env.NEXT_PUBLIC_GA_ID);
  const toc = gaEnabled ? PRIVACY_TOC_EN : PRIVACY_TOC_EN.filter((t) => t.id !== 'analytics');

  return (
    <>
      <div className="card anim-fade-up" id="kurz">
        <h2 className="card-title">The short version</h2>
        <ul style={{ ...ul, marginBottom: 0 }}>
          <li>
            When you book a ticket or order something, your contract is with that{' '}
            <strong>organizer or seller</strong> (“the seller”) – not with us. The seller is responsible for
            your order details; we process them on the seller’s behalf. Who the seller is appears on every
            listing, at checkout, on your order page, on the ticket and in every email.
          </li>
          <li>
            Your money goes straight to the seller – by bank transfer or through the seller’s own PayPal or
            Stripe account. No payment passes through us, and no card or bank details are typed into this
            site.
          </li>
          <li>
            The name, email address and other contact details on an order are erased automatically{' '}
            <strong>{d.buyer} days after the event</strong> (details in section 5).
          </li>
          <li>
            Visits are only counted if you explicitly agree. No advertising, no selling of data, no profiles
            across sellers.
          </li>
        </ul>
      </div>

      <nav className="card" aria-label="Contents">
        <h2 className="card-title">Contents</h2>
        <ol style={{ ...ul, listStyle: 'none', paddingLeft: 0, columns: '2 260px', marginBottom: 0 }}>
          {toc.map((t) => (
            <li key={t.id}>
              <a href={`#${t.id}`} style={{ color: 'var(--brand-text)' }}>
                {t.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <Sec id="verantwortlicher" title="1. Controller and contact">
        <p>The controller under the General Data Protection Regulation (GDPR) for this website is:</p>
        <p style={{ paddingLeft: 16, borderLeft: '3px solid var(--border)' }}>
          <strong>{f.operator.name}</strong>
          {f.operator.addressLines.map((l, i) => (
            <span key={i}>
              <br />
              {l}
            </span>
          ))}
          {f.operator.email ? (
            <>
              <br />
              Email:{' '}
              <a href={`mailto:${f.operator.email}`} style={linkStyle}>
                {f.operator.email}
              </a>
            </>
          ) : null}
          {f.operator.phone ? (
            <>
              <br />
              Phone: {f.operator.phone}
            </>
          ) : null}
          <br />
          Contact form:{' '}
          <Link href="/contact" style={linkStyle}>
            {f.base.replace(/^https?:\/\//, '')}/contact
          </Link>
        </p>
        <p>
          {f.platform} is a free platform run by a private individual (see the{' '}
          <Link href="/impressum" style={linkStyle}>legal notice</Link>). “We” and “us” below mean that
          operator.
        </p>
        <p style={{ marginBottom: 0 }}>
          We have not appointed a data protection officer, as there is no legal obligation to do so. For any
          question about your data, reach us directly <ContactLine f={f} />.
        </p>
      </Sec>

      <Sec id="rollen" title="2. Who is responsible for what?">
        <p>There are two roles on {f.platform}, depending on what you do:</p>
        <ul style={ul}>
          <li>
            <strong>We are the controller</strong> for running the website itself and for the platform’s own
            features: page visits, security, cookies and consent, the customer account, reviews, the
            waitlist, the AI helper, the Ask bar and the help bot, the contact form, and the data of
            organizers and sellers themselves.
          </li>
          <li>
            <strong>The seller is the controller</strong> for everything that belongs to your purchase:
            orders and bookings, tickets, matching payments, entry and collection, standing orders, the
            seller’s “keep me posted” list, customer card and referral programme, and questions you send the
            seller through the question form. We process this data as a{' '}
            <strong>processor</strong> under Art. 28 GDPR, on the basis of a{' '}
            <Link href="/avv" style={linkStyle}>
              data processing agreement
            </Link>{' '}
            and only on the seller’s instructions. The seller’s name, address and legal representative are
            shown on every listing, at checkout, on your order page, on the ticket and in every email about
            your order.
          </li>
        </ul>
        <p style={{ marginBottom: 0 }}>
          You can send requests about data a seller is responsible for to the seller or to us – we forward
          them to the seller without delay and help them answer. The sections below explain those processing
          operations too, so you can see in one place what happens to your data.
        </p>
      </Sec>

      <Sec id="hosting" title="3. Visiting the site, hosting and security">
        <p>
          When you open a page, the server necessarily processes your IP address, the date and time, the
          address (URL) requested and your browser’s identifier (user agent). These appear in the server
          logs.
        </p>
        <Sub>Purpose and legal basis</Sub>
        <p>
          Delivering the website, keeping it stable, finding faults and fending off attacks. The legal basis
          is Art. 6(1)(f) GDPR; our legitimate interest is the secure and reliable operation of the platform.
        </p>
        <Sub>Hosting</Sub>
        <p>
          The platform is hosted by <strong>Render Services, Inc.</strong> (San Francisco, USA); the servers
          are in <strong>{f.region}</strong>.{' '}
          {f.inEU
            ? 'Your data is therefore stored in the EU. As Render is a US company, access from the USA in individual cases (for example for support or maintenance) cannot be ruled out.'
            : 'Your data is therefore processed outside the EU.'}{' '}
          Render uses the network of <strong>Cloudflare, Inc.</strong> (San Francisco, USA) to deliver the
          site and protect it against overload attacks. Both act as processors. {TRANSFER_BASIS_EN}
        </p>
        <Sub>Abuse protection</Sub>
        <p>
          To protect forms and sign-ins against floods of requests, we count requests per IP address – only
          in the server’s memory, never in the database; the counters expire after a short time or on every
          restart. For the daily limits on AI features we store only a hash of the IP address, salted afresh
          every day (the address cannot be read back from it); these entries are deleted after about two days.
        </p>
        <Sub>Storage period</Sub>
        <p style={{ marginBottom: 0 }}>
          The hosting provider keeps server logs only for a limited period and then deletes them
          automatically. We look at them only when there is a reason, such as a fault or an attack.
        </p>
      </Sec>

      <Sec id="cookies" title="4. Cookies and storage on your device">
        <p>
          We store or read something on your device only where it is strictly necessary for a feature you
          have explicitly asked for (§ 25(2) no. 2 TDDDG) – so that you stay signed in, say, or your basket
          is not lost. No consent is needed for that; the processing that follows rests on Art. 6(1)(b) or
          (f) GDPR.{' '}
          {gaEnabled ? (
            <>
              The single exception is counting visits with Google Analytics, which only runs with your consent
              (§ 25(1) TDDDG, Art. 6(1)(a) GDPR, see section 19).
            </>
          ) : (
            <>We set no advertising or analytics cookies.</>
          )}
        </p>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Purpose</th>
                <th>Kept for</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={3}>
                  <strong>Cookies</strong> (HttpOnly and Secure wherever technically possible)
                </td>
              </tr>
              <tr>
                <td className="mono small">customer_session</td>
                <td className="small">Signed in to your customer account</td>
                <td className="small">{s.customerDays} days or until you sign out</td>
              </tr>
              <tr>
                <td className="mono small">organizer_session</td>
                <td className="small">Signed in to the seller hub</td>
                <td className="small">{s.organizerDays} days or until you sign out</td>
              </tr>
              <tr>
                <td className="mono small">payout_step_up</td>
                <td className="small">Re-confirmation before payout details change (sellers)</td>
                <td className="small">{s.stepUpMinutes} minutes</td>
              </tr>
              <tr>
                <td className="mono small">scan_session</td>
                <td className="small">Door scanner a seller has shared with their door staff</td>
                <td className="small">until the scanner link expires</td>
              </tr>
              <tr>
                <td className="mono small">admin_session, admin_preauth, admin_gate</td>
                <td className="small">The operator’s own sign-in (affects only the operator)</td>
                <td className="small">
                  {s.adminHours} hours or {s.preauthMinutes} minutes; unlock up to 30 days
                </td>
              </tr>
              <tr>
                <td className="mono small">google_oauth_state</td>
                <td className="small">Protects “Sign in with Google” against forgery</td>
                <td className="small">10 minutes</td>
              </tr>
              <tr>
                <td className="mono small">lang</td>
                <td className="small">Your language – only if you switch language</td>
                <td className="small">1 year</td>
              </tr>
              <tr>
                <td colSpan={3}>
                  <strong>Local storage (localStorage)</strong> – stays until you clear it or the feature does
                </td>
              </tr>
              <tr>
                <td className="mono small">martnepali.consent.v1</td>
                <td className="small">Your answer about counting visits, with its date</td>
                <td className="small">until you change it</td>
              </tr>
              <tr>
                <td className="mono small">mn_basket_v1</td>
                <td className="small">Your basket</td>
                <td className="small">until you order or empty it</td>
              </tr>
              <tr>
                <td className="mono small">martnepali.saved.v1</td>
                <td className="small">Your saved items</td>
                <td className="small">until you remove them</td>
              </tr>
              <tr>
                <td className="mono small">martnepali.device.v1, martnepali.wished.v1</td>
                <td className="small">
                  Wish button: a random device code and your wishes, so one wish counts once per device. The
                  server stores only a keyed hash that differs for every item – no name, no email, no IP
                  address.
                </td>
                <td className="small">until you clear storage</td>
              </tr>
              <tr>
                <td className="mono small">tx:v2:…</td>
                <td className="small">Cache of automatic translations of page text</td>
                <td className="small">until you clear storage</td>
              </tr>
              <tr>
                <td className="mono small">mn.install.dismissed</td>
                <td className="small">When the “install the app” hint was last shown, so it appears at most once a month</td>
                <td className="small">until you clear storage</td>
              </tr>
              <tr>
                <td colSpan={3}>
                  <strong>Session storage (sessionStorage)</strong> – deleted when you close the tab
                </td>
              </tr>
              <tr>
                <td className="small">Chat histories</td>
                <td className="small">History of the Ask bar, the help bot and the contact chat</td>
                <td className="small">until the tab closes</td>
              </tr>
              <tr>
                <td className="small">Checkout draft</td>
                <td className="small">Your choices in the order form, so a reload does not lose them</td>
                <td className="small">until the tab closes</td>
              </tr>
              <tr>
                <td className="mono small">martnepali.recent.v1</td>
                <td className="small">Recently viewed items</td>
                <td className="small">until the tab closes</td>
              </tr>
              {gaEnabled ? (
                <>
                  <tr>
                    <td colSpan={3}>
                      <strong>Only with your consent</strong>
                    </td>
                  </tr>
                  <tr>
                    <td className="mono small">_ga, _ga_…</td>
                    <td className="small">Google Analytics: telling visits apart (section 19)</td>
                    <td className="small">up to 2 years or until you withdraw</td>
                  </tr>
                </>
              ) : null}
            </tbody>
          </table>
        </div>
        <p className="small muted" style={{ marginTop: 12, marginBottom: 0 }}>
          You can delete cookies and locally stored data at any time in your browser settings. Some features
          (sign-in, basket) will then stop working as usual.
        </p>
      </Sec>

      <Sec id="bestellung" title="5. Tickets and orders">
        <p>The seller is the controller; we process the data on their behalf (section 2).</p>
        <Sub>What data</Sub>
        <p>
          <strong>Required</strong> are your name and your email address. <strong>Optional</strong>,
          depending on the listing, are a phone number, the payer’s name (if different) and a note to the
          seller. Then there is the order itself: tickets or items and options chosen, seat, table or pickup
          slot, prices, discount and referral codes, payment, entry and collection status.
        </p>
        <Sub>Purposes</Sub>
        <ul style={ul}>
          <li>to send you your ticket or collection code – and to send it again if it goes missing;</li>
          <li>
            to match your payment: your order gets a short reference like{' '}
            <span className="mono">TICKETS-AB12CD34</span>, by which the seller recognises your transfer;
          </li>
          <li>to check you in at the door or at collection;</li>
          <li>
            to send you the emails about your order: confirmation with ticket, payment instructions, at most
            one payment reminder and, for goods, “ready to collect”.
          </li>
        </ul>
        <p>
          The QR code on the ticket holds a random code and nothing else – not your name, not your email.
          Whoever scans it at the door learns only whether the ticket is valid and unused. Your order page
          opens only through the personal, signed link in your email or through your customer account.
        </p>
        <Sub>Legal basis</Sub>
        <p>Art. 6(1)(b) GDPR (the contract between you and the seller, or steps towards it).</p>
        <Sub>Who sees what</Sub>
        <ul style={ul}>
          <li>
            <strong>The seller</strong> sees your details and what you ordered – they need them to give you
            your ticket or your goods.
          </li>
          <li>
            <strong>We</strong>, as processor, access them only where needed to run the platform, fix faults
            or support the seller.
          </li>
          <li>
            <strong>Emails</strong> are sent through Twilio SendGrid (section 23). Nobody else receives your
            data; we sell no data, and an order puts you on no mailing list.
          </li>
        </ul>
        <Sub>Erasure</Sub>
        <p style={{ marginBottom: 0 }}>
          Name, email address, phone number, payer’s name and your note are overwritten automatically{' '}
          <strong>{d.buyer} days after the date of the event</strong>. For goods this happens {d.buyer} days
          after collection, and at the latest {d.shopLongStop} days after payment even if you never collect;
          for listings without a date, {d.undated} days after the order. This is not a flag but a real
          overwrite – the old values are gone. What remains is anonymous counts and amounts, so the seller’s
          books still add up. The data disappears from backups within {d.backup} days at the latest.
        </p>
      </Sec>

      <Sec id="zahlung" title="6. Payment">
        <p>You pay the seller directly; {f.platform} receives no money and charges no fee.</p>
        <ul style={ul}>
          <li>
            <strong>Bank transfer:</strong> we show you the seller’s bank details (IBAN) and the payment
            reference. You never enter your own bank details anywhere on this site.
          </li>
          <li>
            <strong>PayPal:</strong> if the seller offers PayPal, PayPal’s script is loaded only when you click
            “Pay with PayPal”; PayPal then technically receives your IP address and browser data. You pay in
            PayPal’s own window, into the seller’s account. The provider is PayPal (Europe) S.à r.l. et Cie,
            S.C.A., 22–24 Boulevard Royal, L-2449 Luxembourg.
          </li>
          <li>
            <strong>Stripe:</strong> if the seller offers Stripe, we send you to the checkout page of the
            seller’s Stripe account and pass on your email address and the order reference. The provider is
            Stripe Payments Europe, Limited, 1 Grand Canal Street Lower, Grand Canal Dock, Dublin, D02 H210,
            Ireland.
          </li>
        </ul>
        <p style={{ marginBottom: 0 }}>
          PayPal and Stripe are the seller’s payment providers and process your payment data as independent
          controllers under their own privacy notices; both may also transfer data to the USA. From them we
          receive only whether, and under which reference, the payment was made. The legal basis for passing
          your details on is Art. 6(1)(b) GDPR.
        </p>
      </Sec>

      <Sec id="kundenkonto" title="7. Customer account">
        <p>
          An account is optional; you can order without one. With one, you see every order that belongs to
          your confirmed email address, and your basket follows you between devices. We are the controller.
        </p>
        <ul style={ul}>
          <li>
            <strong>Sign-in by emailed code:</strong> we send you a six-digit code valid for ten minutes. We
            store your email address, your name (if you give it), when you last signed in and your saved
            basket.
          </li>
          {f.googleSignIn ? (
            <li>
              <strong>“Sign in with Google”:</strong> if you choose it, we send you to Google (Google Ireland
              Limited, Gordon House, Barrow Street, Dublin 4, Ireland). We pass no data about you to Google,
              but Google learns from the sign-in itself that you are signing in to {f.platform}. From Google
              we receive your name, email address and Google account ID. Google may also transfer data to the
              USA; Google’s privacy notice applies.
            </li>
          ) : null}
          <li>
            The sign-in cookie <span className="mono">customer_session</span> lasts {s.customerDays} days or
            until you sign out.
          </li>
        </ul>
        <p>
          <strong>Manage it yourself:</strong> on <Link href="/account" style={linkStyle}>/account</Link> you
          can download your data as a file (JSON) and delete your account at any time. Accounts nobody has
          signed in to for {d.customerInactive} days are deleted automatically, basket included. Your orders
          are not affected – they follow the periods in section 5.
        </p>
        <p style={{ marginBottom: 0 }}>
          The legal basis is Art. 6(1)(b) GDPR (providing the account you asked for).
        </p>
      </Sec>

      <Sec id="mitteilungen" title="8. “Keep me posted” – a seller’s announcements">
        <p>
          At checkout there is an optional box asking whether that one seller may tell you when they announce
          something new. It is never pre-ticked, and your order works exactly the same without it. The seller
          is the controller; we send on their behalf.
        </p>
        <p>
          <strong>Double opt-in:</strong> ticking the box does not subscribe you by itself – anyone could type
          anyone’s address. You get one confirmation email, and only the button in it puts you on the list. No
          press, no subscription; unconfirmed requests are deleted after {d.buyer} days.
        </p>
        <p>
          Once you confirm, we keep your email address – the address alone, not your name – with the time of
          your consent, for exactly one job: that one seller’s announcements, at most one email per new
          listing. Because you asked for it, this address outlives the after-event erasure and stays until you
          unsubscribe.
        </p>
        <p>
          Every announcement carries an unsubscribe link – one click, no sign-in, no expiry. After you
          unsubscribe, your address is kept only as a do-not-email record, so nobody can add you back without
          a fresh consent you confirm yourself. Want even that record erased? Just ask.
        </p>
        <p style={{ marginBottom: 0 }}>
          The legal basis is your consent (Art. 6(1)(a) GDPR), which you can withdraw at any time with effect
          for the future (Art. 7(3) GDPR). The do-not-email record rests on Art. 6(1)(c) and (f) GDPR (proof
          of consent and respecting your withdrawal).
        </p>
      </Sec>

      <Sec id="kundenkarte" title="9. Customer card">
        <p>
          Once you have paid, the order page offers you a card with that one seller. It is only an offer: no
          press, no card. The seller is the controller.
        </p>
        <p>
          Press it and we store your email address, filed against that seller, and give you a page of your
          own with a QR code. The page shows your referral code, your vouchers and what you have bought{' '}
          <em>from that seller</em>. The QR carries the card’s random code and nothing else.
        </p>
        <p>
          The card works with that one seller only. It does not recognise you at another seller, and nowhere
          on {f.platform} are your cards put side by side. Only that seller can look the code up, and then
          sees your name, how many orders you have placed with them, how long you have held the card and which
          vouchers you have not spent. Door staff with a scanner link cannot.
        </p>
        <p style={{ marginBottom: 0 }}>
          The card lasts as long as you want it: “Close this card” on the card page deletes it outright, no
          sign-in needed. The legal basis is Art. 6(1)(b) GDPR (the service you asked the seller for).
        </p>
      </Sec>

      <Sec id="abonnements" title="10. Subscribe & save (standing orders)">
        <p style={{ marginBottom: 0 }}>
          Where a seller offers regular deliveries or collections, we store your name, email address, chosen
          items, rhythm and status. You manage the subscription through a private link in your emails (pause,
          resume, cancel). The seller is the controller; the legal basis is Art. 6(1)(b) GDPR. Cancelled or
          ended subscriptions are deleted {d.subscriptionEnded} days after they end, and also when the listing
          no longer exists. The individual orders follow the periods in section 5.
        </p>
      </Sec>

      <Sec id="empfehlungen" title="11. Referrals and vouchers">
        <p>
          After an order you can share a link carrying a random referral code. If someone books through it,
          the seller can see in their insights who referred whom (by name) and may thank you with a voucher,
          which we email to you. The seller is the controller; the legal basis is Art. 6(1)(b) GDPR (taking
          part in the seller’s referral offer).
        </p>
        <p style={{ marginBottom: 0 }}>
          Your email address as the referrer on a voucher is erased {d.referral} days after the voucher is
          spent or expires – but not while you still have a paid order with that seller whose details have not
          yet been erased; then together with it.
        </p>
      </Sec>

      <Sec id="bewertungen" title="12. Reviews">
        <p style={{ marginBottom: 0 }}>
          After a purchase you can write a review. We check against your order that you really bought, and
          publish your text with a short byline of first name and initial (e.g. “Sunita K.”). Reviews may be
          checked before or after publication and removed if unlawful. When your order is erased under
          section 5, your review is anonymised too: the words stay, your name does not. We are the controller;
          the legal basis is Art. 6(1)(b) GDPR (the review feature you use) and, for checking authenticity,
          Art. 6(1)(f) GDPR (our interest in trustworthy reviews). We delete your review on request.
        </p>
      </Sec>

      <Sec id="warteliste" title="13. Sold-out waitlist">
        <p style={{ marginBottom: 0 }}>
          When a listing has sold out, you can leave your email address. That is all we store – no name, no
          account. If spots free up, everyone on the list gets exactly one email at the same moment. After
          that your address is deleted within {d.waitlistNotified} days; if the event takes place without
          anything freeing up, it is deleted then. For goods and undated listings an entry is deleted at the
          latest {d.waitlistShopMax} days after you signed up. The seller sees only how many people are
          waiting, not the addresses. We are the controller; the legal basis is Art. 6(1)(b) GDPR (the
          notification you asked for).
        </p>
      </Sec>

      <Sec id="fragen" title="14. Questions to sellers, the AI helper, the Ask bar and the help bot">
        <Sub>Questions to the seller (question form)</Sub>
        <p>
          With the question form on a listing you can ask the seller something without signing in. Name and
          email are optional; we use the email only to send you the seller’s answer. The question goes
          straight to the seller, who answers it in their seller hub – no AI service is involved.
        </p>
        <p>
          <strong>Answered questions are published with their answer on the listing page</strong> – without
          your name or email (“Asked by a visitor”). So write your question as if it were public. The
          listing’s AI helper (below) may use published questions and answers as background. Name and email
          are erased on the same clock as order details (section 5; for goods counted from when you asked);
          unanswered questions are then deleted entirely. Question and answer stay as public information about
          the listing.
        </p>
        <p>
          The seller is the controller; we process the question on their behalf. Legal bases: Art. 6(1)(b)
          GDPR for answering, including by email (your request, often before a booking), and Art. 6(1)(f)
          GDPR for publishing it without your name (the seller’s interest in giving other visitors the same
          answer). Your question is removed on request.
        </p>
        <Sub>The AI helper on listings</Sub>
        <p>
          For an instant answer you can ask the listing’s AI helper instead. Your text is sent to an AI service
          (section 18) together with the listing’s information and the questions and answers published there,
          and is not stored in our database. If the helper finds no answer, you can pass the question to the
          seller with one click – only then is it stored as described above. We are the controller for the AI
          helper; the legal basis is Art. 6(1)(b) GDPR (the feature you use).
        </p>
        <Sub>The Ask bar and the help bot</Sub>
        <p style={{ marginBottom: 0 }}>
          What you type into the Ask bar or the help bot is sent to an AI service (section 18) to find
          matching listings or answer questions about the platform. We do not store it in our database; the
          history lives only in your browser’s session storage. Please do not type personal details there.
          The legal basis is Art. 6(1)(b) GDPR (the feature you use).
        </p>
      </Sec>

      <Sec id="mikrofon" title="15. Voice input (microphone)">
        <p style={{ marginBottom: 0 }}>
          Wherever you see a microphone, using it is your choice – every one of those boxes can be typed into
          instead. Nothing is recorded until you tap it and your browser allows access. The recording is sent
          to Google Gemini, which turns it into text and sends the text back – only under the terms of paid
          use (section 18); otherwise the feature is switched off. We do not save the recording on the server,
          in the database or in logs; it exists for the duration of the request. Only the text you see and can
          edit remains. The legal basis is Art. 6(1)(b) GDPR (the feature you started).
        </p>
      </Sec>

      <Sec id="kontakt" title="16. Contact form and contact chat">
        <p>
          The <Link href="/contact" style={linkStyle}>contact form</Link> asks for your name, email and what
          you would like – plus a few optional details about your event if you are asking for a seller
          account. We store the request so it cannot be lost to an email outage, and email it to ourselves.
        </p>
        <p>
          The <strong>contact chat</strong> on the same page is answered by Google Gemini – only under the
          terms of paid use (section 18); otherwise it answers without AI. Email addresses and phone numbers
          are removed from your text automatically before it is sent.
        </p>
        <p style={{ marginBottom: 0 }}>
          We are the controller. The legal basis is Art. 6(1)(b) GDPR where your request is aimed at a
          contract (e.g. a seller account), otherwise Art. 6(1)(f) GDPR (our interest in answering requests).
          Requests are deleted {d.contact} days after they arrive, or sooner if you ask.
        </p>
      </Sec>

      <Sec id="uebersetzung" title="17. Automatic translation">
        <p style={{ marginBottom: 0 }}>
          Pages can be translated automatically into German or Nepali. Only the page’s own text is sent to
          Google Gemini for this. Names, email addresses, phone numbers, bank details, order and ticket codes
          and other buyer details are excluded.{' '}
          {geminiMayProcessPersonalData()
            ? 'This runs under the terms of paid use of the Gemini API, under which Google does not use the text to improve its products.'
            : 'Because only published page text is sent, the free tier of the Gemini API may be used for this.'}{' '}
          Translations are cached on our server and in your browser (section 4). Legal
          texts such as this policy are never machine-translated. The legal basis is Art. 6(1)(f) GDPR (our
          interest in offering the platform in its users’ languages).
        </p>
      </Sec>

      <Sec id="ki" title="18. How we use AI services">
        <ul style={ul}>
          <li>
            <strong>Google Gemini</strong> (Google Cloud EMEA Limited, Dublin, Ireland, or Google LLC, USA)
            receives content that may contain personal data – what you type into the AI helper, the Ask bar
            and the help bot, voice input, the contact chat and the assistant tools for sellers –{' '}
            <strong>only</strong> once we have set up paid use. Under Google’s
            terms for paid use, your content is not used to improve Google’s products and is handled under
            Google’s data processing addendum. Otherwise, or once the daily limit is reached, these features
            work without AI or with Anthropic.
          </li>
          <li>
            <strong>Anthropic</strong> (Anthropic Ireland, Limited, Dublin, Ireland, or Anthropic, PBC, USA)
            answers as a fallback when Gemini is unavailable and helps sellers draft FAQ entries and
            design pages. Under Anthropic’s commercial terms, content sent through its API is not used for
            training.
          </li>
          <li>
            The AI makes no decisions about you; it words answers and texts. Answers can be wrong – what the
            seller states is what counts.
          </li>
        </ul>
        <p style={{ marginBottom: 0 }}>Both act as processors. {TRANSFER_BASIS_EN}</p>
      </Sec>

      {/* Only when analytics is actually switched on — see PrivacyDe.tsx. */}
      {process.env.NEXT_PUBLIC_GA_ID ? (
        <Sec id="analytics" title="19. Counting visits (Google Analytics)">
          <p>
            We use <strong>Google Analytics 4</strong> to see which pages people actually read – it is how we
            decide what to build next, and it is the only measurement on this site.
          </p>
          <p>
            <strong>It only runs if you said yes.</strong> Until you answer the banner nothing is loaded – no
            script, no cookie, no request to Google. Saying no is one click, the same as saying yes, and no
            feature depends on it. Not answering counts as no.
          </p>
          <p>
            What is sent is the page (without anything after the question mark), roughly where you are, your
            browser and device, and the referring page; Google sets the cookies{' '}
            <span className="mono">_ga</span> and <span className="mono">_ga_…</span> (up to 2 years) to tell
            visits apart. <strong>Never</strong> measured, whatever you answered: your order page, your
            tickets, your customer card, your subscription, your account, the door scanner, the seller hub and
            the admin area. Nothing you type is sent to Google.
          </p>
          <p>
            The recipient is <strong>Google Ireland Limited</strong>, Gordon House, Barrow Street, Dublin 4,
            Ireland; data may be transferred to Google LLC in the <strong>USA</strong>. {TRANSFER_BASIS_EN} The
            legal basis is your consent (Art. 6(1)(a) GDPR, § 25(1) TDDDG). You can withdraw it at any time,
            as easily as you gave it:
          </p>
          <ConsentControl />
          <p className="muted small" style={{ marginBottom: 0 }}>
            Withdrawing stops the counting immediately and deletes the cookies Google has already set on this
            device. A browser that blocks analytics cookies, or any of the usual blockers, stops it too.
          </p>
        </Sec>
      ) : null}

      <Sec id="app" title="20. Installable app and offline tickets">
        <p style={{ marginBottom: 0 }}>
          You can install {f.platform} on your device like an app. The app then keeps the site’s program files
          and images and – so you can show your ticket at the door without signal – your own ticket pages, each
          for at most {d.offlineTicket} days. This happens only on your device; none of it is sent to us.
          Order pages, customer cards, subscriptions, your account, the basket, the seller hub and the admin
          area are never kept, and signing out deletes kept pages. The legal basis is § 25(2) no. 2 TDDDG
          together with Art. 6(1)(b) GDPR.
        </p>
      </Sec>

      <Sec id="fotos" title="21. Sellers’ photos and videos">
        <p style={{ marginBottom: 0 }}>
          Photos and videos on listings are uploaded by the sellers themselves. Location and camera data
          (metadata) is removed automatically. The seller is responsible for publishing pictures in which
          people can be recognised and needs a legal basis for it, such as consent – and for children, their
          parents’ consent. If you appear in a picture and do not agree, contact the seller or us – we will
          pass your request on and remove unlawful content.
        </p>
      </Sec>

      <Sec id="anbieter" title="22. Information for organizers and sellers">
        <p>
          This section concerns you if you offer events or goods on {f.platform} yourself. For your own data
          we are the controller; for your customers’ data you are the controller and we are your processor
          under the{' '}
          <Link href="/avv" style={linkStyle}>
            data processing agreement
          </Link>
          , which is part of the <Link href="/terms" style={linkStyle}>terms for sellers</Link>.
        </p>
        <Sub>What data</Sub>
        <ul style={ul}>
          <li>
            <strong>Account:</strong> name, email, password (only as a salted scrypt hash), where used the
            secret of your authenticator app for two-step sign-in (stored encrypted), sessions, time and browser of new sign-ins
            (for the sign-in alert), sign-in and reset codes (hashed, short-lived).
          </li>
          <li>
            <strong>Legal identity:</strong> name, address, legal representative, register entry and contact
            email where given – shown to buyers on listings, at checkout, on order pages, tickets and in
            emails.
          </li>
          <li>
            <strong>Payout details:</strong> account holder and IBAN, shown to buyers for bank transfers; if
            you choose, the credentials of your own PayPal or Stripe account, which we store encrypted with
            AES-256-GCM and use only to create and check payments for your orders.
          </li>
          <li>
            <strong>Content:</strong> your listings, texts, photos and videos, a WhatsApp number if you give
            one (publicly visible), answers to questions, announcements.
          </li>
          <li>
            <strong>Assistant tools:</strong> what you type into the setup assistant, FAQ drafts or the page
            designer is sent to Google Gemini (only under paid use) or Anthropic (section 18).
          </li>
          <li>Your acceptance of the terms and the data processing agreement (version and time).</li>
        </ul>
        <Sub>Purpose and legal basis</Sub>
        <p>
          Providing the platform under the terms (Art. 6(1)(b) GDPR); security features such as sign-in
          alerts and warnings about changed payout details (Art. 6(1)(f) GDPR – our and your interest in
          preventing misuse of your account and diversion of payments). Emails to you are sent through Twilio
          SendGrid.
        </p>
        <Sub>Storage period</Sub>
        <p style={{ marginBottom: 0 }}>
          For as long as your account exists. After it ends we delete your data and your customers’ data
          within {d.termination} days unless the law requires us to keep it; it disappears from backups within
          a further {d.backup} days at the latest. Export what you need for your books beforehand (CSV export in
          the seller hub).
        </p>
      </Sec>

      <Sec id="empfaenger" title="23. Recipients and transfers outside the EU">
        <p>These service providers process data on our behalf (Art. 28 GDPR):</p>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Recipient</th>
                <th>Purpose</th>
                <th>Location</th>
              </tr>
            </thead>
            <tbody>
              {f.processors.map((p) => (
                <tr key={p.key}>
                  <td>
                    <strong>{p.name}</strong>
                    <br />
                    <span className="small muted">{p.addressEn}</span>
                  </td>
                  <td className="small">{p.purposeEn}</td>
                  <td className="small">{p.locationEn}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ marginTop: 12 }}>These receive data as independent controllers:</p>
        <ul style={ul}>
          <li>the <strong>seller</strong> you order from or ask a question (sections 5–11, 14);</li>
          <li>
            <strong>PayPal</strong> or <strong>Stripe</strong>, when you pay there into the seller’s account
            (section 6);
          </li>
          {f.googleSignIn ? <li><strong>Google</strong>, if you choose “Sign in with Google” (section 7);</li> : null}
          {process.env.NEXT_PUBLIC_GA_ID ? (
            <li>
              <strong>Google Ireland Limited</strong> for Google Analytics, only with your consent (section 19);
            </li>
          ) : null}
          <li>authorities, where we are legally obliged (Art. 6(1)(c) GDPR).</li>
        </ul>
        <p style={{ marginBottom: 0 }}>{TRANSFER_BASIS_EN}</p>
      </Sec>

      <Sec id="speicherdauer" title="24. Storage periods at a glance">
        <div className="table-wrap">
          <table className="table">
            <tbody>
              <tr>
                <td className="small">Name, email, phone, payer, note on an order</td>
                <td className="small">
                  {d.buyer} days after the event; goods {d.buyer} days after collection, at the latest{' '}
                  {d.shopLongStop} days after payment; undated {d.undated} days after the order
                </td>
              </tr>
              <tr>
                <td className="small">Name and email on questions; unanswered questions</td>
                <td className="small">as order details (section 14)</td>
              </tr>
              <tr>
                <td className="small">Name on a review</td>
                <td className="small">when the order behind it is erased</td>
              </tr>
              <tr>
                <td className="small">Waitlist</td>
                <td className="small">
                  {d.waitlistNotified} days after the notification, or when the event passes; goods at the latest
                  after {d.waitlistShopMax} days
                </td>
              </tr>
              <tr>
                <td className="small">“Keep me posted”</td>
                <td className="small">until you unsubscribe (then a do-not-email record); unconfirmed {d.buyer} days</td>
              </tr>
              <tr>
                <td className="small">Customer card</td>
                <td className="small">until you close it</td>
              </tr>
              <tr>
                <td className="small">Ended subscriptions</td>
                <td className="small">{d.subscriptionEnded} days after they end</td>
              </tr>
              <tr>
                <td className="small">Referrer’s email on a voucher</td>
                <td className="small">{d.referral} days after it is spent or expires (section 11)</td>
              </tr>
              <tr>
                <td className="small">Customer account</td>
                <td className="small">until you delete it; automatically after {d.customerInactive} days without sign-in</td>
              </tr>
              <tr>
                <td className="small">Contact requests</td>
                <td className="small">{d.contact} days, sooner on request</td>
              </tr>
              <tr>
                <td className="small">Seller account</td>
                <td className="small">while it exists, then {d.termination} days</td>
              </tr>
              <tr>
                <td className="small">Backups</td>
                <td className="small">{d.backup} days</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="small muted" style={{ marginTop: 12, marginBottom: 0 }}>
          Anonymous counts and amounts with no personal reference remain for the sellers’ books.
        </p>
      </Sec>

      <Sec id="pflicht" title="25. What you must provide; no automated decisions">
        <p>
          To order, your name and email address are required – without them the seller cannot issue a ticket
          or match a payment. A customer account requires an email address. Everything else is optional; there
          is no legal obligation to provide any of it.
        </p>
        <p style={{ marginBottom: 0 }}>
          There is no automated decision-making, including profiling, within the meaning of Art. 22 GDPR.
        </p>
      </Sec>

      <Sec id="rechte" title="26. Your rights">
        <p>Under the GDPR you have the right to</p>
        <ul style={ul}>
          <li>access the data we hold about you (Art. 15),</li>
          <li>have inaccurate data corrected (Art. 16),</li>
          <li>erasure (Art. 17),</li>
          <li>restriction of processing (Art. 18),</li>
          <li>data portability (Art. 20),</li>
          <li>object to processing based on Art. 6(1)(f) (Art. 21, see below),</li>
          <li>
            withdraw consent at any time with effect for the future (Art. 7(3)); processing before the
            withdrawal remains lawful.
          </li>
        </ul>
        <p style={{ marginBottom: 0 }}>
          Contact us <ContactLine f={f} />. With a customer account you can also download and delete your data
          yourself on <Link href="/account" style={linkStyle}>/account</Link>. Where your request concerns data
          a seller is responsible for, you can also go to the seller directly; if it reaches us, we forward it
          without delay.
        </p>
      </Sec>

      <Sec id="widerspruch" title="27. Right to object" tone="notice">
        <p style={{ fontWeight: 600 }}>
          Where we process your data on the basis of Art. 6(1)(f) GDPR (legitimate interests), you have the
          right to object at any time, on grounds relating to your particular situation (Art. 21(1) GDPR). We
          will then stop, unless we can demonstrate compelling legitimate grounds that override your
          interests, rights and freedoms, or the processing serves the establishment, exercise or defence of
          legal claims.
        </p>
        <p style={{ fontWeight: 600, marginBottom: 0 }}>
          Where your data is processed for direct marketing – such as a seller’s announcements – you can object
          at any time without giving reasons (Art. 21(2) and (3) GDPR); the easiest way is the unsubscribe link
          in every announcement. Otherwise send your objection informally to us, <ContactLine f={f} />.
        </p>
      </Sec>

      <Sec id="beschwerde" title="28. Right to complain">
        <p>
          You have the right to lodge a complaint with a data protection supervisory authority (Art. 77 GDPR),
          in particular in the member state of your habitual residence, your place of work or the place of the
          alleged infringement. The authority responsible for us is:
        </p>
        <p style={{ paddingLeft: 16, borderLeft: '3px solid var(--border)', marginBottom: 0 }}>
          {f.authority.name}
          {f.authority.addressLines.map((l, i) => (
            <span key={i}>
              <br />
              {l}
            </span>
          ))}
          <br />
          <a href={f.authority.url} rel="noopener noreferrer" target="_blank" style={linkStyle}>
            {f.authority.url.replace(/^https?:\/\//, '')}
          </a>
        </p>
      </Sec>

      <Sec id="aenderungen" title="29. Changes to this policy">
        <p style={{ marginBottom: 0 }}>
          We update this policy when the platform or the law changes. The version published here applies. The
          German version is binding; this English version is for information.
        </p>
      </Sec>
    </>
  );
}
