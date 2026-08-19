// The bank transfer, minus the typing.
//
// A transfer costs nobody anything — no percentage, no per-payment fee. That is
// the whole reason this platform tells buyers to send one. What it costs
// instead is the buyer's patience: open the banking app, copy an IBAN, retype
// an amount, and get a reference exactly right, on a phone, from memory of a
// page they have already navigated away from. Every one of those steps is a
// place to give up, and the reference — the one field the organizer actually
// needs — is the easiest of them to fumble and the most expensive to lose.
//
// A GiroCode removes all four. It is the European Payments Council's
// EPC069-12 QR format: the payee, the account, the amount and the reference,
// encoded so that a banking app can read them and fill its own transfer form.
// The buyer scans, checks the numbers their own bank is showing them, and
// confirms. Sparkasse, Volksbank, ING, DKB and Commerzbank all read it.
//
// So this file is not a convenience. It is what keeps the free path free: the
// cheapest way to pay is only actually the cheapest if people finish it.
//
// Nothing here touches the database or the network — it is a pure encoder, so
// it can be tested and reasoned about on its own, and the QR image is somebody
// else's job.

/**
 * The most a GiroCode payload may be, in bytes.
 *
 * From the specification, and not a soft limit: a longer payload still encodes
 * into a perfectly scannable QR, and then the banking app rejects it. Better to
 * decline to draw a code at all than to print one that fails in a stranger's
 * hand at the moment they were trying to pay.
 */
const MAX_PAYLOAD_BYTES = 331;

/** Field caps from the specification. Anything longer is the caller's mistake to lose, not the bank's to reject. */
const MAX_NAME = 70;
const MAX_IBAN = 34;
const MAX_REMITTANCE = 140;

/**
 * The smallest and largest a transfer may be.
 *
 * Zero is not a payment, and the format cannot express it — a free order has
 * nothing to scan and should not pretend otherwise.
 */
const MIN_CENTS = 1;
const MAX_CENTS = 99999999999; // EUR 999,999,999.99

export interface GirocodeInput {
  /** Who the money goes to, as the organizer's account is actually titled. */
  accountHolder: string;
  /** The organizer's IBAN, spaced or not. */
  iban: string;
  /** BIC. Optional — version 002 lets SEPA transfers omit it, and most German banks derive it. */
  bic?: string;
  /** The amount, in cents, in euros. */
  amountCents: number;
  /** Currency of the order. Anything but EUR means no code — see below. */
  currency: string;
  /** The buyer's payment reference — the thing the organizer matches on. */
  reference: string;
}

/**
 * Strip what the format cannot carry.
 *
 * The payload is newline-delimited, which makes a stray newline in a name or a
 * reference not a cosmetic problem but a structural one: it shifts every field
 * below it by one line, so a bank app reads the amount as the purpose and the
 * reference as nothing at all. Tabs and control characters are the same hazard
 * in a quieter form. Collapsing all whitespace to single spaces also spares the
 * buyer an account holder rendered across two lines in their banking app.
 */
function clean(value: string, max: number): string {
  return (value || '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

/** IBANs are stored and displayed with spaces for readability; the wire wants them without. */
function compactIban(iban: string): string {
  return (iban || '').replace(/\s+/g, '').toUpperCase();
}

/**
 * Build the EPC069-12 payload for an order, or null if this order cannot have one.
 *
 * Returning null rather than throwing is deliberate. Every caller here is a page
 * that is already rendering something useful — the IBAN, the reference, a copy
 * button — and a missing QR should quietly leave those alone rather than take
 * the page down with it. There is no order for which failing to draw a GiroCode
 * is worse than failing to show the transfer details.
 *
 * The cases that produce null are all real:
 *   - no IBAN yet, on an event whose organizer has not finished setting up
 *   - a currency other than EUR, which the format simply cannot express
 *   - a zero total, which is not a payment
 *   - a payload over the byte cap, which would scan and then be refused
 */
export function girocodePayload(input: GirocodeInput): string | null {
  const iban = compactIban(input.iban);
  const holder = clean(input.accountHolder, MAX_NAME);
  const reference = clean(input.reference, MAX_REMITTANCE);

  if (!iban || iban.length > MAX_IBAN) return null;
  if (!holder) return null;

  // EUR only, and not an oversight: the service tag SCT means a SEPA credit
  // transfer, and SEPA settles in euro. A GBP or CHF event gets no code rather
  // than a code that lies about the currency.
  if ((input.currency || '').toUpperCase() !== 'EUR') return null;

  const cents = Math.round(input.amountCents);
  if (!Number.isFinite(cents) || cents < MIN_CENTS || cents > MAX_CENTS) return null;

  const amount = `EUR${(cents / 100).toFixed(2)}`;

  // Field order is the specification's, and it is positional — every line
  // counts, including the empty ones. Version 002 is what makes the BIC
  // optional; 1 is UTF-8.
  //
  // Purpose code and structured reference are deliberately left empty: the
  // format allows a structured creditor reference OR unstructured text but not
  // both, and this platform's reference (TICKETS-XXXXXXXX) is its own scheme
  // rather than an ISO 11649 RF one. Putting it in the unstructured line is
  // what makes it land in the buyer's "Verwendungszweck", which is exactly
  // where the organizer looks for it.
  const lines = [
    'BCD',                                  // service tag
    '002',                                  // version
    '1',                                    // character set: UTF-8
    'SCT',                                  // SEPA credit transfer
    clean(input.bic || '', 11),             // BIC, optional at version 002
    holder,                                 // beneficiary name
    iban,                                   // beneficiary account
    amount,                                 // amount
    '',                                     // purpose code
    '',                                     // structured creditor reference
    reference,                              // unstructured remittance
    // The twelfth field (beneficiary-to-originator note) is omitted entirely:
    // trailing empty fields may be dropped, and a shorter payload scans from
    // further away and in worse light.
  ];

  const payload = lines.join('\n');
  if (Buffer.byteLength(payload, 'utf8') > MAX_PAYLOAD_BYTES) return null;

  return payload;
}
