// The Dashain Heidelberg ad's edit: when each scene plays, where the taps land
// and which sound goes with what. The stage (stage.html) draws from it and the
// soundtrack (synth.mjs) is cut to it, so a change here moves both.
(function (root) {
  const scenes = [
    { id: 'hook', start: 0, end: 4.6 },
    { id: 'org', start: 4.4, end: 8.8 },
    { id: 'site', start: 8.6, end: 12.8 },
    { id: 'aid', start: 12.6, end: 17.4 },
    { id: 'day', start: 17.2, end: 21.2 },
    { id: 'euro', start: 21.0, end: 24.8 },
    { id: 'together', start: 24.6, end: 28.8 },
    { id: 'link', start: 28.6, end: 31.8 },
    { id: 'event', start: 31.6, end: 37.4 },
    { id: 'buy', start: 37.2, end: 51.4 },
    { id: 'cta', start: 51.2, end: 59.0 },
  ];
  const at = (id) => scenes.find((s) => s.id === id).start;
  const BUY = at('buy');
  // The buy scene's taps, in the scene's own seconds (see stage.html's buy()).
  const buyTaps = [1.5, 3.5, 4.9, 5.9, 6.6, 11.0];
  // The music's grid: 112 bpm, beat 0 is the date slam in the hook, and the
  // scenes that start on a drop (event, the finale's OUT!) sit on bar lines.
  const BPM = 112, BEAT = 60 / BPM, G0 = 1.6;
  const beat = (b) => G0 + b * BEAT;
  const TL = {
    TOTAL: 59.0,
    FPS: 30,
    BPM, BEAT, G0,
    beat,
    // DON'T · MISS · OUT! — the last one is the final drop (bar 24).
    ctaSlams: [beat(94), beat(95), beat(96)],
    scenes,
    buyTaps,
    // Every hard cut or wipe gets a whoosh.
    whooshes: scenes.slice(1).map((s) => s.start + 0.05),
    taps: buyTaps.map((x) => BUY + x),
    // Big hits: the date slam in the hook and the "Don't miss out" slam.
    hits: [G0, beat(94), beat(95), beat(96)],
    // Little pops: stat tiles, profession chips, photo cards, detail rows.
    pops: [
      ...[0, 1, 2, 3].map((i) => at('aid') + 1.4 + i * 0.25),
      ...Array.from({ length: 12 }, (_, i) => at('day') + 1.1 + i * 0.12),
      ...[0, 1, 2, 3].map((i) => at('together') + 0.5 + i * 0.35),
      ...[0, 1, 2, 3, 4].map((i) => at('event') + 1.5 + i * 0.28),
    ],
    coins: [at('euro') + 0.75, ...Array.from({ length: 14 }, (_, i) => at('euro') + 1.6 + i * 0.09)],
    // The ticket arriving: a bright chime.
    chime: BUY + 11.5,
  };
  if (typeof module !== 'undefined') module.exports = TL;
  else root.TL = TL;
})(typeof window !== 'undefined' ? window : globalThis);
