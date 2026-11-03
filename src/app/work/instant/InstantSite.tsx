'use client';

// "Your website in 10 seconds" (studio demo #16, /work/instant). A visitor
// types a name, picks a kind (and a city) and watches a whole landing page
// build itself in a framed browser — then remixes it: eight styles, new words,
// a colour, sections on / off / reordered, their own headings; desktop, tablet
// and phone widths; a before / after slider; a share link, an offline .html
// and "Make it real — Kura garau" to the contact chat (written in, never sent).
//
// Everything runs here: the generator is pure (instant.ts), the site is one
// static HTML string shown in a sandboxed iframe (srcdoc, no scripts allowed),
// the state lives in the #hash and one localStorage key. The root is
// translate="no" so nothing typed here ever reaches the site's translator.

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { setSiteLangCookie } from '@/components/studio/siteLang';
import { COPY, LANGS, type Lang } from './content';
import {
  DEVICES,
  KIND_IDS,
  LIMITS,
  STORE_KEY,
  STYLES,
  SWATCHES,
  cleanSaved,
  contactHref,
  decodeSite,
  demoHost,
  encodeSite,
  fileName,
  generate,
  instantBrief,
  moveSection,
  newSite,
  onSections,
  palette,
  placeSection,
  setColor,
  setEdit,
  shuffleStyle,
  shuffleWords,
  siteHtml,
  timeline,
  toggleSection,
  type Device,
  type EditKey,
  type KindId,
  type SectionId,
  type Site,
} from './instant';

type Phase = 'form' | 'building' | 'ready';

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

/** The width of an element, kept up to date (a callback ref, so it follows the element in and out). */
function useWidth<T extends HTMLElement>(): [(el: T | null) => void, number] {
  const [w, setW] = useState(0);
  const ro = useRef<ResizeObserver | null>(null);
  const ref = useCallback((el: T | null) => {
    ro.current?.disconnect();
    ro.current = null;
    if (!el) return;
    const set = () => setW(el.clientWidth);
    set();
    ro.current = new ResizeObserver(set);
    ro.current.observe(el);
  }, []);
  return [ref, w];
}

function readSaved(): { site: Site | null; device: Device } {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? cleanSaved(JSON.parse(raw)) : { site: null, device: 'desktop' };
  } catch {
    return { site: null, device: 'desktop' };
  }
}

export default function InstantSite({ initialLang }: { initialLang: Lang }) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [lang, setLangState] = useState<Lang>(initialLang);
  const c = COPY[lang];

  const [form, setForm] = useState<{ name: string; kind: KindId; city: string }>({ name: '', kind: 'restaurant', city: '' });
  const [formError, setFormError] = useState(false);
  const [site, setSite] = useState<Site | null>(null);
  /** The site the preview shows (headings typed in arrive a moment later). */
  const [shown, setShown] = useState<Site | null>(null);
  const [phase, setPhase] = useState<Phase>('form');
  const [step, setStep] = useState(0);
  const [anim, setAnim] = useState<{ site: Site; run: number } | null>(null);
  const [device, setDevice] = useState<Device>('desktop');
  const [month0, setMonth0] = useState(0);
  const [announce, setAnnounce] = useState('');
  const [split, setSplit] = useState(50);
  const [copied, setCopied] = useState<'' | 'ok' | 'fail'>('');
  const [dragId, setDragId] = useState<SectionId | null>(null);
  const [boxH, setBoxH] = useState(620);
  const [loaded, setLoaded] = useState(false);

  const frameRef = useRef<HTMLIFrameElement>(null);
  const previewRef = useRef<HTMLHeadingElement>(null);
  const timers = useRef<number[]>([]);
  const runRef = useRef(0);
  const editing = useRef(false);
  const savedScroll = useRef(0);
  const [viewRef, viewW] = useWidth<HTMLDivElement>();
  const [baRef, baW] = useWidth<HTMLDivElement>();

  const say = useCallback((m: string) => {
    setAnnounce('');
    window.setTimeout(() => setAnnounce(m), 30);
  }, []);

  // ----- mount: the link's #hash, else what this browser kept -----
  useEffect(() => {
    setMonth0(new Date().getMonth());
    const fit = () => setBoxH(Math.round(Math.min(720, Math.max(440, window.innerHeight * 0.72))));
    fit();
    window.addEventListener('resize', fit);
    const fromHash = decodeSite(window.location.hash);
    const saved = readSaved();
    const s = fromHash ?? saved.site;
    let hadSaved = false;
    try {
      hadSaved = !!localStorage.getItem(STORE_KEY);
    } catch {
      /* ignore */
    }
    // A phone starts on the phone width (the desktop one is tiny there); a saved choice wins.
    setDevice(hadSaved ? saved.device : window.innerWidth < 700 ? 'phone' : 'desktop');
    if (s) {
      setSite(s);
      setForm({ name: s.name, kind: s.kind, city: s.city });
      setPhase('ready');
    }
    setLoaded(true);
    const onHash = () => {
      const d = decodeSite(window.location.hash);
      if (d) {
        setSite(d);
        setForm({ name: d.name, kind: d.kind, city: d.city });
        setPhase('ready');
      }
    };
    window.addEventListener('hashchange', onHash);
    return () => {
      window.removeEventListener('resize', fit);
      window.removeEventListener('hashchange', onHash);
      timers.current.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  // ----- the site → the preview (typed headings wait a beat), the link, this browser -----
  useEffect(() => {
    const t = window.setTimeout(() => setShown(site), editing.current ? 260 : 0);
    editing.current = false;
    return () => window.clearTimeout(t);
  }, [site]);

  useEffect(() => {
    if (!loaded) return;
    try {
      const want = site ? `#${encodeSite(site)}` : '';
      if (window.location.hash !== want) {
        window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}${want}`);
      }
      if (site) localStorage.setItem(STORE_KEY, JSON.stringify({ v: 1, site: encodeSite(site), device }));
      else localStorage.removeItem(STORE_KEY);
    } catch {
      /* private window: the link still works, this browser just forgets */
    }
  }, [site, device, loaded]);

  const staticHtml = useMemo(() => (shown ? siteHtml(shown, lang, { month0 }) : ''), [shown, lang, month0]);
  const frameHtml = useMemo(() => {
    if (!shown) return '';
    if (anim && anim.site === shown) return siteHtml(shown, lang, { month0, animate: true, run: anim.run });
    return staticHtml;
  }, [shown, anim, lang, month0, staticHtml]);
  const gen = useMemo(() => (site ? generate(site, lang, { month0 }) : null), [site, lang, month0]);

  // ----- the build show -----
  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };

  const frameWin = () => {
    try {
      return frameRef.current?.contentWindow ?? null;
    } catch {
      return null;
    }
  };

  const scrollFrame = useCallback(
    (key: string) => {
      const win = frameWin();
      if (!win) return;
      try {
        const el = key === 'top' ? null : win.document.getElementById(key);
        win.scrollTo({ top: el ? Math.max(0, el.offsetTop - 70) : 0, behavior: reduce ? 'auto' : 'smooth' });
      } catch {
        /* the frame is between documents */
      }
    },
    [reduce]
  );

  const finish = useCallback(() => {
    clearTimers();
    setPhase('ready');
    say(COPY[lang].said.done);
  }, [lang, say]);

  const start = (s: Site, animate: boolean) => {
    clearTimers();
    setSite(s);
    savedScroll.current = 0;
    if (!animate || reduce) {
      setAnim(null);
      setPhase('ready');
      say(c.said.done);
    } else {
      runRef.current += 1;
      setAnim({ site: s, run: runRef.current });
      setPhase('building');
      setStep(0);
      const tl = timeline(onSections(s));
      tl.forEach((t, i) => {
        timers.current.push(
          window.setTimeout(() => {
            setStep(i);
            if (t.key === 'done') {
              finish();
              timers.current.push(window.setTimeout(() => scrollFrame('top'), 700));
            } else if (i >= 3) scrollFrame(t.key);
          }, t.at)
        );
      });
    }
    window.requestAnimationFrame(() => {
      previewRef.current?.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
      previewRef.current?.focus({ preventScroll: true });
    });
  };

  const skip = () => {
    clearTimers();
    setAnim(null);
    finish();
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setFormError(true);
      return;
    }
    setFormError(false);
    start(newSite(form.name, form.kind, form.city), true);
  };

  const onFrameLoad = () => {
    const win = frameWin();
    if (!win) return;
    try {
      if (savedScroll.current) win.scrollTo(0, savedScroll.current);
      win.addEventListener('scroll', () => {
        savedScroll.current = win.scrollY;
      });
    } catch {
      /* ignore */
    }
  };

  // ----- remix -----
  const change = (next: Site, msg?: string) => {
    if (phase === 'building') {
      clearTimers();
      setPhase('ready');
    }
    setAnim(null);
    setSite(next);
    if (msg) say(msg);
  };

  const styleName = site ? c.styles[STYLES[site.style].id] : '';

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

  const shareUrl = site && loaded ? `${window.location.origin}/work/instant#${encodeSite(site)}` : '';

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied('ok');
      say(c.copied);
    } catch {
      setCopied('fail');
    }
    window.setTimeout(() => setCopied(''), 2500);
  };

  const download = () => {
    if (!site) return;
    const blob = new Blob([siteHtml(site, lang, { month0 })], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName(site.name);
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  const reset = () => {
    clearTimers();
    setSite(null);
    setAnim(null);
    setPhase('form');
    setForm({ name: '', kind: 'restaurant', city: '' });
    setSplit(50);
    try {
      localStorage.removeItem(STORE_KEY);
    } catch {
      /* ignore */
    }
    say(c.said.reset);
    window.requestAnimationFrame(() => document.getElementById('in-name')?.focus());
  };

  const brief = site ? instantBrief(site, c.brief, styleName, (id) => c.sectionNames[id]) : '';

  // ----- sizes -----
  const devW = DEVICES.find((d) => d.id === device)!.width;
  const scale = viewW ? Math.min(1, viewW / devW) : 1;
  const baLogical = baW && baW < 560 ? 390 : 1100;
  const baScale = baW ? baW / baLogical : 0.5;
  const baH = baW && baW < 560 ? 420 : 380;

  const tl = site ? timeline(onSections(anim?.site ?? site)) : [];
  const stepKey = tl[Math.min(step, tl.length - 1)]?.key ?? 'palette';
  const pct = tl.length > 1 ? Math.round((Math.min(step, tl.length - 1) / (tl.length - 1)) * 100) : 0;
  const fitted = site?.color ? palette(STYLES[site.style], site.color).primary : null;

  const initial = (site?.name ?? '?').trim().charAt(0).toUpperCase() || '?';

  return (
    <div className="in" translate="no">
      <div className="in-top">
        <div className="in-wrap">
          <div className="in-lang" role="group" aria-label={c.langLabel}>
            {LANGS.map((l) => (
              <button key={l.id} type="button" lang={l.id} aria-label={l.label} aria-pressed={lang === l.id} onClick={() => setLang(l.id)}>
                {l.short}
              </button>
            ))}
          </div>
          <p className="in-kicker">{c.kicker}</p>
          <h1>{c.h1}</h1>
          <p className="in-sub">{c.sub}</p>

          <form className="in-form" onSubmit={onSubmit} noValidate>
            <div className="in-row">
              <div className="in-field in-field-name">
                <label htmlFor="in-name">{c.nameLabel}</label>
                <input
                  id="in-name"
                  type="text"
                  value={form.name}
                  maxLength={LIMITS.name}
                  placeholder={c.namePh}
                  autoComplete="off"
                  aria-invalid={formError || undefined}
                  aria-describedby={formError ? 'in-name-err' : undefined}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, name: e.target.value }));
                    if (formError && e.target.value.trim()) setFormError(false);
                  }}
                />
                {formError && (
                  <p id="in-name-err" className="in-err">
                    {c.needName}
                  </p>
                )}
              </div>
              <div className="in-field in-field-city">
                <label htmlFor="in-city">
                  {c.cityLabel} <span className="in-opt">({c.optional})</span>
                </label>
                <input
                  id="in-city"
                  type="text"
                  value={form.city}
                  maxLength={LIMITS.city}
                  placeholder={c.cityPh}
                  autoComplete="off"
                  onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                />
              </div>
            </div>
            <fieldset className="in-kinds">
              <legend>{c.kindLabel}</legend>
              <div className="in-kind-list">
                {KIND_IDS.map((k) => (
                  <label key={k} className={`in-kind${form.kind === k ? ' is-on' : ''}`}>
                    <input type="radio" name="in-kind" value={k} checked={form.kind === k} onChange={() => setForm((f) => ({ ...f, kind: k }))} />
                    <span aria-hidden="true">{c.kindIcons[k]}</span>
                    {c.kinds[k]}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="in-go-row">
              <button type="submit" className="in-go">
                {site ? c.goAgain : c.go}
              </button>
              <p className="in-try">
                <span>{c.tryLabel}</span>
                {c.examples.map((x) => (
                  <button
                    key={x.name}
                    type="button"
                    className="in-chip"
                    onClick={() => {
                      setForm({ name: x.name, kind: x.kind, city: x.city });
                      setFormError(false);
                      start(newSite(x.name, x.kind, x.city), true);
                    }}
                  >
                    {x.name} · {c.kinds[x.kind]}
                  </button>
                ))}
              </p>
            </div>
          </form>
        </div>
      </div>

      <p className="in-sr" role="status" aria-live="polite">
        {announce}
      </p>

      {site && (
        <>
          <section className="in-preview" aria-labelledby="in-preview-h">
            <div className="in-wrap">
              <div className="in-head">
                <div>
                  <h2 id="in-preview-h" ref={previewRef} tabIndex={-1}>
                    {c.previewH}
                  </h2>
                  <p className="in-muted">{c.previewP}</p>
                </div>
                <Link href="/work/build" className="in-applink">
                  {c.appInstead}
                </Link>
              </div>

              <div className="in-tools">
                <div className="in-seg" role="group" aria-label={c.deviceLabel}>
                  {DEVICES.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      aria-pressed={device === d.id}
                      onClick={() => {
                        setDevice(d.id);
                        say(c.said.device(c.devices[d.id]));
                      }}
                    >
                      <DeviceIcon id={d.id} />
                      {c.devices[d.id]}
                    </button>
                  ))}
                </div>
                <div className="in-tool-btns">
                  <button
                    type="button"
                    className="in-btn in-btn-main"
                    onClick={() => {
                      const n = shuffleStyle(site);
                      change(n, c.said.style(c.styles[STYLES[n.style].id]));
                    }}
                  >
                    <span aria-hidden="true">🎨</span> {c.shuffleStyle}
                  </button>
                  <button type="button" className="in-btn" onClick={() => change(shuffleWords(site), c.said.words)}>
                    <span aria-hidden="true">✍️</span> {c.shuffleWords}
                  </button>
                  {phase === 'ready' && !reduce && (
                    <button type="button" className="in-btn" onClick={() => start(site, true)}>
                      <span aria-hidden="true">↻</span> {c.replay}
                    </button>
                  )}
                </div>
                <p className="in-style-now">{c.styleNow(styleName, site.style + 1, STYLES.length)}</p>
              </div>

              {phase === 'building' && (
                <div className="in-progress">
                  <div className="in-progress-text">
                    <span className="in-spark" aria-hidden="true">
                      ✦
                    </span>
                    <span>{c.steps[stepKey]}</span>
                  </div>
                  <div className="in-bar" role="progressbar" aria-label={c.progressLabel} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
                    <span style={{ width: `${pct}%` }} />
                  </div>
                  <button type="button" className="in-btn in-btn-small" onClick={skip}>
                    {c.skip}
                  </button>
                </div>
              )}

              <div className={`in-browser in-dev-${device}`}>
                <div className="in-chrome" aria-hidden="true">
                  <span className="in-dots">
                    <i />
                    <i />
                    <i />
                  </span>
                  <span className="in-address">
                    <span className="in-lock">🔒</span>
                    {demoHost(site.name)}
                  </span>
                </div>
                <div className="in-view" ref={viewRef} style={{ height: boxH }}>
                  {viewW > 0 && (
                    <div className="in-scaler" style={{ width: devW * scale, height: boxH }}>
                      <iframe
                        ref={frameRef}
                        title={c.frameTitle}
                        sandbox="allow-same-origin"
                        srcDoc={frameHtml}
                        onLoad={onFrameLoad}
                        style={{ width: devW, height: boxH / scale, transform: `scale(${scale})` } as CSSProperties}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="in-remix" aria-labelledby="in-remix-h">
            <div className="in-wrap">
              <h2 id="in-remix-h">{c.remixH}</h2>
              <div className="in-grid">
                <div className="in-card">
                  <h3>{c.colourH}</h3>
                  <div className="in-swatches" role="group" aria-label={c.colourH}>
                    <button type="button" className="in-sw in-sw-style" aria-pressed={!site.color} onClick={() => change(setColor(site, null), c.said.colour)}>
                      <span style={{ background: STYLES[site.style].base.primary }} aria-hidden="true" />
                      {c.colourStyle}
                    </button>
                    {SWATCHES.map((hex) => (
                      <button
                        key={hex}
                        type="button"
                        className="in-sw"
                        aria-pressed={site.color === hex}
                        aria-label={c.swatch(hex)}
                        title={c.swatch(hex)}
                        onClick={() => change(setColor(site, hex), c.said.colour)}
                      >
                        <span style={{ background: hex }} aria-hidden="true" />
                      </button>
                    ))}
                  </div>
                  <label className="in-custom">
                    <input
                      type="color"
                      value={site.color ?? STYLES[site.style].base.primary}
                      onChange={(e) => {
                        editing.current = true;
                        change(setColor(site, e.target.value));
                      }}
                    />
                    {c.colourCustom}
                  </label>
                  {fitted && fitted !== site.color && <p className="in-muted in-small">{c.colourFitted}</p>}
                </div>

                <div className="in-card">
                  <h3>{c.sectionsH}</h3>
                  <p className="in-muted in-small">{c.sectionsHint}</p>
                  <ol className="in-secs">
                    {site.order.map((id, i) => {
                      const name = c.sectionNames[id];
                      const on = !site.off.includes(id);
                      return (
                        <li
                          key={id}
                          className={`${on ? '' : 'is-off'}${dragId === id ? ' is-drag' : ''}`}
                          draggable
                          onDragStart={(e) => {
                            setDragId(id);
                            e.dataTransfer.effectAllowed = 'move';
                            try {
                              e.dataTransfer.setData('text/plain', id);
                            } catch {
                              /* ignore */
                            }
                          }}
                          onDragEnd={() => setDragId(null)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault();
                            if (dragId && dragId !== id) {
                              const n = placeSection(site, dragId, id);
                              change(n, c.said.moved(c.sectionNames[dragId], n.order.indexOf(dragId) + 1));
                            }
                            setDragId(null);
                          }}
                        >
                          <span className="in-grip" aria-hidden="true" title={c.dragHandle(name)}>
                            ⋮⋮
                          </span>
                          <label className="in-check">
                            <input type="checkbox" checked={on} onChange={() => change(toggleSection(site, id), on ? c.said.off(name) : c.said.on(name))} />
                            <span>{name}</span>
                          </label>
                          <span className="in-arrows">
                            <button
                              type="button"
                              aria-label={c.moveUp(name)}
                              disabled={i === 0}
                              onClick={() => change(moveSection(site, id, -1), c.said.moved(name, i))}
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              aria-label={c.moveDown(name)}
                              disabled={i === site.order.length - 1}
                              onClick={() => change(moveSection(site, id, 1), c.said.moved(name, i + 2))}
                            >
                              ↓
                            </button>
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                </div>

                <div className="in-card">
                  <h3>{c.wordsH}</h3>
                  <p className="in-muted in-small">{c.wordsHint}</p>
                  {gen &&
                    (['h', 'b', ...onSections(site)] as EditKey[]).map((k) => {
                      const label = k === 'h' ? c.editHeadline : k === 'b' ? c.editSub : c.editHeading(c.sectionNames[k as SectionId]);
                      const max = k === 'b' ? LIMITS.sub : LIMITS.head;
                      return (
                        <div className="in-field in-edit" key={k}>
                          <label htmlFor={`in-e-${k}`}>{label}</label>
                          <input
                            id={`in-e-${k}`}
                            type="text"
                            value={site.edits[k] ?? ''}
                            maxLength={max}
                            placeholder={gen.defaults[k]}
                            autoComplete="off"
                            onChange={(e) => {
                              editing.current = true;
                              change(setEdit(site, k, e.target.value));
                            }}
                          />
                        </div>
                      );
                    })}
                  {Object.keys(site.edits).length > 0 && (
                    <button type="button" className="in-btn in-btn-small" onClick={() => change({ ...site, edits: {} })}>
                      {c.clearEdits}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="in-ba" aria-labelledby="in-ba-h">
            <div className="in-wrap">
              <h2 id="in-ba-h">{c.baH}</h2>
              <p className="in-muted">{c.baP}</p>
              <div className="in-ba-box" ref={baRef} style={{ height: baH }}>
                {baW > 0 && phase === 'ready' && (
                  <iframe
                    title={c.beforeFrameTitle}
                    sandbox=""
                    srcDoc={staticHtml}
                    tabIndex={-1}
                    aria-hidden="true"
                    style={{ width: baLogical, height: baH / baScale, transform: `scale(${baScale})` }}
                  />
                )}
                <div className="in-mock" style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }} aria-hidden="true">
                  <div className="in-mock-cover" />
                  <div className="in-mock-head">
                    <span className="in-mock-av">{initial}</span>
                    <div>
                      <p className="in-mock-name">{site.name}</p>
                      <p className="in-mock-meta">
                        {c.mock.page} · {c.kinds[site.kind]} · {c.mock.likes}
                      </p>
                    </div>
                  </div>
                  <div className="in-mock-btns">
                    <span>{c.mock.follow}</span>
                    <span>{c.mock.message}</span>
                  </div>
                  <div className="in-mock-tabs">
                    <span className="is-on">{c.mock.posts}</span>
                    <span>{c.mock.about}</span>
                  </div>
                  <div className="in-mock-post">
                    <p>{c.mock.noPosts}</p>
                    <i />
                    <i />
                    <i />
                  </div>
                </div>
                <span className="in-ba-label in-ba-before">{c.before}</span>
                <span className="in-ba-label in-ba-after">{c.after}</span>
                <span className="in-ba-handle" style={{ left: `${split}%` }} aria-hidden="true">
                  <b>⇆</b>
                </span>
                <input
                  className="in-ba-range"
                  type="range"
                  min={0}
                  max={100}
                  value={split}
                  aria-label={c.baSlider}
                  aria-valuetext={`${c.before} ${split}% · ${c.after} ${100 - split}%`}
                  onChange={(e) => setSplit(Number(e.target.value))}
                />
              </div>
            </div>
          </section>

          <section className="in-out" aria-labelledby="in-out-h">
            <div className="in-wrap">
              <h2 id="in-out-h">{c.outH}</h2>
              <p className="in-muted">{c.outP}</p>
              <div className="in-out-grid">
                <div className="in-card">
                  <button type="button" className="in-btn" onClick={copyLink}>
                    <span aria-hidden="true">🔗</span> {copied === 'ok' ? c.copied : c.share}
                  </button>
                  {copied === 'fail' && <p className="in-muted in-small">{c.copyFail}</p>}
                  <label className="in-field in-link">
                    <span>{c.linkLabel}</span>
                    <input type="text" readOnly value={shareUrl} onFocus={(e) => e.currentTarget.select()} />
                  </label>
                </div>
                <div className="in-card">
                  <button type="button" className="in-btn" onClick={download}>
                    <span aria-hidden="true">⬇</span> {c.download}
                  </button>
                  <p className="in-muted in-small">{c.downloadHint}</p>
                </div>
                <div className="in-card in-card-real">
                  <Link href={contactHref(brief)} className="in-go in-real" data-send>
                    {c.real}
                  </Link>
                  <p className="in-muted in-small">{c.realHint}</p>
                  <Link href="/work/build" className="in-applink">
                    {c.appInstead}
                  </Link>
                </div>
              </div>
              <p className="in-reset">
                <button type="button" className="in-btn in-btn-small" onClick={reset} title={c.resetHint}>
                  ↺ {c.reset}
                </button>
                <span className="in-muted in-small">{c.resetHint}</span>
              </p>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function DeviceIcon({ id }: { id: Device }) {
  const d =
    id === 'desktop'
      ? 'M3 5h18v11H3z M9 20h6 M12 16v4'
      : id === 'tablet'
        ? 'M6 3h12v18H6z M11 18h2'
        : 'M8 3h8v18H8z M11 18h2';
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
