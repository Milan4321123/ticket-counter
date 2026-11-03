'use client';

// /work/booth — an event photo booth an organizer puts on a QR code at the
// door. A guest takes a selfie (or picks a photo, or uses the drawn sample),
// puts it in a festive frame with stickers, and downloads or shares it. The
// organizer side sets the frame, words and logo and prints a QR poster.
//
// Everything stays in the browser: the camera starts only after a tap and is
// stopped as soon as the shots are taken (or the page is hidden / left);
// photos live in a few reused canvases and are never uploaded; the "live
// wall" keeps tiny thumbnails under the one localStorage key. Rules in
// booth.ts, words in content.ts, all painting in draw.ts.

import { useCallback, useEffect, useId, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent, type PointerEvent as RPointerEvent } from 'react';
import {
  FILTER_IDS,
  FORMAT_IDS,
  FRAME_IDS,
  LIMITS,
  NUDGE_KEYS,
  POSTER,
  STICKER_KINDS,
  STRIP_SHOTS,
  addSticker,
  boothUrl,
  clamp,
  cleanTag,
  cleanText,
  dragSticker,
  fileName,
  fitBox,
  handleSticker,
  hitSticker,
  layoutFor,
  layoutId,
  normalizeSaved,
  nudgeSticker,
  onHandle,
  panDelta,
  pinchSticker,
  pushWall,
  readPresetHash,
  shiftLayer,
  stickerBox,
  toCanvas,
  trimToBudget,
  type BoothText,
  type FilterId,
  type FormatId,
  type FrameId,
  type Lang,
  type Saved,
  type ShotMode,
  type Sticker,
  type StickerKind,
  type WallItem,
} from './booth';
import { COPY, DEFAULT_TEXT, LANGS, num, type Copy } from './content';
import { HANDLE_PAD, canvasBlob, drawSample, drawSticker, fontsReady, frameSwatch, renderBooth, renderPhotoLayer, renderPoster, type DrawFonts, type Pic } from './draw';
import { BoothSfx } from './sound';

const STORE = 'mn:booth:v1';
const PREVIEW_MAX = 1400;

type Role = 'guest' | 'organizer';
type Source = 'sample' | 'file' | 'camera';
type CamPhase = 'off' | 'starting' | 'live' | 'counting' | 'error';
type Cam = { phase: CamPhase; count: number; shot: number; error: string; facing: 'user' | 'environment' };
type Busy = '' | 'png' | 'jpg' | 'share' | 'poster';
export type Fonts = { mukta: string; baloo: string };

const START_STICKERS: Sticker[] = [
  { id: 's1', kind: 'topi', u: 0.24, v: 0.2, s: 0.95, r: -0.22 },
  { id: 's2', kind: 'woho', u: 0.73, v: 0.2, s: 1.05, r: 0.1 },
  { id: 's3', kind: 'heart', u: 0.86, v: 0.78, s: 0.6, r: 0.25 },
];

function defaults(lang: Lang): Saved {
  return {
    lang: null,
    frame: 'dashain',
    format: 'square',
    mode: 'single',
    filter: 'none',
    brightness: 0,
    text: DEFAULT_TEXT.dashain[lang],
    edited: false,
    stickers: START_STICKERS,
    sound: true,
    logo: '',
    wall: [],
  };
}

function useMedia(q: string): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const m = window.matchMedia(q);
    const f = () => setOn(m.matches);
    f();
    m.addEventListener('change', f);
    return () => m.removeEventListener('change', f);
  }, [q]);
  return on;
}

/** A picture file → a decoded image, turned upright from its EXIF where the browser can. */
async function decodeFile(file: File): Promise<{ pic: Pic; close: () => void }> {
  if (!file.type.startsWith('image/') || file.size > 30 * 1024 * 1024) throw new Error('not a picture');
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { pic: bmp, close: () => bmp.close() };
    } catch {
      /* fall back to an <img>, which applies EXIF orientation itself */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return { pic: img, close: () => {} };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function picSize(p: Pic): { w: number; h: number } {
  return p instanceof HTMLImageElement ? { w: p.naturalWidth, h: p.naturalHeight } : { w: p.width, h: p.height };
}

/** Copies a picture into a reused canvas, at most `max` px on its longest side. */
function intoCanvas(c: HTMLCanvasElement, src: CanvasImageSource, w: number, h: number, max: number, mirror = false) {
  const k = Math.min(1, max / Math.max(w, h));
  c.width = Math.max(1, Math.round(w * k));
  c.height = Math.max(1, Math.round(h * k));
  const ctx = c.getContext('2d');
  if (!ctx) return;
  ctx.save();
  if (mirror) {
    ctx.translate(c.width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(src, 0, 0, c.width, c.height);
  ctx.restore();
}

const sleep = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));

export default function PhotoBooth({ initialLang, fonts }: { initialLang: Lang; fonts: Fonts }) {
  const drawFonts: DrawFonts = useMemo(() => ({ head: fonts.baloo, body: fonts.mukta }), [fonts.baloo, fonts.mukta]);
  const [lang, setLang] = useState<Lang>(initialLang);
  const t: Copy = COPY[lang];
  const start = useMemo(() => defaults(initialLang), [initialLang]);
  const [role, setRole] = useState<Role>('guest');
  const [frame, setFrame] = useState<FrameId>(start.frame);
  const [format, setFormat] = useState<FormatId>(start.format);
  const [mode, setMode] = useState<ShotMode>(start.mode);
  const [filter, setFilter] = useState<FilterId>(start.filter);
  const [brightness, setBrightness] = useState(0);
  const [text, setText] = useState<BoothText>(start.text);
  const [edited, setEdited] = useState(false);
  const [stickers, setStickers] = useState<Sticker[]>(start.stickers);
  const [selected, setSelected] = useState<string | null>(null);
  const [sound, setSound] = useState(true);
  const [logo, setLogo] = useState('');
  const [wall, setWall] = useState<WallItem[]>([]);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [shotsVer, setShotsVer] = useState(0);
  const [source, setSource] = useState<Source>('sample');
  const [cam, setCam] = useState<Cam>({ phase: 'off', count: 0, shot: 0, error: '', facing: 'user' });
  const [flash, setFlash] = useState(false);
  const [busy, setBusy] = useState<Busy>('');
  const [say, setSay] = useState('');
  const [note, setNote] = useState<{ kind: 'error' | 'info'; text: string } | null>(null);
  const [preset, setPreset] = useState<string | null>(null);
  const [fontsOk, setFontsOk] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [origin, setOrigin] = useState('https://www.martnepali.com');
  const [canShare, setCanShare] = useState(false);
  const [copied, setCopied] = useState(false);
  const [logoVer, setLogoVer] = useState(0);
  const [icons, setIcons] = useState<Partial<Record<StickerKind, string>>>({});
  const [view, setView] = useState({ w: 0, h: 0, dpr: 1 });
  const calm = useMedia('(prefers-reduced-motion: reduce)');
  const ids = useId();

  const L = useMemo(() => layoutFor(layoutId(mode, format)), [mode, format]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const posterRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const logoFileRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const runRef = useRef(0);
  const sfxRef = useRef<BoothSfx | null>(null);
  const poolRef = useRef<HTMLCanvasElement[]>([]);
  const shotsRef = useRef<(HTMLCanvasElement | null)[]>([null, null, null]);
  const layerRef = useRef<{ canvas: HTMLCanvasElement | null; key: string }>({ canvas: null, key: '' });
  const scratchRef = useRef<{ out: HTMLCanvasElement | null; layer: HTMLCanvasElement | null; thumb: HTMLCanvasElement | null }>({ out: null, layer: null, thumb: null });
  const logoImgRef = useRef<HTMLImageElement | null>(null);
  const rafRef = useRef(0);
  const skipSave = useRef(false);
  const gesture = useRef<{
    pts: Map<number, { x: number; y: number }>;
    kind: '' | 'drag' | 'handle' | 'pinch' | 'pan' | 'zoom';
    id: string;
    start: Sticker | null;
    from: { x: number; y: number };
    a0: { x: number; y: number };
    b0: { x: number; y: number };
    pan0: { x: number; y: number };
    zoom0: number;
    d0: number;
  }>({ pts: new Map(), kind: '', id: '', start: null, from: { x: 0, y: 0 }, a0: { x: 0, y: 0 }, b0: { x: 0, y: 0 }, pan0: { x: 0, y: 0 }, zoom0: 1, d0: 1 });

  const announce = useCallback((m: string) => {
    setSay('');
    requestAnimationFrame(() => setSay(m));
  }, []);

  const sfx = () => {
    if (!sfxRef.current) sfxRef.current = new BoothSfx();
    sfxRef.current.muted = !sound;
    return sfxRef.current;
  };

  // ----- the shot canvases (three, reused) -----
  const pool = (i: number) => {
    if (!poolRef.current[i]) poolRef.current[i] = document.createElement('canvas');
    return poolRef.current[i];
  };

  const loadSample = useCallback((m: ShotMode) => {
    const n = m === 'strip' ? STRIP_SHOTS : 1;
    for (let i = 0; i < STRIP_SHOTS; i++) {
      if (i < n) {
        drawSample(pool(i), i);
        shotsRef.current[i] = pool(i);
      } else shotsRef.current[i] = null;
    }
    setSource('sample');
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setShotsVer((v) => v + 1);
  }, []);

  // ----- load: saved state, an organizer's #b= link -----
  useEffect(() => {
    setOrigin(window.location.origin);
    setCanShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function' && typeof navigator.canShare === 'function');
    let st: Saved = defaults(initialLang);
    try {
      const raw = localStorage.getItem(STORE);
      if (raw) st = normalizeSaved(JSON.parse(raw), st);
    } catch {
      /* private mode, blocked storage, bad JSON: start fresh */
    }
    const l = st.lang ?? initialLang;
    const p = readPresetHash(window.location.hash);
    if (p) {
      st = { ...st, frame: p.frame, text: p.text, edited: true };
      setPreset(p.text.title);
    }
    setLang(l);
    setFrame(st.frame);
    setFormat(st.format);
    setMode(st.mode);
    setFilter(st.filter);
    setBrightness(st.brightness);
    setText(st.edited ? st.text : DEFAULT_TEXT[st.frame][l]);
    setEdited(st.edited);
    setStickers(st.stickers);
    setSound(st.sound);
    setLogo(st.logo);
    setWall(st.wall);
    loadSample(st.mode);
    setLoaded(true);
    let live = true;
    void fontsReady(drawFonts).then(() => live && setFontsOk(true));
    return () => {
      live = false;
    };
  }, [initialLang, drawFonts, loadSample]);

  // ----- save (one key; thumbnails dropped first when storage is full) -----
  useEffect(() => {
    if (!loaded) return;
    if (skipSave.current) {
      skipSave.current = false;
      return;
    }
    const s: Saved = trimToBudget({ lang: lang === initialLang ? null : lang, frame, format, mode, filter, brightness, text, edited, stickers, sound, logo, wall });
    const write = (x: Saved) => localStorage.setItem(STORE, JSON.stringify(x));
    try {
      write(s);
      if (s.wall.length < wall.length) setWall(s.wall);
    } catch {
      let x = s;
      while (x.wall.length) {
        x = { ...x, wall: x.wall.slice(0, Math.floor(x.wall.length / 2)) };
        try {
          write(x);
          setWall(x.wall);
          setNote({ kind: 'info', text: t.quota });
          return;
        } catch {
          /* keep halving */
        }
      }
      try {
        write({ ...x, logo: '' });
      } catch {
        /* storage is unavailable; the demo still works for this visit */
      }
    }
  }, [loaded, lang, initialLang, frame, format, mode, filter, brightness, text, edited, stickers, sound, logo, wall, t.quota]);

  // ----- language / frame → the made-up event's words, until the visitor edits them -----
  useEffect(() => {
    if (!edited) setText(DEFAULT_TEXT[frame][lang]);
  }, [frame, lang, edited]);

  // ----- the organizer's logo as an image -----
  useEffect(() => {
    if (!logo) {
      logoImgRef.current = null;
      setLogoVer((v) => v + 1);
      return;
    }
    const img = new Image();
    let live = true;
    img.onload = () => {
      if (!live) return;
      logoImgRef.current = img;
      setLogoVer((v) => v + 1);
    };
    img.src = logo;
    return () => {
      live = false;
    };
  }, [logo]);

  // ----- sticker icons for the palette (drawn once the fonts are in) -----
  useEffect(() => {
    if (!fontsOk) return;
    const c = document.createElement('canvas');
    c.width = 112;
    c.height = 112;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const out: Partial<Record<StickerKind, string>> = {};
    for (const k of STICKER_KINDS) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, 112, 112);
      const asp = stickerBox({ id: 'x', kind: k, u: 0, v: 0, s: 1, r: 0 }, { x: 0, y: 0, w: 1, h: 1 });
      const ratio = asp.w / asp.h;
      const h = ratio > 1 ? 92 / ratio : 92;
      ctx.translate(56, 56);
      drawSticker(ctx, k, h * ratio, h, drawFonts);
      out[k] = c.toDataURL('image/png');
    }
    c.width = c.height = 1;
    setIcons(out);
  }, [fontsOk, drawFonts]);

  // ----- preview size -----
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => {
      const boxW = el.clientWidth;
      const maxH = Math.min(window.innerHeight * 0.7, 820);
      const f = fitBox(L.w, L.h, boxW, Math.max(240, maxH));
      setView({ w: f.w, h: f.h, dpr: Math.min(2.5, window.devicePixelRatio || 1) });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [L]);

  const cw = Math.max(1, Math.round(Math.min(view.w * view.dpr, (PREVIEW_MAX * L.w) / Math.max(L.w, L.h))));
  const ch = Math.max(1, Math.round((cw * L.h) / L.w));
  const scale = cw / L.w;

  const photoOpts = useCallback(
    () => ({ zoom, panX: pan.x, panY: pan.y, filter, brightness, frame, fonts: drawFonts, emptyLabel: (i: number) => t.cellEmpty(num(i + 1, lang)) }),
    [zoom, pan.x, pan.y, filter, brightness, frame, drawFonts, t, lang]
  );

  // ----- draw the preview (the photo layer is cached; stickers redraw on top) -----
  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !view.w) return;
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      if (c.width !== cw) c.width = cw;
      if (c.height !== ch) c.height = ch;
      const ctx = c.getContext('2d');
      if (!ctx) return;
      const lr = layerRef.current;
      if (!lr.canvas) lr.canvas = document.createElement('canvas');
      const key = [L.id, cw, shotsVer, zoom, pan.x, pan.y, filter, brightness, frame, lang, fontsOk].join('|');
      if (lr.key !== key) {
        renderPhotoLayer(lr.canvas, L, scale, shotsRef.current, photoOpts());
        lr.key = key;
      }
      renderBooth(ctx, scale, { layout: L, frame, text, stickers, logo: logoImgRef.current, fonts: drawFonts, photoLayer: lr.canvas, selected: role === 'guest' ? selected : null });
    });
  }, [L, cw, ch, scale, view.w, shotsVer, zoom, pan, filter, brightness, frame, lang, fontsOk, text, stickers, selected, drawFonts, logoVer, photoOpts, role]);

  // ----- the poster preview (organizer side) -----
  const qrText = boothUrl(origin, { frame, text });
  const posterWords = useMemo(() => ({ scan: t.posterScan, steps: t.posterSteps, foot: t.posterFoot, stepNum: (n: number) => num(n, lang) }), [t, lang]);
  useEffect(() => {
    if (role !== 'organizer') return;
    const c = posterRef.current;
    if (!c) return;
    const k = 0.36;
    c.width = Math.round(POSTER.w * k);
    c.height = Math.round(POSTER.h * k);
    const ctx = c.getContext('2d');
    if (ctx) renderPoster(ctx, k, { frame, text, logo: logoImgRef.current, qrText, fonts: drawFonts, words: posterWords });
  }, [role, frame, text, qrText, drawFonts, posterWords, logoVer, fontsOk]);

  // ----- camera -----
  const stopCamera = useCallback(() => {
    runRef.current += 1;
    const s = streamRef.current;
    if (s) for (const tr of s.getTracks()) tr.stop();
    streamRef.current = null;
    const v = videoRef.current;
    if (v) v.srcObject = null;
  }, []);

  useEffect(() => {
    const hide = () => {
      if (document.visibilityState === 'hidden' && streamRef.current) {
        stopCamera();
        setCam((c) => ({ ...c, phase: 'off', count: 0 }));
      }
    };
    const leave = () => stopCamera();
    document.addEventListener('visibilitychange', hide);
    window.addEventListener('pagehide', leave);
    return () => {
      document.removeEventListener('visibilitychange', hide);
      window.removeEventListener('pagehide', leave);
      stopCamera();
      sfxRef.current?.close();
      cancelAnimationFrame(rafRef.current);
      // let the big canvases go
      for (const c of [...poolRef.current, layerRef.current.canvas, scratchRef.current.out, scratchRef.current.layer, scratchRef.current.thumb]) if (c) c.width = c.height = 1;
    };
  }, [stopCamera]);

  useEffect(() => {
    const v = videoRef.current;
    const s = streamRef.current;
    if ((cam.phase === 'live' || cam.phase === 'counting') && v && s && v.srcObject !== s) {
      v.srcObject = s;
      void v.play().catch(() => {});
    }
  }, [cam.phase]);

  async function openCamera(facing: 'user' | 'environment' = cam.facing) {
    sfx().unlock();
    setNote(null);
    stopCamera();
    if (!navigator.mediaDevices?.getUserMedia) {
      setCam({ phase: 'error', count: 0, shot: 0, error: t.cameraNone, facing });
      setNote({ kind: 'error', text: t.cameraNone });
      return;
    }
    const run = runRef.current;
    setCam({ phase: 'starting', count: 0, shot: 0, error: '', facing });
    announce(t.cameraStarting);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false });
      if (run !== runRef.current) {
        for (const tr of stream.getTracks()) tr.stop();
        return;
      }
      streamRef.current = stream;
      setSelected(null);
      setCam({ phase: 'live', count: 0, shot: 0, error: '', facing });
    } catch (e) {
      const name = (e as { name?: string })?.name ?? '';
      const msg = name === 'NotAllowedError' || name === 'SecurityError' ? t.cameraBlocked : name === 'NotFoundError' || name === 'OverconstrainedError' ? t.cameraNone : t.cameraFail;
      setCam({ phase: 'error', count: 0, shot: 0, error: msg, facing });
      setNote({ kind: 'error', text: msg });
      announce(msg);
    }
  }

  function closeCamera() {
    stopCamera();
    setCam((c) => ({ ...c, phase: 'off', count: 0 }));
  }

  async function takeShots() {
    const v = videoRef.current;
    if (!v || !streamRef.current) return;
    const s = sfx();
    s.unlock();
    const run = runRef.current;
    const n = mode === 'strip' ? STRIP_SHOTS : 1;
    const mirror = cam.facing === 'user';
    for (let k = 0; k < n; k++) {
      for (let c = 3; c >= 1; c--) {
        if (run !== runRef.current) return;
        setCam((x) => ({ ...x, phase: 'counting', count: c, shot: k }));
        announce(n > 1 ? `${t.shotOf(num(k + 1, lang), num(n, lang))} · ${num(c, lang)}` : num(c, lang));
        s.beep(false);
        await sleep(900);
      }
      if (run !== runRef.current) return;
      setCam((x) => ({ ...x, count: 0 }));
      s.shutter();
      if (!calm) {
        setFlash(true);
        window.setTimeout(() => setFlash(false), 260);
      }
      const w = v.videoWidth || 640;
      const h = v.videoHeight || 480;
      intoCanvas(pool(k), v, w, h, LIMITS.shotMax, mirror);
      shotsRef.current[k] = pool(k);
      if (k === 0) for (let j = 1; j < STRIP_SHOTS; j++) shotsRef.current[j] = null;
      setShotsVer((x) => x + 1);
      if (k < n - 1) await sleep(700);
    }
    if (run !== runRef.current) return;
    stopCamera();
    setSource('camera');
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setCam((x) => ({ ...x, phase: 'off', count: 0 }));
    announce(t.captured);
  }

  // ----- files -----
  async function onFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, mode === 'strip' ? STRIP_SHOTS : 1);
    e.target.value = '';
    if (!files.length) return;
    closeCamera();
    setNote(null);
    let ok = 0;
    for (let i = 0; i < files.length; i++) {
      try {
        const d = await decodeFile(files[i]);
        const { w, h } = picSize(d.pic);
        if (!w || !h) throw new Error('empty');
        intoCanvas(pool(i), d.pic, w, h, LIMITS.shotMax);
        d.close();
        shotsRef.current[ok] = pool(i);
        ok += 1;
      } catch {
        setNote({ kind: 'error', text: t.fileError });
      }
    }
    if (!ok) return;
    for (let j = ok; j < STRIP_SHOTS; j++) shotsRef.current[j] = null;
    setSource('file');
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setShotsVer((v) => v + 1);
    announce(t.photoDone(num(ok, lang)));
  }

  function pickSample() {
    closeCamera();
    setNote(null);
    loadSample(mode);
    announce(t.sampleDone);
  }

  function pickMode(m: ShotMode) {
    if (m === mode) return;
    setMode(m);
    setSelected(null);
    if (source === 'sample') loadSample(m);
    else if (m === 'single') {
      const first = shotsRef.current.find((x) => x) ?? null;
      shotsRef.current = [first, null, null];
      setShotsVer((v) => v + 1);
    }
  }

  // ----- stickers -----
  const stickerName = (k: StickerKind) => t.stickers[k];
  const sel = stickers.find((s) => s.id === selected) ?? null;

  function addOne(kind: StickerKind) {
    if (stickers.length >= LIMITS.stickers) {
      announce(t.stickersFull);
      return;
    }
    const next = addSticker(stickers, kind);
    setStickers(next);
    setSelected(next[next.length - 1].id);
    announce(t.stickerAdded(stickerName(kind)));
  }

  function updateSel(f: (s: Sticker) => Sticker) {
    if (!selected) return;
    setStickers((list) => list.map((s) => (s.id === selected ? f(s) : s)));
  }

  function removeSel() {
    if (!sel) return;
    setStickers((list) => list.filter((s) => s.id !== sel.id));
    setSelected(null);
    announce(t.stickerRemoved(stickerName(sel.kind)));
    canvasRef.current?.focus();
  }

  function pickSticker(id: string) {
    const s = stickers.find((x) => x.id === id);
    if (!s) return;
    setSelected(id);
    announce(t.selected(stickerName(s.kind)));
  }

  // ----- pointer: drag, corner handle, pinch, pan / zoom the photo -----
  const pos = (e: { clientX: number; clientY: number }) => {
    const c = canvasRef.current;
    if (!c) return { x: 0, y: 0 };
    return toCanvas(c.getBoundingClientRect(), e.clientX, e.clientY, L.w, L.h);
  };

  function onPointerDown(e: RPointerEvent<HTMLCanvasElement>) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const g = gesture.current;
    const p = pos(e);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* fine */
    }
    g.pts.set(e.pointerId, p);
    const u = L.w / 1080;
    if (g.pts.size === 1) {
      if (sel) {
        const b = stickerBox(sel, L.area);
        if (onHandle({ ...b, w: b.w + HANDLE_PAD * 2 * u, h: b.h + HANDLE_PAD * 2 * u }, p.x, p.y, 40 * u)) {
          g.kind = 'handle';
          g.id = sel.id;
          g.start = sel;
          g.from = p;
          return;
        }
      }
      const i = hitSticker(stickers, L.area, p.x, p.y, 8 * u);
      if (i >= 0) {
        const s = stickers[i];
        if (s.id !== selected) pickSticker(s.id);
        g.kind = 'drag';
        g.id = s.id;
        g.start = s;
        g.from = p;
      } else {
        setSelected(null);
        g.kind = mode === 'single' && shotsRef.current[0] ? 'pan' : '';
        g.from = p;
        g.pan0 = pan;
      }
    } else if (g.pts.size === 2) {
      const [a, b] = Array.from(g.pts.values());
      const target = g.kind === 'drag' || g.kind === 'handle' ? stickers.find((s) => s.id === g.id) : sel;
      if (target) {
        g.kind = 'pinch';
        g.id = target.id;
        g.start = target;
      } else if (mode === 'single') {
        g.kind = 'zoom';
        g.zoom0 = zoom;
      }
      g.a0 = a;
      g.b0 = b;
      g.d0 = Math.max(4, Math.hypot(b.x - a.x, b.y - a.y));
    }
  }

  function onPointerMove(e: RPointerEvent<HTMLCanvasElement>) {
    const g = gesture.current;
    if (!g.pts.has(e.pointerId)) return;
    const p = pos(e);
    g.pts.set(e.pointerId, p);
    if (g.kind === 'drag' && g.start) {
      const next = dragSticker(g.start, p.x - g.from.x, p.y - g.from.y, L.area);
      setStickers((list) => list.map((s) => (s.id === g.id ? next : s)));
    } else if (g.kind === 'handle' && g.start) {
      const b = stickerBox(g.start, L.area);
      const next = handleSticker(g.start, { x: b.cx, y: b.cy }, g.from, p);
      setStickers((list) => list.map((s) => (s.id === g.id ? next : s)));
    } else if (g.kind === 'pinch' && g.start && g.pts.size >= 2) {
      const [a, b] = Array.from(g.pts.values());
      const next = pinchSticker(g.start, g.a0, g.b0, a, b, L.area);
      setStickers((list) => list.map((s) => (s.id === g.id ? next : s)));
    } else if (g.kind === 'zoom' && g.pts.size >= 2) {
      const [a, b] = Array.from(g.pts.values());
      setZoom(clamp((g.zoom0 * Math.hypot(b.x - a.x, b.y - a.y)) / g.d0, LIMITS.zoomMin, LIMITS.zoomMax));
    } else if (g.kind === 'pan') {
      const shot = shotsRef.current[0];
      if (!shot) return;
      const c = L.cells[0];
      const d = panDelta(shot.width, shot.height, c.w, c.h, zoom, p.x - g.from.x, p.y - g.from.y);
      setPan({ x: clamp(g.pan0.x + d.x, -1, 1), y: clamp(g.pan0.y + d.y, -1, 1) });
    }
  }

  function onPointerUp(e: RPointerEvent<HTMLCanvasElement>) {
    const g = gesture.current;
    g.pts.delete(e.pointerId);
    if (g.pts.size === 0) {
      g.kind = '';
      g.start = null;
    } else if (g.kind === 'pinch' || g.kind === 'zoom') {
      // one finger left: carry on dragging from here
      const [rest] = Array.from(g.pts.values());
      const s = stickers.find((x) => x.id === g.id);
      if (g.kind === 'pinch' && s) {
        g.kind = 'drag';
        g.start = s;
        g.from = rest;
      } else g.kind = '';
    }
  }

  function onCanvasKey(e: KeyboardEvent<HTMLCanvasElement>) {
    if (!sel) return;
    if (NUDGE_KEYS.includes(e.key)) {
      e.preventDefault();
      updateSel((s) => nudgeSticker(s, e.key, e.shiftKey));
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      removeSel();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setSelected(null);
    }
  }

  // ----- text -----
  function editText(k: keyof BoothText, v: string) {
    setEdited(true);
    setText((x) => ({ ...x, [k]: k === 'tag' ? cleanTag(v) : cleanText(v, k === 'title' ? LIMITS.title : LIMITS.date) }));
  }

  function pickFrame(f: FrameId) {
    setFrame(f);
  }

  // ----- save, share, the wall -----
  function scratch(k: 'out' | 'layer' | 'thumb') {
    const s = scratchRef.current;
    if (!s[k]) s[k] = document.createElement('canvas');
    return s[k]!;
  }

  function release() {
    const s = scratchRef.current;
    for (const c of [s.out, s.layer, s.thumb]) if (c) c.width = c.height = 1;
  }

  function addToWall(full: HTMLCanvasElement) {
    const th = scratch('thumb');
    const f = fitBox(full.width, full.height, LIMITS.thumb, LIMITS.thumb);
    th.width = Math.max(1, f.w);
    th.height = Math.max(1, f.h);
    const ctx = th.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(full, 0, 0, th.width, th.height);
    const src = th.toDataURL('image/jpeg', 0.6);
    const at = Date.now();
    setWall((w) => pushWall(w, { id: `w${at.toString(36)}`, src, at }));
  }

  async function makeBlob(type: 'image/png' | 'image/jpeg'): Promise<{ blob: Blob; name: string } | null> {
    await fontsReady(drawFonts);
    const out = scratch('out');
    const layer = scratch('layer');
    out.width = L.w;
    out.height = L.h;
    renderPhotoLayer(layer, L, 1, shotsRef.current, photoOpts());
    const ctx = out.getContext('2d');
    if (!ctx) return null;
    renderBooth(ctx, 1, { layout: L, frame, text, stickers, logo: logoImgRef.current, fonts: drawFonts, photoLayer: layer, selected: null });
    const blob = await canvasBlob(out, type, type === 'image/jpeg' ? 0.92 : undefined);
    addToWall(out);
    release();
    return blob ? { blob, name: fileName(text.title || t.frames[frame], L.id, type === 'image/png' ? 'png' : 'jpg') } : null;
  }

  function saveFile(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  async function download(kind: 'png' | 'jpg') {
    if (busy) return;
    setBusy(kind);
    try {
      const r = await makeBlob(kind === 'png' ? 'image/png' : 'image/jpeg');
      if (r) {
        saveFile(r.blob, r.name);
        announce(t.saved(r.name));
      }
    } finally {
      setBusy('');
    }
  }

  async function share() {
    if (busy) return;
    setBusy('share');
    try {
      const r = await makeBlob('image/jpeg');
      if (!r) return;
      const file = new File([r.blob], r.name, { type: 'image/jpeg' });
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: text.title || t.title, text: text.tag || undefined });
        } catch (err) {
          if ((err as { name?: string })?.name !== 'AbortError') setNote({ kind: 'info', text: t.shareFail });
        }
      } else setNote({ kind: 'info', text: t.shareFail });
    } finally {
      setBusy('');
    }
  }

  async function downloadPoster() {
    if (busy) return;
    setBusy('poster');
    try {
      await fontsReady(drawFonts);
      const out = scratch('out');
      out.width = POSTER.w;
      out.height = POSTER.h;
      const ctx = out.getContext('2d');
      if (!ctx) return;
      renderPoster(ctx, 1, { frame, text, logo: logoImgRef.current, qrText, fonts: drawFonts, words: posterWords });
      const blob = await canvasBlob(out, 'image/png');
      release();
      if (blob) {
        const name = `photo-booth-poster-${fileName(text.title || frame, 'print', 'png').replace(/^photo-booth-/, '').replace(/-print\.png$/, '')}-a4.png`;
        saveFile(blob, name);
        announce(t.saved(name));
      }
    } finally {
      setBusy('');
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(qrText);
      setCopied(true);
      announce(t.copied);
    } catch {
      const el = document.getElementById(`${ids}-link`) as HTMLInputElement | null;
      el?.focus();
      el?.select();
    }
  }

  // ----- the organizer's logo -----
  async function onLogo(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      const d = await decodeFile(f);
      const { w, h } = picSize(d.pic);
      const c = document.createElement('canvas');
      let url = '';
      for (const max of [256, 180, 128]) {
        intoCanvas(c, d.pic, w, h, max);
        url = c.toDataURL('image/png');
        if (url.length <= LIMITS.logoBytes) break;
        const ctx = c.getContext('2d');
        if (ctx) {
          ctx.globalCompositeOperation = 'destination-over';
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, c.width, c.height);
        }
        url = c.toDataURL('image/jpeg', 0.85);
        if (url.length <= LIMITS.logoBytes) break;
      }
      d.close();
      c.width = c.height = 1;
      if (url.length > LIMITS.logoBytes) throw new Error('too big');
      setLogo(url);
    } catch {
      setNote({ kind: 'error', text: t.logoError });
    }
  }

  // ----- reset -----
  function reset() {
    closeCamera();
    try {
      localStorage.removeItem(STORE);
    } catch {
      /* fine */
    }
    skipSave.current = true;
    const d = defaults(lang);
    setFrame(d.frame);
    setFormat(d.format);
    setMode(d.mode);
    setFilter(d.filter);
    setBrightness(0);
    setEdited(false);
    setText(DEFAULT_TEXT[d.frame][lang]);
    setStickers(d.stickers);
    setSelected(null);
    setSound(true);
    setLogo('');
    setWall([]);
    setNote(null);
    setPreset(null);
    setCopied(false);
    setRole('guest');
    loadSample('single');
    if (window.location.hash.startsWith('#b=')) history.replaceState(null, '', window.location.pathname + window.location.search);
    announce(t.resetDone);
  }

  const camOn = cam.phase === 'starting' || cam.phase === 'live' || cam.phase === 'counting';
  const cell = L.cells[0];
  const layoutName = t.formats[L.id];

  // ----- pieces -----
  const frameChips = (name: string) => (
    <div className="pb-chips pb-frames" role="radiogroup" aria-label={name}>
      {FRAME_IDS.map((f) => (
        <button key={f} type="button" role="radio" aria-checked={frame === f} className={`pb-frame-chip${frame === f ? ' is-on' : ''}`} onClick={() => pickFrame(f)}>
          <span className="pb-swatch" style={{ background: frameSwatch(f) }} aria-hidden="true" />
          {t.frames[f]}
        </button>
      ))}
    </div>
  );

  const textFields = (
    <div className="pb-fields">
      <label className="pb-field">
        <span>{t.titleL}</span>
        <input type="text" value={text.title} maxLength={LIMITS.title * 2} onChange={(e) => editText('title', e.target.value)} autoComplete="off" />
      </label>
      <label className="pb-field">
        <span>{t.dateL}</span>
        <input type="text" value={text.date} maxLength={LIMITS.date * 2} onChange={(e) => editText('date', e.target.value)} autoComplete="off" />
      </label>
      <label className="pb-field">
        <span>{t.tagL}</span>
        <input type="text" value={text.tag} maxLength={LIMITS.tag * 2} onChange={(e) => editText('tag', e.target.value)} autoComplete="off" spellCheck={false} />
      </label>
      <p className="pb-hint">{t.textHint}</p>
    </div>
  );

  return (
    <div className={`pb${calm ? ' is-calm' : ''}`} lang={lang === 'ne' ? 'ne' : lang}>
      <div className="pb-top">
        <div className="pb-brand">
          <h1 className="pb-title">{t.title}</h1>
          <p className="pb-tag">{t.tagline}</p>
        </div>
        <div className="pb-tools">
          <div className="pb-langs" role="group" aria-label={t.langLabel}>
            {LANGS.map((l) => (
              <button key={l.id} type="button" className={`pb-lang${lang === l.id ? ' is-on' : ''}`} aria-pressed={lang === l.id} onClick={() => setLang(l.id)} lang={l.id}>
                {l.label}
              </button>
            ))}
          </div>
          <button type="button" className="pb-ghost" aria-pressed={sound} onClick={() => setSound((s) => !s)}>
            {sound ? `🔊 ${t.soundOn}` : `🔇 ${t.soundOff}`}
          </button>
          <button type="button" className="pb-ghost" onClick={reset}>
            ↺ {t.reset}
          </button>
        </div>
      </div>

      <p className="pb-privacy">
        <span aria-hidden="true">🔒</span> {t.privacy}
      </p>

      {preset !== null && (
        <div className="pb-preset">
          <span>{t.presetBanner(preset)}</span>
          <button type="button" className="pb-ghost" onClick={() => setPreset(null)}>
            {t.presetDismiss}
          </button>
        </div>
      )}

      <div className="pb-roles" role="group" aria-label={t.roleLabel}>
        {(['guest', 'organizer'] as Role[]).map((r) => (
          <button key={r} type="button" className={`pb-role${role === r ? ' is-on' : ''}`} aria-pressed={role === r} onClick={() => setRole(r)}>
            {r === 'guest' ? '📸 ' : '🎪 '}
            {t.roles[r]}
          </button>
        ))}
      </div>

      <div className="pb-grid">
        <section className="pb-stage-col" aria-label={t.stageLabel}>
          <div className="pb-formats" role="radiogroup" aria-label={t.formatsLabel}>
            {mode === 'strip' ? (
              <span className="pb-format is-on is-static">
                <b>{t.formats.strip}</b>
                <small>{t.formatSub.strip}</small>
              </span>
            ) : (
              FORMAT_IDS.map((f) => (
                <button key={f} type="button" role="radio" aria-checked={format === f} className={`pb-format${format === f ? ' is-on' : ''}`} onClick={() => setFormat(f)}>
                  <b>{t.formats[f]}</b>
                  <small>{t.formatSub[f]}</small>
                </button>
              ))
            )}
          </div>

          <div className="pb-stage" ref={stageRef}>
            <canvas
              ref={canvasRef}
              className="pb-canvas"
              style={view.w ? { width: view.w, height: view.h } : { aspectRatio: `${L.w} / ${L.h}` }}
              width={1}
              height={1}
              tabIndex={0}
              role="img"
              aria-label={t.canvasLabel(t.frames[frame], layoutName)}
              aria-describedby={`${ids}-help`}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onKeyDown={onCanvasKey}
            />
            {camOn && (
              <div className="pb-cam" style={{ aspectRatio: `${cell.w} / ${cell.h}` }}>
                <video ref={videoRef} className={`pb-video${cam.facing === 'user' ? ' is-mirror' : ''}`} playsInline muted autoPlay aria-label={t.cameraVideo} />
                {cam.phase === 'starting' && <p className="pb-cam-msg">{t.cameraStarting}</p>}
                {cam.phase === 'counting' && (
                  <div className="pb-count" aria-hidden="true">
                    {cam.count > 0 && (
                      <span key={`${cam.shot}-${cam.count}`} className="pb-count-n">
                        {num(cam.count, lang)}
                      </span>
                    )}
                    {mode === 'strip' && <span className="pb-count-of">{t.shotOf(num(cam.shot + 1, lang), num(STRIP_SHOTS, lang))}</span>}
                  </div>
                )}
                {flash && <div className="pb-flash" aria-hidden="true" />}
                <div className="pb-cam-bar">
                  <button type="button" className="pb-ghost pb-cam-btn" onClick={closeCamera}>
                    ✕ {t.cancel}
                  </button>
                  <button type="button" className="pb-shutter" onClick={takeShots} disabled={cam.phase !== 'live'} aria-label={mode === 'strip' ? t.shutterStrip : t.shutter}>
                    <span aria-hidden="true" />
                  </button>
                  <button type="button" className="pb-ghost pb-cam-btn" onClick={() => openCamera(cam.facing === 'user' ? 'environment' : 'user')} disabled={cam.phase === 'counting'}>
                    ⇄ {t.flip}
                  </button>
                </div>
              </div>
            )}
          </div>
          <p className="pb-hint pb-center" id={`${ids}-help`}>
            {t.canvasHelp} {t.stickerKeys}
          </p>

          <div className="pb-save" aria-label={t.saveH} role="group">
            <button type="button" className="pb-btn pb-btn-main" onClick={() => download('png')} disabled={!!busy || camOn}>
              {busy === 'png' ? t.saving : `⬇ ${t.savePng}`}
            </button>
            <button type="button" className="pb-btn" onClick={() => download('jpg')} disabled={!!busy || camOn}>
              {busy === 'jpg' ? t.saving : t.saveJpg}
            </button>
            {canShare && (
              <button type="button" className="pb-btn" onClick={share} disabled={!!busy || camOn}>
                {busy === 'share' ? t.saving : `↗ ${t.share}`}
              </button>
            )}
          </div>
          {note && (
            <div className={`pb-note pb-note-${note.kind}`} role={note.kind === 'error' ? 'alert' : 'status'}>
              <p>{note.text}</p>
              {cam.phase === 'error' && (
                <div className="pb-note-actions">
                  <button type="button" className="pb-btn" onClick={() => fileRef.current?.click()}>
                    {t.sourceFile}
                  </button>
                  <button type="button" className="pb-btn" onClick={pickSample}>
                    {t.sourceSample}
                  </button>
                </div>
              )}
            </div>
          )}
        </section>

        {role === 'guest' ? (
          <div className="pb-panel">
            <section className="pb-step" aria-labelledby={`${ids}-s1`}>
              <h2 id={`${ids}-s1`}>{t.stepPhoto}</h2>
              <div className="pb-sources">
                <button type="button" className="pb-source" onClick={() => openCamera()} disabled={camOn}>
                  <span aria-hidden="true">📷</span>
                  {t.sourceCamera}
                </button>
                <button type="button" className="pb-source" onClick={() => fileRef.current?.click()}>
                  <span aria-hidden="true">🖼️</span>
                  {t.sourceFile}
                </button>
                <button type="button" className="pb-source" onClick={pickSample}>
                  <span aria-hidden="true">✨</span>
                  {t.sourceSample}
                </button>
              </div>
              <input ref={fileRef} type="file" accept="image/*" multiple={mode === 'strip'} className="pb-hidden" onChange={onFiles} tabIndex={-1} aria-hidden="true" />
              <div className="pb-seg" role="radiogroup" aria-label={t.modeLabel}>
                {(['single', 'strip'] as ShotMode[]).map((m) => (
                  <button key={m} type="button" role="radio" aria-checked={mode === m} className={`pb-seg-btn${mode === m ? ' is-on' : ''}`} onClick={() => pickMode(m)} disabled={camOn}>
                    {t.modes[m]}
                  </button>
                ))}
              </div>
              {mode === 'strip' && <p className="pb-hint">{t.stripHint} {t.fileHintStrip}</p>}
            </section>

            <section className="pb-step" aria-labelledby={`${ids}-s2`}>
              <h2 id={`${ids}-s2`}>{t.stepFrame}</h2>
              {frameChips(t.stepFrame)}
            </section>

            <section className="pb-step" aria-labelledby={`${ids}-s3`}>
              <h2 id={`${ids}-s3`}>{t.stepText}</h2>
              {textFields}
            </section>

            <section className="pb-step" aria-labelledby={`${ids}-s4`}>
              <h2 id={`${ids}-s4`}>{t.stepStickers}</h2>
              <div className="pb-palette">
                {STICKER_KINDS.map((k) => (
                  <button key={k} type="button" className="pb-sticker-add" onClick={() => addOne(k)} aria-label={t.addSticker(stickerName(k))} title={stickerName(k)}>
                    {icons[k] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={icons[k]} alt="" width={56} height={56} />
                    ) : (
                      <span className="pb-icon-wait" aria-hidden="true" />
                    )}
                    <span className="pb-sticker-name">{stickerName(k)}</span>
                  </button>
                ))}
              </div>
              <h3 className="pb-sub">{t.onPhoto}</h3>
              {stickers.length ? (
                <ul className="pb-placed">
                  {stickers.map((s, i) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        className={`pb-placed-btn${selected === s.id ? ' is-on' : ''}`}
                        aria-pressed={selected === s.id}
                        onClick={() => {
                          pickSticker(s.id);
                          canvasRef.current?.focus();
                        }}
                      >
                        {num(i + 1, lang)}. {stickerName(s.kind)}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="pb-hint">{t.noStickers}</p>
              )}
              {sel && (
                <div className="pb-sel" role="group" aria-label={stickerName(sel.kind)}>
                  <button type="button" className="pb-mini" onClick={() => updateSel((s) => nudgeSticker(s, '-'))} aria-label={t.smaller}>
                    −
                  </button>
                  <button type="button" className="pb-mini" onClick={() => updateSel((s) => nudgeSticker(s, '+'))} aria-label={t.bigger}>
                    +
                  </button>
                  <button type="button" className="pb-mini" onClick={() => updateSel((s) => nudgeSticker(s, '['))} aria-label={t.turnLeft}>
                    ↺
                  </button>
                  <button type="button" className="pb-mini" onClick={() => updateSel((s) => nudgeSticker(s, ']'))} aria-label={t.turnRight}>
                    ↻
                  </button>
                  <button type="button" className="pb-mini pb-mini-wide" onClick={() => setStickers((l) => shiftLayer(l, sel.id, 1))} disabled={stickers[stickers.length - 1]?.id === sel.id}>
                    {t.forward}
                  </button>
                  <button type="button" className="pb-mini pb-mini-wide" onClick={() => setStickers((l) => shiftLayer(l, sel.id, -1))} disabled={stickers[0]?.id === sel.id}>
                    {t.backward}
                  </button>
                  <button type="button" className="pb-mini pb-mini-wide pb-danger" onClick={removeSel}>
                    {t.remove}
                  </button>
                  <button type="button" className="pb-mini pb-mini-wide" onClick={() => setSelected(null)}>
                    {t.deselect}
                  </button>
                </div>
              )}
            </section>

            <section className="pb-step" aria-labelledby={`${ids}-s5`}>
              <h2 id={`${ids}-s5`}>{t.stepLook}</h2>
              <div className="pb-chips" role="radiogroup" aria-label={t.stepLook}>
                {FILTER_IDS.map((f) => (
                  <button key={f} type="button" role="radio" aria-checked={filter === f} className={`pb-chip pb-filter-${f}${filter === f ? ' is-on' : ''}`} onClick={() => setFilter(f)}>
                    {t.filters[f]}
                  </button>
                ))}
              </div>
              <label className="pb-range">
                <span>
                  {t.brightnessL} <output>{num(Math.round(brightness * 100), lang)}</output>
                </span>
                <input type="range" min={-40} max={40} step={2} value={Math.round(brightness * 100)} onChange={(e) => setBrightness(Number(e.target.value) / 100)} />
              </label>
              {mode === 'single' && (
                <label className="pb-range">
                  <span>
                    {t.zoomL} <output>{num(zoom.toFixed(1), lang)}×</output>
                  </span>
                  <input type="range" min={100} max={300} step={5} value={Math.round(zoom * 100)} onChange={(e) => setZoom(Number(e.target.value) / 100)} />
                </label>
              )}
              {mode === 'single' && <p className="pb-hint">{t.zoomHint}</p>}
            </section>
          </div>
        ) : (
          <div className="pb-panel">
            <section className="pb-step">
              <h2>{t.orgH}</h2>
              <p className="pb-hint">{t.orgIntro}</p>
            </section>
            <section className="pb-step" aria-labelledby={`${ids}-o1`}>
              <h2 id={`${ids}-o1`}>{t.eventH}</h2>
              {textFields}
              <h3 className="pb-sub">{t.defaultFrameL}</h3>
              {frameChips(t.defaultFrameL)}
            </section>
            <section className="pb-step" aria-labelledby={`${ids}-o2`}>
              <h2 id={`${ids}-o2`}>{t.logoL}</h2>
              <div className="pb-logo-row">
                {logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logo} alt="" className="pb-logo" width={56} height={56} />
                ) : (
                  <span className="pb-logo pb-logo-empty" aria-hidden="true">
                    ★
                  </span>
                )}
                <button type="button" className="pb-btn" onClick={() => logoFileRef.current?.click()}>
                  {logo ? t.logoChange : t.logoUpload}
                </button>
                {logo && (
                  <button type="button" className="pb-ghost" onClick={() => setLogo('')}>
                    {t.logoRemove}
                  </button>
                )}
              </div>
              <input ref={logoFileRef} type="file" accept="image/png,image/jpeg,image/webp" className="pb-hidden" onChange={onLogo} tabIndex={-1} aria-hidden="true" />
              <p className="pb-hint">{t.logoNote}</p>
            </section>
            <section className="pb-step" aria-labelledby={`${ids}-o3`}>
              <h2 id={`${ids}-o3`}>{t.linkL}</h2>
              <div className="pb-link-row">
                <input id={`${ids}-link`} type="text" readOnly value={qrText} aria-label={t.linkL} onFocus={(e) => e.currentTarget.select()} />
                <button type="button" className="pb-btn" onClick={copyLink}>
                  {copied ? `✓ ${t.copied}` : t.copy}
                </button>
              </div>
              <p className="pb-hint">{t.linkHint}</p>
            </section>
            <section className="pb-step" aria-labelledby={`${ids}-o4`}>
              <h2 id={`${ids}-o4`}>{t.posterH}</h2>
              <p className="pb-hint">{t.posterHint}</p>
              <canvas ref={posterRef} className="pb-poster" role="img" aria-label={t.posterAlt} width={1} height={1} />
              <button type="button" className="pb-btn pb-btn-main" onClick={downloadPoster} disabled={!!busy}>
                {busy === 'poster' ? t.saving : `⬇ ${t.posterDownload}`}
              </button>
            </section>
            <section className="pb-step" aria-labelledby={`${ids}-o5`}>
              <h2 id={`${ids}-o5`}>{t.wallH}</h2>
              <p className="pb-hint">{t.wallHint}</p>
              <div className="pb-wall">
                <div className="pb-wall-head">
                  <span className="pb-wall-live">LIVE</span>
                  <span className="pb-wall-title">{text.title || t.frames[frame]}</span>
                  <span className="pb-wall-tag">{text.tag}</span>
                </div>
                {wall.length ? (
                  <ul className="pb-wall-grid">
                    {wall.map((w, i) => (
                      <li key={w.id}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={w.src} alt={t.wallAlt(num(i + 1, lang))} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="pb-wall-empty">{t.wallEmpty}</p>
                )}
              </div>
              <div className="pb-wall-foot">
                <span>{t.wallCount(num(wall.length, lang))}</span>
                {wall.length > 0 && (
                  <button type="button" className="pb-ghost" onClick={() => setWall([])}>
                    {t.wallClear}
                  </button>
                )}
              </div>
              <button type="button" className="pb-btn" onClick={() => setRole('guest')}>
                📸 {t.backToGuest}
              </button>
            </section>
          </div>
        )}
      </div>

      <p className="pb-live" aria-live="polite" role="status">
        {say}
      </p>
    </div>
  );
}

