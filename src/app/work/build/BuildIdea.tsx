'use client';

// /work/build — "Build your idea". Four steps on the left (what you are, name
// and colour, features, your idea); on the right a phone (and a laptop, for a
// website) that assembles itself as you pick. Rules in idea.ts, words in
// content.ts, the PNG in draw.ts.
//
// The idea lives in the link (#k=…&f=…) so it can be shared, and in
// localStorage so it is still there next time. Nothing is sent anywhere: the
// last step only OPENS the contact chat with the idea written in, and the
// visitor sends it themselves (components/CreatorChat).

import Link from 'next/link';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import {
  COLORS,
  EMPTY_IDEA,
  FEATURE,
  FEATURES,
  KIND_IDS,
  KINDS,
  LIMITS,
  MAKE_IDS,
  cleanColor,
  cleanText,
  contactHref,
  decodeIdea,
  emblemInitials,
  encodeIdea,
  featureDemoHref,
  ideaBrief,
  kindOf,
  onColor,
  pickKind,
  shade,
  slug,
  toggleFeature,
  type FeatureId,
  type Idea,
  type Lang,
} from './idea';
import { cleanInitials } from '../samaj/samaj';
import { COPY, num, type Copy } from './content';
import { drawIdea } from './draw';

const STORE = 'mn:build:v1';
const EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)';
const useIso = typeof window === 'undefined' ? useEffect : useLayoutEffect;

function useCalm(): boolean {
  const [calm, setCalm] = useState(false);
  useEffect(() => {
    const m = window.matchMedia('(prefers-reduced-motion: reduce)');
    const f = () => setCalm(m.matches);
    f();
    m.addEventListener('change', f);
    return () => m.removeEventListener('change', f);
  }, []);
  return calm;
}

/**
 * Smooth layout changes for a list: children marked data-flip="key" that
 * moved since the last render glide from where they were (FLIP), new ones
 * grow in. Positions are offsets inside `ref`, so scrolling never counts as a
 * move. Off under prefers-reduced-motion.
 */
function useFlip(ref: RefObject<HTMLElement | null>, sig: string, calm: boolean, onEnter?: (el: HTMLElement) => void) {
  const prev = useRef<Map<string, { x: number; y: number }> | null>(null);
  useIso(() => {
    const root = ref.current;
    if (!root) return;
    const next = new Map<string, { x: number; y: number }>();
    const entered: HTMLElement[] = [];
    root.querySelectorAll<HTMLElement>('[data-flip]').forEach((el) => {
      const k = el.dataset.flip!;
      const pos = { x: el.offsetLeft, y: el.offsetTop };
      next.set(k, pos);
      const was = prev.current?.get(k);
      if (!prev.current) return;
      if (!was) entered.push(el);
      if (calm || typeof el.animate !== 'function') return;
      if (!was) {
        el.animate(
          [
            { opacity: 0, transform: 'translateY(18px) scale(0.9)' },
            { opacity: 1, transform: 'none' },
          ],
          { duration: 460, easing: EASE }
        );
      } else if (was.x !== pos.x || was.y !== pos.y) {
        el.animate([{ transform: `translate(${was.x - pos.x}px, ${was.y - pos.y}px)` }, { transform: 'none' }], { duration: 380, easing: EASE });
      }
    });
    prev.current = next;
    // One new item = the visitor switched it on: bring it into view. Several at
    // once = an idea opened from a link: stay at the top.
    if (onEnter && entered.length === 1) onEnter(entered[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, calm]);
}

/** A fixed-size drawing scaled down to fit its column (never up), with no overflow. */
function Fit({ w, h, children }: { w: number; h: number; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [s, setS] = useState(1);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    // On a phone the sketch never takes more than ~60% of the screen's height.
    const measure = () => setS(Math.min(1, el.clientWidth / w, window.innerWidth < 900 ? (window.innerHeight * 0.6) / h : 1));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [w]);
  return (
    <div ref={box} className="bd-fit" style={{ height: Math.ceil(h * s) }}>
      <div className="bd-fit-in" style={{ width: w, height: h, transform: `translateX(-50%) scale(${s})` }}>
        {children}
      </div>
    </div>
  );
}

function Emblem({ letters, size = 40, ring = false }: { letters: string; size?: number; ring?: boolean }) {
  const n = Array.from(letters).length;
  return (
    <svg className="bd-emblem" width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r="48" fill="var(--bd-on)" />
      <circle cx="50" cy="50" r="40" fill="none" stroke="var(--bd-c)" strokeWidth="3" strokeDasharray={ring ? '2 5' : undefined} opacity="0.55" />
      <path d="M22 70 L38 48 L46 58 L58 38 L78 70 Z" fill="var(--bd-c)" opacity="0.14" />
      <text x="50" y="52" textAnchor="middle" dominantBaseline="central" fontWeight="800" fontSize={n > 2 ? 26 : n > 1 ? 32 : 40} fill="var(--bd-c)">
        {letters}
      </text>
    </svg>
  );
}

/** A made-up QR code, the same every time for the same seed. */
function FakeQr({ seed, size = 46 }: { seed: string; size?: number }) {
  const cells = useMemo(() => {
    let h = 2166136261;
    for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    const out: [number, number][] = [];
    for (let y = 0; y < 9; y++)
      for (let x = 0; x < 9; x++) {
        const finder = (x < 3 && y < 3) || (x > 5 && y < 3) || (x < 3 && y > 5);
        if (finder) continue;
        h = Math.imul(h ^ (x * 31 + y), 16777619);
        if ((h >>> 13) & 1) out.push([x, y]);
      }
    return out;
  }, [seed]);
  return (
    <svg className="bd-qr" width={size} height={size} viewBox="0 0 9 9" aria-hidden="true" shapeRendering="crispEdges">
      <rect width="9" height="9" fill="#fff" />
      {[
        [0, 0],
        [6, 0],
        [0, 6],
      ].map(([x, y]) => (
        <g key={`${x}${y}`}>
          <rect x={x} y={y} width="3" height="3" fill="#1c1917" />
          <rect x={x + 0.6} y={y + 0.6} width="1.8" height="1.8" fill="#fff" />
          <rect x={x + 1} y={y + 1} width="1" height="1" fill="#1c1917" />
        </g>
      ))}
      {cells.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="#1c1917" />
      ))}
    </svg>
  );
}

/** One feature as a block inside the phone. */
function Block({ id, t, name, seed }: { id: FeatureId; t: Copy; name: string; seed: string }) {
  const m = t.mock;
  const body = (() => {
    switch (id) {
      case 'tickets':
        return (
          <div className="bd-ticket">
            <div>
              <strong>{name}</strong>
              <span>{m.admit}</span>
              <em className="bd-pill bd-pill-ok">{m.checkedIn}</em>
            </div>
            <FakeQr seed={`${seed}-t`} />
          </div>
        );
      case 'menu':
        return (
          <div className="bd-menu">
            {m.dishes.map((d, i) => (
              <div key={d} className="bd-dish">
                <span className="bd-dish-dot" style={{ opacity: 1 - i * 0.22 }} />
                <span>{d}</span>
                <b aria-hidden="true">+</b>
              </div>
            ))}
            <div className="bd-cta-row">
              <span>{m.table}</span>
              <span className="bd-btn">{m.sendKitchen}</span>
            </div>
          </div>
        );
      case 'shop':
        return (
          <div className="bd-shop">
            <div className="bd-prods">
              {m.products.map((p, i) => (
                <div key={p} className="bd-prod">
                  <span className="bd-prod-pic" aria-hidden="true">
                    {i ? '🫙' : '🧢'}
                  </span>
                  <span>{p}</span>
                </div>
              ))}
            </div>
            <div className="bd-cta-row">
              <span>{m.pickup}</span>
              <code>K7Q2</code>
            </div>
          </div>
        );
      case 'booking':
        return (
          <div className="bd-book">
            <div className="bd-days">
              {m.days.map((d, i) => (
                <span key={d} className={i === 2 ? 'is-on' : ''}>
                  {d}
                </span>
              ))}
            </div>
            <div className="bd-slots">
              <span>10:00</span>
              <span className="is-on">17:30</span>
              <span className="bd-btn">{m.book}</span>
            </div>
          </div>
        );
      case 'members':
        return (
          <div className="bd-member">
            <div>
              <strong>{m.memberCard}</strong>
              <span>{name}</span>
              <span>{m.member}</span>
            </div>
            <FakeQr seed={`${seed}-m`} size={40} />
          </div>
        );
      case 'quiz':
        return (
          <div className="bd-quiz">
            <strong>{m.quizQ}</strong>
            {m.quizA.map((a, i) => (
              <span key={a} className={`bd-ans${i === 1 ? ' is-on' : ''}`} style={{ ['--w' as string]: `${[38, 72, 18, 26][i]}%` }}>
                <i>{'ABCD'[i]}</i> {a}
              </span>
            ))}
          </div>
        );
      case 'dashboard':
        return (
          <div className="bd-dash">
            <div className="bd-dash-top">
              <span>{m.inside}</span>
              <strong>312 / 400</strong>
            </div>
            <span className="bd-meter">
              <i style={{ width: '78%' }} />
            </span>
            <div className="bd-bars" aria-hidden="true">
              {[30, 52, 74, 96, 68, 44, 22].map((h, i) => (
                <i key={i} style={{ height: `${h}%` }} />
              ))}
            </div>
          </div>
        );
      case 'lang':
        return (
          <div className="bd-lang">
            <span className="is-on">EN</span>
            <span>DE</span>
            <span lang="ne">नेपाली</span>
            <em lang="ne">नमस्ते · Willkommen</em>
          </div>
        );
      case 'chat':
        return (
          <div className="bd-chat">
            <span className="bd-bub bd-bub-in">{m.chatGuest}</span>
            <span className="bd-bub bd-bub-out">{m.chatReply}</span>
          </div>
        );
      case 'news':
        return (
          <div className="bd-news">
            <span className="bd-bub bd-bub-wa">📣 {m.newsText}</span>
            <span className="bd-btn">{m.getUpdates}</span>
          </div>
        );
      case 'gallery':
        return (
          <div className="bd-gal" aria-hidden="true">
            {['🪁', '🪔', '🎉', '🏔️', '💃', '🍛'].map((e, i) => (
              <span key={e} style={{ ['--h' as string]: `${(i * 47) % 360}` }}>
                {e}
              </span>
            ))}
          </div>
        );
      case 'video':
        return (
          <div className="bd-reel">
            <span className="bd-reel-frame">
              <b aria-hidden="true">▶</b>
            </span>
            <span>
              <strong>{name}</strong>
              <em>{m.reel}</em>
            </span>
          </div>
        );
      case 'stage':
        return (
          <div className="bd-stagevis">
            <em>{m.walkOn}</em>
            <strong>{name}</strong>
          </div>
        );
    }
  })();
  return (
    <section className={`bd-blk bd-blk-${id}`} data-flip={id}>
      <h4>
        <span aria-hidden="true">{FEATURE[id].icon}</span> {t.features[id].tab}
      </h4>
      {body}
    </section>
  );
}

/** "📱 An app" → the emoji and the words, with a real gap between them. */
function IconText({ s }: { s: string }) {
  const m = s.match(/^([^\p{L}\p{N}]+?)\s*([\p{L}\p{N}].*)$/u);
  if (!m) return <>{s}</>;
  return (
    <>
      <span className="bd-ic" aria-hidden="true">
        {m[1]}
      </span>
      {m[2]}
    </>
  );
}

type Look = { name: string; tagline: string; letters: string; placeholder: boolean };

function Phone({ idea, t, look, calm }: { idea: Idea; t: Copy; look: Look; calm: boolean }) {
  const blocks = useRef<HTMLDivElement>(null);
  const tabs = useRef<HTMLDivElement>(null);
  const sig = idea.features.join('.');
  useFlip(blocks, sig, calm, (el) => {
    const box = blocks.current;
    if (!box) return;
    box.scrollTo({ top: Math.max(0, el.offsetTop - 12), behavior: calm ? 'auto' : 'smooth' });
  });
  useFlip(tabs, sig, calm);
  const kind = kindOf(idea);
  return (
    <div className="bd-phone">
      <div className="bd-phone-island" aria-hidden="true" />
      <div className="bd-screen">
        <header className="bd-app-head">
          <Emblem letters={look.letters} size={38} />
          <div className={look.placeholder ? 'is-placeholder' : ''}>
            <strong translate="no">{look.name}</strong>
            <span translate="no">{look.tagline}</span>
          </div>
        </header>
        <div className="bd-blocks" ref={blocks}>
          <section className="bd-hero" data-flip="hero">
            <span className="bd-hero-icon" aria-hidden="true">
              {kind.icon}
            </span>
            <span>
              <strong>{t.mock.welcome}</strong>
              <em translate="no">{look.name}</em>
            </span>
          </section>
          {idea.features.map((f) => (
            <Block key={f} id={f} t={t} name={look.name} seed={look.name} />
          ))}
          {idea.features.length === 0 && (
            <p className="bd-empty" data-flip="empty">
              {t.mock.emptyApp}
            </p>
          )}
        </div>
        <nav className="bd-tabs" ref={tabs} aria-hidden="true">
          <span className="bd-tab is-on" data-flip="home">
            <b>🏠</b>
            {t.mock.home}
          </span>
          {idea.features.slice(0, 4).map((f) => (
            <span key={f} className="bd-tab" data-flip={f}>
              <b>{FEATURE[f].icon}</b>
              {t.features[f].tab}
            </span>
          ))}
        </nav>
      </div>
    </div>
  );
}

function Laptop({ idea, t, look, calm }: { idea: Idea; t: Copy; look: Look; calm: boolean }) {
  const grid = useRef<HTMLDivElement>(null);
  const nav = useRef<HTMLDivElement>(null);
  const sig = idea.features.join('.');
  useFlip(grid, sig, calm);
  useFlip(nav, sig, calm);
  const kind = kindOf(idea);
  return (
    <div className="bd-laptop">
      <div className="bd-lid">
        <div className="bd-chrome" aria-hidden="true">
          <i />
          <i />
          <i />
          <span className="bd-url" translate="no">
            {slug(look.name)}.de
          </span>
        </div>
        <div className="bd-site">
          <header className="bd-site-nav">
            <span className="bd-site-brand">
              <Emblem letters={look.letters} size={26} />
              <strong translate="no">{look.name}</strong>
            </span>
            <span className="bd-site-links" ref={nav}>
              <span data-flip="home">{t.mock.home}</span>
              {idea.features.slice(0, 3).map((f) => (
                <span key={f} data-flip={f}>
                  {t.features[f].tab}
                </span>
              ))}
            </span>
          </header>
          <section className="bd-site-hero">
            <span className="bd-site-icon" aria-hidden="true">
              {kind.icon}
            </span>
            <strong translate="no">{look.name}</strong>
            <span translate="no">{look.tagline}</span>
            <span className="bd-btn">{t.mock.cta}</span>
          </section>
          <div className="bd-site-grid" ref={grid}>
            {idea.features.map((f) => (
              <span key={f} className="bd-site-tile" data-flip={f}>
                <b aria-hidden="true">{FEATURE[f].icon}</b>
                {t.features[f].tab}
              </span>
            ))}
            {idea.features.length === 0 && (
              <span className="bd-site-empty" data-flip="empty">
                {t.mock.emptyApp}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="bd-base" aria-hidden="true" />
    </div>
  );
}

export default function BuildIdea({ initialLang, font }: { initialLang: Lang; font: string }) {
  const lang = initialLang;
  const t = COPY[lang];
  const calm = useCalm();
  const [idea, setIdea] = useState<Idea>(EMPTY_IDEA);
  const [loaded, setLoaded] = useState(false);
  const [device, setDevice] = useState<'phone' | 'laptop'>('phone');
  const [wide, setWide] = useState(false);
  const [offStage, setOffStage] = useState(false);
  const [copied, setCopied] = useState<'' | 'ok' | 'fail'>('');
  const [drawing, setDrawing] = useState(false);
  const [say, setSay] = useState('');
  const stage = useRef<HTMLDivElement>(null);
  const barIcons = useRef<HTMLSpanElement>(null);

  // Start from the link, else from last time on this device.
  useEffect(() => {
    let start = decodeIdea(window.location.hash);
    if (!start) {
      try {
        start = decodeIdea(localStorage.getItem(STORE) ?? '');
      } catch {
        /* private mode */
      }
    }
    if (start) setIdea(start);
    setLoaded(true);
    const onHash = () => {
      const d = decodeIdea(window.location.hash);
      if (d) setIdea(d);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // …and keep both up to date (the link only once there is something in it).
  const encoded = encodeIdea(idea);
  const blank = encoded === encodeIdea(EMPTY_IDEA);
  useEffect(() => {
    if (!loaded) return;
    const id = window.setTimeout(() => {
      const want = blank ? '' : `#${encoded}`;
      if (window.location.hash !== want) {
        window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}${want}`);
      }
      try {
        if (blank) localStorage.removeItem(STORE);
        else localStorage.setItem(STORE, encoded);
      } catch {
        /* fine */
      }
    }, 180);
    return () => window.clearTimeout(id);
  }, [encoded, blank, loaded]);

  // Wide enough for the phone in front of the laptop?
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const measure = () => setWide(el.clientWidth >= 440);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    // Phones: once the sketch has scrolled away, a small bar keeps it in sight.
    const io = new IntersectionObserver(([e]) => setOffStage(!e.isIntersecting), { threshold: 0.05 });
    io.observe(el);
    return () => {
      ro.disconnect();
      io.disconnect();
    };
  }, []);
  useEffect(() => {
    if (idea.make === 'app') setDevice('phone');
    if (idea.make === 'web') setDevice('laptop');
  }, [idea.make]);
  useFlip(barIcons, idea.features.join('.'), calm);

  const kindText = idea.kind ? t.kinds[idea.kind] : t.kinds.other;
  const look: Look = {
    name: idea.name.trim() || (idea.kind ? kindText.sample : t.kinds.other.sample),
    tagline: idea.tagline.trim() || kindText.line,
    letters: emblemInitials(idea, idea.kind ? kindText.sample : t.kinds.other.sample),
    placeholder: !idea.name.trim(),
  };
  const c = idea.color;
  const vars = {
    '--bd-c': c,
    '--bd-on': onColor(c),
    '--bd-deep': shade(c, -0.42),
    '--bd-soft': shade(c, 0.86),
    '--bd-mid': shade(c, 0.6),
    '--bd-font': font,
  } as CSSProperties;
  const brief = useMemo(() => ideaBrief(idea, t.brief), [idea, t]);
  const kindLabel = idea.kind === 'other' ? idea.other.trim() || t.kinds.other.label : idea.kind ? t.kinds[idea.kind].label : t.summary.notYet;
  const makeLabel = t.make[idea.make].replace(/^[^\p{L}]+/u, '');
  const preset = COLORS.find((x) => x.hex === c);

  const update = (patch: Partial<Idea>) => setIdea((i) => ({ ...i, ...patch }));
  const flip = (f: FeatureId) => {
    const on = !idea.features.includes(f);
    setIdea((i) => toggleFeature(i, f));
    setSay(on ? t.added(t.features[f].label) : t.removed(t.features[f].label));
  };

  async function copyLink() {
    const url = `${window.location.origin}${window.location.pathname}#${encoded}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied('ok');
    } catch {
      setCopied('fail');
    }
    window.setTimeout(() => setCopied(''), 2600);
  }

  function download() {
    setDrawing(true);
    // A frame later, so "Drawing…" shows on slow phones.
    window.setTimeout(() => {
      try {
        const canvas = drawIdea(idea, t, { name: look.name, tagline: look.tagline, initials: look.letters, kindLabel, makeLabel }, font);
        canvas.toBlob((b) => {
          setDrawing(false);
          if (!b) return;
          const url = URL.createObjectURL(b);
          const a = document.createElement('a');
          a.href = url;
          a.download = `idea-${slug(look.name)}.png`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          window.setTimeout(() => URL.revokeObjectURL(url), 5000);
        }, 'image/png');
      } catch {
        setDrawing(false);
      }
    }, 30);
  }

  function reset() {
    setIdea(EMPTY_IDEA);
    setSay('');
  }

  const showPhone = idea.make !== 'web' && (idea.make === 'app' || wide || device === 'phone');
  const showLaptop = idea.make !== 'app' && (idea.make === 'web' || wide || device === 'laptop');
  const both = showPhone && showLaptop;
  const done = { kind: Boolean(idea.kind), name: Boolean(idea.name.trim()), features: idea.features.length > 0 };

  const stageBox = (
    <div className={`bd-stage-box${both ? ' is-both' : ''}`}>
      {both ? (
        <Fit w={680} h={540}>
          <div className="bd-combo">
            <div className="bd-combo-laptop">
              <Laptop idea={idea} t={t} look={look} calm={calm} />
            </div>
            <div className="bd-combo-phone">
              <Phone idea={idea} t={t} look={look} calm={calm} />
            </div>
          </div>
        </Fit>
      ) : showLaptop ? (
        <Fit w={600} h={400}>
          <Laptop idea={idea} t={t} look={look} calm={calm} />
        </Fit>
      ) : (
        <Fit w={300} h={600}>
          <Phone idea={idea} t={t} look={look} calm={calm} />
        </Fit>
      )}
    </div>
  );

  return (
    <div className="bd" style={vars}>
      <div className="bd-grid">
        <div className="bd-stage" ref={stage} aria-label={t.mock.sketchLabel} role="region">
          {idea.make === 'both' && !wide && (
            <div className="bd-devices" role="group" aria-label={t.mock.sketchLabel}>
              <button type="button" aria-pressed={device === 'phone'} onClick={() => setDevice('phone')}>
                <IconText s={t.mock.showPhone} />
              </button>
              <button type="button" aria-pressed={device === 'laptop'} onClick={() => setDevice('laptop')}>
                <IconText s={t.mock.showLaptop} />
              </button>
            </div>
          )}
          {stageBox}
          <p className="bd-free">{t.free}</p>
        </div>

        <div className="bd-steps">
          {/* 1 — what are you */}
          <section className={`bd-step${done.kind ? ' is-done' : ''}`} aria-labelledby="bd-s1">
            <h2 id="bd-s1">
              <span className="bd-num">{done.kind ? '✓' : num(1, lang)}</span> {t.steps.kind}
            </h2>
            <p className="bd-hint">{t.stepHint.kind}</p>
            <div className="bd-kinds" role="group" aria-labelledby="bd-s1">
              {KIND_IDS.map((k) => (
                <button key={k} type="button" className="bd-kind" aria-pressed={idea.kind === k} onClick={() => setIdea((i) => pickKind(i, k))} style={{ ['--k' as string]: KINDS[k].color }}>
                  <span aria-hidden="true">{KINDS[k].icon}</span>
                  {t.kinds[k].label}
                </button>
              ))}
            </div>
            {idea.kind === 'other' && (
              <label className="bd-field">
                <span>{t.otherLabel}</span>
                <input
                  value={idea.other}
                  maxLength={LIMITS.other}
                  placeholder={t.otherPlaceholder}
                  onChange={(e) => update({ other: cleanText(e.target.value, LIMITS.other) })}
                  translate="no"
                />
              </label>
            )}
            <div className="bd-make" role="group" aria-label={t.makeLabel}>
              <span className="bd-make-label">{t.makeLabel}</span>
              {MAKE_IDS.map((m) => (
                <button key={m} type="button" aria-pressed={idea.make === m} onClick={() => update({ make: m })}>
                  <IconText s={t.make[m]} />
                </button>
              ))}
            </div>
          </section>

          {/* 2 — name & colour */}
          <section className={`bd-step${done.name ? ' is-done' : ''}`} aria-labelledby="bd-s2">
            <h2 id="bd-s2">
              <span className="bd-num">{done.name ? '✓' : num(2, lang)}</span> {t.steps.name}
            </h2>
            <p className="bd-hint">{t.stepHint.name}</p>
            <div className="bd-name-row">
              <div className="bd-name-fields">
                <label className="bd-field">
                  <span>{t.nameLabel}</span>
                  <input
                    id="bd-name"
                    value={idea.name}
                    maxLength={LIMITS.name}
                    placeholder={idea.kind ? kindText.sample : t.kinds.other.sample}
                    onChange={(e) => update({ name: cleanText(e.target.value, LIMITS.name) })}
                    autoComplete="organization"
                    translate="no"
                  />
                </label>
                <label className="bd-field">
                  <span>
                    {t.taglineLabel} <small>· {t.optional}</small>
                  </span>
                  <input
                    value={idea.tagline}
                    maxLength={LIMITS.tagline}
                    placeholder={kindText.line}
                    onChange={(e) => update({ tagline: cleanText(e.target.value, LIMITS.tagline) })}
                    autoComplete="off"
                    translate="no"
                  />
                </label>
              </div>
              <div className="bd-emblem-box">
                <span className="bd-emblem-label">{t.emblemLabel}</span>
                <Emblem letters={look.letters} size={92} ring />
                <label className="bd-field bd-field-sm">
                  <span>{t.initialsLabel}</span>
                  <input
                    value={idea.initials}
                    placeholder={emblemInitials({ ...idea, initials: '' }, look.name)}
                    onChange={(e) => update({ initials: cleanInitials(e.target.value) })}
                    aria-describedby="bd-ini-hint"
                    autoComplete="off"
                    translate="no"
                  />
                </label>
                <small id="bd-ini-hint" className="bd-hint-sm">
                  {t.initialsHint}
                </small>
              </div>
            </div>
            <div className="bd-colours" role="group" aria-label={t.colourLabel}>
              <span className="bd-make-label">{t.colourLabel}</span>
              {COLORS.map((col) => (
                <button
                  key={col.id}
                  type="button"
                  className="bd-swatch"
                  style={{ background: col.hex }}
                  aria-pressed={c === col.hex}
                  aria-label={t.colours[col.id]}
                  title={t.colours[col.id]}
                  onClick={() => update({ color: col.hex })}
                />
              ))}
              <label className={`bd-swatch bd-swatch-own${preset ? '' : ' is-on'}`} title={t.customColour} style={preset ? undefined : { background: c }}>
                <span className="bd-sr">{t.customColour}</span>
                <input type="color" value={c} onChange={(e) => update({ color: cleanColor(e.target.value) ?? c })} />
              </label>
              <code className="bd-hex">{c}</code>
            </div>
          </section>

          {/* 3 — features */}
          <section className={`bd-step${done.features ? ' is-done' : ''}`} aria-labelledby="bd-s3">
            <h2 id="bd-s3">
              <span className="bd-num">{done.features ? '✓' : num(3, lang)}</span> {t.steps.features}
            </h2>
            <p className="bd-hint">{t.stepHint.features}</p>
            <ul className="bd-feats">
              {FEATURES.map((f) => {
                const on = idea.features.includes(f.id);
                const demo = featureDemoHref(f.id);
                const suggested = kindOf(idea).suggest.includes(f.id);
                return (
                  <li key={f.id} className={`bd-feat${on ? ' is-on' : ''}`}>
                    <button type="button" className="bd-feat-btn" aria-pressed={on} onClick={() => flip(f.id)} data-feature={f.id}>
                      <span className="bd-feat-icon" aria-hidden="true">
                        {f.icon}
                      </span>
                      <span className="bd-feat-text">
                        <strong>{t.features[f.id].label}</strong>
                        <span>{t.features[f.id].line}</span>
                      </span>
                      <span className="bd-switch" aria-hidden="true">
                        <i />
                      </span>
                    </button>
                    {(suggested || demo) && (
                      <span className="bd-feat-foot">
                        {suggested && <span className="bd-sugg">{t.suggested}</span>}
                        {demo && (
                          <Link href={demo} className="bd-see">
                            {t.seeIt}
                          </Link>
                        )}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>

          {/* 4 — your idea */}
          <section className="bd-step bd-step-sum" aria-labelledby="bd-s4" id="idea">
            <h2 id="bd-s4">
              <span className="bd-num">{num(4, lang)}</span> {t.steps.summary}
            </h2>
            <p className="bd-hint">{t.stepHint.summary}</p>
            <div className="bd-sum">
              <header className="bd-sum-head">
                <Emblem letters={look.letters} size={56} />
                <div>
                  <span className="bd-sum-kicker">{t.summary.title}</span>
                  <strong translate="no">{look.name}</strong>
                  <span translate="no">{look.tagline}</span>
                </div>
              </header>
              <dl className="bd-sum-list">
                <div>
                  <dt>{t.summary.what}</dt>
                  <dd translate="no">
                    {idea.kind && (
                      <span className="bd-ic" aria-hidden="true">
                        {kindOf(idea).icon}
                      </span>
                    )}
                    {kindLabel}
                  </dd>
                </div>
                <div>
                  <dt>{t.summary.make}</dt>
                  <dd>
                    <IconText s={t.make[idea.make]} />
                  </dd>
                </div>
                <div>
                  <dt>{t.summary.colour}</dt>
                  <dd>
                    <span className="bd-dot" style={{ background: c }} /> {preset ? t.colours[preset.id] : t.customColour} · <code>{c}</code>
                  </dd>
                </div>
                <div className="bd-sum-feats">
                  <dt>
                    {t.summary.features} · {num(idea.features.length, lang)}
                  </dt>
                  <dd>
                    {idea.features.length ? (
                      <ul>
                        {idea.features.map((f) => (
                          <li key={f}>
                            <span className="bd-ic" aria-hidden="true">
                              {FEATURE[f].icon}
                            </span>
                            {t.features[f].label}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      t.summary.none
                    )}
                  </dd>
                </div>
              </dl>
              <div className="bd-actions">
                <Link href={contactHref(idea, brief)} className="sh-btn sh-btn-main bd-send" data-send>
                  {t.summary.send}
                </Link>
                <p className="bd-send-hint">{t.summary.sendHint}</p>
                <div className="bd-actions-row">
                  <button type="button" className="sh-btn" onClick={() => void copyLink()} data-copy>
                    {copied === 'ok' ? t.summary.copied : t.summary.copy}
                  </button>
                  <button type="button" className="sh-btn" onClick={download} disabled={drawing} data-download>
                    {drawing ? t.summary.downloading : t.summary.download}
                  </button>
                </div>
                {copied === 'fail' && <p className="bd-hint-sm">{t.summary.copyFail}</p>}
                <p className="bd-saved">
                  {loaded && !blank ? t.summary.saved : ''}
                  {!blank && (
                    <button type="button" className="bd-reset" onClick={reset}>
                      {t.summary.reset}
                    </button>
                  )}
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Phones: the sketch, small, while it is scrolled out of view. */}
      <div className={`bd-bar${offStage ? ' is-shown' : ''}`} aria-hidden={!offStage}>
        <Emblem letters={look.letters} size={30} />
        <span className="bd-bar-text">
          <strong translate="no">{look.name}</strong>
          <span className="bd-bar-icons" ref={barIcons}>
            {idea.features.map((f) => (
              <b key={f} data-flip={f}>
                {FEATURE[f].icon}
              </b>
            ))}
            {!idea.features.length && <em>{t.bar(num(0, lang))}</em>}
          </span>
        </span>
        <button
          type="button"
          tabIndex={offStage ? 0 : -1}
          onClick={() => stage.current?.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' })}
        >
          {t.barShow}
        </button>
      </div>
      <p className="bd-sr" aria-live="polite">
        {say}
      </p>
    </div>
  );
}
