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
import { eventFeeAmount, platformFeeRule } from './platform';

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
  const feeRule = platformFeeRule();
  const fee500 = eventFeeAmount(500);
  return [
    'WHAT NEPALICONCERT IS',
    'NepaliConcert is a self-service ticketing platform for multiple independent event organizers.',
    `Organizer accounts are free; the platform charges a fee PER EVENT that follows the venue capacity the organizer sets — ${feeRule}, so a 500-person event costs ${fee500} — paid before that event can be published. Buyers pay organizers directly for tickets.`,
    'The platform never holds, forwards, or touches ticket money — it is software access, not a payment service.',
    'Three areas: the public site for buyers, the organizer portal at /portal, and the platform admin at /admin.',
    'Door staff use time-limited scanner links at /scan — check-in only, no other access.',
    '',
    'WHAT ORGANIZERS CAN DO (in their portal, always only for their own events)',
    '- Create and edit events: name, artist, description, date, venue address (buyers get an Open in Maps link).',
    '- Upload up to 12 photos and 6 short videos per event; either a photo or a video can be the cover. Visitors browse them in a swipeable gallery that opens full screen.',
    '- Prefer a custom-designed page (festival landing page, sponsor logos, a look that is entirely their own)? The team designs it for them — organizers can send a request from the Contact page (/contact) or email the address shown there. The standard self-service page is already included in the per-event fee.',
    '- Post organizer updates on the event page and maintain an FAQ section.',
    '- Set ticket tiers: names, prices, per-tier caps, and optional student-only tiers (student ID is checked at the door).',
    '- Design the page with a manual theme picker, or describe the vibe in plain words and let the AI page designer pick colors and write the headline, tagline, and highlights.',
    '- Enter their own payment details: an account holder and IBAN, and optionally a PayPal address as a second route. Ticket money arrives directly on whichever the buyer used — the platform never touches it.',
    `- Pay the platform fee for that event (${feeRule}; the exact amount for their capacity is on the Publish tab, transferred to the platform with the event's own reference like EVENT-1A2B3C4D, also emailed to them); publishing stays locked until the platform confirms it arrived.`,
    '- Publish the event to the public feed; it gets its own page at /e/event-name.',
    '- Sell tickets: buyers reserve seats, then send the money to the organizer — bank transfer, or PayPal where the organizer offers it — with a personal payment reference like TICKETS-AB12CD34 (references containing S- mark student tickets).',
    '- Confirm payments: the organizer compares open reservations with their bank statement and confirms each payment with a two-step check (typing the last 4 characters of the reference), which mints QR tickets and emails them to the buyer automatically.',
    '- Get payment reminder emails: the platform can email the organizer a digest at up to three configurable moments while transfers are awaited, so they know when to check their bank account.',
    '- Run the door: generate time-limited scanner links for door staff; each QR ticket scans exactly once, and tickets from other events are rejected.',
    '- Visitor Q&A: event pages have a question box; an AI assistant answers from the organizer\'s own content when it can, and everything else lands in the portal for the organizer to answer.',
    '',
    'WHAT THE PLATFORM ADMIN DOES',
    '- Reads the account applications sent from /contact?intent=account and approves the genuine ones, which creates the account and emails the organizer a temporary password they must change on first sign-in.',
    `- Confirms each event's fee, with the amount shown per event (two-step: click Fee received, then type the last 4 characters of the event's EVENT- reference), which unlocks publishing for that event and emails the organizer.`,
    '- Resets organizer passwords (a fresh one-time password is generated, and the organizer must replace it on their next sign-in) and can disable misbehaving accounts.',
    '',
    'PRICING',
    '- The organizer account is free and never expires.',
    `- The platform fee is PER EVENT and follows that event's total capacity: ${feeRule}. A 500-capacity event costs ${fee500}, a 300-capacity event ${eventFeeAmount(300)}. It is paid by bank transfer before the event can be published.`,
    '- The amount is quoted on the event\'s Publish tab and stays fixed once the fee is paid; while it is unpaid, changing the capacity changes the fee.',
    '- Ticket prices are set freely by each organizer; the platform takes no cut of ticket sales.',
    '',
    'HOW TO GET AN ORGANIZER ACCOUNT',
    '- There is NO self-service signup. Accounts are only ever created by the platform owner, by hand, after reading an application.',
    '- Someone who wants to sell tickets applies at /contact?intent=account: name, email, and a few words about the event (optionally phone, what kind of event, when, where, and roughly how many people). It costs nothing to apply and no payment details are asked for.',
    '- A real person reads the application. If it looks right, the owner approves it, which creates the account and emails the applicant their sign-in email and a temporary password.',
    '- The organizer signs in at /portal/login with those details and is required to choose a new password before the portal opens — the emailed one only works once.',
    '- The account itself is free. Money is only due per event: each event has its own reference (EVENT-…) shown on its Publish tab and emailed when they try to publish.',
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
    '',
    'REFUNDS AND SUPPORT',
    '- Ticket money goes directly from buyer to organizer, so ONLY the organizer can refund a buyer — sent back the same way it came, by bank transfer or PayPal. The platform cannot refund anyone because it never holds ticket money.',
    '- Buyers with ticket or refund questions should contact the event\'s organizer; organizers with account questions contact the platform.',
    '- Missing ticket emails are usually in spam, and every buyer also has a personal order page where their tickets live.',
  ].join('\n');
}
