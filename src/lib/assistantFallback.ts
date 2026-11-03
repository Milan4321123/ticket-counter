// The site chatbot's answers when NO AI model answers.
//
// The help bot (POST /api/platform/ask) runs on Google's free Gemini tier,
// and that tier goes down under load: on 2026-09-24 every free model answered
// 503 "high demand" for hours, and the bot said "I could not find that" to
// every question — including "how much does it cost?", which it knows. A
// visitor cannot tell a busy provider from an ignorant bot, so the site looked
// broken.
//
// These are the handful of questions people actually ask, answered from the
// same facts as platformAssistantContext() in lib/assistant, matched by
// keywords (English, German and romanised Nepali). Deliberately short and
// deliberately conservative: a question that does not clearly hit one topic
// gets no canned answer, and the caller says the assistant is busy instead of
// guessing. Only used when every model failed — a working model always wins.
import { platformNameFromEnv } from './platform';

interface Topic {
  key: string;
  /** Lower-case fragments; any ONE matching counts. Checked as substrings. */
  words: string[];
  /** A further test for questions the fragments cannot catch on their own. */
  also?: (q: string) => boolean;
  answer: (brand: string) => string;
}

const TOPICS: Topic[] = [
  {
    // The studio: "can you make a website for us?", "what have you built?".
    // Never a price for that work — free while we grow (the operator is a
    // student; see app/studio/page.tsx).
    key: 'studio',
    also: (q) =>
      /\b(websites?|webseite|apps?|videos?|promo)\b/.test(q) && /\b(cost|costs|price|prices|pricing|how much|rates?|quote|budget|kostet|kosten|preis\w*|kati)\b/.test(q),
    words: ['make a website', 'build a website', 'a website for', 'need a website', 'website for my', 'webseite', 'make an app', 'build an app', 'an app for', 'need an app', 'promo video', 'ad video', 'video for my', 'video for our', 'walk-on', 'stage screen', 'portfolio', 'your work', 'what have you built', 'what have you made', 'studio', 'website banau', 'video banau', 'app banau'],
    answer: () =>
      'Yes — the team makes apps, websites and ad & stage videos for the Nepali community: ticketing with QR check-in, restaurant order-ahead, shops, association websites, Reels ads, walk-on intros and stage screens. ' +
      'It is free while we grow. See every project at /studio, and tell us what you need at /contact (or /contact?intent=app, ?intent=website, ?intent=video).',
  },
  {
    key: 'cost',
    words: ['cost', 'price of using', 'fee', 'free', 'charge', 'commission', 'how much does', 'kosten', 'gebühr', 'kati parcha', 'paisa lagcha', 'pricing'],
    answer: (b) =>
      `${b} is free: the account, publishing an event or shop, and selling all cost nothing, and the platform takes no cut of sales. ` +
      'If a seller switches on instant card or PayPal payment through their own account, PayPal or Stripe keep their usual fee from that seller’s side.',
  },
  {
    key: 'pay',
    words: ['pay', 'payment', 'bank transfer', 'paypal', 'card', 'überweisung', 'bezahlen', 'tirne', 'bhuktani'],
    answer: () =>
      'You pay the organizer or seller directly — never us. At checkout you either pay instantly by card or PayPal (where the seller offers it), ' +
      'or reserve and send a bank transfer with your personal payment reference. Your QR code is emailed as soon as the payment is confirmed.',
  },
  {
    key: 'refund',
    words: ['refund', 'money back', 'cancel', 'rückerstattung', 'erstattung', 'storn', 'paisa firta'],
    answer: () =>
      'Refunds come from the organizer or seller, because the money goes straight to them — the platform never holds it. ' +
      'Contact them from their event or shop page (there is a question box and often a WhatsApp button).',
  },
  {
    key: 'sell',
    words: ['open a shop', 'open shop', 'sell', 'become a seller', 'organizer account', 'sign up', 'signup', 'register', 'create an account', 'account', 'verkaufen', 'pasal kholna', 'bechna'],
    answer: () =>
      'Apply for a free account at /contact?intent=account — say what you sell or organize, and where. A real person reads it and emails you a sign-in. ' +
      'The same account runs events and shops, and it costs nothing.',
  },
  {
    key: 'ticket-missing',
    words: ['no email', 'did not get', "didn't get", 'not received', 'missing ticket', 'where is my ticket', 'lost my ticket', 'spam'],
    answer: () =>
      'Check your spam folder first. Your tickets or collection codes also live on your personal order page, linked from the confirmation email. ' +
      'If the payment has not been confirmed yet, the organizer or seller still has to match it — ask them directly.',
  },
  {
    key: 'collect',
    words: ['collect', 'pickup', 'pick up', 'abholen', 'qr code', 'lina', 'delivery', 'shipping', 'deliver'],
    answer: () =>
      'Shops here are order-and-collect: you order, pay the seller, and get a QR collection code. The shop page says where and when to collect; ' +
      'the seller scans your code when they hand the order over. Most sellers do not ship.',
  },
  {
    key: 'what',
    words: ['what is this', 'what is martnepali', 'what is the site', 'what do you do', 'what can you do', 'about this site', 'who are you', 'k ho', 'was ist'],
    answer: (b) =>
      `${b} is a studio for the Nepali community — we make apps, websites and ad videos (see /studio) — and a free home for Nepali events and a bazaar of Nepali sellers in Germany: buy tickets for concerts and cultural nights at /events, ` +
      'or order momo, sweets, spices and crafts to collect at /market. You always pay the organizer or seller directly and get a QR code by email.',
  },
];

/** The canned answer for this question, or null when no topic clearly matches. */
export function fallbackAnswer(question: string): string | null {
  const q = question.toLowerCase().normalize('NFC');
  let hits = TOPICS.filter((t) => t.words.some((w) => q.includes(w)) || t.also?.(q));
  // "How much does a website cost?" — the studio answer already says it is
  // free; the platform's fee answer next to it would only blur that.
  if (hits[0]?.key === 'studio') hits = hits.filter((t) => t.key !== 'cost' && t.key !== 'sell');
  if (hits.length === 0) return null;
  // Several topics at once ("how do I pay, and can I get a refund?") — answer
  // the first two rather than pick one and ignore the other.
  const brand = platformNameFromEnv();
  return hits
    .slice(0, 2)
    .map((t) => t.answer(brand))
    .join(' ');
}
