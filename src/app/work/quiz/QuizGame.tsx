'use client';

// The live quiz demo: a projector view for the hall and a phone for each
// player, in one page. The other nine players are simulated (game.ts) and the
// whole thing runs in this browser — no server, no sockets, nothing sent.
// Sounds are made live (sound.ts) and only after the visitor taps something.

import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import QRCode from 'qrcode';
import { COPY, MY_AVATARS, QUESTIONS, num, toNeDigits, type QuizCopy, type QuizLang } from './content';
import {
  BOARD_SLIDE_AT,
  QUESTION_MS,
  READY_MS,
  YOU,
  elapsed,
  initialState,
  joinedPlayers,
  me,
  reduce,
  type Player,
  type QuizState,
} from './game';
import { QuizSfx } from './sound';

type View = 'auto' | 'big' | 'phone' | 'both';

const LANG_KEY = 'mn-demo:quiz-lang';
const MUTE_KEY = 'mn-demo:quiz-mute';
const NICK_KEY = 'mn-demo:quiz-nick';
const SITE = 'https://www.martnepali.com';

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
const roomText = (room: string, lang: QuizLang) => (lang === 'ne' ? toNeDigits(room) : room);
const ease = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);

// ---------- small pieces ----------

const SHAPES = [
  <polygon key="t" points="12,3 22,20 2,20" />,
  <polygon key="d" points="12,2 22,12 12,22 2,12" />,
  <circle key="c" cx="12" cy="12" r="9.5" />,
  <rect key="s" x="3" y="3" width="18" height="18" rx="1.5" />,
];
function Shape({ i }: { i: number }) {
  return (
    <svg className="qz-shape" viewBox="0 0 24 24" aria-hidden="true">
      {SHAPES[i]}
    </svg>
  );
}

function Avatar({ p, big }: { p: Pick<Player, 'avatar' | 'hue'>; big?: boolean }) {
  return (
    <span className={`qz-av${big ? ' qz-av-big' : ''}`} style={{ '--h': p.hue } as CSSProperties} aria-hidden="true">
      {p.avatar}
    </span>
  );
}

function Qr({ text }: { text: string }) {
  const path = useMemo(() => {
    const qr = QRCode.create(text, { errorCorrectionLevel: 'M' });
    const n = qr.modules.size;
    let d = '';
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (qr.modules.get(y, x)) d += `M${x + 2} ${y + 2}h1v1h-1z`;
    return { d, n: n + 4 };
  }, [text]);
  return (
    <svg className="qz-qr" viewBox={`0 0 ${path.n} ${path.n}`} role="img" aria-label="QR code" shapeRendering="crispEdges">
      <rect width={path.n} height={path.n} fill="#fff" />
      <path d={path.d} fill="#140c2e" />
    </svg>
  );
}

function Ring({ left, lang }: { left: number; lang: QuizLang }) {
  const frac = Math.max(0, Math.min(1, left / QUESTION_MS));
  const secs = Math.ceil(left / 1000);
  const C = 2 * Math.PI * 42;
  return (
    <div className={`qz-ring${secs <= 5 ? ' is-low' : ''}`} role="timer" aria-label={`${secs}`}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r="42" className="qz-ring-bg" />
        <circle cx="50" cy="50" r="42" className="qz-ring-fg" strokeDasharray={C} strokeDashoffset={C * (1 - frac)} />
      </svg>
      <span>{num(Math.max(0, secs), lang)}</span>
    </div>
  );
}

function Bunting() {
  const cols = ['#3b82f6', '#f8fafc', '#ef4444', '#22c55e', '#facc15'];
  return (
    <div className="qz-bunting" aria-hidden="true">
      {Array.from({ length: 22 }, (_, i) => (
        <i key={i} style={{ background: cols[i % 5], animationDelay: `${(i % 7) * -0.4}s` }} />
      ))}
    </div>
  );
}

function Confetti() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    const g = c?.getContext('2d');
    if (!c || !g || lessMotion()) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = (c.width = Math.round(c.clientWidth * dpr));
    const H = (c.height = Math.round(c.clientHeight * dpr));
    const cols = ['#3b82f6', '#ffffff', '#ef4444', '#22c55e', '#facc15', '#ff6f91', '#ffb347'];
    const bits = Array.from({ length: 140 }, (_, i) => ({
      x: W * (0.1 + 0.8 * Math.random()),
      y: -H * Math.random() * 0.8,
      vx: (Math.random() - 0.5) * 2 * dpr,
      vy: (1.6 + Math.random() * 2.4) * dpr,
      r: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.25,
      s: (4 + Math.random() * 5) * dpr,
      c: cols[i % cols.length],
    }));
    let raf = 0;
    const t0 = performance.now();
    const draw = (now: number) => {
      const age = now - t0;
      g.clearRect(0, 0, W, H);
      let alive = false;
      for (const b of bits) {
        b.x += b.vx + Math.sin((now + b.s * 90) / 400) * 0.6 * dpr;
        b.y += b.vy;
        b.r += b.vr;
        if (b.y > H + 20) {
          if (age < 4500) {
            b.y = -10;
            b.x = W * Math.random();
          } else continue;
        }
        alive = true;
        g.save();
        g.translate(b.x, b.y);
        g.rotate(b.r);
        g.fillStyle = b.c;
        g.fillRect(-b.s / 2, -b.s / 4, b.s, b.s / 2);
        g.restore();
      }
      if (alive) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} className="qz-confetti" aria-hidden="true" />;
}

// ---------- the big screen ----------

function counts(s: QuizState): number[] {
  const c = [0, 0, 0, 0];
  for (const a of Object.values(s.answers)) c[a.choice]++;
  return c;
}

function BigScreen({ s, lang }: { s: QuizState; lang: QuizLang }) {
  const t: QuizCopy = COPY[lang];
  const e = elapsed(s);
  const n = QUESTIONS.length;
  const qn = QUESTIONS[s.q];
  const qt = qn[lang];
  const players = joinedPlayers(s);
  const url = `${SITE}/work/quiz?room=${s.room.replace(' ', '')}#phone`;

  let body: ReactNode;
  if (s.phase === 'lobby') {
    body = (
      <div className="qz-lobby">
        <div className="qz-lobby-join">
          <p className="qz-event">{t.eventName}</p>
          <div className="qz-qr-card">
            <Qr text={url} />
            <div>
              <p className="qz-scan">{t.scan}</p>
              <p className="qz-room-label">{t.room}</p>
              <p className="qz-room">{roomText(s.room, lang)}</p>
            </div>
          </div>
        </div>
        <div className="qz-lobby-room">
          <p className="qz-count">
            <b>{t.players(num(players.length, lang))}</b>
            {players.length < s.players.length && <span className="qz-dots">{t.waiting}</span>}
          </p>
          <ul className="qz-chips">
            {players.map((p) => (
              <li key={p.id} className={`qz-chip${p.id === YOU ? ' is-you' : ''}`}>
                <Avatar p={p} />
                <span>{p.name}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  } else if (s.phase === 'ready') {
    body = (
      <div className="qz-ready" key={`r${s.q}`}>
        <p className="qz-pill">{t.questionOf(num(s.q + 1, lang), num(n, lang))}</p>
        <p className="qz-cat">{qt.cat}</p>
        <h3 className="qz-q qz-q-big">{qt.q}</h3>
        <div className="qz-ready-bar">
          <i style={{ transform: `scaleX(${1 - Math.min(1, e / READY_MS)})` }} />
        </div>
      </div>
    );
  } else if (s.phase === 'question' || s.phase === 'reveal') {
    const reveal = s.phase === 'reveal';
    const c = counts(s);
    const max = Math.max(1, ...c);
    const answered = Object.keys(s.answers).length;
    body = (
      <div className={`qz-round${reveal ? ' is-reveal' : ''}`} key={`q${s.q}`}>
        <div className="qz-round-top">
          <p className="qz-pill">{t.questionOf(num(s.q + 1, lang), num(n, lang))}</p>
          <p className="qz-cat">{qt.cat}</p>
        </div>
        <h3 className="qz-q">{qt.q}</h3>
        <div className="qz-mid">
          {reveal ? (
            <>
              <div className="qz-bars" aria-label={t.answersIn}>
                {c.map((v, i) => (
                  <div key={i} className={`qz-bar qz-c${i}${i === qn.correct ? ' is-right' : ''}`}>
                    <span className="qz-bar-n">{num(v, lang)}</span>
                    <i style={{ '--v': v / max } as CSSProperties} />
                    <span className="qz-bar-k">
                      <Shape i={i} />
                      {i === qn.correct && <b aria-hidden="true">✓</b>}
                    </span>
                  </div>
                ))}
              </div>
              <p className="qz-fact">
                <b>{t.didYouKnow}</b> {qt.fact}
              </p>
            </>
          ) : (
            <>
              <Ring left={QUESTION_MS - e} lang={lang} />
              <ul className="qz-in" aria-hidden="true">
                {players
                  .filter((pl) => s.answers[pl.id])
                  .map((pl) => (
                    <li key={pl.id} title={pl.name}>
                      <Avatar p={pl} />
                    </li>
                  ))}
              </ul>
              <div className="qz-answered">
                <b>{num(answered, lang)}</b>
                <span>{t.answersIn}</span>
              </div>
            </>
          )}
        </div>
        <ul className="qz-answers">
          {qt.a.map((a, i) => (
            <li key={i} className={`qz-ans qz-c${i}${reveal ? (i === qn.correct ? ' is-right' : ' is-wrong') : ''}`}>
              <Shape i={i} />
              <span>{a}</span>
              {reveal && i === qn.correct && <b className="qz-tick">✓</b>}
            </li>
          ))}
        </ul>
      </div>
    );
  } else if (s.phase === 'board') {
    const slid = e >= BOARD_SLIDE_AT;
    const p = ease((e - BOARD_SLIDE_AT) / 1300);
    const list = players;
    body = (
      <div className="qz-board">
        <div className="qz-board-head">
          <h3>{t.leaderboard}</h3>
          <span>{t.afterQ(num(s.q + 1, lang))}</span>
        </div>
        <ol className="qz-rows" style={{ '--n': list.length } as CSSProperties}>
          {list.map((pl) => {
            const r = slid ? pl.rank : pl.prevRank;
            const shown = pl.prevScore + (pl.score - pl.prevScore) * (slid ? p : 0);
            const moved = pl.prevRank - pl.rank;
            return (
              <li
                key={pl.id}
                className={`qz-row${pl.id === YOU ? ' is-you' : ''}${r < 3 ? ` is-top is-top${r}` : ''}`}
                style={{ '--r': r } as CSSProperties}
              >
                <span className="qz-row-rank">{num(r + 1, lang)}</span>
                <Avatar p={pl} />
                <span className="qz-row-name">
                  {pl.name}
                  {pl.id === YOU && <em> · {t.you}</em>}
                </span>
                {slid && moved !== 0 && (
                  <span className={`qz-move ${moved > 0 ? 'up' : 'down'}`}>
                    {moved > 0 ? '▲' : '▼'}
                    {num(Math.abs(moved), lang)}
                  </span>
                )}
                {pl.gain > 0 && <span className="qz-gain">+{num(pl.gain, lang)}</span>}
                <span className="qz-row-score">{num(shown, lang)}</span>
              </li>
            );
          })}
        </ol>
      </div>
    );
  } else {
    const order = [...players].sort((a, b) => a.rank - b.rank);
    const top = [order[1], order[0], order[2]].filter(Boolean);
    const you = me(s);
    body = (
      <div className="qz-podium">
        <Confetti />
        <h3>{t.podium}</h3>
        <div className="qz-steps">
          {top.map((pl) => (
            <div key={pl.id} className={`qz-step qz-step${pl.rank}${pl.id === YOU ? ' is-you' : ''}`}>
              <Avatar p={pl} big />
              <p className="qz-step-name">{pl.name}</p>
              <p className="qz-step-score">
                {num(pl.score, lang)} {t.pts}
              </p>
              <div className="qz-block">
                <span>{num(pl.rank + 1, lang)}</span>
              </div>
            </div>
          ))}
        </div>
        <p className="qz-podium-foot">
          {you && you.rank > 2 ? (
            <>
              {t.you}: #{num(you.rank + 1, lang)} · {num(you.score, lang)} {t.pts} ·{' '}
            </>
          ) : null}
          {t.thanks}
        </p>
      </div>
    );
  }

  return (
    <div className="qz-screen-wrap">
      <div className={`qz-screen qz-ph-${s.phase}`} data-phase={s.phase}>
        <Bunting />
        <div className="qz-screen-brand">
          <span>{t.eventName}</span>
          {s.phase !== 'lobby' && (
            <span className="qz-screen-room">
              {t.room} {roomText(s.room, lang)}
            </span>
          )}
        </div>
        <div className="qz-screen-body">{body}</div>
        {s.paused && (
          <div className="qz-paused">
            <span>❚❚ {t.paused}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- the phone ----------

type PhoneProps = {
  s: QuizState;
  lang: QuizLang;
  onJoin: (name: string, avatar: string) => void;
  onAnswer: (i: number) => void;
  onStart: () => void;
  onAgain: () => void;
  tap: () => void;
};

function Phone({ s, lang, onJoin, onAnswer, onStart, onAgain, tap }: PhoneProps) {
  const t: QuizCopy = COPY[lang];
  const you = me(s);
  const [nick, setNick] = useState('');
  const [av, setAv] = useState(0);
  const e = elapsed(s);
  const total = joinedPlayers(s).length;
  const qn = QUESTIONS[s.q];
  const mine = s.answers[YOU];

  useEffect(() => {
    const saved = load(NICK_KEY);
    if (saved) setNick(saved);
  }, []);

  const join = (ev: FormEvent) => {
    ev.preventDefault();
    const name = nick.trim().slice(0, 16) || t.guest;
    save(NICK_KEY, name);
    onJoin(name, MY_AVATARS[av]);
  };

  let body: ReactNode;
  if (s.phase === 'lobby' && !you) {
    body = (
      <form className="qz-p-join" onSubmit={join}>
        <p className="qz-p-event">{t.eventName}</p>
        <button
          type="button"
          className="qz-p-avpick"
          onClick={() => {
            tap();
            setAv((v) => (v + 1) % MY_AVATARS.length);
          }}
          aria-label={t.avatarHint}
        >
          <Avatar p={{ avatar: MY_AVATARS[av], hue: 150 }} big />
        </button>
        <p className="qz-p-hint">{t.avatarHint}</p>
        <label className="qz-p-label" htmlFor="qz-nick">
          {t.nickLabel}
        </label>
        <input
          id="qz-nick"
          className="qz-p-input"
          value={nick}
          maxLength={16}
          autoComplete="off"
          placeholder={t.nickPh}
          onChange={(ev) => setNick(ev.target.value)}
        />
        <button type="submit" className="qz-p-btn" data-act="join">
          {t.join}
        </button>
      </form>
    );
  } else if (s.phase === 'lobby' && you) {
    body = (
      <div className="qz-p-center">
        <Avatar p={you} big />
        <p className="qz-p-big">{t.youreIn}</p>
        <p className="qz-p-name">{you.name}</p>
        <p className="qz-p-dim">{t.seeYourName}</p>
        <button type="button" className="qz-p-btn qz-p-btn-soft" onClick={onStart} data-act="phone-start">
          {t.startNow}
        </button>
        <p className="qz-p-small">{t.hostToo}</p>
      </div>
    );
  } else if (s.phase === 'ready') {
    body = (
      <div className="qz-p-center" key={`r${s.q}`}>
        <p className="qz-p-qno">{num(s.q + 1, lang)}</p>
        <p className="qz-p-big">{t.getReady}</p>
        <p className="qz-p-dim">{qn[lang].cat}</p>
        <div className="qz-ready-bar qz-p-ready">
          <i style={{ transform: `scaleX(${1 - Math.min(1, e / READY_MS)})` }} />
        </div>
      </div>
    );
  } else if (s.phase === 'question' && !mine) {
    const left = Math.max(0, QUESTION_MS - e);
    body = (
      <div className="qz-p-play">
        <div className="qz-p-qhead">
          <span>{t.qShort(num(s.q + 1, lang), num(QUESTIONS.length, lang))}</span>
          <span className={`qz-p-secs${left <= 5000 ? ' is-low' : ''}`}>{num(Math.ceil(left / 1000), lang)}</span>
        </div>
        <div className="qz-p-timer">
          <i style={{ transform: `scaleX(${left / QUESTION_MS})` }} />
        </div>
        <p className="qz-p-q">{qn[lang].q}</p>
        <div className="qz-p-grid">
          {qn[lang].a.map((a, i) => (
            <button
              key={i}
              type="button"
              className={`qz-p-ans qz-c${i}`}
              onClick={() => onAnswer(i)}
              data-act={`answer-${i}`}
              aria-label={`${t.shapes[i]}: ${a}`}
            >
              <Shape i={i} />
              <span>{a}</span>
            </button>
          ))}
        </div>
      </div>
    );
  } else if (s.phase === 'question' && mine) {
    body = (
      <div className={`qz-p-center qz-p-tint qz-c${mine.choice}`}>
        <span className="qz-p-shape-big">
          <Shape i={mine.choice} />
        </span>
        <p className="qz-p-big">{t.locked}</p>
        <p className="qz-p-dim">{t.waitOthers}</p>
      </div>
    );
  } else if (s.phase === 'reveal' && you) {
    const right = mine && mine.choice === qn.correct;
    body = (
      <div className={`qz-p-center qz-p-result ${right ? 'is-right' : 'is-wrong'}`}>
        <span className="qz-p-mark" aria-hidden="true">
          {right ? '✓' : '✕'}
        </span>
        <p className="qz-p-big">{right ? t.correct : mine ? t.wrong : t.tooSlow}</p>
        {right ? (
          <p className="qz-p-gain">+{num(you.gain, lang)}</p>
        ) : (
          <p className="qz-p-dim">
            {t.answerWas}: <b>{qn[lang].a[qn.correct]}</b>
          </p>
        )}
        <p className="qz-p-chip">
          {t.totalScore}: {num(you.score, lang)}
        </p>
      </div>
    );
  } else if (s.phase === 'board' && you) {
    const order = [...joinedPlayers(s)].sort((a, b) => a.rank - b.rank);
    const ahead = you.rank > 0 ? order[you.rank - 1] : null;
    body = (
      <div className="qz-p-center">
        <p className="qz-p-dim">{t.yourRank}</p>
        <p className="qz-p-rank">#{num(you.rank + 1, lang)}</p>
        <p className="qz-p-dim">{t.of(num(total, lang))}</p>
        <p className="qz-p-chip">
          {num(you.score, lang)} {t.pts}
          {you.gain > 0 && (
            <>
              {' '}
              · +{num(you.gain, lang)} {t.thisRound}
            </>
          )}
        </p>
        <p className="qz-p-dim">{ahead ? t.behind(num(ahead.score - you.score, lang), ahead.name) : t.leading}</p>
      </div>
    );
  } else if (s.phase === 'podium' && you) {
    const medal = ['🥇', '🥈', '🥉'][you.rank] ?? '🎉';
    body = (
      <div className="qz-p-center">
        <span className="qz-p-medal" aria-hidden="true">
          {medal}
        </span>
        <p className="qz-p-dim">{t.finished}</p>
        <p className="qz-p-rank">#{num(you.rank + 1, lang)}</p>
        <p className="qz-p-dim">{t.of(num(total, lang))}</p>
        <p className="qz-p-chip">
          {t.totalScore}: {num(you.score, lang)}
        </p>
        <button type="button" className="qz-p-btn" onClick={onAgain} data-act="again">
          {t.playAgain}
        </button>
      </div>
    );
  } else {
    body = (
      <div className="qz-p-center">
        <p className="qz-p-big">{t.started}</p>
      </div>
    );
  }

  return (
    <div className="qz-phone" data-phase={s.phase}>
      <div className="qz-phone-screen">
        <div className="qz-p-status" aria-hidden="true">
          <span>20:15</span>
          <span className="qz-p-notch" />
          <span>●●● 5G ▮</span>
        </div>
        <div className="qz-p-app">
          <span className="qz-p-logo">{t.phoneApp}</span>
          {you ? (
            <span className="qz-p-me">
              <Avatar p={you} />
              <span>{you.name}</span>
              {s.phase !== 'lobby' && <b>{num(you.score, lang)}</b>}
            </span>
          ) : (
            <span className="qz-p-room">
              {t.room} {roomText(s.room, lang)}
            </span>
          )}
        </div>
        <div className="qz-p-body">{body}</div>
        {s.paused && (
          <div className="qz-paused qz-p-paused">
            <span>❚❚ {t.paused}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- the page ----------

export default function QuizGame() {
  const [lang, setLang] = useState<QuizLang>('en');
  const [view, setView] = useState<View>('auto');
  const [wide, setWide] = useState(true);
  const [muted, setMuted] = useState(false);
  const [s, dispatch] = useReducer(reduce, undefined, () => initialState());
  const sfx = useRef<QuizSfx | null>(null);
  const t: QuizCopy = COPY[lang];

  // Saved choices, the screen width, and a #phone link (that is where the QR code points).
  useEffect(() => {
    const l = load(LANG_KEY);
    if (l === 'en' || l === 'ne') setLang(l);
    if (load(MUTE_KEY) === '1') setMuted(true);
    if (location.hash === '#phone' || new URLSearchParams(location.search).get('view') === 'phone') setView('phone');
    const mq = window.matchMedia('(min-width: 900px)');
    const fit = () => setWide(mq.matches);
    fit();
    mq.addEventListener?.('change', fit);
    return () => mq.removeEventListener?.('change', fit);
  }, []);

  // The game clock: ten ticks a second, real elapsed time, stopped while the tab is hidden.
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

  useEffect(() => {
    const fx = new QuizSfx();
    sfx.current = fx;
    return () => fx.close();
  }, []);
  useEffect(() => {
    if (sfx.current) sfx.current.muted = muted;
  }, [muted]);

  const unlock = useCallback(() => sfx.current?.unlock(), []);
  const tap = useCallback(() => {
    unlock();
    sfx.current?.tap();
  }, [unlock]);

  // ----- sounds that follow the game -----
  const prev = useRef({ phase: s.phase, q: s.q, joined: 0, secs: 99 });
  const joinedCount = joinedPlayers(s).length;
  const secsLeft = s.phase === 'question' ? Math.ceil((QUESTION_MS - elapsed(s)) / 1000) : 99;
  useEffect(() => {
    const fx = sfx.current;
    const p = prev.current;
    if (fx) {
      if (s.phase !== p.phase || s.q !== p.q) {
        if (s.phase === 'ready') fx.whoosh();
        if (s.phase === 'reveal') {
          const mine = s.answers[YOU];
          if (!mine) fx.chime();
          else if (mine.choice === QUESTIONS[s.q].correct) fx.correct();
          else fx.wrong();
        }
        if (s.phase === 'board') window.setTimeout(() => sfx.current?.swish(), BOARD_SLIDE_AT);
        if (s.phase === 'podium') fx.fanfare();
      } else if (s.phase === 'lobby' && joinedCount > p.joined) fx.pop();
      else if (s.phase === 'question' && secsLeft !== p.secs && secsLeft > 0 && !s.paused) fx.tick(secsLeft <= 5);
    }
    prev.current = { phase: s.phase, q: s.q, joined: joinedCount, secs: secsLeft };
  }, [s.phase, s.q, s.answers, s.paused, joinedCount, secsLeft]);

  const pickLang = (l: QuizLang) => {
    unlock();
    setLang(l);
    save(LANG_KEY, l);
  };
  const toggleMute = () => {
    unlock();
    setMuted((m) => {
      save(MUTE_KEY, m ? '0' : '1');
      return !m;
    });
  };
  const start = () => {
    unlock();
    dispatch({ type: 'start', guestName: COPY[lang].guest });
  };
  const restart = () => {
    unlock();
    dispatch({ type: 'restart', seed: Math.floor(Math.random() * 2 ** 31) });
  };

  const shown: Exclude<View, 'auto'> = view === 'auto' ? (wide ? 'both' : 'phone') : view;
  const lobby = s.phase === 'lobby';
  const over = s.phase === 'podium';

  return (
    <div className={`qz qz-lang-${lang}`} lang={lang === 'ne' ? 'ne' : 'en'} translate="no" data-qz-phase={s.phase}>
      <div className="qz-top">
        <div className="qz-top-text">
          <h1 className="qz-title">{t.demoTitle}</h1>
          <p className="qz-intro">{t.intro}</p>
        </div>
        <div className="qz-switches">
          <div className="qz-seg" role="group" aria-label={t.viewLabel}>
            {(['big', 'phone', 'both'] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={shown === v}
                onClick={() => {
                  unlock();
                  setView(v);
                }}
                data-view={v}
              >
                {t.views[v]}
              </button>
            ))}
          </div>
          <div className="qz-seg qz-seg-lang" role="group" aria-label="Language / भाषा">
            <button type="button" aria-pressed={lang === 'en'} onClick={() => pickLang('en')}>
              EN
            </button>
            <button type="button" aria-pressed={lang === 'ne'} onClick={() => pickLang('ne')} lang="ne">
              नेपाली
            </button>
          </div>
        </div>
      </div>

      <div className={`qz-stage qz-view-${view} qz-show-${shown}`}>
        <div className="qz-big-col">
          <BigScreen s={s} lang={lang} />
          <div className="qz-host" role="group" aria-label={t.hostControls}>
            <span className="qz-host-label">{t.hostControls}</span>
            <div className="qz-host-btns">
              {lobby ? (
                <button type="button" className="qz-hb qz-hb-go" onClick={start} data-act="start">
                  ▶ {t.start}
                </button>
              ) : (
                <button
                  type="button"
                  className="qz-hb qz-hb-go"
                  onClick={() => {
                    unlock();
                    dispatch({ type: 'next' });
                  }}
                  disabled={over}
                  data-act="next"
                >
                  ⏭ {t.next}
                </button>
              )}
              <button
                type="button"
                className="qz-hb"
                onClick={() => {
                  unlock();
                  dispatch({ type: 'pause' });
                }}
                disabled={lobby || over}
                aria-pressed={s.paused}
                data-act="pause"
              >
                {s.paused ? `▶ ${t.resume}` : `❚❚ ${t.pause}`}
              </button>
              <button type="button" className="qz-hb" onClick={restart} data-act="restart">
                ↺ {t.restart}
              </button>
              <button
                type="button"
                className="qz-hb qz-hb-icon"
                onClick={toggleMute}
                aria-pressed={!muted}
                aria-label={muted ? t.soundOn : t.soundOff}
                title={muted ? t.soundOn : t.soundOff}
                data-act="mute"
              >
                {muted ? '🔇' : '🔊'}
              </button>
            </div>
            <p className="qz-host-hint">{lobby ? t.hostHintLobby : over ? t.hostHintEnd : t.hostHint}</p>
          </div>
        </div>
        <div className="qz-phone-col">
          <Phone
            s={s}
            lang={lang}
            tap={tap}
            onJoin={(name, avatar) => {
              tap();
              dispatch({ type: 'join', name, avatar });
            }}
            onAnswer={(i) => {
              tap();
              dispatch({ type: 'answer', choice: i });
            }}
            onStart={start}
            onAgain={restart}
          />
        </div>
      </div>
    </div>
  );
}
