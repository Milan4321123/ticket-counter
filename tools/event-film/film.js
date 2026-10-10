// The MartNepali event film: 30 s, 16:9 (1920×1080), for the big screen
// behind a presenter. Roman Nepali up front, English underneath.
//
// It is a pitch to SELLERS, honest about today: two events are on sale (the
// Dashain shows in Heidelberg and Lisbon), and the next one could be yours —
// an event, a shop, a restaurant. Selling is free with no commission, the
// tools are all there (shown from the real demo, marked DEMO), and anyone
// who wants a custom app or page can talk to us. The end card's QR leads to
// martnepali.com/contact ("Tell us what you want to build").
//
// This file is the edit. Every time is seconds; scene times sit on the
// 128 bpm bar grid (a bar = 1.875 s, a beat = 0.46875 s, 16 bars = 30 s).
// The stage (stage.html) animates to these times and the soundtrack
// (synth.mjs) puts its hits, ticks, pops and whooshes on them — `cues()`
// lists those — so a change here moves picture and sound together.
//
// Every claim is a fact about the live site:
// - the two events and their dates: martnepali.com (9 Oct 2026)
// - free account, free publishing, no commission, money straight to the
//   seller: /contact?intent=account, PLATFORM.md §1–2
// - "tickets, goods, food or bookings on your own page": /contact
// - kitchen board, shop page, QR scan at the counter: the demo (/demo)
// - a custom event page, a festival website, an app for your shop, built
//   with you: /contact ("Talk to the creator"). No price, quote or budget
//   words anywhere (the platform stays free — see the project notes).
(function (root) {
  const BPM = 128, B = 60 / BPM, BAR = B * 4, TOTAL = 30, FPS = 30, W = 1920, H = 1080;
  // Words: the first lands at W0 into its block, the next every WS.
  const W0 = 0.2, WS = 0.12;
  const bar = (n) => n * BAR, beat = (n) => n * B;

  const SCENES = [
    { id: 'hook', t: bar(0), d: bar(2), theme: 'dark', cutOut: true,
      line: [0, 0.7], fly: [0.95, bar(1)], glint: 1.95, swap: 2.15,
      textA: 'Dashain Heidelberg ko / *ticket?*', subA: 'Tickets for Dashain Heidelberg?',
      textB: '*MartNepali* ma.', subB: 'Sold right here, on MartNepali.' },
    { id: 'two', t: bar(2), d: bar(2), theme: 'dark', cutIn: true, cutOut: true,
      move: [0, 0.6], land: [0.25, beat(2)], labels: 1.0, holo: bar(1), swap: bar(1), push: [3.1, bar(2)],
      textA: 'Aile *duita* program.', subA: 'Two events on sale right now.',
      textB: 'Arko... *tapai ko?*', subB: 'Next one — yours?',
      tickets: [['Heidelberg', '10 Oct'], ['Lisbon', '18 Oct']] },
    { id: 'yours', t: bar(4), d: bar(1), theme: 'black', cutIn: true, cutOut: true,
      words: ['Program?', 'Pasal?', 'Restaurant?'], subs: ['Your event?', 'Your shop?', 'Your restaurant?'], icons: ['ticket', 'bag', 'momo'],
      at: [0, beat(1), beat(2)], glitch: [beat(3), bar(1) - 0.065], gap: [bar(1) - 0.065, bar(1)] },
    { id: 'drop', t: bar(5), d: bar(1), theme: 'dark', cutIn: true,
      letters: [0.1, 0.42], textAt: 0.5, chips: [beat(2), beat(2.5), beat(3), beat(3.5)], chipText: ['Tickets', 'Products', 'Food orders', 'Bookings'],
      text: 'Yahi *bechnus.*', sub: 'Tickets, goods, food or bookings — on your own page.' },
    { id: 'zero', t: bar(6), d: bar(2), theme: 'dark',
      giant: '0 %', chips: [beat(1), beat(1.5)], chipText: ['Free account', 'Free to publish'], shrink: [1.3, 1.75], stream: 1.35, textAt: 1.7,
      text: 'Paisa *sidhai* tapai ko account ma.', sub: 'Free account · no commission · the money goes straight to you.' },
    { id: 'tools', t: bar(8), d: bar(2), theme: 'dark',
      land: [0, beat(1), beat(2)], labels: [beat(1) - 0.05, beat(2) - 0.05, beat(3) - 0.05], labelText: ['Kitchen board', 'Your shop page', 'QR scan at the counter'],
      tapeStop: [3.3, bar(2)],
      text: 'Sab tool *ek thau ma.*', sub: 'Every tool you need — try the free demo at martnepali.com/demo' },
    { id: 'custom', t: bar(10), d: bar(2), theme: 'deep', cutOut: true,
      designs: [0, beat(2), beat(4), beat(6)], wipe: 0.28, swap: bar(1), roll: [bar(1), bar(2) - 0.12], fly: [3.2, bar(2)],
      tokens: ['Bold', 'Elegant', 'Party', 'Minimal'],
      textA: '*Custom* app / chahiyo?', subA: 'Want a custom app or page?',
      textB: 'Hami / *banaidinchhau.*', subB: 'Your restaurant, shop or festival — we build it with you.' },
    { id: 'talk', t: bar(12), d: bar(1), theme: 'light', cutIn: true, cutOut: true,
      giant: 'Kura *garau.*', subAt: 0.42, sub: 'Let’s talk — tell us what you want to build.',
      chips: [beat(2), beat(2.5), beat(3)], chipText: ['Custom event page', 'Festival website', 'App for your shop'], iris: [bar(1) - 0.27, bar(1)] },
    { id: 'cta', t: bar(13), d: TOTAL - bar(13), theme: 'dark', cutIn: true,
      card: [0, 0.55], lockup: 0.3, rows: [beat(1.5), beat(2.5)], typeA: beat(3.5), typeB: beat(5.5), end: bar(15) - bar(13),
      url: 'martnepali.com/contact',
      rowText: [['Bechna *free* — 0 % commission', 'Selling is free · no commission'], ['Custom app? *Kura garau.*', 'Custom app or page? Let’s talk.']] },
  ];
  const scene = (id) => SCENES.find((s) => s.id === id);

  // Words of an "a b / *c* d" string: [{w, line, accent}].
  function words(text) {
    const out = [];
    let acc = false;
    (text || '').split('/').forEach((line, li) => line.trim().split(/\s+/).filter(Boolean).forEach((w) => {
      if (w.startsWith('*')) acc = true;
      out.push({ w: w.replace(/\*/g, ''), line: li, accent: acc });
      if (w.endsWith('*')) acc = false;
    }));
    return out;
  }
  const wordTimes = (text, start = W0) => words(text).map((_, i) => start + i * WS);
  const subTime = (text, start = W0) => start + words(text).length * WS + 0.08;

  // Hits that shake the camera: [time, strength].
  const SHAKES = [[bar(1), 0.35], [bar(4), 0.5], [bar(4) + beat(1), 0.5], [bar(4) + beat(2), 0.6], [bar(5), 1], [bar(6), 0.6], [bar(12), 1], [bar(15), 0.45]];

  /** Every sound cue: [{t, kind, i}] — kinds: whoosh, tick, pop, type, chime, thunk, boot, beep, coin. */
  function cues() {
    const c = [];
    const add = (t, kind, i = 0) => c.push({ t, kind, i });
    const wordsAt = (s, text, start) => wordTimes(text, start).forEach((x, i) => add(s.t + x, 'tick', i));
    const typing = (text, a, b) => { for (let i = 0; i < text.length; i++) if (text[i] !== ' ') add(a + ((i + 0.5) * (b - a)) / text.length, 'type', i); };
    for (const s of SCENES) {
      if (s.t > 0 && !s.cutIn) add(s.t, 'whoosh');
      switch (s.id) {
        case 'hook': wordsAt(s, s.textA, 0.3); add(s.t + s.fly[0], 'whoosh'); add(s.t + s.swap, 'whoosh'); wordsAt(s, s.textB, s.swap + 0.12); break;
        case 'two': wordsAt(s, s.textA, W0); add(s.t + s.land[0], 'whoosh'); add(s.t + s.labels, 'pop'); add(s.t + s.labels + 0.1, 'pop', 1); wordsAt(s, s.textB, s.swap + 0.12); add(s.t + s.push[0], 'whoosh'); break;
        case 'drop': for (let i = 0; i < 10; i++) add(s.t + s.letters[0] + (i * (s.letters[1] - s.letters[0])) / 10, 'tick', i); wordsAt(s, s.text, s.textAt); s.chips.forEach((x, i) => add(s.t + x, 'pop', i)); break;
        case 'zero': s.chips.forEach((x, i) => add(s.t + x, 'pop', i)); add(s.t + s.shrink[0], 'whoosh'); wordsAt(s, s.text, s.textAt); for (let k = 0; k < 14; k++) add(s.t + s.stream + 0.25 + k * B / 2, 'coin', k); break;
        case 'tools': wordsAt(s, s.text, 0.25); s.land.forEach((x, i) => { add(s.t + x, 'thunk', i); add(s.t + x + 0.12, 'boot', i); }); s.labels.forEach((x, i) => add(s.t + x + 0.1, 'pop', i)); add(s.t + s.land[2] + 0.55, 'beep'); break;
        case 'custom': wordsAt(s, s.textA, W0); s.designs.slice(1).forEach((x) => add(s.t + x, 'whoosh')); s.tokens.forEach((_, i) => add(s.t + 0.5 + i * 0.12, 'pop', i)); wordsAt(s, s.textB, s.swap + 0.12); add(s.t + s.fly[0], 'whoosh'); break;
        case 'talk': add(s.t + s.subAt, 'tick'); s.chips.forEach((x, i) => add(s.t + x, 'pop', i)); add(s.t + s.iris[0], 'whoosh'); break;
        case 'cta': add(s.t + s.card[0] + 0.2, 'whoosh'); s.rows.forEach((x, i) => add(s.t + x, 'pop', i)); typing(s.url, s.t + s.typeA, s.t + s.typeB); add(s.t + s.typeB + 0.1, 'chime'); break;
      }
    }
    return c.sort((x, y) => x.t - y.t);
  }

  const FILM = { BPM, B, BAR, TOTAL, FPS, W, H, W0, WS, SCENES, SHAKES, scene, bar, beat, words, wordTimes, subTime, cues };
  if (typeof module !== 'undefined') module.exports = FILM;
  else root.FILM = FILM;
})(typeof window !== 'undefined' ? window : globalThis);
