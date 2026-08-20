import Link from 'next/link';
import { platformName } from '@/lib/platform';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Card closed',
  robots: { index: false, follow: false },
};

/**
 * Where "close this card" lands. A static segment, so it wins over the
 * /c/[cardCode] route next to it — and it has to be its own page rather than a
 * banner on the card, because by the time somebody reads this there is no card
 * left to render.
 */
export default function CardClosedPage() {
  return (
    <div className="container container-narrow section">
      <div className="card anim-fade-up">
        <h1 className="card-title">Your card is closed</h1>
        <p>
          It is gone — the row, the code and the QR with it. The old link now opens nothing, and
          nobody can bring it back; if you ever want a card again, ask for one from an order page
          and a brand-new code is made for you.
        </p>
        <p className="muted small">
          Nothing else changed. Your orders, your tickets and any discount codes you were holding
          all stand on their own — {platformName()} never used the card to recognise you anywhere
          else.
        </p>
        <p style={{ marginBottom: 0 }}>
          <Link href="/" className="btn">
            Browse what is on
          </Link>
        </p>
      </div>
    </div>
  );
}
