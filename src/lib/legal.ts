import { platformContactEmail } from '@/lib/platform';

/**
 * Who stands behind this website, in the words German law asks for.
 *
 * The Impressum (§5 DDG), the Datenschutzerklärung (Art. 13 GDPR names the
 * controller) and the Auftragsverarbeitungsvertrag all quote the operator, so
 * they read it from here and cannot disagree with each other. Each value can
 * be overridden by an environment variable of the same purpose, but the
 * defaults are the real ones — a legal page must never render empty just
 * because a deployment forgot a setting.
 */

/** Natural person operating the platform (Diensteanbieter, Verantwortlicher). */
export function operatorName(): string {
  return (process.env.OPERATOR_NAME || '').trim() || 'Milan Adhikari';
}

/** Ladungsfähige Anschrift, one line per entry. */
export function operatorAddressLines(): string[] {
  const raw = (process.env.OPERATOR_ADDRESS || '').trim();
  if (raw) return raw.split(/\s*(?:\n|\\n|;)\s*/).filter(Boolean);
  return ['Donnersbergring 26', '64295 Darmstadt', 'Deutschland'];
}

/**
 * The address for Impressum, privacy requests and the AVV: the platform's
 * support mailbox (SUPPORT_EMAIL in lib/platform — fixed in code on purpose,
 * see platformContactEmail). Callers still offer the contact form beside it,
 * so the Impressum always has a second fast channel.
 */
export function operatorEmail(): string {
  return platformContactEmail();
}

/** Optional telephone for the Impressum. Not required when email + form exist. */
export function operatorPhone(): string {
  return (process.env.OPERATOR_PHONE || '').trim();
}

/**
 * The supervisory authority responsible for the operator's place of residence
 * (Hessen). Named on /privacy because Art. 13(2)(d) GDPR requires the right to
 * complain to be stated, and naming the competent one is the helpful version.
 */
export const SUPERVISORY_AUTHORITY = {
  name: 'Der Hessische Beauftragte für Datenschutz und Informationsfreiheit',
  addressLines: ['Postfach 3163', '65021 Wiesbaden'],
  url: 'https://datenschutz.hessen.de',
} as const;

/**
 * Version of the organizer terms (/terms) and the Auftragsverarbeitungsvertrag
 * (/avv) currently published. Bump it whenever either text changes in
 * substance: organizers whose organizers.legal_accepted_version differs are
 * asked to accept again. A date keeps it self-explanatory.
 */
export const LEGAL_TERMS_VERSION = '2026-09-29';

/**
 * Whether Google's Gemini API may be sent content that can contain personal
 * data (visitor questions, voice recordings, the contact chat).
 *
 * On Google's UNPAID tier, Google may use submitted content to improve its
 * products and humans may review it — no data-processing terms apply. Only
 * with billing enabled on the Google Cloud project does the paid-services
 * data-use promise and Google's data processing addendum cover it.
 *
 * Two ways to switch it on:
 *   · GEMINI_PAID_API_KEY — a key from a SEPARATE Google project with billing
 *     on. Only personal-content calls use it (and pay); page translation keeps
 *     running free on GEMINI_API_KEY, which only ever carries published page
 *     text. This is the cheap setup.
 *   · GEMINI_PAID_TIER=1 — billing is on for GEMINI_API_KEY's own project, so
 *     every call is paid anyway.
 * Until one is set, those features behave as if no key were configured (they
 * all have a non-AI fallback).
 */
export function geminiMayProcessPersonalData(): boolean {
  if (geminiPaidApiKey()) return true;
  const v = (process.env.GEMINI_PAID_TIER || '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

/** The billed key for personal-content calls, or '' (see above). */
export function geminiPaidApiKey(): string {
  return (process.env.GEMINI_PAID_API_KEY || '').trim();
}

/**
 * Hard ceiling on PAID Gemini calls per day, across the whole site, so the
 * bill cannot run away whatever the traffic (or an abuser) does. At the lite
 * models' prices (~€0.002 per question) the default caps the worst case at
 * roughly €5 a month; real use is far below it. Past the cap the features fall
 * back exactly as they do without a paid key. GEMINI_PAID_DAILY_CAP overrides.
 */
export function geminiPaidDailyCap(): number {
  const raw = Number(process.env.GEMINI_PAID_DAILY_CAP);
  return Number.isInteger(raw) && raw >= 0 && raw <= 100_000 ? raw : 100;
}

/**
 * The same ceiling for PAID page translation, counted separately so the first
 * German visitor after a deploy (hundreds of new strings) can never use up the
 * day's visitor questions. One call translates up to 15 strings for roughly
 * €0.0015, so the default caps translation at about €0.30 a day in the worst
 * case — and once the site's text is cached, it costs next to nothing.
 * GEMINI_PAID_TRANSLATE_DAILY_CAP overrides.
 */
export function geminiPaidTranslateDailyCap(): number {
  const raw = Number(process.env.GEMINI_PAID_TRANSLATE_DAILY_CAP);
  return Number.isInteger(raw) && raw >= 0 && raw <= 100_000 ? raw : 200;
}

/**
 * Where the servers physically are, until HOSTING_REGION says otherwise.
 *
 * Render lets each service pick a region, and the Datenschutzerklärung and the
 * AVV both have to say which one — "in the EU" and "in Oregon" are different
 * legal statements (Art. 13(1)(f) GDPR: a third-country transfer must be named).
 * Confirmed Sep 2026: this service runs in Render's Frankfurt (EU Central)
 * region. Move the service, and set HOSTING_REGION in the same breath.
 */
export const DEFAULT_HOSTING_REGION = 'Frankfurt am Main, Deutschland (EU)';

/** The hosting region as printed on /privacy and in the AVV. */
export function hostingRegion(): string {
  return (process.env.HOSTING_REGION || '').trim() || DEFAULT_HOSTING_REGION;
}

/**
 * Whether that region is inside the EU/EEA — the legal pages phrase the server
 * location from this. Anything it does not recognise counts as OUTSIDE, so a
 * typo in HOSTING_REGION makes the text over-disclose (mention a transfer that
 * may not happen) rather than hide one that does.
 */
export function hostingInEU(region: string = hostingRegion()): boolean {
  if (/\b(USA|U\.S\.|United States|Vereinigte Staaten|Oregon|Ohio|Virginia|Singapore|Singapur)\b/i.test(region)) {
    return false;
  }
  return /\b(EU|EWR|EEA|Europ\w*|Deutschland|Germany|Frankfurt)\b/i.test(region);
}

/**
 * Days after an organizer's account ends within which the operator deletes the
 * account and every listing and order in it (AVV § 9). A promise kept by hand —
 * there is no self-service organizer deletion yet — so it lives here beside the
 * other legal constants rather than in a sweep.
 */
export const TERMINATION_DELETION_DAYS = 30;

/**
 * How long the installable app keeps an offline copy of a ticket page on the
 * buyer's own device. MIRRORS TICKET_TTL_DAYS in public/sw.js, which cannot
 * import TypeScript — change one, change both. Quoted on /privacy.
 */
export const OFFLINE_TICKET_CACHE_DAYS = 60;

/**
 * The one sentence about data leaving the EU, in both languages. Deliberately
 * generic: it states the mechanism the law offers, not a claim that any named
 * provider holds a particular certification on any particular day.
 */
export const TRANSFER_BASIS_DE =
  'Soweit dabei Daten in die USA oder ein anderes Drittland übermittelt werden, erfolgt dies auf Grundlage des Angemessenheitsbeschlusses der EU-Kommission zum EU-US Data Privacy Framework, sofern der Empfänger danach zertifiziert ist, im Übrigen auf Grundlage der EU-Standardvertragsklauseln (Art. 46 Abs. 2 lit. c DSGVO).';
export const TRANSFER_BASIS_EN =
  'Where this involves a transfer of data to the USA or another third country, it takes place on the basis of the European Commission’s adequacy decision for the EU-US Data Privacy Framework where the recipient is certified under it, and otherwise on the basis of the EU standard contractual clauses (Art. 46(2)(c) GDPR).';

/**
 * The service providers that process personal data for the platform — Anlage 1
 * of the AVV and the "recipients" of the Datenschutzerklärung read this one
 * list, so a provider added here appears in both.
 *
 * NOT in it, on purpose: PayPal and Stripe. A seller connects their OWN account
 * with either; the contract is between the seller (or the buyer) and that
 * provider, which acts as an independent controller — the platform is not
 * their customer for those payments and cannot sub-contract them.
 */
export type LegalProcessor = {
  key: 'render' | 'cloudflare' | 'sendgrid' | 'gemini' | 'anthropic';
  name: string;
  addressDe: string;
  addressEn: string;
  purposeDe: string;
  purposeEn: string;
  locationDe: string;
  locationEn: string;
};

export function dataProcessors(): LegalProcessor[] {
  const region = hostingRegion();
  const eu = hostingInEU(region);
  return [
    {
      key: 'render',
      name: 'Render Services, Inc.',
      addressDe: '525 Brannan Street, Suite 300, San Francisco, CA 94107, USA',
      addressEn: '525 Brannan Street, Suite 300, San Francisco, CA 94107, USA',
      purposeDe:
        'Hosting der Anwendung, der Datenbank und der hochgeladenen Dateien; Server-Protokolle; Datensicherungen des Speichermediums',
      purposeEn: 'Hosting of the application, the database and uploaded files; server logs; storage snapshots',
      locationDe: eu
        ? `Server: ${region}; Zugriff durch das US-Unternehmen im Einzelfall (z. B. Support) möglich`
        : `Server: ${region}`,
      locationEn: eu
        ? `Servers: ${region}; access by the US company possible in individual cases (e.g. support)`
        : `Servers: ${region}`,
    },
    {
      key: 'cloudflare',
      name: 'Cloudflare, Inc.',
      addressDe: '101 Townsend Street, San Francisco, CA 94107, USA',
      addressEn: '101 Townsend Street, San Francisco, CA 94107, USA',
      purposeDe:
        'von Render eingesetzt: Auslieferung der Website (Content Delivery Network), Schutz vor Angriffen und Überlastung',
      purposeEn: 'used by Render: delivering the website (content delivery network), protection against attacks and overload',
      locationDe: 'weltweit verteiltes Netzwerk, einschließlich USA',
      locationEn: 'globally distributed network, including the USA',
    },
    {
      key: 'sendgrid',
      name: 'Twilio Inc. (Twilio SendGrid)',
      addressDe: '101 Spear Street, Suite 500, San Francisco, CA 94105, USA',
      addressEn: '101 Spear Street, Suite 500, San Francisco, CA 94105, USA',
      purposeDe:
        'Versand von E-Mails (Tickets, Zahlungshinweise, Bestellstatus, Anmeldecodes, beantwortete Fragen, bestätigte Mitteilungen)',
      purposeEn:
        'Sending emails (tickets, payment instructions, order status, sign-in codes, answered questions, confirmed announcements)',
      locationDe: 'USA',
      locationEn: 'USA',
    },
    {
      key: 'gemini',
      name: 'Google (Gemini API)',
      addressDe:
        'für Kunden im EWR in der Regel Google Cloud EMEA Limited, 70 Sir John Rogerson’s Quay, Dublin 2, Irland; verbundenes Unternehmen Google LLC, Mountain View, USA',
      addressEn:
        'for customers in the EEA usually Google Cloud EMEA Limited, 70 Sir John Rogerson’s Quay, Dublin 2, Ireland; affiliate Google LLC, Mountain View, USA',
      purposeDe:
        'KI-Funktionen: Beantwortung von Fragen, Kontakt-Chat, Spracheingabe (Umwandlung in Text), Assistenzfunktionen, Übersetzung von Seitentexten',
      purposeEn:
        'AI features: answering questions, contact chat, voice input (speech to text), assistant tools, translating page text',
      locationDe: 'EU und USA',
      locationEn: 'EU and USA',
    },
    {
      key: 'anthropic',
      name: 'Anthropic (Claude API)',
      addressDe:
        'Anthropic Ireland, Limited, Dublin, Irland (Vertragspartner für Kunden im EWR); verbundenes Unternehmen Anthropic, PBC, San Francisco, USA',
      addressEn:
        'Anthropic Ireland, Limited, Dublin, Ireland (contracting party for customers in the EEA); affiliate Anthropic, PBC, San Francisco, USA',
      purposeDe:
        'KI-Funktionen: Ersatz-Beantwortung von Fragen, wenn Gemini nicht verfügbar ist; Assistenzfunktionen für Veranstalter (FAQ-Entwürfe, Seitengestaltung)',
      purposeEn:
        'AI features: fallback for answering questions when Gemini is unavailable; tools for organizers (FAQ drafts, page designer)',
      locationDe: 'USA',
      locationEn: 'USA',
    },
  ];
}

/**
 * A legal date as each version of a page prints it: "29.09.2026" in German,
 * "29 September 2026" in English. Accepts a plain 'YYYY-MM-DD' (the version
 * constant), an ISO timestamp, or SQLite's 'YYYY-MM-DD HH:MM:SS' (UTC). With
 * `withTime` the Berlin wall-clock time is appended — an acceptance is a moment,
 * a version is a day. Unparseable input comes back unchanged rather than as
 * "Invalid Date" on a contract.
 */
export function legalDateLabel(raw: string, lang: 'de' | 'en', withTime = false): string {
  const s = (raw || '').trim();
  let d: Date;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) d = new Date(`${s}T12:00:00Z`);
  else if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(s)) d = new Date(`${s.replace(' ', 'T')}Z`);
  else d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  const date = d.toLocaleDateString(lang === 'de' ? 'de-DE' : 'en-GB', {
    timeZone: 'Europe/Berlin',
    day: lang === 'de' ? '2-digit' : 'numeric',
    month: lang === 'de' ? '2-digit' : 'long',
    year: 'numeric',
  });
  if (!withTime) return date;
  const time = d.toLocaleTimeString(lang === 'de' ? 'de-DE' : 'en-GB', {
    timeZone: 'Europe/Berlin',
    hour: '2-digit',
    minute: '2-digit',
  });
  return lang === 'de' ? `${date}, ${time} Uhr` : `${date}, ${time} (Berlin time)`;
}
