'use client';

// The customer side of "Dhaka & Dal": categories, search, filters, product
// cards with drawn art, a product sheet with sizes, the bag, pickup or
// delivery slots and a confirmation with the pickup code as a QR. No prices
// and no payment step (both say so once). Rules in shop.ts, words in content.ts.

import QRCode from 'qrcode';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Icon, ProductArt } from './art';
import { CAT_NAMES, dayLabel, hhmm, num, productDesc, productName, sizeLabel, type Copy, type Lang } from './content';
import {
  CATS,
  FEW_LEFT,
  addToCart,
  cartCount,
  inCart,
  qrText,
  setCartQty,
  shelfBadge,
  slotId,
  slotsFor,
  totalStock,
  type CartLine,
  type CatId,
  type Kind,
  type Order,
  type Product,
  type Slot,
} from './shop';

type Sort = 'popular' | 'az' | 'stock';

function fold(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function Qr({ text, label }: { text: string; label: string }) {
  const path = useMemo(() => {
    const qr = QRCode.create(text, { errorCorrectionLevel: 'M' });
    const n = qr.modules.size;
    let d = '';
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (qr.modules.get(y, x)) d += `M${x + 2} ${y + 2}h1v1h-1z`;
    return { d, n: n + 4 };
  }, [text]);
  return (
    <svg className="dd-qr" viewBox={`0 0 ${path.n} ${path.n}`} role="img" aria-label={label} shapeRendering="crispEdges">
      <rect width={path.n} height={path.n} fill="#fff" />
      <path d={path.d} fill="#1d1b1a" />
    </svg>
  );
}

export function Sheet({ title, onClose, children, closeLabel, wide }: { title: ReactNode; onClose: () => void; children: ReactNode; closeLabel: string; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('.dd-sheet-close')?.focus();
    document.documentElement.classList.add('dd-locked');
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current();
      if (e.key === 'Tab' && ref.current) {
        const f = [...ref.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select, a[href], [tabindex="0"]')].filter((el) => el.offsetParent !== null);
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) {
          e.preventDefault();
          f[f.length - 1].focus();
        } else if (!e.shiftKey && document.activeElement === f[f.length - 1]) {
          e.preventDefault();
          f[0].focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.documentElement.classList.remove('dd-locked');
      before?.focus?.();
    };
  }, []);
  return (
    <div className="dd-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`dd-sheet${wide ? ' is-wide' : ''}`} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined} ref={ref}>
        <div className="dd-sheet-head">
          <h2 className="dd-sheet-title">{title}</h2>
          <button type="button" className="dd-iconbtn dd-sheet-close" onClick={onClose} aria-label={closeLabel}>
            <Icon name="close" />
          </button>
        </div>
        <div className="dd-sheet-body">{children}</div>
      </div>
    </div>
  );
}

function Stepper({ value, onChange, t, lang, max, min = 1 }: { value: number; onChange: (n: number) => void; t: Copy; lang: Lang; max: number; min?: number }) {
  return (
    <span className="dd-stepper">
      <button type="button" onClick={() => onChange(value - 1)} disabled={value <= min} aria-label={t.less}>
        <Icon name="minus" size={16} />
      </button>
      <output aria-live="polite">{num(value, lang)}</output>
      <button type="button" onClick={() => onChange(value + 1)} disabled={value >= max} aria-label={t.more}>
        <Icon name="plus" size={16} />
      </button>
    </span>
  );
}

function Badge({ stock, t, lang, custom }: { stock: number; t: Copy; lang: Lang; custom?: boolean }) {
  const b = shelfBadge(stock);
  if (b?.kind === 'out') return <span className="dd-badge dd-badge-out">{t.soldOut}</span>;
  if (b?.kind === 'few') return <span className="dd-badge dd-badge-few">{t.fewLeft(num(b.n, lang))}</span>;
  if (custom) return <span className="dd-badge dd-badge-new">{t.newBadge}</span>;
  return null;
}

export type StoreProps = {
  t: Copy;
  lang: Lang;
  products: Product[];
  cart: CartLine[];
  setCart: (fn: (c: CartLine[]) => CartLine[]) => void;
  clock: { today: number; nowMin: number } | null;
  onPlace: (slot: Slot, name: string) => Order | null;
  goOwner: (orderId: string) => void;
  toast: (s: string) => void;
  cat: CatId | 'all';
  setCat: (c: CatId | 'all') => void;
  reduce: boolean;
};

export default function Storefront({ t, lang, products, cart, setCart, clock, onPlace, goOwner, toast, cat, setCat }: StoreProps) {
  const [q, setQ] = useState('');
  const [inStock, setInStock] = useState(false);
  const [sort, setSort] = useState<Sort>('popular');
  const [openId, setOpenId] = useState<string | null>(null);
  const [bagOpen, setBagOpen] = useState(false);

  const shown = useMemo(() => {
    const words = fold(q.trim()).split(/\s+/).filter(Boolean);
    let list = products.filter((p) => (cat === 'all' || p.cat === cat) && (!inStock || totalStock(p) > 0));
    if (words.length) {
      list = list.filter((p) => {
        const hay = fold(
          [
            ...(['en', 'de', 'ne'] as Lang[]).map((l) => productName(p, p.id, l)),
            CAT_NAMES[p.cat][lang],
            productDesc(p, lang) ?? '',
          ].join(' ')
        );
        return words.every((w) => hay.includes(w));
      });
    }
    const name = (p: Product) => productName(p, p.id, lang);
    if (sort === 'az') list = [...list].sort((a, b) => name(a).localeCompare(name(b), lang === 'ne' ? 'ne' : lang));
    else if (sort === 'stock') list = [...list].sort((a, b) => totalStock(b) - totalStock(a));
    else list = [...list].sort((a, b) => Number(!!b.custom) - Number(!!a.custom) || b.weight - a.weight);
    return list;
  }, [products, q, cat, inStock, sort, lang]);

  const n = cartCount(cart);
  const open = openId ? products.find((p) => p.id === openId) ?? null : null;

  const quickAdd = (p: Product) => {
    if (p.variants.length > 1) {
      setOpenId(p.id);
      return;
    }
    const v = p.variants[0];
    if (inCart(cart, p.id, v.id) >= Math.min(9, v.stock)) return;
    setCart((c) => addToCart(c, products, p.id, v.id, 1));
    toast(t.added(productName(p, p.id, lang)));
  };

  return (
    <div className={`dd-store${n > 0 ? ' has-bag' : ''}`}>
      <section className="dd-store-hero" aria-labelledby="dd-store-h">
        <div className="dd-store-hero-text">
          <h2 id="dd-store-h">{t.shopH}</h2>
          <p>{t.shopSub}</p>
          <p className="dd-hidden-note">
            <Icon name="alert" size={16} /> {t.pricesHidden}
          </p>
        </div>
        <div className="dd-store-hero-art" aria-hidden="true">
          <ProductArt kind="topi" color="maroon" size={88} uid="hero1" />
          <ProductArt kind="jar" color="red" size={88} uid="hero2" />
          <ProductArt kind="diyo" color="saffron" size={88} uid="hero3" />
        </div>
      </section>

      <div className="dd-store-tools">
        <div className="dd-search">
          <label htmlFor="dd-q" className="dd-sr">
            {t.searchLabel}
          </label>
          <Icon name="search" />
          <input id="dd-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.searchPh} autoComplete="off" spellCheck={false} />
          {q && (
            <button type="button" className="dd-iconbtn" onClick={() => setQ('')} aria-label={t.clearSearch}>
              <Icon name="close" size={16} />
            </button>
          )}
        </div>
        <button type="button" className="dd-bagbtn" onClick={() => setBagOpen(true)} aria-label={t.openBag(num(n, lang))}>
          <Icon name="bag" />
          <span className="dd-bagbtn-text">{t.bag}</span>
          <span className="dd-bagcount" aria-hidden="true">
            {num(n, lang)}
          </span>
        </button>
      </div>

      <div className="dd-chips" role="group" aria-label={t.catsLabel}>
        <button type="button" aria-pressed={cat === 'all'} onClick={() => setCat('all')}>
          {t.allCats}
        </button>
        {CATS.map((c) => (
          <button key={c} type="button" aria-pressed={cat === c} onClick={() => setCat(c)}>
            {CAT_NAMES[c][lang]}
          </button>
        ))}
      </div>

      <div className="dd-filters">
        <label className="dd-check">
          <input type="checkbox" checked={inStock} onChange={(e) => setInStock(e.target.checked)} />
          <span>{t.inStockOnly}</span>
        </label>
        <label className="dd-select">
          <span>{t.sortLabel}</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="popular">{t.sorts.popular}</option>
            <option value="az">{t.sorts.az}</option>
            <option value="stock">{t.sorts.stock}</option>
          </select>
        </label>
        <p className="dd-count" aria-live="polite">
          {t.results(num(shown.length, lang))}
        </p>
      </div>

      {shown.length === 0 ? (
        <div className="dd-empty">
          <p>{t.noResults}</p>
          <button
            type="button"
            className="dd-btn dd-btn-ghost"
            onClick={() => {
              setQ('');
              setCat('all');
              setInStock(false);
            }}
          >
            {t.clearSearch}
          </button>
        </div>
      ) : (
        <ul className="dd-grid">
          {shown.map((p) => {
            const name = productName(p, p.id, lang);
            const stock = totalStock(p);
            return (
              <li key={p.id} className={`dd-pcard${stock <= 0 ? ' is-out' : ''}`}>
                <button type="button" className="dd-pcard-open" onClick={() => setOpenId(p.id)} aria-label={t.open(name)}>
                  <span className="dd-pcard-art">
                    <ProductArt kind={p.art.kind} color={p.art.color} size={104} uid={`c-${p.id}`} />
                  </span>
                </button>
                <div className="dd-pcard-body">
                  <Badge stock={stock} t={t} lang={lang} custom={p.custom} />
                  <h3 className="dd-pcard-name">{name}</h3>
                  <p className="dd-pcard-sizes">{p.variants.map((v) => sizeLabel(v.size, lang)).join(' · ')}</p>
                  <button type="button" className="dd-btn dd-btn-add" disabled={stock <= 0} onClick={() => quickAdd(p)} aria-label={p.variants.length > 1 ? `${t.chooseSize}: ${name}` : t.addAria(name)}>
                    {stock <= 0 ? t.soldOut : p.variants.length > 1 ? t.chooseSize : (
                      <>
                        <Icon name="plus" size={16} /> {t.add}
                      </>
                    )}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="dd-closed-note">
        <Icon name="clock" size={16} /> {t.closedSunday}
      </p>

      {n > 0 && !bagOpen && (
        <div className="dd-bagbar">
          <button type="button" className="dd-btn dd-btn-primary" onClick={() => setBagOpen(true)}>
            <Icon name="bag" /> {t.openBag(num(n, lang))} · {t.toCheckout}
          </button>
        </div>
      )}

      {open && <ProductSheet p={open} t={t} lang={lang} cart={cart} setCart={setCart} products={products} toast={toast} onClose={() => setOpenId(null)} />}
      {bagOpen && <Bag t={t} lang={lang} products={products} cart={cart} setCart={setCart} clock={clock} onPlace={onPlace} goOwner={goOwner} onClose={() => setBagOpen(false)} />}
    </div>
  );
}

function ProductSheet({ p, t, lang, cart, setCart, products, toast, onClose }: { p: Product; t: Copy; lang: Lang; cart: CartLine[]; setCart: StoreProps['setCart']; products: Product[]; toast: (s: string) => void; onClose: () => void }) {
  const firstIn = p.variants.find((v) => v.stock > 0) ?? p.variants[0];
  const [vid, setVid] = useState(firstIn.id);
  const v = p.variants.find((x) => x.id === vid) ?? firstIn;
  const have = inCart(cart, p.id, v.id);
  const room = Math.max(0, Math.min(9, v.stock) - have);
  const [qty, setQty] = useState(1);
  const name = productName(p, p.id, lang);
  const desc = productDesc(p, lang);
  useEffect(() => setQty((q) => Math.max(1, Math.min(q, room || 1))), [room]);
  return (
    <Sheet title={name} onClose={onClose} closeLabel={t.close}>
      <div className="dd-psheet">
        <div className="dd-psheet-art">
          <ProductArt kind={p.art.kind} color={p.art.color} size={180} uid={`s-${p.id}`} />
        </div>
        <div>
          <p className="dd-psheet-cat">{CAT_NAMES[p.cat][lang]}</p>
          {desc && <p className="dd-psheet-desc">{desc}</p>}
          {p.custom && <p className="dd-psheet-desc">{t.custom}</p>}
          <fieldset className="dd-sizes">
            <legend>{t.size}</legend>
            {p.variants.map((x) => {
              const b = shelfBadge(x.stock);
              return (
                <label key={x.id} className={`dd-size${x.id === v.id ? ' is-on' : ''}${x.stock <= 0 ? ' is-out' : ''}`}>
                  <input type="radio" name={`size-${p.id}`} value={x.id} checked={x.id === v.id} disabled={x.stock <= 0} onChange={() => setVid(x.id)} />
                  <span className="dd-size-name">{sizeLabel(x.size, lang)}</span>
                  {b && <span className={`dd-size-badge ${b.kind === 'out' ? 'is-out' : 'is-few'}`}>{b.kind === 'out' ? t.soldOut : t.fewLeft(num(b.n, lang))}</span>}
                </label>
              );
            })}
          </fieldset>
          <div className="dd-psheet-row">
            <span className="dd-label">{t.qty}</span>
            <Stepper value={qty} onChange={setQty} t={t} lang={lang} max={Math.max(1, room)} />
          </div>
          {have > 0 && <p className="dd-inbag">{t.inBag(num(have, lang))}</p>}
          <button
            type="button"
            className="dd-btn dd-btn-primary dd-btn-block"
            disabled={room <= 0 || v.stock <= 0}
            onClick={() => {
              setCart((c) => addToCart(c, products, p.id, v.id, qty));
              toast(t.added(`${name}, ${sizeLabel(v.size, lang)}`));
              onClose();
            }}
          >
            <Icon name="bag" /> {v.stock <= 0 ? t.soldOut : t.addToBag}
          </button>
          {v.stock > 0 && v.stock <= FEW_LEFT && <p className="dd-few-line">{t.fewLeft(num(v.stock, lang))}</p>}
        </div>
      </div>
    </Sheet>
  );
}

function slotDay(day: number, today: number, t: Copy, lang: Lang): string {
  if (day === today) return t.today;
  if (day === today + 1) return t.tomorrow;
  return dayLabel(day, lang, { weekday: 'long', day: 'numeric', month: 'short' });
}

function Bag({
  t,
  lang,
  products,
  cart,
  setCart,
  clock,
  onPlace,
  goOwner,
  onClose,
}: {
  t: Copy;
  lang: Lang;
  products: Product[];
  cart: CartLine[];
  setCart: StoreProps['setCart'];
  clock: StoreProps['clock'];
  onPlace: StoreProps['onPlace'];
  goOwner: StoreProps['goOwner'];
  onClose: () => void;
}) {
  const [step, setStep] = useState<'bag' | 'checkout' | 'done'>('bag');
  const [kind, setKind] = useState<Kind>('pickup');
  const [slot, setSlot] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [err, setErr] = useState('');
  const [done, setDone] = useState<Order | null>(null);
  const slots = useMemo(() => (clock ? slotsFor(clock.today, clock.nowMin, kind) : []), [clock, kind]);
  const byDay = useMemo(() => {
    const m = new Map<number, Slot[]>();
    for (const s of slots) m.set(s.day, [...(m.get(s.day) ?? []), s]);
    return [...m.entries()];
  }, [slots]);
  const n = cartCount(cart);
  const title = step === 'done' ? t.thanks : step === 'checkout' ? t.howGet : t.bag;

  const place = () => {
    const s = slots.find((x) => slotId(x) === slot);
    if (!s) {
      setErr(t.pickSlot);
      return;
    }
    const o = onPlace(s, name);
    if (o) {
      setDone(o);
      setStep('done');
    }
  };

  return (
    <Sheet title={title} onClose={onClose} closeLabel={t.close}>
      {step === 'bag' &&
        (n === 0 ? (
          <p className="dd-empty">{t.bagEmpty}</p>
        ) : (
          <>
            <ul className="dd-baglist">
              {cart.map((l) => {
                const p = products.find((x) => x.id === l.p);
                const v = p?.variants.find((x) => x.id === l.v);
                if (!p || !v) return null;
                const pname = productName(p, p.id, lang);
                return (
                  <li key={`${l.p}:${l.v}`}>
                    <ProductArt kind={p.art.kind} color={p.art.color} size={52} uid={`b-${l.p}-${l.v}`} />
                    <div className="dd-bagline">
                      <strong>{pname}</strong>
                      <span>{sizeLabel(v.size, lang)}</span>
                    </div>
                    <Stepper value={l.q} min={0} max={Math.min(9, v.stock)} onChange={(q) => setCart((c) => setCartQty(c, products, l.p, l.v, q))} t={t} lang={lang} />
                    <button type="button" className="dd-iconbtn" onClick={() => setCart((c) => setCartQty(c, products, l.p, l.v, 0))} aria-label={`${t.remove}: ${pname}`}>
                      <Icon name="trash" size={16} />
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="dd-bagtotal">{n === 1 ? t.item1 : t.items(num(n, lang))}</p>
            <button type="button" className="dd-btn dd-btn-primary dd-btn-block" onClick={() => setStep('checkout')}>
              {t.toCheckout} <Icon name="arrow" />
            </button>
          </>
        ))}

      {step === 'checkout' && (
        <div className="dd-checkout">
          <fieldset className="dd-kinds">
            <legend className="dd-sr">{t.howGet}</legend>
            {(['pickup', 'delivery'] as Kind[]).map((k) => (
              <label key={k} className={`dd-kind${kind === k ? ' is-on' : ''}`}>
                <input
                  type="radio"
                  name="dd-kind"
                  value={k}
                  checked={kind === k}
                  onChange={() => {
                    setKind(k);
                    setSlot(null);
                    setErr('');
                  }}
                />
                <Icon name={k === 'pickup' ? 'store' : 'bike'} size={22} />
                <span>
                  <strong>{k === 'pickup' ? t.kindPickup : t.kindDelivery}</strong>
                  <small>{k === 'pickup' ? t.kindPickupSub : t.kindDeliverySub}</small>
                </span>
              </label>
            ))}
          </fieldset>

          <fieldset className="dd-slots">
            <legend>{t.chooseTime}</legend>
            {byDay.length === 0 && <p>{t.noSlots}</p>}
            {clock &&
              byDay.map(([day, list]) => (
                <div key={day} className="dd-slotday">
                  <p className="dd-slotday-name">{slotDay(day, clock.today, t, lang)}</p>
                  <div className="dd-slotrow">
                    {list.map((s) => {
                      const id = slotId(s);
                      return (
                        <label key={id} className={`dd-slot${slot === id ? ' is-on' : ''}`}>
                          <input
                            type="radio"
                            name="dd-slot"
                            value={id}
                            checked={slot === id}
                            onChange={() => {
                              setSlot(id);
                              setErr('');
                            }}
                          />
                          {hhmm(s.from * 60, lang)}–{hhmm(s.to * 60, lang)}
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
          </fieldset>

          <div className="dd-field">
            <label htmlFor="dd-name">{t.yourName}</label>
            <input id="dd-name" type="text" value={name} maxLength={30} onChange={(e) => setName(e.target.value)} placeholder={t.namePh} autoComplete="off" spellCheck={false} />
            <small>{t.nameNote}</small>
          </div>

          <p className="dd-hidden-note">
            <Icon name="alert" size={16} /> {t.paymentHidden}
          </p>
          {err && (
            <p className="dd-err" role="alert">
              {err}
            </p>
          )}
          <div className="dd-row-btns">
            <button type="button" className="dd-btn dd-btn-ghost" onClick={() => setStep('bag')}>
              {t.back}
            </button>
            <button type="button" className="dd-btn dd-btn-primary" onClick={place} disabled={n === 0}>
              <Icon name="check" /> {t.placeOrder}
            </button>
          </div>
        </div>
      )}

      {step === 'done' && done && clock && (
        <div className="dd-done">
          <p className="dd-done-code-label">{done.kind === 'pickup' ? t.yourCode : t.yourCodeDelivery}</p>
          <p className="dd-done-code">{done.code}</p>
          <Qr text={qrText(done.code)} label={t.qrLabel(done.code)} />
          <p className="dd-done-help">{done.kind === 'pickup' ? t.codeHelp : t.codeHelpDelivery}</p>
          <dl className="dd-done-facts">
            <div>
              <dt>{t.kind[done.kind]}</dt>
              <dd>{done.slot ? t.slotLine(slotDay(done.slot.day, clock.today, t, lang), hhmm(done.slot.from * 60, lang), hhmm(done.slot.to * 60, lang)) : ''}</dd>
            </div>
            <div>
              <dt>{t.orderNo(done.code)}</dt>
              <dd>
                <ul>
                  {done.lines.map((l) => {
                    const p = products.find((x) => x.id === l.p);
                    const v = p?.variants.find((x) => x.id === l.v);
                    return (
                      <li key={`${l.p}:${l.v}`}>
                        {num(l.q, lang)} × {productName(p, l.p, lang)}
                        {v ? `, ${sizeLabel(v.size, lang)}` : ''}
                      </li>
                    );
                  })}
                </ul>
              </dd>
            </div>
          </dl>
          <button type="button" className="dd-btn dd-btn-primary dd-btn-block" onClick={() => goOwner(done.id)}>
            {t.seeOwner}
          </button>
          <button type="button" className="dd-btn dd-btn-ghost dd-btn-block" onClick={onClose}>
            {t.shopAgain}
          </button>
        </div>
      )}
    </Sheet>
  );
}
