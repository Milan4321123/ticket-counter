'use client';

// "Dui Kinara Radio" — a made-up Nepali community radio + podcast site
// (studio demo #14). A live player that stays at the bottom while you browse
// (mini on phones, full when opened), the week's programme with what is on
// now, podcast episodes with chapters, speed, ±15 s and resume, song requests
// and shout-outs. Everything runs in this browser: the music is composed live
// (stream.ts), the rules are in radio.ts, the words in content.ts, one
// localStorage key, nothing sent. The root is translate="no" so nothing typed
// here (or shown back, like a shout-out) ever reaches the site's translator.

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent, type PointerEvent } from 'react';
import {
  Avatar,
  HostFaces,
  IconBack,
  IconBack15,
  IconBell,
  IconDown,
  IconFeed,
  IconFwd15,
  IconLink,
  IconMusic,
  IconMuted,
  IconNext,
  IconPause,
  IconPlay,
  IconPodApp,
  IconPrev,
  IconRadio,
  IconUp,
  IconVolume,
  ShowCover,
  StationMark,
} from './art';
import {
  COPY,
  EPISODES,
  HOSTS,
  LANGS,
  SEED_REQUESTS,
  SHOWS,
  STATION,
  TUNES,
  count,
  dateLabel,
  episodeById,
  hostLine,
  num,
  type Copy,
  type Episode,
  type Lang,
} from './content';
import {
  GRID_FROM,
  GRID_ROWS,
  GRID_STEP,
  NEPAL_TZ,
  SPEEDS,
  STING_SEC,
  STORE_KEY,
  addRequest,
  chapterIndexAt,
  chapterSeek,
  cleanRequest,
  cleanSaved,
  clock,
  daySlots,
  emptySaved,
  fractionToTime,
  gridRows,
  hhmm,
  inZone,
  listenersAt,
  liveSegment,
  nextChapterSeek,
  onNow,
  prevChapterSeek,
  recordProgress,
  resumeFrom,
  skipBy,
  timeToFraction,
  tuneIndex,
  waveform,
  zonedClock,
  type ReqKind,
  type Saved,
  type ShowId,
  type Slot,
  type Speed,
} from './radio';
import { RadioEngine } from './stream';

const EP_IDS = EPISODES.map((e) => e.id);

function readSaved(): Saved {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? cleanSaved(JSON.parse(raw), EP_IDS, TUNES.length) : emptySaved();
  } catch {
    return emptySaved();
  }
}
function writeSaved(s: Saved) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(s));
  } catch {
    /* private window: it just forgets */
  }
}

function useReducedMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return;
    const set = () => setReduce(mq.matches);
    set();
    mq.addEventListener?.('change', set);
    return () => mq.removeEventListener?.('change', set);
  }, []);
  return reduce;
}

/** What is on at a wall-clock moment, station time. */
function showAt(ms: number): ShowId {
  const c = zonedClock(new Date(ms));
  return onNow(c.day, c.minute + c.second / 60).slot.show;
}

const tc = (sec: number, lang: Lang) => num(clock(sec), lang);
const hm = (min: number, lang: Lang) => num(hhmm(min), lang);
const speedLabel = (s: Speed, lang: Lang) => num(`${s}×`, lang);

// ---------- artwork for the lock screen (drawn once per show) ----------

const ART = new Map<string, string>();
function artwork(show: ShowId): string | null {
  if (ART.has(show)) return ART.get(show)!;
  try {
    const c = document.createElement('canvas');
    c.width = c.height = 512;
    const g = c.getContext('2d');
    if (!g) return null;
    const [a, b] = SHOWS[show].hue;
    const grad = g.createLinearGradient(0, 0, 512, 512);
    grad.addColorStop(0, a);
    grad.addColorStop(1, b);
    g.fillStyle = grad;
    g.fillRect(0, 0, 512, 512);
    g.fillStyle = 'rgba(27,22,56,0.55)';
    g.beginPath();
    g.moveTo(0, 380);
    g.lineTo(120, 250);
    g.lineTo(200, 330);
    g.lineTo(250, 290);
    g.lineTo(250, 512);
    g.lineTo(0, 512);
    g.fill();
    g.beginPath();
    g.moveTo(512, 380);
    g.lineTo(390, 230);
    g.lineTo(310, 330);
    g.lineTo(262, 300);
    g.lineTo(262, 512);
    g.lineTo(512, 512);
    g.fill();
    g.strokeStyle = '#fff3df';
    g.lineWidth = 18;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(70, 170);
    for (let i = 0; i < 4; i++) g.quadraticCurveTo(70 + i * 96 + 48, i % 2 ? 230 : 110, 70 + (i + 1) * 96, 170);
    g.stroke();
    const url = c.toDataURL('image/png');
    ART.set(show, url);
    return url;
  } catch {
    return null;
  }
}

// ---------- visualizer ----------

function Visualizer({ engine, playing, reduce, className }: { engine: RadioEngine | null; playing: boolean; reduce: boolean; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const g = canvas.getContext('2d');
    if (!g) return;
    const analyser = engine?.analyser ?? null;
    const freq = new Uint8Array(analyser ? analyser.frequencyBinCount : 0);
    const binHz = analyser ? analyser.context.sampleRate / analyser.fftSize : 1;
    const live = Boolean(analyser && playing && !reduce);
    let raf = 0;
    let visible = true;

    const draw = () => {
      const W = canvas.width;
      const H = canvas.height;
      if (!W || !H) return;
      g.clearRect(0, 0, W, H);
      const N = Math.max(18, Math.min(48, Math.floor(W / 16)));
      const gap = W / N;
      const bw = Math.max(2, gap * 0.58);
      const grad = g.createLinearGradient(0, H, 0, 0);
      grad.addColorStop(0, '#ffb547');
      grad.addColorStop(1, '#ff6f91');
      g.fillStyle = grad;
      if (live && analyser) analyser.getByteFrequencyData(freq);
      for (let i = 0; i < N; i++) {
        let v: number;
        if (live) {
          const f = 60 * Math.pow(7000 / 60, i / (N - 1));
          v = freq[Math.min(freq.length - 1, Math.round(f / binHz))] / 255;
        } else {
          // A still picture: calm bars (paused, or reduced motion).
          v = (playing ? 0.35 : 0.14) + 0.12 * Math.abs(Math.sin(i * 0.9)) + 0.08 * Math.abs(Math.cos(i * 2.3));
        }
        const h = Math.max(3, v * H * 0.92);
        const x = i * gap + (gap - bw) / 2;
        g.globalAlpha = live || playing ? 0.95 : 0.45;
        g.beginPath();
        if (typeof g.roundRect === 'function') g.roundRect(x, H - h, bw, h, Math.min(bw / 2, 4));
        else g.rect(x, H - h, bw, h);
        g.fill();
      }
      g.globalAlpha = 1;
      if (live && visible) raf = requestAnimationFrame(draw);
    };
    const fit = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.round(canvas.clientWidth * dpr);
      const h = Math.round(canvas.clientHeight * dpr);
      if (w === canvas.width && h === canvas.height) return;
      canvas.width = w;
      canvas.height = h;
      if (!live) draw();
    };
    fit();
    const ro = 'ResizeObserver' in window ? new ResizeObserver(fit) : null;
    ro?.observe(canvas);
    // Off screen, the drawing stops (it is the costly part on a phone).
    const io =
      'IntersectionObserver' in window
        ? new IntersectionObserver(([e]) => {
            const was = visible;
            visible = e.isIntersecting;
            if (visible && !was && live) {
              cancelAnimationFrame(raf);
              raf = requestAnimationFrame(draw);
            }
          })
        : null;
    io?.observe(canvas);
    draw();
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      io?.disconnect();
    };
  }, [engine, playing, reduce]);
  return <canvas ref={ref} className={`rd-viz ${className ?? ''}`} aria-hidden="true" />;
}

// ---------- waveform (seek bar for episodes) ----------

function Waveform({
  ep,
  pos,
  onSeek,
  t,
  lang,
  big,
}: {
  ep: Episode;
  pos: number;
  onSeek?: (sec: number) => void;
  t: Copy;
  lang: Lang;
  big?: boolean;
}) {
  const bars = useMemo(() => waveform(ep.id, big ? 120 : 60), [ep.id, big]);
  const f = timeToFraction(pos, ep.dur);
  const W = bars.length * 4;
  const clipId = `rd-wv${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const pick = (e: PointerEvent<HTMLDivElement>) => {
    if (!onSeek) return;
    const r = e.currentTarget.getBoundingClientRect();
    onSeek(fractionToTime((e.clientX - r.left) / r.width, ep.dur));
  };
  const key = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!onSeek) return;
    const k = e.key;
    if (k === 'ArrowLeft' || k === 'ArrowDown') onSeek(skipBy(pos, -15, ep.dur));
    else if (k === 'ArrowRight' || k === 'ArrowUp') onSeek(skipBy(pos, 15, ep.dur));
    else if (k === 'Home') onSeek(0);
    else if (k === 'End') onSeek(skipBy(ep.dur, -5, ep.dur));
    else return;
    e.preventDefault();
  };
  const svg = (
    <svg viewBox={`0 0 ${W} 40`} preserveAspectRatio="none" aria-hidden="true" className="rd-wave-svg">
      <defs>
        <clipPath id={clipId}>
          <rect x="0" y="0" width={W * f} height="40" />
        </clipPath>
      </defs>
      <g className="rd-wave-base">
        {bars.map((v, i) => (
          <rect key={i} x={i * 4 + 0.6} y={20 - v * 19} width="2.8" height={Math.max(1.5, v * 38)} rx="1.2" />
        ))}
      </g>
      <g className="rd-wave-done" clipPath={`url(#${clipId})`}>
        {bars.map((v, i) => (
          <rect key={i} x={i * 4 + 0.6} y={20 - v * 19} width="2.8" height={Math.max(1.5, v * 38)} rx="1.2" />
        ))}
      </g>
      {big &&
        ep.chapters.slice(1).map((c) => (
          <rect key={c.at} className="rd-wave-ch" x={timeToFraction(c.at, ep.dur) * W - 0.5} y="0" width="1" height="40" />
        ))}
    </svg>
  );
  if (!onSeek) return <div className={`rd-wave ${big ? 'is-big' : ''}`}>{svg}</div>;
  return (
    <div
      className={`rd-wave ${big ? 'is-big' : ''} is-seek`}
      role="slider"
      tabIndex={0}
      aria-label={t.waveLabel}
      aria-valuemin={0}
      aria-valuemax={Math.round(ep.dur)}
      aria-valuenow={Math.round(pos)}
      aria-valuetext={`${tc(pos, lang)} / ${tc(ep.dur, lang)}`}
      onPointerDown={pick}
      onKeyDown={key}
    >
      {svg}
    </div>
  );
}

// ---------- the app ----------

type Toast = { id: number; text: string };

export default function RadioApp({ initialLang }: { initialLang: Lang }) {
  const router = useRouter();
  const [lang, setLangState] = useState<Lang>(initialLang);
  const t = COPY[lang];
  const reduce = useReducedMotion();

  const [now, setNow] = useState<number | null>(null);
  const [saved, setSaved] = useState<Saved>(emptySaved);
  const savedRef = useRef(saved);
  savedRef.current = saved;
  const [epId, setEpId] = useState<string | null>(null);
  const [day, setDay] = useState(0);

  // the player
  const engineRef = useRef<RadioEngine | null>(null);
  const [engine, setEngine] = useState<RadioEngine | null>(null);
  const [src, setSrc] = useState<'live' | string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [unsupported, setUnsupported] = useState(false);
  const srcRef = useRef(src);
  srcRef.current = src;
  const posRef = useRef(pos);
  posRef.current = pos;
  const lastSavedPos = useRef(0);

  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);
  const toast = useCallback((text: string) => {
    const id = ++toastId.current;
    setToasts((xs) => [...xs.slice(-2), { id, text }]);
    setTimeout(() => setToasts((xs) => xs.filter((x) => x.id !== id)), 5200);
  }, []);

  const commit = useCallback((s: Saved) => {
    savedRef.current = s;
    setSaved(s);
    writeSaved(s);
  }, []);

  // ----- mount: clock, saved state, ?ep= -----
  useEffect(() => {
    const s = readSaved();
    savedRef.current = s;
    setSaved(s);
    const n = Date.now();
    setNow(n);
    setDay(zonedClock(new Date(n)).day);
    const fromUrl = () => {
      const id = new URLSearchParams(window.location.search).get('ep');
      setEpId(episodeById(id)?.id ?? null);
    };
    fromUrl();
    window.addEventListener('popstate', fromUrl);
    const iv = setInterval(() => setNow(Date.now()), 5000);
    return () => {
      clearInterval(iv);
      window.removeEventListener('popstate', fromUrl);
    };
  }, []);

  const clockNow = now === null ? null : zonedClock(new Date(now));
  const air = clockNow ? onNow(clockNow.day, clockNow.minute + clockNow.second / 60) : null;
  const ep = episodeById(epId);
  const srcEp = src && src !== 'live' ? episodeById(src) : null;

  // ----- reminders: a note when a show you asked about starts -----
  const lastShow = useRef<ShowId | null>(null);
  useEffect(() => {
    if (!air) return;
    const s = air.slot.show;
    if (lastShow.current && lastShow.current !== s && saved.remind.includes(s)) toast(t.remindNow(SHOWS[s].name[lang]));
    lastShow.current = s;
  }, [air, saved.remind, t, lang, toast]);

  // ----- the engine -----
  const ensure = useCallback((): RadioEngine | null => {
    if (engineRef.current) return engineRef.current;
    const e = RadioEngine.create();
    if (!e) {
      setUnsupported(true);
      return null;
    }
    e.setVolume(savedRef.current.vol);
    e.onEnd = () => {
      const cur = episodeById(srcRef.current);
      setPlaying(false);
      if (cur) {
        setPos(cur.dur);
        commit({ ...savedRef.current, progress: recordProgress(savedRef.current.progress, cur.id, cur.dur, cur.dur) });
      }
    };
    engineRef.current = e;
    setEngine(e);
    return e;
  }, [commit]);

  const saveProgress = useCallback(
    (id: string | null, p: number) => {
      const e = episodeById(id);
      if (!e) return;
      lastSavedPos.current = p;
      commit({ ...savedRef.current, progress: recordProgress(savedRef.current.progress, e.id, p, e.dur) });
    },
    [commit]
  );

  const playLive = useCallback(() => {
    const e = ensure();
    if (!e) return;
    if (srcRef.current && srcRef.current !== 'live') saveProgress(srcRef.current, e.position);
    e.playLive(showAt);
    setSrc('live');
    setPlaying(true);
  }, [ensure, saveProgress]);

  const playEpisode = useCallback(
    (id: string, from?: number) => {
      const target = episodeById(id);
      const e = ensure();
      if (!e || !target) return;
      if (srcRef.current && srcRef.current !== 'live' && srcRef.current !== id) saveProgress(srcRef.current, e.position);
      const start = from ?? resumeFrom(savedRef.current.progress[id], target.dur);
      e.playEpisode({ id, dur: target.dur, chapters: target.chapters.map((c) => c.at) }, start, savedRef.current.speed);
      setSrc(id);
      setPos(start);
      lastSavedPos.current = start;
      setPlaying(true);
    },
    [ensure, saveProgress]
  );

  const pause = useCallback(() => {
    const e = engineRef.current;
    if (!e) return;
    e.pause();
    setPlaying(false);
    if (srcRef.current && srcRef.current !== 'live') {
      setPos(e.position);
      saveProgress(srcRef.current, e.position);
    }
  }, [saveProgress]);

  const resume = useCallback(() => {
    const cur = srcRef.current;
    if (!cur) return playLive();
    const e = engineRef.current;
    if (!e || !e.source) {
      // The engine was closed in the background: start again where we were.
      if (cur === 'live') playLive();
      else playEpisode(cur, posRef.current);
      return;
    }
    const epNow = episodeById(cur);
    if (epNow && posRef.current >= epNow.dur - 1) return playEpisode(cur, 0);
    e.resume();
    setPlaying(true);
  }, [playLive, playEpisode]);

  const toggle = useCallback(() => (playing ? pause() : resume()), [playing, pause, resume]);

  const seek = useCallback(
    (sec: number) => {
      const cur = srcRef.current;
      const e = engineRef.current;
      if (!cur || cur === 'live' || !e) return;
      e.seek(sec);
      setPos(sec);
      saveProgress(cur, sec);
    },
    [saveProgress]
  );

  /** Seek within an episode — loading it first if the player has something else. */
  const seekEpisode = useCallback(
    (id: string, sec: number, andPlay: boolean) => {
      if (srcRef.current === id && engineRef.current?.source) {
        seek(sec);
        if (andPlay && !playing) resume();
      } else if (andPlay) playEpisode(id, sec);
      else {
        const target = episodeById(id);
        if (target) commit({ ...savedRef.current, progress: recordProgress(savedRef.current.progress, id, sec, target.dur) });
      }
    },
    [seek, playing, resume, playEpisode, commit]
  );

  const setSpeed = useCallback(
    (s: Speed) => {
      commit({ ...savedRef.current, speed: s });
      engineRef.current?.setRate(s);
    },
    [commit]
  );

  const setVolume = useCallback(
    (v: number) => {
      engineRef.current?.setVolume(v);
      commit({ ...savedRef.current, vol: v });
    },
    [commit]
  );

  // Episode position while it plays (and a save every 5 s).
  useEffect(() => {
    if (!playing || !src || src === 'live') return;
    const iv = setInterval(() => {
      const e = engineRef.current;
      if (!e) return;
      const p = e.position;
      setPos(p);
      if (Math.abs(p - lastSavedPos.current) >= 5) saveProgress(src, p);
    }, 250);
    return () => clearInterval(iv);
  }, [playing, src, saveProgress]);

  // Leaving the page keeps the spot.
  useEffect(() => {
    const keep = () => {
      const e = engineRef.current;
      if (e && srcRef.current && srcRef.current !== 'live') saveProgress(srcRef.current, e.position);
    };
    window.addEventListener('pagehide', keep);
    return () => window.removeEventListener('pagehide', keep);
  }, [saveProgress]);

  // In the background: schedule further ahead; paused for 30 s → close the
  // AudioContext; playing unattended for 90 min → pause.
  useEffect(() => {
    let closeT: ReturnType<typeof setTimeout> | null = null;
    let sleepT: ReturnType<typeof setTimeout> | null = null;
    const onVis = () => {
      const e = engineRef.current;
      const hidden = document.visibilityState === 'hidden';
      e?.setBackground(hidden);
      if (closeT) clearTimeout(closeT);
      if (sleepT) clearTimeout(sleepT);
      closeT = sleepT = null;
      if (!hidden || !e) return;
      if (!e.playing) {
        closeT = setTimeout(() => {
          if (engineRef.current && !engineRef.current.playing) {
            engineRef.current.close();
            engineRef.current = null;
            setEngine(null);
          }
        }, 30_000);
      } else {
        sleepT = setTimeout(() => {
          pauseRef.current();
          toast(COPY[langRef.current].hiddenStop);
        }, 90 * 60_000);
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      if (closeT) clearTimeout(closeT);
      if (sleepT) clearTimeout(sleepT);
    };
  }, [toast]);
  const pauseRef = useRef(pause);
  pauseRef.current = pause;
  const langRef = useRef(lang);
  langRef.current = lang;

  useEffect(
    () => () => {
      engineRef.current?.close();
      engineRef.current = null;
    },
    []
  );

  // ----- Media Session: lock-screen title, artwork and buttons -----
  const liveShow = air?.slot.show ?? 'mix';
  const segIndex = now === null ? 0 : liveSegment(now).index;
  const liveTune = TUNES[tuneIndex(segIndex, TUNES.length)][lang];
  useEffect(() => {
    if (!('mediaSession' in navigator) || !src) return;
    const ms = navigator.mediaSession;
    try {
      const show = srcEp ? srcEp.show : liveShow;
      const art = artwork(show);
      ms.metadata = new MediaMetadata({
        title: srcEp ? srcEp.title[lang] : `${SHOWS[liveShow].name[lang]} — ${liveTune}`,
        artist: srcEp ? `${SHOWS[srcEp.show].name[lang]} · ${hostLine(srcEp.show, lang)}` : `${hostLine(liveShow, lang)} · ${STATION[lang]}`,
        album: `${STATION[lang]} · ${srcEp ? t.podcast : t.live} (demo)`,
        artwork: art ? [{ src: art, sizes: '512x512', type: 'image/png' }] : [],
      });
      ms.playbackState = playing ? 'playing' : 'paused';
    } catch {
      /* older browsers */
    }
  }, [src, srcEp, liveShow, liveTune, lang, playing, t]);

  const handlers = useRef({ resume, pause, seek, playEpisode });
  handlers.current = { resume, pause, seek, playEpisode };
  useEffect(() => {
    if (!('mediaSession' in navigator) || !src) return;
    const ms = navigator.mediaSession;
    const set = (a: MediaSessionAction, h: MediaSessionActionHandler | null) => {
      try {
        ms.setActionHandler(a, h);
      } catch {
        /* not supported here */
      }
    };
    set('play', () => handlers.current.resume());
    set('pause', () => handlers.current.pause());
    set('stop', () => handlers.current.pause());
    const isEp = src !== 'live';
    const cur = episodeById(src);
    set('seekbackward', isEp ? () => handlers.current.seek(skipBy(posRef.current, -15, cur!.dur)) : null);
    set('seekforward', isEp ? () => handlers.current.seek(skipBy(posRef.current, 15, cur!.dur)) : null);
    set('seekto', isEp ? (d) => d.seekTime != null && handlers.current.seek(d.seekTime) : null);
    set('previoustrack', isEp ? () => handlers.current.seek(prevChapterSeek(cur!.chapters, posRef.current, cur!.dur)) : null);
    set('nexttrack', isEp
      ? () => {
          const n = nextChapterSeek(cur!.chapters, posRef.current, cur!.dur);
          if (n !== null) handlers.current.seek(n);
        }
      : null);
  }, [src]);
  useEffect(() => {
    if (!('mediaSession' in navigator) || !srcEp) return;
    try {
      navigator.mediaSession.setPositionState?.({ duration: srcEp.dur, playbackRate: saved.speed, position: Math.min(srcEp.dur, Math.max(0, pos)) });
    } catch {
      /* ignore */
    }
  }, [srcEp, pos, saved.speed]);

  // ----- language -----
  const setLang = (l: Lang) => {
    setLangState(l);
    try {
      document.cookie = `lang=${l}; path=/; max-age=${365 * 24 * 3600}; samesite=lax${location.protocol === 'https:' ? '; secure' : ''}`;
    } catch {
      /* ignore */
    }
    router.refresh();
  };

  // ----- episodes: ?ep= routing inside the demo -----
  const openEpisode = (id: string | null) => {
    setEpId(id);
    try {
      const url = id ? `${location.pathname}?ep=${encodeURIComponent(id)}` : location.pathname;
      history.pushState(null, '', url);
    } catch {
      /* ignore */
    }
    requestAnimationFrame(() => document.getElementById('rd-podcasts')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }));
  };

  // ----- reminders, reset -----
  const toggleRemind = (s: ShowId) => {
    const on = saved.remind.includes(s);
    commit({ ...saved, remind: on ? saved.remind.filter((x) => x !== s) : [...saved.remind, s] });
    toast(on ? t.remindOff(SHOWS[s].name[lang]) : t.remindSet(SHOWS[s].name[lang]));
  };
  const reset = () => {
    const keep = { ...emptySaved(), vol: saved.vol };
    commit(keep);
    if (src && src !== 'live') {
      engineRef.current?.stop();
      setSrc(null);
      setPlaying(false);
      setPos(0);
    }
    lastSavedPos.current = 0;
    toast(t.resetDone);
  };

  const listeners = air && now !== null ? listenersAt(now, air.slot.show) + (playing && src === 'live' ? 1 : 0) : null;
  const latestReq = saved.reqs[0] ?? null;

  const playerProps: PlayerProps = {
    t,
    lang,
    src,
    srcEp,
    playing,
    pos,
    air,
    engine,
    reduce,
    expanded,
    setExpanded,
    toggle,
    playLive,
    seek,
    speed: saved.speed,
    setSpeed,
    vol: saved.vol,
    setVolume,
    listeners,
    latestReq,
    unsupported,
    openEpisode,
  };

  return (
    <div className={`rd rd-lang-${lang}${src ? ' has-player' : ''}`} lang={lang} translate="no">
      <div className="rd-bar">
        <a href="#rd-top" className="rd-brand">
          <StationMark size={34} />
          <span>{STATION[lang]}</span>
        </a>
        <nav className="rd-nav" aria-label={t.navLabel}>
          <a href="#rd-top">{t.nav.live}</a>
          <a href="#rd-schedule">{t.nav.schedule}</a>
          <a href="#rd-podcasts">{t.nav.podcasts}</a>
          <a href="#rd-requests">{t.nav.requests}</a>
        </nav>
        <div className="rd-langs" role="group" aria-label={t.langLabel}>
          {LANGS.map((x) => (
            <button key={x.id} type="button" aria-pressed={lang === x.id} onClick={() => setLang(x.id)} lang={x.id} aria-label={x.label}>
              {x.short}
            </button>
          ))}
        </div>
      </div>

      {/* ---------- hero: what is on now ---------- */}
      <header className="rd-hero" id="rd-top">
        <div className="rd-hero-text">
          <p className="rd-kicker">
            <span className="rd-dot" aria-hidden="true" /> {t.liveKicker}
          </p>
          <h1 className="rd-h1">{STATION[lang]}</h1>
          <p className="rd-tagline">{t.tagline}</p>
          <p className="rd-madeup">{t.madeUp}</p>
        </div>
        <OnAirCard {...playerProps} />
      </header>

      <Schedule t={t} lang={lang} now={now} day={day} setDay={setDay} remind={saved.remind} toggleRemind={toggleRemind} />

      <section className="rd-section" id="rd-podcasts" aria-labelledby="rd-pod-h">
        <div className="rd-section-head">
          <h2 id="rd-pod-h">{t.podH}</h2>
          <p>{t.podSub}</p>
        </div>
        <Subscribe t={t} toast={toast} />
        {ep ? (
          <EpisodePage
            ep={ep}
            t={t}
            lang={lang}
            saved={saved}
            isSrc={src === ep.id}
            playing={playing && src === ep.id}
            pos={src === ep.id ? pos : saved.progress[ep.id]?.pos ?? 0}
            onBack={() => openEpisode(null)}
            onPlay={() => (src === ep.id ? (playing ? pause() : resume()) : playEpisode(ep.id))}
            onSeek={(sec, play) => seekEpisode(ep.id, sec, play)}
            onSkip={(d) => src === ep.id && seek(skipBy(pos, d, ep.dur))}
            speed={saved.speed}
            setSpeed={setSpeed}
          />
        ) : (
          <EpisodeList t={t} lang={lang} saved={saved} src={src} playing={playing} curPos={pos} open={openEpisode} play={(id) => (src === id && playing ? pause() : src === id ? resume() : playEpisode(id))} />
        )}
      </section>

      <Requests t={t} lang={lang} saved={saved} commit={commit} toast={toast} air={air} listeners={listeners} />

      <section className="rd-section rd-how" aria-labelledby="rd-how-h">
        <h2 id="rd-how-h">{t.howH}</h2>
        <ul>
          {t.how.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
        <button type="button" className="rd-btn rd-btn-ghost" onClick={reset}>
          {t.reset}
        </button>
      </section>

      <Player {...playerProps} />

      <div className="rd-toasts" role="status" aria-live="polite">
        {toasts.map((x) => (
          <p key={x.id} className="rd-toast">
            {x.text}
          </p>
        ))}
      </div>
    </div>
  );
}

// ---------- on air ----------

type PlayerProps = {
  t: Copy;
  lang: Lang;
  src: 'live' | string | null;
  srcEp: Episode | null;
  playing: boolean;
  pos: number;
  air: ReturnType<typeof onNow> | null;
  engine: RadioEngine | null;
  reduce: boolean;
  expanded: boolean;
  setExpanded: (v: boolean) => void;
  toggle: () => void;
  playLive: () => void;
  seek: (sec: number) => void;
  speed: Speed;
  setSpeed: (s: Speed) => void;
  vol: number;
  setVolume: (v: number) => void;
  listeners: number | null;
  latestReq: Saved['reqs'][number] | null;
  unsupported: boolean;
  openEpisode: (id: string | null) => void;
};

function OnAirCard(p: PlayerProps) {
  const { t, lang, air, src, playing, engine, reduce, listeners } = p;
  const liveOn = src === 'live' && playing;
  const show = air?.slot.show ?? null;
  return (
    <div className="rd-onair" style={show ? ({ '--rd-a': SHOWS[show].hue[0], '--rd-b': SHOWS[show].hue[1] } as CSSProperties) : undefined}>
      <div className="rd-onair-top">
        <span className={`rd-badge-air ${liveOn ? 'is-live' : ''}`}>
          <span className="rd-pulse" aria-hidden="true" />
          {t.onAir}
        </span>
        {listeners !== null && (
          <span className="rd-listeners">
            {t.listening(count(listeners, lang))} <small>({t.simulated})</small>
          </span>
        )}
      </div>
      {air && show ? (
        <>
          <div className="rd-onair-show">
            <HostFaces show={show} size={64} className="rd-onair-faces" />
            <div>
              <p className="rd-onair-name">{SHOWS[show].name[lang]}</p>
              <p className="rd-onair-host">{t.withHost(hostLine(show, lang))}</p>
              <p className="rd-onair-until">{t.until(hm(air.slot.end, lang))}</p>
            </div>
          </div>
          <div className="rd-progress" aria-hidden="true">
            <span style={{ width: `${Math.round(air.progress * 100)}%` }} />
          </div>
          <p className="rd-onair-blurb">{SHOWS[show].blurb[lang]}</p>
        </>
      ) : (
        <p className="rd-onair-blurb">{t.loadingNow}</p>
      )}
      <Visualizer engine={engine} playing={liveOn} reduce={reduce} className="rd-viz-hero" />
      <div className="rd-onair-ctl">
        <button type="button" className="rd-btn rd-btn-main" onClick={() => (src === 'live' ? p.toggle() : p.playLive())} aria-pressed={liveOn}>
          {liveOn ? <IconPause /> : <IconPlay />}
          {liveOn ? t.pause : t.listenLive}
        </button>
        {air && (
          <p className="rd-upnext">
            <span>{t.upNext}:</span> {hm(air.nextShow.start, lang)} · {SHOWS[air.nextShow.show].name[lang]}
          </p>
        )}
      </div>
      <p className="rd-note">{t.demoAudio}</p>
      {p.unsupported && <p className="rd-error">{t.noAudio}</p>}
    </div>
  );
}

// ---------- the persistent player ----------

function Ticker({ text, reduce, label }: { text: string; reduce: boolean; label: string }) {
  return (
    <div className={`rd-ticker ${reduce ? 'is-still' : ''}`} aria-label={label} role="group">
      <div className="rd-ticker-track">
        <span>{text}</span>
        {!reduce && <span aria-hidden="true">{text}</span>}
      </div>
    </div>
  );
}

function Player(p: PlayerProps) {
  const { t, lang, src, srcEp, playing, pos, air, engine, reduce, expanded, setExpanded, listeners } = p;
  const closeRef = useRef<HTMLButtonElement>(null);
  const openRef = useRef<HTMLButtonElement>(null);
  const [tick, setTick] = useState(() => Date.now());
  const isLive = src === 'live';

  // The ticker's own clock: once a second while live radio plays.
  useEffect(() => {
    if (!isLive || !playing) return;
    const iv = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(iv);
  }, [isLive, playing]);

  useEffect(() => {
    if (!expanded) return;
    closeRef.current?.focus();
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setExpanded(false);
    };
    document.addEventListener('keydown', onKey);
    document.documentElement.classList.add('rd-locked');
    return () => {
      document.removeEventListener('keydown', onKey);
      document.documentElement.classList.remove('rd-locked');
      openRef.current?.focus();
    };
  }, [expanded, setExpanded]);

  if (!src) return null;

  const show: ShowId = srcEp ? srcEp.show : (air?.slot.show ?? 'mix');
  const seg = liveSegment(tick);
  const inSting = (tick - seg.startMs) / 1000 < STING_SEC;
  const tune = TUNES[tuneIndex(seg.index, TUNES.length)][lang];
  let ticker: string;
  if (srcEp) {
    const ch = srcEp.chapters[chapterIndexAt(srcEp.chapters, pos)];
    ticker = `${SHOWS[srcEp.show].name[lang]} · ${t.epN(num(srcEp.n, lang))} · ${ch.title[lang]}`;
  } else {
    ticker = `${t.nowPlaying}: ${inSting ? t.jingle : t.tuneBy(tune)}`;
    if (p.latestReq) {
      const who = [p.latestReq.name || t.someone, p.latestReq.town].filter(Boolean).join(', ');
      const what = p.latestReq.kind === 'song' && p.latestReq.tune !== null ? t.wants(TUNES[p.latestReq.tune][lang]) : p.latestReq.msg;
      ticker += `  ·  ${t.requestOnAir(who, what)}`;
    }
  }
  const title = srcEp ? srcEp.title[lang] : SHOWS[show].name[lang];
  const sub = srcEp ? `${SHOWS[srcEp.show].name[lang]} · ${tc(pos, lang)} / ${tc(srcEp.dur, lang)}` : t.withHost(hostLine(show, lang));
  const style = { '--rd-a': SHOWS[show].hue[0], '--rd-b': SHOWS[show].hue[1] } as CSSProperties;

  const playBtn = (big?: boolean) => (
    <button type="button" className={`rd-play ${big ? 'is-big' : ''}`} onClick={p.toggle} aria-label={playing ? t.pause : t.play}>
      {playing ? <IconPause /> : <IconPlay />}
    </button>
  );

  return (
    <>
      <div className="rd-player" role="region" aria-label={t.playerLabel} style={style}>
        <div className="rd-player-in">
          <button type="button" ref={openRef} className="rd-player-art" onClick={() => setExpanded(true)} aria-label={t.open}>
            <ShowCover show={show} className="rd-mini-cover" />
          </button>
          <div className="rd-player-meta">
            <p className="rd-player-line">
              {isLive ? (
                <span className={`rd-chip-live ${playing ? 'is-on' : ''}`}>
                  <span className="rd-pulse" aria-hidden="true" />
                  {t.live}
                </span>
              ) : (
                <span className="rd-chip-pod">{t.podcast}</span>
              )}
              <span className="rd-player-title">{title}</span>
            </p>
            {isLive ? <Ticker text={ticker} reduce={reduce || !playing} label={t.tickerLabel} /> : <p className="rd-player-sub">{sub}</p>}
          </div>
          {!isLive && srcEp && (
            <button type="button" className="rd-icon-btn rd-hide-xs" onClick={() => p.seek(skipBy(pos, -15, srcEp.dur))} aria-label={t.back15}>
              <IconBack15 />
            </button>
          )}
          {playBtn()}
          {!isLive && srcEp && (
            <button type="button" className="rd-icon-btn rd-hide-xs" onClick={() => p.seek(skipBy(pos, 15, srcEp.dur))} aria-label={t.fwd15}>
              <IconFwd15 />
            </button>
          )}
          <Volume t={t} vol={p.vol} setVolume={p.setVolume} className="rd-hide-sm" />
          {listeners !== null && isLive && (
            <span className="rd-player-ears rd-hide-sm">
              {t.listening(count(listeners, lang))} <small>({t.simulated})</small>
            </span>
          )}
          <button type="button" className="rd-icon-btn" onClick={() => setExpanded(true)} aria-label={t.open} aria-expanded={expanded}>
            <IconUp />
          </button>
        </div>
        {!isLive && srcEp && (
          <div className="rd-player-progress" aria-hidden="true">
            <span style={{ width: `${timeToFraction(pos, srcEp.dur) * 100}%` }} />
          </div>
        )}
      </div>

      {expanded && (
        <div className="rd-sheet-wrap" onMouseDown={(e) => e.target === e.currentTarget && setExpanded(false)}>
          <div className="rd-sheet" role="dialog" aria-modal="true" aria-labelledby="rd-sheet-h" style={style}>
            <div className="rd-sheet-top">
              <button type="button" ref={closeRef} className="rd-icon-btn" onClick={() => setExpanded(false)} aria-label={t.close}>
                <IconDown />
              </button>
              <span className="rd-sheet-station">
                <StationMark size={22} /> {STATION[lang]}
              </span>
              {isLive ? (
                <span className={`rd-badge-air ${playing ? 'is-live' : ''}`}>
                  <span className="rd-pulse" aria-hidden="true" />
                  {t.onAir}
                </span>
              ) : (
                <span className="rd-chip-pod">{t.podcast}</span>
              )}
            </div>
            <div className="rd-sheet-art">
              <ShowCover show={show} className="rd-sheet-cover" seed={srcEp ? srcEp.n : 1} />
            </div>
            <h2 id="rd-sheet-h" className="rd-sheet-title">
              {title}
            </h2>
            <p className="rd-sheet-sub">{srcEp ? SHOWS[srcEp.show].name[lang] + ' · ' + hostLine(srcEp.show, lang) : t.withHost(hostLine(show, lang))}</p>
            {isLive ? (
              <>
                <Ticker text={ticker} reduce={reduce || !playing} label={t.tickerLabel} />
                <Visualizer engine={engine} playing={playing} reduce={reduce} className="rd-viz-sheet" />
                <div className="rd-sheet-ctl">{playBtn(true)}</div>
                {air && (
                  <p className="rd-upnext">
                    <span>{t.upNext}:</span> {hm(air.nextShow.start, lang)} · {SHOWS[air.nextShow.show].name[lang]}
                  </p>
                )}
                {listeners !== null && (
                  <p className="rd-listeners">
                    {t.listening(count(listeners, lang))} <small>({t.simulated})</small>
                  </p>
                )}
              </>
            ) : (
              srcEp && (
                <>
                  <Waveform ep={srcEp} pos={pos} onSeek={p.seek} t={t} lang={lang} big />
                  <div className="rd-times">
                    <span>{tc(pos, lang)}</span>
                    <span>{tc(srcEp.dur, lang)}</span>
                  </div>
                  <div className="rd-sheet-ctl">
                    <button type="button" className="rd-icon-btn" onClick={() => p.seek(prevChapterSeek(srcEp.chapters, pos, srcEp.dur))} aria-label={t.prevCh}>
                      <IconPrev />
                    </button>
                    <button type="button" className="rd-icon-btn" onClick={() => p.seek(skipBy(pos, -15, srcEp.dur))} aria-label={t.back15}>
                      <IconBack15 />
                    </button>
                    {playBtn(true)}
                    <button type="button" className="rd-icon-btn" onClick={() => p.seek(skipBy(pos, 15, srcEp.dur))} aria-label={t.fwd15}>
                      <IconFwd15 />
                    </button>
                    <button
                      type="button"
                      className="rd-icon-btn"
                      onClick={() => {
                        const n = nextChapterSeek(srcEp.chapters, pos, srcEp.dur);
                        if (n !== null) p.seek(n);
                      }}
                      aria-label={t.nextCh}
                    >
                      <IconNext />
                    </button>
                  </div>
                  <SpeedButtons t={t} lang={lang} speed={p.speed} setSpeed={p.setSpeed} />
                  <ChapterList ep={srcEp} pos={pos} lang={lang} t={t} onPick={(sec) => p.seek(sec)} />
                  <button
                    type="button"
                    className="rd-btn rd-btn-ghost rd-sheet-live"
                    onClick={() => {
                      p.playLive();
                    }}
                  >
                    <IconRadio /> {t.backToLive}
                  </button>
                </>
              )
            )}
            <Volume t={t} vol={p.vol} setVolume={p.setVolume} className="rd-sheet-vol" />
            <p className="rd-note">{srcEp ? t.demoEp : t.demoAudio}</p>
          </div>
        </div>
      )}
    </>
  );
}

function Volume({ t, vol, setVolume, className }: { t: Copy; vol: number; setVolume: (v: number) => void; className?: string }) {
  const last = useRef(vol || 0.8);
  if (vol > 0) last.current = vol;
  return (
    <div className={`rd-vol ${className ?? ''}`}>
      <button type="button" className="rd-icon-btn" onClick={() => setVolume(vol > 0 ? 0 : last.current)} aria-label={vol > 0 ? t.mute : t.unmute}>
        {vol > 0 ? <IconVolume /> : <IconMuted />}
      </button>
      <input type="range" min={0} max={100} step={1} value={Math.round(vol * 100)} onChange={(e) => setVolume(Number(e.target.value) / 100)} aria-label={t.volume} />
    </div>
  );
}

function SpeedButtons({ t, lang, speed, setSpeed }: { t: Copy; lang: Lang; speed: Speed; setSpeed: (s: Speed) => void }) {
  return (
    <div className="rd-speeds" role="group" aria-label={t.speed('').trim()}>
      {SPEEDS.map((s) => (
        <button key={s} type="button" aria-pressed={speed === s} onClick={() => setSpeed(s)} aria-label={t.speed(speedLabel(s, lang))}>
          {speedLabel(s, lang)}
        </button>
      ))}
    </div>
  );
}

function ChapterList({ ep, pos, lang, t, onPick }: { ep: Episode; pos: number; lang: Lang; t: Copy; onPick: (sec: number) => void }) {
  const cur = chapterIndexAt(ep.chapters, pos);
  return (
    <ol className="rd-chapters" aria-label={t.chapters}>
      {ep.chapters.map((c, i) => (
        <li key={c.at}>
          <button type="button" className={i === cur ? 'is-on' : ''} aria-current={i === cur ? 'true' : undefined} onClick={() => onPick(chapterSeek(ep.chapters, i, ep.dur))}>
            <span className="rd-ch-time">{tc(c.at, lang)}</span>
            <span className="rd-ch-title">{c.title[lang]}</span>
          </button>
        </li>
      ))}
    </ol>
  );
}

// ---------- schedule ----------

function Schedule({
  t,
  lang,
  now,
  day,
  setDay,
  remind,
  toggleRemind,
}: {
  t: Copy;
  lang: Lang;
  now: number | null;
  day: number;
  setDay: (d: number) => void;
  remind: ShowId[];
  toggleRemind: (s: ShowId) => void;
}) {
  const date = now === null ? null : new Date(now);
  const c = date ? zonedClock(date) : null;
  const slots = daySlots(day);
  const m = c ? c.minute + c.second / 60 : -1;
  /** Is this slot (of its own day) on air right now? Last night's late show counts too. */
  const isOn = (s: Slot) =>
    Boolean(c && ((s.day === c.day && s.start <= m && m < s.end) || (s.day === (c.day + 6) % 7 && s.end > 1440 && m + 1440 < s.end)));
  const ktm = (min: number, withDay = true) => {
    if (!date) return '';
    const z = inZone(min, date, NEPAL_TZ);
    return num(z.label, lang) + (withDay && z.dayShift > 0 ? ` (+${num(z.dayShift, lang)})` : '');
  };
  const local = date ? `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}` : '';
  const tabsRef = useRef<HTMLDivElement>(null);
  const onTabKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const n = (day + d + 7) % 7;
    setDay(n);
    tabsRef.current?.querySelectorAll<HTMLButtonElement>('[role=tab]')[n]?.focus();
  };
  const nowRow = c && c.minute >= GRID_FROM ? (c.minute - GRID_FROM) / GRID_STEP : c && c.minute < 60 ? (c.minute + 1440 - GRID_FROM) / GRID_STEP : null;
  const nowCol = c ? (c.minute < 60 ? (c.day + 6) % 7 : c.day) : null;

  return (
    <section className="rd-section" id="rd-schedule" aria-labelledby="rd-sched-h">
      <div className="rd-section-head">
        <h2 id="rd-sched-h">{t.schedH}</h2>
        <p>{t.schedSub}</p>
        {c && date && (
          <p className="rd-clocks">
            <span>{t.stationTime(hm(c.minute, lang))}</span>
            <span>{t.ktmTime(ktm(c.minute, false))}</span>
            {local !== hhmm(c.minute) && <span>{t.yourTime(num(local, lang))}</span>}
          </p>
        )}
      </div>

      <div className="rd-sched">
        {/* The week at a glance (a picture; the day list beside it is the way in for keyboards and screen readers). */}
        <div className="rd-week" aria-hidden="true">
          <div className="rd-week-head">
            <span />
            {t.daysShort.map((d, i) => (
              <span key={d} className={c && c.day === i ? 'is-today' : ''}>
                {d}
              </span>
            ))}
          </div>
          <div className="rd-week-body" style={{ '--rd-rows': GRID_ROWS } as CSSProperties}>
            {Array.from({ length: GRID_ROWS / 2 }, (_, h) => (
              <span key={h} className="rd-week-hour" style={{ gridRow: `${h * 2 + 1} / span 2`, gridColumn: 1 }}>
                {hm(GRID_FROM + h * 60, lang)}
              </span>
            ))}
            {Array.from({ length: 7 }, (_, d) =>
              daySlots(d).map((s) => {
                const r = gridRows(s);
                if (!r) return null;
                return (
                  <div
                    key={`${d}-${s.start}`}
                    className={`rd-week-slot ${s.filler ? 'is-mix' : ''} ${isOn(s) ? 'is-on' : ''} ${d === day ? 'is-day' : ''}`}
                    style={{ gridRow: `${r.from} / ${r.to}`, gridColumn: d + 2, '--rd-b': SHOWS[s.show].hue[1] } as CSSProperties}
                    onClick={() => setDay(d)}
                  >
                    {r.to - r.from >= 2 || !s.filler ? <span>{SHOWS[s.show].name[lang]}</span> : null}
                  </div>
                );
              })
            )}
            {nowRow !== null && nowCol !== null && nowRow < GRID_ROWS && (
              <span className="rd-week-now" style={{ gridColumn: nowCol + 2, gridRow: `${Math.floor(nowRow) + 1}`, '--rd-f': nowRow % 1 } as CSSProperties} />
            )}
          </div>
        </div>

        <div className="rd-day">
          <div className="rd-tabs" role="tablist" aria-label={t.dayTabs} ref={tabsRef} onKeyDown={onTabKey}>
            {t.daysShort.map((d, i) => (
              <button
                key={d}
                type="button"
                role="tab"
                id={`rd-tab-${i}`}
                aria-selected={day === i}
                aria-controls="rd-day-panel"
                tabIndex={day === i ? 0 : -1}
                onClick={() => setDay(i)}
                aria-label={t.daysLong[i] + (c && c.day === i ? ` · ${t.today}` : '')}
                className={c && c.day === i ? 'is-today' : ''}
              >
                {d}
              </button>
            ))}
          </div>
          <ol className="rd-slots" id="rd-day-panel" role="tabpanel" aria-labelledby={`rd-tab-${day}`}>
            {slots.map((s) => {
              const on = isOn(s);
              const reminded = remind.includes(s.show);
              return (
                <li key={s.start} className={`rd-slot ${s.filler ? 'is-mix' : ''} ${on ? 'is-on' : ''}`} style={{ '--rd-a': SHOWS[s.show].hue[0] } as CSSProperties}>
                  <div className="rd-slot-time">
                    <span className="rd-slot-start">{hm(s.start, lang)}</span>
                    <span className="rd-slot-end">
                      – {hm(s.end, lang)}
                      {s.end > 1440 ? ` (${t.nextDay})` : ''}
                    </span>
                    {date && (
                      <span className="rd-slot-ktm">
                        {t.ktmShort} {ktm(s.start)}
                      </span>
                    )}
                  </div>
                  <div className="rd-slot-body">
                    <p className="rd-slot-name">
                      {SHOWS[s.show].name[lang]}
                      {on && (
                        <span className="rd-chip-now">
                          <span className="rd-pulse" aria-hidden="true" />
                          {t.onNow}
                        </span>
                      )}
                    </p>
                    {!s.filler && <p className="rd-slot-host">{t.withHost(hostLine(s.show, lang))}</p>}
                    {!s.filler && <p className="rd-slot-blurb">{SHOWS[s.show].blurb[lang]}</p>}
                  </div>
                  {!s.filler && (
                    <button
                      type="button"
                      className={`rd-remind ${reminded ? 'is-on' : ''}`}
                      aria-pressed={reminded}
                      onClick={() => toggleRemind(s.show)}
                      aria-label={`${reminded ? t.reminded : t.remind}: ${SHOWS[s.show].name[lang]}`}
                    >
                      <IconBell />
                      <span>{reminded ? t.reminded : t.remind}</span>
                    </button>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}

// ---------- podcasts ----------

function Subscribe({ t, toast }: { t: Copy; toast: (s: string) => void }) {
  const items = [
    { k: 'rss', icon: <IconFeed />, label: t.subscribe.rss },
    { k: 'app', icon: <IconPodApp />, label: t.subscribe.app },
    { k: 'music', icon: <IconMusic />, label: t.subscribe.music },
    { k: 'copy', icon: <IconLink />, label: t.subscribe.copy },
  ];
  return (
    <div className="rd-subscribe">
      <p className="rd-subscribe-h">
        {t.subscribeH} <span className="rd-demo-tag">demo</span>
      </p>
      <div className="rd-subscribe-row">
        {items.map((x) => (
          <button key={x.k} type="button" className="rd-sub-btn" onClick={() => toast(t.subscribeToast)}>
            {x.icon}
            <span>{x.label}</span>
          </button>
        ))}
      </div>
      <p className="rd-note">{t.subscribeNote}</p>
    </div>
  );
}

function EpisodeList({
  t,
  lang,
  saved,
  src,
  playing,
  curPos,
  open,
  play,
}: {
  t: Copy;
  lang: Lang;
  saved: Saved;
  src: string | null;
  playing: boolean;
  curPos: number;
  open: (id: string) => void;
  play: (id: string) => void;
}) {
  return (
    <ul className="rd-eps">
      {EPISODES.map((e) => {
        const pr = saved.progress[e.id];
        const isPlaying = src === e.id && playing;
        const resumeAt = resumeFrom(pr, e.dur);
        return (
          <li key={e.id} className={`rd-ep ${src === e.id ? 'is-src' : ''}`}>
            <ShowCover show={e.show} className="rd-ep-cover" seed={e.n} />
            <div className="rd-ep-body">
              <p className="rd-ep-meta">
                {SHOWS[e.show].name[lang]} · {t.epN(num(e.n, lang))} · {dateLabel(e.date, lang)} · {t.minutes(num(Math.round(e.dur / 60), lang))}
              </p>
              <h3 className="rd-ep-title">
                <a
                  href={`?ep=${e.id}`}
                  onClick={(ev) => {
                    ev.preventDefault();
                    open(e.id);
                  }}
                >
                  {e.title[lang]}
                </a>
              </h3>
              <p className="rd-ep-desc">{e.desc[lang]}</p>
              <Waveform ep={e} pos={src === e.id ? curPos : (pr?.pos ?? 0)} t={t} lang={lang} />
              <p className="rd-ep-state">
                {pr?.done && <span className="rd-chip-done">✓ {t.played}</span>}
                {resumeAt > 0 && <span>{t.resumeAt(tc(pr!.pos, lang))}</span>}
                {isPlaying && <span className="rd-chip-playing">{t.playingNow}</span>}
              </p>
            </div>
            <button type="button" className="rd-ep-play" onClick={() => play(e.id)} aria-label={`${isPlaying ? t.pauseEp : t.playEp}: ${e.title[lang]}`}>
              {isPlaying ? <IconPause /> : <IconPlay />}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function EpisodePage({
  ep,
  t,
  lang,
  saved,
  isSrc,
  playing,
  pos,
  onBack,
  onPlay,
  onSeek,
  onSkip,
  speed,
  setSpeed,
}: {
  ep: Episode;
  t: Copy;
  lang: Lang;
  saved: Saved;
  isSrc: boolean;
  playing: boolean;
  pos: number;
  onBack: () => void;
  onPlay: () => void;
  onSeek: (sec: number, play: boolean) => void;
  onSkip: (d: number) => void;
  speed: Speed;
  setSpeed: (s: Speed) => void;
}) {
  const pr = saved.progress[ep.id];
  const resumeAt = isSrc ? 0 : resumeFrom(pr, ep.dur);
  const label = playing ? t.pauseEp : resumeAt > 0 ? t.resumeEp(tc(pr!.pos, lang)) : t.playEp;
  const shown = isSrc ? pos : (pr?.pos ?? 0);
  return (
    <article className="rd-epage" aria-labelledby="rd-epage-h">
      <button type="button" className="rd-back" onClick={onBack}>
        <IconBack /> {t.allEpisodes}
      </button>
      <div className="rd-epage-head">
        <ShowCover show={ep.show} className="rd-epage-cover" seed={ep.n} />
        <div>
          <p className="rd-ep-meta">
            {SHOWS[ep.show].name[lang]} · {t.epN(num(ep.n, lang))} · {dateLabel(ep.date, lang)} · {t.minutes(num(Math.round(ep.dur / 60), lang))}
          </p>
          <h3 id="rd-epage-h" className="rd-epage-title">
            {ep.title[lang]}
          </h3>
          <p className="rd-epage-hosts">
            <HostFaces show={ep.show} size={32} /> {hostLine(ep.show, lang)}
          </p>
        </div>
      </div>

      <div className="rd-epage-player">
        <Waveform ep={ep} pos={shown} onSeek={(sec) => onSeek(sec, isSrc && playing)} t={t} lang={lang} big />
        <div className="rd-times">
          <span>{tc(shown, lang)}</span>
          <span>{tc(ep.dur, lang)}</span>
        </div>
        <div className="rd-epage-ctl">
          <button type="button" className="rd-icon-btn" onClick={() => (isSrc ? onSkip(-15) : onSeek(skipBy(shown, -15, ep.dur), false))} aria-label={t.back15}>
            <IconBack15 />
          </button>
          <button type="button" className="rd-btn rd-btn-main" onClick={onPlay}>
            {playing ? <IconPause /> : <IconPlay />}
            {label}
          </button>
          <button type="button" className="rd-icon-btn" onClick={() => (isSrc ? onSkip(15) : onSeek(skipBy(shown, 15, ep.dur), false))} aria-label={t.fwd15}>
            <IconFwd15 />
          </button>
          <SpeedButtons t={t} lang={lang} speed={speed} setSpeed={setSpeed} />
        </div>
        {pr && (pr.pos > 0 || pr.done) && !isSrc && (
          <button type="button" className="rd-linkbtn" onClick={() => onSeek(0, true)}>
            {t.startOver}
          </button>
        )}
        <p className="rd-note">{t.demoEp}</p>
      </div>

      <div className="rd-epage-cols">
        <div>
          <h4>{t.aboutEp}</h4>
          <p>{ep.desc[lang]}</p>
          <h4>{t.showNotes}</h4>
          <ul className="rd-notes">
            {ep.notes.map((n) => (
              <li key={n.en}>{n[lang]}</li>
            ))}
          </ul>
          <h4>{t.hosts}</h4>
          <ul className="rd-hostlist">
            {SHOWS[ep.show].hosts.map((h) => (
              <li key={h}>
                <Avatar host={h} size={44} />
                {HOSTS[h].name[lang]}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4>{t.chapters}</h4>
          <ChapterList ep={ep} pos={shown} lang={lang} t={t} onPick={(sec) => onSeek(sec, true)} />
        </div>
      </div>
    </article>
  );
}

// ---------- requests ----------

function Requests({
  t,
  lang,
  saved,
  commit,
  toast,
  air,
  listeners,
}: {
  t: Copy;
  lang: Lang;
  saved: Saved;
  commit: (s: Saved) => void;
  toast: (s: string) => void;
  air: ReturnType<typeof onNow> | null;
  listeners: number | null;
}) {
  const [kind, setKind] = useState<ReqKind>('song');
  const [name, setName] = useState('');
  const [town, setTown] = useState('');
  const [tune, setTune] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState<'tune' | 'msg' | null>(null);

  const reader = (air && SHOWS[air.slot.show].hosts[0]) || 'nabin';

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const r = cleanRequest({ kind, name, town, tune, msg }, TUNES.length, Date.now());
    if (!r.ok) {
      setErr(r.error);
      return;
    }
    setErr(null);
    commit({ ...saved, reqs: addRequest(saved.reqs, r.req) });
    setMsg('');
    setTune('');
    toast(t.sent);
  };

  return (
    <section className="rd-section" id="rd-requests" aria-labelledby="rd-req-h">
      <div className="rd-section-head">
        <h2 id="rd-req-h">{t.reqH}</h2>
        <p>{t.reqSub}</p>
      </div>
      <div className="rd-req">
        <form className="rd-form" onSubmit={submit} noValidate>
          <fieldset className="rd-kinds">
            <legend>{t.kindLabel}</legend>
            {(['song', 'shout'] as const).map((k) => (
              <label key={k} className={kind === k ? 'is-on' : ''}>
                <input type="radio" name="rd-kind" value={k} checked={kind === k} onChange={() => setKind(k)} />
                {k === 'song' ? t.kindSong : t.kindShout}
              </label>
            ))}
          </fieldset>
          <div className="rd-form-row">
            <label>
              <span>{t.yourName}</span>
              <input type="text" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} autoComplete="off" />
            </label>
            <label>
              <span>{t.town}</span>
              <input type="text" value={town} maxLength={40} onChange={(e) => setTown(e.target.value)} autoComplete="off" />
            </label>
          </div>
          {kind === 'song' && (
            <label>
              <span>{t.tune}</span>
              <select value={tune} onChange={(e) => setTune(e.target.value)} aria-invalid={err === 'tune'} aria-describedby={err === 'tune' ? 'rd-req-err' : undefined}>
                <option value="">{t.tunePick}</option>
                {TUNES.map((x, i) => (
                  <option key={x.en} value={i}>
                    {x[lang]}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            <span>{kind === 'song' ? t.msgSong : t.msgShout}</span>
            <textarea
              value={msg}
              maxLength={200}
              rows={3}
              onChange={(e) => setMsg(e.target.value)}
              aria-invalid={err === 'msg'}
              aria-describedby={err === 'msg' ? 'rd-req-err' : undefined}
            />
          </label>
          <p className="rd-form-err" id="rd-req-err" role="alert">
            {err === 'tune' ? t.errTune : err === 'msg' ? t.errMsg : ''}
          </p>
          <div className="rd-form-foot">
            <button type="submit" className="rd-btn rd-btn-main">
              {t.send}
            </button>
            <span className="rd-note">{t.nothingSent}</span>
          </div>
        </form>

        <div className="rd-onair-reqs">
          <h3>{t.onAirH}</h3>
          {listeners !== null && (
            <p className="rd-listeners">
              {t.listening(count(listeners, lang))} <small>({t.simulated})</small>
            </p>
          )}
          <ul>
            {saved.reqs.map((r) => (
              <li key={r.id} className="rd-reqcard is-mine">
                <Avatar host={reader} size={40} />
                <div>
                  <p className="rd-req-who">
                    {[r.name || t.someone, r.town].filter(Boolean).join(' · ')} <span className="rd-chip-mine">{t.yours}</span>
                  </p>
                  {r.kind === 'song' && r.tune !== null && <p className="rd-req-what">{t.wants(TUNES[r.tune][lang])}</p>}
                  {r.msg && <p className="rd-req-msg">{r.msg}</p>}
                  <p className="rd-req-by">
                    {t.readBy(HOSTS[reader].name[lang])} · {t.nothingSent}
                  </p>
                </div>
              </li>
            ))}
            {SEED_REQUESTS.map((r) => (
              <li key={r.id} className="rd-reqcard">
                <Avatar host={r.host} size={40} />
                <div>
                  <p className="rd-req-who">
                    {r.name} · {r.town[lang]}
                  </p>
                  {r.kind === 'song' && r.tune !== null && <p className="rd-req-what">{t.wants(TUNES[r.tune][lang])}</p>}
                  <p className="rd-req-msg">{r.msg[lang]}</p>
                  <p className="rd-req-by">{t.readBy(HOSTS[r.host].name[lang])}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
