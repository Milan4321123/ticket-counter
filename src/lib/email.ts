// Server-only: buyer emails via SMTP (nodemailer).
// If SMTP is not configured the site still works — buyers see their tickets
// and payment instructions on the order page; this module just quietly
// reports { sent: false }.
import nodemailer from 'nodemailer';
import { getBaseUrl } from './config';
import { getEventById, getEventTier, type EventRow } from './events';
import { formatMoney } from './money';
import { getOrder, getOrderItems, getTicketsForOrder, paymentReference } from './orders';
import {
  eventFeeAmount,
  platformContactEmail,
  platformFeeLabel,
  platformFeeRule,
  type PlatformBank,
} from './platform';
import type { ContactRequestRow } from './contact';

export function isEmailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.EMAIL_FROM);
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

// ---------------------------------------------------------------------------
// Shared template pieces. Email clients ignore stylesheets, so EVERYTHING is
// inline-styled, table-based, and mobile-friendly (single fluid column,
// max-width 560px). Light body, dark header band, violet→pink gradient accent
// bar (with a solid violet fallback for clients that drop gradients).
// ---------------------------------------------------------------------------

const FONT = `-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif`;
const MONO = `ui-monospace,'SF Mono',Menlo,Consolas,'Liberation Mono',monospace`;

/** One-line venue string for emails ("Venue, City"). */
function venueDisplay(event: EventRow): string {
  return [event.venueName, event.city].filter(Boolean).join(', ');
}

/** Full email document: hidden preview line, dark header, gradient bar, body, footer. */
function emailShell(opts: {
  event: EventRow;
  kicker: string;
  preheader: string;
  bodyHtml: string;
  orderId: string;
}): string {
  const cfg = { eventName: opts.event.name, dateDisplay: opts.event.dateDisplay, venue: venueDisplay(opts.event) };
  return `
<div style="margin:0;padding:0;background-color:#f1f2f7;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escapeHtml(opts.preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f2f7;">
    <tr>
      <td align="center" style="padding:28px 12px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border:1px solid #e4e6f0;border-radius:14px;overflow:hidden;font-family:${FONT};">
          <tr>
            <td style="background-color:#0a0b10;padding:26px 28px;">
              <p style="margin:0;color:#a78bfa;font-size:12px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;">${escapeHtml(opts.kicker)}</p>
              <h1 style="margin:8px 0 0;color:#ffffff;font-size:23px;line-height:1.25;font-weight:800;">${escapeHtml(cfg.eventName)}</h1>
              <p style="margin:10px 0 0;color:#b9bdd1;font-size:14px;line-height:1.5;">${escapeHtml(cfg.dateDisplay)}<br>${escapeHtml(cfg.venue)}</p>
            </td>
          </tr>
          <tr>
            <td style="height:4px;font-size:4px;line-height:4px;background-color:#8b5cf6;background-image:linear-gradient(90deg,#8b5cf6,#ec4899);">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:26px 28px;">${opts.bodyHtml}</td>
          </tr>
          <tr>
            <td style="padding:18px 28px;background-color:#f7f8fc;border-top:1px solid #e4e6f0;">
              <p style="margin:0;color:#8a8fa3;font-size:12px;line-height:1.6;">${escapeHtml(cfg.eventName)} · ${escapeHtml(cfg.dateDisplay)} · ${escapeHtml(cfg.venue)}<br>Order ${escapeHtml(opts.orderId)}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</div>`;
}

/** Bulletproof-ish gradient button (solid violet fallback). */
function buttonHtml(href: string, label: string): string {
  return `
      <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto;">
        <tr>
          <td style="border-radius:10px;background-color:#8b5cf6;background-image:linear-gradient(90deg,#8b5cf6,#ec4899);">
            <a href="${escapeHtml(href)}" style="display:inline-block;padding:14px 34px;font-family:${FONT};font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">${escapeHtml(label)}</a>
          </td>
        </tr>
      </table>`;
}

/**
 * Document for mails the PLATFORM sends an organizer (signup instructions,
 * event fee, reminders). Same light card as the buyer mails, but branded with
 * the platform name and the crimson→blue accent bar instead of an event header.
 */
function platformShell(opts: { title: string; preheader: string; bodyHtml: string }): string {
  const platformName = process.env.PLATFORM_NAME || 'NepaliConcert';
  return (
    `<div style="background:#f4f4f7;padding:24px 12px;font-family:${FONT};color:#111;">` +
    `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escapeHtml(opts.preheader)}</div>` +
    `<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;">` +
    `<div style="background:#0a0b10;padding:16px 24px;">` +
    `<span style="color:#ffffff;font-weight:bold;font-size:16px;">${escapeHtml(platformName)}</span>` +
    `<div style="height:3px;background:linear-gradient(90deg,#DC143C,#003893);margin-top:12px;border-radius:2px;"></div>` +
    `</div>` +
    `<div style="padding:24px;">` +
    `<h1 style="margin:0 0 16px;font-size:20px;">${escapeHtml(opts.title)}</h1>` +
    opts.bodyHtml +
    `</div></div></div>`
  );
}

/** Amber note box (student-ID reminders and similar must-read lines). */
function noteBoxHtml(innerHtml: string): string {
  return `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;">
        <tr>
          <td style="background-color:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:13px 16px;color:#78350f;font-size:14px;line-height:1.55;">${innerHtml}</td>
        </tr>
      </table>`;
}

// ---------------------------------------------------------------------------
// Ticket email (order is PAID — QR tickets exist)
// ---------------------------------------------------------------------------

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
    const cfg = { eventName: event.name, dateDisplay: event.dateDisplay, venue: venueDisplay(event) };
    const items = getOrderItems(orderId);
    const hasStudentTickets = items.some((it) => getEventTier(event.id, it.tierId)?.studentOnly === true);
    const orderUrl = `${getBaseUrl()}/order/${orderId}`;
    const tierName = (tierId: string) => getEventTier(event.id, tierId)?.name ?? tierId;
    const total = formatMoney(order.totalCents, order.currency);

    // ---------- Plain-text alternative ----------
    const textLines = [
      `Payment received — thank you, ${order.buyerName}!`,
      '',
      cfg.eventName,
      cfg.dateDisplay,
      cfg.venue,
      '',
      `Your tickets (${tickets.length}):`,
      ...tickets.map((t) => `  - ${t.code} — ${tierName(t.tierId)}`),
      '',
      `Total paid: ${total}`,
      '',
      `View and print your tickets (QR codes) here: ${orderUrl}`,
      '',
      'Show the QR codes at the entrance. Each ticket admits one person and can only be scanned once.',
    ];
    if (hasStudentTickets) {
      textLines.push(
        '',
        'Note: your order includes student tickets. Please bring a valid student ID to show at the entrance.'
      );
    }
    const text = textLines.join('\n');

    // ---------- HTML version ----------
    const ticketRowsHtml = tickets
      .map(
        (t) => `
        <tr>
          <td style="padding:11px 16px;border-top:1px solid #e4e6f0;font-family:${MONO};font-size:15px;font-weight:700;letter-spacing:0.08em;color:#221a3f;white-space:nowrap;">${escapeHtml(t.code)}</td>
          <td style="padding:11px 16px;border-top:1px solid #e4e6f0;font-size:14px;color:#4b4e63;" width="100%">${escapeHtml(tierName(t.tierId))}</td>
        </tr>`
      )
      .join('');

    const bodyHtml = `
      <p style="margin:0 0 14px;color:#171928;font-size:15px;line-height:1.6;">Hi ${escapeHtml(order.buyerName)},</p>
      <p style="margin:0 0 18px;color:#4b4e63;font-size:15px;line-height:1.6;">Payment received — thank you! Your ticket${tickets.length === 1 ? ' is' : 's are'} ready. Here ${tickets.length === 1 ? 'it is' : 'they are'}:</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 6px;border:1px solid #e4e6f0;border-radius:10px;">
        <tr>
          <td style="padding:9px 16px;background-color:#f7f8fc;color:#8a8fa3;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;">Code</td>
          <td style="padding:9px 16px;background-color:#f7f8fc;color:#8a8fa3;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;" width="100%">Ticket type</td>
        </tr>${ticketRowsHtml}
      </table>
      <p style="margin:0 0 22px;color:#4b4e63;font-size:14px;">Total paid: <strong style="color:#171928;">${escapeHtml(total)}</strong></p>
      ${buttonHtml(orderUrl, 'View & print your tickets (QR codes)')}
      <p style="margin:10px 0 22px;text-align:center;color:#8a8fa3;font-size:12px;">The QR codes on that page are what gets scanned at the entrance.</p>
      ${
        hasStudentTickets
          ? noteBoxHtml(
              `<strong>Student tickets:</strong> please bring a valid student ID for each student ticket — it will be checked at the entrance.`
            )
          : ''
      }
      <p style="margin:0;color:#8a8fa3;font-size:13px;line-height:1.6;">Each ticket admits one person and can only be scanned once — no need to print if your phone can show the QR code. See you at the show!</p>`;

    const html = emailShell({
      event,
      kicker: 'Your tickets',
      preheader: `Payment received — your ${tickets.length} ticket${tickets.length === 1 ? '' : 's'} for ${cfg.eventName} ${tickets.length === 1 ? 'is' : 'are'} inside.`,
      bodyHtml,
      orderId,
    });

    await createTransporter().sendMail({
      from: process.env.EMAIL_FROM,
      to: order.buyerEmail,
      subject: `Your tickets for ${cfg.eventName}`,
      text,
      html,
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
    // The ORGANIZER's account — buyers pay each organizer directly.
    if (!event.bankIban.trim() || !event.bankAccountHolder.trim()) {
      return { sent: false, reason: 'transfer-not-configured' };
    }
    const bank = {
      accountHolder: event.bankAccountHolder,
      iban: event.bankIban,
      bic: event.bankBic,
      bankName: event.bankName,
      payWithinDays: event.payWithinDays,
    };

    const cfg = { eventName: event.name };
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

    // ---------- Plain-text alternative ----------
    const bankLines = [
      `Amount:          ${amount}`,
      `Account holder:  ${bank.accountHolder}`,
      `IBAN:            ${bank.iban}`,
      ...(bank.bic ? [`BIC:             ${bank.bic}`] : []),
      ...(bank.bankName ? [`Bank:            ${bank.bankName}`] : []),
      `Reference:       ${reference}`,
    ];
    const textLines = [
      `Thank you, ${order.buyerName} — your tickets for ${cfg.eventName} are reserved!`,
      '',
      `To complete your order, please send a bank transfer by ${deadlineDisplay}:`,
      '',
      ...bankLines.map((l) => `  ${l}`),
      '',
      `IMPORTANT: the reference "${reference}" MUST go in the transfer's purpose line`,
      '("Verwendungszweck") — it is how we match your payment to your tickets.',
    ];
    if (hasStudentTickets) {
      textLines.push(
        '',
        'The "S-" in your reference marks orders that include student tickets.',
        'Please bring a valid student ID to show at the entrance.'
      );
    }
    textLines.push(
      '',
      'As soon as your payment arrives (usually 1-2 business days), your QR-code tickets will be emailed to you automatically.',
      `You can check your order anytime here: ${orderUrl}`,
      '',
      `If we do not receive a payment by ${deadlineDisplay}, the reservation is released again.`
    );
    const text = textLines.join('\n');

    // ---------- HTML version ----------
    const bankRow = (label: string, value: string, mono = false) => `
        <tr>
          <td style="padding:9px 18px;color:#6d6a8a;font-size:13px;white-space:nowrap;vertical-align:top;">${escapeHtml(label)}</td>
          <td style="padding:9px 18px;color:#221a3f;font-size:14px;${mono ? `font-family:${MONO};font-weight:700;letter-spacing:0.03em;` : 'font-weight:600;'}" align="right" width="100%">${escapeHtml(value)}</td>
        </tr>`;

    const bodyHtml = `
      <p style="margin:0 0 14px;color:#171928;font-size:15px;line-height:1.6;">Hi ${escapeHtml(order.buyerName)},</p>
      <p style="margin:0 0 18px;color:#4b4e63;font-size:15px;line-height:1.6;">Your tickets are reserved! To complete your order, please send a bank transfer by <strong style="color:#171928;">${escapeHtml(deadlineDisplay)}</strong>:</p>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;border:1px solid #ddd6fe;border-radius:12px;background-color:#f7f4ff;">
        <tr>
          <td colspan="2" style="padding:18px 18px 4px;" align="center">
            <p style="margin:0;color:#6d6a8a;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;">Amount to transfer</p>
            <p style="margin:4px 0 8px;color:#221a3f;font-size:30px;font-weight:800;">${escapeHtml(amount)}</p>
          </td>
        </tr>
        ${bankRow('Account holder', bank.accountHolder)}
        ${bankRow('IBAN', bank.iban, true)}
        ${bank.bic ? bankRow('BIC', bank.bic, true) : ''}
        ${bank.bankName ? bankRow('Bank', bank.bankName) : ''}
        <tr><td colspan="2" style="padding:0 0 10px;"></td></tr>
      </table>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;">
        <tr>
          <td style="background-color:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:16px 18px;" align="center">
            <p style="margin:0;color:#92400e;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;">Payment reference — required</p>
            <p style="margin:6px 0 8px;font-family:${MONO};font-size:21px;font-weight:700;letter-spacing:0.06em;color:#78350f;">${escapeHtml(reference)}</p>
            <p style="margin:0;color:#78350f;font-size:13px;line-height:1.55;">This reference <strong>must go in the transfer&#39;s purpose line</strong> (&quot;Verwendungszweck&quot;) — it is how we match your payment to your tickets.${hasStudentTickets ? ' The <strong>S-</strong> in the reference marks orders that include student tickets.' : ''}</p>
          </td>
        </tr>
      </table>

      <p style="margin:0 0 22px;color:#4b4e63;font-size:14px;line-height:1.6;">As soon as your payment arrives (usually 1&#8211;2 business days), your QR-code tickets will be emailed to you automatically.</p>
      ${buttonHtml(orderUrl, 'View your order')}
      <p style="margin:10px 0 22px;text-align:center;color:#8a8fa3;font-size:12px;">Bookmark that page — your tickets will appear there too.</p>
      ${
        hasStudentTickets
          ? noteBoxHtml(
              `<strong>Student tickets:</strong> please bring a valid student ID for each student ticket — it will be checked at the entrance.`
            )
          : ''
      }
      <p style="margin:0;color:#8a8fa3;font-size:13px;line-height:1.6;">If we do not receive a payment by ${escapeHtml(deadlineDisplay)}, the reservation is released again.</p>`;

    const html = emailShell({
      event,
      kicker: 'Reservation confirmed',
      preheader: `Reserved! Transfer ${amount} with reference ${reference} by ${deadlineDisplay} to complete your order.`,
      bodyHtml,
      orderId,
    });

    await createTransporter().sendMail({
      from: process.env.EMAIL_FROM,
      to: order.buyerEmail,
      subject: `Reserved: your tickets for ${cfg.eventName} — payment details inside`,
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

    const rowsHtml = awaiting
      .map(
        (o) =>
          `<tr>` +
          `<td style="padding:6px 10px;border-bottom:1px solid #eee;">${escapeHtml(o.eventName)}</td>` +
          `<td style="padding:6px 10px;border-bottom:1px solid #eee;">${escapeHtml(o.buyerName)}</td>` +
          `<td style="padding:6px 10px;border-bottom:1px solid #eee;font-family:monospace;">${escapeHtml(
            paymentReference(o.orderId)
          )}</td>` +
          `<td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;">${escapeHtml(
            formatMoney(o.totalCents, o.currency)
          )}</td>` +
          `</tr>`
      )
      .join('');

    const bodyHtml =
      `<p style="margin:0 0 12px;">Hi ${escapeHtml(organizer.name)},</p>` +
        `<p style="margin:0 0 16px;">You have <strong>${awaiting.length}</strong> reservation${
          awaiting.length === 1 ? '' : 's'
        } waiting for a bank transfer — <strong>${escapeHtml(totals)}</strong> expected in total. ` +
        `Please check your bank statement for these references and confirm any arrived payments so the buyers get their tickets:</p>` +
        `<table style="border-collapse:collapse;width:100%;font-size:14px;margin:0 0 18px;">` +
        `<tr><th align="left" style="padding:6px 10px;">Event</th><th align="left" style="padding:6px 10px;">Buyer</th><th align="left" style="padding:6px 10px;">Reference</th><th align="right" style="padding:6px 10px;">Amount</th></tr>` +
        rowsHtml +
        `</table>` +
        buttonHtml(portalUrl, 'Open your portal') +
        `<p style="margin:16px 0 0;font-size:12px;color:#666;">You can change or disable these reminders in your portal settings.</p>`;
    const html = platformShell({
      title: 'Time to check your bank account',
      preheader: `${awaiting.length} reservation${awaiting.length === 1 ? '' : 's'} waiting — ${totals} expected.`,
      bodyHtml,
    });

    const text =
      `Hi ${organizer.name},\n\n` +
      `You have ${awaiting.length} reservation(s) waiting for a bank transfer — ${totals} expected in total.\n` +
      `Check your bank statement for these references and confirm arrived payments in your portal:\n\n` +
      awaiting
        .map((o) => `- ${o.eventName} · ${o.buyerName} · ${paymentReference(o.orderId)} · ${formatMoney(o.totalCents, o.currency)}`)
        .join('\n') +
      `\n\nPortal: ${portalUrl}\n\nYou can change or disable these reminders in your portal settings.`;

    await createTransporter().sendMail({
      from: process.env.EMAIL_FROM,
      to: organizer.email,
      subject: `${awaiting.length} payment${awaiting.length === 1 ? '' : 's'} to check — ${totals} expected`,
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

/** One label/value line of the bank box. */
function bankRowHtml(label: string, value: string, mono = false): string {
  return `
        <tr>
          <td style="padding:9px 18px;color:#6d6a8a;font-size:13px;white-space:nowrap;vertical-align:top;">${escapeHtml(label)}</td>
          <td style="padding:9px 18px;color:#221a3f;font-size:14px;${mono ? `font-family:${MONO};font-weight:700;letter-spacing:0.03em;` : 'font-weight:600;'}" align="right" width="100%">${escapeHtml(value)}</td>
        </tr>`;
}

/**
 * Amount + the platform's bank details + the required Verwendungszweck —
 * the same box the organizer sees on screen, so both match exactly.
 */
function feeBankBoxHtml(details: FeePaymentDetails, referenceNoteHtml: string): string {
  const { feeLabel, bank, reference } = details;
  const caption = details.amountCaption ?? 'Amount to transfer';
  return `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;border:1px solid #ddd6fe;border-radius:12px;background-color:#f7f4ff;">
        <tr>
          <td colspan="2" style="padding:18px 18px 4px;" align="center">
            <p style="margin:0;color:#6d6a8a;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;">${escapeHtml(caption)}</p>
            <p style="margin:4px 0 8px;color:#221a3f;font-size:26px;font-weight:800;">${escapeHtml(feeLabel)}</p>
          </td>
        </tr>
        ${bankRowHtml('Account holder', bank.accountHolder)}
        ${bankRowHtml('IBAN', bank.iban, true)}
        ${bank.bic ? bankRowHtml('BIC', bank.bic, true) : ''}
        ${bank.bankName ? bankRowHtml('Bank', bank.bankName) : ''}
        <tr><td colspan="2" style="padding:0 0 10px;"></td></tr>
      </table>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;">
        <tr>
          <td style="background-color:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:16px 18px;" align="center">
            <p style="margin:0;color:#92400e;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;">Verwendungszweck — required</p>
            <p style="margin:6px 0 8px;font-family:${MONO};font-size:21px;font-weight:700;letter-spacing:0.06em;color:#78350f;">${escapeHtml(reference)}</p>
            <p style="margin:0;color:#78350f;font-size:13px;line-height:1.55;">${referenceNoteHtml}</p>
          </td>
        </tr>
      </table>`;
}

/** Plain-text twin of the bank box. */
function feeBankBoxText(details: FeePaymentDetails): string[] {
  const { feeLabel, bank, reference } = details;
  return [
    `Amount:            ${feeLabel}`,
    `Account holder:    ${bank.accountHolder}`,
    `IBAN:              ${bank.iban}`,
    ...(bank.bic ? [`BIC:               ${bank.bic}`] : []),
    ...(bank.bankName ? [`Bank:              ${bank.bankName}`] : []),
    `Verwendungszweck:  ${reference}`,
  ];
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

    const platformName = process.env.PLATFORM_NAME || 'NepaliConcert';
    const loginUrl = `${getBaseUrl()}/portal/login`;
    const contactEmail = platformContactEmail();

    const credentialRow = (label: string, value: string) => `
        <tr>
          <td style="padding:9px 18px;color:#6d6a8a;font-size:13px;white-space:nowrap;vertical-align:top;">${escapeHtml(label)}</td>
          <td style="padding:9px 18px;color:#221a3f;font-size:15px;font-family:${MONO};font-weight:700;letter-spacing:0.03em;" width="100%">${escapeHtml(value)}</td>
        </tr>`;

    const bodyHtml =
      `<p style="margin:0 0 12px;">Hi ${escapeHtml(organizer.name)},</p>` +
      `<p style="margin:0 0 16px;">We read what you sent us and your account on ${escapeHtml(platformName)} is ready. ` +
      `Here is how to sign in.</p>` +
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;border:1px solid #ddd6fe;border-radius:12px;background-color:#f7f4ff;">` +
      credentialRow('Email', organizer.email) +
      credentialRow('Temporary password', temporaryPassword) +
      `</table>` +
      noteBoxHtml(
        `<strong>Please change this password.</strong><br>It was picked by us and sent by email, so it is only meant to get you in once. ` +
          `The portal asks you for a new one straight after you sign in — choose something only you know, at least 8 characters.`
      ) +
      buttonHtml(loginUrl, 'Sign in and set your password') +
      `<p style="margin:18px 0 0;font-size:14px;line-height:1.65;">The account is free to keep. You only pay when you ` +
      `publish an event, and the fee follows the size of your venue: <strong>${escapeHtml(platformFeeRule())}</strong> — ` +
      `a 500-person event costs ${escapeHtml(eventFeeAmount(500))}. There is no yearly fee, and we never take a cut of ` +
      `your ticket sales.</p>` +
      (contactEmail
        ? `<p style="margin:16px 0 0;font-size:12px;color:#666;">Stuck, or something above looks wrong? Just reply to this email, or write to ` +
          `<a href="mailto:${escapeHtml(contactEmail)}" style="color:#DC143C;">${escapeHtml(contactEmail)}</a>.</p>`
        : '');

    const text = [
      `Hi ${organizer.name},`,
      '',
      `We read what you sent us and your account on ${platformName} is ready. Here is how to sign in.`,
      '',
      `Email:               ${organizer.email}`,
      `Temporary password:  ${temporaryPassword}`,
      `Sign in:             ${loginUrl}`,
      '',
      'PLEASE CHANGE THIS PASSWORD. It was picked by us and sent by email, so it is only',
      'meant to get you in once. The portal asks you for a new one straight after you sign',
      'in — choose something only you know, at least 8 characters.',
      '',
      `The account is free to keep. You only pay when you publish an event, and the fee follows`,
      `the size of your venue: ${platformFeeRule()} — a 500-person event costs ${eventFeeAmount(500)}.`,
      'No yearly fee, and we never take a cut of your ticket sales.',
      '',
      contactEmail ? `Stuck? Just reply to this email, or write to ${contactEmail}.` : '',
    ]
      .join('\n')
      .trimEnd();

    await createTransporter().sendMail({
      from: process.env.EMAIL_FROM,
      to: organizer.email,
      ...(contactEmail ? { replyTo: contactEmail } : {}),
      subject: `Your ${platformName} organizer account is ready`,
      text,
      html: platformShell({
        title: `Welcome to ${platformName}`,
        preheader: 'Your sign-in details are inside — please change the password once you are in.',
        bodyHtml,
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
      `<p style="margin:0 0 12px;">Hi ${escapeHtml(organizer.name)},</p>` +
      `<p style="margin:0 0 16px;">Your event <strong>${escapeHtml(event.name)}</strong> is ready to go live — ` +
      `all that is left is the <strong>${escapeHtml(feeLabel)}</strong> platform fee for it. ` +
      `Here is everything you need for the transfer:</p>` +
      feeBankBoxHtml(
        details,
        `Put this in the transfer&#39;s purpose line exactly as shown — it is how we match your payment to <strong>${escapeHtml(event.name)}</strong>.`
      ) +
      `<p style="margin:0 0 18px;color:#444;font-size:14px;line-height:1.6;">Once we see your transfer we unlock publishing — usually within a day. We&#39;ll email you the moment it&#39;s live.</p>` +
      buttonHtml(publishUrl, 'Open the Publish tab') +
      `<p style="margin:16px 0 0;font-size:12px;color:#666;">This fee is charged once for this event — it follows the capacity you set (${escapeHtml(platformFeeRule())}) and covers everything: your page, QR tickets, door scanning, and reminders. No commission on your ticket sales.</p>`;

    const text = [
      `Hi ${organizer.name},`,
      '',
      `Your event "${event.name}" is ready to go live — all that is left is the ${feeLabel} platform fee for it.`,
      '',
      ...feeBankBoxText(details).map((l) => `  ${l}`),
      '',
      `IMPORTANT: "${reference}" must go in the transfer's purpose line (Verwendungszweck) —`,
      `it is how we match your payment to "${event.name}".`,
      '',
      "Once we see your transfer we unlock publishing — usually within a day. We'll email you the moment it's live.",
      '',
      `Publish tab: ${publishUrl}`,
    ].join('\n');

    await createTransporter().sendMail({
      from: process.env.EMAIL_FROM,
      to: organizer.email,
      subject: `Publish “${event.name}” — ${feeLabel} transfer details inside`,
      text,
      html: platformShell({
        title: 'Your event fee',
        preheader: `Transfer ${feeLabel} with reference ${reference} to unlock publishing for ${event.name}.`,
        bodyHtml,
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
      `<p style="margin:0 0 12px;">Hi ${escapeHtml(organizer.name)},</p>` +
      `<p style="margin:0 0 16px;">Your transfer arrived — the fee for <strong>${escapeHtml(event.name)}</strong> is paid ` +
      `and publishing is unlocked. Open the Publish tab, give everything a last look, and hit <strong>Publish event</strong>: ` +
      `your page goes into the public feed straight away and buyers can start reserving tickets.</p>` +
      buttonHtml(publishUrl, 'Publish your event') +
      `<p style="margin:16px 0 0;font-size:12px;color:#666;">Ticket money goes directly to the bank account on your event — we never touch it. Good luck with the show!</p>`;

    const text = [
      `Hi ${organizer.name},`,
      '',
      `Your transfer arrived — the fee for "${event.name}" is paid and publishing is unlocked.`,
      'Open the Publish tab, give everything a last look, and hit "Publish event".',
      '',
      `Publish tab: ${publishUrl}`,
      '',
      'Ticket money goes directly to the bank account on your event — we never touch it. Good luck with the show!',
    ].join('\n');

    await createTransporter().sendMail({
      from: process.env.EMAIL_FROM,
      to: organizer.email,
      subject: `“${event.name}” can go live now`,
      text,
      html: platformShell({
        title: 'Your event can go live',
        preheader: `The fee for ${event.name} is confirmed — publishing is unlocked.`,
        bodyHtml,
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
    if (!event.bankIban.trim() || !event.bankAccountHolder.trim()) {
      return { sent: false, reason: 'transfer-not-configured' };
    }

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

    const alreadyPaidLine =
      'Already sent the transfer? Then everything is fine — bank transfers take a few days to arrive ' +
      'and we will confirm yours shortly. You do not need to do anything or pay again.';

    const bankRows = [
      ['Amount', amount],
      ['Account holder', event.bankAccountHolder],
      ['IBAN', event.bankIban],
      ...(event.bankBic ? [['BIC', event.bankBic]] : []),
      ...(event.bankName ? [['Bank', event.bankName]] : []),
      ['Reference', reference],
    ];

    const bankHtml =
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;border:1px solid #e4e6f0;border-radius:10px;">` +
      bankRows
        .map(
          ([label, value], i) =>
            `<tr>` +
            `<td style="padding:10px 14px;color:#6b7080;font-size:13px;${i ? 'border-top:1px solid #eef0f6;' : ''}">${escapeHtml(label)}</td>` +
            `<td align="right" style="padding:10px 14px;font-size:14px;font-weight:${label === 'Reference' || label === 'Amount' ? '700' : '500'};${
              label === 'IBAN' || label === 'Reference' || label === 'BIC' ? `font-family:${MONO};` : ''
            }${i ? 'border-top:1px solid #eef0f6;' : ''}">${escapeHtml(value)}</td>` +
            `</tr>`
        )
        .join('') +
      `</table>`;

    const text =
      `Hi ${order.buyerName},\n\n` +
      `We haven't seen your bank transfer for ${event.name} yet.\n\n` +
      `${alreadyPaidLine}\n\n` +
      `Haven't sent it yet? Here are the details again — please transfer by ${deadlineDisplay}, ` +
      `otherwise the seats go back on sale:\n\n` +
      bankRows.map(([l, v]) => `${(l + ':').padEnd(17)}${v}`).join('\n') +
      `\n\nIMPORTANT: put the reference ${reference} in the transfer's purpose line ("Verwendungszweck") ` +
      `so we can match your payment.\n\n` +
      `Your order page: ${orderUrl}\n\n` +
      `Your QR tickets arrive by email as soon as the payment is confirmed.`;

    const html = platformShell({
      title: 'A quick reminder about your tickets',
      preheader: `We haven't seen your transfer for ${event.name} yet — details inside.`,
      bodyHtml:
        `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;">Hi ${escapeHtml(order.buyerName)},</p>` +
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;">We haven't seen your bank transfer for ` +
        `<strong>${escapeHtml(event.name)}</strong> arrive yet.</p>` +
        noteBoxHtml(
          `<strong>Already paid?</strong> ${escapeHtml(alreadyPaidLine.replace('Already sent the transfer? Then e', 'E'))}`
        ) +
        `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;">If you haven't sent it yet, here are the ` +
        `details again — please transfer by <strong>${escapeHtml(deadlineDisplay)}</strong>, otherwise the seats ` +
        `go back on sale.</p>` +
        bankHtml +
        `<p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:#4b5060;">Put the reference ` +
        `<strong style="font-family:${MONO};">${escapeHtml(reference)}</strong> in the transfer's purpose line ` +
        `("Verwendungszweck") so we can match your payment to your tickets.</p>` +
        buttonHtml(orderUrl, 'View your order') +
        `<p style="margin:18px 0 0;font-size:13px;line-height:1.6;color:#8a8fa3;">Your QR tickets arrive by email ` +
        `as soon as the payment is confirmed.</p>`,
    });

    await createTransporter().sendMail({
      from: process.env.EMAIL_FROM,
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
      ? `<strong>${escapeHtml(request.name)}</strong> is asking for an organizer account. Read it, then approve it at the ` +
        `inbox to create the account and email them their sign-in details.`
      : `<strong>${escapeHtml(request.name)}</strong> would like to talk about a page for their event. ` +
        `Just hit reply — this mail goes straight back to them.`;

    const detailRow = (label: string, valueHtml: string) => `
        <tr>
          <td style="padding:9px 18px;color:#6d6a8a;font-size:13px;white-space:nowrap;vertical-align:top;">${escapeHtml(label)}</td>
          <td style="padding:9px 18px;color:#221a3f;font-size:14px;font-weight:600;" width="100%">${valueHtml}</td>
        </tr>`;
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

    const bodyHtml =
      `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;">${lead}</p>` +
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;border:1px solid #e4e6f0;border-radius:12px;">` +
      detailRow('Name', escapeHtml(request.name)) +
      detailRow(
        'Email',
        `<a href="mailto:${escapeHtml(request.email)}" style="color:#DC143C;">${escapeHtml(request.email)}</a>`
      ) +
      detailRow('Organization', request.organization ? escapeHtml(request.organization) : '—') +
      optionalRows.map(([label, value]) => detailRow(label, escapeHtml(value))).join('') +
      detailRow('Type', escapeHtml(kindLabel)) +
      detailRow('Received', escapeHtml(request.createdAt) + ' UTC') +
      `</table>` +
      noteBoxHtml(`<strong>What they wrote</strong><br>${multilineHtml(request.message)}`) +
      buttonHtml(inboxUrl, wantsAccount ? 'Review and approve' : 'Open the request inbox') +
      `<p style="margin:16px 0 0;font-size:12px;color:#666;">Every enquiry is also stored at ${escapeHtml(inboxUrl)} — ` +
      `${wantsAccount ? 'approve it there, or mark it handled if you turn it down' : 'mark it handled there once you have replied'}.</p>`;

    const text = [
      wantsAccount
        ? `${request.name} is asking for an organizer account.`
        : `${request.name} would like to talk about a page for their event.`,
      '',
      `Name:          ${request.name}`,
      `Email:         ${request.email}`,
      `Organization:  ${request.organization || '—'}`,
      ...optionalRows.map(([label, value]) => `${(label + ':').padEnd(15)}${value}`),
      `Type:          ${kindLabel}`,
      `Received:      ${request.createdAt} UTC`,
      '',
      'WHAT THEY WROTE',
      request.message,
      '',
      `Reply straight to this email — it goes back to ${request.email}.`,
      `Request inbox: ${inboxUrl}`,
    ].join('\n');

    await createTransporter().sendMail({
      from: process.env.EMAIL_FROM,
      to,
      replyTo: request.email,
      subject: `${subjectLead} — ${request.name}`,
      text,
      html: platformShell({
        title: kindLabel,
        preheader: `${request.name}${request.organization ? ` (${request.organization})` : ''} — ${request.email}`,
        bodyHtml,
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

    const platformName = process.env.PLATFORM_NAME || 'NepaliConcert';
    const feeLabel = platformFeeLabel();
    const contactEmail = platformContactEmail();
    const wantsAccount = request.kind === 'organizer-account';

    const bodyHtml =
      `<p style="margin:0 0 12px;">Hi ${escapeHtml(request.name)},</p>` +
      `<p style="margin:0 0 16px;">Thanks for getting in touch — we&rsquo;ve got your ${wantsAccount ? 'application' : 'request'} and a real person ` +
      `will read it and reply within a couple of days${wantsAccount ? '' : ' with ideas and what it would cost'}.</p>` +
      noteBoxHtml(
        wantsAccount
          ? `<strong>What happens next</strong><br>We read what you told us about your event, and if it all looks right we ` +
              `set your account up and email you the sign-in details. Nothing to pay for the account — it is free, and you ` +
              `only pay when you publish an event (${escapeHtml(feeLabel)}). Anything you forgot to mention? Just reply to this email.`
          : `<strong>Good to know</strong><br>The standard self-service event page — photos, video, ticket tiers, QR tickets ` +
              `and door scanning — is already included in the normal event fee (${escapeHtml(feeLabel)}). What we&rsquo;ll ` +
              `quote you for is the design work on top of that.`
      ) +
      `<p style="margin:18px 0 0;font-size:13px;line-height:1.6;color:#666;">Here is what you sent us, for your records:</p>` +
      `<p style="margin:6px 0 0;font-size:13px;line-height:1.6;color:#666;">${multilineHtml(request.message)}</p>` +
      `<p style="margin:16px 0 0;font-size:12px;color:#666;">Anything to add? Just reply to this email, or write to ` +
      `<a href="mailto:${escapeHtml(contactEmail)}" style="color:#DC143C;">${escapeHtml(contactEmail)}</a>.</p>`;

    const text = [
      `Hi ${request.name},`,
      '',
      `Thanks for getting in touch — we've got your ${wantsAccount ? 'application' : 'request'} and a real person will`,
      `read it and reply within a couple of days${wantsAccount ? '.' : ' with ideas and what it would cost.'}`,
      '',
      ...(wantsAccount
        ? [
            'WHAT HAPPENS NEXT: we read what you told us about your event, and if it all looks',
            'right we set your account up and email you the sign-in details. The account is free —',
            `you only pay when you publish an event (${feeLabel}). Forgot to mention something?`,
            'Just reply to this email.',
          ]
        : [
            'GOOD TO KNOW: the standard self-service event page (photos, video, ticket tiers, QR',
            `tickets and door scanning) is already included in the normal event fee (${feeLabel}).`,
            "What we'll quote you for is the design work on top of that.",
          ]),
      '',
      'What you sent us:',
      request.message,
      '',
      `Anything to add? Just reply to this email, or write to ${contactEmail}.`,
    ].join('\n');

    await createTransporter().sendMail({
      from: process.env.EMAIL_FROM,
      to: request.email,
      replyTo: contactEmail,
      subject: `Thanks — we've got your request (${platformName})`,
      text,
      html: platformShell({
        title: "Thanks — we've got your request",
        preheader: "A real person will reply within a couple of days.",
        bodyHtml,
      }),
    });
    return { sent: true };
  } catch (err) {
    console.error('[email] Failed to send contact request acknowledgement:', err instanceof Error ? err.message : err);
    return { sent: false, reason: 'send-failed' };
  }
}
