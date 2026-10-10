// 22 ads for one show: DashainEvent2026 — Sugam Pokhrel & Bajagaja, Sat 10 Oct
// 2026, Rohrbacher Kulturhaus, Heidelberg, presented by NPJOE e.V. with Nepali
// Events Germany. Asked for by the organizer (Oct 1 2026). Each is its own
// idea: line-up hype, emotional Dashain, POV, family, numbers, neon night,
// student deal, the first-aid cause, how to buy, FOMO, group chat, venue,
// outfit checklist, myth-busting, who organizes, a Dashain greeting, a memory
// film, a tag-your-friends post and a 4-part countdown (1 week, 3 days,
// tomorrow, today).
//
// Facts, as on the event page (checked Oct 1 2026): early bird and the first
// standard batch sold out, Standard Phase 2 €50 on sale; students €5 voucher
// with ID; FSJ/BFD/au pairs €15 off with proof; up to 8 tickets per order;
// PayPal or bank transfer; QR tickets by email; supports first-aid training in
// Nepal. The page gives two different door times, so no time is stated.
(function (root) {
  const S = root.STUDIO || (typeof require !== 'undefined' ? require('./scripts.js') : null);
  const { ad, L } = S;
  const EVENT_URL = 'https://www.martnepali.com/e/dashainevent2026-with-sugam-pokhrel-bajagaja';
  const OUT = (tag) => ['evout', 3.4, { tag }];
  const CHECKOUT = ['phone', 3.2, { img: 'checkout-3', scroll: [180, 2437], scrollAt: [0.3, 1.9], taps: [[2.4, 195, 594]], cap: 'Reserve → *PayPal wa bank.*' }];
  const EVENTPAGE = (cap) => ['phone', 3.1, { img: 'event', scroll: [0, 120], scrollAt: [0.3, 1.0], taps: [[2.2, 91, 468]], cap }];
  const TAGS = '#Dashain2026 #SugamPokhrel #Bajagaja #Heidelberg #NepalisInGermany #MartNepali';
  const C = (s) => `${s}\n\n🎟️ martnepali.com · Sat 10 Oct · Rohrbacher Kulturhaus, Heidelberg\nPresented by NPJOE e.V. & Nepali Events Germany\n${TAGS}`;

  const ADS = [
    ad('dh-01-kinetic-lineup', 'dashain', 'kinetic', 'hype', L('#e11d48', '#ffffff', '#fff', 0), [
      ['burst', null, { words: ['SUGAM', 'POKHREL.', 'BAJAGAJA.', 'LIVE.', 'HEIDELBERG.', '10.10.'] }],
      ['lineup', 3.4, { names: ['Sugam Pokhrel', '& Bajagaja', 'LIVE'], sub: 'Dashain & Tihar Festival' }],
      ['tiers', 3.2, { sub: 'Early bird *sold out.* Phase 2 — €50.' }],
      OUT('Miss *nagarnus.*'),
    ], C('SUGAM POKHREL. BAJAGAJA. LIVE. HEIDELBERG. 10.10 🔥 Early bird sold out — Phase 2 ticket abhai paincha.')),

    ad('dh-02-cinema-dashain', 'dashain', 'cinema', 'emotional', L('#f59e0b', '#fcd34d', '#111', -3), [
      ['words', 3.2, { text: 'Dashain bhaneko… / tika, jamara,', sub: 'Dashain is… tika, jamara,' }],
      ['words', 2.8, { text: 'ani *parivar.*', sub: '…and family.' }],
      ['photo', 3.4, { img: 'dashain-2024__community-meal', text: 'Pardesh ma, / *hami nai* parivar.', sub: 'Far from home, we are each other\'s family.' }],
      ['photo', 3.0, { img: 'naya-barsha-2026__live-concert', text: 'Yo Dashain — / *sangai.*', sub: 'This Dashain, together.' }],
      OUT('Heidelberg ma, *sangai.*'),
    ], C('Dashain bhaneko tika, jamara… ani parivar 🙏 Pardesh ma, hami nai parivar. Yo Dashain — sangai, Heidelberg ma.')),

    ad('dh-03-pov-ghar', 'dashain', 'pov', 'funny', L('#ff2d55', '#25f4ee', '#fff', 2), [
      ['emoji', 2.5, { emoji: '😭', text: 'POV: yo barsa pani / Dashain ma *ghar* / jana paina…' }],
      ['emoji', 2.3, { emoji: '😳', text: 'tara *Sugam Pokhrel* / Heidelberg aaudai chha?!' }],
      EVENTPAGE('Get tickets → *done.*'),
      ['emoji', 1.9, { emoji: '🕺', text: 'Dashain *sorted.*' }],
      OUT('10 October — *bhetaula!*'),
    ], C('POV: yo barsa pani Dashain ma ghar jana paina 😭 tara Sugam Pokhrel Heidelberg aaudai chha?! 😳 Dashain sorted 🕺')),

    ad('dh-04-paper-family', 'dashain', 'paper', 'family', L('#c2410c', '#f59e0b', '#fff', 0), [
      ['words', 2.8, { text: 'Pura *parivar* / sangai aaunus.', sub: 'Bring the whole family.' }],
      ['collage', 3.0, { items: ['topi', 'kite', 'selroti', 'momo', 'madal', 'diyo'], text: 'Gaana. Khana. / *Naach.*', sub: 'Live music · Dinner · Dance' }],
      ['list', 3.0, { title: 'Ek order ma / *8 ticket samma.*', items: ['Aama, Buba, Didi, Bhai…', 'PayPal wa bank transfer', 'QR ticket email ma'], sub: 'Up to 8 tickets in one order.' }],
      OUT('Dashain, *parivar sanga.*'),
    ], C('Pura parivar sangai aaunus 👨‍👩‍👧‍👦 Gaana, khana, naach — ek order ma 8 ticket samma.')),

    ad('dh-05-swiss-numbers', 'dashain', 'swiss', 'facts', L('#dc143c', '#1d3fbf', '#fff', 0), [
      ['words', 2.0, { text: 'Number ma / *Dashain Night:*', sub: 'The show in numbers' }],
      ['reason', 2.3, { n: '10.10', title: 'Shanibar', sub: 'Rohrbacher Kulturhaus, Heidelberg', art: 'kite' }],
      ['reason', 2.3, { n: '2', title: 'Sugam Pokhrel & Bajagaja', sub: 'Live — ek manch ma', art: 'mic' }],
      ['reason', 2.3, { n: '€50', title: 'Phase 2 ticket', sub: 'Early bird already sold out', art: 'ticket' }],
      ['reason', 2.3, { n: '8', title: 'Ticket, ek order ma', sub: 'Saathi ra parivar sabai', art: 'topi' }],
      OUT('Number *pugyo?*'),
    ], C('Number ma Dashain Night: 10.10 · 2 (Sugam Pokhrel & Bajagaja) · €50 Phase 2 · 8 ticket ek order ma.')),

    ad('dh-06-neon-night', 'dashain', 'neon', 'concert', L('#ff2e97', '#22d3ee', '#fff', -2), [
      ['words', 2.4, { text: 'Ek raat. / *Sugam Pokhrel.*', sub: 'One night. Live.' }],
      ['poster', 2.8, { text: 'Bajagaja *live* / Heidelberg ma.', sub: 'Dashain & Tihar Festival' }],
      ['countdown', 2.4, { n: '10.10', label: 'SHANIBAR', sub: 'Rohrbacher Kulturhaus' }],
      ['scan', 2.8, { sub: 'QR phone ma — *door ma scan.*' }],
      OUT('Raat *tapai ko.*'),
    ], C('Ek raat. Sugam Pokhrel. Bajagaja live 🌙 10.10 · Rohrbacher Kulturhaus, Heidelberg.')),

    ad('dh-07-pov-student', 'dashain', 'pov', 'deal', L('#ff2d55', '#25f4ee', '#fff', 5), [
      ['emoji', 2.5, { emoji: '🎓', text: 'POV: student ho, / budget *tight* 😅' }],
      ['stat', 2.4, { value: 5, prefix: '€', label: 'student voucher', sub: 'Valid student ID dekhaunus.' }],
      ['words', 2.4, { text: 'FSJ, BFD, Au Pair? / *€15 discount.*', sub: 'Show your proof at the door.' }],
      CHECKOUT,
      OUT('Student ho? *Aaunus!*'),
    ], C('Student ho? 🎓 Valid ID dekhaunus — €5 voucher. FSJ, BFD, Au Pair? €15 discount (proof chahincha).')),

    ad('dh-08-blob-cause', 'dashain', 'blob', 'cause', L('#e11d48', '#fb7185', '#fff', 2), [
      ['words', 2.5, { text: 'Tapai ko ticket le / *Nepal* lai help.', sub: 'Your ticket helps Nepal.' }],
      ['photo', 3.2, { img: 'erste-hilfe-nrna-cup__pitchside-treatment', text: 'First aid *training* / Nepal ma.', sub: 'NPJOE\'s National First Aid Campaign' }],
      ['stat', 2.4, { value: 1450, suffix: '+', label: 'students trained', sub: '68 teachers now train others.' }],
      ['words', 2.2, { text: 'Naachnus, *gaaunus* — / ramro kaam pani.', sub: 'Dance, sing — and do good.' }],
      OUT('Ticket = *seva.*'),
    ], C('Tapai ko ticket le Nepal ma first-aid training lai support garchha ❤️ NPJOE: 1,450+ students trained, 68 teachers as trainers.')),

    ad('dh-09-swiss-howto', 'dashain', 'swiss', 'how-to', L('#1d3fbf', '#dc143c', '#fff', 2), [
      ['words', 2.0, { text: 'Ticket *kasari?*', sub: 'How to get your ticket' }],
      ['steps', 4.0, { title: '3 step.', items: [['Kholnus', 'martnepali.com → Dashain'], ['Rojnus', 'Phase 2 · €50 · 8 samma'], ['Tirnus', 'PayPal wa bank transfer']] }],
      CHECKOUT,
      ['list', 2.8, { title: 'Ani?', items: ['QR ticket email ma', 'Door ma scan', 'Dashain enjoy!'], sub: 'That\'s it.' }],
      OUT('Sajilo, *sidhai.*'),
    ], C('Ticket kasari? 1 martnepali.com kholnus 2 Phase 2 rojnus 3 PayPal wa bank ma tirnus → QR ticket email ma ✅')),

    ad('dh-10-kinetic-fomo', 'dashain', 'kinetic', 'fomo', L('#f59e0b', '#ffffff', '#111', 5), [
      ['burst', null, { words: ['EARLY BIRD.', 'SOLD OUT.', 'STANDARD.', 'SOLD OUT.', 'PHASE 2.', '€50.'], beats: 1.4 }],
      ['tiers', 3.2, { sub: 'Phase 2 abhai *paincha.*' }],
      ['words', 2.0, { text: 'Ahile *kinnus.*', sub: 'Get yours now.' }],
      OUT('Pachi *pachutau.*'),
    ], C('EARLY BIRD: SOLD OUT. STANDARD: SOLD OUT. PHASE 2: €50 — abhai paincha 🔥 Ahile kinnus.')),

    ad('dh-11-pov-groupchat', 'dashain', 'pov', 'friends', L('#ff2d55', '#25f4ee', '#fff', 0), [
      ['chat', 3.9, { title: 'Dashain Squad 🎉', msgs: ['Yo Dashain k plan?', 'Sugam Pokhrel aaudai chha Heidelberg!!', 'Sachchai?? 😳', '10 October, Shanibar', 'Ticket kaha?', 'martnepali.com ma 🔥', '8 jana samma ek order ma', 'Book gardim? 🙋'], badge: 12 }],
      ['emoji', 1.9, { emoji: '✅', text: 'Squad *sorted.*' }],
      EVENTPAGE('Ek jana le book — *sabai lai QR.*'),
      OUT('Squad lai *tag garnus.*'),
    ], C('Group chat ma "Yo Dashain k plan?" 👀 Sugam Pokhrel Heidelberg aaudai chha! Ek order ma 8 ticket samma — squad lai tag garnus 👇')),

    ad('dh-12-blob-venue', 'dashain', 'blob', 'venue', L('#2563eb', '#60a5fa', '#fff', -2), [
      ['words', 2.2, { text: 'Kaha? / *Heidelberg.*', sub: 'Where?' }],
      ['venue', 3.4, { name: 'Rohrbacher Kulturhaus', addr: 'Marie-Clauss-Straße 15', city: '69126 Heidelberg', text: 'Shanibar, *10 October*' }],
      ['poster', 2.8, { text: 'Sugam Pokhrel / & *Bajagaja.*', sub: 'Live music · Dinner · Dance' }],
      OUT('Heidelberg, *tayar?*'),
    ], C('Kaha? Rohrbacher Kulturhaus, Marie-Clauss-Straße 15, 69126 Heidelberg 📍 Shanibar, 10 October.')),

    ad('dh-13-paper-outfit', 'dashain', 'paper', 'funny', L('#c2410c', '#65a30d', '#fff', 0), [
      ['words', 2.4, { text: 'Dashain *checklist:*', sub: 'Before Saturday…' }],
      ['list', 3.6, { title: 'Ready?', items: ['Daura suruwal / sari', 'Tika ra jamara', 'Saathi ra parivar', 'Ticket?'], marks: ['✓', '✓', '✓', '✗'], sub: 'Uh-oh.' }],
      ['words', 2.2, { text: 'Ticket ✗ → / *martnepali.com*', sub: 'Fix it in a minute.' }],
      EVENTPAGE('Ticket ✓ — *ab sab ready.*'),
      OUT('Sab *ready.*'),
    ], C('Dashain checklist: daura suruwal / sari ✓ tika ra jamara ✓ saathi ra parivar ✓ ticket? ✗ → martnepali.com 😅')),

    ad('dh-14-kinetic-myth', 'dashain', 'kinetic', 'myth-busting', L('#2563eb', '#ffffff', '#fff', 2), [
      ['qa', 2.5, { q: 'Ticket kinna / *card chahincha?*', a: 'HOINA.' }],
      ['burst', null, { words: ['PAYPAL.', 'BANK.', 'QR.', 'DONE.'] }],
      ['qa', 2.5, { q: 'Account / *banaunu parchha?*', a: 'HOINA.' }],
      CHECKOUT,
      OUT('Simple. *Sidhai.*'),
    ], C('Ticket kinna card chahincha? HOINA ❌ Account banaunu parchha? HOINA ❌ PayPal wa bank → QR ticket email ma ✅')),

    ad('dh-15-swiss-organizer', 'dashain', 'swiss', 'trust', L('#dc143c', '#0b0b14', '#fff', -3), [
      ['words', 2.1, { text: 'Ko le *gardai* / chha?', sub: 'Who\'s behind the show?' }],
      ['presenters', 3.4, { orgs: [['logo-npjoe', 'NPJOE e.V.', 'Nepalesische Progressive Jugendorganisation · Darmstadt'], ['logo-neg', 'Nepali Events Germany', 'in cooperation']] }],
      ['photo', 3.2, { img: 'erste-hilfe-nrna-cup__team-and-stand', text: 'Nepal ko lagi / *first aid.*', sub: 'The show supports first-aid training in Nepal.' }],
      OUT('Community le, *community ko lagi.*'),
    ], C('Ko le gardai chha? NPJOE e.V. (Darmstadt) ra Nepali Events Germany 🤝 Show le Nepal ma first-aid training lai support garchha.')),

    ad('dh-16-paper-greeting', 'dashain', 'paper', 'greeting', L('#c2410c', '#dc143c', '#fff', 0), [
      ['words', 3.0, { text: 'Bijaya Dashami ko / *hardik shubhakamana.*', sub: 'Happy Dashain to you and your family.' }],
      ['collage', 3.0, { items: ['kite', 'diyo', 'selroti', 'topi', 'madal', 'momo'], text: 'Dashain *&* Tihar', sub: 'Festival · Heidelberg' }],
      ['words', 2.6, { text: '10 October — / *sangai manau.*', sub: 'Let\'s celebrate together.' }],
      OUT('Shubha *Dashain.*'),
    ], C('Bijaya Dashami ko hardik shubhakamana 🪁🪔 10 October — Heidelberg ma sangai manau.')),

    ad('dh-17-cinema-memory', 'dashain', 'cinema', 'nostalgic', L('#e11d48', '#fda4af', '#fff', -5), [
      ['words', 3.2, { text: 'Kehi raat… / *sadhai* yaad rahanchhan.', sub: 'Some nights stay with you forever.' }],
      ['photo', 3.4, { img: 'naya-barsha-2026__band-with-team', text: 'Live gaana. / *Afnai* manchhe.', sub: 'Live music. Your people.' }],
      ['lineup', 3.2, { names: ['Sugam Pokhrel', '& Bajagaja', 'Heidelberg'], sub: 'Sat 10 October' }],
      OUT('Yo raat, *yaad rakhnus.*'),
    ], C('Kehi raat sadhai yaad rahanchhan ✨ Sugam Pokhrel & Bajagaja, live — Heidelberg, 10 October.')),

    ad('dh-18-neon-tag', 'dashain', 'neon', 'engagement', L('#ff2e97', '#fbbf24', '#fff', 3), [
      ['emoji', 2.5, { emoji: '💃', text: 'Tag garnus — / jo sanga *naachne.*' }],
      ['poster', 2.8, { text: 'Sugam Pokhrel / *live.*', sub: 'Dashain & Tihar Festival' }],
      ['emoji', 2.2, { emoji: '🕺', text: 'Ani jo le *ticket* / kinna parchha 😏' }],
      OUT('Tag. *Book.* Naach.'),
    ], C('Tag garnus 👇 jo sanga Sugam Pokhrel ko gaana ma naachne 💃🕺 (ani jo le ticket kinna parchha 😏)')),

    ad('dh-19-kinetic-1week', 'dashain', 'kinetic', 'countdown', L('#e11d48', '#ffffff', '#fff', 0), [
      ['countdown', 2.8, { n: '1', label: 'HAPTA BAAKI', sub: 'One week to go' }],
      ['burst', null, { words: ['SUGAM', 'POKHREL.', 'BAJAGAJA.', 'HEIDELBERG.'] }],
      ['tiers', 3.0, { sub: 'Phase 2 — *€50.*' }],
      OUT('Ek hapta. *Tayar?*'),
    ], C('1 HAPTA BAAKI ⏳ Sugam Pokhrel & Bajagaja · Heidelberg · Sat 10 Oct. Phase 2 ticket — €50.')),

    ad('dh-20-neon-3days', 'dashain', 'neon', 'countdown', L('#22d3ee', '#ff2e97', '#111', -2), [
      ['countdown', 2.8, { n: '3', label: 'DIN BAAKI', sub: '3 days to go' }],
      ['lineup', 3.0, { names: ['Sugam Pokhrel', '& Bajagaja', 'LIVE'], sub: 'Rohrbacher Kulturhaus' }],
      ['words', 2.2, { text: 'Ticket *liyau?*', sub: 'Got your ticket yet?' }],
      OUT('3 din. *Last call.*'),
    ], C('3 DIN BAAKI 🔥 Sugam Pokhrel & Bajagaja live — Rohrbacher Kulturhaus, Heidelberg. Ticket liyau?')),

    ad('dh-21-pov-bholi', 'dashain', 'pov', 'countdown', L('#ff2d55', '#25f4ee', '#fff', 2), [
      ['countdown', 2.6, { n: 'BHOLI!', label: 'Dashain Night', sub: 'Tomorrow!' }],
      ['emoji', 2.2, { emoji: '👗', text: 'Outfit ready? / *Tika* ready?' }],
      ['ticket', 3.0, {}],
      ['emoji', 1.8, { emoji: '😎', text: 'Bhetaula *bholi!*' }],
      OUT('Bholi — *Heidelberg!*'),
    ], C('BHOLI! 🎉 Outfit ready? Tika ready? QR ticket ready? Bhetaula Heidelberg ma 😎')),

    ad('dh-22-kinetic-aaja', 'dashain', 'kinetic', 'countdown', L('#dc143c', '#ffffff', '#fff', 0), [
      ['burst', null, { words: ['AAJA.', 'AAJA.', 'AAJA!'], beats: 1.5 }],
      ['words', 2.2, { text: 'Dashain Night — / *aaja.*', sub: 'Tonight. Heidelberg.' }],
      ['venue', 3.2, { name: 'Rohrbacher Kulturhaus', addr: 'Marie-Clauss-Straße 15', city: '69126 Heidelberg', text: 'Aaja, *Heidelberg.*' }],
      ['ticket', 2.8, {}],
      OUT('Door ma *QR dekhaunus.*'),
    ], C('AAJA! 🔥 Dashain Night — Rohrbacher Kulturhaus, Heidelberg. Door ma QR dekhaunus. Ticket: martnepali.com')),

    // The setlist medley: 5 s per song on a 5-second grid, NO audio — the
    // music clips are added later on a phone. Intro 0–5, song n at 5n–5n+5,
    // jam 90–95, ending 95–100.
    ad('dh-medley-setlist', 'dashain', 'neon', 'setlist', L('#ff2e97', '#22d3ee', '#fff', 0), [
      ['lineup', 5, { names: ['Sugam Pokhrel', '& Bajagaja', 'LIVE'], sub: 'Setlist · Heidelberg · 10.10' }],
      ['song', 5, { n: 1, of: 18, title: 'Pheri Tyo Din' }],
      ['song', 5, { n: 2, of: 18, title: 'Sambhalincha Kahile Maan' }],
      ['song', 5, { n: 3, of: 18, title: 'Timi Ma Bhanda' }],
      ['song', 5, { n: 4, of: 18, title: 'Ma Yasto Geet Gaunchhu' }],
      ['song', 5, { n: 5, of: 18, title: 'Mero Euta Saathi Chha' }],
      ['song', 5, { n: 6, of: 18, title: 'Jhike' }],
      ['song', 5, { n: 7, of: 18, title: 'Dashain' }],
      ['song', 5, { n: 8, of: 18, title: 'Mayale Boleko' }],
      ['song', 5, { n: 9, of: 18, title: 'Maya Ko Bato' }],
      ['song', 5, { n: 10, of: 18, title: 'Bhanchhu Aaja' }],
      ['song', 5, { n: 11, of: 18, title: 'Jadai Chhu Tadha' }],
      ['song', 5, { n: 12, of: 18, title: 'Hitai Ko Maya' }],
      ['song', 5, { n: 13, of: 18, title: 'Timi Royeko Pal' }],
      ['song', 5, { n: 14, of: 18, title: 'Maan Ko Dailo' }],
      ['song', 5, { n: 15, of: 18, title: 'Mero Sansar' }],
      ['song', 5, { n: 16, of: 18, title: 'Sacheko Maya' }],
      ['song', 5, { n: 17, of: 18, title: "She's the Bomb" }],
      ['song', 5, { n: 18, of: 18, title: 'Jamming', sub: 'Jam up! 🔥', big: 'JAM', label: 'GRAND FINALE' }],
      ['evout', 5, { tag: 'Live ma sunnus — *10.10.*' }],
    ], C('Sugam Pokhrel & Bajagaja — setlist preview 🎶 Sabai gaana live sunnus, Heidelberg ma, 10 October!')),
  ];
  for (const a of ADS) { a.set = 'dashain'; a.qrUrl = EVENT_URL; }
  S.register(ADS);
  if (typeof module !== 'undefined') module.exports = ADS;
})(typeof window !== 'undefined' ? window : globalThis);
