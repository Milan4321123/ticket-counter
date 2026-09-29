// Server-only: minimal Google Gemini client for the Q&A assistants.
//
// Deliberately SDK-free — one plain fetch against the generateContent REST
// endpoint. The key comes from Google AI Studio's free tier (GEMINI_API_KEY),
// so quota errors (429) are an expected, normal condition: every failure of
// any kind returns null and the caller (src/lib/assistant.ts) falls back to
// Anthropic or to organizer-answered questions. Nothing here ever throws.
//
// PERSONAL DATA, AND GOOGLE'S OWN TERMS. The Gemini API Additional Terms say
// two things that matter here (checked 2026-09-30):
//   · "You may use only Paid Services when making API Clients available to
//     users in the European Economic Area" — this site's visitors are. So the
//     project behind the key is meant to have billing on, full stop.
//   · Only paid services come with Google's data processing terms, and on the
//     unpaid tier (outside the EEA) content may be used to improve Google's
//     products.
// So text that can contain somebody's personal data (a visitor's question, a
// voice recording, the contact chat, what a seller types into an assistant)
// only ever goes to a BILLED project. Every call has to say which kind it is
// (`personal`, required), so a new caller cannot forget to choose. Which key a
// call uses (routeFor):
//
//   personal     → GEMINI_PAID_API_KEY (a billed project) when set; else
//                  GEMINI_API_KEY only if GEMINI_PAID_TIER=1 says its own
//                  project is billed; else refused.
//   not personal → the billed key whenever one is configured; otherwise
//   (published      GEMINI_API_KEY as it is (it only ever carries published
//    page text)     page and listing text).
//
// A PAID call first takes one unit of a site-wide daily bucket (lib/aiQuota),
// and only climbs the lite rungs of the model ladder (a full flash model costs
// ~5x). Personal calls and page translation have SEPARATE buckets
// (geminiPaidDailyCap / geminiPaidTranslateDailyCap in lib/legal), so a burst
// of translation — the first German visitor after a deploy — can never use up
// the day's visitor questions, and each bucket puts a hard ceiling on the
// bill. A refused call — not allowed, or its bucket used up — returns null
// exactly as if no key were configured, and the caller's existing fallback
// takes over. Never an error.
import { hasAiQuota, takeAiQuota } from './aiQuota';
import { geminiPaidApiKey, geminiPaidDailyCap, geminiPaidTranslateDailyCap } from './legal';

/**
 * The models tried, in order, for every question.
 *
 * A LADDER rather than one model, because the free tier is not only
 * quota-limited but capacity-limited: on 2026-09-24 Google answered 503
 * "This model is currently experiencing high demand" to nearly every request
 * for the lite models, for hours, while the full flash model answered every
 * time. With a single model that meant the website chatbot replied "I could
 * not find that" to every visitor question — it looked alive and knew nothing.
 *
 * Lite first (largest free allowance), then newer lite, then full flash
 * (smaller daily allowance, but it is only reached when the lite ones are
 * refusing). "-latest" aliases float, so a retired version cannot strand the
 * ladder; the pinned names are extra rungs, and a model Google has retired
 * answers 404 and is simply skipped. GEMINI_MODEL, when set, goes to the front.
 */
const MODEL_LADDER = Array.from(
  new Set(
    [
      (process.env.GEMINI_MODEL || '').trim(),
      // Measured Sep 2026: 3.5-flash-lite answers in ~0.7s with minimal
      // thinking; the "-latest" alias took 5-12s for the same one-liner.
      'gemini-3.5-flash-lite',
      'gemini-flash-lite-latest',
      'gemini-3.5-flash',
      'gemini-flash-latest',
    ].filter(Boolean)
  )
);

/** GEMINI_MODEL, when set: the operator's explicit choice, allowed on paid calls even if it is not a lite model. */
const EXPLICIT_MODEL = (process.env.GEMINI_MODEL || '').trim();

/** Paid calls use the lite models only — the full flash rungs cost about five times as much. */
const PAID_LADDER = MODEL_LADDER.filter((m) => /lite/i.test(m) || m === EXPLICIT_MODEL);

const modelUrl = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

/**
 * A model that just said "busy" (503) or "quota" (429) is skipped for a while,
 * so the next visitor does not wait for the same refusal again. 404 (retired)
 * is benched for an hour. Per server process; a restart forgets it, harmlessly.
 * Keyed per key AND model: the free project's quota says nothing about the
 * paid one's.
 */
const benchedUntil = new Map<string, number>();
const BENCH_MS: Record<number, number> = { 503: 60_000, 500: 60_000, 429: 5 * 60_000, 404: 60 * 60_000 };

/** Per model. Short, because a hung model is followed by up to three more rungs. */
const TIMEOUT_MS = 9_000;
/** For the whole ladder — raised automatically for callers that ask for a longer per-model timeout. */
const TOTAL_BUDGET_MS = 12_000;

/** Failures are routine on a free-tier key — warn at most once per minute. */
const WARN_MIN_INTERVAL_MS = 60_000;
let lastWarnAt = 0;

function warnThrottled(message: string) {
  const now = Date.now();
  if (now - lastWarnAt < WARN_MIN_INTERVAL_MS) return;
  lastWarnAt = now;
  console.warn(message);
}

/** The site-wide daily bucket every PAID personal-content call is counted against (lib/aiQuota). */
export const PAID_BUCKET = 'gemini-paid:all';
/** The separate daily bucket for PAID page/listing translation calls. */
export const PAID_TRANSLATE_BUCKET = 'gemini-paid:translate';
const paidBucket = (kind: { personal: boolean }) =>
  kind.personal
    ? { key: PAID_BUCKET, perDay: geminiPaidDailyCap() }
    : { key: PAID_TRANSLATE_BUCKET, perDay: geminiPaidTranslateDailyCap() };

/** GEMINI_PAID_TIER: GEMINI_API_KEY's own project is billed, so every call on it costs. */
function wholeProjectBilled(): boolean {
  const v = (process.env.GEMINI_PAID_TIER || '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

interface Route {
  key: string;
  /** Billed: counted against PAID_BUCKET, lite models only. */
  paid: boolean;
}

/** Which key a call of this kind would use, and whether it is billed — or null: may not be made at all. */
function routeFor(kind: { personal: boolean }): Route | null {
  const free = (process.env.GEMINI_API_KEY || '').trim();
  const paidKey = geminiPaidApiKey();
  if (kind.personal) {
    if (paidKey) return { key: paidKey, paid: true };
    if (free && wholeProjectBilled()) return { key: free, paid: true };
    return null;
  }
  // Google's terms want billed services for EEA visitors, so a billed key,
  // when there is one, carries translation too.
  if (paidKey) return { key: paidKey, paid: true };
  if (free) return { key: free, paid: wholeProjectBilled() };
  return null;
}

/**
 * Whether a Gemini call of this kind can happen right now: a key it may use
 * is configured (for personal content, a billed one) and — for a paid call —
 * today's paid cap still has room. Counts nothing; geminiJson /
 * takeGeminiRoute do that when a call is really made.
 */
export function geminiEnabled(kind: { personal: boolean }): boolean {
  const route = routeFor(kind);
  if (!route) return false;
  return !route.paid || hasAiQuota([paidBucket(kind)]);
}

const warned = new Set<string>();
/** Once per process and reason: say why a configured key is not being used. */
function warnOnce(reason: string, message: string) {
  if (warned.has(reason)) return;
  warned.add(reason);
  console.warn(message);
}

/**
 * For ONE call about to be made: the key to use and whether it is paid —
 * with a paid call already counted against today's cap — or null when the
 * call may not be made (not allowed, or the paid cap is used up). The caller
 * then falls back exactly as with no key.
 */
function takeGeminiRoute(kind: { personal: boolean }): Route | null {
  const route = routeFor(kind);
  if (!route) {
    if (kind.personal && process.env.GEMINI_API_KEY) {
      warnOnce(
        'personal',
        'Gemini: not sending content that can contain personal data — the unpaid tier has no data processing terms. ' +
          'Set GEMINI_PAID_API_KEY (a billed project) or GEMINI_PAID_TIER=1 (GEMINI_API_KEY is billed).'
      );
    }
    return null;
  }
  if (route.paid && !takeAiQuota([paidBucket(kind)])) {
    const bucket = paidBucket(kind);
    warnOnce(
      `cap:${bucket.key}:${new Date().toISOString().slice(0, 10)}`,
      `Gemini: today's ${bucket.perDay} paid ${kind.personal ? 'calls' : 'translation calls'} are used up ` +
        `(${kind.personal ? 'GEMINI_PAID_DAILY_CAP' : 'GEMINI_PAID_TRANSLATE_DAILY_CAP'}) — falling back until tomorrow.`
    );
    return null;
  }
  return route;
}

/** For callers that talk to Gemini themselves (lib/transcribe): the key for ONE call (counted if paid), or null. */
export function geminiKeyFor(kind: { personal: boolean }): string | null {
  return takeGeminiRoute(kind)?.key ?? null;
}

/** The slice of the generateContent response we actually read. */
interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: unknown }[] } }[];
}

/**
 * Send one prompt to Gemini asking for a JSON reply, and return the parsed
 * JSON value — or null on ANY problem (missing key, network error, non-2xx
 * status incl. 429 quota, timeout, unexpected shape, invalid JSON). Callers
 * must treat null as "no answer from this provider" and fall back.
 */
export interface GeminiOptions {
  /**
   * REQUIRED: can this prompt contain personal data? True for anything a
   * person typed or said that is not already published page text — a
   * visitor's question or chat message, a seller's notes to an assistant, a
   * recording. False only for published listing and page text (translation).
   * A personal prompt is refused (null) unless GEMINI_PAID_TIER is set.
   */
  personal: boolean;
  /**
   * Output budget. The default suits a one-paragraph answer.
   *
   * Raise it for anything that has to return a LIST: the model spends this same
   * budget on its internal reasoning before it writes a single character, so a
   * reply that needs ~300 tokens of JSON can still be truncated mid-object at
   * 800 — measured on this app's FAQ generator, which burned ~1000 tokens
   * thinking. A truncated reply is not partial output, it is unparseable JSON,
   * i.e. a total failure that looks like "the model refused".
   */
  maxOutputTokens?: number;
  /** Longer replies need longer to arrive. */
  timeoutMs?: number;
}

export async function geminiJson(prompt: string, options: GeminiOptions): Promise<unknown> {
  const route = takeGeminiRoute(options);
  if (!route) return null;
  const { key } = route;
  const benchKey = (model: string) => `${route.paid ? 'paid' : 'free'}:${model}`;

  const started = Date.now();
  // Every model failed within the last minute: do not make this visitor wait
  // through the same failures again — the caller has its own fallback. A paid
  // call only ever tries the lite models.
  const ladder = (route.paid ? PAID_LADDER : MODEL_LADDER).filter((m) => (benchedUntil.get(benchKey(m)) ?? 0) <= started);

  // An overall budget, so a visitor never waits more than ~12s for "busy".
  // Callers that asked for a longer per-model wait (list-shaped generators)
  // get at least that much in total.
  const budget = Math.max(TOTAL_BUDGET_MS, options.timeoutMs ?? 0);
  for (const model of ladder) {
    const left = budget - (Date.now() - started);
    if (left < 1_500) break;
    const outcome = await geminiJsonOnce(model, key, prompt, {
      ...options,
      timeoutMs: Math.min(options.timeoutMs ?? TIMEOUT_MS, left),
    });
    if (outcome.kind === 'ok') return outcome.value;
    if (outcome.kind === 'stop') return null; // bad key: no other model will do better
    // Busy, over quota, retired, or hung past the timeout: skip it for a while
    // so the next visitor does not wait for the same failure.
    const bench = outcome.status ? BENCH_MS[outcome.status] : outcome.timedOut ? 60_000 : 0;
    if (bench) benchedUntil.set(benchKey(model), Date.now() + bench);
  }
  return null;
}

/**
 * Models that refused `thinkingLevel` (400). Everything else is asked to think
 * minimally: left to itself a lite model spent 11-13 seconds reasoning before
 * a one-line JSON reply, which is every answer timing out in a chat.
 */
const noThinkingLevel = new Set<string>();

type Outcome =
  | { kind: 'ok'; value: unknown }
  | { kind: 'next'; status?: number; timedOut?: boolean }
  | { kind: 'stop' };

async function geminiJsonOnce(
  model: string,
  key: string,
  prompt: string,
  options: GeminiOptions
): Promise<Outcome> {
  const maxOutputTokens = options.maxOutputTokens ?? 800;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? TIMEOUT_MS);
  try {
    const res = await fetch(`${modelUrl(model)}?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          maxOutputTokens,
          ...(noThinkingLevel.has(model) ? {} : { thinkingConfig: { thinkingLevel: 'minimal' } }),
        },
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      // This model does not take thinkingLevel: remember, and ask again without it.
      if (res.status === 400 && !noThinkingLevel.has(model)) {
        noThinkingLevel.add(model);
        clearTimeout(timer);
        return geminiJsonOnce(model, key, prompt, options);
      }
      if (res.status === 401 || res.status === 403) {
        warnThrottled(
          `Gemini rejected the API key (${res.status}). Check GEMINI_API_KEY / GEMINI_PAID_API_KEY — the assistant is falling back ` +
            `to organizer-answered questions until it is valid.`
        );
        return { kind: 'stop' };
      }
      warnThrottled(
        res.status === 404
          ? `Gemini model "${model}" was not found (404) — Google retired it; skipping to the next model.`
          : `Gemini "${model}" answered ${res.status}` +
              (res.status === 503 ? ' (busy — trying the next model)' : res.status === 429 ? ' (quota — trying the next model)' : '') +
              '.'
      );
      return { kind: 'next', status: res.status };
    }

    const data = (await res.json()) as GeminiResponse;
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof text !== 'string' || text.length === 0) {
      warnThrottled(`Gemini "${model}" returned an unexpected response shape.`);
      return { kind: 'next' };
    }
    return { kind: 'ok', value: JSON.parse(text) };
  } catch (e) {
    // Timeout, network failure, or truncated/invalid JSON: this model produced
    // no answer — the next one may.
    warnThrottled(`Gemini "${model}" request failed: ${e instanceof Error ? e.message : String(e)}`);
    return { kind: 'next', timedOut: e instanceof Error && e.name === 'AbortError' };
  } finally {
    clearTimeout(timer);
  }
}
