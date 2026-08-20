// Server-only: provider-agnostic Q&A answering for the visitor assistants.
//
// Two assistants share this module: the per-event visitor Q&A (src/lib/ai.ts
// answerVisitorQuestion) and the public platform help bot
// (POST /api/platform/ask). Both want the same thing from a model — a strict
// {"confident":boolean,"answer":string} verdict grounded in a context block —
// so the provider selection lives here exactly once:
//
//   1. Google Gemini (free tier) when GEMINI_API_KEY is set,
//   2. Anthropic (Haiku) when the Gemini call fails or the key is missing,
//   3. null when no provider produced a usable answer.
//
// Callers decide what null means for them (escalate to the organizer, or a
// friendly "not sure" message). They distinguish "no keys configured at all"
// via geminiEnabled() / ANTHROPIC_API_KEY themselves.
import Anthropic from '@anthropic-ai/sdk';
import { geminiEnabled, geminiJson } from './gemini';
import { platformNameFromEnv } from './platform';

export interface BestModelAnswer {
  confident: boolean;
  answer: string;
}

/** Anthropic path only — Gemini is steered by the schema hint in the prompt. */
const ANSWER_SCHEMA = {
  type: 'object',
  properties: {
    confident: {
      type: 'boolean',
      description:
        'true ONLY if the context above explicitly contains the information needed to answer. false otherwise.',
    },
    answer: {
      type: 'string',
      description: 'The friendly answer for the visitor when confident; empty string when not confident.',
    },
  },
  required: ['confident', 'answer'],
  additionalProperties: false,
} as const;

function parseBestModelAnswer(value: unknown): BestModelAnswer | null {
  if (!value || typeof value !== 'object') return null;
  const { confident, answer } = value as { confident?: unknown; answer?: unknown };
  if (typeof confident !== 'boolean' || typeof answer !== 'string') return null;
  return { confident, answer };
}


/**
 * Ask the best available model for a strict-JSON reply, and hand the parsed
 * value back — or null when no provider is configured OR every configured one
 * failed/refused/returned an unusable shape.
 *
 * `schemaHint` spells the JSON contract out in prose for providers without
 * native structured output (Gemini); `schema` enforces the same shape on the
 * Anthropic path. `parse` is the caller's own validator and is the single gate
 * everything passes through, so no model output reaches a caller unchecked.
 *
 * Kept generic so every AI feature shares ONE provider ladder: whatever the
 * shape, the order is always Gemini first, Anthropic second.
 */
export async function jsonWithBestModel<T>(
  systemRules: string,
  userPrompt: string,
  schemaHint: string,
  schema: Record<string, unknown>,
  parse: (value: unknown) => T | null,
  /** Room for LIST-shaped replies; the default keeps one-answer callers as they were. */
  opts: { maxTokens?: number; geminiOutputTokens?: number } = {}
): Promise<T | null> {
  if (geminiEnabled()) {
    const prompt = `${systemRules}\n\n${schemaHint}\n\n${userPrompt}`;
    const raw = opts.geminiOutputTokens
      ? await geminiJson(prompt, { maxOutputTokens: opts.geminiOutputTokens, timeoutMs: 30_000 })
      : await geminiJson(prompt);
    const parsed = parse(raw);
    if (parsed) return parsed;
    // Gemini failed (quota, network, bad shape) — fall through to Anthropic.
  }

  if (!process.env.ANTHROPIC_API_KEY) return null;
  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: opts.maxTokens ?? 700,
      system: systemRules,
      messages: [{ role: 'user', content: userPrompt }],
      output_config: { format: { type: 'json_schema', schema } },
    });
    if (response.stop_reason === 'refusal') return null;
    const text = response.content.find((b) => b.type === 'text');
    if (!text || text.type !== 'text') return null;
    return parse(JSON.parse(text.text));
  } catch (e) {
    console.error('Assistant model call failed:', e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * Ask the best available model to answer `userPrompt` under `systemRules`,
 * expecting strict JSON {"confident":boolean,"answer":string}.
 *
 * Returns null when no provider is configured OR every configured provider
 * failed/refused — callers treat both as "no AI answer this time".
 */
export async function answerWithBestModel(
  systemRules: string,
  userPrompt: string,
  schemaHint: string
): Promise<BestModelAnswer | null> {
  return jsonWithBestModel(systemRules, userPrompt, schemaHint, ANSWER_SCHEMA, parseBestModelAnswer);
}

/**
 * The platform help bot's entire knowledge base — a curated plain-text
 * summary of README.md and PLATFORM.md. Facts only; the answering rules on
 * top of it forbid the model from inventing anything beyond this text.
 */
export function platformAssistantContext(): string {
  return [
    `WHAT ${platformNameFromEnv().toUpperCase()} IS`,
    `${platformNameFromEnv()} is a self-service platform for Nepali events and a bazaar of Nepali sellers: independent organizers sell tickets, and independent shops sell goods for order-ahead collection.`,
    'Accounts are free, and publishing is free — the platform charges nothing while it grows. Buyers pay each organizer or seller directly.',
    'The platform never holds, forwards, or touches the money — it is software access, not a payment service. It provides the system around the sale: the pages, orders, payment references and matching, QR codes, analytics, and monthly statements.',
    'Three areas: the public site for buyers, the organizer portal at /portal, and the platform admin at /admin.',
    'Door staff use time-limited scanner links at /scan — check-in only, no other access.',
    '',
    'WHAT ORGANIZERS CAN DO (in their portal, always only for their own events)',
    '- Create and edit events: name, artist, description, date, venue address (buyers get an Open in Maps link).',
    '- Upload up to 12 photos and 6 short videos per event; either a photo or a video can be the cover. Visitors browse them in a swipeable gallery that opens full screen.',
    '- Prefer a custom-designed page (festival landing page, sponsor logos, a look that is entirely their own)? The team designs it for them — organizers can send a request from the Contact page (/contact) or email the address shown there. The standard self-service page is free and already included.',
    '- Post organizer updates on the event page and maintain an FAQ section.',
    '- Set ticket tiers: names, prices, per-tier caps, and optional student-only tiers (student ID is checked at the door).',
    '- Design the page with a manual theme picker, or describe the vibe in plain words and let the AI page designer pick colors and write the headline, tagline, and highlights.',
    '- Enter their own payment details: an account holder and IBAN, and optionally a PayPal address as a second route. Ticket money arrives directly on whichever the buyer used — the platform never touches it.',
    '- Publish the event to the public feed; it gets its own page at /e/event-name.',
    '- Sell tickets: buyers reserve seats, then send the money to the organizer — bank transfer, or PayPal where the organizer offers it — with a personal payment reference like TICKETS-AB12CD34 (references containing S- mark student tickets).',
    '- Confirm payments: the organizer compares open reservations with their bank statement and confirms each payment with a two-step check (typing the last 4 characters of the reference), which mints QR tickets and emails them to the buyer automatically.',
    '- Get payment reminder emails: the platform can email the organizer a digest at up to three configurable moments while transfers are awaited, so they know when to check their bank account.',
    '- Run the door: generate time-limited scanner links for door staff; each QR ticket scans exactly once, and tickets from other events are rejected.',
    '- See event insights: every event has an Insights page in the portal showing money received vs money on its way, tickets sold vs capacity, the check-in rate, a sales-over-time chart, sales by ticket type, how people paid, a guests table (each buyer\'s bookings, tickets, total, and check-in status), how many guests are returning, the top referrers, the subscriber count, and a spreadsheet download of it all.',
    '- Download a WhatsApp poster in one tap from the Publish tab: a ready-to-share 1080x1350 PNG with the event details and a QR code that opens the checkout.',
    '- Sold-out waitlist: when an event sells out, buyers can leave their email on the event page. If seats free up, everyone on the waitlist is told once by email, and the seats go to whoever books first.',
    '- Table and group bookings: a ticket tier can bundle several seats (a table of 8, a group of 4) — the buyer makes one booking and one payment, and each seat still gets its own QR ticket.',
    '- Announce new listings to opted-in fans: buyers can tick an optional keep-me-posted box at checkout, then confirm from their own inbox (double opt-in) to hear when that organizer lists something new; the organizer can email those confirmed subscribers once per new listing. Strictly opt-in — buyers who did not tick and confirm are NEVER emailed marketing of any kind, and every announcement carries an unsubscribe link.',
    '- Referral tracking: the share links buyers pass around carry a personal code, and the Insights page shows which guests brought friends along — each referrer opens up into the actual bookings they brought (who, when it was confirmed, what it was worth, how many seats), and says where one of those guests went on to bring people of their own.',
    '- REWARD PEOPLE WHO BRING FRIENDS (referral rewards). Yes, an organizer or seller can reward the buyers whose link brings others. They set exactly two numbers under Settings in their portal: how many confirmed PAID bookings someone must bring, and what one voucher is worth. Rewards are switched off by clearing BOTH numbers together — clearing only one is refused, because half a promise ("bring 5 friends" with no reward, or a reward nobody can reach) is not something to guess at on the organizer\'s behalf. Never tell anyone that zeroing one number stops the offer: it does not, and they would walk away believing a live public promise had been taken down.',
    '- The reward is the ORGANIZER\'S OWN DISCOUNT on their OWN prices: the person redeems the voucher at that organizer\'s checkout and simply transfers them less. The platform never funds a voucher, never holds the money, and takes no cut of it — it stays free and stays out of it entirely.',
    '- Only genuinely paid bookings count towards a voucher: the organizer must have confirmed the payment, and free reservations, test orders and bookings that one of the organizer\'s own vouchers or discount codes already part-paid never earn the next voucher (so a voucher can never breed another voucher).',
    '- Once rewards are switched on, the offer is shown ON THE ORGANIZER\'S PUBLIC LISTING PAGE in their own numbers, so buyers browsing see it before they book. It is not shown on a listing where everything is free, because no booking such a link brings could ever be "actually paid for".',
    '- Counting starts the day the organizer switches rewards on (earlier referrals earn nothing), and runs across ALL of that organizer\'s listings. Vouchers already earned keep their value, are spendable at any of that organizer\'s checkouts, work once each, and do not expire. Buyers are emailed the moment they earn one, and see their link, their progress and their vouchers on their order page and on their customer card.',
    '- Depth is visible but never paid: the organizer can see that someone they were brought by went on to bring others, and a voucher is still earned for DIRECT referrals only. There is no multi-level scheme and nobody earns anything from a referral further down the chain.',
    '- Visitor Q&A: event pages have a question box; an AI assistant answers from the organizer\'s own content when it can, and everything else lands in the portal for the organizer to answer.',
    '',
    'THE BAZAAR — SHOPS AND COLLECTION',
    '- Alongside events, the platform hosts SHOPS: a seller\'s own page for goods — momo to pre-order, sweets, crafts and more — with items and stock instead of a date and venue, and pickup details saying where and when to collect.',
    '- Ordering from a shop works exactly like buying tickets: the buyer orders (no account needed), pays the SELLER directly — bank transfer, or PayPal where that seller offers it — with a personal payment reference, and when the seller confirms the payment, QR COLLECTION CODES arrive by email and on the buyer\'s order page.',
    '- A collection code is scanned exactly once, at the counter, as the goods are handed over — it is the proof of a paid order, not a ticket.',
    '- Every shop is listed by category on the bazaar page at /market; shops also appear on the home feed under "Buy from local sellers".',
    '- Order-ahead stalls at events: a shop can run a stall at an event with the HOST ORGANIZER\'s approval. Attendees order ahead from the stalls shown on the event page and skip the queue on the night. Each stall is paid directly by its buyers and scans its own collection codes — the host never handles a stall\'s money or orders.',
    '- Monthly statements: organizers and sellers get a monthly statement at /portal/statements in their portal — a record of their orders and payments, ready to hand to a tax advisor. The platform keeps the books; the money itself always lands with the seller.',
    '- Opening a shop uses the SAME free application as an organizer account: /contact?intent=account. Say what you sell, where you are, and how collection works — a real person reads it, and the account costs nothing.',
    '',
    'WHAT THE PLATFORM ADMIN DOES',
    '- Reads the account applications sent from /contact?intent=account and approves the genuine ones, which creates the account and emails the organizer a temporary password they must change on first sign-in.',
    '- Resets organizer passwords (a fresh one-time password is generated, and the organizer must replace it on their next sign-in) and can disable misbehaving accounts.',
    '',
    'PRICING',
    '- The organizer account is free and never expires.',
    '- Publishing an event is free — there is no platform fee of any kind.',
    '- Ticket prices are set freely by each organizer; the platform takes no cut of ticket sales.',
    '',
    'HOW TO GET AN ORGANIZER ACCOUNT',
    '- There is NO self-service signup. Accounts are only ever created by the platform owner, by hand, after reading an application.',
    '- Someone who wants to sell tickets applies at /contact?intent=account: name, email, and a few words about the event (optionally phone, what kind of event, when, where, and roughly how many people). It costs nothing to apply and no payment details are asked for.',
    '- A real person reads the application. If it looks right, the owner approves it, which creates the account and emails the applicant their sign-in email and a temporary password.',
    '- The organizer signs in at /portal/login with those details and is required to choose a new password before the portal opens — the emailed one only works once.',
    '- The account itself is free, and so is publishing — nothing is ever due to the platform.',
    '- Anyone asking how to sign up should be pointed at /contact?intent=account, never at a signup form — none exists.',
    '',
    'HOW BUYERS PAY',
    '- Buyers need no account. They reserve tickets at checkout, which holds the seats immediately.',
    '- They receive payment instructions (on screen and by email): the amount, the ORGANIZER\'s payment details, and a personal payment reference that must be included so the payment is matched to their tickets.',
    '- There are TWO possible routes and it depends on the organizer: a bank transfer to their IBAN, and — when that organizer has given a PayPal address — PayPal as well. Where PayPal is offered, say so FIRST and say why: it arrives in seconds, so the QR tickets can be sent the same evening, where a bank transfer takes 1-2 business days. Both reach the same organizer directly; the buyer pays one way or the other, never both.',
    '- Do NOT offer PayPal for an event whose organizer has not given a PayPal address. The event page, checkout, order page and emails only show it when it exists, and promising it otherwise sends the buyer looking for something that is not there.',
    '- The money goes straight to the organizer either way. The platform never holds it and takes no cut of ticket sales, so neither route costs the buyer more.',
    '- When the organizer confirms the payment, QR tickets arrive by email and on the buyer\'s personal order page.',
    '- If no payment arrives, the reservation expires on its own and the seats go back on sale.',
    '- The order page has an add-to-calendar button, so the event date lands in the buyer\'s own calendar.',
    '- Sold out? The event page offers a waitlist: leave an email address, and if seats free up everyone on the list gets exactly ONE email — the seats then go to whoever books first. Nothing else is ever sent to that address.',
    '- At checkout there is an optional keep-me-posted checkbox: tick it and you get one confirmation email — pressing the button in it (and nothing else) subscribes you to hear when that organizer lists something new. It is purely optional, every such email has an unsubscribe link, and buyers who leave it unticked never receive marketing of any kind. Never promise announcements or marketing emails to anyone who has not opted in and confirmed.',
    '',
    'REFUNDS AND SUPPORT',
    '- Ticket money goes directly from buyer to organizer, so ONLY the organizer can refund a buyer — sent back the same way it came, by bank transfer or PayPal. The platform cannot refund anyone because it never holds ticket money.',
    '- Buyers with ticket or refund questions should contact the event\'s organizer; organizers with account questions contact the platform.',
    '- Missing ticket emails are usually in spam, and every buyer also has a personal order page where their tickets live.',
  ].join('\n');
}
