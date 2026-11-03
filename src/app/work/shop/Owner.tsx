'use client';

// The owner's side of "Dhaka & Dal": KPI counts, charts, the orders table with
// the status flow and a pickup-code scan, stock with reorder levels and a
// restock reminder (CSV export), customers (first name + initial only) and the
// product editor. Every number is a count — no money anywhere. Rules in
// shop.ts, charts in charts.tsx, words in content.ts.

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ART_HEX, Icon, ProductArt } from './art';
import { BarList, ChartCard, DailyChart, DailyLegend, DailyTable, Heatmap } from './charts';
import {
  ART_NAMES,
  CAT_NAMES,
  COLOR_NAMES,
  actionText,
  count,
  customerName,
  dayLabel,
  hhmm,
  num,
  productName,
  rangeText,
  sizeLabel,
  statusText,
  type Copy,
  type Lang,
} from './content';
import {
  ART_COLORS,
  ART_KINDS,
  CATS,
  FLOW,
  RANGES,
  RUSH_DAYS,
  TABS,
  bulkMove,
  categoryShare,
  customerRows,
  dailySeries,
  draftProblems,
  festivalsBetween,
  heatmap,
  inRange,
  itemCount,
  kpis,
  nextReadyPickup,
  nextStatus,
  productFromDraft,
  removeProduct,
  restockList,
  scanCode,
  setStock,
  setThreshold,
  stockLevel,
  toCsv,
  topProducts,
  upsertProduct,
  type CatId,
  type Draft,
  type Order,
  type Product,
  type Range,
  type Status,
  type Tab,
  type Theme,
} from './shop';

export type LiveState = 'on' | 'paused' | 'done';

export type OwnerProps = {
  t: Copy;
  lang: Lang;
  products: Product[];
  orders: Order[];
  clock: { today: number; nowMin: number } | null;
  range: Range;
  setRange: (r: Range) => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
  sound: boolean;
  toggleSound: () => void;
  tab: Tab;
  setTab: (t: Tab) => void;
  moveOrders: (ids: string[], to: Status) => void;
  setProducts: (fn: (p: Product[]) => Product[]) => void;
  toast: (s: string) => void;
  focusOrder: string | null;
  clearFocus: () => void;
  live: LiveState;
  goShop: (cat: CatId) => void;
  reduce: boolean;
};

function orderTime(o: Order, today: number, t: Copy, lang: Lang): string {
  const tm = hhmm(o.min, lang);
  if (o.day === today) return tm;
  if (o.day === today - 1) return `${t.yesterday} ${tm}`;
  return `${dayLabel(o.day, lang, { day: 'numeric', month: 'short' })} ${tm}`;
}
function whoText(o: Order, t: Copy, lang: Lang): string {
  return customerName(o.cust, lang, t.you, o.name);
}
function linesText(o: Order, products: Product[], lang: Lang): string {
  return o.lines
    .map((l) => {
      const p = products.find((x) => x.id === l.p);
      const v = p?.variants.find((x) => x.id === l.v);
      return `${num(l.q, lang)}× ${productName(p, l.p, lang)}${v ? ` ${sizeLabel(v.size, lang)}` : ''}`;
    })
    .join(', ');
}

function StatusChip({ o, t }: { o: Order; t: Copy }) {
  return (
    <span className={`dd-st dd-st-${o.status}`}>
      <i aria-hidden="true" />
      {statusText(t, o.status, o.kind)}
    </span>
  );
}

export default function Owner(props: OwnerProps) {
  const { t, lang, clock, range, setRange, theme, setTheme, sound, toggleSound, tab, setTab, live } = props;
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const onTabKey = (e: React.KeyboardEvent, i: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const next = TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length];
    setTab(next);
    tabRefs.current[next]?.focus();
  };
  return (
    <div className="dd-owner" data-theme={theme}>
      <div className="dd-owner-head">
        <div>
          <h2 className="dd-owner-h">{t.ownerH}</h2>
          <p className="dd-owner-sub">{clock ? t.ownerSub(dayLabel(clock.today, lang, { weekday: 'long', day: 'numeric', month: 'long' })) : ' '}</p>
        </div>
        <div className="dd-owner-ctrls">
          <div className="dd-seg" role="group" aria-label={t.rangeLabel}>
            <span className="dd-seg-label" aria-hidden="true">
              {t.rangeLabel}
            </span>
            {RANGES.map((r) => (
              <button key={r} type="button" aria-pressed={range === r} onClick={() => setRange(r)}>
                {rangeText(t, r, lang)}
              </button>
            ))}
          </div>
          <div className="dd-seg" role="group" aria-label={t.themeLabel}>
            {(['dark', 'light'] as Theme[]).map((x) => (
              <button key={x} type="button" aria-pressed={theme === x} onClick={() => setTheme(x)}>
                <Icon name={x === 'dark' ? 'moon' : 'sun'} size={15} /> {t.themes[x]}
              </button>
            ))}
          </div>
          <button type="button" className="dd-chipbtn" aria-pressed={sound} onClick={toggleSound}>
            <Icon name={sound ? 'sound' : 'mute'} size={16} /> {sound ? t.soundOn : t.soundOff}
          </button>
        </div>
      </div>
      <p className={`dd-live dd-live-${live}`}>
        <Icon name="live" size={16} /> {live === 'on' ? t.live : live === 'paused' ? t.livePaused : t.liveDone}
      </p>

      <div className="dd-tabs" role="tablist" aria-label={t.tabsLabel}>
        {TABS.map((x, i) => (
          <button
            key={x}
            ref={(el) => {
              tabRefs.current[x] = el;
            }}
            type="button"
            role="tab"
            id={`dd-tab-${x}`}
            aria-selected={tab === x}
            aria-controls={`dd-panel-${x}`}
            tabIndex={tab === x ? 0 : -1}
            onClick={() => setTab(x)}
            onKeyDown={(e) => onTabKey(e, i)}
          >
            {t.tabs[x]}
          </button>
        ))}
      </div>

      <div className="dd-panel" role="tabpanel" id={`dd-panel-${tab}`} aria-labelledby={`dd-tab-${tab}`}>
        {!clock ? (
          <p className="dd-loading">{t.loading}</p>
        ) : tab === 'overview' ? (
          <Overview {...props} clock={clock} />
        ) : tab === 'orders' ? (
          <OrdersTab {...props} clock={clock} />
        ) : tab === 'stock' ? (
          <StockTab {...props} clock={clock} />
        ) : tab === 'customers' ? (
          <CustomersTab {...props} clock={clock} />
        ) : (
          <ProductsTab {...props} />
        )}
      </div>
    </div>
  );
}

type WithClock = OwnerProps & { clock: { today: number; nowMin: number } };

// ---------------------------------------------------------------- overview

function Kpi({ label, value, sub, onClick, go = '', tone }: { label: string; value: string; sub: string; onClick?: () => void; go?: string; tone?: 'warn' }) {
  const inner = (
    <>
      <span className="dd-kpi-label">{label}</span>
      <span className="dd-kpi-value">{value}</span>
      <span className="dd-kpi-sub">
        {tone === 'warn' && <Icon name="alert" size={14} />} {sub}
      </span>
    </>
  );
  return onClick ? (
    <button type="button" className={`dd-kpi${tone ? ` is-${tone}` : ''}`} onClick={onClick} aria-label={`${label}: ${value}. ${sub}. ${go}`}>
      {inner}
    </button>
  ) : (
    <div className={`dd-kpi${tone ? ` is-${tone}` : ''}`}>{inner}</div>
  );
}

function Overview({ t, lang, orders, products, clock, range, setTab }: WithClock) {
  const { today, nowMin } = clock;
  const k = useMemo(() => kpis(orders, products, today, nowMin, range), [orders, products, today, nowMin, range]);
  const daily = useMemo(() => dailySeries(orders, today, range), [orders, today, range]);
  const fests = useMemo(() => festivalsBetween(today - range, today), [today, range]);
  const ahead = useMemo(() => festivalsBetween(today, today + RUSH_DAYS)[0] ?? null, [today]);
  const top = useMemo(() => topProducts(orders, today, range, 8), [orders, today, range]);
  const cats = useMemo(() => categoryShare(orders, products, today, range), [orders, products, today, range]);
  const heat = useMemo(() => heatmap(orders, today, range), [orders, today, range]);
  const latest = useMemo(() => [...orders].reverse().slice(0, 7), [orders]);
  const rN = num(range, lang);
  return (
    <div className="dd-overview">
      <div className="dd-kpis">
        <Kpi label={t.kOrdersToday} value={num(k.ordersToday, lang)} sub={t.kOrdersTodaySub(num(k.ordersLastWeek, lang))} onClick={() => setTab('orders')} go={t.kGo} />
        <Kpi label={t.kItems} value={count(k.itemsSold, lang)} sub={`${rangeText(t, range, lang)} · ${t.kItemsSub(count(k.itemsPrev, lang))}`} />
        <Kpi label={t.kReturning} value={`${num(k.returningPct, lang)} %`} sub={t.kReturningSub(count(k.returning, lang), count(k.customers, lang))} onClick={() => setTab('customers')} go={t.kGo} />
        <Kpi label={t.kPickups} value={num(k.pickupsWaiting, lang)} sub={t.kPickupsSub} onClick={() => setTab('orders')} go={t.kGo} />
        <Kpi label={t.kLow} value={num(k.lowStock, lang)} sub={t.kLowSub} onClick={() => setTab('stock')} go={t.kGo} tone={k.lowStock > 0 ? 'warn' : undefined} />
      </div>

      <div className="dd-ov-grid">
        <ChartCard
          id="dd-c-daily"
          className="dd-ov-daily"
          title={t.cDaily}
          sub={t.cDailySub(rN)}
          t={t}
          legend={<DailyLegend t={t} />}
          table={<DailyTable points={daily} today={today} t={t} lang={lang} />}
        >
          <DailyChart points={daily} fests={fests} ahead={ahead} today={today} t={t} lang={lang} />
          <p className="dd-chart-note">{t.festNote}</p>
        </ChartCard>

        <section className="dd-card dd-ov-latest" aria-labelledby="dd-latest-h">
          <header className="dd-chart-head">
            <h3 id="dd-latest-h">{t.latest}</h3>
            <button type="button" className="dd-linkbtn" onClick={() => setTab('orders')}>
              {t.allOrders}
            </button>
          </header>
          <ul className="dd-latest">
            {latest.map((o) => (
              <li key={o.id} className={o.src === 'you' ? 'is-you' : undefined}>
                <span className="dd-latest-code">{o.code}</span>
                <span className="dd-latest-who">
                  {whoText(o, t, lang)}
                  <small>
                    {orderTime(o, today, t, lang)} · {itemCount(o) === 1 ? t.item1 : t.items(num(itemCount(o), lang))}
                  </small>
                </span>
                <StatusChip o={o} t={t} />
              </li>
            ))}
          </ul>
        </section>

        <ChartCard
          id="dd-c-top"
          className="dd-ov-half"
          title={t.cTop}
          sub={t.cTopSub(rN)}
          t={t}
          table={
            <table>
              <thead>
                <tr>
                  <th scope="col">{t.thProduct}</th>
                  <th scope="col" className="num">
                    {t.thItems}
                  </th>
                </tr>
              </thead>
              <tbody>
                {top.map((r) => (
                  <tr key={r.p}>
                    <th scope="row">{productName(products.find((p) => p.id === r.p), r.p, lang)}</th>
                    <td className="num">{num(r.q, lang)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          }
        >
          <BarList lang={lang} label={t.cTop} rows={top.map((r) => ({ key: r.p, label: productName(products.find((p) => p.id === r.p), r.p, lang), value: r.q }))} />
        </ChartCard>

        <ChartCard
          id="dd-c-cat"
          className="dd-ov-half"
          title={t.cCat}
          sub={t.cCatSub(rN)}
          t={t}
          table={
            <table>
              <thead>
                <tr>
                  <th scope="col">{t.thCat}</th>
                  <th scope="col" className="num">
                    {t.thItems}
                  </th>
                  <th scope="col" className="num">
                    {t.thShare}
                  </th>
                </tr>
              </thead>
              <tbody>
                {cats.map((r) => (
                  <tr key={r.cat}>
                    <th scope="row">{CAT_NAMES[r.cat][lang]}</th>
                    <td className="num">{num(r.q, lang)}</td>
                    <td className="num">{num(r.pct, lang)} %</td>
                  </tr>
                ))}
              </tbody>
            </table>
          }
        >
          <BarList lang={lang} label={t.cCat} rows={cats.map((r) => ({ key: r.cat, label: CAT_NAMES[r.cat][lang], value: r.q, text: `${num(r.pct, lang)} %` }))} />
        </ChartCard>

        <ChartCard id="dd-c-heat" className="dd-ov-heat" title={t.cHeat} sub={t.cHeatSub(rN)} t={t}>
          <Heatmap grid={heat.grid} max={heat.max} t={t} lang={lang} />
        </ChartCard>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- orders

type OSort = 'new' | 'old' | 'items';
const PAGE = 30;

function OrdersTab({ t, lang, orders, products, clock, range, moveOrders, toast, focusOrder, clearFocus, reduce }: WithClock) {
  const { today } = clock;
  const [q, setQ] = useState('');
  const [st, setSt] = useState<Status | 'all'>('all');
  const [sort, setSort] = useState<OSort>('new');
  const [limit, setLimit] = useState(PAGE);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [flash, setFlash] = useState<string | null>(null);

  // An order sent from the shop: show it at the top and light it up.
  useEffect(() => {
    if (!focusOrder) return;
    setQ('');
    setSt('all');
    setSort('new');
    setFlash(focusOrder);
    clearFocus();
    const id = window.setTimeout(() => {
      document.getElementById(`dd-o-${focusOrder}`)?.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
    }, 60);
    const off = window.setTimeout(() => setFlash(null), 4000);
    return () => {
      window.clearTimeout(id);
      window.clearTimeout(off);
    };
  }, [focusOrder, clearFocus, reduce]);

  const inR = useMemo(() => orders.filter((o) => inRange(o, today, range)), [orders, today, range]);
  const counts = useMemo(() => {
    const c: Record<Status | 'all', number> = { all: inR.length, new: 0, packed: 0, ready: 0, collected: 0 };
    for (const o of inR) c[o.status]++;
    return c;
  }, [inR]);
  const list = useMemo(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    let l = inR.filter((o) => st === 'all' || o.status === st);
    if (words.length)
      l = l.filter((o) => {
        const hay = `${o.code} ${whoText(o, t, lang)} ${linesText(o, products, lang)} ${o.lines.map((x) => productName(products.find((p) => p.id === x.p), x.p, 'en')).join(' ')}`.toLowerCase();
        return words.every((w) => hay.includes(w));
      });
    if (sort === 'new') l = [...l].reverse();
    else if (sort === 'items') l = [...l].sort((a, b) => itemCount(b) - itemCount(a) || b.day - a.day || b.min - a.min);
    return l;
  }, [inR, st, q, sort, t, lang, products]);
  const shown = list.slice(0, limit);
  const allSel = shown.length > 0 && shown.every((o) => sel.has(o.id));

  const move = (o: Order) => {
    const to = nextStatus(o.status);
    if (!to) return;
    moveOrders([o.id], to);
    toast(t.moved(o.code, statusText(t, to, o.kind)));
  };
  const bulk = (to: Status) => {
    const r = bulkMove(orders, [...sel], to);
    if (r.moved.length) moveOrders(r.moved, to);
    toast(t.bulkDone(num(r.moved.length, lang), num(r.skipped.length, lang)));
    setSel(new Set());
  };

  return (
    <div className="dd-orders">
      <ScanPanel t={t} lang={lang} orders={orders} moveOrders={moveOrders} reduce={reduce} />

      <section className="dd-card" aria-labelledby="dd-orders-h">
        <header className="dd-chart-head">
          <div>
            <h3 id="dd-orders-h">{t.ordersH}</h3>
            <p className="dd-chart-sub">{t.ordersSub(num(range, lang))}</p>
          </div>
        </header>
        <div className="dd-otools">
          <div className="dd-search dd-search-sm">
            <label htmlFor="dd-oq" className="dd-sr">
              {t.oSearch}
            </label>
            <Icon name="search" />
            <input id="dd-oq" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.oSearch} autoComplete="off" spellCheck={false} />
          </div>
          <label className="dd-select">
            <span>{t.oSort}</span>
            <select value={sort} onChange={(e) => setSort(e.target.value as OSort)}>
              <option value="new">{t.oSorts.new}</option>
              <option value="old">{t.oSorts.old}</option>
              <option value="items">{t.oSorts.items}</option>
            </select>
          </label>
        </div>
        <div className="dd-chips dd-chips-sm" role="group" aria-label={t.oFilter}>
          {(['all', ...FLOW] as (Status | 'all')[]).map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={st === s}
              onClick={() => {
                setSt(s);
                setLimit(PAGE);
              }}
            >
              {s === 'all' ? t.oAll : t.status[s]} <span className="dd-chip-n">{num(counts[s], lang)}</span>
            </button>
          ))}
        </div>

        {sel.size > 0 && (
          <div className="dd-bulk" role="region" aria-label={t.selected(num(sel.size, lang))}>
            <strong>{t.selected(num(sel.size, lang))}</strong>
            <button type="button" className="dd-btn dd-btn-sm" onClick={() => bulk('packed')}>
              <Icon name="box" size={15} /> {t.bulkPacked}
            </button>
            <button type="button" className="dd-btn dd-btn-sm" onClick={() => bulk('ready')}>
              <Icon name="check" size={15} /> {t.bulkReady}
            </button>
            <button type="button" className="dd-btn dd-btn-sm dd-btn-ghost" onClick={() => setSel(new Set())}>
              {t.bulkClear}
            </button>
          </div>
        )}

        <div className="dd-table-wrap">
          <table className="dd-table dd-otable">
            <thead>
              <tr>
                <th scope="col" className="dd-col-sel">
                  <input
                    type="checkbox"
                    aria-label={t.selectAll}
                    checked={allSel}
                    onChange={(e) => {
                      const next = new Set(sel);
                      for (const o of shown) if (e.target.checked) next.add(o.id);
                      else next.delete(o.id);
                      setSel(next);
                    }}
                  />
                </th>
                <th scope="col">{t.thCode}</th>
                <th scope="col">{t.thCustomer}</th>
                <th scope="col" className="num">
                  {t.thItems}
                </th>
                <th scope="col">{t.thTime}</th>
                <th scope="col">{t.thType}</th>
                <th scope="col">{t.thStatus}</th>
                <th scope="col">{t.thNext}</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((o) => {
                const to = nextStatus(o.status);
                return (
                  <tr key={o.id} id={`dd-o-${o.id}`} className={`${o.src === 'you' ? 'is-you' : ''}${flash === o.id ? ' is-flash' : ''}`}>
                    <td className="dd-col-sel">
                      <input
                        type="checkbox"
                        aria-label={t.selectOne(o.code)}
                        checked={sel.has(o.id)}
                        onChange={(e) => {
                          const next = new Set(sel);
                          if (e.target.checked) next.add(o.id);
                          else next.delete(o.id);
                          setSel(next);
                        }}
                      />
                    </td>
                    <td className="dd-code">{o.code}</td>
                    <td className="dd-who">
                      <span>{whoText(o, t, lang)}</span>
                      <small>{linesText(o, products, lang)}</small>
                    </td>
                    <td className="num">{num(itemCount(o), lang)}</td>
                    <td className="dd-nowrap">{orderTime(o, today, t, lang)}</td>
                    <td className="dd-nowrap">
                      <Icon name={o.kind === 'pickup' ? 'store' : 'bike'} size={15} /> {t.kind[o.kind]}
                    </td>
                    <td>
                      <StatusChip o={o} t={t} />
                    </td>
                    <td>
                      {to ? (
                        <button type="button" className="dd-btn dd-btn-sm dd-btn-next" onClick={() => move(o)} aria-label={`${t.orderNo(o.code)}: ${actionText(t, to as Exclude<Status, 'new'>, o.kind)}`}>
                          {actionText(t, to as Exclude<Status, 'new'>, o.kind)}
                        </button>
                      ) : (
                        <Icon name="check" size={16} />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {shown.length === 0 && <p className="dd-empty">{t.noOrders}</p>}
        {list.length > limit && (
          <button type="button" className="dd-btn dd-btn-ghost dd-btn-block" onClick={() => setLimit((l) => l + PAGE)}>
            {t.showMore} ({num(list.length - limit, lang)})
          </button>
        )}
      </section>
    </div>
  );
}

function ScanPanel({ t, lang, orders, moveOrders, reduce }: { t: Copy; lang: Lang; orders: Order[]; moveOrders: OwnerProps['moveOrders']; reduce: boolean }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const timer = useRef<number | null>(null);
  useEffect(() => () => void (timer.current && window.clearTimeout(timer.current)), []);

  const run = (raw: string) => {
    const r = scanCode(orders, raw);
    if (r.kind === 'collected') {
      if (r.order.kind === 'delivery') {
        setMsg({ ok: false, text: t.scanDelivery(r.order.code) });
        return;
      }
      moveOrders([r.order.id], 'collected');
      setMsg({ ok: true, text: t.scanOk(r.order.code, whoText(r.order, t, lang), num(itemCount(r.order), lang)) });
    } else if (r.kind === 'not-ready') setMsg({ ok: false, text: t.scanNotReady(r.order.code, statusText(t, r.order.status, r.order.kind)) });
    else if (r.kind === 'already') setMsg({ ok: false, text: t.scanAlready(r.order.code) });
    else setMsg({ ok: false, text: t.scanUnknown });
  };
  const scanNext = () => {
    const o = nextReadyPickup(orders);
    if (!o) {
      setMsg({ ok: false, text: t.scanNone });
      return;
    }
    setBusy(true);
    setMsg(null);
    setCode(o.code);
    timer.current = window.setTimeout(
      () => {
        setBusy(false);
        run(o.code);
      },
      reduce ? 0 : 900
    );
  };

  return (
    <section className="dd-card dd-scan" aria-labelledby="dd-scan-h">
      <div className={`dd-scan-view${busy ? ' is-busy' : ''}`} aria-hidden="true">
        <span className="dd-scan-corner" />
        <span className="dd-scan-beam" />
        <Icon name="scan" size={40} />
      </div>
      <div className="dd-scan-body">
        <h3 id="dd-scan-h">{t.scanH}</h3>
        <p className="dd-chart-sub">{t.scanSub}</p>
        <form
          className="dd-scan-form"
          onSubmit={(e) => {
            e.preventDefault();
            run(code);
          }}
        >
          <label htmlFor="dd-scan-code" className="dd-label">
            {t.scanLabel}
          </label>
          <div className="dd-scan-row">
            <input id="dd-scan-code" type="text" value={code} onChange={(e) => setCode(e.target.value)} placeholder={t.scanPh} autoComplete="off" spellCheck={false} maxLength={16} />
            <button type="submit" className="dd-btn dd-btn-sm">
              {t.scanCheck}
            </button>
          </div>
        </form>
        <button type="button" className="dd-btn dd-btn-primary dd-btn-sm" onClick={scanNext} disabled={busy}>
          <Icon name="scan" size={16} /> {busy ? t.scanning : t.scanNext}
        </button>
        <p className={`dd-scan-msg${msg ? (msg.ok ? ' is-ok' : ' is-bad') : ''}`} role="status">
          {msg && <Icon name={msg.ok ? 'check' : 'alert'} size={16} />} {msg?.text}
        </p>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- stock

function NumInput({ value, onCommit, label, min = 0 }: { value: number; onCommit: (n: number) => void; label: string; min?: number }) {
  const [text, setText] = useState(String(value));
  const [focus, setFocus] = useState(false);
  useEffect(() => {
    if (!focus) setText(String(value));
  }, [value, focus]);
  return (
    <span className="dd-num">
      <button type="button" aria-label={`${label} −1`} onClick={() => onCommit(Math.max(min, value - 1))} disabled={value <= min}>
        <Icon name="minus" size={14} />
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={9999}
        value={text}
        aria-label={label}
        onFocus={() => setFocus(true)}
        onBlur={() => {
          setFocus(false);
          setText(String(value));
        }}
        onChange={(e) => {
          setText(e.target.value);
          const n = Number(e.target.value);
          if (e.target.value !== '' && Number.isFinite(n)) onCommit(n);
        }}
      />
      <button type="button" aria-label={`${label} +1`} onClick={() => onCommit(value + 1)}>
        <Icon name="plus" size={14} />
      </button>
    </span>
  );
}

function LevelChip({ level, t }: { level: 'ok' | 'low' | 'out'; t: Copy }) {
  return (
    <span className={`dd-lv dd-lv-${level}`}>
      <Icon name={level === 'ok' ? 'check' : 'alert'} size={13} />
      {t.level[level]}
    </span>
  );
}

function StockTab({ t, lang, products, orders, clock, setProducts, toast }: WithClock) {
  const [onlyLow, setOnlyLow] = useState(false);
  const restock = useMemo(() => restockList(products, orders, clock.today), [products, orders, clock.today]);
  const rows = products.flatMap((p) => p.variants.map((v) => ({ p, v, level: stockLevel(v) }))).filter((r) => !onlyLow || r.level !== 'ok');

  const exportCsv = () => {
    const data: (string | number)[][] = [t.csvHead];
    for (const p of products) for (const v of p.variants) data.push([productName(p, p.id, lang), CAT_NAMES[p.cat][lang], sizeLabel(v.size, lang), v.stock, v.threshold, t.level[stockLevel(v)]]);
    try {
      const blob = new Blob(['﻿' + toCsv(data)], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = t.csvFile;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast(t.csvDone(num(data.length - 1, lang)));
    } catch {
      /* no download in this browser */
    }
  };

  return (
    <div className="dd-stock">
      <section className="dd-card dd-restock" aria-labelledby="dd-restock-h">
        <header className="dd-chart-head">
          <div>
            <h3 id="dd-restock-h">{t.restockH}</h3>
            <p className="dd-chart-sub">{t.restockSub}</p>
          </div>
        </header>
        {restock.length === 0 ? (
          <p className="dd-empty">{t.restockNone}</p>
        ) : (
          <ul className="dd-restock-list">
            {restock.map((r) => {
              const p = products.find((x) => x.id === r.p)!;
              const v = p.variants.find((x) => x.id === r.v)!;
              const name = `${productName(p, p.id, lang)}, ${sizeLabel(v.size, lang)}`;
              return (
                <li key={`${r.p}:${r.v}`}>
                  <ProductArt kind={p.art.kind} color={p.art.color} size={44} uid={`r-${r.p}-${r.v}`} />
                  <div className="dd-restock-text">
                    <strong>{name}</strong>
                    <span>
                      <LevelChip level={r.level} t={t} /> {r.perDay > 0 ? t.restockLine(num(r.stock, lang), count(r.perDay, lang)) : t.restockNoSales}
                      {r.daysLeft !== null && r.level !== 'out' ? ` · ${t.restockDays(num(r.daysLeft, lang))}` : ''}
                    </span>
                    <small>{t.restockSuggest(num(r.suggest, lang))}</small>
                  </div>
                  <button
                    type="button"
                    className="dd-btn dd-btn-sm"
                    onClick={() => {
                      setProducts((ps) => setStock(ps, r.p, r.v, r.stock + r.suggest));
                      toast(t.restocked(name, num(r.suggest, lang)));
                    }}
                  >
                    {t.restockDo(num(r.suggest, lang))}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="dd-card" aria-labelledby="dd-stock-h">
        <header className="dd-chart-head">
          <div>
            <h3 id="dd-stock-h">{t.stockH}</h3>
            <p className="dd-chart-sub">{t.stockSub}</p>
          </div>
          <div className="dd-stock-tools">
            <label className="dd-check">
              <input type="checkbox" checked={onlyLow} onChange={(e) => setOnlyLow(e.target.checked)} />
              <span>{t.onlyLow}</span>
            </label>
            <button type="button" className="dd-btn dd-btn-sm" onClick={exportCsv}>
              <Icon name="download" size={15} /> {t.exportCsv}
            </button>
          </div>
        </header>
        <div className="dd-table-wrap">
          <table className="dd-table dd-stable">
            <thead>
              <tr>
                <th scope="col">{t.thProduct}</th>
                <th scope="col">{t.thSize}</th>
                <th scope="col">{t.thStock}</th>
                <th scope="col">{t.thReorder}</th>
                <th scope="col">{t.thStatus}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ p, v, level }) => {
                const name = productName(p, p.id, lang);
                const size = sizeLabel(v.size, lang);
                const pct = Math.min(100, (v.stock / Math.max(1, v.threshold * 3)) * 100);
                return (
                  <tr key={`${p.id}:${v.id}`} className={`is-${level}`}>
                    <th scope="row">
                      <span className="dd-prodcell">
                        <ProductArt kind={p.art.kind} color={p.art.color} size={32} uid={`t-${p.id}-${v.id}`} />
                        {name}
                      </span>
                    </th>
                    <td className="dd-nowrap">{size}</td>
                    <td>
                      <NumInput value={v.stock} label={t.stockAria(name, size)} onCommit={(n) => setProducts((ps) => setStock(ps, p.id, v.id, n))} />
                      <span className="dd-meter" aria-hidden="true">
                        <span style={{ width: `${pct}%` }} className={`dd-meter-${level}`} />
                        <i style={{ left: `${100 / 3}%` }} />
                      </span>
                    </td>
                    <td>
                      <NumInput value={v.threshold} label={t.reorderAria(name, size)} onCommit={(n) => setProducts((ps) => setThreshold(ps, p.id, v.id, n))} />
                    </td>
                    <td>
                      <LevelChip level={level} t={t} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------- customers

function CustomersTab({ t, lang, orders, clock, range }: WithClock) {
  const [limit, setLimit] = useState(20);
  const rows = useMemo(() => customerRows(orders, clock.today, range), [orders, clock.today, range]);
  return (
    <section className="dd-card" aria-labelledby="dd-cust-h">
      <header className="dd-chart-head">
        <div>
          <h3 id="dd-cust-h">{t.custH}</h3>
          <p className="dd-chart-sub">
            {t.custSub(num(range, lang))} {t.custCount(count(rows.length, lang))}.
          </p>
        </div>
      </header>
      <p className="dd-privacy">
        <Icon name="user" size={16} /> {t.privacy}
      </p>
      <div className="dd-table-wrap">
        <table className="dd-table">
          <thead>
            <tr>
              <th scope="col">{t.thCustomer}</th>
              <th scope="col" className="num">
                {t.thOrders}
              </th>
              <th scope="col" className="num">
                {t.thItems}
              </th>
              <th scope="col">{t.thLast}</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, limit).map((r) => (
              <tr key={r.cust} className={r.cust === 'you' ? 'is-you' : undefined}>
                <th scope="row">
                  <span className="dd-custcell">
                    <span className="dd-avatar" aria-hidden="true">
                      {customerName(r.cust, lang, t.you).slice(0, 1).toUpperCase()}
                    </span>
                    <span className="dd-cap">{customerName(r.cust, lang, t.you)}</span>
                    {r.loyal && (
                      <span className="dd-loyal">
                        <Icon name="star" size={12} /> {t.loyal}
                      </span>
                    )}
                  </span>
                </th>
                <td className="num">{num(r.orders, lang)}</td>
                <td className="num">{num(r.items, lang)}</td>
                <td className="dd-nowrap">{r.last === clock.today ? t.today : r.last === clock.today - 1 ? t.yesterday : dayLabel(r.last, lang, { day: 'numeric', month: 'short' })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="dd-chart-note">{t.loyalNote}</p>
      {rows.length > limit && (
        <button type="button" className="dd-btn dd-btn-ghost dd-btn-block" onClick={() => setLimit((l) => l + 20)}>
          {t.showMore} ({num(rows.length - limit, lang)})
        </button>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- products

function emptyDraft(): Draft {
  return { name: { en: '', de: '', ne: '' }, cat: 'snacks', art: { kind: 'packet', color: 'saffron' }, variants: [{ size: '', stock: 10, threshold: 4 }] };
}
function draftOf(p: Product): Draft {
  return {
    name: { en: productName(p, p.id, 'en'), de: productName(p, p.id, 'de'), ne: productName(p, p.id, 'ne') },
    cat: p.cat,
    art: { ...p.art },
    variants: p.variants.map((v) => ({ size: sizeLabel(v.size, 'en'), stock: v.stock, threshold: v.threshold })),
  };
}

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="dd-field">
      <label htmlFor={id}>{label}</label>
      {children}
    </div>
  );
}

function ProductsTab({ t, lang, products, setProducts, toast, goShop }: OwnerProps) {
  const [editId, setEditId] = useState<string | 'new' | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [errs, setErrs] = useState<string[]>([]);
  const [savedCat, setSavedCat] = useState<CatId | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const startNew = () => {
    setDraft(emptyDraft());
    setEditId('new');
    setErrs([]);
    setSavedCat(null);
    requestAnimationFrame(() => formRef.current?.querySelector('input')?.focus());
  };
  const startEdit = (p: Product) => {
    setDraft(draftOf(p));
    setEditId(p.id);
    setErrs([]);
    setSavedCat(null);
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ block: 'start' });
      formRef.current?.querySelector('input')?.focus();
    });
  };
  const save = () => {
    const probs = draftProblems(draft);
    if (probs.length) {
      setErrs(probs.map((x) => (x === 'name' ? t.errName : t.errSizes)));
      return;
    }
    const id = editId && editId !== 'new' ? editId : `p${Date.now().toString(36)}`;
    const old = products.find((p) => p.id === id);
    let p = productFromDraft(draft, id);
    // A size that was not renamed keeps its code, so its sales history and the shop's labels stay.
    if (old)
      p = {
        ...p,
        weight: old.weight,
        variants: p.variants.map((v) => {
          const o = old.variants.find((x) => x.size === v.size || sizeLabel(x.size, 'en') === v.size);
          return o ? { ...v, id: o.id, size: o.size } : v;
        }),
      };
    setProducts((ps) => upsertProduct(ps, p));
    toast(t.saved(productName(p, p.id, lang)));
    setSavedCat(p.cat);
    setEditId(null);
  };
  const setVar = (i: number, patch: Partial<Draft['variants'][number]>) => setDraft((d) => ({ ...d, variants: d.variants.map((v, j) => (j === i ? { ...v, ...patch } : v)) }));
  const editing = editId && editId !== 'new' ? products.find((p) => p.id === editId) : null;

  return (
    <div className="dd-products">
      <section className="dd-card" aria-labelledby="dd-prod-h">
        <header className="dd-chart-head">
          <div>
            <h3 id="dd-prod-h">{t.prodH}</h3>
            <p className="dd-chart-sub">{t.prodSub}</p>
          </div>
          <button type="button" className="dd-btn dd-btn-primary dd-btn-sm" onClick={startNew}>
            <Icon name="plus" size={16} /> {t.newProduct}
          </button>
        </header>

        {savedCat && (
          <p className="dd-saved" role="status">
            <Icon name="check" size={16} />
            <button type="button" className="dd-linkbtn" onClick={() => goShop(savedCat)}>
              {t.seeInShop}
            </button>
          </p>
        )}

        {editId && (
          <form
            ref={formRef}
            className="dd-editor"
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
            aria-label={editing ? t.editing(productName(editing, editing.id, lang)) : t.adding}
          >
            <p className="dd-editor-title">{editing ? t.editing(productName(editing, editing.id, lang)) : t.adding}</p>
            <div className="dd-editor-grid">
              <div className="dd-editor-fields">
                <Field id="dd-n-en" label={t.nameEn}>
                  <input id="dd-n-en" type="text" lang="en" value={draft.name.en} maxLength={40} placeholder={t.namePhProduct} onChange={(e) => setDraft((d) => ({ ...d, name: { ...d.name, en: e.target.value } }))} autoComplete="off" />
                </Field>
                <Field id="dd-n-de" label={t.nameDe}>
                  <input id="dd-n-de" type="text" lang="de" value={draft.name.de} maxLength={40} onChange={(e) => setDraft((d) => ({ ...d, name: { ...d.name, de: e.target.value } }))} autoComplete="off" />
                </Field>
                <Field id="dd-n-ne" label={t.nameNe}>
                  <input id="dd-n-ne" type="text" lang="ne" value={draft.name.ne} maxLength={40} onChange={(e) => setDraft((d) => ({ ...d, name: { ...d.name, ne: e.target.value } }))} autoComplete="off" />
                </Field>
                <Field id="dd-cat" label={t.cat}>
                  <select id="dd-cat" value={draft.cat} onChange={(e) => setDraft((d) => ({ ...d, cat: e.target.value as CatId }))}>
                    {CATS.map((c) => (
                      <option key={c} value={c}>
                        {CAT_NAMES[c][lang]}
                      </option>
                    ))}
                  </select>
                </Field>
                <fieldset className="dd-artpick">
                  <legend>{t.art}</legend>
                  {ART_KINDS.map((k) => (
                    <label key={k} className={`dd-artopt${draft.art.kind === k ? ' is-on' : ''}`}>
                      <input type="radio" name="dd-art" value={k} checked={draft.art.kind === k} onChange={() => setDraft((d) => ({ ...d, art: { ...d.art, kind: k } }))} />
                      <ProductArt kind={k} color={draft.art.color} size={44} uid={`pick-${k}`} />
                      <span>{ART_NAMES[k][lang]}</span>
                    </label>
                  ))}
                </fieldset>
                <fieldset className="dd-colorpick">
                  <legend>{t.colour}</legend>
                  {ART_COLORS.map((c) => (
                    <label key={c} className={`dd-swatch${draft.art.color === c ? ' is-on' : ''}`} title={COLOR_NAMES[c][lang]}>
                      <input type="radio" name="dd-color" value={c} checked={draft.art.color === c} onChange={() => setDraft((d) => ({ ...d, art: { ...d.art, color: c } }))} aria-label={COLOR_NAMES[c][lang]} />
                      <span style={{ background: ART_HEX[c].main }} aria-hidden="true" />
                    </label>
                  ))}
                </fieldset>
                <fieldset className="dd-varpick">
                  <legend>{t.sizes}</legend>
                  {draft.variants.map((v, i) => {
                    const n = num(i + 1, lang);
                    return (
                      <div key={i} className="dd-varrow">
                        <input type="text" value={v.size} maxLength={12} placeholder={t.sizePh} aria-label={t.sizeAria(n)} onChange={(e) => setVar(i, { size: e.target.value })} autoComplete="off" />
                        <label className="dd-varnum">
                          <span>{t.thStock}</span>
                          <input type="number" min={0} max={9999} inputMode="numeric" value={v.stock} aria-label={t.stockOf(n)} onChange={(e) => setVar(i, { stock: Number(e.target.value) || 0 })} />
                        </label>
                        <label className="dd-varnum">
                          <span>{t.thReorder}</span>
                          <input type="number" min={0} max={9999} inputMode="numeric" value={v.threshold} aria-label={t.reorderOf(n)} onChange={(e) => setVar(i, { threshold: Number(e.target.value) || 0 })} />
                        </label>
                        <button type="button" className="dd-iconbtn" disabled={draft.variants.length <= 1} onClick={() => setDraft((d) => ({ ...d, variants: d.variants.filter((_, j) => j !== i) }))} aria-label={t.removeSize(n)}>
                          <Icon name="trash" size={16} />
                        </button>
                      </div>
                    );
                  })}
                  {draft.variants.length < 6 && (
                    <button type="button" className="dd-linkbtn" onClick={() => setDraft((d) => ({ ...d, variants: [...d.variants, { size: '', stock: 10, threshold: 4 }] }))}>
                      + {t.addSize}
                    </button>
                  )}
                </fieldset>
              </div>
              <div className="dd-editor-preview" aria-hidden="true">
                <p className="dd-label">{t.preview}</p>
                <div className="dd-pcard dd-pcard-preview">
                  <span className="dd-pcard-art">
                    <ProductArt kind={draft.art.kind} color={draft.art.color} size={110} uid="preview" />
                  </span>
                  <div className="dd-pcard-body">
                    <p className="dd-pcard-name">{draft.name[lang] || draft.name.en || draft.name.de || draft.name.ne || '…'}</p>
                    <p className="dd-pcard-sizes">{draft.variants.map((v) => v.size.trim()).filter(Boolean).join(' · ') || '…'}</p>
                  </div>
                </div>
              </div>
            </div>
            {errs.length > 0 && (
              <div className="dd-err" role="alert">
                {errs.map((e) => (
                  <p key={e}>{e}</p>
                ))}
              </div>
            )}
            <div className="dd-row-btns">
              <button type="submit" className="dd-btn dd-btn-primary">
                <Icon name="check" /> {t.save}
              </button>
              <button type="button" className="dd-btn dd-btn-ghost" onClick={() => setEditId(null)}>
                {t.cancel}
              </button>
              {editing?.custom && (
                <button
                  type="button"
                  className="dd-btn dd-btn-ghost dd-btn-danger"
                  onClick={() => {
                    setProducts((ps) => removeProduct(ps, editing.id));
                    toast(t.deleted(productName(editing, editing.id, lang)));
                    setEditId(null);
                  }}
                >
                  <Icon name="trash" size={16} /> {t.del}
                </button>
              )}
            </div>
          </form>
        )}

        <ul className="dd-plist">
          {products.map((p) => {
            const name = productName(p, p.id, lang);
            return (
              <li key={p.id}>
                <ProductArt kind={p.art.kind} color={p.art.color} size={44} uid={`l-${p.id}`} />
                <span className="dd-plist-text">
                  <strong>{name}</strong>
                  <small>
                    {CAT_NAMES[p.cat][lang]} · {p.variants.map((v) => sizeLabel(v.size, lang)).join(' · ')}
                    {p.custom ? ` · ${t.custom}` : ''}
                  </small>
                </span>
                <button type="button" className="dd-btn dd-btn-sm dd-btn-ghost" onClick={() => startEdit(p)} aria-label={t.editAria(name)}>
                  <Icon name="edit" size={15} /> {t.edit}
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

