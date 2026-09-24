import { permanentRedirect } from 'next/navigation';

// /market/items was the goods-first view of the bazaar while /market was
// shelves of shops. The two are one page now — /market opens on the wall of
// goods — and this route only forwards the visitor there with everything they
// had set still set: an old bookmark for "momo in Berlin, cheapest first"
// should land on exactly that, not on the front door.
//
// Permanent, because the old address is not coming back and the search
// engines that hold it should move their standing across rather than keep
// re-checking. No render, no data: reading the query string is the whole job.
export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function MarketItemsRedirect({ searchParams }: Props) {
  const sp = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    // The old page spelled the shelf `c`; the new one spells it `category`
    // (and still reads `c`, but a redirect should hand over the canonical
    // spelling rather than one the target merely tolerates).
    const name = key === 'c' ? 'category' : key;
    for (const v of Array.isArray(value) ? value : value === undefined ? [] : [value]) {
      params.append(name, v);
    }
  }
  const qs = params.toString();
  permanentRedirect(qs ? `/market?${qs}` : '/market');
}
