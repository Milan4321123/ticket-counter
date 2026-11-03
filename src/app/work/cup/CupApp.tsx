'use client';

// The futsal tournament demo: "Himal Cup 2027", a made-up one-day futsal cup
// for Nepali community clubs in Germany, in a hall in Offenbach. Fans get the
// live match centre (simulated scores with a minute clock, goals, cards and
// subs), group tables that sort themselves live with every tie-breaker, the
// knockout bracket filling in, top scorers and fair play, the fixtures by
// pitch and a team registration form. The referee desk takes a match over —
// goals with a scorer, cards, the whistle, undo — and the hall TV gets a big
// screen. All the rules live in cup.ts; this file only draws them. Everything
// stays in localStorage under one key — nothing is sent anywhere, and there is
// no money anywhere: a trophy and medals only.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { Crest, Icon, PenDots, Trophy, inkOn } from './art';
import {
  BRACKET,
  CAPTAIN_MAX,
  GROUPS,
  MOTIFS,
  NAME_MAX,
  REG_COLORS,
  SPEEDS,
  SQUADS,
  TEAMS,
  TEAM_IDS,
  champion,
  clockLabel,
  crestInitials,
  fairPlay,
  fresh,
  groupDone,
  isOn,
  liveMatches,
  matchClock,
  normalize,
  player,
  refAct,
  refCan,
  register,
  score,
  sentOff,
  setFollow,
  setPaused,
  setSpeed,
  slots,
  table,
  tick,
  topScorers,
  upcoming,
  winnerSide,
  type GroupId,
  type Match,
  type MatchEvent,
  type Motif,
  type Note,
  type RefAction,
  type RegError,
  type Side,
  type State,
  type TeamId,
} from './cup';
import { COPY, LANGS, num, type Copy, type Lang, type Mode, type Tab } from './content';

const STORE_KEY = 'mn-demo:cup';
const FIRST_SEED = 2027;
const TABS: Tab[] = ['live', 'fixtures', 'tables', 'bracket', 'stats', 'join'];

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
function clearRaw() {
  try {
    localStorage.removeItem(STORE_KEY);
  } catch {
    /* ignore */
  }
}

// ---------- small helpers ----------

const clk = (sec: number, lang: Lang) => num(clockLabel(sec), lang);
const scoreText = (m: Match, lang: Lang, sep = '–') => {
  const [h, a] = score(m);
  return `${num(h, lang)}${sep}${num(a, lang)}`;
};
function playerName(team: TeamId | null, no: number, lang: Lang): string {
  if (!team) return `#${no}`;
  const p = player(team, no);
  return `#${num(no, lang)} ${p ? p.name : ''}`.trim();
}
function useReducedMotion(): boolean {
  const [r, setR] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setR(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return r;
}

/** Rows that change place glide to it (FLIP), unless motion is reduced. */
function useFlip(ref: RefObject<HTMLElement | null>) {
  const prev = useRef(new Map<string, number>());
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const now = new Map<string, number>();
    el.querySelectorAll<HTMLElement>('[data-flip]').forEach((row) => {
      const k = row.dataset.flip!;
      const top = row.offsetTop;
      now.set(k, top);
      const before = prev.current.get(k);
      if (!reduce && before !== undefined && before !== top && typeof row.animate === 'function') {
        const up = before > top;
        row.animate(
          [
            { transform: `translateY(${before - top}px)`, backgroundColor: up ? 'rgba(163, 230, 53, 0.22)' : 'rgba(248, 113, 113, 0.14)' },
            { transform: 'translateY(0)', backgroundColor: 'transparent' },
          ],
          { duration: 650, easing: 'cubic-bezier(.2,.8,.2,1)' }
        );
      }
    });
    prev.current = now;
  });
}

function TeamCrest({ team, className = '' }: { team: TeamId; className?: string }) {
  const x = TEAMS[team];
  return <Crest colors={x.colors} motif={x.motif} pattern={x.pattern} initials={x.short} className={className} />;
}
function Placeholder({ className = '' }: { className?: string }) {
  return <Crest colors={['#334155', '#64748b']} motif="star" initials="?" className={`${className} is-tbd`} />;
}

function placeLabel(m: Match, side: Side, t: Copy, lang: Lang): string {
  const b = BRACKET[m.id as keyof typeof BRACKET];
  if (!b) return '?';
  const src = b[side];
  if (src[0] === 'A' || src[0] === 'B') return t.groupPlace(src[0] as GroupId, Number(src[1]) as 1 | 2);
  const n = num(src.slice(-1), lang);
  return src[0] === 'W' ? t.sfWinner(n) : t.sfLoser(n);
}
function stageLabel(m: Match, t: Copy) {
  return m.stage === 'group' ? t.group(m.group!) : t.stage[m.stage];
}

// ---------- status ----------

function StatusChip({ m, t, lang }: { m: Match; t: Copy; lang: Lang }) {
  if (m.status === 'live')
    return (
      <span className="cu-chip is-live" data-clock={m.clock}>
        <span className="cu-dot" aria-hidden="true" />
        {t.live} · {num(matchClock(m), lang)}
      </span>
    );
  if (m.status === 'ht') return <span className="cu-chip is-ht">{t.ht}</span>;
  if (m.status === 'ft') return <span className="cu-chip is-ft">{t.ft}</span>;
  return <span className="cu-chip">{t.kickoffAt(clk(m.kickoff, lang))}</span>;
}

function eventIcon(e: MatchEvent) {
  return e.kind === 'goal' ? '⚽' : e.kind === 'yellow' ? '🟨' : e.kind === 'red' ? '🟥' : '🔁';
}
function EventLine({ e, m, t, lang }: { e: MatchEvent; m: Match; t: Copy; lang: Lang }) {
  const team = m[e.side];
  const label = e.kind === 'red' && e.second ? `${t.ev.red} (${t.secondYellow})` : t.ev[e.kind];
  const who = e.kind === 'sub' && e.no2 ? t.subText(playerName(team, e.no2, lang), playerName(team, e.no, lang)) : playerName(team, e.no, lang);
  return (
    <li className={`cu-ev is-${e.kind} is-${e.side}`}>
      <span className="cu-ev-min">{num(e.min, lang)}&prime;</span>
      <span className="cu-ev-ic" aria-hidden="true">
        {eventIcon(e)}
      </span>
      <span className="cu-ev-txt">
        <span className="cu-sr">{label}: </span>
        {who}
        {team && <span className="cu-ev-team"> · {TEAMS[team].short}</span>}
      </span>
    </li>
  );
}

// ---------- a match card ----------

function TeamSide({
  m,
  side,
  t,
  lang,
  follow,
  onFollow,
}: {
  m: Match;
  side: Side;
  t: Copy;
  lang: Lang;
  follow: TeamId | null;
  onFollow?: (team: TeamId) => void;
}) {
  const team = m[side];
  const won = winnerSide(m) === side;
  return (
    <div className={`cu-side is-${side}${won ? ' is-won' : ''}${team && team === follow ? ' is-followed' : ''}`}>
      {team ? <TeamCrest team={team} className="cu-side-crest" /> : <Placeholder className="cu-side-crest" />}
      <span className="cu-side-name">{team ? TEAMS[team].name : placeLabel(m, side, t, lang)}</span>
      {team && onFollow && (
        <button
          type="button"
          className={`cu-follow${team === follow ? ' is-on' : ''}`}
          aria-pressed={team === follow}
          aria-label={team === follow ? t.unfollowBtn(TEAMS[team].name) : t.followBtn(TEAMS[team].name)}
          title={team === follow ? t.unfollowBtn(TEAMS[team].name) : t.followBtn(TEAMS[team].name)}
          onClick={() => onFollow(team)}
          data-follow={team}
        >
          <Icon name={team === follow ? 'starOn' : 'star'} />
        </button>
      )}
    </div>
  );
}

function MatchCard({
  m,
  t,
  lang,
  follow,
  onFollow,
  big = false,
  feed = 6,
}: {
  m: Match;
  t: Copy;
  lang: Lang;
  follow: TeamId | null;
  onFollow?: (team: TeamId) => void;
  big?: boolean;
  feed?: number;
}) {
  const [h, a] = score(m);
  const evs = m.events.slice(-feed).reverse();
  const pensW = m.pens ? winnerSide(m) : null;
  return (
    <article className={`cu-match${big ? ' is-big' : ''} is-${m.status}`} data-match={m.id} aria-label={`${stageLabel(m, t)} · ${t.pitch(num(m.pitch, lang))}`}>
      <header className="cu-match-head">
        <span className="cu-match-stage">
          {stageLabel(m, t)} · {t.pitch(num(m.pitch, lang))}
        </span>
        <StatusChip m={m} t={t} lang={lang} />
      </header>
      <div className="cu-match-body">
        <TeamSide m={m} side="home" t={t} lang={lang} follow={follow} onFollow={onFollow} />
        <div className="cu-score" aria-live={isOn(m) ? 'polite' : undefined}>
          {m.status === 'scheduled' ? (
            <span className="cu-score-vs">{t.vs}</span>
          ) : (
            <>
              <span key={`h${h}`} className="cu-score-n" data-score-home={h}>
                {num(h, lang)}
              </span>
              <span className="cu-score-sep">:</span>
              <span key={`a${a}`} className="cu-score-n" data-score-away={a}>
                {num(a, lang)}
              </span>
            </>
          )}
          {isOn(m) && <span className="cu-score-half">{m.status === 'ht' ? t.ht : m.half === 1 ? t.firstHalf : t.secondHalf}</span>}
        </div>
        <TeamSide m={m} side="away" t={t} lang={lang} follow={follow} onFollow={onFollow} />
      </div>
      {m.pens && (
        <div className="cu-match-pens">
          <span className="cu-pens-h">{t.pens}</span>
          <PenDots pens={m.pens} side="home" label={`${m.home ? TEAMS[m.home].short : ''}`} />
          <PenDots pens={m.pens} side="away" label={`${m.away ? TEAMS[m.away].short : ''}`} />
          {pensW && m[pensW] && (
            <span className="cu-pens-win">
              {t.penWin(TEAMS[m[pensW]!].name, num(m.pens[pensW].filter(Boolean).length, lang), num(m.pens[pensW === 'home' ? 'away' : 'home'].filter(Boolean).length, lang))}
            </span>
          )}
        </div>
      )}
      {m.status !== 'scheduled' && feed > 0 && (
        <ul className="cu-feed" aria-label={t.refLog}>
          {evs.length ? evs.map((e) => <EventLine key={e.id} e={e} m={m} t={t} lang={lang} />) : <li className="cu-ev is-none">{t.noEvents}</li>}
        </ul>
      )}
    </article>
  );
}

function MiniFixture({ m, t, lang, follow }: { m: Match; t: Copy; lang: Lang; follow: TeamId | null }) {
  const name = (side: Side) => {
    const team = m[side];
    return team ? TEAMS[team].name : placeLabel(m, side, t, lang);
  };
  const mine = !!follow && (m.home === follow || m.away === follow);
  return (
    <li className={`cu-mini is-${m.status}${mine ? ' is-mine' : ''}`} data-fixture={m.id}>
      <span className="cu-mini-when">{m.status === 'scheduled' ? clk(m.kickoff, lang) : <StatusChip m={m} t={t} lang={lang} />}</span>
      <span className="cu-mini-teams">
        <span className="cu-mini-team">
          {m.home ? <TeamCrest team={m.home} className="cu-mini-crest" /> : <Placeholder className="cu-mini-crest" />}
          <span>{name('home')}</span>
        </span>
        <span className="cu-mini-score">{m.status === 'scheduled' ? t.vs : scoreText(m, lang)}</span>
        <span className="cu-mini-team is-away">
          {m.away ? <TeamCrest team={m.away} className="cu-mini-crest" /> : <Placeholder className="cu-mini-crest" />}
          <span>{name('away')}</span>
        </span>
      </span>
      <span className="cu-mini-where">
        {stageLabel(m, t)} · {t.pitch(num(m.pitch, lang))}
        {m.pens && ` · ${t.pens} ${num(m.pens.home.filter(Boolean).length, lang)}–${num(m.pens.away.filter(Boolean).length, lang)}`}
      </span>
    </li>
  );
}

// ---------- tables ----------

function GroupTable({ s, g, t, lang, follow, compact = false }: { s: State; g: GroupId; t: Copy; lang: Lang; follow: TeamId | null; compact?: boolean }) {
  const rows = table(s, g);
  const ref = useRef<HTMLTableSectionElement>(null);
  useFlip(ref);
  const done = groupDone(s, g);
  const notes = rows
    // Only ties that mean something: lots once the group is over, never between teams yet to play.
    .map((r, i) => (r.by && rows[i + 1] && r.p > 0 && (r.by !== 'lots' || done) ? t.tieNote(TEAMS[r.team].name, TEAMS[rows[i + 1].team].name, t.by[r.by]) : null))
    .filter((x): x is string => !!x);
  const c = t.cols;
  const L = t.colsLong;
  return (
    <section className={`cu-table${compact ? ' is-compact' : ''}`} aria-labelledby={`cu-tbl-${g}`} data-table={g}>
      <h3 id={`cu-tbl-${g}`} className="cu-table-h">
        {t.group(g)}
        {done && <span className="cu-chip is-ft">{t.ft}</span>}
      </h3>
      <div className="cu-table-scroll" tabIndex={0} role="region" aria-label={t.group(g)}>
        <table>
          <thead>
            <tr>
              <th scope="col" className="cu-c-pos">
                {c.pos}
              </th>
              <th scope="col" className="cu-c-team">
                {c.team}
              </th>
              {(['p', 'w', 'd', 'l', 'gf', 'ga', 'gd', 'pts'] as const).map((k) => (
                <th key={k} scope="col" className={`cu-c-n cu-c-${k}`}>
                  <abbr title={L[k]}>{c[k]}</abbr>
                </th>
              ))}
            </tr>
          </thead>
          <tbody ref={ref}>
            {rows.map((r, i) => (
              <tr key={r.team} data-flip={r.team} data-team={r.team} className={`${i < 2 ? 'is-q' : ''}${r.team === follow ? ' is-followed' : ''}${r.live ? ' is-live' : ''}`}>
                <td className="cu-c-pos">{num(i + 1, lang)}</td>
                <th scope="row" className="cu-c-team">
                  <span className="cu-row-team">
                    <TeamCrest team={r.team} className="cu-row-crest" />
                    {compact ? (
                      <span className="cu-row-name">{TEAMS[r.team].short}</span>
                    ) : (
                      <>
                        <span className="cu-row-name cu-row-full">{TEAMS[r.team].name}</span>
                        <abbr className="cu-row-name cu-row-short" title={TEAMS[r.team].name}>
                          {TEAMS[r.team].short}
                        </abbr>
                      </>
                    )}
                    {r.live && (
                      <span className="cu-row-live" title={t.liveRow}>
                        <span className="cu-dot" aria-hidden="true" />
                        <span className="cu-sr">{t.liveRow}</span>
                      </span>
                    )}
                  </span>
                </th>
                <td className="cu-c-n">{num(r.p, lang)}</td>
                <td className="cu-c-n">{num(r.w, lang)}</td>
                <td className="cu-c-n">{num(r.d, lang)}</td>
                <td className="cu-c-n">{num(r.l, lang)}</td>
                <td className="cu-c-n">{num(r.gf, lang)}</td>
                <td className="cu-c-n">{num(r.ga, lang)}</td>
                <td className="cu-c-n">{num(r.gd > 0 ? `+${r.gd}` : r.gd, lang)}</td>
                <td className="cu-c-n cu-c-pts" data-pts={r.pts}>
                  {num(r.pts, lang)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="cu-table-foot">
        <span className="cu-q-key" aria-hidden="true" />
        {t.qualify}
      </p>
      {notes.length > 0 && (
        <ul className="cu-tie-notes" data-tie-notes={g}>
          {notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ---------- the bracket ----------

function BracketMatch({ m, t, lang, follow }: { m: Match | undefined; t: Copy; lang: Lang; follow: TeamId | null }) {
  if (!m) return null;
  const [h, a] = score(m);
  const w = winnerSide(m);
  const row = (side: Side, goals: number) => {
    const team = m[side];
    return (
      <div className={`cu-br-row${w === side ? ' is-won' : ''}${w && w !== side ? ' is-out' : ''}${team && team === follow ? ' is-followed' : ''}`}>
        {team ? <TeamCrest team={team} className="cu-br-crest" /> : <Placeholder className="cu-br-crest" />}
        <span className="cu-br-name">{team ? TEAMS[team].name : placeLabel(m, side, t, lang)}</span>
        {m.pens && <PenDots pens={m.pens} side={side} />}
        <span className="cu-br-goals">{m.status === 'scheduled' ? '' : num(goals, lang)}</span>
      </div>
    );
  };
  return (
    <div className={`cu-br-match is-${m.status}`} data-bracket={m.id}>
      <div className="cu-br-meta">
        <span>{t.pitch(num(m.pitch, lang))}</span>
        <StatusChip m={m} t={t} lang={lang} />
      </div>
      {row('home', h)}
      {row('away', a)}
    </div>
  );
}

function Bracket({ s, t, lang, follow }: { s: State; t: Copy; lang: Lang; follow: TeamId | null }) {
  const by = (id: string) => s.matches.find((m) => m.id === id);
  const champ = champion(s);
  return (
    <section className="cu-bracket-box" aria-labelledby="cu-br-h">
      <h3 id="cu-br-h" className="cu-block-h">
        {t.bracketH}
      </h3>
      {!groupDone(s, 'A') || !groupDone(s, 'B') ? <p className="cu-dim cu-br-wait">{t.waitingKo}</p> : null}
      <div className="cu-bracket-scroll" tabIndex={0} role="region" aria-label={t.bracketH}>
        <div className="cu-bracket">
          <div className="cu-br-col cu-br-semis">
            <h4>{t.semis}</h4>
            <BracketMatch m={by('SF1')} t={t} lang={lang} follow={follow} />
            <BracketMatch m={by('SF2')} t={t} lang={lang} follow={follow} />
          </div>
          <div className="cu-br-col cu-br-final">
            <h4>{t.finalH}</h4>
            <BracketMatch m={by('F')} t={t} lang={lang} follow={follow} />
            <h4 className="cu-br-third-h">{t.thirdH}</h4>
            <BracketMatch m={by('3P')} t={t} lang={lang} follow={follow} />
          </div>
          <div className={`cu-br-col cu-br-champ${champ ? ' is-done' : ''}`} data-champion={champ ?? ''}>
            <Trophy className="cu-br-trophy" />
            <p className="cu-br-champ-l">{t.championLabel}</p>
            {champ ? (
              <p className="cu-br-champ-n">
                <TeamCrest team={champ} className="cu-br-crest" />
                {TEAMS[champ].name}
              </p>
            ) : (
              <p className="cu-br-champ-n is-tbd">?</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------- fixtures ----------

function Fixtures({ s, t, lang, follow }: { s: State; t: Copy; lang: Lang; follow: TeamId | null }) {
  const [mine, setMine] = useState(false);
  const all = slots(s);
  const shown = mine && follow ? all.map((x) => ({ ...x, matches: x.matches.filter((m) => m.home === follow || m.away === follow) })).filter((x) => x.matches.length) : all;
  return (
    <section className="cu-fixtures" aria-labelledby="cu-fx-h">
      <div className="cu-block-top">
        <h2 id="cu-fx-h" className="cu-block-h">
          {t.fixturesH}
        </h2>
        <div className="cu-seg" role="group" aria-label={t.fixturesH}>
          <button type="button" className={!mine ? 'is-on' : ''} aria-pressed={!mine} onClick={() => setMine(false)}>
            {t.fixturesAll}
          </button>
          <button type="button" className={mine ? 'is-on' : ''} aria-pressed={mine} onClick={() => setMine(true)} disabled={!follow}>
            {t.fixturesMine}
          </button>
        </div>
      </div>
      {!follow && <p className="cu-dim">{t.fixturesPickTeam}</p>}
      <ol className="cu-slots">
        {shown.map((x) => (
          <li key={x.kickoff} className="cu-slot">
            <p className="cu-slot-time">{clk(x.kickoff, lang)}</p>
            <ul className="cu-slot-list">
              {x.matches.map((m) => (
                <MiniFixture key={m.id} m={m} t={t} lang={lang} follow={follow} />
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </section>
  );
}

// ---------- scorers and fair play ----------

function Stats({ s, t, lang, follow }: { s: State; t: Copy; lang: Lang; follow: TeamId | null }) {
  const scorers = topScorers(s, 10);
  const fair = fairPlay(s);
  const ref = useRef<HTMLOListElement>(null);
  useFlip(ref);
  return (
    <div className="cu-stats">
      <section className="cu-card" aria-labelledby="cu-sc-h">
        <h2 id="cu-sc-h" className="cu-block-h">
          {t.scorersH}
        </h2>
        {scorers.length === 0 ? (
          <p className="cu-dim">{t.noGoals}</p>
        ) : (
          <ol className="cu-scorers" ref={ref}>
            {scorers.map((x, i) => (
              <li key={`${x.team}${x.no}`} data-flip={`${x.team}${x.no}`} className={x.team === follow ? 'is-followed' : ''}>
                <span className="cu-sc-rank">{num(i + 1, lang)}</span>
                <TeamCrest team={x.team} className="cu-row-crest" />
                <span className="cu-sc-name">
                  {playerName(x.team, x.no, lang)}
                  <span className="cu-sc-team">{TEAMS[x.team].name}</span>
                </span>
                <span className="cu-sc-goals" aria-label={`${t.goalsCol}: ${x.goals}`}>
                  {num(x.goals, lang)} <span aria-hidden="true">⚽</span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
      <section className="cu-card" aria-labelledby="cu-fp-h">
        <h2 id="cu-fp-h" className="cu-block-h">
          {t.fairH}
        </h2>
        <p className="cu-dim cu-small">{t.fairNote}</p>
        <div className="cu-table-scroll" tabIndex={0} role="region" aria-label={t.fairH}>
          <table className="cu-fair">
            <thead>
              <tr>
                <th scope="col">{t.cols.pos}</th>
                <th scope="col" className="cu-c-team">
                  {t.cols.team}
                </th>
                <th scope="col" className="cu-c-n">
                  <span aria-hidden="true">🟨 </span>
                  {t.yellowCol}
                </th>
                <th scope="col" className="cu-c-n">
                  <span aria-hidden="true">🟥 </span>
                  {t.redCol}
                </th>
                <th scope="col" className="cu-c-n">
                  {t.fpCol}
                </th>
              </tr>
            </thead>
            <tbody>
              {fair.map((r, i) => (
                <tr key={r.team} className={r.team === follow ? 'is-followed' : ''} data-fair={r.team}>
                  <td className="cu-c-pos">{num(i + 1, lang)}</td>
                  <th scope="row" className="cu-c-team">
                    <span className="cu-row-team">
                      <TeamCrest team={r.team} className="cu-row-crest" />
                      <span className="cu-row-name">{TEAMS[r.team].name}</span>
                    </span>
                  </th>
                  <td className="cu-c-n">{num(r.yellow, lang)}</td>
                  <td className="cu-c-n">{num(r.red, lang)}</td>
                  <td className="cu-c-n cu-c-pts">{num(r.points, lang)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

// ---------- team registration ----------

function Join({ s, t, lang, onState, toast }: { s: State; t: Copy; lang: Lang; onState: (s: State) => void; toast: (x: string) => void }) {
  const [name, setName] = useState('');
  const [captain, setCaptain] = useState('');
  const [colors, setColors] = useState<[string, string]>(['#1d4ed8', '#facc15']);
  const [motif, setMotif] = useState<Motif>('peak');
  const [errors, setErrors] = useState<RegError[]>([]);
  const [done, setDone] = useState<string | null>(null);
  const initials = crestInitials(name.trim() || 'Himal FC');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const r = register(s, { name, captain, colors, motif });
    setErrors(r.errors);
    if (r.errors.length) return;
    onState(r.state);
    setDone(name.trim());
    setName('');
    setCaptain('');
    toast(t.regOk);
  };
  const err = (k: RegError) => (errors.includes(k) ? <p className="cu-err">{t.regErr[k]}</p> : null);
  return (
    <div className="cu-join">
      <section className="cu-card" aria-labelledby="cu-join-h">
        <h2 id="cu-join-h" className="cu-block-h">
          {t.joinH}
        </h2>
        <p className="cu-dim">{t.joinSub}</p>
        <form className="cu-form" onSubmit={submit} noValidate data-join="1">
          <div className="cu-form-grid">
            <div className="cu-form-fields">
              <label className="cu-field">
                <span>{t.nameLabel}</span>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t.namePh} maxLength={NAME_MAX + 8} autoComplete="off" name="team" aria-invalid={errors.some((x) => x.startsWith('name'))} />
              </label>
              {err('nameShort')}
              {err('nameLong')}
              {err('nameTaken')}
              <label className="cu-field">
                <span>{t.captainLabel}</span>
                <input value={captain} onChange={(e) => setCaptain(e.target.value)} placeholder={t.captainPh} maxLength={CAPTAIN_MAX + 8} autoComplete="off" name="captain" aria-invalid={errors.some((x) => x.startsWith('captain'))} />
              </label>
              {err('captainShort')}
              {err('captainLong')}
              <fieldset className="cu-field">
                <legend>{t.colorsLabel}</legend>
                {([0, 1] as const).map((i) => (
                  <div key={i} className="cu-swatches" role="radiogroup" aria-label={i === 0 ? t.color1 : t.color2}>
                    <span className="cu-sw-l">{i === 0 ? t.color1 : t.color2}</span>
                    {REG_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        role="radio"
                        aria-checked={colors[i] === c}
                        aria-label={c}
                        className={`cu-sw${colors[i] === c ? ' is-on' : ''}`}
                        style={{ background: c, color: inkOn(c) }}
                        onClick={() => setColors((x) => (i === 0 ? [c, x[1]] : [x[0], c]))}
                        data-color={`${i}${c}`}
                      >
                        {colors[i] === c ? '✓' : ''}
                      </button>
                    ))}
                  </div>
                ))}
              </fieldset>
              {err('colorsSame')}
              <fieldset className="cu-field">
                <legend>{t.motifLabel}</legend>
                <div className="cu-seg" role="radiogroup" aria-label={t.motifLabel}>
                  {MOTIFS.map((x) => (
                    <button key={x} type="button" role="radio" aria-checked={motif === x} className={motif === x ? 'is-on' : ''} onClick={() => setMotif(x)}>
                      {t.motifs[x]}
                    </button>
                  ))}
                </div>
              </fieldset>
            </div>
            <div className="cu-preview" aria-label={t.preview}>
              <p className="cu-dim cu-small">{t.preview}</p>
              <Crest colors={colors} motif={motif} pattern="split" initials={initials} className="cu-preview-crest" title={`${t.preview}: ${name || 'Himal FC'}`} />
              <p className="cu-preview-name">{name.trim() || '…'}</p>
            </div>
          </div>
          {err('full')}
          <button type="submit" className="cu-btn cu-btn-main">
            {t.submit}
          </button>
          {done && (
            <p className="cu-ok" role="status" data-reg-ok="1">
              ✓ {t.regOk} — {done}
            </p>
          )}
        </form>
      </section>
      <section className="cu-card" aria-labelledby="cu-reg-h">
        <h2 id="cu-reg-h" className="cu-block-h">
          {t.registeredH}
        </h2>
        {s.registered.length === 0 ? (
          <p className="cu-dim">{t.regNone}</p>
        ) : (
          <ul className="cu-reglist">
            {s.registered.map((r) => (
              <li key={r.id} data-registered={r.id}>
                <Crest colors={r.colors} motif={r.motif} pattern="split" initials={crestInitials(r.name)} className="cu-row-crest is-lg" />
                <span>
                  <strong>{r.name}</strong>
                  <span className="cu-dim cu-small">
                    {t.registeredBy(r.captain)} · {clk(r.at, lang)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// ---------- the referee desk ----------

type Picker = { kind: 'goal' | 'yellow' | 'red'; side: Side } | null;

function RefDesk({
  s,
  t,
  lang,
  sel,
  setSel,
  act,
  follow,
}: {
  s: State;
  t: Copy;
  lang: Lang;
  sel: string;
  setSel: (id: string) => void;
  act: (id: string, a: RefAction) => void;
  follow: TeamId | null;
}) {
  const m = s.matches.find((x) => x.id === sel) ?? s.matches[0];
  const can = refCan(s, m);
  const [picker, setPicker] = useState<Picker>(null);
  useEffect(() => setPicker(null), [sel]);
  const live = s.matches.filter(isOn);
  const next = s.matches.filter((x) => x.status === 'scheduled');
  const done = s.matches.filter((x) => x.status === 'ft');
  const label = (x: Match) => {
    const h = x.home ? TEAMS[x.home].short : '?';
    const a = x.away ? TEAMS[x.away].short : '?';
    const st = x.status === 'scheduled' ? clk(x.kickoff, lang) : x.status === 'ft' ? `${t.ft} ${scoreText(x, lang)}` : `${t.live} ${scoreText(x, lang)}`;
    return `${stageLabel(x, t)} · ${h}–${a} · ${st}`;
  };
  const press = (a: RefAction) => {
    act(m.id, a);
    setPicker(null);
  };
  const side = (sd: Side) => {
    const team = m[sd];
    const off = sentOff(m, sd);
    return (
      <div className={`cu-ref-team is-${sd}`}>
        <div className="cu-ref-team-top">
          {team ? <TeamCrest team={team} className="cu-ref-crest" /> : <Placeholder className="cu-ref-crest" />}
          <span className="cu-ref-team-name">{team ? TEAMS[team].name : placeLabel(m, sd, t, lang)}</span>
        </div>
        <div className="cu-ref-goalbtns">
          <button type="button" className="cu-btn cu-btn-goal" disabled={!can.goal} onClick={() => setPicker({ kind: 'goal', side: sd })} data-ref-goal={sd}>
            <Icon name="plus" />
            {t.refGoal}
          </button>
          <button type="button" className="cu-btn cu-btn-minus" disabled={!can.goal || !m.events.some((e) => e.kind === 'goal' && e.side === sd)} onClick={() => press({ kind: 'minus', side: sd })} aria-label={`${t.refMinus} · ${team ? TEAMS[team].short : ''}`} title={t.refMinus} data-ref-minus={sd}>
            <Icon name="minus" />
          </button>
        </div>
        <div className="cu-ref-cards">
          <button type="button" className="cu-btn cu-btn-card is-yellow" disabled={!can.card} onClick={() => setPicker({ kind: 'yellow', side: sd })} data-ref-card={`yellow-${sd}`}>
            <span className="cu-card-ic is-yellow" aria-hidden="true" />
            {t.refYellow}
          </button>
          <button type="button" className="cu-btn cu-btn-card is-red" disabled={!can.card} onClick={() => setPicker({ kind: 'red', side: sd })} data-ref-card={`red-${sd}`}>
            <span className="cu-card-ic is-red" aria-hidden="true" />
            {t.refRed}
          </button>
        </div>
        {picker && picker.side === sd && team && (
          <div className="cu-picker" role="group" aria-label={picker.kind === 'goal' ? t.refScorer(TEAMS[team].name) : t.refCardFor(picker.kind === 'yellow' ? t.ev.yellow : t.ev.red, TEAMS[team].name)}>
            <p className="cu-picker-h">{picker.kind === 'goal' ? t.refScorer(TEAMS[team].short) : t.refCardFor(picker.kind === 'yellow' ? t.ev.yellow : t.ev.red, TEAMS[team].short)}</p>
            <div className="cu-picker-grid">
              {SQUADS[team]
                .filter((p) => !off.includes(p.no))
                .map((p) => (
                  <button
                    key={p.no}
                    type="button"
                    className="cu-pick"
                    onClick={() => press(picker.kind === 'goal' ? { kind: 'goal', side: sd, no: p.no } : { kind: 'card', side: sd, no: p.no, color: picker.kind as 'yellow' | 'red' })}
                    data-pick={p.no}
                  >
                    <span className="cu-pick-no">{num(p.no, lang)}</span>
                    <span className="cu-pick-name">{p.name}</span>
                  </button>
                ))}
            </div>
            <button type="button" className="cu-btn cu-btn-ghost cu-btn-sm" onClick={() => setPicker(null)}>
              {t.refCancel}
            </button>
          </div>
        )}
      </div>
    );
  };
  const [h, a] = score(m);
  return (
    <div className="cu-ref">
      <section className="cu-card cu-ref-main" aria-labelledby="cu-ref-h">
        <div className="cu-block-top">
          <h2 id="cu-ref-h" className="cu-block-h">
            <Icon name="whistle" />
            {t.refH}
          </h2>
        </div>
        <p className="cu-dim cu-small">{t.refSub}</p>
        <label className="cu-field cu-ref-pick">
          <span>{t.refPick}</span>
          <select value={m.id} onChange={(e) => setSel(e.target.value)} data-ref-select="1">
            {live.length > 0 && (
              <optgroup label={t.refLiveNow}>
                {live.map((x) => (
                  <option key={x.id} value={x.id}>
                    {label(x)}
                  </option>
                ))}
              </optgroup>
            )}
            {next.length > 0 && (
              <optgroup label={t.nextUp}>
                {next.map((x) => (
                  <option key={x.id} value={x.id}>
                    {label(x)}
                  </option>
                ))}
              </optgroup>
            )}
            {done.length > 0 && (
              <optgroup label={t.ft}>
                {done.map((x) => (
                  <option key={x.id} value={x.id}>
                    {label(x)}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </label>

        <div className={`cu-ref-board is-${m.status}`} data-ref-match={m.id}>
          <div className="cu-ref-board-top">
            <span>
              {stageLabel(m, t)} · {t.pitch(num(m.pitch, lang))}
            </span>
            <StatusChip m={m} t={t} lang={lang} />
          </div>
          <div className="cu-ref-score" aria-live="polite">
            <span key={`h${h}`} className="cu-score-n">
              {num(h, lang)}
            </span>
            <span className="cu-score-sep">:</span>
            <span key={`a${a}`} className="cu-score-n">
              {num(a, lang)}
            </span>
          </div>
          {m.pens && (
            <div className="cu-match-pens">
              <span className="cu-pens-h">{t.pens}</span>
              <PenDots pens={m.pens} side="home" />
              <PenDots pens={m.pens} side="away" />
            </div>
          )}
          <div className="cu-ref-teams">
            {side('home')}
            {side('away')}
          </div>
          <div className="cu-ref-whistle">
            {m.status === 'scheduled' && (
              <button type="button" className="cu-btn cu-btn-main" disabled={!can.start} onClick={() => press({ kind: 'start' })} data-ref-act="start">
                {t.refStart}
              </button>
            )}
            {can.ht && (
              <button type="button" className="cu-btn cu-btn-main" onClick={() => press({ kind: 'ht' })} data-ref-act="ht">
                {t.refHt}
              </button>
            )}
            {can.second && (
              <button type="button" className="cu-btn cu-btn-main" onClick={() => press({ kind: 'second' })} data-ref-act="second">
                {t.refSecond}
              </button>
            )}
            {can.ft && (
              <button type="button" className="cu-btn cu-btn-main" onClick={() => press({ kind: 'ft' })} data-ref-act="ft">
                {t.refFt}
              </button>
            )}
            <button type="button" className="cu-btn" disabled={!can.undo} onClick={() => press({ kind: 'undo' })} data-ref-act="undo">
              <Icon name="undo" />
              {t.refUndo}
            </button>
            {can.auto && (
              <button type="button" className="cu-btn cu-btn-ghost" onClick={() => press({ kind: 'auto' })} data-ref-act="auto">
                <Icon name="robot" />
                {t.refAuto}
              </button>
            )}
          </div>
          <p className="cu-ref-note" data-ref-manual={m.manual ? '1' : '0'}>
            {m.status === 'ft'
              ? t.refClosed
              : m.status === 'scheduled' && !(m.home && m.away)
                ? t.refWaiting
                : m.status === 'scheduled' && !can.start && !champion(s)
                  ? t.refBusy
                  : m.manual
                    ? t.refManual
                    : t.refAutoNote}
          </p>
        </div>

        <h3 className="cu-sub-h">{t.refLog}</h3>
        {m.events.length === 0 ? (
          <p className="cu-dim cu-small">{t.refNothing}</p>
        ) : (
          <ul className="cu-feed cu-ref-log">
            {[...m.events].reverse().map((e) => (
              <EventLine key={e.id} e={e} m={m} t={t} lang={lang} />
            ))}
          </ul>
        )}
      </section>
      <aside className="cu-ref-side">
        <p className="cu-ref-flow">{t.refFlow}</p>
        {m.stage === 'group' ? <GroupTable s={s} g={m.group!} t={t} lang={lang} follow={follow} /> : <Bracket s={s} t={t} lang={lang} follow={follow} />}
      </aside>
    </div>
  );
}

// ---------- the hall TV ----------

function BigScreen({ s, t, lang, onClose, fontClass }: { s: State; t: Copy; lang: Lang; onClose: () => void; fontClass: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
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
    document.documentElement.classList.add('cu-big-on');
    return () => {
      document.removeEventListener('fullscreenchange', onFs);
      document.removeEventListener('keydown', onKey);
      document.documentElement.classList.remove('cu-big-on');
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
      prev?.focus?.({ preventScroll: true });
    };
  }, []);
  const live = liveMatches(s);
  const next = upcoming(s, 3);
  const champ = champion(s);
  const groupsDone = groupDone(s, 'A') && groupDone(s, 'B');
  return createPortal(
    <div className={`cu-big ${fontClass}`} role="dialog" aria-modal="true" aria-labelledby="cu-big-h" tabIndex={-1} ref={ref} lang={lang} translate="no" data-big="1">
      <div className="cu-big-top">
        <span className="cu-big-brand" id="cu-big-h">
          <Trophy className="cu-big-trophy" />
          {t.name}
        </span>
        <span className="cu-big-clock">{t.hallClock(clk(s.now, lang))}</span>
        <button type="button" className="cu-big-exit" onClick={onClose} data-big-exit="1">
          {t.bigExit}
        </button>
      </div>
      <div className="cu-big-main">
        <section className="cu-big-now" aria-label={t.nowPlaying}>
          {champ ? (
            <div className="cu-big-champ">
              <Trophy className="cu-big-champ-trophy" />
              <TeamCrest team={champ} className="cu-big-champ-crest" />
              <p>{t.championH(TEAMS[champ].name)}</p>
            </div>
          ) : live.length ? (
            live.map((m) => <MatchCard key={m.id} m={m} t={t} lang={lang} follow={s.follow} big feed={3} />)
          ) : (
            <p className="cu-big-wait">{next[0] ? t.nothingLive(clk(next[0].kickoff, lang)) : t.dayOver}</p>
          )}
        </section>
        <section className="cu-big-side" aria-label={groupsDone ? t.bracketH : t.tablesH}>
          {groupsDone ? (
            <Bracket s={s} t={t} lang={lang} follow={s.follow} />
          ) : (
            <>
              <GroupTable s={s} g="A" t={t} lang={lang} follow={s.follow} compact />
              <GroupTable s={s} g="B" t={t} lang={lang} follow={s.follow} compact />
            </>
          )}
        </section>
      </div>
      {next.length > 0 && (
        <div className="cu-big-next">
          <span className="cu-big-next-h">{t.nextUp}</span>
          <ul>
            {next.map((m) => (
              <li key={m.id}>
                <strong>{clk(m.kickoff, lang)}</strong> {t.pitch(num(m.pitch, lang))} · {m.home ? TEAMS[m.home].short : placeLabel(m, 'home', t, lang)} {t.vs} {m.away ? TEAMS[m.away].short : placeLabel(m, 'away', t, lang)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>,
    document.body
  );
}

// ---------- the live overview ----------

function Live({ s, t, lang, onFollow }: { s: State; t: Copy; lang: Lang; onFollow: (team: TeamId) => void }) {
  const live = liveMatches(s);
  const next = upcoming(s, 4);
  // Between slots and after the final: the matches that just ended, latest first (the final on top).
  const recent = live.length
    ? []
    : s.matches
        .filter((m) => m.status === 'ft')
        .sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0) || b.kickoff - a.kickoff)
        .slice(0, 2);
  return (
    <div className="cu-live">
      <section className="cu-live-now" aria-labelledby="cu-now-h">
        <h2 id="cu-now-h" className="cu-block-h">
          <span className="cu-dot" aria-hidden="true" />
          {t.nowPlaying}
        </h2>
        {live.length ? (
          <div className="cu-cards">
            {live.map((m) => (
              <MatchCard key={m.id} m={m} t={t} lang={lang} follow={s.follow} onFollow={onFollow} />
            ))}
          </div>
        ) : (
          <>
            <p className="cu-empty">{next[0] ? t.nothingLive(clk(next[0].kickoff, lang)) : t.dayOver}</p>
            {recent.length > 0 && (
              <>
                <h3 className="cu-sub-h">{t.justEnded}</h3>
                <div className="cu-cards">
                  {recent.map((m) => (
                    <MatchCard key={m.id} m={m} t={t} lang={lang} follow={s.follow} onFollow={onFollow} />
                  ))}
                </div>
              </>
            )}
          </>
        )}
        {next.length > 0 && (
          <>
            <h3 className="cu-sub-h">{t.nextUp}</h3>
            <ul className="cu-minis">
              {next.map((m) => (
                <MiniFixture key={m.id} m={m} t={t} lang={lang} follow={s.follow} />
              ))}
            </ul>
          </>
        )}
      </section>
      <section className="cu-live-tables" aria-label={t.tablesH}>
        <GroupTable s={s} g="A" t={t} lang={lang} follow={s.follow} />
        <GroupTable s={s} g="B" t={t} lang={lang} follow={s.follow} />
      </section>
      <div className="cu-live-ko">
        <Bracket s={s} t={t} lang={lang} follow={s.follow} />
      </div>
    </div>
  );
}

// ---------- the app ----------

type Toast = { id: number; text: string; tone: 'goal' | 'info' | 'ok' };

export default function CupApp({ initialLang, fontClass = '' }: { initialLang: Lang; fontClass?: string }) {
  const [s, setS] = useState<State | null>(null);
  const sRef = useRef<State | null>(null);
  const [mode, setMode] = useState<Mode>('fans');
  const [tab, setTab] = useState<Tab>('live');
  const [big, setBig] = useState(false);
  const [refSel, setRefSel] = useState<string>('A1');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);
  const reduce = useReducedMotion();

  const lang: Lang = s?.lang ?? initialLang;
  const t = COPY[lang];

  const toast = useCallback((text: string, tone: Toast['tone'] = 'info') => {
    const id = ++toastId.current;
    setToasts((x) => [...x.slice(-2), { id, text, tone }]);
    setTimeout(() => setToasts((x) => x.filter((y) => y.id !== id)), 4600);
  }, []);

  const commit = useCallback((next: State) => {
    sRef.current = next;
    setS(next);
    saveRaw(next);
  }, []);

  const onNotes = useCallback(
    (notes: Note[], st: State) => {
      const tt = COPY[st.lang];
      const L = st.lang;
      for (const n of notes) {
        if (n.kind === 'goal' && st.follow && n.team === st.follow) {
          const m = st.matches.find((x) => x.id === n.match);
          const sc = `${num(n.score[0], L)}–${num(n.score[1], L)}`;
          toast(tt.goalToast(TEAMS[n.team].name, m ? `${TEAMS[m.home!].short} ${sc} ${TEAMS[m.away!].short}` : sc, playerName(n.team, n.no, L), num(n.min, L)), 'goal');
        }
        if (n.kind === 'ft' && st.follow) {
          const m = st.matches.find((x) => x.id === n.match);
          if (m && (m.home === st.follow || m.away === st.follow))
            toast(tt.ftToast(`${TEAMS[m.home!].name} ${scoreText(m, L)} ${TEAMS[m.away!].name}`, stageLabel(m, tt)), 'info');
        }
        if (n.kind === 'champion') toast(tt.champToast(TEAMS[n.team].name), 'ok');
      }
    },
    [toast]
  );

  // Start: the stored tournament (or a fresh one); ?seed=, ?mode=, ?tab= for links.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const seedParam = Number(params.get('seed'));
    const seed = Number.isInteger(seedParam) && seedParam > 0 ? seedParam : FIRST_SEED;
    const stored = params.get('seed') ? null : loadRaw();
    const st = normalize(stored, initialLang, seed);
    commit(st);
    const pm = params.get('mode');
    if (pm === 'ref' || pm === 'fans') setMode(pm);
    const pt = params.get('tab');
    if (pt && (TABS as string[]).includes(pt)) setTab(pt as Tab);
    const live = st.matches.find(isOn) ?? st.matches.find((m) => m.status === 'scheduled');
    if (live) setRefSel(live.id);
  }, [initialLang, commit]);

  // The hall clock runs while the tab is visible; hidden, the tournament waits.
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
      commit(r.state);
      if (r.notes.length) onNotes(r.notes, r.state);
    }, 250);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s === null]);

  const act = useCallback(
    (id: string, a: RefAction) => {
      const cur = sRef.current;
      if (!cur) return;
      const r = refAct(cur, id, a);
      if (!r.ok) return;
      commit(r.state);
      onNotes(r.notes, r.state);
    },
    [commit, onNotes]
  );

  const onFollow = useCallback(
    (team: TeamId | null) => {
      const cur = sRef.current;
      if (!cur) return;
      const next = setFollow(cur, cur.follow === team ? null : team);
      commit(next);
      const tt = COPY[cur.lang];
      toast(next.follow ? tt.followOn(TEAMS[next.follow].name) : tt.followOff, 'info');
    },
    [commit, toast]
  );

  const reset = () => {
    clearRaw();
    const seed = (Math.floor(Math.random() * 0x7fffffff) || FIRST_SEED) >>> 0;
    const next = fresh(seed, lang);
    commit(next);
    setTab('live');
    setRefSel('A1');
    toast(COPY[lang].resetDone, 'info');
  };

  const champ = s ? champion(s) : null;
  const shownTab = tab;
  const tabBody = useMemo(() => {
    if (!s) return null;
    switch (shownTab) {
      case 'live':
        return <Live s={s} t={t} lang={lang} onFollow={onFollow} />;
      case 'fixtures':
        return <Fixtures s={s} t={t} lang={lang} follow={s.follow} />;
      case 'tables':
        return (
          <div className="cu-tables">
            <GroupTable s={s} g="A" t={t} lang={lang} follow={s.follow} />
            <GroupTable s={s} g="B" t={t} lang={lang} follow={s.follow} />
            <p className="cu-dim cu-small cu-tie-rules">{t.tieRules}</p>
          </div>
        );
      case 'bracket':
        return <Bracket s={s} t={t} lang={lang} follow={s.follow} />;
      case 'stats':
        return <Stats s={s} t={t} lang={lang} follow={s.follow} />;
      case 'join':
        return <Join s={s} t={t} lang={lang} onState={commit} toast={(x) => toast(x, 'ok')} />;
    }
  }, [s, shownTab, t, lang, onFollow, commit, toast]);

  return (
    <div className={`cu${reduce ? ' is-calm' : ''}`} lang={lang} translate="no">
      <div className="cu-top">
        <div className="cu-top-in">
          <div className="cu-brand">
            <Trophy className="cu-brand-mark" />
            <div>
              <p className="cu-brand-name">{t.name}</p>
              <p className="cu-brand-tag">{t.tagline}</p>
            </div>
          </div>
          <div className="cu-tools">
            <span className={`cu-clock${s?.paused || champ ? ' is-paused' : ''}`} data-now={s?.now ?? ''}>
              <span className="cu-dot" aria-hidden="true" />
              {s ? t.hallClock(clk(s.now, lang)) : t.hallClock(num('09:59', lang))}
              {s?.paused && <span className="cu-paused"> · {t.paused}</span>}
            </span>
            <div className="cu-speed" role="group" aria-label={t.speedLabel}>
              <button
                type="button"
                className="cu-speed-pp"
                onClick={() => s && commit(setPaused(s, !s.paused))}
                disabled={!s}
                aria-label={s?.paused ? t.play : t.pause}
                title={s?.paused ? t.play : t.pause}
                data-pause="1"
              >
                <Icon name={s?.paused ? 'play' : 'pause'} />
              </button>
              {SPEEDS.map((x) => (
                <button key={x} type="button" className={s?.speed === x ? 'is-on' : ''} aria-pressed={s?.speed === x} onClick={() => s && commit(setSpeed(s, x))} disabled={!s} data-speed={x}>
                  {num(x, lang)}×
                </button>
              ))}
            </div>
            <div className="cu-langs" role="group" aria-label={t.langLabel}>
              {LANGS.map((l) => (
                <button key={l.id} type="button" className={lang === l.id ? 'is-on' : ''} aria-pressed={lang === l.id} lang={l.id} data-lang={l.id} onClick={() => s && commit({ ...s, lang: l.id })}>
                  {l.label}
                </button>
              ))}
            </div>
            <button type="button" className="cu-reset" onClick={reset} disabled={!s} data-reset="1">
              <Icon name="reset" />
              {t.reset}
            </button>
          </div>
        </div>
        <p className="cu-made-up">{t.madeUp}</p>
        <div className="cu-bar">
          <div className="cu-modes" role="tablist" aria-label={t.modesLabel}>
            {(['fans', 'ref'] as Mode[]).map((x) => (
              <button key={x} type="button" role="tab" aria-selected={mode === x} className={mode === x ? 'is-on' : ''} onClick={() => setMode(x)} data-mode={x}>
                <Icon name={x === 'fans' ? 'fans' : 'whistle'} />
                {t.modes[x]}
              </button>
            ))}
          </div>
          <label className="cu-follow-pick">
            <Icon name={s?.follow ? 'starOn' : 'star'} />
            <span className="cu-sr">{t.followLabel}</span>
            <select value={s?.follow ?? ''} onChange={(e) => onFollow((e.target.value || null) as TeamId | null)} disabled={!s} data-follow-select="1" title={t.followHint}>
              <option value="">{t.followLabel}…</option>
              {TEAM_IDS.map((id) => (
                <option key={id} value={id}>
                  {TEAMS[id].name}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="cu-btn cu-btn-tv" onClick={() => setBig(true)} disabled={!s} data-bigscreen="1">
            <Icon name="tv" />
            {t.bigScreen}
          </button>
        </div>
      </div>

      {!s ? (
        <div className="cu-loading" aria-busy="true">
          <div className="cu-skel" />
          <div className="cu-skel" />
        </div>
      ) : (
        <>
          {champ && mode === 'fans' && (
            <section className="cu-champ" aria-live="polite" data-champ-banner={champ}>
              <Trophy className="cu-champ-trophy" />
              <TeamCrest team={champ} className="cu-champ-crest" />
              <div>
                <p className="cu-champ-l">{t.championLabel}</p>
                <h2>{t.championH(TEAMS[champ].name)}</h2>
                <p className="cu-dim">{t.championSub}</p>
              </div>
              <button type="button" className="cu-btn cu-btn-main" onClick={reset}>
                {t.playAgain}
              </button>
              {!reduce && (
                <div className="cu-confetti" aria-hidden="true">
                  {Array.from({ length: 18 }, (_, i) => (
                    <i key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 6) * 0.25}s`, background: TEAMS[champ].colors[i % 2] }} />
                  ))}
                </div>
              )}
            </section>
          )}
          {mode === 'fans' ? (
            <>
              <nav className="cu-tabs" aria-label={t.tabsLabel}>
                <div className="cu-tabs-in" role="tablist">
                  {TABS.map((x) => (
                    <button key={x} type="button" role="tab" aria-selected={tab === x} className={tab === x ? 'is-on' : ''} onClick={() => setTab(x)} data-tab={x}>
                      {t.tabs[x]}
                    </button>
                  ))}
                </div>
              </nav>
              <div className="cu-body" role="tabpanel" aria-label={t.tabs[tab]}>
                {tabBody}
              </div>
            </>
          ) : (
            <RefDesk s={s} t={t} lang={lang} sel={refSel} setSel={setRefSel} act={act} follow={s.follow} />
          )}
        </>
      )}

      <div className="cu-toasts" aria-live="polite" role="status">
        {toasts.map((x) => (
          <p key={x.id} className={`cu-toast is-${x.tone}`} data-toast={x.tone}>
            {x.text}
          </p>
        ))}
      </div>

      {big && s && <BigScreen s={s} t={t} lang={lang} onClose={() => setBig(false)} fontClass={fontClass} />}
    </div>
  );
}
