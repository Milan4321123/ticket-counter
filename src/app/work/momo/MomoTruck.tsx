'use client';

// The momo food-truck demo: a made-up Nepali momo truck, "Momo Gaadi", on its
// route through Mainz, Wiesbaden and Darmstadt. The customer's phone shows
// where the truck is right now on a drawn map, the week's stops, ordering ahead
// with pickup slots that fill up, a pickup number with a QR code and a live
// queue position, the "ready!" moment and a stamp card. The crew's tablet has
// the queue board, three steamers, a simulated scanner, the day's switches and
// a "Now serving" screen for the truck window. All the rules live in truck.ts;
// this file only draws them. Everything is kept in localStorage under one key —
// nothing is sent anywhere, and there are no prices or payments anywhere.

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'qrcode';
import { BadgeArt, CityMap, GaadiMark, Icon, MomoPlate, Steam, StampMark, TruckArt, type IconName, type MapStop } from './art';
import {
  ACHARS,
  FILLINGS,
  MAX_LINES,
  MAX_PLATES,
  MIN,
  PLACES,
  PLACE_IDS,
  SLOT_CAP_MAX,
  SLOT_CAP_MIN,
  STAMPS_PER_BADGE,
  STATUSES,
  STEAMER_PLATES,
  STYLES,
  WEEK,
  advance,
  aheadOf,
  canOrder,
  cheer,
  clockLabel,
  firstFit,
  minLabel,
  moveNext,
  nearInfo,
  normalize,
  nowServing,
  orderTrip,
  pickupCode,
  placeOrder,
  plates,
  queue,
  route,
  scan,
  setAutoCrew,
  setNear,
  setPaused,
  setPush,
  setSlotCap,
  slotsFor,
  steamerLoad,
  stopStatus,
  tick,
  today,
  toggleNotify,
  toggleSoldOut,
  truckPos,
  type Achar,
  type Event,
  type Filling,
  type Line,
  type Order,
  type PlaceId,
  type State,
  type Style,
} from './truck';
import { COPY, LANGS, num, type Copy, type Lang, type Tab, type View } from './content';

const STORE_KEY = 'mn-demo:momo';

function loadRaw(): unknown {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function saveRaw(s: State) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(s));
  } catch {
    /* private window: the demo still works, it just forgets on reload */
  }
}

// ---------- sound (Web Audio, only ever started by a tap) ----------

let AUDIO: AudioContext | null = null;
function audio(create: boolean): AudioContext | null {
  if (AUDIO || !create) {
    if (AUDIO?.state === 'suspended') AUDIO.resume().catch(() => {});
    return AUDIO;
  }
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    AUDIO = new Ctx();
  } catch {
    AUDIO = null;
  }
  return AUDIO;
}
function tone(ctx: AudioContext, f: number, at: number, len: number, vol: number, type: OscillatorType = 'sine') {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, at);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(vol, at + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, at + len);
  o.connect(g).connect(ctx.destination);
  o.start(at);
  o.stop(at + len + 0.02);
}
/** "Ready!" — a bright little four-note run. */
function readyJingle() {
  const ctx = audio(false);
  if (!ctx) return;
  try {
    const t = ctx.currentTime;
    [523, 659, 784, 1047].forEach((f, i) => tone(ctx, f, t + i * 0.11, 0.28, 0.22, 'triangle'));
  } catch {
    /* no sound — the screen still says it */
  }
}
/** The truck's horn: two short honks. */
function honk() {
  const ctx = audio(false);
  if (!ctx) return;
  try {
    const t = ctx.currentTime;
    tone(ctx, 330, t, 0.16, 0.12, 'square');
    tone(ctx, 330, t + 0.22, 0.2, 0.12, 'square');
  } catch {
    /* ignore */
  }
}
/** A soft chime for a new order on the crew board. */
function chime() {
  const ctx = audio(false);
  if (!ctx) return;
  try {
    const t = ctx.currentTime;
    tone(ctx, 988, t, 0.25, 0.08);
    tone(ctx, 1319, t + 0.12, 0.3, 0.08);
  } catch {
    /* ignore */
  }
}
/** The thunk of a rubber stamp / a ticket handed over. */
function thunk() {
  const ctx = audio(false);
  if (!ctx) return;
  try {
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(180, t);
    o.frequency.exponentialRampToValueAtTime(60, t + 0.14);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.4, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + 0.22);
  } catch {
    /* ignore */
  }
}

// ---------- words ----------

function placeName(p: PlaceId, t: Copy) {
  return `${t.towns[PLACES[p].town]} · ${t.places[p]}`;
}
const clk = (ms: number, lang: Lang) => num(clockLabel(ms), lang);
const mclk = (m: number, lang: Lang) => num(minLabel(m), lang);
function inMin(s: State, at: number, t: Copy, lang: Lang) {
  return t.inMin(num(Math.max(1, Math.round((at - s.now) / MIN)), lang));
}
function lineText(l: Line, t: Copy, lang: Lang) {
  return `${num(l.qty, lang)}× ${t.fillings[l.filling].name} · ${t.styles[l.style]}`;
}

/** The headline for wherever the truck is right now. */
function headline(s: State, t: Copy, lang: Lang): { text: string; tone: 'open' | 'soon' | 'off' | 'road'; place: PlaceId } {
  const r = route(s);
  if (s.drive) {
    const to = r[s.drive.to].place;
    return { text: t.statusDriving(placeName(to, t), clk(s.drive.until, lang)), tone: 'road', place: to };
  }
  const here = r[s.idx].place;
  const st = stopStatus(s, s.idx);
  if (st.kind === 'open') return { text: t.statusOpen(clk(st.until, lang)), tone: 'open', place: here };
  if (st.kind === 'opens') return { text: t.statusOpens(clk(st.at, lang)), tone: 'soon', place: here };
  if (st.kind === 'soldout') return { text: t.statusSoldOut, tone: 'off', place: here };
  return { text: t.statusClosed, tone: 'off', place: here };
}

// ---------- small pieces ----------

function Qr({ text, label, className }: { text: string; label: string; className?: string }) {
  const path = useMemo(() => {
    const qr = QRCode.create(text, { errorCorrectionLevel: 'M' });
    const n = qr.modules.size;
    let d = '';
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (qr.modules.get(y, x)) d += `M${x + 2} ${y + 2}h1v1h-1z`;
    return { d, n: n + 4 };
  }, [text]);
  return (
    <svg className={`mt-qr${className ? ` ${className}` : ''}`} viewBox={`0 0 ${path.n} ${path.n}`} role="img" aria-label={label} shapeRendering="crispEdges">
      <rect width={path.n} height={path.n} fill="#fff" />
      <path d={path.d} fill="#10302c" />
    </svg>
  );
}

function Stepper({ value, onChange, min, max, lang, less, more }: { value: number; onChange: (n: number) => void; min: number; max: number; lang: Lang; less: string; more: string }) {
  return (
    <span className="mt-stepper">
      <button type="button" onClick={() => onChange(value - 1)} disabled={value <= min} aria-label={less}>
        <Icon name="minus" />
      </button>
      <output aria-live="polite">{num(value, lang)}</output>
      <button type="button" onClick={() => onChange(value + 1)} disabled={value >= max} aria-label={more}>
        <Icon name="plus" />
      </button>
    </span>
  );
}

function Switch({ on, onChange, label, sub, id }: { on: boolean; onChange: (v: boolean) => void; label: string; sub?: string; id: string }) {
  return (
    <label className="mt-switch" htmlFor={id}>
      <span className="mt-switch-txt">
        <strong>{label}</strong>
        {sub && <small>{sub}</small>}
      </span>
      <input id={id} type="checkbox" role="switch" checked={on} onChange={(e) => onChange(e.target.checked)} />
      <span className="mt-switch-ui" aria-hidden="true" />
    </label>
  );
}

function Modal({ title, onClose, children, labelId, closeLabel, className }: { title: ReactNode; onClose: () => void; children: ReactNode; labelId: string; closeLabel: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      prev?.focus?.({ preventScroll: true });
    };
  }, []);
  return (
    <div className={`mt-modal-wrap${className ? ` ${className}` : ''}`} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="mt-modal" role="dialog" aria-modal="true" aria-labelledby={labelId} tabIndex={-1} ref={ref}>
        <div className="mt-modal-head">
          <h2 id={labelId}>{title}</h2>
          <button type="button" className="mt-icon-btn" onClick={onClose} aria-label={closeLabel}>
            <Icon name="x" />
          </button>
        </div>
        <div className="mt-modal-body">{children}</div>
      </div>
    </div>
  );
}

function Steps({ o, t }: { o: Order; t: Copy }) {
  const at = STATUSES.indexOf(o.status);
  return (
    <ol className="mt-steps">
      {STATUSES.map((st, i) => (
        <li key={st} className={i < at || (st === 'picked' && at === 3) ? 'is-done' : i === at ? 'is-now' : ''}>
          <span className="mt-step-dot">{i < at || (st === 'picked' && at === 3) ? <Icon name="check" /> : null}</span>
          <span className="mt-step-l">{t.steps[st]}</span>
        </li>
      ))}
    </ol>
  );
}

// ---------- the customer's phone ----------

type CustomerProps = {
  s: State;
  t: Copy;
  lang: Lang;
  tab: Tab;
  setTab: (t: Tab) => void;
  framed: boolean;
  onState: (s: State) => void;
  onEvents: (e: Event[]) => void;
  toast: (text: string, tone?: ToastTone) => void;
  onAllowPush: () => void;
  onPreviewPush: () => void;
};

const TABS: { id: Tab; icon: IconName }[] = [
  { id: 'truck', icon: 'map' },
  { id: 'order', icon: 'bag' },
  { id: 'pickup', icon: 'ticket' },
  { id: 'stamps', icon: 'star' },
];

function Customer(props: CustomerProps) {
  const { s, t, lang, tab, setTab, framed } = props;
  const head = headline(s, t, lang);
  const active = s.orders.filter((o) => o.mine && o.status !== 'picked');
  const bodyRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<HTMLDivElement>(null);
  const go = (x: Tab) => {
    setTab(x);
    if (framed) bodyRef.current?.scrollTo({ top: 0 });
    else {
      // On a phone the app is the page: bring the top of the new tab into view.
      const top = appRef.current?.getBoundingClientRect().top ?? 0;
      if (top < 0) window.scrollBy({ top: top - 72 }); // below the site header
    }
  };
  return (
    <div className={`mt-app${framed ? ' is-framed' : ''}`} ref={appRef}>
      <header className="mt-app-head">
        <GaadiMark className="mt-app-mark" />
        <div className="mt-app-title">
          <strong>{t.name}</strong>
          <span className={`mt-pill is-${head.tone}`}>
            <span className="mt-pill-dot" aria-hidden="true" />
            {head.tone === 'road' ? t.movingTo(t.towns[PLACES[head.place].town]) : head.text}
          </span>
        </div>
      </header>
      <div className="mt-app-body" ref={bodyRef}>
        {tab === 'truck' && <TruckTab {...props} goOrder={() => go('order')} />}
        {tab === 'order' && <OrderTab {...props} done={() => go('pickup')} />}
        {tab === 'pickup' && <PickupTab {...props} goOrder={() => go('order')} />}
        {tab === 'stamps' && <StampsTab {...props} />}
      </div>
      <nav className="mt-tabs" aria-label={t.tabsLabel}>
        {TABS.map((x) => (
          <button key={x.id} type="button" className={tab === x.id ? 'is-on' : ''} aria-current={tab === x.id ? 'page' : undefined} onClick={() => go(x.id)} data-tab={x.id}>
            <Icon name={x.icon} />
            <span>{t.tabs[x.id]}</span>
            {x.id === 'pickup' && active.length > 0 && <span className="mt-tab-badge">{num(active[0].id, lang)}</span>}
          </button>
        ))}
      </nav>
    </div>
  );
}

function TruckTab({ s, t, lang, onState, toast, goOrder, onAllowPush, onPreviewPush }: CustomerProps & { goOrder: () => void }) {
  const r = route(s);
  const pos = truckPos(s);
  const head = headline(s, t, lang);
  const cur = s.drive ? s.drive.from : s.idx;
  const stops: MapStop[] = r.map((visit, k) => ({
    k,
    visit,
    state: s.done ? 'left' : s.drive ? (k <= s.drive.from ? 'left' : k === s.drive.to ? 'next' : 'later') : k < s.idx ? 'left' : k === s.idx ? 'here' : 'later',
  }));
  const legs = r.slice(0, -1).map((v, k) => ({ a: v.place, b: r[k + 1].place, done: k < cur || (s.done && k < r.length - 1) ? 1 : s.drive && k === s.drive.from ? pos.frac : 0 }));
  const open = !s.drive && !s.done && stopStatus(s, s.idx).kind === 'open';
  const near = nearInfo(s);
  const orderWhy = canOrder(s);
  let nearText = '';
  if (near) {
    if (near.today && near.at != null && near.at <= s.now) nearText = t.nearNow;
    else if (near.today && near.at != null) nearText = t.nearToday(clk(near.at, lang), inMin(s, near.at, t, lang));
    else if (near.at != null) nearText = t.nearOther(t.days[near.day], clk(near.at, lang));
  }
  const notifSupported = typeof window !== 'undefined' && 'Notification' in window;
  return (
    <div className="mt-pane">
      <h2 className="mt-h2">{t.todayH(t.days[s.day])}</h2>
      <div className="mt-map-card">
        <CityMap
          stops={stops}
          truck={{ ...pos, open }}
          legs={legs}
          near={s.near}
          notify={s.notify}
          townLabels={t.towns}
          label={t.mapLabel(`${placeName(head.place, t)}: ${head.text}`)}
          numFmt={(n) => num(n, lang)}
        />
        <div className={`mt-now is-${head.tone}`}>
          <span className="mt-now-ic">
            <Icon name={head.tone === 'road' ? 'truck' : head.tone === 'open' ? 'steam' : 'clock'} />
          </span>
          <div>
            <p className="mt-now-place">{placeName(head.place, t)}</p>
            <p className="mt-now-text" aria-live="polite">
              {head.text}
              {s.drive && <span className="mt-now-in"> · {inMin(s, s.drive.until, t, lang)}</span>}
            </p>
          </div>
        </div>
      </div>
      {s.paused && !s.done && (
        <p className="mt-note is-warn">
          <Icon name="pause" />
          {t.pausedNote}
        </p>
      )}
      {s.done && (
        <p className="mt-note">
          <Icon name="flag" />
          {(() => {
            let d = (s.day + 1) % 7;
            while (!WEEK[d].length) d = (d + 1) % 7;
            return t.doneToday(t.days[d], placeName(WEEK[d][0].place, t));
          })()}
        </p>
      )}
      {!orderWhy && (
        <button type="button" className="mt-btn mt-btn-main mt-btn-wide" onClick={goOrder}>
          <Icon name="bag" />
          {t.orderAhead}
        </button>
      )}

      <section className="mt-card" aria-labelledby="mt-near-h">
        <h3 id="mt-near-h" className="mt-h3">
          <Icon name="pin" />
          {t.nearH}
        </h3>
        <div className="mt-near-row">
          <select
            className="mt-select"
            value={s.near ?? ''}
            aria-label={t.nearPick}
            onChange={(e) => onState(setNear(s, (e.target.value || null) as PlaceId | null))}
          >
            <option value="">{t.nearPick}</option>
            {PLACE_IDS.map((p) => (
              <option key={p} value={p}>
                {placeName(p, t)}
              </option>
            ))}
          </select>
          {s.near && (
            <button type="button" className="mt-btn mt-btn-soft mt-btn-sm" onClick={() => onState(setNear(s, null))}>
              {t.nearClear}
            </button>
          )}
        </div>
        {nearText && <p className="mt-near-info">{nearText}</p>}
      </section>

      <section className="mt-card" aria-labelledby="mt-stops-h">
        <h3 id="mt-stops-h" className="mt-h3">
          <Icon name="flag" />
          {t.stopsH}
        </h3>
        <ol className="mt-stops">
          {r.map((v, k) => {
            const st = stopStatus(s, k);
            const on = s.notify.includes(v.place);
            const label =
              st.kind === 'open'
                ? t.statusOpen(clk(st.until, lang))
                : st.kind === 'opens'
                  ? t.statusOpens(clk(st.at, lang))
                  : st.kind === 'driving'
                    ? `${t.statusLater(clk(st.eta, lang))} · ${inMin(s, st.eta, t, lang)}`
                    : st.kind === 'later'
                      ? t.statusLater(clk(st.at, lang))
                      : st.kind === 'soldout'
                        ? t.statusSoldOut
                        : st.kind === 'closed'
                          ? t.statusClosed
                          : t.statusLeft;
            return (
              <li key={k} className={`mt-stop is-${st.kind}`}>
                <span className="mt-stop-n">{num(k + 1, lang)}</span>
                <div className="mt-stop-main">
                  <strong>{placeName(v.place, t)}</strong>
                  <span className="mt-stop-time">
                    {mclk(v.opens, lang)}–{mclk(v.closes, lang)}
                    {s.near === v.place && <span className="mt-tag">{t.nearTag}</span>}
                  </span>
                  <span className="mt-stop-st">{label}</span>
                </div>
                <button
                  type="button"
                  className={`mt-bell${on ? ' is-on' : ''}`}
                  aria-pressed={on}
                  aria-label={on ? t.notifyOn(placeName(v.place, t)) : t.notifyOff(placeName(v.place, t))}
                  title={on ? t.notifyOn(placeName(v.place, t)) : t.notifyOff(placeName(v.place, t))}
                  onClick={() => {
                    audio(true);
                    onState(toggleNotify(s, v.place));
                    toast(on ? t.notifyUnset(placeName(v.place, t)) : t.notifySet(placeName(v.place, t)), 'info');
                  }}
                >
                  <Icon name={on ? 'bell-on' : 'bell'} />
                </button>
              </li>
            );
          })}
        </ol>
        <div className="mt-push">
          <p className="mt-push-h">{t.pushH}</p>
          <p className="mt-push-sub">{t.pushSub}</p>
          <div className="mt-push-btns">
            {s.push ? (
              <span className="mt-tag is-ok">
                <Icon name="check" />
                {t.pushOn}
              </span>
            ) : (
              <button type="button" className="mt-btn mt-btn-soft mt-btn-sm" onClick={onAllowPush} disabled={!notifSupported}>
                <Icon name="bell" />
                {notifSupported ? t.pushAllow : t.pushNone}
              </button>
            )}
            <button type="button" className="mt-btn mt-btn-ghost mt-btn-sm" onClick={onPreviewPush}>
              {t.pushPreview}
            </button>
          </div>
        </div>
      </section>

      <section className="mt-card" aria-labelledby="mt-week-h">
        <h3 id="mt-week-h" className="mt-h3">
          <Icon name="clock" />
          {t.weekH}
        </h3>
        <ul className="mt-week">
          {WEEK.map((day, d) => (
            <li key={d} className={d === s.day ? 'is-today' : ''}>
              <span className="mt-week-d">
                {t.daysShort[d]}
                {d === s.day && <span className="mt-tag">{t.todayTag}</span>}
              </span>
              {day.length ? (
                <span className="mt-week-stops">
                  {day.map((v, i) => (
                    <span key={i} className={s.near === v.place ? 'is-near' : ''}>
                      <b>{mclk(v.opens, lang)}</b> {placeName(v.place, t)}
                    </span>
                  ))}
                </span>
              ) : (
                <span className="mt-week-rest">{t.restDay}</span>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

const FILLING_TINT: Record<Filling, string> = { chicken: '#f59e0b', veg: '#65a30d', paneer: '#eab308', vegan: '#16a34a' };

function OrderTab({ s, t, lang, onState, toast, done }: CustomerProps & { done: () => void }) {
  const [styleOf, setStyleOf] = useState<Record<Filling, Style>>({ chicken: 'steamed', veg: 'steamed', paneer: 'steamed', vegan: 'steamed' });
  const [tray, setTray] = useState<Line[]>([]);
  const [achar, setAchar] = useState<Achar>(2);
  const [slotPick, setSlotPick] = useState<number | null>(null);
  const why = canOrder(s);
  const ot = orderTrip(s);
  const slots = slotsFor(s);
  const need = plates({ lines: tray });
  const chosen = slots.find((x) => x.start === slotPick && x.left >= Math.max(1, need)) ?? null;
  const sel = chosen ?? firstFit(slots, Math.max(1, need));
  const full = need >= MAX_PLATES;
  const stopName = ot ? placeName(route(s)[ot.idx].place, t) : '';

  // A sold-out filling leaves the tray by itself.
  useEffect(() => {
    if (tray.some((l) => s.soldOut.includes(l.filling))) setTray((x) => x.filter((l) => !s.soldOut.includes(l.filling)));
  }, [s.soldOut, tray]);

  const add = (f: Filling) => {
    audio(true);
    const st = styleOf[f];
    setTray((x) => {
      if (plates({ lines: x }) >= MAX_PLATES) return x;
      const i = x.findIndex((l) => l.filling === f && l.style === st);
      if (i >= 0) return x.map((l, j) => (j === i ? { ...l, qty: l.qty + 1 } : l));
      if (x.length >= MAX_LINES) return x;
      return [...x, { filling: f, style: st, qty: 1 }];
    });
  };
  const setQty = (i: number, q: number) => setTray((x) => (q <= 0 ? x.filter((_, j) => j !== i) : x.map((l, j) => (j === i ? { ...l, qty: q } : l))));

  const submit = () => {
    audio(true);
    if (!sel) {
      toast(t.reasons['no-slot'], 'warn');
      return;
    }
    const r = placeOrder(s, { lines: tray, achar, slot: sel.start });
    if (!r.ok) {
      toast(t.reasons[r.reason ?? 'no-slot'], 'warn');
      return;
    }
    onState(r.state);
    setTray([]);
    setSlotPick(null);
    toast(t.placed(num(r.id!, lang)), 'ok');
    done();
  };

  return (
    <div className="mt-pane">
      <div className="mt-menu-head">
        <h2 className="mt-h2">{t.menuH}</h2>
        <span className="mt-hidden-note">{t.pricesHidden}</span>
      </div>
      <p className="mt-sub">{t.menuSub}</p>
      {why && (
        <p className="mt-note is-warn">
          <Icon name={why === 'paused' ? 'pause' : 'flag'} />
          {t.reasons[why]}
        </p>
      )}
      {!why && s.drive && ot && (
        <p className="mt-note">
          <Icon name="truck" />
          {t.forNext(stopName)}
        </p>
      )}
      <ul className="mt-menu">
        {FILLINGS.map((f) => {
          const out = s.soldOut.includes(f);
          const fi = t.fillings[f];
          return (
            <li key={f} className={`mt-dish${out ? ' is-out' : ''}`} style={{ '--mt-tint': FILLING_TINT[f] } as CSSProperties}>
              <div className="mt-dish-art">
                <MomoPlate filling={f} style={styleOf[f]} />
              </div>
              <div className="mt-dish-main">
                <h3>
                  {fi.name}
                  <span className="mt-dish-ne" lang={lang === 'ne' ? 'en' : 'ne'}>
                    {fi.ne}
                  </span>
                </h3>
                <p className="mt-dish-desc">{fi.desc}</p>
                <span className="mt-dish-tags">
                  {f === 'vegan' ? (
                    <span className="mt-chip is-vegan">
                      <Icon name="sprout" />
                      {t.vegan}
                    </span>
                  ) : f !== 'chicken' ? (
                    <span className="mt-chip is-veg">
                      <Icon name="leaf" />
                      {t.veg}
                    </span>
                  ) : null}
                  {out && <span className="mt-chip is-out">{t.soldOut}</span>}
                </span>
                <div className="mt-styles" role="radiogroup" aria-label={fi.name}>
                  {STYLES.map((st) => (
                    <button
                      key={st}
                      type="button"
                      role="radio"
                      aria-checked={styleOf[f] === st}
                      className={styleOf[f] === st ? 'is-on' : ''}
                      onClick={() => setStyleOf((x) => ({ ...x, [f]: st }))}
                      disabled={out}
                    >
                      {t.styles[st]}
                    </button>
                  ))}
                </div>
                <button type="button" className="mt-btn mt-btn-add" onClick={() => add(f)} disabled={out || !!why || full} data-add={f}>
                  <Icon name="plus" />
                  {t.plates(num(1, lang))}
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <section className="mt-card mt-tray" aria-labelledby="mt-tray-h">
        <h3 id="mt-tray-h" className="mt-h3">
          <Icon name="bag" />
          {t.trayH}
          {need > 0 && <span className="mt-count">{t.plates(num(need, lang))}</span>}
        </h3>
        {tray.length === 0 ? (
          <p className="mt-sub">{t.trayEmpty}</p>
        ) : (
          <ul className="mt-tray-list">
            {tray.map((l, i) => (
              <li key={`${l.filling}-${l.style}`}>
                <span className="mt-tray-name">
                  <strong>{t.fillings[l.filling].name}</strong>
                  <small>{t.styles[l.style]}</small>
                </span>
                <Stepper value={l.qty} onChange={(q) => setQty(i, q)} min={0} max={l.qty + (MAX_PLATES - need)} lang={lang} less={t.less} more={t.more} />
              </li>
            ))}
          </ul>
        )}
        {full && <p className="mt-sub">{t.trayMax(num(MAX_PLATES, lang))}</p>}

        <h4 className="mt-h4">{t.acharH}</h4>
        <div className="mt-achars" role="radiogroup" aria-label={t.acharH}>
          {ACHARS.map((a) => (
            <button key={a} type="button" role="radio" aria-checked={achar === a} className={achar === a ? 'is-on' : ''} onClick={() => setAchar(a)}>
              <span className="mt-chilis" aria-hidden="true">
                {Array.from({ length: a }, (_, i) => (
                  <Icon key={i} name="chili" />
                ))}
              </span>
              {t.achars[a - 1]}
            </button>
          ))}
        </div>

        <h4 className="mt-h4">{t.slotH}</h4>
        {ot && <p className="mt-sub">{t.slotSub(stopName)}</p>}
        {slots.length === 0 ? (
          <p className="mt-note">{t.noSlots}</p>
        ) : (
          <div className="mt-slots" role="radiogroup" aria-label={t.slotH}>
            {slots.map((x) => {
              const fits = x.left >= Math.max(1, need);
              const on = sel?.start === x.start;
              return (
                <button
                  key={x.start}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  className={`mt-slot${on ? ' is-on' : ''}${x.full ? ' is-full' : ''}`}
                  disabled={!fits}
                  onClick={() => setSlotPick(x.start)}
                  data-slot={x.start}
                >
                  <strong>{mclk(x.start, lang)}</strong>
                  <span className="mt-slot-bar" aria-hidden="true">
                    <span style={{ width: `${Math.min(100, (x.booked / x.cap) * 100)}%` }} />
                  </span>
                  <small>{x.full ? t.slotFull : t.slotLeft(num(x.left, lang))}</small>
                </button>
              );
            })}
          </div>
        )}
        <button type="button" className="mt-btn mt-btn-main mt-btn-wide mt-place" onClick={submit} disabled={!!why || !tray.length || !sel} data-place="1">
          <Icon name="check" />
          {sel && tray.length ? t.placeBtn(mclk(sel.start, lang)) : tray.length ? t.pickTime : t.reasons.empty}
        </button>
      </section>
    </div>
  );
}

function PickupTab({ s, t, lang, onState, onEvents, toast, goOrder }: CustomerProps & { goOrder: () => void }) {
  const mine = s.orders.filter((o) => o.mine).sort((a, b) => a.id - b.id);
  const active = mine.filter((o) => o.status !== 'picked');
  const past = mine.filter((o) => o.status === 'picked').slice(-3).reverse();
  if (!mine.length)
    return (
      <div className="mt-pane mt-empty">
        <div className="mt-empty-art">
          <Steam className="mt-empty-steam" />
          <MomoPlate filling="chicken" style="steamed" />
        </div>
        <h2 className="mt-h2">{t.noOrder}</h2>
        <p className="mt-sub">{t.noOrderSub}</p>
        {!canOrder(s) && (
          <button type="button" className="mt-btn mt-btn-main" onClick={goOrder}>
            <Icon name="bag" />
            {t.orderAhead}
          </button>
        )}
      </div>
    );
  const hand = (o: Order) => {
    audio(true);
    const r = scan(s, pickupCode(o.id));
    if (r.ok) {
      thunk();
      onState(r.state);
      onEvents(r.events);
      toast(t.thanks, 'ok');
    } else toast(t.scanned[r.result](num(o.id, lang)), 'warn');
  };
  return (
    <div className="mt-pane">
      {active.map((o) => {
        const ahead = aheadOf(s, o.id);
        const place = route(s)[o.trip === s.trip ? s.idx : s.drive ? s.drive.to : s.idx]?.place;
        return (
          <article key={o.id} className={`mt-ticket is-${o.status}`} aria-labelledby={`mt-tk-${o.id}`}>
            <p className="mt-ticket-k">{t.yourNumber}</p>
            <p className="mt-ticket-n" id={`mt-tk-${o.id}`}>
              {num(o.id, lang)}
            </p>
            <p className="mt-ticket-at">{t.pickupAt(mclk(o.slot, lang), place ? placeName(place, t) : '')}</p>
            <Steps o={o} t={t} />
            <div className="mt-ticket-q" aria-live="polite">
              {o.status === 'ready' ? (
                <strong className="mt-ready-now">{t.readyH}</strong>
              ) : (
                <strong className={`mt-ahead${ahead === 0 ? ' is-next' : ''}`} data-ahead={ahead}>
                  {ahead === 0 ? t.aheadNone : ahead === 1 ? t.aheadOne : t.ahead(num(ahead, lang))}
                </strong>
              )}
              {o.status === 'steaming' && <Steam className="mt-ticket-steam" />}
            </div>
            <div className="mt-ticket-code">
              <Qr text={pickupCode(o.id)} label={t.codeLabel(num(o.id, lang))} />
              <div>
                <p className="mt-ticket-show">{t.showCode}</p>
                <ul className="mt-ticket-lines">
                  {o.lines.map((l, i) => (
                    <li key={i}>{lineText(l, t, lang)}</li>
                  ))}
                  <li className="mt-ticket-achar">
                    {t.acharH}: {t.achars[o.achar - 1]}
                  </li>
                </ul>
              </div>
            </div>
            {o.status === 'ready' && (
              <>
                <button type="button" className="mt-btn mt-btn-main mt-btn-wide" onClick={() => hand(o)} data-hand={o.id}>
                  <Icon name="scan" />
                  {t.handBtn}
                </button>
                <p className="mt-sub mt-center">{t.handHint}</p>
              </>
            )}
          </article>
        );
      })}
      {active.length === 0 && (
        <div className="mt-thanks">
          <Icon name="check" />
          <p>{t.thanks}</p>
        </div>
      )}
      {!canOrder(s) && active.length < 2 && (
        <button type="button" className="mt-btn mt-btn-soft mt-btn-wide" onClick={goOrder}>
          <Icon name="bag" />
          {t.orderAgain}
        </button>
      )}
      {past.length > 0 && (
        <section className="mt-card" aria-labelledby="mt-past-h">
          <h3 id="mt-past-h" className="mt-h3">
            {t.earlier}
          </h3>
          <ul className="mt-past">
            {past.map((o) => (
              <li key={o.id}>
                <strong>#{num(o.id, lang)}</strong>
                <span>{o.lines.map((l) => lineText(l, t, lang)).join(', ')}</span>
                <span className="mt-tag is-ok">{t.steps.picked}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function StampsTab({ s, t, lang }: CustomerProps) {
  return (
    <div className="mt-pane">
      <section className="mt-stampcard" aria-labelledby="mt-stamps-h">
        <div className="mt-stampcard-head">
          <GaadiMark className="mt-stampcard-mark" />
          <div>
            <h2 id="mt-stamps-h">{t.stampsH}</h2>
            <p>{t.stampsN(num(s.stamps, lang), num(STAMPS_PER_BADGE, lang))}</p>
          </div>
        </div>
        <ol className="mt-stamps" aria-label={t.stampsN(num(s.stamps, lang), num(STAMPS_PER_BADGE, lang))}>
          {Array.from({ length: STAMPS_PER_BADGE }, (_, i) => (
            <li key={i}>
              <StampMark n={i + 1} on={i < s.stamps} />
            </li>
          ))}
        </ol>
        <p className="mt-stampcard-sub">{t.stampsSub}</p>
      </section>
      <section className="mt-card" aria-labelledby="mt-badges-h">
        <h3 id="mt-badges-h" className="mt-h3">
          <Icon name="star" />
          {t.badgesH}
        </h3>
        {s.badges > 0 ? (
          <ul className="mt-badges">
            {Array.from({ length: Math.min(s.badges, 6) }, (_, i) => (
              <li key={i}>
                <BadgeArt className="mt-badge-art" />
                <span>{t.badgeName}</span>
              </li>
            ))}
            {s.badges > 6 && <li className="mt-badges-more">×{num(s.badges, lang)}</li>}
          </ul>
        ) : (
          <div className="mt-badge-none">
            <BadgeArt className="mt-badge-art is-ghost" />
            <p>{t.noBadge(num(STAMPS_PER_BADGE - s.stamps, lang))}</p>
          </div>
        )}
      </section>
    </div>
  );
}

// ---------- "Your momo are ready!" ----------

function ReadyOverlay({ o, t, lang, onClose, framed }: { o: Order; t: Copy; lang: Lang; onClose: () => void; framed: boolean }) {
  const ref = useRef<HTMLButtonElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
    readyJingle();
    try {
      navigator.vibrate?.([120, 60, 120]);
    } catch {
      /* ignore */
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  return (
    <div className={`mt-ready${framed ? ' is-framed' : ''}`} role="alertdialog" aria-modal="true" aria-labelledby="mt-ready-h" aria-describedby="mt-ready-p">
      <div className="mt-confetti" aria-hidden="true">
        {Array.from({ length: 28 }, (_, i) => (
          <span key={i} style={{ '--i': i, '--x': `${(i * 37) % 100}%`, '--d': `${(i % 7) * 0.12}s`, '--c': ['#f59e0b', '#14b8a6', '#dc2626', '#facc15', '#22c55e'][i % 5] } as CSSProperties} />
        ))}
      </div>
      <div className="mt-ready-card">
        <div className="mt-ready-art">
          <Steam className="mt-ready-steam" />
          <MomoPlate filling={o.lines[0].filling} style={o.lines[0].style} />
        </div>
        <h2 id="mt-ready-h">{t.readyH}</h2>
        <p className="mt-ready-n">{num(o.id, lang)}</p>
        <p id="mt-ready-p">{t.readySub(num(o.id, lang))}</p>
        <button type="button" className="mt-btn mt-btn-main mt-btn-wide" onClick={onClose} ref={ref} data-ready-ok="1">
          {t.readyOk}
        </button>
      </div>
    </div>
  );
}

// ---------- the crew's tablet ----------

type CrewProps = {
  s: State;
  t: Copy;
  lang: Lang;
  sound: boolean;
  setSound: (v: boolean) => void;
  onState: (s: State) => void;
  onEvents: (e: Event[]) => void;
  toast: (text: string, tone?: ToastTone) => void;
  onServing: () => void;
};

function Crew({ s, t, lang, sound, setSound, onState, onEvents, toast, onServing }: CrewProps) {
  const [scanning, setScanning] = useState(false);
  const r = route(s);
  const head = headline(s, t, lang);
  const trip = s.drive ? s.trip + 1 : s.trip;
  const q = queue(s, trip);
  const open = q.filter((o) => o.status !== 'picked');
  const handed = q.length - open.length;
  const groups = new Map<number, Order[]>();
  for (const o of open) groups.set(o.slot, [...(groups.get(o.slot) ?? []), o]);
  const load = steamerLoad(s);
  const td = today(s);
  const maxSlot = Math.max(1, ...td.perSlot.map((x) => x.orders));
  const maxFill = Math.max(1, ...FILLINGS.map((f) => td.byFilling[f]));
  const mineWaiting = !s.drive && !s.done && s.orders.some((o) => o.mine && o.trip === s.trip && o.status !== 'picked');
  const next = !s.drive && !s.done ? r[s.idx + 1] : undefined;

  const act = (o: Order) => {
    audio(true);
    const m = advance(s, o.id);
    if (!m.ok) {
      toast(m.reason === 'steamers-full' ? t.steamersFull : t.notHere, 'warn');
      return;
    }
    if (sound) thunk();
    onState(m.state);
    onEvents(m.events);
  };
  const move = () => {
    audio(true);
    const m = moveNext(s);
    if (!m.ok) {
      toast(m.reason === 'mine-waiting' ? t.mineWaiting : t.movingTo(placeName(head.place, t)), 'warn');
      return;
    }
    if (sound) honk();
    onState(m.state);
    onEvents(m.events);
  };

  return (
    <div className="mt-crew">
      <div className="mt-crew-head">
        <div className="mt-crew-title">
          <Icon name="crew" />
          <div>
            <h2>{t.crewH}</h2>
            <p>{t.crewSub}</p>
          </div>
        </div>
        <div className={`mt-crew-stop is-${head.tone}`}>
          <strong>{placeName(head.place, t)}</strong>
          <span>{head.text}</span>
        </div>
      </div>

      <div className="mt-crew-tools">
        <button type="button" className="mt-btn mt-btn-crew" onClick={() => setScanning(true)} data-scan="1">
          <Icon name="scan" />
          {t.scanBtn}
        </button>
        <button type="button" className="mt-btn mt-btn-crew" onClick={onServing} data-serving="1">
          <Icon name="tv" />
          {t.servingBtn}
        </button>
        <button type="button" className="mt-btn mt-btn-crew mt-btn-icon" onClick={() => setSound(!sound)} aria-pressed={sound} aria-label={t.sound} title={t.sound}>
          <Icon name={sound ? 'sound' : 'mute'} />
        </button>
      </div>

      <div className="mt-crew-grid">
        <section className="mt-board" aria-labelledby="mt-queue-h">
          <div className="mt-board-head">
            <h3 id="mt-queue-h">
              {t.queueH} · {t.queueFor(placeName((s.drive ? r[s.drive.to] : r[s.idx]).place, t))}
            </h3>
            <span className="mt-board-count">{num(open.length, lang)}</span>
          </div>
          {open.length === 0 ? (
            <p className="mt-board-empty">{t.queueEmpty}</p>
          ) : (
            <div className="mt-slotgroups">
              {[...groups.entries()].map(([slot, list]) => {
                const booked = q.filter((o) => o.slot === slot).reduce((a, o) => a + plates(o), 0);
                return (
                  <div key={slot} className="mt-slotgroup">
                    <div className="mt-slotgroup-head">
                      <strong>{mclk(slot, lang)}</strong>
                      <span className="mt-load" aria-hidden="true">
                        <span style={{ width: `${Math.min(100, (booked / s.slotCap) * 100)}%` }} />
                      </span>
                      <small>{t.slotLoad(num(booked, lang), num(s.slotCap, lang))}</small>
                    </div>
                    <ul>
                      {list.map((o) => (
                        <li key={o.id} className={`mt-order is-${o.status}${o.mine ? ' is-mine' : ''}`} data-order={o.id}>
                          <div className="mt-order-top">
                            <span className="mt-order-n">#{num(o.id, lang)}</span>
                            {o.mine && <span className="mt-tag is-you">{t.you}</span>}
                            <span className={`mt-st is-${o.status}`}>{t.steps[o.status]}</span>
                          </div>
                          <ul className="mt-order-lines">
                            {o.lines.map((l, i) => (
                              <li key={i}>{lineText(l, t, lang)}</li>
                            ))}
                            <li className="mt-order-achar">
                              <Icon name="chili" />
                              {t.achars[o.achar - 1]}
                            </li>
                          </ul>
                          {o.status !== 'picked' && (
                            <button type="button" className={`mt-btn mt-go is-${o.status}`} onClick={() => act(o)} disabled={!!s.drive} data-go={o.id}>
                              {t.go[o.status]}
                              <Icon name="arrow" />
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
          {handed > 0 && <p className="mt-board-handed">{t.steps.picked}: {num(handed, lang)}</p>}
        </section>

        <div className="mt-crew-side">
          <section className="mt-panel" aria-labelledby="mt-route-h">
            <h3 id="mt-route-h">{t.routeH}</h3>
            <ol className="mt-route">
              {r.map((v, k) => {
                const st = stopStatus(s, k);
                return (
                  <li key={k} className={`is-${st.kind}`}>
                    <span className="mt-route-dot">{num(k + 1, lang)}</span>
                    <span className="mt-route-name">{placeName(v.place, t)}</span>
                    <small>
                      {mclk(v.opens, lang)}–{mclk(v.closes, lang)}
                    </small>
                  </li>
                );
              })}
            </ol>
            {s.drive ? (
              <p className="mt-route-moving">
                <Icon name="truck" />
                {t.movingTo(placeName(r[s.drive.to].place, t))} · {inMin(s, s.drive.until, t, lang)}
              </p>
            ) : (
              <button type="button" className="mt-btn mt-btn-move" onClick={move} disabled={mineWaiting} data-move="1">
                <Icon name="truck" />
                {s.done
                  ? t.moveDay(
                      t.days[
                        (() => {
                          let d = (s.day + 1) % 7;
                          while (!WEEK[d].length) d = (d + 1) % 7;
                          return d;
                        })()
                      ]
                    )
                  : next
                    ? t.moveBtn(placeName(next.place, t))
                    : t.moveEnd}
              </button>
            )}
            {mineWaiting && <p className="mt-crew-note">{t.mineWaiting}</p>}
          </section>

          <section className="mt-panel" aria-labelledby="mt-steam-h">
            <h3 id="mt-steam-h">{t.steamersH}</h3>
            <ul className="mt-steamers">
              {load.map((n, i) => (
                <li key={i}>
                  <span className="mt-steamer-l">{t.steamer(num(i + 1, lang))}</span>
                  <span className="mt-steamer-bar" role="meter" aria-valuemin={0} aria-valuemax={STEAMER_PLATES} aria-valuenow={n} aria-label={t.steamer(num(i + 1, lang))}>
                    <span style={{ width: `${(n / STEAMER_PLATES) * 100}%` }} />
                    {n > 0 && <Steam className="mt-steamer-steam" />}
                  </span>
                  <small>{t.platesOf(num(n, lang), num(STEAMER_PLATES, lang))}</small>
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-panel" aria-label={t.pauseLabel}>
            <Switch
              id="mt-pause"
              on={s.paused}
              onChange={(v) => {
                onState(setPaused(s, v));
                toast(v ? t.pausedToast : t.resumedToast, v ? 'warn' : 'ok');
              }}
              label={t.pauseLabel}
              sub={s.paused ? t.pauseOn : t.pauseOff}
            />
            <Switch id="mt-auto" on={s.autoCrew} onChange={(v) => onState(setAutoCrew(s, v))} label={t.autoLabel} sub={t.autoSub} />
          </section>

          <section className="mt-panel" aria-labelledby="mt-so-h">
            <h3 id="mt-so-h">{t.soldOutH}</h3>
            <div className="mt-soldout">
              {FILLINGS.map((f) => {
                const out = s.soldOut.includes(f);
                return (
                  <button
                    key={f}
                    type="button"
                    className={out ? 'is-out' : ''}
                    aria-pressed={out}
                    onClick={() => {
                      onState(toggleSoldOut(s, f));
                      toast(out ? t.backToast(t.fillings[f].name) : t.soldOutToast(t.fillings[f].name), out ? 'ok' : 'warn');
                    }}
                    data-soldout={f}
                  >
                    <span className="mt-so-dot" style={{ background: FILLING_TINT[f] }} aria-hidden="true" />
                    {t.fillings[f].name}
                    <small>{out ? t.soldOut : '✓'}</small>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="mt-panel" aria-labelledby="mt-cap-h">
            <h3 id="mt-cap-h">{t.capH}</h3>
            <div className="mt-cap">
              <Stepper value={s.slotCap} onChange={(n) => onState(setSlotCap(s, n))} min={SLOT_CAP_MIN} max={SLOT_CAP_MAX} lang={lang} less={t.less} more={t.more} />
              <small>{t.capSub}</small>
            </div>
          </section>

          <section className="mt-panel" aria-labelledby="mt-counts-h">
            <h3 id="mt-counts-h">{t.countsH}</h3>
            <div className="mt-stats">
              <p>
                <strong>{num(td.orders, lang)}</strong>
                {t.countsOrders}
              </p>
              <p>
                <strong>{num(td.plates, lang)}</strong>
                {t.countsPlates}
              </p>
              <p>
                <strong>{num(td.stops, lang)}</strong>
                {t.countsStops}
              </p>
            </div>
            <h4>{t.perSlotH}</h4>
            {td.perSlot.length === 0 ? (
              <p className="mt-crew-note">{t.perSlotNone}</p>
            ) : (
              <div className="mt-bars" role="list">
                {td.perSlot.map((x) => (
                  <div key={x.slot} className="mt-bar" role="listitem" aria-label={`${mclk(x.slot, lang)}: ${num(x.orders, lang)}`}>
                    <span className="mt-bar-n">{num(x.orders, lang)}</span>
                    <span className="mt-bar-col" style={{ height: `${(x.orders / maxSlot) * 100}%` }} />
                    <span className="mt-bar-l">{mclk(x.slot, lang)}</span>
                  </div>
                ))}
              </div>
            )}
            <h4>{t.byFillingH}</h4>
            <ul className="mt-hbars">
              {FILLINGS.map((f) => (
                <li key={f}>
                  <span>{t.fillings[f].name}</span>
                  <span className="mt-hbar">
                    <span style={{ width: `${(td.byFilling[f] / maxFill) * 100}%`, background: FILLING_TINT[f] }} />
                  </span>
                  <b>{num(td.byFilling[f], lang)}</b>
                </li>
              ))}
            </ul>
            <p className="mt-crew-note">{t.countsNote}</p>
          </section>
        </div>
      </div>

      {scanning && (
        <Scanner
          s={s}
          t={t}
          lang={lang}
          onClose={() => setScanning(false)}
          onScan={(code) => {
            audio(true);
            const res = scan(s, code);
            const n = num(res.id ?? '?', lang);
            if (res.ok) {
              if (sound) thunk();
              onState(res.state);
              onEvents(res.events);
            }
            toast(t.scanned[res.result](n), res.ok ? 'ok' : 'warn');
            return res.ok;
          }}
        />
      )}
    </div>
  );
}

function Scanner({ s, t, lang, onClose, onScan }: { s: State; t: Copy; lang: Lang; onClose: () => void; onScan: (code: string) => boolean }) {
  const [busy, setBusy] = useState<number | null>(null);
  const [typed, setTyped] = useState('');
  const ready = queue(s).filter((o) => o.status === 'ready');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  const go = (o: Order) => {
    if (busy) return;
    setBusy(o.id);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    timer.current = setTimeout(
      () => {
        setBusy(null);
        if (onScan(pickupCode(o.id)) && ready.length <= 1) onClose();
      },
      reduce ? 50 : 700
    );
  };
  return (
    <Modal title={t.scanH} onClose={onClose} labelId="mt-scan-h" closeLabel={t.close} className="is-crew">
      <p className="mt-sub">{t.scanSub}</p>
      <div className={`mt-viewfinder${busy ? ' is-busy' : ''}`} aria-hidden="true">
        <span className="mt-vf-line" />
        {busy ? <Qr text={pickupCode(busy)} label="" className="mt-vf-qr" /> : <Icon name="scan" />}
      </div>
      {busy && <p className="mt-center mt-sub" aria-live="polite">{t.scanning}</p>}
      {ready.length === 0 ? (
        <p className="mt-note">{t.scanNone}</p>
      ) : (
        <ul className="mt-scan-list">
          {ready.map((o) => (
            <li key={o.id}>
              <button type="button" onClick={() => go(o)} disabled={!!busy} data-scan-id={o.id} className={o.mine ? 'is-mine' : ''}>
                <Qr text={pickupCode(o.id)} label={t.codeLabel(num(o.id, lang))} />
                <span>
                  #{num(o.id, lang)}
                  {o.mine && <span className="mt-tag is-you">{t.you}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        className="mt-scan-type"
        onSubmit={(e) => {
          e.preventDefault();
          if (typed.trim()) onScan(typed.replace(/[०-९]/g, (d) => String('०१२३४५६७८९'.indexOf(d))));
          setTyped('');
        }}
      >
        <label htmlFor="mt-scan-in">{t.scanType}</label>
        <input id="mt-scan-in" inputMode="numeric" autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={t.scanTypePh} />
        <button type="submit" className="mt-btn mt-btn-soft mt-btn-sm">
          {t.scanGo}
        </button>
      </form>
    </Modal>
  );
}

// ---------- "Now serving" for the truck window ----------

function Serving({ s, t, lang, onClose, fontClass }: { s: State; t: Copy; lang: Lang; onClose: () => void; fontClass: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const ns = nowServing(s);
  const head = headline(s, t, lang);
  useEffect(() => {
    const el = ref.current;
    const prev = document.activeElement as HTMLElement | null;
    el?.focus();
    let entered = false;
    try {
      const p = el?.requestFullscreen?.();
      if (p && typeof p.then === 'function')
        p.then(
          () => {
            entered = true;
          },
          () => {}
        );
    } catch {
      /* the overlay still fills the window */
    }
    const onFs = () => {
      if (entered && !document.fullscreenElement) closeRef.current();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current();
    document.addEventListener('fullscreenchange', onFs);
    document.addEventListener('keydown', onKey);
    document.documentElement.classList.add('mt-serving-on');
    return () => {
      document.removeEventListener('fullscreenchange', onFs);
      document.removeEventListener('keydown', onKey);
      document.documentElement.classList.remove('mt-serving-on');
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
      prev?.focus?.({ preventScroll: true });
    };
  }, []);
  return createPortal(
    <div className={`mt-serving ${fontClass}`} role="dialog" aria-modal="true" aria-labelledby="mt-serving-h" tabIndex={-1} ref={ref} lang={lang} translate="no">
      <div className="mt-serving-top">
        <span className="mt-serving-brand">
          <GaadiMark className="mt-serving-mark" />
          {t.name}
        </span>
        <span className="mt-serving-where">
          {placeName(head.place, t)} · {clk(s.now, lang)}
        </span>
        <button type="button" className="mt-serving-exit" onClick={onClose} data-serving-exit="1">
          {t.servingExit}
        </button>
      </div>
      <div className="mt-serving-main">
        <p className="mt-serving-h" id="mt-serving-h">
          {t.servingH}
        </p>
        {ns.serving != null ? (
          <p className="mt-serving-n" aria-live="polite" data-serving-n={ns.serving}>
            {num(ns.serving, lang)}
          </p>
        ) : (
          <p className="mt-serving-none" aria-live="polite">
            <Steam className="mt-serving-wait" />
            {t.servingNone}
          </p>
        )}
      </div>
      <div className="mt-serving-lists">
        <div>
          <h3>{t.servingReady}</h3>
          <p>{ns.ready.slice(1, 9).map((n) => num(n, lang)).join('  ') || '·'}</p>
        </div>
        <div>
          <h3>
            <Steam className="mt-serving-steam" />
            {t.servingSteaming}
          </h3>
          <p>{ns.steaming.slice(0, 10).map((n) => num(n, lang)).join('  ') || '·'}</p>
        </div>
      </div>
      <TruckArt className="mt-serving-truck" steam />
    </div>,
    document.body
  );
}

// ---------- the whole demo ----------

type ToastTone = 'ok' | 'info' | 'warn';
type Toast = { id: number; text: string; tone: ToastTone };
const VIEWS: View[] = ['customer', 'crew', 'both'];
const VIEW_ICON: Record<View, IconName> = { customer: 'phone', crew: 'crew', both: 'columns' };

export default function MomoTruck({ initialLang, fontClass = '' }: { initialLang: Lang; fontClass?: string }) {
  const [s, setS] = useState<State | null>(null);
  const sRef = useRef<State | null>(null);
  const [view, setView] = useState<View>('customer');
  const [tab, setTab] = useState<Tab>('truck');
  const [wide, setWide] = useState(false);
  const [roomy, setRoomy] = useState(false);
  const [sound, setSound] = useState(true);
  const [serving, setServing] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);
  const soundRef = useRef(sound);
  soundRef.current = sound;
  const viewRef = useRef<View>(view);

  const lang: Lang = s?.lang ?? initialLang;
  const t = COPY[lang];
  const eff: View = view === 'both' && !wide ? 'customer' : view;
  viewRef.current = eff;

  const toast = useCallback((text: string, tone: ToastTone = 'ok') => {
    const id = ++toastId.current;
    setToasts((x) => [...x.slice(-2), { id, text, tone }]);
    setTimeout(() => setToasts((x) => x.filter((y) => y.id !== id)), 4200);
  }, []);

  const commit = useCallback((next: State) => {
    sRef.current = next;
    setS(next);
    saveRaw(next);
  }, []);

  const pushNote = useCallback((title: string, body: string) => {
    const cur = sRef.current;
    if (!cur?.push) return;
    try {
      if ('Notification' in window && Notification.permission === 'granted') new Notification(title, { body, tag: 'momo-gaadi' });
    } catch {
      /* some phones only allow notifications from a service worker — the toast is enough */
    }
  }, []);

  const onEvents = useCallback(
    (events: Event[]) => {
      const cur = sRef.current;
      if (!cur) return;
      const tt = COPY[cur.lang];
      for (const e of events) {
        if (e.kind === 'arrived' && e.notify) {
          const msg = tt.arrived(placeName(e.place, tt));
          toast(msg, 'info');
          pushNote(tt.name, msg);
          if (soundRef.current) honk();
        }
        if (e.kind === 'order' && soundRef.current && viewRef.current !== 'customer') chime();
        if (e.kind === 'stamp') toast(tt.stampToast(num(e.stamps, cur.lang), num(STAMPS_PER_BADGE, cur.lang)), 'ok');
        if (e.kind === 'badge') toast(tt.badgeToast, 'ok');
        if (e.kind === 'closed') toast(tt.closedToast, 'info');
        if (e.kind === 'newday') toast(tt.newDayToast(tt.days[e.day]), 'info');
        if (e.kind === 'departed' && cur.drive) toast(tt.movedToast(placeName(route(cur)[cur.drive.to].place, tt)), 'info');
      }
    },
    [toast, pushNote]
  );

  // Start: the stored day (or a fresh one), ?view= for links.
  useEffect(() => {
    const st = normalize(loadRaw(), initialLang);
    commit(st);
    const params = new URLSearchParams(window.location.search);
    const pv = params.get('view');
    const mqWide = window.matchMedia('(min-width: 1100px)');
    const mqRoomy = window.matchMedia('(min-width: 720px)');
    const onMq = () => {
      setWide(mqWide.matches);
      setRoomy(mqRoomy.matches);
    };
    onMq();
    setView(pv && (VIEWS as string[]).includes(pv) ? (pv as View) : mqWide.matches ? 'both' : 'customer');
    mqWide.addEventListener('change', onMq);
    mqRoomy.addEventListener('change', onMq);
    // The first tap anywhere may start the sound (browsers only allow audio after one).
    const unlock = () => audio(true);
    window.addEventListener('pointerdown', unlock, { once: true });
    return () => {
      mqWide.removeEventListener('change', onMq);
      mqRoomy.removeEventListener('change', onMq);
      window.removeEventListener('pointerdown', unlock);
    };
  }, [initialLang, commit]);

  // The day runs: one tick a second while the tab is visible.
  useEffect(() => {
    if (!s) return;
    let last = performance.now();
    const onVis = () => {
      last = performance.now();
    };
    document.addEventListener('visibilitychange', onVis);
    const id = setInterval(() => {
      const nowMs = performance.now();
      const dt = nowMs - last;
      last = nowMs;
      const cur = sRef.current;
      if (!cur || document.hidden) return;
      const r = tick(cur, dt);
      if (r.state === cur) return;
      // Arrival notes need the state they arrive in.
      sRef.current = r.state;
      commit(r.state);
      onEvents(r.events);
    }, 1000);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s === null]);

  // Switching views on a phone: start at the top of the new view, not in the footer.
  const stageRef = useRef<HTMLDivElement>(null);
  const pickView = (v: View) => {
    setView(v);
    requestAnimationFrame(() => {
      const top = stageRef.current?.getBoundingClientRect().top ?? 0;
      if (top < 0) window.scrollBy({ top: top - 72 });
    });
  };

  const onState = useCallback((next: State) => commit(next), [commit]);
  const onEventsAfter = useCallback(
    (events: Event[]) => {
      onEvents(events);
    },
    [onEvents]
  );

  const reset = () => {
    const fresh = normalize(null, lang);
    commit(fresh);
    setTab('truck');
    toast(COPY[lang].resetDone, 'info');
  };

  const allowPush = () => {
    const cur = sRef.current;
    if (!cur) return;
    const tt = COPY[cur.lang];
    if (!('Notification' in window)) {
      toast(tt.pushNone, 'warn');
      return;
    }
    try {
      Notification.requestPermission().then(
        (p) => {
          const now = sRef.current;
          if (!now) return;
          if (p === 'granted') {
            commit(setPush(now, true));
            toast(tt.pushOn, 'ok');
          } else toast(tt.pushDenied, 'warn');
        },
        () => toast(tt.pushDenied, 'warn')
      );
    } catch {
      toast(tt.pushDenied, 'warn');
    }
  };
  const previewPush = () => {
    const cur = sRef.current;
    if (!cur) return;
    const tt = COPY[cur.lang];
    const r = route(cur);
    const next = cur.drive ? r[cur.drive.to] : r[Math.min(cur.idx + 1, r.length - 1)];
    const msg = tt.arrived(placeName(next.place, tt));
    toast(msg, 'info');
    pushNote(tt.name, msg);
  };

  const showCustomer = eff === 'customer' || eff === 'both';
  const framed = eff === 'both' || (eff === 'customer' && roomy);
  const views = wide ? VIEWS : VIEWS.filter((v) => v !== 'both');
  const readyMine = s && showCustomer ? s.orders.find((o) => o.mine && o.status === 'ready' && !s.cheered.includes(o.id)) : undefined;

  return (
    <div className={`mt mt-v-${eff}`} lang={lang} translate="no">
      <div className="mt-top">
        <div className="mt-top-in">
          <div className="mt-brand">
            <GaadiMark className="mt-brand-mark" />
            <div>
              <p className="mt-brand-name">{t.name}</p>
              <p className="mt-brand-tag">{t.tagline}</p>
            </div>
          </div>
          <div className="mt-top-tools">
            <span className="mt-clock" title={t.fast}>
              <span className="mt-live" aria-hidden="true" />
              {s ? t.clock(clk(s.now, lang)) : t.clock(num('11:24', lang))}
            </span>
            <div className="mt-langs" role="group" aria-label={t.langLabel}>
              {LANGS.map((l) => (
                <button key={l.id} type="button" className={lang === l.id ? 'is-on' : ''} aria-pressed={lang === l.id} lang={l.id} data-lang={l.id} onClick={() => s && commit({ ...s, lang: l.id })}>
                  {l.label}
                </button>
              ))}
            </div>
            <button type="button" className="mt-reset" onClick={reset} disabled={!s} data-reset="1">
              <Icon name="reset" />
              {t.reset}
            </button>
          </div>
        </div>
        <p className="mt-made-up">
          {t.madeUp} · {t.fast}
        </p>
        <div className="mt-views" role="tablist" aria-label={t.viewsLabel}>
          {views.map((v) => (
            <button key={v} type="button" role="tab" aria-selected={eff === v} className={eff === v ? 'is-on' : ''} onClick={() => pickView(v)} data-view={v}>
              <Icon name={VIEW_ICON[v]} />
              {t.views[v]}
            </button>
          ))}
        </div>
      </div>

      {!s ? (
        <div className="mt-loading" aria-busy="true">
          <div className="mt-skel" />
          <div className="mt-skel" />
        </div>
      ) : (
        <div className="mt-stage" ref={stageRef}>
          {showCustomer && (
            <section className="mt-panel-customer" aria-label={t.views.customer}>
              <div className={`mt-phone${framed ? ' is-framed' : ''}`}>
                {framed && <span className="mt-phone-notch" aria-hidden="true" />}
                <Customer
                  s={s}
                  t={t}
                  lang={lang}
                  tab={tab}
                  setTab={setTab}
                  framed={framed}
                  onState={onState}
                  onEvents={onEventsAfter}
                  toast={toast}
                  onAllowPush={allowPush}
                  onPreviewPush={previewPush}
                />
                {readyMine && (
                  <ReadyOverlay
                    key={readyMine.id}
                    o={readyMine}
                    t={t}
                    lang={lang}
                    framed={framed}
                    onClose={() => {
                      const cur = sRef.current;
                      if (cur) commit(cheer(cur, readyMine.id));
                      setTab('pickup');
                    }}
                  />
                )}
              </div>
            </section>
          )}
          {(eff === 'crew' || eff === 'both') && (
            <section className="mt-panel-crew" aria-label={t.views.crew}>
              <Crew s={s} t={t} lang={lang} sound={sound} setSound={setSound} onState={onState} onEvents={onEventsAfter} toast={toast} onServing={() => setServing(true)} />
            </section>
          )}
        </div>
      )}

      <div className="mt-toasts" aria-live="polite" role="status">
        {toasts.map((x) => (
          <p key={x.id} className={`mt-toast is-${x.tone}`}>
            {x.text}
          </p>
        ))}
      </div>

      {serving && s && <Serving s={s} t={t} lang={lang} onClose={() => setServing(false)} fontClass={fontClass} />}
    </div>
  );
}
