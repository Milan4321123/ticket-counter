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
 * multi-megabyte POST could pin memory/CPU during a flood. We check the
 * Content-Length header first (cheap rejection) and also cap the actual bytes
 * read in case the header lies.
 *
 * Throws BodyTooLargeError when oversized, or SyntaxError on invalid JSON —
 * callers already catch parse failures and treat them as a bad request.
 */
export async function readJsonLimited(req: Request, maxBytes = 16 * 1024): Promise<unknown> {
  const declared = Number(req.headers.get('content-length') || '');
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new BodyTooLargeError();
  }

  const buf = await req.arrayBuffer();
  if (buf.byteLength > maxBytes) {
    throw new BodyTooLargeError();
  }
  if (buf.byteLength === 0) {
    // Mirror req.json()'s behaviour on an empty body: invalid JSON.
    throw new SyntaxError('Unexpected end of JSON input');
  }
  return JSON.parse(new TextDecoder().decode(buf));
}
