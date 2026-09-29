import type { Metadata } from 'next';
import Link from 'next/link';
import { operatorAddressLines, operatorEmail, operatorName, operatorPhone } from '@/lib/legal';
import { platformName } from '@/lib/platform';

// The operator's details come from the environment (lib/legal), so the page is
// rendered per request rather than baked at build time with stale values.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Impressum · Legal notice',
  description: 'Anbieterkennzeichnung nach § 5 DDG und Verantwortlicher nach § 18 Abs. 2 MStV.',
  alternates: { canonical: '/impressum' },
};

const linkStyle = { color: 'var(--brand-text)', fontWeight: 600 } as const;

/**
 * The Impressum (§ 5 DDG — the Digitale-Dienste-Gesetz replaced the TMG in May
 * 2024). Deliberately lean: who runs the site, how to reach him quickly, who
 * answers for editorial content, and the one thing a marketplace-like site
 * must add — that each listing is its seller's own, with the seller's details
 * shown on the listing itself.
 *
 * No link to the EU online dispute resolution platform: it was shut down in
 * July 2025 (Regulation (EU) 2024/3228), and a dead link would be the only
 * inaccurate line on the page.
 *
 * German is the binding text; the English labels are there so a visitor who
 * reads no German still finds the address and the contact.
 */
export default function ImpressumPage() {
  const name = operatorName();
  const address = operatorAddressLines();
  const email = operatorEmail();
  const phone = operatorPhone();
  const platform = platformName();

  const block = (
    <>
      {name}
      {address.map((line, i) => (
        <span key={i}>
          <br />
          {line}
        </span>
      ))}
    </>
  );

  return (
    <div translate="no" lang="de" className="notranslate">
      <section className="feed-hero" style={{ padding: '64px 0 28px' }}>
        <div className="container container-narrow">
          <p className="feed-kicker anim-fade-up">Impressum · Legal notice</p>
          <h1 className="anim-fade-up anim-d1" style={{ fontSize: 'clamp(1.9rem, 4.4vw, 3rem)' }}>
            Impressum
          </h1>
          <p className="feed-hero-sub anim-fade-up anim-d2" style={{ marginBottom: 0 }}>
            {platform} ist eine unentgeltliche Plattform für Veranstaltungen und Nepali-Geschäfte, betrieben
            von einer Privatperson. <span lang="en">— {platform} is a free platform for events and Nepali
            shops, run by a private individual.</span>
          </p>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 20 }}>
        <div className="container container-narrow">
          <div className="card">
            <h2 className="card-title">
              Angaben gemäß § 5 DDG <span className="muted small">· Information pursuant to § 5 DDG</span>
            </h2>
            <p style={{ marginBottom: 0 }}>{block}</p>
          </div>

          <div className="card">
            <h2 className="card-title">
              Kontakt <span className="muted small">· Contact</span>
            </h2>
            <p style={{ marginBottom: 0 }}>
              {email ? (
                <>
                  E-Mail:{' '}
                  <a href={`mailto:${email}`} style={linkStyle}>
                    {email}
                  </a>
                  <br />
                </>
              ) : null}
              {phone ? (
                <>
                  Telefon <span className="muted">· Phone</span>: {phone}
                  <br />
                </>
              ) : null}
              Kontaktformular <span className="muted">· Contact form</span>:{' '}
              <Link href="/contact" style={linkStyle}>
                /contact
              </Link>
            </p>
          </div>

          <div className="card">
            <h2 className="card-title">Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h2>
            <p style={{ marginBottom: 0 }}>{block}</p>
          </div>

          <div className="card">
            <h2 className="card-title">
              Angebote von Veranstaltern und Verkäufern{' '}
              <span className="muted small">· Listings by organizers and sellers</span>
            </h2>
            <p>
              {platform} stellt die technische Plattform bereit. Veranstaltungen, Warenangebote und die
              zugehörigen Texte, Bilder und Preise veröffentlichen die jeweiligen Veranstalter und Verkäufer in
              eigener Verantwortung. Beim Kauf eines Tickets oder einer Ware ist ausschließlich der jeweilige
              Veranstalter bzw. Verkäufer Vertragspartner; Name, Anschrift und Vertretungsberechtigte stehen
              auf jeder Angebotsseite, im Bestellvorgang und auf der Bestellbestätigung.
            </p>
            <p className="muted small" style={{ marginBottom: 0 }}>
              Each event and shop is published by its own organizer or seller, who is also the party you buy
              from; their details appear on the listing, at checkout and on your order confirmation.
            </p>
          </div>

          <div className="card">
            <h2 className="card-title">
              Hinweise auf rechtswidrige Inhalte, Kontaktstelle{' '}
              <span className="muted small">· Reporting illegal content, point of contact</span>
            </h2>
            <p style={{ marginBottom: 0 }}>
              Rechtswidrige Inhalte können Sie uns jederzeit über das{' '}
              <Link href="/contact" style={linkStyle}>
                Kontaktformular
              </Link>
              {email ? <> oder per E-Mail an {email}</> : null} melden (Art. 16 DSA); bitte nennen Sie die
              genaue Adresse der Seite und den Grund. Dieselben Wege sind die zentrale Kontaktstelle für
              Behörden und für Nutzerinnen und Nutzer nach Art. 11 und 12 DSA. Wir kommunizieren auf Deutsch und
              Englisch.
            </p>
          </div>

          <div className="card">
            <h2 className="card-title">Verbraucherstreitbeilegung</h2>
            <p style={{ marginBottom: 0 }}>
              Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer
              Verbraucherschlichtungsstelle teilzunehmen (§ 36 VSBG).
            </p>
          </div>

          <div className="card">
            <h2 className="card-title">Haftung für Inhalte und Links</h2>
            <p>
              Für eigene Inhalte sind wir nach den allgemeinen Gesetzen verantwortlich. Für Inhalte, die
              Veranstalter und Verkäufer veröffentlichen, sind wir nicht zu einer allgemeinen Überwachung
              verpflichtet; sobald wir von einer Rechtsverletzung Kenntnis erhalten, entfernen oder sperren wir
              den Inhalt unverzüglich.
            </p>
            <p style={{ marginBottom: 0 }}>
              Für die Inhalte verlinkter fremder Websites ist deren jeweiliger Anbieter verantwortlich. Zum
              Zeitpunkt der Verlinkung waren keine Rechtsverstöße erkennbar; bei Bekanntwerden entfernen wir
              solche Links umgehend.
            </p>
          </div>

          <p className="muted small" style={{ marginTop: 16 }}>
            Siehe auch <span lang="en">· See also</span>:{' '}
            <Link href="/privacy" style={linkStyle}>
              Datenschutzerklärung
            </Link>{' '}
            ·{' '}
            <Link href="/terms" style={linkStyle}>
              Nutzungsbedingungen
            </Link>{' '}
            ·{' '}
            <Link href="/avv" style={linkStyle}>
              Auftragsverarbeitungsvertrag
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
