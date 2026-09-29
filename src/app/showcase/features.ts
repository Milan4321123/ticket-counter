// The feature catalog behind /showcase.
//
// Every entry here is something the code actually does today — each one was
// checked against the module that implements it (named in the comment beside
// the group). If a feature is removed, remove its card: a portfolio page that
// promises something the product cannot show is worse than a shorter page.
//
// Links come in two kinds:
//   · `live`  — a public page anyone can open right now.
//   · `demo`  — a target for /demo?to=<target>, which opens the visitor's own
//               private 24-hour demo organizer account and lands them there.
// Event and shop pages are reached through the demo rather than by a real
// slug, because real listings come and go.

export type DemoTarget =
  | 'portal'
  | 'event'
  | 'shop'
  | 'orders'
  | 'insights'
  | 'checkin'
  | 'statements'
  | 'promos'
  | 'settings'
  | 'reviews'
  | 'buyer-event'
  | 'buyer-shop'
  | 'checkout'
  | 'kitchen'
  | 'kitchen-setup'
  | 'live'
  | 'appointments'
  | 'buyer-salon';

export function demoHref(target: DemoTarget): string {
  return `/demo?to=${target}`;
}

export interface FeatureLink {
  label: string;
  href: string;
  /** Styles the link as the demo action (vs. a plain public page). */
  kind: 'live' | 'demo';
}

export interface Feature {
  title: string;
  benefit: string;
  links: FeatureLink[];
}

export interface FeatureGroup {
  id: string;
  label: string;
  /** One line under the group heading: who this group is for. */
  intro: string;
  features: Feature[];
}

const live = (href: string, label = 'See it live'): FeatureLink => ({ label, href, kind: 'live' });
const demo = (target: DemoTarget, label = 'Try it in the demo'): FeatureLink => ({
  label,
  href: demoHref(target),
  kind: 'demo',
});

export const FEATURE_GROUPS: FeatureGroup[] = [
  {
    // src/app/page.tsx, src/app/e/[slug], MediaSwiper/MediaLightbox,
    // api/events/[id]/calendar, WaitlistForm, lib/cards.ts
    id: 'buyers',
    label: 'For buyers',
    intro: 'Finding something, booking it and turning up — with no account to create.',
    features: [
      {
        title: 'Install it like an app',
        benefit: 'Add to home screen on any phone; tickets you have opened still show their QR code with no signal.',
        links: [live('/', 'Open on your phone')],
      },
      {
        title: 'Save a ticket to your phone',
        benefit: 'One tap turns a ticket into a boarding-pass style image for the photo library — seat, QR and all.',
        links: [demo('checkout', 'Buy one and save it')],
      },
      {
        title: 'English, Deutsch, नेपाली',
        benefit: 'Switch the menus, bazaar, checkout and seller hub between three languages with one tap.',
        links: [live('/api/lang?to=ne&back=/market', 'See it in Nepali'), live('/api/lang?to=de&back=/market', 'Auf Deutsch')],
      },
      {
        title: 'One feed of every event',
        benefit: 'Every published event from every organizer, grouped into scrollable rails so the next night out is one swipe away.',
        links: [live('/')],
      },
      {
        title: 'Event pages that sell the night',
        benefit: 'Cover photo or video, a swipeable gallery that opens full screen, organizer updates and an FAQ on one page.',
        links: [demo('buyer-event')],
      },
      {
        title: 'Open in Maps & add to calendar',
        benefit: 'The venue opens in the phone’s maps app, and a calendar file puts the date in the buyer’s own calendar.',
        links: [demo('buyer-event')],
      },
      {
        title: 'Checkout without an account',
        benefit: 'Name, email, pay — no sign-up, no password, and seats are held the moment the order is placed.',
        links: [demo('checkout')],
      },
      {
        title: 'QR tickets by email and on an order page',
        benefit: 'Every ticket gets its own QR code, emailed and kept on a personal order page if the email goes missing.',
        links: [demo('checkout')],
      },
      {
        title: 'Sold-out waitlist',
        benefit: 'When an event sells out, buyers leave an email and get exactly one message if seats free up.',
        links: [live('/organizers', 'Read more')],
      },
    ],
  },
  {
    // portal/events/[id]/edit, lib/events listingDetailChecks, lib/media.ts
    id: 'organizers',
    label: 'For event organizers',
    intro: 'A self-service portal that replaces the group-chat poster and the spreadsheet guest list.',
    features: [
      {
        title: 'Reserved seating with a live map',
        benefit: 'Lay out your hall in sections and rows; buyers tap the exact seats they want and no seat can ever be sold twice.',
        links: [demo('checkout', 'Pick your seats'), demo('event', 'Draw a hall')],
      },
      {
        title: 'Organizer dashboard',
        benefit: 'Every event and shop you run, with sales, open payments and what needs attention next.',
        links: [demo('portal')],
      },
      {
        title: 'Editor with a publish checklist',
        benefit: 'Up to 12 photos and 6 videos with cropping, and a Publish tab that lists anything still missing.',
        links: [demo('event')],
      },
      {
        title: 'Ticket tiers, caps and student tickets',
        benefit: 'Set prices and per-tier limits, including student-only tiers that remind door staff to check ID.',
        links: [demo('event')],
      },
      {
        title: 'Table & group bookings',
        benefit: 'Sell a table of 8 as one booking and one payment — each seat still gets its own QR ticket.',
        links: [demo('event')],
      },
      {
        title: 'Insights',
        benefit: 'Money received vs. on its way, a sales chart, a guests table, returning buyers, top referrers and a CSV export.',
        links: [demo('insights')],
      },
      {
        title: 'Orders & payment confirmation',
        benefit: 'Match a transfer by the last characters of its reference or the sender’s name; tickets are sent on confirm.',
        links: [demo('orders')],
      },
      {
        title: 'Monthly statements',
        benefit: 'A printable, CSV-ready record of each month’s orders and payments to hand to a tax advisor.',
        links: [demo('statements')],
      },
    ],
  },
  {
    // kind='shop' listings, lib/marketItems.ts, lib/marketQuery.ts,
    // lib/reviews.ts, lib/savedItems.ts, lib/stalls.ts, lib/listingQuality.ts
    id: 'shops',
    label: 'For shops & restaurants',
    intro: 'The same machine as tickets, pointed at goods: order ahead, pay the seller, collect with a code.',
    features: [
      {
        title: 'Live kitchen screen',
        benefit: 'Paid orders land on a board by themselves — New, Cooking, Ready — with a chime and a full-screen mode for the pass.',
        links: [demo('kitchen', 'Open the kitchen')],
      },
      {
        title: 'Collection time slots',
        benefit: 'Buyers pick when to collect; you set opening days, hours, kitchen notice and how many orders each slot takes.',
        links: [demo('checkout', 'Pick a slot'), demo('kitchen-setup', 'Set the hours')],
      },
      {
        title: 'Choices for every dish',
        benefit: 'Spice level, which achar, no onion — chosen at checkout and printed on the kitchen ticket.',
        links: [demo('buyer-shop', 'Order a momo')],
      },
      {
        title: 'Appointment booking',
        benefit: 'For salons, tutors, pujas and photographers: services with 30-minute slots, one client per slot, and a day board for the bookings.',
        links: [demo('buyer-salon', 'Book a time'), demo('appointments', 'See the day’s book')],
      },
      {
        title: 'Order from the table',
        benefit: 'A printable QR code per table: guests order and pay on their phone and the kitchen sees the table number.',
        links: [demo('kitchen-setup', 'Print table codes')],
      },
      {
        title: 'Your own shop page',
        benefit: 'Items with photos, prices and live stock, plus where and when to collect.',
        links: [demo('buyer-shop'), demo('shop', 'Edit a shop')],
      },
      {
        title: 'The bazaar',
        benefit: 'Every shop’s items in one grid, with department and shop chips, price bands, sorting and pages.',
        links: [live('/market'), live('/market/c/khaja-food', 'A department page')],
      },
      {
        title: 'Live search as you type',
        benefit: 'Results update with every letter, across every shop at once.',
        links: [live('/market?q=momo')],
      },
      {
        title: 'Reviews from real orders',
        benefit: 'Only someone who paid for that exact item can review it, and the seller can reply.',
        links: [demo('buyer-shop'), demo('reviews', 'Reply as the seller')],
      },
      {
        title: 'Stalls at events',
        benefit: 'A shop can run a stall at an event with the host’s approval, so guests order ahead and skip the queue.',
        links: [live('/organizers', 'Read more')],
      },
    ],
  },
  {
    // lib/girocode.ts, lib/paypalLink.ts, lib/paypal.ts, lib/stripe.ts,
    // lib/paymentConnections.ts, lib/paymentFees.ts, lib/reminders.ts
    id: 'payments',
    label: 'Payments',
    intro: 'Money goes straight from buyer to seller. The platform never holds it and takes no cut.',
    features: [
      {
        title: 'Bank transfer with a personal reference',
        benefit: 'Every order gets its own reference, so each transfer on the statement matches one order.',
        links: [demo('checkout')],
      },
      {
        title: 'GiroCode QR',
        benefit: 'Buyers scan a QR with their banking app and the IBAN, amount and reference fill themselves in.',
        links: [demo('checkout')],
      },
      {
        title: 'PayPal.Me',
        benefit: 'Sellers can add their PayPal.Me link as a second, faster way to be paid.',
        links: [demo('settings')],
      },
      {
        title: 'Instant payment with the seller’s own PayPal or Stripe',
        benefit: 'Connect your own account and buyers pay by card or PayPal; a fee table shows what each provider keeps.',
        links: [demo('settings')],
      },
      {
        title: 'Payment reminders & auto-expiry',
        benefit: 'Sellers get a digest when transfers are waiting, and unpaid reservations expire and go back on sale.',
        links: [demo('orders')],
      },
    ],
  },
  {
    // lib/promos.ts, lib/referrals.ts, lib/marketing.ts, portal publish tab,
    // lib/digest.ts, lib/festivals.ts, lib/patro.ts, lib/ogCard.ts
    id: 'growth',
    label: 'Marketing & growth',
    intro: 'Tools to fill the room — in the channels this community actually uses.',
    features: [
      {
        title: 'Promo codes',
        benefit: 'Mint your own codes — early bird, sponsor, one per WhatsApp group — as discounts on your own prices.',
        links: [demo('promos')],
      },
      {
        title: 'Referral rewards',
        benefit: 'Every buyer’s share link carries a code; bring enough paying friends and they earn a voucher you set.',
        links: [demo('settings')],
      },
      {
        title: 'WhatsApp poster in one tap',
        benefit: 'A ready-to-share 1080×1350 image with the event details and a QR code that opens checkout.',
        links: [demo('event')],
      },
      {
        title: '“Keep me posted” announcements',
        benefit: 'Buyers opt in at checkout and confirm by email; you announce new listings, with one-click unsubscribe.',
        links: [demo('checkout')],
      },
      {
        title: 'Weekly digest',
        benefit: 'The week’s events as one bilingual message, ready to paste into WhatsApp groups.',
        links: [live('/digest')],
      },
      {
        title: 'Festival pages & Nepali calendar',
        benefit: 'Pages for Dashain, Tihar and more, plus a Bikram Sambat date converter people come back to.',
        links: [live('/festivals'), live('/patro', 'Open the patro')],
      },
    ],
  },
  {
    // src/app/scan, portal/events/[id]/checkin, lib/tickets.ts
    id: 'door',
    label: 'Door & collection',
    intro: 'The night itself: quick scans, no double entry, nothing for door staff to learn.',
    features: [
      {
        title: 'Live event-day screen',
        benefit: 'Put it on a TV by the door: check-ins count up in real time, the last hour as a chart, who just arrived, and today’s sales.',
        links: [demo('live', 'Open the live screen')],
      },
      {
        title: 'Door scanner links',
        benefit: 'Staff get a time-limited link for one event; each ticket scans once and other events’ tickets are rejected.',
        links: [demo('checkin')],
      },
      {
        title: 'Check-in from the portal',
        benefit: 'Scan from the portal itself — the same box recognises a regular’s customer card and shows who they are.',
        links: [demo('checkin')],
      },
      {
        title: 'Collection codes at the counter',
        benefit: 'Shop orders come with QR collection codes, scanned once as the goods are handed over.',
        links: [demo('buyer-shop')],
      },
    ],
  },
  {
    // lib/assistant.ts, lib/assistantFallback.ts, lib/ai.ts, lib/gemini.ts,
    // lib/transcribe.ts, PlatformAssistant
    id: 'ai',
    label: 'AI',
    intro: 'Useful, grounded helpers — never free-form code or styling on your page.',
    features: [
      {
        title: 'Visitor Q&A on event pages',
        benefit: 'An assistant answers from the organizer’s own content; anything it is unsure of goes to the organizer.',
        links: [demo('buyer-event')],
      },
      {
        title: 'AI page designer',
        benefit: 'Describe the vibe in plain words and it picks a look and writes the headline from your event’s real details.',
        links: [demo('event')],
      },
      {
        title: 'Speak instead of type',
        benefit: 'Organizers can dictate their event description, tuned for Nepali names, venues and food.',
        links: [demo('event')],
      },
      {
        title: 'Platform help chatbot',
        benefit: 'Answers questions about how the platform works, with built-in answers if the AI is unavailable.',
        links: [live('/organizers')],
      },
    ],
  },
  {
    // lib/totp.ts, lib/loginCode.ts, lib/payoutStepUp.ts, lib/payout.ts,
    // lib/secretBox.ts, lib/ratelimit.ts, lib/buyerAccount.ts,
    // lib/retention.ts, lib/consent.ts
    id: 'trust',
    label: 'Trust, privacy & security',
    intro: 'Built for strangers’ money and personal details from day one.',
    features: [
      {
        title: 'Two-factor sign-in',
        benefit: 'An authenticator app, or a code emailed to the account’s own address.',
        links: [demo('settings')],
      },
      {
        title: 'Guarded payout changes',
        benefit: 'Changing where money lands needs a fresh check, waits 24 hours and sends an alarm email.',
        links: [demo('settings')],
      },
      {
        title: 'Encrypted payment credentials',
        benefit: 'A seller’s own PayPal secret or Stripe key is stored encrypted, never in the clear.',
        links: [live('/built#security', 'How it works')],
      },
      {
        title: 'No overselling, no price tampering',
        benefit: 'Prices and seat counts are enforced on the server, even with many buyers at once.',
        links: [live('/built#architecture', 'How it works')],
      },
      {
        title: 'Rate limits & signed links',
        benefit: 'Logins and orders are rate-limited; order pages unlock account data only with a signed token.',
        links: [live('/built#security', 'How it works')],
      },
      {
        title: 'Data erased after the event',
        benefit: 'Buyer names and emails are wiped after a retention window, and a consent banner asks before analytics.',
        links: [live('/privacy')],
      },
    ],
  },
];

export const FEATURE_COUNT = FEATURE_GROUPS.reduce((n, g) => n + g.features.length, 0);
