// Server-only: buyer + organizer emails via SMTP (nodemailer).
// If SMTP is not configured the site still works — buyers see their tickets
// and payment instructions on the order page; this module just quietly
// reports { sent: false }.
import nodemailer from 'nodemailer';
import QRCode from 'qrcode';
import { getBaseUrl } from './config';
import {
  getEventById,
  getEventTier,
  paypalPayee,
  type PaypalPayee,
  type EventQuestionRow,
  type EventRow,
} from './events';
import { formatMoney } from './money';
import { getOrder, getOrderItems, getTicketsForOrder, paymentReference } from './orders';
import { orderPayout } from './payout';
import {
  eventFeeAmount,
  bareAddress,
  emailFromBuyers,
  emailFromOrganizers,
  platformContactEmail,
  platformNameFromEnv,
  platformWordmark,
  platformFeeLabel,
  platformFeeRule,
  type PlatformBank,
} from './platform';
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

/** The headline figure of a money mail. */
function amountRowHtml(caption: string, amount: string): string {
  return `
        <tr>
          <td align="center" style="padding:20px 20px 16px;border-bottom:1px solid ${C.line};">
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
}): string {
  const position = opts.total > 1 ? `Ticket ${opts.index} of ${opts.total}` : 'Your ticket';
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
                  <img src="cid:${escapeHtml(opts.cid)}" width="200" height="200" alt="QR code for ticket ${escapeHtml(opts.code)}" style="display:block;width:200px;max-width:100%;height:auto;background-color:#ffffff;">
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
            <p class="muted" style="margin:6px 0 0;color:${C.muted};font-size:13px;line-height:1.5;">Admits one person · ${escapeHtml(opts.buyerName)}</p>
          </td>
        </tr>
      </table>`;
}

/**
 * Send the buyer their tickets for a PAID order. Never throws — payment flow
 * must not fail because email is down or unconfigured.
 */
export async function sendTicketEmail(orderId: string): Promise<{ sent: boolean; reason?: string }> {
  try {
    if (!isEmailConfigured()) return { sent: false, reason: 'email-not-configured' };

    const order = getOrder(orderId);
    if (!order) return { sent: false, reason: 'order-not-found' };
    if (order.status !== 'paid') return { sent: false, reason: 'order-not-paid' };

    const tickets = getTicketsForOrder(orderId);
    if (tickets.length === 0) return { sent: false, reason: 'no-tickets' };

    const event = getEventById(order.eventId);
    if (!event) return { sent: false, reason: 'event-not-found' };
    const venue = venueDisplay(event);
    const items = getOrderItems(orderId);
    const hasStudentTickets = items.some((it) => getEventTier(event.id, it.tierId)?.studentOnly === true);
    const orderUrl = `${getBaseUrl()}/order/${orderId}`;
    const tierName = (tierId: string) => getEventTier(event.id, tierId)?.name ?? tierId;
    const total = formatMoney(order.totalCents, order.currency);
    const one = tickets.length === 1;

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
          when: event.dateDisplay,
        })
      )
      .join('');

    const ticketCount = one ? 'Your ticket is' : tickets.length === 2 ? 'Both tickets are' : `All ${tickets.length} tickets are`;
    const bodyHtml =
      pHtml(`Hi ${escapeHtml(order.buyerName)},`) +
      pHtml(
        `Payment received — thank you! ${ticketCount} below. ` +
          `Show the QR code at the door, we scan it, and you are in.`,
        20
      ) +
      stubsHtml +
      pHtml(`Total paid: ${strong(total)}`, 20) +
      buttonHtml(orderUrl, one ? 'Open your ticket online' : 'Open your tickets online') +
      buttonNoteHtml('Same tickets, always up to date — handy for printing or if this email gets lost.') +
      (hasStudentTickets
        ? `<div style="margin-top:20px;">${calloutHtml(
            `<strong>Student ticket${one ? '' : 's'}:</strong> bring a valid student ID for each student ticket. ` +
              `It is checked at the door.`
          )}</div>`
        : '') +
      smallHtml(
        `Each ticket admits one person and can be scanned once. A screenshot works just as well as paper — ` +
          `just make sure the code is sharp. See you at the show!`
      );

    const html = renderEmail({
      title: `Your ticket${one ? '' : 's'} for ${event.name}`,
      preheader: `Payment received. ${one ? 'Your QR ticket is' : `Your ${tickets.length} QR tickets are`} in this email — show ${one ? 'it' : 'them'} at the door.`,
      kicker: 'Payment received',
      headline: event.name,
      metaLines: [event.dateDisplay, venue],
      bodyHtml,
      footerLines: [
        `${escapeHtml(event.name)} · ${escapeHtml(event.dateDisplay)}`,
        escapeHtml(venue),
        `Order ${escapeHtml(orderId)}`,
        `You are getting this because you bought tickets on ${escapeHtml(platformName())}.`,
      ],
    });

    const text = renderText({
      headline: `Payment received — thank you, ${order.buyerName}!`,
      context: [event.name, event.dateDisplay, venue],
      lines: [
        wrapText(
          `${ticketCount} listed below. The QR codes are in the HTML version of this email — if you ` +
            `cannot see them, open your order page and show the code there.`
        ),
        '',
        ...tickets.flatMap((t, i) => [
          tickets.length > 1 ? `TICKET ${i + 1} OF ${tickets.length}` : 'YOUR TICKET',
          ...textRows([
            ['Code', t.code],
            ['Type', tierName(t.tierId)],
          ]),
          '',
        ]),
        `Total paid: ${total}`,
        '',
        `Your tickets: ${orderUrl}`,
        '',
        wrapText(
          'Each ticket admits one person and can be scanned once. A screenshot works just as ' +
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
      footer: [`${event.name} · ${event.dateDisplay} · ${venue}`, `Order ${orderId}`],
    });

    await createTransporter().sendMail({
      from: emailFromBuyers(),
      replyTo: bareAddress(emailFromBuyers()),
      to: order.buyerEmail,
      subject: `Your ${one ? 'ticket' : `${tickets.length} tickets`} for ${event.name}`,
      text,
      html,
      attachments,
    });

    return { sent: true };
  } catch (err) {
    console.error('[email] Failed to send ticket email:', err instanceof Error ? err.message : err);
    return { sent: false, reason: 'send-failed' };
  }
}

// ---------------------------------------------------------------------------
// Bank-transfer instructions email (order is CLAIMED — seats reserved)
// ---------------------------------------------------------------------------

/**
 * Send bank-transfer payment instructions for a freshly reserved order.
 * Never throws — the buyer sees the same instructions on the order page.
 */
/**
 * The "you can also use PayPal" line, for buyer mails that print bank details.
 *
 * Deliberately a note beside the bank panel rather than a second panel of its
 * own: it is the same amount, to the same person, with the same reference —
 * only the pipe differs. Returns '' when the organizer offers no PayPal, so
 * every call site can concatenate it unconditionally.
 */
function paypalNoteHtml(payee: PaypalPayee | null, reference: string, amount: string): string {
  if (!payee) return '';
  // GREEN, and placed ABOVE the bank panel at every call site: PayPal clears in
  // seconds where a transfer takes 1-2 business days, so the buyer who takes
  // this route has their QR tickets the same evening. Green marks the FAST one,
  // not one anyone profits from — the money reaches the organizer either way
  // and the platform takes nothing from ticket sales.
  //
  // Its own table rather than calloutHtml(), which is amber and reads as a
  // warning. Inline styles because email clients discard stylesheets.
  return `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0f2a20" style="margin:0 0 18px;background-color:#0f2a20;border:1px solid #34d399;border-left:4px solid #34d399;border-radius:12px;">
        <tr>
          <td style="padding:16px 18px;color:#d1fae5;font-size:15px;line-height:1.55;">
            <span style="color:#34d399;font-weight:800;">Fastest: pay by PayPal</span><br>
            Send ${strong(escapeHtml(payee.handle))} ${strong(escapeHtml(amount))} and put
            ${strong(escapeHtml(reference))} in PayPal&#39;s message field. It arrives in seconds,
            so your QR tickets can be sent straight away — a bank transfer takes 1&ndash;2 business
            days. It reaches the same organizer either way: pay one way or the other, not both.
          </td>
        </tr>
      </table>`;
}

/** Plain-text twin of paypalNoteHtml. Empty array when there is no PayPal. */
function paypalNoteText(payee: PaypalPayee | null, reference: string, amount: string): string[] {
  if (!payee) return [];
  return [
    '',
    'FASTEST: PAY BY PAYPAL',
    wrapText(
      `Send ${payee.handle} ${amount} and put ${reference} in PayPal's message field. It ` +
        `arrives in seconds, so your QR tickets can be sent straight away — a bank transfer takes ` +
        `1-2 business days. It reaches the same organizer either way: pay one way or the other, ` +
        `not both.`
    ),
  ];
}

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
    if (!payout.iban.trim() || !payout.holder.trim()) {
      return { sent: false, reason: 'transfer-not-configured' };
    }
    const bank = {
      accountHolder: payout.holder,
      iban: payout.iban,
      bic: payout.bic,
      bankName: payout.bankName,
      payWithinDays: event.payWithinDays,
    };
    // From the order's own snapshot, exactly like the bank rows beside it — the
    // two must describe the same moment, or an organizer who later added PayPal
    // would have it offered on instructions that never mentioned it.
    const payee = paypalPayee({ paypalAccount: payout.paypal });
    const offersPaypal = payee !== null;

    const venue = venueDisplay(event);
    const orderUrl = `${getBaseUrl()}/order/${orderId}`;
    const reference = paymentReference(orderId);
    const hasStudentTickets = getOrderItems(orderId).some(
      (it) => getEventTier(event.id, it.tierId)?.studentOnly === true
    );
    const amount = formatMoney(order.totalCents, order.currency);
    const deadline = new Date(Date.parse(order.createdAt.replace(' ', 'T') + 'Z') + bank.payWithinDays * 86_400_000);
    const deadlineDisplay = deadline.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    const bankRows: DetailRow[] = [
      { label: 'Account holder', value: bank.accountHolder },
      { label: 'IBAN', value: bank.iban, mono: true },
      ...(bank.bic ? [{ label: 'BIC', value: bank.bic, mono: true }] : []),
      ...(bank.bankName ? [{ label: 'Bank', value: bank.bankName }] : []),
    ];

    const bodyHtml =
      pHtml(`Hi ${escapeHtml(order.buyerName)},`) +
      pHtml(
        `Your seats are held. To turn them into tickets, ${offersPaypal ? 'send the money' : 'send a bank transfer'} by ` +
          `${strong(deadlineDisplay)} — everything you need is here.`,
        20
      ) +
      paypalNoteHtml(payee, reference, amount) +
      panelHtml(amountRowHtml('Amount to transfer', amount) + detailRowsHtml(bankRows)) +
      referenceBoxHtml(
        'Payment reference — required',
        reference,
        `Put this in the transfer&#39;s purpose line (&quot;Verwendungszweck&quot;). It is how your payment finds ` +
          `your tickets.${hasStudentTickets ? ' The <strong>S-</strong> marks an order with student tickets.' : ''}`
      ) +
      pHtml(
        `Once the money lands — usually one or two working days — your QR tickets are emailed to you automatically. ` +
          `Nothing else to do.`,
        20
      ) +
      buttonHtml(orderUrl, 'View your order') +
      buttonNoteHtml('Worth bookmarking: your tickets appear on that page too.') +
      (hasStudentTickets
        ? `<div style="margin-top:20px;">${calloutHtml(
            `<strong>Student tickets:</strong> bring a valid student ID for each student ticket. It is checked at the door.`
          )}</div>`
        : '') +
      smallHtml(`If no payment arrives by ${escapeHtml(deadlineDisplay)}, the seats go back on sale.`);

    const html = renderEmail({
      title: `Your tickets for ${event.name} are reserved`,
      preheader: `Send ${amount} with reference ${reference} by ${deadlineDisplay} and your tickets are on their way.`,
      kicker: 'Seats reserved',
      headline: event.name,
      metaLines: [event.dateDisplay, venue],
      bodyHtml,
      footerLines: [
        `${escapeHtml(event.name)} · ${escapeHtml(event.dateDisplay)}`,
        escapeHtml(venue),
        `Order ${escapeHtml(orderId)}`,
        `You are getting this because you reserved tickets on ${escapeHtml(platformName())}.`,
      ],
    });

    const text = renderText({
      headline: `Your tickets for ${event.name} are reserved, ${order.buyerName}!`,
      context: [event.dateDisplay, venue],
      lines: [
        wrapText(
          `To complete your order, ${offersPaypal ? 'send the money' : 'send a bank transfer'} by ${deadlineDisplay}:`
        ),
        // Above the bank rows, matching the HTML. The plain-text twin used to
        // trail them, so the reader who gets text-only — which is every reader
        // whose client blocks HTML — was steered to the slower method by the
        // simple fact of it coming first.
        ...paypalNoteText(payee, reference, amount),
        '',
        ...textRows([
          ['Amount', amount],
          ['Account holder', bank.accountHolder],
          ['IBAN', bank.iban],
          ...(bank.bic ? ([['BIC', bank.bic]] as Array<[string, string]>) : []),
          ...(bank.bankName ? ([['Bank', bank.bankName]] as Array<[string, string]>) : []),
          ['Reference', reference],
        ]),
        '',
        wrapText(
          `IMPORTANT: the reference ${reference} must go in the transfer's purpose line ` +
            `("Verwendungszweck"). It is how your payment finds your tickets.`
        ),
        ...(hasStudentTickets
          ? [
              '',
              wrapText(
                'The "S-" in your reference marks an order with student tickets. Bring a valid ' +
                  'student ID for each of them — it is checked at the door.'
              ),
            ]
          : []),
        '',
        wrapText(
          'Once the money lands — usually one or two working days — your QR tickets are ' +
            'emailed to you automatically. Nothing else to do.'
        ),
        '',
        `Your order: ${orderUrl}`,
        '',
        wrapText(`If no payment arrives by ${deadlineDisplay}, the seats go back on sale.`),
      ],
      footer: [`${event.name} · ${event.dateDisplay} · ${venue}`, `Order ${orderId}`],
    });

    await createTransporter().sendMail({
      from: emailFromBuyers(),
      replyTo: bareAddress(emailFromBuyers()),
      to: order.buyerEmail,
      subject: `Reserved: your tickets for ${event.name} — payment details inside`,
      text,
      html,
    });

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

    await createTransporter().sendMail({
      from: emailFromOrganizers(),
      replyTo: bareAddress(emailFromOrganizers()),
      to: organizer.email,
      subject: `${awaiting.length} payment${one ? '' : 's'} to check — ${totals} expected`,
      text,
      html,
    });
    return { sent: true };
  } catch (err) {
    console.error('[email] Failed to send transfer reminder:', err instanceof Error ? err.message : err);
    return { sent: false, reason: 'send-failed' };
  }
}

// ---------------------------------------------------------------------------
// Platform fee emails (organizer ← platform owner)
//
// The platform's fee is charged PER EVENT: the organizer transfers it to the
// platform's own account with the event's Verwendungszweck, and publishing
// unlocks when the owner confirms the transfer. These three mails carry those
// details into the organizer's inbox so they are never only on screen.
// ---------------------------------------------------------------------------

export interface FeePaymentDetails {
  /**
   * The headline figure: one event's own fee ('€50.00') where an event is
   * known, or the pricing model ('from €15.00 per event') where none is.
   */
  feeLabel: string;
  /** Caption above it. Defaults to 'Amount to transfer'. */
  amountCaption?: string;
  /** The PLATFORM's bank account (never an organizer's). */
  bank: PlatformBank;
  /** The Verwendungszweck to put in the transfer's purpose line. */
  reference: string;
}

export interface OrganizerContact {
  name: string;
  email: string;
}

/**
 * Amount + the platform's bank details — the same box the organizer sees on
 * screen, so both match exactly.
 */
function feeBankPanelHtml(details: FeePaymentDetails): string {
  const { feeLabel, bank } = details;
  const rows: DetailRow[] = [
    { label: 'Account holder', value: bank.accountHolder },
    { label: 'IBAN', value: bank.iban, mono: true },
    ...(bank.bic ? [{ label: 'BIC', value: bank.bic, mono: true }] : []),
    ...(bank.bankName ? [{ label: 'Bank', value: bank.bankName }] : []),
  ];
  return panelHtml(amountRowHtml(details.amountCaption ?? 'Amount to transfer', feeLabel) + detailRowsHtml(rows));
}

/** Plain-text twin of the bank box. */
function feeBankBoxText(details: FeePaymentDetails): string[] {
  const { feeLabel, bank, reference } = details;
  return textRows([
    ['Amount', feeLabel],
    ['Account holder', bank.accountHolder],
    ['IBAN', bank.iban],
    ...(bank.bic ? ([['BIC', bank.bic]] as Array<[string, string]>) : []),
    ...(bank.bankName ? ([['Bank', bank.bankName]] as Array<[string, string]>) : []),
    ['Verwendungszweck', reference],
  ]);
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
        `The account itself is free. You pay only when you publish an event, and the price follows the size of ` +
          `your room: <strong>${escapeHtml(platformFeeRule())}</strong>, so a 500-person event costs ` +
          `${escapeHtml(eventFeeAmount(500))}. No yearly fee, and we never take a cut of your ticket sales.`
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
          `The account itself is free. You pay only when you publish an event, and the price follows ` +
            `the size of your room: ${platformFeeRule()}, so a 500-person event costs ${eventFeeAmount(500)}. ` +
            `No yearly fee, and we never take a cut of your ticket sales.`
        ),
        ...(contactEmail ? ['', wrapText(`Stuck? Reply to this email, or write to ${contactEmail}.`)] : []),
      ],
      footer: [`${name} · organizer portal`],
    });

    await createTransporter().sendMail({
      from: emailFromOrganizers(),
      to: organizer.email,
      ...(contactEmail ? { replyTo: contactEmail } : {}),
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
    return { sent: true };
  } catch (err) {
    // Deliberately terse: nothing about this failure may echo the password.
    console.error('[email] Failed to send organizer credentials:', err instanceof Error ? err.message : err);
    return { sent: false, reason: 'send-failed' };
  }
}

/**
 * The fee for ONE event: sent when an organizer tries to publish an event whose
 * fee has not arrived yet, so the IBAN and that event's Verwendungszweck are in
 * their inbox while they open their banking app. Never throws.
 */
export async function sendEventFeeInstructionsEmail(
  organizer: OrganizerContact,
  event: { id: string; name: string },
  details: FeePaymentDetails
): Promise<{ sent: boolean; reason?: string }> {
  try {
    if (!isEmailConfigured()) return { sent: false, reason: 'email-not-configured' };

    const publishUrl = `${getBaseUrl()}/portal/events/${event.id}/edit?tab=publish`;
    const { feeLabel, reference } = details;

    const bodyHtml =
      pHtml(`Hi ${escapeHtml(organizer.name)},`) +
      pHtml(
        `${strong(event.name)} is ready to go live. One thing left: the ${strong(feeLabel)} fee for it. ` +
          `Here is everything your banking app needs.`,
        20
      ) +
      feeBankPanelHtml(details) +
      referenceBoxHtml(
        'Verwendungszweck — required',
        reference,
        `Copy it into the purpose line exactly as shown. It is how your transfer finds ` +
          `<strong>${escapeHtml(event.name)}</strong>.`
      ) +
      pHtml(`As soon as we see the money we unlock publishing — usually within a day — and email you.`, 20) +
      buttonHtml(publishUrl, 'Open the Publish tab') +
      smallHtml(
        `Charged once for this event and based on the capacity you set (${escapeHtml(platformFeeRule())}). ` +
          `It covers the lot: your page, QR tickets, door scanning and reminders. No commission on ticket sales.`
      );

    const text = renderText({
      headline: `The fee for "${event.name}"`,
      lines: [
        `Hi ${organizer.name},`,
        '',
        wrapText(
          `"${event.name}" is ready to go live. One thing left: the ${feeLabel} fee for it. ` +
            `Here is everything your banking app needs.`
        ),
        '',
        ...feeBankBoxText(details),
        '',
        wrapText(
          `IMPORTANT: "${reference}" must go in the transfer's purpose line (Verwendungszweck). ` +
            `It is how your transfer finds "${event.name}".`
        ),
        '',
        wrapText('As soon as we see the money we unlock publishing — usually within a day — and email you.'),
        '',
        `Publish tab: ${publishUrl}`,
      ],
      footer: [
        wrapText(
          `Charged once for this event, based on the capacity you set (${platformFeeRule()}). ` +
            `No commission on your ticket sales.`
        ),
      ],
    });

    await createTransporter().sendMail({
      from: emailFromOrganizers(),
      replyTo: bareAddress(emailFromOrganizers()),
      to: organizer.email,
      subject: `Publish “${event.name}” — ${feeLabel} transfer details inside`,
      text,
      html: renderEmail({
        title: `The fee for ${event.name}`,
        preheader: `Transfer ${feeLabel} with reference ${reference} to unlock publishing for ${event.name}.`,
        kicker: 'Almost live',
        headline: `Your fee for ${event.name}`,
        bodyHtml,
        footerLines: [
          `${escapeHtml(platformName())} · organizer portal`,
          'You are getting this because you asked to publish this event.',
        ],
      }),
    });
    return { sent: true };
  } catch (err) {
    console.error('[email] Failed to send event fee instructions:', err instanceof Error ? err.message : err);
    return { sent: false, reason: 'send-failed' };
  }
}

/**
 * The platform owner confirmed an event's fee: publishing is unlocked.
 * Never throws — the portal shows the same state anyway.
 */
export async function sendEventLiveEmail(
  organizer: OrganizerContact,
  event: { id: string; name: string }
): Promise<{ sent: boolean; reason?: string }> {
  try {
    if (!isEmailConfigured()) return { sent: false, reason: 'email-not-configured' };

    const publishUrl = `${getBaseUrl()}/portal/events/${event.id}/edit?tab=publish`;

    const bodyHtml =
      pHtml(`Hi ${escapeHtml(organizer.name)},`) +
      pHtml(
        `Your transfer arrived. The fee for ${strong(event.name)} is paid and publishing is unlocked.`,
        20
      ) +
      pHtml(
        `Open the Publish tab, give the page a last look, and press <strong>Publish event</strong>. It goes into ` +
          `the public feed straight away and people can start reserving tickets.`,
        20
      ) +
      buttonHtml(publishUrl, 'Publish your event') +
      smallHtml(
        `Ticket money goes straight to the bank account on your event — we never touch it. Good luck with the show!`
      );

    const text = renderText({
      headline: `"${event.name}" can go live`,
      lines: [
        `Hi ${organizer.name},`,
        '',
        wrapText(`Your transfer arrived. The fee for "${event.name}" is paid and publishing is unlocked.`),
        '',
        wrapText(
          'Open the Publish tab, give the page a last look, and press "Publish event". It goes into ' +
            'the public feed straight away and people can start reserving tickets.'
        ),
        '',
        `Publish tab: ${publishUrl}`,
      ],
      footer: [
        wrapText('Ticket money goes straight to the bank account on your event — we never touch it. Good luck!'),
      ],
    });

    await createTransporter().sendMail({
      from: emailFromOrganizers(),
      replyTo: bareAddress(emailFromOrganizers()),
      to: organizer.email,
      subject: `“${event.name}” can go live now`,
      text,
      html: renderEmail({
        title: `${event.name} can go live`,
        preheader: `The fee for ${event.name} is confirmed — publishing is unlocked.`,
        kicker: 'Fee confirmed',
        headline: `${event.name} can go live`,
        bodyHtml,
        footerLines: [
          `${escapeHtml(platformName())} · organizer portal`,
          'You are getting this because you run this event.',
        ],
      }),
    });
    return { sent: true };
  } catch (err) {
    console.error('[email] Failed to send event-live email:', err instanceof Error ? err.message : err);
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
    if (!payout.iban.trim() || !payout.holder.trim()) {
      return { sent: false, reason: 'transfer-not-configured' };
    }
    const payee = paypalPayee({ paypalAccount: payout.paypal });
    const offersPaypal = payee !== null;

    const venue = venueDisplay(event);
    const amount = formatMoney(order.totalCents, order.currency);
    const reference = paymentReference(orderId);
    const orderUrl = `${getBaseUrl()}/order/${orderId}`;
    const deadline = new Date(
      Date.parse(order.createdAt.replace(' ', 'T') + 'Z') + event.payWithinDays * 86_400_000
    );
    const deadlineDisplay = deadline.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    const alreadyPaid =
      'Bank transfers take a few days to land, and we confirm them by hand. You do not need to do anything, ' +
      'and you certainly should not pay twice.';

    const bankRows: DetailRow[] = [
      { label: 'Account holder', value: payout.holder },
      { label: 'IBAN', value: payout.iban, mono: true },
      ...(payout.bic ? [{ label: 'BIC', value: payout.bic, mono: true }] : []),
      ...(payout.bankName ? [{ label: 'Bank', value: payout.bankName }] : []),
    ];

    const bodyHtml =
      pHtml(`Hi ${escapeHtml(order.buyerName)},`) +
      pHtml(
        `Your seats are still held, but we have not seen your ${offersPaypal ? 'payment' : 'bank transfer'} yet.`,
        20
      ) +
      calloutHtml(`<strong>Already sent it?</strong> Then all is well. ${escapeHtml(alreadyPaid)}`) +
      pHtml(
        `Not yet? Here are the details again. Please send it by ${strong(deadlineDisplay)}, otherwise the seats ` +
          `go back on sale.`,
        20
      ) +
      paypalNoteHtml(payee, reference, amount) +
      panelHtml(amountRowHtml('Amount to transfer', amount) + detailRowsHtml(bankRows)) +
      referenceBoxHtml(
        'Payment reference — required',
        reference,
        `Put this in the transfer&#39;s purpose line (&quot;Verwendungszweck&quot;) so your payment finds your tickets.`
      ) +
      buttonHtml(orderUrl, 'View your order') +
      smallHtml('Your QR tickets arrive by email the moment the payment is confirmed.');

    const html = renderEmail({
      title: `Your tickets for ${event.name} are still reserved`,
      preheader: `We have not seen your transfer for ${event.name} yet — the details are inside.`,
      kicker: 'Still reserved',
      headline: event.name,
      metaLines: [event.dateDisplay, venue],
      bodyHtml,
      footerLines: [
        `${escapeHtml(event.name)} · ${escapeHtml(event.dateDisplay)}`,
        escapeHtml(venue),
        `Order ${escapeHtml(orderId)}`,
        `You are getting this because you reserved tickets on ${escapeHtml(platformName())}.`,
      ],
    });

    const text = renderText({
      headline: `Your tickets for ${event.name} are still reserved`,
      context: [event.dateDisplay, venue],
      lines: [
        `Hi ${order.buyerName},`,
        '',
        wrapText(
          `Your seats are still held, but we have not seen your ${offersPaypal ? 'payment' : 'bank transfer'} yet.`
        ),
        '',
        wrapText(`ALREADY SENT IT? Then all is well. ${alreadyPaid}`),
        '',
        wrapText(
          `Not yet? Here are the details again. Please send it by ${deadlineDisplay}, otherwise the ` +
            `seats go back on sale.`
        ),
        ...paypalNoteText(payee, reference, amount),
        '',
        ...textRows([
          ['Amount', amount],
          ['Account holder', payout.holder],
          ['IBAN', payout.iban],
          ...(payout.bic ? ([['BIC', payout.bic]] as Array<[string, string]>) : []),
          ...(payout.bankName ? ([['Bank', payout.bankName]] as Array<[string, string]>) : []),
          ['Reference', reference],
        ]),
        '',
        wrapText(
          `IMPORTANT: put the reference ${reference} in the transfer's purpose line ` +
            `("Verwendungszweck") so your payment finds your tickets.`
        ),
        '',
        `Your order: ${orderUrl}`,
        '',
        wrapText('Your QR tickets arrive by email the moment the payment is confirmed.'),
      ],
      footer: [`${event.name} · ${event.dateDisplay} · ${venue}`, `Order ${orderId}`],
    });

    await createTransporter().sendMail({
      from: emailFromBuyers(),
      replyTo: bareAddress(emailFromBuyers()),
      to: order.buyerEmail,
      subject: `Reminder: your tickets for ${event.name} are still reserved`,
      text,
      html,
    });
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

    await createTransporter().sendMail({
      from: emailFromOrganizers(),
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
    const feeLabel = platformFeeLabel();
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
              `right we set your account up and email you the sign-in details. The account is free — you pay ` +
              `only when you publish an event (${escapeHtml(feeLabel)}). Forgot to mention something? Just reply.`
          : `<strong>Good to know</strong><br>The standard event page — photos, video, ticket tiers, QR tickets ` +
              `and door scanning — is already in the normal event fee (${escapeHtml(feeLabel)}). What we quote ` +
              `you for is the design work on top.`
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
                `your account up and email you the sign-in details. The account is free — you pay only when ` +
                `you publish an event (${feeLabel}). Forgot to mention something? Just reply.`
            : `GOOD TO KNOW: the standard event page (photos, video, ticket tiers, QR tickets and door ` +
                `scanning) is already in the normal event fee (${feeLabel}). What we quote you for is the ` +
                `design work on top.`
        ),
        '',
        'WHAT YOU SENT US',
        request.message,
        '',
        wrapText(`Anything to add? Reply to this email, or write to ${contactEmail}.`),
      ],
      footer: [`${name} · ${getBaseUrl()}`],
    });

    await createTransporter().sendMail({
      from: wantsAccount ? emailFromOrganizers() : emailFromBuyers(),
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

    await createTransporter().sendMail({
      from: emailFromBuyers(),
      replyTo: bareAddress(emailFromBuyers()),
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

    await createTransporter().sendMail({
      from: emailFromOrganizers(),
      replyTo: bareAddress(emailFromOrganizers()),
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

    const transporter = createTransporter();
    await transporter.sendMail({
      from: emailFromOrganizers(),
      replyTo: bareAddress(emailFromOrganizers()),
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
        await transporter.sendMail({
          from: emailFromOrganizers(),
          replyTo: bareAddress(emailFromOrganizers()),
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
