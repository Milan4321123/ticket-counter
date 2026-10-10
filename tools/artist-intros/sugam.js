// Sugam Pokhrel — the MAIN GUEST walk-on for Dashain 2026, Heidelberg (16:9, ~33 s, 128 bpm).
// The headliner gets the biggest show and the most ways for the hall to join in:
//  1 open    — the camera warps through a tunnel of his hits → "Tonight's MAIN GUEST"
//  2 lights  — "Phone lights up!": gold particles assemble his portrait, the hall fills with lights
//  3 clap    — "Clap with us… faster… FASTER!": claps speed up (½ → ¼ → ⅛ → 1/16) into the drop
//  4 drop    — "HANDS UP!": the hall sings a WHOA-OH-OH-OH chant (bouncing-ball lyrics)
//  5 call    — "When I say SUGAM, you say POKHREL!" ×2
//  6 count   — 3 · 2 · 1, the particles become the numbers, then a breath of black
//  7 reveal  — lights on: fireworks, his photo in colour, his name in 3D gold; the chant
//              comes back with the full band, and the last chord rings out for the band
// The stage (sugam.html) and the score (sugam.score.mjs) both read this file.
//
// Facts (checked Oct 9 2026, en.wikipedia.org/wiki/Sugam_Pokharel): debut album
// Shoonya 2001; albums Highway 2003, Sutra 2004, Sugam Yaatra 2006, Tilasmi
// Kathmandu 2022; hits Feri Tyo Din, Kati Din Bitey, Maya Ko Baato, Jhilke, Ke Yo
// Maya Ho, School Pathshala, Jadai Chu Tadha, Sambhalincha Kahile Mann, Mero
// Sansaar; judge on Nepal Idol season 4; his 2012 Dashain–Tihar song became a
// festival anthem. The chant melody is original.
(function (root) {
  const BPM = 128, B = 60 / BPM;                // one beat = 0.46875 s
  const at = (beat) => +(beat * B).toFixed(5);
  const ARTIST = {
    id: 'sugam', BPM, B, at,
    TOTAL: at(70),                              // 32.8 s
    scenes: {
      open:   [0, at(12)],
      lights: [at(12), at(20)],
      clap:   [at(20), at(32)],
      drop:   [at(32), at(40)],
      call:   [at(40), at(48)],
      count:  [at(48), at(54)],
      reveal: [at(54), at(70)],
    },
    open: {
      // the tunnel: card i sits at z = z0 − gap·i and the camera flies d(t) = v·t + a·t² into it
      titles: ['Feri Tyo Din', 'Kati Din Bitey', 'Shoonya · 2001', 'Maya Ko Baato', 'Jhilke', 'Highway · 2003', 'Ke Yo Maya Ho',
        'School Pathshala', 'Sutra · 2004', 'Jadai Chu Tadha', 'Sambhalincha Kahile Mann', 'Sugam Yaatra · 2006', 'Mero Sansaar', 'Tilasmi Kathmandu · 2022'],
      z0: -1400, gap: 520, v: 900, a: 260,
      lines: [
        { t: at(1), text: '25 years', w: 0 },
        { t: at(2), text: 'of <em>hits.</em>', w: 1 },
      ],
      sub: { t: at(3), text: 'Pachchis barsa — hit mathi hit.' },
      out: at(6),
      kicker: { t: at(7), text: "Tonight's" },
      main: { t: at(8), text: 'MAIN GUEST' },
      mainSub: { t: at(9), text: 'Aajako mukhya pahuna' },
    },
    lights: {
      head: { t: at(13), text: 'Phone lights <b class="acc">up!</b>' },
      sub: { t: at(13.5), text: 'Mobile ko torch balnus!' },
      chips: [
        { t: at(16), text: 'Nepal Idol judge', x: 300, y: 470 },
        { t: at(17), text: 'A Dashain anthem', x: 1620, y: 420 },
        { t: at(18), text: 'Since 2001', x: 330, y: 700 },
      ],
    },
    clap: {
      // ½ notes → ¼ → ⅛ → 1/16: the hall speeds up into the drop
      beats: [20, 22, 24, 25, 26, 27, 28, 28.5, 29, 29.5, 30, 30.25, 30.5, 30.75, 31, 31.25, 31.5, 31.75],
      texts: [
        { t: at(20), text: 'Clap with us!', sub: 'Sangai taali!' },
        { t: at(28), text: 'Faster!', sub: 'Chhito!' },
        { t: at(30), text: 'FASTER!!', sub: 'Aajhai chhito!' },
      ],
    },
    drop: {
      head: { t: at(32), text: 'HANDS UP!' },
      sub: { t: at(32.5), text: 'Haat mathi! · Sing along — sangai gaaunus!' },
    },
    // the chant: [beat, midi, beats, syllable]; sung over D – A – Bm – G
    chant: [[0, 74, 1.5, 'WHOA'], [1.5, 73, 0.5, 'OH'], [2, 71, 1, 'OH'], [3, 69, 1, 'OH'],
            [4, 71, 1.5, 'WHOA'], [5.5, 73, 0.5, 'OH'], [6, 74, 1, 'OH'], [7, 76, 1, 'OH!']],
    call: {
      lines: [{ t: at(40), text: 'When I say <b class="acc">SUGAM</b>' }, { t: at(42), text: 'you say <b class="acc">POKHREL!</b>' }],
      sub: { t: at(42.5), text: "Ma 'SUGAM' bhanchhu — tapai 'POKHREL' bhannus!" },
      shouts: [{ t: at(44), word: 'SUGAM!', who: 'stage' }, { t: at(45), word: 'POKHREL!', who: 'crowd' },
               { t: at(46), word: 'SUGAM!', who: 'stage' }, { t: at(47), word: 'POKHREL!', who: 'crowd' }],
    },
    count: [
      { t: at(48), n: '3', ne: 'Tin' },
      { t: at(50), n: '2', ne: 'Dui' },
      { t: at(52), n: '1', ne: 'Ek' },
    ],
    implode: at(53.15), blackout: at(53.5),
    reveal: {
      t: at(54), first: 'SUGAM', last: 'POKHREL',
      kicker: '★  Main guest · Mukhya pahuna  ★',
      tag: { t: at(55), text: 'Live · Dashain 2026 · Heidelberg' },
      welcome: { t: at(55.5), small: 'Please welcome on stage', big: 'Hardik swagat!' },
      bandOut: at(66),                          // the band stops, the chord rings, the crowd keeps cheering
      // fireworks: [beat, x, y, colour, rocket?]
      // (at the sides, so they never cover his face or name)
      shells: [[54, 300, 260, '255,196,92', false], [54, 1620, 230, '255,240,210', false], [56, 220, 190, '220,40,80'], [57, 1700, 210, '255,196,92'],
               [58, 380, 330, '255,240,210'], [59, 1540, 300, '255,150,60'], [60, 260, 200, '255,196,92'], [61, 1660, 260, '220,40,80'],
               [62, 360, 170, '255,240,210'], [63, 1560, 190, '255,196,92'], [64, 280, 300, '255,150,60'], [64.5, 1640, 320, '255,240,210']],
    },
  };
  ARTIST.claps = ARTIST.clap.beats.map(at);
  // tunnel: how far the camera has flown at time t, and when card i flies past it
  ARTIST.fly = (t) => ARTIST.open.v * t + ARTIST.open.a * t * t;
  ARTIST.passes = ARTIST.open.titles.map((_, i) => {
    const D = -ARTIST.open.z0 + ARTIST.open.gap * i + 300, { v, a } = ARTIST.open;
    return (-v + Math.sqrt(v * v + 4 * a * D)) / (2 * a);
  });

  if (typeof module !== 'undefined') module.exports = ARTIST;
  else (root.ARTISTS = root.ARTISTS || {}).sugam = ARTIST;
})(this);
