import BrowserFrame from './BrowserFrame';

/**
 * Miniature public SHOP page "screenshot" — pure CSS plus three tiny inline
 * SVG glyphs, no images. A shelf breadcrumb, the shop's own name, a grid of
 * goods with a picture area, a price and an availability chip, the Order
 * button and the collection line.
 *
 * Why the shop's OWN page and not the cross-shop item search (/market/items):
 * this row recruits someone who might open a shop, and the question in their
 * head is "what would MY shop look like" — the storefront is the thing they
 * build, own and send to their customers. The bazaar-wide search is where
 * strangers find them, which is a promise better made in a sentence than in a
 * second mock of a page they do not own. The breadcrumb keeps it visible: this
 * page is inside the bazaar, filed on a shelf.
 *
 * Goods, not tickets, at a glance: pictures in a grid with prices under them,
 * rather than the text rows of ticket tiers on EventPageMock — and every noun
 * comes from the shop half of vocabFor ("Order", "collection code", "left").
 */
export default function ShopMock() {
  return (
    <div
      className="mock-scene"
      role="img"
      aria-label="Preview of a public shop page in the bazaar: the shop Himali Ghar Pasal filed under groceries and spices, three goods on sale — black cardamom pods at 10 euros 50, homemade lapsi achar at 6 euros and sel roti at 4 euros 50 — each with a photo, a price and an availability chip saying how many are left, an Order button, and the collection line saying to collect on Saturdays in Neukölln and show the QR code on your order."
    >
      <div className="mock-tilt">
        <BrowserFrame url="martnepali.com/e/himali-ghar-pasal">
          {/* The shelf the seller picked in the editor. It is here so a
              prospective seller sees that a shop is not a page floating on its
              own — it is filed in the bazaar where shoppers browse. */}
          <div className="mock-chip-label">Bazaar &rsaquo; Groceries &amp; spices</div>
          <div className="mock-h1">Himali Ghar Pasal</div>
          <div className="mock-sub">
            Home kitchen, Berlin &middot; collect in Neuk&ouml;lln
          </div>

          <div className="mock-goods">
            <div className="mock-good">
              <div className="mock-good-pic mock-thumb-c">
                {/* Two cardamom pods. Line art, not a photo: the tile has to
                    read as "a picture of the thing" at 100px wide, and a
                    detailed drawing turns to mush at this size. */}
                <svg className="mock-good-glyph" viewBox="0 0 24 24" aria-hidden>
                  <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                    <ellipse cx="9" cy="12" rx="3.4" ry="6.2" transform="rotate(-18 9 12)" />
                    <ellipse cx="15.5" cy="13" rx="3" ry="5.4" transform="rotate(14 15.5 13)" />
                    <path d="M9 5.4v-1.6M15.5 7.4V6" />
                  </g>
                </svg>
              </div>
              <div className="mock-good-body">
                <div className="mock-good-name">Alaichi &middot; whole pods 100g</div>
                <div className="mock-good-price">&euro;10.50</div>
                <span className="mock-avail">12 left</span>
              </div>
            </div>

            <div className="mock-good">
              <div className="mock-good-pic mock-thumb-a">
                {/* A jar with a lid. */}
                <svg className="mock-good-glyph" viewBox="0 0 24 24" aria-hidden>
                  <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
                    <rect x="7" y="3.5" width="10" height="2.6" rx="1.1" />
                    <path d="M8.2 6.1h7.6v11.6a2.8 2.8 0 0 1-2.8 2.8h-2a2.8 2.8 0 0 1-2.8-2.8Z" />
                    <path d="M8.2 11.6h7.6" />
                  </g>
                </svg>
              </div>
              <div className="mock-good-body">
                <div className="mock-good-name">Lapsi achar &middot; 400g jar</div>
                <div className="mock-good-price">&euro;6.00</div>
                <span className="mock-avail mock-avail-low">3 left</span>
              </div>
            </div>

            <div className="mock-good">
              <div className="mock-good-pic mock-thumb-b">
                {/* A ring of sel roti. */}
                <svg className="mock-good-glyph" viewBox="0 0 24 24" aria-hidden>
                  <g fill="none" stroke="currentColor" strokeWidth="1.6">
                    <circle cx="12" cy="12" r="7.6" />
                    <circle cx="12" cy="12" r="2.7" />
                  </g>
                </svg>
              </div>
              <div className="mock-good-body">
                <div className="mock-good-name">Sel roti &middot; pack of 6</div>
                <div className="mock-good-price">&euro;4.50</div>
                <span className="mock-avail">Made to order</span>
              </div>
            </div>
          </div>

          {/* "Order", not "Get tickets" — the shop half of vocabFor. */}
          <div className="mock-btns mock-goods-foot">
            <span className="mock-btn mock-btn-brand">Order</span>
          </div>

          <div className="mock-card">
            <div className="mock-chip-label">How to collect</div>
            <div className="mock-card-meta">
              Saturdays 3&ndash;7pm, Neuk&ouml;lln &middot; show the QR code on your order and
              I&rsquo;ll scan it at the counter.
            </div>
          </div>
        </BrowserFrame>
      </div>
    </div>
  );
}
