/* VERTAX iOS — shared kit: icons, chrome, primitives. Exports to window. */

/* ---------- icons (simple line set, 1.6 stroke) ---------- */
const Ic = {};
const mk = (paths, fill) => ({ size = 22, c = 'currentColor', sw = 1.7 } = {}) =>
  React.createElement('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: fill ? c : 'none',
    stroke: fill ? 'none' : c, strokeWidth: sw, strokeLinecap: 'round', strokeLinejoin: 'round' },
    paths.map((d, i) => React.createElement('path', { key: i, d })));

Ic.crate = mk(['M3 8.5 12 5l9 3.5-9 3.5-9-3.5Z', 'M3 8.5v7l9 3.5 9-3.5v-7', 'M12 12v7']);
Ic.find = mk(['M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z', 'M21 21l-4.3-4.3']);
Ic.build = mk(['M4 7h10', 'M4 12h16', 'M4 17h7', 'M18 5v4', 'M16 7h4', 'M15 15v4', 'M13 17h4']);
Ic.dig = mk(['M12 3v6', 'M5 9l7 4 7-4', 'M5 9v6l7 4 7-4V9', 'M12 13v8']);
Ic.disc = mk(['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', 'M12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z']);
Ic.plus = mk(['M12 5v14', 'M5 12h14']);
Ic.chevron = mk(['M9 6l6 6-6 6']);
Ic.chevDown = mk(['M6 9l6 6 6-6']);
Ic.back = mk(['M15 6l-6 6 6 6']);
Ic.sliders = mk(['M4 8h10', 'M18 8h2', 'M4 16h2', 'M10 16h10', 'M16 6v4', 'M8 14v4']);
Ic.search = mk(['M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z', 'M20 20l-3.8-3.8']);
Ic.gear = mk(['M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z', 'M19.4 13a7.7 7.7 0 0 0 0-2l1.6-1.2-1.6-2.8-1.9.8a7.6 7.6 0 0 0-1.7-1l-.3-2H10.5l-.3 2a7.6 7.6 0 0 0-1.7 1l-1.9-.8L5 9.8 6.6 11a7.7 7.7 0 0 0 0 2L5 14.2 6.6 17l1.9-.8a7.6 7.6 0 0 0 1.7 1l.3 2h3l.3-2a7.6 7.6 0 0 0 1.7-1l1.9.8 1.6-2.8L19.4 13Z']);
Ic.scan = mk(['M4 8V5h3', 'M20 8V5h-3', 'M4 16v3h3', 'M20 16v3h-3', 'M7 12h10']);
Ic.bolt = mk(['M13 3 5 13h6l-1 8 8-10h-6l1-8Z']);
Ic.check = mk(['M5 12.5 10 17l9-10']);
Ic.heart = mk(['M12 20s-7-4.6-9.3-9C1.1 8 2.6 4.8 6 4.8c2 0 3.2 1.2 4 2.4.8-1.2 2-2.4 4-2.4 3.4 0 4.9 3.2 3.3 6.2C19 15.4 12 20 12 20Z']);
Ic.clock = mk(['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', 'M12 7v5l3.5 2']);
Ic.tag = mk(['M3 12V4h8l9 9-8 8-9-9Z', 'M7.5 8.5h.01']);
Ic.wave = mk(['M3 12h2l1.5-5 2 11 2.5-9 2 6 1.5-3H21']);
Ic.arrowUp = mk(['M12 19V5', 'M6 11l6-6 6 6']);
Ic.import = mk(['M12 3v11', 'M8 10l4 4 4-4', 'M5 19h14']);
Ic.flame = mk(['M12 3c1 3-1 4-1 6a3 3 0 0 0 6 .5C18 13 16 18 12 21 8 18 6 14 7 10c.6 2 2 2.5 2 1 0-2 2-4 3-8Z']);
Ic.layers = mk(['M12 3 3 8l9 5 9-5-9-5Z', 'M3 13l9 5 9-5', 'M3 18l9 5 9-5']);
Ic.x = mk(['M6 6l12 12', 'M18 6 6 18']);
Ic.dots = mk(['M6 12h.01', 'M12 12h.01', 'M18 12h.01'], false);
Ic.shuffle = mk(['M16 4h4v4', 'M4 20 20 4', 'M4 4l5 5', 'M14 14l6 6', 'M16 20h4v-4']);
Ic.user = mk(['M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z', 'M5 20c0-3.3 3.1-6 7-6s7 2.7 7 6']);
Ic.play = mk(['M7 5v14l12-7-12-7Z'], true);
Ic.skipBack = mk(['M18 6 8 12l10 6V6Z', 'M6 5v14'], false);
Ic.undo = mk(['M9 7 4 12l5 5', 'M4 12h11a5 5 0 0 1 0 10h-1']);
Ic.stop = mk(['M7 7h10v10H7z'], true);

/* ---------- status bar ---------- */
function StatusBar() {
  return (
    React.createElement('div', { className: 'vx-status' },
      React.createElement('span', { className: 'vx-status-time' }, '9:41'),
      React.createElement('div', { className: 'vx-island' }),
      React.createElement('div', { className: 'vx-status-icons' },
        React.createElement('svg', { width: 18, height: 12, viewBox: '0 0 18 12', fill: 'currentColor' },
          [3, 8, 13].map((x, i) => React.createElement('rect', { key: i, x: x * 1.05, y: 8 - i * 2.5, width: 3, height: 4 + i * 2.5, rx: 0.6 })),
          React.createElement('rect', { x: 0, y: 5.5, width: 3, height: 6.5, rx: 0.6 })),
        React.createElement('svg', { width: 17, height: 12, viewBox: '0 0 17 12', fill: 'currentColor' },
          React.createElement('path', { d: 'M8.5 2.5c2.4 0 4.6.9 6.2 2.4l-1 1.1A7.4 7.4 0 0 0 8.5 4 7.4 7.4 0 0 0 3.3 6L2.3 5A8.9 8.9 0 0 1 8.5 2.5Z' }),
          React.createElement('path', { d: 'M8.5 6c1.4 0 2.7.5 3.6 1.5l-1 1A3.6 3.6 0 0 0 8.5 8.5 3.6 3.6 0 0 0 5.9 9.5l-1-1A5 5 0 0 1 8.5 6Z' }),
          React.createElement('circle', { cx: 8.5, cy: 11, r: 1.2 })),
        React.createElement('svg', { width: 26, height: 13, viewBox: '0 0 26 13', fill: 'none' },
          React.createElement('rect', { x: 0.7, y: 0.7, width: 21, height: 11.6, rx: 3, stroke: 'currentColor', strokeOpacity: 0.4, strokeWidth: 1 }),
          React.createElement('rect', { x: 2.2, y: 2.2, width: 16, height: 8.6, rx: 1.8, fill: 'currentColor' }),
          React.createElement('rect', { x: 23.2, y: 4.2, width: 1.8, height: 4.6, rx: 0.9, fill: 'currentColor', fillOpacity: 0.5 })))
    )
  );
}

/* ---------- tab bar ---------- */
function TabBar({ active = 'crate' }) {
  const tabs = [
    ['crate', 'Crate', Ic.crate],
    ['find', 'Find', Ic.find],
    ['build', 'Build', Ic.build],
    ['dig', 'Dig', Ic.dig],
  ];
  return (
    React.createElement('div', { className: 'vx-tabbar' },
      tabs.map(([id, label, Icon]) =>
        React.createElement('div', { key: id, className: 'vx-tab' + (active === id ? ' on' : '') },
          React.createElement(Icon, { size: 25, sw: active === id ? 2 : 1.7 }),
          React.createElement('span', { className: 'tl' }, label))),
      React.createElement('div', { className: 'vx-home-ind' })
    )
  );
}

/* ---------- cover tile ---------- */
const COVER_TINTS = [
  ['#2b4a4d', '#9fdce0'], ['#3a3551', '#b9a8e6'], ['#4a3c33', '#e6b78f'],
  ['#324a37', '#9fe0a8'], ['#3f3a44', '#cfc6d6'], ['#2d3f4f', '#9cc6e6'],
  ['#4a3340', '#e6a0c4'], ['#43472d', '#d9de8a'], ['#33414a', '#a8cdd9'],
];
function coverHash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }
function Cover({ seed = 'x', cat, size = 52, radius }) {
  const [bg, disc] = COVER_TINTS[coverHash(seed) % COVER_TINTS.length];
  return (
    React.createElement('div', { className: 'vx-cover', style: { width: size, height: size, '--cv': bg, '--cvd': disc, borderRadius: radius || undefined } },
      React.createElement('div', { className: 'disc' }),
      cat ? React.createElement('span', { className: 'cat' }, cat) : null)
  );
}

/* ---------- compatibility ring (conic) ---------- */
function ScoreRing({ value = 80, size = 92, stroke = 8, color = 'var(--lime)', label = 'FIT', numSize }) {
  const deg = Math.round(value * 3.6);
  return (
    React.createElement('div', { className: 'vx-ring', style: { width: size, height: size } },
      React.createElement('div', { style: {
        width: size, height: size, borderRadius: '50%',
        background: `conic-gradient(${color} ${deg}deg, var(--card-2) ${deg}deg)`,
        WebkitMask: `radial-gradient(closest-side, transparent calc(100% - ${stroke}px), #000 calc(100% - ${stroke}px))`,
        mask: `radial-gradient(closest-side, transparent calc(100% - ${stroke}px), #000 calc(100% - ${stroke}px))` } }),
      React.createElement('div', { className: 'vx-ring-val' },
        React.createElement('div', { className: 'num', style: { fontSize: numSize || size * 0.33, color } }, value),
        label ? React.createElement('div', { className: 'lab' }, label) : null))
  );
}

/* ---------- waveform ---------- */
function Wave({ n = 38, seed = 1, className = '', height = 34, peak }) {
  let s = seed * 9301 + 49297;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const bars = Array.from({ length: n }, (_, i) => {
    const env = Math.sin((i / n) * Math.PI);
    return 0.22 + (0.45 * rnd() + 0.5 * env) * 0.78;
  });
  return (
    React.createElement('div', { className: 'vx-wave ' + className, style: { height } },
      bars.map((h, i) =>
        React.createElement('i', { key: i, style: { height: (h * 100) + '%', opacity: peak != null ? (i <= peak ? 1 : 0.28) : undefined } })))
  );
}

/* ---------- BPM stat block ---------- */
function Bpm({ value, size = 22, unit = true }) {
  return React.createElement('span', { className: 'vx-bpm', style: { fontSize: size } },
    String(value), unit ? React.createElement('span', { className: 'u' }, 'BPM') : null);
}

/* ---------- phone frame ---------- */
function Phone({ children }) {
  return React.createElement('div', { className: 'vx-phone' }, children);
}

Object.assign(window, { Ic, StatusBar, TabBar, Cover, ScoreRing, Wave, Bpm, Phone, coverHash });
