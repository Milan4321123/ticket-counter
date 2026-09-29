// The Datenschutz ad — one timeline, read by stage.html (the picture) and
// synth.mjs (the sound), so every tick lands on its chime.
//
// 120 bpm: one bar = 2 s. Every claim below is TRUE of martnepali.com as of
// 30 Sep 2026 and is backed by code — change the site, check this list:
//   legal    /impressum, /privacy (DE + EN)                    src/app/impressum, src/app/privacy
//   avv      Art. 28 AVV, accepted in /portal/legal             src/app/avv, src/app/portal/legal
//   eu       Render region Frankfurt                            lib/legal.ts DEFAULT_HOSTING_REGION
//   consent  analytics only after "yes", refuse = same button   components/ConsentBanner.tsx
//   money    buyers pay the organizer directly                  (the platform never holds money)
//   erase    buyer details erased 30 days after the event       lib/retention.ts BUYER_RETENTION_DAYS
//   photo    location data stripped from uploads                lib/stripMetadata.ts
//   rights   account holders download / delete their data       /account, api/account/{export,delete}
// Deliberately NOT claimed: "100% DSGVO-konform", certificates, seals —
// a checklist of facts, not a promise nobody can audit.
(function (root) {
  const BPM = 120;
  const BAR = 2;

  const ITEMS = [
    { id: 'legal', de: 'Impressum & Datenschutz&shy;erklärung', en: 'Legal notice and privacy policy — in German and English' },
    { id: 'avv', de: 'Ein AVV mit jedem Verein', en: 'A data processing agreement (Art. 28 GDPR) with every organizer' },
    { id: 'eu', de: 'Server in Frankfurt', en: 'Our servers are in Frankfurt, in the EU' },
    { id: 'consent', de: 'Kein Tracking ohne dein Ja', en: 'No tracking unless you say yes' },
    { id: 'money', de: 'Dein Geld geht direkt an den Veranstalter', en: 'Your money goes straight to the organizer — never through us' },
    { id: 'erase', de: 'Käuferdaten nach 30 Tagen gelöscht', en: 'Buyer details erased automatically, 30 days after the event' },
    { id: 'photo', de: 'Standortdaten aus Fotos entfernt', en: 'Location data stripped from every uploaded photo' },
    { id: 'rights', de: 'Deine Daten: herunterladen oder löschen', en: 'Download or delete your account data — any time' },
  ];

  const ITEM_LEN = 3; // 1.5 bars each
  const T = {
    hook: 0, // "Deine Daten." / "Wer passt darauf auf?"
    logo: 4, // app icon + wordmark
    stamp: 6, // "DSGVO. Check." — the big tick lands here
    items: 8, // first checklist item
    recap: 8 + ITEMS.length * ITEM_LEN, // 32: the whole list, ticked
    outro: 37, // where to read it all
    end: 44,
  };
  const TOTAL = T.end;
  /** Seconds into an item at which its box gets ticked. */
  const TICK_AT = 1.25;

  /** Every sound cue the synth plays, in seconds. */
  function cues() {
    const c = [];
    c.push({ kind: 'word', t: 0.35 }, { kind: 'word', t: 1.05 }, { kind: 'word', t: 2.2 }, { kind: 'word', t: 2.75 });
    c.push({ kind: 'whoosh', t: T.logo - 0.25 }, { kind: 'pop', t: T.logo + 0.1, i: 0 });
    c.push({ kind: 'stamp', t: T.stamp });
    ITEMS.forEach((_, i) => {
      const t0 = T.items + i * ITEM_LEN;
      c.push({ kind: 'whoosh', t: t0 - 0.12 });
      c.push({ kind: 'tick', t: t0 + TICK_AT, i });
    });
    ITEMS.forEach((_, i) => c.push({ kind: 'pop', t: T.recap + 0.9 + i * 0.28, i }));
    c.push({ kind: 'chord', t: T.recap + 0.9 + ITEMS.length * 0.28 + 0.1 });
    c.push({ kind: 'whoosh', t: T.outro - 0.2 });
    [0, 1, 2].forEach((i) => c.push({ kind: 'pop', t: T.outro + 0.9 + i * 0.35, i }));
    c.push({ kind: 'hit', t: T.end - 2.2 });
    return c;
  }

  const SPEC = { BPM, BAR, ITEMS, ITEM_LEN, T, TOTAL, TICK_AT, cues };
  if (typeof module === 'object' && module.exports) module.exports = SPEC;
  else root.SPEC = SPEC;
})(this);
