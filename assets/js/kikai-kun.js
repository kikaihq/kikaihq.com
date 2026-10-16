(() => {
'use strict';
const C = { ink:'#17181C', paper:'#E9E4D8', panel:'#1E1F22', red:'#D9432C', redHi:'#F6A592', redLo:'#9E2F1C',
            gun:'#6A707C', bone:'#DED6C4', eye:'#F7F3EA', oldSig:'#3FE0D0', oldDeep:'#00897D' };
const SURF = {
  ink:   { fg:C.paper, core:C.red, hi:C.redHi, lo:C.redLo, bg:C.ink, off:'rgba(233,228,216,.07)' },
  panel: { fg:C.paper, core:C.red, hi:C.redHi, lo:C.redLo, bg:C.panel, off:'rgba(233,228,216,.07)' },
  paper: { fg:C.ink, core:C.red, hi:C.redHi, lo:C.redLo, bg:C.paper, off:'rgba(23,24,28,.07)' },
  red:   { fg:C.paper, core:C.paper, hi:C.paper, lo:C.paper, bg:C.red, off:'rgba(233,228,216,.1)' },
  monoInk:   { fg:C.ink, core:C.ink, hi:C.ink, lo:C.ink, bg:C.paper, off:'rgba(23,24,28,.07)' },
  monoPaper: { fg:C.paper, core:C.paper, hi:C.paper, lo:C.paper, bg:C.ink, off:'rgba(233,228,216,.07)' },
  monoRed:   { fg:C.red, core:C.red, hi:C.red, lo:C.red, bg:C.paper, off:'rgba(23,24,28,.07)' },
  gray:  { fg:'#DCDCDC', core:'#8C8C8C', hi:'#B4B4B4', lo:'#6C6C6C', bg:'#1F1F1F', off:'rgba(220,220,220,.07)' },
  cur:   { fg:'currentColor', core:'currentColor', hi:'currentColor', lo:'currentColor', bg:'none', off:'rgba(127,127,127,.12)' }
};
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
const n = (v) => +v.toFixed(3);
const JA_ONLY = /^[\u3040-\u30ff\u4e00-\u9fff\u3000-\u303f]+$/;
function svg(vb, inner, o = {}) {
  const a11y = o.label ? `role="img" aria-label="${esc(o.label)}"${JA_ONLY.test(o.label) ? ' lang="ja"' : ''}` : 'aria-hidden="true" focusable="false"';
  const size = o.w ? ` width="${o.w}" height="${o.h || o.w}"` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}"${o.cls ? ` class="${o.cls}"` : ''}${size} ${a11y}${o.crisp ? ' shape-rendering="crispEdges"' : ''}>${inner}</svg>`;
}
const CORE = { x: 4, y: 4, socket: 1.28, r: .95 };
function cellsPath(rows, pal, ox = 0, oy = 0, k = 1) {
  const by = {};
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const fill = pal[row[x]];
      if (!fill) continue;
      (by[fill] = by[fill] || []).push(`M${n(ox + x * k)} ${n(oy + y * k)}h${k}v${k}h-${k}z`);
    }
  });
  return Object.entries(by).map(([f, d]) => `<path d="${d.join('')}" fill="${f}"/>`).join('');
}
const KUN_W = 32, KUN_HEAD = 16, EYE_W = 12, EYE_X = [2, 18], BROW_W = 12, BROW_X = [2, 18];
const HEART = ['..AABB..', '.AAABBB.', 'AAAABBBB', 'AAAABBBB', 'BBBBDDDD', 'BBBBDDDD', '.BBBDDD.', '..BBDD..'];   // the pixel core's four facets, round
function bodyOf(core, top, guard) {
  const rows = [], e = 1e-9, leg = 2.75;
  const inHeart = (x, y) => { const hy = y - top, hx = x - 12; return hy >= 0 && hy < 8 && hx >= 0 && hx < 8 && HEART[hy][hx] !== '.'; };
  const nearHeart = (x, y) => [-1, 0, 1].some((dy) => [-1, 0, 1].some((dx) => inHeart(x + dx, y + dy)));
  for (let py = 0; py < 32; py++) {
    let r = '';
    for (let px = 0; px < 32; px++) {
      const x = (px + .5) / 4, y = (py + .5) / 4;
      const legs = y >= 2 && x >= 8 - leg - y - e && x <= y + leg + e && !(y > x + e && y > 8 - x + e);
      if (inHeart(px, py)) r += HEART[py - top][px - 12];
      else r += (y < 2 || legs) && Math.hypot(x - core.x, y - core.y) >= core.socket && !(guard && nearHeart(px, py)) ? '#' : '.';
    }
    rows.push(r);
  }
  return rows;
}
const BODY = bodyOf(CORE, 12, true);
const DOME = Array.from({ length: 6 }, (_, y) => Math.round(6 - Math.sqrt(36 - (6 - y - .5) ** 2)));   // a half circle, 12 wide
const FX = {
  z5: ['zzzzz', '...z.', '..z..', '.z...', 'zzzzz'], z4: ['zzzz', '..z.', '.z..', 'zzzz'],
  bang: ['zz', 'zz', 'zz', '..', 'zz'], ask: ['zzz.', '...z', '.zz.', '....', '.z..']
};
const PUPIL = { n: ['.pp.', 'pppp', 'pppp', 'pppp', '.pp.'], b: ['.pppp.', 'pppppp', 'pppppp', 'pppppp', 'pppppp', '.pppp.'], s: ['pp', 'pp'], m: ['.pp.', 'pppp', 'pppp', '.pp.'] };
function kunHead(m) {
  const g = Array.from({ length: KUN_HEAD }, () => Array(KUN_W).fill('.'));
  const put = (x, y, c) => { if (y >= 0 && y < KUN_HEAD && x >= 0 && x < KUN_W) g[y][x] = c; };
  const at = (x, y) => (y >= 0 && y < KUN_HEAD && x >= 0 && x < KUN_W ? g[y][x] : '.');
  [0, 1].forEach((side) => {
    const e = side && m.eyeR ? m.eyeR : m.eye, b = side && m.browR !== undefined ? m.browR : m.brow;
    const ox = EYE_X[side], inner = (x) => (side ? EYE_W - 1 - x : x) / (EYE_W - 1);   // 0 outer, 1 inner
    if (e && (e.shape === 'arc' || e.shape === 'cup')) {           // squeezed shut: a two-pixel arch, or a U asleep
      const h = e.h ?? 6, t = KUN_HEAD - 1 - h;
      for (let r = 0; r < h; r++) for (let x = 0; x < EYE_W; x++) {
        const rr = e.shape === 'arc' ? r : h - 1 - r, a = DOME[rr] ?? 0;
        if (x >= a && x <= EYE_W - 1 - a && (x < a + 2 || x > EYE_W - 3 - a || rr < 2)) put(ox + x, t + r, '#');
      }
    } else if (e && e.shape === 'line') {                          // a blink: two lids met, just above the bar
      for (let x = 1; x < EYE_W - 1; x++) { put(ox + x, KUN_HEAD - 3, '#'); put(ox + x, KUN_HEAD - 2, '#'); }
    } else if (e) {
      const H = e.h ?? 11, top = KUN_HEAD - H;
      const inDome = (x, r) => r >= 0 && r < H && x >= (DOME[r] ?? 0) && x <= EYE_W - 1 - (DOME[r] ?? 0);
      for (let r = 0; r < H; r++) for (let x = 0; x < EYE_W; x++) {
        if (!inDome(x, r)) continue;
        put(ox + x, top + r, r === H - 1 || !inDome(x - 1, r) || !inDome(x + 1, r) || !inDome(x, r - 1) ? 'o' : 'w');
      }
      const lid = e.lid || 0, slope = e.slope || 0;                  // slope > 0: lower at the inner corner
      if (lid || slope) for (let x = 0; x < EYE_W; x++) {
        const cover = Math.round(lid + slope * (inner(x) - .5) * 2);
        for (let r = 1; r < H - 1; r++) if (at(ox + x, top + r) === 'w' && r <= cover) put(ox + x, top + r, r < cover && e.shell ? '#' : 'o');
      }
      if (e.shape === 'x') {
        ['oo..oo', '.oooo.', '..oo..', '.oooo.', 'oo..oo'].forEach((row, r) => [...row].forEach((c, x) => { if (c === 'o') put(ox + 3 + x, top + H - 7 + r, 'o'); }));
      } else {
        const P = PUPIL[e.pupil || 'n'], pw = P[0].length, ph = P.length;
        const x0 = ox + Math.round((EYE_W - pw) / 2) + (e.px || 0), y0 = top + Math.round((H - 1 - ph) / 2) + (e.py || 0) + 1;
        P.forEach((row, r) => [...row].forEach((c, x) => { if (c === 'p' && at(x0 + x, y0 + r) === 'w') put(x0 + x, y0 + r, 'p'); }));
        if (ph > 2) (e.pupil === 'b' ? [[1, 1], [2, 1], [1, 2], [2, 2], [pw - 2, ph - 2]] : [[1, 1]]).forEach(([gx, gy]) => { if (at(x0 + gx, y0 + gy) === 'p') put(x0 + gx, y0 + gy, 'g'); });
      }
    }
    if (b) {                                                         // a brow: y at the outer end, tilt drops the inner end, arch lifts the middle
      const th = b.th ?? 3;
      for (let x = 0; x < BROW_W; x++) {
        const t = (side ? BROW_W - 1 - x : x) / (BROW_W - 1), yy = b.y + Math.round((b.tilt || 0) * t - (b.arch || 0) * Math.sin(Math.PI * t));
        for (let k = t === 0 && th > 2 ? 1 : 0; k < th; k++) put(BROW_X[side] + x, yy + k, '#');   // the outer end tapers
      }
    }
  });
  (m.fx || []).forEach(([name, x, y]) => FX[name].forEach((row, r) => [...row].forEach((c, i) => { if (c !== '.') put(x + i, y + r, c); })));
  return g.map((r) => r.join(''));
}
function kunStep(side, body = BODY) {
  const out = body.map((r) => [...r]), [a, b] = side ? [16, 32] : [0, 16];
  for (let y = 23; y < 32; y++) for (let x = a; x < b; x++) out[y][x] = '.';
  for (let y = 23; y < 32; y++) for (let x = a; x < b; x++) if (body[y][x] === '#') out[y - 2][x] = '#';
  return out.map((r) => r.join(''));
}
const BROW = { y: 1 }, OPEN = { h: 11 };
const KUN_MOODS = {
  idle:       { brow: BROW, eye: OPEN },
  blinkHalf:  { brow: BROW, eye: { h: 11, lid: 6 } },
  curious:    { brow: { y: 2, tilt: 1 }, browR: { y: 1, arch: 1 }, eye: { h: 11, px: 2, py: -1 }, eyeR: { h: 12, px: 2, py: -1 } },
  happy:      { brow: { y: 1, arch: 1 }, eye: { shape: 'arc', h: 6 } },
  excited:    { brow: { y: 1, arch: 1 }, eye: { h: 12, pupil: 'b' } },
  determined: { brow: { y: 1, tilt: 3 }, eye: { h: 11, lid: 3, slope: 2 } },
  thinking:   { brow: { y: 2, tilt: -1 }, browR: { y: 1, arch: 1 }, eye: { h: 11, px: -2, py: -2 }, fx: [['ask', 14, 0]] },
  worried:    { brow: { y: 3, tilt: -3 }, eye: { h: 11, py: 1, lid: 2, slope: -1.5 } },
  sad:        { brow: { y: 4, tilt: -3 }, eye: { h: 10, py: 1, pupil: 'm', lid: 3, slope: -2 } },
  surprised:  { brow: { y: 1, arch: 1, th: 2 }, eye: { h: 12, pupil: 's' }, fx: [['bang', 15, 0]] },
  skeptical:  { brow: { y: 3 }, browR: { y: 1, arch: 1 }, eye: { h: 11, px: 2, lid: 5 }, eyeR: { h: 11, px: 2 } },
  error:      { brow: { y: 3, tilt: -2 }, browR: { y: 1, tilt: 2 }, eye: { h: 11, shape: 'x' } },
  sleep:      { eye: { shape: 'cup', h: 3 }, fx: [['z5', 25, 1], ['z4', 19, 5]] },
  boot0:      {},
  boot1:      { eye: { h: 4, lid: 4, shell: true } },
  boot2:      { eye: { h: 8, lid: 4, shell: true } },
  boot3:      { eye: { h: 12, pupil: 's' } }
};
function kunMood(pose, o = {}) {
  const m = KUN_MOODS[pose] || KUN_MOODS.idle;
  if (!o.look && !o.breath && !o.blink && !o.drift) return m;
  const browLifts = (b) => !b || b.y - (b.arch || 0) > 0;
  const roomFor = (b, h) => !b || KUN_HEAD - h >= b.y - (b.arch || 0) + (b.th ?? 3) + 1;
  const eye = (e, b) => {
    if (!e || e.shape) return e;
    if (o.blink === 2) return { shape: 'line' };
    const out = Object.assign({}, e);
    if (o.look) { out.px = o.look[0]; out.py = o.look[1]; }
    if (o.breath && (o.v32 || browLifts(b) || roomFor(b, (e.h ?? 11) + 1))) out.h = (e.h ?? 11) + 1;
    if (o.blink === 1) out.lid = Math.max(e.lid || 0, Math.floor((out.h ?? 11) / 2));
    return out;
  };
  const brow = (b) => (b && o.breath && b.y - (b.arch || 0) > 0 ? Object.assign({}, b, { y: b.y - 1 }) : b);
  return { eye: eye(m.eye, m.brow), eyeR: eye(m.eyeR || m.eye, m.browR === undefined ? m.brow : m.browR), brow: brow(m.brow), browR: m.browR === undefined ? undefined : brow(m.browR),
           fx: (m.fx || []).map(([f, x, y]) => [f, x, y - (o.drift ? 1 : 0)]) };
}
function kunRows(pose, o = {}) {
  const walk = pose === 'walkB' || pose === 'walkC', side = pose === 'walkC' ? 1 : 0;
  const head = kunHead(kunMood(walk ? 'idle' : pose, o));
  if (o.v31) return head.concat(walk ? BODY4.slice(0, 20).concat(kunLegs(side)) : BODY4);
  if (o.v32) return head.concat(walk ? kunStep(side, BODY_V32) : BODY_V32);
  return head.concat(walk ? kunStep(side) : BODY);
}
function kunPal(on, print) {
  const s0 = SURF[on] || SURF.ink;
  return { '#': on === 'bone' ? C.ink : s0.fg, o: C.ink, w: C.eye, p: C.ink, g: C.eye, A: print ? C.red : C.redHi, B: C.red, D: print ? C.red : C.redLo, z: C.gun };
}
function kunInner(pose, on, o) { return cellsPath(kunRows(pose, o), kunPal(on, o && o.print)); }
function kun(pose, label, size, on, o) { return svg('0 0 32 48', kunInner(pose, on, o), { label, cls: 'sprite', crisp: true, w: size, h: size ? size * 1.5 : 0 }); }
const motionQ = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
let reduce = !!(motionQ && motionQ.matches);
const PAUSE_KEY = 'kikai-kun-paused';
let paused = false;
try { paused = window.localStorage.getItem(PAUSE_KEY) === '1'; } catch (e) { paused = false; }
function setPaused(on, quiet) {
  paused = on;
  try { if (on) window.localStorage.setItem(PAUSE_KEY, '1'); else window.localStorage.removeItem(PAUSE_KEY); } catch (e) { /* this page only */ }
  stages.forEach((s) => s.applyPause(quiet));
}
const WALK = ['idle', 'walkB', 'idle', 'walkC'];
const BLINK = (p, label) => [[p, 50, label, { blink: 1 }], [p, 80, label, { blink: 2 }], [p, 50, label, { blink: 1 }]];
const HOP = (p, label) => [[p, 80, label, { hop: 2 }], [p, 90, label, { hop: 3 }], [p, 80, label, { hop: 1 }], [p, 90, label]];
const TOUR = [['boot0', 1100, 'At rest: the logo'], ['boot1', 150, 'Power-on'], ['boot2', 170, 'Power-on'], ['boot3', 260, 'Power-on'], ['idle', 120, 'Power-on', { breath: 1 }],
  ['idle', 1100, 'Idle'], ...BLINK('idle', 'Idle'), ['idle', 600, 'Idle'], ['idle', 520, 'Looking around', { look: [-2, 0] }], ['idle', 520, 'Looking around', { look: [2, 0] }],
  ['curious', 1300, 'Curious'], ...HOP('happy', 'Happy'), ['happy', 900, 'Happy'], ['excited', 1200, 'Excited'], ...BLINK('excited', 'Excited'), ['excited', 300, 'Excited'],
  ['thinking', 900, 'Thinking'], ['thinking', 900, 'Thinking', { look: [2, -2] }], ['determined', 1300, 'Determined'], ...BLINK('determined', 'Determined'),
  ['worried', 260, 'Worried', { look: [-1, 1] }], ['worried', 260, 'Worried', { look: [1, 1] }], ['worried', 260, 'Worried', { look: [-1, 1] }], ['worried', 500, 'Worried'],
  ['sad', 1500, 'Sad'], ...BLINK('sad', 'Sad'), ['surprised', 90, 'Surprised', { hop: 2 }], ['surprised', 1000, 'Surprised'], ['skeptical', 1500, 'Skeptical'],
  ...Array.from({ length: 12 }, (_, i) => [WALK[i % 4], 125, 'Walking']), ['idle', 400, 'Idle'],
  ['error', 70, 'Error', { shake: 1 }], ['error', 70, 'Error', { shake: -1 }], ['error', 70, 'Error', { shake: 1 }], ['error', 1000, 'Error'], ...BLINK('idle', 'Idle'),
  ['idle', 600, 'Idle'], ['idle', 700, 'Getting sleepy', { blink: 1 }], ['sleep', 900, 'Asleep'], ['sleep', 900, 'Asleep', { drift: 1 }], ['sleep', 900, 'Asleep'], ['sleep', 900, 'Asleep', { drift: 1 }],
  ['boot2', 170, 'Powering down'], ['boot1', 170, 'Powering down'], ['boot0', 500, 'At rest: the logo']];
const BOOT = [['boot0', 700, 'At rest: the logo'], ['boot1', 150, 'Power-on'], ['boot2', 170, 'Power-on'], ['boot3', 260, 'Power-on'], ['idle', 120, 'Power-on', { breath: 1 }]];
const LOST = [['idle', 900, 'Lost'], ['idle', 620, 'Looking around', { look: [-2, 0] }], ['idle', 620, 'Looking around', { look: [2, 0] }], ...BLINK('idle', 'Lost'),
  ['curious', 1300, 'Curious'], ['thinking', 1000, 'Thinking'], ['thinking', 1000, 'Thinking', { look: [2, -2] }], ...BLINK('thinking', 'Thinking'),
  ['worried', 260, 'Worried', { look: [-1, 1] }], ['worried', 260, 'Worried', { look: [1, 1] }], ['worried', 260, 'Worried', { look: [-1, 1] }], ['worried', 900, 'Worried'],
  ...BLINK('worried', 'Worried'), ['sad', 1400, 'Lost'], ...BLINK('sad', 'Lost')];
const NO_PUPILS = new Set(['happy', 'error', 'sleep']);
const FACES = [['idle', 'Idle', 'Idle'], ['happy', 'Happy', 'Happy'], ['excited', 'Excited', 'Excited'], ['curious', 'Curious', 'Curious'], ['determined', 'Set', 'Determined'],
               ['thinking', 'Think', 'Thinking'], ['worried', 'Worried', 'Worried'], ['sad', 'Sad', 'Sad'], ['surprised', 'Wow', 'Surprised'], ['skeptical', 'Hmm', 'Skeptical'],
               ['error', 'Error', 'Error'], ['sleep', 'Sleep', 'Asleep']];
const FIRST = ['idle', 'happy', 'curious', 'sleep'];
let pickers = 0;
const drawn = new Map();
function draw(pose, label, on, o) {
  const key = pose + '|' + label + '|' + on + '|' + JSON.stringify(o || {});
  let s = drawn.get(key);
  if (!s) {
    if (drawn.size > 400) drawn.clear();
    s = kun(pose, label, 0, on || 'panel', o);
    drawn.set(key, s);
  }
  return s;
}
const stages = [];
function mount(holder) {
  if (holder._kun) return holder._kun;
  const root = holder.closest('[data-kun-stage]') || holder.parentElement;
  const labelEl = root.querySelector('[data-kun-label]');
  const hint = root.querySelector('[data-kun-hint]');
  const facesEl = root.querySelector('[data-kun-faces]');
  const start = holder.getAttribute('data-kun-start') || 'idle';
  const rest = start === 'lost' ? ['thinking', 'Thinking'] : ['idle', 'Idle'];
  const st = { scene: null, held: null, t: null, seen: false, started: false, pointer: null, x: 0 };
  const sprite = () => Math.max(1, Math.round(holder.getBoundingClientRect().width / 32));
  function show(pose, label, o = {}) {
    holder.innerHTML = draw(pose, 'Kikai-kun, ' + label, 'panel', o);
    if (o.x !== undefined) st.x = o.x;
    const s = sprite(), tx = st.x + (o.shake ? o.shake * s : 0), ty = o.hop ? -o.hop * s : 0;
    holder.style.transform = tx || ty ? `translate(${tx}px, ${ty}px)` : '';
    if (labelEl) labelEl.textContent = label;
  }
  function press(face) {
    if (facesEl) facesEl.querySelectorAll('[data-face]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.face === face)));
  }
  function stop() { clearTimeout(st.t); st.t = null; }
  const sayEl = document.createElement('span');
  sayEl.className = 'vh';
  sayEl.setAttribute('role', 'status');
  root.appendChild(sayEl);
  let sayT = null;
  function say(text) {
    clearTimeout(sayT);
    sayEl.textContent = '';
    sayT = setTimeout(() => { sayEl.textContent = text; }, 60);
  }
  function sceneStep() {
    st.t = null;
    const sc = st.scene;
    if (!sc || !st.seen || reduce || (paused && !sc.user)) return;
    if (sc.at >= sc.steps.length) {
      if (sc.loop) sc.at = 0;
      else { st.scene = null; sc.then(); return; }
    }
    const [pose, ms, label, o] = sc.steps[sc.at++];
    show(pose, label, o);
    st.t = setTimeout(sceneStep, ms);
  }
  function run(steps, loop, then, user) {
    stop();
    st.held = null;
    st.scene = { steps, at: 0, loop, user: !!user, then: then || (() => hold('idle', 'Idle')) };
    sceneStep();
  }
  function heldFrame() {
    const h = st.held, look = st.pointer && Date.now() - st.pointer.t < 5000 ? st.pointer.look : null;
    show(h.face, h.label, { breath: h.breath, look, blink: [0, 1, 2, 1][h.blink], drift: h.breath });
  }
  function heldTick() {
    st.t = null;
    const h = st.held;
    if (!h || st.scene || !st.seen || reduce || paused) return;
    if (h.blink) h.blink = (h.blink + 1) % 4;
    else if (!NO_PUPILS.has(h.face) && Date.now() > h.next) { h.blink = 1; h.next = Date.now() + 2500 + Math.random() * 3000; }
    else h.breath ^= 1;
    heldFrame();
    st.t = setTimeout(heldTick, h.blink ? 60 : 800);
  }
  function hold(face, label) {
    stop();
    st.scene = null;
    st.held = { face, label, breath: 0, blink: 0, next: Date.now() + 1500 };
    press(face);
    show(face, label);
    st.t = setTimeout(heldTick, 800);
  }
  function still() {
    stop();
    st.scene = null; st.held = null; st.x = 0;
    show(rest[0], rest[1]);
    press(rest[0]);
  }
  function walkIn() {
    const board = holder.closest('.board') || root;
    const s = sprite(), dist = holder.getBoundingClientRect().right - st.x - board.getBoundingClientRect().left;   // the rect has moved by st.x
    const n = Math.max(1, Math.ceil(dist / s)), step = Math.max(3, Math.ceil(n / 26)), steps = [];
    for (let i = 0, left = n; left > 0; i++, left -= step) steps.push([WALK[i % 4], 125, 'Walking', { x: -left * s }]);
    steps.push(['idle', 500, 'Hello', { x: 0 }], ...BLINK('idle', 'Hello'), ['idle', 400, 'Hello']);
    return steps;
  }
  function begin() {
    st.started = true;
    if (reduce || paused) { still(); return; }
    if (start === 'boot') run(BOOT, false);
    else if (start === 'walk') run(walkIn(), false);
    else if (start === 'lost') run(LOST, false, still);      // once, then he rests: no endless loop
    else hold('idle', 'Idle');
  }
  function resume() {
    if (reduce || paused) return;
    if (!st.started) begin();
    else if (st.t) return;
    else if (st.scene) sceneStep();
    else if (st.held) heldTick();
  }
  function wake() {
    if (!st.started) begin();
    else if (start === 'lost') run(LOST, false, still);
    else hold('idle', 'Idle');
  }
  function setFace(face) {
    if (face === 'play') {
      if (reduce) return;
      if (paused) setPaused(false, true);                     // Play means play
      st.started = true;
      press('play');
      say('Kikai-kun plays through his moods');
      run(TOUR, true, null, true);
      return;
    }
    const f = FACES.find(([p]) => p === face), label = f ? f[2] : face;
    say('Kikai-kun: ' + label);
    if (reduce || paused) { stop(); st.scene = null; st.held = null; press(face); show(face, label); return; }
    hold(face, label);
  }
  function poke() {
    if (reduce) return;
    stop();
    const prev = st.scene, steps = HOP('happy', 'Poked!').concat(HOP('happy', 'Poked!'), [['happy', 500, 'Poked!']]);
    st.scene = { steps, at: 0, loop: false, user: true, then: () => {
      if (paused) still();
      else if (prev) { st.scene = prev; sceneStep(); } else if (st.held) heldTick(); else hold('idle', 'Idle');
    } };
    say('Kikai-kun hops');
    sceneStep();
  }
  function watch(e) {
    if (!st.held || st.scene || !st.seen || reduce || paused || NO_PUPILS.has(st.held.face)) return;
    const r = holder.getBoundingClientRect();
    const look = [Math.max(-2, Math.min(2, Math.round((e.clientX - r.left - r.width / 2) / (r.width * .47)))),
                  Math.max(-2, Math.min(1, Math.round((e.clientY - r.top - r.height * .2) / (r.width * .625))))];
    const was = st.pointer && Date.now() - st.pointer.t < 5000 ? st.pointer.look.join() : '';
    st.pointer = { look, t: Date.now() };
    if (look.join() !== was && !st.held.blink) heldFrame();
  }
  const pauseBtn = document.createElement('button');
  pauseBtn.type = 'button';
  pauseBtn.className = 'kun-pause';
  pauseBtn.textContent = 'Pause';           // one word in both states, inside its name (WCAG 2.5.3): filled and aria-pressed say it is on
  pauseBtn.setAttribute('aria-label', 'Pause Kikai-kun');
  pauseBtn.setAttribute('aria-pressed', String(paused));
  pauseBtn.addEventListener('click', () => setPaused(!paused));
  (holder.closest('.board') || root).appendChild(pauseBtn);
  function applyPause(quiet) {
    pauseBtn.setAttribute('aria-pressed', String(paused));
    if (quiet || reduce) return;
    if (paused) still(); else wake();
  }
  function applyReduce() {
    if (reduce) {
      holder.removeAttribute('role');
      holder.removeAttribute('tabindex');
      holder.removeAttribute('aria-label');
    } else {
      holder.setAttribute('role', 'button');
      holder.tabIndex = 0;
      holder.setAttribute('aria-label', 'Poke Kikai-kun');
    }
    if (hint) hint.hidden = reduce;
    pauseBtn.hidden = reduce;
    const play = facesEl && facesEl.querySelector('[data-face="play"]');
    if (play) play.hidden = reduce;
    if (reduce || paused) still();
    else if (st.started && !st.scene && !st.held) wake();
  }
  if (facesEl) {
    const faceBtn = ([p, nm]) => `<button type="button" data-face="${p}" aria-pressed="false">${esc(nm)}</button>`;
    const restId = 'kun-more-faces-' + (++pickers);
    facesEl.innerHTML = '<button type="button" data-face="play" aria-pressed="false">Play</button>' +
      FACES.filter(([p]) => FIRST.includes(p)).map(faceBtn).join('') +
      `<button type="button" class="faces-more" aria-expanded="false" aria-controls="${restId}">More<span class="faces-more-w"> faces</span><span class="faces-sign" aria-hidden="true">+</span></button>` +
      `<div class="faces-rest" id="${restId}" hidden>` + FACES.filter(([p]) => !FIRST.includes(p)).map(faceBtn).join('') + '</div>';
    const moreBtn = facesEl.querySelector('.faces-more'), restEl = facesEl.querySelector('.faces-rest');
    moreBtn.addEventListener('click', () => {
      const open = restEl.hidden;
      restEl.hidden = !open;
      moreBtn.setAttribute('aria-expanded', String(open));
      moreBtn.querySelector('.faces-sign').textContent = open ? '−' : '+';
    });
    facesEl.hidden = false;
    facesEl.addEventListener('click', (e) => { const b = e.target.closest('[data-face]'); if (b) setFace(b.dataset.face); });
  }
  holder.addEventListener('click', poke);
  holder.addEventListener('keydown', (e) => {
    if (!holder.hasAttribute('role') || (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar')) return;
    e.preventDefault();                                       // Space would scroll the page
    if (!e.repeat) poke();
  });
  window.addEventListener('pointermove', watch, { passive: true });
  holder.classList.add('kun-on');
  if (!reduce && !paused && start === 'boot') show('boot0', 'At rest: the logo');
  else if (!reduce && !paused && start === 'walk') show('idle', 'Walking', { x: -(holder.getBoundingClientRect().right - (holder.closest('.board') || root).getBoundingClientRect().left) });
  applyReduce();
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((es) => es.forEach((e) => { st.seen = e.isIntersecting; if (st.seen) resume(); }), { threshold: 0.15 }).observe(root);
  } else { st.seen = true; resume(); }
  const api = { setFace, poke, play: () => setFace('play'), applyReduce, applyPause };
  holder._kun = api;
  stages.push(api);
  return api;
}
function init() { document.querySelectorAll('[data-kikai-kun]').forEach(mount); }
if (motionQ) {
  const onChange = (e) => { reduce = e.matches; stages.forEach((s) => s.applyReduce()); };
  if (motionQ.addEventListener) motionQ.addEventListener('change', onChange); else if (motionQ.addListener) motionQ.addListener(onChange);
}
window.KikaiKun = {
  draw: (pose, label, on, o) => draw(pose, label || 'Kikai-kun', on, o),
  mood: (el, face) => { if (el) mount(el).setFace(face); },
  poke: (el) => { if (el) mount(el).poke(); },
  play: (el) => { if (el) mount(el).play(); }
};
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
})();
