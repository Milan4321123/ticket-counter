// The Ask chat reads what people type on a phone, fast: "itesms udner 10
// eruro", "evetn", "caht". Before any rule looks at a message, words that are
// one slip away from a word the chat understands are put right — a swapped
// pair, one letter missing, extra or wrong. Conservative on purpose: short
// words only lose a swapped pair, and a word is only changed into a word from
// the list below, never into anything else.
const VOCAB = (
  'items item under below above over euro euros cheap cheaper cheapest price prices event events ticket tickets ' +
  'concert concerts festival weekend tomorrow today tonight shop shops store bazaar market basket account ' +
  'order orders stock available sweets jewellery jewelry clothes clothing groceries spices crafts handicrafts food ' +
  'momo achar thukpa chowmin dhaka topi roti chiya masala tea rice sell selling seller organizer organiser ' +
  'setup create restaurant demo video payment works free where what show find search looking want chat help ' +
  'sure dashain tihar holi teej berlin munich frankfurt hamburg cologne darmstadt heidelberg ' +
  'upload uploaded photo photos picture pictures preview design colours colors update updates publish language'
).split(' ');

/** Damerau (optimal string alignment) distance, stopping early past `max`. */
function distance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    let rowMin = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      rowMin = Math.min(rowMin, d[i][j]);
    }
    if (rowMin > max) return max + 1;
  }
  return d[a.length][b.length];
}

const isSwap = (a: string, b: string) =>
  a.length === b.length && [...a].filter((c, i) => c !== b[i]).length === 2 && [...a].sort().join('') === [...b].sort().join('');

function fixWord(word: string): string {
  const w = word.toLowerCase();
  if (w.length < 4 || !/^[a-z]+$/.test(w) || VOCAB.includes(w)) return word;
  let best = '';
  for (const v of VOCAB) {
    // 4 letters: only a swapped pair ("caht"). 5–6: one slip. 7+: two.
    const ok =
      w.length === 4 ? isSwap(w, v) : distance(w, v, w.length >= 7 ? 2 : 1) <= (w.length >= 7 ? 2 : 1);
    if (ok) {
      if (best) return word; // two candidates: do not guess
      best = v;
    }
  }
  return best || word;
}

/** Short slips a distance rule cannot safely catch. */
const SHORT: Record<string, string> = {
  phtot: 'photo', phtoto: 'photo', potho: 'photo', phot: 'photo', uplaod: 'upload', uplaoed: 'uploaded', uploded: 'uploaded', uplod: 'upload',
  cna: 'can', teh: 'the', hwo: 'how', adn: 'and', fro: 'for', yuo: 'you', ot: 'to', waht: 'what', wat: 'what', pls: 'please', plz: 'please', u: 'you' };

/** The message with obvious slips put right ("itesms udner 10 eruro" → "items under 10 euro"). */
export function fixTypos(q: string): string {
  return q
    .replace(/\bset\s?u[opi]\b/gi, 'set up')
    .replace(/[A-Za-z]+/g, (w) => SHORT[w.toLowerCase()] ?? fixWord(w));
}
