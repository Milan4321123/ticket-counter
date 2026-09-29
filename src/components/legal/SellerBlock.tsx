import type { SellerIdentity } from '@/lib/sellerIdentity';
import { sellerAddressOneLine } from '@/lib/sellerIdentity';

/**
 * The seller of record, printed where a buyer is deciding to buy or holding
 * what they bought: legal name, address, "vertreten durch …", register entry
 * and a contact address — only the fields the organizer filled in.
 *
 * It is the organizer's Impressum on their own pages and the answer to "who is
 * the controller of my data?" (Art. 13 GDPR), and it keeps the platform a
 * disclosed agent rather than the seller (§3 Abs. 11 UStG).
 *
 * Names and addresses carry translate="no": a browser translating the page
 * must not turn "Nepali Samaj Darmstadt e.V." or a street name into something
 * else. The labels around them stay translatable.
 *
 * Renders nothing when the organizer has not filled in any legal details,
 * unless `fallback` is set — then it still names the seller by account name,
 * for pages that have no other seller line of their own.
 */
export default function SellerBlock({
  seller,
  kind,
  platformName,
  fallback = false,
  style,
}: {
  seller: SellerIdentity | null;
  kind: 'event' | 'shop';
  /** When given, one closing line saying the platform only provides the software. */
  platformName?: string;
  fallback?: boolean;
  style?: React.CSSProperties;
}) {
  if (!seller) return null;
  if (!seller.hasLegalDetails && !(fallback && seller.displayName)) return null;
  const isShop = kind === 'shop';
  const address = sellerAddressOneLine(seller);
  return (
    <section
      aria-label={isShop ? 'Seller' : 'Organizer'}
      className="muted small"
      style={{
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: '10px 14px',
        lineHeight: 1.5,
        margin: '12px 0',
        ...style,
      }}
    >
      <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>
        {isShop ? 'Verkäufer / Seller' : 'Veranstalter / Organizer'}
      </div>
      <div>
        <strong translate="no">{seller.displayName}</strong>
        {address ? (
          <>
            {', '}
            <span translate="no">{address}</span>
          </>
        ) : null}
      </div>
      {seller.representative ? (
        <div>
          vertreten durch / represented by <span translate="no">{seller.representative}</span>
        </div>
      ) : null}
      {seller.register ? <div translate="no">{seller.register}</div> : null}
      {seller.contactEmail ? (
        <div>
          Contact:{' '}
          <a href={`mailto:${seller.contactEmail}`} translate="no">
            {seller.contactEmail}
          </a>
        </div>
      ) : null}
      {platformName ? (
        <div style={{ marginTop: 4 }}>
          {isShop ? 'Your order is placed with' : 'Your contract is with'} the {isShop ? 'seller' : 'organizer'} named
          here. {platformName} provides the booking software only.
        </div>
      ) : null}
    </section>
  );
}
