// Server-only: buyer + organizer emails via SMTP (nodemailer).
// If SMTP is not configured the site still works — buyers see their tickets
// and payment instructions on the order page; this module just quietly
// reports { sent: false }.
import nodemailer from 'nodemailer';
import type Mail from 'nodemailer/lib/mailer';
import QRCode from 'qrcode';
import { getBaseUrl } from './config';
import { getDb } from './db';
import {
  getEventById,
  getEventTier,
  paypalPayee,
  type PaypalPayee,
  type EventQuestionRow,
  type EventRow,
} from './events';
import { formatMoney } from './money';
import { girocodePayload } from './girocode';
import { vocabFor } from './vocab';
import {
  getOrder,
  getOrderItems,
  getTicketsForOrder,
  orderUrlForBuyerEmail,
  paymentReference,
  referralCode,
} from './orders';
import { orderPayout } from './payout';
import { getVoucher, organizerCurrency } from './referrals';
import {
  bareAddress,
  emailFromBuyers,
  emailFromOrganizers,
  platformContactEmail,
  platformNameFromEnv,
  platformWordmark,
  replyToBuyers,
  replyToOrganizers,
} from './platform';
import { confirmSubscriptionUrl, oneClickUnsubscribeUrl, unsubscribeUrl } from './marketing';
import { WAITLIST_NOTIFIED_RETENTION_DAYS } from './retention';
import { whatsappShareUrl } from './whatsapp';
import type { ContactRequestRow } from './contact';

export function isEmailConfigured(): boolean {
  // ANY of the three From addresses counts, not EMAIL_FROM specifically.
  //
  // This was a trap of my own making. Splitting the sender into
  // EMAIL_FROM_BUYERS and EMAIL_FROM_ORGANIZERS documented them as optional
  // with a fallback to EMAIL_FROM — but this gate, the master switch every
  // single send checks first, still demanded EMAIL_FROM by name. So setting the
  // two new variables and clearing the old one switched email OFF completely:
  // every send returned 'email-not-configured' having never attempted anything,
  // which looks exactly like a broken mail provider and is not one.
  //
  // ANY is still the right answer for the question this function is asked —
  // "is mail set up on this server at all", by callers like the announce route
  // deciding whether to offer a button. It is NOT enough before a send, because
  // a send uses one specific address: sendMailAs() below checks the From that
  // this particular mail needs.
  return Boolean(
    process.env.SMTP_HOST &&
      (process.env.EMAIL_FROM || process.env.EMAIL_FROM_BUYERS || process.env.EMAIL_FROM_ORGANIZERS)
  );
}

function createTransporter() {
  const port = Number(process.env.SMTP_PORT || 587);
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || '' }
      : undefined,
    // Hard caps so a stalled SMTP connection (blocked port, slow host) can never
    // hang a request for minutes — it fails fast and the caller carries on.
    connectionTimeout: 10_000, // TCP connect
    greetingTimeout: 10_000, // wait for server greeting
    socketTimeout: 20_000, // inactivity
  });
}

/** Which From address a mail goes out under — see lib/platform for why two. */
type Audience = 'buyers' | 'organizers';

/** Everything about a mail except who it is from; sendMailAs supplies that. */
type MailMessage = Omit<Mail.Options, 'from'>;

/**
 * Send one mail under the From address of ITS OWN audience, refusing legibly
 * when that address is empty.
 *
 * isEmailConfigured() above is satisfied by ANY of the three From variables,
 * which is right for what it answers ("is mail set up at all") and wrong as the
 * only check before a send: a deployment that sets EMAIL_FROM_BUYERS alone
 * passes that gate and then hands nodemailer `from: ''` for every organizer
 * mail. What comes back is an SMTP error about a missing sender — a broken
 * mail server by every appearance, and a missing env var in fact.
 *
 * So each send asks for the address it actually needs, and an absent one is
 * reported as the configuration problem it is, before anything touches SMTP.
 */
async function sendMailAs(
  audience: Audience,
  message: MailMessage
): Promise<{ sent: boolean; reason?: string }> {
  const from = (audience === 'buyers' ? emailFromBuyers() : emailFromOrganizers()).trim();
  if (!from) {
    console.error(
      `[email] No From address for ${audience}: set EMAIL_FROM_${audience.toUpperCase()} (or EMAIL_FROM). Mail not sent.`
    );
    return { sent: false, reason: 'email-not-configured' };
  }
  await createTransporter().sendMail({ from, ...message });
  return { sent: true };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function platformName(): string {
  return platformNameFromEnv();
}

/**
 * The organizer's name, for buyer mails that need to say WHO is selling.
 *
 * Not decoration: buyers here wire money to a private account on this
 * platform's word, and the mails must name the organizer as the party they are
 * buying from — the platform is software only and never holds, sees, or
 * confirms the money. Deliberately a direct query rather than an import from
 * lib/organizers: that module pulls in next/headers for portal sessions, and
 * this file also runs from background jobs outside any request (the same
 * reason maskTail below is a local copy). Returns '' when the organizer cannot
 * be found — and never throws — so a missing name degrades to "the organizer"
 * instead of stopping a ticket mail.
 */
function organizerDisplayName(organizerId: string): string {
  try {
    const row = getDb().prepare(`SELECT name FROM organizers WHERE id = ?`).get(organizerId) as
      | { name: string }
      | undefined;
    return row?.name?.trim() ?? '';
  } catch {
    return '';
  }
}

// ---------------------------------------------------------------------------
// Shared template pieces.
//
// Email clients are not browsers: Outlook renders with Word, Gmail strips most
// of <style>, and several clients invert colours for dark mode. So everything
// structural here is a table with inline styles — no flexbox, no grid, no
// external CSS, no web fonts, no <button>. The <style> block only carries
// enhancements (responsive padding, dark mode, print) that the mail must
// survive losing.
//
// Two rules the whole file follows:
//  1. Every element that sets a background ALSO sets its text colour, so a
//     client that inverts one of them cannot leave dark-on-dark text behind.
//  2. Nothing long (IBAN, reference, ticket code) sits in a nowrap cell —
//     values stack under their label so a 320px screen never scrolls sideways.
// ---------------------------------------------------------------------------

const FONT = `-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif`;
const MONO = `ui-monospace,'SF Mono',Menlo,Consolas,'Liberation Mono',monospace`;

/** One palette for all nine mails, so they cannot drift apart. */
const C = {
  canvas: '#eceef5',
  card: '#ffffff',
  line: '#dde1ec',
  band: '#0b0c12',
  brand: '#dc143c', // the platform crimson
  brandDeep: '#8b0f2f',
  brandBlue: '#003893',
  brandLight: '#ff8fa5', // crimson that still reads on the dark band
  button: '#c2102e', // a shade deeper than --brand: white text needs the contrast
  ink: '#14161f',
  body: '#474b5c',
  muted: '#767b8c',
  panel: '#f6f7fb',
  amberBg: '#fff8e6',
  amberLine: '#f0cf8c',
  amberInk: '#6b3e05',
};

/** One-line venue string for emails ("Venue, City"). */
/**
 * The first non-empty line of a multi-line field.
 *
 * Collection details are a paragraph, and the slots a date used to sit in — a
 * meta row, a stub header, a footer — hold one short line. The whole text is on
 * the listing's page; this is the part that fits.
 */
function firstLineOf(text: string): string {
  return text.split('\n').map((l) => l.trim()).find(Boolean) ?? '';
}

function venueDisplay(event: EventRow): string {
  return [event.venueName, event.city].filter(Boolean).join(', ');
}

/**
 * Two-tone wordmark for the masthead, from the same splitter the site logo uses.
 *
 * It used to match on /^(Nepali)(.+)$/ and fall back to flat white for anything
 * else, so a rename quietly lost the design in every email.
 */
function wordmarkHtml(): string {
  const { head, accent } = platformWordmark();
  const plain = `<span style="color:#ffffff;">${escapeHtml(head)}</span>`;
  if (!accent) return plain;
  return `${plain}<span style="color:${C.brandLight};">${escapeHtml(accent)}</span>`;
}

/**
 * The inbox preview line. The zero-width padding after it stops Gmail from
 * pulling the first paragraph in after the preheader.
 */
function preheaderHtml(text: string): string {
  const spacer = '&#847;&zwnj;&nbsp;'.repeat(60);
  return `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${C.canvas};opacity:0;">${escapeHtml(text)}${spacer}</div>`;
}

interface EmailDocument {
  /** Not shown in the inbox, but some clients use it as the window title. */
  title: string;
  preheader: string;
  kicker: string;
  headline: string;
  /** Event date / venue lines under the headline. */
  metaLines?: string[];
  bodyHtml: string;
  /** Small print at the bottom; the last line is dimmed further. */
  footerLines: string[];
}

/** Full document: dark brand band, crimson rule, white card, footer. */
function renderEmail(doc: EmailDocument): string {
  const meta = (doc.metaLines ?? []).filter(Boolean);
  const metaHtml = meta.length
    ? `<p class="muted" style="margin:12px 0 0;color:${C.muted};font-size:15px;line-height:1.55;">${meta
        .map((l) => escapeHtml(l))
        .join('<br>')}</p>`
    : '';
  const footerHtml = doc.footerLines
    .filter(Boolean)
    .map(
      (line, i) =>
        `<p class="muted" style="margin:${i ? '6px' : '0'} 0 0;color:${C.muted};font-size:12px;line-height:1.6;">${line}</p>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no,date=no,address=no,email=no">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${escapeHtml(doc.title)}</title>
<!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
<style>
  body,table,td,p,a,h1,h2{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;}
  table{border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;}
  img{border:0;line-height:100%;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;}
  a[x-apple-data-detectors]{color:inherit!important;text-decoration:none!important;font-size:inherit!important;font-family:inherit!important;font-weight:inherit!important;line-height:inherit!important;}
  @media only screen and (max-width:620px){
    .px{padding-left:20px!important;padding-right:20px!important;}
    .h1{font-size:23px!important;}
  }
  /* Dark mode is a courtesy, never load-bearing: the light styles above stay
     legible on their own if a client ignores this block. */
  @media (prefers-color-scheme:dark){
    .canvas{background-color:#080910!important;}
    .card{background-color:#15171f!important;border-color:#2b2f3d!important;}
    .ink,.h1{color:#f5f6fa!important;}
    .bodytext{color:#c9cddb!important;}
    .muted{color:#9aa1b3!important;}
    .panel{background-color:#1b1e28!important;border-color:#2f3342!important;}
    .foot{background-color:#101219!important;border-color:#2b2f3d!important;}
    .amber{background-color:#3a2b0b!important;border-color:#7d5f1c!important;}
    .amber-t{color:#ffdf9e!important;}
    /* Crimson is too dark to read on a dark card — every use carries this class. */
    .brandtext,.brandtext a{color:#ff8fa5!important;}
    /* A QR needs a white quiet zone — this cell must NOT follow the theme. */
    .qr{background-color:#ffffff!important;}
  }
  @media print{
    .no-print{display:none!important;}
    .canvas,.card,.foot,.panel{background-color:#ffffff!important;}
    .card{border:0!important;}
    .stub{page-break-inside:avoid;break-inside:avoid;}
  }
</style>
</head>
<body class="canvas" style="margin:0;padding:0;width:100%;background-color:${C.canvas};font-family:${FONT};">
${preheaderHtml(doc.preheader)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.canvas}" class="canvas" style="background-color:${C.canvas};">
  <tr>
    <td align="center" style="padding:24px 12px 32px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" class="card" style="width:100%;max-width:600px;background-color:${C.card};border:1px solid ${C.line};border-radius:14px;overflow:hidden;">
        <tr>
          <td class="px" bgcolor="${C.band}" style="background-color:${C.band};padding:20px 32px;">
            <span style="font-family:${FONT};font-size:18px;font-weight:800;letter-spacing:-0.01em;color:#ffffff;">${wordmarkHtml()}</span>
          </td>
        </tr>
        <tr>
          <td bgcolor="${C.brand}" style="height:4px;font-size:0;line-height:0;background-color:${C.brand};background-image:linear-gradient(90deg,${C.brand},${C.brandDeep} 55%,${C.brandBlue});">&nbsp;</td>
        </tr>
        <tr>
          <td class="px" style="padding:30px 32px 0;">
            <p class="brandtext" style="margin:0;color:${C.brand};font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;">${escapeHtml(doc.kicker)}</p>
            <h1 class="h1 ink" style="margin:8px 0 0;color:${C.ink};font-size:27px;line-height:1.22;font-weight:800;letter-spacing:-0.02em;">${escapeHtml(doc.headline)}</h1>
            ${metaHtml}
          </td>
        </tr>
        <tr>
          <td class="px bodytext" style="padding:24px 32px 32px;color:${C.body};font-size:16px;line-height:1.6;">${doc.bodyHtml}</td>
        </tr>
        <tr>
          <td class="px foot" bgcolor="${C.panel}" style="padding:20px 32px;background-color:${C.panel};border-top:1px solid ${C.line};">${footerHtml}</td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

/**
 * Bulletproof button: colour and padding live on the <td> (Word ignores both on
 * an <a>), the label is a padded inline-block for everyone else, and the box is
 * ~52px tall so a thumb can hit it.
 */
function buttonHtml(href: string, label: string): string {
  return `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" class="no-print" style="margin:8px auto 0;">
        <tr>
          <td align="center" bgcolor="${C.button}" style="border-radius:10px;background-color:${C.button};background-image:linear-gradient(135deg,${C.button},${C.brandDeep});mso-padding-alt:16px 30px;">
            <a href="${escapeHtml(href)}" style="display:inline-block;padding:16px 30px;font-family:${FONT};font-size:16px;line-height:20px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">${escapeHtml(label)}</a>
          </td>
        </tr>
      </table>`;
}

/** Caption under a button ("that page is also where you print them"). */
function buttonNoteHtml(text: string): string {
  return `<p class="muted no-print" style="margin:10px 0 0;text-align:center;color:${C.muted};font-size:13px;line-height:1.5;">${text}</p>`;
}

interface DetailRow {
  label: string;
  /** Plain text, escaped for you. Ignored when valueHtml is given. */
  value?: string;
  valueHtml?: string;
  /** IBANs, references and codes: monospace so digits can be read back. */
  mono?: boolean;
}

/**
 * Label above value, one per line. Deliberately NOT a two-column layout: an
 * IBAN in a right-aligned cell pushes a phone-width mail into sideways
 * scrolling, which is exactly what the old bank box did.
 */
function detailRowsHtml(rows: DetailRow[]): string {
  return rows
    .map((row, i) => {
      const value = row.valueHtml ?? escapeHtml(row.value ?? '');
      const valueStyle = row.mono
        ? `font-family:${MONO};font-size:16px;font-weight:700;letter-spacing:0.03em;`
        : 'font-size:16px;font-weight:600;';
      return `
        <tr>
          <td style="padding:${i ? '12px' : '4px'} 20px 12px;${i ? `border-top:1px solid ${C.line};` : ''}">
            <p class="muted" style="margin:0;color:${C.muted};font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;">${escapeHtml(row.label)}</p>
            <p class="ink" style="margin:4px 0 0;color:${C.ink};${valueStyle}line-height:1.45;word-break:break-word;">${value}</p>
          </td>
        </tr>`;
    })
    .join('');
}

/** Soft panel wrapper for detail rows / amounts. */
function panelHtml(innerHtml: string): string {
  return `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="panel" bgcolor="${C.panel}" style="margin:0 0 18px;background-color:${C.panel};border:1px solid ${C.line};border-radius:12px;">
        ${innerHtml}
      </table>`;
}

/**
 * The headline figure of a money mail.
 *
 * The rule underneath separates it from the account rows below. Pass rule=false
 * when there are none — a PayPal-only order prints no bank panel, and the rule
 * would then float as a hairline across an otherwise empty card.
 */
function amountRowHtml(caption: string, amount: string, rule = true): string {
  return `
        <tr>
          <td align="center" style="padding:20px 20px 16px;${rule ? `border-bottom:1px solid ${C.line};` : ''}">
            <p class="muted" style="margin:0;color:${C.muted};font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;">${escapeHtml(caption)}</p>
            <p class="ink" style="margin:6px 0 0;color:${C.ink};font-size:34px;line-height:1.15;font-weight:800;letter-spacing:-0.02em;">${escapeHtml(amount)}</p>
          </td>
        </tr>`;
}

/** Someone else's words, quoted back. Neutral panel with a brand rule. */
function quoteHtml(captionHtml: string, innerHtml: string): string {
  return `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="panel" bgcolor="${C.panel}" style="margin:0 0 18px;background-color:${C.panel};border:1px solid ${C.line};border-left:4px solid ${C.brand};border-radius:0 12px 12px 0;">
        <tr>
          <td class="bodytext" style="padding:16px 20px;color:${C.body};font-size:15px;line-height:1.6;">
            <p class="muted" style="margin:0 0 8px;color:${C.muted};font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;">${captionHtml}</p>
            ${innerHtml}
          </td>
        </tr>
      </table>`;
}

/** Amber callout — the one line in a mail that must not be skimmed past. */
function calloutHtml(innerHtml: string): string {
  return `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="amber" bgcolor="${C.amberBg}" style="margin:0 0 18px;background-color:${C.amberBg};border:1px solid ${C.amberLine};border-radius:12px;">
        <tr>
          <td class="amber-t" style="padding:16px 18px;color:${C.amberInk};font-size:15px;line-height:1.55;">${innerHtml}</td>
        </tr>
      </table>`;
}

/** The payment reference / Verwendungszweck, given its own loud box. */
function referenceBoxHtml(caption: string, reference: string, noteHtml: string): string {
  return `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="amber" bgcolor="${C.amberBg}" style="margin:0 0 18px;background-color:${C.amberBg};border:1px solid ${C.amberLine};border-radius:12px;">
        <tr>
          <td align="center" class="amber-t" style="padding:18px;color:${C.amberInk};">
            <p class="amber-t" style="margin:0;color:${C.amberInk};font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;">${escapeHtml(caption)}</p>
            <p class="amber-t" style="margin:8px 0 10px;font-family:${MONO};font-size:22px;line-height:1.3;font-weight:700;letter-spacing:0.05em;color:${C.amberInk};word-break:break-all;">${escapeHtml(reference)}</p>
            <p class="amber-t" style="margin:0;color:${C.amberInk};font-size:14px;line-height:1.55;">${noteHtml}</p>
          </td>
        </tr>
      </table>`;
}

/** Body paragraph. */
function pHtml(innerHtml: string, marginBottom = 16): string {
  return `<p class="bodytext" style="margin:0 0 ${marginBottom}px;color:${C.body};font-size:16px;line-height:1.6;">${innerHtml}</p>`;
}

/** Closing small print inside the body. */
function smallHtml(innerHtml: string): string {
  return `<p class="muted" style="margin:18px 0 0;color:${C.muted};font-size:13px;line-height:1.6;">${innerHtml}</p>`;
}

function strong(text: string): string {
  return `<strong class="ink" style="color:${C.ink};">${escapeHtml(text)}</strong>`;
}

// ---------------------------------------------------------------------------
// Plain-text twin. Every mail sends one: it is what screen readers, watches and
// text-only clients get, and a mail with no text/plain part scores worse with
// spam filters.
// ---------------------------------------------------------------------------

/** Hard-wrap prose so no line runs past a narrow terminal or watch screen. */
function wrapText(s: string, width = 72): string {
  const out: string[] = [];
  for (const paragraph of s.split('\n')) {
    let line = '';
    for (const word of paragraph.split(' ')) {
      if (line && line.length + 1 + word.length > width) {
        out.push(line);
        line = word;
      } else {
        line = line ? `${line} ${word}` : word;
      }
    }
    out.push(line);
  }
  return out.join('\n');
}

/** Same skeleton as the HTML: title, context, body, footer. */
function renderText(opts: { headline: string; context?: string[]; lines: string[]; footer?: string[] }): string {
  const rule = '-'.repeat(60);
  const context = (opts.context ?? []).filter(Boolean);
  const footer = (opts.footer ?? []).filter(Boolean);
  return [
    platformName().toUpperCase(),
    rule,
    opts.headline,
    ...(context.length ? context : []),
    '',
    ...opts.lines,
    '',
    rule,
    ...footer,
  ]
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd();
}

/** "Label:  value" lines, aligned, for bank details in the text part. */
function textRows(rows: Array<[string, string]>): string[] {
  const width = Math.max(...rows.map(([label]) => label.length)) + 2;
  return rows.map(([label, value]) => `  ${(label + ':').padEnd(width)}${value}`);
}

/**
 * A bank-payment GiroCode for email.
 *
 * Email clients commonly strip data: image URLs, so this deliberately returns
 * raw PNG bytes for a cid: inline attachment, just like the ticket QR codes.
 * Failure is non-fatal: the written IBAN, amount and reference remain the
 * authoritative payment instructions.
 */
async function bankPaymentQrPng(payload: string | null): Promise<Buffer | null> {
  if (!payload) return null;
  try {
    return await QRCode.toBuffer(payload, {
      type: 'png',
      width: 720,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000ff', light: '#ffffffff' },
    });
  } catch {
    return null;
  }
}

/** Email-client-safe presentation for the bank-app GiroCode. */
function bankPaymentQrHtml(cid: string, amount: string, reference: string): string {
  return `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="card" bgcolor="${C.card}" style="margin:20px 0;background-color:${C.card};border:1px solid ${C.line};border-radius:14px;">
        <tr>
          <td align="center" style="padding:20px 18px;">
            <p class="ink" style="margin:0 0 12px;color:${C.ink};font-size:18px;font-weight:800;line-height:1.35;">Scan with your banking app</p>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="background-color:#ffffff;border:1px solid ${C.line};border-radius:10px;">
              <tr>
                <td bgcolor="#ffffff" style="padding:10px;background-color:#ffffff;line-height:0;">
                  <img src="cid:${escapeHtml(cid)}" width="240" height="240" alt="Bank payment QR code for ${escapeHtml(amount)} with reference ${escapeHtml(reference)}" style="display:block;width:240px;max-width:100%;height:auto;background-color:#ffffff;">
                </td>
              </tr>
            </table>
            <p class="muted" style="margin:12px 0 0;color:${C.muted};font-size:13px;line-height:1.55;">It fills in the organizer&rsquo;s account, ${escapeHtml(amount)}, and reference <strong>${escapeHtml(reference)}</strong>. Check the details in your bank before confirming.</p>
            <p class="muted" style="margin:6px 0 0;color:${C.muted};font-size:12px;line-height:1.5;">Reading this on the same phone? Save or screenshot the QR and import it in your banking app, if your app supports payment from a photo.</p>
          </td>
        </tr>
      </table>`;
}

// ---------------------------------------------------------------------------
// Ticket email (order is PAID — QR tickets exist)
// ---------------------------------------------------------------------------

/**
 * PNG of the ticket code for embedding. Generated here rather than through
 * tickets.ticketQrDataUrl() because mail needs raw bytes (not a data URL, which
 * Gmail and Outlook both refuse in <img src>) and a much larger pixel size, so
 * the code still scans after the mail is printed on paper.
 */
async function ticketQrPng(code: string): Promise<Buffer> {
  return QRCode.toBuffer(code, {
    type: 'png',
    width: 660,
    margin: 1,
    errorCorrectionLevel: 'M',
    color: { dark: '#000000ff', light: '#ffffffff' },
  });
}

/**
 * One ticket, laid out like a stub. It repeats the event and the buyer so a
 * single printed stub, cut out of the page, still says what it is good for.
 */
function ticketStubHtml(opts: {
  index: number;
  total: number;
  code: string;
  cid: string;
  tierName: string;
  buyerName: string;
  eventName: string;
  when: string;
  /** "Ticket" or "Collection code" — what this stub is, per lib/vocab. */
  unitLabel: string;
  /**
   * What this one stub buys: "Admits one person" / "Covers one item".
   *
   * Passed in rather than looked up, because it is a whole sentence and not a
   * noun — the same split sendTicketEmail already makes for its closing line,
   * and lib/vocab deliberately holds words, not prose.
   */
  goodFor: string;
}): string {
  const position =
    opts.total > 1 ? `${opts.unitLabel} ${opts.index} of ${opts.total}` : `Your ${opts.unitLabel.toLowerCase()}`;
  return `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="card stub" bgcolor="${C.card}" style="margin:0 0 16px;background-color:${C.card};border:1px solid ${C.line};border-radius:14px;">
        <tr>
          <td class="panel" bgcolor="${C.panel}" style="padding:11px 18px;background-color:${C.panel};border-bottom:1px solid ${C.line};border-radius:14px 14px 0 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td class="brandtext" style="color:${C.brand};font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;">${escapeHtml(position)}</td>
                <td align="right" class="ink" style="color:${C.ink};font-size:14px;font-weight:700;">${escapeHtml(opts.tierName)}</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:20px 12px 8px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" class="qr" bgcolor="#ffffff" style="background-color:#ffffff;border:1px solid ${C.line};border-radius:10px;">
              <tr>
                <td class="qr" bgcolor="#ffffff" style="padding:10px;background-color:#ffffff;line-height:0;">
                  <img src="cid:${escapeHtml(opts.cid)}" width="200" height="200" alt="QR code for ${escapeHtml(opts.unitLabel.toLowerCase())} ${escapeHtml(opts.code)}" style="display:block;width:200px;max-width:100%;height:auto;background-color:#ffffff;">
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:4px 18px 20px;">
            <p class="ink" style="margin:0;font-family:${MONO};font-size:24px;line-height:1.2;font-weight:700;letter-spacing:0.12em;color:${C.ink};">${escapeHtml(opts.code)}</p>
            <p class="ink" style="margin:10px 0 0;color:${C.ink};font-size:15px;font-weight:700;line-height:1.45;">${escapeHtml(opts.eventName)}</p>
            <p class="muted" style="margin:2px 0 0;color:${C.muted};font-size:13px;line-height:1.5;">${escapeHtml(opts.when)}</p>
            <p class="muted" style="margin:6px 0 0;color:${C.muted};font-size:13px;line-height:1.5;">${escapeHtml(opts.goodFor)} · ${escapeHtml(opts.buyerName)}</p>
          </td>
        </tr>
      </table>`;
}

/**
 * Send the buyer their tickets for a PAID order. Never throws — payment flow
 * must not fail because email is down or unconfigured.
 */
export async function sendTicketEmail(
  orderId: string
): Promise<{ sent: boolean; reason?: string; detail?: string }> {
  try {
    if (!isEmailConfigured()) return { sent: false, reason: 'email-not-configured' };

    const order = getOrder(orderId);
    if (!order) return { sent: false, reason: 'order-not-found' };
    if (order.status !== 'paid') return { sent: false, reason: 'order-not-paid' };
    // The retention sweep replaces erased addresses with a reserved-.invalid
    // one that can never be delivered to. Refusing here beats letting the
    // transporter hard-bounce against a sending domain still earning trust.
    if (order.buyerErasedAt || order.buyerEmail.trim().toLowerCase().endsWith('.invalid')) {
      return { sent: false, reason: 'address-erased' };
    }

    const tickets = getTicketsForOrder(orderId);
    if (tickets.length === 0) return { sent: false, reason: 'no-tickets' };

    const event = getEventById(order.eventId);
    if (!event) return { sent: false, reason: 'event-not-found' };
    const venue = venueDisplay(event);
    // A shop's buyer is being told to come and collect, not to turn up at a
    // show — same QR, same scan, different sentence around it.
    const v = vocabFor(event.kind);
    const isShop = event.kind === 'shop';
    const whenLine = isShop ? firstLineOf(event.pickupInfo) : event.dateDisplay;
    const items = getOrderItems(orderId);
    const hasStudentTickets = items.some((it) => getEventTier(event.id, it.tierId)?.studentOnly === true);
    // Carries the order access token, and this is the one place that token is
    // ever handed out: the mail goes TO order.buyer_email, so a reader holding
    // this link has proved they read that mailbox — which is what unlocks the
    // buyer's vouchers and card code on the order page (lib/buyerAccount.ts).
    // A link built any other way must stay the bare /order/<id>.
    const orderUrl = orderUrlForBuyerEmail(orderId);
    const tierName = (tierId: string) => getEventTier(event.id, tierId)?.name ?? tierId;
    const total = formatMoney(order.totalCents, order.currency);
    const one = tickets.length === 1;
    // Bundle-aware order line: the stubs below list every code, but a buyer of
    // "2× Table of 8" needs the sentence connecting two bookings to sixteen
    // codes — without it the mail looks like it minted fourteen too many.
    const hasBundle = items.some((it) => (getEventTier(event.id, it.tierId)?.seatsPerUnit ?? 1) > 1);
    const itemsLine = items.map((it) => `${it.quantity}× ${tierName(it.tierId)}`).join(', ');
    // Who confirmed the payment and issued these codes. The buyer paid the
    // organizer's own account, and the organizer marked it received — this mail
    // used to say only "payment received", which read as if the platform had
    // taken the money. Falls back to "The organizer" when the account is gone.
    const organizerName = organizerDisplayName(event.organizerId);
    const confirmedBy = organizerName || 'The organizer';

    // Each QR rides along as an inline attachment: a data: URL would be
    // stripped by Gmail and Outlook, and a linked image would need the buyer to
    // be online at the door.
    const attachments = await Promise.all(
      tickets.map(async (t) => ({
        filename: `ticket-${t.code}.png`,
        content: await ticketQrPng(t.code),
        cid: `qr-${t.code.toLowerCase()}@tickets`,
        contentType: 'image/png',
        contentDisposition: 'inline' as const,
      }))
    );

    const stubsHtml = tickets
      .map((t, i) =>
        ticketStubHtml({
          index: i + 1,
          total: tickets.length,
          code: t.code,
          cid: attachments[i].cid,
          tierName: tierName(t.tierId),
          buyerName: order.buyerName,
          eventName: event.name,
          when: whenLine,
          unitLabel: v.Code,
          goodFor: isShop ? 'Covers one item' : 'Admits one person',
        })
      )
      .join('');

    const ticketCount = one
      ? `Your ${v.code} is`
      : tickets.length === 2
        ? `Both ${v.codes} are`
        : `All ${tickets.length} ${v.codes} are`;
    // A zero-total order was never paid for — it is a confirmed reservation,
    // and thanking someone for a payment they did not make reads like a
    // mistake on exactly the email they might forward around.
    const isFreeOrder = order.totalCents === 0;
    // The share link the order page also offers: no number, so WhatsApp's own
    // picker chooses the group. The buyer holding fresh codes is the single
    // best moment to ask, and an email survives to be re-found later.
    //
    // ?ref= is this buyer's own referral code (the order's random share_code —
    // see lib/orders referralCode — NEVER the payment reference's short id,
    // which support treats as weak proof of owning the order and so must not
    // be broadcast), so the organizer's insights can see who brought friends.
    // Analysis only, no reward. Pre-share_code orders have no code — their
    // link simply carries no ref. The TEXT here and on the order page must
    // stay word-for-word identical — change one, change both.
    const refCode = referralCode(order);
    const shareEventUrl = `${getBaseUrl()}/e/${event.slug}${refCode ? `?ref=${refCode}` : ''}`;
    const shareUrl =
      event.status === 'published'
        ? whatsappShareUrl(
            isFreeOrder
              ? `I'm going to ${event.name} — it's free! Reserve your spot: ${shareEventUrl}`
              : `I just got my tickets for ${event.name}! Get yours: ${shareEventUrl}`
          )
        : null;
    const bodyHtml =
      pHtml(`Hi ${escapeHtml(order.buyerName)},`) +
      pHtml(
        (isFreeOrder
          ? `You're on the list! ${ticketCount} below. `
          : `${escapeHtml(confirmedBy)}${organizerName ? ', the organizer,' : ''} has confirmed your payment — ` +
            `thank you! ${ticketCount} below. `) +
          (isShop
            ? `Show the QR code when you collect and your order is handed over.`
            : `Show the QR code at the door, we scan it, and you are in.`),
        20
      ) +
      (hasBundle
        ? pHtml(
            `Your order: ${escapeHtml(itemsLine)} — ${tickets.length} QR ${tickets.length === 1 ? v.code : v.codes} in total.`,
            20
          )
        : '') +
      stubsHtml +
      (isFreeOrder ? '' : pHtml(`Total paid: ${strong(total)}`, 20)) +
      buttonHtml(orderUrl, `Open your ${one ? v.code : v.codes} online`) +
      (shareUrl
        ? smallHtml(
            `Going with friends? <a href="${escapeHtml(shareUrl)}" style="color:${C.brandDeep};font-weight:700;">Share ${escapeHtml(event.name)} on WhatsApp</a> — it takes one tap.`
          )
        : '') +
      buttonNoteHtml(`Same ${v.codes}, always up to date — handy for printing or if this email gets lost.`) +
      (hasStudentTickets
        ? `<div style="margin-top:20px;">${calloutHtml(
            `<strong>Student ticket${one ? '' : 's'}:</strong> bring a valid student ID for each student ticket. ` +
              `It is checked at the door.`
          )}</div>`
        : '') +
      // The one moment a review can honestly be asked for.
      //
      // Nothing else on the site ever invites one, so the review system has
      // been sitting there waiting for buyers who had no reason to come back:
      // the order page is somewhere people go BEFORE they pay, not after they
      // have eaten. This mail already goes to the buyer's own address and
      // already carries the access token that is the entire right to write one
      // — so the ask costs no new email, no schedule and nothing to
      // unsubscribe from.
      //
      // Shops only, and worded for AFTER collection. An event has no item to
      // review, and asking somebody to rate food they have not picked up yet
      // is how a bazaar fills with reviews of an unopened parcel.
      // …and only when the link can actually deliver it. The review form on the
      // order page appears for a reader holding the access token and nobody
      // else, and that token does not exist on a deployment with no APP_SECRET
      // (orderUrlForBuyerEmail then returns the bare path). Inviting somebody
      // to say how it was and landing them on a page with no form is a worse
      // outcome than never asking.
      (isShop && orderUrl.includes('token=')
        ? smallHtml(
            `Once you have collected and tried it, <a href="${escapeHtml(orderUrl)}#review" style="color:${C.brandDeep};font-weight:700;">say how it was</a>. ` +
              `Only people who actually ordered can, so a few honest words are worth more here than anywhere else — and they help ${escapeHtml(organizerName || 'the seller')} more than anything else you could do.`
          )
        : '') +
      smallHtml(
        (isShop
          ? `Each code covers one item and can be scanned once. A screenshot works just as well as paper — ` +
            `just make sure the code is sharp. See you at collection!`
          : `Each ticket admits one person and can be scanned once. A screenshot works just as well as paper — ` +
            `just make sure the code is sharp. See you at the show!`)
      );

    const html = renderEmail({
      title: `Your ${one ? v.code : v.codes} for ${event.name}`,
      preheader:
        `${isFreeOrder ? 'Reservation confirmed.' : 'Payment confirmed.'} ${one ? `Your QR ${v.code} is` : `Your ${tickets.length} QR ${v.codes} are`} in this email — ` +
        `show ${one ? 'it' : 'them'} at ${v.where}.`,
      kicker: isFreeOrder ? 'Reservation confirmed' : 'Payment confirmed',
      headline: event.name,
      metaLines: [whenLine, venue],
      bodyHtml,
      footerLines: [
        `${escapeHtml(event.name)}${whenLine ? ` · ${escapeHtml(whenLine)}` : ''}`,
        escapeHtml(venue),
        `Order ${escapeHtml(orderId)}`,
        `You are getting this because you ordered on ${escapeHtml(platformName())}.`,
      ],
    });

    const text = renderText({
      headline: isFreeOrder
        ? `You're on the list, ${order.buyerName}!`
        : `Payment confirmed — thank you, ${order.buyerName}!`,
      context: [event.name, whenLine, venue],
      lines: [
        wrapText(
          (isFreeOrder ? '' : `${confirmedBy}${organizerName ? ', the organizer,' : ''} has confirmed your payment. `) +
            `${ticketCount} listed below. The QR codes are in the HTML version of this email — if you ` +
            `cannot see them, open your order page and show the code there.`
        ),
        ...(hasBundle
          ? [
              '',
              wrapText(
                `Your order: ${itemsLine} — ${tickets.length} QR ${tickets.length === 1 ? v.code : v.codes} in total.`
              ),
            ]
          : []),
        '',
        ...tickets.flatMap((t, i) => [
          tickets.length > 1
            ? `${v.Code.toUpperCase()} ${i + 1} OF ${tickets.length}`
            : `YOUR ${v.Code.toUpperCase()}`,
          ...textRows([
            ['Code', t.code],
            ['Type', tierName(t.tierId)],
          ]),
          '',
        ]),
        ...(isFreeOrder ? [] : [`Total paid: ${total}`, '']),
        `Your ${v.codes}: ${orderUrl}`,
        '',
        ...(isShop && orderUrl.includes('token=')
          ? [
              wrapText(
                `Once you have collected and tried it, say how it was: ${orderUrl}#review — only people ` +
                  `who actually ordered can leave a review, so a few honest words are worth more here ` +
                  `than anywhere else.`
              ),
              '',
            ]
          : []),
        wrapText(
          isShop
            ? 'Each code covers one item and can be scanned once. A screenshot works just as ' +
              'well as paper — just make sure the code is sharp.'
            : 'Each ticket admits one person and can be scanned once. A screenshot works just as ' +
              'well as paper — just make sure the code is sharp.'
        ),
        ...(hasStudentTickets
          ? [
              '',
              wrapText(
                'STUDENT TICKETS: bring a valid student ID for each student ticket. It is checked at the door.'
              ),
            ]
          : []),
      ],
      footer: [[event.name, whenLine, venue].filter(Boolean).join(' · '), `Order ${orderId}`],
    });

    const mailed = await sendMailAs('buyers', {
      replyTo: replyToBuyers(),
      to: order.buyerEmail,
      subject: `Your ${one ? v.code : `${tickets.length} ${v.codes}`} for ${event.name}`,
      text,
      html,
      attachments,
    });
    if (!mailed.sent) return mailed;

    return { sent: true };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error('[email] Failed to send ticket email:', detail);
    // `reason` stays the stable code other callers branch on (the reminder sweep
    // treats anything other than 'send-failed' as permanent). `detail` carries
    // what the mail server actually said, for the admin who has to fix it —
    // "send-failed" in a tooltip is not a diagnosis.
    return { sent: false, reason: 'send-failed', detail };
  }
}

// ---------------------------------------------------------------------------
// Payment instructions email (order is CLAIMED — seats reserved)
// Bank transfer, PayPal, or both — whichever routes the organizer offers.
// ---------------------------------------------------------------------------

/** What the PayPal note needs to know beyond the payee itself. */
interface PaypalNoteOpts {
  reference: string;
  amount: string;
  /** "tickets" / "collection codes" — what arrives once the money is confirmed. */
  codes: string;
  /** Is a bank account shown alongside? Decides whether this is A route or THE route. */
  alsoBank: boolean;
}

/**
 * The "you can also use PayPal" line, for buyer mails that print payment details.
 *
 * Deliberately a note beside the bank panel rather than a second panel of its
 * own: it is the same amount, to the same person, with the same reference —
 * only the pipe differs. Returns '' when the organizer offers no PayPal, so
 * every call site can concatenate it unconditionally.
 */
function paypalNoteHtml(payee: PaypalPayee | null, opts: PaypalNoteOpts): string {
  if (!payee) return '';
  // GREEN, and placed ABOVE the bank panel at every call site: PayPal clears in
  // seconds where a transfer takes 1-2 business days, so the buyer who takes
  // this route has their QR codes the same evening. Green marks the FAST one,
  // not one anyone profits from — the money reaches the organizer either way
  // and the platform takes nothing from ticket sales.
  //
  // Its own table rather than calloutHtml(), which is amber and reads as a
  // warning. Inline styles because email clients discard stylesheets.
  //
  // Its own bold rather than strong(), for two reasons that both bit here.
  // strong() escapes what it is given, so the old strong(escapeHtml(handle))
  // escaped twice: "Ram&Sons" rendered as "Ram&amp;Sons" and buyers copied a
  // broken handle into PayPal while the plain-text twin showed the real one.
  // And strong() paints near-black ink, which is the file's rule for a light
  // card and unreadable on this dark green one — the three values a buyer has
  // to read were the three least legible words in the mail.
  const bold = (text: string) => `<strong style="color:#ffffff;">${escapeHtml(text)}</strong>`;
  return `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0f2a20" style="margin:0 0 18px;background-color:#0f2a20;border:1px solid #34d399;border-left:4px solid #34d399;border-radius:12px;">
        <tr>
          <td style="padding:16px 18px;color:#d1fae5;font-size:15px;line-height:1.55;">
            <span style="color:#34d399;font-weight:800;">${opts.alsoBank ? 'Fastest: pay by PayPal' : 'Pay by PayPal'}</span><br>
            Send ${bold(payee.handle)} ${bold(opts.amount)} and put
            ${bold(opts.reference)} in PayPal&#39;s message field. It arrives in seconds,
            so the organizer can confirm your payment and your QR ${escapeHtml(opts.codes)} go out straight away${
              opts.alsoBank
                ? ` — a bank transfer takes 1&ndash;2 business days. It reaches the same organizer either
            way: pay one way or the other, not both.`
                : '.'
            }
          </td>
        </tr>
      </table>`;
}

/** Plain-text twin of paypalNoteHtml. Empty array when there is no PayPal. */
function paypalNoteText(payee: PaypalPayee | null, opts: PaypalNoteOpts): string[] {
  if (!payee) return [];
  return [
    '',
    opts.alsoBank ? 'FASTEST: PAY BY PAYPAL' : 'PAY BY PAYPAL',
    wrapText(
      `Send ${payee.handle} ${opts.amount} and put ${opts.reference} in PayPal's message ` +
        `field. It arrives in seconds, so the organizer can confirm your payment and your QR ` +
        `${opts.codes} go out straight away` +
        (opts.alsoBank
          ? ` — a bank transfer takes 1-2 business days. It reaches the same organizer either ` +
            `way: pay one way or the other, not both.`
          : '.')
    ),
  ];
}

/**
 * Send payment instructions for a freshly reserved order — bank transfer, or
 * PayPal, or both, whichever routes the organizer actually offers.
 * Never throws — the buyer sees the same instructions on the order page.
 */
export async function sendTransferInstructionsEmail(
  orderId: string
): Promise<{ sent: boolean; reason?: string }> {
  try {
    if (!isEmailConfigured()) return { sent: false, reason: 'email-not-configured' };

    const order = getOrder(orderId);
    if (!order) return { sent: false, reason: 'order-not-found' };
    if (order.paymentMode !== 'transfer' || order.status !== 'claimed') {
      return { sent: false, reason: 'order-not-awaiting-transfer' };
    }
    const event = getEventById(order.eventId);
    if (!event) return { sent: false, reason: 'event-not-found' };
    // What THIS order was told to pay, frozen at creation — never the event's
    // current details. A mail is a promise in writing; re-reading the event
    // would let a later edit change what an already-issued instruction says.
    const payout = orderPayout(order, event);
    // From the order's own snapshot, exactly like the bank rows beside it — the
    // two must describe the same moment, or an organizer who later added PayPal
    // would have it offered on instructions that never mentioned it.
    const payee = paypalPayee({ paypalAccount: payout.paypal });
    const offersPaypal = payee !== null;
    // A bank account is one route, not the only one. This used to refuse
    // outright without an IBAN, which made a PayPal-only organizer unsellable:
    // the checkout offered "Reserve — pay by PayPal", the order was created, and
    // the buyer's instructions were then silently never sent. What must still be
    // true is that SOME route exists — both halves of the account together, or
    // PayPal — otherwise there is nothing to tell the buyer to do.
    const bank =
      payout.iban.trim() && payout.holder.trim()
        ? {
            accountHolder: payout.holder,
            iban: payout.iban,
            bic: payout.bic,
            bankName: payout.bankName,
          }
        : null;
    if (!bank && !offersPaypal) {
      return { sent: false, reason: 'transfer-not-configured' };
    }

    // Whose account this is. The panel below prints an IBAN with no story
    // around it, and the story matters: the buyer is paying the ORGANIZER's own
    // account and buying from them — the platform never touches the money. The
    // mail has to say so, plainly, before it asks anyone to transfer anything.
    const organizerName = organizerDisplayName(event.organizerId);
    // A shop's buyer is not going to an "event" — same seller story, its own noun.
    const sellerRole = event.kind === 'shop' ? 'the seller behind this shop' : 'the organizer of this event';
    const sellerIntroHtml = organizerName
      ? `You are buying from ${strong(organizerName)}, ${sellerRole}`
      : `You are buying from ${event.kind === 'shop' ? 'the seller behind' : 'the organizer of'} ${strong(event.name)}`;
    const sellerIntroText = organizerName
      ? `You are buying from ${organizerName}, ${sellerRole}`
      : `You are buying from ${event.kind === 'shop' ? 'the seller behind' : 'the organizer of'} ${event.name}`;

    const venue = venueDisplay(event);
    // Tokenized, for the same reason as the ticket mail: it is addressed to
    // order.buyer_email, so this link is proof of that mailbox. A buyer who
    // bookmarks it still has the working link once the order is paid.
    const orderUrl = orderUrlForBuyerEmail(orderId);
    const reference = paymentReference(orderId);
    const items = getOrderItems(orderId);
    const hasStudentTickets = items.some(
      (it) => getEventTier(event.id, it.tierId)?.studentOnly === true
    );
    // What is being held, bundle-aware: quantities count BOOKINGS, so a
    // "2× Table of 8" reservation says here that sixteen QR tickets come out
    // of it — this mail is the buyer's receipt-in-waiting and must not leave
    // that number to be discovered at the door.
    const v = vocabFor(event.kind);
    // Same pair sendTicketEmail uses: a shop's buyer is collecting from a
    // counter, not turning up at a show on a date, and a shop need not have a
    // date at all — so the slot a date sits in holds the collection line.
    const isShop = event.kind === 'shop';
    const whenLine = isShop ? firstLineOf(event.pickupInfo) : event.dateDisplay;
    const tierOf = (tierId: string) => getEventTier(event.id, tierId);
    const totalTickets = items.reduce(
      (s, it) => s + it.quantity * (tierOf(it.tierId)?.seatsPerUnit ?? 1),
      0
    );
    const itemsLine = items
      .map((it) => `${it.quantity}× ${tierOf(it.tierId)?.name ?? it.tierId}`)
      .join(', ');
    const amount = formatMoney(order.totalCents, order.currency);
    // A GiroCode is a BANK payment — nothing to encode when there is no account.
    const paymentQrCid = `bank-payment-${orderId.toLowerCase()}@tickets`;
    const paymentQrPng = bank
      ? await bankPaymentQrPng(
          girocodePayload({
            accountHolder: bank.accountHolder,
            iban: bank.iban,
            bic: bank.bic,
            amountCents: order.totalCents,
            currency: order.currency,
            reference,
          })
        )
      : null;
    const paymentQrAttachment = paymentQrPng
      ? {
          filename: `bank-payment-${orderId}.png`,
          content: paymentQrPng,
          cid: paymentQrCid,
          contentType: 'image/png',
          contentDisposition: 'inline' as const,
        }
      : null;
    const deadline = new Date(Date.parse(order.createdAt.replace(' ', 'T') + 'Z') + event.payWithinDays * 86_400_000);
    const deadlineDisplay = deadline.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    const bankRows: DetailRow[] = bank
      ? [
          { label: 'Account holder', value: bank.accountHolder },
          { label: 'IBAN', value: bank.iban, mono: true },
          ...(bank.bic ? [{ label: 'BIC', value: bank.bic, mono: true }] : []),
          ...(bank.bankName ? [{ label: 'Bank', value: bank.bankName }] : []),
        ]
      : [];

    // The two sentences with no vocab word of their own: what is being held for
    // this buyer, and what happens if they never pay. A shop holds stock, not
    // seats, and nothing about a counter is "a door".
    const heldSentence = isShop ? `Your ${v.units} are set aside` : 'Your seats are held';
    const releasedSentence = isShop ? `the ${v.units} go back on sale` : 'the seats go back on sale';
    // Where the reference has to be typed, which depends on the route the buyer
    // actually has. PayPal-only instructions must not send anyone hunting for a
    // "Verwendungszweck" field that is not in front of them.
    const referenceWhereHtml = bank
      ? `Put this in the transfer&#39;s purpose line (&quot;Verwendungszweck&quot;).`
      : `Put this in PayPal&#39;s message field.`;
    const referenceWhereText = bank
      ? `must go in the transfer's purpose line ("Verwendungszweck")`
      : `must go in PayPal's message field`;
    // How long the money takes, said honestly per route: PayPal is minutes, a
    // transfer is days, and promising the slower one to a PayPal-only buyer
    // makes them wait for a confirmation that already happened.
    const arrivalSentence = bank
      ? 'Once the money lands — usually one or two working days —'
      : 'Once the money lands — usually within minutes —';
    const payAction = offersPaypal ? 'send the money' : 'send a bank transfer';

    const bodyHtml =
      pHtml(`Hi ${escapeHtml(order.buyerName)},`) +
      pHtml(
        `${heldSentence}. To turn them into ${v.codes}, ${payAction} by ` +
          `${strong(deadlineDisplay)} — everything you need is here.`,
        20
      ) +
      pHtml(
        `${sellerIntroHtml} — the payment details below are their own, and your money goes straight to them.`,
        20
      ) +
      pHtml(
        `Your reservation: ${escapeHtml(itemsLine)} — ${totalTickets} QR ${totalTickets === 1 ? v.code : v.codes} once the payment is confirmed.`,
        20
      ) +
      paypalNoteHtml(payee, { reference, amount, codes: v.codes, alsoBank: bank !== null }) +
      panelHtml(
        amountRowHtml(bank ? 'Amount to transfer' : 'Amount to pay', amount, bank !== null) +
          detailRowsHtml(bankRows)
      ) +
      referenceBoxHtml(
        'Payment reference — required',
        reference,
        `${referenceWhereHtml} It is how your payment finds ` +
          `your ${escapeHtml(v.codes)}.${hasStudentTickets ? ` The <strong>S-</strong> marks an order with student ${escapeHtml(v.units)}.` : ''}`
      ) +
      (paymentQrAttachment ? bankPaymentQrHtml(paymentQrCid, amount, reference) : '') +
      pHtml(
        `${arrivalSentence} the organizer confirms your payment, and ` +
          `your QR ${escapeHtml(v.codes)} are emailed to you the moment they do. Nothing else to do.`,
        20
      ) +
      buttonHtml(orderUrl, 'View your order') +
      buttonNoteHtml(`Worth bookmarking: your ${v.codes} appear on that page too.`) +
      (hasStudentTickets
        ? `<div style="margin-top:20px;">${calloutHtml(
            `<strong>Student ${escapeHtml(v.units)}:</strong> bring a valid student ID for each student ` +
              `${escapeHtml(v.unit)}. It is checked at ${escapeHtml(v.where)}.`
          )}</div>`
        : '') +
      smallHtml(`If no payment arrives by ${escapeHtml(deadlineDisplay)}, ${escapeHtml(releasedSentence)}.`);

    const html = renderEmail({
      title: `Your ${v.units} for ${event.name} are reserved`,
      preheader: `Send ${amount} with reference ${reference} by ${deadlineDisplay} and your ${v.codes} are on their way.`,
      kicker: isShop ? `${v.Units} reserved` : 'Seats reserved',
      headline: event.name,
      metaLines: [whenLine, venue],
      bodyHtml,
      footerLines: [
        `${escapeHtml(event.name)}${whenLine ? ` · ${escapeHtml(whenLine)}` : ''}`,
        escapeHtml(venue),
        `Order ${escapeHtml(orderId)}`,
        `You are getting this because you reserved ${escapeHtml(v.units)} on ${escapeHtml(platformName())}.`,
      ],
    });

    const text = renderText({
      headline: `Your ${v.units} for ${event.name} are reserved, ${order.buyerName}!`,
      context: [whenLine, venue],
      lines: [
        wrapText(
          `${sellerIntroText} — the payment details below are their own, and your money goes straight to them.`
        ),
        '',
        wrapText(
          `Your reservation: ${itemsLine} — ${totalTickets} QR ${totalTickets === 1 ? v.code : v.codes} once the payment is confirmed.`
        ),
        '',
        wrapText(`To complete your order, ${payAction} by ${deadlineDisplay}:`),
        // Above the bank rows, matching the HTML. The plain-text twin used to
        // trail them, so the reader who gets text-only — which is every reader
        // whose client blocks HTML — was steered to the slower method by the
        // simple fact of it coming first.
        ...paypalNoteText(payee, { reference, amount, codes: v.codes, alsoBank: bank !== null }),
        '',
        ...textRows([
          ['Amount', amount],
          ...(bank
            ? ([
                ['Account holder', bank.accountHolder],
                ['IBAN', bank.iban],
                ...(bank.bic ? [['BIC', bank.bic]] : []),
                ...(bank.bankName ? [['Bank', bank.bankName]] : []),
              ] as Array<[string, string]>)
            : []),
          ['Reference', reference],
        ]),
        '',
        wrapText(
          `IMPORTANT: the reference ${reference} ${referenceWhereText}. It is how your payment ` +
            `finds your ${v.codes}.`
        ),
        ...(hasStudentTickets
          ? [
              '',
              wrapText(
                `The "S-" in your reference marks an order with student ${v.units}. Bring a valid ` +
                  `student ID for each of them — it is checked at ${v.where}.`
              ),
            ]
          : []),
        '',
        wrapText(
          `${arrivalSentence} the organizer confirms your payment, and your QR ${v.codes} are ` +
            `emailed to you the moment they do. Nothing else to do.`
        ),
        '',
        `Your order: ${orderUrl}`,
        '',
        wrapText(`If no payment arrives by ${deadlineDisplay}, ${releasedSentence}.`),
      ],
      footer: [[event.name, whenLine, venue].filter(Boolean).join(' · '), `Order ${orderId}`],
    });

    const mailed = await sendMailAs('buyers', {
      replyTo: replyToBuyers(),
      to: order.buyerEmail,
      subject: `Reserved: your ${v.units} for ${event.name} — payment details inside`,
      text,
      html,
      ...(paymentQrAttachment ? { attachments: [paymentQrAttachment] } : {}),
    });
    if (!mailed.sent) return mailed;

    return { sent: true };
  } catch (err) {
    console.error('[email] Failed to send transfer instructions:', err instanceof Error ? err.message : err);
    return { sent: false, reason: 'send-failed' };
  }
}

// ---------------- Organizer "check your bank account" reminders ----------------

export interface ReminderOrderSummary {
  orderId: string;
  eventName: string;
  buyerName: string;
  totalCents: number;
  currency: string;
  createdAt: string;
}

/** One waiting reservation. Two columns at most, so it holds up at 320px. */
function reservationRowHtml(o: ReminderOrderSummary, first: boolean): string {
  return `
        <tr>
          <td style="padding:14px 20px;${first ? '' : `border-top:1px solid ${C.line};`}">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="vertical-align:top;">
                  <p class="ink" style="margin:0;color:${C.ink};font-size:16px;font-weight:700;line-height:1.35;">${escapeHtml(o.buyerName)}</p>
                  <p class="muted" style="margin:3px 0 0;color:${C.muted};font-size:13px;line-height:1.45;">${escapeHtml(o.eventName)}</p>
                </td>
                <td align="right" class="ink" style="vertical-align:top;color:${C.ink};font-size:17px;font-weight:800;white-space:nowrap;padding-left:12px;">${escapeHtml(formatMoney(o.totalCents, o.currency))}</td>
              </tr>
              <tr>
                <td colspan="2" style="padding-top:8px;">
                  <span class="brandtext" style="font-family:${MONO};font-size:14px;font-weight:700;letter-spacing:0.04em;color:${C.brandDeep};word-break:break-all;">${escapeHtml(paymentReference(o.orderId))}</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>`;
}

/**
 * Digest reminding an organizer to check their bank statement for incoming
 * transfers and confirm arrived payments in the portal. Never throws.
 */
export async function sendTransferReminderEmail(
  organizer: { email: string; name: string },
  awaiting: ReminderOrderSummary[]
): Promise<{ sent: boolean; reason?: string }> {
  try {
    if (!isEmailConfigured()) return { sent: false, reason: 'email-not-configured' };
    if (awaiting.length === 0) return { sent: false, reason: 'nothing-awaiting' };

    const totalByCurrency = new Map<string, number>();
    for (const o of awaiting) {
      totalByCurrency.set(o.currency, (totalByCurrency.get(o.currency) ?? 0) + o.totalCents);
    }
    const totals = [...totalByCurrency.entries()]
      .map(([cur, cents]) => formatMoney(cents, cur))
      .join(' + ');
    const portalUrl = `${getBaseUrl()}/portal`;
    const one = awaiting.length === 1;

    const bodyHtml =
      pHtml(`Hi ${escapeHtml(organizer.name)},`) +
      pHtml(
        `${one ? 'One reservation is' : `${awaiting.length} reservations are`} waiting for a bank transfer — ` +
          `${strong(totals)} in total. Look for these references on your statement, then confirm ` +
          `${one ? 'it' : 'the ones that arrived'} in your portal so the ${one ? 'buyer gets their tickets' : 'buyers get their tickets'}.`,
        20
      ) +
      panelHtml(awaiting.map((o, i) => reservationRowHtml(o, i === 0)).join('')) +
      buttonHtml(portalUrl, 'Confirm payments in your portal') +
      smallHtml('You can change or switch off these reminders in your portal settings.');

    const html = renderEmail({
      title: 'Payments to confirm',
      preheader: `${one ? 'One reservation is' : `${awaiting.length} reservations are`} waiting — ${totals} expected.`,
      kicker: 'Payments to confirm',
      headline: 'Time to check your bank account',
      bodyHtml,
      footerLines: [
        `${escapeHtml(platformName())} · organizer portal`,
        'You are getting this because you have reservations awaiting a bank transfer.',
      ],
    });

    const text = renderText({
      headline: 'Time to check your bank account',
      lines: [
        `Hi ${organizer.name},`,
        '',
        wrapText(
          `${one ? 'One reservation is' : `${awaiting.length} reservations are`} waiting for a bank transfer — ` +
            `${totals} in total. Look for these references on your statement, then confirm the ones ` +
            `that arrived in your portal so the buyers get their tickets.`
        ),
        '',
        ...awaiting.flatMap((o) => [
          `  ${o.buyerName} · ${o.eventName}`,
          `  ${paymentReference(o.orderId)} · ${formatMoney(o.totalCents, o.currency)}`,
          '',
        ]),
        `Your portal: ${portalUrl}`,
      ],
      footer: ['You can change or switch off these reminders in your portal settings.'],
    });

    const mailed = await sendMailAs('organizers', {
      replyTo: replyToOrganizers(),
      to: organizer.email,
      subject: `${awaiting.length} payment${one ? '' : 's'} to check — ${totals} expected`,
      text,
      html,
    });
    if (!mailed.sent) return mailed;
    return { sent: true };
  } catch (err) {
    console.error('[email] Failed to send transfer reminder:', err instanceof Error ? err.message : err);
    return { sent: false, reason: 'send-failed' };
  }
}

// ---------------------------------------------------------------------------
// Organizer account emails (organizer ← platform owner)
//
// There used to be fee-instruction mails here too — the per-event fee, the
// platform's own IBAN, an EVENT- Verwendungszweck. The platform is free while
// it grows, so those mails are gone and no email names a price anywhere.
// ---------------------------------------------------------------------------

export interface OrganizerContact {
  name: string;
  email: string;
}

/**
 * The one mail that turns an approved application into an account: their
 * sign-in email and a temporary password the platform generated for them.
 *
 * This is the ONLY place a password is ever written down, and it goes to the
 * address the applicant themselves gave us — never logged, never stored in
 * plain text, and dead the moment they change it (which they are forced to do
 * on the way in). Never throws.
 */
export async function sendOrganizerCredentialsEmail(
  organizer: OrganizerContact,
  temporaryPassword: string
): Promise<{ sent: boolean; reason?: string }> {
  try {
    if (!isEmailConfigured()) return { sent: false, reason: 'email-not-configured' };

    const name = platformName();
    const loginUrl = `${getBaseUrl()}/portal/login`;
    const contactEmail = platformContactEmail();

    const bodyHtml =
      pHtml(`Hi ${escapeHtml(organizer.name)},`) +
      pHtml(`We read what you sent us, and your account is ready. Here is how to get in.`, 20) +
      panelHtml(
        detailRowsHtml([
          { label: 'Sign in with', value: organizer.email, mono: true },
          { label: 'Temporary password', value: temporaryPassword, mono: true },
        ])
      ) +
      calloutHtml(
        `<strong>Change this password.</strong> We picked it and sent it by email, so treat it as good for one ` +
          `trip only. The portal asks for a new one the moment you sign in — pick something only you know, at ` +
          `least 8 characters.`
      ) +
      buttonHtml(loginUrl, 'Sign in and set your password') +
      smallHtml(
        `The account is free, and so is publishing — no fees at all, and we never take a cut of your ` +
          `ticket sales. Buyers pay you directly.`
      ) +
      (contactEmail
        ? smallHtml(
            `Stuck, or something above looks wrong? Reply to this email, or write to ` +
              `<a class="brandtext" href="mailto:${escapeHtml(contactEmail)}" style="color:${C.brandDeep};font-weight:600;">${escapeHtml(contactEmail)}</a>.`
          )
        : '');

    const text = renderText({
      headline: `Welcome to ${name} — your organizer account is ready`,
      lines: [
        `Hi ${organizer.name},`,
        '',
        wrapText('We read what you sent us, and your account is ready. Here is how to get in.'),
        '',
        ...textRows([
          ['Sign in with', organizer.email],
          ['Temporary password', temporaryPassword],
          ['Sign-in page', loginUrl],
        ]),
        '',
        wrapText(
          'CHANGE THIS PASSWORD. We picked it and sent it by email, so treat it as good for one ' +
            'trip only. The portal asks for a new one the moment you sign in — pick something only ' +
            'you know, at least 8 characters.'
        ),
        '',
        wrapText(
          'The account is free, and so is publishing — no fees at all, and we never take a cut of ' +
            'your ticket sales. Buyers pay you directly.'
        ),
        ...(contactEmail ? ['', wrapText(`Stuck? Reply to this email, or write to ${contactEmail}.`)] : []),
      ],
      footer: [`${name} · organizer portal`],
    });

    const mailed = await sendMailAs('organizers', {
      to: organizer.email,
      // replyToOrganizers(), like every other organizer mail — NOT
      // platformContactEmail(). The two are usually the same address, but the
      // whole point of EMAIL_REPLY_TO_ORGANIZERS is the window where they are
      // not: a domain authenticated for SENDING with no mailbox yet. This mail
      // ignored that override, so the one email that says "reply to us if
      // something looks wrong" was the one whose replies bounced.
      replyTo: replyToOrganizers(),
      subject: `Your ${name} organizer account is ready`,
      text,
      html: renderEmail({
        title: `Your ${name} organizer account is ready`,
        preheader: 'Your sign-in details are inside — please change the password once you are in.',
        kicker: 'Welcome aboard',
        headline: 'Your organizer account is ready',
        bodyHtml,
        footerLines: [
          `${escapeHtml(name)} · organizer portal`,
          'You are getting this because you asked us for an organizer account.',
        ],
      }),
    });
    if (!mailed.sent) return mailed;
    return { sent: true };
  } catch (err) {
    // Deliberately terse: nothing about this failure may echo the password.
    console.error('[email] Failed to send organizer credentials:', err instanceof Error ? err.message : err);
    return { sent: false, reason: 'send-failed' };
  }
}


// ---------------------------------------------------------------------------
// Buyer payment reminder — ONE friendly nudge when a transfer hasn't been
// confirmed yet. Deliberately reassuring: most people who get a payment
// reminder have already paid and just need to hear that nothing is wrong.
// ---------------------------------------------------------------------------

export async function sendBuyerPaymentReminderEmail(
  orderId: string
): Promise<{ sent: boolean; reason?: string }> {
  try {
    if (!isEmailConfigured()) return { sent: false, reason: 'email-not-configured' };

    const order = getOrder(orderId);
    if (!order) return { sent: false, reason: 'order-not-found' };
    if (order.paymentMode !== 'transfer' || order.status !== 'claimed') {
      return { sent: false, reason: 'order-not-awaiting-transfer' };
    }
    const event = getEventById(order.eventId);
    if (!event) return { sent: false, reason: 'event-not-found' };
    // The account this order was given, frozen at creation. A reminder must
    // repeat the ORIGINAL instruction — chasing a buyer with details that
    // changed after they ordered is how one edit redirects the unpaid book.
    const payout = orderPayout(order, event);
    const payee = paypalPayee({ paypalAccount: payout.paypal });
    const offersPaypal = payee !== null;
    // Same rule as the instructions mail this one repeats: a bank account is a
    // route, PayPal is a route, and only having neither means there is nothing
    // to remind anybody to do.
    const hasBank = Boolean(payout.iban.trim() && payout.holder.trim());
    if (!hasBank && !offersPaypal) {
      return { sent: false, reason: 'transfer-not-configured' };
    }

    // A shop buyer is chasing items to collect, not seats at a show — and a
    // shop need not have a date at all, so nothing here may print one blindly.
    const v = vocabFor(event.kind);
    const isShop = event.kind === 'shop';
    const whenLine = isShop ? firstLineOf(event.pickupInfo) : event.dateDisplay;
    const heldSentence = isShop ? `Your ${v.units} are still set aside` : 'Your seats are still held';
    const releasedSentence = isShop ? `the ${v.units} go back on sale` : 'the seats go back on sale';

    const venue = venueDisplay(event);
    const amount = formatMoney(order.totalCents, order.currency);
    const reference = paymentReference(orderId);
    // Tokenized like the instructions mail this one repeats — same recipient,
    // same proof, same link.
    const orderUrl = orderUrlForBuyerEmail(orderId);
    const deadline = new Date(
      Date.parse(order.createdAt.replace(' ', 'T') + 'Z') + event.payWithinDays * 86_400_000
    );
    const deadlineDisplay = deadline.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    // Only the bank half is slow. A PayPal-only buyer who reads "transfers take
    // a few days" is being told to keep waiting for something that arrived in
    // seconds — the reassurance has to describe the route they were given.
    const alreadyPaid = hasBank
      ? "Bank transfers take a few days to land in the organizer's account, and the organizer confirms each " +
        'one by hand once it shows up on their statement — we cannot see it for them. You do not need to do ' +
        'anything, and you certainly should not pay twice.'
      : 'The organizer confirms each payment by hand once it shows up in their account — we cannot see it ' +
        'for them. You do not need to do anything, and you certainly should not pay twice.';

    const bankRows: DetailRow[] = hasBank
      ? [
          { label: 'Account holder', value: payout.holder },
          { label: 'IBAN', value: payout.iban, mono: true },
          ...(payout.bic ? [{ label: 'BIC', value: payout.bic, mono: true }] : []),
          ...(payout.bankName ? [{ label: 'Bank', value: payout.bankName }] : []),
        ]
      : [];

    const bodyHtml =
      pHtml(`Hi ${escapeHtml(order.buyerName)},`) +
      pHtml(
        `${heldSentence}, but the organizer has not confirmed your ${offersPaypal ? 'payment' : 'bank transfer'} yet.`,
        20
      ) +
      calloutHtml(`<strong>Already sent it?</strong> Then all is well. ${escapeHtml(alreadyPaid)}`) +
      pHtml(
        `Not yet? Here are the details again. Please send it by ${strong(deadlineDisplay)}, otherwise ` +
          `${escapeHtml(releasedSentence)}.`,
        20
      ) +
      paypalNoteHtml(payee, { reference, amount, codes: v.codes, alsoBank: hasBank }) +
      panelHtml(
        amountRowHtml(hasBank ? 'Amount to transfer' : 'Amount to pay', amount, hasBank) +
          detailRowsHtml(bankRows)
      ) +
      referenceBoxHtml(
        'Payment reference — required',
        reference,
        hasBank
          ? `Put this in the transfer&#39;s purpose line (&quot;Verwendungszweck&quot;) so your payment finds your ${escapeHtml(v.codes)}.`
          : `Put this in PayPal&#39;s message field so your payment finds your ${escapeHtml(v.codes)}.`
      ) +
      buttonHtml(orderUrl, 'View your order') +
      smallHtml(
        `Your QR ${escapeHtml(v.codes)} arrive by email the moment the organizer confirms your payment.`
      );

    const html = renderEmail({
      title: `Your ${v.units} for ${event.name} are still reserved`,
      preheader: `The organizer has not confirmed your payment for ${event.name} yet — the details are inside.`,
      kicker: 'Still reserved',
      headline: event.name,
      metaLines: [whenLine, venue],
      bodyHtml,
      footerLines: [
        `${escapeHtml(event.name)}${whenLine ? ` · ${escapeHtml(whenLine)}` : ''}`,
        escapeHtml(venue),
        `Order ${escapeHtml(orderId)}`,
        `You are getting this because you reserved ${escapeHtml(v.units)} on ${escapeHtml(platformName())}.`,
      ],
    });

    const text = renderText({
      headline: `Your ${v.units} for ${event.name} are still reserved`,
      context: [whenLine, venue],
      lines: [
        `Hi ${order.buyerName},`,
        '',
        wrapText(
          `${heldSentence}, but the organizer has not confirmed your ${offersPaypal ? 'payment' : 'bank transfer'} yet.`
        ),
        '',
        wrapText(`ALREADY SENT IT? Then all is well. ${alreadyPaid}`),
        '',
        wrapText(
          `Not yet? Here are the details again. Please send it by ${deadlineDisplay}, otherwise ` +
            `${releasedSentence}.`
        ),
        ...paypalNoteText(payee, { reference, amount, codes: v.codes, alsoBank: hasBank }),
        '',
        ...textRows([
          ['Amount', amount],
          ...(hasBank
            ? ([
                ['Account holder', payout.holder],
                ['IBAN', payout.iban],
                ...(payout.bic ? [['BIC', payout.bic]] : []),
                ...(payout.bankName ? [['Bank', payout.bankName]] : []),
              ] as Array<[string, string]>)
            : []),
          ['Reference', reference],
        ]),
        '',
        wrapText(
          hasBank
            ? `IMPORTANT: put the reference ${reference} in the transfer's purpose line ` +
              `("Verwendungszweck") so your payment finds your ${v.codes}.`
            : `IMPORTANT: put the reference ${reference} in PayPal's message field so your ` +
              `payment finds your ${v.codes}.`
        ),
        '',
        `Your order: ${orderUrl}`,
        '',
        wrapText(
          `Your QR ${v.codes} arrive by email the moment the organizer confirms your payment.`
        ),
      ],
      footer: [[event.name, whenLine, venue].filter(Boolean).join(' · '), `Order ${orderId}`],
    });

    const mailed = await sendMailAs('buyers', {
      replyTo: replyToBuyers(),
      to: order.buyerEmail,
      subject: `Reminder: your ${v.units} for ${event.name} are still reserved`,
      text,
      html,
    });
    if (!mailed.sent) return mailed;
    return { sent: true };
  } catch (err) {
    console.error('[email] Failed to send buyer payment reminder:', err instanceof Error ? err.message : err);
    return { sent: false, reason: 'send-failed' };
  }
}

// ---------------------------------------------------------------------------
// "Design my page for me" enquiries (public /contact form)
//
// Two mails per enquiry: one to the platform owner's inbox (with reply-to set
// to the enquirer, so hitting reply just works), one friendly acknowledgement
// back to the enquirer. Both fail silently — the enquiry is already stored and
// visible at /admin/contact.
// ---------------------------------------------------------------------------

/** Multi-line free text as safe HTML (escaped, newlines preserved). */
function multilineHtml(text: string): string {
  return escapeHtml(text).replace(/\r?\n/g, '<br>');
}

/** The enquiry, mailed to the team. Reply-to is the person who wrote it. */
export async function sendContactRequestToTeam(
  request: ContactRequestRow
): Promise<{ sent: boolean; reason?: string }> {
  try {
    if (!isEmailConfigured()) return { sent: false, reason: 'email-not-configured' };

    const to = platformContactEmail();
    if (!to) return { sent: false, reason: 'contact-email-not-configured' };

    const wantsAccount = request.kind === 'organizer-account';
    const kindLabel = wantsAccount
      ? 'Organizer account application'
      : request.kind === 'general'
        ? 'General message'
        : 'Custom-page request';
    const subjectLead = wantsAccount
      ? 'New account application'
      : request.kind === 'general'
        ? 'New message'
        : 'New custom-page request';
    const inboxUrl = `${getBaseUrl()}/admin/contact`;
    const lead = wantsAccount
      ? `${strong(request.name)} is asking for an organizer account. Read it, then approve it in the inbox to ` +
        `create the account and email them their sign-in details.`
      : `${strong(request.name)} would like to talk about a page for their event. Hit reply — this mail goes ` +
        `straight back to them.`;

    // Only rows they actually filled in — a table of dashes reads as a worse
    // application than it is.
    const optionalRows = (
      [
        ['Phone', request.phone],
        ['Kind of event', request.eventKind],
        ['When', request.eventWhen],
        ['Where', request.eventWhere],
        ['Expected people', request.expectedPeople],
      ] as const
    ).filter(([, value]) => value !== '');

    const rows: DetailRow[] = [
      { label: 'Name', value: request.name },
      {
        label: 'Email',
        valueHtml: `<a class="brandtext" href="mailto:${escapeHtml(request.email)}" style="color:${C.brandDeep};text-decoration:underline;">${escapeHtml(request.email)}</a>`,
      },
      ...(request.organization ? [{ label: 'Organization', value: request.organization }] : []),
      ...optionalRows.map(([label, value]) => ({ label, value })),
      { label: 'Type', value: kindLabel },
      { label: 'Received', value: `${request.createdAt} UTC` },
    ];

    const bodyHtml =
      pHtml(lead, 20) +
      panelHtml(detailRowsHtml(rows)) +
      quoteHtml('What they wrote', multilineHtml(request.message)) +
      buttonHtml(inboxUrl, wantsAccount ? 'Review and approve' : 'Open the request inbox') +
      smallHtml(
        `Every enquiry is stored in the inbox too — ` +
          `${wantsAccount ? 'approve it there, or mark it handled if you turn it down' : 'mark it handled once you have replied'}.`
      );

    const text = renderText({
      headline: kindLabel,
      lines: [
        wrapText(
          wantsAccount
            ? `${request.name} is asking for an organizer account.`
            : `${request.name} would like to talk about a page for their event.`
        ),
        '',
        ...textRows([
          ['Name', request.name],
          ['Email', request.email],
          ...(request.organization ? ([['Organization', request.organization]] as Array<[string, string]>) : []),
          ...optionalRows.map(([label, value]) => [label, value] as [string, string]),
          ['Type', kindLabel],
          ['Received', `${request.createdAt} UTC`],
        ]),
        '',
        'WHAT THEY WROTE',
        request.message,
        '',
        wrapText(`Reply straight to this email — it goes back to ${request.email}.`),
        `Request inbox: ${inboxUrl}`,
      ],
    });

    const mailed = await sendMailAs('organizers', {
      to,
      replyTo: request.email,
      subject: `${subjectLead} — ${request.name}`,
      text,
      html: renderEmail({
        title: kindLabel,
        preheader: `${request.name}${request.organization ? ` (${request.organization})` : ''} — ${request.email}`,
        kicker: wantsAccount ? 'New application' : 'New enquiry',
        headline: kindLabel,
        bodyHtml,
        footerLines: [`${escapeHtml(platformName())} · ${escapeHtml(inboxUrl)}`],
      }),
    });
    if (!mailed.sent) return mailed;
    return { sent: true };
  } catch (err) {
    console.error('[email] Failed to send contact request to team:', err instanceof Error ? err.message : err);
    return { sent: false, reason: 'send-failed' };
  }
}

/** Friendly "we got it" auto-reply to the person who filled in the form. */
export async function sendContactRequestAck(
  request: ContactRequestRow
): Promise<{ sent: boolean; reason?: string }> {
  try {
    if (!isEmailConfigured()) return { sent: false, reason: 'email-not-configured' };

    const name = platformName();
    const contactEmail = platformContactEmail();
    const wantsAccount = request.kind === 'organizer-account';

    const bodyHtml =
      pHtml(`Hi ${escapeHtml(request.name)},`) +
      pHtml(
        `Thanks for getting in touch. We have your ${wantsAccount ? 'application' : 'request'}, and a real ` +
          `person will read it and write back within a couple of days` +
          `${wantsAccount ? '' : ' with ideas and what it would cost'}.`,
        20
      ) +
      calloutHtml(
        wantsAccount
          ? `<strong>What happens next</strong><br>We read what you told us about your event. If it all looks ` +
              `right we set your account up and email you the sign-in details. The account is free, and so is ` +
              `publishing. Forgot to mention something? Just reply.`
          : `<strong>Good to know</strong><br>The standard event page — photos, video, ticket tiers, QR tickets ` +
              `and door scanning — is free and already included. What we quote you for is the design work on top.`
      ) +
      quoteHtml('What you sent us', multilineHtml(request.message)) +
      pHtml(
        `Anything to add? Just reply to this email, or write to ` +
          `<a class="brandtext" href="mailto:${escapeHtml(contactEmail)}" style="color:${C.brandDeep};font-weight:700;">${escapeHtml(contactEmail)}</a>.`,
        0
      );

    const text = renderText({
      headline: "Thanks — we've got your request",
      lines: [
        `Hi ${request.name},`,
        '',
        wrapText(
          `Thanks for getting in touch. We have your ${wantsAccount ? 'application' : 'request'}, and a real ` +
            `person will read it and write back within a couple of days` +
            `${wantsAccount ? '.' : ' with ideas and what it would cost.'}`
        ),
        '',
        wrapText(
          wantsAccount
            ? `WHAT HAPPENS NEXT: we read what you told us about your event. If it all looks right we set ` +
                `your account up and email you the sign-in details. The account is free, and so is publishing. ` +
                `Forgot to mention something? Just reply.`
            : `GOOD TO KNOW: the standard event page (photos, video, ticket tiers, QR tickets and door ` +
                `scanning) is free and already included. What we quote you for is the design work on top.`
        ),
        '',
        'WHAT YOU SENT US',
        request.message,
        '',
        wrapText(`Anything to add? Reply to this email, or write to ${contactEmail}.`),
      ],
      footer: [`${name} · ${getBaseUrl()}`],
    });

    const mailed = await sendMailAs(wantsAccount ? 'organizers' : 'buyers', {
      to: request.email,
      replyTo: contactEmail,
      subject: `Thanks — we've got your request (${name})`,
      text,
      html: renderEmail({
        title: "Thanks — we've got your request",
        preheader: 'A real person will read it and reply within a couple of days.',
        kicker: 'Got it',
        headline: "Thanks — we've got your request",
        bodyHtml,
        footerLines: [
          `${escapeHtml(name)} · ${escapeHtml(getBaseUrl())}`,
          'You are getting this because you wrote to us through the site.',
        ],
      }),
    });
    if (!mailed.sent) return mailed;
    return { sent: true };
  } catch (err) {
    console.error('[email] Failed to send contact request acknowledgement:', err instanceof Error ? err.message : err);
    return { sent: false, reason: 'send-failed' };
  }
}

/**
 * The organizer's answer, sent to the person who asked.
 *
 * Questions used to be answered only on the page, which quietly assumed the
 * asker would come back and look. Nobody re-opens an event page on the chance
 * that a question they asked days ago has been answered — so in practice the
 * answer reached everyone EXCEPT the one person who wanted it.
 *
 * Sends nothing when the question was asked anonymously, and nothing once the
 * address has been erased by the retention sweep: the .invalid address is not
 * deliverable and mailing it would only generate bounces.
 */
export async function sendQuestionAnsweredEmail(
  question: EventQuestionRow
): Promise<{ sent: boolean; reason?: string }> {
  try {
    if (!isEmailConfigured()) return { sent: false, reason: 'email-not-configured' };

    const to = question.askerEmail.trim();
    if (!to) return { sent: false, reason: 'no-address' };
    if (question.askerErasedAt || to.endsWith('.invalid')) return { sent: false, reason: 'address-erased' };
    if (!question.answer?.trim()) return { sent: false, reason: 'no-answer' };

    const event = getEventById(question.eventId);
    if (!event) return { sent: false, reason: 'event-missing' };

    const name = platformName();
    const eventUrl = `${getBaseUrl()}/e/${event.slug}`;
    const greeting = question.askerName.trim() ? `Hi ${escapeHtml(question.askerName.trim())},` : 'Hi,';
    const headline = `${event.name} — your question is answered`;

    const bodyHtml =
      pHtml(greeting) +
      pHtml(
        `The organizer of <strong>${escapeHtml(event.name)}</strong> has replied to the question you ` +
          `asked on their event page.`,
        20
      ) +
      quoteHtml('You asked', multilineHtml(question.question)) +
      calloutHtml(`<strong>Their answer</strong><br>${multilineHtml(question.answer)}`) +
      pHtml(
        `Everything about the event — dates, tickets and the rest — is on ` +
          `<a class="brandtext" href="${escapeHtml(eventUrl)}" style="color:${C.brandDeep};font-weight:700;">the event page</a>. ` +
          `Need anything else? Ask again there.`,
        20
      ) +
      pHtml(
        `<span style="color:${C.muted};font-size:13px;">You are getting this because you asked to be told ` +
          `the answer. It is a one-off — there is no mailing list, and we do not write to you again.</span>`,
        0
      );

    const text = renderText({
      headline,
      lines: [
        question.askerName.trim() ? `Hi ${question.askerName.trim()},` : 'Hi,',
        '',
        wrapText(`The organizer of ${event.name} has replied to the question you asked on their event page.`),
        '',
        'YOU ASKED',
        question.question,
        '',
        'THEIR ANSWER',
        question.answer,
        '',
        wrapText(`Everything about the event is on ${eventUrl} — need anything else? Ask again there.`),
        '',
        wrapText(
          'You are getting this because you asked to be told the answer. It is a one-off — there is no ' +
            'mailing list, and we do not write to you again.'
        ),
      ],
      footer: [`${name} · ${getBaseUrl()}`],
    });

    const mailed = await sendMailAs('buyers', {
      replyTo: replyToBuyers(),
      to,
      subject: `Answered: your question about ${event.name}`,
      text,
      html: renderEmail({
        title: headline,
        preheader: `The organizer replied to your question about ${event.name}.`,
        kicker: 'Answered',
        headline,
        bodyHtml,
        footerLines: [`${name} · ${getBaseUrl()}`],
      }),
    });
    if (!mailed.sent) return mailed;
    return { sent: true };
  } catch (err) {
    console.error('[email] Failed to send question answer:', err instanceof Error ? err.message : err);
    return { sent: false, reason: 'send-failed' };
  }
}

// ---------------- Somebody signed in ----------------

/**
 * A coarse, human description of the browser that signed in.
 *
 * Not fingerprinting and not precise — "Chrome on Windows" is exactly as much
 * as the account owner needs to think "that is my laptop" or "that is not
 * mine". A version string or a full user-agent would say less to them, not
 * more, and would put a line of machinery in a message meant to be read at a
 * glance.
 */
export function describeDevice(userAgent: string): string {
  const ua = userAgent || '';
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /OPR\/|Opera/.test(ua)
      ? 'Opera'
      : /Firefox\//.test(ua)
        ? 'Firefox'
        : /Chrome\//.test(ua)
          ? 'Chrome'
          : /Safari\//.test(ua)
            ? 'Safari'
            : '';
  const os = /iPhone|iPad/.test(ua)
    ? 'iPhone'
    : /Android/.test(ua)
      ? 'Android'
      : /Mac OS X|Macintosh/.test(ua)
        ? 'a Mac'
        : /Windows/.test(ua)
          ? 'Windows'
          : /Linux/.test(ua)
            ? 'Linux'
            : '';
  if (browser && os) return `${browser} on ${os}`;
  if (browser) return browser;
  if (os) return os;
  return 'an unrecognised browser';
}

/**
 * Tell the organizer their account was just signed in to.
 *
 * Sent to the address the account was opened with, which is the point: it is
 * the one channel an attacker holding the password does not automatically
 * control. It attacks the problem where it starts — somebody else getting in —
 * rather than at the individual things they might then change.
 *
 * Deliberately short, and it asks for exactly one thing. There is no "contact
 * the team" or support address in it: the useful action is to change the
 * password, immediately, and every extra instruction is a reason to do nothing
 * tonight and deal with it later.
 *
 * Never throws — a sign-in must not fail because the alarm about it could not
 * be sent.
 */
export async function sendSignInAlertEmail(
  organizer: OrganizerContact,
  details: { device: string; when: Date }
): Promise<{ sent: boolean; reason?: string }> {
  try {
    if (!isEmailConfigured()) return { sent: false, reason: 'email-not-configured' };
    const brand = platformName();
    const whenDisplay = details.when.toLocaleString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    });
    const headline = `New sign-in to your ${brand} account`;

    const rows: DetailRow[] = [
      { label: 'When', value: whenDisplay },
      { label: 'Browser', value: details.device },
    ];

    const bodyHtml =
      pHtml(`Hi ${escapeHtml(organizer.name)},`) +
      pHtml(`Your organizer account was just signed in to.`, 20) +
      panelHtml(detailRowsHtml(rows)) +
      calloutHtml(
        `<strong>Was this you?</strong> Then nothing to do — you can ignore this.<br>` +
          `<strong>If it was not</strong>, change your password now. Somebody else knows it.`
      );

    const mailed = await sendMailAs('organizers', {
      replyTo: replyToOrganizers(),
      to: organizer.email,
      subject: headline,
      text: renderText({
        headline,
        lines: [
          `Hi ${organizer.name},`,
          '',
          'Your organizer account was just signed in to.',
          '',
          ...textRows([
            ['When', whenDisplay],
            ['Browser', details.device],
          ]),
          '',
          wrapText('Was this you? Then there is nothing to do and you can ignore this.'),
          '',
          wrapText('If it was not you, change your password now — somebody else knows it.'),
        ],
        footer: [`${brand} · ${getBaseUrl()}`],
      }),
      html: renderEmail({
        title: headline,
        preheader: `Signed in on ${whenDisplay} using ${details.device}.`,
        kicker: 'Sign-in',
        headline,
        bodyHtml,
        footerLines: [`${brand} · ${getBaseUrl()}`],
      }),
    });
    if (!mailed.sent) return mailed;
    return { sent: true };
  } catch (err) {
    console.error('[email] Failed to send sign-in alert:', err instanceof Error ? err.message : err);
    return { sent: false, reason: 'send-failed' };
  }
}

// ---------------- The payout account moved ----------------

export interface PayoutChangeDetails {
  /** What moved, in words — e.g. ['your IBAN', 'the account holder']. */
  labels: string[];
  /** The NEW values. Only ever shown masked; see maskTail(). */
  bankIban: string;
  paypalAccount: string;
  /** True when this filled an empty payout account rather than moving one. */
  firstTime: boolean;
  /**
   * Unix ms at which the new account starts being given to buyers, or null when
   * it applied at once. Non-null is the important case: it is the window in
   * which the reader can still stop this, and the message is worth little if it
   * does not say how long they have.
   */
  effectiveAt?: number | null;
  /** The account holder name now on the payout account. */
  holderName?: string;
  /**
   * True when that name shares nothing with the organizer we approved.
   *
   * Shown only on the OWNER's copy. To the organizer it would be noise — they
   * know whose account it is — but to the platform it is the clearest mule
   * signal available without holding the money: a redirected payout has to
   * carry a stranger's name, and this is where that becomes visible.
   */
  nameMismatch?: boolean;
}

/**
 * Last four characters only.
 *
 * A notification is the one message that goes to an address we are not certain
 * is still in the right hands — the whole point is that it reaches someone who
 * may have just been robbed. Printing the new IBAN in full would hand the
 * attacker's account number to the victim and the victim's to the attacker, and
 * help neither. Four characters is enough for the owner to recognise their own
 * account, and not enough for anyone to use.
 *
 * Deliberately a local copy rather than an import from lib/payoutStepUp: that
 * module reaches the signing secret through lib/auth, which pulls in
 * next/headers, and this file is also used from background jobs that run
 * outside any request.
 */
function maskTail(value: string): string {
  const compact = value.replace(/\s+/g, '');
  if (!compact) return 'removed';
  if (compact.length <= 4) return `••••${compact}`;
  return `••••${compact.slice(-4)}`;
}

/**
 * Tell the organizer — and the platform owner — that the account their ticket
 * money is paid into has changed.
 *
 * This is an ALARM, not a receipt. It is written for the person who did not
 * make the change: it leads with what happened, says when, and says what to do,
 * because if it is unwelcome then every minute before it is read is a buyer
 * transferring money to a stranger.
 *
 * The platform owner gets their own copy, and that is not a courtesy. Mail to
 * some providers is being silently dropped until the sending domain is
 * authenticated, so the organizer's copy may never arrive — the owner's inbox is
 * the backstop that means a redirected payout is still noticed by somebody.
 *
 * Never throws: the change is already committed by the time this runs.
 */
export async function sendPayoutChangedEmail(
  organizer: OrganizerContact,
  event: { id: string; name: string },
  change: PayoutChangeDetails
): Promise<{ sent: boolean; reason?: string }> {
  try {
    if (!isEmailConfigured()) return { sent: false, reason: 'email-not-configured' };

    const brand = platformName();
    const what = change.labels.join(' and ');
    const headline = change.firstTime
      ? `Payment details set for ${event.name}`
      : `The payout account for ${event.name} has changed`;
    const kicker = change.firstTime ? 'Payment details set' : 'Payout account changed';
    const editUrl = `${getBaseUrl()}/portal/events/${event.id}/edit`;

    const rows: DetailRow[] = [
      { label: 'Event', value: event.name },
      ...(change.bankIban.trim() ? [{ label: 'IBAN now ending', value: maskTail(change.bankIban), mono: true }] : []),
      ...(change.paypalAccount.trim()
        ? [{ label: 'PayPal now ending', value: maskTail(change.paypalAccount), mono: true }]
        : []),
    ];

    // The window, when there is one. This is the whole reason the delay exists:
    // the message is worth far more if it says the change has NOT happened yet
    // and names the moment it will.
    const waiting = typeof change.effectiveAt === 'number' && change.effectiveAt > Date.now();
    const whenDisplay = waiting
      ? new Date(change.effectiveAt as number).toLocaleString('en-GB', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '';

    const alarmHtml = waiting
      ? `<strong>This has not taken effect yet.</strong> Buyers are still being given your current account ` +
        `until <strong>${escapeHtml(whenDisplay)}</strong>. If you did not make this change, open your event ` +
        `now and cancel it — nothing will have moved. Then change your password, because someone else is ` +
        `signed in to your organizer account.`
      : change.firstTime
        ? `<strong>If you did not do this</strong>, someone else is signed in to your organizer account. ` +
          `Change your password now and reply to this email.`
        : `<strong>If you did not make this change, act now.</strong> Someone else is signed in to your ` +
          `organizer account and your buyers' payments are going to them. Change your password immediately, ` +
          `set the correct account back, and reply to this email so we can help.`;

    const bodyHtml =
      pHtml(`Hi ${escapeHtml(organizer.name)},`) +
      pHtml(
        change.firstTime
          ? `You set ${escapeHtml(what)} for <strong>${escapeHtml(event.name)}</strong>. This is where your ` +
            `ticket money will be paid — buyers transfer to you directly.`
          : `${escapeHtml(what.charAt(0).toUpperCase() + what.slice(1))} for ` +
            `<strong>${escapeHtml(event.name)}</strong> was just changed. From now on, buyers are told to send ` +
            `their ticket money to the new account.`,
        20
      ) +
      panelHtml(detailRowsHtml(rows)) +
      calloutHtml(alarmHtml) +
      pHtml(
        `You can check the details any time on ` +
          `<a class="brandtext" href="${escapeHtml(editUrl)}" style="color:${C.brandDeep};font-weight:700;">your event's payment tab</a>.`,
        0
      );

    const text = renderText({
      headline,
      lines: [
        `Hi ${organizer.name},`,
        '',
        wrapText(
          change.firstTime
            ? `You set ${what} for ${event.name}. This is where your ticket money will be paid — buyers transfer to you directly.`
            : `${what.charAt(0).toUpperCase() + what.slice(1)} for ${event.name} was just changed. From now on, buyers are told to send their ticket money to the new account.`
        ),
        '',
        ...textRows([
          ['Event', event.name],
          ...(change.bankIban.trim() ? ([['IBAN now ending', maskTail(change.bankIban)]] as Array<[string, string]>) : []),
          ...(change.paypalAccount.trim()
            ? ([['PayPal now ending', maskTail(change.paypalAccount)]] as Array<[string, string]>)
            : []),
        ]),
        '',
        waiting
          ? wrapText(
              `THIS HAS NOT TAKEN EFFECT YET. Buyers are still being given your current account until ${whenDisplay}. ` +
                'If you did not make this change, open your event now and cancel it — nothing will have moved. Then ' +
                'change your password, because someone else is signed in to your organizer account.'
            )
          : change.firstTime
            ? wrapText(
                'IF YOU DID NOT DO THIS, someone else is signed in to your organizer account. Change your password now and reply to this email.'
              )
            : wrapText(
                "IF YOU DID NOT MAKE THIS CHANGE, ACT NOW. Someone else is signed in to your organizer account and your buyers' payments are going to them. Change your password immediately, set the correct account back, and reply to this email so we can help."
              ),
        '',
        wrapText(`You can check the details any time at ${editUrl}`),
      ],
      footer: [`${brand} · ${getBaseUrl()}`],
    });

    const mailed = await sendMailAs('organizers', {
      replyTo: replyToOrganizers(),
      to: organizer.email,
      subject: waiting
        ? `Confirm or cancel: the payout account for ${event.name} is being changed`
        : change.firstTime
          ? `Payment details set for ${event.name}`
          : `Action may be needed: the payout account for ${event.name} changed`,
      text,
      html: renderEmail({
        title: headline,
        preheader: change.firstTime
          ? `Where your ticket money for ${event.name} will be paid.`
          : `The account your ticket money for ${event.name} is paid into has changed.`,
        kicker,
        headline,
        bodyHtml,
        footerLines: [`${brand} · ${getBaseUrl()}`],
      }),
    });
    if (!mailed.sent) return mailed;

    // The owner's copy: a separate message, never a CC. A CC would address the
    // owner as the organizer and put each party's address in the other's inbox.
    // A failure here must not turn the organizer's alarm into a failed send, so
    // it is logged and swallowed on its own.
    const ownerInbox = platformContactEmail();
    if (ownerInbox && ownerInbox.toLowerCase() !== organizer.email.trim().toLowerCase()) {
      const ownerLine =
        `${organizer.name} (${organizer.email}) ` +
        (change.firstTime ? 'set the payment details for' : 'CHANGED the payout account for') +
        ` "${event.name}" — ${what}.`;
      const mismatchText = change.nameMismatch
        ? `NAME MISMATCH: the account holder is now "${change.holderName ?? ''}", which shares no name with ` +
          `the approved organizer "${organizer.name}". That is what a redirected payout looks like. ` +
          `Check it with them directly, on a number you already had — not one on this platform — ` +
          (waiting ? 'and cancel the change before it takes effect.' : 'and switch the account off if in doubt.')
        : '';
      try {
        const ownerCopy = await sendMailAs('organizers', {
          replyTo: replyToOrganizers(),
          to: ownerInbox,
          subject: change.nameMismatch
            ? `NAME MISMATCH on the payout account — ${event.name}`
            : change.firstTime
              ? `Payment details set — ${event.name}`
              : `Payout account changed — ${event.name}`,
          text: renderText({
            headline: change.firstTime ? 'Payment details set' : 'Payout account changed',
            lines: [
              wrapText(ownerLine),
              '',
              ...(mismatchText ? [wrapText(mismatchText), ''] : []),
              ...textRows([
                ['Organizer', `${organizer.name} <${organizer.email}>`],
                ['Event', event.name],
                ...(change.bankIban.trim()
                  ? ([['IBAN now ending', maskTail(change.bankIban)]] as Array<[string, string]>)
                  : []),
                ...(change.paypalAccount.trim()
                  ? ([['PayPal now ending', maskTail(change.paypalAccount)]] as Array<[string, string]>)
                  : []),
              ]),
              '',
              wrapText(
                'You are told because organizer mail is not reliably delivered yet. If the organizer says ' +
                  'they did not do this, switch the account off and check their event before any more buyers pay.'
              ),
            ],
            footer: [`${brand} · ${getBaseUrl()}`],
          }),
          html: renderEmail({
            title: change.firstTime ? 'Payment details set' : 'Payout account changed',
            preheader: ownerLine,
            kicker,
            headline: change.firstTime ? 'Payment details set' : 'Payout account changed',
            bodyHtml:
              pHtml(escapeHtml(ownerLine), 20) +
              (mismatchText ? calloutHtml(`<strong>${escapeHtml(mismatchText)}</strong>`) : '') +
              panelHtml(
                detailRowsHtml([
                  { label: 'Organizer', value: `${organizer.name} <${organizer.email}>` },
                  ...rows,
                ])
              ) +
              pHtml(
                `<span style="color:${C.muted};font-size:13px;">You are told because organizer mail is not ` +
                  `reliably delivered yet. If they say they did not do this, switch the account off and check ` +
                  `their event before any more buyers pay.</span>`,
                0
              ),
            footerLines: [`${brand} · ${getBaseUrl()}`],
          }),
        });
        // Logged, never returned: the organizer's alarm above already went out,
        // and this copy failing must not report the whole notice as unsent.
        if (!ownerCopy.sent) {
          console.error(`[email] Payout-change owner copy not sent: ${ownerCopy.reason}`);
        }
      } catch (err) {
        console.error('[email] Payout-change owner copy failed:', err instanceof Error ? err.message : err);
      }
    }

    return { sent: true };
  } catch (err) {
    console.error('[email] Failed to send payout-change notice:', err instanceof Error ? err.message : err);
    return { sent: false, reason: 'send-failed' };
  }
}

// ---------------------------------------------------------------------------
// Waitlist: the single "there is space again" email a sold-out signup buys
// ---------------------------------------------------------------------------

/**
 * Tell one waitlisted address that the sold-out listing can be bought again.
 *
 * Everyone on the list gets this at the same moment and nothing is reserved
 * for anyone, so the one thing this mail must NOT do is read like a held
 * ticket: it says plainly that the whole list is being told at once and that
 * whoever books first gets the spots. It is also the LAST thing the address
 * ever hears from us — the sweep (lib/waitlist.ts) stamps the row before
 * sending and never re-notifies, and retention deletes the address itself
 * within WAITLIST_NOTIFIED_RETENTION_DAYS — so the mail says that too, in so
 * many words, because one email is exactly what the signup form promised.
 *
 * Never throws — the sweep has already spent the row's one notification, and
 * a mail failure must not take the whole sweep down with it.
 */
export async function sendWaitlistSpotsOpenEmail(
  to: string,
  event: EventRow
): Promise<{ sent: boolean; reason?: string }> {
  try {
    if (!isEmailConfigured()) return { sent: false, reason: 'email-not-configured' };

    const v = vocabFor(event.kind);
    const isShop = event.kind === 'shop';
    const eventUrl = `${getBaseUrl()}/e/${event.slug}`;
    const venue = venueDisplay(event);
    const whenLine = isShop ? firstLineOf(event.pickupInfo) : event.dateDisplay;
    const headline = `${v.Units} for ${event.name} are available again`;

    const bodyHtml =
      pHtml(`Hi,`) +
      pHtml(
        `You asked to hear if ${v.units} for ${strong(event.name)} became available again — and right ` +
          `now they are.`,
        20
      ) +
      calloutHtml(
        `<strong>First come, first served.</strong> Everyone on the waitlist is getting this same email ` +
          `right now, and nothing is being held for anybody — if you want ${isShop ? 'your items' : 'to go'}, ` +
          `book now, before the ${v.units} are gone again.`
      ) +
      buttonHtml(eventUrl, v.cta) +
      smallHtml(
        `This is the one email you asked for when you joined the waitlist — we will not write to you ` +
          `again, and your address is deleted from the waitlist within ${WAITLIST_NOTIFIED_RETENTION_DAYS} days.`
      );

    const text = renderText({
      headline,
      context: [event.name, whenLine, venue],
      lines: [
        'Hi,',
        '',
        wrapText(
          `You asked to hear if ${v.units} for ${event.name} became available again — and right now ` +
            `they are.`
        ),
        '',
        wrapText(
          `FIRST COME, FIRST SERVED: everyone on the waitlist is getting this same email right now, ` +
            `and nothing is being held for anybody. If you want ${isShop ? 'your items' : 'to go'}, book now.`
        ),
        '',
        `${v.cta}: ${eventUrl}`,
        '',
        wrapText(
          `This is the one email you asked for when you joined the waitlist — we will not write to ` +
            `you again, and your address is deleted from the waitlist within ` +
            `${WAITLIST_NOTIFIED_RETENTION_DAYS} days.`
        ),
      ],
      footer: [[event.name, whenLine, venue].filter(Boolean).join(' · ')],
    });

    const mailed = await sendMailAs('buyers', {
      replyTo: replyToBuyers(),
      to,
      subject: headline,
      text,
      html: renderEmail({
        title: headline,
        preheader: `Space just opened up — the whole waitlist is being told at once, and ${v.units} go to whoever books first.`,
        kicker: 'Available again',
        headline: event.name,
        metaLines: [whenLine, venue],
        bodyHtml,
        footerLines: [
          `${escapeHtml(event.name)}${whenLine ? ` · ${escapeHtml(whenLine)}` : ''}`,
          escapeHtml(venue),
          `You are getting this because you joined the waitlist for this ${escapeHtml(v.listing)} on ${escapeHtml(platformName())}. It is the only email the waitlist ever sends.`,
        ],
      }),
    });
    if (!mailed.sent) return mailed;
    return { sent: true };
  } catch (err) {
    console.error('[email] Failed to send waitlist notification:', err instanceof Error ? err.message : err);
    return { sent: false, reason: 'send-failed' };
  }
}

// ---------------------------------------------------------------------------
// Announcements: the one email a "keep me posted" tick buys per new listing
// ---------------------------------------------------------------------------

/**
 * Tell ONE subscriber that the organizer they asked to hear from has published
 * something new. Only ever called by the announce route, which walks the
 * CONFIRMED, not-unsubscribed audience and claims a marketing_sends row per
 * address BEFORE calling this — so this mail can never reach anyone who did
 * not ask (and confirm from their own inbox), and never twice about one event.
 *
 * The organizer is the sender-in-spirit: the subject and the first line name
 * THEM as the party announcing, because the tick at checkout was about their
 * future listings, not about the platform. The event link is deliberately
 * plain — no referral code, no tracking: nobody "referred" this reader, the
 * organizer did.
 *
 * Refuses to send at all when no unsubscribe link can be built (unsigned
 * deployment): a marketing email without a working way out breaks the exact
 * promise /privacy makes about it. Never throws — a failed address is the
 * route's loop to log and carry on past.
 */
export async function sendOrganizerAnnouncementEmail(
  to: string,
  event: EventRow
): Promise<{ sent: boolean; reason?: string }> {
  try {
    if (!isEmailConfigured()) return { sent: false, reason: 'email-not-configured' };
    const unsubUrl = unsubscribeUrl(event.organizerId, to);
    const oneClickUrl = oneClickUnsubscribeUrl(event.organizerId, to);
    if (!unsubUrl || !oneClickUrl) return { sent: false, reason: 'unsubscribe-unavailable' };

    const v = vocabFor(event.kind);
    const isShop = event.kind === 'shop';
    const organizerName = organizerDisplayName(event.organizerId) || 'The organizer';
    const eventUrl = `${getBaseUrl()}/e/${event.slug}`;
    const venue = venueDisplay(event);
    const whenLine = isShop ? firstLineOf(event.pickupInfo) : event.dateDisplay;
    const headline = `${organizerName} has a new ${v.listing} on ${platformName()}`;

    const bodyHtml =
      pHtml(`Hi,`) +
      pHtml(
        `You asked ${strong(organizerName)} to keep you posted — here is what they just announced: ` +
          `${strong(event.name)}${whenLine ? `, ${escapeHtml(whenLine)}` : ''}${venue ? ` at ${escapeHtml(venue)}` : ''}.`,
        20
      ) +
      buttonHtml(eventUrl, `See the ${v.listing}`) +
      buttonNoteHtml(`Everything — ${isShop ? 'items, prices and how to collect' : 'tickets, prices and details'} — is on the page.`) +
      smallHtml(
        `You get at most one email per new listing, and you can ` +
          `<a href="${escapeHtml(unsubUrl)}" style="color:${C.brandDeep};font-weight:700;">unsubscribe any time</a> — ` +
          `one button on the page that opens, no sign-in, and it works immediately and forever.`
      );

    const text = renderText({
      headline,
      context: [event.name, whenLine, venue],
      lines: [
        'Hi,',
        '',
        wrapText(
          `You asked ${organizerName} to keep you posted — here is what they just announced: ` +
            `${event.name}${whenLine ? `, ${whenLine}` : ''}${venue ? ` at ${venue}` : ''}.`
        ),
        '',
        `See the ${v.listing}: ${eventUrl}`,
        '',
        wrapText(
          `You get at most one email per new listing. Unsubscribe any time — one button, no ` +
            `sign-in, works immediately and forever: ${unsubUrl}`
        ),
      ],
      footer: [[event.name, whenLine, venue].filter(Boolean).join(' · ')],
    });

    const mailed = await sendMailAs('buyers', {
      replyTo: replyToBuyers(),
      to,
      subject: headline,
      text,
      // The standard machine-readable way out, on top of the visible link —
      // mail clients surface it as their own Unsubscribe button. RFC 8058
      // one-click: the client POSTs to the API endpoint, which acts at once —
      // unlike the visible page link, which waits for a human button press so
      // that link-prefetching mail scanners cannot unsubscribe anyone.
      headers: {
        'List-Unsubscribe': `<${oneClickUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
      html: renderEmail({
        title: headline,
        preheader: `${organizerName} just published ${event.name} — you asked them to keep you posted.`,
        kicker: 'New from an organizer you follow',
        headline: event.name,
        metaLines: [whenLine, venue],
        bodyHtml,
        footerLines: [
          `${escapeHtml(event.name)}${whenLine ? ` · ${escapeHtml(whenLine)}` : ''}`,
          escapeHtml(venue),
          `You are getting this because you ticked "keep me posted" about ${escapeHtml(organizerName)} at a ` +
            `checkout on ${escapeHtml(platformName())}. ` +
            `<a class="brandtext" href="${escapeHtml(unsubUrl)}" style="color:${C.brandDeep};font-weight:600;">Unsubscribe</a> ` +
            `any time — one button, no sign-in.`,
        ],
      }),
    });
    if (!mailed.sent) return mailed;
    return { sent: true };
  } catch (err) {
    console.error('[email] Failed to send announcement:', err instanceof Error ? err.message : err);
    return { sent: false, reason: 'send-failed' };
  }
}

/**
 * The double-opt-in confirmation: one email asking the address's owner to
 * press a button before they hear anything from the organizer. Anyone can
 * type any address into a checkout, so the tick alone must never subscribe —
 * this email is the proof-of-ownership step, and it is deliberately neutral:
 * no event pitch, no links except the confirm button, because a confirmation
 * request that advertises is itself the marketing it is supposed to gate.
 *
 * Refuses to send when no confirm link can be built (unsigned deployment or
 * no pending row): a confirmation email without a working button is spam.
 * Never throws — the orders route fires and forgets it.
 */
export async function sendMarketingConfirmationEmail(
  to: string,
  organizerId: string
): Promise<{ sent: boolean; reason?: string }> {
  try {
    if (!isEmailConfigured()) return { sent: false, reason: 'email-not-configured' };
    const confirmUrl = confirmSubscriptionUrl(organizerId, to);
    if (!confirmUrl) return { sent: false, reason: 'confirm-unavailable' };

    const organizerName = organizerDisplayName(organizerId) || 'the organizer';
    const headline = `Confirm it: hear from ${organizerName} on ${platformName()}`;

    const bodyHtml =
      pHtml(`Hi,`) +
      pHtml(
        `At a ${escapeHtml(platformName())} checkout just now, someone asked ${strong(organizerName)} ` +
          `to keep this address posted about their future listings. Nothing is sent until you say so yourself:`,
        20
      ) +
      buttonHtml(confirmUrl, 'Yes, keep me posted') +
      buttonNoteHtml(`One press and you are on the list — at most one email per new listing, unsubscribe any time.`) +
      smallHtml(
        `Not you, or changed your mind? Do nothing. Without that button press this address is never ` +
          `subscribed, and this is the only email about it.`
      );

    const text = renderText({
      headline,
      lines: [
        'Hi,',
        '',
        wrapText(
          `At a ${platformName()} checkout just now, someone asked ${organizerName} to keep this ` +
            `address posted about their future listings. Nothing is sent until you say so yourself.`
        ),
        '',
        `Yes, keep me posted: ${confirmUrl}`,
        '',
        wrapText(
          `Not you, or changed your mind? Do nothing. Without that confirmation this address is ` +
            `never subscribed, and this is the only email about it.`
        ),
      ],
    });

    const mailed = await sendMailAs('buyers', {
      replyTo: replyToBuyers(),
      to,
      subject: headline,
      text,
      html: renderEmail({
        title: headline,
        preheader: `One button press subscribes you to ${organizerName}'s announcements — doing nothing does nothing.`,
        kicker: 'Please confirm',
        headline: `Hear from ${organizerName}?`,
        bodyHtml,
        footerLines: [
          `Sent because "keep me posted" was ticked at a ${escapeHtml(organizerName)} checkout on ` +
            `${escapeHtml(platformName())}. If that was not you, no action is needed.`,
        ],
      }),
    });
    if (!mailed.sent) return mailed;
    return { sent: true };
  } catch (err) {
    console.error('[email] Failed to send marketing confirmation:', err instanceof Error ? err.message : err);
    return { sent: false, reason: 'send-failed' };
  }
}

/**
 * Tell somebody their friends' bookings just earned them a voucher.
 *
 * Says plainly WHOSE thank-you this is: the ORGANIZER grants the discount, on
 * their own prices, and the buyer will simply transfer less money to them. The
 * platform never holds or funds any part of it and takes nothing — so this
 * mail must never read as the platform handing out money.
 *
 * Best-effort like every send here: the voucher exists in the database whether
 * or not this arrives, and it is also shown on the referrer's own order page.
 */
export async function sendReferralRewardEmail(
  voucherId: string,
  eventId: string
): Promise<{ sent: boolean; reason?: string }> {
  try {
    if (!isEmailConfigured()) return { sent: false, reason: 'email-not-configured' };

    const voucher = getVoucher(voucherId);
    if (!voucher) return { sent: false, reason: 'voucher-not-found' };
    const to = (voucher.referrerEmail || '').trim();
    if (!to) return { sent: false, reason: 'no-recipient' };

    const event = getEventById(eventId);
    const v = vocabFor(event?.kind ?? 'event');
    const organizerName = organizerDisplayName(voucher.organizerId) || 'the organizer';
    const amount = formatMoney(voucher.amountCents, event?.currency ?? organizerCurrency(voucher.organizerId));
    const eventUrl = event ? `${getBaseUrl()}/e/${event.slug}` : getBaseUrl();
    const headline = `${organizerName} has a ${amount} thank-you for you`;

    const bodyHtml =
      pHtml(`Hi,`) +
      pHtml(
        `Friends of yours booked through your share link${event ? ` for ${strong(event.name)}` : ''} — enough ` +
          `of them that ${strong(organizerName)} would like to say thank you with ${strong(amount)} off your ` +
          `next booking with them.`,
        20
      ) +
      referenceBoxHtml(
        'Your voucher code',
        voucher.code,
        `Type it into the &ldquo;Have a discount code?&rdquo; box at checkout and ${escapeHtml(amount)} comes ` +
          `straight off your total.`
      ) +
      pHtml(
        `It works on any ${escapeHtml(v.listing)} from ${strong(organizerName)}, it is yours to use once, and ` +
          `there is no expiry date on it.`,
        20
      ) +
      buttonHtml(eventUrl, event ? `See what ${organizerName} has on` : 'Have a look') +
      smallHtml(
        `${escapeHtml(organizerName)} is giving this discount on their own ${escapeHtml(v.units)}, at their own ` +
          `prices — you simply pay them less. ${escapeHtml(platformName())} is free, never handles the money, ` +
          `and takes nothing from it.`
      );

    const text = renderText({
      headline,
      context: event ? [event.name] : [],
      lines: [
        'Hi,',
        '',
        wrapText(
          `Friends of yours booked through your share link${event ? ` for ${event.name}` : ''} — enough of ` +
            `them that ${organizerName} would like to say thank you with ${amount} off your next booking ` +
            `with them.`
        ),
        '',
        `Your voucher code: ${voucher.code}`,
        '',
        wrapText(
          `Type it into the "Have a discount code?" box at checkout and ${amount} comes straight off your ` +
            `total. It works on any ${v.listing} from ${organizerName}, it is yours to use once, and there ` +
            `is no expiry date on it.`
        ),
        '',
        `${event ? `See what ${organizerName} has on` : 'Have a look'}: ${eventUrl}`,
        '',
        wrapText(
          `${organizerName} is giving this discount on their own ${v.units}, at their own prices — you ` +
            `simply pay them less. ${platformName()} is free, never handles the money, and takes nothing ` +
            `from it.`
        ),
      ],
    });

    const mailed = await sendMailAs('buyers', {
      replyTo: replyToBuyers(),
      to,
      subject: headline,
      text,
      html: renderEmail({
        title: headline,
        preheader: `Your share link brought friends in — ${amount} off your next booking with ${organizerName}.`,
        kicker: 'Thank you',
        headline: `${amount} off, from ${organizerName}`,
        metaLines: event ? [event.name] : [],
        bodyHtml,
        footerLines: [
          `Sent because a ${escapeHtml(v.listing)} you booked was shared by you and friends booked through ` +
            `your link. ${escapeHtml(organizerName)} sets and grants this reward themselves on ` +
            `${escapeHtml(platformName())}.`,
        ],
      }),
    });
    if (!mailed.sent) return mailed;
    return { sent: true };
  } catch (err) {
    console.error('[email] Failed to send referral reward:', err instanceof Error ? err.message : err);
    return { sent: false, reason: 'send-failed' };
  }
}

// ---------------------------------------------------------------------------
// Vendor stalls (organizer ↔ organizer)
//
// A stall is a kind='shop' listing standing at a kind='event' listing with the
// host's consent (lib/stalls.ts). These three mails carry the consent flow —
// request, decision, removal — between the two organizers. No money moves at
// any point: buyers order from the shop's own page and pay the shop's own
// account, and booth rent between host and vendor is their offline business,
// which the platform never handles or mediates.
// ---------------------------------------------------------------------------

/**
 * Tell the host organizer a shop is asking for a stall at their event.
 *
 * Links to the shop's PUBLIC page rather than describing it, so the host
 * judges exactly what buyers would see before saying yes. Never throws — the
 * request row is already written, and the host also sees it in their portal.
 */
export async function sendStallRequestEmail(
  hostOrganizer: OrganizerContact,
  hostEvent: Pick<EventRow, 'id' | 'name' | 'dateDisplay'>,
  shop: Pick<EventRow, 'name' | 'slug' | 'organizerId'>,
  message: string
): Promise<{ sent: boolean; reason?: string }> {
  try {
    if (!isEmailConfigured()) return { sent: false, reason: 'email-not-configured' };

    const sellerName = organizerDisplayName(shop.organizerId) || 'a seller';
    const shopUrl = `${getBaseUrl()}/e/${shop.slug}`;
    const panelUrl = `${getBaseUrl()}/portal/events/${hostEvent.id}/edit?tab=stalls`;
    const headline = `${shop.name} wants a stall at ${hostEvent.name}`;

    const bodyHtml =
      pHtml(`Hi ${escapeHtml(hostOrganizer.name)},`) +
      pHtml(
        `${strong(sellerName)} would like to stand at ${strong(hostEvent.name)} with their shop ` +
          `<a class="brandtext" href="${escapeHtml(shopUrl)}" style="color:${C.brandDeep};font-weight:700;">${escapeHtml(shop.name)}</a>. ` +
          `That link is their public page — exactly what buyers would see.`,
        20
      ) +
      (message.trim() ? quoteHtml('Their message', multilineHtml(message.trim())) : '') +
      pHtml(
        `Approving puts their card in the &ldquo;Order ahead&rdquo; section of your event page, linking out ` +
          `to their shop. Buyers order from the shop and pay ${escapeHtml(sellerName)} directly — nothing ` +
          `about your own tickets or your own money changes, and you can remove the stall again at any time.`,
        20
      ) +
      buttonHtml(panelUrl, 'Decide in your portal') +
      smallHtml(
        `${escapeHtml(platformName())} never handles or mediates any payment between you and a vendor — ` +
          `booth rent, if any, is your own offline business.`
      );

    const text = renderText({
      headline,
      context: [hostEvent.dateDisplay],
      lines: [
        `Hi ${hostOrganizer.name},`,
        '',
        wrapText(
          `${sellerName} would like to stand at ${hostEvent.name} with their shop "${shop.name}". ` +
            `Their public page — exactly what buyers would see — is here: ${shopUrl}`
        ),
        ...(message.trim() ? ['', 'THEIR MESSAGE', wrapText(message.trim())] : []),
        '',
        wrapText(
          `Approving puts their card in the "Order ahead" section of your event page, linking out to ` +
            `their shop. Buyers order from the shop and pay ${sellerName} directly — nothing about your ` +
            `own tickets or your own money changes, and you can remove the stall again at any time.`
        ),
        '',
        `Decide in your portal: ${panelUrl}`,
        '',
        wrapText(
          `${platformName()} never handles or mediates any payment between you and a vendor — booth ` +
            `rent, if any, is your own offline business.`
        ),
      ],
      footer: [`${platformName()} · organizer portal`],
    });

    const mailed = await sendMailAs('organizers', {
      replyTo: replyToOrganizers(),
      to: hostOrganizer.email,
      subject: `Stall request for ${hostEvent.name}: ${shop.name}`,
      text,
      html: renderEmail({
        title: headline,
        preheader: `${sellerName} asks to stand at ${hostEvent.name} — view their shop and decide in your portal.`,
        kicker: 'Stall request',
        headline,
        metaLines: [hostEvent.dateDisplay],
        bodyHtml,
        footerLines: [
          `${escapeHtml(platformName())} · organizer portal`,
          'You are getting this because a shop asked for a stall at your event.',
        ],
      }),
    });
    if (!mailed.sent) return mailed;
    return { sent: true };
  } catch (err) {
    console.error('[email] Failed to send stall request:', err instanceof Error ? err.message : err);
    return { sent: false, reason: 'send-failed' };
  }
}

/**
 * Tell the shop owner the host has decided — approved or declined.
 *
 * Approved leads with what they gained (a card on the event page) and the one
 * useful next step: the per-event collection note. Never throws — the decision
 * is already committed, and their portal shows it either way.
 */
export async function sendStallDecisionEmail(
  shopOrganizer: OrganizerContact,
  hostEvent: Pick<EventRow, 'name' | 'slug' | 'dateDisplay'>,
  shop: Pick<EventRow, 'id' | 'name'>,
  decision: 'approved' | 'declined'
): Promise<{ sent: boolean; reason?: string }> {
  try {
    if (!isEmailConfigured()) return { sent: false, reason: 'email-not-configured' };

    const approved = decision === 'approved';
    const eventUrl = `${getBaseUrl()}/e/${hostEvent.slug}`;
    const panelUrl = `${getBaseUrl()}/portal/events/${shop.id}/edit?tab=stalls`;
    const headline = approved
      ? `You're in: ${shop.name} has a stall at ${hostEvent.name}`
      : `${hostEvent.name} declined your stall request`;

    const bodyHtml =
      pHtml(`Hi ${escapeHtml(shopOrganizer.name)},`) +
      (approved
        ? pHtml(
            `The organizer of <a class="brandtext" href="${escapeHtml(eventUrl)}" style="color:${C.brandDeep};font-weight:700;">${escapeHtml(hostEvent.name)}</a> ` +
              `said yes: ${strong(shop.name)} now has a card in the &ldquo;Order ahead&rdquo; section of their ` +
              `event page, linking to your shop. Buyers pre-order from your own page and pay your own ` +
              `account, exactly as they do today — and you scan your own collection codes at the event ` +
              `with your usual scanner link.`,
            20
          ) +
          pHtml(
            `One thing worth doing now: tell buyers where to find you at the event — ` +
              `&ldquo;Stall 4, food row, from 17:00&rdquo; — with the collection note in your portal.`,
            20
          ) +
          buttonHtml(panelUrl, 'Add your collection note')
        : pHtml(
            `The organizer of ${strong(hostEvent.name)} decided not to take ${strong(shop.name)} this ` +
              `time. Nothing about your shop changes — it stays live, buyers order as before, and you ` +
              `can ask this host again later or take your shop to another event from your portal.`,
            20
          ) + buttonHtml(panelUrl, 'Find another event'));

    const text = renderText({
      headline,
      lines: [
        `Hi ${shopOrganizer.name},`,
        '',
        wrapText(
          approved
            ? `The organizer of ${hostEvent.name} said yes: ${shop.name} now has a card in the ` +
                `"Order ahead" section of their event page (${eventUrl}), linking to your shop. Buyers ` +
                `pre-order from your own page and pay your own account, exactly as they do today — and ` +
                `you scan your own collection codes at the event with your usual scanner link.`
            : `The organizer of ${hostEvent.name} decided not to take ${shop.name} this time. Nothing ` +
                `about your shop changes — it stays live, buyers order as before, and you can ask this ` +
                `host again later or take your shop to another event from your portal.`
        ),
        '',
        approved
          ? wrapText(
              `One thing worth doing now: tell buyers where to find you at the event — "Stall 4, food ` +
                `row, from 17:00" — with the collection note in your portal: ${panelUrl}`
            )
          : `Your portal: ${panelUrl}`,
      ],
      footer: [`${platformName()} · organizer portal`],
    });

    const mailed = await sendMailAs('organizers', {
      replyTo: replyToOrganizers(),
      to: shopOrganizer.email,
      subject: approved
        ? `Approved: your stall at ${hostEvent.name}`
        : `Declined: your stall request for ${hostEvent.name}`,
      text,
      html: renderEmail({
        title: headline,
        preheader: approved
          ? `Your card is live on the event page — add a collection note so buyers can find your stall.`
          : `The host said no this time. Your shop is unchanged.`,
        kicker: approved ? 'Stall approved' : 'Stall declined',
        headline,
        metaLines: [hostEvent.dateDisplay],
        bodyHtml,
        footerLines: [
          `${escapeHtml(platformName())} · organizer portal`,
          'You are getting this because you asked for a stall at this event.',
        ],
      }),
    });
    if (!mailed.sent) return mailed;
    return { sent: true };
  } catch (err) {
    console.error('[email] Failed to send stall decision:', err instanceof Error ? err.message : err);
    return { sent: false, reason: 'send-failed' };
  }
}

/**
 * Tell the shop owner the host removed their approved stall.
 *
 * The card is already gone from the event page by the time this sends. The
 * mail's real job is the amber sentence: buyers may hold paid pre-orders they
 * placed expecting to collect at that event, and honouring or refunding those
 * is the shop owner's — money went buyer → shop, the platform holds nothing it
 * could give back. Never throws.
 */
export async function sendStallRevokedEmail(
  shopOrganizer: OrganizerContact,
  hostEvent: Pick<EventRow, 'name'>,
  shop: Pick<EventRow, 'id' | 'name'>
): Promise<{ sent: boolean; reason?: string }> {
  try {
    if (!isEmailConfigured()) return { sent: false, reason: 'email-not-configured' };

    const ordersUrl = `${getBaseUrl()}/portal/events/${shop.id}/orders`;
    const headline = `${hostEvent.name} removed your stall`;

    const bodyHtml =
      pHtml(`Hi ${escapeHtml(shopOrganizer.name)},`) +
      pHtml(
        `The organizer of ${strong(hostEvent.name)} has removed ${strong(shop.name)} from their event ` +
          `page. The card is gone as of now. Your shop itself is untouched — it stays live and buyers ` +
          `can still order from your own page.`,
        20
      ) +
      calloutHtml(
        `<strong>You may have pre-orders to honour or refund.</strong> Buyers who ordered expecting to ` +
          `collect at ${escapeHtml(hostEvent.name)} still hold paid orders — they were not cancelled, and ` +
          `their money went straight to you. Check your orders and tell those buyers how they get their ` +
          `items now, or pay them back yourself.`
      ) +
      buttonHtml(ordersUrl, 'Check your orders') +
      smallHtml(
        `If you think this was a mistake, talk to the host directly — a removed stall cannot be ` +
          `re-requested from the portal.`
      );

    const text = renderText({
      headline,
      lines: [
        `Hi ${shopOrganizer.name},`,
        '',
        wrapText(
          `The organizer of ${hostEvent.name} has removed ${shop.name} from their event page. The card ` +
            `is gone as of now. Your shop itself is untouched — it stays live and buyers can still ` +
            `order from your own page.`
        ),
        '',
        wrapText(
          `IMPORTANT: you may have pre-orders to honour or refund. Buyers who ordered expecting to ` +
            `collect at ${hostEvent.name} still hold paid orders — they were not cancelled, and their ` +
            `money went straight to you. Check your orders and tell those buyers how they get their ` +
            `items now, or pay them back yourself.`
        ),
        '',
        `Your orders: ${ordersUrl}`,
        '',
        wrapText(
          `If you think this was a mistake, talk to the host directly — a removed stall cannot be ` +
            `re-requested from the portal.`
        ),
      ],
      footer: [`${platformName()} · organizer portal`],
    });

    const mailed = await sendMailAs('organizers', {
      replyTo: replyToOrganizers(),
      to: shopOrganizer.email,
      subject: `Removed: your stall at ${hostEvent.name}`,
      text,
      html: renderEmail({
        title: headline,
        preheader: `Your card is off the event page. You may have pre-orders to honour or refund.`,
        kicker: 'Stall removed',
        headline,
        bodyHtml,
        footerLines: [
          `${escapeHtml(platformName())} · organizer portal`,
          'You are getting this because your approved stall at this event was removed by the host.',
        ],
      }),
    });
    if (!mailed.sent) return mailed;
    return { sent: true };
  } catch (err) {
    console.error('[email] Failed to send stall revocation:', err instanceof Error ? err.message : err);
    return { sent: false, reason: 'send-failed' };
  }
}
