(() => {
'use strict';
const root = document.documentElement;
const motionQ = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
const fineQ = window.matchMedia ? window.matchMedia('(hover: hover) and (pointer: fine)') : null;
const calm = () => !!(motionQ && motionQ.matches);
const GROUPS = '.cols,.halves,.works,.steps,.words,.facts,.contact-grid,.name-grid,.mark-grid,.files';
const STEP = 70;            // ms between two arrivals in the same batch
const MAX_STEPS = 6;        // the seventh and later arrive with the sixth
const SETTLE = 1400;        // ms after its start that an arrival is over (base.css: .75 s, the rule 1.2 s)
function targets() {
  const out = [];
  document.querySelectorAll('main .section').forEach((sec) => {
    Array.from(sec.children).forEach((kid) => {
      if (kid.matches(GROUPS) && kid.children.length > 1) out.push(...Array.from(kid.children));
      else out.push(kid);
    });
  });
  document.querySelectorAll('main > .wrap > .founder').forEach((el) => out.push(el));
  return out.filter((el, i, all) => all.indexOf(el) === i && !el.closest('.hero, .page-hero, .studio-hero, .kq-hero, .game-hero'));
}
function settle(el) {
  el.classList.remove('rv', 'in');
  el.style.removeProperty('--rv-d');
}
function arrivals() {
  if (calm() || !('IntersectionObserver' in window)) return;
  const fold = window.innerHeight || document.documentElement.clientHeight;
  const waiting = targets().filter((el) => el.getBoundingClientRect().top > fold * 0.96);
  if (!waiting.length) return;
  const io = new IntersectionObserver((entries) => {
    const now = entries.filter((e) => e.isIntersecting).map((e) => e.target);
    now.sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
    now.forEach((el, k) => {
      io.unobserve(el);
      const d = Math.min(k, MAX_STEPS) * STEP;
      el.style.setProperty('--rv-d', d + 'ms');
      el.classList.add('in');
      setTimeout(() => settle(el), d + SETTLE);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  waiting.forEach((el) => { el.classList.add('rv'); io.observe(el); });
  if (motionQ) {
    const off = (e) => { if (e.matches) waiting.forEach((el) => { io.unobserve(el); settle(el); }); };
    if (motionQ.addEventListener) motionQ.addEventListener('change', off);
    else if (motionQ.addListener) motionQ.addListener(off);
  }
}
const TILT = '.plate, .kq-photo';
const MAX_TILT = 4;         // degrees, either way
let frame = 0, last = null;
function onMove(e) {
  last = e;
  if (!frame) frame = requestAnimationFrame(paint);
}
function paint() {
  frame = 0;
  const e = last;
  if (!e || !(e.target instanceof Element)) return;
  const card = e.target.closest('.card');
  if (card) {
    const r = card.getBoundingClientRect();
    card.style.setProperty('--mx', Math.round(e.clientX - r.left) + 'px');
    card.style.setProperty('--my', Math.round(e.clientY - r.top) + 'px');
  }
  const obj = e.target.closest(TILT);
  if (obj && !calm()) {
    const r = obj.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;   // 0..1
    obj.style.setProperty('--ry', ((x - 0.5) * 2 * MAX_TILT).toFixed(2) + 'deg');
    obj.style.setProperty('--rx', ((0.5 - y) * 2 * MAX_TILT).toFixed(2) + 'deg');
    obj.style.setProperty('--gx', Math.round(x * 100) + '%');
    obj.classList.add('tilting');
  }
}
function pointer() {
  if (!fineQ || !fineQ.matches) return;
  document.addEventListener('pointermove', onMove, { passive: true });
  document.querySelectorAll(TILT).forEach((el) => el.addEventListener('pointerleave', () => el.classList.remove('tilting')));
}
function init() { arrivals(); pointer(); }
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
})();
