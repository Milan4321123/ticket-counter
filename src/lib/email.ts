// Server-only: buyer emails via SMTP (nodemailer).
// If SMTP is not configured the site still works — buyers see their tickets
// and payment instructions on the order page; this module just quietly
// reports { sent: false }.
import nodemailer from 'nodemailer';
import { getBankTransferConfig, getBaseUrl, getEventConfig, getTier } from './config';
import { formatMoney } from './money';
import { getOrder, getOrderItems, getTicketsForOrder, paymentReference } from './orders';

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

/** Full email document: hidden preview line, dark header, gradient bar, body, footer. */
function emailShell(opts: { kicker: string; preheader: string; bodyHtml: string; orderId: string }): string {
  const cfg = getEventConfig();
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

    const cfg = getEventConfig();
    const items = getOrderItems(orderId);
    const hasStudentTickets = items.some((it) => getTier(it.tierId)?.studentOnly === true);
    const orderUrl = `${getBaseUrl()}/order/${orderId}`;
    const tierName = (tierId: string) => getTier(tierId)?.name ?? tierId;
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
    const bank = getBankTransferConfig();
    if (!bank) return { sent: false, reason: 'transfer-not-configured' };

    const cfg = getEventConfig();
    const orderUrl = `${getBaseUrl()}/order/${orderId}`;
    const reference = paymentReference(orderId);
    const hasStudentTickets = getOrderItems(orderId).some((it) => getTier(it.tierId)?.studentOnly === true);
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
