// Server-only: minimal Google Gemini client for the Q&A assistants.
//
// Deliberately SDK-free — one plain fetch against the generateContent REST
// endpoint. The key comes from Google AI Studio's free tier (GEMINI_API_KEY),
// so quota errors (429) are an expected, normal condition: every failure of
// any kind returns null and the caller (src/lib/assistant.ts) falls back to
// Anthropic or to organizer-answered questions. Nothing here ever throws.

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

const modelUrl = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

/**
 * A model that just said "busy" (503) or "quota" (429) is skipped for a while,
 * so the next visitor does not wait for the same refusal again. 404 (retired)
 * is benched for an hour. Per server process; a restart forgets it, harmlessly.
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

export function geminiEnabled(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
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

export async function geminiJson(prompt: string, options: GeminiOptions = {}): Promise<unknown> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;

  const started = Date.now();
  // Every model failed within the last minute: do not make this visitor wait
  // through the same failures again — the caller has its own fallback.
  const ladder = MODEL_LADDER.filter((m) => (benchedUntil.get(m) ?? 0) <= started);

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
    if (bench) benchedUntil.set(model, Date.now() + bench);
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
          `Gemini rejected the API key (${res.status}). Check GEMINI_API_KEY — the assistant is falling back ` +
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
