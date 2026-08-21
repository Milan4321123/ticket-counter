// The four steps between "I want this" and "I have it", in one place.
//
// Lifted out of the event page (src/app/e/[slug]/page.tsx) the day /market
// grew a "how ordering works here" section. The bazaar's front page and a
// seller's own page describe the SAME machine — reserve, pay the seller with
// your reference, get a QR code by email, show it when you collect — and two
// hand-written copies of that sequence is how a site comes to promise a
// payment window on one page and a different one on another. The one that is
// wrong is always the one nobody reopened.
//
// Nothing here reads the database or names a particular seller: it is the
// mechanism, in the words the buyer meets it in. Anything specific to one
// listing (the bank details, the collection address, the payment deadline)
// stays on that listing's own page, which is the only place it can be true.
//
// Safe on the client — no database, no server-only imports.
import type { EventKind } from './types';

export interface HowItWorksStep {
  title: string;
  desc: string;
}

/**
 * Which ways the buyer can send the money.
 *
 *  true / false — THIS seller does or does not offer PayPal alongside their
 *                 bank details. What a listing page knows, because it is
 *                 looking at one payout account (see paypalPayee()).
 *  'varies'     — a page about MANY sellers at once, which cannot promise
 *                 either. /market covers the whole bazaar, and every seller
 *                 chooses their own routes; saying "bank transfer" there would
 *                 hide the PayPal some of them offer, and saying "or PayPal"
 *                 would promise a button that a particular shop may not have.
 */
export type PayRoutes = boolean | 'varies';

/** The steps, in order, worded for this kind of listing and these routes. */
export function howItWorks(pay: PayRoutes, kind: EventKind): HowItWorksStep[] {
  const isShop = kind === 'shop';
  // 'varies' is treated as "some of them do" wherever a timing is quoted, so
  // the page never quotes a slower promise than a buyer might actually get.
  const mayPaypal = pay === true || pay === 'varies';
  return [
    isShop
      ? {
          title: 'Place your order',
          desc: 'Pick what you want at checkout and reserve it in one click — no account needed, and your items are held for you right away.',
        }
      : {
          title: 'Reserve your tickets',
          desc: 'Pick your tickets at checkout and reserve them in one click — no account needed, and your seats are held for you right away.',
        },
    pay === 'varies'
      ? {
          title: 'Pay the seller directly',
          desc: 'You get that seller’s own bank details — and their PayPal address, if they offer one — plus a personal payment reference. Send the money from any bank app; just remember to include the reference. The money goes to them, not to us.',
        }
      : pay
        ? {
            title: 'Pay by bank transfer or PayPal',
            desc: 'You get the organizer’s bank details, their PayPal address, and a personal payment reference. Send the money whichever way suits you — just remember to include the reference.',
          }
        : {
            title: 'Pay by bank transfer',
            desc: 'You get the organizer’s bank details and a personal payment reference. Send a normal transfer from any bank app — just remember to include the reference.',
          },
    {
      title: 'Your payment is confirmed',
      desc:
        (mayPaypal
          ? 'PayPal usually arrives within minutes and a bank transfer takes 1–2 business days. As soon as yours lands, the seller confirms it and your '
          : 'As soon as the transfer arrives (usually 1–2 business days), the seller confirms it and your ') +
        (isShop ? 'QR collection code is emailed to you.' : 'QR-code tickets land in your inbox.'),
    },
    isShop
      ? {
          title: 'Show the code when you collect',
          desc: 'Bring your code on your phone or on paper. One quick scan when you arrive and your order is handed over.',
        }
      : {
          title: 'Show the QR code at the door',
          desc: 'Bring your QR codes on your phone or on paper. One quick scan per ticket and you are in — enjoy the show!',
        },
  ];
}
