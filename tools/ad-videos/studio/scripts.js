// The 30 MartNepali ads — five modules (buy, sell, events, food, all) × six
// each, every one in its own tone (funny, emotional, FOMO, how-to, myth-busting,
// before/after, listicle…) and one of seven looks (skins), each look with its
// own kind of music:
//   blob    — soft colour blobs, glass UI, tech-house 120        (like the reference promo)
//   kinetic — black & white slam type, trap 140
//   paper   — cream paper, marigolds, serif, Nepali folk 6/8
//   swiss   — white grid infographic, numbers, house 124
//   neon    — synthwave night, neon signs, synthwave 100
//   pov     — a creator's TikTok: caption boxes, emoji, lo-fi 84
//   cinema  — letterboxed film look, slow serif, piano & strings 72
// Roman Nepali up front, English underneath. Shots are [type, seconds, props];
// times are filled in cumulatively. studio/stage.html draws them,
// synth-studio.mjs scores them; cues(ad) is where the sounds go.
(function (root) {
  const SKINS = {
    blob: { bpm: 120 }, kinetic: { bpm: 140 }, paper: { bpm: 100 }, swiss: { bpm: 124 },
    neon: { bpm: 100 }, pov: { bpm: 84 }, cinema: { bpm: 72 },
  };
  const W0 = 0.18, WS = 0.13;
  const TIMES = {
    ask: { cursorIn: 0.15, click: 0.55, typeA: 0.7, typeB: 2.0, send: 2.25, think: 2.4, results: [2.95, 3.15, 3.35] },
    build: { typeA: 0.45, typeB: 1.6, send: 1.8, think: 1.95, page: 2.55, rows: [2.9, 3.05, 3.2] },
    notify: { cards: [0.25, 0.7, 1.15] },
    menu: { taps: [0.8, 1.5, 2.2], done: 2.35 },
    kitchen: { arrive: [0.25, 1.3], moves: [0.7, 1.7], ready: 1.75 },
    tiers: { stamp: 0.55, seats0: 0.8, seats1: 2.6 },
    scan: { scans: [0.5, 1.3, 2.1] },
    logo: { mark: 0.22, slide: 0.6, letters: [0.62, 0.95], sub: 1.0 },
    outro: { lockup: 0.1, typeA: 0.55, typeB: 1.35, tag: 1.45 },
    collage: { items: 0.12, step: 0.1, words: 0.45 },
    pillars: { first: 0.25, step: 0.35 },
    langs: { first: 0.3, step: 0.2, words: 0.5 },
    poster: { poster: 0.1, tickets: [0.5, 0.65, 0.8], words: 0.45 },
    table: { qr: 0.3, scan: 1.2, words: 0.5 },
    chat: { first: 0.25, step: 0.3 },
    compare: { before: 0.15, bLines: 0.45, after: 1.5, aLines: 1.8, step: 0.25 },
    stat: { count: [0.2, 1.1], label: 0.45 },
    steps: { first: 0.35, step: 0.5 },
    qa: { answer: 1.35, note: 1.75 },
    bars: { grow: [0.3, 1.3], top: 1.5 },
    reason: { num: 0.05, title: 0.25, art: 0.35, sub: 0.6 },
    install: { share: 0.7, sheet: 0.85, add: 1.6, icon: 2.0 },
    festivals: { first: 0.3, step: 0.16 },
    emoji: { pop: 0.1, words: 0.45 },
    type: { typeA: 0.3, typeB: 1.2, go: 1.35 },
    list: { first: 0.55, step: 0.3 },
    photo: { words: 0.5 },
    countdown: { num: [0.1, 0.5], label: 0.55 },
    venue: { pin: 0.35, card: 0.8, words: 0.2 },
    lineup: { poster: 0.1, first: 0.45, step: 0.4 },
    ticket: { card: 0.2, check: 1.1 },
    presenters: { first: 0.3, step: 0.45 },
    evout: { poster: 0.1, date: 0.45, typeA: 0.8, typeB: 1.55, qr: 1.0, tag: 1.65 },
    song: { num: 0.05, title: 0.2, artist: 0.55 },
  };

  const beat = (skin) => 60 / SKINS[skin].bpm;
  function ad(id, module, skin, tone, look, shots, caption) {
    let t = 0;
    const out = shots.map(([type, d, props = {}]) => {
      if (type === 'burst' && d == null) d = props.words.length * beat(skin) * (props.beats || 1);
      const s = { type, t, d, ...props };
      t += d;
      return s;
    });
    return { id, module, skin, tone, ...look, shots: out, TOTAL: +t.toFixed(3), caption };
  }
  const L = (accent, accent2, onacc = '#fff', key = 0) => ({ accent, accent2, onacc, key });

  const RES = (k) => ({ momo: ['momo', 'Momo', 'Order & collect'], achar: ['achar', 'Achar', 'Nepali bazaar'], chilli: ['chilli', 'Dalle khursani achar', 'Nepali bazaar'], chiya: ['chiya', 'Chiya masala', 'Nepali bazaar'], ticket: ['ticket', 'Dashain Night', 'Sat 10 Oct · Heidelberg'] }[k]);
  const SHOP_ROWS = [['achar', 'Lapsi achar', '€6.00'], ['chilli', 'Dalle khursani achar', '€5.50'], ['chiya', 'Chiya masala', '€4.50']];

  const ADS = [
    // ───────────── BUY (customers) ─────────────
    ad('buy-1-pov-aama', 'buy', 'pov', 'funny', L('#ff2d55', '#25f4ee', '#fff', 0), [
      ['emoji', 2.6, { emoji: '📞', text: 'POV: Aama ko phone — / "Dashain ma ghar / aaudainas?"' }],
      ['emoji', 2.0, { emoji: '😭', text: 'Ticket *mahango…* / chhutti *chaina…*' }],
      ['words', 1.9, { text: 'Kamsekam *momo* ta / khanchhu 🥟', sub: 'At least I\'ll have momo.' }],
      ['type', 1.7, { text: 'martnepali.com' }],
      ['phone', 3.0, { img: 'home', taps: [[2.2, 97, 330]], cap: 'Momo, achar, Dashain program — *sab yahi* 😍' }],
      ['emoji', 1.8, { emoji: '😂', text: 'Aama lai photo / *pathaideko.*' }],
      ['outro', 2.5, { tag: 'Ghar tadha, *swad najik.*' }],
    ], 'POV: Aama ko phone aayo 😭 Kamsekam momo ta khanchhu 🥟 martnepali.com — momo, achar, Dashain program, sab ek thau ma. #NepalisInGermany #momo #Dashain'),

    ad('buy-2-kinetic-oneclick', 'buy', 'kinetic', 'fomo', L('#e11d48', '#ffffff', '#fff', 0), [
      ['burst', null, { words: ['MOMO.', 'ACHAR.', 'SEL ROTI.', 'DHAKA TOPI.', 'CHIYA.', 'TICKETS.'] }],
      ['words', 2.1, { text: 'Card *chaidaina.* / Account chaidaina.', sub: 'No card. No account.' }],
      ['phone', 3.0, { img: 'checkout-3', scroll: [180, 2437], scrollAt: [0.3, 1.9], taps: [[2.4, 195, 594]], cap: 'Reserve → PayPal wa bank.' }],
      ['burst', null, { words: ['PAYPAL.', 'BANK.', 'QR.', 'DONE.'] }],
      ['outro', 2.6, { tag: 'Kinnus. *Ahile.*' }],
    ], 'Momo. Achar. Sel roti. Dhaka topi. Tickets. Card chaidaina, account chaidaina — PayPal wa bank, QR, done ✅ martnepali.com'),

    ad('buy-3-cinema-swad', 'buy', 'cinema', 'emotional', L('#f59e0b', '#fcd34d', '#111', -3), [
      ['words', 3.2, { text: 'Pardesh ko / chiso beluka…', sub: 'A cold evening, far from home…' }],
      ['words', 3.0, { text: 'ghar ko *swad* / yaad aaucha.', sub: '…and you miss the taste of home.' }],
      ['collage', 3.4, { items: ['chiya', 'achar', 'selroti', 'momo'], text: 'Ilam ko chiya. / Aama jastai *achar.*', sub: 'Ilam tea. Achar like Aama makes.' }],
      ['words', 2.6, { text: 'Aba *tadha* chaina.', sub: 'It isn\'t far anymore.' }],
      ['logo', 2.6, { sub: 'Nepali bazaar' }],
      ['outro', 3.2, { tag: 'Ghar ko swad, *ghar mai.*' }],
    ], 'Pardesh ko chiso beluka… ghar ko swad yaad aaucha. Aba tadha chaina 🫖 Ilam ko chiya, achar, sel roti — martnepali.com'),

    ad('buy-4-swiss-3steps', 'buy', 'swiss', 'how-to', L('#dc143c', '#1d3fbf', '#fff', 0), [
      ['words', 2.1, { text: 'Kasari *kinne?*', sub: 'How to buy on MartNepali' }],
      ['steps', 4.0, { title: '3 step.', items: [['Khojnus', 'Nepali ma sodhe pani hunchha'], ['Rojnus', 'Ticket, momo, achar…'], ['Tirnus', 'PayPal wa bank transfer']] }],
      ['phone', 3.2, { img: 'checkout-3', scroll: [180, 2437], scrollAt: [0.3, 2.0], taps: [[2.5, 195, 594]], cap: 'Reserve → *QR email ma.*' }],
      ['list', 2.8, { title: '*Chaidaina:*', mark: '✗', items: ['Card', 'Account', 'Kunai fee'], sub: 'No card, no account, no fees.' }],
      ['outro', 2.6, { tag: 'Sajilo. *Sidhai.*' }],
    ], 'Kasari kinne? 3 step: khojnus, rojnus, PayPal wa bank ma tirnus. Card chaidaina, account chaidaina, fee chaina ✅ martnepali.com'),

    ad('buy-5-blob-ask', 'buy', 'blob', 'feature', L('#e11d48', '#fb7185', '#fff', 2), [
      ['words', 2.4, { text: 'Roman Nepali ma / *sodhnus.*', sub: 'Ask in Roman Nepali.' }],
      ['ask', 4.6, { q: '10 euro bhanda sasto achar dekhau', results: [RES('achar'), RES('chilli'), RES('chiya')], sub: 'AI le bujhchha — English, Deutsch, नेपाली pani.' }],
      ['langs', 2.6, { chips: ['English', 'Deutsch', 'नेपाली', 'Roman Nepali'], text: 'Jun bhasa ma *pani.*', sub: 'Any language.' }],
      ['logo', 2.0, {}],
      ['outro', 2.6, { tag: 'Sodhnus. *Paunus.*' }],
    ], '"10 euro bhanda sasto achar dekhau" — MartNepali ko AI le Roman Nepali pani bujhchha 🤖 English, Deutsch, नेपाली — jun bhasa ma pani. martnepali.com'),

    ad('buy-6-neon-weekend', 'buy', 'neon', 'nightlife', L('#ff2e97', '#22d3ee', '#fff', -2), [
      ['words', 2.4, { text: 'Weekend *plan?*', sub: 'Nepali concerts & programs.' }],
      ['poster', 2.7, { text: 'Nepali program, / *ticket* yahi.', sub: 'Real shows, selling right here.' }],
      ['phone', 3.2, { img: 'event', scroll: [0, 120], scrollAt: [0.3, 1.0], taps: [[2.2, 91, 468]], cap: 'Get tickets → *2 tap.*' }],
      ['scan', 2.8, { sub: 'QR phone ma — door ma scan, *bhitra!*' }],
      ['outro', 2.6, { tag: 'Night *tapai ko.*' }],
    ], 'Weekend plan? 🎶 Nepali program ko ticket martnepali.com ma — QR phone ma, door ma scan, bhitra! #NepaliEvents'),

    // ───────────── SELL (shops) ─────────────
    ad('sell-1-paper-aama', 'sell', 'paper', 'emotional', L('#c2410c', '#f59e0b', '#fff', 0), [
      ['words', 3.0, { text: 'Aama ko haat ko / *achar…*', sub: 'Aama\'s homemade achar…' }],
      ['words', 3.0, { text: 'aba pura *Germany* le / chakhna sakchha.', sub: '…now all of Germany can taste it.' }],
      ['build', 4.3, { q: 'Ma ghar mai achar banauchhu.', shop: 'Aama ko Achar', place: 'Order & collect', rows: SHOP_ROWS, sub: 'Afnai page — *AI le banaidinchha.*' }],
      ['notify', 2.7, { cards: [['Naya order!', '2× Lapsi achar · €12.00'], ['Naya order!', 'Dalle khursani achar · €5.50'], ['Paid ✓', 'Sidhai tapai ko account ma']], text: 'Order *aaucha.*', sub: 'Orders come to you.' }],
      ['outro', 3.0, { tag: 'Free. *Commission chaina.*' }],
    ], 'Aama ko haat ko achar — aba pura Germany le chakhna sakchha 🫙 Afnai page, free, commission chaina. martnepali.com → Sell with us'),

    ad('sell-2-kinetic-myth', 'sell', 'kinetic', 'myth-busting', L('#f59e0b', '#ffffff', '#111', 5), [
      ['qa', 2.6, { q: 'Online bechna / *gaaro?*', a: 'HOINA.' }],
      ['burst', null, { words: ['PAGE?', 'AI LE', 'BANAUCHHA.', 'FEE?', 'ZERO.', 'COMMISSION?', 'ZERO.'] }],
      ['stat', 2.4, { value: 0, prefix: '€', label: 'suru garna', sub: 'Free to start. No commission. Ever.' }],
      ['list', 2.8, { title: 'Paisa *kaha* jaanchha?', items: ['Sidhai tapai ko bank', 'Wa tapai ko PayPal', 'Hami kehi kaatdainau'], sub: 'Straight to you. We take nothing.' }],
      ['outro', 2.6, { tag: 'Aaja nai *suru.*' }],
    ], 'Online bechna gaaro? HOINA ❌ Page AI le banauchha, fee zero, commission zero. Paisa sidhai tapai ko bank wa PayPal ma. martnepali.com'),

    ad('sell-3-swiss-5reasons', 'sell', 'swiss', 'listicle', L('#f59e0b', '#0b0b14', '#111', 5), [
      ['words', 2.0, { text: '*5* karan:', sub: '5 reasons to sell on MartNepali' }],
      ['reason', 2.3, { n: '01', title: 'Free', sub: 'Fee chaina, commission chaina', art: 'coin' }],
      ['reason', 2.3, { n: '02', title: 'Paisa sidhai tapai lai', sub: 'Bank wa PayPal — hami bich ma chhainau', art: 'bag' }],
      ['reason', 2.3, { n: '03', title: 'QR le handover', sub: 'Scan garnus, saman dinus', art: 'phone' }],
      ['reason', 2.3, { n: '04', title: 'Subscribe & save', sub: 'Regular customer, pheri pheri', art: 'achar' }],
      ['reason', 2.3, { n: '05', title: 'Nepali customers', sub: 'Community ko afnai bazaar', art: 'topi' }],
      ['outro', 2.8, { tag: 'Tapai ko pasal, *aaja.*' }],
    ], '5 karan MartNepali ma bechne: 1 Free 2 Paisa sidhai tapai lai 3 QR le handover 4 Subscribe & save 5 Nepali customers ✅ martnepali.com'),

    ad('sell-4-pov-chaos', 'sell', 'pov', 'before-after', L('#f59e0b', '#25f4ee', '#111', 5), [
      ['chat', 3.6, { title: 'Achar orders 🫙', msgs: ['Didi achar baki chha?', '2 jar lapsi pls', 'Kati ho?', 'Account number pathau na', 'Paisa pathaye hai', 'Mero order kaha pugyo??', 'Aaja lina milchha?', 'Didi reply?? 😅'], badge: 47 }],
      ['emoji', 1.8, { emoji: '😵‍💫', text: 'Ma ta *thaki* sake…' }],
      ['compare', 3.4, { before: ['Message ma order', 'Account number pathaunu', 'Kasle tiryo, thaha chaina'], after: ['Afnai order page', 'Payment reference auto', 'Sab order ek list ma'] }],
      ['notify', 2.6, { cards: [['Naya order!', '2× Lapsi achar · €12.00'], ['Paid ✓', 'Reference milyo — confirm'], ['Pickup ✓', 'QR scan — dinu bhayo']], text: 'Aba *shanta.*', sub: 'Calm again.' }],
      ['outro', 2.6, { tag: 'Message chaos, *bye bye.*' }],
    ], 'POV: 47 ta message "didi achar baki chha?" 😵‍💫 Aba afnai order page, payment reference auto, sab order ek list ma. martnepali.com'),

    ad('sell-5-blob-insights', 'sell', 'blob', 'feature', L('#f59e0b', '#fbbf24', '#111', 7), [
      ['words', 2.4, { text: 'Kun saman *dherai* / bikchha?', sub: 'Which items sell best?' }],
      ['bars', 3.6, { title: 'Shop insights' }],
      ['words', 2.3, { text: 'Regular customer? / *Subscribe & save.*', sub: 'Repeat orders, 5–15% off.' }],
      ['notify', 2.6, { cards: [['Naya subscription!', 'Chiya masala ↻'], ['Repeat order ↻', 'Lapsi achar · 10% off'], ['Paid ✓', 'Sidhai tapai lai']], text: 'Pheri *pheri.*', sub: 'Again and again.' }],
      ['outro', 2.6, { tag: 'Data le *badhaunus.*' }],
    ], 'Kun saman dherai bikchha? Shop insights le dekhauchha 📊 Regular customer lai Subscribe & save — pheri pheri order ↻ martnepali.com'),

    ad('sell-6-neon-sidehustle', 'sell', 'neon', 'aspirational', L('#ff2e97', '#22d3ee', '#fff', -1), [
      ['words', 2.4, { text: 'Side income / *chahiyo?*', sub: 'Want a side income?' }],
      ['collage', 2.7, { items: ['topi', 'pote', 'achar', 'chiya', 'selroti', 'bag'], text: 'Dhaka. Pote. *Achar.*', sub: 'Sell what you make — from home.' }],
      ['stat', 2.4, { value: 0, prefix: '€', label: 'suru garna', sub: 'Costs nothing to start.' }],
      ['words', 2.2, { text: 'Pahila *demo* / try garnus.', sub: 'Try the seller demo — no signup.' }],
      ['outro', 2.6, { tag: 'Ghar bata *business.*' }],
    ], 'Side income chahiyo? Dhaka, pote, achar — ghar bata bechnus. Suru garna €0. Pahila demo try garnus, signup chaidaina ✨ martnepali.com'),

    // ───────────── EVENTS (organizers) ─────────────
    ad('events-1-kinetic-housefull', 'events', 'kinetic', 'hype', L('#2563eb', '#ffffff', '#fff', 2), [
      ['burst', null, { words: ['EARLY BIRD.', 'SOLD OUT.', 'PHASE 2.', 'SOLD OUT.', 'HOUSEFULL.'], beats: 1.5 }],
      ['tiers', 3.2, { sub: 'Early bird, phase, *seat map.*' }],
      ['scan', 2.7, { sub: 'Door ma *phone le scan.*' }],
      ['stat', 2.3, { value: 0, suffix: '%', label: 'commission', sub: 'Ticket money goes straight to you.' }],
      ['outro', 2.6, { tag: 'Next program: *HOUSEFULL.*' }],
    ], 'Early bird → SOLD OUT → Phase 2 → HOUSEFULL 🔥 Ticket, seat map, door scan — 0% commission. martnepali.com'),

    ad('events-2-swiss-checklist', 'events', 'swiss', 'checklist', L('#2563eb', '#0b0b14', '#fff', 2), [
      ['words', 2.2, { text: 'Program garda / *k k* chahincha?', sub: 'What does an event need?' }],
      ['list', 4.3, { title: 'Checklist', items: ['Online ticket', 'Early bird & phase', 'Seat map', 'Discount & referral code', 'Door ma QR scan', 'Live door screen'], sub: 'All in one place.' }],
      ['stat', 2.2, { value: 0, prefix: '€', label: 'suru garna', sub: 'Free for organizers.' }],
      ['phone', 3.1, { img: 'event', scroll: [0, 120], scrollAt: [0.3, 1.0], taps: [[2.2, 91, 468]], cap: 'Dashain Heidelberg — *yahi bata.*' }],
      ['outro', 2.6, { tag: 'Sab *ek thau* ma.' }],
    ], 'Program garda k k chahincha? ✅ Online ticket ✅ Early bird ✅ Seat map ✅ Discount & referral code ✅ Door scan ✅ Live door screen — free. martnepali.com'),

    ad('events-3-pov-door', 'events', 'pov', 'funny', L('#2563eb', '#25f4ee', '#fff', 2), [
      ['emoji', 2.7, { emoji: '😰', text: 'POV: program ko din — / door ma 300 jana, / hat ma *Excel sheet*' }],
      ['chat', 2.6, { title: 'Door 🚪', msgs: ['Mero naam list ma chha?', 'Maile paisa pathako thiye!', 'Screenshot dekhauchhu', '2 jana ho hami', 'Bhai chhito na 😤'], badge: 23 }],
      ['words', 1.7, { text: 'Aba *hoina.*' }],
      ['scan', 2.9, { sub: 'Phone le scan — *next!*' }],
      ['emoji', 1.8, { emoji: '😎', text: 'Line *gayab.*' }],
      ['outro', 2.6, { tag: 'Door ma *tension chaina.*' }],
    ], 'POV: program ko din, door ma 300 jana, hat ma Excel sheet 😰 Aba phone le QR scan — line gayab 😎 martnepali.com'),

    ad('events-4-neon-night', 'events', 'neon', 'aspirational', L('#ff2e97', '#22d3ee', '#fff', -2), [
      ['words', 2.4, { text: 'Tapai ko *concert.* / Tapai ko night.', sub: 'Your concert. Your night.' }],
      ['tiers', 3.4, { sub: 'Phase, seat map — *sab set.*' }],
      ['stat', 2.3, { value: 1, label: 'phone le pura door', sub: 'One phone runs the whole door.' }],
      ['scan', 2.8, { sub: 'QR scan — *bhitra.*' }],
      ['outro', 2.8, { tag: 'Stage *tayar.*' }],
    ], 'Tapai ko concert. Tapai ko night 🌙 Ticket phase, seat map, ek phone le pura door. martnepali.com'),

    ad('events-5-blob-proof', 'events', 'blob', 'proof', L('#2563eb', '#60a5fa', '#fff', 2), [
      ['poster', 3.0, { text: 'Sugam Pokhrel · Heidelberg / tickets *yahi* bata.', sub: 'A real show, selling right here.' }],
      ['phone', 3.3, { img: 'event', scroll: [0, 120], scrollAt: [0.3, 1.0], taps: [[2.3, 91, 468]], cap: 'Real event. *Real tickets.*' }],
      ['words', 2.2, { text: 'Early bird: / *SOLD OUT.*', sub: 'The early-bird tickets are gone.' }],
      ['words', 2.2, { text: 'Tapai ko program / *pani?*', sub: 'Your event next?' }],
      ['logo', 2.0, { sub: 'for organizers' }],
      ['outro', 2.6, { tag: 'Free ma *suru garnus.*' }],
    ], 'Sugam Pokhrel & Bajagaja · Heidelberg — tickets yahi bata bikdai chha, early bird already SOLD OUT 🔥 Tapai ko program pani? martnepali.com'),

    ad('events-6-cinema-community', 'events', 'cinema', 'emotional', L('#60a5fa', '#bfdbfe', '#111', -5), [
      ['words', 3.2, { text: 'Program bhaneko / ticket matra hoina…', sub: 'An event is more than tickets…' }],
      ['words', 2.8, { text: 'yo *community* ho.', sub: '…it\'s community.' }],
      ['collage', 3.3, { items: ['madal', 'mic', 'kite', 'ticket'], text: 'Gaana. Naach. / *Bhet.*', sub: 'Songs. Dance. Meeting again.' }],
      ['words', 3.0, { text: 'Tapai jodnus — / ticket *hami* sambhalchhau.', sub: 'You bring people together. We handle the tickets.' }],
      ['outro', 3.2, { tag: 'Community ko lagi, *free.*' }],
    ], 'Program bhaneko ticket matra hoina — yo community ho 🪁 Tapai jodnus, ticket hami sambhalchhau. Free for organizers. martnepali.com'),

    // ───────────── FOOD (restaurants) ─────────────
    ad('food-1-kinetic-rush', 'food', 'kinetic', 'problem', L('#84cc16', '#ffffff', '#111', 7), [
      ['burst', null, { words: ['FRIDAY.', '7 PM.', 'PHONE', 'BAJIRAKHCHHA.', '📞📞📞'] }],
      ['words', 1.7, { text: '*STOP.*' }],
      ['menu', 3.2, { dish: 'Jhol momo', price: '€9.50', art: 'jhol', sub: 'Customer afai *order garchha.*' }],
      ['kitchen', 3.0, { sub: 'Kitchen board: *sab clear.*' }],
      ['outro', 2.6, { tag: 'Rush ma pani *shanta.*' }],
    ], 'Friday. 7 PM. Phone bajirakhchha 📞📞📞 STOP. Online menu + kitchen board — rush ma pani shanta. martnepali.com'),

    ad('food-2-paper-smallkitchen', 'food', 'paper', 'warm', L('#c2410c', '#65a30d', '#fff', 0), [
      ['words', 2.8, { text: 'Sano kitchen, / *thulo swad.*', sub: 'Small kitchen, big taste.' }],
      ['collage', 2.8, { items: ['thali', 'momo', 'selroti', 'jhol'], text: 'Dal bhat. Momo. / *Sel roti.*', sub: 'Your menu, online.' }],
      ['menu', 3.3, { dish: 'Dal bhat thali', price: '€11.00', art: 'thali', sub: 'Kati baje lina — *customer afai rojchha.*' }],
      ['words', 2.4, { text: 'Pickup ma / *QR dekhaunus.*', sub: 'Collect with a QR code.' }],
      ['outro', 3.0, { tag: 'Tapai ko kitchen, *online.*' }],
    ], 'Sano kitchen, thulo swad 🍛 Dal bhat, momo, sel roti — menu online, customer afai pickup time rojchha, QR le collect. martnepali.com'),

    ad('food-3-swiss-4tools', 'food', 'swiss', 'explainer', L('#65a30d', '#0b0b14', '#fff', 7), [
      ['words', 2.0, { text: 'Restaurant ko lagi / *4 tool.*', sub: '4 tools for your restaurant' }],
      ['reason', 2.3, { n: '01', title: 'Online menu', sub: 'Photo, price, choices', art: 'jhol' }],
      ['reason', 2.3, { n: '02', title: 'Pickup time', sub: 'Customer afai samaya rojchha', art: 'momo' }],
      ['reason', 2.3, { n: '03', title: 'Kitchen board', sub: 'Naya → Pakaudai → Tayar', art: 'thali' }],
      ['reason', 2.3, { n: '04', title: 'Table QR', sub: 'Table bata sidhai order', art: 'phone' }],
      ['kitchen', 2.9, { sub: 'Sab ek *screen* ma.' }],
      ['outro', 2.6, { tag: 'Free ma *try garnus.*' }],
    ], 'Restaurant ko lagi 4 tool: 1 Online menu 2 Pickup time 3 Kitchen board 4 Table QR 🍜 Free ma try garnus — martnepali.com'),

    ad('food-4-pov-orders', 'food', 'pov', 'funny', L('#84cc16', '#25f4ee', '#111', 7), [
      ['emoji', 2.8, { emoji: '🤯', text: 'POV: customer phone ma — / "momo piro kam, 6:45 ma / aauchhu, achar extra…"' }],
      ['emoji', 1.8, { emoji: '📝', text: '…ani tapai lai / *kehi yaad chaina.*' }],
      ['menu', 3.2, { dish: 'Jhol momo', price: '€9.50', art: 'jhol', sub: 'Aba customer *afai choose garchha.*' }],
      ['kitchen', 2.8, { sub: 'Kitchen ma *sab lekhiyeko.*' }],
      ['emoji', 1.6, { emoji: '😌', text: '*Sukha.*' }],
      ['outro', 2.6, { tag: 'Order *clear.* Kitchen *happy.*' }],
    ], 'POV: "momo piro kam, 6:45 ma aauchhu, achar extra…" 🤯 ani tapai lai kehi yaad chaina 😅 Aba customer afai choose garchha. martnepali.com'),

    ad('food-5-neon-craving', 'food', 'neon', 'customer-craving', L('#ff2e97', '#22d3ee', '#fff', 3), [
      ['words', 2.4, { text: 'Momo *craving?* 🌙', sub: 'Momo cravings?' }],
      ['menu', 3.2, { dish: 'Jhol momo', price: '€9.50', art: 'jhol', sub: 'Order ahead — *time rojnus.*' }],
      ['words', 2.2, { text: 'Line ma *nabasnus.* / QR le linus.', sub: 'Skip the queue — collect with your QR.' }],
      ['table', 2.6, { text: 'Restaurant ma? / *Table bata order.*', sub: 'A QR on every table.' }],
      ['outro', 2.6, { tag: 'Momo *time.*' }],
    ], 'Momo craving? 🌙 Order ahead, time rojnus, line ma nabasnus — QR le linus. martnepali.com'),

    ad('food-6-blob-table', 'food', 'blob', 'feature', L('#65a30d', '#a3e635', '#111', 5), [
      ['words', 2.2, { text: 'Waiter *busy?*', sub: 'Busy waiters?' }],
      ['table', 2.8, { text: 'Table bata sidhai / *order.*', sub: 'Guests scan the table QR.' }],
      ['menu', 3.2, { dish: 'Jhol momo', price: '€9.50', art: 'jhol', sub: 'Piro ra choices — *customer afai.*' }],
      ['kitchen', 3.0, { sub: 'Sidhai *kitchen board* ma.' }],
      ['words', 2.0, { text: 'Kaam *halka.*', sub: 'Less running around.' }],
      ['outro', 2.6, { tag: 'Restaurant, *smart.*' }],
    ], 'Waiter busy? Table QR scan → menu → order sidhai kitchen board ma. Kaam halka ✅ martnepali.com'),

    // ───────────── ALL (the platform) ─────────────
    ad('all-1-cinema-manifesto', 'all', 'cinema', 'manifesto', L('#dc143c', '#fca5a5', '#fff', 0), [
      ['words', 3.0, { text: 'Hami Nepal bata / *tadha* chhau…', sub: 'We are far from Nepal…' }],
      ['words', 3.0, { text: 'tara *Nepal* hami bata / tadha chaina.', sub: '…but Nepal is not far from us.' }],
      ['collage', 3.4, { items: ['kite', 'momo', 'madal', 'topi', 'achar', 'ticket'], text: 'Hamro program. / Hamro bazaar. / Hamro *swad.*', sub: 'Our events. Our bazaar. Our taste.' }],
      ['words', 2.8, { text: 'Kinnus. Bechnus. / *Jodnus.*', sub: 'Buy. Sell. Come together.' }],
      ['logo', 2.6, { sub: 'Jahaa bhaye pani, Nepal najikai' }],
      ['outro', 3.2, { tag: 'Hamro community ko *ghar.*' }],
    ], 'Hami Nepal bata tadha chhau… tara Nepal hami bata tadha chaina 🇳🇵 Kinnus. Bechnus. Jodnus. martnepali.com'),

    ad('all-2-kinetic-4in1', 'all', 'kinetic', 'hype', L('#dc143c', '#ffffff', '#fff', 0), [
      ['burst', null, { words: ['KINNUS.', 'BECHNUS.', 'PROGRAM.', 'RESTAURANT.', 'EK THAU.'], beats: 1.5 }],
      ['pillars', 3.4, { cards: [['bag', 'Kinnus', 'Bazaar, momo, tickets'], ['achar', 'Bechnus', 'Afnai pasal, free'], ['ticket', 'Program', 'Ticket, seat, scan'], ['jhol', 'Restaurant', 'Menu, kitchen, table QR']] }],
      ['stat', 2.3, { value: 0, suffix: '%', label: 'commission — kasai sanga', sub: 'We take no cut from anyone.' }],
      ['langs', 2.5, { chips: ['English', 'Deutsch', 'नेपाली', 'Roman Nepali'], text: 'Jun bhasa ma *pani.*', sub: 'Any language.' }],
      ['outro', 2.6, { tag: 'Sab *ek thau.*' }],
    ], 'Kinnus. Bechnus. Program. Restaurant. EK THAU 🔥 0% commission, jun bhasa ma pani. martnepali.com'),

    ad('all-3-swiss-didyouknow', 'all', 'swiss', 'facts', L('#dc143c', '#1d3fbf', '#fff', 0), [
      ['words', 2.0, { text: 'Thaha *chha?*', sub: 'Did you know?' }],
      ['reason', 2.3, { n: '01', title: 'Bechna free', sub: 'Commission chaina — kahile pani', art: 'coin' }],
      ['reason', 2.3, { n: '02', title: 'Paisa sidhai', sub: 'Buyer → seller, bich ma koi chaina', art: 'bag' }],
      ['reason', 2.3, { n: '03', title: '3 bhasa', sub: 'English · Deutsch · नेपाली', art: 'phone' }],
      ['reason', 2.3, { n: '04', title: 'Nepali patro pani', sub: 'Chad parva, program — sab yahi', art: 'kite' }],
      ['outro', 2.8, { tag: 'Aba *thaha bhayo.*' }],
    ], 'Thaha chha? 1 Bechna free, commission chaina 2 Paisa sidhai seller lai 3 English, Deutsch, नेपाली 4 Nepali patro pani 📅 martnepali.com'),

    ad('all-4-pov-demo', 'all', 'pov', 'funny', L('#ff2d55', '#25f4ee', '#fff', 2), [
      ['emoji', 2.6, { emoji: '🤔', text: 'POV: bechna man chha, / tara *sign up* garna / alchi lagchha 😴' }],
      ['words', 2.0, { text: '*Try the demo.* / Signup chaidaina.', sub: 'The seller demo needs no signup.' }],
      ['build', 4.2, { q: 'Ma momo ra achar bechchhu.', shop: 'Momo & Achar', place: 'Order & collect', rows: [['momo', 'Momo (10 pcs)', '€9.00'], ['achar', 'Lapsi achar', '€6.00'], ['chiya', 'Chiya masala', '€4.50']], sub: 'Page *tayar.* Try garera hernus.' }],
      ['emoji', 1.8, { emoji: '😳', text: 'Yeti *sajilo?*' }],
      ['outro', 2.6, { tag: 'Try the demo → *martnepali.com*' }],
    ], 'POV: bechna man chha tara sign up garna alchi 😴 Try the demo — signup chaidaina. Yeti sajilo? 😳 martnepali.com'),

    ad('all-5-neon-festivals', 'all', 'neon', 'festival', L('#ff2e97', '#fbbf24', '#fff', 0), [
      ['words', 2.4, { text: 'Chad parva ko / *season* aayo!', sub: 'Festival season is here!' }],
      ['festivals', 3.1, { chips: ['Dashain', 'Tihar', 'Chhath', 'Teej', 'Lhosar', 'Holi'] }],
      ['collage', 2.8, { items: ['kite', 'diyo', 'ticket', 'selroti', 'topi', 'madal'], text: 'Program. Saman. / *Swad.*', sub: 'Events, festival goods, food.' }],
      ['words', 2.2, { text: 'Nepali *patro* pani / yahi.', sub: 'The Nepali calendar, right there.' }],
      ['outro', 2.6, { tag: 'Chad parva ko *ghar.*' }],
    ], 'Chad parva ko season aayo! 🪔 Dashain, Tihar, Chhath, Teej, Lhosar, Holi — program, saman, swad ra Nepali patro, sab martnepali.com ma'),

    ad('all-6-paper-app', 'all', 'paper', 'how-to', L('#c2410c', '#dc143c', '#fff', 0), [
      ['words', 2.6, { text: 'App download / *chaidaina.*', sub: 'No app store needed.' }],
      ['install', 4.0, { sub: 'Share → *Add to Home Screen*' }],
      ['words', 2.4, { text: 'Ek tap ma / *MartNepali.*', sub: 'Opens like an app.' }],
      ['pillars', 3.3, { cards: [['ticket', 'Tickets', 'Offline pani khulchha'], ['bag', 'Bazaar', 'Achar dekhi dhaka samma'], ['momo', 'Momo', 'Order garnus, pickup ma']] }],
      ['outro', 2.8, { tag: 'Phone ma, *sadhai.*' }],
    ], 'App download chaidaina 📱 Share → Add to Home Screen → ek tap ma MartNepali. Tickets offline pani khulchha. martnepali.com'),
  ];

  // Words of "a b / *c* d": [{w, line, accent}].
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
  const subTime = (text, start = W0) => start + words(text).length * WS + 0.1;

  /** Every sound cue of an ad: [{t, kind, i}] — whoosh, big, tick, hit, pop, click, type, chime, slam. */
  function cues(ad) {
    const c = [];
    const add = (t, kind, i = 0) => c.push({ t, kind, i });
    const typing = (text, a, b) => { for (let i = 0; i < text.length; i++) if (text[i] !== ' ') add(a + ((i + 0.5) * (b - a)) / text.length, 'type', i); };
    for (const s of ad.shots) {
      const T = TIMES[s.type] || {};
      add(s.t, s.t === 0 ? 'hit' : 'whoosh');
      const wordsAt = (text, start) => text && wordTimes(text, start).forEach((x, i) => add(s.t + x, 'tick', i));
      switch (s.type) {
        case 'words': wordsAt(s.text, W0); break;
        case 'emoji': add(s.t + T.pop, 'pop', 2); wordsAt(s.text, T.words); break;
        case 'burst': s.words.forEach((_, i) => add(s.t + (i * s.d) / s.words.length, 'slam', i)); break;
        case 'collage': s.items.forEach((_, i) => add(s.t + T.items + i * T.step, 'pop', i)); wordsAt(s.text, T.words); break;
        case 'giant': add(s.t, 'big'); break;
        case 'logo': add(s.t + T.mark, 'hit'); for (let i = 0; i < 10; i++) add(s.t + T.letters[0] + (i * (T.letters[1] - T.letters[0])) / 10, 'tick', i); break;
        case 'ask': add(s.t + T.click, 'click'); typing(s.q, s.t + T.typeA, s.t + T.typeB); add(s.t + T.send, 'click'); T.results.forEach((x, i) => add(s.t + x, 'pop', i)); break;
        case 'build': typing(s.q, s.t + T.typeA, s.t + T.typeB); add(s.t + T.send, 'click'); add(s.t + T.page, 'chime'); T.rows.forEach((x, i) => add(s.t + x, 'pop', i)); break;
        case 'notify': T.cards.forEach((x, i) => add(s.t + x, i === 2 ? 'chime' : 'pop', i)); wordsAt(s.text, 1.5); break;
        case 'list': s.items.forEach((_, i) => add(s.t + T.first + i * T.step, 'pop', i)); break;
        case 'menu': T.taps.forEach((x) => add(s.t + x, 'click')); add(s.t + T.done, 'chime'); break;
        case 'kitchen': T.arrive.forEach((x, i) => add(s.t + x, 'pop', i)); T.moves.forEach((x) => add(s.t + x, 'click')); add(s.t + T.ready, 'chime'); break;
        case 'tiers': add(s.t + T.stamp, 'slam'); break;
        case 'scan': T.scans.forEach((x) => { add(s.t + x, 'click'); add(s.t + x + 0.12, 'chime'); }); break;
        case 'outro': add(s.t + T.lockup, 'hit'); typing('martnepali.com', s.t + T.typeA, s.t + T.typeB); break;
        case 'pillars': s.cards.forEach((_, i) => add(s.t + T.first + i * T.step, 'pop', i)); break;
        case 'langs': s.chips.forEach((_, i) => add(s.t + T.first + i * T.step, 'pop', i)); wordsAt(s.text, T.words); break;
        case 'poster': add(s.t + T.poster, 'pop'); T.tickets.forEach((x, i) => add(s.t + x, 'pop', i + 1)); wordsAt(s.text, T.words); break;
        case 'table': add(s.t + T.qr, 'pop'); add(s.t + T.scan, 'chime'); wordsAt(s.text, T.words); break;
        case 'chat': s.msgs.forEach((_, i) => add(s.t + T.first + i * T.step, 'ding', i)); break;
        case 'compare': add(s.t + T.before, 'pop'); s.before.forEach((_, i) => add(s.t + T.bLines + i * T.step, 'tick', i)); add(s.t + T.after, 'hit'); s.after.forEach((_, i) => add(s.t + T.aLines + i * T.step, 'pop', i)); break;
        case 'stat': for (let i = 0; i < 8; i++) add(s.t + T.count[0] + (i * (T.count[1] - T.count[0])) / 8, 'tick', i); add(s.t + T.count[1], 'slam'); break;
        case 'steps': s.items.forEach((_, i) => add(s.t + T.first + i * T.step, 'pop', i)); break;
        case 'qa': wordsAt(s.q, W0); add(s.t + T.answer, 'slam'); break;
        case 'bars': for (let i = 0; i < 7; i++) add(s.t + T.grow[0] + i * 0.12, 'tick', i); add(s.t + T.top, 'pop'); break;
        case 'reason': add(s.t + T.num, 'slam'); add(s.t + T.art, 'pop'); break;
        case 'install': add(s.t + T.share, 'click'); add(s.t + T.add, 'click'); add(s.t + T.icon, 'chime'); break;
        case 'festivals': s.chips.forEach((_, i) => add(s.t + T.first + i * T.step, 'pop', i)); break;
        case 'type': typing(s.text, s.t + T.typeA, s.t + T.typeB); add(s.t + T.go, 'click'); break;
        case 'phone': (s.taps || []).forEach(([x]) => add(s.t + x, 'click')); break;
        case 'photo': wordsAt(s.text, T.words); break;
        case 'countdown': add(s.t + T.num[1], 'slam'); add(s.t + T.label, 'hit'); break;
        case 'venue': add(s.t + T.pin, 'slam'); add(s.t + T.card, 'pop'); wordsAt(s.text, T.words); break;
        case 'lineup': add(s.t + T.poster, 'pop'); s.names.forEach((_, i) => add(s.t + T.first + i * T.step, 'slam', i)); break;
        case 'ticket': add(s.t + T.card, 'pop'); add(s.t + T.check, 'chime'); break;
        case 'presenters': s.orgs.forEach((_, i) => add(s.t + T.first + i * T.step, 'pop', i)); break;
        case 'evout': add(s.t + T.poster, 'hit'); add(s.t + T.date, 'slam'); typing('martnepali.com', s.t + T.typeA, s.t + T.typeB); add(s.t + T.qr, 'pop'); break;
      }
    }
    return c.sort((x, y) => x.t - y.t);
  }

  const STUDIO = { SKINS, W0, WS, TIMES, ADS, byId: Object.fromEntries(ADS.map((a) => [a.id, a])), words, wordTimes, subTime, cues, beat, ad, L };
  // Another set of ads (studio/dashain-scripts.js) adds itself here.
  STUDIO.register = (list) => { for (const a of list) { STUDIO.ADS.push(a); STUDIO.byId[a.id] = a; } };
  if (typeof module !== 'undefined') module.exports = STUDIO;
  else root.STUDIO = STUDIO;
})(typeof window !== 'undefined' ? window : globalThis);
