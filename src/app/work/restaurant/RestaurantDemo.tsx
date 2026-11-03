'use client';

// The QR table ordering demo: a made-up Nepali restaurant in Köln, seen three
// ways at once. The guest at table 7 orders from their phone, the kitchen board
// moves tickets New → Cooking → Ready, and the waiter / owner watches the floor
// plan, answers calls, sees today's counts and marks dishes sold out. The
// other eleven tables are simulated so the evening feels busy. All the rules
// live in order.ts; this file only draws them. Everything is kept in
// localStorage under one key — nothing is sent anywhere, and there are no
// prices, totals or payments anywhere (the "bill" is an order summary).

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'qrcode';
import { ChuloMark, FoodArt, Icon, type IconName } from './art';
import {
  CATS,
  DISHES,
  STATIONS,
  STYLES,
  TABLE_COUNT,
  ackCall,
  addToCart,
  advance,
  askBill,
  callActive,
  callWaiter,
  cartCount,
  clearTable,
  clockLabel,
  dishById,
  dropSoldOut,
  isSoldOut,
  minsSince,
  normalize,
  orderSummary,
  progress,
  sendCart,
  setCartQty,
  switchGuestTable,
  tableOrders,
  tableStatus,
  tick,
  ticketClock,
  today,
  toggleSoldOut,
  type Cat,
  type Choice,
  type Dish,
  type Line,
  type Order,
  type Spice,
  type State,
  type Station,
  type Status,
  type Style,
  type TableStatus,
} from './order';
import { COPY, LANGS, num, type Copy, type Lang, type View } from './content';

const STORE_KEY = 'mn-demo:restaurant';
const QR_BASE = 'https://www.martnepali.com/work/restaurant?table=';

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
  if (AUDIO || !create) return AUDIO;
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    AUDIO = new Ctx();
  } catch {
    AUDIO = null;
  }
  return AUDIO;
}
/** The "bump" of a ticket being pushed along the rail. */
function bump() {
  const ctx = audio(true);
  if (!ctx) return;
  try {
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(190, t);
    o.frequency.exponentialRampToValueAtTime(55, t + 0.16);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + 0.24);
  } catch {
    /* no sound — the card still moves */
  }
}
/** A soft two-note chime for a new ticket — only after a tap has started the audio. */
function chime() {
  const ctx = audio(false);
  if (!ctx) return;
  try {
    [880, 1320].forEach((f, i) => {
      const t = ctx.currentTime + i * 0.16;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + 0.32);
    });
  } catch {
    /* ignore */
  }
}

// ---------- words ----------

function dishName(d: Dish, lang: Lang) {
  return lang === 'ne' ? d.ne : d.roman;
}
function dishSub(d: Dish, t: Copy, lang: Lang) {
  return lang === 'ne' ? d.roman : t.dishes[d.id].tr;
}
function choiceText(l: Line, t: Copy): string {
  const out: string[] = [];
  if (l.style) out.push(t.styles[l.style]);
  if (l.spice) out.push(t.spiceLevels[l.spice - 1]);
  if (l.achar) out.push(`+ ${t.acharH.toLowerCase()}`);
  return out.join(' · ');
}
const clock = (now: number, lang: Lang) => num(clockLabel(now), lang);

// ---------- small pieces ----------

function Chili({ n, label }: { n: number; label: string }) {
  return (
    <span className="rq-chip rq-chip-spicy" title={label}>
      {Array.from({ length: n }, (_, i) => (
        <Icon key={i} name="chili" />
      ))}
      <span className="rq-sr">{label}</span>
    </span>
  );
}

function DietChips({ d, t, lang, full }: { d: Dish; t: Copy; lang: Lang; full?: boolean }) {
  const gf = !d.allergens.includes('A');
  return (
    <span className="rq-chips">
      {d.vegan ? (
        <span className="rq-chip rq-chip-vegan">
          <Icon name="sprout" />
          {t.vegan}
        </span>
      ) : d.veg ? (
        <span className="rq-chip rq-chip-veg">
          <Icon name="leaf" />
          {t.veg}
        </span>
      ) : null}
      {gf && (
        <span className="rq-chip rq-chip-gf">
          <Icon name="wheat" />
          {t.gf}
        </span>
      )}
      {d.spicy > 0 && <Chili n={d.spicy} label={`${t.spicy}: ${t.spiceLevels[d.spicy - 1]}`} />}
      {d.allergens && !full && (
        <span className="rq-chip rq-chip-al" title={d.allergens.split('').map((a) => t.allergens[a]).join(', ')}>
          {d.allergens.split('').join(' ')}
        </span>
      )}
    </span>
  );
}

function Qr({ text, label }: { text: string; label: string }) {
  const path = useMemo(() => {
    const qr = QRCode.create(text, { errorCorrectionLevel: 'M' });
    const n = qr.modules.size;
    let d = '';
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (qr.modules.get(y, x)) d += `M${x + 2} ${y + 2}h1v1h-1z`;
    return { d, n: n + 4 };
  }, [text]);
  return (
    <svg className="rq-qr" viewBox={`0 0 ${path.n} ${path.n}`} role="img" aria-label={label} shapeRendering="crispEdges">
      <rect width={path.n} height={path.n} fill="#fff" />
      <path d={path.d} fill="#2a1a12" />
    </svg>
  );
}

function Stepper({ value, onChange, t, lang, min = 1 }: { value: number; onChange: (n: number) => void; t: Copy; lang: Lang; min?: number }) {
  return (
    <span className="rq-stepper">
      <button type="button" onClick={() => onChange(value - 1)} disabled={value <= min} aria-label={t.less}>
        <Icon name="minus" />
      </button>
      <output aria-live="polite">{num(value, lang)}</output>
      <button type="button" onClick={() => onChange(value + 1)} disabled={value >= 9} aria-label={t.more}>
        <Icon name="plus" />
      </button>
    </span>
  );
}

function Sheet({ title, onClose, children, labelId, closeLabel, className }: { title: ReactNode; onClose: () => void; children: ReactNode; labelId: string; closeLabel: string; className?: string }) {
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
    <div className={`rq-sheet-wrap${className ? ` ${className}` : ''}`} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="rq-sheet" role="dialog" aria-modal="true" aria-labelledby={labelId} tabIndex={-1} ref={ref}>
        <div className="rq-sheet-grab" aria-hidden="true" />
        <div className="rq-sheet-head">
          <h2 id={labelId}>{title}</h2>
          <button type="button" className="rq-icon-btn" onClick={onClose} aria-label={closeLabel}>
            <Icon name="x" />
          </button>
        </div>
        <div className="rq-sheet-body">{children}</div>
      </div>
    </div>
  );
}

// ---------- the guest's phone ----------

type GuestSheet = { kind: 'dish'; id: string } | { kind: 'cart' } | { kind: 'summary' } | null;

function DishSheet({ d, s, t, lang, onAdd, onClose }: { d: Dish; s: State; t: Copy; lang: Lang; onAdd: (id: string, qty: number, c: Choice) => void; onClose: () => void }) {
  const [style, setStyle] = useState<Style>('steamed');
  const [spice, setSpice] = useState<Spice>((Math.max(1, d.spicy) as Spice) || 1);
  const [achar, setAchar] = useState(false);
  const [qty, setQty] = useState(1);
  const out = isSoldOut(s, d.id);
  return (
    <Sheet title={dishName(d, lang)} onClose={onClose} labelId="rq-dish-h" closeLabel={t.close}>
      <div className={`rq-dish-hero${out ? ' is-out' : ''}`} style={{ '--h': d.hue } as CSSProperties}>
        <FoodArt kind={d.art} hue={d.hue} className="rq-dish-art" />
      </div>
      <p className="rq-dish-sub">
        {dishSub(d, t, lang)}
        {lang !== 'ne' && (
          <span className="rq-dev" lang="ne">
            {' '}
            · {d.ne}
          </span>
        )}
      </p>
      <p className="rq-dish-desc">{t.dishes[d.id].desc}</p>
      <DietChips d={d} t={t} lang={lang} full />
      {d.allergens && (
        <p className="rq-allergens">
          <strong>{t.allergensH}:</strong> {d.allergens.split('').map((a) => `${a} ${t.allergens[a]}`).join(' · ')}
        </p>
      )}
      {out ? (
        <p className="rq-soldout-note" role="status">
          <strong>{t.soldOut}.</strong> {t.soldOutNote}
        </p>
      ) : (
        <>
          {d.styles && (
            <fieldset className="rq-opt">
              <legend>{t.styleH}</legend>
              <div className="rq-seg rq-seg-4">
                {STYLES.map((x) => (
                  <label key={x} className={style === x ? 'is-on' : ''}>
                    <input type="radio" name="rq-style" value={x} checked={style === x} onChange={() => setStyle(x)} />
                    {t.styles[x]}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          {d.spice && (
            <fieldset className="rq-opt">
              <legend>{t.spiceH}</legend>
              <div className="rq-seg">
                {([1, 2, 3] as Spice[]).map((x) => (
                  <label key={x} className={spice === x ? 'is-on' : ''}>
                    <input type="radio" name="rq-spice" value={x} checked={spice === x} onChange={() => setSpice(x)} />
                    <span className="rq-seg-chili" aria-hidden="true">
                      {Array.from({ length: x }, (_, i) => (
                        <Icon key={i} name="chili" />
                      ))}
                    </span>
                    {t.spiceLevels[x - 1]}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          {d.achar && (
            <label className="rq-toggle-row">
              <input type="checkbox" checked={achar} onChange={(e) => setAchar(e.target.checked)} />
              <span className="rq-toggle" aria-hidden="true" />
              <span>
                <strong>{t.acharH}</strong>
                <small>{t.acharSub}</small>
              </span>
            </label>
          )}
          <div className="rq-add-row">
            <span className="rq-add-q">{t.qty}</span>
            <Stepper value={qty} onChange={(n) => setQty(Math.max(1, Math.min(9, n)))} t={t} lang={lang} />
          </div>
          <button type="button" className="rq-btn rq-btn-main rq-btn-block" onClick={() => onAdd(d.id, qty, { style, spice, achar })}>
            <Icon name="plus" />
            {t.addN(num(qty, lang))}
          </button>
        </>
      )}
    </Sheet>
  );
}

function StatusSteps({ o, t, lang, now }: { o: Order; t: Copy; lang: Lang; now: number }) {
  const steps: Status[] = ['received', 'cooking', 'ready', 'served'];
  const at = steps.indexOf(o.status);
  const p = progress(o, now);
  return (
    <div className="rq-track">
      <div className="rq-track-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(p.frac * 100)} aria-label={t.statuses[o.status]}>
        <span style={{ width: `${Math.round(p.frac * 100)}%` }} />
      </div>
      <ol className="rq-steps">
        {steps.map((st, i) => (
          <li key={st} className={i < at ? 'is-done' : i === at ? 'is-now' : ''} aria-current={i === at ? 'step' : undefined}>
            <span className="rq-step-dot" aria-hidden="true">
              {i < at || (i === at && st === 'served') ? <Icon name="check" /> : num(i + 1, lang)}
            </span>
            <span className="rq-step-l">{t.statuses[st]}</span>
          </li>
        ))}
      </ol>
      <p className="rq-track-help">
        {t.statusHelp[o.status]}
        {o.status !== 'served' && <span className="rq-eta"> · {t.eta(num(p.left, lang))}</span>}
      </p>
    </div>
  );
}

function Guest({
  s,
  t,
  lang,
  framed,
  onState,
  toast,
}: {
  s: State;
  t: Copy;
  lang: Lang;
  framed: boolean;
  onState: (n: State) => void;
  toast: (text: string, tone?: ToastTone) => void;
}) {
  const [tab, setTab] = useState<'menu' | 'orders'>('menu');
  const [cat, setCat] = useState<Cat | 'all'>('all');
  const [q, setQ] = useState('');
  const [sheet, setSheet] = useState<GuestSheet>(null);
  const [cartMsg, setCartMsg] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const n = s.guestTable;
  const table = s.tables.find((x) => x.n === n)!;
  const mine = tableOrders(s, n).sort((a, b) => b.at - a.at);
  const active = mine.filter((o) => o.status !== 'served');
  const count = cartCount(s);
  const hasSoldOutInCart = s.cart.some((l) => isSoldOut(s, l.dish));

  const query = q.trim().toLowerCase();
  const shown = DISHES.filter((d) => {
    if (cat !== 'all' && d.cat !== cat) return false;
    if (!query) return true;
    const hay = [d.roman, d.ne, t.dishes[d.id].tr, t.dishes[d.id].desc, t.cats[d.cat], d.vegan ? `${t.vegan} vegan` : '', d.veg ? `${t.veg} veg` : '', d.spicy >= 2 ? `${t.spicy} spicy` : '']
      .join(' ')
      .toLowerCase();
    return hay.includes(query);
  });

  // After switching tabs, show the top of the phone again (inside the frame, or on the page).
  const toTop = () => {
    const el = scrollRef.current;
    if (!el) return;
    if (framed) {
      el.scrollTo({ top: 0 });
      return;
    }
    const y = el.getBoundingClientRect().top + window.scrollY - 70;
    if (window.scrollY > y) window.scrollTo({ top: y });
  };

  const add = (id: string, qty: number, c: Choice) => {
    const r = addToCart(s, id, qty, c);
    if (!r.ok) {
      toast(t.reasons[r.reason ?? 'unknown'], 'warn');
      return;
    }
    onState(r.state);
    setSheet(null);
    toast(t.added(dishName(dishById(id)!, lang)));
  };

  const send = () => {
    const r = sendCart(s);
    if (!r.ok) {
      setCartMsg(t.reasons[r.reason ?? 'empty']);
      return;
    }
    onState(r.state);
    setSheet(null);
    setCartMsg('');
    setTab('orders');
    toTop();
    toast(t.sent(`#${num(r.id!, lang)}`));
  };

  const bill = () => {
    if (mine.length) onState(askBill(s));
    setSheet({ kind: 'summary' });
  };

  const summary = orderSummary(s);
  const called = table.callAt != null;
  const acked = table.callAckAt != null;

  return (
    <div className="rq-g">
      <div className="rq-g-scroll" ref={scrollRef}>
        <header className="rq-g-head">
          <div className="rq-g-brand">
            <ChuloMark className="rq-g-mark" />
            <div>
              <p className="rq-g-name">{t.name}</p>
              <p className="rq-g-city">{t.city}</p>
            </div>
            <span className="rq-g-table">
              <Icon name="qr" />
              {t.table(num(n, lang))}
            </span>
          </div>
          <p className="rq-g-welcome">{t.welcome}</p>
          <p className="rq-g-note">
            <Icon name="star" />
            {t.pricesHidden}
          </p>
          <div className="rq-g-actions">
            <button type="button" className={`rq-btn rq-btn-soft${called ? ' is-on' : ''}`} onClick={() => onState(callWaiter(s))} aria-pressed={called}>
              <Icon name="bell" />
              {called ? (acked ? t.onTheWay : t.called) : t.callWaiter}
            </button>
            <button type="button" className={`rq-btn rq-btn-soft${table.billAt != null ? ' is-on' : ''}`} onClick={bill}>
              <Icon name="receipt" />
              {table.billAt != null ? t.summaryH : t.askBill}
            </button>
          </div>
          {table.billAt != null && (
            <p className="rq-g-flag" role="status">
              {t.billAsked}
            </p>
          )}
        </header>

        <div className="rq-g-tabs" role="tablist" aria-label={t.views.guest}>
          {(['menu', 'orders'] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={tab === k}
              className={tab === k ? 'is-on' : ''}
              onClick={() => {
                setTab(k);
                toTop();
              }}
            >
              {t.tabs[k]}
              {k === 'orders' && active.length > 0 && <span className="rq-badge">{num(active.length, lang)}</span>}
            </button>
          ))}
        </div>

        {tab === 'menu' && (
          <div className="rq-g-menu" role="tabpanel">
            {active[0] && (
              <button type="button" className="rq-mini-track" onClick={() => setTab('orders')}>
                <span className={`rq-dotst rq-st-${active[0].status}`} aria-hidden="true" />
                <span>
                  <strong>{t.orderNo(num(active[0].id, lang))}</strong> · {t.statuses[active[0].status]}
                </span>
                <span className="rq-mini-eta">{t.eta(num(progress(active[0], s.now).left, lang))}</span>
              </button>
            )}
            <div className="rq-g-filter">
              <label className="rq-search">
                <Icon name="search" />
                <span className="rq-sr">{t.search}</span>
                <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.searchPh} enterKeyHint="search" />
                {q && (
                  <button type="button" className="rq-search-x" onClick={() => setQ('')} aria-label={t.clearSearch}>
                    <Icon name="x" />
                  </button>
                )}
              </label>
              <div className="rq-cats" role="group" aria-label={t.search}>
                {(['all', ...CATS] as const).map((c) => (
                  <button key={c} type="button" className={cat === c ? 'is-on' : ''} aria-pressed={cat === c} onClick={() => setCat(c)}>
                    {c === 'all' ? t.allDishes : t.cats[c]}
                  </button>
                ))}
              </div>
            </div>
            {shown.length === 0 && <p className="rq-empty">{t.noResults}</p>}
            {CATS.filter((c) => shown.some((d) => d.cat === c)).map((c) => (
              <section key={c} className="rq-menu-sec" aria-labelledby={`rq-cat-${c}`}>
                <h3 id={`rq-cat-${c}`}>{t.cats[c]}</h3>
                <ul className="rq-dishes">
                  {shown
                    .filter((d) => d.cat === c)
                    .map((d) => {
                      const out = isSoldOut(s, d.id);
                      const inCart = s.cart.filter((l) => l.dish === d.id).reduce((a, l) => a + l.qty, 0);
                      return (
                        <li key={d.id}>
                          <button type="button" className={`rq-dish${out ? ' is-out' : ''}`} onClick={() => setSheet({ kind: 'dish', id: d.id })} data-dish={d.id}>
                            <span className="rq-dish-pic" style={{ '--h': d.hue } as CSSProperties}>
                              <FoodArt kind={d.art} hue={d.hue} />
                              {out && <span className="rq-out-tag">{t.soldOut}</span>}
                            </span>
                            <span className="rq-dish-txt">
                              <span className="rq-dish-name">
                                {dishName(d, lang)}
                                {d.popular && !out && (
                                  <span className="rq-pop" title={t.popular}>
                                    <Icon name="star" />
                                    <span className="rq-sr">{t.popular}</span>
                                  </span>
                                )}
                              </span>
                              <span className="rq-dish-tr">
                                {dishSub(d, t, lang)}
                                {lang !== 'ne' && (
                                  <span className="rq-dev" lang="ne">
                                    {' '}
                                    · {d.ne}
                                  </span>
                                )}
                              </span>
                              <DietChips d={d} t={t} lang={lang} />
                            </span>
                            <span className={`rq-dish-add${inCart ? ' has' : ''}`} aria-hidden="true">
                              {inCart ? num(inCart, lang) : <Icon name="plus" />}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                </ul>
              </section>
            ))}
            <p className="rq-legend-al">
              {t.allergensH}: {Object.entries(t.allergens)
                .map(([k, v]) => `${k} ${v}`)
                .join(' · ')}
            </p>
          </div>
        )}

        {tab === 'orders' && (
          <div className="rq-g-orders" role="tabpanel">
            {mine.length === 0 && <p className="rq-empty">{t.ordersEmpty}</p>}
            {mine.map((o) => (
              <article key={o.id} className={`rq-order rq-st-${o.status}`} data-order={o.id}>
                <header>
                  <h3>{t.orderNo(num(o.id, lang))}</h3>
                  <span className="rq-order-time">
                    <Icon name="clock" />
                    {clock(o.at, lang)}
                  </span>
                </header>
                <StatusSteps o={o} t={t} lang={lang} now={s.now} />
                <ul className="rq-order-lines">
                  {o.lines.map((l, i) => {
                    const d = dishById(l.dish)!;
                    return (
                      <li key={i}>
                        <span className="rq-q">{num(l.qty, lang)}×</span>
                        <span>
                          {dishName(d, lang)}
                          {choiceText(l, t) && <small>{choiceText(l, t)}</small>}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </article>
            ))}
          </div>
        )}
        <div className="rq-g-pad" aria-hidden="true" />

        {count > 0 && (
          <div className="rq-cartbar">
            <button type="button" className="rq-cartbar-btn" onClick={() => setSheet({ kind: 'cart' })}>
              <span className="rq-cartbar-n">
                <Icon name="bag" />
                {num(count, lang)}
              </span>
              <span className="rq-cartbar-l">{t.cartBar(num(count, lang))}</span>
              <span className="rq-cartbar-go">{t.cartOpen} →</span>
            </button>
          </div>
        )}
      </div>

      {sheet?.kind === 'dish' && <DishSheet key={sheet.id} d={dishById(sheet.id)!} s={s} t={t} lang={lang} onAdd={add} onClose={() => setSheet(null)} />}

      {sheet?.kind === 'cart' && (
        <Sheet title={t.cartH} onClose={() => setSheet(null)} labelId="rq-cart-h" closeLabel={t.close}>
          {s.cart.length === 0 ? (
            <p className="rq-empty">{t.cartEmpty}</p>
          ) : (
            <>
              <ul className="rq-cart">
                {s.cart.map((l, i) => {
                  const d = dishById(l.dish)!;
                  const out = isSoldOut(s, d.id);
                  return (
                    <li key={`${l.dish}-${i}`} className={out ? 'is-out' : ''}>
                      <span className="rq-cart-pic">
                        <FoodArt kind={d.art} hue={d.hue} />
                      </span>
                      <span className="rq-cart-txt">
                        <strong>{dishName(d, lang)}</strong>
                        {choiceText(l, t) && <small>{choiceText(l, t)}</small>}
                        {out && <em>{t.soldOut}</em>}
                      </span>
                      <Stepper value={l.qty} min={0} onChange={(q2) => onState(setCartQty(s, i, q2))} t={t} lang={lang} />
                    </li>
                  );
                })}
              </ul>
              <p className="rq-cart-hint">{t.cartHint}</p>
              {(cartMsg || hasSoldOutInCart) && (
                <div className="rq-cart-msg" role="alert">
                  <p>{hasSoldOutInCart ? t.reasons['sold-out'] : cartMsg}</p>
                  {hasSoldOutInCart && (
                    <button type="button" className="rq-btn rq-btn-soft" onClick={() => onState(dropSoldOut(s))}>
                      {t.removeSoldOut}
                    </button>
                  )}
                </div>
              )}
              <button type="button" className="rq-btn rq-btn-main rq-btn-block" onClick={send} disabled={hasSoldOutInCart}>
                <Icon name="chef" />
                {t.send}
              </button>
            </>
          )}
        </Sheet>
      )}

      {sheet?.kind === 'summary' && (
        <Sheet title={t.summaryH} onClose={() => setSheet(null)} labelId="rq-sum-h" closeLabel={t.close}>
          <p className="rq-sum-sub">
            {t.table(num(n, lang))} · {t.summarySub}
          </p>
          {summary.length === 0 ? (
            <p className="rq-empty">{t.summaryNone}</p>
          ) : (
            <>
              <ul className="rq-sum">
                {summary.map((l, i) => {
                  const d = dishById(l.dish)!;
                  return (
                    <li key={i}>
                      <span className="rq-q">{num(l.qty, lang)}×</span>
                      <span className="rq-sum-txt">
                        <strong>{dishName(d, lang)}</strong>
                        {choiceText(l, t) && <small>{choiceText(l, t)}</small>}
                      </span>
                      <span className="rq-sum-served">{t.summaryServed(num(l.served, lang), num(l.qty, lang))}</span>
                    </li>
                  );
                })}
              </ul>
              <p className="rq-sum-count">{t.summaryItems(num(summary.reduce((a, l) => a + l.qty, 0), lang))}</p>
              <p className="rq-sum-note">{t.summaryNote}</p>
            </>
          )}
        </Sheet>
      )}
    </div>
  );
}

// ---------- the kitchen board ----------

function Kitchen({ s, t, lang, sound, setSound, onAdvance }: { s: State; t: Copy; lang: Lang; sound: boolean; setSound: (v: boolean) => void; onAdvance: (id: number) => void }) {
  const [station, setStation] = useState<Station | 'all'>('all');
  const cols: Exclude<Status, 'served'>[] = ['received', 'cooking', 'ready'];
  const visible = (o: Order) => (station === 'all' ? o.lines : o.lines.filter((l) => dishById(l.dish)?.station === station));
  return (
    <div className="rq-k">
      <div className="rq-k-bar">
        <div className="rq-k-title">
          <span className="rq-live" aria-hidden="true" />
          <h2>{t.kitchenH}</h2>
          <span className="rq-k-clock">{clock(s.now, lang)}</span>
        </div>
        <button type="button" className={`rq-k-sound${sound ? ' is-on' : ''}`} aria-pressed={sound} onClick={() => setSound(!sound)}>
          <Icon name={sound ? 'sound' : 'mute'} />
          {sound ? t.soundOn : t.soundOff}
        </button>
      </div>
      <div className="rq-k-stations" role="group" aria-label={t.stationsLabel}>
        {(['all', ...STATIONS] as const).map((x) => (
          <button key={x} type="button" className={station === x ? 'is-on' : ''} aria-pressed={station === x} onClick={() => setStation(x)}>
            {t.stations[x]}
          </button>
        ))}
      </div>
      <p className="rq-k-hint">{t.tapHint}</p>
      <div className="rq-k-cols">
        {cols.map((c) => {
          const list = s.orders.filter((o) => o.status === c && visible(o).length > 0).sort((a, b) => a.at - b.at);
          return (
            <section key={c} className={`rq-k-col rq-k-${c}`} aria-label={t.cols[c]}>
              <header>
                <h3>{t.cols[c]}</h3>
                <span className="rq-k-count">{num(list.length, lang)}</span>
              </header>
              {list.length === 0 && <p className="rq-k-empty">{t.colEmpty}</p>}
              {list.map((o) => {
                const lines = visible(o);
                const others = o.lines.length - lines.length;
                const ck = ticketClock(o, s.now);
                const isGuest = o.table === s.guestTable;
                return (
                  <button
                    key={o.id}
                    type="button"
                    className={`rq-ticket${ck.level ? ` is-${ck.level}` : ''}${isGuest ? ' is-guest' : ''}`}
                    onClick={() => onAdvance(o.id)}
                    data-ticket={o.id}
                    aria-label={`${t.tableShort(num(o.table, lang))} #${num(o.id, lang)} · ${t.mins(num(ck.mins, lang))} · ${t.go[c]}`}
                  >
                    <span className="rq-ticket-top">
                      <span className="rq-ticket-t">{t.tableShort(num(o.table, lang))}</span>
                      {isGuest && <span className="rq-ticket-you">{t.you}</span>}
                      <span className="rq-ticket-no">#{num(o.id, lang)}</span>
                      <span className="rq-ticket-clock">
                        <Icon name="clock" />
                        {t.mins(num(ck.mins, lang))}
                      </span>
                    </span>
                    <span className="rq-ticket-lines">
                      {lines.map((l, i) => {
                        const d = dishById(l.dish)!;
                        return (
                          <span key={i} className={`rq-tl rq-tl-${d.station}`}>
                            <b>{num(l.qty, lang)}×</b> {dishName(d, lang)}
                            {choiceText(l, t) && <small>{choiceText(l, t)}</small>}
                          </span>
                        );
                      })}
                      {others > 0 && <span className="rq-tl-other">{t.other(num(others, lang))}</span>}
                    </span>
                    <span className="rq-ticket-go">{t.go[c]}</span>
                  </button>
                );
              })}
            </section>
          );
        })}
      </div>
    </div>
  );
}

// ---------- the waiter & owner ----------

const STATUS_ICON: Record<TableStatus, IconName> = { free: 'check', ordering: 'phone', waiting: 'clock', eating: 'leaf', bill: 'receipt' };

function Waiter({
  s,
  t,
  lang,
  onState,
  onAdvance,
  onPrint,
  toast,
}: {
  s: State;
  t: Copy;
  lang: Lang;
  onState: (n: State) => void;
  onAdvance: (id: number) => void;
  onPrint: () => void;
  toast: (text: string, tone?: ToastTone) => void;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const td = today(s);
  const maxTop = Math.max(1, ...td.top.map((x) => x.count));
  const ready = s.orders.filter((o) => o.status === 'ready').sort((a, b) => (a.readyAt ?? 0) - (b.readyAt ?? 0));
  const alerts = s.tables.filter((x) => callActive(x) || x.billAt != null);
  const sel = open != null ? s.tables.find((x) => x.n === open) : undefined;

  const toggle = (id: string) => {
    const next = toggleSoldOut(s, id);
    onState(next);
    const d = dishById(id)!;
    toast(next.soldOut.includes(id) ? t.soldOutToast(dishName(d, lang)) : t.backToast(dishName(d, lang)), next.soldOut.includes(id) ? 'warn' : 'ok');
  };

  return (
    <div className="rq-w">
      <section className="rq-w-block" aria-labelledby="rq-alerts-h">
        <h3 id="rq-alerts-h">
          <Icon name="bell" />
          {t.alertsH}
        </h3>
        {alerts.length === 0 ? (
          <p className="rq-w-none">{t.alertsNone}</p>
        ) : (
          <ul className="rq-alerts">
            {alerts.map((x) => {
              const calling = callActive(x);
              return (
                <li key={x.n} className={calling ? 'is-call' : 'is-bill'} data-alert={x.n}>
                  <Icon name={calling ? 'bell' : 'receipt'} />
                  <span>
                    <strong>{t.tableH(num(x.n, lang))}</strong>
                    {x.n === s.guestTable && <span className="rq-you-tag">{t.you}</span>} · {calling ? t.calling : t.wantsBill}
                    <small> · {t.mins(num(minsSince(s.now, calling ? x.callAt : x.billAt), lang))}</small>
                  </span>
                  <button type="button" className="rq-btn rq-btn-sm" onClick={() => onState(calling ? ackCall(s, x.n) : clearTable(s, x.n))}>
                    {calling ? t.ack : t.clearTable}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rq-w-block" aria-labelledby="rq-floor-h">
        <h3 id="rq-floor-h">
          <Icon name="grid" />
          {t.floorH}
        </h3>
        <p className="rq-w-sub">{t.floorSub}</p>
        <div className="rq-floor">
          <span className="rq-floor-lbl rq-floor-window">{t.window}</span>
          <div className="rq-floor-grid">
            {s.tables.map((x) => {
              const st = tableStatus(s, x.n);
              const calling = callActive(x);
              return (
                <button
                  key={x.n}
                  type="button"
                  className={`rq-tbl rq-ts-${st}${calling ? ' is-call' : ''}${x.n === s.guestTable ? ' is-you' : ''} rq-seats-${x.seats}`}
                  onClick={() => setOpen(x.n)}
                  data-table={x.n}
                  data-status={st}
                  aria-label={`${t.tableH(num(x.n, lang))}: ${t.status[st]}${calling ? `, ${t.calling}` : ''}`}
                >
                  <span className="rq-tbl-n">{num(x.n, lang)}</span>
                  <span className="rq-tbl-seats" aria-hidden="true">
                    {Array.from({ length: x.seats }, (_, i) => (
                      <i key={i} className={i < (st === 'free' ? 0 : x.guests) ? 'on' : ''} />
                    ))}
                  </span>
                  <span className="rq-tbl-st">
                    <Icon name={STATUS_ICON[st]} />
                    {t.status[st]}
                  </span>
                  {x.n === s.guestTable && <span className="rq-tbl-you">{t.you}</span>}
                  {calling && (
                    <span className="rq-tbl-alert" aria-hidden="true">
                      <Icon name="bell" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="rq-floor-foot">
            <span className="rq-floor-lbl">{t.door}</span>
            <span className="rq-floor-lbl">{t.pass}</span>
            <span className="rq-floor-lbl">{t.bar}</span>
          </div>
        </div>
        <ul className="rq-legend">
          {(['free', 'ordering', 'waiting', 'eating', 'bill'] as TableStatus[]).map((k) => (
            <li key={k} className={`rq-ts-${k}`}>
              <i aria-hidden="true" />
              {t.status[k]}
            </li>
          ))}
          <li className="is-call">
            <i aria-hidden="true" />
            {t.calling}
          </li>
        </ul>
      </section>

      <section className="rq-w-block" aria-labelledby="rq-ready-h">
        <h3 id="rq-ready-h">
          <Icon name="chef" />
          {t.readyH}
        </h3>
        {ready.length === 0 ? (
          <p className="rq-w-none">{t.readyNone}</p>
        ) : (
          <ul className="rq-ready">
            {ready.map((o) => (
              <li key={o.id}>
                <span>
                  <strong>{t.tableH(num(o.table, lang))}</strong> · #{num(o.id, lang)}
                  <small>{o.lines.map((l) => `${num(l.qty, lang)}× ${dishName(dishById(l.dish)!, lang)}`).join(', ')}</small>
                </span>
                <button type="button" className="rq-btn rq-btn-sm rq-btn-main" onClick={() => onAdvance(o.id)}>
                  {t.serve}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rq-w-block" aria-labelledby="rq-today-h">
        <h3 id="rq-today-h">
          <Icon name="chart" />
          {t.todayH}
        </h3>
        <div className="rq-kpis">
          <div>
            <strong>{num(td.orders, lang)}</strong>
            <span>{t.kOrders}</span>
          </div>
          <div>
            <strong>{num(td.dishes, lang)}</strong>
            <span>{t.kDishes}</span>
          </div>
          <div>
            <strong>{t.kPrepVal(num(td.avgPrep, lang))}</strong>
            <span>{t.kPrep}</span>
          </div>
        </div>
        <h4>{t.topH}</h4>
        <ol className="rq-best">
          {td.top.map((x) => (
            <li key={x.dish}>
              <span className="rq-best-name">{dishName(dishById(x.dish)!, lang)}</span>
              <span className="rq-best-bar" aria-hidden="true">
                <span style={{ width: `${Math.round((x.count / maxTop) * 100)}%` }} />
              </span>
              <span className="rq-best-n">{num(x.count, lang)}</span>
            </li>
          ))}
        </ol>
        <p className="rq-w-sub">{t.countsNote}</p>
      </section>

      <section className="rq-w-block" aria-labelledby="rq-menu-h">
        <h3 id="rq-menu-h">
          <Icon name="leaf" />
          {t.menuH}
        </h3>
        <p className="rq-w-sub">{t.menuSub}</p>
        <ul className="rq-avail">
          {DISHES.map((d) => {
            const out = isSoldOut(s, d.id);
            return (
              <li key={d.id} className={out ? 'is-out' : ''}>
                <span className="rq-avail-name">
                  {dishName(d, lang)}
                  <small>{t.cats[d.cat]}</small>
                </span>
                <button type="button" role="switch" aria-checked={!out} className="rq-switch" onClick={() => toggle(d.id)} data-avail={d.id}>
                  <span className="rq-switch-knob" aria-hidden="true" />
                  <span className="rq-switch-l">{out ? t.soldOut : t.available}</span>
                  <span className="rq-sr"> — {dishName(d, lang)}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <button type="button" className="rq-btn rq-btn-main rq-btn-block" onClick={onPrint}>
          <Icon name="print" />
          {t.printBtn}
        </button>
      </section>

      {sel && (
        <Sheet title={t.tableH(num(sel.n, lang))} onClose={() => setOpen(null)} labelId="rq-tbl-h" closeLabel={t.close} className="is-modal">
          {(() => {
            const st = tableStatus(s, sel.n);
            const orders = tableOrders(s, sel.n).sort((a, b) => a.at - b.at);
            return (
              <>
                <p className={`rq-tbl-status rq-ts-${st}`}>
                  <i aria-hidden="true" />
                  {t.status[st]}
                  {st !== 'free' && ` · ${t.guests(num(sel.guests, lang))}`} · {t.seats(num(sel.seats, lang))}
                  {sel.n === s.guestTable && <span className="rq-you-tag">{t.you}</span>}
                </p>
                {callActive(sel) && (
                  <div className="rq-tbl-call">
                    <Icon name="bell" />
                    <span>{t.calling}</span>
                    <button type="button" className="rq-btn rq-btn-sm" onClick={() => onState(ackCall(s, sel.n))}>
                      {t.ack}
                    </button>
                  </div>
                )}
                {orders.length === 0 ? (
                  <p className="rq-empty">{t.noOrders}</p>
                ) : (
                  <ul className="rq-tbl-orders">
                    {orders.map((o) => (
                      <li key={o.id}>
                        <span className="rq-tbl-o-head">
                          <strong>#{num(o.id, lang)}</strong>
                          <span className={`rq-pill rq-st-${o.status}`}>{t.statuses[o.status]}</span>
                          {o.status === 'ready' && (
                            <button type="button" className="rq-btn rq-btn-sm rq-btn-main" onClick={() => onAdvance(o.id)}>
                              {t.serve}
                            </button>
                          )}
                        </span>
                        <small>{o.lines.map((l) => `${num(l.qty, lang)}× ${dishName(dishById(l.dish)!, lang)}`).join(', ')}</small>
                      </li>
                    ))}
                  </ul>
                )}
                {st !== 'free' && (
                  <button
                    type="button"
                    className="rq-btn rq-btn-soft rq-btn-block"
                    onClick={() => {
                      onState(clearTable(s, sel.n));
                      setOpen(null);
                    }}
                  >
                    {t.clearTable}
                  </button>
                )}
              </>
            );
          })()}
        </Sheet>
      )}
    </div>
  );
}

function PrintSheet({ t, lang, onClose, fontClass }: { t: Copy; lang: Lang; onClose: () => void; fontClass: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current();
    document.addEventListener('keydown', onKey);
    document.documentElement.classList.add('rq-printing');
    return () => {
      document.removeEventListener('keydown', onKey);
      document.documentElement.classList.remove('rq-printing');
      prev?.focus?.({ preventScroll: true });
    };
  }, []);
  return createPortal(
    <div className={`rq-print rq-print-root ${fontClass}`} role="dialog" aria-modal="true" aria-labelledby="rq-print-h" tabIndex={-1} ref={ref} translate="no" lang={lang}>
      <div className="rq-print-bar">
        <div>
          <h2 id="rq-print-h">{t.printH}</h2>
          <p>{t.printSub}</p>
        </div>
        <div className="rq-print-btns">
          <button type="button" className="rq-btn rq-btn-main" onClick={() => window.print()}>
            <Icon name="print" />
            {t.printNow}
          </button>
          <button type="button" className="rq-btn rq-btn-soft" onClick={onClose}>
            {t.close}
          </button>
        </div>
      </div>
      <ul className="rq-print-grid">
        {Array.from({ length: TABLE_COUNT }, (_, i) => i + 1).map((n) => (
          <li key={n} className="rq-print-card">
            <span className="rq-print-brand">
              <ChuloMark className="rq-print-mark" />
              {t.name}
            </span>
            <strong className="rq-print-t">{t.table(num(n, lang))}</strong>
            <Qr text={`${QR_BASE}${n}`} label={t.tableQr(num(n, lang))} />
            <span className="rq-print-scan">{t.scanToOrder}</span>
            <span className="rq-print-url">martnepali.com/work/restaurant?table={n}</span>
          </li>
        ))}
      </ul>
    </div>,
    document.body
  );
}

// ---------- the whole demo ----------

type ToastTone = 'ok' | 'info' | 'warn';
type Toast = { id: number; text: string; tone: ToastTone };
const VIEWS: View[] = ['guest', 'kitchen', 'waiter', 'all'];
const VIEW_ICON: Record<View, IconName> = { guest: 'phone', kitchen: 'chef', waiter: 'grid', all: 'columns' };

export default function RestaurantDemo({ initialLang, fontClass = '' }: { initialLang: Lang; fontClass?: string }) {
  const [s, setS] = useState<State | null>(null);
  const sRef = useRef<State | null>(null);
  const [view, setView] = useState<View>('guest');
  const [wide, setWide] = useState(false);
  const [roomy, setRoomy] = useState(false);
  const [sound, setSound] = useState(true);
  const [printing, setPrinting] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);
  const soundRef = useRef(sound);
  soundRef.current = sound;
  const visitRef = useRef(0);

  const lang: Lang = s?.lang ?? initialLang;
  const t = COPY[lang];

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

  // Start: stored evening (or a fresh one), ?table= from a scanned QR code, ?view=.
  useEffect(() => {
    let st = normalize(loadRaw(), initialLang);
    const params = new URLSearchParams(window.location.search);
    const tbl = Number(params.get('table'));
    let v: View | null = null;
    if (Number.isInteger(tbl) && tbl >= 1 && tbl <= TABLE_COUNT) {
      st = switchGuestTable(st, tbl);
      v = 'guest';
    }
    const pv = params.get('view');
    if (pv && (VIEWS as string[]).includes(pv)) v = pv as View;
    visitRef.current = st.visit;
    commit(st);
    const mqWide = window.matchMedia('(min-width: 1180px)');
    const mqRoomy = window.matchMedia('(min-width: 720px)');
    const onMq = () => {
      setWide(mqWide.matches);
      setRoomy(mqRoomy.matches);
    };
    onMq();
    setView(v ?? (mqWide.matches ? 'all' : 'guest'));
    mqWide.addEventListener('change', onMq);
    mqRoomy.addEventListener('change', onMq);
    return () => {
      mqWide.removeEventListener('change', onMq);
      mqRoomy.removeEventListener('change', onMq);
    };
  }, [initialLang, commit]);

  // The evening runs: one tick a second while the tab is visible.
  useEffect(() => {
    if (!s) return;
    let last = performance.now();
    const id = setInterval(() => {
      const nowMs = performance.now();
      const dt = nowMs - last;
      last = nowMs;
      const cur = sRef.current;
      if (!cur || document.hidden) return;
      const r = tick(cur, dt);
      commit(r.state);
      const tt = COPY[r.state.lang];
      for (const e of r.events) {
        if (e.kind === 'order' && soundRef.current) chime();
        if (e.kind === 'status' && e.table === r.state.guestTable && e.status !== 'received') {
          const o = r.state.orders.find((x) => x.id === e.id);
          const d = o && dishById(o.lines[0].dish);
          if (d) toast(tt.statusToast(dishName(d, r.state.lang), tt.statuses[e.status]), 'info');
        }
      }
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s === null]);

  // The waiter cleared the visitor's table: say so on the phone.
  useEffect(() => {
    if (!s) return;
    if (s.visit !== visitRef.current) {
      const was = visitRef.current;
      visitRef.current = s.visit;
      if (was) toast(COPY[s.lang].newVisit, 'info');
    }
  }, [s, toast]);

  const onAdvance = useCallback(
    (id: number) => {
      const cur = sRef.current;
      if (!cur) return;
      if (soundRef.current) bump();
      commit(advance(cur, id));
    },
    [commit]
  );
  const onState = useCallback((next: State) => commit(next), [commit]);

  const reset = () => {
    const fresh = normalize(null, lang);
    visitRef.current = fresh.visit;
    commit(fresh);
    toast(COPY[lang].resetDone, 'info');
  };

  const eff: View = view === 'all' && !wide ? 'guest' : view;
  const framed = eff === 'all' || (eff === 'guest' && roomy);
  const views = wide ? VIEWS : VIEWS.filter((v) => v !== 'all');

  return (
    <div className={`rq rq-v-${eff}`} lang={lang} translate="no">
      <div className="rq-top">
        <div className="rq-top-in">
          <div className="rq-brand">
            <ChuloMark className="rq-brand-mark" />
            <div>
              <p className="rq-brand-name">
                {t.name} <span>· {t.city}</span>
              </p>
              <p className="rq-brand-tag">{t.tagline}</p>
            </div>
          </div>
          <div className="rq-top-tools">
            <span className="rq-clock" title={t.fast}>
              <span className="rq-live" aria-hidden="true" />
              {s ? t.clock(clock(s.now, lang)) : t.clock('18:47')}
            </span>
            <div className="rq-langs" role="group" aria-label={t.langLabel}>
              {LANGS.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  className={lang === l.id ? 'is-on' : ''}
                  aria-pressed={lang === l.id}
                  lang={l.id}
                  data-lang={l.id}
                  onClick={() => s && commit({ ...s, lang: l.id })}
                >
                  {l.label}
                </button>
              ))}
            </div>
            <button type="button" className="rq-reset" onClick={reset} disabled={!s}>
              <Icon name="reset" />
              {t.reset}
            </button>
          </div>
        </div>
        <p className="rq-made-up">
          {t.madeUp} · {t.fast}
        </p>
        <div className="rq-views" role="tablist" aria-label={t.viewsLabel}>
          {views.map((v) => (
            <button key={v} type="button" role="tab" aria-selected={eff === v} className={eff === v ? 'is-on' : ''} onClick={() => setView(v)} data-view={v}>
              <Icon name={VIEW_ICON[v]} />
              <span className="rq-v-long">{t.views[v]}</span>
              <span className="rq-v-short">{t.viewsShort[v]}</span>
            </button>
          ))}
        </div>
      </div>

      {!s ? (
        <div className="rq-loading" aria-busy="true">
          <div className="rq-skel" />
          <div className="rq-skel" />
          <div className="rq-skel" />
        </div>
      ) : (
        <div className="rq-stage">
          {(eff === 'guest' || eff === 'all') && (
            <section className="rq-panel rq-panel-guest" aria-label={t.views.guest}>
              {eff === 'all' && (
                <p className="rq-panel-l">
                  <Icon name="phone" />
                  {t.views.guest} · {t.table(num(s.guestTable, lang))}
                </p>
              )}
              <div className={`rq-phone${framed ? ' is-framed' : ''}`}>
                {framed && <span className="rq-phone-notch" aria-hidden="true" />}
                <Guest s={s} t={t} lang={lang} framed={framed} onState={onState} toast={toast} />
              </div>
              {eff === 'guest' && <p className="rq-scanned">{t.scanned(num(s.guestTable, lang))}</p>}
            </section>
          )}
          {(eff === 'kitchen' || eff === 'all') && (
            <section className="rq-panel rq-panel-kitchen" aria-label={t.views.kitchen}>
              {eff === 'all' && (
                <p className="rq-panel-l">
                  <Icon name="chef" />
                  {t.views.kitchen}
                </p>
              )}
              <Kitchen s={s} t={t} lang={lang} sound={sound} setSound={setSound} onAdvance={onAdvance} />
            </section>
          )}
          {(eff === 'waiter' || eff === 'all') && (
            <section className="rq-panel rq-panel-waiter" aria-label={t.views.waiter}>
              {eff === 'all' && (
                <p className="rq-panel-l">
                  <Icon name="grid" />
                  {t.views.waiter}
                </p>
              )}
              <Waiter s={s} t={t} lang={lang} onState={onState} onAdvance={onAdvance} onPrint={() => setPrinting(true)} toast={toast} />
            </section>
          )}
        </div>
      )}

      <div className="rq-toasts" aria-live="polite" role="status">
        {toasts.map((x) => (
          <p key={x.id} className={`rq-toast is-${x.tone}`}>
            {x.text}
          </p>
        ))}
      </div>

      {printing && <PrintSheet t={t} lang={lang} onClose={() => setPrinting(false)} fontClass={fontClass} />}
    </div>
  );
}
