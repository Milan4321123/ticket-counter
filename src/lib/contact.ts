// Server-only: enquiries from the public contact form — organizers asking the
// team to DESIGN a page for them (the fancier alternative to the self-service
// page every event fee already includes).
//
// Every enquiry is STORED as well as emailed: a lead must survive an SMTP
// outage, so /admin/contact is the source of truth and the mail is a
// convenience copy.
import crypto from 'crypto';
import { getDb } from './db';

/**
 * 'organizer-account' is someone asking to sell tickets here. Accounts are
 * created by the platform owner rather than self-served, so "Get started" is a
 * conversation, not a signup form — this keeps those enquiries apart from the
 * custom-design ones in the admin list.
 */
export type ContactRequestKind = 'custom-design' | 'organizer-account' | 'general';
export type ContactRequestStatus = 'new' | 'handled';

export interface ContactRequestRow {
  id: string;
  name: string;
  email: string;
  organization: string;
  message: string;
  kind: ContactRequestKind;
  status: ContactRequestStatus;
  createdAt: string;
  // Only the account applications fill these in, and even there they are
  // optional — an empty string means "they did not say".
  phone: string;
  eventKind: string;
  eventWhen: string;
  eventWhere: string;
  expectedPeople: string;
  /** Set once this application was approved into a real account. */
  organizerId: string | null;
  /** Sent from inside a demo: the demo page that moves across on approval. */
  demoEventId: string | null;
}

const CONTACT_COLS = `
  id, name, email, organization, message, kind, status,
  created_at AS createdAt,
  phone,
  event_kind AS eventKind,
  event_when AS eventWhen,
  event_where AS eventWhere,
  expected_people AS expectedPeople,
  organizer_id AS organizerId,
  demo_event_id AS demoEventId
`;

/** Store one enquiry and hand back the saved row. */
export function createContactRequest(params: {
  name: string;
  email: string;
  organization?: string;
  message: string;
  kind?: ContactRequestKind;
  phone?: string;
  eventKind?: string;
  eventWhen?: string;
  eventWhere?: string;
  expectedPeople?: string;
  /** Sent from a demo: the demo page to carry over on approval. */
  demoEventId?: string;
}): ContactRequestRow {
  const id = crypto.randomUUID();
  getDb()
    .prepare(
      `INSERT INTO contact_requests
         (id, name, email, organization, message, kind,
          phone, event_kind, event_when, event_where, expected_people, demo_event_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      params.name.trim(),
      params.email.trim(),
      (params.organization ?? '').trim(),
      params.message.trim(),
      params.kind ?? 'custom-design',
      (params.phone ?? '').trim(),
      (params.eventKind ?? '').trim(),
      (params.eventWhen ?? '').trim(),
      (params.eventWhere ?? '').trim(),
      (params.expectedPeople ?? '').trim(),
      params.demoEventId ?? null
    );
  return getDb().prepare(`SELECT ${CONTACT_COLS} FROM contact_requests WHERE id = ?`).get(id) as ContactRequestRow;
}

/** Newest first — optionally only the ones in a given status. */
export function listContactRequests(status?: ContactRequestStatus): ContactRequestRow[] {
  if (status) {
    return getDb()
      .prepare(`SELECT ${CONTACT_COLS} FROM contact_requests WHERE status = ? ORDER BY created_at DESC`)
      .all(status) as ContactRequestRow[];
  }
  return getDb()
    .prepare(`SELECT ${CONTACT_COLS} FROM contact_requests ORDER BY created_at DESC`)
    .all() as ContactRequestRow[];
}

export function getContactRequest(id: string): ContactRequestRow | null {
  return (
    (getDb().prepare(`SELECT ${CONTACT_COLS} FROM contact_requests WHERE id = ?`).get(id) as
      | ContactRequestRow
      | undefined) ?? null
  );
}

/** Tick an enquiry off the inbox. False when it was already handled/unknown. */
export function markContactRequestHandled(id: string): boolean {
  return (
    getDb().prepare(`UPDATE contact_requests SET status = 'handled' WHERE id = ? AND status = 'new'`).run(id)
      .changes > 0
  );
}

/**
 * Claim an application for the account it just created. The UPDATE only fires
 * while organizer_id is still empty, so two approvals racing each other can
 * never both win — the loser is told which account already exists.
 */
export function linkContactRequestToOrganizer(id: string, organizerId: string): boolean {
  return (
    getDb()
      .prepare(`UPDATE contact_requests SET organizer_id = ? WHERE id = ? AND organizer_id IS NULL`)
      .run(organizerId, id).changes > 0
  );
}

/** How many enquiries still need an answer (admin dashboard badge). */
export function countNewContactRequests(): number {
  return (
    getDb().prepare(`SELECT COUNT(*) AS n FROM contact_requests WHERE status = 'new'`).get() as { n: number }
  ).n;
}
