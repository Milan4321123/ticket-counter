// Server-only: WHO a buyer is buying from, as every buyer-facing surface
// names them — event and item pages, checkout, the order and ticket pages, and
// the buyer emails.
//
// The organizer, not this platform, is the seller (the Veranstalter) and the
// controller of the buyer's data. Saying so on every surface is what keeps the
// platform a disclosed agent — a buyer page that does not name the seller can
// make the whole ticket value the operator's turnover (§3 Abs. 11 UStG) — and
// it is what Art. 13 GDPR asks for before somebody hands over their details.
//
// Deliberately a DB-only module (no next/headers): lib/email reads it from
// background jobs that run outside any request, the same reason lib/email does
// not import lib/organizers. lib/organizers owns WRITING these columns; this
// file only reads them.
import { getDb } from './db';
import { chunkIds } from './sqlIn';

export interface SellerIdentity {
  organizerId: string;
  /**
   * The name to print: the legal name when the organizer filled it in, else
   * their account name, else ''. Callers add their own "the organizer" wording
   * for the empty case.
   */
  displayName: string;
  /** '' until filled in on /portal/settings. */
  legalName: string;
  /** One entry per address line; [] when not filled in. */
  addressLines: string[];
  /** "Vorstand: …" — who represents a Verein or company; '' when not given. */
  representative: string;
  /** "Amtsgericht Darmstadt, VR 1234"; '' when not given. */
  register: string;
  /** Where buyers can write to the seller; '' when not given. */
  contactEmail: string;
  /** Anything beyond the bare name to show — decides whether a block renders. */
  hasLegalDetails: boolean;
}

interface Row {
  id: string;
  name: string;
  legalName: string;
  legalAddress: string;
  legalRepresentative: string;
  legalRegister: string;
  legalContactEmail: string;
}

const COLS = `id, name, legal_name AS legalName, legal_address AS legalAddress,
  legal_representative AS legalRepresentative, legal_register AS legalRegister,
  legal_contact_email AS legalContactEmail`;

function fromRow(r: Row): SellerIdentity {
  const legalName = (r.legalName ?? '').trim();
  const addressLines = (r.legalAddress ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const representative = (r.legalRepresentative ?? '').trim();
  const register = (r.legalRegister ?? '').trim();
  const contactEmail = (r.legalContactEmail ?? '').trim();
  return {
    organizerId: r.id,
    displayName: legalName || (r.name ?? '').trim(),
    legalName,
    addressLines,
    representative,
    register,
    contactEmail,
    hasLegalDetails: Boolean(legalName || addressLines.length || representative || register || contactEmail),
  };
}

/** One seller. Null when the organizer row is gone; never throws. */
export function getSellerIdentity(organizerId: string): SellerIdentity | null {
  try {
    const row = getDb().prepare(`SELECT ${COLS} FROM organizers WHERE id = ?`).get(organizerId) as Row | undefined;
    return row ? fromRow(row) : null;
  } catch {
    return null;
  }
}

/**
 * Many sellers in one statement per 500 ids — for a page that shows several
 * shops at once (the stall cards on an event page), so naming each seller does
 * not cost a query per card.
 */
export function getSellerIdentitiesBulk(organizerIds: string[]): Map<string, SellerIdentity> {
  const out = new Map<string, SellerIdentity>();
  const unique = [...new Set(organizerIds.filter(Boolean))];
  for (const batch of chunkIds(unique)) {
    const rows = getDb()
      .prepare(`SELECT ${COLS} FROM organizers WHERE id IN (${batch.map(() => '?').join(',')})`)
      .all(...batch) as Row[];
    for (const r of rows) out.set(r.id, fromRow(r));
  }
  return out;
}

/** The address on one line, for a footer or a ticket: "Str. 1, 64283 Darmstadt". */
export function sellerAddressOneLine(s: SellerIdentity): string {
  return s.addressLines.join(', ');
}
