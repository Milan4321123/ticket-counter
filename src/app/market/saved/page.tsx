import Link from 'next/link';
import SavedItems from '@/components/SavedItems';

// The shopper's own two lists: what they put aside, and what they have been
// looking at. Both live in this browser's localStorage and nowhere else (see
// lib/savedItems), which makes this page a thin shell — the server has nothing
// to fetch, because there is nothing on the server to fetch.
//
// No `export const dynamic` on purpose, and it is the one page in the bazaar
// without it. Every neighbouring page renders fresh because it prints live
// availability that must not go stale; this one prints nothing the server
// knows. Marking it dynamic would buy a request-time render of a page whose
// entire content arrives after hydration.
export const metadata = {
  title: 'Saved for later',
  description:
    'The things you saved while browsing the Nepali bazaar, kept in this browser only.',
  // Nothing here to index: to a crawler this page is a heading and an empty
  // list, because the contents exist only in one person's browser. It is also
  // the closest thing on the site to a record of what somebody has been
  // looking at, and that is not a thing to invite a search engine into.
  robots: { index: false, follow: true },
};

export default function SavedPage() {
  return (
    <section className="section" style={{ paddingTop: 48 }}>
      <div className="container" style={{ maxWidth: 980 }}>
        <nav className="bz-crumbs" aria-label="Breadcrumb">
          <Link href="/market">The bazaar</Link>
          <span aria-current="page">Saved</span>
        </nav>
        <h1 style={{ fontSize: 'clamp(1.7rem, 3.8vw, 2.4rem)', margin: 0 }}>Saved for later</h1>
        {/* The one line the page owes the visitor, and it is said here rather
            than only inside the component because it has to be readable before
            anything has hydrated — the lists themselves render only after this
            browser's storage has been read, so for a moment this sentence is
            the whole page. SavedItems says it again at the foot, next to the
            prices; that is a different moment for the same fact. Somebody up
            here is deciding whether to use the page at all, and somebody down
            there is reading a price and wondering how old it is. */}
        <p className="muted" style={{ margin: '10px 0 0', maxWidth: 640 }}>
          This list is kept in this browser and nothing about it is ever sent to us — we do not
          know what you saved, and neither does the seller.
        </p>
        <p style={{ margin: '14px 0 30px' }}>
          <Link href="/market/items" style={{ textDecoration: 'underline' }}>
            Everything on sale
          </Link>
          {' · '}
          <Link href="/market" style={{ textDecoration: 'underline' }}>
            Browse the shops
          </Link>
        </p>
        <SavedItems />
      </div>
    </section>
  );
}
