// "k cha, sanchai xa?", "hello", "wie geht's?" — small talk at the start of a
// chat message. The site's chats answer it the way a person would, and read
// only what comes after it as the actual message: "k cha, sanchai xa? mero
// momo pasal cha" is a greeting, then a momo shop — not a question starting
// with "k" ("what"), and not a shop called "k cha".
//
// Client-safe (the setup chat uses it in the browser): no imports.

export type TalkLang = 'en' | 'de' | 'ne' | 'rn';

/** One greeting token; the lookahead keeps "hiana" from reading as "hi" + "ana". */
const TOKEN =
  "(?:hi+|hello+|hey+|hallo|servus|moin|hola|namaste|namaskar|नमस्ते|नमस्कार|good (?:morning|afternoon|evening)|guten (?:morgen|tag|abend)|how are you(?: doing)?|how r u|how is it going|how's it going|wie geht'?s(?: dir| ihnen| euch)?|wie geht es (?:dir|ihnen)|k(?:e)? ?(?:cha|chha|xa|chh)|k (?:ramro|khabar|gardai)(?: (?:cha|chha|xa))?|kasto (?:cha|chha|xa)|khabar (?:k|ke) (?:cha|chha|xa)|sanch(?:ai|ia|ae|e)(?: (?:cha|chha|xa|chu|chhu|hunuhuncha|hunuhunxa|hunuhunchha))?|के छ|कस्तो छ|के खबर|सन्चै(?: छ| हुनुहुन्छ| हुनुहुन्छ)?|dai|didi|bhai|bahini|hajur|sathi|bro|brother|sister|sir|madam)";
const LEAD = new RegExp(`^\\s*(?:${TOKEN}(?=[\\s,.!?।🙏😊🙂👋]|$)[\\s,.!?।🙏😊🙂👋]*)+`, 'i');
const ASKED_HOW = /how are|how r u|how('s| is) it|k(e)? ?(cha|chha|xa|chh)|k (ramro|khabar|gardai)|kasto|khabar|sanch(ai|ia|ae|e)|wie geht|के छ|कस्तो|के खबर|सन्चै/i;
/** A greeting alone must say something friendly — "dai" or "sir" alone is not one. */
const REAL_GREETING = /\bhi+\b|hello|hey|hallo|servus|moin|hola|namaste|namaskar|नमस्|good |guten|how|wie geht|k(e)? ?(cha|chha|xa|chh)|k (ramro|khabar|gardai)|kasto|khabar|sanch(ai|ia|ae|e)|के छ|कस्तो|के खबर|सन्चै/i;

export interface SmallTalk {
  /** The message opens with a greeting. */
  greeting: boolean;
  /** …that asks how we are ("k cha?", "how are you?"). */
  askedHow: boolean;
  /** What comes after it — the actual message ('' when it was only a greeting). */
  rest: string;
}

export function splitGreeting(text: string): SmallTalk {
  const m = text.match(LEAD);
  if (!m || !REAL_GREETING.test(m[0])) return { greeting: false, askedHow: false, rest: text.trim() };
  return { greeting: true, askedHow: ASKED_HOW.test(m[0]), rest: text.slice(m[0].length).trim() };
}

/** The language to answer small talk in: Devanagari, German, Roman Nepali or English. */
export function chatLang(text: string): TalkLang {
  if (/[ऀ-ॿ]/.test(text)) return 'ne';
  if (/\b(hallo|guten|wie geht|ich|mein|meine|und|nicht|bitte|danke|wir|ist)\b|[äöüß]/i.test(text)) return 'de';
  if (/\b(cha|chha|xa|chu|chhu|sanchai|mero|hamro|tapai|hajur|garnus|garna|pasal|ma|ko|lai|ramro|kasto|dai|didi|bhayo|hunchha|huncha)\b/i.test(text)) return 'rn';
  return 'en';
}

/** A person's answer to a greeting. */
export function greetBack(lang: TalkLang, askedHow: boolean): string {
  switch (lang) {
    case 'de':
      return askedHow ? 'Hallo! Mir geht’s gut, danke 🙂' : 'Hallo 🙂';
    case 'ne':
      return askedHow ? 'नमस्ते 🙏 म सन्चै छु, धन्यवाद!' : 'नमस्ते 🙏';
    case 'rn':
      return askedHow ? 'Namaste 🙏 Sanchai chu, dhanyabad!' : 'Namaste 🙏';
    default:
      return askedHow ? 'Namaste 🙏 I’m well, thank you!' : 'Namaste 🙏';
  }
}
