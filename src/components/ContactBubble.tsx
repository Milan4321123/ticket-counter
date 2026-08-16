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
}: {
  name: string;
  role: string;
  photoUrl: string;
}) {
  const pathname = usePathname() || '';

  // Not in the places where it is noise rather than help: the owner's own admin
  // area, the door scanner (staff mid-scan do not want a designer), or the
  // contact page itself, where following it would reload the page you are on.
  const hidden =
    !name.trim() ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/scan') ||
    pathname.startsWith('/contact');
  if (hidden) return null;

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
        <img src={photoUrl} alt="" className="contact-fab-photo" />
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
