// Speech to text, server side, through the Gemini key this app already has.
//
// This replaces the browser's built-in Web Speech API, which was free and
// needed no server but was the wrong tool here for three reasons:
//
//   - It only exists in Chrome. Safari and Firefox users saw no mic at all,
//     and on iOS — where most organizers actually are — that is everyone.
//   - It is tuned for short commands. Someone talking for a minute about their
//     event kept getting cut off at the first pause.
//   - It mangles exactly the words that matter here. Nepali names, venues and
//     food are the whole subject of these events, and a recognizer with no idea
//     what it is listening to turns "Dashain" into "the shine".
//
// Recording the audio and sending it once to a model fixes all three: it works
// in every browser that can record, it does not mind pauses, and — the part
// that matters most — the model can be TOLD what it is listening to. See
// TRANSCRIBE_PROMPT: the vocabulary hint alone is the difference between
// "Ardashen program" and "Dashain program" on a real recording.
// Same key as the rest of the AI features — one Google AI Studio project, one
// free-tier allowance shared between them. That sharing is why the model choice
// below matters so much.

/**
 * Deliberately the lite model, and not a matter of taste.
 *
 * Measured against this project's own key: gemini-flash-latest allows 20
 * requests PER DAY on the free tier — one organizer dictating a few paragraphs
 * would exhaust it before lunch and take the visitor assistant down with it,
 * since both draw on the same project quota. The lite model's allowance is far
 * higher and its transcription of a real clip was accurate. Override with
 * GEMINI_TRANSCRIBE_MODEL if the account ever moves to a paid tier.
 */
const TRANSCRIBE_MODEL =
  (process.env.GEMINI_TRANSCRIBE_MODEL || '').trim() || 'gemini-flash-lite-latest';

const TRANSCRIBE_URL = `https://generativelanguage.googleapis.com/v1beta/models/${TRANSCRIBE_MODEL}:generateContent`;

/**
 * What the model is told before it hears anything.
 *
 * Two jobs. The vocabulary list is the accuracy fix — a general recognizer has
 * no reason to prefer "Dashain" over "the shine" or "momo" over "mo mo", and
 * naming them costs nothing and repairs the words this audience uses most.
 *
 * The rest is restraint. This text goes straight into a field the organizer is
 * writing, so the model must transcribe and stop: no summarising, no answering
 * a question it thinks it heard, no "Sure, here is the transcript". It is also
 * told to keep the speaker's own language, because plenty of organizers will
 * dictate in Nepali or German and translating them would silently rewrite what
 * they said.
 */
const TRANSCRIBE_PROMPT = [
  'Transcribe this recording word for word.',
  '',
  'Context: the speaker is an event organizer in Europe describing their own',
  'event — a Nepali concert, cultural night, or community gathering. Expect',
  'names and words such as: Nepali, Nepal, Namaste, Dashain, Tihar, Teej, Holi,',
  'Losar, momo, samaj, dohori, Newari, Gurkha, Kathmandu, Pokhara, sanskritik,',
  'karyakram, and European city and venue names (Berlin, Darmstadt, Frankfurt,',
  'Hamburg, Kulturhaus, Gemeindehaus, Saal). Prefer these spellings when the',
  'audio is consistent with them.',
  '',
  'Rules:',
  '- Output ONLY the transcript. No preamble, no commentary, no quotation marks.',
  '- Keep the language the speaker actually used. Do not translate.',
  '- Write numbers, times and prices the way they were said (7 pm, 15 euro).',
  '- Add ordinary punctuation and capitalisation so the text is readable.',
  '- If the audio contains no intelligible speech, output nothing at all.',
].join('\n');

/**
 * Formats Gemini documents as supported audio input. The client converts every
 * recording to WAV before upload precisely so this list never has to be
 * guessed at — see SpeechInput — but the check stays as a guard against a
 * caller sending something else.
 */
const ACCEPTED_MIME = new Set([
  'audio/wav',
  'audio/x-wav',
  'audio/mpeg',
  'audio/mp3',
  'audio/aiff',
  'audio/aac',
  'audio/mp4',
  'audio/ogg',
  'audio/flac',
]);

export function isAcceptedAudioMime(mime: string): boolean {
  return ACCEPTED_MIME.has(mime.split(';')[0].trim().toLowerCase());
}

export type TranscribeResult =
  | { ok: true; text: string }
  | { ok: false; reason: 'disabled' | 'busy' | 'failed'; message: string };

interface GeminiTextResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  error?: { code?: number; message?: string };
}

/**
 * Turn one recording into text.
 *
 * `audioBase64` is the raw file, base64 encoded, WITHOUT a data: prefix.
 *
 * Never throws: every failure comes back as a reason the caller can show
 * someone. Dictation is a convenience sitting next to a textarea that still
 * works, so the honest response to a failure is "type it instead", not an
 * error page.
 */
export async function transcribeAudio(
  audioBase64: string,
  mime: string
): Promise<TranscribeResult> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return {
      ok: false,
      reason: 'disabled',
      message: 'Voice typing is not set up on this server — please type instead.',
    };
  }

  let res: Response;
  try {
    res = await fetch(`${TRANSCRIBE_URL}?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: TRANSCRIBE_PROMPT },
              { inline_data: { mime_type: mime, data: audioBase64 } },
            ],
          },
        ],
        generationConfig: {
          // Transcription is not a creative task: the same audio should give
          // the same words every time.
          temperature: 0,
          maxOutputTokens: 2048,
        },
      }),
      // A minute of audio takes a few seconds to process; anything beyond this
      // is a hang, and the person is sitting there watching a spinner.
      signal: AbortSignal.timeout(45_000),
    });
  } catch {
    return {
      ok: false,
      reason: 'failed',
      message: 'We could not reach the transcription service. Please try again, or type it in.',
    };
  }

  let data: GeminiTextResponse;
  try {
    data = (await res.json()) as GeminiTextResponse;
  } catch {
    return { ok: false, reason: 'failed', message: 'Transcription failed — please type it in.' };
  }

  if (!res.ok || data.error) {
    const code = data.error?.code ?? res.status;
    // 429 is the free tier's daily allowance, which is a "come back later",
    // not a fault. Logged loudly because it is also the signal that this
    // account needs a paid tier if dictation is being used in earnest.
    if (code === 429) {
      console.warn(
        `[transcribe] Gemini quota exhausted for "${TRANSCRIBE_MODEL}". Voice typing is ` +
          `unavailable until the daily allowance resets.`
      );
      return {
        ok: false,
        reason: 'busy',
        message: 'Voice typing has hit its daily limit. Please type this one in.',
      };
    }
    if (code === 404) {
      console.warn(
        `[transcribe] Gemini model "${TRANSCRIBE_MODEL}" was not found (404). Set ` +
          `GEMINI_TRANSCRIBE_MODEL to a current model, or unset it to use the default alias.`
      );
    } else {
      console.warn(`[transcribe] Gemini error ${code}: ${data.error?.message ?? 'unknown'}`);
    }
    return { ok: false, reason: 'failed', message: 'Transcription failed — please type it in.' };
  }

  const text = (data.candidates?.[0]?.content?.parts ?? [])
    .map((p) => p.text ?? '')
    .join('')
    .trim();

  // Silence is a legitimate outcome — the prompt asks for nothing at all when
  // there is no speech — and it must not be reported as a failure. The caller
  // shows "we did not catch that".
  return { ok: true, text };
}
