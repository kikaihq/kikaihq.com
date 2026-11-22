(() => {
'use strict';
const TAU = Math.PI * 2, PI = Math.PI;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const wrap = (a) => { a %= TAU; return a > PI ? a - TAU : a < -PI ? a + TAU : a; };
function mulberry(seed) {
  let a = seed >>> 0;
  return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const N = 16;            // segments in a spine
const BODY = 0.74;       // the share of the spine that is body; the rest is the tail fin
const PIVOT = 6;         // the joint the body bends about: about 0.37 of the length, a koi's centre of mass
const CHAIN = 0.17;      // the most a joint of the swimming chain bends, rad
const BEND = 0.2;        // the most a joint of the drawn body bends, wave included, rad (15 x 0.2 = 3.0 < pi)
const R_MIN = 0.4;       // the tightest turn, in body lengths
const STEP = 1 / 60;     // the physics step, s
const CS_T = 0.2;        // a C-start's bend, s
const WAVE = 0.055;      // the swimming wave's bend per joint at full beat, rad
const KAPPA = 6.2;       // its phase along the body, rad per body length: about one wave on the body
const LIMITS = { N, CHAIN, BEND, R_MIN, STEP, CS_T };
const HW = new Float32Array(257), TAIL = new Float32Array(257), NOTCH = new Float32Array(257);
for (let i = 0; i <= 256; i++) {
  const s = i / 256, q = s / BODY, k = clamp((s - BODY) / (1 - BODY), 0, 1);
  HW[i] = q <= 0 || q > 1 ? 0 : q < 0.3 ? 0.122 * Math.pow(Math.sin((q / 0.3) * PI / 2), 0.6) : 0.122 * (1 - 0.74 * Math.pow((q - 0.3) / 0.7, 1.45));
  TAIL[i] = lerp(0.026, 0.135, Math.pow(k, 0.85));
  NOTCH[i] = k > 0.62 ? 0.07 * Math.pow((k - 0.62) / 0.38, 1.2) : -1;
}
const REACH = new Float32Array(N);
for (let i = 0; i < N; i++) for (let k = i * 16; k <= i * 16 + 16; k++) REACH[i] = Math.max(REACH[i], HW[k], k / 256 > BODY - 0.04 ? TAIL[k] : 0);
const WJ = new Float32Array(N);
for (let k = 1; k < N; k++) { const s = k / N, e = clamp((s - 0.18) / 0.62, 0, 1); WJ[k] = 0.16 + 0.84 * e * e * (3 - 2 * e); }
const A = 0, B = 1, R = 2, U = 3, O = 4, G = 5, K = 6, F = 7, NC = 8;
const CHARS = ' :oO0@+x%#&=X-~\\|/\'".,()`*s$8';
const C = (ch) => CHARS.indexOf(ch);
const RAMP = [':oO0@', ':=+xX', '+x%#&', ':=x%#', '+oO%@', '-=s$8', ':=o8@', ':oO0@'].map((r) => Array.from(r, C));
const LV = 12;           // steps of opacity in the atlas
const TEXT_CAP = 0.1;    // the most a letter of the pond shows under text (4.7:1 or better, tools/test_koi.mjs)
function blobs(r, c, n, from, to, size) {
  const out = [];
  for (let i = 0; i < n; i++) out.push({ s: lerp(from, to, (i + 0.25 + r() * 0.5) / n), u: (r() - 0.5) * 1.1, rs: (0.045 + r() * 0.06) * size, ru: (0.5 + r() * 0.7) * size, c, w: r() * TAU });
  return out;
}
const VARIETIES = {
  tancho: { base: A, paint: () => [{ s: 0.115, u: 0, rs: 0.05, ru: 0.62, c: R, hard: 1, w: 0 }] },
  shiro: { base: A, paint: (r) => blobs(r, B, 3, 0.24, 0.7, 0.5) },
  kumonryu: { base: B, paint: (r) => blobs(r, A, 3, 0.1, 0.68, 0.8) },
  purachina: { base: A, paint: () => [] },
  soragoi: { base: B, paint: () => [] },
  asagi: { base: U, net: 1, paint: () => [{ s: 0.42, u: 0.95, rs: 0.38, ru: 0.26, c: A, hard: 1, w: 0 }, { s: 0.42, u: -0.95, rs: 0.38, ru: 0.26, c: A, hard: 1, w: 0 }] },
  shusui: { base: A, paint: () => [{ line: 1, s0: 0.05, s1: 0.72, u: 0, ru: 0.24, c: U }] },
  kohaku: { base: A, paint: (r) => blobs(r, R, 3 + ((r() * 2) | 0), 0.12, 0.7, 1) },
  sanke: { base: A, paint: (r) => [...blobs(r, R, 3, 0.14, 0.7, 1), ...blobs(r, B, 4, 0.2, 0.72, 0.5)] },
  showa: { base: B, paint: (r) => [...blobs(r, A, 3, 0.1, 0.7, 1), ...blobs(r, R, 3, 0.08, 0.66, 1)] },
  ogon: { base: O, net: 1, paint: () => [] },
  yamabuki: { base: G, net: 1, paint: () => [] },
  chagoi: { base: K, net: 1, paint: () => [] }
};
const LABS = ['tancho', 'shiro', 'kumonryu', 'purachina', 'soragoi'];
class Koi {
  constructor(sim, len, deep, variety) {
    const r = sim.rand;
    this.sim = sim; this.len = len; this.seg = len / N;
    this.variety = variety; this.base = VARIETIES[variety].base; this.blobs = VARIETIES[variety].paint(r); this.net = VARIETIES[variety].net || 0;
    this.zLo = deep ? 0.5 : 0; this.zHi = deep ? 1 : 0.62;
    this.z = this.zGoal = lerp(this.zLo, this.zHi, r()); this.zT = 10 + r() * 30;
    this.seed = r() * 1000; this.bx = r() * 2 - 1; this.by = r() * 2 - 1;
    this.cruise = len * ((deep ? 0.15 : 0.18) + 0.07 * r());
    this.v = this.cruise; this.vWant = this.cruise; this.turn = 0; this.hungry = false; this.brake = false; this.home = 0; this.curious = false;
    this.mode = 0; this.modeT = r() * 3; this.amp = 1; this.phase = r() * TAU;
    this.tx = 0; this.ty = 0; this.tT = 0;
    this.cs = 0; this.csT = 0; this.csSide = 1; this.csB = 0; this.esc = 0; this.escT = 0; this.power = 1;
    this.kiss = 6 + r() * 20;
    this.j = new Float32Array((N + 1) * 2);      // the swimming chain
    this.p = new Float32Array((N + 1) * 2);      // the drawn body: the chain with the wave on
    this.pp = new Float32Array((N + 1) * 2);     // the drawn body one step ago (frames fall between steps)
    this.ang = new Float32Array(N); this.rel0 = new Float32Array(N);
    this.am0 = 0; this.px0 = 0; this.py0 = 0;
    this.place(r() * sim.w, r() * sim.h, r() * TAU);
  }
  place(x, y, h) {
    const seg = this.seg;
    this.x = x; this.y = y; this.h = h;
    for (let k = 0; k <= N; k++) { this.j[k * 2] = x - Math.cos(h) * seg * k; this.j[k * 2 + 1] = y - Math.sin(h) * seg * k; }
    this.pose(); this.pp.set(this.p);
  }
  radius(v) { return this.len * clamp(0.3 + 0.2 * v / this.cruise, R_MIN, 0.95); }
  think(dt) {
    const s = this.sim, L = this.len, r = s.rand;
    this.zT -= dt;
    if (this.zT < 0) { this.zT = 20 + r() * 40; this.zGoal = lerp(this.zLo, this.zHi, r()); }
    this.z += (this.zGoal - this.z) * Math.min(1, dt * 0.06);
    this.tT -= dt;
    if (this.tT < 0 || (this.tx - this.x) ** 2 + (this.ty - this.y) ** 2 < (L * 0.7) ** 2) s.aim(this);
    let tx = this.tx, ty = this.ty, vWant = this.cruise * (0.85 + 0.3 * Math.sin(s.t * 0.21 + this.seed)), hungry = false, point = true;
    if (this.z < 0.7 && s.food.length) {
      let best = (L * 3) ** 2, food = null;
      for (const f of s.food) { const d = (f.x - this.x) ** 2 + (f.y - this.y) ** 2; if (d < best) { best = d; food = f; } }
      if (food) {
        tx = food.x; ty = food.y; hungry = true; vWant = this.cruise * 2;
        const d = Math.sqrt(best), off = Math.abs(wrap(Math.atan2(ty - this.y, tx - this.x) - this.h));
        if (d < L * 1.4 && off > 0.5) vWant = this.cruise * 0.8;
        if (d < L * 0.07 + 6 && off < 1.2) s.eat(food, this);
      }
    }
    if (!hungry && this.curious && s.lure) {
      tx = s.lx; ty = s.ly;
      vWant = this.cruise * ((tx - this.x) ** 2 + (ty - this.y) ** 2 < (L * 0.9) ** 2 ? 0.55 : 1.05);
    }
    let want = Math.atan2(ty - this.y, tx - this.x);
    if (this.escT > 0) { this.escT -= dt; want = this.esc; vWant = Math.max(vWant, this.cruise * 1.6); hungry = true; point = false; }
    const rr = this.radius(this.v), look = rr * 1.4 + L * 0.25, m = -L * 0.18;
    const lx = this.x + Math.cos(this.h) * look, ly = this.y + Math.sin(this.h) * look;
    let wall = false;
    this.home -= dt;
    if (lx < m || ly < m || lx > s.w - m || ly > s.h - m || this.home > 0) {
      if (!(this.home > 0)) this.home = 1.5;      // once it has turned for home it keeps on for a moment
      want = Math.atan2(s.h * (0.5 + 0.3 * this.by) - this.y, s.w * (0.5 + 0.3 * this.bx) - this.x); wall = true;
    } else {
      const av = s.avoid;
      for (let i = 0; i < av.length; i += 4) {
        if (lx > av[i] && ly > av[i + 1] && lx < av[i + 2] && ly < av[i + 3]) { want = Math.atan2(this.y - (av[i + 1] + av[i + 3]) / 2, this.x - (av[i] + av[i + 2]) / 2); wall = true; break; }
      }
    }
    let d = wrap(want - this.h);
    if (wall) { point = false; this.escT = Math.min(this.escT, 0.3); }
    this.brake = wall;
    for (const o of s.fish) {
      if (o === this || Math.abs(o.z - this.z) > 0.22) continue;
      const dx = this.x - o.x, dy = this.y - o.y, q = dx * dx + dy * dy, RR = L * 0.6;
      if (q < RR * RR && q > 1) d += wrap(Math.atan2(dy, dx) - this.h) * 0.4 * (1 - Math.sqrt(q) / RR);
    }
    if (point && Math.abs(d) > 0.3) {
      const side = d > 0 ? 1 : -1, cx = this.x - Math.sin(this.h) * rr * side, cy = this.y + Math.cos(this.h) * rr * side;
      if ((tx - cx) ** 2 + (ty - cy) ** 2 < (rr * 0.92) ** 2) d = 0;
    }
    this.turn = d;
    const half = this.cruise * 0.5, slowed = Math.max(half, vWant * (1 - 0.5 * Math.min(1, Math.abs(d) / (PI * 0.5))));
    this.vWant = wall ? (Math.abs(d) > 0.6 ? half : this.cruise * 1.1) : slowed;
    this.hungry = hungry;
  }
  move(dt) {
    this.pp.set(this.p);
    if (this.cs > 0) { this.bend(dt); return; }
    const L = this.len, r = this.sim.rand;
    this.modeT -= dt;
    if (this.mode === 1 && !this.brake) {           // gliding: no thrust, the water slows it
      this.v *= Math.exp(-dt * 0.35);
      if (this.hungry || this.v < this.vWant * 0.72 || this.modeT < 0) { this.mode = 0; this.modeT = 1.4 + r() * 2.4; }
    } else {                                        // beating: it swims up to the speed it wants (braking, faster)
      this.mode = 0;
      this.v += (this.vWant - this.v) * Math.min(1, dt * (this.brake && this.v > this.vWant ? 2.6 : 1.3));
      if (!this.hungry && this.modeT < 0) { this.mode = 1; this.modeT = 0.8 + r() * 1.8; }
    }
    this.v = clamp(this.v, 0, L * 1.2);
    const w = this.v / this.radius(this.v);         // never tighter than its turning radius
    this.h = wrap(this.h + clamp(this.turn * 2.2, -w, w) * dt);
    this.x += Math.cos(this.h) * this.v * dt;
    this.y += Math.sin(this.h) * this.v * dt;
    this.phase = (this.phase + TAU * clamp(0.5 + 2.1 * this.v / L, 0.45, 3.6) * dt) % (TAU * 64);
    const ampT = this.mode === 1 ? 0.12 : clamp(0.45 + 0.55 * this.v / this.cruise, 0.45, 1.6);
    this.amp += (ampT - this.amp) * Math.min(1, dt * (this.mode ? 1.2 : 3));
    this.kiss -= dt;
    if (this.kiss < 0) { this.kiss = 14 + r() * 26; if (this.z < 0.25) this.sim.ripple(this.x, this.y, L * 0.12, 0.28); }
    this.follow();
    this.pose();
  }
  follow() {
    const j = this.j, seg = this.seg;
    j[0] = this.x; j[1] = this.y;
    let pa = this.h + PI;
    for (let k = 1; k <= N; k++) {
      const i = k * 2;
      let a = Math.atan2(j[i + 1] - j[i - 1], j[i] - j[i - 2]);
      const d = wrap(a - pa);
      if (d > CHAIN) a = pa + CHAIN; else if (d < -CHAIN) a = pa - CHAIN;
      j[i] = j[i - 2] + Math.cos(a) * seg; j[i + 1] = j[i - 1] + Math.sin(a) * seg;
      pa = a;
    }
  }
  angles() {
    const j = this.j, a = this.ang;
    for (let k = 0; k < N; k++) a[k] = Math.atan2(j[k * 2 + 1] - j[k * 2 + 3], j[k * 2] - j[k * 2 + 2]);
  }
  pose() {
    this.angles();
    const j = this.j, p = this.p, a = this.ang, seg = this.seg, m = PIVOT, amp = this.amp * WAVE, ph = this.phase;
    p[m * 2] = j[m * 2]; p[m * 2 + 1] = j[m * 2 + 1];
    let ak = a[m];
    for (let k = m; k < N; k++) {
      if (k > m) ak += clamp(wrap(a[k] - a[k - 1]) + amp * WJ[k] * Math.sin(ph - KAPPA * k / N), -BEND, BEND);
      p[k * 2 + 2] = p[k * 2] - Math.cos(ak) * seg; p[k * 2 + 3] = p[k * 2 + 1] - Math.sin(ak) * seg;
    }
    ak = a[m];
    for (let k = m - 1; k >= 0; k--) {
      ak -= clamp(wrap(a[k + 1] - a[k]) + amp * WJ[k + 1] * Math.sin(ph - KAPPA * (k + 1) / N), -BEND, BEND);
      p[k * 2] = p[k * 2 + 2] + Math.cos(ak) * seg; p[k * 2 + 1] = p[k * 2 + 3] + Math.sin(ak) * seg;
    }
  }
  startle(px, py, power) {
    if (this.cs > 0 || this.escT > 0.6) return false;
    const j = this.j, mx = j[PIVOT * 2], my = j[PIVOT * 2 + 1], s = this.sim, L = this.len;
    let away = Math.atan2(my - py, mx - px);
    const ex = mx + Math.cos(away) * L * 1.2, ey = my + Math.sin(away) * L * 1.2;
    if ((ex < 0 && Math.cos(away) < 0) || (ex > s.w && Math.cos(away) > 0)) away = PI - away;
    if ((ey < 0 && Math.sin(away) < 0) || (ey > s.h && Math.sin(away) > 0)) away = -away;
    const d = wrap(away - this.h);
    this.csSide = Math.abs(d) < 0.2 ? (wrap(Math.atan2(s.h / 2 - my, s.w / 2 - mx) - this.h) > 0 ? 1 : -1) : (d > 0 ? 1 : -1);
    this.angles();
    for (let k = 1; k < N; k++) this.rel0[k] = wrap(this.ang[k] - this.ang[k - 1]);
    this.am0 = this.ang[PIVOT]; this.px0 = mx; this.py0 = my;
    this.csB = CHAIN * (0.8 + 0.18 * power); this.cs = CS_T; this.csT = 0;
    this.esc = away; this.escT = 1.4 + power; this.power = power; this.amp = 0; this.mode = 0;
    return true;
  }
  bend(dt) {
    this.csT += dt;
    const t = Math.min(1, this.csT / CS_T), e = 1 - (1 - t) ** 3, side = this.csSide, cb = this.csB, j = this.j, seg = this.seg, m = PIVOT;
    const am = this.am0 + side * cb * 1.5 * e;
    j[m * 2] = this.px0; j[m * 2 + 1] = this.py0;
    let ak = am;
    for (let k = m; k < N; k++) {
      if (k > m) ak += lerp(this.rel0[k], -side * cb, e);
      j[k * 2 + 2] = j[k * 2] - Math.cos(ak) * seg; j[k * 2 + 3] = j[k * 2 + 1] - Math.sin(ak) * seg;
    }
    ak = am;
    for (let k = m - 1; k >= 0; k--) {
      ak -= lerp(this.rel0[k + 1], -side * cb, e);
      j[k * 2] = j[k * 2 + 2] + Math.cos(ak) * seg; j[k * 2 + 1] = j[k * 2 + 3] + Math.sin(ak) * seg;
    }
    this.x = j[0]; this.y = j[1]; this.h = wrap(ak); this.v = this.cruise * 0.3;
    if (t >= 1) { this.cs = 0; this.v = Math.min(this.len * 1.2, this.cruise * (3.4 + 1.6 * this.power)); this.modeT = 1.5; this.amp = 1.5; }
    this.pose();
  }
  colorAt(s, u) {
    let c = this.base;
    if (!this.blobs.length) return c;
    for (const b of this.blobs) {
      if (b.line) { if (s > b.s0 && s < b.s1 && Math.abs(u - b.u) < b.ru * (1 - 0.55 * (s - b.s0) / (b.s1 - b.s0))) c = b.c; continue; }
      const e = ((s - b.s) / b.rs) ** 2 + ((u - b.u) / b.ru) ** 2;
      if (e < (b.hard ? 1 : 1 + 0.42 * Math.sin(s * 46 + b.w) * Math.cos(u * 4.1 + b.w * 2))) c = b.c;
    }
    return c;
  }
}
class Sim {
  constructor(o) {
    this.rand = mulberry(o.seed || 1);
    this.w = o.w; this.h = o.h; this.t = 0; this.acc = 0;
    this.open = o.open || null; this.avoid = o.avoid || [];
    this.kinds = (o.kinds || []).filter((k) => VARIETIES[k]);
    if (this.kinds.length < 2) this.kinds = LABS.slice();
    this.lure = false; this.lx = 0; this.ly = 0; this.lureT = 0;
    this.fish = []; this.food = []; this.rings = [];
    this.populate(o.count || 5, o.unit || 300);
  }
  populate(count, unit) {
    const r = this.rand, deep = Math.round(count * 0.35), first = this.kinds[0], rest = this.kinds.slice(1);
    for (let k = rest.length - 1; k > 0; k--) { const m = (r() * (k + 1)) | 0; [rest[k], rest[m]] = [rest[m], rest[k]]; }
    this.unit = unit; this.fish = []; this.rest = rest;
    for (let i = 0; i < count; i++) {
      const d = i >= count - deep;
      this.fish.push(new Koi(this, unit * (d ? 0.72 : 1) * (0.84 + r() * 0.34), d, i ? rest[(i - 1) % rest.length] : first));
    }
  }
  setCount(n) {
    const first = this.kinds[0], rest = this.rest || this.kinds.slice(1);
    while (this.fish.length > n) {
      let k = -1;
      for (let i = 0; i < this.fish.length; i++) if (this.fish[i].variety !== first && (k < 0 || this.fish[i].z > this.fish[k].z)) k = i;
      this.fish.splice(k < 0 ? this.fish.length - 1 : k, 1);
    }
    while (this.fish.length < n) {
      const f = new Koi(this, this.unit * (0.84 + this.rand() * 0.34), false, rest[this.fish.length % rest.length]);
      f.place(-f.len * 0.4, this.h * (0.2 + 0.6 * this.rand()), 0);
      this.fish.push(f);
    }
  }
  setLure(x, y) { this.lure = true; this.lx = x; this.ly = y; }
  clearLure() { if (this.lure) { this.lure = false; for (const f of this.fish) f.curious = false; } }
  flick(x, y) {
    let n = 0;
    for (const f of this.fish) {
      if (f.z > 0.85) continue;
      const p = f.p;
      for (let k = 0; k <= N; k += 2) if (Math.hypot(p[k * 2] - x, p[k * 2 + 1] - y) < f.len * 0.3 + 12) { if (f.startle(x, y, 0.5)) n++; break; }
    }
    return n;
  }
  shift(dy) {
    if (!dy) return;
    dy = clamp(dy, -240, 240);
    for (const f of this.fish) {
      const k = -dy * (0.03 + 0.14 * (1 - f.z));
      f.y += k; f.ty += k;
      for (let i = 1; i < f.j.length; i += 2) { f.j[i] += k; f.p[i] += k; f.pp[i] += k; }
      const L = f.len;
      if (f.y < -L * 1.1) f.place(f.x, this.h + L * 0.5, -PI / 2);
      else if (f.y > this.h + L * 1.1) f.place(f.x, -L * 0.5, PI / 2);
    }
  }
  resize(w, h) {
    this.w = w; this.h = h;
    for (const f of this.fish) {
      f.tT = 0;
      const L = f.len, m = L * 0.3;
      if (f.x < -m || f.y < -m || f.x > w + m || f.y > h + m) f.place(clamp(f.x, -m, w + m), clamp(f.y, -m, h + m), Math.atan2(h / 2 - f.y, w / 2 - f.x));
    }
  }
  aim(f) {
    const r = this.rand;
    let bx = this.w / 2, by = this.h / 2, bs = -1;
    for (let k = 0; k < 6; k++) {
      const x = this.w * (0.1 + 0.8 * r()), y = this.h * (0.1 + 0.8 * r()), d = Math.hypot(x - f.x, y - f.y);
      const sc = (this.open ? this.open(x, y) : 1) * (0.6 + 0.4 * r()) * (d < f.len ? 0.3 : 1);
      if (sc > bs) { bs = sc; bx = x; by = y; }
    }
    f.tx = bx; f.ty = by; f.tT = 7 + 12 * r();
  }
  ripple(x, y, max, a, v = 34, two = 0) { if (this.rings.length < 12 && x > 0 && y > 0 && x < this.w && y < this.h) this.rings.push({ x, y, r: 3, max, a, v, two }); }
  eat(food, f) { this.food.splice(this.food.indexOf(food), 1); this.ripple(food.x, food.y, f.len * 0.1 + 8, 0.34); }
  touch(x, y) {
    let hit = null, best = 1e9;
    for (const f of this.fish) {
      if (f.z > 0.85) continue;
      const p = f.p;
      for (let k = 0; k <= N; k += 2) { const d = Math.hypot(p[k * 2] - x, p[k * 2 + 1] - y); if (d < f.len * 0.16 + 10 && d < best) { best = d; hit = f; } }
    }
    this.ripple(x, y, 84, 0.5, 64, 1);
    if (hit) {
      hit.startle(x, y, 1);
      for (const f of this.fish) if (f !== hit && Math.hypot(f.x - x, f.y - y) < f.len * 1.3) f.startle(x, y, 0.45);
      return 'startle';
    }
    const n = 3 + ((this.rand() * 3) | 0);
    for (let i = 0; i < n && this.food.length < 24; i++) this.food.push({ x: x + (this.rand() - 0.5) * 40, y: y + (this.rand() - 0.5) * 30, age: 0 });
    return 'feed';
  }
  step(dt) {
    this.t += dt;
    for (const f of this.fish) f.think(dt);
    for (const f of this.fish) {
      f.move(dt);
      const L = f.len, m = L * 0.4;
      if (f.cs <= 0 && (f.x < -L * 1.3 || f.y < -L * 1.3 || f.x > this.w + L * 1.3 || f.y > this.h + L * 1.3)) {
        f.place(clamp(f.x, -m, this.w + m), clamp(f.y, -m, this.h + m), Math.atan2(this.h / 2 - f.y, this.w / 2 - f.x));
        this.rescued = (this.rescued || 0) + 1;
      }
    }
    for (let i = this.food.length - 1; i >= 0; i--) { const f = this.food[i]; f.age += dt; f.y += dt * 1.5; if (f.age > 40) this.food.splice(i, 1); }
    for (let i = this.rings.length - 1; i >= 0; i--) { const g = this.rings[i]; g.r += dt * g.v; if (g.r >= g.max) this.rings.splice(i, 1); }
    this.lureT -= dt;
    if (this.lure && this.lureT <= 0) {
      this.lureT = 0.5;
      let a = null, b = null, da = 1e12, db = 1e12;
      for (const f of this.fish) {
        f.curious = false;
        if (f.z > 0.62 || f.escT > 0) continue;
        const d = (f.x - this.lx) ** 2 + (f.y - this.ly) ** 2;
        if (d > (f.len * 3.5) ** 2) continue;
        if (d < da) { b = a; db = da; a = f; da = d; } else if (d < db) { b = f; db = d; }
      }
      if (a) a.curious = true;
      if (b) b.curious = true;
    }
  }
  advance(dt) {
    if (!(dt > 0)) return 0;
    this.acc += Math.min(dt, 0.25);
    let n = 0;
    while (this.acc >= STEP) { this.step(STEP); this.acc -= STEP; n++; }
    return n;
  }
}
class Painter {
  constructor(canvas) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d', { alpha: true });
    this.P = new Float32Array((N + 1) * 2);
    this.SA = new Float32Array(N * 2); this.SV = new Float32Array(N * 2); this.IL = new Float32Array(N); this.IL2 = new Float32Array(N);
    this.BX = new Float32Array(N * 4); this.FI = new Float32Array(4 * 12);
    this.colors = ['#E9E4D8', '#6A707C', '#D9432C', '#2DB4A9', '#E2823C', '#D6A84A', '#A07D5E', '#9C988C'];
    this.tone = 0.8; this.calm = 1; this.near = 0.5; this.under = TEXT_CAP;
    this.map = new Uint8Array(0); this.mapRows = 0; this.scrollY = 0; this.headBottom = 0; this.vh = 1;
  }
  layout(w, h, dpr, fs) {
    this.w = w; this.h = h; this.dpr = dpr; this.fs = fs;
    const cwd = Math.max(2, Math.round(fs * 0.6 * dpr)), chd = Math.max(4, Math.round(fs * 1.16 * dpr));
    this.cwd = cwd; this.chd = chd; this.cw = cwd / dpr; this.ch = chd / dpr;
    this.cols = Math.ceil(w / this.cw) + 1; this.rows = Math.ceil(h / this.ch) + 1;
    const n = this.cols * this.rows;
    this.code = new Uint8Array(n); this.col = new Uint8Array(n); this.lvl = new Uint8Array(n); this.own = new Uint8Array(n);
    this.touched = new Int32Array(n); this.nt = 0;
    this.scode = new Uint8Array(n); this.scol = new Uint8Array(n); this.slvl = new Uint8Array(n); this.stamp = new Uint32Array(n);
    this.shown = new Int32Array(n); this.shown2 = new Int32Array(n); this.ns = 0; this.tick = 1;
    this.X = new Int32Array(this.cols); this.Y = new Int32Array(this.rows);
    for (let i = 0; i < this.cols; i++) this.X[i] = i * cwd;
    for (let i = 0; i < this.rows; i++) this.Y[i] = i * chd;
    this.rowQ = new Int32Array(this.rows); this.rowQ2 = new Int32Array(this.rows); this.rowF = new Float32Array(this.rows);
    this.span0 = new Int32Array(this.rows); this.span1 = new Int32Array(this.rows); this.rmask = new Int32Array(this.rows);
    this.canvas.width = Math.round(w * dpr); this.canvas.height = Math.round(h * dpr);
    this.atlas();
  }
  atlas() {
    const d = this.dpr, tw = this.cwd, th = this.chd, total = CHARS.length * NC * LV, per = 64;
    const cv = this.sheet || (this.sheet = document.createElement('canvas'));
    cv.width = per * tw; cv.height = Math.ceil(total / per) * th;
    const g = cv.getContext('2d');
    g.clearRect(0, 0, cv.width, cv.height);
    g.font = '500 ' + (this.fs * d).toFixed(2) + 'px "IBM Plex Mono",ui-monospace,Consolas,monospace';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let c = 1; c < CHARS.length; c++) {
      for (let k = 0; k < NC; k++) {
        g.fillStyle = this.colors[k];
        for (let l = 1; l <= LV; l++) {
          const t = (c * NC + k) * LV + l - 1, x = (t % per) * tw, y = ((t / per) | 0) * th;
          g.save(); g.beginPath(); g.rect(x, y, tw, th); g.clip();
          g.globalAlpha = l / LV;
          g.fillText(CHARS[c], x + tw / 2, y + th / 2);
          g.restore();
        }
      }
    }
    this.per = per;
    this.wipe();
  }
  wipe() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    for (let n = 0; n < this.ns; n++) this.slvl[this.shown[n]] = 0;
    this.ns = 0;
  }
  put(i, ch, c, a) {
    const l = (a * LV + 0.5) | 0;
    if (l <= 0) return;
    if (!this.lvl[i]) this.touched[this.nt++] = i;
    this.code[i] = ch; this.col[i] = c; this.lvl[i] = l > LV ? LV : l; this.own[i] = this.rank;
  }
  quiet(i, ix, iy) {
    const q = this.rowQ[iy];
    if (q === -1) return 2;
    const a = q < 0 ? 0 : this.map[q + ix], q2 = this.rowQ2[iy], b = q2 < 0 ? 0 : this.map[q2 + ix];
    return a > b ? a : b;
  }
  allow(q) { return q === 0 ? 1 : q === 1 ? this.near : q === 2 ? this.under : 0; }
  rowsFor(scrollY, headBottom) {
    const ch = this.ch, cols = this.cols, mr = this.mapRows, vh = this.vh;
    for (let iy = 0; iy < this.rows; iy++) {
      const top = iy * ch, d0 = Math.floor((top + scrollY) / ch), d1 = Math.floor((top + ch - 0.01 + scrollY) / ch);
      this.rowQ[iy] = top < headBottom + 2 ? -1 : d0 >= 0 && d0 < mr ? d0 * cols : -2;
      this.rowQ2[iy] = d1 >= 0 && d1 < mr ? d1 * cols : -2;
      this.rowF[iy] = 1 - 0.28 * clamp((top + ch / 2 + scrollY - vh * 0.9) / vh, 0, 1);
    }
  }
  frame(sim, t) {
    this.rank = 0;
    for (const g of sim.rings) this.ring(g);
    const fish = sim.fish;
    for (let i = 1; i < fish.length; i++) { const f = fish[i]; let k = i - 1; while (k >= 0 && fish[k].z < f.z) { fish[k + 1] = fish[k]; k--; } fish[k + 1] = f; }
    for (let i = 0; i < fish.length; i++) { this.rank = i + 1; this.fish(fish[i], t); }
    this.rank = 0;
    const cw = this.cw, ch = this.ch, star = C('*'), o = C('o');
    for (const f of sim.food) {
      const ix = Math.floor(f.x / cw), iy = Math.floor(f.y / ch);
      if (ix < 0 || iy < 0 || ix >= this.cols || iy >= this.rows) continue;
      const i = iy * this.cols + ix, q = this.quiet(i, ix, iy);
      const m = this.allow(q), a = 0.8 * Math.min(1, (40 - f.age) / 6);
      if (m > 0) this.put(i, f.age < 0.4 ? o : star, F, q === 2 ? Math.min(m, a) : a * m);
    }
    this.drawn = this.nt;
    this.blit();
  }
  ring(g) {
    const life = 1 - g.r / g.max;
    this.ringAt(g.x, g.y, g.r, g.a * life * life * Math.max(0.55, this.tone));
    if (g.two && g.r > 14) this.ringAt(g.x, g.y, g.r * 0.58, g.a * 0.6 * life * Math.max(0.55, this.tone));
  }
  ringAt(x, y, r, a0) {
    const cw = this.cw, ch = this.ch, n = Math.max(10, Math.round(TAU * r / cw));
    for (let k = 0; k < n; k++) {
      const th = k / n * TAU, c = Math.cos(th), s = Math.sin(th);
      const ix = Math.floor((x + c * r) / cw), iy = Math.floor((y + s * r * 0.62) / ch);
      if (ix < 0 || iy < 0 || ix >= this.cols || iy >= this.rows) continue;
      const i = iy * this.cols + ix, q = this.quiet(i, ix, iy), m = this.allow(q);
      if (m <= 0 || q === 2) continue;
      let c0 = C('-');
      if (Math.abs(c) > 0.86) c0 = c > 0 ? C(')') : C('(');
      else if (Math.abs(c) > 0.42) c0 = s < 0 ? (c > 0 ? C('.') : C(',')) : (c > 0 ? C('\'') : C('`'));
      this.put(i, c0, A, a0 * m * this.rowF[iy]);
    }
  }
  sample(px, py, L, mask) {
    const SA = this.SA, SV = this.SV, BX = this.BX;
    let best = 1e12, bi = -1, bt = 0, side = 1;
    for (let i = 0; i < N; i++) {
      if (!((mask >> i) & 1) || px < BX[i * 4] || py < BX[i * 4 + 1] || px > BX[i * 4 + 2] || py > BX[i * 4 + 3]) continue;
      const ax = SA[i * 2], ay = SA[i * 2 + 1], vx = SV[i * 2], vy = SV[i * 2 + 1];
      let t = ((px - ax) * vx + (py - ay) * vy) * this.IL2[i];
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const dx = px - ax - vx * t, dy = py - ay - vy * t, d2 = dx * dx + dy * dy;
      if (d2 < best) { best = d2; bi = i; bt = t; side = vx * dy - vy * dx < 0 ? -1 : 1; }
    }
    this.qe = 1e9;
    if (bi >= 0) {
      const d = Math.sqrt(best), s = (bi + bt) / N, ti = (s * 256) | 0;
      this.qs = s; this.qx = SV[bi * 2] * this.IL[bi]; this.qy = SV[bi * 2 + 1] * this.IL[bi];
      if (s <= BODY) {
        const hw = HW[ti] * L;
        if (d < hw) { this.qu = side * d / hw; this.qd = hw - d; return 1; }
        this.qe = d - hw;
      }
      if (s > BODY - 0.04) {
        const outer = TAIL[ti] * L, notch = NOTCH[ti] < 0 ? -1 : NOTCH[ti] * L;
        if (d < outer && d > notch && !(bi === N - 1 && bt === 1 && d > L * 0.03)) {
          this.qu = side * d / outer; this.qd = Math.min(outer - d, d - notch); this.qk = clamp((s - BODY) / (1 - BODY), 0, 1); return 2;
        }
        if (d - outer < this.qe) this.qe = d - outer;
      }
    }
    const FI = this.FI;
    for (let f = 0; f < 4; f++) {
      const o = f * 12;
      if (px < FI[o + 8] || py < FI[o + 9] || px > FI[o + 10] || py > FI[o + 11]) continue;
      const lx = px - FI[o], ly = py - FI[o + 1], ax = FI[o + 2], ay = FI[o + 3], len = FI[o + 4], a = lx * ax + ly * ay;
      if (a < 0 || a > len) continue;
      const b = Math.abs(ly * ax - lx * ay), k = a / len, half = FI[o + 5] * 1.3 * Math.sqrt(k) * Math.sqrt(1 - k * k * k);
      if (b < half) { this.qx = ax; this.qy = ay; this.qd = Math.min(half - b, (1 - k) * len); this.qk = k; this.qs = FI[o + 6]; this.qu = FI[o + 7] * 0.9; return 3; }
    }
    return 0;
  }
  span(B, o, r0, r1, bit) {
    const ch = this.ch, cw = this.cw, S0 = this.span0, S1 = this.span1, RM = this.rmask;
    const a = Math.max(r0, Math.floor(B[o + 1] / ch)), b = Math.min(r1, Math.floor(B[o + 3] / ch)), c0 = Math.max(0, Math.floor(B[o] / cw)), c1 = Math.min(this.cols - 1, Math.floor(B[o + 2] / cw));
    for (let iy = a; iy <= b; iy++) { if (c0 < S0[iy]) S0[iy] = c0; if (c1 > S1[iy]) S1[iy] = c1; RM[iy] |= bit; }
  }
  finNear(px, py) {
    const FI = this.FI;
    for (let o = 0; o < 48; o += 12) if (px >= FI[o + 8] && py >= FI[o + 9] && px <= FI[o + 10] && py <= FI[o + 11]) return true;
    return false;
  }
  at(s) {
    const P = this.P, f = clamp(s, 0, 0.9999) * N, i = f | 0, t = f - i;
    const ax = P[i * 2], ay = P[i * 2 + 1], bx = P[i * 2 + 2], by = P[i * 2 + 3], d = Math.hypot(bx - ax, by - ay) || 1;
    this.ax = lerp(ax, bx, t); this.ay = lerp(ay, by, t); this.atx = (bx - ax) / d; this.aty = (by - ay) / d;
  }
  fish(f, t) {
    const P = this.P, p = f.p, pp = f.pp, L = f.len, cw = this.cw, ch = this.ch, cols = this.cols;
    for (let k = 0; k < P.length; k++) P[k] = pp[k] + (p[k] - pp[k]) * t;
    const SA = this.SA, SV = this.SV, BX = this.BX, halo = cw * 1.25;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (let i = 0; i < N; i++) {
      const ax = P[i * 2], ay = P[i * 2 + 1], bx = P[i * 2 + 2], by = P[i * 2 + 3], vx = bx - ax, vy = by - ay, l2 = vx * vx + vy * vy || 1;
      SA[i * 2] = ax; SA[i * 2 + 1] = ay; SV[i * 2] = vx; SV[i * 2 + 1] = vy; this.IL2[i] = 1 / l2; this.IL[i] = 1 / Math.sqrt(l2);
      const M = REACH[i] * L + halo;
      BX[i * 4] = Math.min(ax, bx) - M; BX[i * 4 + 1] = Math.min(ay, by) - M; BX[i * 4 + 2] = Math.max(ax, bx) + M; BX[i * 4 + 3] = Math.max(ay, by) + M;
      if (BX[i * 4] < x0) x0 = BX[i * 4]; if (BX[i * 4 + 1] < y0) y0 = BX[i * 4 + 1]; if (BX[i * 4 + 2] > x1) x1 = BX[i * 4 + 2]; if (BX[i * 4 + 3] > y1) y1 = BX[i * 4 + 3];
    }
    const flap = Math.sin(f.phase * 0.5), FI = this.FI;
    for (let n = 0; n < 4; n++) {
      const back = n > 1, side = n % 2 ? 1 : -1, s = back ? 0.47 : 0.21, len = (back ? 0.085 : 0.17) * L, wide = (back ? 0.036 : 0.066) * L;
      const ang = (back ? 0.5 - flap * 0.12 : 0.6 + flap * 0.2) + flap * side * 0.08;
      this.at(s);
      const hw = HW[(s * 256) | 0] * L * 0.72, nx = -this.aty * side, ny = this.atx * side, c = Math.cos(ang), sn = Math.sin(ang);
      const o = n * 12, x = this.ax + nx * hw, y = this.ay + ny * hw, ax = this.atx * c + nx * sn, ay = this.aty * c + ny * sn, ex = x + ax * len, ey = y + ay * len, rr = wide * 1.05 + ch * 0.3;
      FI[o] = x; FI[o + 1] = y; FI[o + 2] = ax; FI[o + 3] = ay; FI[o + 4] = len; FI[o + 5] = wide; FI[o + 6] = s; FI[o + 7] = side;
      FI[o + 8] = Math.min(x, ex) - rr; FI[o + 9] = Math.min(y, ey) - rr; FI[o + 10] = Math.max(x, ex) + rr; FI[o + 11] = Math.max(y, ey) + rr;
      if (FI[o + 8] < x0) x0 = FI[o + 8]; if (FI[o + 9] < y0) y0 = FI[o + 9]; if (FI[o + 10] > x1) x1 = FI[o + 10]; if (FI[o + 11] > y1) y1 = FI[o + 11];
    }
    const r0 = Math.max(0, Math.floor(y0 / ch)), r1 = Math.min(this.rows - 1, Math.floor(y1 / ch));
    if (r0 > r1 || x1 < 0 || x0 > this.w) return;
    const S0 = this.span0, S1 = this.span1, RM = this.rmask;
    for (let iy = r0; iy <= r1; iy++) { S0[iy] = cols; S1[iy] = -1; RM[iy] = 0; }
    for (let i = 0; i < N; i++) this.span(BX, i * 4, r0, r1, 1 << i);
    for (let n = 0; n < 4; n++) this.span(FI, n * 12 + 8, r0, r1, 0);
    const dim0 = (0.92 - 0.55 * f.z) * this.tone * this.calm, base = f.base, lo = ch * 0.3;
    const DQ = C('"'), AP = C('\''), OO = C('o'), DOT = C('.'), EYE = C('0'), TIL = C('~'), COL = C(':');
    for (let iy = r0; iy <= r1; iy++) {
      const pyT = (iy + 0.25) * ch, pyM = (iy + 0.5) * ch, pyB = (iy + 0.75) * ch, rf = this.rowF[iy], mask = RM[iy];
      for (let ix = S0[iy]; ix <= S1[iy]; ix++) {
        const i = iy * cols + ix, q = this.quiet(i, ix, iy), allow = this.allow(q);
        if (allow <= 0) continue;
        const px = (ix + 0.5) * cw;
        let top = this.sample(px, pyM, L, mask), bot = top;
        let ts = this.qs, tu = this.qu, td = this.qd, ttx = this.qx, tty = this.qy, tk = this.qk, te = this.qe;
        if (top ? td <= ch * 0.28 : te <= ch * 0.28 || this.finNear(px, pyM)) {
          top = this.sample(px, pyT, L, mask); ts = this.qs; tu = this.qu; td = this.qd; ttx = this.qx; tty = this.qy; tk = this.qk; te = this.qe;
          bot = this.sample(px, pyB, L, mask);
        }
        if (!top && !bot) {
          if (this.own[i] && this.lvl[i] && Math.min(te, this.qe) < cw * 1.2) this.lvl[i] = (this.lvl[i] * 0.3) | 0;
          continue;
        }
        let dim = dim0 * rf;
        if (q === 1) dim *= allow;
        const cap = q === 2 ? allow : 1;
        const kind = Math.max(top, bot) === 3 && Math.min(top, bot) > 0 ? Math.min(top, bot) : (top === 1 || bot === 1 ? 1 : Math.max(top, bot));
        const both = top === kind && bot === kind, high = top === kind;
        const s = both ? (ts + this.qs) / 2 : (high ? ts : this.qs), u = both ? (tu + this.qu) / 2 : (high ? tu : this.qu);
        const depth = high && !both ? td : this.qd, tx = high ? ttx : this.qx, ty = high ? tty : this.qy, k = high ? tk : this.qk;
        if (kind === 1) {
          const c = f.colorAt(s, u);
          if (!both) { this.put(i, high ? (depth > lo ? DQ : AP) : (depth > lo ? OO : DOT), c, Math.min(cap, dim * 0.8)); continue; }
          if (s > 0.05 && s < 0.1 && Math.abs(Math.abs(u) - 0.6) < 0.24) { if (base === A) this.put(i, EYE, B, Math.min(cap, 0.9 * dim)); else if (this.lvl[i]) this.lvl[i] = 0; continue; }
          const ramp = RAMP[c], shade = clamp(1.22 - Math.abs(u) * 1.1 + 0.08 * Math.sin(s * 70 + u * 4 + f.seed) + f.net * 0.2 * Math.sin(s * 150) * Math.sin(u * 9 + s * 50), 0, 0.999);
          this.put(i, ramp[(shade * 5) | 0], c, Math.min(cap, dim * (c > B ? 1.3 : 1) * (0.62 + 0.38 * shade)));
        } else {
          const a = dim * (kind === 2 ? 0.6 - k * 0.14 : 0.5);
          if (!both) { this.put(i, high ? AP : DOT, base, Math.min(cap, a * 0.9)); continue; }
          let g = kind === 2 ? TIL : COL;
          if (depth >= cw * 0.7) {
            const an = ((Math.atan2(ty, tx) % PI) + PI) % PI;
            g = an < 0.39 || an > 2.75 ? C('-') : an < 1.18 ? C('\\') : an < 1.96 ? C('|') : C('/');
          }
          this.put(i, g, base, Math.min(cap, a));
        }
      }
    }
  }
  blit() {
    const ctx = this.ctx, sheet = this.sheet, tw = this.cwd, th = this.chd, per = this.per, cols = this.cols, T = this.touched, X = this.X, Y = this.Y;
    const CODE = this.code, COLR = this.col, LVL = this.lvl, OWN = this.own, SC = this.scode, SK = this.scol, SL = this.slvl, ST = this.stamp;
    const tick = this.tick = (this.tick + 1) >>> 0 || 1, next = this.shown2;
    let ns = 0, changed = 0;
    for (let n = 0; n < this.nt; n++) {
      const i = T[n], l = LVL[i];
      if (l) {
        if (SL[i] !== l || SC[i] !== CODE[i] || SK[i] !== COLR[i]) {
          const t = (CODE[i] * NC + COLR[i]) * LV + l - 1, iy = (i / cols) | 0, x = X[i - iy * cols], y = Y[iy];
          if (SL[i]) ctx.clearRect(x, y, tw, th);
          ctx.drawImage(sheet, (t % per) * tw, ((t / per) | 0) * th, tw, th, x, y, tw, th);
          SL[i] = l; SC[i] = CODE[i]; SK[i] = COLR[i]; changed++;
        }
        ST[i] = tick; next[ns++] = i;
      }
      LVL[i] = 0; OWN[i] = 0;
    }
    const prev = this.shown;
    for (let n = 0; n < this.ns; n++) {
      const i = prev[n];
      if (ST[i] !== tick && SL[i]) { const iy = (i / cols) | 0; ctx.clearRect(X[i - iy * cols], Y[iy], tw, th); SL[i] = 0; changed++; }
    }
    this.shown = next; this.shown2 = prev; this.ns = ns; this.nt = 0; this.changed = changed;
  }
}
const KEY = 'kikai-pond', FISH_KEY = 'kikai-pond-fish';
const COVER = '.card,.board,.plate,.kq-photo,.notice,.burn-art,.seg,img,video,iframe';
const SOLID = 'a,button,.btn,input,select,textarea,hr,svg';     // a link's whole box: a wrapped one spans the lines it breaks across
const BUDGET = 4;          // ms of work a frame may take before the pond gets simpler
const stat = { frames: 0, work: new Float32Array(240), level: 0, fish: 0, cells: 0, changed: 0, food: 0, rings: 0, sim: null };
function mount() {
  const doc = document, root = doc.documentElement, body = doc.body;
  if (!body || doc.querySelector('canvas.pond') || !window.requestAnimationFrame) return;
  const canvas = doc.createElement('canvas');
  canvas.className = 'pond'; canvas.setAttribute('aria-hidden', 'true');
  body.insertBefore(canvas, body.firstChild);
  if (!canvas.getContext) { canvas.remove(); return; }
  const P = new Painter(canvas);
  const btn = doc.createElement('button');
  btn.type = 'button'; btn.className = 'pond-btn'; btn.setAttribute('aria-label', 'Pause the koi pond');
  btn.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path class="i-pause" d="M4 3h3v10H4zM9 3h3v10H9z"/><path class="i-play" d="M4.5 2.5 13 8l-8.5 5.5z"/></svg><span>Koi</span>';
  const theme = doc.querySelector('.site-head [data-theme-toggle]');
  if (theme) theme.parentNode.insertBefore(btn, theme); else { btn.classList.add('pond-btn-free'); body.appendChild(btn); }
  const motionQ = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  let choice = null;
  try { choice = window.localStorage.getItem(KEY); } catch (e) { choice = null; }
  const playing = () => (choice === 'paused' ? false : choice === 'playing' ? true : !(motionQ && motionQ.matches));
  const stage = doc.querySelector('[data-kikai-kun]');
  P.calm = stage ? 0.7 : 1;
  let sim = null, size = '', seen = true, raf = 0, restored = false, lastDraw = 0, level = 0, slow = 0, fast = 0, settle = 0, avoidDoc = [];
  function readColors() {
    const cs = getComputedStyle(canvas), get = (n, d) => (cs.getPropertyValue(n) || '').trim() || d;
    const num = (n, d) => { const v = parseFloat(get(n, String(d))); return v >= 0 ? v : d; };
    P.colors = ['a', 'b', 'r', 'u', 'o', 'g', 'k', 'f'].map((k, i) => get('--pond-' + k, P.colors[i]));
    P.tone = num('--pond-tone', 0.8); P.near = num('--pond-near', 0.5); P.under = Math.min(TEXT_CAP, num('--pond-under', TEXT_CAP));
    P.kinds = get('--pond-kinds', '').replace(/["']/g, ' ').split(/\s+/).filter((k) => VARIETIES[k]);
  }
  function buildMap() {
    const cw = P.cw, ch = P.ch, cols = P.cols, sy = window.scrollY, rows = Math.ceil(Math.max(root.scrollHeight, body.scrollHeight) / ch) + 2;
    if (P.map.length < rows * cols) P.map = new Uint8Array(rows * cols); else P.map.fill(0, 0, rows * cols);
    P.mapRows = rows;
    const map = P.map;
    const mark = (x0, y0, x1, y1, lv) => {
      const a = Math.max(0, Math.floor(y0 / ch)), b = Math.min(rows - 1, Math.floor(y1 / ch)), c0 = Math.max(0, Math.floor(x0 / cw)), c1 = Math.min(cols - 1, Math.floor(x1 / cw));
      for (let r = a; r <= b; r++) for (let c = c0; c <= c1; c++) { const i = r * cols + c; if (map[i] < lv) map[i] = lv; }
    };
    const box = (r, pad, softPad, lv) => {
      if (r.width < 1 && r.height < 1) return;
      if (softPad) mark(r.left - softPad, r.top + sy - softPad * 0.6, r.right + softPad, r.bottom + sy + softPad * 0.6, 1);
      mark(r.left - pad, r.top + sy - pad, r.right + pad, r.bottom + sy + pad, lv);
    };
    for (const el of doc.querySelectorAll(COVER)) if (!el.closest('.site-head')) box(el.getBoundingClientRect(), 0, cw * 2, 3);
    for (const el of doc.querySelectorAll(SOLID)) if (!el.closest(COVER) && !el.closest('.site-head') && el !== canvas) box(el.getBoundingClientRect(), 6, cw * 2.5, 2);
    const walk = doc.createTreeWalker(body, NodeFilter.SHOW_TEXT), range = doc.createRange();
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      if (!/\S/.test(n.nodeValue)) continue;
      const el = n.parentElement;
      if (!el || el.closest(COVER) || el.closest('script,style,.vh,.site-head')) continue;
      range.selectNodeContents(n);
      const rs = range.getClientRects();
      for (let k = 0; k < rs.length; k++) box(rs[k], 6, cw * 2.5, 2);
    }
    avoidDoc = [];
    if (stage) for (const el of doc.querySelectorAll('[data-kun-stage]')) { const r = el.getBoundingClientRect(); avoidDoc.push(r.left - 24, r.top + sy - 24, r.right + 24, r.bottom + sy + 24); }
  }
  const openness = (x, y) => {
    const ix = Math.floor(x / P.cw), dr = Math.floor((y + window.scrollY) / P.ch);
    if (ix < 0 || ix >= P.cols || dr < 0 || dr >= P.mapRows) return 1;
    const q = P.map[dr * P.cols + ix];
    return q === 0 ? 1 : q === 1 ? 0.5 : 0.05;
  };
  function sizeUp() {
    const w = root.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
    const unit = clamp(Math.min(w * 0.23, h * 0.42), 140, 400), fs = clamp(Math.round(unit / 31), 8, 12);
    const count = Math.max(2, clamp(Math.round(w * h / 210000), 2, 7) - (stage ? 1 : 0) - Math.max(0, level - 2));
    const dpr = Math.min(window.devicePixelRatio || 1, level >= 1 ? 1 : 2);
    P.vh = window.innerHeight;
    P.layout(w, h, dpr, fs);
    const key = String(Math.round(unit / 20));
    if (!sim) {
      sim = new Sim({ w, h, seed: (Date.now() ^ (Math.random() * 1e9)) >>> 0, count, unit, kinds: P.kinds, open: openness, avoid: [] });
      restore(w, h);
      if (!restored) for (let k = 0; k < 120; k++) sim.step(STEP);     // two seconds before the first picture: natural curves
    } else {
      sim.resize(w, h);
      if (key !== size) { sim.populate(count, unit); for (let k = 0; k < 120; k++) sim.step(STEP); }
      else sim.setCount(count);
    }
    size = key; stat.fish = sim.fish.length;
    buildMap();
    settle = performance.now() + 1500;
  }
  function restore(w, h) {
    let s = null;
    try { s = JSON.parse(window.sessionStorage.getItem(FISH_KEY) || 'null'); } catch (e) { s = null; }
    if (!s || !Array.isArray(s.f) || Math.abs(s.w - w) > w * 0.1 || Math.abs(s.h - h) > h * 0.25 || Date.now() - s.at > 120000) return;
    sim.fish = []; restored = true;
    for (const r of s.f) {
      if (!VARIETIES[r[0]] || r.length !== 6 + (N + 1) * 2) continue;
      const f = new Koi(sim, r[1], r[2] > 0.5 && r[1] < sim.unit * 0.9, r[0]);
      f.z = f.zGoal = r[2]; f.x = r[3]; f.y = r[4]; f.h = r[5];
      for (let k = 0; k < (N + 1) * 2; k++) f.j[k] = r[6 + k];
      f.follow(); f.pose(); f.pp.set(f.p);
      sim.fish.push(f);
    }
    if (!sim.fish.length) sim.populate(3, sim.unit);
  }
  function save() {
    if (!sim) return;
    const f = sim.fish.map((k) => [k.variety, +k.len.toFixed(1), +k.z.toFixed(2), +k.x.toFixed(1), +k.y.toFixed(1), +k.h.toFixed(3), ...Array.from(k.j, (v) => +v.toFixed(1))]);
    try { window.sessionStorage.setItem(FISH_KEY, JSON.stringify({ at: Date.now(), w: P.w, h: P.h, f })); } catch (e) { /* this page only */ }
  }
  const head = doc.querySelector('.site-head');
  function paint(t) {
    const hb = head ? head.getBoundingClientRect().bottom : 0, sy = window.scrollY;
    P.rowsFor(sy, hb > 0 ? hb : 0);
    const av = sim.avoid;
    av.length = avoidDoc.length;
    for (let i = 0; i < avoidDoc.length; i++) av[i] = i % 2 ? avoidDoc[i] - sy : avoidDoc[i];
    P.frame(sim, t);
    stat.cells = P.drawn; stat.changed = P.changed; stat.food = sim.food.length; stat.rings = sim.rings.length; stat.sim = sim;
  }
  const running = () => playing() && seen && !doc.hidden;
  function loop(now) {
    raf = 0;
    if (!running()) return;
    raf = requestAnimationFrame(loop);
    const gap = level >= 2 ? 31 : 15;                   // at most 60 pictures a second; 30 when it must
    if (now - lastDraw < gap) return;
    const dt = lastDraw ? (now - lastDraw) / 1000 : STEP;
    lastDraw = now;
    const t0 = performance.now();
    if (fineQ && fineQ.matches && pt && now - pt > 700 && !gone && openness(px, py) === 1) sim.setLure(px, py); else sim.clearLure();
    sim.advance(dt);
    paint(sim.acc / STEP);
    const work = performance.now() - t0;
    stat.work[stat.frames++ % stat.work.length] = work;
    if (now < settle) return;
    if (work > BUDGET) { slow++; fast = 0; } else if (work < BUDGET * 0.3) { fast++; slow = Math.max(0, slow - 1); } else slow = Math.max(0, slow - 1);
    if (slow > 40 && level < 5) setLevel(level + 1);
    else if (fast > 600 && level > 0) setLevel(level - 1);
  }
  function setLevel(to) {
    const from = level;
    level = to; slow = 0; fast = 0; stat.level = to;
    if (!((from === 1 && to === 2) || (from === 2 && to === 1))) sizeUp();
  }
  function start() { if (!raf && running()) { lastDraw = 0; raf = requestAnimationFrame(loop); } }
  function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; }
  function still() { stop(); if (sim) paint(1); }
  function show() {
    const on = playing();
    btn.setAttribute('aria-pressed', String(!on));
    btn.title = on ? 'Pause the koi pond. A click on open water feeds them.' : 'Play the koi pond';
    if (on) start(); else still();
  }
  btn.addEventListener('animationend', () => btn.classList.remove('pulse'));
  btn.addEventListener('click', () => {
    btn.classList.remove('pulse'); void btn.offsetWidth; btn.classList.add('pulse');
    choice = playing() ? 'paused' : (motionQ && motionQ.matches ? 'playing' : null);
    try { if (choice) window.localStorage.setItem(KEY, choice); else window.localStorage.removeItem(KEY); } catch (e) { /* this page only */ }
    show();
  });
  if (motionQ) { const f = () => show(); if (motionQ.addEventListener) motionQ.addEventListener('change', f); else if (motionQ.addListener) motionQ.addListener(f); }
  const fineQ = window.matchMedia ? window.matchMedia('(hover: hover) and (pointer: fine)') : null;
  let px = 0, py = 0, pt = 0, gone = true;
  doc.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    const now = performance.now(), d = Math.hypot(e.clientX - px, e.clientY - py), dt = now - pt;
    px = e.clientX; py = e.clientY; pt = now; gone = false;
    if (sim && raf && dt > 0 && dt < 100 && d / dt > 1.2) sim.flick(px, py);
  }, { passive: true });
  doc.addEventListener('pointerout', (e) => { if (!e.relatedTarget) gone = true; }, { passive: true });
  doc.addEventListener('click', (e) => {
    if (!sim || !playing() || e.button !== 0 || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    const tg = e.target;
    if (!(tg instanceof Element) || tg.closest('a,button,input,select,textarea,label,summary,[tabindex],[role],' + COVER + ',p,h1,h2,h3,h4,li,dt,dd,figure,svg,.site-head')) return;
    const sel = window.getSelection && window.getSelection();
    if (sel && !sel.isCollapsed) return;
    if (openness(e.clientX, e.clientY) < 1) return;
    sim.touch(e.clientX, e.clientY);
  });
  const redraw = () => { if (sim) { P.atlas(); paint(raf ? sim.acc / STEP : 1); } };
  const retheme = () => { readColors(); redraw(); };
  new MutationObserver(retheme).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  const schemeQ = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)');
  if (schemeQ && schemeQ.addEventListener) schemeQ.addEventListener('change', retheme);
  let tMap = 0, tSize = 0;
  const later = (fn, ms) => () => { clearTimeout(fn.t); fn.t = setTimeout(fn, ms); };
  const remap = () => { if (sim) { buildMap(); if (!raf) still(); } };
  const remapSoon = later(remap, 220);
  let lastY = window.scrollY;
  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    if (sim && raf && !(motionQ && motionQ.matches)) sim.shift(y - lastY);     // depth: only while it swims, never under reduced motion
    lastY = y;
    clearTimeout(tMap); tMap = setTimeout(() => { remap(); setTimeout(remap, 900); }, 260);
  }, { passive: true });
  let lastW = 0, lastH = 0;
  window.addEventListener('resize', () => {
    clearTimeout(tSize);
    tSize = setTimeout(() => { const w = root.clientWidth, h = canvas.clientHeight; if (w !== lastW || Math.abs(h - lastH) > 40) { lastW = w; lastH = h; sizeUp(); if (!raf) still(); } else remap(); }, 160);
  }, { passive: true });
  if ('ResizeObserver' in window) new ResizeObserver(remapSoon).observe(body);
  if ('IntersectionObserver' in window) new IntersectionObserver((es) => { seen = es[es.length - 1].isIntersecting; if (seen) start(); else stop(); }).observe(canvas);
  doc.addEventListener('visibilitychange', () => { if (doc.hidden) { stop(); save(); } else start(); });
  window.addEventListener('pagehide', save);
  readColors();
  sizeUp();
  lastW = root.clientWidth; lastH = canvas.clientHeight;
  paint(1);
  canvas.classList.add('on');
  if (restored) canvas.classList.add('now');
  show();
  if (doc.fonts && doc.fonts.load) doc.fonts.load('500 12px "IBM Plex Mono"').then(() => { buildMap(); redraw(); }, () => {});
  window.addEventListener('load', () => setTimeout(remap, 400));
}
window.KikaiPond = { Sim, LIMITS, TEXT_CAP, stats: () => {
  const n = Math.min(stat.frames, stat.work.length), w = Array.from(stat.work.slice(0, n)).sort((a, b) => a - b);
  const koi = stat.sim ? stat.sim.fish.map((f) => [Math.round(f.j[PIVOT * 2]), Math.round(f.j[PIVOT * 2 + 1]), +f.z.toFixed(2), f.variety, f.cs > 0 || f.escT > 0 ? 1 : 0]) : [];
  return { frames: stat.frames, level: stat.level, fish: stat.fish, cells: stat.cells, changed: stat.changed, food: stat.food, rings: stat.rings, koi, workAvg: n ? w.reduce((a, b) => a + b, 0) / n : 0, workP95: n ? w[Math.floor(n * 0.95)] : 0 };
} };
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
}
})();
