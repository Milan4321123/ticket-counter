// Bajagaja — walk-on intro for Dashain 2026, Heidelberg (16:9, 24 s, 120 bpm).
// Same shape as Sugam's walk-on, its own look (neon cyan & red) and sound
// (a band counting in, funk-rock, the crowd clapping on 2 and 4): lights down
// and drumsticks counting in → clap along while the story is told over
// silhouettes (one man → the band) → the roll call of the instruments (the
// "baja") → 3 · 2 · 1 → the band lights up.
// The stage (bajagaja.html) and the score (bajagaja.score.mjs) both read this.
//
// Facts (checked Oct 9 2026): Sugam Pokharel first went by "1MB" — "1 Man Band"
// (en.wikipedia.org/wiki/Sugam_Pokharel); Sugam Pokharel & The Bajagaja is his
// own live band, formed in 2017 (the band's Facebook page, facebook.com/sug1mb.bajagaja).
// Photos: "studio" has a date and an "O2 years" logo printed on it — it is only
// ever shown as a silhouette; "club" (logo cut away) is the one shown in colour.
(function (root) {
  const BPM = 120, B = 60 / BPM;                // one beat = 0.5 s
  const at = (beat) => +(beat * B).toFixed(3);
  const ARTIST = {
    id: 'bajagaja', BPM, B,
    TOTAL: at(48),                              // 24 s
    scenes: {
      dark:   [0, at(8)],                       // 0 – 4
      clap:   [at(8), at(24)],                  // 4 – 12
      roll:   [at(24), at(32)],                 // 12 – 16
      count:  [at(32), at(38)],                 // 16 – 19
      reveal: [at(38), at(48)],                 // 19 – 24
    },
    sticks: [at(4), at(5), at(6), at(7)],       // "1, 2, 3, 4!" on the drumsticks
    dark: [
      { t: at(1), text: 'Heidelberg,' },
      { t: at(2.5), text: 'ready for the <b class="acc">band?</b>' },
      { t: at(3.5), text: 'Band ko lagi tayar?', sub: true },
    ],
    clap: {
      call: { t: at(8), text: 'Clap with us!', sub: 'Sangai taali — 2 ra 4 ma!' },
      lines: [
        { t: at(12), text: 'It started as <b class="acc">1MB</b> —<br>a one-man band.', sub: 'Suru ma — ek jana, euta band.', img: 'one' },
        { t: at(16), text: 'Then came<br>the <em>band.</em>', sub: 'Ani aayo — Bajagaja.', img: 'studio' },
        { t: at(20), text: 'Since <em>2017,</em><br>his own live band.', sub: '2017 dekhi — Sugam ko afnai band.', img: 'club' },
      ],
      prompt: '👏 Clap on 2 & 4 · Sangai taali',
    },
    roll: [
      { t: at(24), word: 'GUITAR!', kick: 'Baja 01', wave: 'saw' },
      { t: at(26), word: 'BASS!', kick: 'Baja 02', wave: 'sine' },
      { t: at(28), word: 'KEYS!', kick: 'Baja 03', wave: 'chord' },
      { t: at(30), word: 'DRUMS!', kick: 'Baja 04', wave: 'hits' },
    ],
    count: [
      { t: at(32), n: '3', ne: 'Tin' },
      { t: at(34), n: '2', ne: 'Dui' },
      { t: at(36), n: '1', ne: 'Ek' },
    ],
    reveal: {
      t: at(38), name: 'BAJAGAJA', pre: 'Sugam Pokhrel &',
      tag: { t: at(39), text: 'Live · Dashain 2026 · Heidelberg' },
      welcome: { t: at(39.5), small: 'Please welcome on stage', big: 'Hardik swagat!' },
      bandOut: at(44),                          // the groove stops, the chord rings, the crowd keeps cheering
    },
  };
  // the crowd claps on 2 and 4 of every bar in the clap scene
  ARTIST.claps = [];
  for (let b = 8; b < 24; b++) if (b % 2 === 1) ARTIST.claps.push(at(b));
  ARTIST.kicks = [];
  for (let b = 8; b < 24; b++) ARTIST.kicks.push(at(b));

  if (typeof module !== 'undefined') module.exports = ARTIST;
  else (root.ARTISTS = root.ARTISTS || {}).bajagaja = ARTIST;
})(this);
