'use client';

// The drawn map of Nepal for Yatri Treks: a hand-made outline with relief
// bands (plains, hills, the snowy crest, the dry land behind it), little
// drawn mountains along the crest, the big peaks, every place the planner
// knows, and the trip's route drawn on top (animated unless the visitor
// prefers reduced motion). Pan and zoom with the pointer (drag, wheel,
// pinch), the buttons, or the keyboard on the focused map (arrows, + −, 0
// for all of Nepal, F to fit the route). No tiles, no requests: it is SVG
// from trek.ts.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { COPY, PEAK_NAME, REGION_NAME, STOP_NAME, STOP_NOTE, count, num, type Lang } from './content';
import {
  ADDABLE,
  HOME_VIEW,
  MAP_H,
  MAP_W,
  PEAKS,
  STOPS,
  STOP_IDS,
  clampView,
  fitView,
  outlinePath,
  panBy,
  project,
  projectStop,
  reliefBands,
  ridgeGlyphs,
  viewBox,
  zoomAt,
  type DayInfo,
  type StopId,
  type View,
} from './trek';

const OUTLINE = outlinePath();
const BANDS = reliefBands();
const RIDGES = ridgeGlyphs();
const PEAK_XY = PEAKS.map((p) => ({ ...p, ...project(p.lat, p.lon) }));
const STOP_XY = Object.fromEntries(STOP_IDS.map((id) => [id, projectStop(id)])) as Record<StopId, { x: number; y: number }>;
const PHEWA = project(28.2154, 83.9453);
const RARA = project(29.5285, 82.0878);

type Props = {
  lang: Lang;
  infos: DayInfo[];
  /** Changes when the map should fit the route again (a new trip). */
  fitKey: string;
  /** A stop to bring into view (a day's "show on map"), with a counter so the same stop can be asked twice. */
  focus: { stop: StopId; n: number } | null;
  activeDay: number | null;
  reduce: boolean;
  tripLabel: string;
  canAdd: boolean;
  onAdd: (stop: StopId) => void;
};

export default function MapView({ lang, infos, fitKey, focus, activeDay, reduce, tripLabel, canAdd, onAdd }: Props) {
  const t = COPY[lang];
  const routeStops = useMemo(() => {
    const ids: StopId[] = [];
    for (const x of infos) {
      ids.push(x.stop);
      if (x.via) ids.push(x.via);
      if (x.side) ids.push(x.side);
    }
    return ids;
  }, [infos]);
  const [view, setView] = useState<View>(() => fitView(routeStops));
  const [pxPerUnit, setPx] = useState(1);
  const [picked, setPicked] = useState<StopId | null>(null);
  const frame = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const viewRef = useRef(view);
  viewRef.current = view;

  // Fit the route when the trip changes.
  const routeRef = useRef(routeStops);
  routeRef.current = routeStops;
  useEffect(() => {
    setView(fitView(routeRef.current));
  }, [fitKey]);

  // Bring a day's place into view.
  useEffect(() => {
    if (!focus) return;
    const p = STOP_XY[focus.stop];
    setView((v) => clampView({ cx: p.x, cy: p.y, z: Math.max(v.z, 4) }));
  }, [focus]);

  // Map units → screen pixels, so labels and markers keep their size on screen.
  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    const measure = () => {
      const w = el.getBoundingClientRect().width || MAP_W;
      setPx(w / MAP_W);
    };
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, []);
  const k = pxPerUnit * view.z; // screen px per map unit at this zoom
  const u = (px: number) => px / k; // a screen size in map units

  // ----- pointer: drag to pan, pinch to zoom, a short tap is a click -----
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef<{
    x: number;
    y: number;
    moved: boolean;
    pinch: number | null;
  } | null>(null);
  const toMap = useCallback((clientX: number, clientY: number) => {
    const el = svg.current!;
    const r = el.getBoundingClientRect();
    const v = viewRef.current;
    const w = MAP_W / v.z;
    const h = MAP_H / v.z;
    return {
      x: v.cx - w / 2 + ((clientX - r.left) / r.width) * w,
      y: v.cy - h / 2 + ((clientY - r.top) / r.height) * h,
    };
  }, []);
  const onPointerDown = (e: React.PointerEvent) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) drag.current = { x: e.clientX, y: e.clientY, moved: false, pinch: null };
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      drag.current = {
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2,
        moved: true,
        pinch: Math.hypot(a.x - b.x, a.y - b.y),
      };
      svg.current?.setPointerCapture?.(e.pointerId);
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId) || !drag.current) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const d = drag.current;
    const el = svg.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (pointers.current.size >= 2 && d.pinch) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const m = toMap(mid.x, mid.y);
      setView((v) => zoomAt(v, dist / d.pinch!, m.x, m.y));
      drag.current = { ...d, pinch: dist, x: mid.x, y: mid.y };
      return;
    }
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < 5) return;
    if (!d.moved) svg.current?.setPointerCapture?.(e.pointerId);
    d.moved = true;
    const scale = r.width / (MAP_W / viewRef.current.z);
    setView((v) => clampView({ cx: v.cx - dx / scale, cy: v.cy - dy / scale, z: v.z }));
    d.x = e.clientX;
    d.y = e.clientY;
  };
  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) {
      // keep `moved` until the click event has been seen
      setTimeout(() => (drag.current = null), 0);
    }
  };
  const wasDrag = () => drag.current?.moved === true;

  // ----- wheel: zoom at the pointer (a native listener, so it can stop the page scrolling) -----
  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const m = toMap(e.clientX, e.clientY);
      const f = Math.exp(-Math.max(-120, Math.min(120, e.deltaY)) * 0.004);
      setView((v) => zoomAt(v, f, m.x, m.y));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [toMap]);

  // ----- keyboard on the focused map -----
  const onKey = (e: React.KeyboardEvent) => {
    const v = viewRef.current;
    let next: View | null = null;
    if (e.key === 'ArrowLeft') next = panBy(v, -0.15, 0);
    else if (e.key === 'ArrowRight') next = panBy(v, 0.15, 0);
    else if (e.key === 'ArrowUp') next = panBy(v, 0, -0.15);
    else if (e.key === 'ArrowDown') next = panBy(v, 0, 0.15);
    else if (e.key === '+' || e.key === '=') next = zoomAt(v, 1.5, v.cx, v.cy);
    else if (e.key === '-' || e.key === '_') next = zoomAt(v, 1 / 1.5, v.cx, v.cy);
    else if (e.key === '0') next = HOME_VIEW;
    else if (e.key === 'f' || e.key === 'F') next = fitView(routeStops);
    else if (e.key === 'Escape' && picked) {
      setPicked(null);
      e.preventDefault();
      return;
    }
    if (next) {
      e.preventDefault();
      setView(next);
    }
  };

  // ----- the route -----
  const route = useMemo(() => {
    const pts: { x: number; y: number }[] = [];
    const push = (id: StopId) => {
      const p = STOP_XY[id];
      const last = pts[pts.length - 1];
      if (!last || last.x !== p.x || last.y !== p.y) pts.push(p);
    };
    const spurs: { a: StopId; b: StopId; day: number }[] = [];
    infos.forEach((x, i) => {
      if (x.prev) push(x.prev);
      if (x.via) push(x.via);
      push(x.stop);
      if (x.side) {
        // From whichever end of the day is nearer the viewpoint.
        const s = STOP_XY[x.side];
        const from = x.prev && dist2(STOP_XY[x.prev], s) < dist2(STOP_XY[x.stop], s) ? x.prev : x.stop;
        spurs.push({ a: from, b: x.side, day: i });
      }
    });
    const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join('');
    return { d, spurs, sig: d + spurs.map((s) => s.a + s.b).join() };
  }, [infos]);

  const onRoute = useMemo(() => new Set(routeStops), [routeStops]);
  const activeStop = activeDay !== null && infos[activeDay] ? infos[activeDay].stop : null;
  const first = infos[0]?.via ?? infos[0]?.stop;
  const last = infos[infos.length - 1]?.stop;
  const fs = u(12.5);
  // Which places get a label at this zoom, and on which side — the most important first, skipping any that would overlap one already placed.
  const labels = useMemo(() => {
    const want = (id: StopId) => {
      const pri = STOPS[id].pri;
      return id === activeStop || id === picked || pri === 1 || (pri === 2 && view.z >= 2.2) || (pri === 3 && view.z >= 4.5) || (onRoute.has(id) && view.z >= 3.2);
    };
    const rank = (id: StopId) => (id === activeStop || id === picked ? 0 : STOPS[id].pri * 2 - (onRoute.has(id) ? 1 : 0));
    const ids = STOP_IDS.filter(want).sort((a, b) => rank(a) - rank(b));
    const placed: { x0: number; y0: number; x1: number; y1: number }[] = [];
    const out = new Map<StopId, 'right' | 'left'>();
    const kk = pxPerUnit * view.z;
    for (const id of ids) {
      const p = STOP_XY[id];
      const sx = p.x * kk;
      const sy = p.y * kk;
      const w = STOP_NAME[id][lang].length * 7.4 + 4;
      for (const side of ['right', 'left'] as const) {
        const b = side === 'right' ? { x0: sx + 6, y0: sy - 9, x1: sx + 8 + w, y1: sy + 8 } : { x0: sx - 8 - w, y0: sy - 9, x1: sx - 6, y1: sy + 8 };
        if (!placed.some((o) => b.x0 < o.x1 && b.x1 > o.x0 && b.y0 < o.y1 && b.y1 > o.y0)) {
          placed.push(b);
          out.set(id, side);
          break;
        }
      }
    }
    // Peak names only where they don't sit on a place's label.
    const peaks = new Set<string>();
    if (view.z >= 1.6) {
      for (const pk of PEAK_XY) {
        const w = PEAK_NAME[pk.id][lang].length * 6.6 + 4;
        const sx = pk.x * kk;
        const sy = pk.y * kk - 10;
        const b = { x0: sx - w / 2, y0: sy - 11, x1: sx + w / 2, y1: sy + 3 };
        if (!placed.some((o) => b.x0 < o.x1 && b.x1 > o.x0 && b.y0 < o.y1 && b.y1 > o.y0)) {
          placed.push(b);
          peaks.add(pk.id);
        }
      }
    }
    return { places: out, peaks };
  }, [activeStop, picked, view.z, pxPerUnit, onRoute, lang]);
  const pick = (id: StopId) => {
    if (wasDrag()) return;
    setPicked((p) => (p === id ? null : id));
  };

  return (
    <div className="tk-map">
      <div
        className="tk-map-frame"
        ref={frame}
        tabIndex={0}
        role="group"
        aria-roledescription="map"
        aria-label={t.mapLabel(tripLabel)}
        aria-describedby="tk-map-help"
        onKeyDown={onKey}
      >
        <svg
          ref={svg}
          viewBox={viewBox(view)}
          className="tk-map-svg"
          aria-hidden="true"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <defs>
            <clipPath id="tk-clip">
              <path d={OUTLINE} />
            </clipPath>
            <linearGradient id="tk-land" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0" stopColor="#dfe8c4" />
              <stop offset="1" stopColor="#d6cfae" />
            </linearGradient>
            <linearGradient id="tk-snow" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0" stopColor="#c9c4b4" />
              <stop offset="0.45" stopColor="#eceae3" />
              <stop offset="1" stopColor="#ffffff" />
            </linearGradient>
            <pattern id="tk-hills" width="14" height="9" patternUnits="userSpaceOnUse">
              <path d="M1 7 Q4 2 7 7 M8 8 Q10.5 4.5 13 8" fill="none" stroke="#9c8f63" strokeWidth="0.6" opacity="0.55" />
            </pattern>
            <pattern id="tk-dots" width="6" height="6" patternUnits="userSpaceOnUse">
              <circle cx="1.5" cy="1.5" r="0.55" fill="#8aa35c" opacity="0.5" />
            </pattern>
          </defs>
          <rect x={-200} y={-200} width={MAP_W + 400} height={MAP_H + 400} fill="#e9e3d3" />
          <path d={OUTLINE} fill="#000" opacity="0.08" transform="translate(2.5 3)" />
          <g clipPath="url(#tk-clip)">
            <path d={OUTLINE} fill="url(#tk-land)" />
            <path d={BANDS.terai} fill="#cfe0a6" />
            <path d={BANDS.terai} fill="url(#tk-dots)" />
            <path d={BANDS.hills} fill="#cbbf92" opacity="0.55" />
            <path d={BANDS.hills} fill="url(#tk-hills)" />
            <path d={BANDS.trans} fill="#d9c49a" />
            <path d={BANDS.snow} fill="url(#tk-snow)" />
            {RIDGES.map((r, i) => (
              <g key={i}>
                <path d={`M${r.x - r.s} ${r.y + r.s * 0.35}L${r.x} ${r.y - r.s}L${r.x + r.s} ${r.y + r.s * 0.35}Z`} fill="#fbfbf8" />
                <path d={`M${r.x} ${r.y - r.s}L${r.x + r.s} ${r.y + r.s * 0.35}L${r.x + r.s * 0.2} ${r.y + r.s * 0.35}Z`} fill="#a9b4bf" />
              </g>
            ))}
            <ellipse cx={PHEWA.x} cy={PHEWA.y} rx={2.2} ry={1.1} fill="#6aa9c9" />
            <ellipse cx={RARA.x} cy={RARA.y} rx={1.8} ry={1.1} fill="#6aa9c9" />
          </g>
          <path d={OUTLINE} fill="none" stroke="#6b5d3e" strokeWidth={1.4} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />

          {/* the big peaks */}
          {PEAK_XY.map((p) => (
            <g key={p.id} className="tk-peak">
              <path
                d={`M${p.x - u(6)} ${p.y + u(4)}L${p.x} ${p.y - u(7)}L${p.x + u(6)} ${p.y + u(4)}Z`}
                fill="#ffffff"
                stroke="#55606b"
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
              {labels.peaks.has(p.id) && (
                <text x={p.x} y={p.y - u(10)} fontSize={u(11)} textAnchor="middle" className="tk-peak-label">
                  {PEAK_NAME[p.id][lang]}
                </text>
              )}
            </g>
          ))}

          {/* the route */}
          {route.d && (
            <g className="tk-route" key={reduce ? 'still' : route.sig}>
              <path d={route.d} className="tk-route-casing" vectorEffect="non-scaling-stroke" />
              <path d={route.d} className={`tk-route-line${reduce ? '' : ' is-drawing'}`} pathLength={1} vectorEffect="non-scaling-stroke" />
              {route.spurs.map((s) => (
                <line
                  key={`${s.a}-${s.b}-${s.day}`}
                  x1={STOP_XY[s.a].x}
                  y1={STOP_XY[s.a].y}
                  x2={STOP_XY[s.b].x}
                  y2={STOP_XY[s.b].y}
                  className="tk-route-spur"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </g>
          )}

          {/* places */}
          {STOP_IDS.map((id) => {
            const p = STOP_XY[id];
            const on = onRoute.has(id);
            const view_ = STOPS[id].kind === 'view';
            const r = u(on ? 5 : 3.6);
            return (
              <g key={id} className={`tk-place${on ? ' is-on' : ''}${id === activeStop ? ' is-active' : ''}${id === picked ? ' is-picked' : ''}`} onClick={() => pick(id)}>
                <circle cx={p.x} cy={p.y} r={u(13)} fill="transparent" />
                {view_ ? (
                  <path d={`M${p.x} ${p.y - r * 1.25}L${p.x + r * 1.1} ${p.y + r * 0.8}L${p.x - r * 1.1} ${p.y + r * 0.8}Z`} className="tk-dot" vectorEffect="non-scaling-stroke" />
                ) : (
                  <circle cx={p.x} cy={p.y} r={r} className="tk-dot" vectorEffect="non-scaling-stroke" />
                )}
                {id === activeStop && <circle cx={p.x} cy={p.y} r={u(11)} className="tk-ring" vectorEffect="non-scaling-stroke" />}
                {labels.places.has(id) && (
                  <text
                    x={labels.places.get(id) === 'left' ? p.x - u(8) : p.x + u(8)}
                    y={p.y + u(4)}
                    fontSize={fs}
                    textAnchor={labels.places.get(id) === 'left' ? 'end' : 'start'}
                    className={`tk-label${on ? ' is-on' : ''}`}
                  >
                    {STOP_NAME[id][lang]}
                  </text>
                )}
              </g>
            );
          })}
          {first && (
            <g className="tk-flag" transform={`translate(${STOP_XY[first].x} ${STOP_XY[first].y})`}>
              <path d={`M0 0V${-u(18)}L${u(11)} ${-u(14)}L0 ${-u(10)}`} vectorEffect="non-scaling-stroke" />
            </g>
          )}
          {last && last !== first && <circle cx={STOP_XY[last].x} cy={STOP_XY[last].y} r={u(7.5)} className="tk-end" vectorEffect="non-scaling-stroke" />}
        </svg>

        {picked && (
          <div className="tk-place-card" role="dialog" aria-label={STOP_NAME[picked][lang]}>
            <p className="tk-place-name">{STOP_NAME[picked][lang]}</p>
            <p className="tk-place-meta">
              {count(STOPS[picked].alt, lang)} m · {REGION_NAME[STOPS[picked].region][lang]}
            </p>
            <p className="tk-place-note">{STOP_NOTE[picked][lang]}</p>
            <div className="tk-place-actions">
              {canAdd && ADDABLE.includes(picked) && (
                <button
                  type="button"
                  className="tk-btn tk-btn-main tk-btn-sm"
                  onClick={() => {
                    onAdd(picked);
                    setPicked(null);
                  }}
                >
                  {t.placeAdd}
                </button>
              )}
              <button type="button" className="tk-btn tk-btn-sm" onClick={() => setPicked(null)}>
                {t.placeClose}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="tk-map-bar">
        <div className="tk-zoom" role="group" aria-label={t.mapH}>
          <button type="button" className="tk-icon-btn" onClick={() => setView((v) => zoomAt(v, 1.6, v.cx, v.cy))} aria-label={t.zoomIn}>
            <span aria-hidden="true">+</span>
          </button>
          <button type="button" className="tk-icon-btn" onClick={() => setView((v) => zoomAt(v, 1 / 1.6, v.cx, v.cy))} aria-label={t.zoomOut}>
            <span aria-hidden="true">−</span>
          </button>
          <button type="button" className="tk-btn tk-btn-sm" onClick={() => setView(fitView(routeStops))}>
            {t.fitRoute}
          </button>
          <button type="button" className="tk-btn tk-btn-sm" onClick={() => setView(HOME_VIEW)}>
            {t.wholeNepal}
          </button>
        </div>
        <span className="tk-zoom-level" aria-hidden="true">
          {num(Math.round(view.z * 10) / 10, lang)}×
        </span>
      </div>
      <p id="tk-map-help" className="tk-map-help">
        {t.mapHelp}
      </p>
      <ul className="tk-legend" aria-hidden="true">
        <li>
          <span className="tk-key tk-key-route" />
          {t.legendRoute}
        </li>
        <li>
          <span className="tk-key tk-key-spur" />
          {t.legendSide}
        </li>
        <li>
          <span className="tk-key tk-key-peak" />
          {t.legendPeak}
        </li>
      </ul>
    </div>
  );
}

function dist2(a: { x: number; y: number }, b: { x: number; y: number }) {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
}
