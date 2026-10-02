import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/**
 * The event hero's WebGL stage: the event's own cover printed on a glossy,
 * holographic 3D ticket, floating in a field of light that matches the page's
 * layout. Loaded on demand by HoloStage (its own chunk — shops and every other
 * page never download three.js).
 *
 * It follows the mouse, can be spun by dragging sideways (with inertia), turns
 * and rises away as the hero scrolls off, and stops rendering entirely while
 * the hero is off screen or the tab is hidden.
 *
 * Returns a cleanup function, or null when WebGL is not available — the CSS
 * scene (HeroDepth) then simply stays.
 */

export type HoloLayout = 'classic' | 'poster' | 'festival' | 'editorial' | 'neon';

export interface HoloOptions {
  layout: HoloLayout;
  cover: string | null;
  /** The same picture uncropped — the ticket shows the WHOLE poster. */
  poster: string | null;
  title: string;
  kicker: string;
  place: string;
  day: string;
  month: string;
  weekday: string;
  price: string;
  accent: string;
  pink: string;
  font: string;
}

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

/** A ticket outline: rounded corners, a notch top and bottom at the tear line. */
function ticketShape(w: number, h: number, tear: number, portrait: boolean) {
  const r = Math.min(w, h) * 0.06;
  const n = Math.min(w, h) * 0.07;
  const s = new THREE.Shape();
  const x0 = -w / 2;
  const y0 = -h / 2;
  const x1 = w / 2;
  const y1 = h / 2;
  if (!portrait) {
    const px = x0 + w * tear;
    s.moveTo(x0 + r, y0);
    s.lineTo(px - n, y0);
    s.absarc(px, y0, n, Math.PI, 0, true);
    s.lineTo(x1 - r, y0);
    s.quadraticCurveTo(x1, y0, x1, y0 + r);
    s.lineTo(x1, y1 - r);
    s.quadraticCurveTo(x1, y1, x1 - r, y1);
    s.lineTo(px + n, y1);
    s.absarc(px, y1, n, 0, Math.PI, true);
    s.lineTo(x0 + r, y1);
    s.quadraticCurveTo(x0, y1, x0, y1 - r);
    s.lineTo(x0, y0 + r);
    s.quadraticCurveTo(x0, y0, x0 + r, y0);
  } else {
    // Portrait (poster layout): the stub is at the bottom, notches on the sides
    // exactly where it tears off. `tear` is the stub's share, from the bottom.
    const py = y0 + h * tear;
    s.moveTo(x0 + r, y0);
    s.lineTo(x1 - r, y0);
    s.quadraticCurveTo(x1, y0, x1, y0 + r);
    s.lineTo(x1, py - n);
    s.absarc(x1, py, n, -Math.PI / 2, Math.PI / 2, true);
    s.lineTo(x1, y1 - r);
    s.quadraticCurveTo(x1, y1, x1 - r, y1);
    s.lineTo(x0 + r, y1);
    s.quadraticCurveTo(x0, y1, x0, y1 - r);
    s.lineTo(x0, py + n);
    s.absarc(x0, py, n, Math.PI / 2, -Math.PI / 2, true);
    s.lineTo(x0, y0 + r);
    s.quadraticCurveTo(x0, y0, x0 + r, y0);
  }
  return s;
}

/** Deterministic 0…1 from a string — the barcode looks the same every visit. */
function seeded(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxW: number, size: number, weight: string, font: string) {
  let s = size;
  ctx.font = `${weight} ${s}px ${font}`;
  while (s > 18 && ctx.measureText(text).width > maxW) {
    s -= 4;
    ctx.font = `${weight} ${s}px ${font}`;
  }
  return s;
}

/**
 * Where everything sits on the face, in face units. The picture window takes
 * the picture's OWN proportions, so the poster is shown whole — never cropped
 * to fit a fixed ticket. Under it a caption band carries the name (printing
 * the title over the poster hid the poster's own lettering), and the stub
 * holds the date: beside it on a landscape ticket, below on a portrait one.
 */
interface FacePlan {
  portrait: boolean;
  w: number;
  h: number;
  /** The stub's share of the width (landscape) or height from the bottom (portrait). */
  tear: number;
  pic: { x: number; y: number; w: number; h: number };
  cap: { x: number; y: number; w: number; h: number };
  stub: { x: number; y: number; w: number; h: number };
}

function planFace(portrait: boolean, aspect: number): FacePlan {
  if (portrait) {
    const a = clamp(aspect, 0.55, 2.2);
    const picH = 1 / a;
    const capH = 0.2;
    const stubH = 0.3;
    const h = picH + capH + stubH;
    return {
      portrait,
      w: 1,
      h,
      tear: stubH / h,
      pic: { x: 0, y: 0, w: 1, h: picH },
      cap: { x: 0, y: picH, w: 1, h: capH },
      stub: { x: 0, y: picH + capH, w: 1, h: stubH },
    };
  }
  const a = clamp(aspect, 0.6, 2.6);
  const capH = 0.24;
  const h = 1 + capH;
  const stubW = 0.46 * h;
  const w = a + stubW;
  return {
    portrait,
    w,
    h,
    tear: a / w,
    pic: { x: 0, y: 0, w: a, h: 1 },
    cap: { x: 0, y: 1, w: a, h: capH },
    stub: { x: a, y: 0, w: stubW, h },
  };
}

type Rect = { x: number; y: number; w: number; h: number };

/** Paints the face: the whole picture, the caption band, the stub. */
function paintFace(canvas: HTMLCanvasElement, o: HoloOptions, img: HTMLImageElement | null, plan: FacePlan) {
  const ctx = canvas.getContext('2d')!;
  const W = canvas.width;
  const H = canvas.height;
  const k = W / plan.w;
  const px = (r: Rect): Rect => ({ x: r.x * k, y: r.y * k, w: r.w * k, h: r.h * k });
  const pic = px(plan.pic);
  const cap = px(plan.cap);
  const stub = px(plan.stub);
  ctx.clearRect(0, 0, W, H);

  // The picture — or, without one, the page's colours with a few soft rings.
  const bg = ctx.createLinearGradient(pic.x, pic.y, pic.x + pic.w, pic.y + pic.h);
  bg.addColorStop(0, '#0b0714');
  bg.addColorStop(0.55, o.accent);
  bg.addColorStop(1, o.pink);
  ctx.fillStyle = bg;
  ctx.fillRect(pic.x, pic.y, pic.w, pic.h);
  if (img && img.naturalWidth) {
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    const fill = Math.max(pic.w / iw, pic.h / ih);
    const fit = Math.min(pic.w / iw, pic.h / ih);
    // The window already has the picture's shape, so this only differs for an
    // extreme strip: then the gaps are a blurred copy, never a crop.
    if (fill / fit > 1.02) {
      ctx.save();
      ctx.filter = 'blur(24px) brightness(0.55)';
      ctx.drawImage(img, pic.x + (pic.w - iw * fill) / 2, pic.y + (pic.h - ih * fill) / 2, iw * fill, ih * fill);
      ctx.restore();
    }
    ctx.save();
    ctx.beginPath();
    ctx.rect(pic.x, pic.y, pic.w, pic.h);
    ctx.clip();
    ctx.drawImage(img, pic.x + (pic.w - iw * fit) / 2, pic.y + (pic.h - ih * fit) / 2, iw * fit, ih * fit);
    ctx.restore();
  } else {
    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    for (let i = 1; i < 9; i++) {
      ctx.beginPath();
      ctx.arc(pic.x + pic.w * 0.8, pic.y + pic.h * 0.1, i * pic.w * 0.09, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // The caption band: dark, a thin line of the page's colour along its top.
  const cg = ctx.createLinearGradient(cap.x, cap.y, cap.x + cap.w, cap.y + cap.h);
  cg.addColorStop(0, '#0d0918');
  cg.addColorStop(1, '#1a1030');
  ctx.fillStyle = cg;
  ctx.fillRect(cap.x, cap.y, cap.w, cap.h);
  const line = ctx.createLinearGradient(cap.x, 0, cap.x + cap.w, 0);
  line.addColorStop(0, o.accent);
  line.addColorStop(1, o.pink);
  ctx.fillStyle = line;
  ctx.fillRect(cap.x, cap.y, cap.w, Math.max(3, cap.h * 0.025));

  const pad = cap.h * 0.2;
  const textW = cap.w - pad * 2;
  ctx.textBaseline = 'alphabetic';
  const letter = (v: string) => {
    if ('letterSpacing' in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = v;
  };
  if (o.kicker) {
    letter(`${Math.round(cap.h * 0.02)}px`);
    fitText(ctx, o.kicker.toUpperCase(), textW, Math.round(cap.h * 0.13), '800', o.font);
    ctx.fillStyle = o.accent;
    ctx.fillText(o.kicker.toUpperCase(), cap.x + pad, cap.y + cap.h * 0.3);
    letter('0px');
  }
  const ts = fitText(ctx, o.title, textW, Math.round(cap.h * 0.32), '900', o.font);
  ctx.fillStyle = '#fff';
  ctx.fillText(o.title, cap.x + pad, cap.y + cap.h * 0.3 + ts * 0.95);
  if (o.place) {
    fitText(ctx, o.place, textW, Math.round(cap.h * 0.13), '600', o.font);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText(o.place, cap.x + pad, cap.y + cap.h * 0.86);
  }

  // The stub — the page's two colours, the date large, a barcode.
  const sg = ctx.createLinearGradient(stub.x, stub.y, stub.x + stub.w, stub.y + stub.h);
  sg.addColorStop(0, o.accent);
  sg.addColorStop(1, o.pink);
  ctx.fillStyle = sg;
  ctx.fillRect(stub.x, stub.y, stub.w, stub.h);
  ctx.save();
  ctx.beginPath();
  ctx.rect(stub.x, stub.y, stub.w, stub.h);
  ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  for (let i = -stub.h; i < stub.w + stub.h; i += 26) {
    ctx.beginPath();
    ctx.moveTo(stub.x + i, stub.y);
    ctx.lineTo(stub.x + i + 12, stub.y);
    ctx.lineTo(stub.x + i + 12 - stub.h, stub.y + stub.h);
    ctx.lineTo(stub.x + i - stub.h, stub.y + stub.h);
    ctx.fill();
  }
  ctx.restore();

  const rnd = seeded(o.title + o.day);
  const bars = (x0: number, x1: number, y: number, h: number) => {
    let x = x0;
    while (x < x1) {
      const bw = 2 + Math.floor(rnd() * 7);
      if (rnd() > 0.35) ctx.fillRect(x, y, Math.min(bw, x1 - x), h);
      x += bw + 3;
    }
  };
  ctx.fillStyle = '#fff';
  if (plan.portrait) {
    // Date on the left; ADMIT ONE, the price and the barcode stacked on the
    // right, each on its own row.
    const lx = stub.x + stub.w * 0.2;
    ctx.textAlign = 'center';
    ctx.font = `900 ${Math.round(stub.h * 0.46)}px ${o.font}`;
    ctx.fillText(o.day || '★', lx, stub.y + stub.h * 0.6);
    ctx.font = `800 ${Math.round(stub.h * 0.14)}px ${o.font}`;
    ctx.fillText(`${o.weekday} ${o.month}`.trim().toUpperCase(), lx, stub.y + stub.h * 0.82);
    ctx.textAlign = 'left';
    const rx = stub.x + stub.w * 0.42;
    const rw = stub.w * 0.5;
    fitText(ctx, 'ADMIT ONE', rw, Math.round(stub.h * 0.17), '900', o.font);
    ctx.fillText('ADMIT ONE', rx, stub.y + stub.h * 0.32);
    if (o.price) {
      fitText(ctx, o.price, rw, Math.round(stub.h * 0.12), '700', o.font);
      ctx.fillStyle = 'rgba(255,255,255,0.88)';
      ctx.fillText(o.price, rx, stub.y + stub.h * 0.52);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    bars(rx, rx + rw, stub.y + stub.h * 0.62, stub.h * 0.22);
  } else {
    const cx = stub.x + stub.w / 2;
    const u = Math.min(stub.w, stub.h * 0.5);
    ctx.textAlign = 'center';
    ctx.font = `800 ${Math.round(u * 0.12)}px ${o.font}`;
    ctx.fillText((o.weekday || 'ADMIT').toUpperCase(), cx, stub.y + stub.h * 0.2);
    ctx.font = `900 ${Math.round(u * 0.44)}px ${o.font}`;
    ctx.fillText(o.day || '1', cx, stub.y + stub.h * 0.46);
    ctx.font = `800 ${Math.round(u * 0.13)}px ${o.font}`;
    ctx.fillText((o.month || 'ONE').toUpperCase(), cx, stub.y + stub.h * 0.57);
    if (o.price) {
      fitText(ctx, o.price, stub.w * 0.8, Math.round(u * 0.09), '700', o.font);
      ctx.fillText(o.price, cx, stub.y + stub.h * 0.68);
    }
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    let y = stub.y + stub.h * 0.76;
    const end = stub.y + stub.h * 0.92;
    while (y < end) {
      const bh = 2 + Math.floor(rnd() * 5);
      if (rnd() > 0.35) ctx.fillRect(stub.x + stub.w * 0.16, y, stub.w * 0.68, bh);
      y += bh + 3;
    }
  }
  ctx.textAlign = 'left';

  // The tear line.
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 4;
  ctx.setLineDash([14, 12]);
  ctx.beginPath();
  if (plan.portrait) {
    ctx.moveTo(0, stub.y);
    ctx.lineTo(W, stub.y);
  } else {
    ctx.moveTo(stub.x, 0);
    ctx.lineTo(stub.x, H);
  }
  ctx.stroke();
  ctx.setLineDash([]);
}

/** The palette of the field of light around the ticket, per layout. */
function fieldColours(o: HoloOptions): THREE.Color[] {
  switch (o.layout) {
    case 'neon':
      return ['#22d3ee', '#ec4899', '#a855f7', '#f0abfc'].map((c) => new THREE.Color(c));
    case 'festival':
      return ['#fde047', '#f97316', '#ec4899', '#a855f7', '#22c55e', '#38bdf8'].map((c) => new THREE.Color(c));
    case 'editorial':
      return ['#e9d3a4', '#f6efe4', '#c9a86a'].map((c) => new THREE.Color(c));
    default:
      return [o.accent, o.pink, '#ffffff'].map((c) => new THREE.Color(c));
  }
}

export function startHolo(host: HTMLElement, hero: HTMLElement, o: HoloOptions): (() => void) | null {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch {
    return null;
  }
  const touch = window.matchMedia('(pointer: coarse)').matches;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, touch ? 1.5 : 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x000000, 0);
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0, 9);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;

  const accent = new THREE.Color(o.accent);
  const pink = new THREE.Color(o.pink);
  const edgeColour = o.layout === 'neon' ? new THREE.Color('#22d3ee') : o.layout === 'editorial' ? new THREE.Color('#e9d3a4') : accent;

  // ---------------- The ticket ----------------
  //
  // Built once the poster has loaded (or given up on), because its shape IS
  // the poster's shape. Until then the field of light plays on its own.
  const portrait = o.layout === 'poster';
  const depth = 0.05;
  let TW = portrait ? 2.6 : 4.6;
  let TH = portrait ? 3.7 : 2;
  let tear = 0.3;
  let ticketReady = false;
  const faceCanvas = document.createElement('canvas');
  const faceTex = new THREE.CanvasTexture(faceCanvas);
  faceTex.colorSpace = THREE.SRGBColorSpace;
  faceTex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  const holoUniforms = {
    map: { value: faceTex },
    time: { value: 0 },
    accent: { value: accent },
    pink: { value: pink },
    tearAt: { value: tear },
    portrait: { value: portrait ? 1 : 0 },
  };
  const faceMat = new THREE.ShaderMaterial({
    uniforms: holoUniforms,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = -mv.xyz;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D map;
      uniform float time;
      uniform vec3 accent;
      uniform vec3 pink;
      uniform float tearAt;
      uniform float portrait;
      varying vec2 vUv;
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        vec4 base = texture2D(map, vUv);
        float facing = abs(dot(normalize(vN), normalize(vV)));
        float fres = pow(1.0 - facing, 2.2);
        // Rainbow foil that shifts with the viewing angle — strong on the
        // stub, only a breath over the picture so the poster stays true.
        vec3 irid = 0.5 + 0.5 * cos(6.2831 * (vec3(0.0, 0.33, 0.67) + fres * 1.8 + vUv.x * 0.9 + vUv.y * 0.5 + time * 0.04));
        float onStub = portrait > 0.5 ? step(vUv.y, tearAt) : step(tearAt, vUv.x);
        float foil = mix(0.03, 0.22, onStub) + fres * 0.45;
        // A blade of light that crosses the ticket every few seconds.
        float band = vUv.x * 0.8 + vUv.y * 0.45 - mod(time * 0.32, 3.2) + 0.6;
        float blade = smoothstep(0.05, 0.0, abs(band)) * mix(0.14, 0.26, onStub);
        // Fine holographic lines.
        float lines = (0.5 + 0.5 * sin((vUv.y * 420.0) + time * 2.0)) * 0.035 * onStub;
        vec3 col = base.rgb + irid * foil * 0.55 + vec3(blade) + lines;
        col += mix(accent, pink, vUv.x) * fres * 0.3;
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const edgeMat = new THREE.MeshStandardMaterial({
    color: o.layout === 'editorial' ? new THREE.Color('#c9a86a') : accent.clone().lerp(new THREE.Color('#ffffff'), 0.25),
    metalness: 1,
    roughness: 0.22,
    emissive: edgeColour,
    emissiveIntensity: 0.35,
  });
  const outlineMat = new THREE.LineBasicMaterial({
    color: edgeColour,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
  });
  const glowCanvas = document.createElement('canvas');
  glowCanvas.width = glowCanvas.height = 128;
  {
    const g = glowCanvas.getContext('2d')!;
    const rg = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    rg.addColorStop(0, 'rgba(255,255,255,0.9)');
    rg.addColorStop(0.35, 'rgba(255,255,255,0.35)');
    rg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = rg;
    g.fillRect(0, 0, 128, 128);
  }
  const glowTex = new THREE.CanvasTexture(glowCanvas);
  const haloMat = new THREE.MeshBasicMaterial({
    map: glowTex,
    color: edgeColour,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const rig = new THREE.Group(); // scroll + entrance
  const spinner = new THREE.Group(); // mouse, drag, idle
  rig.add(spinner);
  scene.add(rig);
  const built: THREE.BufferGeometry[] = [];

  const buildTicket = (img: HTMLImageElement | null) => {
    const aspect = img && img.naturalWidth ? img.naturalWidth / img.naturalHeight : portrait ? 0.72 : 2.16;
    const plan = planFace(portrait, aspect);
    // World size: a landscape ticket about 4.6 wide, a portrait one 3.7 tall.
    const k = 1 / Math.max(plan.w / 4.6, plan.h / (portrait ? 3.7 : 2.4));
    TW = plan.w * k;
    TH = plan.h * k;
    tear = plan.tear;
    holoUniforms.tearAt.value = tear;

    const shape = ticketShape(TW, TH, tear, portrait);
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: true,
      bevelThickness: 0.025,
      bevelSize: 0.025,
      bevelSegments: 4,
      curveSegments: 28,
    });
    geo.translate(0, 0, -depth / 2);
    // Face UVs from position, so the printed face maps edge to edge; the back
    // is mirrored so it reads the right way round when the ticket spins.
    const pos = geo.attributes.position;
    const uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const u = (pos.getX(i) + TW / 2) / TW;
      const v = (pos.getY(i) + TH / 2) / TH;
      uv.setXY(i, pos.getZ(i) < 0 ? 1 - u : u, v);
    }
    uv.needsUpdate = true;

    const long = 2048;
    faceCanvas.width = plan.w >= plan.h ? long : Math.round((long * plan.w) / plan.h);
    faceCanvas.height = Math.round((faceCanvas.width * plan.h) / plan.w);
    paintFace(faceCanvas, o, img, plan);
    faceTex.needsUpdate = true;

    const outlineGeo = new THREE.BufferGeometry().setFromPoints(
      shape.getPoints(48).map((p) => new THREE.Vector3(p.x, p.y, depth / 2 + 0.032))
    );
    const haloGeo = new THREE.PlaneGeometry(TW * 2.1, TH * 2.3);
    built.push(geo, outlineGeo, haloGeo);
    const halo = new THREE.Mesh(haloGeo, haloMat);
    halo.position.z = -0.6;
    spinner.add(new THREE.Mesh(geo, [faceMat, edgeMat]), new THREE.LineLoop(outlineGeo, outlineMat));
    rig.add(halo);
    ticketReady = true;
    layoutStage();
  };

  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(3, 4, 6);
  scene.add(key, new THREE.AmbientLight(0xffffff, 0.35));

  // ---------------- The field of light ----------------
  const N = touch ? 650 : 1600;
  const pts = new Float32Array(N * 3);
  const cols = new Float32Array(N * 3);
  const seeds = new Float32Array(N);
  const palette = fieldColours(o);
  const rnd = seeded(o.title);
  for (let i = 0; i < N; i++) {
    pts[i * 3] = (rnd() - 0.5) * 26;
    pts[i * 3 + 1] = (rnd() - 0.5) * 15;
    pts[i * 3 + 2] = -14 + rnd() * 17;
    const c = palette[Math.floor(rnd() * palette.length)];
    cols[i * 3] = c.r;
    cols[i * 3 + 1] = c.g;
    cols[i * 3 + 2] = c.b;
    seeds[i] = rnd();
  }
  const fieldGeo = new THREE.BufferGeometry();
  fieldGeo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
  fieldGeo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  fieldGeo.setAttribute('seed', new THREE.BufferAttribute(seeds, 1));
  const fall = o.layout === 'festival' ? 1.0 : o.layout === 'editorial' ? -0.12 : -0.25;
  const fieldMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      time: { value: 0 },
      scale: { value: 1 },
      fall: { value: fall },
      boost: { value: 0 },
    },
    vertexShader: /* glsl */ `
      attribute vec3 color;
      attribute float seed;
      uniform float time;
      uniform float scale;
      uniform float fall;
      uniform float boost;
      varying vec3 vC;
      varying float vA;
      void main() {
        vec3 p = position;
        p.y = mod(p.y - time * fall * (0.4 + seed) + 7.5, 15.0) - 7.5;
        p.x += sin(time * (0.2 + seed * 0.5) + seed * 40.0) * 0.35;
        p.z += boost * 6.0 * seed;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float tw = 0.55 + 0.45 * sin(time * (1.0 + seed * 3.0) + seed * 60.0);
        gl_PointSize = scale * (1.4 + seed * 3.2) * (10.0 / -mv.z);
        vC = color;
        vA = tw * smoothstep(-24.0, -11.0, mv.z);
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vC;
      varying float vA;
      void main() {
        vec2 d = gl_PointCoord - 0.5;
        float r = length(d);
        float a = smoothstep(0.5, 0.0, r);
        a *= a;
        gl_FragColor = vec4(vC * (0.6 + a), a * vA);
      }`,
  });
  const field = new THREE.Points(fieldGeo, fieldMat);
  scene.add(field);

  // Neon: a glowing grid floor running toward the viewer.
  let floor: THREE.Mesh | null = null;
  if (o.layout === 'neon') {
    floor = new THREE.Mesh(
      new THREE.PlaneGeometry(60, 40),
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { time: { value: 0 }, c1: { value: new THREE.Color('#ec4899') }, c2: { value: new THREE.Color('#22d3ee') } },
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: /* glsl */ `
          uniform float time; uniform vec3 c1; uniform vec3 c2; varying vec2 vUv;
          void main(){
            vec2 g = vec2(vUv.x * 60.0, vUv.y * 40.0 + time * 1.6);
            vec2 f = abs(fract(g) - 0.5);
            float line = smoothstep(0.47, 0.5, max(f.x, f.y));
            float fade = smoothstep(0.0, 0.55, vUv.y) * smoothstep(1.0, 0.7, vUv.y);
            vec3 col = mix(c1, c2, vUv.x);
            gl_FragColor = vec4(col * line * 1.4, line * fade * 0.8);
          }`,
      })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, -2.6, -8);
    scene.add(floor);
  }

  // Wait for the picture (the whole poster), then build; give up after a few
  // seconds and print the ticket without it rather than show nothing.
  let disposed = false;
  const src = o.poster || o.cover;
  if (src) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    const giveUp = window.setTimeout(() => {
      if (!disposed && !ticketReady) buildTicket(null);
    }, 6000);
    img.onload = () => {
      window.clearTimeout(giveUp);
      if (disposed) return;
      if (!ticketReady) buildTicket(img);
    };
    img.onerror = () => {
      window.clearTimeout(giveUp);
      if (!disposed && !ticketReady) buildTicket(null);
    };
    img.src = src;
  }

  // ---------------- Layout of the stage ----------------
  let W = 1;
  let H = 1;
  let restX = 0;
  let restY = 0;
  let restScale = 1;
  const layoutStage = () => {
    W = Math.max(1, host.clientWidth);
    H = Math.max(1, host.clientHeight);
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    const visH = 2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const visW = visH * camera.aspect;
    const wide = W > 760;
    if (wide) {
      // Beside the title, on the right.
      const target = Math.min(visW * 0.34, portrait ? 3 : 5);
      restScale = target / TW;
      if (TH * restScale > visH * (portrait ? 0.7 : 0.5)) restScale = (visH * (portrait ? 0.7 : 0.5)) / TH;
      restX = visW * 0.28;
      // Up where the hero is empty; the title sits in its lower half.
      restY = portrait ? 0 : visH * 0.1;
    } else {
      // Phone: the stage is the cover band — the ticket fills it, centred.
      restScale = Math.min((visW * 0.74) / TW, (visH * 0.8) / TH);
      restX = 0;
      restY = 0;
    }
    fieldMat.uniforms.scale.value = renderer.getPixelRatio() * (wide ? 1 : 0.8);
  };
  layoutStage();
  if (!src) buildTicket(null);
  const ro = new ResizeObserver(layoutStage);
  ro.observe(host);

  // ---------------- Input ----------------
  let mx = 0;
  let my = 0;
  let smx = 0;
  let smy = 0;
  let spin = 0;
  let spinVel = 0;
  let dragging = false;
  let lastX = 0;
  const offs: (() => void)[] = [];
  const on = (t: EventTarget, type: string, fn: EventListener, opts?: AddEventListenerOptions) => {
    t.addEventListener(type, fn, opts);
    offs.push(() => t.removeEventListener(type, fn, opts));
  };
  on(hero, 'pointermove', (ev) => {
    const e = ev as PointerEvent;
    const r = hero.getBoundingClientRect();
    if (e.pointerType === 'mouse') {
      mx = ((e.clientX - r.left) / r.width) * 2 - 1;
      my = ((e.clientY - r.top) / r.height) * 2 - 1;
    }
    if (dragging) {
      const dx = e.clientX - lastX;
      lastX = e.clientX;
      spin += dx * 0.012;
      spinVel = dx * 0.012;
    }
  });
  on(hero, 'pointerleave', () => {
    mx = 0;
    my = 0;
  });
  on(hero, 'pointerdown', (ev) => {
    const e = ev as PointerEvent;
    if ((e.target as Element).closest('a, button, input, select, textarea, summary, [role="button"]')) return;
    dragging = true;
    lastX = e.clientX;
  });
  const up = () => {
    dragging = false;
  };
  on(window, 'pointerup', up);
  on(window, 'pointercancel', up);
  // Android tilts it with the phone (iOS asks permission, so it just sways).
  on(window, 'deviceorientation', (ev) => {
    const e = ev as DeviceOrientationEvent;
    if (e.gamma == null || e.beta == null) return;
    mx = clamp(e.gamma / 30, -1, 1);
    my = clamp((e.beta - 45) / 30, -1, 1);
  });

  // ---------------- Loop ----------------
  let visible = true;
  const io = new IntersectionObserver(([en]) => {
    visible = en.isIntersecting;
    if (visible) kick();
  });
  io.observe(hero);
  const onVis = () => {
    if (!document.hidden) kick();
  };
  on(document, 'visibilitychange', onVis);

  let lastNow = performance.now();
  let t = 0;
  let born = 0;
  let raf = 0;
  const tick = () => {
    raf = 0;
    if (disposed || !visible || document.hidden) return;
    const now = performance.now();
    const dt = Math.min((now - lastNow) / 1000, 1 / 20);
    lastNow = now;
    t += dt;
    if (ticketReady) born = Math.min(1, born + dt / 2.2);
    const e = 1 - Math.pow(1 - born, 4);

    const r = hero.getBoundingClientRect();
    const hp = clamp(-r.top / Math.max(r.height, 1));

    smx += (mx - smx) * Math.min(1, dt * 4);
    smy += (my - smy) * Math.min(1, dt * 4);
    if (!dragging) {
      spinVel *= Math.pow(0.04, dt);
      spin += spinVel;
      // Drift back to facing forward once let go.
      const home = Math.round(spin / (Math.PI * 2)) * Math.PI * 2;
      if (Math.abs(spinVel) < 0.002) spin += (home - spin) * Math.min(1, dt * 1.6);
    }

    // Entrance: flies in from deep, turning over once.
    // Scrolling away it sinks back into the room rather than rising over the title.
    rig.position.set(restX + hp * (restX ? 1.2 : 0), restY + hp * 0.5, -7 * (1 - e) - hp * 4);
    rig.scale.setScalar(restScale * (0.55 + 0.45 * e));
    spinner.rotation.set(
      Math.sin(t * 0.7) * 0.07 - smy * 0.32 + hp * 0.5,
      (restX ? -0.32 : -0.12) + Math.sin(t * 0.45) * (touch ? 0.22 : 0.12) + smx * 0.5 + spin - (1 - e) * Math.PI * 1.25 + hp * 1.4,
      Math.sin(t * 0.33) * 0.03 + (1 - e) * 0.4
    );
    spinner.position.y = Math.sin(t * 0.9) * 0.08;
    haloMat.opacity = e * (0.32 + 0.1 * Math.sin(t * 1.4)) * (1 - hp);
    outlineMat.opacity = 0.55 + 0.35 * Math.sin(t * 2.1);

    holoUniforms.time.value = t;
    fieldMat.uniforms.time.value = t;
    fieldMat.uniforms.boost.value = (1 - e) * 1.2 + hp * 0.6;
    field.rotation.y = smx * 0.08 + hp * 0.25;
    field.rotation.x = smy * 0.05;
    if (floor) (floor.material as THREE.ShaderMaterial).uniforms.time.value = t;
    camera.position.x = smx * 0.25;
    camera.position.y = -smy * 0.15;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  };
  const kick = () => {
    if (!raf && !disposed) {
      lastNow = performance.now();
      raf = requestAnimationFrame(tick);
    }
  };
  kick();

  return () => {
    disposed = true;
    if (raf) cancelAnimationFrame(raf);
    offs.forEach((off) => off());
    io.disconnect();
    ro.disconnect();
    built.forEach((g) => g.dispose());
    faceMat.dispose();
    edgeMat.dispose();
    outlineMat.dispose();
    haloMat.dispose();
    faceTex.dispose();
    glowTex.dispose();
    fieldGeo.dispose();
    fieldMat.dispose();
    if (floor) {
      floor.geometry.dispose();
      (floor.material as THREE.Material).dispose();
    }
    envTex.dispose();
    pmrem.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  };
}
