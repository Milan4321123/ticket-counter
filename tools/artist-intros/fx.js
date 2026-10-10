// Shared drawing kit for the artist intros: easing, the blur-in reveal of the
// reference promos, and canvas effects (dust, light beams, sparks, rays, a 3D
// wave of dots, film grain). Everything is a pure function of time t, so any
// frame can be rendered on its own.
(function (root) {
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const prog = (t, t0, d) => clamp((t - t0) / d);
  const lerp = (a, b, k) => a + (b - a) * k;
  const E = {
    out3: (x) => 1 - Math.pow(1 - x, 3),
    out5: (x) => 1 - Math.pow(1 - x, 5),
    in3: (x) => x * x * x,
    inOut: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
    back: (x) => { const c = 1.9, c3 = c + 1; return 1 + c3 * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); },
  };
  // Seeded random, so particles sit in the same place in every frame.
  function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

  // Words sharpen out of a blur (and blur away on the way out).
  function reveal(el, t, t0, o = {}) {
    const d = o.d ?? 0.5, p = prog(t, t0, d), e = E.out5(p);
    let op = clamp(p * 2.4), blur = (o.blur ?? 22) * (1 - e);
    let dx = (o.dx ?? 0) * (1 - e), dy = (o.dy ?? 26) * (1 - e), sc = 1 + (o.sc ?? 0) * (1 - e);
    if (o.out != null && t > o.out) {
      const q = prog(t, o.out, o.od ?? 0.28), f = E.in3(q);
      op *= 1 - q; blur += (o.oblur ?? 16) * f; dy += (o.ody ?? -30) * f; sc += (o.osc ?? 0) * f;
    }
    if (o.drift) sc *= 1 + o.drift * Math.max(0, t - t0);
    el.style.opacity = op.toFixed(3);
    el.style.filter = blur > 0.08 ? `blur(${blur.toFixed(2)}px)` : 'none';
    el.style.transform = `translate(${dx.toFixed(1)}px,${dy.toFixed(1)}px) scale(${sc.toFixed(4)})`;
    return p;
  }

  // A scene's camera: punches in from a blur when it starts, flicks out at the end.
  function sceneCam(el, t, a, b, { drift = 0.012, punch = 0.07, inD = 0.32, outD = 0.1, extra = '' } = {}) {
    const on = t >= a && t < b;
    el.style.display = on ? 'block' : 'none';
    if (!on) return false;
    const pi = E.out5(prog(t, a, inD)), po = prog(t, b - outD, outD);
    const sc = (1 + punch * (1 - pi)) * (1 + drift * (t - a)) * (1 + 0.035 * po * po);
    const blur = 12 * (1 - pi) + 9 * po * po;
    el.style.transform = `${extra} scale(${sc.toFixed(4)})`;
    el.style.filter = blur > 0.1 ? `blur(${blur.toFixed(2)}px)` : 'none';
    return true;
  }

  // Decaying camera shake after hits.
  function shake(t, hits, amp = 14) {
    let x = 0, y = 0;
    for (const h of hits) {
      const d = t - h; if (d < 0 || d > 0.6) continue;
      const k = Math.exp(-d * 9) * amp;
      x += Math.sin(d * 83) * k; y += Math.cos(d * 71) * k * 0.7;
    }
    return [x, y];
  }

  // Floating dust / bokeh at three depths.
  function makeDust(n, seed) { const r = rng(seed); return Array.from({ length: n }, () => ({ x: r(), y: r(), z: r(), ph: r() * 6.28, sp: 0.3 + r() })); }
  function dust(ctx, t, pts, { W = 1920, H = 1080, color = '255,220,170', alpha = 1, rise = 18 } = {}) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const p of pts) {
      const z = p.z, x = ((p.x * W + Math.sin(t * 0.4 * p.sp + p.ph) * 40 * z) % W + W) % W;
      const y = (((p.y * H - t * rise * (0.3 + z) * p.sp) % H) + H) % H;
      const big = z > 0.92, r = big ? 14 + 26 * (z - 0.92) * 12 : 0.8 + 2.4 * z;
      const a = (big ? 0.06 : 0.15 + 0.55 * z) * alpha * (0.6 + 0.4 * Math.sin(t * 2 * p.sp + p.ph));
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${color},${a})`); g.addColorStop(1, `rgba(${color},0)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill();
    }
    ctx.restore();
  }

  // Stage light beams from above, swinging.
  function beams(ctx, t, list, { H = 1080, alpha = 1 } = {}) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const b of list) {
      const ang = b.a + Math.sin(t * b.s + b.ph) * b.sw;
      const len = H * 1.5, w = b.w;
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(ang);
      const g = ctx.createLinearGradient(0, 0, 0, len);
      g.addColorStop(0, `rgba(${b.c},${0.55 * alpha})`); g.addColorStop(0.5, `rgba(${b.c},${0.16 * alpha})`); g.addColorStop(1, `rgba(${b.c},0)`);
      ctx.fillStyle = g; ctx.filter = 'blur(18px)';
      ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(10, 0); ctx.lineTo(w, len); ctx.lineTo(-w, len); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  // Sparks rising from the bottom (the drop).
  function makeSparks(n, seed) { const r = rng(seed); return Array.from({ length: n }, () => ({ x: r(), t0: r() * 3, v: 0.5 + r(), dr: (r() - 0.5) * 2, s: 1 + r() * 2.5, hue: r() })); }
  function sparks(ctx, t, pts, { W = 1920, H = 1080, since = 0, burst = null, alpha = 1 } = {}) {
    if (t < since) return;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const p of pts) {
      const life = 3 / p.v, age = ((t - since + p.t0) % life);
      const k = age / life;
      let x = p.x * W + Math.sin(age * 2 + p.dr * 3) * 30 * p.dr, y = H + 20 - k * H * 1.15;
      if (burst != null && t - burst < 1.2 && t >= burst) { const d = t - burst; x += (p.x - 0.5) * 900 * E.out3(Math.min(1, d * 1.5)) * (1 - k); }
      const a = Math.sin(k * Math.PI) * (0.5 + 0.5 * Math.sin(t * 20 * p.v + p.t0 * 9)) * alpha;
      const c = p.hue > 0.7 ? '255,255,255' : p.hue > 0.3 ? '255,190,90' : '255,110,60';
      ctx.fillStyle = `rgba(${c},${a.toFixed(3)})`;
      ctx.beginPath(); ctx.ellipse(x, y, p.s * 0.8, p.s * 2.6, p.dr * 0.3, 0, 6.283); ctx.fill();
    }
    ctx.restore();
  }

  // Light rays bursting from a point (the build-up before the drop).
  function rays(ctx, t, cx, cy, { n = 48, len = 1400, alpha = 1, spin = 0.3, color = '255,200,120', seed = 3 } = {}) {
    const r = rng(seed);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.translate(cx, cy); ctx.rotate(t * spin);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 6.283 + r() * 0.1, w = 0.004 + r() * 0.02, l = len * (0.5 + r() * 0.5);
      const g = ctx.createLinearGradient(0, 0, Math.cos(a) * l, Math.sin(a) * l);
      g.addColorStop(0, `rgba(${color},${0.5 * alpha})`); g.addColorStop(1, `rgba(${color},0)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a - w) * l, Math.sin(a - w) * l); ctx.lineTo(Math.cos(a + w) * l, Math.sin(a + w) * l); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  // A plane of dots rolling in a 3D wave, seen in perspective.
  function wavePlane(ctx, t, { W = 1920, H = 1080, cols = 64, rows = 34, gap = 70, camY = -260, horizon = 430, f = 760, amp = 46, color = (k) => `rgba(140,170,255,${k})`, alpha = 1, glowAt = null } = {}) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let j = rows - 1; j >= 0; j--) {
      const Z = 260 + j * gap;
      for (let i = 0; i < cols; i++) {
        const X = (i - cols / 2) * gap;
        const Y = Math.sin(X * 0.006 + t * 1.6) * Math.cos(Z * 0.005 - t * 1.1) * amp + Math.sin((X + Z) * 0.003 + t) * amp * 0.5;
        const sx = W / 2 + (X * f) / Z, sy = horizon + ((Y - camY) * f) / Z;
        if (sx < -10 || sx > W + 10 || sy > H + 10) continue;
        const depth = 1 - j / rows;
        let k = (0.18 + 0.82 * depth) * alpha;
        let col = color(k.toFixed(3));
        if (glowAt) { const d = Math.hypot(sx - glowAt[0], sy - glowAt[1]); if (d < 260) col = `rgba(255,190,90,${(k * (1.6 - d / 260)).toFixed(3)})`; }
        ctx.fillStyle = col;
        const s = 1.2 + 3 * depth;
        ctx.fillRect(sx - s / 2, sy - s / 2, s, s);
      }
    }
    ctx.restore();
  }

  // Film grain: a few noise tiles, one per frame.
  function makeGrain(n = 6, w = 480, h = 270, seed = 7) {
    const r = rng(seed);
    return Array.from({ length: n }, () => {
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const x = c.getContext('2d'), im = x.createImageData(w, h);
      for (let i = 0; i < im.data.length; i += 4) { const v = (r() * 255) | 0; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; }
      x.putImageData(im, 0, 0); return c;
    });
  }

  // A follow-spot from the rig onto the stage floor.
  function spotlight(ctx, x, floorY, { top = -40, topX = null, w = 260, alpha = 1, color = '255,236,200' } = {}) {
    const tx = topX ?? x;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.filter = 'blur(14px)';
    const g = ctx.createLinearGradient(0, top, 0, floorY);
    g.addColorStop(0, `rgba(${color},${0.5 * alpha})`); g.addColorStop(1, `rgba(${color},${0.12 * alpha})`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(tx - 16, top); ctx.lineTo(tx + 16, top); ctx.lineTo(x + w, floorY); ctx.lineTo(x - w, floorY); ctx.closePath(); ctx.fill();
    ctx.filter = 'none';
    const p = ctx.createRadialGradient(x, floorY, 0, x, floorY, w * 1.3);
    p.addColorStop(0, `rgba(${color},${0.55 * alpha})`); p.addColorStop(1, `rgba(${color},0)`);
    ctx.fillStyle = p; ctx.beginPath(); ctx.ellipse(x, floorY, w * 1.3, w * 0.28, 0, 0, 6.283); ctx.fill();
    ctx.restore();
  }

  // Confetti thrown up from a point at time t0, falling and flipping.
  function makeConfetti(n, seed) {
    const r = rng(seed), cols = ['#f59e0b', '#fde68a', '#dc143c', '#ffffff', '#f97316', '#2563eb'];
    return Array.from({ length: n }, () => ({ a: -Math.PI / 2 + (r() - 0.5) * 2.4, v: 900 + r() * 1500, w: 10 + r() * 14, h: 6 + r() * 8, spin: (r() - 0.5) * 18, flip: 4 + r() * 10, ph: r() * 6.28, sway: 30 + r() * 60, c: cols[(r() * cols.length) | 0], x0: (r() - 0.5) * 300 }));
  }
  function confetti(ctx, t, pts, t0, ox, oy, { g = 1100, drag = 1.6 } = {}) {
    const d = t - t0; if (d < 0) return;
    ctx.save();
    for (const p of pts) {
      const k = (1 - Math.exp(-drag * d)) / drag;            // velocity decays with air drag
      const x = ox + p.x0 + Math.cos(p.a) * p.v * k + Math.sin(d * 3 + p.ph) * p.sway * Math.min(1, d);
      const y = oy + Math.sin(p.a) * p.v * k + 0.5 * g * d * d * 0.35;
      if (y > 1150) continue;
      ctx.save(); ctx.translate(x, y); ctx.rotate(p.spin * d * 0.3 + p.ph);
      ctx.scale(1, Math.cos(p.flip * d + p.ph));
      ctx.fillStyle = p.c; ctx.globalAlpha = Math.min(1, 3 - d * 0.35);
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    ctx.restore();
  }

  // The audience in silhouette along the bottom: two rows, rim-lit by the stage.
  // handsUp 0..1 = share of people with their arms up; clap 0..1 = hands
  // brought together over the head; jump 0..1 = bouncing; phones 0..1 = lights.
  function makeCrowd(seed, n = 30) {
    const r = rng(seed), ppl = [];
    for (const row of [0, 1]) {
      const N = row ? n : Math.round(n * 1.25);
      for (let i = 0; i < N; i++) ppl.push({ row, x: ((i + 0.2 + r() * 0.6) / N) * 2080 - 80, s: (row ? 1.18 : 0.84) * (0.88 + r() * 0.26), k: r(), phone: r() < 0.4, ph: r() * 6.28, hand: r() < 0.5 ? -1 : 1 });
    }
    return ppl;
  }
  // sway 0..1 = everyone waving their arms side to side together, one wave per swayT seconds
  function crowd(ctx, t, ppl, { baseY = 1080, handsUp = 0.4, clap = 0, jump = 0, phones = 0, rim = '255,200,130', rimA = 0.55, sway = 0, swayT = 1 } = {}) {
    ctx.save();
    for (const p of ppl) {
      const s = p.s, raised = p.k < handsUp;
      const bob = jump * Math.abs(Math.sin(t * 5.2 + p.ph)) * 34 * s;
      const x = p.x, y = baseY - (p.row ? 70 : 150) * s - bob;
      const col = p.row ? '#020204' : '#0b0b15';
      ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineCap = 'round';
      if (raised) {
        const group = sway ? Math.sin((t / swayT) * 6.283 + p.row * 0.4) * 70 * s * sway : 0;
        const wave = (Math.sin(t * 2.6 + p.ph) * 18 * s * (1 - sway) + group) * (1 - clap);
        ctx.lineWidth = 20 * s;
        for (const side of [-1, 1]) {
          const sx = x + side * 52 * s, sy = y + 70 * s;
          const hx = lerp(x + side * 105 * s + wave, x + side * 9 * s, clap), hy = lerp(y - 150 * s, y - 175 * s, clap);
          ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(hx, hy); ctx.stroke();
          ctx.beginPath(); ctx.arc(hx, hy, 13 * s, 0, 6.283); ctx.fill();
          if (phones > 0 && p.phone && side === p.hand && clap < 0.5) {
            const g = ctx.createRadialGradient(hx, hy - 12 * s, 0, hx, hy - 12 * s, 46 * s);
            g.addColorStop(0, `rgba(255,255,255,${0.95 * phones})`); g.addColorStop(0.25, `rgba(220,235,255,${0.35 * phones})`); g.addColorStop(1, 'rgba(220,235,255,0)');
            ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(hx, hy - 12 * s, 46 * s, 0, 6.283); ctx.fill(); ctx.restore();
            ctx.fillStyle = col;
          }
        }
      }
      // shoulders + head
      ctx.beginPath(); ctx.ellipse(x, y + 120 * s, 82 * s, 80 * s, 0, Math.PI, 0); ctx.rect(x - 82 * s, y + 120 * s, 164 * s, 200 * s); ctx.fill();
      ctx.beginPath(); ctx.arc(x, y + 8 * s, 36 * s, 0, 6.283); ctx.fill();
      // rim light on the top edges
      ctx.save(); ctx.strokeStyle = `rgba(${rim},${rimA * (p.row ? 1 : 0.6)})`; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.arc(x, y + 8 * s, 36 * s, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(x, y + 120 * s, 82 * s, 80 * s, 0, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  // A soft round glow drawn once, for drawing thousands of particles quickly.
  const SPRITES = {};
  function glowSprite(rgb = '255,200,110', size = 32) {
    const key = rgb + size; if (SPRITES[key]) return SPRITES[key];
    const c = document.createElement('canvas'); c.width = c.height = size;
    const x = c.getContext('2d'), g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,250,236,1)'); g.addColorStop(0.16, `rgba(${rgb},0.95)`); g.addColorStop(0.45, `rgba(${rgb},0.28)`); g.addColorStop(1, `rgba(${rgb},0)`);
    x.fillStyle = g; x.fillRect(0, 0, size, size);
    return (SPRITES[key] = c);
  }

  // Fireworks: shells [{t, x, y, rgb, rocket}] — a rocket climbs for 0.6 s (unless
  // rocket === false), then the shell bursts into sparks that slow, fall and fade.
  function makeShells(list) {
    return list.map((s, k) => { const r = rng(k * 31 + 7); return { ...s, x0: s.x + (r() - 0.5) * 200, sparks: Array.from({ length: s.n || 110 }, () => ({ a: r() * 6.283, v: 360 + r() * 460, tw: r() * 6.28, life: 1.3 + r() * 1.1 })) }; });
  }
  function fireworks(ctx, t, shells) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    for (const s of shells) {
      const sp = glowSprite(s.rgb), up = 0.6;
      if (s.rocket !== false && t >= s.t - up && t < s.t) {
        const pos = (k) => { const e = 1 - Math.pow(1 - k, 2); return [s.x0 + (s.x - s.x0) * e, 1120 + (s.y - 1120) * e]; };
        const k = (t - (s.t - up)) / up, [x, y] = pos(k), [xt, yt] = pos(Math.max(0, k - 0.15));
        const g = ctx.createLinearGradient(xt, yt, x, y); g.addColorStop(0, `rgba(${s.rgb},0)`); g.addColorStop(1, 'rgba(255,240,210,0.9)');
        ctx.strokeStyle = g; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(xt, yt); ctx.lineTo(x, y); ctx.stroke();
        ctx.drawImage(sp, x - 12, y - 12, 24, 24);
      }
      const d = t - s.t; if (d < 0 || d > 2.6) continue;
      if (d < 0.2) { const fl = 1 - d / 0.2, g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, 300); g.addColorStop(0, `rgba(255,246,225,${0.75 * fl})`); g.addColorStop(1, `rgba(${s.rgb},0)`); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(s.x, s.y, 300, 0, 6.283); ctx.fill(); }
      for (const p of s.sparks) {
        if (d > p.life) continue;
        const at = (dd) => { const k = (1 - Math.exp(-2.2 * dd)) / 2.2; return [s.x + Math.cos(p.a) * p.v * k, s.y + Math.sin(p.a) * p.v * k + 90 * dd * dd]; };
        const [x, y] = at(d), [xt, yt] = at(Math.max(0, d - 0.08));
        const life = 1 - d / p.life, a = life * life * (0.6 + 0.4 * Math.sin(t * 31 + p.tw));
        ctx.strokeStyle = `rgba(${s.rgb},${(a * 0.75).toFixed(3)})`; ctx.lineWidth = 2.2;
        ctx.beginPath(); ctx.moveTo(xt, yt); ctx.lineTo(x, y); ctx.stroke();
        const sz = 7 + 9 * life; ctx.globalAlpha = Math.min(1, a); ctx.drawImage(sp, x - sz / 2, y - sz / 2, sz, sz); ctx.globalAlpha = 1;
      }
    }
    ctx.restore();
  }

  // An anamorphic lens flare: a long horizontal streak with a hot core.
  function flare(ctx, x, y, a = 1, len = 1800, rgb = '255,214,150') {
    if (a <= 0) return;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(x - len / 2, 0, x + len / 2, 0);
    g.addColorStop(0, `rgba(${rgb},0)`); g.addColorStop(0.5, `rgba(255,248,230,${0.85 * a})`); g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g; ctx.fillRect(x - len / 2, y - 3, len, 6);
    ctx.filter = 'blur(10px)'; ctx.fillStyle = g; ctx.fillRect(x - len / 2, y - 14, len, 28); ctx.filter = 'none';
    const c = ctx.createRadialGradient(x, y, 0, x, y, 220); c.addColorStop(0, `rgba(255,250,240,${0.9 * a})`); c.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, 220, 0, 6.283); ctx.fill();
    ctx.restore();
  }

  root.FX = { glowSprite, makeShells, fireworks, flare, clamp, prog, lerp, E, rng, reveal, sceneCam, shake, makeDust, dust, beams, makeSparks, sparks, rays, wavePlane, makeGrain, spotlight, makeConfetti, confetti, makeCrowd, crowd };
})(this);
