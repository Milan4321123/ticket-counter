// The five MartNepali brand ads (customer, shop seller, restaurant, event
// organizer, general), in the style of a modern product promo: soft morphing
// colour blobs on white, words that sharpen out of a blur, a giant word the
// camera flies through, a dark dot-matrix logo reveal, glass UI cards with a
// cursor typing and clicking, and a search-bar outro. Roman Nepali up front,
// English underneath.
//
// Every time here is seconds. `TIMES` holds each shot type's inner beats; the
// stage (stage.html) animates to them and the soundtrack (synth-brand.mjs)
// puts its clicks, ticks and pops on them — `cues(ad)` lists those.
(function (root) {
  const BPM = 120, B = 0.5;
  // Words: the first word lands at W0, the next every WS.
  const W0 = 0.18, WS = 0.13;
  const TIMES = {
    ask: { cursorIn: 0.15, click: 0.55, typeA: 0.7, typeB: 2.0, send: 2.25, think: 2.4, results: [2.95, 3.15, 3.35] },
    build: { typeA: 0.45, typeB: 1.6, send: 1.8, think: 1.95, page: 2.6, rows: [2.95, 3.1, 3.25] },
    notify: { cards: [0.25, 0.75, 1.25] },
    list: { rows: [0.55, 0.85, 1.15] },
    menu: { taps: [0.8, 1.55, 2.3], done: 2.45 },
    kitchen: { arrive: [0.25, 1.35], moves: [0.75, 1.75], ready: 1.8 },
    tiers: { stamp: 0.55, seats0: 0.8, seats1: 2.6 },
    scan: { scans: [0.5, 1.35, 2.2] },
    logo: { ring: [0.0, 0.45], mark: 0.22, slide: 0.6, letters: [0.62, 0.95], sub: 1.0 },
    outro: { lockup: 0.1, typeA: 0.6, typeB: 1.45, tag: 1.55 },
    collage: { items: 0.12, step: 0.1 },
    pillars: { cards: [0.25, 0.65, 1.05] },
    split: { left: 0.2, right: 0.5, lines: [0.8, 1.1, 1.4] },
    langs: { chips: [0.3, 0.5, 0.7, 0.9] },
    poster: { poster: 0.1, tickets: [0.5, 0.65, 0.8] },
    table: { qr: 0.3, scan: 1.2 },
  };

  const AD = {};
  AD.customer = {
    name: 'For customers', accent: '#e11d48', accent2: '#fb7185', key: 0, TOTAL: 20,
    shots: [
      { type: 'words', t: 0, d: 2.5, text: 'Pardesh ma pani / *Nepal* ko swad?', sub: 'Missing the taste of home?' },
      { type: 'giant', t: 2.5, d: 1.5, text: 'MOMO' },
      { type: 'collage', t: 4, d: 2, items: ['momo', 'achar', 'chiya', 'topi', 'selroti', 'ticket'], text: 'Momo. Achar. *Chiya.* / Tickets pani.', sub: '…and tickets too.' },
      { type: 'logo', t: 6, d: 2 },
      { type: 'ask', t: 8, d: 4.5, q: 'Frankfurt ma momo kaha paincha?', results: [['momo', 'Momo', 'Order & collect'], ['achar', 'Achar, chiya, masala', 'Nepali bazaar'], ['ticket', 'Dashain Night', 'Sat 10 Oct · Heidelberg']], sub: 'Nepali, English, Deutsch — jun bhasa ma pani.' },
      { type: 'list', t: 12.5, d: 2.5, title: '*Sajilo.*', items: ['Card chaidaina', 'PayPal wa bank transfer', 'QR dekhau, ticket / saman lau'], sub: 'No card. PayPal or bank. Show your QR.' },
      { type: 'words', t: 15, d: 2, text: 'Jahaa bhaye pani, / *Nepal* najikai.', sub: 'Wherever you are, Nepal is close.' },
      { type: 'outro', t: 17, d: 3, tag: 'Events · Bazaar · *Momo*' },
    ],
  };
  AD.seller = {
    name: 'For shop sellers', accent: '#f59e0b', accent2: '#fbbf24', key: 5, TOTAL: 20,
    shots: [
      { type: 'words', t: 0, d: 2.5, text: 'Ghar ma *achar* / banaunu hunchha?', sub: 'Make achar at home?' },
      { type: 'giant', t: 2.5, d: 1.5, text: 'ONLINE' },
      { type: 'collage', t: 4, d: 2, items: ['achar', 'chilli', 'chiya', 'topi', 'pote', 'bag'], text: 'Achar. Masala. *Dhaka.* / Je pani bechnus.', sub: 'Sell what you make or bring from Nepal.' },
      { type: 'logo', t: 6, d: 2, sub: 'for sellers' },
      { type: 'build', t: 8, d: 4.5, q: 'Ma Frankfurt ma ghar mai achar banauchhu.', shop: 'Aama ko Achar', place: 'Frankfurt · Order & collect', rows: [['achar', 'Lapsi achar', '€6.00'], ['chilli', 'Dalle khursani achar', '€5.50'], ['chiya', 'Chiya masala', '€4.50']], sub: 'Afnai pasal ko page — chittai.' },
      { type: 'notify', t: 12.5, d: 2.5, cards: [['Naya order!', '2× Lapsi achar · €12.00'], ['Naya order!', 'Chiya masala · €4.50'], ['Paid ✓', '€12.00 — sidhai tapai ko PayPal ma']], text: 'Order *aaucha.*', sub: 'The orders come to you.' },
      { type: 'list', t: 15, d: 2, title: 'Tapai ko pasal, / *tapai ko paisa.*', items: ['Paisa sidhai tapai ko account ma', 'QR scan garera saman dinus', 'Free ma suru garnus'], sub: 'Money straight to you. Free to start.' },
      { type: 'outro', t: 17, d: 3, tag: 'Afno pasal, *online.*' },
    ],
  };
  AD.restaurant = {
    name: 'For restaurants', accent: '#65a30d', accent2: '#a3e635', key: 7, TOTAL: 20,
    shots: [
      { type: 'words', t: 0, d: 2, text: 'Friday beluka ko / *rush?*', sub: 'Friday night rush?' },
      { type: 'words', t: 2, d: 2, text: 'Phone ma order / *linu parena.*', sub: 'No more taking orders by phone.' },
      { type: 'collage', t: 4, d: 2, items: ['momo', 'jhol', 'thali', 'chiya', 'selroti', 'chilli'], text: 'Menu *online.* / Order sidhai.', sub: 'Your menu online — orders come straight in.' },
      { type: 'logo', t: 6, d: 2, sub: 'for restaurants' },
      { type: 'menu', t: 8, d: 3.5, dish: 'Jhol momo', price: '€9.50', sub: 'Piro ra samaya — customer afai rojchha.' },
      { type: 'kitchen', t: 11.5, d: 3, sub: 'Kitchen board: sab order ek thau ma.' },
      { type: 'table', t: 14.5, d: 2.5, text: 'Table bata sidhai / *order.*', sub: 'A QR on every table.' },
      { type: 'outro', t: 17, d: 3, tag: 'Kitchen shanta, *customer khushi.*' },
    ],
  };
  AD.organizer = {
    name: 'For event organizers', accent: '#2563eb', accent2: '#60a5fa', key: 2, TOTAL: 20,
    shots: [
      { type: 'words', t: 0, d: 2.5, text: 'Program garnu / hudai *chha?*', sub: 'Planning an event?' },
      { type: 'giant', t: 2.5, d: 1.5, text: 'HOUSEFULL' },
      { type: 'poster', t: 4, d: 2.5, text: 'Dashain Heidelberg ko ticket / *yahi* bata bikdai chha.', sub: 'The Dashain Heidelberg tickets sell right here.' },
      { type: 'logo', t: 6.5, d: 2, sub: 'for organizers' },
      { type: 'tiers', t: 8.5, d: 3.5, sub: 'Early bird, phase, seat map — sab milcha.' },
      { type: 'scan', t: 12, d: 3, sub: 'Door ma phone le scan — line chhito.' },
      { type: 'list', t: 15, d: 2, title: 'Sab *ek thau* ma.', items: ['Discount ra referral code', 'Paisa sidhai tapai ko account ma', 'Free ma suru garnus'], sub: 'Everything in one place — free to start.' },
      { type: 'outro', t: 17, d: 3, tag: 'Tapai ko program, *housefull.*' },
    ],
  };
  AD.general = {
    name: 'MartNepali', accent: '#dc143c', accent2: '#2563eb', key: -3, TOTAL: 20,
    shots: [
      { type: 'words', t: 0, d: 2.5, text: 'Nepali community ko / lagi, *ek thau.*', sub: 'One place for the Nepali community.' },
      { type: 'giant', t: 2.5, d: 1.5, text: 'NEPAL' },
      { type: 'collage', t: 4, d: 2, items: ['momo', 'ticket', 'achar', 'topi', 'kite', 'madal'], text: 'Program. Bazaar. *Momo.*', sub: 'Events, a Nepali bazaar and restaurants.' },
      { type: 'logo', t: 6, d: 2 },
      { type: 'pillars', t: 8, d: 3.5, cards: [['ticket', 'Events & tickets', 'Program ko ticket, QR ma'], ['bag', 'Nepali bazaar', 'Achar dekhi dhaka samma'], ['momo', 'Restaurants', 'Momo order, pickup ma']] },
      { type: 'split', t: 11.5, d: 2.5, left: ['Kinnus', 'Card chaidaina', 'QR le lina', 'PayPal wa bank'], right: ['Bechnus', 'Free ma suru', 'Paisa sidhai tapai lai', 'Afnai page'] },
      { type: 'langs', t: 14, d: 2.5, chips: ['English', 'Deutsch', 'नेपाली', 'Roman Nepali'], text: 'Jun bhasa ma *pani.*', sub: 'Ask in any language.' },
      { type: 'outro', t: 16.5, d: 3.5, tag: 'Jahaa bhaye pani, *Nepal najikai.*' },
    ],
  };

  // Words of a "a b / *c* d" string: [{w, line, accent}].
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
  // When each word lands (seconds into its shot), and when the English line follows.
  const wordTimes = (text, start = W0) => words(text).map((_, i) => start + i * WS);
  const subTime = (text, start = W0) => start + words(text).length * WS + 0.1;

  /** Every sound cue of an ad: [{t, kind, i}] — kinds: whoosh, big, tick, pop, click, type, chime, hit. */
  function cues(ad) {
    const c = [];
    const add = (t, kind, i = 0) => c.push({ t, kind, i });
    for (const s of ad.shots) {
      const T = TIMES[s.type] || {};
      add(s.t, s.t === 0 ? 'hit' : 'whoosh');
      const wordsAt = (text, start) => wordTimes(text, start).forEach((x, i) => add(s.t + x, 'tick', i));
      switch (s.type) {
        case 'words': case 'table': case 'langs': wordsAt(s.text, s.type === 'words' ? W0 : 0.5); break;
        case 'collage': s.items.forEach((_, i) => add(s.t + T.items + i * T.step, 'pop', i)); wordsAt(s.text, 0.45); break;
        case 'giant': add(s.t, 'big'); break;
        case 'logo': add(s.t + T.mark, 'hit'); for (let i = 0; i < 10; i++) add(s.t + T.letters[0] + (i * (T.letters[1] - T.letters[0])) / 10, 'tick', i); break;
        case 'ask': add(s.t + T.click, 'click'); typing(s.q, s.t + T.typeA, s.t + T.typeB); add(s.t + T.send, 'click'); T.results.forEach((x, i) => add(s.t + x, 'pop', i)); break;
        case 'build': typing(s.q, s.t + T.typeA, s.t + T.typeB); add(s.t + T.send, 'click'); add(s.t + T.page, 'chime'); T.rows.forEach((x, i) => add(s.t + x, 'pop', i)); break;
        case 'notify': T.cards.forEach((x, i) => add(s.t + x, i === 2 ? 'chime' : 'pop', i)); break;
        case 'list': T.rows.forEach((x, i) => add(s.t + x, 'pop', i)); break;
        case 'menu': T.taps.forEach((x) => add(s.t + x, 'click')); add(s.t + T.done, 'chime'); break;
        case 'kitchen': T.arrive.forEach((x, i) => add(s.t + x, 'pop', i)); T.moves.forEach((x) => add(s.t + x, 'click')); add(s.t + T.ready, 'chime'); break;
        case 'tiers': add(s.t + T.stamp, 'hit'); break;
        case 'scan': T.scans.forEach((x) => { add(s.t + x, 'click'); add(s.t + x + 0.12, 'chime'); }); break;
        case 'outro': add(s.t + T.lockup, 'hit'); typing('martnepali.com', s.t + T.typeA, s.t + T.typeB); break;
        case 'pillars': T.cards.forEach((x, i) => add(s.t + x, 'pop', i)); break;
        case 'split': add(s.t + T.left, 'pop'); add(s.t + T.right, 'pop', 1); T.lines.forEach((x, i) => add(s.t + x, 'tick', i)); break;
        case 'poster': add(s.t + T.poster, 'pop'); T.tickets.forEach((x, i) => add(s.t + x, 'pop', i + 1)); wordsAt(s.text, 0.45); break;
      }
    }
    function typing(text, a, b) { for (let i = 0; i < text.length; i++) if (text[i] !== ' ') add(a + ((i + 0.5) * (b - a)) / text.length, 'type', i); }
    return c.sort((x, y) => x.t - y.t);
  }

  const BRAND = { BPM, B, W0, WS, TIMES, AD, words, wordTimes, subTime, cues };
  if (typeof module !== 'undefined') module.exports = BRAND;
  else root.BRAND = BRAND;
})(typeof window !== 'undefined' ? window : globalThis);
