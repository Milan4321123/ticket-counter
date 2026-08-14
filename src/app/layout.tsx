import type { Metadata } from 'next';
import Link from 'next/link';
import { Sora } from 'next/font/google';
import './globals.css';
import { getEventConfig } from '@/lib/config';

const sora = Sora({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-display',
  display: 'swap',
});

export async function generateMetadata(): Promise<Metadata> {
  const cfg = getEventConfig();
  return {
    title: `${cfg.eventName} — Tickets`,
    description: `Buy tickets for ${cfg.eventName}: ${cfg.dateDisplay} at ${cfg.venue}.`,
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const cfg = getEventConfig();
  return (
    <html lang="en" className={sora.variable}>
      <body>
        <header className="site-header">
          <div className="container header-inner">
            <Link href="/" className="brand">
              {cfg.eventName}
            </Link>
            <nav>
              <Link href="/checkout" className="btn btn-primary btn-sm">
                Buy tickets
              </Link>
            </nav>
          </div>
        </header>
        <main className="anim-fade-up">{children}</main>
        <footer className="site-footer">
          <div className="container">
            <p className="footer-main">
              {cfg.eventName} · {cfg.dateDisplay} · {cfg.venue}
            </p>
            <p className="footer-sub">Tickets are delivered by email — see you at the show.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
