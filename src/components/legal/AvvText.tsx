/**
 * The Auftragsverarbeitungsvertrag (Art. 28 GDPR) between an organizer (the
 * controller, "Verantwortlicher") and the platform operator (the processor,
 * "Auftragsverarbeiter"). Rendered publicly on /avv with the controller left
 * generic, and inside the portal with the organizer's own details filled in.
 *
 * SERVER component: it reads the retention constants from lib/retention (which
 * opens SQLite) and the operator from lib/legal, so render it from a server
 * component and pass the organizer's details down as props.
 *
 * Every period in here is QUOTED from the constant the erasure sweep uses —
 * never typed as a number — so the contract and the code cannot disagree about
 * when a buyer disappears. Every technical measure in Anlage 2 is one the code
 * actually takes; if you remove a measure, remove its sentence.
 *
 * German only, on purpose: this is the binding contract, and a translation
 * that drifted from it would be a second, different contract.
 */
import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  BACKUP_RETENTION_DAYS,
  BUYER_RETENTION_DAYS,
  REFERRAL_VOUCHER_RETENTION_DAYS,
  SHOP_UNCOLLECTED_LONG_STOP_DAYS,
  SUBSCRIPTION_ENDED_RETENTION_DAYS,
  UNDATED_ORDER_RETENTION_DAYS,
} from '@/lib/retention';
import {
  LEGAL_TERMS_VERSION,
  TERMINATION_DELETION_DAYS,
  TRANSFER_BASIS_DE,
  dataProcessors,
  hostingInEU,
  hostingRegion,
  legalDateLabel,
  operatorAddressLines,
  operatorEmail,
  operatorName,
} from '@/lib/legal';
import { platformName } from '@/lib/platform';
import { getBaseUrl } from '@/lib/config';

export type AvvParty = {
  name: string;
  addressLines: string[];
  representative?: string;
};

/** Days of notice before a new sub-processor is used (§ 6 Abs. 2). */
const SUBPROCESSOR_NOTICE_DAYS = 14;

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section className="card legal-section" id={id}>
      <h2 className="card-title">{title}</h2>
      {children}
    </section>
  );
}

const listStyle = { paddingLeft: 20, lineHeight: 1.7 } as const;

export default function AvvText({
  controller,
  acceptedAt,
}: {
  controller?: AvvParty | null;
  acceptedAt?: string | null;
}) {
  const platform = platformName();
  const base = getBaseUrl();
  const email = operatorEmail();
  const region = hostingRegion();
  const inEU = hostingInEU(region);
  const processors = dataProcessors();
  const version = legalDateLabel(LEGAL_TERMS_VERSION, 'de');
  const contactUrl = `${base}/contact`;
  const controllerName = controller?.name?.trim() || '';

  return (
    <div className="legal-doc" translate="no" lang="de">
      {/* Print: the site's global print rules already drop the header, footer
          and shadows; a contract additionally reads better without card
          chrome and with sections allowed to break across pages. */}
      <style>{`
        .legal-doc .legal-section h2 { scroll-margin-top: 90px; }
        .legal-doc p { line-height: 1.65; }
        @media print {
          .legal-doc { color: #111; font-size: 11pt; }
          .legal-doc .card { border: none; padding: 0; margin: 0 0 14pt; background: none; }
          .legal-doc .card-title { font-size: 12.5pt; }
          .legal-doc .table-wrap { overflow: visible; }
          .legal-doc a { color: #111; text-decoration: none; }
        }
      `}</style>

      <section className="card legal-section" id="parteien">
        <h2 className="card-title" style={{ fontSize: '1.25rem' }}>
          Vertrag über die Verarbeitung personenbezogener Daten im Auftrag
          <br />
          <span className="muted" style={{ fontSize: '0.95rem', fontWeight: 600 }}>
            (Auftragsverarbeitungsvertrag gemäß Art. 28 Abs. 3 DSGVO)
          </span>
        </h2>
        <p>zwischen</p>
        <p style={{ paddingLeft: 16, borderLeft: '3px solid var(--border)' }}>
          {controller && controllerName ? (
            <>
              <strong>{controllerName}</strong>
              {controller.addressLines.filter(Boolean).map((line, i) => (
                <span key={i}>
                  <br />
                  {line}
                </span>
              ))}
              {controller.representative?.trim() ? (
                <>
                  <br />
                  vertreten durch {controller.representative.trim()}
                </>
              ) : null}
            </>
          ) : (
            <>
              dem Veranstalter bzw. Verkäufer, der in seinem Veranstalterkonto auf {platform} als
              Anbieter hinterlegt ist und diesen Vertrag dort angenommen hat (Name, Anschrift und
              Vertretungsberechtigte gemäß den Angaben im Veranstalterkonto)
            </>
          )}
          <br />
          <span className="muted">– nachfolgend „Verantwortlicher“ –</span>
        </p>
        <p>und</p>
        <p style={{ paddingLeft: 16, borderLeft: '3px solid var(--border)' }}>
          <strong>{operatorName()}</strong>
          {operatorAddressLines().map((line, i) => (
            <span key={i}>
              <br />
              {line}
            </span>
          ))}
          <br />
          Betreiber der Plattform {platform}
          <br />
          <span className="muted">– nachfolgend „Auftragsverarbeiter“ –</span>
        </p>
        <p style={{ marginBottom: 0 }}>
          <strong>Präambel.</strong> Der Verantwortliche nutzt die vom Auftragsverarbeiter unentgeltlich
          betriebene Plattform {platform}, um Veranstaltungen und Waren anzubieten und Bestellungen seiner
          Kundinnen und Kunden entgegenzunehmen. Grundlage sind die{' '}
          <Link href="/terms">Nutzungsbedingungen für Veranstalter und Verkäufer</Link> (nachfolgend
          „Hauptvertrag“). Bei der Erbringung dieser Leistungen verarbeitet der Auftragsverarbeiter
          personenbezogene Daten, für die der Verantwortliche im Sinne von Art. 4 Nr. 7 DSGVO
          verantwortlich ist. Dieser Vertrag regelt die datenschutzrechtlichen Rechte und Pflichten der
          Parteien hierzu. Er gilt für alle Tätigkeiten, bei denen der Auftragsverarbeiter oder von ihm
          eingesetzte Unterauftragsverarbeiter personenbezogene Daten des Verantwortlichen verarbeiten.
        </p>
      </section>

      <Section id="p1" title="§ 1 Gegenstand und Dauer">
        <p>
          (1) Gegenstand des Auftrags ist die Bereitstellung und der Betrieb der Plattform-Software, mit
          der der Verantwortliche seine Angebote veröffentlicht und die Bestellungen, Buchungen und
          Reservierungen seiner Kundinnen und Kunden abwickelt. Art, Zweck und Umfang der Verarbeitung
          ergeben sich aus § 2.
        </p>
        <p style={{ marginBottom: 0 }}>
          (2) Der Vertrag beginnt mit seiner elektronischen Annahme durch den Verantwortlichen im
          Veranstalterbereich der Plattform und wird auf unbestimmte Zeit geschlossen. Er endet, ohne dass
          es einer gesonderten Kündigung bedarf, mit der Beendigung des Hauptvertrags. Pflichten, die
          ihrer Natur nach über das Vertragsende hinaus fortwirken – insbesondere zur Löschung (§ 9) und
          zur Vertraulichkeit (§ 5 Abs. 2) –, bleiben bis zu ihrer Erfüllung bestehen.
        </p>
      </Section>

      <Section id="p2" title="§ 2 Art und Zweck der Verarbeitung, Art der Daten, Kategorien betroffener Personen">
        <p>
          (1) <strong>Art der Verarbeitung:</strong> Erheben, Erfassen, Organisieren, Speichern, Auslesen,
          Abfragen, Verwenden, Abgleichen, Offenlegen durch Übermittlung (an den Verantwortlichen und an
          die betroffene Person selbst), Einschränken, Löschen und Anonymisieren (Art. 4 Nr. 2 DSGVO).
        </p>
        <p>(2) <strong>Zweck der Verarbeitung:</strong></p>
        <ol type="a" style={listStyle}>
          <li>
            Entgegennahme und Verwaltung von Bestellungen, Buchungen und Reservierungen für die Angebote
            des Verantwortlichen (Tickets, Sitz- und Tischplätze, Waren, Abholzeitfenster, wiederkehrende
            Bestellungen „Subscribe &amp; save“);
          </li>
          <li>
            Ausstellung und Versand von Tickets und Abholcodes (QR-Codes) sowie der bestellbezogenen
            E-Mails (Bestätigung, Zahlungshinweise, eine Zahlungserinnerung, Abholbereitschaft) und die
            Anzeige der eigenen Bestellungen gegenüber der betroffenen Person, auch in ihrem Kundenkonto
            nach Bestätigung ihrer E-Mail-Adresse;
          </li>
          <li>
            Anzeige der Zahlungsangaben des Verantwortlichen und Zuordnung eingehender Zahlungen
            (Zahlungsreferenz; bei Online-Zahlung Verarbeitung der Rückmeldung des vom Verantwortlichen
            selbst beauftragten Zahlungsdienstes);
          </li>
          <li>
            Einlass- und Abholkontrolle durch Scannen der Codes durch den Verantwortlichen oder das von
            ihm eingesetzte Einlasspersonal;
          </li>
          <li>
            Bereitstellung von Übersichten, Auswertungen und Exporten für den Verantwortlichen
            (Bestelllisten, Umsätze, Abrechnungen, Empfehlungsauswertungen);
          </li>
          <li>
            Durchführung der vom Verantwortlichen genutzten Zusatzfunktionen: Mitteilungsliste („Keep me
            posted“, nur nach bestätigter Einwilligung im Double-Opt-in-Verfahren), Kundenkarte,
            Empfehlungs- und Gutscheinprogramm, Weiterleitung von Besucherfragen zu seinen Angeboten an ihn
            und Veröffentlichung der von ihm beantworteten Fragen auf seiner Angebotsseite (ohne Name und
            E-Mail-Adresse der fragenden Person);
          </li>
          <li>fristgerechte Löschung bzw. Anonymisierung nach Abs. 5.</li>
        </ol>
        <p>(3) <strong>Art der personenbezogenen Daten:</strong></p>
        <ol type="a" style={listStyle}>
          <li>
            Kontaktdaten der Kundinnen und Kunden: Name, E-Mail-Adresse, optional Telefonnummer, Name der
            zahlenden Person (sofern abweichend), Bestellnotiz;
          </li>
          <li>
            Bestell- und Vertragsdaten: gebuchte Tickets, Artikel, Mengen und gewählte Optionen, Preise und
            Rabatte, Sitz-, Tisch- oder Abholzeitfenster, Bestellzeitpunkt, Bestell-, Zahlungs- und
            Abholstatus, Zahlungsreferenz, Ticket- und Abholcodes, Einlass- und Abholvermerke;
          </li>
          <li>
            zahlungsbezogene Daten: Zahlungsart, Zahlungseingang und bei Online-Zahlung die vom
            Zahlungsdienst des Verantwortlichen zurückgemeldeten Kennungen und Status. Karten-,
            Konto- oder Zugangsdaten der Kundinnen und Kunden werden nicht verarbeitet;
          </li>
          <li>
            Daten der Zusatzfunktionen: E-Mail-Adressen der Mitteilungsliste mit Zeitpunkt der Bestätigung
            und Abmeldevermerk; Kundenkarten (E-Mail-Adresse, Kartencode, Bestellungen beim
            Verantwortlichen, Gutscheine); Abonnements (Name, E-Mail-Adresse, Artikel, Rhythmus, Status);
            Empfehlungscodes, Zuordnung von Empfehlenden und Empfohlenen (Namen), Gutscheine und
            E-Mail-Adresse der empfehlenden Person;
          </li>
          <li>
            Besucherfragen zu Angeboten des Verantwortlichen: Fragetext, optional Name und E-Mail-Adresse
            der fragenden Person.
          </li>
        </ol>
        <p>(4) <strong>Kategorien betroffener Personen:</strong></p>
        <ol type="a" style={listStyle}>
          <li>Kundinnen und Kunden des Verantwortlichen (Käufer, Besteller, Ticketinhaber, Abonnenten);</li>
          <li>Interessenten (Personen auf der Mitteilungsliste, Personen, die Fragen stellen);</li>
          <li>Teilnehmende am Empfehlungsprogramm (Empfehlende und Empfohlene).</li>
        </ol>
        <p>
          (5) <strong>Löschfristen.</strong> Der Verantwortliche weist den Auftragsverarbeiter an, die
          folgenden Fristen automatisch einzuhalten; danach bleiben nur anonyme Zahlen und Beträge ohne
          Personenbezug für die Buchführung des Verantwortlichen erhalten:
        </p>
        <ol type="a" style={listStyle}>
          <li>
            Name, E-Mail-Adresse, Telefonnummer, Name der zahlenden Person und Bestellnotiz werden{' '}
            {BUYER_RETENTION_DAYS} Tage nach dem Datum der Veranstaltung gelöscht; bei Warenbestellungen{' '}
            {BUYER_RETENTION_DAYS} Tage nach der Abholung, spätestens {SHOP_UNCOLLECTED_LONG_STOP_DAYS}{' '}
            Tage nach der Zahlung; bei Angeboten ohne Datum {UNDATED_ORDER_RETENTION_DAYS} Tage nach der
            Bestellung;
          </li>
          <li>beendete oder gekündigte Abonnements {SUBSCRIPTION_ENDED_RETENTION_DAYS} Tage nach ihrem Ende;</li>
          <li>
            die E-Mail-Adresse einer empfehlenden Person zu einem Gutschein{' '}
            {REFERRAL_VOUCHER_RETENTION_DAYS} Tage nach dessen Einlösung oder Verfall;
          </li>
          <li>
            Einträge der Mitteilungsliste mit der Abmeldung; danach verbleibt lediglich ein Sperrvermerk,
            damit die Adresse nicht erneut ohne Einwilligung aufgenommen wird. Nicht bestätigte
            Eintragungswünsche werden nach {BUYER_RETENTION_DAYS} Tagen gelöscht;
          </li>
          <li>
            Name und E-Mail-Adresse fragender Personen nach denselben Fristen wie unter lit. a (bei
            Warenangeboten gerechnet ab dem Zeitpunkt der Frage); unbeantwortete Fragen werden dann
            vollständig gelöscht;
          </li>
          <li>Kundenkarten, sobald die betroffene Person sie schließt oder ihre Löschung verlangt.</li>
        </ol>
        <p style={{ marginBottom: 0 }}>
          Datensicherungen werden nach {BACKUP_RETENTION_DAYS} Tagen gelöscht; gelöschte Daten sind damit
          spätestens nach diesem Zeitraum auch aus den Sicherungen entfernt.
        </p>
      </Section>

      <Section id="p3" title="§ 3 Weisungsbefugnis des Verantwortlichen">
        <p>
          (1) Der Auftragsverarbeiter verarbeitet die personenbezogenen Daten ausschließlich auf
          dokumentierte Weisung des Verantwortlichen – auch in Bezug auf die Übermittlung in ein Drittland
          oder an eine internationale Organisation –, sofern er nicht durch das Recht der Union oder der
          Mitgliedstaaten, dem er unterliegt, hierzu verpflichtet ist. In einem solchen Fall teilt er dem
          Verantwortlichen diese rechtlichen Anforderungen vor der Verarbeitung mit, sofern das betreffende
          Recht eine solche Mitteilung nicht wegen eines wichtigen öffentlichen Interesses verbietet
          (Art. 28 Abs. 3 lit. a DSGVO).
        </p>
        <p>
          (2) Die Weisungen des Verantwortlichen ergeben sich abschließend aus diesem Vertrag und dem
          Hauptvertrag sowie aus den Einstellungen und Handlungen des Verantwortlichen im
          Veranstalterbereich der Plattform (etwa dem Anlegen und Veröffentlichen von Angeboten, dem
          Aktivieren von Funktionen, dem Bestätigen von Zahlungen, dem Versand von Mitteilungen, dem
          Export oder der Löschung von Daten). Darüber hinausgehende Einzelweisungen erteilt der
          Verantwortliche in Textform (z. B. per E-Mail); mündliche Weisungen bestätigt er unverzüglich in
          Textform.
        </p>
        <p>
          (3) Ist der Auftragsverarbeiter der Auffassung, dass eine Weisung gegen die DSGVO oder andere
          Datenschutzvorschriften der Union oder der Mitgliedstaaten verstößt, informiert er den
          Verantwortlichen unverzüglich (Art. 28 Abs. 3 UAbs. 2 DSGVO). Er ist berechtigt, die
          Durchführung der Weisung auszusetzen, bis sie vom Verantwortlichen bestätigt oder geändert wird.
        </p>
        <p style={{ marginBottom: 0 }}>
          (4) Weisungen, die eine Änderung des Funktionsumfangs der unentgeltlich bereitgestellten
          Plattform erfordern würden, ist der Auftragsverarbeiter nicht verpflichtet umzusetzen. Lehnt er
          eine solche Weisung ab, kann der Verantwortliche den Hauptvertrag und diesen Vertrag jederzeit
          beenden.
        </p>
      </Section>

      <Section id="p4" title="§ 4 Pflichten des Verantwortlichen">
        <p>
          (1) Der Verantwortliche ist für die Rechtmäßigkeit der Verarbeitung, insbesondere für das
          Vorliegen einer Rechtsgrundlage, und für die Wahrung der Rechte der betroffenen Personen
          verantwortlich. Er erfüllt die Informationspflichten nach Art. 13 und 14 DSGVO gegenüber seinen
          Kundinnen und Kunden; der Auftragsverarbeiter unterstützt ihn dabei, indem die Plattform die
          vom Verantwortlichen hinterlegte Anbieterkennzeichnung auf Angebotsseiten, im Bestellvorgang,
          auf Bestellseiten, Tickets und in E-Mails anzeigt und in ihrer Datenschutzerklärung die
          Verarbeitung im Auftrag beschreibt.
        </p>
        <p>
          (2) Der Verantwortliche hinterlegt im Veranstalterkonto zutreffende und vollständige Angaben
          zu seiner Identität (Name bzw. Bezeichnung, ladungsfähige Anschrift, Vertretungsberechtigte) und
          hält sie aktuell.
        </p>
        <p>
          (3) Der Verantwortliche hält seine Zugangsdaten geheim, nutzt die angebotene Zwei-Faktor-
          Authentisierung und gibt Scan-Links für die Einlasskontrolle nur an Personen weiter, die er
          damit beauftragt.
        </p>
        <p style={{ marginBottom: 0 }}>
          (4) Der Verantwortliche informiert den Auftragsverarbeiter unverzüglich, wenn er Fehler oder
          Unregelmäßigkeiten bei der Verarbeitung feststellt.
        </p>
      </Section>

      <Section id="p5" title="§ 5 Pflichten des Auftragsverarbeiters">
        <p>
          (1) Der Auftragsverarbeiter verarbeitet die Daten nur im Rahmen dieses Vertrags und der
          Weisungen des Verantwortlichen und nicht für eigene Zwecke. Ausgenommen sind anonyme bzw.
          zusammengefasste Auswertungen ohne Personenbezug (z. B. Anzahl der Bestellungen) für den Betrieb
          und die Verbesserung der Plattform. Nutzen betroffene Personen Funktionen, für die der
          Auftragsverarbeiter selbst Verantwortlicher ist (etwa das Kundenkonto, Bewertungen, die
          Warteliste bei ausverkauften Angeboten, Kontaktanfragen an die Plattform), verarbeitet er die
          dafür erforderlichen Daten – einschließlich der Feststellung, dass eine Bestellung besteht, und
          des Vornamens mit Initial für eine veröffentlichte Bewertung – in eigener Verantwortung nach
          seiner <Link href="/privacy?v=de">Datenschutzerklärung</Link>.
        </p>
        <p>
          (2) Der Auftragsverarbeiter gewährleistet, dass sich die zur Verarbeitung befugten Personen
          zur Vertraulichkeit verpflichtet haben oder einer angemessenen gesetzlichen
          Verschwiegenheitspflicht unterliegen (Art. 28 Abs. 3 lit. b, Art. 29, Art. 32 Abs. 4 DSGVO).
          Derzeit verarbeitet der Auftragsverarbeiter die Daten persönlich; setzt er weitere Personen
          ein, verpflichtet er sie vor Aufnahme der Tätigkeit schriftlich oder in Textform zur
          Vertraulichkeit. Zugriff auf personenbezogene Daten des Verantwortlichen nimmt er nur, soweit
          dies für den Betrieb, die Fehlerbehebung, die Sicherheit der Plattform oder die Unterstützung
          des Verantwortlichen erforderlich ist.
        </p>
        <p>
          (3) Der Auftragsverarbeiter trifft die technischen und organisatorischen Maßnahmen nach
          Art. 32 DSGVO, die in <a href="#anlage-2">Anlage 2</a> beschrieben sind. Er darf sie dem
          technischen Fortschritt anpassen, sofern das Schutzniveau nicht unterschritten wird;
          wesentliche Änderungen dokumentiert er.
        </p>
        <p>
          (4) Ein Datenschutzbeauftragter ist beim Auftragsverarbeiter nicht bestellt, da hierzu keine
          Pflicht besteht. Ansprechpartner für den Datenschutz ist der Auftragsverarbeiter selbst{' '}
          {email ? <>(E-Mail: {email}; alternativ über {contactUrl})</> : <>(über {contactUrl})</>}.
        </p>
        <p style={{ marginBottom: 0 }}>
          (5) Der Auftragsverarbeiter informiert den Verantwortlichen unverzüglich über Kontrollhandlungen
          und Maßnahmen einer Aufsichtsbehörde, soweit sie sich auf die Verarbeitung nach diesem Vertrag
          beziehen.
        </p>
      </Section>

      <Section id="p6" title="§ 6 Unterauftragsverarbeiter">
        <p>
          (1) Der Verantwortliche erteilt dem Auftragsverarbeiter die allgemeine Genehmigung, weitere
          Auftragsverarbeiter (Unterauftragsverarbeiter) einzusetzen (Art. 28 Abs. 2 Satz 1 DSGVO). Die
          bei Vertragsschluss eingesetzten Unterauftragsverarbeiter sind in{' '}
          <a href="#anlage-1">Anlage 1</a> aufgeführt und gelten als genehmigt.
        </p>
        <p>
          (2) Der Auftragsverarbeiter informiert den Verantwortlichen über jede beabsichtigte Hinzuziehung
          oder Ersetzung eines Unterauftragsverarbeiters mindestens {SUBPROCESSOR_NOTICE_DAYS} Tage vorher
          per E-Mail oder durch einen Hinweis im Veranstalterbereich (Art. 28 Abs. 2 Satz 2 DSGVO). Der
          Verantwortliche kann der Änderung innerhalb dieser Frist aus wichtigem datenschutzrechtlichem
          Grund widersprechen. Finden die Parteien keine einvernehmliche Lösung, kann jede Partei den
          Hauptvertrag und diesen Vertrag mit Wirkung zum Zeitpunkt der Änderung beenden.
        </p>
        <p>
          (3) Der Auftragsverarbeiter erlegt jedem Unterauftragsverarbeiter vertraglich im Wesentlichen
          dieselben Datenschutzpflichten auf, die in diesem Vertrag festgelegt sind, insbesondere
          hinreichende Garantien für geeignete technische und organisatorische Maßnahmen (Art. 28 Abs. 4
          Satz 1 DSGVO); bei den in Anlage 1 genannten Anbietern geschieht dies durch deren
          Auftragsverarbeitungsbedingungen. Kommt ein Unterauftragsverarbeiter seinen
          Datenschutzpflichten nicht nach, haftet der Auftragsverarbeiter gegenüber dem Verantwortlichen
          nach Maßgabe von Art. 28 Abs. 4 Satz 2 DSGVO.
        </p>
        <p>
          (4) Keine Unterauftragsverarbeiter im Sinne dieses Vertrags sind Dienstleister, mit denen der
          Verantwortliche selbst einen Vertrag unterhält – insbesondere sein Kreditinstitut und die von
          ihm mit eigenem Konto angebundenen Zahlungsdienste (PayPal, Stripe). Diese handeln gegenüber dem
          Verantwortlichen bzw. den Kundinnen und Kunden in eigener Verantwortung.
        </p>
        <p style={{ marginBottom: 0 }}>
          (5) Eine Verarbeitung außerhalb der Europäischen Union bzw. des Europäischen Wirtschaftsraums
          erfolgt nur, soweit die Voraussetzungen der Art. 44 ff. DSGVO erfüllt sind. {TRANSFER_BASIS_DE}
        </p>
      </Section>

      <Section id="p7" title="§ 7 Unterstützung des Verantwortlichen">
        <p>
          (1) Der Auftragsverarbeiter unterstützt den Verantwortlichen angesichts der Art der
          Verarbeitung nach Möglichkeit mit geeigneten technischen und organisatorischen Maßnahmen bei der
          Erfüllung der Rechte der betroffenen Personen nach Kapitel III DSGVO (Art. 28 Abs. 3 lit. e
          DSGVO) – in erster Linie durch die Funktionen des Veranstalterbereichs (Einsicht in Bestellungen,
          Export als CSV-Datei) und, wo diese nicht ausreichen, auf Anforderung in Textform (etwa zur
          Berichtigung, Löschung oder Einschränkung einzelner Datensätze).
        </p>
        <p>
          (2) Wendet sich eine betroffene Person mit einem Anliegen zu Daten des Verantwortlichen
          unmittelbar an den Auftragsverarbeiter, leitet dieser das Anliegen unverzüglich an den
          Verantwortlichen weiter. Automatisch vorgesehene Funktionen, die die betroffene Person selbst
          auslöst (z. B. Abmeldung von der Mitteilungsliste, Schließen der Kundenkarte), gelten als vom
          Verantwortlichen angewiesen.
        </p>
        <p style={{ marginBottom: 0 }}>
          (3) Der Auftragsverarbeiter unterstützt den Verantwortlichen unter Berücksichtigung der Art der
          Verarbeitung und der ihm zur Verfügung stehenden Informationen bei der Einhaltung der Pflichten
          aus Art. 32 bis 36 DSGVO (Sicherheit der Verarbeitung, Meldung und Benachrichtigung bei
          Datenschutzverletzungen, Datenschutz-Folgenabschätzung, vorherige Konsultation).
        </p>
      </Section>

      <Section id="p8" title="§ 8 Meldung von Verletzungen des Schutzes personenbezogener Daten">
        <p>
          (1) Der Auftragsverarbeiter meldet dem Verantwortlichen eine Verletzung des Schutzes
          personenbezogener Daten, die Daten des Verantwortlichen betrifft, unverzüglich nach
          Bekanntwerden, möglichst innerhalb von 48 Stunden, per E-Mail an die im Veranstalterkonto
          hinterlegte Adresse (Art. 33 Abs. 2 DSGVO).
        </p>
        <p>
          (2) Die Meldung enthält, soweit bekannt, die Angaben nach Art. 33 Abs. 3 DSGVO (Art der
          Verletzung, Kategorien und ungefähre Zahl der betroffenen Personen und Datensätze,
          wahrscheinliche Folgen, ergriffene oder vorgeschlagene Maßnahmen). Informationen, die noch nicht
          vorliegen, werden unverzüglich nachgereicht.
        </p>
        <p style={{ marginBottom: 0 }}>
          (3) Der Auftragsverarbeiter trifft unverzüglich die erforderlichen Maßnahmen zur Sicherung der
          Daten und zur Minderung möglicher nachteiliger Folgen und stimmt sich hierzu mit dem
          Verantwortlichen ab. Meldungen an Aufsichtsbehörden und Benachrichtigungen betroffener Personen
          nach Art. 33 und 34 DSGVO obliegen dem Verantwortlichen.
        </p>
      </Section>

      <Section id="p9" title="§ 9 Löschung und Rückgabe nach Beendigung">
        <p>
          (1) Der Verantwortliche kann Bestellungen und Abrechnungen jederzeit im Veranstalterbereich als
          CSV-Datei exportieren; dies gilt insbesondere vor Beendigung des Vertrags. Mit dieser
          Exportmöglichkeit ist die Pflicht zur Rückgabe der Daten erfüllt.
        </p>
        <p>
          (2) Nach Beendigung des Hauptvertrags löscht der Auftragsverarbeiter alle im Auftrag
          verarbeiteten personenbezogenen Daten innerhalb von {TERMINATION_DELETION_DAYS} Tagen, sofern
          nicht nach dem Unionsrecht oder dem Recht der Mitgliedstaaten eine Verpflichtung zur Speicherung
          besteht (Art. 28 Abs. 3 lit. g DSGVO). In Datensicherungen enthaltene Kopien werden mit deren
          turnusmäßiger Löschung nach spätestens {BACKUP_RETENTION_DAYS} Tagen entfernt; bis dahin werden
          sie nicht mehr verwendet, außer zur Wiederherstellung nach einem Störfall.
        </p>
        <p style={{ marginBottom: 0 }}>
          (3) Auf Verlangen bestätigt der Auftragsverarbeiter die Löschung in Textform.
        </p>
      </Section>

      <Section id="p10" title="§ 10 Nachweise und Kontrollen">
        <p>
          (1) Der Auftragsverarbeiter stellt dem Verantwortlichen alle erforderlichen Informationen zum
          Nachweis der Einhaltung der in Art. 28 DSGVO niedergelegten Pflichten zur Verfügung (Art. 28
          Abs. 3 lit. h DSGVO) – in erster Linie durch diesen Vertrag mit seinen Anlagen und auf Anfrage
          durch Auskünfte in Textform.
        </p>
        <p>
          (2) Der Verantwortliche ist berechtigt, Überprüfungen einschließlich Inspektionen selbst oder
          durch einen von ihm beauftragten, zur Verschwiegenheit verpflichteten Prüfer durchzuführen. Sie
          sind mit angemessener Frist, in der Regel 14 Tage, anzukündigen und so durchzuführen, dass der
          Betrieb der Plattform nicht unverhältnismäßig gestört wird. Da der Auftragsverarbeiter keine
          eigenen Serverräume betreibt, erfolgt der Nachweis für die Rechenzentren durch geeignete
          Nachweise der Unterauftragsverarbeiter (z. B. Zertifikate oder Prüfberichte, soweit verfügbar).
        </p>
        <p style={{ marginBottom: 0 }}>(3) Jede Partei trägt die ihr durch Kontrollen entstehenden Kosten selbst.</p>
      </Section>

      <Section id="p11" title="§ 11 Haftung">
        <p>
          (1) Für den Ersatz von Schäden, die eine betroffene Person wegen einer unzulässigen oder
          unrichtigen Datenverarbeitung erleidet, gilt Art. 82 DSGVO.
        </p>
        <p style={{ marginBottom: 0 }}>
          (2) Im Verhältnis der Parteien zueinander haftet jede Partei nach Maßgabe ihres Anteils an der
          Verantwortung für den Schaden (Art. 82 Abs. 2, 4 und 5 DSGVO). Im Übrigen gelten die
          Haftungsregelungen des Hauptvertrags, soweit zwingendes Recht nicht entgegensteht.
        </p>
      </Section>

      <Section id="p12" title="§ 12 Schlussbestimmungen">
        <p>
          (1) Dieser Vertrag wird in einem elektronischen Format geschlossen (Art. 28 Abs. 9 DSGVO): Der
          Verantwortliche nimmt die veröffentlichte Fassung im Veranstalterbereich an; die angenommene
          Fassung und der Zeitpunkt der Annahme werden gespeichert. Der Vertrag kann jederzeit unter{' '}
          {base}/avv abgerufen und ausgedruckt werden.
        </p>
        <p>
          (2) Änderungen dieses Vertrags werden dem Verantwortlichen im Veranstalterbereich angezeigt und
          bedürfen seiner erneuten Annahme. Bis dahin gilt die zuletzt angenommene Fassung fort.
        </p>
        <p>
          (3) Bei Widersprüchen zwischen diesem Vertrag und dem Hauptvertrag gehen die Regelungen dieses
          Vertrags in Bezug auf den Datenschutz vor.
        </p>
        <p>
          (4) Sollte eine Bestimmung dieses Vertrags unwirksam sein oder werden, bleibt die Wirksamkeit
          der übrigen Bestimmungen unberührt. An die Stelle der unwirksamen Bestimmung tritt die
          gesetzliche Regelung.
        </p>
        <p style={{ marginBottom: 0 }}>(5) Es gilt das Recht der Bundesrepublik Deutschland.</p>
      </Section>

      <section className="card legal-section" id="abschluss">
        <h2 className="card-title">Vertragsschluss</h2>
        <p style={{ marginBottom: acceptedAt ? 8 : 0 }}>
          Fassung vom {version} (Version {LEGAL_TERMS_VERSION}).{' '}
          {acceptedAt ? null : (
            <>
              Der Vertrag kommt durch die elektronische Annahme dieser Fassung im Veranstalterbereich
              zustande.
            </>
          )}
        </p>
        {acceptedAt ? (
          <p style={{ marginBottom: 0 }}>
            <strong>Elektronisch angenommen</strong>
            {controllerName ? <> von {controllerName}</> : null} am {legalDateLabel(acceptedAt, 'de', true)}.
          </p>
        ) : null}
      </section>

      <section className="card legal-section" id="anlage-1">
        <h2 className="card-title">Anlage 1 – Unterauftragsverarbeiter</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Unternehmen</th>
                <th>Leistung</th>
                <th>Ort der Verarbeitung</th>
              </tr>
            </thead>
            <tbody>
              {processors.map((p) => (
                <tr key={p.key}>
                  <td>
                    <strong>{p.name}</strong>
                    <br />
                    <span className="small muted">{p.addressDe}</span>
                  </td>
                  <td className="small">{p.purposeDe}</td>
                  <td className="small">{p.locationDe}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="small" style={{ marginTop: 12 }}>
          <strong>Drittlandübermittlung:</strong> {TRANSFER_BASIS_DE}
        </p>
        <p className="small">
          <strong>Hosting:</strong> Die Server der Plattform befinden sich in {region}.{' '}
          {inEU
            ? 'Render Services, Inc. ist ein Unternehmen mit Sitz in den USA; ein Zugriff aus den USA (etwa im Rahmen von Support oder Wartung) kann daher nicht ausgeschlossen werden.'
            : 'Die Daten werden damit außerhalb der EU verarbeitet.'}
        </p>
        <p className="small" style={{ marginBottom: 0 }}>
          <strong>KI-Dienste:</strong> Inhalte, die personenbezogene Daten enthalten können (z. B. Eingaben
          in die Assistenzfunktionen), werden nur dann an Google übermittelt, wenn der Auftragsverarbeiter die
          kostenpflichtige Nutzung der Gemini API eingerichtet hat. Nach den Bedingungen von Google für
          diese Nutzung werden die Inhalte nicht zur Verbesserung der Produkte von Google verwendet und
          nach dem Data Processing Addendum von Google verarbeitet; andernfalls werden solche Inhalte
          nicht an Google, sondern gegebenenfalls an Anthropic übermittelt oder ohne KI bearbeitet.
          Anthropic verwendet über die API übermittelte Inhalte nach seinen kommerziellen Bedingungen
          nicht zum Training seiner Modelle. Fragen, die Besucher über das Frageformular an den
          Verantwortlichen richten, werden nicht an KI-Dienste übermittelt; veröffentlichte Fragen und
          Antworten können – ohne Name und E-Mail-Adresse – dem KI-Helfer der Angebotsseite als Kontext
          dienen.
        </p>
      </section>

      <section className="card legal-section" id="anlage-2">
        <h2 className="card-title">Anlage 2 – Technische und organisatorische Maßnahmen (Art. 32 DSGVO)</h2>

        <h3 style={{ fontSize: '1rem', margin: '4px 0 6px' }}>1. Vertraulichkeit (Art. 32 Abs. 1 lit. b DSGVO)</h3>
        <ul style={listStyle}>
          <li>
            <strong>Zutrittskontrolle:</strong> Der Auftragsverarbeiter betreibt keine eigenen Server. Die
            Plattform läuft bei Render Services, Inc. in Rechenzentren in {region}; die physische
            Sicherung obliegt dem Hosting-Anbieter und dessen Rechenzentrumsbetreibern.
          </li>
          <li>
            <strong>Zugangskontrolle:</strong> Passwörter werden ausschließlich als gesalzene
            scrypt-Hashwerte gespeichert, nie im Klartext; Veranstalterpasswörter müssen mindestens 12
            Zeichen lang sein. Zwei-Faktor-Authentisierung per Authenticator-App (TOTP) für Veranstalter,
            in der Standardeinstellung vor der Veröffentlichung eines Angebots verpflichtend; die
            TOTP-Geheimnisse werden verschlüsselt gespeichert. Anmeldung
            des Betreibers nur mit Passwort und zusätzlichem Einmalcode. Begrenzung fehlgeschlagener
            Anmeldeversuche; Benachrichtigung per E-Mail bei neuer Anmeldung in einem Veranstalterkonto;
            erneute Bestätigung vor der Änderung von Auszahlungsdaten. Sitzungen über signierte Cookies
            mit den Attributen HttpOnly und Secure und begrenzter Laufzeit; eine Passwortänderung beendet
            alle bestehenden Sitzungen.
          </li>
          <li>
            <strong>Zugriffskontrolle:</strong> Mandantentrennung – jeder Veranstalter sieht
            ausschließlich seine eigenen Angebote, Bestellungen und Kundinnen und Kunden; jede Abfrage im
            Veranstalterbereich ist an das angemeldete Konto gebunden. Einlass-Scanner erhalten über
            signierte, zeitlich befristete Links nur die Möglichkeit, Codes zu prüfen. Bestellseiten sind
            nur über einen kryptografisch signierten Link erreichbar. Zugriff des Betreibers auf Daten
            einzelner Kundinnen und Kunden nur, soweit für Betrieb, Fehlerbehebung oder Unterstützung
            erforderlich.
          </li>
          <li>
            <strong>Verschlüsselung:</strong> Übertragung ausschließlich per HTTPS (TLS) mit HTTP Strict
            Transport Security (HSTS). Zugangsdaten, die Veranstalter für ihre eigenen Zahlungsdienste
            hinterlegen (PayPal-Client-Secret, Stripe-Schlüssel), werden mit AES-256-GCM verschlüsselt
            gespeichert.
          </li>
          <li>
            <strong>Pseudonymisierung und Datenminimierung:</strong> QR-Codes auf Tickets und Kundenkarten
            enthalten nur zufällige Codes, keine Namen oder E-Mail-Adressen. Für die Begrenzung von
            KI-Anfragen wird nur ein täglich neu gesalzener Hashwert der IP-Adresse gespeichert und nach
            etwa zwei Tagen gelöscht; die Begrenzung von Anfragen je IP-Adresse erfolgt im Arbeitsspeicher.
            Aus hochgeladenen Fotos werden Standort- und Kameradaten (Metadaten) automatisch entfernt.
          </li>
        </ul>

        <h3 style={{ fontSize: '1rem', margin: '14px 0 6px' }}>2. Integrität (Art. 32 Abs. 1 lit. b DSGVO)</h3>
        <ul style={listStyle}>
          <li>
            <strong>Weitergabekontrolle:</strong> Transportverschlüsselung (siehe oben); Daten verlassen die
            Plattform nur an die in Anlage 1 genannten Unterauftragsverarbeiter, an die betroffene Person
            selbst und an den Verantwortlichen (Anzeige und CSV-Export).
          </li>
          <li>
            <strong>Schutz der Anwendung:</strong> Sicherheits-Header (Content-Security-Policy,
            X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy); serverseitige
            Prüfung aller Eingaben; Prüfung hochgeladener Bilder anhand ihres tatsächlichen Dateiformats;
            signierte Links und Sitzungen (HMAC).
          </li>
          <li>
            <strong>Eingabekontrolle:</strong> Bestell-, Zahlungs-, Einlass- und Abholvorgänge werden mit
            Zeitstempel gespeichert; Änderungen der Auszahlungsdaten werden dem Veranstalter per E-Mail
            gemeldet.
          </li>
        </ul>

        <h3 style={{ fontSize: '1rem', margin: '14px 0 6px' }}>
          3. Verfügbarkeit und Belastbarkeit (Art. 32 Abs. 1 lit. b und c DSGVO)
        </h3>
        <ul style={listStyle}>
          <li>
            Konsistente Datensicherungen der Datenbank (SQLite „VACUUM INTO“) mit anschließender
            Integritätsprüfung; Sicherungen werden nach {BACKUP_RETENTION_DAYS} Tagen gelöscht
            (rollierende Aufbewahrung). Wiederherstellung durch Einspielen einer Sicherung.
          </li>
          <li>Speicherung der Datenbank auf einem persistenten Speichermedium beim Hosting-Anbieter.</li>
          <li>
            Begrenzung von Anfragen je Zeiteinheit und Tageskontingente für KI-Funktionen zum Schutz vor
            Missbrauch und Überlastung; Schutz vor Überlastungsangriffen durch das Netzwerk des
            Hosting-Anbieters.
          </li>
        </ul>

        <h3 style={{ fontSize: '1rem', margin: '14px 0 6px' }}>
          4. Verfahren zur regelmäßigen Überprüfung (Art. 32 Abs. 1 lit. d, Art. 25 DSGVO)
        </h3>
        <ul style={listStyle}>
          <li>
            Automatisierte Tests der Anwendung, unter anderem für Zugriffsbeschränkungen, Löschroutinen
            und den Ausschluss privater Seiten von der Reichweitenmessung.
          </li>
          <li>
            Datenschutzfreundliche Voreinstellungen: automatische Löschung nach den Fristen in § 2 Abs. 5;
            keine vorausgewählten Einwilligungen; Reichweitenmessung nur nach Einwilligung und nie auf
            Bestell-, Ticket-, Kundenkarten-, Scanner-, Veranstalter- oder Administrationsseiten.
          </li>
          <li>
            Überprüfung dieser Maßnahmen bei wesentlichen Änderungen der Plattform; Auswahl von
            Unterauftragsverarbeitern unter Berücksichtigung ihrer Datenschutz- und Sicherheitszusagen
            (Auftragskontrolle).
          </li>
        </ul>
      </section>
    </div>
  );
}
