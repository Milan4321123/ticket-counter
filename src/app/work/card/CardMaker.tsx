'use client';

// /work/card — a link-in-bio page and a digital business card, made in a
// minute. Editor on the left (on top on a phone), a live phone preview on the
// right (a small live strip at the bottom on a phone). Rules in card.ts, words
// and templates in content.ts, the downloadable pictures in draw.ts.
//
// Everything stays in the browser: the state lives in localStorage under one
// key, a photo is made small on a canvas right here and never uploaded, and
// "Publish" only packs the page into a link (#p=…) — opening that link shows
// the page read-only, with no editor.
//
// Visitor text is only ever rendered as React text (escaped); every link goes
// through card.ts's linkHref()/hrefOf() allowlist and is rendered with
// target="_blank" rel="noopener noreferrer nofollow".

import QRCode from 'qrcode';
import { useEffect, useId, useMemo, useRef, useState, type ChangeEvent, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import {
  BUTTON_STYLES,
  FONT_IDS,
  LIMITS,
  LINK_REL,
  LINK_TYPES,
  THEMES,
  THEME_IDS,
  addLink,
  asLang,
  buildVCard,
  cleanText,
  cardContacts,
  emblemLetters,
  encodeForLink,
  encodeState,
  fileName,
  hrefOf,
  linkHref,
  moveLink,
  moveLinkBy,
  mulberry32,
  normalizeState,
  pageColors,
  publishedUrl,
  qrTarget,
  readHash,
  removeLink,
  seedStats,
  slug,
  tickStats,
  updateLink,
  type CardState,
  type FontId,
  type Lang,
  type LinkError,
  type LinkItem,
  type LinkType,
  type Stats,
  type ThemeId,
} from './card';
import { COPY, LANGS, TEMPLATE_IDS, buttonText, num, templateState, type Copy, type TemplateId } from './content';
import { canvasBlob, drawCard, drawPass } from './draw';

const STORE = 'mn:card:v1';
const PHONE_W = 340;
const PHONE_H = 700;
const ACCENTS = ['#dc143c', '#ea580c', '#ca8a04', '#15803d', '#0e7490', '#1d4ed8', '#7c3aed', '#db2777'];
const TEMPLATE_ICON: Record<TemplateId, string> = { momo: '🥟', tutor: '📚', dj: '🎧', artist: '🎨' };

type Tab = 'page' | 'card';
export type Fonts = { mukta: string; baloo: string };

function headFont(f: FontId, fonts: Fonts): string {
  switch (f) {
    case 'friendly':
      return fonts.baloo;
    case 'classic':
      return `Georgia, 'Times New Roman', 'Noto Serif Devanagari', serif`;
    case 'type':
      return `ui-monospace, SFMono-Regular, Menlo, Consolas, ${fonts.mukta}`;
    default:
      return fonts.mukta;
  }
}

function errorText(t: Copy, type: LinkType, e: LinkError): string {
  if (e === 'host') return type === 'event' ? t.errors.hostEvent : type === 'whatsapp' ? t.errors.hostWa : t.errors.hostOther;
  return t.errors[e];
}

function inputModeFor(type: LinkType): 'email' | 'tel' | 'url' | 'text' {
  if (type === 'email') return 'email';
  if (type === 'phone' || type === 'whatsapp') return 'tel';
  if (type === 'website' || type === 'menu' || type === 'event') return 'url';
  return 'text';
}

function useMedia(q: string): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const m = window.matchMedia(q);
    const f = () => setOn(m.matches);
    f();
    m.addEventListener('change', f);
    return () => m.removeEventListener('change', f);
  }, [q]);
  return on;
}

/** A photo → a square JPEG data URL of at most `max` px, made on a canvas here. Never uploaded. */
function photoToDataUrl(file: File, max: number): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/') || file.size > 25 * 1024 * 1024) return reject(new Error('not a picture'));
    const fr = new FileReader();
    fr.onerror = () => reject(new Error('unreadable'));
    fr.onload = () => shrinkDataUrl(String(fr.result), max, 0.86).then(resolve, reject);
    fr.readAsDataURL(file);
  });
}

function shrinkDataUrl(src: string, max: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onerror = () => reject(new Error('not a picture'));
    img.onload = () => {
      const side = Math.min(img.naturalWidth, img.naturalHeight);
      if (!side) return reject(new Error('empty'));
      const size = Math.min(max, side);
      const c = document.createElement('canvas');
      c.width = size;
      c.height = size;
      const ctx = c.getContext('2d');
      if (!ctx) return reject(new Error('no canvas'));
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, size, size);
      resolve(c.toDataURL('image/jpeg', quality));
    };
    img.src = src;
  });
}

// ---------------- small pieces ----------------

const ICONS: Record<LinkType, ReactNode> = {
  website: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18" />
    </>
  ),
  whatsapp: (
    <>
      <path d="M20 11.5a8.5 8.5 0 0 1-12.6 7.4L3.5 20l1.1-3.8A8.5 8.5 0 1 1 20 11.5z" />
      <path d="M9 8.8c.2 2.4 2.4 4.9 5 5.6l1.2-1.3" />
    </>
  ),
  instagram: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17" cy="7" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),
  tiktok: <path d="M13.5 3.5v11a3.5 3.5 0 1 1-3.5-3.5M13.5 3.5c.4 2.6 2.4 4.4 5 4.6" />,
  youtube: (
    <>
      <rect x="2.5" y="5.5" width="19" height="13" rx="4" />
      <path d="M10 9.3v5.4l4.6-2.7z" fill="currentColor" stroke="none" />
    </>
  ),
  facebook: <path d="M14 21v-7.5h2.7l.4-3H14V8.7c0-.9.3-1.5 1.6-1.5H17V4.5a19 19 0 0 0-2.4-.1c-2.4 0-4 1.4-4 4.1v2h-2.7v3h2.7V21" />,
  email: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="M3.8 6.6 12 13l8.2-6.4" />
    </>
  ),
  phone: <path d="M5.2 4h3.3l1.6 4.1-2.1 1.4a11 11 0 0 0 6.5 6.5l1.4-2.1 4.1 1.6v3.3a1.6 1.6 0 0 1-1.7 1.6A16.4 16.4 0 0 1 3.6 5.7 1.6 1.6 0 0 1 5.2 4z" />,
  maps: (
    <>
      <path d="M12 21s-6.5-6.1-6.5-11.1a6.5 6.5 0 0 1 13 0C18.5 14.9 12 21 12 21z" />
      <circle cx="12" cy="9.8" r="2.4" />
    </>
  ),
  event: (
    <>
      <path d="M3 9V6.5A1.5 1.5 0 0 1 4.5 5h15A1.5 1.5 0 0 1 21 6.5V9a3 3 0 0 0 0 6v2.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5V15a3 3 0 0 0 0-6z" />
      <path d="M14.5 5.5v13" strokeDasharray="2 2.2" />
    </>
  ),
  menu: (
    <>
      <path d="M3.5 12.5h17a8.5 8.5 0 0 1-17 0z" />
      <path d="M9 3.5c-1 1.4 1 2.4 0 4M13 3c-1 1.4 1 2.4 0 4" />
    </>
  ),
};

function Icon({ type }: { type: LinkType }) {
  return (
    <svg className="cm-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {ICONS[type]}
    </svg>
  );
}

function Avatar({ s, size, className = '' }: { s: CardState; size: number; className?: string }) {
  if (s.avatar) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className={`cp-avatar ${className}`} src={s.avatar} alt="" width={size} height={size} />;
  }
  const letters = emblemLetters(s);
  const n = Array.from(letters).length;
  return (
    <span className={`cp-avatar cp-emblem ${className}`} style={{ width: size, height: size, fontSize: size * (n > 2 ? 0.32 : n > 1 ? 0.4 : 0.48) }} aria-hidden="true">
      {letters}
    </span>
  );
}

/** The theme's decoration, behind the page. Pure decoration (aria-hidden). */
function ThemeArt({ theme }: { theme: ThemeId }) {
  switch (theme) {
    case 'himalaya':
      return (
        <span className="cp-art" aria-hidden="true">
          <span className="cp-cloud cp-cloud-a" />
          <span className="cp-cloud cp-cloud-b" />
          <svg className="cp-peaks" viewBox="0 0 400 120" preserveAspectRatio="none">
            <path d="M0 120 L0 82 L48 50 L82 72 L130 18 L170 60 L210 34 L262 76 L310 28 L352 66 L400 44 L400 120 Z" fill="currentColor" opacity="0.22" />
            <path d="M118 32 L130 18 L142 34 L134 30 L126 36 Z M300 40 L310 28 L321 42 L313 38 L306 43 Z" fill="#fff" opacity="0.9" />
          </svg>
        </span>
      );
    case 'dhaka':
      return (
        <span className="cp-art" aria-hidden="true">
          <span className="cp-dhaka" />
        </span>
      );
    case 'flags':
      return (
        <span className="cp-art" aria-hidden="true">
          <svg className="cp-flags" viewBox="0 0 400 60" preserveAspectRatio="none">
            <path d="M0 8 Q200 34 400 8" stroke="#7c5c3b" strokeWidth="1.5" fill="none" />
            {Array.from({ length: 10 }, (_, i) => {
              const x = 6 + i * 39.5;
              const y = 8 + Math.sin(((i + 0.5) / 10) * Math.PI) * 13;
              return <rect key={i} className="cp-flag" style={{ animationDelay: `${-i * 0.3}s` }} x={x} y={y} width="28" height="22" fill={['#2563eb', '#f8fafc', '#dc2626', '#16a34a', '#facc15'][i % 5]} stroke="rgba(0,0,0,0.12)" />;
            })}
          </svg>
        </span>
      );
    case 'night':
      return (
        <span className="cp-art" aria-hidden="true">
          {Array.from({ length: 9 }, (_, i) => (
            <span key={i} className="cp-bokeh" style={{ left: `${(i * 37) % 100}%`, top: `${(i * 23 + 8) % 92}%`, width: 24 + ((i * 13) % 40), height: 24 + ((i * 13) % 40), animationDelay: `${-i * 1.3}s`, background: ['#fb923c', '#facc15', '#f472b6'][i % 3] }} />
          ))}
        </span>
      );
    case 'minimal':
      return (
        <span className="cp-art" aria-hidden="true">
          <span className="cp-line" />
        </span>
      );
    case 'neon':
      return (
        <span className="cp-art" aria-hidden="true">
          <span className="cp-ring cp-ring-a" />
          <span className="cp-ring cp-ring-b" />
        </span>
      );
  }
}

function themeStyle(s: CardState, fonts: Fonts): CSSProperties {
  const c = pageColors(s);
  return {
    '--cp-bg': c.bg,
    '--cp-bg2': c.bg2,
    '--cp-text': c.text,
    '--cp-dim': c.dim,
    '--cp-accent': c.accent,
    '--cp-surface': c.surface,
    '--cp-btn-bg': c.btnBg,
    '--cp-btn-text': c.btnText,
    '--cp-btn-border': c.btnBorder,
    '--cp-on-accent': c.emblemText,
    '--cp-head': headFont(s.font, fonts),
    '--cp-body': fonts.mukta,
  } as CSSProperties;
}

/** The link-in-bio page itself: in the phone preview, in the read-only view, and as a tiny live thumbnail. */
function LinkPage({ s, t, fonts, calm, mode, onLinkClick }: { s: CardState; t: Copy; fonts: Fonts; calm: boolean; mode: 'preview' | 'view' | 'mini'; onLinkClick?: (id: string) => void }) {
  const links = s.links.map((l) => ({ l, href: hrefOf(l) })).filter((x): x is { l: LinkItem; href: string } => !!x.href);
  const Name = mode === 'view' ? 'h1' : 'p';
  return (
    <div className={`cp cp-${s.theme} cp-btn-${s.button} cp-${mode}${s.animated && !calm ? ' is-anim' : ''}`} style={themeStyle(s, fonts)}>
      <ThemeArt theme={s.theme} />
      <div className="cp-in">
        <Avatar s={s} size={mode === 'view' ? 104 : 88} />
        <Name className="cp-name">{s.name || t.card.noName}</Name>
        {s.role && <p className="cp-role">{s.role}</p>}
        {s.bio && <p className="cp-bio">{s.bio}</p>}
        {links.length ? (
          <ul className="cp-links">
            {links.map(({ l, href }) => (
              <li key={l.id}>
                <a className="cp-link" href={href} target="_blank" rel={LINK_REL} onClick={() => onLinkClick?.(l.id)} tabIndex={mode === 'mini' ? -1 : undefined}>
                  <span className="cp-ic">
                    <Icon type={l.type} />
                  </span>
                  <span className="cp-lt">{buttonText(t, l)}</span>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="cp-empty">{t.page.empty}</p>
        )}
        <p className="cp-foot">
          <span className="cp-made">{t.page.madeWith}</span>
          {mode === 'view' && <span className="cp-demo">{t.page.demoNote}</span>}
        </p>
      </div>
    </div>
  );
}

/** A fixed-size drawing scaled down to fit its column (never up). */
function Fit({ w, h, children, className }: { w: number; h: number; children: ReactNode; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [k, setK] = useState(1);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => {
      const tall = window.innerWidth >= 900 ? (window.innerHeight - 120) / h : 1;
      setK(Math.max(0.4, Math.min(1, el.clientWidth / w, tall)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [w, h]);
  return (
    <div ref={box} className={`cm-fit ${className ?? ''}`} style={{ height: Math.ceil(h * k) }}>
      <div className="cm-fit-in" style={{ width: w, height: h, transform: `translateX(-50%) scale(${k})` }}>
        {children}
      </div>
    </div>
  );
}

function Qr({ text, label }: { text: string; label: string }) {
  const q = useMemo(() => {
    const qr = QRCode.create(text, { errorCorrectionLevel: text.length > 400 ? 'L' : 'M' });
    const n = qr.modules.size;
    let d = '';
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (qr.modules.get(y, x)) d += `M${x + 2} ${y + 2}h1v1h-1z`;
    return { d, n: n + 4 };
  }, [text]);
  return (
    <svg className="cm-qr" viewBox={`0 0 ${q.n} ${q.n}`} role="img" aria-label={label} shapeRendering="crispEdges">
      <rect width={q.n} height={q.n} fill="#fff" />
      <path d={q.d} fill="#111827" />
    </svg>
  );
}

function BizCard({ s, t, fonts, flipped, onFlip, qrText }: { s: CardState; t: Copy; fonts: Fonts; flipped: boolean; onFlip: () => void; qrText: string }) {
  const contacts = cardContacts(s);
  const icon: Record<'phone' | 'email' | 'web', LinkType> = { phone: 'phone', email: 'email', web: 'website' };
  return (
    <button type="button" className={`cm-biz${flipped ? ' is-flipped' : ''}`} onClick={onFlip} aria-pressed={flipped} aria-label={t.card.label} style={themeStyle(s, fonts)} data-flip-card>
      <span className="cm-biz-in">
        <span className={`cm-face cm-front cp-${s.theme}`}>
          <ThemeArt theme={s.theme} />
          <span className="cm-front-top">
            <Avatar s={s} size={64} className="cm-biz-av" />
            <span className="cm-front-id">
              <span className="cm-front-name">{s.name || t.card.noName}</span>
              {s.role && <span className="cm-front-role">{s.role}</span>}
            </span>
          </span>
          {contacts.length > 0 && (
            <span className="cm-front-lines">
              {contacts.map((k) => (
                <span key={k.kind} className="cm-front-line">
                  <Icon type={icon[k.kind]} />
                  <span>{k.text}</span>
                </span>
              ))}
            </span>
          )}
          <span className="cm-front-bar" />
        </span>
        <span className="cm-face cm-back">
          <span className="cm-back-qr">
            <Qr text={qrText} label={t.card.scan} />
          </span>
          <span className="cm-back-txt">
            <span className="cm-back-scan">{t.card.scan}</span>
            <span className="cm-back-name">{s.name || t.card.noName}</span>
            <span className="cm-back-site">martnepali.com · demo</span>
          </span>
        </span>
      </span>
    </button>
  );
}

function Section({ title, hint, children, id, className }: { title: string; hint?: string; children: ReactNode; id?: string; className?: string }) {
  const h = useId();
  return (
    <section className={`cm-sec ${className ?? ''}`} aria-labelledby={h} id={id}>
      <h2 className="cm-h" id={h}>
        {title}
      </h2>
      {hint && <p className="cm-hint">{hint}</p>}
      {children}
    </section>
  );
}

// ---------------- the maker ----------------

const START: TemplateId = 'momo';

export default function CardMaker({ initialLang, fonts }: { initialLang: Lang; fonts: Fonts }) {
  const [lang, setLang] = useState<Lang>(initialLang);
  const t = COPY[lang];
  const [s, setS] = useState<CardState>(() => templateState(START, initialLang));
  const [stats, setStats] = useState<Stats>(() => seedStats(templateState(START, initialLang).links, mulberry32(9)));
  const [tab, setTab] = useState<Tab>('page');
  const [view, setView] = useState<CardState | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [say, setSay] = useState('');
  const [add, setAdd] = useState<{ type: LinkType; value: string; label: string; error: string }>({ type: 'website', value: '', label: '', error: '' });
  const [pub, setPub] = useState<null | { url: string; droppedAvatar: boolean; droppedLinks: number; sig: string }>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState<'' | 'png' | 'pass'>('');
  const [photoErr, setPhotoErr] = useState('');
  const [origin, setOrigin] = useState('https://www.martnepali.com');
  const [phoneInView, setPhoneInView] = useState(true);
  const [dragId, setDragId] = useState<string | null>(null);
  const [armId, setArmId] = useState<string | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const calm = useMedia('(prefers-reduced-motion: reduce)');
  const narrow = useMedia('(max-width: 899px)');
  const skipSave = useRef(false);
  const phoneRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const addValueRef = useRef<HTMLInputElement>(null);
  const usable = s.links.filter((l) => hrefOf(l));
  const usableRef = useRef(usable);
  usableRef.current = usable;
  const ids = useId();

  // ----- load: saved state, a published link in the hash -----
  useEffect(() => {
    setOrigin(window.location.origin);
    try {
      const raw = localStorage.getItem(STORE);
      const o = raw ? (JSON.parse(raw) as { lang?: unknown; tab?: unknown; state?: unknown }) : null;
      if (o && typeof o === 'object') {
        const l = asLang(o.lang);
        if (l) setLang(l);
        if (o.state) {
          const st = normalizeState(o.state);
          setS(st);
          setStats(seedStats(st.links, mulberry32(9)));
        }
        if (o.tab === 'card') setTab('card');
      }
    } catch {
      // No storage (private mode, blocked): the demo still works, it just forgets.
    }
    const onHash = () => setView(readHash(window.location.hash));
    onHash();
    window.addEventListener('hashchange', onHash);
    setLoaded(true);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // ----- save (one key) -----
  useEffect(() => {
    if (!loaded) return;
    if (skipSave.current) {
      skipSave.current = false;
      return;
    }
    try {
      localStorage.setItem(STORE, JSON.stringify({ lang, tab, state: s }));
    } catch {
      try {
        localStorage.setItem(STORE, JSON.stringify({ lang, tab, state: { ...s, avatar: '' } }));
      } catch {
        // Storage full or blocked: nothing to do.
      }
    }
  }, [s, lang, tab, loaded]);

  // ----- the read-only view covers the page; the page under it does not scroll -----
  useEffect(() => {
    if (!view) return;
    const root = document.documentElement;
    root.classList.add('cm-viewing');
    const title = document.title;
    document.title = `${view.name || 'Links'} · MartNepali demo`;
    window.scrollTo(0, 0);
    return () => {
      root.classList.remove('cm-viewing');
      document.title = title;
    };
  }, [view]);

  // ----- simulated stats: tick while the panel is on screen and the tab visible -----
  useEffect(() => {
    if (view || tab !== 'page') return;
    const el = statsRef.current;
    let visible = false;
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
    });
    if (el) io.observe(el);
    const rnd = mulberry32((Date.now() & 0xffff) + 1);
    const id = window.setInterval(() => {
      if (!visible || document.hidden) return;
      setStats((st) => tickStats(st, usableRef.current, rnd));
    }, 1500);
    return () => {
      window.clearInterval(id);
      io.disconnect();
    };
  }, [view, tab]);

  // ----- the phone dock on small screens: shown while the big preview is off screen -----
  useEffect(() => {
    const el = phoneRef.current;
    if (!el || view) return;
    const io = new IntersectionObserver(([e]) => setPhoneInView(e.isIntersecting), { threshold: 0.12 });
    io.observe(el);
    return () => io.disconnect();
  }, [view, tab]);

  // A drag handle that was pressed but not dragged lets go of its row.
  useEffect(() => {
    const up = () => setArmId(null);
    window.addEventListener('pointerup', up);
    return () => window.removeEventListener('pointerup', up);
  }, []);

  const announce = (text: string) => setSay(text);
  const label = (l: LinkItem) => buttonText(t, l);

  // ----- QR: the page itself if it fits a small code, else the first web link -----
  const qr = useMemo(() => {
    const page = publishedUrl(origin, encodeState(s, false));
    const web = s.links.find((l) => (l.type === 'website' || l.type === 'menu') && hrefOf(l));
    return qrTarget(page, (web && hrefOf(web)) || `${origin}/work/card`);
  }, [origin, s]);

  const sig = useMemo(() => JSON.stringify(s), [s]);

  // ---------------- actions ----------------

  function patch(p: Partial<CardState>) {
    setS((x) => normalizeStateKeepLinks({ ...x, ...p }));
  }

  function applyTemplate(id: TemplateId) {
    const st = templateState(id, lang);
    setS(st);
    setStats(seedStats(st.links, mulberry32(id.length * 7 + 3)));
    setPub(null);
    setFlipped(false);
    setPhotoErr('');
    setAdd((a) => ({ ...a, value: '', label: '', error: '' }));
    announce(t.templateDone(t.templates[id]));
  }

  function reset() {
    try {
      localStorage.removeItem(STORE);
    } catch {
      // nothing stored
    }
    skipSave.current = true;
    const st = templateState(START, lang);
    setS(st);
    setStats(seedStats(st.links, mulberry32(9)));
    setTab('page');
    setFlipped(false);
    setPub(null);
    setCopied(false);
    setPhotoErr('');
    setAdd({ type: 'website', value: '', label: '', error: '' });
    announce(t.resetDone);
  }

  function pickLang(l: Lang) {
    setLang(l);
  }

  async function onPhoto(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setPhotoErr('');
    try {
      const url = await photoToDataUrl(f, 256);
      setS((x) => ({ ...x, avatar: url }));
    } catch {
      setPhotoErr(t.photoError);
    }
  }

  function addNow() {
    if (s.links.length >= LIMITS.links) return;
    const r = linkHref(add.type, add.value);
    if (!r.ok) {
      setAdd((a) => ({ ...a, error: errorText(t, a.type, r.error) }));
      announce(`${t.refused} ${errorText(t, add.type, r.error)}`);
      addValueRef.current?.focus();
      return;
    }
    const next = addLink(s.links, { type: add.type, value: add.value, label: add.label });
    setS((x) => ({ ...x, links: next }));
    announce(t.added(buttonText(t, { type: add.type, label: add.label })));
    setAdd((a) => ({ ...a, value: '', label: '', error: '' }));
  }

  function focusRow(id: string, sel: string) {
    requestAnimationFrame(() => {
      const row = listRef.current?.querySelector<HTMLElement>(`[data-id="${id}"]`);
      const want = row?.querySelector<HTMLButtonElement>(sel);
      if (want && !want.disabled) want.focus();
      else row?.querySelector<HTMLButtonElement>('[data-move]:not([disabled])')?.focus();
    });
  }

  function moveBy(id: string, d: number) {
    const i = s.links.findIndex((l) => l.id === id);
    const next = moveLinkBy(s.links, id, d);
    if (next === s.links) return;
    setS((x) => ({ ...x, links: next }));
    announce(t.movedTo(label(s.links[i]), num(i + d + 1, lang)));
    focusRow(id, `[data-move="${d < 0 ? 'up' : 'down'}"]`);
  }

  function moveTo(id: string, to: number) {
    const from = s.links.findIndex((l) => l.id === id);
    if (from < 0) return;
    const next = moveLink(s.links, from, to);
    if (next === s.links) return;
    setS((x) => ({ ...x, links: next }));
    announce(t.movedTo(label(s.links[from]), num(Math.max(0, Math.min(s.links.length - 1, to)) + 1, lang)));
  }

  function del(id: string) {
    const i = s.links.findIndex((l) => l.id === id);
    if (i < 0) return;
    const gone = s.links[i];
    const next = removeLink(s.links, id);
    setS((x) => ({ ...x, links: next }));
    announce(t.removed(label(gone)));
    requestAnimationFrame(() => {
      const after = next[i] ?? next[i - 1];
      if (after) listRef.current?.querySelector<HTMLButtonElement>(`[data-id="${after.id}"] [data-del]`)?.focus();
      else addValueRef.current?.focus();
    });
  }

  async function publish() {
    let st = s;
    if (s.avatar) {
      try {
        st = { ...s, avatar: await shrinkDataUrl(s.avatar, 72, 0.7) };
      } catch {
        st = { ...s, avatar: '' };
      }
    }
    const pk = encodeForLink(st);
    setPub({ url: publishedUrl(origin, pk.code), droppedAvatar: pk.droppedAvatar, droppedLinks: pk.droppedLinks, sig });
    setCopied(false);
  }

  async function copyLink() {
    if (!pub) return;
    try {
      await navigator.clipboard.writeText(pub.url);
      setCopied(true);
      announce(t.copied);
    } catch {
      document.getElementById(`${ids}-url`)?.focus();
      (document.getElementById(`${ids}-url`) as HTMLInputElement | null)?.select();
    }
  }

  function saveFile(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 4000);
    announce(t.card.saved(name));
  }

  const drawFonts = { head: headFont(s.font, fonts), body: fonts.mukta };

  async function downloadPng() {
    setBusy('png');
    try {
      const c = await drawCard(s, drawFonts, { scan: t.card.scan, noName: t.card.noName }, qr.text);
      const b = await canvasBlob(c);
      if (b) saveFile(b, fileName(s, 'png'));
    } finally {
      setBusy('');
    }
  }

  async function downloadPass() {
    setBusy('pass');
    try {
      const c = await drawPass(
        s,
        drawFonts,
        { kicker: t.card.passKicker, phone: t.card.passPhone, email: t.card.passEmail, scan: t.card.scan, foot: t.card.passFoot, noName: t.card.noName },
        qr.text
      );
      const b = await canvasBlob(c);
      if (b) saveFile(b, `${slug(s.name, 'my-card')}-pass.png`);
    } finally {
      setBusy('');
    }
  }

  function downloadVcf() {
    saveFile(new Blob([buildVCard(s, qr.full ? qr.text : undefined)], { type: 'text/vcard;charset=utf-8' }), fileName(s, 'vcf'));
  }

  function leaveView(copy: boolean) {
    if (copy && view) {
      setS(normalizeState(view));
      setStats(seedStats(view.links, mulberry32(11)));
      setPub(null);
      setTab('page');
    }
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}`);
    setView(null);
  }

  function onTabKey(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const next: Tab = tab === 'page' ? 'card' : 'page';
    setTab(next);
    requestAnimationFrame(() => document.getElementById(`${ids}-tab-${next}`)?.focus());
  }

  function scrollToPhone() {
    phoneRef.current?.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' });
  }

  // ---------------- the read-only published page ----------------

  if (view) {
    return (
      <div className="cm-view" lang={lang} style={themeStyle(view, fonts)}>
        <LinkPage s={view} t={t} fonts={fonts} calm={calm} mode="view" />
        <div className="cm-view-bar">
          <a
            href="/work/card"
            onClick={(e) => {
              e.preventDefault();
              leaveView(false);
            }}
          >
            {t.page.makeOwn}
          </a>
          <button type="button" onClick={() => leaveView(true)}>
            {t.page.editCopy}
          </button>
        </div>
      </div>
    );
  }

  // ---------------- the maker ----------------

  const full = s.links.length >= LIMITS.links;
  const maxClicks = Math.max(1, ...usable.map((l) => stats.clicks[l.id] ?? 0));
  const accentNow = pageColors(s).accent;
  const changedSincePublish = pub && pub.sig !== sig;

  const profile = (
    <Section title={t.profileH}>
      <div className="cm-profile">
        <div className="cm-photo" style={themeStyle(s, fonts)}>
          <Avatar s={s} size={72} />
          <div className="cm-photo-btns">
            <label className="cm-btn cm-file">
              <input type="file" accept="image/*" onChange={onPhoto} />
              {s.avatar ? t.photoChange : t.photoUpload}
            </label>
            {s.avatar && (
              <button type="button" className="cm-btn cm-btn-quiet" onClick={() => patch({ avatar: '' })}>
                {t.photoRemove}
              </button>
            )}
          </div>
        </div>
        <p className="cm-note">{t.photoNote}</p>
        {photoErr && (
          <p className="cm-err" role="alert">
            {photoErr}
          </p>
        )}
        <label className="cm-field">
          <span>{t.nameL}</span>
          <input value={s.name} maxLength={LIMITS.name} placeholder={t.namePh} onChange={(e) => setS((x) => ({ ...x, name: cleanText(e.target.value, LIMITS.name) }))} data-field="name" />
        </label>
        <label className="cm-field">
          <span>{t.roleL}</span>
          <input value={s.role} maxLength={LIMITS.role} placeholder={t.rolePh} onChange={(e) => setS((x) => ({ ...x, role: cleanText(e.target.value, LIMITS.role) }))} />
        </label>
        <label className="cm-field">
          <span>
            {t.bioL} <em>· {t.optional}</em>
          </span>
          <textarea rows={2} value={s.bio} maxLength={LIMITS.bio} placeholder={t.bioPh} onChange={(e) => setS((x) => ({ ...x, bio: cleanText(e.target.value, LIMITS.bio) }))} />
        </label>
        {!s.avatar && (
          <label className="cm-field cm-field-short">
            <span>{t.initialsL}</span>
            <input value={s.initials} maxLength={6} placeholder={emblemLetters({ initials: '', name: s.name })} onChange={(e) => patch({ initials: e.target.value })} aria-describedby={`${ids}-ini`} />
            <small id={`${ids}-ini`}>{t.initialsHint}</small>
          </label>
        )}
      </div>
    </Section>
  );

  return (
    <div className="cm" lang={lang} style={{ '--cm-mukta': fonts.mukta, '--cm-baloo': fonts.baloo } as CSSProperties}>
      <div className="cm-top">
        <div className="cm-brand">
          <h1 className="cm-title">{t.title}</h1>
          <p className="cm-tag">{t.tagline}</p>
        </div>
        <div className="cm-tools">
          <div className="cm-langs" role="group" aria-label={t.langLabel}>
            {LANGS.map((l) => (
              <button key={l.id} type="button" lang={l.id} className={lang === l.id ? 'is-on' : ''} aria-pressed={lang === l.id} onClick={() => pickLang(l.id)} data-lang={l.id}>
                {l.label}
              </button>
            ))}
          </div>
          <button type="button" className="cm-btn cm-btn-quiet" onClick={reset} data-reset>
            ↺ {t.reset}
          </button>
        </div>
      </div>
      <p className="cm-local">
        <span aria-hidden="true">🔒</span>
        <span>{t.local}</span>
      </p>

      <div className="cm-templates" role="group" aria-labelledby={`${ids}-tpl`}>
        <p className="cm-tpl-h" id={`${ids}-tpl`}>
          <strong>{t.templatesH}</strong> <span>{t.templatesHint}</span>
        </p>
        <div className="cm-tpl-row">
          {TEMPLATE_IDS.map((id) => (
            <button key={id} type="button" className="cm-tpl" onClick={() => applyTemplate(id)} data-template={id}>
              <span aria-hidden="true">{TEMPLATE_ICON[id]}</span> {t.templates[id]}
            </button>
          ))}
        </div>
      </div>

      <div className="cm-tabs" role="tablist" aria-label={t.tabsLabel}>
        {(['page', 'card'] as Tab[]).map((k) => (
          <button
            key={k}
            id={`${ids}-tab-${k}`}
            type="button"
            role="tab"
            aria-selected={tab === k}
            aria-controls={`${ids}-panel`}
            tabIndex={tab === k ? 0 : -1}
            className={tab === k ? 'is-on' : ''}
            onClick={() => setTab(k)}
            onKeyDown={onTabKey}
            data-tab={k}
          >
            <span aria-hidden="true">{k === 'page' ? '🔗' : '🪪'}</span> {t.tabs[k]}
          </button>
        ))}
      </div>

      <div className={`cm-grid cm-grid-${tab}`} id={`${ids}-panel`} role="tabpanel" aria-labelledby={`${ids}-tab-${tab}`}>
        <div className="cm-edit">
          {profile}

          {tab === 'page' ? (
            <>
              <Section title={t.linksH} hint={t.linksHint}>
                <ol className="cm-links" ref={listRef}>
                  {s.links.map((l, i) => {
                    const check = linkHref(l.type, l.value);
                    const errId = `${ids}-err-${l.id}`;
                    const name = `${t.linkN(num(i + 1, lang))} · ${label(l)}`;
                    return (
                      <li
                        key={l.id}
                        data-id={l.id}
                        className={`cm-li${dragId === l.id ? ' is-dragging' : ''}${overIdx === i && dragId && dragId !== l.id ? ' is-over' : ''}${check.ok ? '' : ' is-bad'}`}
                        draggable={armId === l.id}
                        onDragStart={(e) => {
                          setDragId(l.id);
                          e.dataTransfer.effectAllowed = 'move';
                          e.dataTransfer.setData('text/plain', l.id);
                        }}
                        onDragOver={(e) => {
                          if (!dragId) return;
                          e.preventDefault();
                          e.dataTransfer.dropEffect = 'move';
                          if (overIdx !== i) setOverIdx(i);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          const id = dragId ?? e.dataTransfer.getData('text/plain');
                          if (id) moveTo(id, i);
                          setDragId(null);
                          setOverIdx(null);
                          setArmId(null);
                        }}
                        onDragEnd={() => {
                          setDragId(null);
                          setOverIdx(null);
                          setArmId(null);
                        }}
                      >
                        <span className="cm-handle" title={t.handle} aria-hidden="true" onPointerDown={() => setArmId(l.id)}>
                          ⋮⋮
                        </span>
                        <span className="cm-li-ic">
                          <Icon type={l.type} />
                        </span>
                        <div className="cm-li-fields">
                          <div className="cm-li-row">
                            <select aria-label={`${t.typeL} · ${name}`} value={l.type} onChange={(e) => setS((x) => ({ ...x, links: updateLink(x.links, l.id, { type: e.target.value as LinkType }) }))}>
                              {LINK_TYPES.map((ty) => (
                                <option key={ty} value={ty}>
                                  {t.types[ty].name}
                                </option>
                              ))}
                            </select>
                            <input
                              aria-label={`${t.labelL} · ${name}`}
                              value={l.label}
                              maxLength={LIMITS.label}
                              placeholder={t.types[l.type].def}
                              onChange={(e) => setS((x) => ({ ...x, links: updateLink(x.links, l.id, { label: e.target.value }) }))}
                            />
                          </div>
                          <input
                            className="cm-li-value"
                            aria-label={`${t.valueL} · ${name}`}
                            value={l.value}
                            maxLength={LIMITS.value}
                            placeholder={t.types[l.type].ph}
                            inputMode={inputModeFor(l.type)}
                            autoComplete="off"
                            spellCheck={false}
                            aria-invalid={!check.ok}
                            aria-describedby={check.ok ? undefined : errId}
                            onChange={(e) => setS((x) => ({ ...x, links: updateLink(x.links, l.id, { value: e.target.value }) }))}
                          />
                          {!check.ok && (
                            <p className="cm-err" id={errId}>
                              {errorText(t, l.type, check.error)} {t.notShown}
                            </p>
                          )}
                        </div>
                        <div className="cm-li-tools">
                          <button type="button" data-move="up" onClick={() => moveBy(l.id, -1)} disabled={i === 0} aria-label={`${t.moveUp}: ${name}`} title={t.moveUp}>
                            ↑
                          </button>
                          <button type="button" data-move="down" onClick={() => moveBy(l.id, 1)} disabled={i === s.links.length - 1} aria-label={`${t.moveDown}: ${name}`} title={t.moveDown}>
                            ↓
                          </button>
                          <button type="button" data-del onClick={() => del(l.id)} aria-label={`${t.remove}: ${name}`} title={t.remove} className="cm-del">
                            ✕
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ol>

                <form
                  className="cm-add"
                  noValidate
                  onSubmit={(e) => {
                    e.preventDefault();
                    addNow();
                  }}
                >
                  <h3 className="cm-add-h">{t.addH}</h3>
                  <div className="cm-add-grid">
                    <label className="cm-field">
                      <span>{t.typeL}</span>
                      <select value={add.type} onChange={(e) => setAdd((a) => ({ ...a, type: e.target.value as LinkType, error: '' }))} data-add-type>
                        {LINK_TYPES.map((ty) => (
                          <option key={ty} value={ty}>
                            {t.types[ty].name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="cm-field">
                      <span>{t.valueL}</span>
                      <input
                        ref={addValueRef}
                        value={add.value}
                        maxLength={LIMITS.value}
                        placeholder={t.types[add.type].ph}
                        inputMode={inputModeFor(add.type)}
                        autoComplete="off"
                        spellCheck={false}
                        aria-invalid={!!add.error}
                        aria-describedby={add.error ? `${ids}-adderr` : undefined}
                        onChange={(e) => setAdd((a) => ({ ...a, value: e.target.value, error: '' }))}
                        data-add-value
                      />
                    </label>
                    <label className="cm-field">
                      <span>
                        {t.labelL} <em>· {t.optional}</em>
                      </span>
                      <input value={add.label} maxLength={LIMITS.label} placeholder={t.types[add.type].def} onChange={(e) => setAdd((a) => ({ ...a, label: e.target.value }))} data-add-label />
                    </label>
                  </div>
                  {add.error && (
                    <p className="cm-err" id={`${ids}-adderr`} data-add-error>
                      {t.refused} {add.error}
                    </p>
                  )}
                  {full ? (
                    <p className="cm-note">{t.full(num(LIMITS.links, lang))}</p>
                  ) : (
                    <button type="submit" className="cm-btn cm-btn-main" data-add>
                      + {t.add}
                    </button>
                  )}
                </form>
              </Section>

              <Section title={t.lookH}>
                <p className="cm-label">{t.themeL}</p>
                <div className="cm-themes">
                  {THEME_IDS.map((id) => {
                    const th = THEMES[id];
                    return (
                      <button
                        key={id}
                        type="button"
                        className={`cm-theme${s.theme === id ? ' is-on' : ''}`}
                        aria-pressed={s.theme === id}
                        onClick={() => patch({ theme: id, accent: '' })}
                        data-theme={id}
                        style={{ '--sw-bg': th.bg, '--sw-bg2': th.bg2, '--sw-ac': th.accent, '--sw-tx': th.text } as CSSProperties}
                      >
                        <span className="cm-theme-sw" aria-hidden="true">
                          <i />
                          <i />
                        </span>
                        {t.themes[id]}
                      </button>
                    );
                  })}
                </div>

                <p className="cm-label">{t.accentL}</p>
                <div className="cm-accents">
                  <button type="button" className={`cm-acc cm-acc-auto${!s.accent ? ' is-on' : ''}`} aria-pressed={!s.accent} onClick={() => patch({ accent: '' })} style={{ '--sw': THEMES[s.theme].accent } as CSSProperties}>
                    {t.accentAuto}
                  </button>
                  {ACCENTS.map((hex) => (
                    <button key={hex} type="button" className={`cm-acc${s.accent === hex ? ' is-on' : ''}`} aria-pressed={s.accent === hex} aria-label={hex} title={hex} onClick={() => patch({ accent: hex })} style={{ '--sw': hex } as CSSProperties} />
                  ))}
                  <label className="cm-acc-own" title={t.accentOwn}>
                    <input type="color" value={accentNow} onChange={(e) => patch({ accent: e.target.value })} aria-label={t.accentOwn} />
                  </label>
                </div>

                <div className="cm-two">
                  <div>
                    <p className="cm-label">{t.buttonL}</p>
                    <div className="cm-seg">
                      {BUTTON_STYLES.map((b) => (
                        <button key={b} type="button" className={`cm-seg-b cm-seg-${b}${s.button === b ? ' is-on' : ''}`} aria-pressed={s.button === b} onClick={() => patch({ button: b })} data-button={b}>
                          {t.buttons[b]}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="cm-label">{t.fontL}</p>
                    <div className="cm-seg">
                      {FONT_IDS.map((f) => (
                        <button key={f} type="button" className={`cm-seg-b${s.font === f ? ' is-on' : ''}`} aria-pressed={s.font === f} onClick={() => patch({ font: f })} style={{ fontFamily: headFont(f, fonts) }} data-font={f}>
                          {t.fonts[f]}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <label className="cm-switch">
                  <input type="checkbox" checked={s.animated} onChange={(e) => patch({ animated: e.target.checked })} data-anim />
                  <span className="cm-switch-ui" aria-hidden="true" />
                  {t.animL}
                </label>
                {s.animated && calm && <p className="cm-note">{t.animCalm}</p>}
              </Section>

              <Section title={t.publishH} hint={t.publishHint} className="cm-pub">
                <button type="button" className="cm-btn cm-btn-main" onClick={publish} data-publish>
                  ↗ {pub && changedSincePublish ? t.publishAgain : t.publishBtn}
                </button>
                {pub && (
                  <div className="cm-pub-out" data-published>
                    <label className="cm-field" htmlFor={`${ids}-url`}>
                      <span>{t.publishedL}</span>
                    </label>
                    <div className="cm-pub-row">
                      <input id={`${ids}-url`} readOnly value={pub.url} onFocus={(e) => e.currentTarget.select()} data-pub-url />
                      <button type="button" className="cm-btn" onClick={copyLink}>
                        {copied ? `✓ ${t.copied}` : t.copy}
                      </button>
                      <a className="cm-btn" href={pub.url} target="_blank" rel="noopener noreferrer">
                        {t.open} ↗
                      </a>
                    </div>
                    {pub.droppedAvatar && <p className="cm-warn">{t.droppedAvatar}</p>}
                    {pub.droppedLinks > 0 && <p className="cm-warn">{t.droppedLinks(num(pub.droppedLinks, lang))}</p>}
                    <p className="cm-note">{t.publishSim}</p>
                  </div>
                )}
              </Section>

              <section className="cm-sec cm-stats" aria-labelledby={`${ids}-stats`} ref={statsRef}>
                <h2 className="cm-h" id={`${ids}-stats`}>
                  {t.statsH} <span className="cm-sim">{t.statsSim.split(' — ')[0]}</span>
                </h2>
                <p className="cm-hint">{t.statsSim}</p>
                <p className="cm-views">
                  <strong>{num(stats.views.toLocaleString('en-US'), lang)}</strong> {t.views}
                </p>
                {usable.length ? (
                  <ul className="cm-bars">
                    {usable.map((l) => {
                      const n = stats.clicks[l.id] ?? 0;
                      return (
                        <li key={l.id}>
                          <span className="cm-bar-l">
                            <Icon type={l.type} /> <span>{label(l)}</span>
                          </span>
                          <span className="cm-bar">
                            <span style={{ width: `${Math.round((n / maxClicks) * 100)}%` }} />
                          </span>
                          <span className="cm-bar-n">{t.clicks(num(n, lang))}</span>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="cm-note">{t.statsEmpty}</p>
                )}
              </section>
            </>
          ) : (
            <>
              <Section title={t.card.showH}>
                <div className="cm-checks">
                  {(['phone', 'email', 'web'] as const).map((k) => (
                    <label key={k} className="cm-check">
                      <input type="checkbox" checked={s.front[k]} onChange={(e) => setS((x) => ({ ...x, front: { ...x.front, [k]: e.target.checked } }))} />
                      {t.card.show[k]}
                    </label>
                  ))}
                </div>
              </Section>
              <Section title={t.card.downloadsH}>
                <ul className="cm-dl">
                  <li>
                    <button type="button" className="cm-btn cm-btn-main" onClick={downloadPng} disabled={!!busy} data-dl="png">
                      ⬇ {busy === 'png' ? t.card.making : t.card.png}
                    </button>
                    <p className="cm-note">{t.card.pngNote}</p>
                  </li>
                  <li>
                    <button type="button" className="cm-btn" onClick={downloadVcf} data-dl="vcf">
                      ⬇ {t.card.vcf}
                    </button>
                    <p className="cm-note">{t.card.vcfNote}</p>
                  </li>
                  <li>
                    <button type="button" className="cm-btn" onClick={downloadPass} disabled={!!busy} data-dl="pass">
                      ⬇ {busy === 'pass' ? t.card.making : t.card.pass}
                    </button>
                    <p className="cm-note">{t.card.passNote}</p>
                  </li>
                </ul>
              </Section>
            </>
          )}
        </div>

        <div className="cm-side">
          {tab === 'page' ? (
            <div className="cm-phone-wrap" ref={phoneRef}>
              <Fit w={PHONE_W} h={PHONE_H}>
                <div className="cm-phone" role="region" aria-label={t.page.previewLabel}>
                  <div className="cm-phone-notch" aria-hidden="true" />
                  <div className="cm-phone-screen">
                    <LinkPage s={s} t={t} fonts={fonts} calm={calm} mode="preview" onLinkClick={(id) => setStats((st) => ({ ...st, clicks: { ...st.clicks, [id]: (st.clicks[id] ?? 0) + 1 } }))} />
                  </div>
                </div>
              </Fit>
            </div>
          ) : (
            <div className="cm-card-wrap">
              <BizCard s={s} t={t} fonts={fonts} flipped={flipped} onFlip={() => {
                setFlipped((f) => !f);
                announce(flipped ? t.card.showingFront : t.card.showingBack);
              }} qrText={qr.text} />
              <div className="cm-card-under">
                <button type="button" className="cm-btn" onClick={() => {
                  setFlipped((f) => !f);
                  announce(flipped ? t.card.showingFront : t.card.showingBack);
                }} data-flip>
                  ⟲ {t.card.flip} · {flipped ? t.card.back : t.card.front}
                </button>
                <p className="cm-note">{t.card.hint}</p>
                <p className="cm-note">{qr.full ? t.card.qrFull : t.card.qrShort}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {narrow && tab === 'page' && !phoneInView && (
        <div className="cm-dock">
          <div className="cm-dock-mini" aria-hidden="true" inert>
            <div className="cm-dock-scale">
              <LinkPage s={s} t={t} fonts={fonts} calm mode="mini" />
            </div>
          </div>
          <div className="cm-dock-txt">
            <strong>{t.dock.live}</strong>
            <span>{s.name || t.card.noName}</span>
          </div>
          <button type="button" className="cm-btn cm-btn-main" onClick={scrollToPhone}>
            {t.dock.see} ↓
          </button>
        </div>
      )}

      <p className="cm-sr" aria-live="polite" role="status">
        {say}
      </p>
    </div>
  );
}

/** A patch keeps the visitor's half-typed links as they are; everything else is cleaned. */
function normalizeStateKeepLinks(x: CardState): CardState {
  const n = normalizeState({ ...x, links: [] });
  return { ...n, links: x.links };
}
