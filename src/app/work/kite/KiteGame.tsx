'use client';

// Changa Chet! — the page side of the kite fight. kite.ts holds the rules,
// draw.ts the pictures, sound.ts the noises; this file owns the canvas, the
// input, the screens (start, your kite, pause, game over) and the little bits
// of "juice" (pops, paper bits, shake). Everything runs in this browser.
//
// The animation loop only runs while the game is on screen and the tab is
// visible; going away pauses a round. Calm mode (on by default under
// prefers-reduced-motion) slows the spin and the game a little, and turns off
// shaking, parallax and most particles.

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { COPY, FLYERS, LANGS, PALETTE, asKiteLang, clock, num, type KiteCopy, type Lang } from './content';
import {
  COMBO_S,
  DT,
  H,
  KITE_R,
  LIVES,
  PATTERNS,
  newGame,
  nextBest,
  shuffle,
  stageCover,
  step,
  timeLeft,
  type GameEvent,
  type GameState,
  type KiteLook,
  type Pattern,
} from './kite';
import {
  drawBird,
  drawClouds,
  drawFarKites,
  drawFlags,
  drawFlyer,
  drawFront,
  drawKite,
  drawMid,
  drawMountains,
  drawShareCard,
  drawSky,
  drawSock,
  drawString,
  makeScene,
  type Scene,
} from './draw';
import { KiteSfx } from './sound';

type Screen = 'menu' | 'custom' | 'playing' | 'paused' | 'over';
type Result = { score: number; cuts: number; loots: number; bestCombo: number; reason: 'time' | 'lives'; bonus: number; newBest: boolean };

const K = {
  lang: 'mn-demo:kite-lang',
  look: 'mn-demo:kite-look',
  best: 'mn-demo:kite-best',
  mute: 'mn-demo:kite-mute',
  calm: 'mn-demo:kite-calm',
};
const DEFAULT_LOOK: KiteLook = { main: '#e23d3d', accent: '#1f7ae0', pattern: 'sunmoon' };
const SHIRTS = ['#2f62c9', '#d63a2f', '#2d9b55', '#8e44ad', '#e08a1a', '#0f9bb5'];

function load(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function save(key: string, v: string) {
  try {
    localStorage.setItem(key, v);
  } catch {
    /* private window: it just forgets */
  }
}
function asLook(raw: string | null): KiteLook | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<KiteLook>;
    if (typeof v.main === 'string' && PALETTE.includes(v.main) && typeof v.accent === 'string' && PALETTE.includes(v.accent) && PATTERNS.includes(v.pattern as Pattern)) {
      return { main: v.main, accent: v.accent, pattern: v.pattern as Pattern };
    }
  } catch {
    /* ignore */
  }
  return null;
}
// ---------- juice ----------

type Particle = { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number; rot: number; vr: number; spark: boolean };
type Pop = { text: string; sub: string; x: number; y: number; age: number; color: string; big: boolean };
type Fx = { parts: Particle[]; pops: Pop[]; shakeT: number; shakeAmp: number; windFlash: number };

function burst(fx: Fx, x: number, y: number, colors: string[], n: number, spark = false) {
  for (let i = 0; i < n; i++) {
    if (fx.parts.length > 260) fx.parts.shift();
    const a = Math.random() * Math.PI * 2;
    const v = (spark ? 160 : 90) + Math.random() * (spark ? 260 : 220);
    fx.parts.push({
      x,
      y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v - (spark ? 0 : 80),
      life: 0,
      max: spark ? 0.35 + Math.random() * 0.25 : 0.9 + Math.random() * 0.8,
      color: colors[i % colors.length],
      size: spark ? 2 + Math.random() * 2 : 5 + Math.random() * 7,
      rot: Math.random() * 6,
      vr: (Math.random() - 0.5) * 14,
      spark,
    });
  }
}

const easeOutBack = (x: number) => {
  const c1 = 1.9;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};

// ---------- small canvas for kite previews ----------

function KiteSwatch({ look, size, angle = 0.25, label }: { look: KiteLook; size: number; angle?: number; label?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = Math.round(size * dpr);
    c.height = Math.round(size * dpr);
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    drawKite(ctx, size / 2, size * 0.44, angle, look, size * 0.3);
  }, [look, size, angle]);
  return <canvas ref={ref} className="kt-swatch-cv" style={{ width: size, height: size }} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} />;
}

// ---------- the game ----------

type Layers = { key: string; far: HTMLCanvasElement; mid: HTMLCanvasElement; front: HTMLCanvasElement };

function makeLayer(sc: Scene, kd: number, paint: (ctx: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil((sc.W + sc.pad * 2) * kd));
  c.height = Math.max(1, Math.ceil(H * kd));
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.setTransform(kd, 0, 0, kd, sc.pad * kd, 0);
    paint(ctx);
  }
  return c;
}

export default function KiteGame({ initialLang, font }: { initialLang: Lang; font: string }) {
  const [lang, setLang] = useState<Lang>(initialLang);
  const [screen, setScreen] = useState<Screen>('menu');
  const [look, setLook] = useState<KiteLook>(DEFAULT_LOOK);
  const [calm, setCalm] = useState(false);
  const [muted, setMuted] = useState(false);
  const [best, setBest] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [shareMsg, setShareMsg] = useState('');
  const [say, setSay] = useState('');

  const t: KiteCopy = COPY[lang];

  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<GameState | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const layersRef = useRef<Layers | null>(null);
  const sizeRef = useRef({ cssW: 0, cssH: 0, dpr: 1 });
  const screenRef = useRef<Screen>('menu');
  const langRef = useRef<Lang>(initialLang);
  const lookRef = useRef<KiteLook>(DEFAULT_LOOK);
  const calmRef = useRef(false);
  const bestRef = useRef(0);
  const inViewRef = useRef(true);
  const rafRef = useRef(0);
  const lastRef = useRef(0);
  const accRef = useRef(0);
  const clockRef = useRef(0);
  const parRef = useRef(0);
  const inputRef = useRef({ keys: new Set<string>(), pointers: new Set<number>() });
  const fxRef = useRef<Fx>({ parts: [], pops: [], shakeT: 0, shakeAmp: 0, windFlash: 0 });
  const sfxRef = useRef<KiteSfx | null>(null);
  const fpsRef = useRef({ frames: 0, since: 0 });
  const coverRef = useRef<{ on: boolean; freezeAt: number }>({ on: false, freezeAt: 0 });
  const sayAtRef = useRef(0);
  const shirtsRef = useRef<string[]>(SHIRTS);

  screenRef.current = screen;
  langRef.current = lang;
  lookRef.current = look;
  calmRef.current = calm;
  bestRef.current = best;

  const sfx = () => (sfxRef.current ??= new KiteSfx());

  const announce = useCallback((text: string, force = false) => {
    const now = performance.now();
    if (!force && now - sayAtRef.current < 1200) return;
    sayAtRef.current = now;
    setSay(text);
  }, []);

  // ----- saved settings -----
  useEffect(() => {
    const l = asKiteLang(load(K.lang));
    if (l) setLang(l);
    const lk = asLook(load(K.look));
    if (lk) setLook(lk);
    const b = Number(load(K.best));
    if (Number.isFinite(b) && b > 0) setBest(Math.floor(b));
    const c = load(K.calm);
    setCalm(c === null ? Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) : c === '1');
    const m = load(K.mute) === '1';
    setMuted(m);
    if (window.location.hash === '#cover') coverRef.current.on = true;
  }, []);

  // ----- world size -----
  const worldW = useCallback(() => {
    const { cssW, cssH } = sizeRef.current;
    if (!cssW || !cssH) return 1000;
    return Math.max(600, Math.min(1800, Math.round((H * cssW) / cssH)));
  }, []);

  const ambient = useCallback(() => {
    const W = worldW();
    const s = newGame({ W, seed: 11, look: lookRef.current, names: FLYERS[langRef.current], calm: calmRef.current });
    s.flying = false;
    s.respawnT = Infinity;
    s.phase = 'over';
    gameRef.current = s;
  }, [worldW]);

  const ensureScene = useCallback((W: number) => {
    if (!sceneRef.current || sceneRef.current.W !== W) {
      sceneRef.current = makeScene(W);
      layersRef.current = null;
    }
    const sc = sceneRef.current;
    const { cssW, cssH, dpr } = sizeRef.current;
    const k = Math.min(cssW / W, cssH / H);
    const kd = Math.min(k * dpr, 2.2);
    const key = `${W}:${kd.toFixed(3)}`;
    const s = gameRef.current;
    if (!layersRef.current || layersRef.current.key !== key) {
      const wires = s?.wires ?? [];
      layersRef.current = {
        key,
        far: makeLayer(sc, kd, (c) => drawMountains(c, sc)),
        mid: makeLayer(sc, kd, (c) => drawMid(c, sc)),
        front: makeLayer(sc, kd, (c) => drawFront(c, sc, wires)),
      };
    }
    return sc;
  }, []);

  // ----- events from the rules → sound, pops, words -----
  const handle = useCallback(
    (evs: GameEvent[]) => {
      const fx = fxRef.current;
      const s = gameRef.current;
      const tt = COPY[langRef.current];
      const L = langRef.current;
      const calmNow = calmRef.current;
      const snd = sfx();
      for (const e of evs) {
        if (e.type === 'chet') {
          snd.snap();
          snd.woho(e.combo);
          const cut = s?.loose[s.loose.length - 1]?.look;
          fx.pops.push({ text: tt.chet, sub: `+${num(e.points, L)}${e.combo > 1 ? `  ×${num(e.combo, L)}` : ''}`, x: e.x, y: e.y, age: 0, color: '#ffd23f', big: true });
          burst(fx, e.x, e.y, cut ? [cut.main, cut.accent, '#fffaf0'] : ['#ffd23f', '#fff'], calmNow ? 8 : 26);
          burst(fx, e.x, e.y, ['#fff6c8', '#ffd23f'], calmNow ? 0 : 14, true);
          if (!calmNow) {
            fx.shakeT = 0.32;
            fx.shakeAmp = 9 + Math.min(8, e.combo * 2);
          }
          announce(tt.say.cut(e.name, num(e.points, L)), true);
          if (coverRef.current.on && !coverRef.current.freezeAt) coverRef.current.freezeAt = performance.now() + 230;
        } else if (e.type === 'lost') {
          snd.lost();
          fx.pops.push({ text: '✂', sub: e.by ?? '', x: e.x, y: e.y, age: 0, color: '#ff6b5b', big: false });
          burst(fx, e.x, e.y, [lookRef.current.main, lookRef.current.accent], calmNow ? 6 : 16);
          if (!calmNow) {
            fx.shakeT = 0.25;
            fx.shakeAmp = 7;
          }
          announce(tt.say.lost(e.by, num(Math.max(0, e.lives), L)), true);
        } else if (e.type === 'loot') {
          snd.loot();
          fx.pops.push({ text: tt.lootPop, sub: `+${num(e.points, L)}`, x: e.x, y: e.y, age: 0, color: '#7ef0c2', big: false });
          burst(fx, e.x, e.y, ['#7ef0c2', '#fff', '#ffd23f'], calmNow ? 5 : 14, true);
          announce(tt.say.loot);
        } else if (e.type === 'hit') {
          snd.hit();
          burst(fx, e.x, e.y, e.cause === 'bird' ? ['#3a3540', '#5a5560', '#fff'] : ['#fff6c8', '#9fd8ff'], calmNow ? 4 : 12, e.cause === 'wire');
          if (!calmNow) {
            fx.shakeT = 0.18;
            fx.shakeAmp = 5;
          }
          announce(e.cause === 'bird' ? tt.say.bird : tt.say.wire);
        } else if (e.type === 'gust') {
          snd.gust();
          fx.windFlash = 1.6;
        } else if (e.type === 'over') {
          snd.over((s?.score ?? 0) > bestRef.current);
        }
      }
    },
    [announce]
  );

  const finish = useCallback(() => {
    const s = gameRef.current;
    if (!s) return;
    const prev = bestRef.current;
    const nb = nextBest(prev, s.score);
    const r: Result = {
      score: s.score,
      cuts: s.cuts,
      loots: s.loots,
      bestCombo: s.bestCombo,
      reason: s.overReason ?? 'time',
      bonus: s.overReason === 'time' ? s.lives * 150 : 0,
      newBest: s.score > prev && s.score > 0,
    };
    if (nb !== prev) {
      save(K.best, String(nb));
      setBest(nb);
    }
    setResult(r);
    setShareMsg('');
    setScreen('over');
    screenRef.current = 'over';
    announce(COPY[langRef.current].say.over(num(s.score, langRef.current)), true);
  }, [announce]);

  // ----- drawing one frame -----
  const draw = useCallback(
    (now: number) => {
      const cv = canvasRef.current;
      const s = gameRef.current;
      if (!cv || !s) return;
      const ctx = cv.getContext('2d');
      if (!ctx) return;
      const { cssW, cssH, dpr } = sizeRef.current;
      if (!cssW || !cssH) return;
      const sc = ensureScene(s.W);
      const layers = layersRef.current!;
      const W = s.W;
      const k = Math.min(cssW / W, cssH / H);
      const ox = (cssW - W * k) / 2;
      const oy = (cssH - H * k) / 2;
      const fx = fxRef.current;
      const calmNow = calmRef.current;
      const time = clockRef.current;
      const tt = COPY[langRef.current];
      const L = langRef.current;
      const scr = screenRef.current;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#e48a5c';
      ctx.fillRect(0, 0, cssW, cssH);
      let sx = 0;
      let sy = 0;
      if (fx.shakeT > 0 && !calmNow) {
        const a = fx.shakeAmp * Math.min(1, fx.shakeT / 0.3);
        sx = (Math.random() - 0.5) * 2 * a;
        sy = (Math.random() - 0.5) * 2 * a;
      }
      ctx.save();
      ctx.translate(ox + sx, oy + sy);
      ctx.scale(k, k);

      const p = s.player;
      const wantPar = !calmNow && s.flying ? (p.x - W / 2) / W : 0;
      parRef.current += (wantPar - parRef.current) * 0.05;
      const par = parRef.current;

      drawSky(ctx, W, -ox / k - 20, cssW / k + 40);
      ctx.drawImage(layers.far, -sc.pad - par * 14, 0, W + sc.pad * 2, H);
      ctx.save();
      ctx.translate(-par * 22, 0);
      drawClouds(ctx, sc, calmNow ? time * 0.4 : time, s.wind);
      drawFarKites(ctx, sc, calmNow ? 0 : time, s.wind);
      ctx.restore();
      ctx.drawImage(layers.mid, -sc.pad - par * 34, 0, W + sc.pad * 2, H);
      ctx.drawImage(layers.front, -sc.pad, 0, W + sc.pad * 2, H);
      drawFlags(ctx, sc, time, s.wind, calmNow);
      drawSock(ctx, sc, time, s.wind, calmNow);

      // Flyers and strings.
      s.opps.forEach((o) => {
        if (o.anchor.x > -20 && o.anchor.x < W + 20) drawFlyer(ctx, o.anchor, shirtsRef.current[o.slot % shirtsRef.current.length], o.look.main, time, false, o.pulling);
      });
      const playing = scr === 'playing' || scr === 'paused' || (scr === 'over' && s.overReason !== null);
      drawFlyer(ctx, p.anchor, '#f2b705', '#d63a2f', time, playing && s.t < 4, s.flying && p.pulling);
      for (const o of s.opps) drawString(ctx, o.anchor, o, o.tension, s.wind, 'rgba(40,30,40,0.55)', 1.6);
      if (s.flying) {
        ctx.save();
        ctx.shadowColor = 'rgba(255,255,255,0.7)';
        ctx.shadowBlur = 4;
        drawString(ctx, p.anchor, p, p.tension, s.wind, s.player.strength < 0.35 ? '#ffb3a8' : '#ffffff', 2.4);
        ctx.restore();
      }
      // Loose kites with their broken strings.
      for (const l of s.loose) {
        ctx.strokeStyle = 'rgba(40,30,40,0.5)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(l.x, l.y);
        ctx.quadraticCurveTo(l.x - l.vx * 0.4, l.y + 40, l.x - l.vx * 0.6 + Math.sin(l.age * 4) * 10, l.y + 90);
        ctx.stroke();
        if (l.prize && !calmNow) {
          ctx.strokeStyle = `rgba(255,240,170,${0.35 + 0.25 * Math.sin(time * 8)})`;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(l.x, l.y, KITE_R * 1.5, 0, Math.PI * 2);
          ctx.stroke();
        }
        drawKite(ctx, l.x, l.y, l.a, l.look, KITE_R * 0.92);
      }
      // The other kites with their flyers' names.
      const label = 12 / k;
      ctx.font = `700 ${label}px ${font}`;
      ctx.textAlign = 'center';
      for (const o of s.opps) {
        drawKite(ctx, o.x, o.y, o.a, o.look, KITE_R);
        if (o.contactT > 0) {
          ctx.strokeStyle = 'rgba(255,90,70,0.9)';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(o.x, o.y, KITE_R * 1.35, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, o.strength));
          ctx.stroke();
        }
        if (s.phase === 'playing' || playing) {
          const ty = Math.max(label * 1.2, o.y - KITE_R * 1.5 - 4 / k);
          const w = ctx.measureText(o.name).width + 10 / k;
          const lx = Math.min(W - w / 2 - 4, Math.max(w / 2 + 4, o.x));
          ctx.fillStyle = 'rgba(20,18,40,0.5)';
          ctx.fillRect(lx - w / 2, ty - label * 0.95, w, label * 1.3);
          ctx.fillStyle = '#fff';
          ctx.fillText(o.name, lx, ty);
        }
      }
      if (s.flying) {
        const blink = s.safeT > 0 && Math.floor(time * 10) % 2 === 0;
        ctx.globalAlpha = blink ? 0.45 : 1;
        drawKite(ctx, p.x, p.y, p.a, p.look, KITE_R * 1.05, { outline: 'rgba(255,255,255,0.9)' });
        ctx.globalAlpha = 1;
      }
      if (playing && s.t < 4 && s.phase === 'playing') {
        ctx.font = `800 ${14 / k}px ${font}`;
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = 'rgba(20,18,40,0.7)';
        ctx.lineWidth = 4 / k;
        ctx.strokeText(tt.you, p.anchor.x - 15, p.anchor.y - 52 - 8 / k);
        ctx.fillText(tt.you, p.anchor.x - 15, p.anchor.y - 52 - 8 / k);
      }
      for (const b of s.birds) drawBird(ctx, b.x, b.y, time, b.phase, Math.sign(b.vx));
      // Sparks where strings cross.
      for (const c of s.contacts) {
        const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, 16);
        g.addColorStop(0, 'rgba(255,250,220,0.95)');
        g.addColorStop(1, 'rgba(255,200,80,0)');
        ctx.fillStyle = g;
        ctx.fillRect(c.x - 16, c.y - 16, 32, 32);
      }
      // Paper bits and sparks.
      for (const q of fx.parts) {
        const a = 1 - q.life / q.max;
        ctx.globalAlpha = Math.max(0, a);
        if (q.spark) {
          ctx.strokeStyle = q.color;
          ctx.lineWidth = q.size;
          ctx.beginPath();
          ctx.moveTo(q.x, q.y);
          ctx.lineTo(q.x - q.vx * 0.04, q.y - q.vy * 0.04);
          ctx.stroke();
        } else {
          ctx.save();
          ctx.translate(q.x, q.y);
          ctx.rotate(q.rot);
          ctx.fillStyle = q.color;
          ctx.fillRect(-q.size / 2, -q.size / 3, q.size, q.size * 0.66);
          ctx.restore();
        }
      }
      ctx.globalAlpha = 1;
      // "CHET!" and friends.
      for (const pp of fx.pops) {
        const u = pp.age;
        const grow = calmNow ? 1 : pp.big ? easeOutBack(Math.min(1, u / 0.28)) : Math.min(1, u / 0.12);
        const alpha = 1 - Math.max(0, (u - 0.75) / 0.45);
        const size = (pp.big ? 70 : 40) * Math.max(0.2, grow);
        const y = pp.y - 40 - u * 40;
        const x = Math.min(W - 120, Math.max(120, pp.x));
        ctx.globalAlpha = Math.max(0, alpha);
        ctx.font = `800 ${size}px ${font}`;
        ctx.lineJoin = 'round';
        ctx.lineWidth = size * 0.16;
        ctx.strokeStyle = 'rgba(40,16,30,0.85)';
        ctx.strokeText(pp.text, x, y);
        ctx.fillStyle = pp.color;
        ctx.fillText(pp.text, x, y);
        if (pp.sub) {
          const s2 = Math.max(18 / k, size * 0.42);
          ctx.font = `800 ${s2}px ${font}`;
          ctx.lineWidth = s2 * 0.18;
          ctx.strokeText(pp.sub, x, y + s2 * 1.15);
          ctx.fillStyle = '#ffffff';
          ctx.fillText(pp.sub, x, y + s2 * 1.15);
        }
      }
      ctx.globalAlpha = 1;
      ctx.restore();

      if (playing) drawHud(ctx, s, cssW, tt, L, font, fx.windFlash, lookRef.current);
      void now;
    },
    [ensureScene, font]
  );

  // ----- the loop -----
  const shouldRun = () => inViewRef.current && typeof document !== 'undefined' && !document.hidden && screenRef.current !== 'paused';

  const frame = useCallback(
    (now: number) => {
      rafRef.current = 0;
      if (!shouldRun()) return;
      const dtRaw = lastRef.current ? (now - lastRef.current) / 1000 : DT;
      lastRef.current = now;
      const dt = Math.min(0.1, Math.max(0, dtRaw));
      const s = gameRef.current;
      const scr = screenRef.current;
      const fx = fxRef.current;
      const calmNow = calmRef.current;
      const cover = coverRef.current;
      const frozen = cover.freezeAt > 0 && now > cover.freezeAt;
      if (s && !frozen) {
        const speedUp = calmNow ? 0.85 : 1;
        accRef.current += dt * speedUp;
        let n = 0;
        const pullNow = inputRef.current.keys.size > 0 || inputRef.current.pointers.size > 0 || (cover.on && s.t < s.roundLen * 0.55 + 0.1);
        while (accRef.current >= DT && n < 5) {
          const evs = step(s, { pull: scr === 'playing' && pullNow }, DT);
          if (scr === 'playing' && evs.length) handle(evs);
          accRef.current -= DT;
          n++;
        }
        if (n === 5) accRef.current = 0;
        clockRef.current += dt * speedUp;
        if (scr === 'playing' && s.contacts.length) {
          sfx().saw(now);
          if (!calmNow && Math.random() < 0.6) for (const c of s.contacts) burst(fx, c.x, c.y, ['#fff6c8', '#ffd23f'], 1, true);
        }
        if (scr === 'playing' && s.phase === 'over' && s.overT > 1.1) finish();
        // Juice.
        for (const q of fx.parts) {
          q.life += dt;
          q.x += q.vx * dt;
          q.y += q.vy * dt;
          if (q.spark) {
            q.vx *= 0.9;
            q.vy *= 0.9;
          } else {
            q.vx *= 0.98;
            q.vy += 180 * dt;
            q.rot += q.vr * dt;
          }
        }
        fx.parts = fx.parts.filter((q) => q.life < q.max);
        for (const pp of fx.pops) pp.age += dt;
        fx.pops = fx.pops.filter((pp) => pp.age < 1.25);
        if (fx.shakeT > 0) fx.shakeT -= dt;
        if (fx.windFlash > 0) fx.windFlash -= dt;
      }
      draw(now);
      if (scr === 'playing') {
        const f = fpsRef.current;
        f.frames++;
        if (!f.since) f.since = now;
        if (now - f.since >= 1000) {
          if (stageRef.current) stageRef.current.dataset.fps = String(Math.round((f.frames * 1000) / (now - f.since)));
          f.frames = 0;
          f.since = now;
        }
      }
      rafRef.current = requestAnimationFrame(frame);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [draw, finish, handle]
  );

  const kick = useCallback(() => {
    if (!rafRef.current && shouldRun()) {
      lastRef.current = 0;
      rafRef.current = requestAnimationFrame(frame);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame]);

  // ----- size, visibility, off-screen -----
  useEffect(() => {
    const st = stageRef.current;
    const cv = canvasRef.current;
    if (!st || !cv) return;
    const resize = () => {
      const r = st.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      sizeRef.current = { cssW: r.width, cssH: r.height, dpr };
      cv.width = Math.max(1, Math.round(r.width * dpr));
      cv.height = Math.max(1, Math.round(r.height * dpr));
      const W = worldW();
      const scr = screenRef.current;
      if (!gameRef.current || ((scr === 'menu' || scr === 'custom') && Math.abs(gameRef.current.W - W) > 4)) ambient();
      draw(performance.now());
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(st);
    const io = new IntersectionObserver(
      ([e]) => {
        inViewRef.current = e.isIntersecting;
        if (!e.isIntersecting && screenRef.current === 'playing') {
          inputRef.current.keys.clear();
          inputRef.current.pointers.clear();
          setScreen('paused');
          screenRef.current = 'paused';
        }
        kick();
      },
      { threshold: 0.15 }
    );
    io.observe(st);
    const vis = () => {
      if (document.hidden && screenRef.current === 'playing') {
        setScreen('paused');
        screenRef.current = 'paused';
      }
      if (document.hidden) sfxRef.current?.suspend();
      kick();
    };
    document.addEventListener('visibilitychange', vis);
    const blur = () => {
      inputRef.current.keys.clear();
      inputRef.current.pointers.clear();
    };
    window.addEventListener('blur', blur);
    kick();
    return () => {
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', vis);
      window.removeEventListener('blur', blur);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    };
  }, [ambient, draw, kick, worldW]);

  useEffect(() => {
    if (screen !== 'paused') kick();
    else draw(performance.now());
  }, [screen, kick, draw]);

  useEffect(() => {
    if (sfxRef.current) sfxRef.current.muted = muted;
  }, [muted]);

  // ----- actions -----
  const start = useCallback(() => {
    const snd = sfx();
    snd.muted = muted;
    snd.unlock();
    const W = worldW();
    const seed = (Date.now() ^ Math.floor(Math.random() * 1e9)) | 0;
    const s = newGame({ W, seed, look: lookRef.current, names: shuffle(FLYERS[langRef.current], seed), calm: calmRef.current });
    if (coverRef.current.on) {
      stageCover(s);
      coverRef.current.freezeAt = 0;
    }
    shirtsRef.current = shuffle(SHIRTS, seed + 1);
    gameRef.current = s;
    fxRef.current = { parts: [], pops: [], shakeT: 0, shakeAmp: 0, windFlash: 0 };
    accRef.current = 0;
    inputRef.current.keys.clear();
    inputRef.current.pointers.clear();
    fpsRef.current = { frames: 0, since: 0 };
    setResult(null);
    setScreen('playing');
    screenRef.current = 'playing';
    snd.start();
    announce(COPY[langRef.current].say.start, true);
    requestAnimationFrame(() => {
      const st = stageRef.current;
      if (!st) return;
      st.focus({ preventScroll: true });
      st.scrollIntoView({ block: 'nearest', behavior: calmRef.current ? 'auto' : 'smooth' });
    });
  }, [announce, muted, worldW]);

  const pause = useCallback(() => {
    if (screenRef.current !== 'playing') return;
    inputRef.current.keys.clear();
    inputRef.current.pointers.clear();
    setScreen('paused');
    screenRef.current = 'paused';
  }, []);
  const resume = useCallback(() => {
    if (screenRef.current !== 'paused') return;
    sfx().unlock();
    lastRef.current = 0;
    setScreen('playing');
    screenRef.current = 'playing';
    requestAnimationFrame(() => stageRef.current?.focus({ preventScroll: true }));
  }, []);
  const toMenu = useCallback(() => {
    ambient();
    setScreen('menu');
    screenRef.current = 'menu';
  }, [ambient]);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const next = !m;
      save(K.mute, next ? '1' : '0');
      if (!next) sfx().unlock();
      return next;
    });
  }, []);
  const toggleCalm = useCallback(() => {
    setCalm((c) => {
      const next = !c;
      save(K.calm, next ? '1' : '0');
      return next;
    });
  }, []);
  const pickLang = (l: Lang) => {
    setLang(l);
    save(K.lang, l);
  };
  const updateLook = (patch: Partial<KiteLook>) => {
    setLook((lk) => {
      const next = { ...lk, ...patch };
      save(K.look, JSON.stringify(next));
      if (gameRef.current) gameRef.current.player.look = next;
      return next;
    });
  };

  // ----- input -----
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const scr = screenRef.current;
      const tag = (e.target as HTMLElement | null)?.tagName;
      const onControl = tag === 'BUTTON' || tag === 'INPUT' || tag === 'A' || tag === 'SELECT' || tag === 'TEXTAREA';
      if (scr === 'playing') {
        if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
          if (onControl && e.code === 'Space') return;
          e.preventDefault();
          inputRef.current.keys.add(e.code);
          return;
        }
        if (e.code === 'KeyP' || e.code === 'Escape') {
          e.preventDefault();
          pause();
          return;
        }
      } else if (scr === 'paused' && (e.code === 'KeyP' || e.code === 'Escape')) {
        e.preventDefault();
        resume();
        return;
      }
      if (e.code === 'KeyM' && !onControl && (scr === 'playing' || scr === 'paused')) toggleMute();
    };
    const up = (e: KeyboardEvent) => {
      inputRef.current.keys.delete(e.code);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [pause, resume, toggleMute]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (screenRef.current !== 'playing') return;
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    sfx().unlock();
    inputRef.current.pointers.add(e.pointerId);
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* fine */
    }
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    inputRef.current.pointers.delete(e.pointerId);
  };

  // ----- share -----
  const share = useCallback(async () => {
    if (!result) return;
    const tt = COPY[langRef.current];
    const L = langRef.current;
    setShareMsg(tt.sharing);
    try {
      await document.fonts?.ready;
    } catch {
      /* draw anyway */
    }
    const c = document.createElement('canvas');
    c.width = 1080;
    c.height = 1080;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    drawShareCard(ctx, {
      look: lookRef.current,
      title: tt.title,
      big: num(result.score, L),
      line: `${tt.cuts}: ${num(result.cuts, L)} · ${tt.loot}: ${num(result.loots, L)}`,
      foot: 'martnepali.com/work/kite',
      font,
    });
    const blob: Blob | null = await new Promise((res) => c.toBlob(res, 'image/png'));
    if (!blob) {
      setShareMsg('');
      return;
    }
    const file = new File([blob], 'changa-chet-score.png', { type: 'image/png' });
    const text = tt.shareText(num(result.score, L), num(result.cuts, L));
    const url = 'https://www.martnepali.com/work/kite';
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (nav.share && nav.canShare?.({ files: [file] })) {
      try {
        await nav.share({ files: [file], title: tt.title, text: `${text} ${url}` });
        setShareMsg('');
        return;
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') {
          setShareMsg('');
          return;
        }
      }
    }
    const a = document.createElement('a');
    const href = URL.createObjectURL(blob);
    a.href = href;
    a.download = 'changa-chet-score.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 4000);
    setShareMsg(tt.saved);
  }, [result, font]);

  // ----- render -----
  const playingLike = screen === 'playing' || screen === 'paused';
  return (
    <div className="kt" lang={lang} translate="no" style={{ '--kt-font': font } as CSSProperties}>
      <div className="kt-bar">
        <div className="kt-brand">
          <KiteSwatch look={look} size={40} angle={0.2} />
          <div>
            <h1 className="kt-title">{t.title}</h1>
            <p className="kt-tag">{t.tagline}</p>
          </div>
        </div>
        <div className="kt-tools">
          <div className="kt-langs" role="group" aria-label={t.langLabel}>
            {LANGS.map((l) => (
              <button key={l.id} type="button" lang={l.id} className={lang === l.id ? 'is-on' : ''} aria-pressed={lang === l.id} onClick={() => pickLang(l.id)}>
                {l.label}
              </button>
            ))}
          </div>
          <button type="button" className={`kt-chip${calm ? ' is-on' : ''}`} aria-pressed={calm} onClick={toggleCalm} title={t.calmHint}>
            <span aria-hidden="true">{calm ? '◐' : '○'}</span> {t.calm}
          </button>
          <button type="button" className={`kt-chip${muted ? '' : ' is-on'}`} aria-pressed={!muted} onClick={toggleMute}>
            <span aria-hidden="true">{muted ? '🔇' : '🔊'}</span> {muted ? t.soundOff : t.sound}
          </button>
          {playingLike && (
            <button type="button" className="kt-chip kt-pause" onClick={screen === 'paused' ? resume : pause}>
              <span aria-hidden="true">{screen === 'paused' ? '▶' : '❚❚'}</span> {screen === 'paused' ? t.resume : t.pause}
            </button>
          )}
        </div>
      </div>

      <div
        ref={stageRef}
        className={`kt-stage${screen === 'playing' ? ' is-playing' : ''}`}
        tabIndex={0}
        role="group"
        aria-label={t.stageLabel}
        aria-describedby="kt-how"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onLostPointerCapture={onPointerUp}
        onContextMenu={(e) => e.preventDefault()}
      >
        <canvas ref={canvasRef} className="kt-canvas" role="img" aria-label={t.canvasLabel} />

        {screen === 'menu' && (
          <div className="kt-over">
            <div className="kt-panel kt-start">
              <h2>{t.title}</h2>
              <p className="kt-panel-sub">{t.tagline}</p>
              <ol className="kt-how-list">
                {t.how.map((h, i) => (
                  <li key={i}>{h}</li>
                ))}
              </ol>
              <div className="kt-start-row">
                <button type="button" className="kt-kitebtn" onClick={() => setScreen('custom')}>
                  <KiteSwatch look={look} size={52} />
                  <span>{t.yourKite}</span>
                </button>
                <button type="button" className="kt-go" onClick={start}>
                  {t.play}
                </button>
              </div>
              {best > 0 && <p className="kt-best">{t.best(num(best, lang))}</p>}
            </div>
          </div>
        )}

        {screen === 'custom' && (
          <div className="kt-over">
            <div className="kt-panel kt-custom">
              <div className="kt-custom-head">
                <KiteSwatch look={look} size={84} label={`${t.yourKite}: ${t.patterns[look.pattern]}`} />
                <h2>{t.yourKite}</h2>
              </div>
              <fieldset className="kt-field">
                <legend>{t.colour}</legend>
                <div className="kt-swatches">
                  {PALETTE.map((c, i) => (
                    <button
                      key={c}
                      type="button"
                      className={`kt-sw${look.main === c ? ' is-on' : ''}`}
                      style={{ '--c': c } as CSSProperties}
                      aria-pressed={look.main === c}
                      aria-label={t.colourName(i)}
                      onClick={() => updateLook({ main: c, accent: look.accent === c ? (c === PALETTE[7] ? PALETTE[8] : PALETTE[7]) : look.accent })}
                    />
                  ))}
                </div>
              </fieldset>
              <fieldset className="kt-field">
                <legend>{t.accent}</legend>
                <div className="kt-swatches">
                  {PALETTE.map((c, i) => (
                    <button
                      key={c}
                      type="button"
                      className={`kt-sw${look.accent === c ? ' is-on' : ''}`}
                      style={{ '--c': c } as CSSProperties}
                      aria-pressed={look.accent === c}
                      aria-label={t.colourName(i)}
                      disabled={look.main === c}
                      onClick={() => updateLook({ accent: c })}
                    />
                  ))}
                </div>
              </fieldset>
              <fieldset className="kt-field">
                <legend>{t.pattern}</legend>
                <div className="kt-patterns">
                  {PATTERNS.map((pt) => (
                    <button key={pt} type="button" className={`kt-pat${look.pattern === pt ? ' is-on' : ''}`} aria-pressed={look.pattern === pt} onClick={() => updateLook({ pattern: pt })}>
                      <KiteSwatch look={{ ...look, pattern: pt }} size={40} angle={0} />
                      <span>{t.patterns[pt]}</span>
                    </button>
                  ))}
                </div>
              </fieldset>
              <div className="kt-row">
                <button type="button" className="kt-btn" onClick={() => setScreen('menu')}>
                  {t.done}
                </button>
                <button type="button" className="kt-go" onClick={start}>
                  {t.play}
                </button>
              </div>
            </div>
          </div>
        )}

        {screen === 'paused' && (
          <div className="kt-over">
            <div className="kt-panel kt-small">
              <h2>{t.paused}</h2>
              <div className="kt-col">
                <button type="button" className="kt-go" onClick={resume} autoFocus>
                  {t.resume}
                </button>
                <button type="button" className="kt-btn" onClick={start}>
                  {t.restart}
                </button>
                <button type="button" className="kt-btn" onClick={toMenu}>
                  {t.menu}
                </button>
              </div>
            </div>
          </div>
        )}

        {screen === 'over' && result && (
          <div className="kt-over">
            <div className="kt-panel kt-result">
              <h2>{result.reason === 'time' ? t.timeUp : t.outOfKites}</h2>
              <p className="kt-score">{num(result.score, lang)}</p>
              {result.newBest ? <p className="kt-newbest">{t.newBest}</p> : <p className="kt-best">{t.best(num(best, lang))}</p>}
              <dl className="kt-stats">
                <div>
                  <dt>{t.cuts}</dt>
                  <dd>{num(result.cuts, lang)}</dd>
                </div>
                <div>
                  <dt>{t.loot}</dt>
                  <dd>{num(result.loots, lang)}</dd>
                </div>
                <div>
                  <dt>{t.bestCombo}</dt>
                  <dd>×{num(Math.max(1, result.bestCombo), lang)}</dd>
                </div>
              </dl>
              {result.bonus > 0 && <p className="kt-bonus">{t.bonus(num(result.bonus, lang))}</p>}
              <div className="kt-row">
                <button type="button" className="kt-go" onClick={start} autoFocus>
                  {t.playAgain}
                </button>
                <button type="button" className="kt-btn" onClick={share}>
                  {t.share}
                </button>
                <button type="button" className="kt-btn" onClick={() => setScreen('custom')}>
                  {t.yourKite}
                </button>
              </div>
              <p className="kt-sharemsg" role="status">
                {shareMsg}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="kt-below">
        <p id="kt-how" className="kt-how">
          {t.description}
        </p>
        <p className="kt-keys">{t.keys}</p>
      </div>
      <p className="kt-sr" aria-live="polite">
        {say}
      </p>
    </div>
  );
}

// ---------- the heads-up display (screen pixels) ----------

function drawHud(ctx: CanvasRenderingContext2D, s: GameState, cssW: number, t: KiteCopy, L: Lang, font: string, windFlash: number, look: KiteLook) {
  const fs = Math.max(13, Math.min(20, cssW / 30));
  const pad = Math.max(8, fs * 0.6);
  ctx.save();
  ctx.textBaseline = 'alphabetic';
  const pill = (x: number, y: number, w: number, h: number, fill: string) => {
    ctx.fillStyle = fill;
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, w, h, h / 2);
    else ctx.rect(x, y, w, h);
    ctx.fill();
  };
  // Score (left).
  ctx.textAlign = 'left';
  ctx.font = `700 ${fs * 0.7}px ${font}`;
  const scoreText = num(s.score, L);
  ctx.font = `800 ${fs * 1.35}px ${font}`;
  const sw = Math.max(ctx.measureText(scoreText).width, fs * 3) + pad * 1.6;
  pill(pad, pad, sw, fs * 2.6, 'rgba(20,18,40,0.55)');
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.font = `700 ${fs * 0.66}px ${font}`;
  ctx.fillText(t.score, pad + pad * 0.8, pad + fs * 0.95);
  ctx.fillStyle = '#fff';
  ctx.font = `800 ${fs * 1.35}px ${font}`;
  ctx.fillText(scoreText, pad + pad * 0.8, pad + fs * 2.25);
  if (s.combo > 1 && s.comboT > 0) {
    const cy = pad + fs * 2.6 + 6;
    const label = `×${num(s.combo, L)} ${t.combo}`;
    ctx.font = `800 ${fs * 0.9}px ${font}`;
    const cw = ctx.measureText(label).width + pad * 1.4;
    pill(pad, cy, cw, fs * 1.5, 'rgba(255,190,40,0.9)');
    ctx.fillStyle = '#3b1d00';
    ctx.fillText(label, pad + pad * 0.7, cy + fs * 1.07);
    ctx.fillStyle = 'rgba(59,29,0,0.5)';
    ctx.fillRect(pad + pad * 0.7, cy + fs * 1.25, (cw - pad * 1.4) * (s.comboT / COMBO_S), 2);
  }
  // Time (centre) and wind.
  const left = timeLeft(s);
  const tt = clock(left, L);
  ctx.textAlign = 'center';
  ctx.font = `800 ${fs * 1.2}px ${font}`;
  const tw = ctx.measureText(tt).width + pad * 2;
  pill(cssW / 2 - tw / 2, pad, tw, fs * 1.8, left <= 10 && s.phase === 'playing' ? 'rgba(214,58,47,0.9)' : 'rgba(20,18,40,0.55)');
  ctx.fillStyle = '#fff';
  ctx.fillText(tt, cssW / 2, pad + fs * 1.3);
  const arrows = s.wind >= 0 ? '→'.repeat(1 + Math.min(2, Math.floor(Math.abs(s.wind) / 45))) : '←'.repeat(1 + Math.min(2, Math.floor(Math.abs(s.wind) / 45)));
  ctx.font = `700 ${fs * (windFlash > 0 ? 0.85 : 0.7)}px ${font}`;
  ctx.fillStyle = windFlash > 0 ? '#fff6c8' : 'rgba(255,255,255,0.85)';
  ctx.strokeStyle = 'rgba(20,18,40,0.6)';
  ctx.lineWidth = 3;
  const wt = `${t.wind} ${arrows}`;
  ctx.strokeText(wt, cssW / 2, pad + fs * 2.75);
  ctx.fillText(wt, cssW / 2, pad + fs * 2.75);
  // Kites left and string strength (right).
  const r = fs * 0.42;
  const boxW = Math.max(LIVES * r * 2.6 + pad, fs * 5.4);
  const bx = cssW - pad - boxW;
  pill(bx, pad, boxW, fs * 2.9, 'rgba(20,18,40,0.55)');
  for (let i = 0; i < LIVES; i++) {
    ctx.globalAlpha = i < s.lives ? 1 : 0.25;
    drawKite(ctx, bx + pad * 0.8 + r + i * r * 2.6, pad + fs * 0.75, 0, look, r, { simple: true });
  }
  ctx.globalAlpha = 1;
  const barX = bx + pad * 0.8;
  const barW = boxW - pad * 1.6;
  const barY = pad + fs * 2.25;
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(barX, barY, barW, 5);
  const v = s.flying ? s.player.strength : 0;
  ctx.fillStyle = v > 0.6 ? '#57e39b' : v > 0.3 ? '#ffc94a' : '#ff6b5b';
  ctx.fillRect(barX, barY, barW * v, 5);
  ctx.textAlign = 'left';
  ctx.font = `700 ${fs * 0.55}px ${font}`;
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText(t.string, barX, barY - 3);
  ctx.restore();
}
