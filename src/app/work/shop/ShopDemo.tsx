'use client';

// "Dhaka & Dal" — a made-up Nepali grocery and crafts shop in Leipzig (studio
// demo #15). Two sides with a switch: the customer's storefront (phone first:
// search, categories, sizes, bag, pickup or delivery slot, a pickup code as a
// QR) and the owner's dashboard (counts, charts, orders with a status flow and
// a code scan, stock and reorder levels, customers, a product editor, live
// orders trickling in). Everything runs in this browser: the order history is
// seeded (shop.ts), the visitor's changes live in one localStorage key,
// nothing is sent. The root is translate="no" so nothing typed here — a first
// name, a product name — ever reaches the site's translator.

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { setSiteLangCookie } from '@/components/studio/siteLang';
import { Icon, ShopMark } from './art';
import { COPY, LANGS, SHOP, customerName, num, type Lang } from './content';
import Owner, { type LiveState } from './Owner';
import Storefront from './Storefront';
import {
  EXTRA_MAX,
  FLOW,
  LIVE_CAP,
  SEED_PRODUCTS,
  STORE_KEY,
  TABS,
  cleanSaved,
  emptySaved,
  fitCart,
  generateHistory,
  hash,
  itemCount,
  liveDelay,
  liveOrder,
  localNow,
  mergeOrders,
  placeOrder,
  takeStock,
  type CartLine,
  type CatId,
  type Order,
  type Product,
  type Range,
  type Saved,
  type Slot,
  type Status,
  type Tab,
  type Theme,
  type View,
} from './shop';

function readSaved(): Saved | null {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? cleanSaved(JSON.parse(raw)) : null;
  } catch {
    return null;
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

/** A soft two-note chime for a new order (only after the owner switched sound on — a tap). */
function chime(ctx: AudioContext | null) {
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    [880, 1320].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, now + i * 0.14);
      g.gain.exponentialRampToValueAtTime(0.18, now + i * 0.14 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.14 + 0.35);
      o.connect(g).connect(ctx.destination);
      o.start(now + i * 0.14);
      o.stop(now + i * 0.14 + 0.4);
    });
  } catch {
    /* no audio: the toast still shows */
  }
}

export default function ShopDemo({ initialLang }: { initialLang: Lang }) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [lang, setLangState] = useState<Lang>(initialLang);
  const t = COPY[lang];
  const [saved, setSaved] = useState<Saved>(emptySaved);
  const [view, setViewState] = useState<View>('owner');
  const [tab, setTabState] = useState<Tab>('overview');
  const [cat, setCat] = useState<CatId | 'all'>('all');
  const [clock, setClock] = useState<{ today: number; nowMin: number } | null>(null);
  const [toastMsg, setToastMsg] = useState<{ id: number; text: string } | null>(null);
  const [focusOrder, setFocusOrder] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);
  const [liveN, setLiveN] = useState(0);
  const audio = useRef<AudioContext | null>(null);
  const seed = useRef(0);
  const topRef = useRef<HTMLDivElement>(null);

  const commit = useCallback((fn: (s: Saved) => Saved) => {
    setSaved((s) => {
      const n = fn(s);
      writeSaved(n);
      return n;
    });
  }, []);

  // ----- mount: saved state, the URL, the clock, the visitor's colour scheme -----
  useEffect(() => {
    const s = readSaved();
    if (s) setSaved(s);
    else if (window.matchMedia?.('(prefers-color-scheme: light)').matches) setSaved((x) => ({ ...x, theme: 'light' }));
    try {
      const u = new URLSearchParams(location.search);
      const v = u.get('view');
      if (v === 'shop' || v === 'owner') setViewState(v);
      const tb = u.get('tab');
      if (TABS.includes(tb as Tab)) setTabState(tb as Tab);
    } catch {
      /* ignore */
    }
    seed.current = Math.floor(Math.random() * 1e6);
    setClock(localNow(new Date()));
    const id = window.setInterval(() => setClock(localNow(new Date())), 30000);
    const vis = () => setHidden(document.visibilityState === 'hidden');
    vis();
    document.addEventListener('visibilitychange', vis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', vis);
    };
  }, []);

  const toast = useCallback((text: string) => setToastMsg({ id: Date.now() + Math.random(), text }), []);
  useEffect(() => {
    if (!toastMsg) return;
    const id = window.setTimeout(() => setToastMsg(null), 4200);
    return () => window.clearTimeout(id);
  }, [toastMsg]);

  const products: Product[] = saved.products ?? SEED_PRODUCTS;
  const history = useMemo(() => (clock ? generateHistory(clock.today, clock.nowMin) : []), [clock]);
  const orders = useMemo(() => mergeOrders(history, saved.extra, saved.moves), [history, saved.extra, saved.moves]);

  const setUrl = (v: View, tb: Tab) => {
    try {
      const u = new URL(location.href);
      u.searchParams.set('view', v);
      if (v === 'owner' && tb !== 'overview') u.searchParams.set('tab', tb);
      else u.searchParams.delete('tab');
      history_replace(u.toString());
    } catch {
      /* ignore */
    }
  };
  const setView = (v: View) => {
    setViewState(v);
    setUrl(v, tab);
    requestAnimationFrame(() => topRef.current?.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' }));
  };
  const setTab = (tb: Tab) => {
    setTabState(tb);
    setUrl(view, tb);
  };

  // ----- language -----
  const setLang = (l: Lang) => {
    setLangState(l);
    setSiteLangCookie(l);
    try {
      document.documentElement.lang = l;
    } catch {
      /* ignore */
    }
    router.refresh();
  };

  // ----- orders -----
  const moveOrders = useCallback(
    (ids: string[], to: Status) => {
      const want = new Set(ids);
      commit((s) => {
        const extra = s.extra.map((o) => (want.has(o.id) && FLOW.indexOf(to) > FLOW.indexOf(o.status) ? { ...o, status: to } : o));
        const extraIds = new Set(s.extra.map((o) => o.id));
        const moves = { ...s.moves };
        for (const id of ids) if (!extraIds.has(id)) moves[id] = to;
        return { ...s, extra, moves };
      });
    },
    [commit]
  );

  const setProducts = useCallback((fn: (p: Product[]) => Product[]) => commit((s) => ({ ...s, products: fn(s.products ?? SEED_PRODUCTS) })), [commit]);
  const setCart = useCallback(
    (fn: (c: CartLine[]) => CartLine[]) => commit((s) => ({ ...s, cart: fitCart(fn(s.cart), s.products ?? SEED_PRODUCTS) })),
    [commit]
  );

  const onPlace = (slot: Slot, name: string): Order | null => {
    if (!clock || !saved.cart.length) return null;
    const now = localNow(new Date());
    const o = placeOrder(saved.cart, slot, now.today, now.nowMin, saved.seq + 1, name);
    commit((s) => ({
      ...s,
      products: takeStock(s.products ?? SEED_PRODUCTS, o.lines),
      extra: [...s.extra, o].slice(-EXTRA_MAX),
      cart: [],
      seq: s.seq + 1,
    }));
    setClock(now);
    return o;
  };
  const goOwner = (orderId: string) => {
    setFocusOrder(orderId);
    setTabState('orders');
    setViewState('owner');
    setUrl('owner', 'orders');
    const o = saved.extra.find((x) => x.id === orderId);
    if (o) toast(t.yourArrived(o.code));
    requestAnimationFrame(() => topRef.current?.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' }));
  };
  const goShop = (c: CatId) => {
    setCat(c);
    setView('shop');
  };
  const clearFocus = useCallback(() => setFocusOrder(null), []);

  // ----- sound -----
  const toggleSound = () => {
    const on = !saved.sound;
    if (on && !audio.current) {
      try {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        audio.current = new AC();
      } catch {
        audio.current = null;
      }
    }
    if (on) {
      void audio.current?.resume?.();
      chime(audio.current);
    }
    commit((s) => ({ ...s, sound: on }));
  };

  // ----- live orders: only on the owner side, only while visible, capped -----
  const live: LiveState = liveN >= LIVE_CAP ? 'done' : hidden ? 'paused' : 'on';
  const liveRef = useRef({ products, sound: saved.sound, lang });
  liveRef.current = { products, sound: saved.sound, lang };
  const hasClock = clock !== null;
  useEffect(() => {
    if (!hasClock || view !== 'owner' || hidden || liveN >= LIVE_CAP) return;
    const id = window.setTimeout(() => {
      const now = localNow(new Date());
      const o = liveOrder(liveN, seed.current, now.today, now.nowMin, liveRef.current.products);
      setLiveN((n) => n + 1);
      if (!o) return;
      commit((s) => ({ ...s, products: takeStock(s.products ?? SEED_PRODUCTS, o.lines), extra: [...s.extra, o].slice(-EXTRA_MAX) }));
      const L = liveRef.current.lang;
      toast(COPY[L].newOrder(o.code, customerName(o.cust, L, COPY[L].you), num(itemCount(o), L)));
      if (liveRef.current.sound) chime(audio.current);
    }, liveDelay(liveN, seed.current) - (liveN === 0 ? 8000 : 0));
    return () => window.clearTimeout(id);
  }, [hasClock, view, hidden, liveN, commit, toast]);

  // ----- reset -----
  const reset = () => {
    const keepTheme = saved.theme;
    commit(() => ({ ...emptySaved(), theme: keepTheme }));
    setLiveN(0);
    setCat('all');
    seed.current = hash(String(Date.now())) % 1e6;
    toast(t.resetDone);
  };

  return (
    <div className={`dd dd-lang-${lang}`} lang={lang} translate="no" ref={topRef}>
      <div className="dd-top">
        <div className="dd-brand">
          <ShopMark size={40} />
          <div>
            <h1 className="dd-h1">{SHOP[lang]}</h1>
            <p className="dd-place">{t.place}</p>
          </div>
        </div>
        <div className="dd-langs" role="group" aria-label={t.langLabel}>
          {LANGS.map((x) => (
            <button key={x.id} type="button" aria-pressed={lang === x.id} onClick={() => setLang(x.id)} lang={x.id} aria-label={x.label}>
              {x.short}
            </button>
          ))}
        </div>
      </div>
      <p className="dd-madeup">{t.madeUp}</p>

      <div className="dd-switch" role="group" aria-label={t.viewLabel}>
        {(['shop', 'owner'] as View[]).map((v) => (
          <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)}>
            <Icon name={v === 'shop' ? 'bag' : 'box'} size={18} />
            <span>
              <strong>{t.views[v]}</strong>
              <small>{t.viewHint[v]}</small>
            </span>
          </button>
        ))}
      </div>
      <p className="dd-try">{t.tryLine}</p>

      {view === 'shop' ? (
        <Storefront t={t} lang={lang} products={products} cart={saved.cart} setCart={setCart} clock={clock} onPlace={onPlace} goOwner={goOwner} toast={toast} cat={cat} setCat={setCat} reduce={reduce} />
      ) : (
        <Owner
          t={t}
          lang={lang}
          products={products}
          orders={orders}
          clock={clock}
          range={saved.range}
          setRange={(r: Range) => commit((s) => ({ ...s, range: r }))}
          theme={saved.theme}
          setTheme={(x: Theme) => commit((s) => ({ ...s, theme: x }))}
          sound={saved.sound}
          toggleSound={toggleSound}
          tab={tab}
          setTab={setTab}
          moveOrders={moveOrders}
          setProducts={setProducts}
          toast={toast}
          focusOrder={focusOrder}
          clearFocus={clearFocus}
          live={live}
          goShop={goShop}
          reduce={reduce}
        />
      )}

      <section className="dd-how" aria-labelledby="dd-how-h">
        <h2 id="dd-how-h">{t.howH}</h2>
        <ul>
          {t.how.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
        <button type="button" className="dd-btn dd-btn-ghost" onClick={reset}>
          {t.reset}
        </button>
      </section>

      <div className="dd-toast-region" aria-live="polite" role="status">
        {toastMsg && (
          <div key={toastMsg.id} className="dd-toast">
            {toastMsg.text}
          </div>
        )}
      </div>
    </div>
  );
}

function history_replace(url: string) {
  window.history.replaceState(window.history.state, '', url);
}
