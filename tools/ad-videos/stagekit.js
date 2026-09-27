// Shared pieces for the styled shorts (styles/*.html): easing, word reveals,
// the phone (the real captured MartNepali screens, with taps, typing and the
// camera finding a QR), the ticket card and the page setup. Every style draws
// its own world around these; nothing here moves unless render(t) says so.
(function (root) {
  const K = {};
  K.$ = (s, r = document) => r.querySelector(s);
  K.$$ = (s, r = document) => [...r.querySelectorAll(s)];
  K.clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  K.lerp = (a, b, k) => a + (b - a) * k;
  K.prog = (t, a, b) => K.clamp((t - a) / (b - a));
  K.eOut = (k) => 1 - Math.pow(1 - k, 3);
  K.eOut5 = (k) => 1 - Math.pow(1 - k, 5);
  K.eIO = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
  K.eBack = (k) => { const c = 1.9; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };
  K.css = (el, o) => { for (const k in o) el.style[k] = o[k]; return el; };
  let seed = 11;
  K.rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  K.popIn = (el, t, at, from = 0.5, dur = 0.4) => {
    const k = K.prog(t, at, at + dur);
    el.style.opacity = K.clamp(k * 3);
    el.style.transform = `scale(${K.lerp(from, 1, K.eBack(k))})`;
    return k;
  };

  // ---- Words that rise out of their line (class rv, data-at = seconds) ----
  K.splitWords = (scope = document) => {
    for (const el of K.$$('.rv', scope)) {
      if (el._words) continue;
      const walk = (node) => {
        for (const child of [...node.childNodes]) {
          if (child.nodeType === 3) {
            const frag = document.createDocumentFragment();
            for (const p of child.textContent.split(/(\s+)/)) {
              if (!p) continue;
              if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(' ')); continue; }
              const w = document.createElement('span'); w.className = 'w';
              const inner = document.createElement('span'); inner.textContent = p;
              w.appendChild(inner); frag.appendChild(w);
            }
            node.replaceChild(frag, child);
          } else if (child.nodeType === 1 && !child.classList.contains('w')) {
            const w = document.createElement('span'); w.className = 'w';
            const inner = document.createElement('span');
            node.replaceChild(w, child); inner.appendChild(child); w.appendChild(inner);
          }
        }
      };
      walk(el);
      el._words = K.$$('.w > span', el);
      el._at = parseFloat(el.dataset.at || '0');
    }
  };
  K.reveal = (scope, t, dur = 0.45, stagger = 0.05) => {
    for (const el of K.$$('.rv', scope)) el._words.forEach((w, i) => {
      const k = K.eOut5(K.prog(t, el._at + i * stagger, el._at + i * stagger + dur));
      w.style.transform = `translateY(${(1 - k) * 110}%)`;
    });
  };
  // Word-by-word pop (for captions): each word scales in.
  K.popWords = (el, t, at, stagger = 0.08) => {
    if (!el._words) K.splitWords(el.parentElement);
    el._words.forEach((w, i) => {
      const k = K.prog(t, at + i * stagger, at + i * stagger + 0.25);
      w.style.opacity = K.clamp(k * 3);
      w.style.transform = `scale(${K.lerp(0.4, 1, K.eBack(k))})`;
    });
  };

  // ---- The phone ----
  const SHOTS = ['home', 'event', 'city-check', 'checkout-0', 'checkout-1', 'checkout-2', 'checkout-3', 'checkout-q3', 'checkout-q4'];
  const KEY = { 'city-check': 'city', 'checkout-0': 'ck0', 'checkout-1': 'ck1', 'checkout-2': 'ck2', 'checkout-3': 'ck3', 'checkout-q3': 'q3', 'checkout-q4': 'q4' };

  /**
   * A phone showing the captured screens. `width` is the screen's width in
   * page px; `look` is 'bezel' (a device), 'bare' (a rounded screen, no body)
   * or 'full' (the screen alone, square corners — for full-bleed shots).
   * `addrTop` puts the browser's address bar at the top (for full-bleed).
   */
  K.Phone = function (host, { width = 540, look = 'bezel', addrTop = false, base = '../out/dashain/' } = {}) {
    const s = width / 390;
    const pad = look === 'bezel' ? Math.round(width * 0.037) : 0;
    const el = document.createElement('div');
    el.className = 'kphone kphone-' + look;
    const radius = look === 'full' ? 0 : Math.round(width * 0.115);
    K.css(el, { position: 'absolute', width: width + pad * 2 + 'px', height: Math.round(844 * s) + pad * 2 + 'px', borderRadius: radius + pad + 'px', padding: pad + 'px' });
    el.innerHTML = `
      <div class="kp-screen" style="position:absolute;left:${pad}px;top:${pad}px;width:${width}px;height:${Math.round(844 * s)}px;border-radius:${radius}px;overflow:hidden;background:#0a0a12">
        <div class="kp-vp" style="position:absolute;left:0;top:0;width:390px;height:844px;transform-origin:0 0;transform:scale(${s});overflow:hidden">
          ${SHOTS.map((n) => `<img data-shot="${KEY[n] || n}" src="${base}shots/${n}.png" style="position:absolute;left:0;top:0;width:390px;display:none">`).join('')}
          <img class="kp-hdr" src="${base}shots/event-header.png" style="position:absolute;left:0;top:0;width:390px;display:none">
          <div class="kp-browser" style="position:absolute;inset:0;display:none;background:radial-gradient(500px 500px at 50% 35%,#1b1b2a,#0c0c14)">
            <div style="position:absolute;left:40px;top:${addrTop ? 230 : 150}px;font:700 17px/1 Inter,sans-serif;color:rgba(255,255,255,.5)">Favourites</div>
            <div style="position:absolute;left:40px;right:40px;top:${addrTop ? 270 : 190}px;display:grid;grid-template-columns:repeat(4,1fr);gap:22px">${'<span style="aspect-ratio:1;border-radius:16px;background:rgba(255,255,255,.07)"></span>'.repeat(8)}</div>
            <div class="kp-addr" style="position:absolute;left:14px;right:14px;top:${addrTop ? 64 : 764}px;height:54px;border-radius:18px;background:#2a2a34;box-shadow:0 8px 24px rgba(0,0,0,.4);display:flex;align-items:center;padding:0 18px;gap:8px;font:500 20px/1 Inter,sans-serif;color:#fff;overflow:hidden">
              <span class="kp-ph" style="color:rgba(255,255,255,.45)">Search or enter website</span><span class="kp-typed"></span><span class="kp-caret" style="width:2px;height:24px;background:#4f8cff"></span><span class="kp-bar" style="position:absolute;left:0;bottom:0;height:3px;background:#4f8cff;width:0"></span>
            </div>
          </div>
          <div class="kp-camera" style="position:absolute;inset:0;display:none;background:#1a1410;overflow:hidden">
            <div class="kp-scene" style="position:absolute;left:0;top:0;width:390px;height:844px">
              <img src="${base}media/poster-main.jpg" style="position:absolute;left:-230px;top:-140px;width:560px;height:793px;object-fit:cover">
              <div class="kp-sticker" style="position:absolute;left:112px;top:344px;width:166px;padding:9px;background:#fff;border-radius:14px;box-shadow:0 8px 20px rgba(0,0,0,.35)"><div style="font:800 15px/1 Inter,sans-serif;color:#dc143c;text-align:center;letter-spacing:.12em;margin-bottom:6px">TICKETS</div><div class="qr" style="width:148px;height:148px"></div></div>
            </div>
            ${[[70, 280, 'border-right:0;border-bottom:0;border-top-left-radius:18px'], [276, 280, 'border-left:0;border-bottom:0;border-top-right-radius:18px'], [70, 520, 'border-right:0;border-top:0;border-bottom-left-radius:18px'], [276, 520, 'border-left:0;border-top:0;border-bottom-right-radius:18px']].map(([x, y, b]) => `<div style="position:absolute;left:${x}px;top:${y}px;width:44px;height:44px;border:5px solid #fff;${b}"></div>`).join('')}
            <div class="kp-lock" style="position:absolute;border:4px solid #fbbf24;border-radius:16px;box-shadow:0 0 0 2000px rgba(0,0,0,.25);opacity:0"></div>
            <div class="kp-banner" style="position:absolute;left:14px;right:14px;top:64px;height:108px;border-radius:26px;background:rgba(40,40,48,.94);display:flex;align-items:center;gap:14px;padding:0 18px;font:600 18px/1.3 Inter,sans-serif;color:#fff;box-shadow:0 10px 30px rgba(0,0,0,.4);opacity:0">
              <i class="kp-icon" style="width:50px;height:50px;border-radius:14px;background:#fff;display:flex;align-items:center;justify-content:center;flex:none"></i><div><b style="display:block;font:700 19px/1.2 Inter,sans-serif">martnepali.com</b>Open “DashainEvent2026 — Tickets”</div>
            </div>
          </div>
          <div class="kp-finger" style="position:absolute;width:64px;height:64px;margin:-32px 0 0 -32px;border-radius:50%;background:rgba(255,255,255,.55);border:3px solid rgba(255,255,255,.9);box-shadow:0 6px 20px rgba(0,0,0,.35);z-index:60;opacity:0"></div>
          <div class="kp-ripple" style="position:absolute;width:64px;height:64px;margin:-32px 0 0 -32px;border-radius:50%;border:4px solid #fff;z-index:60;opacity:0"></div>
        </div>
      </div>
      ${look === 'bezel' ? `<div style="position:absolute;left:50%;top:${pad + 14 * s}px;width:${108 * s}px;height:${30 * s}px;margin-left:${-54 * s}px;border-radius:30px;background:#000;z-index:5"></div>` : ''}`;
    host.appendChild(el);
    this.el = el; this.scale = s; this.pad = pad; this.width = width;
    this.vp = K.$('.kp-vp', el);
  };
  /** Page coordinates (relative to the phone's host) of a point in the 390×844 screen. */
  K.Phone.prototype.at = function (x, y) {
    const left = parseFloat(this.el.style.left) || 0, top = parseFloat(this.el.style.top) || 0;
    return [left + this.pad + x * this.scale, top + this.pad + y * this.scale];
  };
  /**
   * Draws second t of a spec: { flow: [{from, shot, s0, s1, a, b, hdr}], taps:
   * [[t, x, y]], typing: {text, a, b, load}, camera: {lock, banner} }.
   */
  K.Phone.prototype.render = function (t, spec) {
    const $ = (s) => K.$(s, this.el);
    let f = spec.flow[0];
    for (const g of spec.flow) if (t >= g.from) f = g;
    const scroll = f.s0 === undefined ? 0 : K.lerp(f.s0, f.s1, f.a === undefined ? 0 : K.eIO(K.prog(t, f.a, f.b)));
    for (const img of K.$$('img[data-shot]', this.vp)) {
      const on = img.dataset.shot === f.shot;
      img.style.display = on ? 'block' : 'none';
      img.style.opacity = 1; img.style.filter = '';
      if (on) img.style.transform = `translateY(${-scroll}px)`;
    }
    if (f.shot === 'city') {
      const ev = $('img[data-shot="event"]');
      ev.style.display = 'block'; ev.style.transform = 'translateY(-120px)';
      ev.style.filter = `brightness(${1 - 0.7 * K.eOut(K.prog(t, f.from, f.from + 0.3))})`;
      const c = $('img[data-shot="city"]');
      c.style.opacity = K.eOut(K.prog(t, f.from, f.from + 0.3));
      c.style.transform = `translateY(${(1 - K.eOut5(K.prog(t, f.from, f.from + 0.45))) * 120}px)`;
    }
    $('.kp-hdr').style.display = f.hdr ? 'block' : 'none';

    const br = $('.kp-browser');
    br.style.display = f.shot === 'browser' ? 'block' : 'none';
    if (spec.typing && f.shot === 'browser') {
      const ty = spec.typing;
      const n = Math.round(ty.text.length * K.prog(t, ty.a, ty.b));
      $('.kp-typed').textContent = ty.text.slice(0, n);
      $('.kp-ph').style.display = t < ty.a - 0.25 ? 'inline' : 'none';
      $('.kp-caret').style.opacity = t > ty.a - 0.25 && t < ty.load && (n < ty.text.length || Math.floor(t * 3) % 2 === 0) ? 1 : 0;
      $('.kp-bar').style.width = K.eOut(K.prog(t, ty.load, ty.load + 0.4)) * 100 + '%';
      if (!spec.addrStays) $('.kp-addr').style.transform = `translateY(${-K.eOut5(K.prog(t, ty.a - 0.3, ty.a)) * 330}px)`;
    }
    const cam = $('.kp-camera');
    cam.style.display = f.shot === 'camera' ? 'block' : 'none';
    if (spec.camera && f.shot === 'camera') {
      const c = spec.camera;
      const settle = K.eOut(K.prog(t, f.from, c.lock));
      const shake = 1 - settle * 0.8;
      $('.kp-scene').style.transform = `translate(${Math.sin(t * 7) * 6 * shake + (1 - settle) * 60}px, ${Math.cos(t * 5.3) * 5 * shake + (1 - settle) * 40}px) scale(${K.lerp(1.25, 1, settle)})`;
      const lk = K.eOut5(K.prog(t, c.lock, c.lock + 0.3));
      K.css($('.kp-lock'), { opacity: String(lk), left: K.lerp(60, 118, lk) + 'px', top: K.lerp(270, 348, lk) + 'px', width: K.lerp(270, 156, lk) + 'px', height: K.lerp(300, 180, lk) + 'px' });
      const bk = K.eOut5(K.prog(t, c.banner, c.banner + 0.35));
      K.css($('.kp-banner'), { opacity: String(bk), transform: `translateY(${(1 - bk) * -140}px)` });
    }
    const fi = $('.kp-finger'), ri = $('.kp-ripple');
    let shown = false;
    for (const [at, x, y] of spec.taps || []) {
      if (t > at - 0.4 && t < at + 0.35) {
        const a = K.prog(t, at - 0.4, at - 0.18), press = t >= at - 0.05 && t < at + 0.12;
        K.css(fi, { left: x + 'px', top: y + 'px', opacity: String(a * (t > at + 0.2 ? 1 - K.prog(t, at + 0.2, at + 0.35) : 1)), transform: `scale(${press ? 0.8 : K.lerp(1.4, 1, K.eOut(a))})` });
        const rk = K.prog(t, at, at + 0.4);
        K.css(ri, { left: x + 'px', top: y + 'px', opacity: String(t >= at ? 1 - rk : 0), transform: `scale(${1 + rk * 1.8})` });
        shown = true;
      }
    }
    if (!shown) { fi.style.opacity = 0; ri.style.opacity = 0; }
    return f;
  };

  // ---- The ticket ----
  K.ticket = ({ label = 'YOUR TICKETS · 2×', theme = 'dark', qr = '', base = '../out/dashain/', note = 'Show the QR at the door. See you on 10 October!' } = {}) => {
    const T = {
      dark: { bg: '#14141f', fg: '#fff', dim: 'rgba(255,255,255,.72)', acc: '#fbbf24', hole: '#07091a', line: 'rgba(255,255,255,.18)' },
      paper: { bg: '#fffaf0', fg: '#2b1d12', dim: 'rgba(43,29,18,.7)', acc: '#c2410c', hole: '#f3e6cf', line: 'rgba(43,29,18,.25)' },
      light: { bg: '#ffffff', fg: '#0b0b14', dim: 'rgba(11,11,20,.65)', acc: '#dc143c', hole: '#f4f4f8', line: 'rgba(11,11,20,.18)' },
      neon: { bg: '#0d0620', fg: '#fff', dim: 'rgba(255,255,255,.75)', acc: '#22d3ee', hole: '#05020f', line: 'rgba(236,72,153,.5)' },
    }[theme];
    const el = document.createElement('div');
    el.className = 'kticket';
    K.css(el, { position: 'absolute', width: '640px', borderRadius: '40px', overflow: 'hidden', background: T.bg, color: T.fg, boxShadow: '0 50px 120px rgba(0,0,0,.55)' });
    el.innerHTML = `
      <div style="height:230px;position:relative;overflow:hidden"><img src="${base}media/poster-banner.jpg" style="width:100%;height:100%;object-fit:cover;object-position:50% 30%">
        <div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,0) 40%,${T.bg} 100%)"></div></div>
      <div style="padding:4px 40px 0">
        <div style="font:700 24px/1 Inter,sans-serif;letter-spacing:.2em;color:${T.acc}">${label}</div>
        <div style="margin-top:12px;font:800 52px/1.05 Inter,sans-serif;letter-spacing:-.02em">DashainEvent2026</div>
        <div style="margin-top:10px;font:600 27px/1.35 Inter,sans-serif;color:${T.dim}">Sat 10 Oct 2026 · Rohrbacher Kulturhaus, Heidelberg<br>Standard – Phase 2</div>
      </div>
      <div style="position:relative;margin:26px 0 0;height:0;border-top:3px dashed ${T.line}">
        <span style="position:absolute;left:-22px;top:-22px;width:44px;height:44px;border-radius:50%;background:${T.hole}"></span>
        <span style="position:absolute;right:-22px;top:-22px;width:44px;height:44px;border-radius:50%;background:${T.hole}"></span>
      </div>
      <div style="display:flex;align-items:center;gap:30px;padding:30px 40px 36px">
        <div class="qr" style="width:210px;height:210px;border-radius:20px;background:#fff;padding:12px;flex:none;border:${theme === 'light' || theme === 'paper' ? '2px solid rgba(0,0,0,.08)' : '0'}">${qr}</div>
        <div><div style="display:inline-flex;align-items:center;gap:10px;padding:10px 18px;border-radius:999px;background:rgba(34,197,94,.16);color:${theme === 'light' || theme === 'paper' ? '#15803d' : '#4ade80'};font:700 26px/1 Inter,sans-serif">✓ In your email</div>
        <div style="margin-top:16px;font:600 27px/1.35 Inter,sans-serif;color:${T.dim}">${note}</div></div>
      </div>`;
    return el;
  };

  // ---- Setup ----
  K.fitQr = () => { for (const s of K.$$('.qr svg')) { s.setAttribute('width', '100%'); s.setAttribute('height', '100%'); } };
  K.ready = async (qr, base = '../out/dashain/') => {
    if (qr) for (const el of K.$$('.qr')) if (!el.innerHTML.trim()) el.innerHTML = qr;
    K.fitQr();
    try {
      const svg = await (await fetch(base + 'martnepali-logo.svg')).text();
      for (const el of K.$$('.mn-mark, .kp-icon')) { el.innerHTML = svg; const s = K.$('svg', el); s.setAttribute('width', el.dataset.w || '30'); s.setAttribute('height', el.dataset.h || '36'); }
    } catch {}
    await document.fonts.ready;
    await Promise.all(K.$$('img').map((i) => i.decode().catch(() => {})));
  };
  /** Standalone viewing: ?t=4 shows one moment, ?play plays it. */
  K.standalone = (setup, render, total) => {
    const q = new URLSearchParams(location.search);
    if (q.has('render')) return;
    addEventListener('load', async () => {
      await setup(null);
      if (q.has('play')) {
        const t0 = performance.now();
        const loop = () => { render(((performance.now() - t0) / 1000) % total); requestAnimationFrame(loop); };
        loop();
      } else render(parseFloat(q.get('t') || '0'));
    });
  };

  root.K = K;
})(window);
