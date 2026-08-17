'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { whatsappUrl } from '@/lib/whatsapp';

/**
 * A floating "message the organizer on WhatsApp" bubble.
 *
 * The same shape and corner as the platform's own contact bubble, deliberately:
 * a visitor already reads a round face in that spot as "a person I can talk
 * to", and this is the person who can actually answer them. It reuses
 * `.contact-fab` outright rather than copying its rules, so the existing
 * behaviour it depends on — sitting clear of the assistant, lifting above the
 * sticky checkout bar on a phone — keeps applying without a second copy that
 * can fall out of step.
 *
 * Why the organizer and not the platform: the question buyers stop on is
 * whether the bank account they are about to pay is really the organizer's.
 * The platform cannot answer that — the money never passes through it — and its
 * own face beside somebody else's IBAN reads as a guarantee it is not making.
 * The person who owns the account can answer it in one message.
 *
 * Renders nothing at all when there is no usable number, so a page never grows
 * a bubble that goes nowhere.
 *
 * Portaled to <body> for the same reason the assistant is: the root layout
 * wraps every page in `<main class="anim-fade-up">`, and while that entrance
 * animation runs, main carries a transform — which makes it the containing
 * block for `position: fixed` children. Rendered in the tree, the bubble spent
 * the first half-second laid out against the DOCUMENT (a few thousand pixels
 * down a long event page) and then snapped into the corner.
 */
export default function OrganizerWhatsApp({
  number,
  organizerName,
  eventName,
  photoUrl = null,
  photoFocus = null,
}: {
  /** Raw as the organizer typed it — validated and normalised here. */
  number: string;
  organizerName: string;
  eventName: string;
  /** The organizer's round profile photo, when they have uploaded one. */
  photoUrl?: string | null;
  /**
   * Which part of that photo sits in the circle, as CSS object-position.
   *
   * Only meaningful for the bubble's OWN photo — the page's profile photo is
   * served already cropped, so a caller falling back to it passes nothing.
   */
  photoFocus?: string | null;
}) {
  // The first line is written for the ORGANIZER's benefit as much as the
  // buyer's: it arrives naming the event, so someone running three of them
  // knows which page the message came from before reading a word of it.
  const href = whatsappUrl(number, `Hi! I have a question about ${eventName}.`);

  // Portals need the DOM, so nothing renders until the client has mounted.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!href || !mounted) return null;

  const name = organizerName.trim();
  const first = name.split(/\s+/)[0] || name;

  return createPortal(
    <a
      href={href}
      // no-print: a buyer saving the transfer instructions as a PDF should get
      // the IBAN and the reference, not a floating button stamped in the corner.
      className="contact-fab contact-fab-wa no-print"
      // A different app, and often a different device. rel is not optional:
      // without it the opened tab can reach back through window.opener.
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Message ${name || 'the organizer'} on WhatsApp about ${eventName}`}
    >
      <span className="contact-fab-photo-wrap">
        {photoUrl ? (
          // Served from our own media route, already cropped to an avatar.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoUrl}
            alt=""
            className="contact-fab-photo"
            style={photoFocus ? { objectPosition: photoFocus } : undefined}
          />
        ) : (
          <span className="contact-fab-photo contact-fab-initial" aria-hidden="true">
            {(name.charAt(0) || 'O').toUpperCase()}
          </span>
        )}
        {/* The glyph is what makes it obvious this opens WhatsApp rather than a
            chat on our own site — the difference matters before someone taps. */}
        <span className="contact-fab-wa-badge" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" role="presentation">
            <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.86 9.86 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm5.8 14.09c-.25.69-1.45 1.32-1.99 1.37-.53.05-1.02.24-3.44-.72-2.9-1.14-4.73-4.1-4.87-4.29-.14-.19-1.16-1.54-1.16-2.94 0-1.4.73-2.09.99-2.37.26-.29.57-.36.76-.36l.54.01c.17 0 .41-.07.64.49.24.58.81 2 .88 2.15.07.14.12.31.02.5-.09.19-.14.31-.28.48l-.42.49c-.14.14-.28.29-.12.57.16.29.71 1.17 1.53 1.9 1.05.93 1.93 1.22 2.21 1.36.28.14.44.12.6-.07.17-.19.69-.81.88-1.09.19-.29.38-.24.64-.14.26.09 1.66.78 1.95.93.28.14.47.21.54.33.07.12.07.69-.18 1.37Z" />
          </svg>
        </span>
      </span>
      <span className="contact-fab-label" aria-hidden="true">
        WhatsApp {first}
      </span>
    </a>,
    document.body
  );
}
