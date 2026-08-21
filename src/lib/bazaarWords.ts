// The bazaar's own dictionary: the same thing, in the words different people
// reach for.
//
// A Nepali seller in Germany writes "Taplejung ko alaichi". Their buyer is
// often the same person — but just as often it is their German neighbour
// typing "cardamom", a second-generation kid who knows the food and not the
// spelling, or an auntie typing अलैंची on a Nepali keyboard. Before this file,
// a search for "cardamom" over a bazaar with five listings of alaichi on it
// returned nothing at all, and the honest empty state said "nobody is selling
// that here yet" — which was a lie the site could not see it was telling.
//
// lib/marketItems used to say, in as many words, that search does no synonyms:
// "every one of those would find matches a visitor cannot see the reason for."
// That objection is right and it is the reason this file has the shape it has:
//
//   · It is a HAND-WRITTEN list, not a stemmer and not a language model. Every
//     line is a claim by a person that these words name the same thing, and it
//     can be read, argued with and corrected. Nothing here guesses.
//   · A match is EXPLAINED. Whatever a group adds to the search, the results
//     page can say out loud — "cardamom also matches alaichi" — so a shopper
//     looking at a jar labelled in a language they do not read still knows
//     exactly why it is in front of them. That is the whole answer to the
//     objection: the matches are not mysterious any more.
//   · It is small and it is about FOOD AND GOODS, not about language in
//     general. No conjugation, no plurals-by-rule, no transliteration engine
//     that would confidently turn any Nepali word into three wrong ones.
//
// How it is used: the words are folded into an item's search text when it is
// read (see lib/marketItems), not into the query. Expanding the haystack
// instead of the query keeps the matching itself as plain as it was — one
// substring test per term — and it means a two-word query like "sel roti" or
// "singing bowl" needs no phrase handling to keep working.
//
// Safe on the client — no database, no server-only imports.

export interface WordGroup {
  /**
   * Every spelling that means this thing. Order matters only for the
   * explanation: the FIRST entry is the one a sentence names, so it should be
   * the word a Nepali seller would actually write on their own label.
   */
  words: readonly string[];
  /** How the results page names this group: "alaichi (cardamom)". */
  label: string;
}

/**
 * Kept deliberately short. A dictionary that tries to cover a language goes
 * wrong quietly; one that covers the forty things Nepali sellers in Europe
 * actually list can be checked by eye. Add a line when a seller lists
 * something this misses — that is the intended way for it to grow.
 */
export const BAZAAR_WORDS: readonly WordGroup[] = [
  // ---- cooked food and khaja
  { label: 'momo (dumplings)', words: ['momo', 'momos', 'मोमो', 'dumpling', 'dumplings'] },
  { label: 'sel roti', words: ['sel roti', 'selroti', 'सेल रोटी', 'rice ring', 'rice doughnut'] },
  { label: 'choila (grilled meat)', words: ['choila', 'chhoila', 'छोइला', 'grilled buff'] },
  { label: 'sukuti (dried meat)', words: ['sukuti', 'सुकुटी', 'dried meat', 'jerky'] },
  { label: 'chatamari', words: ['chatamari', 'चतामरी', 'newari pizza', 'rice crepe'] },
  { label: 'thukpa (noodle soup)', words: ['thukpa', 'थुक्पा', 'noodle soup'] },
  { label: 'chowmein', words: ['chowmein', 'chow mein', 'चाउमिन', 'fried noodles'] },
  { label: 'aloo (potato)', words: ['aloo', 'alu', 'आलु', 'potato'] },

  // ---- sweets
  // 'sweets' but not 'sweet': the singular turns "sweet potato pickle" into a
  // listing of mithai, and a group is only worth having while every word in it
  // means the thing on its own.
  { label: 'mithai (sweets)', words: ['mithai', 'मिठाई', 'sweets'] },
  { label: 'lakhamari', words: ['lakhamari', 'लखामरी'] },
  { label: 'barfi', words: ['barfi', 'burfi', 'बर्फी', 'fudge'] },
  { label: 'jeri (jalebi)', words: ['jeri', 'jalebi', 'जेरी', 'जलेबी'] },
  { label: 'juju dhau (curd)', words: ['juju dhau', 'जुजु धौ', 'king curd', 'yoghurt', 'yogurt', 'curd'] },
  { label: 'laddu', words: ['laddu', 'ladoo', 'लड्डु'] },

  // ---- groceries and spices
  { label: 'alaichi (cardamom)', words: ['alaichi', 'elaichi', 'अलैंची', 'cardamom'] },
  { label: 'timur (Sichuan pepper)', words: ['timur', 'टिमुर', 'sichuan pepper', 'szechuan pepper', 'prickly ash'] },
  { label: 'gundruk (fermented greens)', words: ['gundruk', 'गुन्द्रुक', 'fermented greens'] },
  { label: 'chiya (tea)', words: ['chiya', 'chia', 'चिया', 'tea', 'masala tea', 'chai'] },
  { label: 'achar (pickle)', words: ['achar', 'अचार', 'pickle', 'pickles', 'chutney'] },
  { label: 'masala (spice mix)', words: ['masala', 'मसला', 'spice', 'spices', 'spice mix'] },
  { label: 'chiura (beaten rice)', words: ['chiura', 'चिउरा', 'beaten rice', 'flattened rice', 'poha'] },
  { label: 'ghyu (ghee)', words: ['ghyu', 'घ्यू', 'ghee', 'clarified butter'] },
  { label: 'dal (lentils)', words: ['dal', 'daal', 'दाल', 'lentil', 'lentils'] },
  { label: 'jimbu', words: ['jimbu', 'जिम्बु', 'himalayan herb'] },
  { label: 'titaura', words: ['titaura', 'तितौरा', 'lapsi candy'] },
  { label: 'lapsi (hog plum)', words: ['lapsi', 'लप्सी', 'hog plum'] },
  { label: 'rakshi / tongba', words: ['rakshi', 'रक्सी', 'tongba', 'तोङ्बा', 'millet drink'] },

  // ---- clothing and fabric
  { label: 'daura suruwal', words: ['daura suruwal', 'daura', 'दौरा सुरुवाल', 'national dress'] },
  { label: 'dhaka topi', words: ['dhaka topi', 'topi', 'ढाका टोपी', 'nepali cap', 'nepali hat'] },
  { label: 'dhaka (woven cloth)', words: ['dhaka', 'ढाका', 'handwoven cloth'] },
  { label: 'sari', words: ['sari', 'saree', 'साडी', 'सारी'] },
  { label: 'kurta', words: ['kurta', 'kurtha', 'कुर्ता', 'tunic'] },
  { label: 'gunyu cholo', words: ['gunyu cholo', 'gunyu', 'गुन्यु चोलो'] },
  { label: 'pashmina', words: ['pashmina', 'पस्मिना', 'shawl'] },

  // ---- jewellery
  { label: 'pote (glass beads)', words: ['pote', 'पोते', 'glass beads', 'bead necklace'] },
  { label: 'tilhari', words: ['tilhari', 'तिलहरी'] },
  { label: 'mangalsutra', words: ['mangalsutra', 'मंगलसूत्र'] },
  { label: 'bangles', words: ['bangle', 'bangles', 'chura', 'चुरा'] },

  // ---- handicraft and home
  { label: 'khukuri', words: ['khukuri', 'khukri', 'kukri', 'खुकुरी', 'nepali knife'] },
  { label: 'thangka', words: ['thangka', 'thanka', 'थान्का', 'buddhist painting'] },
  { label: 'singing bowl', words: ['singing bowl', 'singing bowls', 'सिंगिङ बाउल', 'tibetan bowl'] },
  { label: 'lokta paper', words: ['lokta', 'लोक्ता', 'handmade paper', 'nepali paper'] },
  { label: 'felt (wool)', words: ['felt', 'फेल्ट', 'wool ball', 'felt ball'] },
  { label: 'prayer flags', words: ['prayer flag', 'prayer flags', 'lungta', 'लुङ्ता'] },
  { label: 'mandala', words: ['mandala', 'मण्डला'] },
  { label: 'incense (dhup)', words: ['dhup', 'धुप', 'incense'] },

  // ---- festivals, because people shop by occasion
  { label: 'Dashain', words: ['dashain', 'दशैं', 'dasain'] },
  { label: 'Tihar', words: ['tihar', 'तिहार', 'deepawali', 'diwali'] },
  { label: 'Teej', words: ['teej', 'तीज'] },
  // No 'new year' here. Losar is one of the new years this community keeps and
  // Nepali New Year in Baisakh is another, so the phrase would file each under
  // the other — a wrong answer delivered confidently, which is the one thing
  // this list must not do.
  { label: 'Losar', words: ['losar', 'lhosar', 'ल्होसार'] },
];

/** Is this position in `text` the start and end of a whole word? */
function isBoundary(char: string | undefined): boolean {
  // Undefined means the string ended, which is a boundary. Anything that is
  // not a letter or a digit is one too — and \p{L} matters here rather than
  // \w, because half the words in the list above are Devanagari and \w is
  // ASCII-only, so \b would treat every one of them as a run of boundaries.
  return char === undefined || !/[\p{L}\p{N}]/u.test(char);
}

/** True when `word` appears in `text` as a whole word, not inside another. */
export function containsWord(text: string, word: string): boolean {
  let from = 0;
  for (;;) {
    const at = text.indexOf(word, from);
    if (at === -1) return false;
    if (isBoundary(text[at - 1]) && isBoundary(text[at + word.length])) return true;
    from = at + 1;
  }
}

/**
 * The other spellings of everything this text mentions.
 *
 * Whole-word on the DETECTING side on purpose: a description containing
 * "potential" must not be filed under pote, and "sweet potato" must not become
 * a listing of mithai. The matching side stays a plain substring test, which
 * is what it always was — this only decides which extra words an item is
 * honestly described by.
 */
export function relatedWords(text: string): string[] {
  const found = new Set<string>();
  for (const group of BAZAAR_WORDS) {
    if (group.words.some((w) => containsWord(text, w))) {
      for (const w of group.words) found.add(w);
    }
  }
  return [...found];
}

/**
 * Which groups a shopper's own words belong to — what the results page needs
 * to say "cardamom also matches alaichi" rather than leaving them to wonder
 * why a jar labelled in Devanagari came back.
 *
 * Only groups where the term is NOT already the group's own first spelling
 * are worth mentioning: somebody who typed "alaichi" does not need to be told
 * that it matched alaichi.
 */
export function expansionsFor(terms: string[]): { typed: string; label: string }[] {
  const out: { typed: string; label: string }[] = [];
  for (const term of terms) {
    for (const group of BAZAAR_WORDS) {
      if (!group.words.some((w) => w === term)) continue;
      if (group.words[0] === term) continue;
      if (out.some((o) => o.label === group.label)) continue;
      out.push({ typed: term, label: group.label });
    }
  }
  return out;
}
