'use client';

// The demo artist page itself: hero, music player, tour, about + press, stage
// videos, press kit and a booking enquiry, in English, Deutsch or नेपाली. Everything
// runs in the browser — the songs are composed and played live (synth.ts),
// the press kit is drawn on the spot (presskit.ts), and the booking form only
// checks what is typed: it sends nothing and stores nothing.

import { useCallback, useEffect, useRef, useState, type CSSProperties, type FormEvent, type MutableRefObject } from 'react';
import { useRouter } from 'next/navigation';
import StudioPlayer from '@/components/StudioPlayer';
import { setSiteLangCookie } from '@/components/studio/siteLang';
import { videoById, type StudioVideo } from '@/lib/studioVideos';
import { Cover, Hills, Portrait } from './art';
import { BOOKING_EMAIL, COPY, LANGS, TOUR, fmtNum, showDate, toNeDigits, type ArtistLang } from './content';
import { bioText, contactCard, oneSheet, saveBlob } from './presskit';
import { DemoSynth, TRACKS, trackLength } from './synth';

function prefersLessMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/** Devanagari digits in their own span: the display face (Rozha One) draws them like Latin ones. */
function withNums(text: string) {
  const parts = text.split(/([०-९]+)/);
  return parts.length === 1 ? text : parts.map((p, i) => (i % 2 ? <span key={i} className="ar-num">{p}</span> : p));
}

function clock(sec: number, lang: ArtistLang): string {
  const s = Math.max(0, Math.floor(sec));
  const out = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  return lang === 'ne' ? toNeDigits(out) : out;
}

// ---------- the player ----------

type StartRef = MutableRefObject<(() => void) | null>;

function Visualizer({ synth, playing, hue }: { synth: DemoSynth | null; playing: boolean; hue: [string, string] }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const g = canvas.getContext('2d');
    if (!g) return;
    const analyser = synth?.analyser ?? null;
    const freq = new Uint8Array(analyser ? analyser.frequencyBinCount : 0);
    const wave = new Uint8Array(analyser ? analyser.fftSize : 0);
    const binHz = analyser ? analyser.context.sampleRate / analyser.fftSize : 1;
    let raf = 0;

    const draw = () => {
      const W = canvas.width;
      const H = canvas.height;
      if (!W || !H) return;
      g.clearRect(0, 0, W, H);
      const N = Math.max(24, Math.min(64, Math.floor(W / 14)));
      const gap = W / N;
      const bw = Math.max(2, gap * 0.56);
      const mid = H / 2;
      const live = Boolean(analyser && playing);
      if (live && analyser) {
        analyser.getByteFrequencyData(freq);
        analyser.getByteTimeDomainData(wave);
      }
      const grad = g.createLinearGradient(0, 0, W, 0);
      grad.addColorStop(0, hue[0]);
      grad.addColorStop(0.55, '#ff6f91');
      grad.addColorStop(1, '#ffd27a');
      g.fillStyle = grad;
      for (let i = 0; i < N; i++) {
        let v: number;
        if (live) {
          // Log spread, 70 Hz to 6 kHz — where the drum, drone and flute live.
          const f = 70 * Math.pow(6000 / 70, i / (N - 1));
          const bin = Math.min(freq.length - 1, Math.round(f / binHz));
          v = freq[bin] / 255;
        } else {
          v = 0.06 + 0.05 * (1 + Math.sin(i * 0.7)) + 0.03 * (1 + Math.cos(i * 1.9));
        }
        const h = Math.max(2, v * H * 0.44);
        const x = i * gap + (gap - bw) / 2;
        g.globalAlpha = live ? 0.95 : 0.4;
        g.fillRect(x, mid - h, bw, h);
        g.globalAlpha = live ? 0.35 : 0.18;
        g.fillRect(x, mid + 2, bw, h * 0.7);
      }
      g.globalAlpha = 1;
      if (live) {
        g.strokeStyle = 'rgba(255,255,255,0.55)';
        g.lineWidth = Math.max(1, W / 600);
        g.beginPath();
        const step = Math.max(1, Math.floor(wave.length / W));
        for (let x = 0, j = 0; j < wave.length; j += step, x += W / (wave.length / step)) {
          const y = mid + ((wave[j] - 128) / 128) * H * 0.3;
          if (j === 0) g.moveTo(x, y);
          else g.lineTo(x, y);
        }
        g.stroke();
        raf = requestAnimationFrame(draw);
      }
    };
    // Resizing clears the canvas, so a still (paused) picture is drawn again.
    const fit = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.round(canvas.clientWidth * dpr);
      const h = Math.round(canvas.clientHeight * dpr);
      if (w === canvas.width && h === canvas.height) return;
      canvas.width = w;
      canvas.height = h;
      if (!(analyser && playing)) draw();
    };
    fit();
    const ro = 'ResizeObserver' in window ? new ResizeObserver(fit) : null;
    ro?.observe(canvas);
    draw();
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
    };
  }, [synth, playing, hue]);

  return <canvas ref={ref} className="ar-viz" aria-hidden="true" />;
}

function Player({ lang, startRef }: { lang: ArtistLang; startRef: StartRef }) {
  const t = COPY[lang];
  const [synth, setSynth] = useState<DemoSynth | null>(null);
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const [unsupported, setUnsupported] = useState(false);
  const loaded = useRef(-1);
  const currentRef = useRef(0);
  currentRef.current = current;
  const synthRef = useRef<DemoSynth | null>(null);

  const ensure = useCallback((): DemoSynth | null => {
    if (synthRef.current) return synthRef.current;
    const s = DemoSynth.create();
    if (!s) {
      setUnsupported(true);
      return null;
    }
    synthRef.current = s;
    setSynth(s);
    s.onEnd = () => {
      const next = currentRef.current + 1;
      if (next < TRACKS.length) {
        s.load(TRACKS[next]);
        loaded.current = next;
        setCurrent(next);
        setPos(0);
      } else {
        loaded.current = -1;
        setPlaying(false);
        setPos(0);
        setCurrent(0);
        void s.ctx.suspend();
      }
    };
    return s;
  }, []);

  const start = useCallback(
    (i: number, from = 0) => {
      const s = ensure();
      if (!s) return;
      s.load(TRACKS[i], from);
      loaded.current = i;
      setCurrent(i);
      setPos(from);
      setPlaying(true);
    },
    [ensure]
  );

  const toggle = () => {
    const s = ensure();
    if (!s) return;
    if (playing) {
      s.pause();
      setPlaying(false);
    } else if (loaded.current === current) {
      s.play();
      setPlaying(true);
    } else start(current, pos);
  };

  // The hero's "Listen" button starts the music from here.
  useEffect(() => {
    startRef.current = () => {
      if (!synthRef.current || loaded.current === -1 || !synthRef.current.playing) start(currentRef.current, 0);
    };
    return () => {
      startRef.current = null;
    };
  }, [start, startRef]);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      const s = synthRef.current;
      if (s) setPos(s.position);
    }, 200);
    return () => clearInterval(id);
  }, [playing]);

  useEffect(
    () => () => {
      synthRef.current?.close();
      synthRef.current = null;
    },
    []
  );

  const def = TRACKS[current];
  const len = trackLength(def);
  const tr = t.tracks[def.id];

  const seek = (v: number) => {
    setPos(v);
    const s = synthRef.current;
    if (s && loaded.current === current) s.seekTo(v);
  };

  return (
    <div className="ar-player" style={{ '--ar-hue-a': def.hue[0], '--ar-hue-b': def.hue[1] } as CSSProperties}>
      <div className="ar-player-main">
        <div className={`ar-disc${playing ? ' is-playing' : ''}`}>
          <Cover id={def.id} hue={def.hue} />
        </div>
        <div className="ar-player-info">
          <p className="ar-now">
            <span className="ar-chip ar-chip-demo">{t.demo}</span> {playing ? t.nowPlaying : t.tapToPlay}
          </p>
          <h3 className="ar-track-title">
            {tr.title} <span>· {tr.meaning}</span>
          </h3>
          <p className="ar-track-mood">{tr.mood}</p>
          <div className="ar-controls">
            <button type="button" className="ar-ctl" aria-label={t.prev} onClick={() => start((current + TRACKS.length - 1) % TRACKS.length)}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 5h2v14H6zM20 5v14L9 12z" />
              </svg>
            </button>
            <button type="button" className="ar-ctl ar-ctl-play" aria-label={playing ? t.pause : t.play} aria-pressed={playing} onClick={toggle}>
              {playing ? (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M7 5h4v14H7zM13 5h4v14h-4z" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>
            <button type="button" className="ar-ctl" aria-label={t.next} onClick={() => start((current + 1) % TRACKS.length)}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M16 5h2v14h-2zM4 5v14l11-7z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <Visualizer synth={synth} playing={playing} hue={def.hue} />

      <div className="ar-progress">
        <span className="ar-time">{clock(pos, lang)}</span>
        <input
          type="range"
          min={0}
          max={Math.floor(len * 10) / 10}
          step={0.1}
          value={Math.min(pos, len)}
          aria-label={t.seek}
          aria-valuetext={`${clock(pos, lang)} / ${clock(len, lang)}`}
          style={{ '--p': `${(Math.min(pos, len) / len) * 100}%` } as CSSProperties}
          onChange={(e) => seek(Number(e.target.value))}
        />
        <span className="ar-time">{clock(len, lang)}</span>
      </div>

      {unsupported && (
        <p className="ar-error" role="alert">
          {t.noAudio}
        </p>
      )}

      <ol className="ar-tracks">
        {TRACKS.map((d, i) => {
          const on = i === current;
          return (
            <li key={d.id}>
              <button type="button" className={on ? 'on' : ''} aria-current={on ? 'true' : undefined} onClick={() => (on ? toggle() : start(i))}>
                <span className="ar-tracks-n">{on && playing ? <span className="ar-mini-eq" aria-hidden="true"><i /><i /><i /></span> : lang === 'ne' ? toNeDigits(i + 1) : i + 1}</span>
                <span className="ar-tracks-cover">
                  <Cover id={d.id} hue={d.hue} />
                </span>
                <span className="ar-tracks-name">
                  <strong>{t.tracks[d.id].title}</strong>
                  <small>{t.tracks[d.id].mood}</small>
                </span>
                <span className="ar-tracks-len">{clock(trackLength(d), lang)}</span>
              </button>
            </li>
          );
        })}
      </ol>
      <p className="ar-demo-note">♪ {t.demoMelodies}</p>
      <p className="ar-hint">{t.iphoneHint}</p>
    </div>
  );
}

// ---------- tour ----------

function Tour({ lang }: { lang: ArtistLang }) {
  const t = COPY[lang];
  const [open, setOpen] = useState<string | null>(null);
  return (
    <>
      <ol className="ar-tour">
        {TOUR.map((stop, i) => {
          const d = showDate(stop.date, lang);
          const p = t.stops[stop.id];
          const isOpen = open === stop.id;
          const sold = stop.status === 'soldout';
          return (
            <li key={stop.id} className={`ar-stop${sold ? ' is-sold' : ''}`} data-reveal style={{ '--i': i } as CSSProperties}>
              <div className="ar-stop-row">
                <p className="ar-stop-date">
                  <strong>{d.day}</strong>
                  <span>{d.month}</span>
                  <small>{d.weekday}</small>
                </p>
                <div className="ar-stop-where">
                  <h3>
                    {p.city} <span>· {p.country}</span>
                  </h3>
                  <p>{p.venue}</p>
                </div>
                <span className={`ar-status ar-status-${stop.status}`}>{t.status[stop.status]}</span>
                <button
                  type="button"
                  className="ar-btn ar-btn-small"
                  aria-expanded={isOpen}
                  aria-controls={`ar-tix-${stop.id}`}
                  disabled={sold}
                  onClick={() => setOpen(isOpen ? null : stop.id)}
                >
                  {t.tickets}
                </button>
              </div>
              {isOpen && (
                <div className="ar-tix" id={`ar-tix-${stop.id}`} role="note">
                  <p>{t.ticketsNote}</p>
                  <div className="ar-tix-row">
                    <a href="/events" className="ar-link">
                      {t.ticketsLink}
                    </a>
                    <button type="button" className="ar-link" onClick={() => setOpen(null)}>
                      {t.close}
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ol>
      <p className="ar-demo-note ar-center">{t.tourDemo}</p>
    </>
  );
}

// ---------- about ----------

function Stats({ lang }: { lang: ArtistLang }) {
  const t = COPY[lang];
  const ref = useRef<HTMLDListElement>(null);
  const [k, setK] = useState(1);

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersLessMotion() || !('IntersectionObserver' in window)) return;
    const r = el.getBoundingClientRect();
    if (r.top < window.innerHeight) return; // already on screen: just show the numbers
    setK(0);
    let raf = 0;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        const t0 = performance.now();
        const run = (now: number) => {
          const p = Math.min(1, (now - t0) / 1300);
          setK(1 - Math.pow(1 - p, 3));
          if (p < 1) raf = requestAnimationFrame(run);
        };
        raf = requestAnimationFrame(run);
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <dl className="ar-stats" ref={ref}>
      {t.stats.map((s) => {
        const v = fmtNum((s.value * k).toFixed(s.decimals), lang) + s.suffix;
        return (
          <div key={s.label}>
            <dt>{s.label}</dt>
            <dd>{v}</dd>
          </div>
        );
      })}
    </dl>
  );
}

// ---------- press kit ----------

type KitId = 'sheet' | 'bio' | 'card';

function PressKit({ lang, rootRef }: { lang: ArtistLang; rootRef: MutableRefObject<HTMLDivElement | null> }) {
  const t = COPY[lang];
  const [busy, setBusy] = useState<KitId | null>(null);
  const [done, setDone] = useState<KitId[]>([]);
  const mark = (id: KitId) => setDone((d) => (d.includes(id) ? d : [...d, id]));

  const get = async (id: KitId) => {
    if (busy) return;
    const suffix = lang === 'en' ? '' : `-${lang}`;
    if (id === 'bio') {
      saveBlob(new Blob([bioText(lang)], { type: 'text/plain;charset=utf-8' }), `rimjhim-tara-bio${suffix}.txt`);
      mark(id);
      return;
    }
    if (id === 'card') {
      saveBlob(new Blob([contactCard(lang)], { type: 'text/vcard;charset=utf-8' }), `rimjhim-tara-booking.vcf`);
      mark(id);
      return;
    }
    setBusy(id);
    try {
      const root = rootRef.current;
      const blob = root ? await oneSheet(lang, root) : null;
      if (blob) {
        saveBlob(blob, `rimjhim-tara-one-sheet${suffix}.png`);
        mark(id);
      }
    } finally {
      setBusy(null);
    }
  };

  const items: { id: KitId; title: string; text: string; icon: string }[] = [
    { id: 'sheet', title: t.kitSheet, text: t.kitSheetText, icon: 'M4 4h16v16H4zM4 15l5-5 4 4 3-3 4 4' },
    { id: 'bio', title: t.kitBio, text: t.kitBioText, icon: 'M6 3h9l4 4v14H6zM9 10h7M9 14h7M9 18h5' },
    { id: 'card', title: t.kitCard, text: t.kitCardText, icon: 'M3 6h18v12H3zM8 11a2 2 0 1 0 0-.01M5.5 16c.6-1.6 1.6-2.4 2.5-2.4s1.9.8 2.5 2.4M14 10h4M14 14h4' },
  ];

  return (
    <>
      <div className="ar-kit">
        {items.map((it) => (
          <button key={it.id} type="button" className="ar-kit-item" onClick={() => void get(it.id)} disabled={busy !== null} data-reveal>
            <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d={it.icon} />
            </svg>
            <strong>{it.title}</strong>
            <span>{it.text}</span>
            <em aria-live="polite">{busy === it.id ? t.kitMaking : done.includes(it.id) ? t.kitDone : '↓'}</em>
          </button>
        ))}
      </div>
      <p className="ar-demo-note ar-center">{t.kitNote}</p>
    </>
  );
}

// ---------- booking ----------

type Enquiry = {
  name: string;
  email: string;
  org: string;
  city: string;
  date: string;
  type: 'concert' | 'festival' | 'community' | 'other';
  size: 's' | 'm' | 'l' | 'xl';
  message: string;
};
type Field = 'name' | 'email' | 'city' | 'date';

const BLANK: Enquiry = { name: '', email: '', org: '', city: '', date: '', type: 'concert', size: 'm', message: '' };

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function Booking({ lang }: { lang: ArtistLang }) {
  const t = COPY[lang];
  const [form, setForm] = useState<Enquiry>(BLANK);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [sent, setSent] = useState<Enquiry | null>(null);
  const [minDate, setMinDate] = useState<string | undefined>(undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const thanksRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMinDate(todayIso()), []);
  useEffect(() => {
    if (sent) thanksRef.current?.focus();
  }, [sent]);

  const check = (f: Enquiry): Partial<Record<Field, string>> => {
    const e: Partial<Record<Field, string>> = {};
    if (!f.name.trim()) e.name = t.errName;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.trim())) e.email = t.errEmail;
    if (!f.city.trim()) e.city = t.errCity;
    if (!f.date) e.date = t.errDate;
    else if (f.date < todayIso()) e.date = t.errDatePast;
    return e;
  };

  const submit = (ev: FormEvent) => {
    ev.preventDefault();
    const e = check(form);
    setErrors(e);
    const first = (['name', 'email', 'city', 'date'] as Field[]).find((k) => e[k]);
    if (first) {
      formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      return;
    }
    // Nothing leaves the page: the "sent" state only lives in memory.
    setSent({ ...form, name: form.name.trim().slice(0, 80), city: form.city.trim().slice(0, 60), message: form.message.slice(0, 600) });
  };

  const set = <K extends keyof Enquiry>(k: K, v: Enquiry[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (k in errors) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  if (sent) {
    const first = sent.name.split(/\s+/)[0];
    const d = showDate(sent.date, lang);
    return (
      <div className="ar-thanks" role="status" tabIndex={-1} ref={thanksRef}>
        <div className="ar-thanks-eq" aria-hidden="true">
          {Array.from({ length: 9 }, (_, i) => (
            <i key={i} style={{ '--i': i } as CSSProperties} />
          ))}
        </div>
        <h3>{t.thanks(first)}</h3>
        <p>{t.thanksText}</p>
        <dl className="ar-thanks-sum">
          <dt>{t.thanksSummary}</dt>
          <dd>
            {t.types[sent.type]} · {sent.city} · {d.full} · {t.sizes[sent.size]}
            {sent.org ? ` · ${sent.org}` : ''}
          </dd>
        </dl>
        <button
          type="button"
          className="ar-btn ar-btn-ghost"
          onClick={() => {
            setSent(null);
            setForm(BLANK);
          }}
        >
          {t.another}
        </button>
      </div>
    );
  }

  const err = (k: Field) =>
    errors[k] ? (
      <span className="ar-err" id={`ar-err-${k}`}>
        {errors[k]}
      </span>
    ) : null;
  const aria = (k: Field) => ({ 'aria-invalid': Boolean(errors[k]), 'aria-describedby': errors[k] ? `ar-err-${k}` : undefined });
  const hasErrors = Object.values(errors).some(Boolean);

  return (
    <form className="ar-form" onSubmit={submit} noValidate ref={formRef}>
      {hasErrors && (
        <p className="ar-error" role="alert">
          {t.errFix}
        </p>
      )}
      <div className="ar-grid">
        <label className="ar-field">
          <span>{t.fName}</span>
          <input name="name" type="text" maxLength={80} autoComplete="name" value={form.name} onChange={(e) => set('name', e.target.value)} {...aria('name')} />
          {err('name')}
        </label>
        <label className="ar-field">
          <span>{t.fEmail}</span>
          <input name="email" type="email" inputMode="email" maxLength={120} autoComplete="email" value={form.email} onChange={(e) => set('email', e.target.value)} {...aria('email')} />
          {err('email')}
        </label>
        <label className="ar-field">
          <span>
            {t.fOrg} <small>({t.optional})</small>
          </span>
          <input name="org" type="text" maxLength={80} placeholder={t.fOrgPh} value={form.org} onChange={(e) => set('org', e.target.value)} />
        </label>
        <label className="ar-field">
          <span>{t.fCity}</span>
          <input name="city" type="text" maxLength={60} placeholder={t.fCityPh} value={form.city} onChange={(e) => set('city', e.target.value)} {...aria('city')} />
          {err('city')}
        </label>
        <label className="ar-field">
          <span>{t.fDate}</span>
          <input name="date" type="date" min={minDate} max="2030-12-31" value={form.date} onChange={(e) => set('date', e.target.value)} {...aria('date')} />
          {err('date')}
        </label>
        <label className="ar-field">
          <span>{t.fSize}</span>
          <select name="size" value={form.size} onChange={(e) => set('size', e.target.value as Enquiry['size'])}>
            {(Object.keys(t.sizes) as Enquiry['size'][]).map((k) => (
              <option key={k} value={k}>
                {t.sizes[k]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <fieldset className="ar-field">
        <legend>{t.fType}</legend>
        <div className="ar-pills">
          {(Object.keys(t.types) as Enquiry['type'][]).map((k) => (
            <button key={k} type="button" aria-pressed={form.type === k} className={form.type === k ? 'on' : ''} onClick={() => set('type', k)}>
              {t.types[k]}
            </button>
          ))}
        </div>
      </fieldset>
      <label className="ar-field">
        <span>
          {t.fMessage} <small>({t.optional})</small>
        </span>
        <textarea name="message" rows={4} maxLength={600} placeholder={t.fMessagePh} value={form.message} onChange={(e) => set('message', e.target.value)} />
      </label>
      <button type="submit" className="ar-btn ar-btn-main ar-btn-wide">
        {t.send}
      </button>
      <p className="ar-demo-note">{t.formNote}</p>
    </form>
  );
}

// ---------- the page ----------

const STAGE_VIDEOS = ['stage-dance'].map((id) => videoById(id)).filter((v): v is StudioVideo => Boolean(v));

export default function ArtistPage({ initialLang }: { initialLang: ArtistLang }) {
  // The site's language (its EN · DE · ने switch) is the page's language.
  const [lang, setLang] = useState<ArtistLang>(initialLang);
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const startRef = useRef<(() => void) | null>(null);
  const t = COPY[lang];

  const pick = useCallback(
    (l: ArtistLang) => {
      setLang(l);
      setSiteLangCookie(l);
      router.refresh();
    },
    [router]
  );

  // The sticky bar sits under the site header, whatever its height.
  useEffect(() => {
    const root = rootRef.current;
    const header = document.querySelector<HTMLElement>('.site-header');
    if (!root) return;
    const set = () => root.style.setProperty('--ar-top', `${header ? header.offsetHeight : 0}px`);
    set();
    window.addEventListener('resize', set);
    return () => window.removeEventListener('resize', set);
  }, []);

  // Sections rise in as they scroll into view (never with reduced motion — see artist.css).
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !('IntersectionObserver' in window)) return;
    root.classList.add('ar-js');
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('is-in');
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: '0px 0px -6% 0px', threshold: 0.06 }
    );
    root.querySelectorAll('[data-reveal]').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const listen = () => {
    document.getElementById('ar-music')?.scrollIntoView({ behavior: prefersLessMotion() ? 'auto' : 'smooth', block: 'start' });
    startRef.current?.();
  };

  return (
    <div ref={rootRef} className={`ar ar-lang-${lang}`} lang={lang} translate="no">
      <div className="ar-bar">
        <a href="#ar-top" className="ar-mono" aria-label={t.artist}>
          {lang === 'ne' ? 'रि·ता' : 'R·T'}
        </a>
        <nav className="ar-bar-nav" aria-label={t.artist}>
          <a href="#ar-music">{t.nav.music}</a>
          <a href="#ar-tour">{t.nav.tour}</a>
          <a href="#ar-about">{t.nav.about}</a>
          <a href="#ar-kit">{t.nav.kit}</a>
          <a href="#ar-booking">{t.nav.booking}</a>
        </nav>
        <div className="ar-lang" role="group" aria-label={t.langLabel}>
          {LANGS.map((x) => (
            <button key={x.id} type="button" aria-pressed={lang === x.id} onClick={() => pick(x.id)} lang={x.id} aria-label={x.label}>
              {x.short}
            </button>
          ))}
        </div>
      </div>

      {/* ---------- hero ---------- */}
      <header className="ar-hero" id="ar-top">
        <div className="ar-lights" aria-hidden="true">
          {Array.from({ length: 5 }, (_, i) => (
            <span key={i} className={`ar-beam ar-beam-${i}`} />
          ))}
        </div>
        <div className="ar-hero-inner">
          <div className="ar-hero-art">
            <Portrait className="ar-portrait" />
          </div>
          <div className="ar-hero-text">
            <p className="ar-kicker">{t.kicker}</p>
            <h1 className="ar-name">{t.artist}</h1>
            <p className="ar-band">{t.withBand}</p>
            <p className="ar-one">{t.oneLine}</p>
            <div className="ar-ctas">
              <button type="button" className="ar-btn ar-btn-main" onClick={listen}>
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                  <path fill="currentColor" d="M8 5v14l11-7z" />
                </svg>
                {t.listen}
              </button>
              <a href="#ar-booking" className="ar-btn ar-btn-ghost">
                {t.book}
              </a>
            </div>
            <div className="ar-eq" aria-hidden="true">
              {Array.from({ length: 28 }, (_, i) => (
                <i key={i} style={{ '--i': i } as CSSProperties} />
              ))}
            </div>
          </div>
        </div>
        <Hills className="ar-hills" />
      </header>

      {/* ---------- music ---------- */}
      <section className="ar-section" id="ar-music" aria-labelledby="ar-music-h">
        <h2 id="ar-music-h" className="ar-h2" data-reveal>
          {t.musicTitle}
        </h2>
        <p className="ar-sub" data-reveal>
          {t.musicSub}
        </p>
        <div data-reveal>
          <Player lang={lang} startRef={startRef} />
        </div>
      </section>

      {/* ---------- tour ---------- */}
      <section className="ar-section ar-section-tour" id="ar-tour" aria-labelledby="ar-tour-h">
        <h2 id="ar-tour-h" className="ar-h2" data-reveal>
          {withNums(t.tourTitle)}
        </h2>
        <p className="ar-sub" data-reveal>
          {t.tourSub}
        </p>
        <Tour lang={lang} />
      </section>

      {/* ---------- about + press ---------- */}
      <section className="ar-section ar-about" id="ar-about" aria-labelledby="ar-about-h">
        <div className="ar-about-grid">
          <div data-reveal>
            <h2 id="ar-about-h" className="ar-h2 ar-h2-left">
              {t.aboutTitle}
            </h2>
            {t.bio.map((p) => (
              <p key={p.slice(0, 24)} className="ar-bio">
                {p}
              </p>
            ))}
          </div>
          <div data-reveal>
            <Stats lang={lang} />
            <p className="ar-demo-note">{t.statsNote}</p>
          </div>
        </div>
        <h3 className="ar-h3" data-reveal>
          {t.pressTitle}
        </h3>
        <div className="ar-press">
          {t.press.map((q, i) => (
            <figure key={q.outlet} data-reveal style={{ '--i': i } as CSSProperties}>
              <blockquote>“{q.line}”</blockquote>
              <figcaption>
                {q.outlet} <span className="ar-chip ar-chip-demo">{t.demo}</span>
              </figcaption>
            </figure>
          ))}
        </div>
        <p className="ar-demo-note ar-center">{t.pressNote}</p>
      </section>

      {/* ---------- stage visuals ---------- */}
      {STAGE_VIDEOS.length > 0 && (
        <section className="ar-section" id="ar-videos" aria-labelledby="ar-videos-h">
          <h2 id="ar-videos-h" className="ar-h2" data-reveal>
            {t.videosTitle}
          </h2>
          <p className="ar-sub" data-reveal>
            {t.videosSub}
          </p>
          <div className="ar-videos">
            {STAGE_VIDEOS.map((v, i) => (
              <figure key={v.id} className="ar-video" data-reveal translate="no">
                <StudioPlayer video={v} title={t.videoTitles[i]} playLabel={t.videoPlay(t.videoTitles[i])} />
                <figcaption>{t.videoCaptions[i]}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      {/* ---------- press kit ---------- */}
      <section className="ar-section" id="ar-kit" aria-labelledby="ar-kit-h">
        <h2 id="ar-kit-h" className="ar-h2" data-reveal>
          {t.kitTitle}
        </h2>
        <p className="ar-sub" data-reveal>
          {t.kitSub}
        </p>
        <PressKit lang={lang} rootRef={rootRef} />
      </section>

      {/* ---------- booking ---------- */}
      <section className="ar-section" id="ar-booking" aria-labelledby="ar-book-h">
        <div className="ar-book-card" data-reveal>
          <h2 id="ar-book-h" className="ar-h2">
            {t.bookTitle}
          </h2>
          <p className="ar-sub">{t.bookSub}</p>
          <p className="ar-book-mail">
            {BOOKING_EMAIL} <span className="ar-chip ar-chip-demo">{t.demo}</span>
          </p>
          <Booking lang={lang} />
        </div>
      </section>

      <footer className="ar-foot">
        <p className="ar-foot-name">{t.artist}</p>
        <p>{t.footer}</p>
      </footer>
    </div>
  );
}
