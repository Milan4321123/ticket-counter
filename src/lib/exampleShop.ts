// The one place that knows how a listing declares itself an EXAMPLE.
//
// scripts/seed-bazaar.mjs publishes shops the SITE ITSELF owns, so a Nepali
// seller can see their own shop before they build it. Their seller, stock and
// collection address are invented, and checkout refuses an order on them. They
// are marked in exactly one machine-readable place: the listing NAME ends in
// "(example shop)" — see EXAMPLE_NAME_SUFFIX in that script, and the hero
// paragraph on /market that already promises "every shop here that isn't
// marked 'example shop'".
//
// Reading the NAME rather than the seeded id prefix (`seed-bazaar-`) on
// purpose. The name is the thing a visitor is actually shown, so keying off it
// means a chip on a tile and the words in the title can never disagree: if the
// mark is in the name it is on the tile, and if it is not in the name the tile
// was never claiming anything. The id prefix is a script's private convention
// and could be changed without a single visible consequence — which is exactly
// the kind of coupling that goes stale silently.
//
// It degrades the safe way too: an unmarked listing reads as an ordinary shop,
// which is what an unmarked listing is.
//
// Safe on the client — no database, no server-only imports.

/** The suffix the seed appends, matched loosely enough to survive casing. */
const EXAMPLE_MARK = /\s*\((example shop)\)\s*$/i;

export interface ListingName {
  /**
   * The name with the mark taken off — "Taplejung Alaichi Ghar".
   *
   * Split out because a cross-shop grid says the shop name in a small line
   * under an item, where "Taplejung Alaichi Ghar (example shop)" wraps to two
   * lines and reads as part of the shop's name. The fact is louder as its own
   * chip; this is the half that goes back in the sentence.
   */
  name: string;
  /** True when the seller behind it is the site's own invention. */
  isExample: boolean;
}

/** Split a stored listing name into what to print and what to warn about. */
export function readListingName(raw: string): ListingName {
  const name = raw.trim();
  return EXAMPLE_MARK.test(name)
    ? { name: name.replace(EXAMPLE_MARK, '').trim(), isExample: true }
    : { name, isExample: false };
}
