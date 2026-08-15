// Server-only: minimal Google Gemini client for the Q&A assistants.
//
// Deliberately SDK-free — one plain fetch against the generateContent REST
// endpoint. The key comes from Google AI Studio's free tier (GEMINI_API_KEY),
// so quota errors (429) are an expected, normal condition: every failure of
// any kind returns null and the caller (src/lib/assistant.ts) falls back to
// Anthropic or to organizer-answered questions. Nothing here ever throws.

/**
 * A floating "-latest" alias, NOT a pinned version, and the LITE tier — both
 * deliberate.
 *
 * Floating, because Google retires individual Gemini versions and the endpoint
 * then answers 404 for every request. That is exactly what happened here: this
 * file pinned gemini-2.0-flash, Google withdrew it, and from that moment every
 * visitor question silently fell through to "the organizer has been asked" —
 * the assistant looked alive but could never answer. (gemini-2.5-flash is
 * already closed to new keys too, so pinning any version just restarts the
 * clock.)
 *
 * Lite, because of the FREE-TIER QUOTA, which is the binding constraint here,
 * not quality. The plain "-latest" alias resolves to the current premium flash
 * model, whose free allowance is **20 requests per day** — a single curious
 * visitor exhausts that before lunch, and the assistant then escalates
 * everything until midnight. The lite alias has a far larger allowance and
 * answers in roughly half the time. Answering "where can I park?" from a block
 * of supplied text needs no premium reasoning; not being rate-limited into
 * silence matters far more. Set GEMINI_MODEL to override if you ever move to a
 * paid key.
 */
const GEMINI_MODEL = (process.env.GEMINI_MODEL || '').trim() || 'gemini-flash-lite-latest';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const TIMEOUT_MS = 15_000;

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

  const maxOutputTokens = options.maxOutputTokens ?? 800;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? TIMEOUT_MS);
  try {
    const res = await fetch(`${GEMINI_URL}?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', maxOutputTokens },
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      if (res.status === 404) {
        // Not a blip: the configured model no longer exists, so EVERY question
        // will fall through to the organizer from now on. Say so unmistakably —
        // the previous version of this message was indistinguishable from a
        // quota warning, which is how a dead assistant went unnoticed.
        warnThrottled(
          `Gemini model "${GEMINI_MODEL}" was not found (404). The AI assistant is DISABLED until this is ` +
            `fixed: every visitor question will be passed to the organizer instead. Google retires model ` +
            `versions — set GEMINI_MODEL to a current one, or leave it unset to use the floating alias.`
        );
      } else if (res.status === 401 || res.status === 403) {
        warnThrottled(
          `Gemini rejected the API key (${res.status}). Check GEMINI_API_KEY — the assistant is falling back ` +
            `to organizer-answered questions until it is valid.`
        );
      } else {
        warnThrottled(
          `Gemini request failed with status ${res.status}` +
            (res.status === 429 ? ' (free-tier quota exhausted — falling back)' : '') +
            '.'
        );
      }
      return null;
    }

    const data = (await res.json()) as GeminiResponse;
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof text !== 'string' || text.length === 0) {
      warnThrottled('Gemini returned an unexpected response shape.');
      return null;
    }
    return JSON.parse(text);
  } catch (e) {
    // AbortError (timeout), fetch/network failures, and JSON.parse errors all
    // land here — same outcome: this provider produced no answer.
    warnThrottled(`Gemini request failed: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
