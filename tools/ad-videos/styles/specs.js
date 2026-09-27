// The five styled 15-second shorts for the Dashain Heidelberg event — each a
// different look, a different kind of music and a different way to the
// ticket. styles/<id>.html draws one, synth-styles.mjs scores it; both read
// the times here. Phone coordinates are the 390×844 screen.
(function (root) {
  const P = { card: [97, 330], getTickets: [91, 588], yes: [195, 596], plus0: [322, 487], plus: [322, 575], reserve: [195, 3031] };
  const RES = 2437;

  /** Event page → Get tickets (→ city check) → + (, +) → scroll to Reserve → tap. */
  function buyFlow(t, { city = false, speed = 1, plus = 2 } = {}) {
    const d = (x) => x * speed;
    const flow = [], taps = [];
    let x = t;
    flow.push({ from: x, shot: 'event', s0: 0, s1: 120, a: x + d(0.1), b: x + d(0.6), hdr: true });
    taps.push([x + d(0.95), P.getTickets[0], P.getTickets[1] - 120]);
    x += d(1.2);
    if (city) { flow.push({ from: x, shot: 'city' }); taps.push([x + d(0.7), ...P.yes]); x += d(0.95); }
    const pick = x;
    flow.push({ from: x, shot: 'ck0', s0: 180, s1: 180, hdr: true });
    taps.push([x + d(0.4), P.plus0[0], P.plus0[1] - 180]);
    flow.push({ from: x + d(0.5), shot: 'ck1', s0: 180, s1: 180, hdr: true });
    if (plus >= 2) { taps.push([x + d(0.8), P.plus[0], P.plus[1] - 180]); flow.push({ from: x + d(0.9), shot: 'ck2', s0: 180, s1: 180, hdr: true }); }
    const sc = x + d(1.15);
    flow.push({ from: sc, shot: 'ck3', s0: 180, s1: RES, a: sc + d(0.05), b: sc + d(1.0), hdr: true });
    taps.push([sc + d(1.3), P.reserve[0], P.reserve[1] - RES]);
    return { flow, taps, marks: { event: t, getTickets: t + d(0.95), pick, scroll: sc, reserve: sc + d(1.3), done: sc + d(1.55) } };
  }
  const grid = (BPM, G0) => { const B = 60 / BPM; return { B, beat: (b) => G0 + b * B }; };

  const S = {};

  // 1 · HYPE — black & white kinetic type, trap at 140. The direct link.
  {
    const BPM = 140, G0 = 0.43, { B, beat } = grid(BPM, G0);
    const phone = beat(9.5);
    const bf = buyFlow(phone, { speed: 0.8 });
    S.hype = {
      id: 'hype', title: 'Hype', TOTAL: 15, BPM, G0, B, beat,
      words: [[beat(0), '10.10'], [beat(1), 'HEIDELBERG'], [beat(2), 'SUGAM<br>POKHREL'], [beat(3), '& BAJAGAJA'], [beat(4), 'LIVE.'], [beat(5), 'DINNER.'], [beat(6), 'DANCE.'], [beat(7), 'DASHAIN.']],
      linkAt: beat(8), linkTap: beat(9),
      phone, flow: bf.flow, taps: bf.taps, marks: bf.marks,
      captions: [[phone, 'OPEN THE LINK'], [bf.marks.pick, 'PICK 2'], [bf.marks.scroll, 'RESERVE'], [bf.marks.done, 'DONE.']],
      ticketAt: bf.marks.done + 0.05,
      urgency: [beat(20), beat(22)],
      slams: [beat(24), beat(25), beat(26)],
      endCard: beat(28), finalHit: beat(32),
    };
  }

  // 2 · WARM — cream paper, marigolds, NPJOE's photos; Nepali folk in 6/8. Four tickets.
  {
    // 6/8: the grid unit is the eighth note (0.2 s); a bar is 6 of them.
    const E = 0.2, G0 = 0.2, beat = (b) => G0 + b * E;
    const phone = 5.6, t0 = 6.1;
    const flow = [
      { from: phone, shot: 'ck0', s0: 180, s1: 180, hdr: true },
      { from: t0 + 0.1, shot: 'ck1', s0: 180, s1: 180, hdr: true },
      { from: t0 + 0.55, shot: 'ck2', s0: 180, s1: 180, hdr: true },
      { from: t0 + 1.0, shot: 'q3', s0: 180, s1: 180, hdr: true },
      { from: t0 + 1.45, shot: 'q4', s0: 180, s1: 600, a: t0 + 1.7, b: t0 + 2.3, hdr: true },
      { from: t0 + 2.9, shot: 'q4', s0: 600, s1: RES, a: t0 + 2.9, b: t0 + 3.6, hdr: true }];
    const taps = [[t0, P.plus0[0], P.plus0[1] - 180], [t0 + 0.45, P.plus[0], P.plus[1] - 180], [t0 + 0.9, P.plus[0], P.plus[1] - 180], [t0 + 1.35, P.plus[0], P.plus[1] - 180], [t0 + 3.9, P.reserve[0], P.reserve[1] - RES]];
    S.warm = {
      id: 'warm', title: 'Warm family', TOTAL: 15, BPM: 300, G0, B: E, beat, meter: 6,
      phone, flow, taps, ticketAt: t0 + 4.15, tickets: 4,
      notes: [[phone, 'Tap + for everyone'], [t0 + 1.7, 'Up to 8 tickets, one order'], [t0 + 2.9, 'Reserve once']],
      total: { at: t0 + 2.0, until: t0 + 2.9 },
      invite: 3.4, cta: 11.6, finalHit: beat(72),
    };
  }

  // 3 · POV — a full-screen phone, TikTok captions, hand-drawn circles; lo-fi at 84.
  {
    // The beat grid puts a bar line on the drop (when the phone comes up).
    const BPM = 84, G0 = 3.4 - 5 * (60 / 84), { B, beat } = grid(BPM, G0);
    const phone = 3.4, typeA = 3.75, typeB = 4.75, load = 4.85, home = 5.25;
    const bf = buyFlow(home + 0.95, {});
    const flow = [{ from: phone, shot: 'browser' }, { from: home, shot: 'home' }, ...bf.flow];
    const taps = [[phone + 0.2, 195, 91], [home + 0.75, ...P.card], ...bf.taps];
    const tapPt = (i) => [bf.taps[i][1], bf.taps[i][2]];
    S.pov = {
      id: 'pov', title: 'POV', TOTAL: 15, BPM, G0, B, beat,
      phone, flow, taps, typing: { text: 'martnepali.com', a: typeA, b: typeB, load }, addrStays: true,
      meme: 2.6, tapeStop: [2.6, 3.1],
      // Hand-drawn circles: [draw from, until, x, y, rx, ry].
      circles: [[home + 0.2, home + 0.95, ...P.card, 88, 125], [bf.marks.event + 0.5, bf.marks.getTickets + 0.2, ...tapPt(0), 86, 44], [bf.marks.pick + 0.02, bf.marks.pick + 0.42, ...tapPt(1), 40, 40], [bf.marks.scroll + 0.95, bf.marks.reserve + 0.2, ...tapPt(3), 170, 50]],
      captions: [
        [phone, 'just type martnepali.com'],
        [home, 'the Dashain one 👇'],
        [bf.marks.event + 0.3, 'get tickets'],
        [bf.marks.pick, '2 tickets ✔'],
        [bf.marks.scroll + 0.3, 'reserve — pay by PayPal or bank'],
        [bf.marks.done, 'done. see you there 🕺'],
      ],
      ticketAt: bf.marks.done, endCard: 12.0,
    };
  }

  // 4 · 3 REASONS — a white Swiss infographic, house at 124. Tickets in 4 steps.
  {
    const BPM = 124, G0 = 0.1, { B, beat } = grid(BPM, G0);
    const reasons = [beat(2), beat(5.5), beat(9)];    // 01 · 02 · 03
    const steps = beat(12.5);                          // "Tickets in 4 steps"
    const phone = steps + 0.2;
    const bf = buyFlow(phone + 0.25, { speed: 0.85 });
    S.reasons = {
      id: 'reasons', title: '3 reasons', TOTAL: 15, BPM, G0, B, beat,
      reasons, steps, phone, flow: [{ from: phone, shot: 'event', s0: 0, s1: 0, hdr: true }, ...bf.flow], taps: bf.taps, marks: bf.marks,
      ticks: [bf.marks.getTickets, bf.marks.scroll, bf.marks.reserve, bf.marks.done + 0.3],
      ticketAt: bf.marks.done, cta: beat(24), finalHit: beat(30),
    };
  }

  // 5 · NEON — synthwave night, neon Himalaya, flickering signs; 100 bpm. Scan the poster.
  {
    const BPM = 100, G0 = 0.3, { B, beat } = grid(BPM, G0);
    const phone = beat(6.5), lock = phone + 0.95, banner = lock + 0.4, open = banner + 0.6;
    const bf = buyFlow(open + 0.2, { speed: 0.85 });
    S.neon = {
      id: 'neon', title: 'Neon night', TOTAL: 15, BPM, G0, B, beat,
      signs: [beat(0.5), beat(1.25), beat(2)], billboard: beat(4),
      phone, flow: [{ from: phone, shot: 'camera' }, ...bf.flow], taps: [[open, 195, 118], ...bf.taps], camera: { lock, banner }, marks: bf.marks,
      ticketAt: bf.marks.done, cta: beat(19), finalHit: beat(24),
    };
  }

  const SPECS = { S, P, RES, buyFlow };
  if (typeof module !== 'undefined') module.exports = SPECS;
  else root.SPECS = SPECS;
})(typeof window !== 'undefined' ? window : globalThis);
