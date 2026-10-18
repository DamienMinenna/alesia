/*!
 * deck.js — a small, dependency-free HTML slide engine.
 *
 * Works when index.html is opened straight from disk (file://) and from any
 * static host such as GitHub Pages: no server, no build step, no fetch().
 *
 * Content lives in index.html as <section class="slide"> elements inside
 * <div class="deck">. This file never needs editing to add a slide.
 *
 * Keys
 *   Next ........ →  PageDown  Space        Previous .. ←  PageUp  (Shift+Space)
 *   First/last .. Home / End                Jump ...... type a number, then Enter
 *   Pen ......... P   Highlighter .. H      Eraser .... E   Clear slide ink .. C
 *   Laser ....... L   Undo ink ..... Ctrl+Z
 *   Overview .... O   Fullscreen ... F (or F5)   Black / white screen .. B / W
 *   Speaker view  S   Help ......... ?      Esc ....... leave the current tool / overlay
 *   Quality ..... Q   (auto / high / medium / low animation quality, for slower computers)
 *
 * End of the talk: <section data-last> on one slide (e.g. the conclusion) → page numbers read "n/N" up to it
 * and the progress bar is full from it on; slides after it (back-up) show "n" only.
 *
 * Steps (build-ups)
 *   <li data-step>              appears on the next press (document order)
 *   <div data-step="3">         appears at step 3
 *   <div data-step="1" data-step-out="3">   visible for steps 1–2 only
 *   data-anim="fade|up|down|left|right|zoom|grow|highlight"   (CSS, see deck.css)
 *
 * Widgets (custom JavaScript inside a slide)
 *   <div data-widget="my-thing"></div>
 *   Deck.widget('my-thing', {
 *     steps: 3,                               // optional: presses this widget consumes
 *     mount(el, api) {                        // called once, at start-up
 *       return {
 *         enter(step) {}, leave() {},         // slide became visible / hidden
 *         step(step, dir) {},                 // dir: +1, -1 or 'jump'
 *         resize(scale) {}, print() {}        // optional
 *       };
 *     }
 *   });
 *
 * Variants (alternative versions of one slide, chosen with buttons on the slide)
 *   <button data-variant="a">A</button> <button data-variant="b">B</button>
 *   <span data-for-variant="a">shown for A only</span>   (several names: data-for-variant="a b")
 *   widgets receive variant(name); the first button is the default (or data-variant-default on the slide);
 *   the choice applies to every slide with the same version names; build steps are counted per version
 *   key V: next version (from any slide)
 *
 * Events: document.addEventListener('deck:enter' | 'deck:leave' | 'deck:step' | 'deck:variant', e => e.detail)
 */
(function () {
  'use strict';

  var Deck = (window.Deck = window.Deck || {});
  Deck.widgets = Deck.widgets || {};

  var S = {
    root: null, viewport: null, slides: [], index: 0, step: 0, started: false, ready: false,
    W: 1920, H: 1080, scale: 1,
    tool: null, penColor: '#E50019', hlColor: '#ffe14d', penWidth: 4,
    ink: {}, current: null, laserTrail: [], laserPos: null, laserRAF: 0,
    overview: null, ovSel: 0, help: null, blank: null,
    goto: '', gotoTimer: 0, idleTimer: 0,
    presenter: null, t0: Date.now()
  };
  Deck._state = S;

  /* ------------------------------------------------------------------ utils */
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function dpr() { return Math.min(window.devicePixelRatio || 1, 2); }
  function emit(name, detail, target) {
    var ev = new CustomEvent('deck:' + name, { detail: detail });
    (target || document).dispatchEvent(ev);
    if (target) document.dispatchEvent(new CustomEvent('deck:' + name, { detail: detail }));
  }

  var ICON = {
    prev: '<path d="M12.5 4.5 7 10l5.5 5.5"/>',
    next: '<path d="M7.5 4.5 13 10l-5.5 5.5"/>',
    pen: '<path d="M4 16l.9-3.6L13 4.3a1.6 1.6 0 0 1 2.3 0l.4.4a1.6 1.6 0 0 1 0 2.3L7.6 15.1z"/><path d="M11.5 5.8l2.7 2.7"/>',
    highlighter: '<path d="M6.5 13.5 13.8 6.2l-2-2-7.3 7.3-.8 2.8z"/><path d="M3 17.5h7"/>',
    eraser: '<path d="M8 16.5h8.5"/><path d="M3.8 12.6l7.4-7.4a1.4 1.4 0 0 1 2 0l2.6 2.6a1.4 1.4 0 0 1 0 2L10 15.7H7z"/>',
    laser: '<circle cx="10" cy="10" r="2.6" fill="currentColor"/><path d="M10 2.5v2.4M10 15.1v2.4M2.5 10h2.4M15.1 10h2.4M4.7 4.7l1.7 1.7M13.6 13.6l1.7 1.7M15.3 4.7l-1.7 1.7M6.4 13.6l-1.7 1.7"/>',
    clear: '<path d="M4.5 6h11M8 6V4.3h4V6M6 6l.8 10h6.4L14 6"/>',
    overview: '<rect x="3.5" y="3.5" width="5" height="5" rx="1"/><rect x="11.5" y="3.5" width="5" height="5" rx="1"/><rect x="3.5" y="11.5" width="5" height="5" rx="1"/><rect x="11.5" y="11.5" width="5" height="5" rx="1"/>',
    fullscreen: '<path d="M3.5 7.5v-4h4M12.5 3.5h4v4M16.5 12.5v4h-4M7.5 16.5h-4v-4"/>',
    presenter: '<rect x="2.5" y="3.5" width="15" height="10" rx="1.5"/><path d="M7 17h6M10 13.5V17"/>',
    help: '<circle cx="10" cy="10" r="7"/><path d="M8 8a2 2 0 1 1 2.6 1.9c-.4.2-.6.5-.6 1v.6"/><circle cx="10" cy="14" r=".4" fill="currentColor"/>'
  };
  function icon(name) {
    return '<svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' + ICON[name] + '</svg>';
  }

  /* ------------------------------------------------------ quality / frames
   * One shared animation loop (Deck.ticker) drives every animated widget at the
   * same moments, so the browser composes at most `fps` frames per second.
   * Deck.quality picks the frame rate and canvas resolution: 'high', 'medium',
   * 'low', or 'auto' (default) which steps down by itself when the machine
   * cannot keep up. Key Q cycles the modes; ?quality=low in the URL forces one.
   */
  var LEVELS = [
    { name: 'high', fps: 30, kMax: 1.5, kMin: 0.7, slow: 1 },
    { name: 'medium', fps: 20, kMax: 1.1, kMin: 0.6, slow: 1.5 },
    { name: 'low', fps: 15, kMax: 0.85, kMin: 0.5, slow: 3 }
  ];
  var MODES = ['auto', 'high', 'medium', 'low'];
  function store(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* private mode */ } }
  function stored(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  var Q = Deck.quality = {
    mode: 'auto', level: 0, listeners: [],
    get name() { return LEVELS[this.level].name; },
    get fps() { return LEVELS[this.level].fps; },
    get kMax() { return LEVELS[this.level].kMax; },
    get kMin() { return LEVELS[this.level].kMin; },
    get slow() { return LEVELS[this.level].slow; },
    onChange: function (fn) { this.listeners.push(fn); },
    set: function (mode) { setQuality(mode, true); }
  };
  function applyLevel(level) {
    level = clamp(level | 0, 0, LEVELS.length - 1);
    var changed = level !== Q.level;
    Q.level = level;
    var de = document.documentElement;
    LEVELS.forEach(function (L, i) { de.classList.toggle('deck-q-' + L.name, i === level); });
    if (changed) {
      TK.settle = performance.now() + 1500;
      Q.listeners.forEach(function (fn) { try { fn(Q); } catch (e) { console.error(e); } });
    }
  }
  function setQuality(mode, user) {
    if (MODES.indexOf(mode) < 0) mode = 'auto';
    Q.mode = mode;
    if (user) {
      store('deck-quality', mode === 'auto' ? null : mode);
      if (mode === 'auto') store('deck-quality-auto', null);  // re-detect from scratch
    }
    applyLevel(mode === 'auto' ? (user ? 0 : +(stored('deck-quality-auto') || 0)) : MODES.indexOf(mode) - 1);
    TK.bad = 0; TK.w0 = 0;
  }
  function initQuality() {
    var m = location.search.match(/[?&]quality=(\w+)/);
    setQuality(m ? m[1] : (stored('deck-quality') || 'auto'), false);
    TK.settle = performance.now() + 3000;
  }

  var TK = { subs: [], raf: 0, ric: 0, idle: 0, last: 0, lastRaf: 0, w0: 0, n: 0, bad: 0, settle: 0 };
  var RIC = window.requestIdleCallback;
  // idle time left between frames (how busy the computer is), summed over the measurement window
  function idleLoop(d) { TK.idle += d.timeRemaining(); TK.ric = TK.raf ? RIC(idleLoop) : 0; }
  Deck.ticker = {
    /** fn(now) is called at the deck frame rate while subscribed */
    add: function (fn) {
      if (TK.subs.indexOf(fn) < 0) TK.subs.push(fn);
      if (!TK.raf) { TK.w0 = 0; TK.raf = requestAnimationFrame(tickLoop); }
      if (RIC && !TK.ric) TK.ric = RIC(idleLoop);
    },
    remove: function (fn) {
      var i = TK.subs.indexOf(fn);
      if (i >= 0) TK.subs.splice(i, 1);
      if (!TK.subs.length && TK.raf) { cancelAnimationFrame(TK.raf); TK.raf = 0; }
    }
  };
  function tickLoop(now) {
    TK.raf = requestAnimationFrame(tickLoop);
    if (now - TK.lastRaf > 400) TK.w0 = 0;        // tab hidden or a long stall: restart the measurement
    TK.lastRaf = now;
    if (now - TK.last < 1000 / Q.fps - 4) return;
    TK.last = now;
    var list = TK.subs.slice();
    for (var i = 0; i < list.length; i++) {
      try { list[i](now); } catch (e) { console.error('[deck] ticker', e); Deck.ticker.remove(list[i]); }
    }
    governor(now);
  }
  // auto quality: if, for ~6 s, the frame rate stays clearly below the target or the computer has
  // almost no idle time left (it is working flat out to keep up), step down one level
  function governor(now) {
    if (Q.mode !== 'auto' || Q.level >= LEVELS.length - 1) return;
    if (now < TK.settle || !TK.w0 || document.hidden) { TK.w0 = now; TK.n = 0; TK.idle = 0; return; }
    TK.n++;
    var span = now - TK.w0;
    if (span < 3000) return;
    var rate = TK.n * 1000 / span, idle = RIC ? TK.idle / span : 1;
    TK.bad = rate < 0.75 * Q.fps || idle < 0.25 ? TK.bad + 1 : 0;
    Q.last = { fps: Math.round(rate), idle: Math.round(idle * 100) };
    TK.w0 = now; TK.n = 0; TK.idle = 0;
    if (TK.bad >= 2) {
      TK.bad = 0;
      store('deck-quality-auto', String(Q.level + 1));
      applyLevel(Q.level + 1);
    }
  }

  function toast(msg) {
    if (!S.toastEl) { S.toastEl = el('div', 'deck-goto deck-toast'); document.body.appendChild(S.toastEl); }
    S.toastEl.textContent = msg;
    S.toastEl.classList.add('show');
    clearTimeout(S.toastTimer);
    S.toastTimer = setTimeout(function () { S.toastEl.classList.remove('show'); }, 2200);
  }
  function cycleQuality() {
    setQuality(MODES[(MODES.indexOf(Q.mode) + 1) % MODES.length], true);
    toast('Quality: ' + Q.mode + (Q.mode === 'auto' ? ' (' + Q.name + ' for now)' : '') + '  ·  Q to change');
  }

  /* SVG <animateMotion> dots are replaced by JS on the shared ticker, so they
     move at the deck frame rate (SMIL would force 60 frames per second). */
  function prepareMotion(slide) {
    var list = slide._motion || [];
    $$('animateMotion', slide).forEach(function (am) {
      var dot = am.parentNode, d = am.getAttribute('path');
      if (!d || !dot) return;
      var p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('d', d);
      var L = p.getTotalLength(), n = Math.max(2, Math.min(400, Math.ceil(L / 3))), pts = new Float32Array(2 * (n + 1));
      for (var k = 0; k <= n; k++) { var q = p.getPointAtLength(L * k / n); pts[2 * k] = q.x; pts[2 * k + 1] = q.y; }
      var dur = parseFloat(am.getAttribute('dur')) || 2, begin = parseFloat(am.getAttribute('begin')) || 0;
      list.push({ el: dot, pts: pts, n: n, dur: dur, off: -begin, last: '' });
      dot.removeChild(am);
      place(list[list.length - 1], 0);
    });
    if (!list.length) return;
    slide._motion = list;
    slide._motionFn = slide._motionFn || function (now) { list.forEach(function (m) { place(m, now / 1000); }); };
    function place(m, t) {
      var u = ((t + m.off) / m.dur) % 1, f = u * m.n, k = Math.min(m.n - 1, Math.floor(f)), a = f - k;
      var x = m.pts[2 * k] + (m.pts[2 * k + 2] - m.pts[2 * k]) * a, y = m.pts[2 * k + 1] + (m.pts[2 * k + 3] - m.pts[2 * k + 1]) * a;
      var v = 'translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ')';
      if (v !== m.last) { m.last = v; m.el.setAttribute('transform', v); }
    }
  }
  function motion(slide, run) {
    if (!slide._motionFn) return;
    if (run) Deck.ticker.add(slide._motionFn); else Deck.ticker.remove(slide._motionFn);
  }

  /* -------------------------------------------------------------- variants
   * One choice for the whole deck: picking "ECRIS" on one slide switches every slide that has an
   * "ecris" version. Each version has its own build steps, widgets and videos; the choice is kept
   * when the page is reloaded in the same tab. */
  function variantOff(node) { return !!(node.closest && node.closest('.deck-variant-off')); }
  function variantNames(slide) { return $$('[data-variant]', slide).map(function (b) { return b.getAttribute('data-variant'); }); }
  function setVariant(slide, name, synced) {
    if (variantNames(slide).indexOf(name) < 0) return;
    var active = S.started && slide === S.slides[S.index];
    var shown = function (list) { return list.filter(function (n) { return !variantOff(n); }); };
    var wBefore = shown(slide._widgets || []), mBefore = shown($$('video, audio', slide));
    slide._variant = name;
    slide.setAttribute('data-variant-current', name);
    $$('[data-variant]', slide).forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-variant') === name); });
    $$('[data-for-variant]', slide).forEach(function (e) {
      e.classList.toggle('deck-variant-off', e.getAttribute('data-for-variant').split(/[\s,]+/).indexOf(name) < 0);
    });
    callWidgets(slide, 'variant', name);
    if (S.ready) collectSteps(slide);
    if (active) {
      var wAfter = shown(slide._widgets || []), st = Math.min(S.step, slide._steps);
      wBefore.forEach(function (n) { if (wAfter.indexOf(n) < 0) callOne(n, 'leave'); });
      S.step = st; applySteps(slide, st);
      wAfter.forEach(function (n) { if (wBefore.indexOf(n) < 0) { callOne(n, 'enter', st); callOne(n, 'step', st, 'jump'); } });
      mBefore.forEach(function (m) { if (variantOff(m)) try { m.pause(); } catch (e) { /* ignore */ } });
      $$('video[data-autoplay], audio[data-autoplay]', slide).forEach(function (m) { if (!variantOff(m) && mBefore.indexOf(m) < 0) playMedia(m); });
      afterChange();
    }
    emit('variant', { slide: slide, index: S.slides.indexOf(slide), variant: name }, slide);
    if (!synced) {
      try { sessionStorage.setItem('deck-variant', name); } catch (e) { /* ignore */ }
      S.slides.forEach(function (o) { if (o !== slide && o._variant !== name) setVariant(o, name, true); });
    }
  }
  function initVariants(slide) {
    var btns = $$('[data-variant]', slide);
    if (!btns.length) return;
    btns.forEach(function (b) {
      b.addEventListener('click', function (e) { e.stopPropagation(); setVariant(slide, b.getAttribute('data-variant')); b.blur(); });
    });
    var keep = null;
    try { keep = sessionStorage.getItem('deck-variant'); } catch (e) { /* ignore */ }
    var names = variantNames(slide);
    setVariant(slide, names.indexOf(keep) >= 0 ? keep : (slide.getAttribute('data-variant-default') || names[0]), true);
  }
  /* V key: next version (on this slide, or on the deck's first slide with versions), shown in a toast */
  function cycleVariant() {
    var cur = S.slides[S.index];
    var src = variantNames(cur).length ? cur : S.slides.filter(function (o) { return variantNames(o).length; })[0];
    if (!src) return;
    var names = variantNames(src), now = src._variant || names[0];
    var nxt = names[(names.indexOf(now) + 1) % names.length];
    setVariant(src, nxt);
    var b = $('[data-variant="' + nxt + '"]', src), lab = $('.vs-label', src);
    toast((lab ? lab.textContent.trim() + ' ' : 'Version: ') + (b ? b.textContent.trim() : nxt) + '  ·  V to change');
  }
  /** Deck.variant(name) — switch every slide that has this version, e.g. Deck.variant('ecris') */
  Deck.variant = function (name) {
    var sl = S.slides.filter(function (o) { return variantNames(o).indexOf(name) >= 0; })[0];
    if (sl) setVariant(sl, name);
  };

  /* --------------------------------------------------------------- widgets */
  Deck.widget = function (name, def) {
    Deck.widgets[name] = def;
    if (!S.ready) return;
    $$('[data-widget="' + name + '"]', S.root).forEach(mountWidget);
    S.slides.forEach(prepareMotion);
    S.slides.forEach(collectSteps);
    var cur = S.slides[S.index];
    if (cur && cur.querySelector('[data-widget="' + name + '"]')) {
      callWidgets(cur, 'enter', S.step);
      callWidgets(cur, 'step', S.step, 'jump');
    }
  };

  function mountWidget(node) {
    if (node._deckWidget) return;
    var def = Deck.widgets[node.getAttribute('data-widget')];
    if (!def) return;
    var slide = node.closest('.slide');
    var api = {
      deck: Deck, slide: slide, el: node,
      get scale() { return S.scale; },
      get dpr() { return dpr(); },
      get active() { return slide.classList.contains('active'); },
      get printing() { return document.body.classList.contains('deck-printing'); }
    };
    var inst = {};
    try { inst = (def.mount && def.mount(node, api)) || {}; }
    catch (err) { console.error('[deck] widget "' + node.getAttribute('data-widget') + '" failed to mount', err); }
    node._deckWidget = inst;
    (slide._widgets = slide._widgets || []).push(node);
  }

  function widgetSteps(node) {
    var def = Deck.widgets[node.getAttribute('data-widget')];
    var n = node.hasAttribute('data-steps') ? +node.getAttribute('data-steps') : 0;
    if (def && def.steps != null) n = Math.max(n, typeof def.steps === 'function' ? def.steps(node) : def.steps);
    return n || 0;
  }

  function callWidgets(slide, method) {
    var args = Array.prototype.slice.call(arguments, 2);
    (slide._widgets || []).forEach(function (node) {
      if (method !== 'variant' && variantOff(node)) return; // widgets of the version not shown stay asleep
      callOne.apply(null, [node, method].concat(args));
    });
  }
  function callOne(node, method) {
    var inst = node._deckWidget, args = Array.prototype.slice.call(arguments, 2);
    if (inst && typeof inst[method] === 'function') {
      try { inst[method].apply(inst, args); }
      catch (err) { console.error('[deck] widget ' + method + '()', err); }
    }
  }

  /* ----------------------------------------------------------------- steps */
  function collectSteps(slide) {
    var auto = 0, max = 0;
    var els = $$('[data-step]', slide).filter(function (e) { return e.closest('.slide') === slide && !variantOff(e); });
    els.forEach(function (e) {
      var v = e.getAttribute('data-step');
      var n = (v === '' || v === 'auto') ? ++auto : parseInt(v, 10);
      if (!(v === '' || v === 'auto')) auto = Math.max(auto, n);
      e._step = n;
      e._stepOut = e.hasAttribute('data-step-out') ? parseInt(e.getAttribute('data-step-out'), 10) : 0;
      e.classList.add('step');
      max = Math.max(max, n, e._stepOut ? e._stepOut : 0);
    });
    $$('[data-widget]', slide).forEach(function (w) { if (!variantOff(w)) max = Math.max(max, widgetSteps(w)); });
    if (slide.hasAttribute('data-steps')) max = Math.max(max, +slide.getAttribute('data-steps'));
    slide._stepEls = els;
    slide._steps = max;
  }

  function applySteps(slide, k) {
    (slide._stepEls || []).forEach(function (e) {
      var vis = k >= e._step && !(e._stepOut && k >= e._stepOut);
      e.classList.toggle('step-visible', vis);
      e.classList.toggle('step-current', k === e._step);
    });
    slide.setAttribute('data-current-step', k);
  }

  /* ------------------------------------------------------------ navigation */
  function go(i, s, opts) {
    opts = opts || {};
    var n = S.slides.length;
    if (!n) return;
    i = clamp(i | 0, 0, n - 1);
    var target = S.slides[i];
    if (s === 'last') s = target._steps;
    s = clamp(s | 0, 0, target._steps);
    var prevIndex = S.index, prev = S.slides[prevIndex];

    if (i !== prevIndex || !S.started) {
      if (S.started && prev) {
        prev.classList.remove('active');
        callWidgets(prev, 'leave');
        mediaLeave(prev);
        emit('leave', { slide: prev, index: prevIndex }, prev);
      }
      if (opts.instant || !S.started) {
        S.root.classList.add('deck-instant');
        requestAnimationFrame(function () { requestAnimationFrame(function () { S.root.classList.remove('deck-instant'); }); });
      }
      S.slides.forEach(function (sl, k) {
        sl.classList.toggle('past', k < i);
        sl.classList.toggle('future', k > i);
      });
      S.index = i; S.step = s;
      applySteps(target, s);
      target.classList.add('active');
      callWidgets(target, 'enter', s);
      callWidgets(target, 'step', s, 'jump');
      mediaEnter(target);
      emit('enter', { slide: target, index: i, step: s }, target);
    } else if (s !== S.step) {
      var dir = s > S.step ? 1 : -1;
      S.step = s;
      applySteps(target, s);
      callWidgets(target, 'step', s, dir);
      emit('step', { slide: target, index: i, step: s, dir: dir }, target);
    }
    S.started = true;
    afterChange();
  }

  function next() {
    var cur = S.slides[S.index];
    if (S.step < cur._steps) go(S.index, S.step + 1);
    else if (S.index < S.slides.length - 1) go(S.index + 1, 0);
  }
  function prev() {
    if (S.step > 0) go(S.index, S.step - 1);
    else if (S.index > 0) go(S.index - 1, 'last');
  }
  Deck.next = next;
  Deck.prev = prev;
  /** Deck.go(slideNumber, step) — slide numbers start at 1, like the footer. */
  Deck.go = function (num, step) { go((num | 0) - 1, step || 0); };
  Object.defineProperty(Deck, 'index', { get: function () { return S.index; } });
  Object.defineProperty(Deck, 'step', { get: function () { return S.step; } });
  Object.defineProperty(Deck, 'slides', { get: function () { return S.slides; } });
  Object.defineProperty(Deck, 'scale', { get: function () { return S.scale; } });
  Deck.on = function (name, fn) { document.addEventListener('deck:' + name, function (e) { fn(e.detail); }); };

  function svgAnimations(slide, run) {
    $$('svg', slide).forEach(function (s) {
      if (s.ownerSVGElement) return; // only outermost <svg> elements own a timeline
      try { if (run) s.unpauseAnimations(); else s.pauseAnimations(); } catch (e) { /* ignore */ }
    });
  }
  function mediaEnter(slide) {
    svgAnimations(slide, true);
    motion(slide, true);
    TK.settle = Math.max(TK.settle, performance.now() + 2000);
    predecode(S.slides[S.index + 1]);
    $$('video[data-autoplay], audio[data-autoplay]', slide).forEach(function (m) { if (!variantOff(m)) playMedia(m); });
    $$('img[data-restart]', slide).forEach(function (img) { var src = img.getAttribute('src'); img.setAttribute('src', ''); img.setAttribute('src', src); });
  }
  // decode the next slide's pictures while the current one is shown: no hiccup when moving on
  function predecode(slide) {
    if (!slide || slide._decoded) return;
    slide._decoded = true;
    var run = function () { $$('img', slide).forEach(function (im) { if (im.decode) im.decode().catch(function () {}); }); };
    if (window.requestIdleCallback) requestIdleCallback(run, { timeout: 1500 }); else setTimeout(run, 400);
  }
  function playMedia(m) {
    try { m.currentTime = 0; var pr = m.play(); if (pr && pr.catch) pr.catch(function () { /* autoplay refused or no playable source */ }); } catch (e) { /* ignore */ }
  }
  function mediaLeave(slide) {
    svgAnimations(slide, false);
    motion(slide, false);
    $$('video, audio', slide).forEach(function (m) { try { m.pause(); } catch (e) { /* ignore */ } });
  }

  function afterChange() {
    writeHash();
    var n = S.slides.length;
    var cur = S.slides[S.index];
    var end = S.lastIndex != null ? S.lastIndex : n - 1; // the bar is full from the data-last slide on
    var frac = end > 0 ? (S.index + (cur._steps ? S.step / (cur._steps + 1) : 0)) / end : 1;
    S.progress.style.transform = 'scaleX(' + clamp(frac, 0, 1) + ')';
    S.root.setAttribute('data-slide', S.index + 1);
    document.body.classList.toggle('deck-on-first', S.index === 0);
    if (S.counter) S.counter.textContent = (S.index + 1) + ' / ' + n;
    redrawInk();
    updatePresenter();
    if (S.overview) highlightOverview(S.index);
  }

  /* ------------------------------------------------------------------ hash */
  function writeHash() {
    var h = '#/' + (S.index + 1) + (S.step ? '/' + S.step : '');
    if (location.hash === h) return;
    try { history.replaceState(null, '', h); } catch (e) { location.hash = h; }
  }
  function readHash() {
    var m = location.hash.match(/^#\/?(\d+)(?:\/(\d+))?$/);
    if (m) return [parseInt(m[1], 10) - 1, parseInt(m[2] || '0', 10)];
    var id = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
    if (id) {
      for (var k = 0; k < S.slides.length; k++) if (S.slides[k].id === id) return [k, 0];
    }
    return null;
  }

  /* ---------------------------------------------------------------- layout */
  function layout() {
    var vw = window.innerWidth, vh = window.innerHeight;
    var s = Math.min(vw / S.W, vh / S.H);
    S.scale = s;
    var x = (vw - S.W * s) / 2, y = (vh - S.H * s) / 2;
    S.root.style.transform = 'translate(' + x + 'px,' + y + 'px) scale(' + s + ')';
    sizeOverlays();
    redrawInk();
    S.slides.forEach(function (sl) { callWidgets(sl, 'resize', s); });
  }

  /* -------------------------------------------------------------- keyboard */
  function onKey(e) {
    var t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    if (e.metaKey || e.altKey) return;
    var k = e.key;

    if (e.ctrlKey) {
      if (k === 'z' || k === 'Z') { undoInk(); e.preventDefault(); }
      return;
    }
    if (S.overview && overviewKey(e)) return;
    if (S.help && k !== '?') { if (k === 'Escape' || k === 'Enter' || k === ' ') { toggleHelp(false); e.preventDefault(); } return; }

    var handled = true;
    switch (k) {
      case 'ArrowRight': case 'PageDown': case 'Spacebar': case ' ':
        if (S.blank) toggleBlank(null);
        if (e.shiftKey && (k === ' ' || k === 'Spacebar')) prev(); else next();
        break;
      case 'ArrowLeft': case 'PageUp':
        if (S.blank) toggleBlank(null);
        prev(); break;
      case 'Home': go(0, 0); break;
      case 'End': go(S.slides.length - 1, 'last'); break;
      case 'p': case 'P': setTool('pen'); break;
      case 'h': case 'H': setTool('highlighter'); break;
      case 'e': case 'E': setTool('eraser'); break;
      case 'l': case 'L': setTool('laser'); break;
      case 'c': case 'C': clearInk(); break;
      case 'o': case 'O': toggleOverview(); break;
      case 'f': case 'F': case 'F5': toggleFullscreen(); break;
      case 'b': case 'B': case '.': toggleBlank('black'); break;
      case 'w': case 'W': toggleBlank('white'); break;
      case 's': case 'S': openPresenter(); break;
      case 'q': case 'Q': cycleQuality(); break;
      case 'v': case 'V': cycleVariant(); break;
      case '?': toggleHelp(); break;
      case 'Escape':
        if (S.blank) toggleBlank(null);
        else if (S.tool) setTool(null);
        else if (S.goto) clearGoto();
        else handled = false;
        break;
      case 'Enter':
        if (S.goto) { var num = parseInt(S.goto, 10); clearGoto(); go(num - 1, 0); }
        else handled = false;
        break;
      case 'Backspace':
        if (S.goto) { S.goto = S.goto.slice(0, -1); showGoto(); } else handled = false;
        break;
      default:
        if (/^[0-9]$/.test(k)) { S.goto += k; showGoto(); }
        else handled = false;
    }
    if (handled) { e.preventDefault(); e.stopPropagation(); }
  }

  function showGoto() {
    S.gotoBox.textContent = S.goto ? 'Go to slide ' + S.goto + ' ↵' : '';
    S.gotoBox.classList.toggle('show', !!S.goto);
    clearTimeout(S.gotoTimer);
    S.gotoTimer = setTimeout(clearGoto, 2500);
  }
  function clearGoto() { S.goto = ''; S.gotoBox.classList.remove('show'); }

  /* ----------------------------------------------------------------- tools */
  function setTool(tool) {
    if (S.tool === tool) tool = null;
    S.tool = tool;
    document.body.setAttribute('data-deck-tool', tool || '');
    S.inkCanvas.style.pointerEvents = (tool === 'pen' || tool === 'highlighter' || tool === 'eraser') ? 'auto' : 'none';
    $$('.deck-toolbar [data-tool]').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-tool') === tool); });
    renderSwatches();
    sizeOverlays();
    if (tool === 'laser') startLaser(); else stopLaser();
    showToolbar();
  }
  Deck.setTool = setTool;

  function stagePoint(e) {
    var r = S.root.getBoundingClientRect();
    return [(e.clientX - r.left) / S.scale, (e.clientY - r.top) / S.scale];
  }

  function inkFor(i) { return (S.ink[i] = S.ink[i] || []); }

  function onInkDown(e) {
    if (!S.tool || S.tool === 'laser') return;
    e.preventDefault();
    S.inkCanvas.setPointerCapture(e.pointerId);
    var p = stagePoint(e);
    if (S.tool === 'eraser') { S.erasing = true; eraseAt(p); return; }
    var hl = S.tool === 'highlighter';
    S.current = { tool: S.tool, color: hl ? S.hlColor : S.penColor, width: hl ? 26 : S.penWidth, pts: [p[0], p[1]] };
    inkFor(S.index).push(S.current);
    redrawInk();
  }
  function onInkMove(e) {
    if (S.erasing) { eraseAt(stagePoint(e)); return; }
    if (!S.current) return;
    var evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    if (!evs.length) evs = [e];
    for (var i = 0; i < evs.length; i++) {
      var p = stagePoint(evs[i]);
      var pts = S.current.pts, lx = pts[pts.length - 2], ly = pts[pts.length - 1];
      if ((p[0] - lx) * (p[0] - lx) + (p[1] - ly) * (p[1] - ly) > 2) pts.push(p[0], p[1]);
    }
    redrawInk();
  }
  function onInkUp() { S.current = null; S.erasing = false; }

  function eraseAt(p) {
    var list = inkFor(S.index), r2 = 22 * 22, changed = false;
    for (var i = list.length - 1; i >= 0; i--) {
      var pts = list[i].pts;
      for (var j = 0; j < pts.length; j += 2) {
        var dx = pts[j] - p[0], dy = pts[j + 1] - p[1];
        if (dx * dx + dy * dy < r2) { list.splice(i, 1); changed = true; break; }
      }
    }
    if (changed) redrawInk();
  }
  function clearInk() { S.ink[S.index] = []; redrawInk(); }
  function undoInk() { inkFor(S.index).pop(); redrawInk(); }

  // the pen/laser canvases are full-screen bitmaps: only keep them allocated while needed
  function sizeOverlays() {
    var need = function (c, on) {
      var w = on ? Math.round(S.W * S.scale * dpr()) : 1, h = on ? Math.round(S.H * S.scale * dpr()) : 1;
      if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    };
    var hasInk = !!(S.ink[S.index] && S.ink[S.index].length);
    need(S.inkCanvas, hasInk || S.tool === 'pen' || S.tool === 'highlighter' || S.tool === 'eraser');
    need(S.laserCanvas, S.tool === 'laser');
  }
  function redrawInk() {
    var c = S.inkCanvas;
    if (!c) return;
    sizeOverlays();
    var ctx = c.getContext('2d'), k = S.scale * dpr();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.setTransform(k, 0, 0, k, 0, 0);
    (S.ink[S.index] || []).forEach(function (st) { drawStroke(ctx, st); });
  }

  function drawStroke(ctx, st) {
    var p = st.pts;
    ctx.save();
    ctx.globalAlpha = st.tool === 'highlighter' ? 0.38 : 1;
    ctx.strokeStyle = st.color; ctx.fillStyle = st.color;
    ctx.lineWidth = st.width; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (p.length <= 2) {
      ctx.beginPath(); ctx.arc(p[0], p[1], st.width / 2, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.beginPath(); ctx.moveTo(p[0], p[1]);
      for (var i = 2; i < p.length - 2; i += 2) {
        ctx.quadraticCurveTo(p[i], p[i + 1], (p[i] + p[i + 2]) / 2, (p[i + 1] + p[i + 3]) / 2);
      }
      ctx.lineTo(p[p.length - 2], p[p.length - 1]);
      ctx.stroke();
    }
    ctx.restore();
  }

  /* laser pointer */
  function onPointerMoveGlobal(e) {
    if (S.tool === 'laser') {
      var p = stagePoint(e);
      S.laserPos = p;
      S.laserTrail.push({ x: p[0], y: p[1], t: performance.now() });
    }
    wake();
  }
  function startLaser() {
    if (S.laserRAF) return;
    var loop = function (now) {
      S.laserRAF = requestAnimationFrame(loop);
      drawLaser(now);
    };
    S.laserRAF = requestAnimationFrame(loop);
  }
  function stopLaser() {
    cancelAnimationFrame(S.laserRAF); S.laserRAF = 0;
    S.laserTrail = []; S.laserPos = null;
    var c = S.laserCanvas; c.getContext('2d').clearRect(0, 0, c.width, c.height);
  }
  function drawLaser(now) {
    var c = S.laserCanvas, ctx = c.getContext('2d'), k = S.scale * dpr();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    if (!S.laserPos) return;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    var life = 320, tr = S.laserTrail;
    while (tr.length && now - tr[0].t > life) tr.shift();
    ctx.lineCap = 'round';
    for (var i = 1; i < tr.length; i++) {
      var a = 1 - (now - tr[i].t) / life;
      ctx.strokeStyle = 'rgba(229,0,25,' + (0.55 * a * a) + ')';
      ctx.lineWidth = 2 + 9 * a;
      ctx.beginPath(); ctx.moveTo(tr[i - 1].x, tr[i - 1].y); ctx.lineTo(tr[i].x, tr[i].y); ctx.stroke();
    }
    var x = S.laserPos[0], y = S.laserPos[1];
    var g = ctx.createRadialGradient(x, y, 0, x, y, 30);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.16, 'rgba(255,60,80,1)');
    g.addColorStop(0.4, 'rgba(229,0,25,0.45)');
    g.addColorStop(1, 'rgba(229,0,25,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, 30, 0, Math.PI * 2); ctx.fill();
  }

  /* --------------------------------------------------------------- toolbar */
  var PEN_COLORS = ['#E50019', '#1f3a93', '#1d1d1f', '#16855a'];
  var HL_COLORS = ['#ffe14d', '#ffb3bd', '#9be7c4', '#a8c8ff'];

  function buildToolbar() {
    var tb = el('div', 'deck-toolbar');
    var btn = function (name, title, action, tool) {
      var b = el('button', 'deck-btn', icon(name));
      b.title = title; b.setAttribute('aria-label', title);
      if (tool) b.setAttribute('data-tool', tool);
      b.addEventListener('click', function (e) { e.stopPropagation(); action(); b.blur(); });
      return b;
    };
    tb.appendChild(btn('prev', 'Previous (←)', prev));
    tb.appendChild(btn('next', 'Next (→)', next));
    tb.appendChild(el('span', 'deck-sep'));
    tb.appendChild(btn('pen', 'Pen (P)', function () { setTool('pen'); }, 'pen'));
    tb.appendChild(btn('highlighter', 'Highlighter (H)', function () { setTool('highlighter'); }, 'highlighter'));
    tb.appendChild(btn('eraser', 'Eraser (E)', function () { setTool('eraser'); }, 'eraser'));
    tb.appendChild(btn('laser', 'Laser pointer (L)', function () { setTool('laser'); }, 'laser'));
    tb.appendChild(btn('clear', 'Clear drawings on this slide (C)', clearInk));
    S.swatches = el('span', 'deck-swatches');
    tb.appendChild(S.swatches);
    tb.appendChild(el('span', 'deck-sep'));
    tb.appendChild(btn('overview', 'Overview (O)', toggleOverview));
    tb.appendChild(btn('presenter', 'Speaker view (S)', openPresenter));
    tb.appendChild(btn('fullscreen', 'Fullscreen (F)', toggleFullscreen));
    tb.appendChild(btn('help', 'Keyboard shortcuts (?)', function () { toggleHelp(); }));
    S.counter = el('span', 'deck-counter');
    tb.appendChild(S.counter);
    tb.addEventListener('mouseenter', function () { S.tbHover = true; });
    tb.addEventListener('mouseleave', function () { S.tbHover = false; wake(); });
    document.body.appendChild(tb);
    S.toolbar = tb;
    renderSwatches();
  }

  function renderSwatches() {
    if (!S.swatches) return;
    var hl = S.tool === 'highlighter';
    var list = S.tool === 'pen' ? PEN_COLORS : hl ? HL_COLORS : [];
    S.swatches.innerHTML = '';
    list.forEach(function (c) {
      var b = el('button', 'deck-swatch');
      b.style.background = c;
      b.title = c;
      if ((hl ? S.hlColor : S.penColor) === c) b.classList.add('on');
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        if (hl) S.hlColor = c; else S.penColor = c;
        renderSwatches(); b.blur();
      });
      S.swatches.appendChild(b);
    });
    S.swatches.style.display = list.length ? '' : 'none';
  }

  function showToolbar() {
    if (!S.toolbar) return;
    S.toolbar.classList.add('show');
    S.counter.textContent = (S.index + 1) + ' / ' + S.slides.length;
  }
  function wake() {
    document.body.classList.remove('deck-idle');
    showToolbar();
    clearTimeout(S.idleTimer);
    S.idleTimer = setTimeout(function () {
      if (S.tbHover) return;
      S.toolbar.classList.remove('show');
      if (!S.tool) document.body.classList.add('deck-idle');
    }, 2600);
  }

  /* -------------------------------------------------------------- overview */
  function cloneSlide(slide, step, doc) {
    var c = doc && doc !== document ? doc.importNode(slide, true) : slide.cloneNode(true);
    c.classList.remove('past', 'future');
    c.classList.add('active', 'deck-clone');
    c.removeAttribute('id');
    $$('aside.notes', c).forEach(function (n) { n.remove(); });
    var orig = $$('.step', slide); // build-step numbers live on the original elements (not copied by cloneNode)
    $$('.step', c).forEach(function (e, k) {
      var o = orig[k] || e;
      var vis = step == null ? true : (step >= o._step && !(o._stepOut && step >= o._stepOut));
      e.classList.toggle('step-visible', vis);
    });
    // copy canvas pixels so animated widgets show their current frame
    var src = $$('canvas', slide), dst = $$('canvas', c);
    dst.forEach(function (d, k) {
      var sc = src[k];
      if (!sc || !sc.width) return;
      try { d.width = sc.width; d.height = sc.height; d.getContext('2d').drawImage(sc, 0, 0); } catch (e) { /* ignore */ }
    });
    return c;
  }
  Deck.cloneSlide = cloneSlide;

  function toggleOverview(force) {
    var open = force != null ? force : !S.overview;
    if (open && !S.overview) {
      var ov = el('div', 'deck-overview');
      var grid = el('div', 'deck-ov-grid');
      S.slides.forEach(function (sl, i) {
        var card = el('button', 'deck-ov-card');
        var frame = el('div', 'deck-ov-frame');
        frame.appendChild(cloneSlide(sl));
        var label = el('div', 'deck-ov-label');
        label.innerHTML = '<b>' + (i + 1) + '</b> ' + (sl.getAttribute('data-title') || (sl.querySelector('h1,h2') || {}).textContent || '');
        card.appendChild(frame); card.appendChild(label);
        card.addEventListener('click', function () { toggleOverview(false); go(i, 0); });
        card.addEventListener('mouseenter', function () { highlightOverview(i); });
        grid.appendChild(card);
      });
      ov.appendChild(grid);
      document.body.appendChild(ov);
      S.overview = ov;
      sizeOverview();
      highlightOverview(S.index);
      requestAnimationFrame(function () { ov.classList.add('show'); });
    } else if (!open && S.overview) {
      S.overview.remove();
      S.overview = null;
    }
  }
  function sizeOverview() {
    if (!S.overview) return;
    var cards = $$('.deck-ov-frame', S.overview);
    if (!cards.length) return;
    var w = cards[0].getBoundingClientRect().width;
    cards.forEach(function (f) { f.style.setProperty('--s', w / S.W); });
  }
  function highlightOverview(i) {
    S.ovSel = i;
    $$('.deck-ov-card', S.overview).forEach(function (c, k) {
      c.classList.toggle('sel', k === i);
      c.classList.toggle('current', k === S.index);
    });
    var sel = $$('.deck-ov-card', S.overview)[i];
    if (sel && sel.scrollIntoView) sel.scrollIntoView({ block: 'nearest' });
  }
  function overviewKey(e) {
    var k = e.key, n = S.slides.length;
    var cols = Math.max(1, Math.round(S.overview.querySelector('.deck-ov-grid').getBoundingClientRect().width /
      ($('.deck-ov-card', S.overview).getBoundingClientRect().width + 24)));
    var i = S.ovSel;
    if (k === 'ArrowRight') i++;
    else if (k === 'ArrowLeft') i--;
    else if (k === 'ArrowDown' || k === 'PageDown') i += cols;
    else if (k === 'ArrowUp' || k === 'PageUp') i -= cols;
    else if (k === 'Enter' || k === ' ') { toggleOverview(false); go(S.ovSel, 0); e.preventDefault(); return true; }
    else if (k === 'Escape' || k === 'o' || k === 'O') { toggleOverview(false); e.preventDefault(); return true; }
    else return false;
    highlightOverview(clamp(i, 0, n - 1));
    e.preventDefault();
    return true;
  }

  /* ------------------------------------------------------------ help/blank */
  function toggleHelp(force) {
    var open = force != null ? force : !S.help;
    if (open && !S.help) {
      var rows = [
        ['→ &nbsp; PageDown &nbsp; Space', 'Next step / slide'],
        ['← &nbsp; PageUp', 'Previous step / slide'],
        ['Home &nbsp; End', 'First / last slide'],
        ['<i>number</i> then Enter', 'Jump to a slide'],
        ['P &nbsp; H &nbsp; E', 'Pen · highlighter · eraser'],
        ['L', 'Laser pointer'],
        ['C &nbsp; Ctrl+Z', 'Clear slide ink · undo stroke'],
        ['O', 'Overview'],
        ['F', 'Fullscreen'],
        ['S', 'Speaker view (notes, timer)'],
        ['B &nbsp; W', 'Black / white screen'],
        ['V', 'Switch version (Case: superconducting magnet ↔ ECR ion source)'],
        ['Q', 'Animation quality: auto · high · medium · low (now ' + Q.mode + (Q.mode === 'auto' ? ', ' + Q.name : '') + ')'],
        ['Esc', 'Leave the current tool']
      ];
      var h = el('div', 'deck-help');
      h.innerHTML = '<div class="deck-help-card"><h3>Keyboard</h3><table>' +
        rows.map(function (r) { return '<tr><td><kbd>' + r[0] + '</kbd></td><td>' + r[1] + '</td></tr>'; }).join('') +
        '</table><p>Press <kbd>?</kbd> or <kbd>Esc</kbd> to close</p></div>';
      h.addEventListener('click', function () { toggleHelp(false); });
      document.body.appendChild(h);
      S.help = h;
    } else if (!open && S.help) {
      S.help.remove(); S.help = null;
    }
  }
  function toggleBlank(mode) {
    if (S.blank === mode || mode == null) { S.blank = null; S.blankEl.className = 'deck-blank'; return; }
    S.blank = mode;
    S.blankEl.className = 'deck-blank show ' + mode;
  }
  function toggleFullscreen() {
    var d = document, de = d.documentElement;
    var fs = d.fullscreenElement || d.webkitFullscreenElement;
    try {
      if (fs) (d.exitFullscreen || d.webkitExitFullscreen).call(d);
      else (de.requestFullscreen || de.webkitRequestFullscreen).call(de);
    } catch (e) { /* ignore */ }
  }

  /* --------------------------------------------------------- speaker view */
  function openPresenter() {
    var w = S.presenter;
    if (w && !w.closed) { w.focus(); return; }
    w = window.open('', 'deck-presenter', 'width=1280,height=800');
    if (!w) { alert('Allow pop-ups for this page to open the speaker view.'); return; }
    var links = $$('link[rel="stylesheet"]').map(function (l) { return '<link rel="stylesheet" href="' + l.href + '">'; }).join('') +
      $$('head style').map(function (st) { return '<style>' + st.textContent + '</style>'; }).join('');
    w.document.open();
    w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>Speaker view — ' +
      document.title + '</title><base href="' + location.href.replace(/#.*$/, '') + '">' + links +
      '</head><body class="deck-presenter-body"><div class="pv">' +
      '<header class="pv-head"><span class="pv-count"></span><span class="pv-timer" title="Click to reset">00:00</span><span class="pv-clock"></span></header>' +
      '<section class="pv-cur"><div class="pv-frame pv-frame-cur"></div></section>' +
      '<aside class="pv-side"><div class="pv-label">Next</div><div class="pv-frame pv-frame-next"></div>' +
      '<div class="pv-label">Notes</div><div class="pv-notes"></div></aside>' +
      '</div></body></html>');
    w.document.close();
    S.presenter = w;
    S.t0 = Date.now();
    w.addEventListener('keydown', onKey);
    w.document.querySelector('.pv-timer').addEventListener('click', function () { S.t0 = Date.now(); });
    w.addEventListener('resize', updatePresenter);
    var ticks = 0;
    var tick = function () {
      if (w.closed) return;
      var t = Math.floor((Date.now() - S.t0) / 1000);
      var mm = String(Math.floor(t / 60)).padStart(2, '0'), ss = String(t % 60).padStart(2, '0');
      w.document.querySelector('.pv-timer').textContent = mm + ':' + ss;
      w.document.querySelector('.pv-clock').textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      // animated widgets: refresh the live preview of the current slide every 2 s (the next one is static)
      if (++ticks % 4 === 0 && S.slides[S.index]._widgets) updatePresenter(true);
      w.setTimeout(tick, 500);
    };
    tick();
    setTimeout(updatePresenter, 60);
  }

  function updatePresenter(onlyCurrent) {
    var w = S.presenter;
    if (!w || w.closed) return;
    var d = w.document, cur = S.slides[S.index];
    if (onlyCurrent === true) { putFrame(d, '.pv-frame-cur', cur, S.step); return; }
    var put = function (sel, slide, step) { putFrame(d, sel, slide, step); };
    put('.pv-frame-cur', cur, S.step);
    if (S.step < cur._steps) put('.pv-frame-next', cur, S.step + 1);
    else put('.pv-frame-next', S.slides[S.index + 1], 0);
    var notes = cur.querySelector('aside.notes');
    d.querySelector('.pv-notes').innerHTML = notes ? notes.innerHTML : '<span class="pv-muted">No notes for this slide.</span>';
    d.querySelector('.pv-count').textContent = 'Slide ' + (S.index + 1) + ' / ' + S.slides.length +
      (cur._steps ? '  ·  step ' + S.step + ' / ' + cur._steps : '');
  }

  function putFrame(d, sel, slide, step) {
    var frame = d.querySelector(sel);
    if (!frame) return;
    frame.innerHTML = '';
    if (!slide) { frame.innerHTML = '<div class="pv-end">End of presentation</div>'; return; }
    frame.appendChild(cloneSlide(slide, step, d));
    frame.style.setProperty('--s', frame.getBoundingClientRect().width / S.W);
  }

  /* ----------------------------------------------------------------- touch */
  function bindTouch() {
    var x0 = null, y0 = null;
    S.viewport.addEventListener('touchstart', function (e) {
      if (S.tool || e.touches.length !== 1) return;
      x0 = e.touches[0].clientX; y0 = e.touches[0].clientY;
    }, { passive: true });
    S.viewport.addEventListener('touchend', function (e) {
      if (x0 == null) return;
      var dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
      x0 = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.3) { if (dx < 0) next(); else prev(); }
    }, { passive: true });
  }

  /* ----------------------------------------------------------------- print */
  function beforePrint() {
    document.body.classList.add('deck-printing');
    S.slides.forEach(function (sl) {
      (sl._stepEls || []).forEach(function (e) { e.classList.add('step-visible'); });
      callWidgets(sl, 'print');
    });
  }
  function afterPrint() {
    document.body.classList.remove('deck-printing');
    S.slides.forEach(function (sl, i) { applySteps(sl, i === S.index ? S.step : 0); });
    var cur = S.slides[S.index];
    S.slides.forEach(function (sl, i) { if (i !== S.index) callWidgets(sl, 'leave'); }); // stop animations started for printing
    callWidgets(cur, 'step', S.step, 'jump');
  }

  /* ------------------------------------------------------------------ init */
  function buildFooter(slide, i, cfg) {
    if (slide.getAttribute('data-chrome') === 'none' || slide.classList.contains('no-chrome')) return;
    var f = el('footer', 'slide-footer');
    if (cfg.logo) f.appendChild(Object.assign(el('img', 'slide-footer-logo'), { src: cfg.logo, alt: '' }));
    f.appendChild(el('span', 'slide-footer-text', cfg.text || ''));
    f.appendChild(el('span', 'slide-footer-date', cfg.date || ''));
    // "n/N" up to the slide marked data-last (the end of the talk), then just "n" for the back-up slides
    var last = S.lastIndex;
    f.appendChild(el('span', 'slide-footer-num', last != null && i <= last ? (i + 1) + '/' + (last + 1) : String(i + 1)));
    slide.appendChild(f);
  }

  function init() {
    if (S.ready) return;
    var root = $('.deck');
    if (!root) { console.warn('[deck] no .deck element found'); return; }
    S.root = root;
    S.W = +root.getAttribute('data-width') || 1920;
    S.H = +root.getAttribute('data-height') || 1080;
    root.style.width = S.W + 'px';
    root.style.height = S.H + 'px';

    // viewport wrapper
    var vp = el('div', 'deck-viewport');
    root.parentNode.insertBefore(vp, root);
    vp.appendChild(root);
    S.viewport = vp;
    document.body.classList.add('deck-body');

    S.slides = $$(':scope > section.slide, :scope > section', root);
    var cfg = {
      text: root.getAttribute('data-footer'),
      date: root.getAttribute('data-date'),
      logo: root.getAttribute('data-footer-logo')
    };
    S.lastIndex = null;
    S.slides.forEach(function (sl, i) { if (S.lastIndex == null && sl.hasAttribute('data-last')) S.lastIndex = i; });
    S.slides.forEach(function (sl, i) {
      sl.classList.add('slide');
      sl.setAttribute('data-index', i + 1);
      buildFooter(sl, i, cfg);
    });

    // maths (KaTeX auto-render, if loaded)
    if (window.renderMathInElement) {
      try {
        window.renderMathInElement(root, {
          delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '\\[', right: '\\]', display: true },
            { left: '\\(', right: '\\)', display: false },
            { left: '$', right: '$', display: false }
          ],
          ignoredClasses: ['no-math'],
          throwOnError: false
        });
      } catch (e) { console.warn('[deck] KaTeX', e); }
    }

    // overlays inside the stage (scaled with it)
    S.inkCanvas = el('canvas', 'deck-ink');
    S.laserCanvas = el('canvas', 'deck-laser');
    S.progress = el('div', 'deck-progress');
    root.appendChild(S.inkCanvas);
    root.appendChild(S.laserCanvas);
    root.appendChild(S.progress);
    S.inkCanvas.addEventListener('pointerdown', onInkDown);
    S.inkCanvas.addEventListener('pointermove', onInkMove);
    S.inkCanvas.addEventListener('pointerup', onInkUp);
    S.inkCanvas.addEventListener('pointercancel', onInkUp);

    S.blankEl = el('div', 'deck-blank');
    document.body.appendChild(S.blankEl);
    S.gotoBox = el('div', 'deck-goto');
    document.body.appendChild(S.gotoBox);
    buildToolbar();

    initQuality();
    // widgets, then steps (widgets may add steps)
    $$('[data-widget]', root).forEach(mountWidget);
    S.slides.forEach(prepareMotion);
    S.slides.forEach(initVariants);
    S.slides.forEach(collectSteps);
    S.slides.forEach(function (sl) { applySteps(sl, 0); });

    S.ready = true;
    layout();
    var h = readHash();
    go(h ? h[0] : 0, h ? h[1] : 0, { instant: true });
    S.slides.forEach(function (sl, i) { if (i !== S.index) svgAnimations(sl, false); });

    window.addEventListener('resize', function () { layout(); sizeOverview(); updatePresenter(); });
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('pointermove', onPointerMoveGlobal, { passive: true });
    window.addEventListener('pointerdown', wake, { passive: true });
    window.addEventListener('hashchange', function () {
      var hh = readHash();
      if (hh && (hh[0] !== S.index || hh[1] !== S.step)) go(hh[0], hh[1]);
    });
    window.addEventListener('beforeprint', beforePrint);
    window.addEventListener('afterprint', afterPrint);
    // keep keyboard focus on the deck after clicking widget buttons
    root.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('button');
      if (b) setTimeout(function () { b.blur(); }, 0);
    });
    bindTouch();
    wake();
    emit('ready', { deck: Deck });
  }

  Deck.init = init;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else setTimeout(init, 0);
})();
