// Drawn illustrations for the MartNepali brand ads — flat, soft-shaded
// objects (no photos): momo, jhol momo, achar, chiya, dhaka topi, sel roti,
// a ticket, a kite, chilli, a madal, pote, a shopping bag, a thali, a mic.
// Each is an SVG string on a 200×200 box.
(function (root) {
  const g = (id, stops) => `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">${stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('')}</linearGradient>`;
  const rg = (id, stops, cx = '.4', cy = '.35') => `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r=".75">${stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('')}</radialGradient>`;
  const svg = (defs, body) => `<svg viewBox="0 0 200 200" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg"><defs>${defs}</defs>${body}</svg>`;
  const shadow = '<ellipse cx="100" cy="184" rx="70" ry="9" fill="rgba(0,0,0,.18)"/>';
  const dumpling = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})">
      <path d="M-26 8 Q-28 -14 0 -22 Q28 -14 26 8 Q0 18 -26 8Z" fill="url(#dough)"/>
      <path d="M0 -22 q-3 8 -10 12 M0 -22 q3 8 10 12 M0 -22 v12" stroke="#d9c3a0" stroke-width="2.2" fill="none" stroke-linecap="round"/>
      <path d="M-18 4 Q0 12 18 4" stroke="rgba(160,120,70,.25)" stroke-width="3" fill="none"/></g>`;
  const ART = {
    momo: svg(g('bamboo', [[0, '#e8b96a'], [1, '#b07a2e']]) + rg('dough', [[0, '#fffaf0'], [1, '#ecdcc0']]),
      `${shadow}<ellipse cx="100" cy="150" rx="84" ry="26" fill="#8a5a1c"/><rect x="16" y="108" width="168" height="44" rx="8" fill="url(#bamboo)"/>
       ${[0, 1, 2, 3, 4, 5, 6].map((i) => `<line x1="${28 + i * 24}" y1="110" x2="${28 + i * 24}" y2="150" stroke="rgba(120,80,30,.35)" stroke-width="2"/>`).join('')}
       <ellipse cx="100" cy="108" rx="84" ry="26" fill="#f3d9a4"/><ellipse cx="100" cy="108" rx="74" ry="20" fill="#5e7a3a" opacity=".35"/>
       ${dumpling(68, 104, 1)}${dumpling(132, 104, 1)}${dumpling(100, 92, 1.05)}${dumpling(84, 118, 0.95)}${dumpling(118, 118, 0.95)}
       <path d="M70 60 q-8 -14 2 -26 M100 52 q-8 -14 2 -26 M130 60 q-8 -14 2 -26" stroke="rgba(255,255,255,.9)" stroke-width="5" fill="none" stroke-linecap="round" opacity=".7"/>`),
    jhol: svg(g('bowl', [[0, '#ffffff'], [1, '#dfe3ea']]) + rg('soup', [[0, '#f59e0b'], [1, '#c2410c']]) + rg('dough', [[0, '#fffaf0'], [1, '#ecdcc0']]),
      `${shadow}<path d="M18 96 Q18 176 100 176 Q182 176 182 96Z" fill="url(#bowl)"/><ellipse cx="100" cy="96" rx="82" ry="24" fill="url(#soup)"/>
       ${dumpling(72, 94, 0.8)}${dumpling(104, 88, 0.85)}${dumpling(134, 96, 0.8)}
       <circle cx="88" cy="104" r="3" fill="#16a34a"/><circle cx="120" cy="106" r="3" fill="#16a34a"/><circle cx="150" cy="92" r="2.5" fill="#16a34a"/>
       <path d="M40 116 Q100 150 160 116" stroke="#dc143c" stroke-width="5" fill="none" opacity=".8"/>`),
    achar: svg(g('glass', [[0, 'rgba(255,255,255,.85)'], [1, 'rgba(220,230,240,.6)']]) + g('pickle', [[0, '#f97316'], [1, '#b91c1c']]) + g('cloth', [[0, '#ef4444'], [1, '#991b1b']]),
      `${shadow}<rect x="46" y="56" width="108" height="124" rx="22" fill="url(#pickle)"/>
       ${[[70, 100], [110, 90], [90, 130], [128, 140], [66, 150], [104, 160]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="9" fill="#fbbf24" opacity=".7"/>`).join('')}
       <rect x="46" y="56" width="108" height="124" rx="22" fill="url(#glass)" opacity=".35"/><rect x="58" y="66" width="14" height="96" rx="7" fill="#fff" opacity=".45"/>
       <path d="M34 66 Q36 24 100 22 Q164 24 166 66Z" fill="url(#cloth)"/><path d="M60 40 Q100 30 140 40" stroke="rgba(255,255,255,.35)" stroke-width="5" fill="none" stroke-linecap="round"/>
       <rect x="36" y="58" width="128" height="10" rx="5" fill="#fbbf24"/>`),
    chiya: svg(g('tea', [[0, '#d69e5a'], [1, '#8a5320']]) + g('cup', [[0, 'rgba(255,255,255,.9)'], [1, 'rgba(210,220,230,.7)']]),
      `${shadow}<path d="M52 64 L148 64 L136 178 L64 178Z" fill="url(#tea)"/><path d="M52 64 L148 64 L136 178 L64 178Z" fill="url(#cup)" opacity=".3"/>
       <ellipse cx="100" cy="66" rx="48" ry="8" fill="#e8c08a"/><path d="M60 80 L70 168" stroke="#fff" stroke-width="7" opacity=".5" stroke-linecap="round"/>
       <path d="M80 44 q-10 -16 2 -30 M104 40 q-10 -16 2 -30 M126 46 q-10 -16 2 -30" stroke="#94a3b8" stroke-width="5" fill="none" stroke-linecap="round" opacity=".6"/>`),
    topi: svg('',
      `${shadow}<path d="M28 150 L44 58 Q100 40 156 58 L172 150 Q100 166 28 150Z" fill="#1f2937"/>
       <clipPath id="tc"><path d="M28 150 L44 58 Q100 40 156 58 L172 150 Q100 166 28 150Z"/></clipPath>
       <g clip-path="url(#tc)">${Array.from({ length: 6 }, (_, r) => Array.from({ length: 9 }, (_, c) => { const x = 20 + c * 20 + (r % 2) * 10, y = 50 + r * 18; const col = ['#dc2626', '#f8fafc', '#16a34a', '#f59e0b', '#2563eb'][(r + c) % 5]; return `<path d="M${x} ${y} l8 8 l-8 8 l-8 -8Z" fill="${col}"/>`; }).join('')).join('')}</g>
       <path d="M28 150 Q100 166 172 150 L170 138 Q100 152 30 138Z" fill="#111827"/>`),
    selroti: svg(rg('roti', [[0, '#f5c26b'], [0.7, '#c77d25'], [1, '#8a4e12']], '.5', '.5'),
      `${shadow}<circle cx="100" cy="104" r="74" fill="url(#roti)"/><circle cx="100" cy="104" r="34" fill="#f4f4f1"/>
       <circle cx="100" cy="104" r="54" fill="none" stroke="rgba(255,230,170,.5)" stroke-width="6" stroke-dasharray="8 10"/>`),
    ticket: svg(g('tk', [[0, '#ff3b5c'], [1, '#b8102f']]),
      `${shadow}<g transform="rotate(-10 100 100)"><path d="M22 56 H178 V86 a14 14 0 0 0 0 28 V144 H22 V114 a14 14 0 0 0 0 -28Z" fill="url(#tk)"/>
       <line x1="130" y1="60" x2="130" y2="140" stroke="#fff" stroke-width="3" stroke-dasharray="6 6" opacity=".7"/>
       <text x="76" y="96" font-family="Inter,sans-serif" font-weight="800" font-size="18" fill="#fff" text-anchor="middle">DASHAIN</text>
       <text x="76" y="120" font-family="Inter,sans-serif" font-weight="700" font-size="13" fill="#fff" opacity=".85" text-anchor="middle">10.10.2026</text>
       <text x="154" y="106" font-family="Inter,sans-serif" font-weight="800" font-size="13" fill="#fff" text-anchor="middle" transform="rotate(90 154 104)">ADMIT</text></g>`),
    kite: svg('',
      `<path d="M100 14 L170 84 L100 154 L30 84Z" fill="#dc143c"/><path d="M100 14 L170 84 L100 84Z" fill="#fbbf24"/><path d="M100 84 L30 84 L100 154Z" fill="#1d4ed8"/>
       <path d="M100 14 V154 M30 84 H170" stroke="rgba(0,0,0,.2)" stroke-width="2"/><path d="M100 154 q-16 12 0 22 t0 20" stroke="#fbbf24" stroke-width="4" fill="none"/>`),
    chilli: svg(g('ch', [[0, '#ef4444'], [1, '#991b1b']]),
      `${shadow}<path d="M46 150 Q60 70 150 44 Q170 40 166 58 Q110 80 70 160 Q52 176 46 150Z" fill="url(#ch)"/><path d="M150 44 q10 -18 26 -14" stroke="#16a34a" stroke-width="10" fill="none" stroke-linecap="round"/>
       <path d="M70 130 Q90 90 140 62" stroke="#fff" stroke-width="6" opacity=".35" fill="none" stroke-linecap="round"/>`),
    madal: svg(g('md', [[0, '#b45309'], [1, '#7c2d12']]),
      `${shadow}<path d="M20 70 Q100 50 180 70 L180 140 Q100 160 20 140Z" fill="url(#md)"/><ellipse cx="22" cy="105" rx="14" ry="36" fill="#f5deb3"/><ellipse cx="178" cy="105" rx="14" ry="36" fill="#f5deb3"/>
       ${[40, 60, 80, 100, 120, 140, 160].map((x) => `<path d="M${x} 62 L${x + 10} 148" stroke="#fde68a" stroke-width="2.5" opacity=".7"/>`).join('')}`),
    pote: svg('',
      `${shadow}${Array.from({ length: 28 }, (_, i) => { const a = Math.PI * 0.1 + (i / 27) * Math.PI * 0.8; return `<circle cx="${(100 + Math.cos(a) * 70).toFixed(1)}" cy="${(40 + Math.sin(a) * 110).toFixed(1)}" r="7" fill="${i % 2 ? '#16a34a' : '#22c55e'}"/>`; }).join('')}
       <rect x="84" y="140" width="32" height="30" rx="6" fill="#fbbf24"/><rect x="92" y="170" width="16" height="14" rx="3" fill="#f59e0b"/>`),
    bag: svg(g('bg', [[0, '#ff3b5c'], [1, '#b8102f']]),
      `${shadow}<path d="M70 70 q0 -36 30 -36 q30 0 30 36" stroke="#7f1d1d" stroke-width="10" fill="none"/><path d="M36 64 H164 L154 176 H46Z" fill="url(#bg)"/>
       <path d="M86 92 L110 110 L94 110 L114 128 L86 128Z" fill="#fff" opacity=".9"/><circle cx="96" cy="104" r="3" fill="#b8102f"/>`),
    thali: svg(rg('pl', [[0, '#f8fafc'], [1, '#cbd5e1']], '.5', '.4'),
      `${shadow}<ellipse cx="100" cy="112" rx="88" ry="64" fill="url(#pl)"/><ellipse cx="100" cy="112" rx="76" ry="54" fill="none" stroke="#94a3b8" stroke-width="3"/>
       <ellipse cx="86" cy="118" rx="34" ry="24" fill="#fffdf5"/><circle cx="140" cy="92" r="16" fill="#eab308"/><circle cx="140" cy="130" r="14" fill="#16a34a"/><circle cx="60" cy="86" r="12" fill="#dc2626"/><circle cx="106" cy="80" r="11" fill="#f97316"/>`),
    mic: svg(g('mc', [[0, '#e5e7eb'], [1, '#6b7280']]),
      `${shadow}<rect x="72" y="20" width="56" height="86" rx="28" fill="url(#mc)"/>${[34, 48, 62, 76, 90].map((y) => `<line x1="76" y1="${y}" x2="124" y2="${y}" stroke="rgba(0,0,0,.2)" stroke-width="2"/>`).join('')}
       <path d="M58 88 q0 40 42 40 q42 0 42 -40" stroke="#374151" stroke-width="8" fill="none"/><rect x="94" y="128" width="12" height="40" fill="#374151"/><rect x="66" y="166" width="68" height="10" rx="5" fill="#374151"/>`),
    diyo: svg(g('dy', [[0, '#f59e0b'], [1, '#9a3412']]) + rg('fl', [[0, '#fffbeb'], [0.5, '#fde047'], [1, '#f97316']], '.5', '.6'),
      `${shadow}<ellipse cx="100" cy="112" rx="96" ry="60" fill="rgba(251,191,36,.18)"/><path d="M30 118 Q100 190 170 118 Z" fill="url(#dy)"/><ellipse cx="100" cy="118" rx="70" ry="14" fill="#7c2d12"/>
       <path d="M100 40 Q122 80 100 112 Q78 80 100 40Z" fill="url(#fl)"/><path d="M100 70 Q108 90 100 108 Q92 90 100 70Z" fill="#fff" opacity=".8"/>`),
    coin: svg(rg('cn', [[0, '#fff3c4'], [0.4, '#f6c343'], [1, '#a16207']], '.35', '.3'),
      `${shadow}<circle cx="100" cy="100" r="78" fill="url(#cn)"/><circle cx="100" cy="100" r="62" fill="none" stroke="rgba(255,255,255,.5)" stroke-width="5"/>
       <text x="100" y="128" font-family="Inter,sans-serif" font-weight="800" font-size="84" fill="#7a4a05" text-anchor="middle">€</text>`),
    phone: svg(g('ph', [[0, '#1f2937'], [1, '#030712']]),
      `${shadow}<rect x="56" y="14" width="88" height="170" rx="18" fill="url(#ph)"/><rect x="63" y="28" width="74" height="142" rx="10" fill="#fff"/>
       ${[0, 1, 2, 3, 4, 5, 6].map((r) => [0, 1, 2, 3, 4, 5, 6].map((c) => ((r * 7 + c) * 37) % 5 < 2 || (r < 2 && c < 2) || (r < 2 && c > 4) || (r > 4 && c < 2) ? `<rect x="${70 + c * 8.5}" y="${60 + r * 8.5}" width="8" height="8" fill="#111"/>` : '').join('')).join('')}
       <rect x="72" y="136" width="56" height="18" rx="9" fill="#dc143c"/><rect x="88" y="19" width="24" height="5" rx="2.5" fill="#374151"/>`),
  };
  root.ART = ART;
})(typeof window !== 'undefined' ? window : globalThis);
