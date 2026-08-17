// The one definition of what counts as an acceptable organizer password.
//
// It lived in three places — the change route, the reset route, and the reset
// FORM — each with its own copy of "8". Three copies of a rule is three chances
// for it to drift, and the one that drifts is usually the form, which then
// promises something the server refuses.
//
// Deliberately dependency-free so the browser and the server can share it: the
// form checks it to give instant feedback, the routes check it because a form
// is not a security boundary.

/**
 * Twelve, not eight.
 *
 * Eight characters of anything a person invents is a weak secret, and the blast
 * radius here is not "someone reads a diary". An organizer session can change
 * the IBAN on their own event — the account ticket money is transferred into —
 * so a guessed password redirects other people's money to whoever guessed it.
 *
 * Everything around the password is already strong: scrypt with a random salt,
 * eight failed attempts per IP per fifteen minutes plus a global backstop, an
 * httpOnly cookie, and a session MAC bound to the password hash so changing it
 * revokes every existing session. The length floor was the one soft spot in the
 * wall, which is exactly where an attacker would push.
 */
export const MIN_PASSWORD_LENGTH = 12;

/** Bounded so a megabyte of text cannot be fed to the hashing function. */
export const MAX_PASSWORD_LENGTH = 200;

/**
 * Passwords that meet the length rule and are still worthless.
 *
 * Not a "strength meter", and deliberately not a demand for a symbol and a
 * capital — those rules produce Passw0rd! and a sticky note, and NIST stopped
 * recommending them years ago. This is the much narrower job of refusing the
 * handful of things a person types when a box demands twelve characters and
 * they have not thought about it.
 *
 * Matched loosely: case is ignored, and anything that is ONLY one of these plus
 * trailing digits is still that password. 'password1234' is not a new idea.
 */
const WEAK = [
  'password',
  'passwort',
  'nepaliconcert',
  'nepalievents',
  'nepalconcert',
  'organizer',
  'organiser',
  'letmein',
  'welcome',
  'admin',
  'qwerty',
  'iloveyou',
  'dashain',
  'namaste',
  'kathmandu',
  'nepal',
];

/** A single repeated character, or a straight run off the keyboard. */
function isTrivialPattern(value: string): boolean {
  if (/^(.)\1+$/.test(value)) return true; // aaaaaaaaaaaa
  const runs = ['abcdefghijklmnopqrstuvwxyz', '01234567890', 'qwertyuiop', 'asdfghjkl'];
  return runs.some((run) => run.includes(value) || [...run].reverse().join('').includes(value));
}

/**
 * The reason a password is unacceptable, or null when it is fine.
 *
 * Returns a sentence written for the person choosing it — it is shown to them
 * directly, and "policy violation" helps nobody pick a better one.
 */
export function passwordProblem(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Your new password needs at least ${MIN_PASSWORD_LENGTH} characters. A few words in a row is easier to remember than a short jumble, and much harder to guess.`;
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return `Passwords can be at most ${MAX_PASSWORD_LENGTH} characters.`;
  }

  const flat = password.toLowerCase().trim();
  // Strip trailing digits before comparing: 'dashain2026' is 'dashain'.
  const core = flat.replace(/[0-9!@#$%^&*._-]+$/, '');
  if (WEAK.includes(core) || WEAK.includes(flat)) {
    return 'That is one of the first passwords anyone would try. Please choose something else — a few unrelated words work well.';
  }
  // Checked on BOTH forms: 'qwertyuiop' is a run, and so is 'qwertyuiop12' —
  // appending two digits to a keyboard row does not make it a password.
  if (isTrivialPattern(flat) || isTrivialPattern(core)) {
    return 'That is a straight run of keys. Please choose something less predictable.';
  }
  return null;
}
