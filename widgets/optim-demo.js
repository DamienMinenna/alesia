/*!
 * optim-demo.js — live, in-browser optimisers on the 2D Ackley function.
 * Illustration only (re-implemented in JavaScript, not ALESIA itself):
 * 16 generations × 20 individuals = 320 evaluations, as on the original slide.
 * Random, GA, DE, PSO and CMA-ES run live; BO and DNN (active learning) replay runs recorded
 * offline with Python (widgets/optim-runs.js, made by tools/make_optim_runs.py).
 *
 *   <div data-widget="optim-demo"></div>
 * Each key press switches algorithm: Random → GA → DE → PSO → CMA-ES → BO → DNN (6 steps).
 * The buttons can also be clicked; "↻" re-runs with a new random seed (next recorded run for BO / DNN).
 * Elements of the slide with data-od-show="pso bo" are shown only while one of these runs;
 * data-od-hl="…" are highlighted (dimmed otherwise).
 */
(function () {
  'use strict';
  if (!window.Deck) return;
  var TAU = Math.PI * 2, LO = -5, HI = 5, POP = 20, GEN = 16, FMAX = 14.5;
  var ALGOS = [
    { id: 'random', name: 'Random' },
    { id: 'ga', name: 'GA' },
    { id: 'de', name: 'DE' },
    { id: 'pso', name: 'PSO' },
    { id: 'cmaes', name: 'CMA-ES' },
    { id: 'bo', name: 'BO', recorded: true },
    { id: 'dnn', name: 'DNN', recorded: true }
  ];

  function ackley(x, y) {
    return -20 * Math.exp(-0.2 * Math.sqrt(0.5 * (x * x + y * y))) - Math.exp(0.5 * (Math.cos(TAU * x) + Math.cos(TAU * y))) + Math.E + 20;
  }
  function rng(seed) { // mulberry32
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function clampX(v) { return v < LO ? LO : v > HI ? HI : v; }

  /* --------------------------------------------------------- optimisers */
  function makeOptimiser(id, R, seed) {
    // recorded runs (Bayesian optimisation, neural-network active learning): replayed 20 points at a time
    var runs = (window.OPTIM_RUNS || {})[id];
    if (runs && runs.length) {
      var rec = runs[seed % runs.length], k = 0;
      var take = function () { var p = []; for (var i = 0; i < POP; i++, k++) p.push([rec[2 * k], rec[2 * k + 1]]); return p; };
      return { first: take, next: function () { return take(); } };
    }
    if (id === 'bo' || id === 'dnn') id = 'random'; // data file missing
    var gauss = function () { var u = 1 - R(), v = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v); };
    var uni = function () { return LO + (HI - LO) * R(); };
    var randPop = function () { var p = []; for (var i = 0; i < POP; i++) p.push([uni(), uni()]); return p; };
    var g = 0;
    if (id === 'random') return { first: randPop, next: function () { return randPop(); } };

    if (id === 'ga') {
      return {
        first: randPop,
        next: function (pop, f) {
          g++;
          var idx = pop.map(function (_, i) { return i; }).sort(function (a, b) { return f[a] - f[b]; });
          var pool = idx.slice(0, 10).map(function (i) { return pop[i]; });
          var out = [pop[idx[0]].slice(), pop[idx[1]].slice()];
          var sig = 1.2 * (1 - g / GEN) + 0.08;
          var pick = function () { var a = Math.floor(R() * 10), b = Math.floor(R() * 10); return pool[Math.min(a, b)]; };
          while (out.length < POP) {
            var p1 = pick(), p2 = pick();
            var c = [R() < 0.5 ? p1[0] : p2[0], R() < 0.5 ? p1[1] : p2[1]];
            if (R() < 0.45) c[0] = clampX(c[0] + sig * gauss());
            if (R() < 0.45) c[1] = clampX(c[1] + sig * gauss());
            out.push(c);
          }
          return out;
        }
      };
    }

    if (id === 'de') {
      var X = null, FX = null, trial = null;
      return {
        first: function () { X = randPop(); return X.map(function (p) { return p.slice(); }); },
        next: function (pop, f) {
          if (!FX) { FX = f.slice(); }
          else { for (var i = 0; i < POP; i++) if (f[i] < FX[i]) { X[i] = pop[i]; FX[i] = f[i]; } }
          trial = [];
          for (var j = 0; j < POP; j++) {
            var a, b, c;
            do { a = Math.floor(R() * POP); } while (a === j);
            do { b = Math.floor(R() * POP); } while (b === j || b === a);
            do { c = Math.floor(R() * POP); } while (c === j || c === a || c === b);
            var F = 0.6, jr = Math.floor(R() * 2), t = X[j].slice();
            for (var k = 0; k < 2; k++) if (R() < 0.8 || k === jr) t[k] = clampX(X[a][k] + F * (X[b][k] - X[c][k]));
            trial.push(t);
          }
          return trial;
        }
      };
    }

    if (id === 'pso') {
      var V = [], PB = [], PF = [], GB = null, GF = Infinity;
      return {
        first: function () { var p = randPop(); for (var i = 0; i < POP; i++) V.push([(R() - 0.5) * 2, (R() - 0.5) * 2]); return p; },
        next: function (pop, f) {
          for (var i = 0; i < POP; i++) {
            if (!PB[i] || f[i] < PF[i]) { PB[i] = pop[i].slice(); PF[i] = f[i]; }
            if (f[i] < GF) { GF = f[i]; GB = pop[i].slice(); }
          }
          var w = 0.62, c1 = 1.5, c2 = 1.6, out = [];
          for (i = 0; i < POP; i++) {
            var x = pop[i], v = V[i];
            for (var k = 0; k < 2; k++) {
              v[k] = w * v[k] + c1 * R() * (PB[i][k] - x[k]) + c2 * R() * (GB[k] - x[k]);
              v[k] = Math.max(-2.5, Math.min(2.5, v[k]));
            }
            out.push([clampX(x[0] + v[0]), clampX(x[1] + v[1])]);
          }
          return out;
        }
      };
    }

    // CMA-ES, n = 2 (Hansen's standard settings)
    var n = 2, lam = POP, mu = 10, wts = [], ws = 0;
    for (var i = 0; i < mu; i++) { wts.push(Math.log(mu + 0.5) - Math.log(i + 1)); ws += wts[i]; }
    wts = wts.map(function (w) { return w / ws; });
    var mueff = 1 / wts.reduce(function (s, w) { return s + w * w; }, 0);
    var cc = (4 + mueff / n) / (n + 4 + 2 * mueff / n), cs = (mueff + 2) / (n + mueff + 5);
    var c1 = 2 / ((n + 1.3) * (n + 1.3) + mueff);
    var cmu = Math.min(1 - c1, 2 * (mueff - 2 + 1 / mueff) / ((n + 2) * (n + 2) + mueff));
    var damps = 1 + 2 * Math.max(0, Math.sqrt((mueff - 1) / (n + 1)) - 1) + cs;
    var chiN = Math.sqrt(n) * (1 - 1 / (4 * n) + 1 / (21 * n * n));
    var m = [uni() * 0.7, uni() * 0.7], sigma = 2.2, Cm = [[1, 0], [0, 1]], pc = [0, 0], ps = [0, 0];
    var B = [[1, 0], [0, 1]], D = [1, 1], Z = [];
    function eig() {
      var a = Cm[0][0], b = Cm[0][1], c = Cm[1][1], tr = a + c, det = a * c - b * b;
      var disc = Math.sqrt(Math.max(0, tr * tr / 4 - det)), l1 = tr / 2 + disc, l2 = tr / 2 - disc;
      var v1 = Math.abs(b) > 1e-12 ? [l1 - c, b] : (a >= c ? [1, 0] : [0, 1]);
      var nv = Math.hypot(v1[0], v1[1]); v1 = [v1[0] / nv, v1[1] / nv];
      B = [[v1[0], -v1[1]], [v1[1], v1[0]]];
      D = [Math.sqrt(Math.max(1e-12, l1)), Math.sqrt(Math.max(1e-12, l2))];
    }
    function sample() {
      eig(); Z = [];
      var out = [];
      for (var k = 0; k < lam; k++) {
        var z = [gauss(), gauss()], dz = [D[0] * z[0], D[1] * z[1]];
        var y = [B[0][0] * dz[0] + B[0][1] * dz[1], B[1][0] * dz[0] + B[1][1] * dz[1]];
        Z.push(y);
        out.push([clampX(m[0] + sigma * y[0]), clampX(m[1] + sigma * y[1])]);
      }
      return out;
    }
    return {
      first: sample,
      next: function (pop, f) {
        g++;
        var idx = pop.map(function (_, k) { return k; }).sort(function (a, b) { return f[a] - f[b]; });
        var old = m.slice(); m = [0, 0];
        for (var k = 0; k < mu; k++) { m[0] += wts[k] * pop[idx[k]][0]; m[1] += wts[k] * pop[idx[k]][1]; }
        var yw = [(m[0] - old[0]) / sigma, (m[1] - old[1]) / sigma];
        // C^-1/2 * yw
        var bt = [B[0][0] * yw[0] + B[1][0] * yw[1], B[0][1] * yw[0] + B[1][1] * yw[1]];
        bt = [bt[0] / D[0], bt[1] / D[1]];
        var cy = [B[0][0] * bt[0] + B[0][1] * bt[1], B[1][0] * bt[0] + B[1][1] * bt[1]];
        var kps = Math.sqrt(cs * (2 - cs) * mueff);
        ps = [(1 - cs) * ps[0] + kps * cy[0], (1 - cs) * ps[1] + kps * cy[1]];
        var psn = Math.hypot(ps[0], ps[1]);
        var hsig = psn / Math.sqrt(1 - Math.pow(1 - cs, 2 * g)) / chiN < 1.4 + 2 / (n + 1) ? 1 : 0;
        var kpc = hsig * Math.sqrt(cc * (2 - cc) * mueff);
        pc = [(1 - cc) * pc[0] + kpc * yw[0], (1 - cc) * pc[1] + kpc * yw[1]];
        var rk = [[0, 0], [0, 0]];
        for (k = 0; k < mu; k++) {
          var y = [(pop[idx[k]][0] - old[0]) / sigma, (pop[idx[k]][1] - old[1]) / sigma];
          rk[0][0] += wts[k] * y[0] * y[0]; rk[0][1] += wts[k] * y[0] * y[1]; rk[1][1] += wts[k] * y[1] * y[1];
        }
        var a = 1 - c1 - cmu, dh = (1 - hsig) * cc * (2 - cc);
        Cm[0][0] = a * Cm[0][0] + c1 * (pc[0] * pc[0] + dh * Cm[0][0]) + cmu * rk[0][0];
        Cm[0][1] = a * Cm[0][1] + c1 * (pc[0] * pc[1] + dh * Cm[0][1]) + cmu * rk[0][1];
        Cm[1][1] = a * Cm[1][1] + c1 * (pc[1] * pc[1] + dh * Cm[1][1]) + cmu * rk[1][1];
        Cm[1][0] = Cm[0][1];
        sigma *= Math.exp((cs / damps) * (psn / chiN - 1));
        sigma = Math.min(4, Math.max(1e-3, sigma));
        return sample();
      },
      ellipse: function () { eig(); return { m: m, B: B, D: D, sigma: sigma }; }
    };
  }

  /* ------------------------------------------------------------ heatmap */
  var HEAT = null;
  function heatmap() {
    if (HEAT) return HEAT;
    var N = 320, c = document.createElement('canvas'); c.width = c.height = N;
    var ctx = c.getContext('2d'), img = ctx.createImageData(N, N);
    var stops = [[0, [74, 6, 18]], [0.22, [150, 14, 36]], [0.45, [222, 74, 92]], [0.7, [246, 170, 179]], [1, [255, 246, 247]]];
    for (var j = 0; j < N; j++) for (var i = 0; i < N; i++) {
      var x = LO + (HI - LO) * (i + 0.5) / N, y = HI - (HI - LO) * (j + 0.5) / N;
      var t = Math.pow(ackley(x, y) / FMAX, 0.85), k = 1;
      while (k < stops.length - 1 && t > stops[k][0]) k++;
      var a = stops[k - 1], b = stops[k], u = Math.max(0, Math.min(1, (t - a[0]) / (b[0] - a[0])));
      var p = 4 * (j * N + i);
      img.data[p] = a[1][0] + (b[1][0] - a[1][0]) * u;
      img.data[p + 1] = a[1][1] + (b[1][1] - a[1][1]) * u;
      img.data[p + 2] = a[1][2] + (b[1][2] - a[1][2]) * u;
      img.data[p + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return (HEAT = c);
  }

  var CSS = [
    '.od{display:flex;flex-direction:column;gap:18px;height:100%;font-family:Poppins,system-ui,sans-serif}',
    '.od-tabs{display:flex;gap:10px;flex-wrap:wrap;align-items:center}',
    '.od-tabs button{all:unset;cursor:pointer;font-size:21px;font-weight:500;padding:9px 18px;border-radius:999px;background:#fff5f6;color:#b40014;border:1.5px solid #f9c3ca;transition:background .2s,color .2s}',
    '.od-tabs button:hover{background:#fde4e7}',
    '.od-tabs button.on{background:#E50019;color:#fff;border-color:#E50019}',
    '.od-tabs .od-re{padding:9px 14px;color:#8a8a93;border-color:#ece5e6;background:#fff}',
    '.od-main{flex:1;min-height:0;display:grid;grid-template-columns:1fr 0.82fr;gap:26px}',
    '.od-main canvas{width:100%;height:100%;display:block}',
    '.od-mapw{position:relative;min-height:0}.od-mapw canvas{position:absolute;inset:0}',
    '.od-info{font-size:20px;color:#8a8a93;font-variant-numeric:tabular-nums}',
    '.od-info b{color:#E50019;font-weight:600}',
    /* slide elements that follow the running method */
    '.od-hide{display:none!important}',
    '[data-od-hl]{transition:opacity .35s,border-color .35s,background-color .35s}',
    '[data-od-hl].od-dim{opacity:.42}',
    '[data-od-hl].od-hl{border-color:#ef5466!important;background:#fff5f6!important}',
    '.deck-clone [data-od-hl]{transition:none}'
  ].join('\n');

  Deck.widget('optim-demo', {
    steps: ALGOS.length - 1,
    mount: function (el, api) {
      if (!document.getElementById('od-style')) { var s = document.createElement('style'); s.id = 'od-style'; s.textContent = CSS; document.head.appendChild(s); }
      el.innerHTML = '<div class="od"><div class="od-tabs"></div><div class="od-main"><div class="od-mapw"><canvas class="od-bg"></canvas><canvas class="od-map"></canvas></div><canvas class="od-score"></canvas></div><div class="od-info"></div></div>';
      var tabs = el.querySelector('.od-tabs'), map = el.querySelector('.od-map'), bgc = el.querySelector('.od-bg'), sc = el.querySelector('.od-score'), info = el.querySelector('.od-info');
      ALGOS.forEach(function (a, i) {
        var b = document.createElement('button'); b.textContent = a.name;
        b.addEventListener('click', function () { start(i); });
        tabs.appendChild(b);
      });
      var re = document.createElement('button'); re.className = 'od-re'; re.textContent = '↻'; re.title = 'Run again with a new seed';
      re.addEventListener('click', function () { seed++; start(cur); });
      tabs.appendChild(re);

      var cur = 0, seed = 7, run = null, active = false;
      // show / highlight the slide's text for the running method
      function follow(id) {
        var sl = api.slide;
        if (!sl) return;
        sl.setAttribute('data-od-method', id);
        var has = function (e, a) { return e.getAttribute(a).split(/[\s,]+/).indexOf(id) >= 0; };
        Array.prototype.forEach.call(sl.querySelectorAll('[data-od-show]'), function (e) { e.classList.toggle('od-hide', !has(e, 'data-od-show')); });
        Array.prototype.forEach.call(sl.querySelectorAll('[data-od-hl]'), function (e) { var on = has(e, 'data-od-hl'); e.classList.toggle('od-hl', on); e.classList.toggle('od-dim', !on); });
      }
      function start(i) {
        cur = i;
        Array.prototype.forEach.call(tabs.children, function (b, k) { b.classList.toggle('on', k === i); });
        follow(ALGOS[i].id);
        var R = rng(seed * 97 + i * 13 + 1), opt = makeOptimiser(ALGOS[i].id, R, seed);
        var pop = opt.first();
        run = { opt: opt, gens: [], pop: pop, prevPop: null, gen: 0, t0: performance.now(), best: Infinity, bestP: null, history: [] };
        evaluate();
      }
      function evaluate() {
        var f = run.pop.map(function (p) { return ackley(p[0], p[1]); });
        run.gens.push({ pop: run.pop, f: f });
        f.forEach(function (v, k) {
          run.history.push(v);
          if (v < run.best) { run.best = v; run.bestP = run.pop[k]; }
        });
        run.lastEval = performance.now();
      }
      function stepGen() {
        if (run.gens.length >= GEN) return;
        var last = run.gens[run.gens.length - 1];
        run.prevPop = last.pop;
        run.pop = run.opt.next(last.pop, last.f);
        evaluate();
      }

      // canvas sizes are read once per enter/resize (reading them every frame forces a layout)
      function measure() { [map, bgc, sc].forEach(function (c) { c._w = c.clientWidth; c._h = c.clientHeight; }); }
      function size(c) {
        if (!c._w) measure();
        var Q = Deck.quality, w = c._w, h = c._h, k = Math.min(Q ? Math.max(1, Q.kMax + 0.5) : 2.5, (window.devicePixelRatio || 1) * (api.scale || 1));
        if (!w || !h) return null;
        if (c.width !== Math.round(w * k) || c.height !== Math.round(h * k)) { c.width = Math.round(w * k); c.height = Math.round(h * k); c._fresh = true; }
        var ctx = c.getContext('2d'); ctx.setTransform(k, 0, 0, k, 0, 0);
        return { ctx: ctx, w: w, h: h };
      }

      var drawnHist = -1, drawnRun = null;
      function draw(now, force) {
        if (!run) return;
        if (now - run.lastEval > 560 && run.gens.length < GEN) stepGen();
        // only redraw while particles glide or when a generation was added (most frames: nothing to do)
        var changed = force || run !== drawnRun || run.history.length !== drawnHist;
        if (!changed && now - run.lastEval > 420) return;
        var A = size(map), Bs = size(sc), Bg = size(bgc);
        if (!A || !Bs || !Bg) return;
        // ----- map
        var ctx = A.ctx, S = Math.min(A.w, A.h) - 34, ox = (A.w - S) / 2 + 12, oy = 4;
        var X = function (x) { return ox + (x - LO) / (HI - LO) * S; }, Y = function (y) { return oy + (HI - y) / (HI - LO) * S; };
        if (bgc._fresh) { // the map itself never changes: painted once, underneath
          bgc._fresh = false;
          var bctx = Bg.ctx;
          bctx.clearRect(0, 0, Bg.w, Bg.h);
          bctx.imageSmoothingEnabled = true;
          bctx.drawImage(heatmap(), ox, oy, S, S);
          bctx.strokeStyle = 'rgba(0,0,0,.12)'; bctx.lineWidth = 1; bctx.strokeRect(ox + 0.5, oy + 0.5, S - 1, S - 1);
          bctx.fillStyle = '#8a8a93'; bctx.font = '15px Poppins, sans-serif'; bctx.textAlign = 'center';
          [-4, -2, 0, 2, 4].forEach(function (v) {
            bctx.fillText(String(v), X(v), oy + S + 20);
            bctx.textAlign = 'right'; bctx.fillText(String(v), ox - 7, Y(v) + 5); bctx.textAlign = 'center';
          });
          // global minimum marker
          bctx.strokeStyle = 'rgba(255,255,255,.9)'; bctx.lineWidth = 1.5;
          bctx.beginPath(); bctx.moveTo(X(0) - 9, Y(0)); bctx.lineTo(X(0) + 9, Y(0)); bctx.moveTo(X(0), Y(0) - 9); bctx.lineTo(X(0), Y(0) + 9); bctx.stroke();
        }
        ctx.clearRect(0, 0, A.w, A.h);
        // CMA-ES search distribution
        if (run.opt.ellipse && run.gens.length < GEN + 1) {
          var e = run.opt.ellipse(), ang = Math.atan2(e.B[1][0], e.B[0][0]);
          ctx.save(); ctx.translate(X(e.m[0]), Y(e.m[1])); ctx.rotate(-ang);
          ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.setLineDash([5, 4]); ctx.lineWidth = 1.6;
          ctx.beginPath(); ctx.ellipse(0, 0, Math.max(2, 2 * e.sigma * e.D[0] / (HI - LO) * S), Math.max(2, 2 * e.sigma * e.D[1] / (HI - LO) * S), 0, 0, TAU); ctx.stroke();
          ctx.restore(); ctx.setLineDash([]);
        }
        // past generations
        var gens = run.gens, last = gens.length - 1;
        for (var gi = 0; gi < last; gi++) {
          var age = (last - gi) / GEN;
          ctx.fillStyle = 'rgba(255,255,255,' + (0.55 - 0.35 * age).toFixed(2) + ')';
          ctx.beginPath(); // one fill per generation
          gens[gi].pop.forEach(function (p) { var px = X(p[0]), py = Y(p[1]); ctx.moveTo(px + 2.6, py); ctx.arc(px, py, 2.6, 0, TAU); });
          ctx.fill();
        }
        // current generation (particles glide from their previous positions)
        var u = Math.max(0, Math.min(1, (now - run.lastEval) / 380)), eu = 1 - Math.pow(1 - u, 3);
        gens[last].pop.forEach(function (p, k) {
          var px = p[0], py = p[1];
          if (run.prevPop && ALGOS[cur].id === 'pso') { px = run.prevPop[k][0] + (p[0] - run.prevPop[k][0]) * eu; py = run.prevPop[k][1] + (p[1] - run.prevPop[k][1]) * eu; }
          var r = ALGOS[cur].id === 'pso' ? 5.5 : 2 + 3.5 * eu;
          ctx.fillStyle = '#fff'; ctx.strokeStyle = '#26262b'; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(X(px), Y(py), r, 0, TAU); ctx.fill(); ctx.stroke();
        });
        // best so far
        if (run.bestP) {
          var bx = X(run.bestP[0]), by = Y(run.bestP[1]);
          ctx.fillStyle = '#ffd23a'; ctx.strokeStyle = '#26262b'; ctx.lineWidth = 1.3;
          ctx.beginPath();
          for (var q = 0; q < 10; q++) { var rr = q % 2 ? 4 : 10, aa = -Math.PI / 2 + q * Math.PI / 5; ctx.lineTo(bx + rr * Math.cos(aa), by + rr * Math.sin(aa)); }
          ctx.closePath(); ctx.fill(); ctx.stroke();
        }
        if (!changed) return;
        drawnRun = run; drawnHist = run.history.length;
        // ----- score vs run id
        var c2 = Bs.ctx, W2 = Bs.w, H2 = Bs.h, l = 46, r2 = 10, t2 = 8, b2 = 44;
        var pw = W2 - l - r2, ph = H2 - t2 - b2, N = POP * GEN;
        var SX = function (i) { return l + i / N * pw; }, SY = function (v) { return t2 + (1 - v / 14.5) * ph; };
        c2.clearRect(0, 0, W2, H2);
        for (gi = 0; gi < GEN; gi += 2) { c2.fillStyle = '#f6f3f4'; c2.fillRect(SX(gi * POP), t2, pw / GEN, ph); }
        c2.strokeStyle = '#d9cfd1'; c2.lineWidth = 1.2; c2.strokeRect(l + 0.5, t2 + 0.5, pw, ph);
        c2.fillStyle = '#8a8a93'; c2.font = '15px Poppins, sans-serif'; c2.textAlign = 'center';
        [0, 100, 200, 300].forEach(function (v) { c2.fillText(String(v), SX(v), t2 + ph + 20); });
        c2.textAlign = 'right';
        [0, 4, 8, 12].forEach(function (v) { c2.fillText(String(v), l - 8, SY(v) + 5); });
        c2.textAlign = 'center'; c2.fillText('Evaluation', l + pw / 2, H2 - 4);
        c2.save(); c2.translate(13, t2 + ph / 2); c2.rotate(-Math.PI / 2); c2.fillText('Score', 0, 0); c2.restore();
        var hist = run.history, best = Infinity;
        // every evaluation (red), average of each iteration (dark grey), best so far (black)
        c2.fillStyle = 'rgba(229,0,25,.72)'; c2.beginPath();
        hist.forEach(function (v, i) { var px = SX(i), py = SY(v); c2.moveTo(px + 2.6, py); c2.arc(px, py, 2.6, 0, TAU); });
        c2.fill();
        var means = [];
        for (var gm = 0; gm * POP < hist.length; gm++) {
          var sum = 0, cnt = 0;
          for (var q = gm * POP; q < Math.min(hist.length, (gm + 1) * POP); q++) { sum += hist[q]; cnt++; }
          means.push([SX(gm * POP + POP / 2), SY(sum / cnt)]);
        }
        c2.strokeStyle = '#55555d'; c2.lineWidth = 2.2; c2.beginPath();
        means.forEach(function (m, i) { if (i) c2.lineTo(m[0], m[1]); else c2.moveTo(m[0], m[1]); });
        c2.stroke();
        c2.fillStyle = '#55555d';
        means.forEach(function (m) { c2.fillRect(m[0] - 3.5, m[1] - 3.5, 7, 7); });
        c2.strokeStyle = '#111114'; c2.lineWidth = 2.6; c2.beginPath();
        hist.forEach(function (v, i) { best = Math.min(best, v); if (i) c2.lineTo(SX(i), SY(best)); else c2.moveTo(SX(i), SY(best)); });
        c2.stroke();
        // legend
        var lx = l + pw - 196, ly = t2 + 14;
        c2.fillStyle = 'rgba(255,255,255,.88)'; c2.fillRect(lx - 10, ly - 12, 200, 76);
        c2.font = '14px Poppins, sans-serif'; c2.textAlign = 'left';
        c2.fillStyle = 'rgba(229,0,25,.8)'; c2.beginPath(); c2.arc(lx + 8, ly, 3.4, 0, TAU); c2.fill();
        c2.fillStyle = '#46464e'; c2.fillText('evaluation', lx + 24, ly + 5);
        c2.fillStyle = '#55555d'; c2.fillRect(lx, ly + 22, 16, 2.4); c2.fillRect(lx + 4.5, ly + 19.7, 7, 7);
        c2.fillStyle = '#46464e'; c2.fillText('average per iteration', lx + 24, ly + 28);
        c2.fillStyle = '#111114'; c2.fillRect(lx, ly + 45, 16, 2.6);
        c2.fillStyle = '#46464e'; c2.fillText('best so far', lx + 24, ly + 51);
        info.innerHTML = 'generation ' + Math.min(GEN, gens.length) + ' / ' + GEN + ' &nbsp;·&nbsp; ' + hist.length + ' evaluations &nbsp;·&nbsp; best <i>f</i> = <b>' + run.best.toFixed(3) + '</b>' + (ALGOS[cur].recorded ? ' &nbsp;·&nbsp; recorded run' : '');
      }
      function tick(now) { if (active) draw(now); }
      follow(ALGOS[cur].id);

      return {
        enter: function () { active = true; measure(); Deck.ticker.add(tick); },
        leave: function () { active = false; Deck.ticker.remove(tick); },
        step: function (k) { start(k); },
        resize: function () { measure(); if (run && active) draw(performance.now(), true); },
        print: function () {
          measure(); start(cur);
          while (run.gens.length < GEN) stepGen();
          run.lastEval = -1e9; draw(performance.now(), true);
        }
      };
    }
  });
})();
