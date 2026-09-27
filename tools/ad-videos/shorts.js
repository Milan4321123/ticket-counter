// The five 15-second shorts for the Dashain Heidelberg event: a hook that
// sells the night, then one way of getting the ticket on MartNepali, then
// DON'T · MISS · OUT!. shorts.html draws them (?v=1…5), synth-shorts.mjs
// scores them. Times are seconds; phone coordinates are the 390×844 viewport.
(function (root) {
  const BPM = 112, BEAT = 60 / BPM, G0 = 0.35;
  const beat = (b) => G0 + b * BEAT;
  const COMMON = {
    TOTAL: 15, FPS: 30, BPM, BEAT, G0, beat,
    ctaStart: 11.8,
    ctaSlams: [beat(22), beat(23), beat(24)], // DON'T · MISS · OUT! (the drop, bar 6)
    finalHit: beat(26),
  };

  // Where things are on the captured pages (see out/dashain/shots.json).
  const P = {
    card: [97, 330],                 // home: the Dashain card
    getTickets: [91, 588],           // event page (page y)
    yes: [195, 596],                 // city check: "Yes, Heidelberg is right"
    plus0: [322, 487],               // checkout, before the basket note appears
    plus: [322, 575],                // checkout, after
    reserve: [195, 3031],            // checkout: "Reserve tickets"
  };
  const RES = 2437;                  // scroll that puts Reserve mid-screen

  // The usual path from the event page to the ticket, starting at t.
  // skipCity cuts straight from "Get tickets" to the ticket list (the
  // Heidelberg-or-Lisbon check is shown in short 1 only).
  function buy(t, { skipCity = false } = {}) {
    const flow = [], taps = [];
    let x = t;
    flow.push({ from: x, shot: 'event', s0: 0, s1: 120, a: x + 0.1, b: x + 0.6, hdr: true });
    taps.push([x + 0.95, P.getTickets[0], P.getTickets[1] - 120]);
    x += 1.2;
    if (!skipCity) {
      flow.push({ from: x, shot: 'city' });
      taps.push([x + 0.7, ...P.yes]);
      x += 0.95;
    }
    return { flow, taps, x };
  }

  const V = {};

  // 1 · The direct link.
  {
    const phone = 3.35;
    const b = buy(phone);
    let x = b.x;
    const flow = [...b.flow,
      { from: x, shot: 'ck0', s0: 180, s1: 180, hdr: true },
      { from: x + 0.6, shot: 'ck1', s0: 180, s1: 180, hdr: true },
      { from: x + 1.1, shot: 'ck2', s0: 180, s1: 180, hdr: true },
      { from: x + 1.4, shot: 'ck3', s0: 180, s1: RES, a: x + 1.45, b: x + 2.9, hdr: true }];
    const taps = [[3.2, 540, 1560, 'stage'], ...b.taps, [x + 0.5, P.plus0[0], P.plus0[1] - 180], [x + 1.0, P.plus[0], P.plus[1] - 180], [x + 3.3, P.reserve[0], P.reserve[1] - RES]];
    V[1] = {
      slug: 'link', name: 'The direct link', transpose: 0, phone, flow, taps, ticketAt: x + 3.6, tickets: 2,
      steps: [[phone, 'Tap the link'], [phone + 1.2, 'Heidelberg? Yes!'], [x, 'Pick your tickets'], [x + 1.4, 'Reserve — PayPal or bank'], [x + 3.6, 'Your QR ticket, by email']],
      pops: [0.8, 1.3, 1.6, 2.4],
    };
  }

  // 2 · Type martnepali.com.
  {
    const phone = 3.0, typeA = 3.8, typeB = 4.8, load = 4.95, home = 5.35;
    const b = buy(home + 0.75, { skipCity: true });
    let x = b.x;
    const flow = [
      { from: phone, shot: 'browser' },
      { from: home, shot: 'home' },
      ...b.flow,
      { from: x, shot: 'ck0', s0: 180, s1: 180, hdr: true },
      { from: x + 0.5, shot: 'ck1', s0: 180, s1: 180, hdr: true },
      { from: x + 0.9, shot: 'ck2', s0: 180, s1: 180, hdr: true },
      { from: x + 1.1, shot: 'ck3', s0: 180, s1: RES, a: x + 1.15, b: x + 2.0, hdr: true }];
    const taps = [[3.55, 195, 790], [home + 0.55, ...P.card], ...b.taps, [x + 0.4, P.plus0[0], P.plus0[1] - 180], [x + 0.8, P.plus[0], P.plus[1] - 180], [x + 2.3, P.reserve[0], P.reserve[1] - RES]];
    V[2] = {
      slug: 'type-it', name: 'Just type martnepali.com', transpose: 2, phone, flow, taps, ticketAt: x + 2.55, tickets: 2,
      typing: { text: 'martnepali.com', a: typeA, b: typeB, load },
      steps: [[phone, 'Type martnepali.com'], [home, 'Tap the Dashain event'], [home + 0.75, 'Get tickets'], [x, 'Pick & reserve'], [x + 2.55, 'Your QR ticket, by email']],
      pops: [0.2, 0.7, 1.2, 1.7, 2.2],
    };
  }

  // 3 · Scan the poster.
  {
    const phone = 2.4, lock = 3.4, banner = 3.8, open = 4.45;
    const b = buy(open + 0.2, { skipCity: true });
    let x = b.x;
    const flow = [
      { from: phone, shot: 'camera' },
      ...b.flow,
      { from: x, shot: 'ck0', s0: 180, s1: 180, hdr: true },
      { from: x + 0.5, shot: 'ck1', s0: 180, s1: 180, hdr: true },
      { from: x + 0.9, shot: 'ck2', s0: 180, s1: 180, hdr: true },
      { from: x + 1.2, shot: 'ck3', s0: 180, s1: RES, a: x + 1.25, b: x + 2.5, hdr: true }];
    const taps = [[open, 195, 118], ...b.taps, [x + 0.4, P.plus0[0], P.plus0[1] - 180], [x + 0.8, P.plus[0], P.plus[1] - 180], [x + 2.85, P.reserve[0], P.reserve[1] - RES]];
    V[3] = {
      slug: 'scan', name: 'Scan the poster', transpose: -2, phone, flow, taps, ticketAt: x + 3.1, tickets: 2,
      camera: { lock, banner },
      steps: [[phone, 'Point your camera'], [open + 0.2, 'Get tickets'], [x, 'Pick your tickets'], [x + 1.2, 'Reserve — PayPal or bank'], [x + 3.1, 'Your QR ticket, by email']],
      pops: [0.3, 1.2],
    };
  }

  // 4 · Bring the family: four tickets in one order.
  {
    const phone = 3.3, t0 = 4.0;
    const flow = [
      { from: phone, shot: 'ck0', s0: 180, s1: 180, hdr: true },
      { from: t0 + 0.1, shot: 'ck1', s0: 180, s1: 180, hdr: true },
      { from: t0 + 0.6, shot: 'ck2', s0: 180, s1: 180, hdr: true },
      { from: t0 + 1.1, shot: 'q3', s0: 180, s1: 180, hdr: true },
      { from: t0 + 1.6, shot: 'q4', s0: 180, s1: 600, a: t0 + 1.9, b: t0 + 2.6, hdr: true },
      { from: t0 + 3.3, shot: 'q4', s0: 600, s1: RES, a: t0 + 3.3, b: t0 + 4.3, hdr: true }];
    const taps = [[t0, P.plus0[0], P.plus0[1] - 180], [t0 + 0.5, P.plus[0], P.plus[1] - 180], [t0 + 1.0, P.plus[0], P.plus[1] - 180], [t0 + 1.5, P.plus[0], P.plus[1] - 180], [t0 + 4.7, P.reserve[0], P.reserve[1] - RES]];
    V[4] = {
      slug: 'family', name: 'Bring the family', transpose: 3, phone, flow, taps, ticketAt: t0 + 5.0, tickets: 4,
      callout: { at: t0 + 2.4, until: t0 + 3.3, text: '4 tickets · €200 — one order' },
      steps: [[phone, 'Tap + for everyone'], [t0 + 1.9, 'Up to 8 per order'], [t0 + 3.3, 'Reserve once'], [t0 + 5.0, '4 QR tickets, by email']],
      pops: [0.9, 1.5, 2.2],
    };
  }

  // 5 · No card, no fees: how paying works.
  {
    const phone = 3.3;
    const flow = [{ from: phone, shot: 'ck3', s0: 2150, s1: RES, a: 3.8, b: 8.6, hdr: true }];
    const taps = [[9.1, P.reserve[0], P.reserve[1] - RES]];  // after the notes clear (8.6)
    V[5] = {
      slug: 'no-card', name: 'No card, no fees', transpose: -3, phone, flow, taps, ticketAt: 9.4, tickets: 2,
      notes: [
        [4.0, '💳', 'No card number — ever', -1, 640],
        [5.0, '🏦', 'Pay by PayPal or bank transfer', 1, 850],
        [6.0, '🤝', 'The money goes straight to the organizer', -1, 1060],
        [7.0, '📧', 'Your QR ticket comes by email', 1, 1270],
      ],
      steps: [[phone, 'How paying works'], [8.7, 'Reserve in one tap'], [9.4, 'Your QR ticket, by email']],
      pops: [0.6, 1.0, 1.4, 2.4],
    };
  }

  const SHORTS = { ...COMMON, V, P, RES };
  if (typeof module !== 'undefined') module.exports = SHORTS;
  else root.SHORTS = SHORTS;
})(typeof window !== 'undefined' ? window : globalThis);
