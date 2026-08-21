// The bazaar's shelves: the fixed set of categories a SHOP can sit on.
//
// Fixed rather than free text on purpose — the /market page groups shops by
// this, and a browse page only works when "momo" and "Momo & snacks" and
// "food" are the same shelf. Sellers pick one from a short list; anything the
// list does not cover goes under "Something else" rather than into a
// write-your-own field that would splinter the page into shelves of one.
//
// Events never carry one: a category answers "what does this shop sell?", and
// an event is found by its date and its festival pages instead.
//
// Safe on the client — no database, no server-only imports (the editor's
// <select> and the server's whitelist both read this one list, so the choices
// offered and the choices accepted can never drift).

export interface ShopCategory {
  /** Stored in events.category and used in the /market/c/<key> URL — never renamed. */
  key: string;
  /** The shelf's name, shown on the /market page and on shop tiles. */
  label: string;
  /** One warm line under the shelf heading on /market. */
  line: string;
  /**
   * The shelf's name in Nepali, printed beside the English one.
   *
   * Beside, never instead: the people who shop here read one or both, and a
   * page that picks for them loses half its visitors. It is also what somebody
   * typing "मिठाई" into a search box is looking at, which is why it sits in
   * this table rather than being hard-coded into whichever page is Nepali this
   * week.
   */
  np: string;
  /**
   * Two or three sentences for the shelf's own department page.
   *
   * Written for a shopper who arrived on /market/c/<key> from a search engine
   * with no idea what this site is, so each one says what the shelf holds in
   * words people actually use for the goods, and none of them claims a single
   * thing about how many sellers are on it — that number changes daily and the
   * page counts it for itself.
   */
  intro: string;
  /**
   * What a shopper might type that means this shelf — used for search hints.
   *
   * A wish list, not an inventory: nothing here is offered to anybody until
   * something on sale actually matches it (searchSuggestions in
   * lib/marketItems checks every one of these against the real goods before it
   * will suggest it). So a term for a thing nobody stocks yet costs nothing and
   * starts working the day the first seller lists it.
   */
  terms: readonly string[];
}

export const SHOP_CATEGORIES: readonly ShopCategory[] = [
  {
    key: 'khaja-food',
    label: 'Khaja & cooked food',
    np: 'खाजा',
    line: 'Momo, sel roti, choila — cooked by someone who learned it at home.',
    intro:
      'Khaja is what you eat between meals and what you put in front of somebody who has just ' +
      'walked in: momo, sel roti, chatamari, choila, aloo achar, a plate of sekuwa. The shops ' +
      'here cook in small batches, usually for a particular afternoon, so what is on sale ' +
      'changes with the week and with the festival that is coming. You order from the cook, pay ' +
      'them directly, and collect it with the QR code on your order.',
    terms: [
      'momo',
      'sel roti',
      'chatamari',
      'choila',
      'sekuwa',
      'thukpa',
      'chow mein',
      'aloo achar',
      'samosa',
      'khaja',
      'khaja set',
      'dal bhat',
    ],
  },
  {
    key: 'sweets-bakery',
    label: 'Sweets & bakery',
    np: 'मिठाई',
    line: 'Lakhamari, barfi, festival sweets and cakes, made in small batches.',
    intro:
      'The box you carry to somebody else’s house at Tihar, and the one you keep for ' +
      'yourself: lakhamari, barfi, peda, jeri, malpuwa, yomari when the season is right, and ' +
      'birthday cakes written on in Nepali. Sweets are made to order more often than not, so ' +
      'the collection day on a listing is the day it was baked for.',
    terms: [
      'lakhamari',
      'barfi',
      'peda',
      'jeri',
      'malpuwa',
      'yomari',
      'laddu',
      'mithai',
      'cake',
      'gundpak',
      'anarsa',
      'sweets',
    ],
  },
  {
    key: 'groceries-spices',
    label: 'Groceries & spices',
    np: 'किराना',
    line: 'Timur, gundruk, the masala your dal has been missing.',
    intro:
      'The shelf you raid before you cook: timur, jimbu, dalle khursani, gundruk, sinki, ' +
      'chiura, ilam tea, mustard oil, ready masala for the dishes nobody writes down. Most of ' +
      'it keeps, so this is the shelf people order once and come back to — and the one ' +
      'where a small seller with one very good jar is worth finding.',
    terms: [
      'timur',
      'jimbu',
      'gundruk',
      'sinki',
      'dalle',
      'khursani',
      'chiura',
      'masala',
      'achar',
      'ilam tea',
      'mustard oil',
      'ghee',
    ],
  },
  {
    key: 'clothing-fabrics',
    label: 'Clothing & fabrics',
    np: 'लुगाफाटो',
    line: 'Daura suruwal, saris, dhaka — for the festival photo and for every day.',
    intro:
      'Daura suruwal and dhaka topi for the photograph everybody is in, saris and kurta for ' +
      'the evening, gunyu cholo and haku patasi, pashmina for a German winter, and dhaka cloth ' +
      'by the metre for whoever does their own sewing. Sizes and fabric are the seller’s ' +
      'own words on each listing, so read them and ask before you order.',
    terms: [
      'daura suruwal',
      'dhaka topi',
      'dhaka',
      'sari',
      'kurta',
      'pashmina',
      'shawl',
      'gunyu cholo',
      'haku patasi',
      'topi',
      'scarf',
      'fabric',
    ],
  },
  {
    key: 'jewellery',
    label: 'Jewellery',
    np: 'गहना',
    line: 'Tilhari, pote, earrings — the pieces that finish an outfit.',
    intro:
      'Pote strung the length you asked for, tilhari, chura, sirbandi, earrings, and the ' +
      'everyday silver that goes with jeans as happily as with a sari. What a piece is made of ' +
      'is the seller’s to state and yours to check — the listing says it, and the ' +
      'seller answers for it, not this site.',
    terms: [
      'pote',
      'tilhari',
      'chura',
      'sirbandi',
      'naugedi',
      'mangalsutra',
      'earrings',
      'bangles',
      'necklace',
      'silver',
      'gahana',
    ],
  },
  {
    key: 'handicrafts',
    label: 'Handicrafts & decor',
    np: 'हस्तकला',
    line: 'Singing bowls, thangka, khukuri, felt — a bit of home for the shelf.',
    intro:
      'Singing bowls, thangka, khukuri, lokta paper, felt animals, allo weaving, prayer flags, ' +
      'incense and the small brass things that end up on every Nepali windowsill in Germany. ' +
      'Much of this is made by hand and no two pieces are identical, which is the point — ' +
      'the photographs on a listing are of the thing itself wherever the seller managed it.',
    terms: [
      'singing bowl',
      'thangka',
      'khukuri',
      'lokta',
      'felt',
      'allo',
      'prayer flag',
      'incense',
      'mask',
      'statue',
      'handicraft',
      'dhaka weaving',
    ],
  },
  {
    key: 'other',
    label: 'Something else',
    np: 'अरू',
    line: 'Sellers whose thing fits no shelf — often the most interesting ones.',
    intro:
      'Everything the six shelves above do not have a word for: madal and bansuri, books and ' +
      'music, puja items, herbs, hampers put together for a particular festival, services sold ' +
      'as a collectable booking. If you keep meeting the same thing here, tell us and it gets a ' +
      'shelf of its own — the list is short on purpose, not fixed forever.',
    terms: [
      'madal',
      'bansuri',
      'sarangi',
      'puja',
      'books',
      'music',
      'herbs',
      'gift',
      'hamper',
      'handmade',
    ],
  },
];

/** True when this is a key the platform stores — the server's whitelist. */
export function isShopCategory(key: string): boolean {
  return SHOP_CATEGORIES.some((c) => c.key === key);
}

/**
 * The label for a stored key, or '' — for '' itself (uncategorised, always
 * legal) and for anything unrecognised, so a key retired later degrades to
 * "no chip" rather than to a broken word on a public tile.
 */
export function categoryLabel(key: string): string {
  return SHOP_CATEGORIES.find((c) => c.key === key)?.label ?? '';
}

/**
 * The whole shelf for a stored key, or null.
 *
 * null rather than a made-up shelf so /market/c/<key> can answer a retired or
 * mistyped key with notFound() instead of publishing a department page with an
 * empty heading and an invitation to stock a shelf that does not exist.
 */
export function shopCategory(key: string): ShopCategory | null {
  return SHOP_CATEGORIES.find((c) => c.key === key) ?? null;
}
