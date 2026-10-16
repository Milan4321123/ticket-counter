// Cities, folded so that the same place is one place however it was typed.
//
// Every city on the site is free text — an organizer's venue, a member's home
// town, a help post — and the community writes the same town five ways:
// "Frankfurt am Main", "frankfurt", "60311 Frankfurt", "Munich", "München".
// Filters, the swipe deck's city chips and the city pages all need ONE key per
// place, and a name to print for it. Client-safe: no database, no server
// imports — the deck filters in the browser with the same fold.

/** Towns with a Nepali community worth a suggestion, German spelling. */
export const KNOWN_CITIES = [
  'Berlin',
  'Hamburg',
  'München',
  'Köln',
  'Frankfurt',
  'Stuttgart',
  'Düsseldorf',
  'Leipzig',
  'Dortmund',
  'Essen',
  'Bremen',
  'Dresden',
  'Hannover',
  'Nürnberg',
  'Bonn',
  'Münster',
  'Mannheim',
  'Karlsruhe',
  'Wiesbaden',
  'Mainz',
  'Darmstadt',
  'Heidelberg',
  'Freiburg',
  'Aachen',
  'Augsburg',
  'Regensburg',
  'Würzburg',
  'Kassel',
  'Göttingen',
  'Erlangen',
  'Ulm',
  'Trier',
  'Kaiserslautern',
  'Saarbrücken',
  'Magdeburg',
  'Halle',
  'Jena',
  'Erfurt',
  'Potsdam',
  'Rostock',
  'Kiel',
  'Lübeck',
  'Bielefeld',
  'Paderborn',
  'Siegen',
  'Gießen',
  'Marburg',
  'Offenbach',
  'Ingolstadt',
  'Konstanz',
  'Tübingen',
  'Passau',
  'Bamberg',
  'Bayreuth',
  'Chemnitz',
  'Wuppertal',
  'Braunschweig',
  'Koblenz',
  'Fulda',
  'Heilbronn',
  'Ludwigshafen',
  'Hanau',
];

/** English names people use for German cities, folded → the German key. */
const ENGLISH: Record<string, string> = {
  munich: 'munchen',
  cologne: 'koln',
  nuremberg: 'nurnberg',
  hanover: 'hannover',
  brunswick: 'braunschweig',
};

/**
 * The comparison key: lower case, umlauts and their two-letter spellings
 * folded ("München" = "Muenchen" = "munchen"), postcodes and the river or
 * region suffix dropped ("Frankfurt am Main" = "Frankfurt"), English names
 * mapped to the German ones. Never shown to anyone.
 */
export function cityKey(raw: string): string {
  let s = (raw || '')
    .replace(/\(.*?\)/g, ' ')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/ae/g, 'a')
    .replace(/oe/g, 'o')
    .replace(/ue/g, 'u')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\d+/g, ' ')
    .replace(/[^a-z\s-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  // "Frankfurt am Main", "Freiburg im Breisgau", "Halle (Saale)", "Offenbach a.M."
  s = s.replace(/\s+(am|an der|im|in der|a|ob der|bei)\s.*$/, '').replace(/\s+[a-z]$/, '').trim();
  return ENGLISH[s] ?? s;
}

const KNOWN = new Map(KNOWN_CITIES.map((c) => [cityKey(c), c]));

/** The name to print: the known spelling when there is one, else as typed (tidied). */
export function cityName(raw: string): string {
  const key = cityKey(raw);
  if (!key) return '';
  const known = KNOWN.get(key);
  if (known) return known;
  const tidy = (raw || '').replace(/\b\d{4,6}\b/g, '').replace(/\s+/g, ' ').trim();
  return tidy ? tidy[0].toUpperCase() + tidy.slice(1) : '';
}

/** URL segment for a city page: "München" → "munchen". */
export function citySlug(raw: string): string {
  return cityKey(raw).replace(/\s+/g, '-');
}
