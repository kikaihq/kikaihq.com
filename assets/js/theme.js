(function () {
  'use strict';
  var KEY = 'kikai-theme';
  var GROUND = { dark: '#111317', light: '#E4DFD0' };   /* tokens.css --bg, ink and paper */
  var root = document.documentElement;
  root.classList.add('js');
  var saved = null;
  try { saved = window.localStorage.getItem(KEY); } catch (e) { saved = null; }
  if (saved === 'light' || saved === 'dark') root.setAttribute('data-theme', saved);
  var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null;
  function current() {
    var t = root.getAttribute('data-theme');
    return t === 'light' || t === 'dark' ? t : (mq && mq.matches ? 'light' : 'dark');
  }
  function label(btn) {
    var text = current() === 'dark' ? 'Switch to the paper theme' : 'Switch to the ink theme';
    btn.setAttribute('aria-label', text);
    btn.setAttribute('title', text);
  }
  function themeColor() {
    var t = root.getAttribute('data-theme');
    var metas = document.querySelectorAll('meta[name="theme-color"]');
    for (var i = 0; i < metas.length; i++) {
      var m = metas[i];
      if (!m.hasAttribute('data-os')) m.setAttribute('data-os', m.getAttribute('content') || '');
      m.setAttribute('content', GROUND[t] || m.getAttribute('data-os'));
    }
  }
  function bind() {
    var btns = Array.prototype.slice.call(document.querySelectorAll('[data-theme-toggle]'));
    themeColor();
    btns.forEach(function (btn) {
      label(btn);
      btn.addEventListener('click', function () {
        var next = current() === 'dark' ? 'light' : 'dark';
        function apply() {
          root.setAttribute('data-theme', next);
          try { window.localStorage.setItem(KEY, next); } catch (e) { /* switches for this page anyway */ }
          btns.forEach(label);
          themeColor();
        }
        var calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (calm || !document.startViewTransition) { apply(); return; }
        var r = btn.getBoundingClientRect();
        var x = r.left + r.width / 2, y = r.top + r.height / 2;
        var w = window.innerWidth, h = window.innerHeight;
        root.style.setProperty('--vt-x', Math.round(x) + 'px');
        root.style.setProperty('--vt-y', Math.round(y) + 'px');
        root.style.setProperty('--vt-r', Math.ceil(Math.sqrt(Math.pow(Math.max(x, w - x), 2) + Math.pow(Math.max(y, h - y), 2))) + 'px');
        root.classList.add('vt-theme');
        var t = document.startViewTransition(apply);
        var done = function () { root.classList.remove('vt-theme'); };
        t.finished.then(done, done);
      });
    });
    if (mq && mq.addEventListener) mq.addEventListener('change', function () { btns.forEach(label); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})();
