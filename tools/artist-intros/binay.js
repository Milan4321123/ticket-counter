// Binay Karki — walk-on intro for Dashain 2026, Heidelberg (16:9, 24 s, 150 bpm).
// Same shape as the other walk-ons, its own look (fire & smoke, deep red and
// orange) and sound (fast hard rock): the amp hums on and feeds back → the hall
// shouts "HEY!" on 2 and 4 while his story is told over his silhouette → AIR
// GUITAR! over a 3D fretboard while the guitar shreds → 3 · 2 · 1 → lights on.
// The stage (binay.html) and the score (binay.score.mjs) both read this.
//
// Facts (checked Oct 9 2026; thin sources, from artistnepal.com, Apple Music and
// YouTube): frontman of Thunga Band; composer and arranger, founder of Aarohi
// Beats; sang on The Voice of Nepal season 2 (2019); songs include Sapana (2024),
// Kin Chhin Chhin, No Entry, Ex Lover.
// Photos: "guitar-hd" (portrait with guitar, 960 px, sent Oct 9) is the one shown
// in colour; "badge" has his name printed beside him — only the cut-out person
// is used, as a silhouette. Milan asked (Oct 9) to drop "& Thunga Band" from the
// video, so the band is not named on screen.
(function (root) {
  const BPM = 150, B = 60 / BPM;                // one beat = 0.4 s
  const at = (beat) => +(beat * B).toFixed(3);
  const ARTIST = {
    id: 'binay', BPM, B,
    TOTAL: at(60),                              // 24 s
    scenes: {
      dark:   [0, at(8)],                       // 0 – 3.2
      hey:    [at(8), at(28)],                  // 3.2 – 11.2
      air:    [at(28), at(36)],                 // 11.2 – 14.4
      count:  [at(36), at(42)],                 // 14.4 – 16.8
      reveal: [at(42), at(60)],                 // 16.8 – 24
    },
    dark: [
      { t: at(1), text: 'Heidelberg,' },
      { t: at(3), text: 'turn it <b class="acc">up!</b>' },
      { t: at(4.5), text: 'Awaaz thulo garnus!', sub: true },
    ],
    strum: at(4),                               // the first open chord rings out
    hey: {
      call: { t: at(8), text: 'Shout <b class="acc">HEY!</b> with us', sub: 'Sangai karaunus — HEY!' },
      lines: [
        { t: at(12), text: 'From <em>The Voice</em><br>of Nepal.', sub: 'The Voice of Nepal, Season 2 dekhi.', img: 'badge' },
        { t: at(16), text: 'Composer. Arranger.<br><em>Frontman.</em>', sub: 'Geet banaune, bajaune, gaune.', img: 'guitar' },
        { t: at(20), text: '<em>Sapana.</em> Kin Chhin<br>Chhin. No Entry.', sub: 'Unka geet — hamro playlist.', img: 'guitar' },
        { t: at(24), text: 'Tonight.<br><em>Live.</em> Here.', sub: 'Aaja raati — yahin, live!', img: 'badge' },
      ],
      prompt: '🙌 Shout HEY! on 2 & 4 · Sangai karaunus',
    },
    air: { t: at(28), text: 'AIR GUITAR!', sub: 'Hawa ma guitar bajaunus!' },
    count: [
      { t: at(36), n: '3', ne: 'Tin' },
      { t: at(38), n: '2', ne: 'Dui' },
      { t: at(40), n: '1', ne: 'Ek' },
    ],
    reveal: {
      t: at(42), first: 'BINAY', last: 'KARKI',
      tag: { t: at(43), text: 'Live · Dashain 2026 · Heidelberg' },
      welcome: { t: at(43.5), small: 'Please welcome on stage', big: 'Hardik swagat!' },
      bandOut: at(54),                          // the groove stops, the chord rings, the crowd keeps cheering
    },
  };
  // the hall shouts HEY! on 2 and 4 of every bar in the hey scene
  ARTIST.heys = [];
  for (let b = 8; b < 28; b++) if (b % 2 === 1) ARTIST.heys.push(at(b));
  // notes come down the fretboard on every beat of the air-guitar scene
  ARTIST.notes = [];
  for (let b = 28; b < 36; b++) ARTIST.notes.push(at(b));

  if (typeof module !== 'undefined') module.exports = ARTIST;
  else (root.ARTISTS = root.ARTISTS || {}).binay = ARTIST;
})(this);
