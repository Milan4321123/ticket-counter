import type { Metadata } from 'next';
import Link from 'next/link';
import PrivacyDe from '@/components/legal/PrivacyDe';
import PrivacyEn from '@/components/legal/PrivacyEn';
import { privacyFacts } from '@/components/legal/privacyFacts';
import { LEGAL_TERMS_VERSION, legalDateLabel } from '@/lib/legal';
import { currentLang } from '@/lib/i18nServer';
import { shareImages } from '@/lib/seo';

// Every period, cookie lifetime and provider on this page is read from the
// code that makes it true (components/legal/privacyFacts.ts) — so it renders
// per request, and cannot promise one thing while the server does another.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Datenschutzerklärung · Privacy policy',
  description:
    'Welche Daten wir verarbeiten, wofür, wer sie erhält und wann sie gelöscht werden. What we process, why, who receives it and when it is erased.',
  alternates: { canonical: '/privacy' },
  openGraph: {
    type: 'website',
    title: 'Datenschutzerklärung · Privacy policy',
    description: 'What we ask for when you book a ticket, why we need it, who it goes to, and when it is erased.',
    url: '/privacy',
    images: shareImages(),
  },
};

type Props = { searchParams: Promise<{ v?: string | string[] }> };

/**
 * The Datenschutzerklärung, in German (binding) or English.
 *
 * Which one: ?v=de / ?v=en wins — it is what the switch link sets, and what a
 * shared link should keep — otherwise the visitor's site language, where
 * German reads German and everything else (English, Nepali) reads English.
 *
 * The whole legal text is translate="no". The site's machine translation
 * (components/AutoTranslate) would otherwise happily rewrite a legal notice
 * into Nepali, and a paraphrase of a legal text is a different legal text.
 */
export default async function PrivacyPage({ searchParams }: Props) {
  const raw = (await searchParams).v;
  const asked = (Array.isArray(raw) ? raw[0] : raw)?.toLowerCase();
  const lang: 'de' | 'en' =
    asked === 'de' || asked === 'en' ? asked : (await currentLang()) === 'de' ? 'de' : 'en';
  const de = lang === 'de';
  const facts = privacyFacts();
  const stand = legalDateLabel(LEGAL_TERMS_VERSION, lang);

  return (
    <div translate="no" lang={lang} className="notranslate">
      <section className="feed-hero" style={{ padding: '64px 0 28px' }}>
        <div className="container container-narrow">
          <p className="feed-kicker anim-fade-up">{de ? 'Datenschutz · Privacy' : 'Privacy · Datenschutz'}</p>
          <h1 className="anim-fade-up anim-d1" style={{ fontSize: 'clamp(1.9rem, 4.4vw, 3rem)' }}>
            {de ? 'Datenschutzerklärung' : 'Privacy policy'}
          </h1>
          <p className="feed-hero-sub anim-fade-up anim-d2" style={{ marginBottom: 12 }}>
            {de
              ? 'Welche Daten wir verarbeiten, wofür wir sie brauchen, wer sie erhält und wann sie gelöscht werden – für alle, die hier Tickets buchen, bestellen, fragen oder selbst etwas anbieten.'
              : 'What we process, why we need it, who receives it and when it is erased – for everyone who books, orders, asks or sells here.'}
          </p>
          <p className="muted small anim-fade-up anim-d2" style={{ marginBottom: 0 }}>
            {de ? `Stand: ${stand}` : `Last updated: ${stand}`}
            {' · '}
            {de ? (
              <Link href="/privacy?v=en" hrefLang="en" style={{ color: 'var(--brand-text)', fontWeight: 600 }}>
                Read in English
              </Link>
            ) : (
              <Link href="/privacy?v=de" hrefLang="de" style={{ color: 'var(--brand-text)', fontWeight: 600 }}>
                Auf Deutsch lesen (verbindliche Fassung)
              </Link>
            )}
          </p>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 20 }}>
        <div className="container container-narrow">
          {de ? <PrivacyDe f={facts} /> : <PrivacyEn f={facts} />}
        </div>
      </section>
    </div>
  );
}
