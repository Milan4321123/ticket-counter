/**
 * Die Datenschutzerklärung — German, the binding version.
 *
 * Every number and every provider comes from `facts` (components/legal/
 * privacyFacts.ts), which reads the constants the code itself runs on; the
 * English twin (PrivacyEn.tsx) renders the same facts. Change a section here,
 * change it there.
 *
 * Plain language where the law allows it: the legal basis, the recipients and
 * the storage period are named per processing, as Art. 13 GDPR asks, but the
 * explanation around them is written for the person booking a momo pre-order,
 * not for their lawyer.
 */
import Link from 'next/link';
import ConsentControl from '@/components/ConsentControl';
import { TRANSFER_BASIS_DE, geminiMayProcessPersonalData } from '@/lib/legal';
import { LegalSection as Sec, LegalSub as Sub, legalListStyle as ul } from './LegalSection';
import type { PrivacyFacts } from './privacyFacts';

const linkStyle = { color: 'var(--brand-text)', fontWeight: 600 } as const;

export const PRIVACY_TOC_DE: { id: string; title: string }[] = [
  { id: 'verantwortlicher', title: '1. Verantwortlicher und Kontakt' },
  { id: 'rollen', title: '2. Wer ist wofür verantwortlich?' },
  { id: 'hosting', title: '3. Aufruf der Website, Hosting und Sicherheit' },
  { id: 'cookies', title: '4. Cookies und Speicherung auf Ihrem Gerät' },
  { id: 'bestellung', title: '5. Tickets und Bestellungen' },
  { id: 'zahlung', title: '6. Bezahlung' },
  { id: 'kundenkonto', title: '7. Kundenkonto' },
  { id: 'mitteilungen', title: '8. „Keep me posted“ – Mitteilungen eines Anbieters' },
  { id: 'kundenkarte', title: '9. Kundenkarte' },
  { id: 'abonnements', title: '10. Subscribe & save (wiederkehrende Bestellungen)' },
  { id: 'empfehlungen', title: '11. Empfehlungen und Gutscheine' },
  { id: 'bewertungen', title: '12. Bewertungen' },
  { id: 'warteliste', title: '13. Warteliste bei ausverkauften Angeboten' },
  { id: 'fragen', title: '14. Fragen an Anbieter, KI-Helfer, Suchleiste und Hilfe-Bot' },
  { id: 'mikrofon', title: '15. Spracheingabe (Mikrofon)' },
  { id: 'kontakt', title: '16. Kontaktformular und Kontakt-Chat' },
  { id: 'uebersetzung', title: '17. Automatische Übersetzung' },
  { id: 'ki', title: '18. Grundsätze für KI-Dienste' },
  { id: 'analytics', title: '19. Reichweitenmessung (Google Analytics)' },
  { id: 'app', title: '20. Installierbare App und Offline-Tickets' },
  { id: 'fotos', title: '21. Fotos und Videos der Anbieter' },
  { id: 'anbieter', title: '22. Informationen für Veranstalter und Verkäufer' },
  { id: 'empfaenger', title: '23. Empfänger und Drittlandübermittlung' },
  { id: 'speicherdauer', title: '24. Speicherdauer im Überblick' },
  { id: 'pflicht', title: '25. Pflicht zur Bereitstellung, keine automatisierte Entscheidung' },
  { id: 'rechte', title: '26. Ihre Rechte' },
  { id: 'widerspruch', title: '27. Widerspruchsrecht' },
  { id: 'beschwerde', title: '28. Beschwerderecht' },
  { id: 'aenderungen', title: '29. Änderungen dieser Datenschutzerklärung' },
];

function ContactLine({ f }: { f: PrivacyFacts }) {
  return (
    <>
      {f.operator.email ? (
        <>
          per E-Mail an{' '}
          <a href={`mailto:${f.operator.email}`} style={linkStyle}>
            {f.operator.email}
          </a>{' '}
          oder über das{' '}
        </>
      ) : (
        <>über das </>
      )}
      <Link href="/contact" style={linkStyle}>
        Kontaktformular
      </Link>
    </>
  );
}

export default function PrivacyDe({ f }: { f: PrivacyFacts }) {
  const d = f.days;
  const s = f.sessions;
  const gaEnabled = Boolean(process.env.NEXT_PUBLIC_GA_ID);
  const toc = gaEnabled ? PRIVACY_TOC_DE : PRIVACY_TOC_DE.filter((t) => t.id !== 'analytics');

  return (
    <>
      <div className="card anim-fade-up" id="kurz">
        <h2 className="card-title">Das Wichtigste in Kürze</h2>
        <ul style={{ ...ul, marginBottom: 0 }}>
          <li>
            Wenn Sie ein Ticket buchen oder etwas bestellen, schließen Sie den Vertrag mit dem jeweiligen{' '}
            <strong>Veranstalter bzw. Verkäufer</strong> (im Folgenden „Anbieter“) – nicht mit uns. Der
            Anbieter ist für Ihre Bestelldaten verantwortlich; wir verarbeiten sie in seinem Auftrag. Wer
            der Anbieter ist, steht auf jeder Angebotsseite, im Bestellvorgang, auf Ihrer Bestellseite, dem
            Ticket und in jeder E-Mail.
          </li>
          <li>
            Ihr Geld geht direkt an den Anbieter – per Überweisung oder über dessen eigenes PayPal- bzw.
            Stripe-Konto. Über uns läuft keine Zahlung, und auf dieser Website werden keine Karten- oder
            Bankdaten eingegeben.
          </li>
          <li>
            Name, E-Mail-Adresse und die übrigen Kontaktangaben einer Bestellung werden automatisch{' '}
            <strong>{d.buyer} Tage nach der Veranstaltung</strong> gelöscht (Einzelheiten in Abschnitt 5).
          </li>
          <li>
            Reichweitenmessung findet nur statt, wenn Sie ausdrücklich zustimmen. Keine Werbung, kein
            Verkauf von Daten, keine Profile über mehrere Anbieter hinweg.
          </li>
        </ul>
      </div>

      <nav className="card" aria-label="Inhalt">
        <h2 className="card-title">Inhalt</h2>
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

      <Sec id="verantwortlicher" title="1. Verantwortlicher und Kontakt">
        <p>Verantwortlicher im Sinne der Datenschutz-Grundverordnung (DSGVO) für diese Website ist:</p>
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
              E-Mail:{' '}
              <a href={`mailto:${f.operator.email}`} style={linkStyle}>
                {f.operator.email}
              </a>
            </>
          ) : null}
          {f.operator.phone ? (
            <>
              <br />
              Telefon: {f.operator.phone}
            </>
          ) : null}
          <br />
          Kontaktformular:{' '}
          <Link href="/contact" style={linkStyle}>
            {f.base.replace(/^https?:\/\//, '')}/contact
          </Link>
        </p>
        <p>
          {f.platform} ist eine unentgeltliche Plattform, die von einer Privatperson betrieben wird
          (siehe <Link href="/impressum" style={linkStyle}>Impressum</Link>). Wenn im Folgenden von „wir“
          oder „uns“ die Rede ist, ist dieser Betreiber gemeint.
        </p>
        <p style={{ marginBottom: 0 }}>
          Ein Datenschutzbeauftragter ist nicht bestellt, da hierzu keine Pflicht besteht. Für alle Fragen
          zum Datenschutz erreichen Sie uns direkt <ContactLine f={f} />.
        </p>
      </Sec>

      <Sec id="rollen" title="2. Wer ist wofür verantwortlich?">
        <p>Auf {f.platform} gibt es zwei Rollen, je nachdem, was Sie tun:</p>
        <ul style={ul}>
          <li>
            <strong>Wir sind Verantwortlicher</strong> für den Betrieb der Website selbst und für die
            Funktionen der Plattform: Aufruf der Seiten, Sicherheit, Cookies und Einwilligungen, das
            Kundenkonto, Bewertungen, die Warteliste, den KI-Helfer, die Suchleiste und den Hilfe-Bot, das
            Kontaktformular und die Daten der Veranstalter und Verkäufer selbst.
          </li>
          <li>
            <strong>Der Anbieter ist Verantwortlicher</strong> für alles, was zu Ihrem Kauf bei ihm gehört:
            Bestellungen und Buchungen, Tickets, Zahlungszuordnung, Einlass und Abholung, wiederkehrende
            Bestellungen, seine Mitteilungsliste („Keep me posted“), seine Kundenkarte, sein
            Empfehlungsprogramm und Fragen, die Sie ihm über das Frageformular stellen. Wir verarbeiten diese Daten als <strong>Auftragsverarbeiter</strong> nach
            Art. 28 DSGVO auf Grundlage eines{' '}
            <Link href="/avv" style={linkStyle}>
              Auftragsverarbeitungsvertrags
            </Link>{' '}
            und nur nach seinen Weisungen. Name, Anschrift und Vertretungsberechtigte des Anbieters finden Sie
            auf jeder Angebotsseite, im Bestellvorgang, auf Ihrer Bestellseite, auf dem Ticket und in jeder
            E-Mail zu Ihrer Bestellung.
          </li>
        </ul>
        <p style={{ marginBottom: 0 }}>
          Anliegen zu Daten, für die ein Anbieter verantwortlich ist, können Sie an den Anbieter oder an uns
          richten – wir leiten sie unverzüglich an den Anbieter weiter und unterstützen ihn bei der
          Beantwortung. In den folgenden Abschnitten erklären wir auch diese Verarbeitungen, damit Sie an
          einer Stelle sehen, was mit Ihren Daten geschieht.
        </p>
      </Sec>

      <Sec id="hosting" title="3. Aufruf der Website, Hosting und Sicherheit">
        <p>
          Wenn Sie eine Seite aufrufen, verarbeitet der Server technisch notwendig Ihre IP-Adresse, Datum
          und Uhrzeit, die aufgerufene Adresse (URL) und die Kennung Ihres Browsers (User-Agent). Diese
          Angaben erscheinen in den Server-Protokollen.
        </p>
        <Sub>Zweck und Rechtsgrundlage</Sub>
        <p>
          Auslieferung der Website, Stabilität, Fehlersuche und Abwehr von Angriffen. Rechtsgrundlage ist
          Art. 6 Abs. 1 lit. f DSGVO; unser berechtigtes Interesse liegt in einem sicheren und
          funktionsfähigen Betrieb der Plattform.
        </p>
        <Sub>Hosting</Sub>
        <p>
          Die Plattform wird bei <strong>Render Services, Inc.</strong> (San Francisco, USA) betrieben; die
          Server befinden sich in <strong>{f.region}</strong>.{' '}
          {f.inEU
            ? 'Ihre Daten werden also in der EU gespeichert. Da Render ein US-Unternehmen ist, kann ein Zugriff aus den USA im Einzelfall (etwa für Support oder Wartung) nicht ausgeschlossen werden.'
            : 'Ihre Daten werden damit außerhalb der EU verarbeitet.'}{' '}
          Render setzt für die Auslieferung und den Schutz vor Überlastungsangriffen das Netzwerk der{' '}
          <strong>Cloudflare, Inc.</strong> (San Francisco, USA) ein. Beide handeln als Auftragsverarbeiter.{' '}
          {TRANSFER_BASIS_DE}
        </p>
        <Sub>Missbrauchsschutz</Sub>
        <p>
          Um Formulare und Anmeldungen vor massenhaften Anfragen zu schützen, zählen wir Anfragen je
          IP-Adresse – nur im Arbeitsspeicher des Servers, nicht in der Datenbank; die Zähler verfallen nach
          kurzer Zeit bzw. mit jedem Neustart. Für die Tageskontingente der KI-Funktionen speichern wir
          ausschließlich einen täglich neu gesalzenen Hashwert der IP-Adresse (die Adresse selbst ist daraus
          nicht ablesbar); diese Einträge werden nach etwa zwei Tagen gelöscht.
        </p>
        <Sub>Speicherdauer</Sub>
        <p style={{ marginBottom: 0 }}>
          Die Server-Protokolle werden vom Hosting-Anbieter nur für einen begrenzten Zeitraum vorgehalten und
          danach automatisch gelöscht. Wir werten sie nur anlassbezogen aus, etwa bei Störungen oder
          Angriffen.
        </p>
      </Sec>

      <Sec id="cookies" title="4. Cookies und Speicherung auf Ihrem Gerät">
        <p>
          Wir speichern nur dann etwas auf Ihrem Gerät oder lesen es aus, wenn es für eine von Ihnen
          ausdrücklich gewünschte Funktion unbedingt erforderlich ist (§ 25 Abs. 2 Nr. 2 TDDDG) – etwa, damit
          Sie angemeldet bleiben oder Ihr Warenkorb nicht verloren geht. Dafür ist keine Einwilligung nötig;
          die anschließende Verarbeitung stützt sich auf Art. 6 Abs. 1 lit. b bzw. lit. f DSGVO.{' '}
          {gaEnabled ? (
            <>
              Einzige Ausnahme ist die Reichweitenmessung mit Google Analytics: Sie läuft nur mit Ihrer
              Einwilligung (§ 25 Abs. 1 TDDDG, Art. 6 Abs. 1 lit. a DSGVO, siehe Abschnitt 19).
            </>
          ) : (
            <>Cookies zu Werbe- oder Analysezwecken setzen wir nicht.</>
          )}
        </p>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Zweck</th>
                <th>Speicherdauer</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={3}>
                  <strong>Cookies</strong> (alle mit den Attributen HttpOnly bzw. Secure, soweit technisch
                  möglich)
                </td>
              </tr>
              <tr>
                <td className="mono small">customer_session</td>
                <td className="small">Anmeldung im Kundenkonto</td>
                <td className="small">{s.customerDays} Tage oder bis zur Abmeldung</td>
              </tr>
              <tr>
                <td className="mono small">organizer_session</td>
                <td className="small">Anmeldung im Veranstalterbereich</td>
                <td className="small">{s.organizerDays} Tage oder bis zur Abmeldung</td>
              </tr>
              <tr>
                <td className="mono small">payout_step_up</td>
                <td className="small">erneute Bestätigung vor Änderung von Auszahlungsdaten (Veranstalter)</td>
                <td className="small">{s.stepUpMinutes} Minuten</td>
              </tr>
              <tr>
                <td className="mono small">scan_session</td>
                <td className="small">Einlass-Scanner, den ein Veranstalter seinem Einlasspersonal freigibt</td>
                <td className="small">bis zum Ablauf des Scan-Links</td>
              </tr>
              <tr>
                <td className="mono small">admin_session, admin_preauth, admin_gate</td>
                <td className="small">Anmeldung des Betreibers (betrifft nur den Betreiber)</td>
                <td className="small">
                  {s.adminHours} Stunden bzw. {s.preauthMinutes} Minuten; Freischaltung bis 30 Tage
                </td>
              </tr>
              <tr>
                <td className="mono small">google_oauth_state</td>
                <td className="small">Schutz der Anmeldung mit Google vor Fälschung</td>
                <td className="small">10 Minuten</td>
              </tr>
              <tr>
                <td className="mono small">lang</td>
                <td className="small">gewählte Sprache – nur, wenn Sie die Sprache wechseln</td>
                <td className="small">1 Jahr</td>
              </tr>
              <tr>
                <td colSpan={3}>
                  <strong>Lokaler Speicher (localStorage)</strong> – bleibt, bis Sie ihn löschen oder die
                  Funktion ihn leert
                </td>
              </tr>
              <tr>
                <td className="mono small">martnepali.consent.v1</td>
                <td className="small">Ihre Entscheidung zur Reichweitenmessung, mit Zeitpunkt</td>
                <td className="small">bis Sie sie ändern</td>
              </tr>
              <tr>
                <td className="mono small">mn_basket_v1</td>
                <td className="small">Ihr Warenkorb</td>
                <td className="small">bis zur Bestellung bzw. Leerung</td>
              </tr>
              <tr>
                <td className="mono small">martnepali.saved.v1</td>
                <td className="small">Ihre Merkliste („Gespeichert“)</td>
                <td className="small">bis Sie Einträge entfernen</td>
              </tr>
              <tr>
                <td className="mono small">martnepali.device.v1, martnepali.wished.v1</td>
                <td className="small">
                  Wunsch-Button: zufällige Gerätekennung und Ihre Wünsche, damit ein Wunsch je Gerät nur
                  einmal zählt. Der Server speichert nur einen je Artikel verschiedenen, verschlüsselten
                  Hashwert – keinen Namen, keine E-Mail-Adresse, keine IP-Adresse.
                </td>
                <td className="small">bis Sie den Speicher löschen</td>
              </tr>
              <tr>
                <td className="mono small">tx:v2:…</td>
                <td className="small">Zwischenspeicher für automatische Übersetzungen von Seitentexten</td>
                <td className="small">bis Sie den Speicher löschen</td>
              </tr>
              <tr>
                <td className="mono small">mn.install.dismissed</td>
                <td className="small">Hinweis zur App-Installation ausgeblendet</td>
                <td className="small">bis Sie den Speicher löschen</td>
              </tr>
              <tr>
                <td colSpan={3}>
                  <strong>Sitzungsspeicher (sessionStorage)</strong> – wird beim Schließen des Tabs gelöscht
                </td>
              </tr>
              <tr>
                <td className="small">Chat-Verläufe</td>
                <td className="small">Verlauf der Suchleiste, des Hilfe-Bots und des Kontakt-Chats</td>
                <td className="small">bis zum Schließen des Tabs</td>
              </tr>
              <tr>
                <td className="small">Bestellentwurf</td>
                <td className="small">Ihre Auswahl im Bestellformular, damit sie beim Neuladen erhalten bleibt</td>
                <td className="small">bis zum Schließen des Tabs</td>
              </tr>
              <tr>
                <td className="mono small">martnepali.recent.v1</td>
                <td className="small">zuletzt angesehene Artikel</td>
                <td className="small">bis zum Schließen des Tabs</td>
              </tr>
              {gaEnabled ? (
                <>
                  <tr>
                    <td colSpan={3}>
                      <strong>Nur mit Ihrer Einwilligung</strong>
                    </td>
                  </tr>
                  <tr>
                    <td className="mono small">_ga, _ga_…</td>
                    <td className="small">Google Analytics: Unterscheidung von Besuchen (Abschnitt 19)</td>
                    <td className="small">bis zu 2 Jahre oder bis zum Widerruf</td>
                  </tr>
                </>
              ) : null}
            </tbody>
          </table>
        </div>
        <p className="small muted" style={{ marginTop: 12, marginBottom: 0 }}>
          Sie können Cookies und lokal gespeicherte Daten jederzeit in den Einstellungen Ihres Browsers
          löschen. Einige Funktionen (Anmeldung, Warenkorb) arbeiten dann nicht mehr wie gewohnt.
        </p>
      </Sec>

      <Sec id="bestellung" title="5. Tickets und Bestellungen">
        <p>
          Verantwortlich ist der jeweilige Anbieter; wir verarbeiten die Daten in seinem Auftrag (Abschnitt
          2).
        </p>
        <Sub>Welche Daten</Sub>
        <p>
          <strong>Pflichtangaben</strong> sind Ihr Name und Ihre E-Mail-Adresse. <strong>Freiwillig</strong>{' '}
          sind – je nach Angebot – eine Telefonnummer, der Name der zahlenden Person (falls abweichend) und
          eine Nachricht an den Anbieter. Hinzu kommen die Angaben zur Bestellung selbst: gebuchte Tickets
          oder Artikel und gewählte Optionen, Sitz-, Tisch- oder Abholzeitfenster, Preise, Rabatt- und
          Empfehlungscodes, Zahlungs-, Einlass- und Abholstatus.
        </p>
        <Sub>Zwecke</Sub>
        <ul style={ul}>
          <li>Ihnen Ihr Ticket bzw. Ihren Abholcode zu senden – und erneut, falls er verloren geht;</li>
          <li>
            Ihre Zahlung zuzuordnen: Ihre Bestellung erhält eine kurze Referenz wie{' '}
            <span className="mono">TICKETS-AB12CD34</span>, an der der Anbieter die Überweisung erkennt;
          </li>
          <li>den Einlass bzw. die Abholung zu prüfen;</li>
          <li>
            Ihnen die bestellbezogenen E-Mails zu senden: Bestätigung mit Ticket, Zahlungshinweise, höchstens
            eine Zahlungserinnerung, bei Waren die Nachricht „abholbereit“.
          </li>
        </ul>
        <p>
          Der QR-Code auf dem Ticket enthält nur einen zufälligen Code – weder Namen noch E-Mail-Adresse. Wer
          ihn am Einlass scannt, erfährt nur, ob das Ticket gültig und noch nicht benutzt ist. Ihre
          Bestellseite ist nur über den persönlichen, signierten Link aus Ihrer E-Mail oder über Ihr
          Kundenkonto erreichbar.
        </p>
        <Sub>Rechtsgrundlage</Sub>
        <p>
          Art. 6 Abs. 1 lit. b DSGVO (Vertrag zwischen Ihnen und dem Anbieter bzw. dessen Anbahnung).
        </p>
        <Sub>Wer sieht was</Sub>
        <ul style={ul}>
          <li>
            <strong>Der Anbieter</strong> sieht Ihre Angaben und was Sie bestellt haben, denn er braucht sie,
            um Ihnen Ihr Ticket bzw. Ihre Ware zu geben.
          </li>
          <li>
            <strong>Wir</strong> greifen als Auftragsverarbeiter nur darauf zu, soweit es für Betrieb,
            Fehlerbehebung oder die Unterstützung des Anbieters nötig ist.
          </li>
          <li>
            <strong>E-Mails</strong> versenden wir über Twilio SendGrid (Abschnitt 23). Sonst gibt niemand
            Ihre Daten weiter; wir verkaufen keine Daten, und eine Bestellung trägt Sie in keinen Verteiler ein.
          </li>
        </ul>
        <Sub>Löschung</Sub>
        <p style={{ marginBottom: 0 }}>
          Name, E-Mail-Adresse, Telefonnummer, Name der zahlenden Person und Ihre Nachricht werden{' '}
          <strong>{d.buyer} Tage nach dem Datum der Veranstaltung</strong> automatisch überschrieben. Bei
          Warenbestellungen geschieht das {d.buyer} Tage nach der Abholung, spätestens {d.shopLongStop} Tage
          nach der Zahlung, auch wenn Sie nie abholen; bei Angeboten ohne Datum {d.undated} Tage nach der
          Bestellung. Das ist keine Markierung, sondern echtes Überschreiben – die alten Werte sind weg.
          Übrig bleiben nur anonyme Zahlen und Beträge, damit die Buchführung des Anbieters aufgeht. Aus den
          Datensicherungen verschwinden die Daten spätestens nach {d.backup} Tagen.
        </p>
      </Sec>

      <Sec id="zahlung" title="6. Bezahlung">
        <p>
          Sie bezahlen direkt an den Anbieter; {f.platform} nimmt kein Geld entgegen und erhebt keine Gebühr.
        </p>
        <ul style={ul}>
          <li>
            <strong>Überweisung:</strong> Wir zeigen Ihnen die Bankverbindung (IBAN) des Anbieters und die
            Zahlungsreferenz. Ihre eigenen Bankdaten geben Sie nirgends auf dieser Website ein.
          </li>
          <li>
            <strong>PayPal:</strong> Bietet der Anbieter PayPal an, wird das PayPal-Skript erst geladen, wenn
            Sie auf „Mit PayPal bezahlen“ klicken; dabei erhält PayPal technisch Ihre IP-Adresse und
            Browserdaten. Die Zahlung erfolgt im Fenster von PayPal über das Konto des Anbieters. Anbieter ist
            die PayPal (Europe) S.à r.l. et Cie, S.C.A., 22–24 Boulevard Royal, L-2449 Luxemburg.
          </li>
          <li>
            <strong>Stripe:</strong> Bietet der Anbieter Stripe an, leiten wir Sie zur Bezahlseite seines
            Stripe-Kontos weiter und übergeben dabei Ihre E-Mail-Adresse und die Bestellreferenz. Anbieter ist
            die Stripe Payments Europe, Limited, 1 Grand Canal Street Lower, Grand Canal Dock, Dublin, D02
            H210, Irland.
          </li>
        </ul>
        <p style={{ marginBottom: 0 }}>
          PayPal und Stripe sind Zahlungsdienste des Anbieters und verarbeiten Ihre Zahlungsdaten in eigener
          Verantwortung nach ihren eigenen Datenschutzhinweisen; beide können Daten auch in die USA
          übermitteln. Wir erhalten von ihnen nur die Rückmeldung, ob und unter welcher Kennung bezahlt
          wurde. Rechtsgrundlage für die Übergabe ist Art. 6 Abs. 1 lit. b DSGVO.
        </p>
      </Sec>

      <Sec id="kundenkonto" title="7. Kundenkonto">
        <p>
          Ein Kundenkonto ist freiwillig; Bestellen geht auch ohne. Mit einem Konto sehen Sie alle
          Bestellungen, die zu Ihrer bestätigten E-Mail-Adresse gehören, und Ihr Warenkorb wird zwischen
          Ihren Geräten mitgenommen. Verantwortlich sind wir.
        </p>
        <ul style={ul}>
          <li>
            <strong>Anmeldung per E-Mail-Code:</strong> Wir senden Ihnen einen sechsstelligen Code, der zehn
            Minuten gilt. Gespeichert werden Ihre E-Mail-Adresse, Ihr Name (falls angegeben), der Zeitpunkt
            der letzten Anmeldung und Ihr gespeicherter Warenkorb.
          </li>
          {f.googleSignIn ? (
            <li>
              <strong>„Mit Google anmelden“:</strong> Wählen Sie diese Möglichkeit, leiten wir Sie zu Google
              weiter (Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irland). Wir übermitteln
              dabei keine Daten über Sie an Google; Google erfährt aber durch die Anmeldung selbst, dass Sie
              sich bei {f.platform} anmelden. Von Google erhalten wir Ihren Namen, Ihre E-Mail-Adresse und
              Ihre Google-Konto-ID. Google kann Daten auch in die USA übermitteln; es gelten die
              Datenschutzhinweise von Google.
            </li>
          ) : null}
          <li>
            Das Anmelde-Cookie <span className="mono">customer_session</span> gilt {s.customerDays} Tage oder
            bis Sie sich abmelden.
          </li>
        </ul>
        <p>
          <strong>Selbst verwalten:</strong> Unter <Link href="/account" style={linkStyle}>/account</Link>{' '}
          können Sie Ihre Daten jederzeit als Datei (JSON) herunterladen und Ihr Konto selbst löschen. Konten,
          in die sich {d.customerInactive} Tage lang niemand angemeldet hat, löschen wir automatisch samt
          Warenkorb. Ihre Bestellungen sind davon nicht betroffen – für sie gelten die Fristen aus Abschnitt 5.
        </p>
        <p style={{ marginBottom: 0 }}>
          Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (Bereitstellung des von Ihnen gewünschten Kontos).
        </p>
      </Sec>

      <Sec id="mitteilungen" title="8. „Keep me posted“ – Mitteilungen eines Anbieters">
        <p>
          Im Bestellvorgang gibt es ein freiwilliges Kästchen, mit dem Sie zustimmen können, dass dieser
          eine Anbieter Ihnen neue Angebote ankündigen darf. Es ist nie vorausgewählt, und Ihre Bestellung
          funktioniert ohne es genauso. Verantwortlich ist der Anbieter; wir versenden in seinem Auftrag.
        </p>
        <p>
          <strong>Double-Opt-in:</strong> Das Ankreuzen allein trägt Sie nicht ein – jeder könnte ja jede
          Adresse eintippen. Sie erhalten eine Bestätigungs-E-Mail, und erst der Klick darin setzt Sie auf die
          Liste. Ohne Klick keine Eintragung; nicht bestätigte Anfragen werden nach {d.buyer} Tagen gelöscht.
        </p>
        <p>
          Nach der Bestätigung speichern wir nur Ihre E-Mail-Adresse – nicht Ihren Namen – mit dem Zeitpunkt
          der Einwilligung, für genau einen Zweck: Ankündigungen dieses einen Anbieters, höchstens eine E-Mail
          je neuem Angebot. Weil Sie das ausdrücklich wollten, bleibt diese Adresse über die Löschung nach
          der Veranstaltung hinaus gespeichert, bis Sie sich abmelden.
        </p>
        <p>
          Jede Mitteilung enthält einen Abmeldelink – ein Klick, ohne Anmeldung, ohne Ablaufdatum. Nach der
          Abmeldung bewahren wir Ihre Adresse nur noch als Sperrvermerk auf, damit niemand Sie ohne erneute,
          von Ihnen bestätigte Einwilligung wieder eintragen kann. Möchten Sie auch diesen Vermerk gelöscht
          haben, genügt eine Nachricht.
        </p>
        <p style={{ marginBottom: 0 }}>
          Rechtsgrundlage ist Ihre Einwilligung (Art. 6 Abs. 1 lit. a DSGVO), die Sie jederzeit mit Wirkung
          für die Zukunft widerrufen können (Art. 7 Abs. 3 DSGVO). Der Sperrvermerk beruht auf Art. 6 Abs. 1
          lit. c und lit. f DSGVO (Nachweis der Einwilligung und Beachtung Ihres Widerrufs).
        </p>
      </Sec>

      <Sec id="kundenkarte" title="9. Kundenkarte">
        <p>
          Nach der Bezahlung bietet Ihnen die Bestellseite eine Kundenkarte bei diesem einen Anbieter an. Das
          ist nur ein Angebot: Ohne Klick entsteht keine Karte. Verantwortlich ist der Anbieter.
        </p>
        <p>
          Mit dem Klick speichern wir Ihre E-Mail-Adresse, zugeordnet zu diesem Anbieter, und geben Ihnen
          eine eigene Seite mit QR-Code. Die Seite zeigt Ihren Empfehlungscode, Ihre Gutscheine und was Sie{' '}
          <em>bei diesem Anbieter</em> gekauft haben. Der QR-Code enthält nur den zufälligen Code der Karte.
        </p>
        <p>
          Die Karte gilt nur bei diesem einen Anbieter. Sie erkennt Sie nicht bei anderen Anbietern, und es
          gibt keine Stelle auf {f.platform}, die Ihre Karten nebeneinanderlegt. Nur dieser Anbieter kann den
          Code nachschlagen und sieht dann Ihren Namen, die Zahl Ihrer Bestellungen bei ihm, seit wann Sie die
          Karte haben und welche Gutscheine Sie noch nicht eingelöst haben. Das Einlasspersonal mit
          Scan-Link sieht das nicht.
        </p>
        <p style={{ marginBottom: 0 }}>
          Die Karte bleibt, solange Sie sie wollen: Mit „Close this card“ auf der Kartenseite wird sie ohne
          Anmeldung sofort vollständig gelöscht. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (die von
          Ihnen angeforderte Leistung des Anbieters).
        </p>
      </Sec>

      <Sec id="abonnements" title="10. Subscribe & save (wiederkehrende Bestellungen)">
        <p style={{ marginBottom: 0 }}>
          Bietet ein Anbieter regelmäßige Lieferungen oder Abholungen an, speichern wir für Sie Name,
          E-Mail-Adresse, gewählte Artikel, Rhythmus und Status. Sie verwalten das Abonnement über einen
          privaten Link aus Ihren E-Mails (pausieren, fortsetzen, kündigen). Verantwortlich ist der Anbieter;
          Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO. Gekündigte oder beendete Abonnements werden{' '}
          {d.subscriptionEnded} Tage nach ihrem Ende gelöscht, ebenso, wenn das Angebot nicht mehr existiert.
          Die einzelnen Bestellungen daraus folgen den Fristen aus Abschnitt 5.
        </p>
      </Sec>

      <Sec id="empfehlungen" title="11. Empfehlungen und Gutscheine">
        <p>
          Nach einer Bestellung können Sie einen Link teilen, der einen zufälligen Empfehlungscode enthält.
          Bucht jemand über diesen Link, kann der Anbieter in seiner Auswertung sehen, wer wen empfohlen hat
          (mit Namen), und Ihnen als Dank einen Gutschein zukommen lassen, den wir Ihnen per E-Mail senden.
          Verantwortlich ist der Anbieter; Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (Teilnahme am
          Empfehlungsangebot des Anbieters).
        </p>
        <p style={{ marginBottom: 0 }}>
          Ihre E-Mail-Adresse als empfehlende Person zu einem Gutschein wird {d.referral} Tage nach dessen
          Einlösung oder Verfall gelöscht – jedoch nicht, solange Sie bei diesem Anbieter noch eine bezahlte
          Bestellung haben, deren Daten noch nicht gelöscht sind; dann mit deren Löschung.
        </p>
      </Sec>

      <Sec id="bewertungen" title="12. Bewertungen">
        <p style={{ marginBottom: 0 }}>
          Nach einem Kauf können Sie eine Bewertung schreiben. Wir prüfen anhand Ihrer Bestellung, dass Sie
          tatsächlich gekauft haben, und veröffentlichen Ihren Text mit einer kurzen Angabe aus Vorname und
          Anfangsbuchstabe des Nachnamens (z. B. „Sunita K.“). Bewertungen können vor oder nach der
          Veröffentlichung geprüft und bei Rechtsverstößen entfernt werden. Wird Ihre Bestellung nach den
          Fristen aus Abschnitt 5 gelöscht, wird auch Ihre Bewertung anonymisiert: Der Text bleibt, Ihr Name
          nicht. Verantwortlich sind wir; Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (die von Ihnen
          genutzte Bewertungsfunktion) und für die Prüfung der Echtheit Art. 6 Abs. 1 lit. f DSGVO (unser
          Interesse an verlässlichen Bewertungen). Auf Wunsch löschen wir Ihre Bewertung.
        </p>
      </Sec>

      <Sec id="warteliste" title="13. Warteliste bei ausverkauften Angeboten">
        <p style={{ marginBottom: 0 }}>
          Ist ein Angebot ausverkauft, können Sie Ihre E-Mail-Adresse hinterlassen. Mehr speichern wir nicht –
          keinen Namen, kein Konto. Werden wieder Plätze frei, erhalten alle auf der Liste gleichzeitig genau
          eine E-Mail. Danach wird Ihre Adresse innerhalb von {d.waitlistNotified} Tagen gelöscht; findet die
          Veranstaltung statt, ohne dass etwas frei wurde, wird sie dann gelöscht. Bei Warenangeboten und
          Angeboten ohne Datum wird ein Eintrag spätestens {d.waitlistShopMax} Tage nach der Eintragung
          gelöscht. Der Anbieter sieht nur die Anzahl der Einträge, nicht die Adressen. Verantwortlich sind
          wir; Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (die von Ihnen angeforderte Benachrichtigung).
        </p>
      </Sec>

      <Sec id="fragen" title="14. Fragen an Anbieter, KI-Helfer, Suchleiste und Hilfe-Bot">
        <Sub>Fragen an den Anbieter (Frageformular)</Sub>
        <p>
          Über das Frageformular auf einer Angebotsseite können Sie dem Anbieter eine Frage stellen, ohne
          sich anzumelden. Name und E-Mail-Adresse sind freiwillig; die E-Mail-Adresse verwenden wir nur, um
          Ihnen die Antwort des Anbieters zuzusenden. Die Frage geht unmittelbar an den Anbieter, der sie in
          seinem Veranstalterbereich beantwortet – ein KI-Dienst ist daran nicht beteiligt.
        </p>
        <p>
          <strong>Beantwortete Fragen werden mit der Antwort auf der Angebotsseite veröffentlicht</strong> –
          ohne Ihren Namen und ohne Ihre E-Mail-Adresse („Asked by a visitor“). Schreiben Sie Ihre Frage also
          so, als wäre sie öffentlich. Veröffentlichte Fragen und Antworten kann der KI-Helfer der
          Angebotsseite (unten) als Wissensgrundlage verwenden. Name und E-Mail-Adresse werden nach denselben
          Fristen wie Bestelldaten gelöscht (Abschnitt 5; bei Warenangeboten gemessen ab dem Zeitpunkt der
          Frage); unbeantwortete Fragen werden dann vollständig gelöscht. Frage und Antwort bleiben als
          öffentliche Information zum Angebot erhalten.
        </p>
        <p>
          Verantwortlich ist der Anbieter; wir verarbeiten die Frage in seinem Auftrag. Rechtsgrundlagen: Art.
          6 Abs. 1 lit. b DSGVO für die Beantwortung, auch per E-Mail (Ihre Anfrage, häufig vor einer Buchung),
          und Art. 6 Abs. 1 lit. f DSGVO für die Veröffentlichung ohne Ihren Namen (Interesse des Anbieters,
          anderen Besuchern dieselbe Antwort zugänglich zu machen). Auf Wunsch wird Ihre Frage entfernt.
        </p>
        <Sub>KI-Helfer auf Angebotsseiten</Sub>
        <p>
          Für eine sofortige Antwort können Sie Ihre Frage stattdessen dem KI-Helfer der Angebotsseite
          stellen. Ihr Text wird zusammen mit den Angaben des Angebots und den dort veröffentlichten Fragen und
          Antworten an einen KI-Dienst übermittelt (Abschnitt 18) und nicht in unserer Datenbank gespeichert.
          Findet der Helfer keine Antwort, können Sie die Frage mit einem Klick an den Anbieter weitergeben –
          erst dann wird sie wie oben beschrieben gespeichert. Verantwortlich für den KI-Helfer sind wir;
          Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (die von Ihnen genutzte Funktion).
        </p>
        <Sub>Suchleiste „Ask“ und Hilfe-Bot</Sub>
        <p style={{ marginBottom: 0 }}>
          Was Sie in die Suchleiste oder den Hilfe-Bot eingeben, wird an einen KI-Dienst (Abschnitt 18)
          übermittelt, um passende Angebote zu finden bzw. Fragen zur Plattform zu beantworten. Wir speichern
          diese Eingaben nicht in unserer Datenbank; der Verlauf liegt nur im Sitzungsspeicher Ihres
          Browsers. Bitte geben Sie dort keine persönlichen Daten ein. Rechtsgrundlage ist Art. 6 Abs. 1 lit.
          b DSGVO (die von Ihnen genutzte Funktion).
        </p>
      </Sec>

      <Sec id="mikrofon" title="15. Spracheingabe (Mikrofon)">
        <p style={{ marginBottom: 0 }}>
          Wo ein Mikrofon-Symbol erscheint, ist dessen Nutzung freiwillig; jedes dieser Felder kann auch per
          Tastatur ausgefüllt werden. Erst wenn Sie tippen und Ihr Browser den Zugriff erlaubt, wird
          aufgenommen. Die Aufnahme wird an Google Gemini gesendet, das sie in Text umwandelt und zurückgibt
          – ausschließlich unter den Bedingungen der kostenpflichtigen Nutzung (Abschnitt 18); andernfalls ist
          die Funktion abgeschaltet. Wir speichern die Aufnahme weder auf dem Server noch in der Datenbank
          noch in Protokollen; sie existiert nur für die Dauer der Anfrage. Übrig bleibt nur der Text, den Sie
          sehen und bearbeiten können. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (die von Ihnen
          ausgelöste Funktion).
        </p>
      </Sec>

      <Sec id="kontakt" title="16. Kontaktformular und Kontakt-Chat">
        <p>
          Das <Link href="/contact" style={linkStyle}>Kontaktformular</Link> fragt nach Name, E-Mail-Adresse
          und Ihrem Anliegen, bei einer Anfrage nach einem Veranstalterkonto zusätzlich nach einigen
          freiwilligen Angaben zu Ihrem Angebot. Wir speichern die Anfrage, damit sie bei einer E-Mail-Störung
          nicht verloren geht, und leiten sie per E-Mail an uns selbst weiter.
        </p>
        <p>
          Der <strong>Kontakt-Chat</strong> auf derselben Seite wird von Google Gemini beantwortet – nur unter
          den Bedingungen der kostenpflichtigen Nutzung (Abschnitt 18); sonst antwortet er ohne KI. E-Mail-
          Adressen und Telefonnummern werden vor der Übermittlung automatisch aus Ihrem Text entfernt.
        </p>
        <p style={{ marginBottom: 0 }}>
          Verantwortlich sind wir. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO, soweit Ihre Anfrage auf
          einen Vertrag zielt (z. B. ein Veranstalterkonto), im Übrigen Art. 6 Abs. 1 lit. f DSGVO (unser
          Interesse, Anfragen zu beantworten). Anfragen werden {d.contact} Tage nach Eingang gelöscht, auf
          Wunsch früher.
        </p>
      </Sec>

      <Sec id="uebersetzung" title="17. Automatische Übersetzung">
        <p style={{ marginBottom: 0 }}>
          Seiten können automatisch ins Deutsche oder Nepalesische übersetzt werden. Dafür wird ausschließlich
          der Text der Seite selbst an Google Gemini gesendet. Namen, E-Mail-Adressen, Telefonnummern,
          Bankverbindungen, Bestell- und Ticketcodes und andere Angaben zu Käuferinnen und Käufern werden
          davon ausgenommen.{' '}
          {geminiMayProcessPersonalData()
            ? 'Dies erfolgt zu den Bedingungen der kostenpflichtigen Nutzung der Gemini API, nach denen Google die Texte nicht zur Verbesserung seiner Produkte verwendet.'
            : 'Weil nur veröffentlichter Seitentext übermittelt wird, kann hierfür auch die unentgeltliche Stufe der Gemini API genutzt werden.'}{' '}
          Übersetzungen werden auf unserem Server und in Ihrem Browser zwischengespeichert (Abschnitt 4).
          Rechtstexte wie diese Datenschutzerklärung werden nie maschinell übersetzt. Rechtsgrundlage ist
          Art. 6 Abs. 1 lit. f DSGVO (unser Interesse, die Plattform in den Sprachen ihrer Nutzer anzubieten).
        </p>
      </Sec>

      <Sec id="ki" title="18. Grundsätze für KI-Dienste">
        <ul style={ul}>
          <li>
            <strong>Google Gemini</strong> (Google Cloud EMEA Limited, Dublin, Irland, bzw. Google LLC, USA)
            erhält Inhalte, die personenbezogene Daten enthalten können – Eingaben in den KI-Helfer, die
            Suchleiste und den Hilfe-Bot, Spracheingaben, den Kontakt-Chat und die Assistenzfunktionen für
            Veranstalter –, <strong>nur</strong>, wenn wir die
            kostenpflichtige Nutzung eingerichtet haben. Nach den Bedingungen von Google für diese Nutzung
            werden Ihre Inhalte nicht zur Verbesserung der Produkte von Google verwendet und nach dem Data
            Processing Addendum von Google als Auftragsverarbeitung behandelt. Ist das nicht der Fall oder
            ist das Tageskontingent erschöpft, arbeiten diese Funktionen ohne KI oder mit Anthropic.
          </li>
          <li>
            <strong>Anthropic</strong> (Anthropic Ireland, Limited, Dublin, Irland, bzw. Anthropic, PBC, USA)
            beantwortet Eingaben ersatzweise, wenn Gemini nicht verfügbar ist, und unterstützt Veranstalter
            beim Entwerfen von FAQ-Einträgen und der Seitengestaltung. Nach den kommerziellen Bedingungen von
            Anthropic werden über die Schnittstelle übermittelte Inhalte nicht zum Training verwendet.
          </li>
          <li>
            Die KI trifft keine Entscheidungen über Sie; sie formuliert Antworten und Texte. Antworten können
            fehlerhaft sein – verbindlich sind die Angaben des Anbieters.
          </li>
        </ul>
        <p style={{ marginBottom: 0 }}>Beide Dienste handeln als Auftragsverarbeiter. {TRANSFER_BASIS_DE}</p>
      </Sec>

      {/* Only when analytics is actually switched on. A privacy notice that
          describes a tracker the deployment does not run is as wrong as one
          that hides a tracker it does: both leave a reader unable to trust the
          rest of the page. The same env var that loads the tag writes this
          section, so the two cannot disagree. */}
      {process.env.NEXT_PUBLIC_GA_ID ? (
        <Sec id="analytics" title="19. Reichweitenmessung (Google Analytics)">
          <p>
            Mit <strong>Google Analytics 4</strong> sehen wir, welche Seiten tatsächlich gelesen werden – so
            entscheiden wir, was wir als Nächstes bauen. Es ist die einzige Messung auf dieser Website.
          </p>
          <p>
            <strong>Sie läuft nur, wenn Sie zugestimmt haben.</strong> Bis zu Ihrer Antwort im Hinweisfenster
            wird nichts geladen – kein Skript, kein Cookie, keine Anfrage an Google. „Nein“ ist genauso ein
            Klick wie „Ja“, und keine Funktion hängt davon ab. Keine Antwort gilt als Nein.
          </p>
          <p>
            Übermittelt werden die aufgerufene Seite (ohne alles nach dem Fragezeichen), ungefährer Standort,
            Browser und Gerät sowie die verweisende Seite; Google setzt die Cookies{' '}
            <span className="mono">_ga</span> und <span className="mono">_ga_…</span> (bis zu 2 Jahre), um
            Besuche zu unterscheiden. <strong>Nie</strong> gemessen werden – unabhängig von Ihrer Antwort – Ihre
            Bestellseite, Ihre Tickets, Ihre Kundenkarte, Ihr Abonnement, Ihr Kundenkonto, der Einlass-Scanner,
            der Veranstalter- und der Administrationsbereich. Nichts, was Sie eingeben, wird an Google gesendet.
          </p>
          <p>
            Empfänger ist die <strong>Google Ireland Limited</strong>, Gordon House, Barrow Street, Dublin 4,
            Irland; Daten können an die Google LLC in den <strong>USA</strong> übermittelt werden.{' '}
            {TRANSFER_BASIS_DE} Rechtsgrundlage ist Ihre Einwilligung (Art. 6 Abs. 1 lit. a DSGVO, § 25 Abs. 1
            TDDDG). Sie können sie jederzeit so einfach widerrufen, wie Sie sie erteilt haben:
          </p>
          <ConsentControl />
          <p className="muted small" style={{ marginBottom: 0 }}>
            Der Widerruf stoppt die Messung sofort und löscht die von Google auf diesem Gerät gesetzten
            Cookies. Auch ein Browser, der Analyse-Cookies blockiert, oder ein üblicher Blocker verhindert sie.
          </p>
        </Sec>
      ) : null}

      <Sec id="app" title="20. Installierbare App und Offline-Tickets">
        <p style={{ marginBottom: 0 }}>
          Sie können {f.platform} wie eine App auf Ihrem Gerät installieren. Die App speichert dazu die
          Programmdateien und Bilder der Website und – damit Sie Ihr Ticket am Einlass auch ohne Empfang
          zeigen können – Ihre eigenen Ticketseiten, jeweils höchstens {d.offlineTicket} Tage lang. Das
          geschieht nur auf Ihrem Gerät; nichts davon wird an uns übertragen. Bestellseiten, Kundenkarten,
          Abonnements, Ihr Kundenkonto, der Warenkorb sowie Veranstalter- und Administrationsbereich werden
          nie gespeichert, und beim Abmelden werden gespeicherte Seiten gelöscht. Rechtsgrundlage ist § 25
          Abs. 2 Nr. 2 TDDDG in Verbindung mit Art. 6 Abs. 1 lit. b DSGVO.
        </p>
      </Sec>

      <Sec id="fotos" title="21. Fotos und Videos der Anbieter">
        <p style={{ marginBottom: 0 }}>
          Fotos und Videos auf Angebotsseiten laden die Anbieter selbst hoch. Standort- und Kameradaten
          (Metadaten) werden dabei automatisch entfernt. Für die Veröffentlichung von Aufnahmen, auf denen
          Personen erkennbar sind, ist der Anbieter verantwortlich; er muss dafür eine Rechtsgrundlage haben,
          etwa eine Einwilligung und bei Minderjährigen die der Eltern. Sind Sie auf einer Aufnahme zu sehen
          und nicht einverstanden, wenden Sie sich an den Anbieter oder an uns – wir leiten Ihr Anliegen
          weiter und entfernen rechtswidrige Inhalte.
        </p>
      </Sec>

      <Sec id="anbieter" title="22. Informationen für Veranstalter und Verkäufer">
        <p>
          Dieser Abschnitt betrifft Sie, wenn Sie auf {f.platform} selbst Veranstaltungen oder Waren
          anbieten. Für Ihre eigenen Daten sind wir verantwortlich; für die Daten Ihrer Kundinnen und Kunden
          sind Sie verantwortlich und wir Ihr Auftragsverarbeiter nach dem{' '}
          <Link href="/avv" style={linkStyle}>
            Auftragsverarbeitungsvertrag
          </Link>
          , der Teil der <Link href="/terms" style={linkStyle}>Nutzungsbedingungen</Link> ist.
        </p>
        <Sub>Welche Daten</Sub>
        <ul style={ul}>
          <li>
            <strong>Konto:</strong> Name, E-Mail-Adresse, Passwort (nur als gesalzener scrypt-Hashwert),
            gegebenenfalls das Geheimnis Ihrer Authenticator-App für die Zwei-Faktor-Anmeldung (verschlüsselt
            gespeichert), Sitzungen,
            Zeitpunkt und Browser neuer Anmeldungen (für die Anmeldebenachrichtigung), Anmelde- und
            Rücksetzcodes (nur als Hashwert, kurzlebig).
          </li>
          <li>
            <strong>Anbieterkennzeichnung:</strong> Name bzw. Bezeichnung, Anschrift, Vertretungsberechtigte,
            gegebenenfalls Registereintrag und Kontakt-E-Mail – diese Angaben werden Käuferinnen und Käufern
            auf Angebotsseiten, im Bestellvorgang, auf Bestellseiten, Tickets und in E-Mails angezeigt.
          </li>
          <li>
            <strong>Auszahlungsdaten:</strong> Kontoinhaber und IBAN, die Käufern zur Überweisung angezeigt
            werden; auf Wunsch Zugangsdaten Ihres eigenen PayPal- oder Stripe-Kontos, die wir mit AES-256-GCM
            verschlüsselt speichern und nur verwenden, um Zahlungen für Ihre Bestellungen anzulegen und zu
            prüfen.
          </li>
          <li>
            <strong>Inhalte:</strong> Ihre Angebote, Texte, Fotos und Videos, gegebenenfalls eine
            WhatsApp-Nummer (öffentlich sichtbar), Antworten auf Fragen, Mitteilungen.
          </li>
          <li>
            <strong>Assistenzfunktionen:</strong> Was Sie in den Einrichtungsassistenten, die FAQ-Entwürfe oder
            die Seitengestaltung eingeben, wird an Google Gemini (nur bei kostenpflichtiger Nutzung) bzw.
            Anthropic übermittelt (Abschnitt 18).
          </li>
          <li>Ihre Annahme der Nutzungsbedingungen und des Auftragsverarbeitungsvertrags (Version und Zeitpunkt).</li>
        </ul>
        <Sub>Zweck und Rechtsgrundlage</Sub>
        <p>
          Bereitstellung der Plattform nach den Nutzungsbedingungen (Art. 6 Abs. 1 lit. b DSGVO);
          Sicherheitsfunktionen wie Anmeldebenachrichtigungen und Warnungen bei geänderten Auszahlungsdaten
          (Art. 6 Abs. 1 lit. f DSGVO – unser und Ihr Interesse, Missbrauch Ihres Kontos und Umleitung von
          Zahlungen zu verhindern). E-Mails an Sie versenden wir über Twilio SendGrid.
        </p>
        <Sub>Speicherdauer</Sub>
        <p style={{ marginBottom: 0 }}>
          Für die Dauer Ihres Kontos. Nach dessen Beendigung löschen wir Ihre Daten und die Ihrer Kundinnen
          und Kunden innerhalb von {d.termination} Tagen, soweit keine gesetzliche Aufbewahrungspflicht
          besteht; aus den Datensicherungen verschwinden sie spätestens nach weiteren {d.backup} Tagen.
          Exportieren Sie vorher, was Sie für Ihre Buchführung brauchen (CSV-Export im Veranstalterbereich).
        </p>
      </Sec>

      <Sec id="empfaenger" title="23. Empfänger und Drittlandübermittlung">
        <p>Folgende Dienstleister verarbeiten Daten in unserem Auftrag (Art. 28 DSGVO):</p>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Empfänger</th>
                <th>Zweck</th>
                <th>Ort</th>
              </tr>
            </thead>
            <tbody>
              {f.processors.map((p) => (
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
        <p style={{ marginTop: 12 }}>In eigener Verantwortung erhalten Daten:</p>
        <ul style={ul}>
          <li>der <strong>Anbieter</strong>, bei dem Sie bestellen oder dem Sie eine Frage stellen (Abschnitte 5–11, 14);</li>
          <li>
            <strong>PayPal</strong> bzw. <strong>Stripe</strong>, wenn Sie über das Konto des Anbieters dort
            bezahlen (Abschnitt 6);
          </li>
          {f.googleSignIn ? <li><strong>Google</strong>, wenn Sie „Mit Google anmelden“ wählen (Abschnitt 7);</li> : null}
          {process.env.NEXT_PUBLIC_GA_ID ? (
            <li>
              <strong>Google Ireland Limited</strong> für Google Analytics, nur mit Ihrer Einwilligung
              (Abschnitt 19);
            </li>
          ) : null}
          <li>Behörden, soweit wir gesetzlich dazu verpflichtet sind (Art. 6 Abs. 1 lit. c DSGVO).</li>
        </ul>
        <p style={{ marginBottom: 0 }}>{TRANSFER_BASIS_DE}</p>
      </Sec>

      <Sec id="speicherdauer" title="24. Speicherdauer im Überblick">
        <div className="table-wrap">
          <table className="table">
            <tbody>
              <tr>
                <td className="small">Name, E-Mail, Telefon, Zahlender, Nachricht einer Bestellung</td>
                <td className="small">
                  {d.buyer} Tage nach der Veranstaltung; Waren {d.buyer} Tage nach Abholung, spätestens{' '}
                  {d.shopLongStop} Tage nach Zahlung; ohne Datum {d.undated} Tage nach Bestellung
                </td>
              </tr>
              <tr>
                <td className="small">Name und E-Mail bei Fragen; unbeantwortete Fragen</td>
                <td className="small">wie Bestelldaten (Abschnitt 14)</td>
              </tr>
              <tr>
                <td className="small">Name unter einer Bewertung</td>
                <td className="small">mit Löschung der zugehörigen Bestellung</td>
              </tr>
              <tr>
                <td className="small">Warteliste</td>
                <td className="small">
                  {d.waitlistNotified} Tage nach der Benachrichtigung bzw. mit der Veranstaltung; Waren
                  spätestens nach {d.waitlistShopMax} Tagen
                </td>
              </tr>
              <tr>
                <td className="small">„Keep me posted“</td>
                <td className="small">
                  bis zur Abmeldung (danach Sperrvermerk); unbestätigte Anfragen {d.buyer} Tage
                </td>
              </tr>
              <tr>
                <td className="small">Kundenkarte</td>
                <td className="small">bis Sie sie schließen</td>
              </tr>
              <tr>
                <td className="small">Beendete Abonnements</td>
                <td className="small">{d.subscriptionEnded} Tage nach Ende</td>
              </tr>
              <tr>
                <td className="small">E-Mail der empfehlenden Person zu einem Gutschein</td>
                <td className="small">{d.referral} Tage nach Einlösung oder Verfall (Abschnitt 11)</td>
              </tr>
              <tr>
                <td className="small">Kundenkonto</td>
                <td className="small">bis Sie es löschen; automatisch nach {d.customerInactive} Tagen ohne Anmeldung</td>
              </tr>
              <tr>
                <td className="small">Kontaktanfragen</td>
                <td className="small">{d.contact} Tage, auf Wunsch früher</td>
              </tr>
              <tr>
                <td className="small">Veranstalterkonto</td>
                <td className="small">Dauer des Kontos, danach {d.termination} Tage</td>
              </tr>
              <tr>
                <td className="small">Datensicherungen</td>
                <td className="small">{d.backup} Tage</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="small muted" style={{ marginTop: 12, marginBottom: 0 }}>
          Anonyme Zahlen und Beträge ohne Personenbezug bleiben für die Buchführung der Anbieter erhalten.
        </p>
      </Sec>

      <Sec id="pflicht" title="25. Pflicht zur Bereitstellung, keine automatisierte Entscheidung">
        <p>
          Für eine Bestellung sind Name und E-Mail-Adresse erforderlich – ohne sie kann der Anbieter Ihnen
          kein Ticket ausstellen und keine Zahlung zuordnen. Für ein Kundenkonto ist die E-Mail-Adresse
          erforderlich. Alle übrigen Angaben sind freiwillig; eine gesetzliche Pflicht zur Angabe besteht
          nicht.
        </p>
        <p style={{ marginBottom: 0 }}>
          Eine automatisierte Entscheidungsfindung einschließlich Profiling im Sinne von Art. 22 DSGVO findet
          nicht statt.
        </p>
      </Sec>

      <Sec id="rechte" title="26. Ihre Rechte">
        <p>Sie haben nach der DSGVO das Recht auf</p>
        <ul style={ul}>
          <li>Auskunft über die zu Ihnen gespeicherten Daten (Art. 15),</li>
          <li>Berichtigung unrichtiger Daten (Art. 16),</li>
          <li>Löschung (Art. 17),</li>
          <li>Einschränkung der Verarbeitung (Art. 18),</li>
          <li>Datenübertragbarkeit (Art. 20),</li>
          <li>Widerspruch gegen Verarbeitungen auf Grundlage von Art. 6 Abs. 1 lit. f (Art. 21, siehe unten),</li>
          <li>
            Widerruf einer Einwilligung jederzeit mit Wirkung für die Zukunft (Art. 7 Abs. 3); die
            Rechtmäßigkeit der bis dahin erfolgten Verarbeitung bleibt unberührt.
          </li>
        </ul>
        <p style={{ marginBottom: 0 }}>
          Wenden Sie sich dazu <ContactLine f={f} />. Mit einem Kundenkonto können Sie Ihre Daten unter{' '}
          <Link href="/account" style={linkStyle}>/account</Link> auch selbst herunterladen und löschen.
          Betrifft Ihr Anliegen Daten, für die ein Anbieter verantwortlich ist, können Sie sich auch direkt an
          ihn wenden; erreicht uns Ihr Anliegen, leiten wir es unverzüglich weiter.
        </p>
      </Sec>

      <Sec id="widerspruch" title="27. Widerspruchsrecht" tone="notice">
        <p style={{ fontWeight: 600 }}>
          Soweit wir Ihre Daten auf Grundlage von Art. 6 Abs. 1 lit. f DSGVO (berechtigte Interessen)
          verarbeiten, haben Sie das Recht, aus Gründen, die sich aus Ihrer besonderen Situation ergeben,
          jederzeit Widerspruch gegen diese Verarbeitung einzulegen (Art. 21 Abs. 1 DSGVO). Wir verarbeiten
          die Daten dann nicht mehr, es sei denn, wir können zwingende schutzwürdige Gründe nachweisen, die
          Ihre Interessen, Rechte und Freiheiten überwiegen, oder die Verarbeitung dient der Geltendmachung,
          Ausübung oder Verteidigung von Rechtsansprüchen.
        </p>
        <p style={{ fontWeight: 600, marginBottom: 0 }}>
          Werden Ihre Daten für Direktwerbung verarbeitet – etwa die Mitteilungen eines Anbieters –, können
          Sie jederzeit ohne Angabe von Gründen widersprechen (Art. 21 Abs. 2 und 3 DSGVO); am einfachsten
          über den Abmeldelink in jeder Mitteilung. Ihren Widerspruch richten Sie im Übrigen formlos an uns,{' '}
          <ContactLine f={f} />.
        </p>
      </Sec>

      <Sec id="beschwerde" title="28. Beschwerderecht">
        <p>
          Sie haben das Recht, sich bei einer Datenschutz-Aufsichtsbehörde zu beschweren (Art. 77 DSGVO),
          insbesondere in dem Mitgliedstaat Ihres Aufenthaltsorts, Ihres Arbeitsplatzes oder des Orts des
          mutmaßlichen Verstoßes. Für uns zuständig ist:
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

      <Sec id="aenderungen" title="29. Änderungen dieser Datenschutzerklärung">
        <p style={{ marginBottom: 0 }}>
          Wir passen diese Datenschutzerklärung an, wenn sich die Plattform oder die Rechtslage ändert. Es gilt
          die jeweils hier veröffentlichte Fassung. Die deutsche Fassung ist maßgeblich; die englische dient
          der Information.
        </p>
      </Sec>
    </>
  );
}
