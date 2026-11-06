// Server-only: an OpenAI-compatible chat model for the "Talk to the creator"
// chat (lib/creatorChat), so it can talk without Gemini's paid tier.
//
// Which service is used depends only on which key is set:
//   XAI_API_KEY  → xAI Grok   (https://api.x.ai/v1)
//   GROQ_API_KEY → Groq       (https://api.groq.com/openai/v1, free tier)
// CHAT_AI_MODEL overrides the model name. Nothing set → this returns null and
// the chat uses Gemini (paid tier) or its scripted questions, as before.
//
// The visitor's words are personal data: what reaches the service is the
// redacted transcript (emails and phone numbers replaced, lib/creatorChat),
// and the privacy policy names the service whenever its key is set
// (components/legal/Privacy*, chatAiProvider()).

type Provider = { id: 'xai' | 'groq'; name: string; url: string; key: string; model: string };

export function chatAiProvider(): Provider | null {
  const model = process.env.CHAT_AI_MODEL?.trim();
  const xai = process.env.XAI_API_KEY?.trim();
  if (xai) return { id: 'xai', name: 'xAI Grok', url: 'https://api.x.ai/v1/chat/completions', key: xai, model: model || 'grok-3-mini' };
  const groq = process.env.GROQ_API_KEY?.trim();
  if (groq)
    return { id: 'groq', name: 'Groq', url: 'https://api.groq.com/openai/v1/chat/completions', key: groq, model: model || 'llama-3.3-70b-versatile' };
  return null;
}

/** Pull the first {...} object out of a model reply (some wrap it in ```json fences). */
export function parseJsonReply(text: string): unknown {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

/** One prompt in, one JSON object out — or null when the service is not set up, busy or slow. */
export async function chatAiJson(prompt: string, timeoutMs = 12000): Promise<unknown> {
  const p = chatAiProvider();
  if (!p) return null;
  try {
    const res = await fetch(p.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${p.key}` },
      body: JSON.stringify({
        model: p.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,
        max_tokens: 700,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      console.warn(`${p.name} chat: HTTP ${res.status}`);
      return null;
    }
    const data = (await res.json()) as { choices?: { message?: { content?: unknown } }[] };
    const content = data.choices?.[0]?.message?.content;
    return typeof content === 'string' ? parseJsonReply(content) : null;
  } catch (e) {
    console.warn(`${p.name} chat failed:`, e instanceof Error ? e.message : e);
    return null;
  }
}
