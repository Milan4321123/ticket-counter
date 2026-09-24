import Link from 'next/link';
import styles from './showcase.module.css';

/**
 * The closing band on /showcase and /built. Plain wording on purpose: it
 * invites a conversation and promises nothing — no prices, no packages.
 */
export default function ContactBand() {
  return (
    <section className={styles.contactBand} aria-labelledby="contact-band-title">
      <div className="container">
        <div className={styles.contactInner}>
          <div>
            <h2 id="contact-band-title" className={styles.contactTitle}>
              Want something like this for your restaurant, shop or events?
            </h2>
            <p className="muted" style={{ margin: 0 }}>
              Tell us what you run and what gets in the way. A real person reads every message.
            </p>
          </div>
          <div className={styles.contactActions}>
            <Link href="/contact" className="btn btn-brand">
              Get in touch →
            </Link>
            <Link href="/demo" className="btn">
              Try the demo first
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
