(() => {
'use strict';
const motionQ = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
let reduce = !!(motionQ && motionQ.matches);
let boards = [], replays = [];
function say(el, text) {
  const stage = el.querySelector('[data-power-on-stage]');
  if (!stage) return;
  if (el._rest === undefined) el._rest = stage.textContent;
  stage.textContent = text === null ? el._rest : text;
}
function rest(el) {
  (el._t || []).forEach(clearTimeout);
  el._t = [];
  el.classList.remove('s-led', 's-px', 's-vec', 'boot');
  say(el, null);
}
function play(el) {
  if (reduce || !el) return;
  rest(el);
  void el.getBoundingClientRect();                 // restart the LED animation from its first frame
  el.classList.add('s-led', 'boot');
  say(el, 'LED');
  el._t = [
    setTimeout(() => { el.classList.remove('s-led'); el.classList.add('s-px'); say(el, 'PIXEL'); }, 900),
    setTimeout(() => { el.classList.remove('s-px'); el.classList.add('s-vec'); say(el, 'VECTOR'); }, 1300),
    setTimeout(() => { el.classList.remove('s-vec', 'boot'); say(el, null); }, 2600)
  ];
}
function applyReduce() {
  replays.forEach((b) => { b.hidden = reduce; });
  if (reduce) boards.forEach(rest);
}
function init() {
  boards = Array.from(document.querySelectorAll('[data-power-on]'));
  replays = Array.from(document.querySelectorAll('[data-power-on-replay]'));
  replays.forEach((b) => b.addEventListener('click', () => play(document.getElementById(b.getAttribute('aria-controls')))));
  applyReduce();
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      setTimeout(() => play(e.target), 250);
    }), { threshold: 0.35 });
    boards.forEach((b) => io.observe(b));
  } else {
    boards.forEach((b) => setTimeout(() => play(b), 300));
  }
}
if (motionQ) {
  const onChange = (e) => { reduce = e.matches; applyReduce(); };
  if (motionQ.addEventListener) motionQ.addEventListener('change', onChange); else if (motionQ.addListener) motionQ.addListener(onChange);
}
window.KikaiPowerOn = { play };
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
})();
