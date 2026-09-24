import Link from 'next/link';

export const metadata = { title: 'You are offline', robots: { index: false, follow: false } };

/** What the installed app shows when there is no connection (public/sw.js). */
export default function OfflinePage() {
  return (
    <div className="container container-narrow section" style={{ textAlign: 'center' }}>
      <p className="feed-kicker">No connection</p>
      <h1 className="page-title">You are offline</h1>
      <p className="muted" style={{ maxWidth: 480, margin: '0 auto 18px' }}>
        This page needs the internet. Your tickets and orders you have opened before still work — open them from your
        confirmation email or your browser history, and show the QR code as usual.
      </p>
      <Link href="/" className="btn btn-brand">
        Try again
      </Link>
    </div>
  );
}
