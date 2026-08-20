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
  /** Stored in events.category and used in no URL yet — stable, never renamed. */
  key: string;
  /** The shelf's name, shown on the /market page and on shop tiles. */
  label: string;
  /** One warm line under the shelf heading on /market. */
  line: string;
}

export const SHOP_CATEGORIES: readonly ShopCategory[] = [
  {
    key: 'khaja-food',
    label: 'Khaja & cooked food',
    line: 'Momo, sel roti, choila — cooked by someone who learned it at home.',
  },
  {
    key: 'sweets-bakery',
    label: 'Sweets & bakery',
    line: 'Lakhamari, barfi, festival sweets and cakes, made in small batches.',
  },
  {
    key: 'groceries-spices',
    label: 'Groceries & spices',
    line: 'Timur, gundruk, the masala your dal has been missing.',
  },
  {
    key: 'clothing-fabrics',
    label: 'Clothing & fabrics',
    line: 'Daura suruwal, saris, dhaka — for the festival photo and for every day.',
  },
  {
    key: 'jewellery',
    label: 'Jewellery',
    line: 'Tilhari, pote, earrings — the pieces that finish an outfit.',
  },
  {
    key: 'handicrafts',
    label: 'Handicrafts & decor',
    line: 'Singing bowls, thangka, khukuri, felt — a bit of home for the shelf.',
  },
  {
    key: 'other',
    label: 'Something else',
    line: 'Sellers whose thing fits no shelf — often the most interesting ones.',
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
