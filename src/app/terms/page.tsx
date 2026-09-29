import type { Metadata } from 'next';
import Link from 'next/link';
import PrintButton from '@/components/legal/PrintButton';
import { LegalSection as Sec, legalListStyle as ul } from '@/components/legal/LegalSection';
import { getBaseUrl } from '@/lib/config';
import {
  LEGAL_TERMS_VERSION,
  TERMINATION_DELETION_DAYS,
  legalDateLabel,
  operatorAddressLines,
  operatorEmail,
  operatorName,
} from '@/lib/legal';
import { platformName } from '@/lib/platform';
import { BACKUP_RETENTION_DAYS } from '@/lib/retention';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Nutzungsbedingungen für Veranstalter und Verkäufer',
  description:
    'Die Bedingungen, zu denen Veranstalter und Verkäufer die Plattform unentgeltlich nutzen. Terms for organizers and sellers.',
  alternates: { canonical: '/terms' },
};

const linkStyle = { color: 'var(--brand-text)', fontWeight: 600 } as const;

/** Notice the operator gives before ending an account without cause (§ 10). */
const OPERATOR_NOTICE_DAYS = 14;
/** Notice before the whole platform is switched off (§ 10). */
const SHUTDOWN_NOTICE_WEEKS = 4;

/**
 * The organizer and seller terms. The legal architecture in one sentence: the
 * operator provides software and nothing else — every ticket and every jar of
 * achar is sold by the seller, in their own name and for their own account,
 * and the money goes to them directly. Everything below follows from that,
 * and it is also why the buyer-facing pages must name the seller: a platform
 * that sells for an UNNAMED principal can itself be treated as the seller
 * (for VAT, § 3 Abs. 11 UStG), which would make every ticket its turnover.
 *
 * Organizers accept this text together with the AVV (/avv) in the portal; the
 * accepted version is LEGAL_TERMS_VERSION, so change that constant whenever
 * this text changes in substance.
 */
export default function TermsPage() {
  const platform = platformName();
  const base = getBaseUrl();
  const email = operatorEmail();
  const stand = legalDateLabel(LEGAL_TERMS_VERSION, 'de');

  return (
    <div translate="no" lang="de" className="notranslate">
      <section className="feed-hero" style={{ padding: '64px 0 28px' }}>
        <div className="container container-narrow">
          <p className="feed-kicker anim-fade-up">For organizers and sellers · Für Veranstalter und Verkäufer</p>
          <h1 className="anim-fade-up anim-d1" style={{ fontSize: 'clamp(1.8rem, 4.2vw, 2.8rem)' }}>
            Nutzungsbedingungen für Veranstalter und Verkäufer
          </h1>
          <p className="muted small anim-fade-up anim-d2" style={{ marginBottom: 12 }}>
            Stand: {stand} · Version {LEGAL_TERMS_VERSION}
          </p>
          <PrintButton />
        </div>
      </section>

      <section className="section" style={{ paddingTop: 20 }}>
        <div className="container container-narrow">
          <div className="card glow-card" lang="en">
            <h2 className="card-title">In short (English summary, not binding)</h2>
            <ul style={{ ...ul, marginBottom: 12 }}>
              <li>
                {platform} is <strong>free</strong>. We provide the software; we take no fee and never hold
                your buyers&rsquo; money.
              </li>
              <li>
                <strong>You are the seller.</strong> You sell in your own name and for your own account, set
                your prices, and handle refunds, cancellations, taxes and any withdrawal rules yourself.
              </li>
              <li>
                Enter your correct <strong>legal identity</strong> (name, address, who represents you) — it is
                shown to your buyers.
              </li>
              <li>
                You are responsible for your content, including the rights to your photos and the consent of
                the people in them (parents&rsquo; consent for children).
              </li>
              <li>
                Your buyers&rsquo; data is <em>your</em> data; we process it for you under the{' '}
                <Link href="/avv" style={linkStyle}>
                  data processing agreement
                </Link>
                , which is part of these terms.
              </li>
              <li>
                We may remove unlawful content or suspend accounts. No guaranteed availability; liability is
                limited as far as the law allows for a free service.
              </li>
              <li>
                Either side can end this at any time; your data is then deleted as the AVV says. German law
                applies; the German text below is binding.
              </li>
            </ul>
          </div>

          <Sec id="p1" title="§ 1 Geltungsbereich und Betreiber">
            <p>
              (1) Diese Nutzungsbedingungen regeln die Nutzung der Plattform {platform} (erreichbar unter{' '}
              {base}) durch Veranstalter und Verkäufer (nachfolgend „Anbieter“), etwa Vereine, Unternehmen oder
              Privatpersonen, die Veranstaltungen oder Waren anbieten.
            </p>
            <p>
              (2) Betreiber der Plattform ist {operatorName()}, {operatorAddressLines().join(', ')}{' '}
              (nachfolgend „Betreiber“). Kontakt: {email ? <>{email} oder </> : null}
              <Link href="/contact" style={linkStyle}>
                Kontaktformular
              </Link>
              .
            </p>
            <p style={{ marginBottom: 0 }}>
              (3) Abweichende Bedingungen des Anbieters gelten nicht, auch wenn der Betreiber ihnen nicht
              ausdrücklich widerspricht.
            </p>
          </Sec>

          <Sec id="p2" title="§ 2 Leistungen des Betreibers, Unentgeltlichkeit">
            <p>
              (1) Der Betreiber stellt eine technische Plattform (Software) bereit, mit der Anbieter
              Angebotsseiten erstellen, Bestellungen und Reservierungen entgegennehmen, Tickets und Abholcodes
              ausgeben, den Einlass bzw. die Abholung prüfen und Auswertungen abrufen können. Der Umfang ergibt
              sich aus der jeweils aktuellen Funktionalität der Plattform.
            </p>
            <p>
              (2) Die Nutzung ist <strong>unentgeltlich</strong>. Der Betreiber erhebt keine Gebühren und
              keine Provisionen und erhält keine Zahlungen von Käuferinnen und Käufern. Kostenpflichtige
              Leistungen könnten künftig nur nach vorheriger Ankündigung und aufgrund einer gesonderten
              Vereinbarung eingeführt werden; eine Zahlungspflicht entsteht nie ohne Ihre ausdrückliche
              Zustimmung.
            </p>
            <p style={{ marginBottom: 0 }}>
              (3) Ein Anspruch auf bestimmte Funktionen besteht nicht. Der Betreiber kann Funktionen ändern,
              erweitern oder einschränken, soweit dies unter Berücksichtigung der Interessen der Anbieter
              zumutbar ist; wesentliche Einschränkungen kündigt er rechtzeitig an.
            </p>
          </Sec>

          <Sec id="p3" title="§ 3 Rolle des Betreibers, Verträge mit Käufern">
            <p>
              (1) Der Betreiber ist weder Veranstalter noch Verkäufer, weder Vertreter noch Vermittler des
              Anbieters, nimmt keine Zahlungen für ihn entgegen und ist nicht Partei der Verträge zwischen
              Anbietern und Käuferinnen bzw. Käufern.
            </p>
            <p>
              (2) Verträge über Tickets, Waren und sonstige Leistungen kommen ausschließlich zwischen dem
              Anbieter und der Käuferin bzw. dem Käufer zustande. Der Anbieter handelt dabei{' '}
              <strong>im eigenen Namen und auf eigene Rechnung</strong>.
            </p>
            <p>
              (3) Käuferinnen und Käufer zahlen unmittelbar an den Anbieter – durch Überweisung auf dessen Konto
              oder über dessen eigenes, von ihm mit der Plattform verbundenes PayPal- oder Stripe-Konto. Der
              Betreiber hat keinen Zugriff auf diese Gelder. Für die Nutzung von PayPal und Stripe gelten
              ausschließlich die Verträge zwischen dem Anbieter und diesen Zahlungsdiensten, deren Einhaltung
              dem Anbieter obliegt.
            </p>
            <p>(4) Der Anbieter ist insbesondere selbst verantwortlich für</p>
            <ul style={ul}>
              <li>Preise, Preisangaben und die Beschreibung seiner Angebote;</li>
              <li>
                die Erbringung der Leistung (Durchführung der Veranstaltung, Übergabe oder Lieferung der Ware)
                sowie Absagen, Stornierungen, Erstattungen und Gewährleistung;
              </li>
              <li>
                die gesetzlichen Informationspflichten gegenüber Verbraucherinnen und Verbrauchern, soweit er
                Unternehmer ist, einschließlich der Prüfung, ob und in welchem Umfang ein Widerrufsrecht besteht
                (vgl. § 312g BGB), und einer gegebenenfalls erforderlichen Widerrufsbelehrung;
              </li>
              <li>Steuern und Abgaben sowie seine Buchführung;</li>
              <li>
                erforderliche Genehmigungen und die Einhaltung der für sein Angebot geltenden Vorschriften (etwa
                Lebensmittel- und Hygienerecht, Jugendschutz, Urheber- und Aufführungsrechte);
              </li>
              <li>die Beantwortung von Anfragen seiner Käuferinnen und Käufer.</li>
            </ul>
            <p style={{ marginBottom: 0 }}>
              (5) Der Betreiber ist nicht verpflichtet, Streitigkeiten zwischen Anbietern und Käufern zu klären.
            </p>
          </Sec>

          <Sec id="p4" title="§ 4 Konto und Anbieterkennzeichnung">
            <p>
              (1) Die Registrierung setzt wahrheitsgemäße Angaben voraus. Natürliche Personen müssen volljährig
              sein; Vereine und andere Organisationen handeln durch ihre Vertretungsberechtigten. Das Konto ist
              nicht übertragbar.
            </p>
            <p>
              (2) Der Anbieter hinterlegt im Veranstalterbereich zutreffende und vollständige Angaben zu seiner
              Identität: Name bzw. Bezeichnung, ladungsfähige Anschrift, Vertretungsberechtigte und,
              soweit vorhanden, Registereintrag. Diese Angaben werden Käuferinnen und Käufern auf
              Angebotsseiten, im Bestellvorgang, auf Bestellseiten, Tickets und in E-Mails angezeigt; sie
              kennzeichnen den Anbieter als Vertragspartner und als Verantwortlichen für die Daten seiner
              Kundinnen und Kunden. Der Anbieter hält sie stets aktuell. Weitergehende eigene
              Kennzeichnungspflichten (etwa nach § 5 DDG) bleiben seine Sache.
            </p>
            <p>
              (3) Der Anbieter hält seine Zugangsdaten geheim, nutzt die angebotene Zwei-Faktor-Anmeldung und
              informiert den Betreiber unverzüglich, wenn er einen Missbrauch vermutet. Er ist für Handlungen
              verantwortlich, die über sein Konto oder die von ihm ausgegebenen Scan-Links vorgenommen werden,
              soweit er dies zu vertreten hat.
            </p>
            <p style={{ marginBottom: 0 }}>
              (4) Der Anbieter ist für die Richtigkeit seiner Bank- und Zahlungsangaben verantwortlich. Zugangsdaten
              zu seinem PayPal- oder Stripe-Konto speichert der Betreiber verschlüsselt und verwendet sie
              ausschließlich, um Zahlungen für Bestellungen des Anbieters anzulegen und deren Status zu prüfen.
            </p>
          </Sec>

          <Sec id="p5" title="§ 5 Inhalte des Anbieters">
            <p>
              (1) Der Anbieter ist für alle Inhalte verantwortlich, die er einstellt – Texte, Bilder, Videos,
              Preise, Antworten auf Fragen, Mitteilungen. Sie müssen zutreffend und rechtmäßig sein.
            </p>
            <p>
              (2) Unzulässig sind insbesondere rechtswidrige Inhalte und Angebote, Verletzungen von Rechten
              Dritter (etwa Urheber-, Marken- oder Persönlichkeitsrechte), irreführende Angaben, jugendgefährdende,
              diskriminierende oder volksverhetzende Inhalte sowie Angebote von Waren, deren Verkauf verboten
              ist.
            </p>
            <p>
              (3) Für Fotos und Videos muss der Anbieter die erforderlichen Nutzungsrechte besitzen. Sind
              Personen erkennbar, sorgt er für eine Rechtsgrundlage der Veröffentlichung – in der Regel deren
              Einwilligung (§ 22 KUG, Art. 6 DSGVO), bei Minderjährigen die Einwilligung der
              Sorgeberechtigten. Dass die Plattform Standort- und Kameradaten automatisch aus Bildern entfernt,
              entbindet ihn davon nicht.
            </p>
            <p>
              (4) Der Anbieter räumt dem Betreiber für die Dauer der Veröffentlichung das einfache,
              unentgeltliche Recht ein, seine Inhalte zu speichern, technisch zu bearbeiten (etwa zu
              verkleinern, zuzuschneiden, zu komprimieren und – auch mithilfe externer KI-Dienste –
              maschinell zu übersetzen) und auf der Plattform
              sowie in von ihr erzeugten Vorschauen (etwa beim Teilen eines Links) öffentlich zugänglich zu
              machen – ausschließlich zum Betrieb der Plattform und zur Darstellung seiner Angebote. Eine
              darüber hinausgehende Nutzung, etwa in Werbung für die Plattform, erfolgt nur mit seiner
              gesonderten Zustimmung.
            </p>
            <p style={{ marginBottom: 0 }}>
              (5) Automatische Funktionen – maschinelle Übersetzungen und KI-gestützte Antworten auf
              Besucherfragen aus den Angaben seines Angebots – beruhen auf den Inhalten des Anbieters. Der
              Betreiber übernimmt keine Gewähr für ihre Richtigkeit; maßgeblich sind die Angaben des Anbieters,
              der seine Angebotsseite deshalb vollständig und aktuell halten sollte.
            </p>
          </Sec>

          <Sec id="p6" title="§ 6 Maßnahmen bei Verstößen, Meldungen">
            <p>
              (1) Bei konkreten Anhaltspunkten für rechtswidrige Inhalte oder einen Verstoß gegen diese
              Bedingungen kann der Betreiber Inhalte entfernen oder sperren, Angebote aus der Veröffentlichung
              nehmen oder das Konto vorübergehend oder dauerhaft sperren. Er wählt unter Berücksichtigung der
              berechtigten Interessen des Anbieters das mildeste geeignete Mittel. Die Entscheidung trifft der
              Betreiber persönlich.
            </p>
            <p>
              (2) Der Betreiber teilt dem Anbieter eine solche Maßnahme mit Begründung mit (Art. 17 DSA), soweit
              dem keine rechtlichen Gründe entgegenstehen. Der Anbieter kann über das{' '}
              <Link href="/contact" style={linkStyle}>
                Kontaktformular
              </Link>
              {email ? <> oder per E-Mail</> : null} Stellung nehmen und eine Überprüfung verlangen.
            </p>
            <p>
              (3) Jede Person kann rechtswidrige Inhalte auf demselben Weg melden (Art. 16 DSA). Der Betreiber
              prüft Meldungen zeitnah, sorgfältig und objektiv.
            </p>
            <p style={{ marginBottom: 0 }}>
              (4) Der Anbieter stellt den Betreiber von Ansprüchen Dritter frei, die auf einer von ihm zu
              vertretenden Rechtsverletzung durch seine Inhalte oder Angebote beruhen, einschließlich der
              angemessenen Kosten der Rechtsverteidigung.
            </p>
          </Sec>

          <Sec id="p7" title="§ 7 Verfügbarkeit">
            <p style={{ marginBottom: 0 }}>
              Der Betreiber bemüht sich um einen störungsfreien Betrieb, schuldet aber keine bestimmte
              Verfügbarkeit. Wartung, Störungen und Umstände außerhalb seines Einflusses können die Nutzung
              zeitweise einschränken; auch die Zustellung von E-Mails (etwa durch Spamfilter) kann nicht
              garantiert werden. Der Anbieter sollte daher insbesondere vor einer Veranstaltung die Liste seiner
              Bestellungen exportieren (CSV-Export im Veranstalterbereich) und sich nicht allein auf die
              Plattform verlassen.
            </p>
          </Sec>

          <Sec id="p8" title="§ 8 Haftung">
            <p>
              (1) Der Betreiber haftet unbeschränkt bei Vorsatz und grober Fahrlässigkeit, für Schäden aus der
              Verletzung des Lebens, des Körpers oder der Gesundheit, nach dem Produkthaftungsgesetz sowie im
              Umfang einer übernommenen Garantie.
            </p>
            <p>
              (2) Im Übrigen ist die Haftung für einfache Fahrlässigkeit ausgeschlossen, da die Plattform
              unentgeltlich bereitgestellt wird (vgl. §§ 521, 599 BGB).
            </p>
            <p>
              (3) Für den Verlust von Daten haftet der Betreiber im Rahmen der Absätze 1 und 2 nur in Höhe des
              Aufwands, der bei regelmäßiger Sicherung durch den Anbieter (Export) zur Wiederherstellung
              erforderlich gewesen wäre.
            </p>
            <p style={{ marginBottom: 0 }}>
              (4) Die Beschränkungen gelten auch zugunsten von Erfüllungsgehilfen des Betreibers. Die Haftung
              gegenüber betroffenen Personen nach Art. 82 DSGVO bleibt unberührt.
            </p>
          </Sec>

          <Sec id="p9" title="§ 9 Datenschutz und Auftragsverarbeitung">
            <p>
              (1) Für die personenbezogenen Daten seiner Kundinnen und Kunden ist der Anbieter Verantwortlicher;
              der Betreiber verarbeitet sie als Auftragsverarbeiter. Der{' '}
              <Link href="/avv" style={linkStyle}>
                Auftragsverarbeitungsvertrag
              </Link>{' '}
              ist Bestandteil dieser Nutzungsbedingungen und wird mit ihrer Annahme geschlossen.
            </p>
            <p>
              (2) Für die eigenen Daten des Anbieters (Konto, Anbieterkennzeichnung, Auszahlungsangaben) ist
              der Betreiber Verantwortlicher; Einzelheiten stehen in der{' '}
              <Link href="/privacy?v=de#anbieter" style={linkStyle}>
                Datenschutzerklärung
              </Link>
              .
            </p>
            <p style={{ marginBottom: 0 }}>
              (3) Der Anbieter verwendet die Daten seiner Kundinnen und Kunden nur im gesetzlich zulässigen
              Rahmen, insbesondere für die Abwicklung ihrer Bestellungen. Werbliche Mitteilungen versendet er
              nur an Personen, die dazu eingewilligt haben (etwa über „Keep me posted“), oder soweit es das
              Gesetz sonst erlaubt (§ 7 UWG).
            </p>
          </Sec>

          <Sec id="p10" title="§ 10 Laufzeit und Beendigung">
            <p>
              (1) Der Vertrag läuft auf unbestimmte Zeit. Der Anbieter kann ihn jederzeit ohne Frist beenden,
              indem er dies dem Betreiber in Textform mitteilt. Der Betreiber kann ihn mit einer Frist von{' '}
              {OPERATOR_NOTICE_DAYS} Tagen per E-Mail beenden; das Recht zur Kündigung aus wichtigem Grund bleibt
              unberührt. Stellt der Betreiber die Plattform insgesamt ein, kündigt er dies mindestens{' '}
              {SHUTDOWN_NOTICE_WEEKS} Wochen vorher an.
            </p>
            <p>
              (2) Mit Vertragsende werden die Angebote des Anbieters aus der Veröffentlichung genommen. Verträge,
              die er bereits mit Käuferinnen und Käufern geschlossen hat, hat er weiterhin zu erfüllen oder
              ordnungsgemäß rückabzuwickeln.
            </p>
            <p style={{ marginBottom: 0 }}>
              (3) Der Anbieter kann seine Bestellungen und Abrechnungen bis zum Vertragsende als CSV-Datei
              exportieren. Danach löscht der Betreiber das Konto und alle zugehörigen Daten innerhalb von{' '}
              {TERMINATION_DELETION_DAYS} Tagen nach Maßgabe des Auftragsverarbeitungsvertrags; aus
              Datensicherungen verschwinden sie spätestens nach weiteren {BACKUP_RETENTION_DAYS} Tagen.
            </p>
          </Sec>

          <Sec id="p11" title="§ 11 Änderungen dieser Bedingungen">
            <p style={{ marginBottom: 0 }}>
              Jede Fassung dieser Bedingungen und des Auftragsverarbeitungsvertrags trägt ein Datum und eine
              Versionskennung (derzeit {LEGAL_TERMS_VERSION}). Änderungen teilt der Betreiber dem Anbieter
              rechtzeitig vorher per E-Mail oder im Veranstalterbereich mit; sie gelten erst, wenn der Anbieter
              die neue Fassung dort annimmt. Bis dahin gilt die bisherige Fassung fort. Nimmt der Anbieter die
              neue Fassung nicht an, kann jede Partei den Vertrag nach § 10 beenden.
            </p>
          </Sec>

          <Sec id="p12" title="§ 12 Schlussbestimmungen">
            <p>
              (1) Es gilt das Recht der Bundesrepublik Deutschland unter Ausschluss des UN-Kaufrechts. Ist der
              Anbieter Verbraucher, bleiben zwingende Verbraucherschutzvorschriften des Staates seines
              gewöhnlichen Aufenthalts unberührt.
            </p>
            <p>(2) Ein Gerichtsstand wird nicht vereinbart; es gelten die gesetzlichen Vorschriften.</p>
            <p>
              (3) Sollte eine Bestimmung unwirksam sein, bleibt die Wirksamkeit der übrigen unberührt; an ihre
              Stelle tritt die gesetzliche Regelung.
            </p>
            <p style={{ marginBottom: 0 }}>
              (4) Maßgeblich ist die deutsche Fassung. Übersetzungen und Zusammenfassungen dienen nur der
              Information.
            </p>
          </Sec>

          <p className="muted small" style={{ marginTop: 16 }}>
            Siehe auch:{' '}
            <Link href="/avv" style={linkStyle}>
              Auftragsverarbeitungsvertrag
            </Link>{' '}
            ·{' '}
            <Link href="/privacy?v=de" style={linkStyle}>
              Datenschutzerklärung
            </Link>{' '}
            ·{' '}
            <Link href="/impressum" style={linkStyle}>
              Impressum
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
