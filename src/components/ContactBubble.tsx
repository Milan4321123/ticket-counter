'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * A floating "talk to a person" bubble, on every public page.
 *
 * It used to be a card on the home page, which meant it only existed for
 * someone who happened to scroll past it once. The moment a visitor actually
 * wants a human is usually deep inside an event page, or halfway through a
 * checkout they are unsure about — so the invitation follows them the way the
 * assistant does, and stays put while they scroll.
 *
 * Stacked directly ABOVE the chat bubble rather than beside it. Both are "get
 * help" affordances and belong in the same corner; putting one on the left
 * would read as an unrelated control, and side by side they would collide on a
 * narrow phone.
 */
export default function ContactBubble({
  name,
  role,
  photoUrl,
  focus,
}: {
  name: string;
  role: string;
  photoUrl: string;
  focus: string;
}) {
  const pathname = usePathname() || '';

  // An ALLOWLIST, not a list of exceptions — and the difference is the whole
  // point of this bubble.
  //
  // This is the platform owner, and what they are offering is an organizer
  // account and a page designed by hand. That offer is for people who want to
  // RUN an event. A ticket buyer who taps it reaches someone who cannot help
  // with the only things they care about — their order, their seats, the
  // account they are being asked to pay — and the platform ends up fielding
  // questions that belong to the organizer, slowly, on the wrong channel.
  //
  // Worse on the money pages specifically: the platform's own face beside
  // somebody else's IBAN reads as the platform vouching for that account, or
  // holding the money. It does neither — buyers pay the organizer directly.
  // The person to reach about an account number is the organizer who owns it.
  //
  // So it appears where someone is being invited to become an organizer, and
  // nowhere else. Anything new that is buyer-facing stays clean by default,
  // which is the right way round for a rule nobody will remember to re-check.
  const forOrganizers = pathname === '/organizers' || pathname.startsWith('/organizers/');
  if (!name.trim() || !forOrganizers) return null;

  const first = name.trim().split(/\s+/)[0] || name.trim();

  return (
    <Link
      href="/contact"
      className="contact-fab"
      aria-label={`Talk to ${name.trim()} — ${role.trim() || 'the designer'}`}
    >
      {photoUrl ? (
        // Uploaded by the owner in the admin area and served from our own route,
        // so next/image adds nothing here.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoUrl} alt="" className="contact-fab-photo" style={{ objectPosition: focus }} />
      ) : (
        <span className="contact-fab-photo contact-fab-initial" aria-hidden="true">
          {name.trim().charAt(0).toUpperCase()}
        </span>
      )}
      {/* Widens on hover and focus to say who it is. Hidden from assistive tech
          because the link's own label already carries the full sentence. */}
      <span className="contact-fab-label" aria-hidden="true">
        Talk to {first}
      </span>
    </Link>
  );
}
