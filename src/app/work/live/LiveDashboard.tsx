'use client';

// The venue big-screen dashboard demo: what an organizer watches on the night
// of a concert. The whole evening is simulated in sim.ts (seeded, pure) and the
// page just moves its clock — nothing is fetched, sent or stored beyond the
// language choice. The scan beep (sound.ts) only plays after the visitor taps.

import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type FormEvent } from 'react';
import { COPY, digits, num, type LiveLang } from './content';
import {
  BIN_COUNT,
  BIN_FROM,
  BIN_SEC,
  CAPACITY,
  DOORS,
  DOORS_LIST,
  END,
  PROGRAMME,
  SHOUT_MAX,
  SPARK_MIN,
  SPEEDS,
  TICKET_TYPES,
  checkShout,
  clock,
  initialState,
  laneStatus,
  nextAtDoor,
  reduce,
  snapshot,
  waitMin,
  type FeedItem,
  type LiveState,
  type Snapshot,
  type TicketType,
  type WallPost,
} from './sim';
import { ScanBeep } from './sound';

const LANG_KEY = 'mn-demo:live-lang';

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
function lessMotion(): boolean {
  return typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
}

/** A number that glides to its new value instead of jumping (straight to it under reduced motion). */
function useCountUp(target: number): number {
  const [v, setV] = useState(target);
  const cur = useRef(target);
  useEffect(() => {
    if (lessMotion()) {
      cur.current = target;
      setV(target);
      return;
    }
    let raf = 0;
    let last = performance.now();
    const step = (now: number) => {
      const dt = now - last;
      last = now;
      cur.current += (target - cur.current) * (1 - Math.exp(-dt / 160));
      if (Math.abs(target - cur.current) < 0.5) {
        cur.current = target;
        setV(target);
        return;
      }
      setV(cur.current);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return v;
}

/** The rendered width of an element, so chart text stays a readable size at any width. */
function useWidth<T extends HTMLElement>(fallback: number) {
  const ref = useRef<T>(null);
  const [w, setW] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(200, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

const TYPE_VAR: Record<TicketType, string> = { standard: 'var(--lv-std)', vip: 'var(--lv-vip)', family: 'var(--lv-fam)' };

// ---------- tiles ----------

function Gauge({ value, lang, big }: { value: number; lang: LiveLang; big?: boolean }) {
  const t = COPY[lang];
  const shown = useCountUp(value);
  const frac = Math.min(1, shown / CAPACITY);
  // A 270° arc, open at the bottom.
  const R = 44;
  const arc = `M ${50 - R * Math.SQRT1_2} ${50 + R * Math.SQRT1_2} A ${R} ${R} 0 1 1 ${50 + R * Math.SQRT1_2} ${50 + R * Math.SQRT1_2}`;
  return (
    <div className={`lv-gauge${big ? ' lv-gauge-big' : ''}`}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <path d={arc} className="lv-gauge-track" pathLength={100} />
        <path d={arc} className="lv-gauge-fill" pathLength={100} strokeDasharray={`${frac * 100} 100`} />
      </svg>
      <div className="lv-gauge-mid">
        <b className="lv-num">{num(shown, lang)}</b>
        <span>{t.ofCapacity(num(CAPACITY, lang))}</span>
        <em>{num((value / CAPACITY) * 100, lang)}%</em>
      </div>
    </div>
  );
}

function Spark({ series, lang }: { series: number[]; lang: LiveLang }) {
  const [ref, w] = useWidth<HTMLDivElement>(260);
  const h = 64;
  const max = Math.max(10, ...series);
  const x = (i: number) => 4 + (i / (series.length - 1)) * (w - 8);
  const y = (v: number) => h - 4 - (v / max) * (h - 12);
  const line = series.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  const area = `${line} L${x(series.length - 1)} ${h - 4} L${x(0)} ${h - 4} Z`;
  const last = series[series.length - 1];
  return (
    <div className="lv-spark" ref={ref}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`${COPY[lang].perMin}: ${series.join(', ')}`}>
        <line x1={4} x2={w - 4} y1={h - 4} y2={h - 4} className="lv-axis" />
        <path d={area} className="lv-spark-area" />
        <path d={line} className="lv-spark-line" />
        <circle cx={x(series.length - 1)} cy={y(last)} r={4} className="lv-spark-dot" />
      </svg>
    </div>
  );
}

function Arrivals({ snap, lang }: { snap: Snapshot; lang: LiveLang }) {
  const t = COPY[lang];
  const [ref, w] = useWidth<HTMLDivElement>(640);
  const [hover, setHover] = useState<number | null>(null);
  const h = 210;
  const L = 34;
  const R = 6;
  const T = 22;
  const B = 24;
  const max = Math.max(80, Math.ceil(Math.max(...snap.bins) / 20) * 20);
  const step = (w - L - R) / BIN_COUNT;
  const bw = Math.max(3, step - 2);
  const y = (v: number) => T + (1 - v / max) * (h - T - B);
  const ticks = Array.from({ length: max / 20 + 1 }, (_, i) => i * 20);
  const binLabel = (i: number) => digits(clock(BIN_FROM + i * BIN_SEC), lang);
  const focus = hover ?? (snap.current >= 0 && snap.current < BIN_COUNT ? snap.current : null);
  const readout =
    focus !== null ? t.arrivalsBin(binLabel(focus), binLabel(focus + 1), num(snap.bins[focus], lang)) : t.arrivalsSub;
  return (
    <div className="lv-bars" ref={ref}>
      <p className="lv-readout" aria-live="off">
        {readout}
      </p>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={t.arrivals} onMouseLeave={() => setHover(null)}>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={L} x2={w - R} y1={y(v)} y2={y(v)} className={v ? 'lv-gridline' : 'lv-axis'} />
            <text x={L - 6} y={y(v) + 4} className="lv-tick" textAnchor="end">
              {num(v, lang)}
            </text>
          </g>
        ))}
        {snap.bins.map((v, i) => {
          if (i > snap.current) return null;
          const bx = L + i * step + 1;
          const top = y(v);
          const base = y(0);
          const r = Math.min(4, (base - top) / 2, bw / 2);
          const d = v
            ? `M${bx} ${base} V${top + r} Q${bx} ${top} ${bx + r} ${top} H${bx + bw - r} Q${bx + bw} ${top} ${bx + bw} ${top + r} V${base} Z`
            : '';
          const cls = i === snap.current ? 'lv-bar is-now' : hover === i ? 'lv-bar is-hover' : 'lv-bar';
          return d ? <path key={i} d={d} className={cls} /> : null;
        })}
        {snap.current >= 0 && snap.current < BIN_COUNT && (
          <text x={L + snap.current * step + 1 + bw / 2} y={y(snap.bins[snap.current]) - 6} className="lv-bar-label" textAnchor="middle">
            {num(snap.bins[snap.current], lang)}
          </text>
        )}
        {Array.from({ length: BIN_COUNT / 6 + 1 }, (_, k) => (
          <text key={k} x={L + k * 6 * step} y={h - 6} className="lv-tick" textAnchor={k === 0 ? 'start' : k === BIN_COUNT / 6 ? 'end' : 'middle'}>
            {binLabel(k * 6)}
          </text>
        ))}
        {snap.bins.map((_, i) => (
          <rect
            key={`hit${i}`}
            x={L + i * step}
            y={T}
            width={step}
            height={h - T - B}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
            onClick={() => setHover(i)}
          />
        ))}
      </svg>
      <details className="lv-table">
        <summary>{t.table}</summary>
        <table>
          <tbody>
            {snap.bins.map((v, i) =>
              i <= snap.current ? (
                <tr key={i}>
                  <th scope="row">
                    {binLabel(i)}–{binLabel(i + 1)}
                  </th>
                  <td>{num(v, lang)}</td>
                </tr>
              ) : null,
            )}
          </tbody>
        </table>
      </details>
    </div>
  );
}

function Donut({ byType, lang }: { byType: Record<TicketType, number>; lang: LiveLang }) {
  const t = COPY[lang];
  const total = TICKET_TYPES.reduce((a, k) => a + byType[k], 0);
  const R = 38;
  const C = 2 * Math.PI * R;
  const gap = total ? 1.2 : 0;
  let acc = 0;
  return (
    <div className="lv-donut">
      <svg viewBox="0 0 100 100" role="img" aria-label={TICKET_TYPES.map((k) => `${t.type[k]} ${byType[k]}`).join(', ')}>
        <circle cx="50" cy="50" r={R} className="lv-donut-track" />
        {TICKET_TYPES.map((k) => {
          const len = total ? (byType[k] / total) * C : 0;
          const seg = (
            <circle
              key={k}
              cx="50"
              cy="50"
              r={R}
              className="lv-donut-seg"
              style={{ stroke: TYPE_VAR[k] }}
              strokeDasharray={`${Math.max(0, len - gap)} ${C}`}
              strokeDashoffset={-acc}
              transform="rotate(-90 50 50)"
            />
          );
          acc += len;
          return seg;
        })}
      </svg>
      <ul className="lv-legend">
        {TICKET_TYPES.map((k) => (
          <li key={k}>
            <i style={{ background: TYPE_VAR[k] }} aria-hidden="true" />
            <span>{t.type[k]}</span>
            <b>{num(byType[k], lang)}</b>
            <em>{num(total ? (byType[k] / total) * 100 : 0, lang)}%</em>
          </li>
        ))}
      </ul>
    </div>
  );
}

const STATUS_ICON = { flowing: '✓', busy: '!', long: '‼' } as const;

function Lanes({ queue, lang }: { queue: Snapshot['queue']; lang: LiveLang }) {
  const t = COPY[lang];
  return (
    <ul className="lv-lanes">
      {DOORS_LIST.map((d) => {
        const q = queue[d];
        const st = laneStatus(q);
        const m = waitMin(q, d);
        return (
          <li key={d} className={`lv-lane is-${st}`}>
            <div className="lv-lane-top">
              <b>{t.door(d)}</b>
              <span className="lv-pill">
                <span aria-hidden="true">{STATUS_ICON[st]}</span> {t.status[st]}
              </span>
            </div>
            <div className="lv-lane-meter" aria-hidden="true">
              <i style={{ width: `${Math.min(100, (q / 40) * 100)}%` }} />
            </div>
            <div className="lv-lane-foot">
              <span>{t.waiting(num(q, lang))}</span>
              <span>{q ? t.wait(num(m, lang)) : t.noWait}</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function feedText(f: FeedItem, lang: LiveLang): string {
  const t = COPY[lang];
  switch (f.kind) {
    case 'in':
      return t.inLine(f.code, t.type[f.type], t.door(f.door));
    case 'dup':
      return t.dupLine(f.code, t.door(f.door), digits(clock(f.first), lang));
    case 'sale':
      return `${t.saleLine(f.code, t.type[f.type])} · ${t.channel[f.channel]}`;
    case 'none':
      return t.noneLine;
  }
}

function Feed({ feed, lang }: { feed: FeedItem[]; lang: LiveLang }) {
  const t = COPY[lang];
  const rows = feed.slice(-12).reverse();
  return (
    <ol className="lv-feed">
      {rows.map((f) => (
        <li key={f.id} className={`lv-feed-${f.kind}${'mine' in f && f.mine ? ' is-mine' : ''}`}>
          <time>{digits(clock(f.at), lang)}</time>
          <span className="lv-feed-icon" aria-hidden="true">
            {f.kind === 'in' ? '✓' : f.kind === 'dup' ? '⚠' : f.kind === 'sale' ? '+' : '·'}
          </span>
          <span className="lv-feed-text">{feedText(f, lang)}</span>
          {'mine' in f && f.mine && <span className="lv-you">{t.you}</span>}
        </li>
      ))}
    </ol>
  );
}

function Wall({ wall, lang, max }: { wall: WallPost[]; lang: LiveLang; max: number }) {
  return (
    <ol className="lv-wall-list">
      {wall.slice(-max).map((p) => (
        <li key={p.id} className={p.mine ? 'is-mine' : undefined} lang={p.lang === 'ne' ? 'ne' : 'en'}>
          <p>{p.text}</p>
          <span>— {p.name}</span>
        </li>
      ))}
    </ol>
  );
}

function ShoutForm({ lang, onPost }: { lang: LiveLang; onPost: (name: string, text: string) => void }) {
  const t = COPY[lang];
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const c = checkShout(text);
    if (!c.ok) {
      setMsg({ ok: false, text: t.shoutErr[c.reason] });
      return;
    }
    const n = checkShout(name.slice(0, 24));
    const who = n.ok ? n.text : t.guest;
    if (!n.ok && n.reason === 'rude') {
      setMsg({ ok: false, text: t.shoutErr.rude });
      return;
    }
    onPost(who, c.text);
    setText('');
    setMsg({ ok: true, text: t.shoutOk });
  };
  const left = SHOUT_MAX - [...text].length;
  return (
    <form className="lv-shout-form" onSubmit={submit}>
      <div className="lv-shout-fields">
        <label>
          <span>{t.yourName}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} placeholder={t.namePh} autoComplete="off" />
        </label>
        <label className="lv-shout-text">
          <span>
            {t.yourShout} <em className={left < 0 ? 'is-over' : undefined}>{num(left, lang)}</em>
          </span>
          <input value={text} onChange={(e) => setText(e.target.value)} maxLength={SHOUT_MAX + 20} placeholder={t.shoutPh} autoComplete="off" />
        </label>
        <button type="submit" className="lv-btn lv-btn-go">
          {t.post}
        </button>
      </div>
      <p className={`lv-shout-msg${msg && !msg.ok ? ' is-err' : ''}`} role="status">
        {msg ? msg.text : t.local}
      </p>
    </form>
  );
}

function StageNow({ s, snap, lang, big }: { s: LiveState; snap: Snapshot; lang: LiveLang; big?: boolean }) {
  const t = COPY[lang];
  const now = snap.onStage >= 0 ? PROGRAMME[snap.onStage] : null;
  const next = snap.next >= 0 ? PROGRAMME[snap.next] : null;
  const label = now ? t.nowOnStage : s.t < DOORS ? t.beforeDoors : snap.next === 0 ? t.doorsOpen : s.t >= END ? '' : t.changeover;
  const mins = Math.max(1, Math.ceil(snap.nextIn / 60));
  return (
    <div className={`lv-now${big ? ' lv-now-big' : ''}`}>
      <div className="lv-now-main">
        <p className="lv-kicker">
          {now && <span className="lv-live-dot" aria-hidden="true" />}
          {label}
        </p>
        {now ? (
          <>
            <p className="lv-now-name">{t.acts[now.id].name}</p>
            <p className="lv-now-what">{t.acts[now.id].what}</p>
          </>
        ) : (
          <p className="lv-now-name lv-now-quiet">{s.t >= END ? t.quiet.end : snap.next === 0 ? t.quiet.doors : t.quiet.change}</p>
        )}
      </div>
      <div className="lv-next">
        {next ? (
          <>
            <p className="lv-kicker">
              {t.nextUp} · {t.acts[next.id].name}
            </p>
            <p className="lv-next-in">{t.inMin(num(mins, lang))}</p>
          </>
        ) : (
          <p className="lv-kicker">{t.lastAct}</p>
        )}
      </div>
    </div>
  );
}

const SPAN_FROM = DOORS;
const SPAN = END - DOORS;
const pct = (x: number) => `${(Math.max(0, Math.min(SPAN, x - SPAN_FROM)) / SPAN) * 100}%`;

function Timeline({ s, snap, lang }: { s: LiveState; snap: Snapshot; lang: LiveLang }) {
  const t = COPY[lang];
  return (
    <div className="lv-timeline">
      <div className="lv-track" aria-hidden="true">
        {PROGRAMME.map((a, i) => (
          <span
            key={a.id}
            className={`lv-act-seg${i === snap.onStage ? ' is-now' : s.t >= a.end ? ' is-done' : ''}`}
            style={{ left: pct(a.start), width: `calc(${pct(a.end)} - ${pct(a.start)})` }}
          >
            <span>{t.acts[a.id].name}</span>
          </span>
        ))}
        <span className="lv-marker" style={{ left: pct(s.t) }} />
      </div>
      <div className="lv-hours" aria-hidden="true">
        {Array.from({ length: 7 }, (_, i) => (
          <span key={i} style={{ left: `${(i / 6) * 100}%` }}>
            {digits(String(18 + i === 24 ? 0 : 18 + i).padStart(2, '0'), lang)}
          </span>
        ))}
      </div>
      <ol className="lv-acts">
        {PROGRAMME.map((a, i) => (
          <li key={a.id} className={i === snap.onStage ? 'is-now' : s.t >= a.end ? 'is-done' : undefined}>
            <time>{digits(clock(a.start), lang)}</time> {t.acts[a.id].name}
            <span>{t.acts[a.id].what}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function BigScreen({ s, snap, lang, onExit }: { s: LiveState; snap: Snapshot; lang: LiveLang; onExit: () => void }) {
  const t = COPY[lang];
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onExit();
    };
    const onFs = () => {
      if (!document.fullscreenElement) onExit();
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('fullscreenchange', onFs);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('fullscreenchange', onFs);
      document.documentElement.style.overflow = prev;
      if (document.fullscreenElement) void document.exitFullscreen?.().catch(() => {});
    };
  }, [onExit]);
  const shown = useCountUp(snap.checkedIn);
  return (
    <div className="lv-big" ref={ref} role="dialog" aria-modal="true" aria-label={t.bigScreen} tabIndex={-1}>
      <div className="lv-big-head">
        <p>
          <b>{t.show}</b> · {t.venue}
        </p>
        <p className="lv-big-clock">{digits(clock(s.t), lang)}</p>
        <button type="button" className="lv-btn" onClick={onExit}>
          ✕ {t.exitBig} <small>({t.escHint})</small>
        </button>
      </div>
      <div className="lv-big-body">
        <div className="lv-big-left">
          <StageNow s={s} snap={snap} lang={lang} big />
          <div className="lv-big-count">
            <p className="lv-kicker">{t.inHall}</p>
            <p className="lv-big-num">
              <b className="lv-num">{num(shown, lang)}</b>
              <span> / {num(CAPACITY, lang)}</span>
            </p>
          </div>
        </div>
        <div className="lv-big-wall">
          <p className="lv-kicker">{t.wall}</p>
          <Wall wall={s.wall} lang={lang} max={6} />
        </div>
      </div>
    </div>
  );
}

function Num({ value, lang }: { value: number; lang: LiveLang }) {
  return <>{num(useCountUp(value), lang)}</>;
}

// ---------- the page ----------

export default function LiveDashboard() {
  const [lang, setLang] = useState<LiveLang>('en');
  const [s, dispatch] = useReducer(reduce, undefined, () => initialState());
  const [big, setBig] = useState(false);
  const beep = useRef<ScanBeep | null>(null);
  const t = COPY[lang];
  const snap = useMemo(() => snapshot(s), [s]);

  useEffect(() => {
    const l = load(LANG_KEY);
    if (l === 'en' || l === 'ne') setLang(l);
    const b = new ScanBeep();
    beep.current = b;
    return () => b.close();
  }, []);

  // The evening's clock: ten ticks a second of real time, stopped while the tab is hidden.
  useEffect(() => {
    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      const dt = Math.min(250, now - last);
      last = now;
      if (!document.hidden) dispatch({ type: 'tick', dt });
    }, 100);
    return () => window.clearInterval(id);
  }, []);

  const pickLang = (l: LiveLang) => {
    setLang(l);
    save(LANG_KEY, l);
  };
  const exitBig = useCallback(() => setBig(false), []);
  // Fullscreen has to be asked for inside the tap itself; the overlay is fixed,
  // so a fullscreen page shows just it. Where fullscreen is refused (iPhone),
  // the overlay alone still fills the window.
  const openBig = () => {
    setBig(true);
    try {
      void document.documentElement.requestFullscreen?.()?.catch(() => {});
    } catch {
      /* overlay only */
    }
  };
  const scan = () => {
    if (nextAtDoor(s) !== null) beep.current?.ok();
    else beep.current?.dup();
    dispatch({ type: 'scan' });
  };
  const rescan = () => {
    beep.current?.dup();
    dispatch({ type: 'rescan' });
  };

  const mine = [...s.feed].reverse().find((f) => 'mine' in f && f.mine);
  const over = s.t >= END;
  const spark = snap.perMin;

  return (
    <div className={`lv lv-lang-${lang}`} lang={lang === 'ne' ? 'ne' : 'en'} translate="no">
      <div className="lv-top">
        <div className="lv-top-text">
          <h1 className="lv-title">{t.title}</h1>
          <p className="lv-intro">{t.intro}</p>
        </div>
        <div className="lv-seg" role="group" aria-label="Language / भाषा">
          <button type="button" aria-pressed={lang === 'en'} onClick={() => pickLang('en')}>
            EN
          </button>
          <button type="button" aria-pressed={lang === 'ne'} onClick={() => pickLang('ne')} lang="ne">
            नेपाली
          </button>
        </div>
      </div>

      <div className="lv-board">
        <header className="lv-head">
          <div className="lv-show">
            <p className="lv-show-name">{t.show}</p>
            <p className="lv-show-meta">
              {t.venue} · {t.doors}
            </p>
          </div>
          <p className="lv-clock" aria-label={digits(clock(s.t), lang)}>
            {digits(clock(s.t, true), lang)}
          </p>
          <span className="lv-badge">{t.simulated}</span>
          <div className="lv-controls">
            <div className="lv-seg lv-seg-speed" role="group" aria-label={t.speed}>
              {SPEEDS.map((v) => (
                <button key={v} type="button" aria-pressed={s.speed === v && !s.paused} onClick={() => dispatch({ type: 'speed', speed: v })} data-speed={v}>
                  {digits(String(v), lang)}×
                </button>
              ))}
            </div>
            <button type="button" className="lv-btn lv-btn-icon" onClick={() => dispatch({ type: 'pause' })} aria-pressed={s.paused} aria-label={s.paused ? t.play : t.pause} title={s.paused ? t.play : t.pause} disabled={over}>
              {s.paused ? '▶' : '❚❚'}
            </button>
            <button type="button" className="lv-btn lv-btn-icon" onClick={() => dispatch({ type: 'restart', seed: Math.floor(Math.random() * 2 ** 31) })} aria-label={t.restart} title={t.restart}>
              ↺
            </button>
            <button type="button" className="lv-btn lv-btn-big" onClick={openBig} data-act="big">
              ⛶ {t.bigScreen}
            </button>
          </div>
        </header>

        <section className="lv-stage" aria-label={t.programme}>
          <StageNow s={s} snap={snap} lang={lang} />
          <Timeline s={s} snap={snap} lang={lang} />
          {over && (
            <div className="lv-over">
              <p>{t.showOver}</p>
              <button type="button" className="lv-btn lv-btn-go" onClick={() => dispatch({ type: 'restart', seed: Math.floor(Math.random() * 2 ** 31) })}>
                ↺ {t.replay}
              </button>
            </div>
          )}
        </section>

        <div className="lv-grid">
          <section className="lv-tile lv-t-gauge" aria-labelledby="lv-h-in">
            <h2 id="lv-h-in">{t.checkedIn}</h2>
            <Gauge value={snap.checkedIn} lang={lang} />
          </section>

          <section className="lv-tile lv-t-sold" aria-labelledby="lv-h-sold">
            <h2 id="lv-h-sold">{t.soldToday}</h2>
            <p className="lv-big-stat lv-num">
              <Num value={snap.soldToday} lang={lang} />
            </p>
            <p className="lv-sub">{t.onlineDoor(num(snap.soldOnline, lang), num(snap.soldDoor, lang))}</p>
            <p className="lv-sub">{t.soldOf(num(snap.soldTotal, lang), num(CAPACITY, lang))}</p>
            <p className={`lv-note${snap.onlineOpen ? '' : ' is-closed'}`}>{snap.onlineOpen ? t.onlineOpen : t.onlineClosed}</p>
          </section>

          <section className="lv-tile lv-t-pace" aria-labelledby="lv-h-pace">
            <h2 id="lv-h-pace">{t.perMin}</h2>
            <p className="lv-big-stat lv-num">
              <Num value={snap.pace} lang={lang} /> <small>{t.perMinUnit}</small>
            </p>
            <Spark series={spark} lang={lang} />
            <p className="lv-sub lv-spark-axis">
              <span>{t.last30}</span>
              <span>{digits(clock(s.t - SPARK_MIN * 60), lang)}–{digits(clock(s.t), lang)}</span>
            </p>
          </section>

          <section className="lv-tile lv-t-doors" aria-labelledby="lv-h-doors">
            <h2 id="lv-h-doors">{t.doorsTile}</h2>
            <Lanes queue={snap.queue} lang={lang} />
          </section>

          <section className="lv-tile lv-t-arrivals" aria-labelledby="lv-h-arr">
            <h2 id="lv-h-arr">{t.arrivals}</h2>
            <Arrivals snap={snap} lang={lang} />
          </section>

          <section className="lv-tile lv-t-types" aria-labelledby="lv-h-types">
            <h2 id="lv-h-types">{t.types}</h2>
            <p className="lv-sub">{t.typesSub}</p>
            <Donut byType={snap.byType} lang={lang} />
          </section>

          <section className="lv-tile lv-t-feed" aria-labelledby="lv-h-feed">
            <h2 id="lv-h-feed">{t.feed}</h2>
            <p className="lv-sub">{t.feedSub}</p>
            <Feed feed={s.feed} lang={lang} />
          </section>

          <section className="lv-tile lv-t-wall" aria-labelledby="lv-h-wall">
            <h2 id="lv-h-wall">{t.wall}</h2>
            <p className="lv-sub">{t.wallSub}</p>
            <div className="lv-wall">
              <Wall wall={s.wall} lang={lang} max={8} />
            </div>
            <ShoutForm lang={lang} onPost={(name, text) => dispatch({ type: 'shout', name, text, lang })} />
          </section>

          <section className="lv-tile lv-t-scan" aria-labelledby="lv-h-scan">
            <h2 id="lv-h-scan">{t.scanTitle}</h2>
            <p className="lv-sub">{t.scanSub}</p>
            <div className="lv-scan-btns">
              <button type="button" className="lv-btn lv-btn-go" onClick={scan} data-act="scan">
                ⌁ {t.scan}
              </button>
              <button type="button" className="lv-btn" onClick={rescan} disabled={s.last === null} data-act="rescan">
                ↻ {t.rescan}
              </button>
            </div>
            <p
              className={`lv-scan-result${mine?.kind === 'dup' ? ' is-dup' : mine?.kind === 'in' ? ' is-ok' : ''}`}
              role="status"
              key={mine?.id ?? 0}
            >
              {mine?.kind === 'in'
                ? t.scanOk(mine.code, t.door(mine.door))
                : mine?.kind === 'dup'
                  ? t.scanDup(mine.code)
                  : mine?.kind === 'none'
                    ? t.noneLine
                    : ' '}
            </p>
            <p className="lv-sub">{t.dupsToday(num(snap.dups, lang))}</p>
          </section>
        </div>
      </div>

      {big && <BigScreen s={s} snap={snap} lang={lang} onExit={exitBig} />}
    </div>
  );
}

