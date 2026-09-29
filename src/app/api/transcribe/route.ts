import { NextResponse } from 'next/server';
import { clientIp, rateLimit } from '@/lib/ratelimit';
import { isAcceptedAudioMime, transcribeAudio, transcriptionAvailable } from '@/lib/transcribe';
import type { ApiErrorResponse } from '@/lib/types';

/**
 * Voice typing: audio in, text out.
 *
 * Used from the organizer's editor AND from the visitor chat, so it cannot
 * simply require a session. What protects it instead is a hard budget, because
 * the thing being spent is not CPU — it is the project's shared free Gemini
 * allowance, and burning it here would take the visitor assistant and the FAQ
 * generator down with it.
 *
 * Three limits, each closing a different door:
 *   - per IP, so one person cannot sit on the button;
 *   - global, so a hundred IPs cannot do together what one may not do alone;
 *   - per request size, so nobody uploads an album.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** ~1 minute of the 16 kHz mono WAV the client uploads, plus base64 overhead. */
const MAX_AUDIO_BYTES = 3 * 1024 * 1024;
const MAX_BODY_BYTES = Math.ceil(MAX_AUDIO_BYTES * 1.4);

const PER_IP_LIMIT = 20;
const PER_IP_WINDOW_MS = 10 * 60_000;

// A whole-server ceiling. The free tier is a daily bucket shared with every
// other AI feature, so this is deliberately far below it: dictation may spend
// some of the allowance, never all of it.
const GLOBAL_KEY = 'transcribe:all';
const GLOBAL_LIMIT = 240;
const GLOBAL_WINDOW_MS = 60 * 60_000;

/**
 * Whether voice typing works here at all — components/SpeechInput asks once
 * per page and shows no mic when it does not (no key, or Gemini's unpaid tier,
 * which may not be sent a voice: lib/transcribe).
 */
export function GET() {
  return NextResponse.json({ available: transcriptionAvailable() }, { headers: { 'Cache-Control': 'no-store' } });
}

function tooMany(message: string) {
  return NextResponse.json({ error: message } satisfies ApiErrorResponse, { status: 429 });
}

export async function POST(req: Request) {
  // Not available: say so before reading (or rate-counting) a recording.
  if (!transcriptionAvailable()) {
    return NextResponse.json(
      { error: 'Voice typing is not set up on this server — please type instead.' } satisfies ApiErrorResponse,
      { status: 503 }
    );
  }
  // rateLimit() returns TRUE when the call is allowed — the limit is the !.
  if (!rateLimit(`transcribe:${clientIp(req)}`, PER_IP_LIMIT, PER_IP_WINDOW_MS)) {
    return tooMany('That is a lot of dictation in a short time — please type this one in.');
  }
  if (!rateLimit(GLOBAL_KEY, GLOBAL_LIMIT, GLOBAL_WINDOW_MS)) {
    return tooMany('Voice typing is busy right now. Please type this one in.');
  }

  // Read the body with a ceiling BEFORE parsing. A JSON parse of an unbounded
  // string is itself the denial of service.
  const declared = Number(req.headers.get('content-length') ?? '0');
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return NextResponse.json(
      { error: 'That recording is too long — please keep it under a minute.' } satisfies ApiErrorResponse,
      { status: 413 }
    );
  }

  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return NextResponse.json(
      { error: 'The recording did not come through. Please try again.' } satisfies ApiErrorResponse,
      { status: 400 }
    );
  }
  // content-length is a claim, not a fact; check what actually arrived too.
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json(
      { error: 'That recording is too long — please keep it under a minute.' } satisfies ApiErrorResponse,
      { status: 413 }
    );
  }

  let body: { audio?: unknown; mime?: unknown };
  try {
    body = JSON.parse(raw) as { audio?: unknown; mime?: unknown };
  } catch {
    return NextResponse.json(
      { error: 'The recording did not come through. Please try again.' } satisfies ApiErrorResponse,
      { status: 400 }
    );
  }

  const audio = typeof body.audio === 'string' ? body.audio : '';
  const mime = typeof body.mime === 'string' ? body.mime : '';
  if (!audio || !mime) {
    return NextResponse.json(
      { error: 'No audio was received.' } satisfies ApiErrorResponse,
      { status: 400 }
    );
  }
  if (!isAcceptedAudioMime(mime)) {
    return NextResponse.json(
      { error: 'That audio format is not supported.' } satisfies ApiErrorResponse,
      { status: 415 }
    );
  }
  // Reject anything that is not plain base64 before it reaches the model —
  // cheap, and it keeps a malformed body from becoming someone else's problem.
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(audio)) {
    return NextResponse.json(
      { error: 'The recording did not come through. Please try again.' } satisfies ApiErrorResponse,
      { status: 400 }
    );
  }

  const result = await transcribeAudio(audio, mime);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.message } satisfies ApiErrorResponse,
      { status: result.reason === 'busy' ? 429 : result.reason === 'disabled' ? 503 : 502 }
    );
  }

  // The audio itself is never written anywhere — not to disk, not to the
  // database, not to a log. It exists for the length of this request and then
  // it is gone, which is the only honest way to offer a microphone.
  return NextResponse.json({ ok: true, text: result.text });
}
