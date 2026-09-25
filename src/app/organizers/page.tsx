import Link from 'next/link';
import { shareImages } from '@/lib/seo';
import { platformNameFromEnv } from '@/lib/platform';
import PlatformAssistant from '@/components/PlatformAssistant';
import InView from '@/components/InView';
import DemoStart from '@/components/DemoStart';
import './organizers.css';

// The brand name comes from an env var — read it fresh on every request.
export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  const title = 'Sell tickets or open a shop — free for organizers';
  const description =
    'Your own event page with QR tickets, or your own shop in the bazaar. Payments land in ' +
    'your own bank account. Completely free — no fees, no commission.';
  return {
    title,
    description,
    alternates: { canonical: '/organizers' },
    openGraph: { type: 'website', title, description, url: '/organizers', images: shareImages() },
  };
}

/**
 * The page for people who might sell here. Short on purpose: one promise,
 * then six small animated screens of the real tools — each with one line and
 * a door into the demo, where the real thing is one click away. Everything a
 * longer page used to explain, the demo now shows.
 */
export default function OrganizersPage() {
  return (
    <div className="og">
      {/* ---- Hero ---- */}
      <section className="og-hero container">
        <p className="feed-kicker anim-fade-up">For organizers, restaurants &amp; shops</p>
        <h1 className="og-title anim-fade-up anim-d1">
          Sell tickets and goods.
          <br />
          <span>Free.</span>
        </h1>
        <p className="og-sub anim-fade-up anim-d2">
          Your page, your orders, your door — and the money goes straight into your own account.
        </p>
        <div className="og-cta anim-fade-up anim-d2">
          <DemoStart className="btn btn-brand btn-lg">
            ▶ Try the demo
          </DemoStart>
          <DemoStart to="assistant" className="btn btn-lg">
            ✨ Try the AI assistant
          </DemoStart>
        </div>
        <ul className="og-chips anim-fade-up anim-d3">
          <li>€0 fees · no commission</li>
          <li>Paid to your bank</li>
          <li>Live in minutes</li>
          <li>AI fills in your page</li>
        </ul>
      </section>

      {/* ---- The AI setup assistant: one sentence in, a filled form out ---- */}
      <InView as="section" className="container og-ai">
        <div className="og-ai-copy">
          <p className="feed-kicker">New · AI assistant</p>
          <h2>
            Say it in one sentence.
            <br />
            <span>We fill in the rest.</span>
          </h2>
          <p className="muted">
            Type or speak what you sell — in English, German or Nepali — and the assistant fills in your page: name,
            items, prices, collection times. It asks for anything missing, and you check it all before anything goes
            live.
          </p>
          <div className="og-cta og-cta-left">
            <DemoStart to="assistant" className="btn btn-brand btn-lg">
              ✨ Try the AI assistant
            </DemoStart>
          </div>
        </div>
        <div className="og-screen og-chat" aria-hidden="true">
          <div className="og-chat-me">
            <span className="og-chat-type">Momo shop in Berlin — chicken 9€, veg 8€, collect Saturdays 4–7pm</span>
          </div>
          <div className="og-chat-dots">
            <span />
            <span />
            <span />
          </div>
          <ul className="og-chat-form">
            <li>
              <b>✓</b> Name <i>Didi’s Momo Kitchen</i>
            </li>
            <li>
              <b>✓</b> Item <i>Chicken momo · €9.00</i>
            </li>
            <li>
              <b>✓</b> Item <i>Veg momo · €8.00</i>
            </li>
            <li>
              <b>✓</b> Collection <i>Saturdays 16–19h</i>
            </li>
            <li>
              <b>✓</b> City <i>Berlin</i>
            </li>
          </ul>
        </div>
      </InView>

      {/* ---- Six things you can do, shown not told ---- */}
      <section className="container og-scenes">
        <InView className="og-scene">
          <div className="og-screen og-build" aria-hidden="true">
            <div className="og-b-cover" />
            <div className="og-b-line og-b-l1" />
            <div className="og-b-line og-b-l2" />
            <div className="og-b-tier">
              <span />
              <b>€15</b>
            </div>
            <div className="og-b-tier og-b-t2">
              <span />
              <b>€25</b>
            </div>
            <div className="og-b-publish">Publish ✓</div>
          </div>
          <div className="og-caption">
            <h2>Build your page</h2>
            <p>Photos, prices, dates — live in minutes. No tech skills.</p>
            <DemoStart to="event" plain className="og-demo-link">Open the editor in the demo →</DemoStart>
          </div>
        </InView>

        <InView className="og-scene">
          <div className="og-screen og-paid" aria-hidden="true">
            <div className="og-p-total">
              <span>Received</span>
              <b>
                €<i className="og-count" />
              </b>
            </div>
            <div className="og-p-toast og-p-1">
              <span className="og-p-dot" /> Sita · 2 tickets <b>+€30</b>
            </div>
            <div className="og-p-toast og-p-2">
              <span className="og-p-dot" /> Ram · Momo ×3 <b>+€27</b>
            </div>
            <div className="og-p-toast og-p-3">
              <span className="og-p-dot" /> Maya · VIP <b>+€45</b>
            </div>
          </div>
          <div className="og-caption">
            <h2>Get paid directly</h2>
            <p>Bank transfer, PayPal or card — always into your own account.</p>
            <DemoStart to="orders" plain className="og-demo-link">Confirm a payment in the demo →</DemoStart>
          </div>
        </InView>

        <InView className="og-scene">
          <div className="og-screen og-kitchen" aria-hidden="true">
            <div className="og-k-cols">
              <span>New</span>
              <span>Cooking</span>
              <span>Ready</span>
            </div>
            <div className="og-k-card">
              <b>#12 · 14:30</b>
              <span>Momo ×2 · spicy</span>
            </div>
            <div className="og-k-card og-k-still og-k-s1">
              <b>#13</b>
              <span>Sel roti</span>
            </div>
            <div className="og-k-card og-k-still og-k-s2">
              <b>#11</b>
              <span>Thali</span>
            </div>
          </div>
          <div className="og-caption">
            <h2>Run the kitchen</h2>
            <p>Orders with pickup times on one live board: New → Cooking → Ready.</p>
            <DemoStart to="kitchen" plain className="og-demo-link">Open the kitchen in the demo →</DemoStart>
          </div>
        </InView>

        <InView className="og-scene">
          <div className="og-screen og-scan" aria-hidden="true">
            <div className="og-s-qr">
              {Array.from({ length: 25 }, (_, i) => (
                <span key={i} className={[0, 1, 3, 5, 6, 8, 11, 12, 13, 16, 18, 19, 21, 23, 24].includes(i) ? 'on' : ''} />
              ))}
              <i className="og-s-beam" />
            </div>
            <div className="og-s-ok">
              <b>✓</b> Welcome, Ram — VIP
            </div>
          </div>
          <div className="og-caption">
            <h2>Scan at the door</h2>
            <p>Any phone becomes the scanner. Each ticket works exactly once.</p>
            <DemoStart to="checkin" plain className="og-demo-link">Try check-in in the demo →</DemoStart>
          </div>
        </InView>

        <InView className="og-scene">
          <div className="og-screen og-seats" aria-hidden="true">
            <div className="og-st-stage">Stage</div>
            <div className="og-st-grid">
              {Array.from({ length: 40 }, (_, i) => (
                <span key={i} style={{ ['--i' as string]: String((i * 7) % 40) }} className={i < 10 ? 'vip' : ''} />
              ))}
            </div>
          </div>
          <div className="og-caption">
            <h2>Seats &amp; bookings</h2>
            <p>A real seat map, table bookings, or appointment times.</p>
            <DemoStart to="checkout" plain className="og-demo-link">Pick seats in the demo →</DemoStart>
          </div>
        </InView>

        <InView className="og-scene">
          <div className="og-screen og-stats" aria-hidden="true">
            <div className="og-c-head">
              <span>Sales this week</span>
              <b>+38%</b>
            </div>
            <div className="og-c-bars">
              {[38, 52, 44, 70, 62, 88, 100].map((h, i) => (
                <span key={i} style={{ ['--h' as string]: `${h}%`, ['--i' as string]: String(i) }} />
              ))}
            </div>
            <div className="og-c-days">
              <span>M</span>
              <span>T</span>
              <span>W</span>
              <span>T</span>
              <span>F</span>
              <span>S</span>
              <span>S</span>
            </div>
          </div>
          <div className="og-caption">
            <h2>See your numbers</h2>
            <p>What sells, on which days, and who brought their friends.</p>
            <DemoStart to="insights" plain className="og-demo-link">Open insights in the demo →</DemoStart>
          </div>
        </InView>
      </section>

      {/* ---- Three steps ---- */}
      <InView as="section" className="container og-steps">
        <div className="og-step">
          <span>1</span>
          <b>Try the demo</b>
          <p>A ready-made shop, restaurant or event — yours for 24 hours.</p>
        </div>
        <div className="og-step">
          <span>2</span>
          <b>Get your account</b>
          <p>Tell us what you sell. It’s free.</p>
        </div>
        <div className="og-step">
          <span>3</span>
          <b>Publish &amp; sell</b>
          <p>Share the link. Orders come in, money goes to you.</p>
        </div>
      </InView>

      {/* ---- Close ---- */}
      <section className="container og-close">
        <h2>See it for yourself</h2>
        <p className="muted">The demo opens in a second. No sign-up.</p>
        <div className="og-cta">
          <DemoStart className="btn btn-brand btn-lg">
            ▶ Try the demo
          </DemoStart>
          <Link href="/contact?intent=account" className="btn btn-lg">
            Get an account
          </Link>
        </div>
        <p className="muted small" style={{ marginTop: 14 }}>
          Already selling here? <Link href="/portal/login">Sign in</Link>
        </p>
      </section>

      <PlatformAssistant brand={platformNameFromEnv()} />
    </div>
  );
}
