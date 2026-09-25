'use client';

// "Ask MartNepali" — a Siri-like glowing pill at the top of the homepage that
// opens a full-screen chat. Ask anything: "momo in Berlin" finds events,
// shops and items; "my basket" / "sell tickets" / "try the demo" offer (or,
// said as a command, open) the page that does it; "what can this site do?"
// gets a short answer. Everything lands in the chat as a conversation, so a
// long list of results never pushes the homepage around. ✕, Escape or the
// phone's back button close it.
import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { Lang } from '@/lib/i18n';
import SpeechInput from './SpeechInput';
import StoryPlayer from './StoryPlayer';

/** "/#watch" in an answer is the customer's story video, played right here. */
const isWatch = (href: string) => href === '/#watch';

interface AskLink { label: string; href: string; icon: string }
interface AskResult { kind: 'event' | 'shop' | 'item' | 'offer'; title: string; sub: string; href: string; image: string | null }
interface Msg {
  from: 'me' | 'bot';
  text?: string;
  links?: AskLink[];
  results?: AskResult[];
  going?: AskLink;
  thinking?: boolean;
  /** The shopping filters this reply applied — the next question builds on them. */
  filters?: unknown;
}

const W: Record<Lang, { pill: string; hello: string; sub: string; ph: string; ideas: string[]; shop: string[]; none: string; opening: string; events: string; shops: string; items: string; offers: string; close: string; fresh: string; langs: string }> = {
  en: {
    pill: 'Ask anything — events, momo, how it works…',
    hello: 'Namaste! What are you looking for?',
    sub: 'Find events, shops and food, or ask how anything works.',
    ph: 'Ask or search…',
    shop: ['Items under €10', 'Momo in Berlin under €8', 'Cheapest sweets, only in stock', '10 euro bhanda sasto khaja', 'Events this weekend'],
    ideas: ['What is MartNepali?', 'Show me how it works (video)', 'Dashain events', 'Ma euta event setup garna chahanchhu', 'Berlin ma momo kaha paincha?', 'I want to put my event here', 'How do I pay?', 'Open my basket'],
    langs: 'Write in English, Deutsch, नेपाली — or Roman Nepali, like the two above.',
    none: 'Nothing matched that — try a different word, a city, or ask a question.',
    opening: 'Opening',
    events: 'Events', shops: 'Shops', items: 'Bazaar — food & goods', offers: 'Tickets & dishes at events', close: 'Close', fresh: 'New chat',
  },
  de: {
    pill: 'Frag einfach — Events, Momo, wie es geht…',
    hello: 'Namaste! Wonach suchst du?',
    sub: 'Finde Events, Läden und Essen — oder frag, wie etwas funktioniert.',
    ph: 'Fragen oder suchen…',
    shop: ['Artikel unter 10 €', 'Momo in Berlin unter 8 €', 'Günstigste Süßigkeiten, nur vorrätig', '10 euro bhanda sasto khaja', 'Events dieses Wochenende'],
    ideas: ['Was ist MartNepali?', 'Zeig mir, wie es geht (Video)', 'Dashain Events', 'Ma euta event setup garna chahanchhu', 'Berlin ma momo kaha paincha?', 'Ich möchte mein Event hier anbieten', 'Wie bezahle ich?', 'Öffne meinen Warenkorb'],
    langs: 'Schreib auf Deutsch, Englisch, नेपाली — oder Nepali in lateinischen Buchstaben, wie oben.',
    none: 'Nichts gefunden — versuch ein anderes Wort, eine Stadt oder stell eine Frage.',
    opening: 'Öffne',
    events: 'Events', shops: 'Läden', items: 'Basar — Essen & Waren', offers: 'Tickets & Gerichte bei Events', close: 'Schließen', fresh: 'Neuer Chat',
  },
  ne: {
    pill: 'जे पनि सोध्नुहोस् — कार्यक्रम, मम, कसरी चल्छ…',
    hello: 'नमस्ते! तपाईं के खोज्दै हुनुहुन्छ?',
    sub: 'कार्यक्रम, पसल र खाना खोज्नुहोस्, वा कुनै कुरा कसरी चल्छ सोध्नुहोस्।',
    ph: 'सोध्नुहोस् वा खोज्नुहोस्…',
    shop: ['€10 भन्दा सस्तो सामान', 'Momo in Berlin under €8', 'सबैभन्दा सस्तो मिठाई', '10 euro bhanda sasto khaja', 'यो हप्ता कार्यक्रम'],
    ideas: ['MartNepali के हो?', 'यो कसरी चल्छ देखाउनुहोस् (भिडियो)', 'दशैं कार्यक्रम', 'Ma euta event setup garna chahanchhu', 'Berlin ma momo kaha paincha?', 'मेरो कार्यक्रम यहाँ राख्न चाहन्छु', 'कसरी भुक्तानी गर्ने?', 'मेरो टोकरी खोल्नुहोस्'],
    langs: 'नेपाली, English, Deutsch — वा Roman Nepali मा पनि लेख्न सक्नुहुन्छ, माथिका जस्तै।',
    none: 'केही भेटिएन — अर्को शब्द, सहर, वा प्रश्न सोध्नुहोस्।',
    opening: 'खोल्दै',
    events: 'कार्यक्रम', shops: 'पसल', items: 'बजार — खाना र सामान', offers: 'कार्यक्रमका टिकट र परिकार', close: 'बन्द गर्नुहोस्', fresh: 'नयाँ कुराकानी',
  },
};

/**
 * Into the setup assistant: a free demo, a blank shop or event draft in the
 * editor, the assistant open — with `ask` (when given) as its first message.
 * A POST, as the demo's own button does (a new account never comes from a link).
 */
function startSetup(kind: 'event' | 'shop' | 'restaurant', ask?: string) {
  try {
    if (ask) sessionStorage.setItem('setup:ask', ask);
  } catch {
    // No storage: the assistant opens and asks instead.
  }
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = '/api/demo/start';
  const to = document.createElement('input');
  to.type = 'hidden';
  to.name = 'to';
  to.value = kind === 'event' ? 'assistant-event' : kind === 'restaurant' ? 'assistant-restaurant' : 'assistant';
  form.appendChild(to);
  document.body.appendChild(form);
  form.submit();
}

/** Shop or event, from what the visitor said last in this chat. */
function guessKind(): 'event' | 'shop' | 'restaurant' {
  try {
    const chat = JSON.parse(sessionStorage.getItem('ask:chat:v1') || '[]') as { from: string; text?: string }[];
    const said = chat.filter((m) => m.from === 'me').slice(-3).map((m) => m.text ?? '').join(' ');
    const event = /\b(events?|concerts?|tickets?|party|festival|karyakram|veranstaltung|konzert|night)\b/i.test(said);
    const shop = /\b(shop|store|pasal|restaurant|kitchen|momo|food|menu|items?|laden)\b/i.test(said);
    if (event && !shop) return 'event';
    return /\b(restaurant|kitchen|momo|khaja|food|menu|thukpa|khana)\b/i.test(said) ? 'restaurant' : 'shop';
  } catch {
    return 'shop';
  }
}

/** "/demo#build" in an answer is the build button, not a page. */
const isBuild = (href: string) => href === '/demo#build';

/** Answer text with its "[label](/path)" links made real (site paths only). */
function rich(text: string, onClose: () => void) {
  const out: ReactNode[] = [];
  const re = /\[([^\]]{1,60})\]\((\/[^)\s]{0,80})\)|\*\*([^*]{1,80})\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1] && isWatch(m[2])) {
      out.push(<StoryPlayer key={m.index} storyId="customer" label={m[1]} variant="inline" />);
    } else if (m[1]) {
      out.push(
        <Link
          key={m.index}
          href={m[2]}
          className="ab-inline"
          onClick={(e) => {
            if (isBuild(m![2])) {
              e.preventDefault();
              startSetup(guessKind());
              return;
            }
            onClose();
          }}
        >
          {m[1]}
        </Link>
      );
    } else out.push(<strong key={m.index}>{m[3]}</strong>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function Orb({ busy = false, size = 26 }: { busy?: boolean; size?: number }) {
  return <span className={`ab-orb${busy ? ' is-busy' : ''}`} style={{ width: size, height: size }} aria-hidden="true" />;
}

/**
 * `where="bazaar"`: a slimmer pill above the goods whose examples are about
 * shopping — the same chat, so "cheaper" or "only in Berlin" asked here builds
 * on the filters set from the homepage.
 */
export default function AskBar({ lang = 'en', where = 'home' }: { lang?: Lang; where?: 'home' | 'bazaar' }) {
  const base = W[lang] ?? W.en;
  const w = where === 'bazaar' ? { ...base, ideas: base.shop } : base;
  const [open, setOpen] = useState(false);
  const [tick, setTick] = useState(0);

  // The pill's hint cycles through what you could ask.
  useEffect(() => {
    if (open) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 3200);
    return () => window.clearInterval(id);
  }, [open]);

  return (
    <>
      <button type="button" className={`ab-pill${where === 'bazaar' ? ' is-compact' : ''}`} onClick={() => setOpen(true)} aria-label={w.pill} translate="no">
        <span className="ab-ring" aria-hidden="true" />
        <span className="ab-pill-in">
          <Orb />
          <span key={tick} className="ab-hint">
            {where === 'bazaar'
              ? `${w.ideas[tick % w.ideas.length]}…`
              : tick === 0
                ? w.pill
                : `${w.ideas[(tick - 1) % w.ideas.length]}…`}
          </span>
          <span className="ab-mic" aria-hidden="true">
            <svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
          </span>
        </span>
      </button>
      {open && <AskOverlay w={w} onClose={() => setOpen(false)} />}
    </>
  );
}

/** The conversation lives for this visit (the tab), like a session cookie. */
const STORE = 'ask:chat:v1';
function loadChat(): Msg[] {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORE) || '[]') as Msg[];
    return Array.isArray(saved) ? saved.filter((m) => !m.thinking && (!m.going || m.text)).map((m) => ({ ...m, going: undefined })).slice(-40) : [];
  } catch {
    return [];
  }
}

function AskOverlay({ w, onClose }: { w: (typeof W)['en']; onClose: () => void }) {
  const [msgs, setMsgs] = useState<Msg[]>(loadChat);
  useEffect(() => {
    try {
      sessionStorage.setItem(STORE, JSON.stringify(msgs.filter((m) => !m.thinking && (!m.going || m.text)).slice(-40)));
    } catch {
      // Private mode: the chat simply starts fresh next time.
    }
  }, [msgs]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const speechBase = useRef('');

  const close = () => {
    setLeaving(true);
    window.setTimeout(onClose, 220);
  };

  // Escape and the phone's back button close it; the page underneath stays put.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.history.pushState({ ...(window.history.state ?? {}), askOpen: true }, '');
    const onPop = () => close();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && window.history.back();
    window.addEventListener('popstate', onPop);
    document.addEventListener('keydown', onKey);
    window.setTimeout(() => input.current?.focus(), 250);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('popstate', onPop);
      document.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight, behavior: msgs.length > 2 ? 'smooth' : 'auto' });
  }, [msgs]);

  async function ask(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    setDraft('');
    setBusy(true);
    setMsgs((m) => [...m, { from: 'me', text: q }, { from: 'bot', thinking: true }]);
    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          q,
          // The conversation so far, so follow-ups ("explain more") make sense.
          history: msgs.filter((m) => m.text && !m.thinking).slice(-6).map((m) => ({ from: m.from, text: m.text })),
          // What the shopper has narrowed to so far ("cheaper", "only in Berlin" change it).
          filters: [...msgs].reverse().find((m) => m.from === 'bot' && m.filters)?.filters ?? null,
        }),
      });
      const d = (await res.json().catch(() => null)) as {
        links?: AskLink[]; results?: AskResult[]; answer?: string | null; note?: string | null; go?: boolean; error?: string; filters?: unknown;
        action?: { type: 'setup'; kind: 'event' | 'shop' | 'restaurant' };
      } | null;
      const links = d?.links ?? [];
      const results = d?.results ?? [];
      let reply: Msg;
      const filters = d?.filters ?? undefined;
      if (d?.action?.type === 'setup') {
        // "Set up a shop with momo for €30…": hand this exact request to the
        // setup assistant in the page editor (a free demo), which starts from it.
        const kind = d.action.kind;
        reply = { from: 'bot', text: d.answer ?? undefined, going: { icon: '✨', label: 'Setup assistant', href: '/demo' } };
        window.setTimeout(() => startSetup(kind, q), 1400);
      } else if (d?.go && links[0]) {
        // Kept (with its answer) so the chat, reopened on the next page, still knows the filters.
        reply = { from: 'bot', going: links[0], text: d.answer ?? undefined, links, filters };
        window.setTimeout(() => (window.location.href = links[0].href), 1100);
      } else {
        const text = d?.error ?? d?.answer ?? d?.note ?? (results.length || links.length ? undefined : w.none);
        reply = { from: 'bot', text, links, results, filters };
      }
      setMsgs((m) => [...m.slice(0, -1), reply]);
    } catch {
      setMsgs((m) => [...m.slice(0, -1), { from: 'bot', text: w.none }]);
    } finally {
      setBusy(false);
      input.current?.focus();
    }
  }

  const groups = (rs: AskResult[]) =>
    (['event', 'offer', 'shop', 'item'] as const)
      .map((k) => ({ k, label: { event: w.events, offer: w.offers, shop: w.shops, item: w.items }[k], list: rs.filter((r) => r.kind === k) }))
      .filter((g) => g.list.length);

  return createPortal(
    <div className={`ab-overlay${leaving ? ' is-leaving' : ''}`} role="dialog" aria-modal="true" aria-label={w.hello} translate="no">
      <div className="ab-aurora" aria-hidden="true" />
      <div className="ab-top">
        <Orb busy={busy} size={30} />
        <span className="ab-top-title">Ask</span>
        {msgs.length > 0 && (
          <button type="button" className="ab-new" onClick={() => setMsgs([])} disabled={busy}>
            ＋ {w.fresh}
          </button>
        )}
        <button type="button" className="ab-x" onClick={() => window.history.back()} aria-label={w.close}>
          ✕
        </button>
      </div>

      <div className="ab-log" ref={log}>
        {msgs.length === 0 && (
          <div className="ab-hello">
            <Orb size={64} />
            <h2>{w.hello}</h2>
            <p>{w.sub}</p>
            <p className="ab-langs">{w.langs}</p>
            <div className="ab-ideas">
              {w.ideas.map((i, k) => (
                <button
                  key={i}
                  type="button"
                  className={`ab-idea${/^(Ma euta|Berlin ma|10 euro bhanda)/.test(i) ? ' is-roman' : ''}`}
                  style={{ animationDelay: `${0.15 + k * 0.06}s` }}
                  onClick={() => void ask(i)}
                >
                  {i}
                </button>
              ))}
            </div>
          </div>
        )}
        {msgs.map((m, i) =>
          m.from === 'me' ? (
            <div key={i} className="ab-me">
              {m.text}
            </div>
          ) : (
            <div key={i} className="ab-bot">
              {m.thinking ? (
                <span className="ab-dots" aria-label="…"><i /><i /><i /></span>
              ) : m.going ? (
                <>
                  {m.text && <p>{rich(m.text, onClose)}</p>}
                  <p className="ab-going">
                    {w.opening} <strong>{m.going.icon} {m.going.label}</strong>…
                  </p>
                </>
              ) : (
                <>
                  {m.text && <p>{rich(m.text, onClose)}</p>}
                  {m.links && m.links.length > 0 && (
                    <div className="ab-links">
                      {m.links.map((l) =>
                        isWatch(l.href) ? (
                          <StoryPlayer key={l.href} storyId="customer" label={`${l.label} · 1½ min`} />
                        ) : (
                        <Link
                          key={l.href}
                          href={l.href}
                          className={`ab-link${isBuild(l.href) ? ' is-build' : ''}`}
                          onClick={(e) => {
                            if (isBuild(l.href)) {
                              e.preventDefault();
                              startSetup(guessKind());
                              return;
                            }
                            onClose();
                          }}
                        >
                          <span aria-hidden="true">{l.icon}</span> {l.label} →
                        </Link>
                        )
                      )}
                    </div>
                  )}
                  {m.results &&
                    groups(m.results).map((g) => (
                      <div key={g.k} className="ab-group">
                        <div className="ab-group-title">{g.label}</div>
                        <div className="ab-cards">
                          {g.list.map((r) => (
                            <Link key={r.href} href={r.href} className="ab-card" onClick={onClose}>
                              <span className="ab-card-img">
                                {r.image ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={r.image} alt="" loading="lazy" />
                                ) : (
                                  <span aria-hidden="true">{r.kind === 'event' || r.kind === 'offer' ? '🎟' : r.kind === 'shop' ? '🏪' : '🥟'}</span>
                                )}
                              </span>
                              <strong>{r.title}</strong>
                              <span>{r.sub}</span>
                            </Link>
                          ))}
                        </div>
                      </div>
                    ))}
                </>
              )}
            </div>
          )
        )}
      </div>

      <form
        className="ab-input"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(draft);
        }}
      >
        <span className="ab-ring" aria-hidden="true" />
        <span className="ab-input-in">
          <Orb busy={busy} />
          <input
            ref={input}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={w.ph}
            maxLength={200}
            enterKeyHint="search"
            aria-label={w.ph}
          />
          <SpeechInput
            label="Speak"
            onStart={() => (speechBase.current = draft.trim() ? draft.trimEnd() + ' ' : '')}
            onText={(t) => setDraft(speechBase.current + t)}
          />
          <button type="submit" className="ab-send" disabled={busy || !draft.trim()} aria-label="Send">
            ↑
          </button>
        </span>
      </form>
    </div>,
    document.body
  );
}
