// Server-only: small request-hardening helpers shared by API routes.

/** Raised when a request body is larger than a route is willing to read. */
export class BodyTooLargeError extends Error {
  constructor() {
    super('Request body too large');
    this.name = 'BodyTooLargeError';
  }
}

/**
 * Read and JSON-parse a request body, refusing anything over `maxBytes`
 * (default 16 KB — every request this app accepts is tiny). Next.js App Router
 * does NOT cap body size by default, so without this a single malicious
 * multi-megabyte POST could pin memory/CPU during a flood.
 *
 * The Content-Length header is only a cheap early rejection — it can lie or
 * be absent entirely (chunked bodies), so the real limit is enforced on the
 * bytes AS THEY STREAM IN: the read is aborted the moment the running total
 * exceeds `maxBytes`, never buffering the whole body first.
 *
 * Throws BodyTooLargeError when oversized, or SyntaxError on invalid JSON —
 * callers already catch parse failures and treat them as a bad request.
 */
export async function readJsonLimited(req: Request, maxBytes = 16 * 1024): Promise<unknown> {
  const declared = Number(req.headers.get('content-length') || '');
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new BodyTooLargeError();
  }

  if (!req.body) {
    // Mirror req.json()'s behaviour on an empty body: invalid JSON.
    throw new SyntaxError('Unexpected end of JSON input');
  }

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new BodyTooLargeError();
    }
    chunks.push(value);
  }

  if (total === 0) {
    // Mirror req.json()'s behaviour on an empty body: invalid JSON.
    throw new SyntaxError('Unexpected end of JSON input');
  }
  const buf = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    buf.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(buf));
}

/**
 * A state-changing request must come from this site: when the browser names
 * an Origin, it has to be ours (the request's own host or the configured base
 * URL). No Origin at all is a non-browser client and is left to the route's
 * other checks, as in api/demo/start.
 */
export function fromThisSite(req: Request, baseUrl: string): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return true;
  try {
    const host = new URL(origin).host;
    return host === new URL(req.url).host || host === new URL(baseUrl).host;
  } catch {
    return false;
  }
}
