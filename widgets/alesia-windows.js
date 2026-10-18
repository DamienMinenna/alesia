/*!
 * alesia-windows.js — more tilted-window animations built on MDKit (magnet-design.js).
 *
 *   <div data-widget="alesia-landscape"></div>  one window (appears on the first key press): 2D fitness landscape
 *                                               in reds (darkest = global minimum, same colours as the optimiser
 *                                               example), discontinuity zone in green, a swarm slowly converging
 *                                               to the global minimum
 *   <div data-widget="alesia-hub"></div>        thank-you slide: the six tools of the title sequence,
 *                                               now all connected through an ALESIA window running a
 *                                               Bayesian optimisation
 *   <div data-widget="ecris-design"></div>      ECRIS: magnetic, mechanics and IBSimu (beam extraction)
 *                                               windows, one per key press (2 steps)
 *   <div data-widget="alesia-workflow-live"></div>  workflow for superconducting magnets (2 steps):
 *                                               inputs, requirements, physics codes → + optimiser,
 *                                               database, score and the loop → + ALESIA manager (Slurm)
 *
 * Load after magnet-design.js. Everything is drawn on <canvas>, no libraries.
 */
(function () {
  'use strict';
  var K = window.MDKit;
  if (!K || !window.Deck) return;
  var H = K.helpers, clamp01 = H.clamp01, lerp = H.lerp, easeOut = H.easeOut, easeInOut = H.easeInOut,
    backOut = H.backOut, frac = H.frac, mix = H.mix, rgba = H.rgba, roundRect = H.roundRect, TAU = Math.PI * 2;

  function rng(seed) { // mulberry32
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function fitRect(W, Hh, aspect, m) { // largest rect of given aspect inside W×H with margin m
    var w = W - 2 * m, h = Hh - 2 * m;
    if (w / h > aspect) w = h * aspect; else h = w / aspect;
    return { x: (W - w) / 2, y: (Hh - h) / 2, w: w, h: h };
  }

  /* ================================================== 2D fitness landscape */
  var LX = 1.6, LY = 1.0;                    // domain [-LX, LX] × [-LY, LY]
  var GMIN = [0.62, -0.3];                   // global minimum (brightest green)
  var LOCALS = [[-0.95, 0.45, 0.56, 0.17], [-0.55, -0.55, 0.5, 0.16], [1.08, 0.55, 0.5, 0.15], [-0.12, 0.32, 0.46, 0.14], [0.22, -0.72, 0.42, 0.13]];
  function depth(x, y) { // 0 (high fitness score) … 1 (global minimum)
    var dx = x - GMIN[0], dy = y - GMIN[1];
    var d = Math.exp(-(dx * dx + dy * dy) / (2 * 0.27 * 0.27));
    for (var i = 0; i < LOCALS.length; i++) {
      var L = LOCALS[i], ex = x - L[0], ey = y - L[1];
      d = Math.max(d, L[2] * Math.exp(-(ex * ex + ey * ey) / (2 * L[3] * L[3])));
    }
    d += 0.03 * (Math.cos(5.2 * Math.PI * x) + Math.cos(5.2 * Math.PI * y)) * (1 - d) + 0.03; // Ackley-like ripples
    return clamp01(d);
  }
  var BAND_C = 0.17, BAND_W = 0.075;         // discontinuity zone: |0.85 x − 0.5 y − c| < w
  function inBand(x, y) { return Math.abs(0.85 * x - 0.5 * y - BAND_C) < BAND_W; }
  function fval(x, y) { return inBand(x, y) ? Infinity : 1 - depth(x, y); }

  // same colour scale as the optimiser example (optim-demo.js): white-pink far away, darkest red at the global minimum
  var LS_STOPS = [[0, [74, 6, 18]], [0.22, [150, 14, 36]], [0.45, [222, 74, 92]], [0.7, [246, 170, 179]], [1, [255, 246, 247]]];
  function CM_RED(d, out) {
    var t = Math.pow(clamp01(1 - d), 0.85), k = 1;
    while (k < LS_STOPS.length - 1 && t > LS_STOPS[k][0]) k++;
    var a = LS_STOPS[k - 1], b = LS_STOPS[k], u = clamp01((t - a[0]) / (b[0] - a[0]));
    out[0] = a[1][0] + (b[1][0] - a[1][0]) * u; out[1] = a[1][1] + (b[1][1] - a[1][1]) * u; out[2] = a[1][2] + (b[1][2] - a[1][2]) * u;
    return out;
  }
  var LS_IMG = null;
  function landscapeImage() {
    if (LS_IMG) return LS_IMG;
    var w = 384, h = 240, c = document.createElement('canvas'); c.width = w; c.height = h;
    var ctx = c.getContext('2d'), img = ctx.createImageData(w, h), col = [0, 0, 0];
    for (var j = 0; j < h; j++) for (var i = 0; i < w; i++) {
      var x = -LX + 2 * LX * (i + 0.5) / w, y = LY - 2 * LY * (j + 0.5) / h, d = depth(x, y);
      CM_RED(d, col);
      if (frac(d * 10) < 0.08 && d > 0.1) { col[0] *= 0.93; col[1] *= 0.95; col[2] *= 0.93; } // contour lines
      if (inBand(x, y)) {
        var hatch = ((i + j) % 10) < 2;  // discontinuity zone: green, hatched
        var m2 = mix(col, hatch ? [8, 132, 56] : [96, 200, 128], hatch ? 0.9 : 0.72);
        col[0] = m2[0]; col[1] = m2[1]; col[2] = m2[2];
      }
      var p = 4 * (j * w + i);
      img.data[p] = col[0]; img.data[p + 1] = col[1]; img.data[p + 2] = col[2]; img.data[p + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    LS_IMG = c;  // a plain canvas (an ImageBitmap would not survive PDF export, and the map is painted only once anyway)
    return c;
  }

  var LS_N = 22, LS_IT = 22, LS_DT = 0.62, LS_CYCLE = 18;
  function SceneLandscape() { this.seed = 5; this.start(0); }
  SceneLandscape.prototype.start = function (t) {
    var R = this.R = rng(this.seed++ * 7919 + 13);
    this.t0 = t; this.iter = 0; this.P = []; this.V = []; this.PB = []; this.PF = []; this.gb = null; this.gf = Infinity;
    for (var i = 0; i < LS_N; i++) {
      this.P.push([-LX + 2 * LX * R(), -LY + 2 * LY * R()]);
      this.V.push([(R() - 0.5) * 0.3, (R() - 0.5) * 0.2]);
      this.PF.push(Infinity); this.PB.push(null);
    }
    this.prev = this.P.map(function (p) { return p.slice(); });
    this.trails = this.P.map(function (p) { return [p.slice()]; });
    this.evaluate();
  };
  SceneLandscape.prototype.evaluate = function () {
    for (var i = 0; i < LS_N; i++) {
      var p = this.P[i], f = fval(p[0], p[1]);
      if (f < this.PF[i]) { this.PF[i] = f; this.PB[i] = p.slice(); }
      if (f < this.gf) { this.gf = f; this.gb = p.slice(); }
    }
  };
  SceneLandscape.prototype.stepIter = function () {
    var R = this.R, w = 0.62, c1 = 1.0, c2 = 1.25, k = 0.75;
    this.prev = this.P.map(function (p) { return p.slice(); });
    for (var i = 0; i < LS_N; i++) {
      var p = this.P[i], v = this.V[i], pb = this.PB[i] || p;
      for (var d = 0; d < 2; d++) {
        v[d] = w * v[d] + c1 * R() * (pb[d] - p[d]) + c2 * R() * (this.gb[d] - p[d]);
        v[d] = Math.max(-0.3, Math.min(0.3, v[d]));
        p[d] += k * v[d];
      }
      p[0] = Math.max(-LX, Math.min(LX, p[0])); p[1] = Math.max(-LY, Math.min(LY, p[1]));
    }
    this.iter++;
    // exploration safeguard: if the swarm has not found the global basin yet, send a scout
    if (this.iter === 6 && Math.hypot(this.gb[0] - GMIN[0], this.gb[1] - GMIN[1]) > 0.3) {
      var worst = 0;
      for (var j = 1; j < LS_N; j++) if (this.PF[j] > this.PF[worst]) worst = j;
      var a = R() * TAU, r = 0.18 + 0.12 * R();
      this.P[worst] = [GMIN[0] + r * Math.cos(a), GMIN[1] + r * Math.sin(a)];
    }
    this.evaluate();
    var self = this;
    this.trails.forEach(function (tr, i) { tr.push(self.P[i].slice()); if (tr.length > 9) tr.shift(); });
  };
  SceneLandscape.prototype.drawBg = function (ctx, W, Hh) { // the map itself never changes
    var r = fitRect(W, Hh, LX / LY, 14);
    var X = function (x) { return r.x + (x + LX) / (2 * LX) * r.w; }, Y = function (y) { return r.y + (LY - y) / (2 * LY) * r.h; };
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(landscapeImage(), r.x, r.y, r.w, r.h);
    ctx.strokeStyle = 'rgba(0,0,0,.10)'; ctx.lineWidth = 1; ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
    // discontinuity zone borders
    ctx.strokeStyle = 'rgba(10,140,60,.9)'; ctx.lineWidth = 1.6;
    [-BAND_W, BAND_W].forEach(function (o) {
      var c = BAND_C + o;
      ctx.beginPath(); ctx.moveTo(X((c - 0.5 * LY) / 0.85), Y(-LY)); ctx.lineTo(X((c + 0.5 * LY) / 0.85), Y(LY)); ctx.stroke();
    });
    // axis ticks
    ctx.strokeStyle = 'rgba(60,60,70,.35)'; ctx.lineWidth = 1;
    for (var k = 1; k < 8; k++) { var tx = r.x + r.w * k / 8; ctx.beginPath(); ctx.moveTo(tx, r.y + r.h); ctx.lineTo(tx, r.y + r.h - 5); ctx.stroke(); }
    for (k = 1; k < 5; k++) { var ty = r.y + r.h * k / 5; ctx.beginPath(); ctx.moveTo(r.x, ty); ctx.lineTo(r.x + 5, ty); ctx.stroke(); }
  };
  SceneLandscape.prototype.draw = function (ctx, W, Hh, t) {
    var lt = t - this.t0;
    if (lt > LS_CYCLE) { this.start(t); lt = 0; }
    var target = Math.min(LS_IT, Math.max(0, Math.floor((lt - 0.8) / LS_DT)));
    while (this.iter < target) this.stepIter();
    var u = this.iter < LS_IT ? easeInOut(frac((lt - 0.8) / LS_DT) * 1.6) : 1;
    if (lt < 0.8) u = 1;
    var r = fitRect(W, Hh, LX / LY, 14);
    var X = function (x) { return r.x + (x + LX) / (2 * LX) * r.w; }, Y = function (y) { return r.y + (LY - y) / (2 * LY) * r.h; };
    var fade = Math.min(clamp01(lt / 0.6), clamp01((LS_CYCLE - lt) / 0.8));
    ctx.save(); ctx.globalAlpha = fade;
    // trails
    var self = this;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    this.trails.forEach(function (tr) {
      if (tr.length < 2) return;
      ctx.strokeStyle = 'rgba(45,18,24,.26)'; ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.moveTo(X(tr[0][0]), Y(tr[0][1]));
      for (var q = 1; q < tr.length; q++) ctx.lineTo(X(tr[q][0]), Y(tr[q][1]));
      ctx.stroke();
    });
    // particles
    this.P.forEach(function (p, i) {
      var q = self.prev[i], px = lerp(q[0], p[0], u), py = lerp(q[1], p[1], u), sx = X(px), sy = Y(py);
      if (inBand(px, py)) {
        ctx.strokeStyle = '#1f1f24'; ctx.lineWidth = 2.4;  // a design in the discontinuity zone: not valid
        ctx.beginPath(); ctx.moveTo(sx - 5, sy - 5); ctx.lineTo(sx + 5, sy + 5); ctx.moveTo(sx + 5, sy - 5); ctx.lineTo(sx - 5, sy + 5); ctx.stroke();
        return;
      }
      ctx.fillStyle = '#26262b'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(sx, sy, 4.6, 0, TAU); ctx.fill(); ctx.stroke();
    });
    // best so far
    if (this.gb) {
      var bx = X(this.gb[0]), by = Y(this.gb[1]), pulse = 0.5 + 0.5 * Math.sin(t * 4);
      ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.arc(bx, by, 10 + 4 * pulse, 0, TAU); ctx.stroke();
      ctx.strokeStyle = 'rgba(60,8,20,.6)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(bx, by, 12 + 4 * pulse, 0, TAU); ctx.stroke();
    }
    ctx.restore();
  };

  /* ================================================ Bayesian optimisation */
  function bayesF(x) { // objective to minimise on [0, 1]
    return 0.9 - Math.exp(-Math.pow((x - 0.72) / 0.075, 2)) - 0.55 * Math.exp(-Math.pow((x - 0.24) / 0.06, 2)) -
      0.4 * Math.exp(-Math.pow((x - 0.47) / 0.05, 2)) + 0.12 * Math.sin(14 * x) + 0.25 * x;
  }
  function erf(x) { // Abramowitz–Stegun 7.1.26
    var s = x < 0 ? -1 : 1; x = Math.abs(x);
    var t = 1 / (1 + 0.3275911 * x);
    var y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return s * y;
  }
  function gpFit(X, Y, ell) {
    var n = X.length, mean = 0, sd = 0, i, j, k;
    for (i = 0; i < n; i++) mean += Y[i]; mean /= n;
    for (i = 0; i < n; i++) sd += (Y[i] - mean) * (Y[i] - mean); sd = Math.sqrt(sd / n) || 1;
    var y = Y.map(function (v) { return (v - mean) / sd; });
    var L = [];
    for (i = 0; i < n; i++) { L.push(new Float64Array(n)); }
    for (i = 0; i < n; i++) for (j = 0; j <= i; j++) {
      var s = Math.exp(-Math.pow(X[i] - X[j], 2) / (2 * ell * ell)) + (i === j ? 1e-4 : 0);
      for (k = 0; k < j; k++) s -= L[i][k] * L[j][k];
      L[i][j] = i === j ? Math.sqrt(Math.max(s, 1e-12)) : s / L[j][j];
    }
    var z = new Float64Array(n), a = new Float64Array(n);
    for (i = 0; i < n; i++) { var t = y[i]; for (k = 0; k < i; k++) t -= L[i][k] * z[k]; z[i] = t / L[i][i]; }
    for (i = n - 1; i >= 0; i--) { var t2 = z[i]; for (k = i + 1; k < n; k++) t2 -= L[k][i] * a[k]; a[i] = t2 / L[i][i]; }
    return { X: X.slice(), L: L, a: a, mean: mean, sd: sd, ell: ell, n: n };
  }
  function gpPredict(m, x, out) {
    var n = m.n, ks = new Float64Array(n), mu = 0, i, k;
    for (i = 0; i < n; i++) { ks[i] = Math.exp(-Math.pow(x - m.X[i], 2) / (2 * m.ell * m.ell)); mu += ks[i] * m.a[i]; }
    var v = new Float64Array(n), vv = 0;
    for (i = 0; i < n; i++) { var t = ks[i]; for (k = 0; k < i; k++) t -= m.L[i][k] * v[k]; v[i] = t / m.L[i][i]; vv += v[i] * v[i]; }
    out[0] = m.mean + mu * m.sd; out[1] = Math.sqrt(Math.max(1e-10, 1 - vv)) * m.sd;
    return out;
  }

  var BG = 140, B_ITERS = 10, B_DT = 1.45;
  function SceneBayes() { this.seed = 2; this.mu = new Float64Array(BG); this.sd = new Float64Array(BG); this.pm = new Float64Array(BG); this.ps = new Float64Array(BG); this.ei = new Float64Array(BG); this.start(0); }
  SceneBayes.prototype.start = function (t) {
    var R = rng(this.seed++ * 104729 + 7);
    this.t0 = t; this.iter = 0;
    this.X = [0.06 + 0.1 * R(), 0.42 + 0.12 * R(), 0.86 + 0.1 * R()];
    this.Y = this.X.map(bayesF);
    this.fit(true);
    this.tNew = -10; this.newX = null;
  };
  SceneBayes.prototype.fit = function (snap) {
    var m = gpFit(this.X, this.Y, 0.1), o = [0, 0], best = Math.min.apply(null, this.Y), maxEi = 0, arg = 0;
    for (var i = 0; i < BG; i++) {
      var x = i / (BG - 1);
      this.pm[i] = snap ? NaN : this.mu[i]; this.ps[i] = snap ? NaN : this.sd[i];
      gpPredict(m, x, o);
      this.mu[i] = o[0]; this.sd[i] = o[1];
      var s = o[1], imp = best - o[0] - 0.01, z = imp / s;
      var ei = s < 1e-6 ? 0 : imp * 0.5 * (1 + erf(z / Math.SQRT2)) + s * Math.exp(-z * z / 2) / Math.sqrt(TAU);
      this.ei[i] = Math.max(0, ei);
      if (this.ei[i] > maxEi) { maxEi = this.ei[i]; arg = i; }
    }
    this.maxEi = maxEi || 1; this.arg = arg; this.tFit = this.lt || 0;
  };
  SceneBayes.prototype.draw = function (ctx, W, Hh, t) {
    var lt = this.lt = t - this.t0;
    var total = 0.9 + B_ITERS * B_DT + 2.6;
    if (lt > total) { this.start(t); lt = this.lt = 0; }
    var target = Math.min(B_ITERS, Math.max(0, Math.floor((lt - 0.9) / B_DT)));
    while (this.iter < target) {
      var nx = this.arg / (BG - 1);
      this.X.push(nx); this.Y.push(bayesF(nx));
      this.newX = nx; this.tNew = 0.9 + (this.iter + 1) * B_DT;
      this.iter++;
      this.fit(false);
      this.tFit = this.tNew;
    }
    var m = 16, x0 = 34, x1 = W - m, y0 = 14, y1 = Hh * 0.63, a0 = Hh * 0.71, a1 = Hh - 12;
    var X = function (x) { return x0 + x * (x1 - x0); }, FMIN = -0.3, FMAX = 1.35;
    var Y = function (f) { return y1 - (f - FMIN) / (FMAX - FMIN) * (y1 - y0); };
    var fade = Math.min(clamp01(lt / 0.5), clamp01((total - lt) / 0.7));
    var blend = clamp01((lt - this.tFit) / 0.55), eb = easeInOut(blend);
    // axes
    ctx.strokeStyle = '#e3d5d8'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0, y1); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x0, a0); ctx.lineTo(x0, a1); ctx.lineTo(x1, a1); ctx.stroke();
    for (var g = 1; g < 10; g++) { ctx.beginPath(); ctx.moveTo(X(g / 10), y1); ctx.lineTo(X(g / 10), y1 + 4); ctx.stroke(); }
    ctx.save(); ctx.globalAlpha = fade;
    // hidden objective (dashed)
    ctx.setLineDash([4, 5]); ctx.strokeStyle = 'rgba(120,120,130,.45)'; ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (var i = 0; i <= 160; i++) { var xx = i / 160; if (i) ctx.lineTo(X(xx), Y(bayesF(xx))); else ctx.moveTo(X(xx), Y(bayesF(xx))); }
    ctx.stroke(); ctx.setLineDash([]);
    var mu = this.mu, sd = this.sd, pm = this.pm, ps = this.ps;
    var M = function (k) { return isNaN(pm[k]) ? mu[k] : lerp(pm[k], mu[k], eb); };
    var Sd = function (k) { return isNaN(ps[k]) ? sd[k] : lerp(ps[k], sd[k], eb); };
    // ±1.5σ band (clipped to the plot)
    ctx.save(); ctx.beginPath(); ctx.rect(x0, y0 - 6, x1 - x0, y1 - y0 + 6); ctx.clip();
    ctx.fillStyle = 'rgba(229,0,25,.12)';
    ctx.beginPath();
    for (i = 0; i < BG; i++) { var px = X(i / (BG - 1)), py = Y(M(i) + 1.5 * Sd(i)); if (i) ctx.lineTo(px, Math.max(y0 - 30, py)); else ctx.moveTo(px, Math.max(y0 - 30, py)); }
    for (i = BG - 1; i >= 0; i--) ctx.lineTo(X(i / (BG - 1)), Math.min(y1 + 30, Y(M(i) - 1.5 * Sd(i))));
    ctx.closePath();
    ctx.fill();
    // GP mean
    ctx.strokeStyle = '#E50019'; ctx.lineWidth = 2.4;
    ctx.beginPath();
    for (i = 0; i < BG; i++) { if (i) ctx.lineTo(X(i / (BG - 1)), Y(M(i))); else ctx.moveTo(X(i / (BG - 1)), Y(M(i))); }
    ctx.stroke();
    ctx.restore();
    // best observed so far
    var best = Math.min.apply(null, this.Y), bi = this.Y.indexOf(best);
    ctx.setLineDash([3, 4]); ctx.strokeStyle = 'rgba(124,126,158,.8)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(x0, Y(best)); ctx.lineTo(x1, Y(best)); ctx.stroke(); ctx.setLineDash([]);
    // observations
    for (i = 0; i < this.X.length; i++) {
      var isNew = this.X[i] === this.newX && lt - this.tNew < 1.2, pop = isNew ? backOut((lt - this.tNew) * 2.5) : 1;
      ctx.fillStyle = i === bi ? '#14b04f' : '#26262b';
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(X(this.X[i]), Y(this.Y[i]), Math.max(0, (i === bi ? 5.6 : 4.4) * pop), 0, TAU); ctx.fill(); ctx.stroke();
      if (isNew) {
        ctx.strokeStyle = 'rgba(229,0,25,' + (0.7 * (1 - (lt - this.tNew) / 1.2)) + ')'; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.arc(X(this.X[i]), Y(this.Y[i]), Math.max(0, 6 + 18 * (lt - this.tNew)), 0, TAU); ctx.stroke();
      }
    }
    // acquisition function (expected improvement)
    var ei = this.ei, mx = this.maxEi;
    var A = function (v) { return a1 - (v / mx) * (a1 - a0) * 0.92; };
    ctx.fillStyle = 'rgba(80,190,110,.28)'; ctx.strokeStyle = '#2f9e57'; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(X(0), a1);
    for (i = 0; i < BG; i++) ctx.lineTo(X(i / (BG - 1)), A(ei[i]));
    ctx.lineTo(X(1), a1); ctx.closePath(); ctx.fill();
    ctx.beginPath();
    for (i = 0; i < BG; i++) { if (i) ctx.lineTo(X(i / (BG - 1)), A(ei[i])); else ctx.moveTo(X(i / (BG - 1)), A(ei[i])); }
    ctx.stroke();
    // next sample proposed by the acquisition function
    if (this.iter < B_ITERS) {
      var ax = X(this.arg / (BG - 1)), pulse = 0.5 + 0.5 * Math.sin(t * 6);
      ctx.setLineDash([4, 4]); ctx.strokeStyle = 'rgba(229,0,25,' + (0.35 + 0.35 * pulse) + ')'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(ax, A(ei[this.arg])); ctx.lineTo(ax, y0); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#E50019';
      ctx.beginPath(); ctx.moveTo(ax, A(ei[this.arg]) - 3); ctx.lineTo(ax - 6, A(ei[this.arg]) - 13); ctx.lineTo(ax + 6, A(ei[this.arg]) - 13); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  };

  /* ================================================== IBSimu beam extraction */
  // geometry in (z, r) millimetres, after the ECRIS extraction system (CEA)
  var IB = {
    PE: [[-6, 60], [7.5, 60], [7.5, 34], [6.5, 30], [4, 27], [2.8, 24], [2.8, 8], [2, 6.3], [-6, 3.2]],
    EA: [[20, 8], [21, 6.3], [23, 6.3], [24.2, 8], [36, 28.5], [40.5, 33], [47, 35], [110, 35], [110, 45], [47, 45], [38, 40.5], [33, 35], [29.5, 29]],
    EB: [[28, 8], [29, 7], [31.2, 7], [32, 8], [33.2, 12], [40, 26], [43, 28.5], [78, 28.5], [81, 30.5], [97, 31], [97, 33], [46, 33], [41.5, 31.8], [38, 28], [30.3, 12.5]],
    EC: [[38, 8], [39, 7], [43, 7], [70, 12], [78, 12], [110, 19.5], [110, 27.5], [95, 26], [51.5, 26], [47.5, 24.5], [45.5, 21]],
    // electrode being optimised (outline), top-left → tip → top-right
    HP: [[10.6, 40], [10.1, 32], [9.4, 24], [8.6, 17], [8.3, 11.5], [9.2, 7.6], [11.2, 6.2], [13.4, 6.9], [16.2, 10], [18.3, 16], [20.6, 23], [23.5, 29], [27, 33], [31, 36]],
    // beam envelope R(z)
    ENV: [[-4, 4.6], [0, 4.4], [6, 4.0], [11, 3.4], [20, 3.5], [35, 4.0], [60, 4.9], [104, 6.0]]
  };
  var Z0 = -3, Z1 = 103, R1 = 30;
  function envR(z) {
    var e = IB.ENV, i = 1;
    while (i < e.length - 1 && e[i][0] < z) i++;
    var u = clamp01((z - e[i - 1][0]) / (e[i][0] - e[i - 1][0])), s = u * u * (3 - 2 * u);
    return lerp(e[i - 1][1], e[i][1], s);
  }
  var HOT = H.cmap([[0, '#140000'], [0.3, '#7a0000'], [0.55, '#e00000'], [0.78, '#ff8a00'], [1, '#ffe94d']]);
  function catmull(ctx, pts) {
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (var i = 0; i < pts.length - 1; i++) {
      var p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      ctx.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]);
    }
  }
  var IB_CYCLE = 4.6, NTRAJ = 30;
  function SceneIBSimu() { this.R = rng(42); this.gen = -1; this.cands = []; this.best = IB.HP; this.col = [0, 0, 0]; }
  SceneIBSimu.prototype.newGeneration = function () {
    this.gen++;
    var R = this.R, amp = 3.2 * Math.exp(-this.gen / 3.5) + 0.35, self = this;
    for (var c = 0; c < 6; c++) {
      var ph = R() * TAU, ph2 = R() * TAU, a1 = (R() - 0.5) * 2 * amp, a2 = (R() - 0.5) * 2 * amp;
      var pts = IB.HP.map(function (p, i) {
        var s = i / (IB.HP.length - 1);
        var dz = a1 * Math.sin(Math.PI * s + ph) + 0.5 * a2 * Math.sin(3 * Math.PI * s + ph2);
        var dr = 0.6 * a2 * Math.cos(2 * Math.PI * s + ph);
        return [p[0] + dz, Math.max(5.2, p[1] + dr * (p[1] < 10 ? 0.4 : 1))];
      });
      self.cands.push({ pts: pts, fit: clamp01(0.35 + 0.65 * Math.min(1, amp / 2.5) * (0.5 + 0.5 * R())), born: self.gen });
    }
    while (this.cands.length > 54) this.cands.shift();
    var bestC = this.cands[this.cands.length - 1 - Math.floor(R() * 6)];
    bestC.fit = Math.min(bestC.fit, 0.12);
    this.best = bestC.pts;
    if (this.gen > 12) { this.gen = -1; this.cands = []; }
  };
  SceneIBSimu.prototype.draw = function (ctx, W, Hh, t) {
    var cyc = Math.floor(t / IB_CYCLE), ct = t - cyc * IB_CYCLE;
    if (cyc !== this.cycle) { this.cycle = cyc; this.newGeneration(); }
    var m = 12, rx = m + 6, rw = W - 2 * m - 6, ry = m, rh = Hh - 2 * m - 6;
    var X = function (z) { return rx + (z - Z0) / (Z1 - Z0) * rw; }, Y = function (r) { return ry + rh - (r / R1) * rh; };
    ctx.save();
    ctx.beginPath(); ctx.rect(rx, ry, rw, rh); ctx.clip();
    // beam
    var front = Z0 + Math.max(0, ct - 0.25) * 62, fadeB = clamp01((IB_CYCLE - ct) / 0.5);
    var zEnd = Math.min(Z1, front);
    if (zEnd > Z0) {
      // envelope glow
      var gEnv = ctx.createLinearGradient(0, Y(7), 0, Y(0));
      gEnv.addColorStop(0, 'rgba(240,60,200,0)'); gEnv.addColorStop(1, 'rgba(240,60,200,.22)');
      ctx.fillStyle = gEnv;
      ctx.beginPath(); ctx.moveTo(X(Z0), Y(0));
      for (var z = Z0; z <= zEnd; z += 1.5) ctx.lineTo(X(z), Y(envR(z) * 1.05));
      ctx.lineTo(X(zEnd), Y(0)); ctx.closePath();
      ctx.globalAlpha = fadeB; ctx.fill();
      ctx.lineWidth = 1.1;
      for (var k = 0; k < NTRAJ; k++) {
        var uu = (k + 0.5) / NTRAJ;
        ctx.strokeStyle = 'rgba(236,48,196,' + (0.25 + 0.3 * (1 - uu)) + ')';
        ctx.beginPath();
        for (z = Z0; z <= zEnd; z += 1.5) {
          var rr2 = envR(z) * uu + 0.12 * uu * Math.sin(z * 0.22 + k * 1.3);
          if (z === Z0) ctx.moveTo(X(z), Y(rr2)); else ctx.lineTo(X(z), Y(rr2));
        }
        ctx.stroke();
      }
      // particles flowing once the beam is established
      if (front > Z1) {
        ctx.fillStyle = 'rgba(255,170,240,.95)';
        for (k = 0; k < NTRAJ; k += 2) {
          var uk = (k + 0.5) / NTRAJ, zp = Z0 + frac(ct * 0.55 + k * 0.137) * (Z1 - Z0);
          ctx.beginPath(); ctx.arc(X(zp), Y(envR(zp) * uk), 1.9, 0, TAU); ctx.fill();
        }
      }
      // beam front
      if (front <= Z1) {
        var fg = ctx.createRadialGradient(X(front), Y(0), 0, X(front), Y(0), 26);
        fg.addColorStop(0, 'rgba(255,230,250,.95)'); fg.addColorStop(0.4, 'rgba(250,90,215,.55)'); fg.addColorStop(1, 'rgba(250,90,215,0)');
        ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(X(front), Y(0), 26, 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    // electrodes
    ctx.fillStyle = '#8e8e95'; ctx.strokeStyle = '#5c5c63'; ctx.lineWidth = 1.3; ctx.lineJoin = 'round';
    var fills = this.elecFill;  // optional colours, e.g. by electrode potential
    [IB.PE, IB.EA, IB.EB, IB.EC].forEach(function (poly, k) {
      if (fills) ctx.fillStyle = fills[k];
      ctx.beginPath();
      poly.forEach(function (p, i) { if (i) ctx.lineTo(X(p[0]), Y(p[1])); else ctx.moveTo(X(p[0]), Y(p[1])); });
      ctx.closePath(); ctx.fill(); ctx.stroke();
    });
    // optimised electrode: candidate outlines coloured by fitness score, best in black
    var self = this, col = this.col;
    ctx.lineCap = 'round';
    this.cands.forEach(function (c) {
      var age = self.gen - c.born;
      HOT(c.fit, col);
      ctx.strokeStyle = rgba(col, Math.max(0.06, 0.32 - age * 0.04));
      ctx.lineWidth = 1.6;
      ctx.beginPath(); catmull(ctx, c.pts.map(function (p) { return [X(p[0]), Y(p[1])]; })); ctx.stroke();
    });
    ctx.strokeStyle = '#1a0003'; ctx.lineWidth = 3.2;
    ctx.beginPath(); catmull(ctx, this.best.map(function (p) { return [X(p[0]), Y(p[1])]; })); ctx.stroke();
    ctx.restore();
  };
  SceneIBSimu.prototype.drawBg = function (ctx, W, Hh) { // never changes: painted once, underneath
    var m = 12, rx = m + 6, rw = W - 2 * m - 6, ry = m, rh = Hh - 2 * m - 6;
    var X = function (z) { return rx + (z - Z0) / (Z1 - Z0) * rw; }, Y = function (r) { return ry + rh - (r / R1) * rh; };
    ctx.save();
    ctx.beginPath(); ctx.rect(rx, ry, rw, rh); ctx.clip();
    // light grid
    ctx.strokeStyle = '#f3ecee'; ctx.lineWidth = 1;
    for (var gz = 0; gz <= 100; gz += 20) { ctx.beginPath(); ctx.moveTo(X(gz), ry); ctx.lineTo(X(gz), ry + rh); ctx.stroke(); }
    for (var gr = 10; gr < R1; gr += 10) { ctx.beginPath(); ctx.moveTo(rx, Y(gr)); ctx.lineTo(rx + rw, Y(gr)); ctx.stroke(); }
    // equipotential lines
    ctx.strokeStyle = 'rgba(96,200,120,.55)'; ctx.lineWidth = 1.1;
    for (var e = 0; e < 11; e++) {
      var zz = 3.6 + e * 1.45, bulge = 1.6 * Math.exp(-Math.pow((zz - 10) / 6, 2)) + 0.4;
      ctx.beginPath();
      for (var rr = 0; rr <= 5.6; rr += 0.4) {
        var zq = zz + bulge * (1 - Math.pow(rr / 5.8, 2));
        if (rr) ctx.lineTo(X(zq), Y(rr)); else ctx.moveTo(X(zq), Y(rr));
      }
      ctx.stroke();
    }
    // plasma (left)
    var pg = ctx.createRadialGradient(X(-3), Y(0), 0, X(-3), Y(0), (X(6) - X(-3)) * 1.4);
    pg.addColorStop(0, 'rgba(255,90,215,.75)'); pg.addColorStop(0.6, 'rgba(255,120,225,.35)'); pg.addColorStop(1, 'rgba(255,140,230,0)');
    ctx.fillStyle = pg; ctx.fillRect(X(-3), Y(9), X(8) - X(-3), Y(0) - Y(9));
    // symmetry axis
    ctx.setLineDash([6, 5]); ctx.strokeStyle = 'rgba(70,70,80,.45)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(rx, Y(0) - 1); ctx.lineTo(rx + rw, Y(0) - 1); ctx.stroke(); ctx.setLineDash([]);
    ctx.restore();
    ctx.strokeStyle = 'rgba(0,0,0,.12)'; ctx.lineWidth = 1; ctx.strokeRect(rx + 0.5, ry + 0.5, rw - 1, rh - 1);
  };

  /* ================================================== stage configurations */
  var W6 = K.WINDOWS;

  // slide "A new optimisation platform ALESIA": one window, fitness landscape
  Deck.widget('alesia-landscape', K.makeWidget({
    windows: [{ title: 'alesia', status: 'finding minima ongoing', Scene: SceneLandscape, menu: [30, 38, 26, 34, 30], hub: true }],
    steps: 1, origin: [0.5, 0.5], printTime: 9000,
    layout: function (stage) {  // appears with "For each run" (first key press)
      var s = Math.min(1.12, this.W * 0.88 / K.WW, this.H * 0.88 / K.WH);
      return [stage < 1 ? null : { x: this.W * 0.5, y: this.H * 0.5, z: 0, ry: -13, rx: 2, s: s, o: 1, dim: 0 }];
    },
    appearFrom: function (t) { return { x: t.x + 60, y: t.y + 24, z: t.z - 200, ry: t.ry - 14, rx: t.rx, s: t.s * 0.94, o: 0, dim: 0 }; },
    appearDelay: function () { return 0.15; },
    every: function () { return 1; }
  }));

  // thank-you slide: everything connected through ALESIA (Bayesian optimisation)
  var HUB_WINDOWS = W6.concat([{ title: 'alesia', status: 'bayesian optimisation ongoing', Scene: SceneBayes, menu: [30, 38, 26, 44, 32, 28], hub: true, z: 20 }]);
  Deck.widget('alesia-hub', K.makeWidget({
    windows: HUB_WINDOWS,
    steps: 0, origin: [0.5, 0.5], printTime: 7000,
    layout: function () {
      var W = this.W, Hh = this.H, out = [], rows = [0.21, 0.5, 0.79];
      for (var i = 0; i < 6; i++) {
        var left = i < 3, row = rows[i % 3];
        out.push({ x: left ? W * 0.165 : W * 0.835, y: Hh * row, z: -40, ry: left ? 26 : -26, rx: 2, s: 0.5, o: 1, dim: 0 });
      }
      out.push({ x: W * 0.5, y: Hh * 0.5, z: 0, ry: 0, rx: 3, s: Math.min(0.94, Hh * 0.82 / K.WH), o: 1, dim: 0 });
      return out;
    },
    appearFrom: function (t, i) {
      if (i === 6) return { x: t.x, y: t.y + 30, z: t.z - 260, ry: t.ry, rx: t.rx + 6, s: t.s * 0.88, o: 0, dim: 0 };
      var dir = i < 3 ? -1 : 1;
      return { x: t.x + dir * 90, y: t.y + 20, z: t.z - 160, ry: t.ry - dir * 14, rx: t.rx, s: t.s * 0.92, o: 0, dim: 0 };
    },
    appearDelay: function (i) { return i === 6 ? 0.85 : 0.08 + i * 0.11; },
    links: W6.map(function (_, i) { return { a: i, b: 6, type: 'hub', from: 0, dv: [-120, 0, 120][i % 3] }; }),
    linkDelay: function (l) { return 1.5 + l.i * 0.1; },
    every: function (i) { return i === 6 ? 1 : 5; }
  }));

  // ECRIS: magnetic and mechanics windows of the title sequence + IBSimu beam extraction
  var ECRIS_WINDOWS = [W6[0], W6[1], { title: 'ibsimu', status: 'beam dynamics ongoing', Scene: SceneIBSimu, menu: [28, 36, 30, 40] }];
  Deck.widget('ecris-design', K.makeWidget({
    windows: ECRIS_WINDOWS,
    steps: 2, origin: [0.5, 0.46], gapMin: 70, overlapLen: 70, linkScale: 0.85, printTime: 12300,
    layout: function (stage) {
      var W = this.W, cy = this.H * 0.48, out = [];
      for (var i = 0; i < 3; i++) {
        if (i > stage) { out.push(null); continue; }
        if (i === stage) { out.push({ x: W * 0.7, y: cy, z: 0, ry: 13, rx: 2, s: 0.86, o: 1, dim: 0 }); continue; }
        if (stage === 1) { out.push({ x: W * 0.22, y: cy, z: -40, ry: 15, rx: 2, s: 0.66, o: 1, dim: 0.04 }); continue; }
        var k = stage - 1 - i;
        out.push({ x: W * 0.2 - k * 62, y: cy - k * 18, z: -100 - k * 42, ry: 32, rx: 2, s: 0.62 - k * 0.012, o: 1, dim: 0.07 + 0.08 * k });
      }
      return out;
    },
    appearFrom: function (t) { return { x: t.x + 90, y: t.y + 20, z: t.z - 200, ry: t.ry + 16, rx: t.rx, s: t.s * 0.92, o: 0, dim: t.dim }; },
    links: [{ a: 0, b: 1, type: 'flow', from: 1 }, { a: 1, b: 2, type: 'flow', from: 2 }]
  }));

  /* ================== design parameters (slide 4): drawings on the slide itself, no window
   *   <div data-widget="coil-params"></div>    superconducting magnet: 1/8 of a solenoid (coil) in its iron yoke,
   *                                            dimensions and current density changing (colour bar), next to the
   *                                            conductor animation of the title sequence
   *   <div data-widget="ibsimu-params"></div>  ECR ion source: beam extraction (IBSimu) with the electrodes coloured
   *                                            by their potential, which changes (colour bar)
   */
  var CM_J = H.cmap([[0, '#3b4cc0'], [0.25, '#2aa9d2'], [0.5, '#46c45a'], [0.75, '#f0cf38'], [1, '#e2372c']]);
  var CM_V = H.cmap([[0, '#2c5fd0'], [0.25, '#cfd0d6'], [0.62, '#f08a96'], [1, '#c3001c']]); // -10 … +30 kV (0 kV = grey)
  var V_MIN = -10, V_MAX = 30;
  // vertical colour bar: scale on the left, moving value markers (with labels kept apart) on the right
  function colourBar(ctx, x, y, w, h, cm, title, ticks, lo, hi, marks) {
    var col = [0, 0, 0];
    for (var i = 0; i < h; i++) { cm(1 - i / h, col); ctx.fillStyle = 'rgb(' + (col[0] | 0) + ',' + (col[1] | 0) + ',' + (col[2] | 0) + ')'; ctx.fillRect(x, y + i, w, 1.5); }
    ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.font = '600 14px Poppins, sans-serif'; ctx.fillStyle = '#46464e'; ctx.textAlign = 'center'; ctx.fillText(title, x + w / 2, y - 12);
    ctx.font = '12px Poppins, sans-serif'; ctx.fillStyle = '#8a8a93'; ctx.textAlign = 'right';
    ticks.forEach(function (v) { var yy = y + h * (1 - (v - lo) / (hi - lo)); ctx.fillRect(x - 4, yy - 0.5, 4, 1); ctx.fillText(String(v), x - 7, yy + 4); });
    var ms = (marks || []).map(function (m) { return { m: m, y: y + h * (1 - clamp01((m.v - lo) / (hi - lo))) }; });
    ms.sort(function (a, b) { return a.y - b.y; });
    ms.forEach(function (o, k) { o.ly = k ? Math.max(o.y, ms[k - 1].ly + 17) : o.y; });
    ms.forEach(function (o) {
      ctx.fillStyle = '#1f1f24'; ctx.fillRect(x, o.y - 1, w, 2);
      ctx.beginPath(); ctx.moveTo(x + w + 2, o.y); ctx.lineTo(x + w + 11, o.y - 6); ctx.lineTo(x + w + 11, o.y + 6); ctx.closePath(); ctx.fill();
      if (Math.abs(o.ly - o.y) > 1) { ctx.strokeStyle = '#8a8a93'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + w + 11, o.y); ctx.lineTo(x + w + 15, o.ly); ctx.stroke(); }
      ctx.font = '600 13px Poppins, sans-serif'; ctx.textAlign = 'left'; ctx.fillText(o.m.label, x + w + 16, o.ly + 4.5);
    });
  }

  // 1/8 of a solenoid: the coil (half length, full turn) and a quarter of its iron yoke, as in the SPIN ROTATORS model
  function SceneCoilYoke() { this.cam = new K.Cam(); this.rc = [0, 0, 0]; this.pr = new Float32Array(3); }
  SceneCoilYoke.prototype.fps = 15;
  SceneCoilYoke.prototype.dims = function (t) {
    var ri = 0.52 + 0.1 * Math.sin(0.5 * t), th = 0.3 + 0.1 * Math.sin(0.7 * t + 1), L = 3.3 + 0.45 * Math.sin(0.4 * t + 2);
    var ryi = ri + th + 0.1 + 0.05 * Math.sin(0.45 * t + 0.4), yt = 0.62 + 0.2 * Math.sin(0.6 * t + 0.5), Ly = L + 0.35 + 0.3 * Math.sin(0.45 * t + 1.2);
    var J = 105 + 75 * Math.sin(0.55 * t + 0.7);   // 30 … 180 A/mm² on a 0 … 200 scale
    return { ri: ri, ro: ri + th, L: L, ryi: ryi, ryo: ryi + yt, Ly: Ly, J: J };
  };
  SceneCoilYoke.prototype.draw = function (ctx, W, Hh, t) {
    var d = this.dims(t), cam = this.cam, rc = this.rc, faces = [], self = this;
    var barW = 110, VW = W - barW;
    cam.yaw = 0.78 + 0.05 * Math.sin(0.23 * t); cam.pitch = 0.42; cam.dist = 7; cam.focal = 1; cam.cx = 0; cam.cy = 0; cam.update();
    // fixed framing from the largest dimensions reached (so the changes stay visible and nothing is clipped)
    var bx0 = 1e9, bx1 = -1e9, by0 = 1e9, by1 = -1e9, pr0 = this.pr;
    function fitPt(x, y, z) { cam.proj(x, y, z, pr0, 0); bx0 = Math.min(bx0, pr0[0]); bx1 = Math.max(bx1, pr0[0]); by0 = Math.min(by0, pr0[1]); by1 = Math.max(by1, pr0[1]); }
    for (var s0 = 0; s0 < 24; s0++) {
      var aa = s0 / 24 * TAU, aq0 = s0 / 23 * Math.PI / 2;
      fitPt(1.02 * Math.cos(aa), 0, 1.02 * Math.sin(aa)); fitPt(1.02 * Math.cos(aa), 3.75, 1.02 * Math.sin(aa));       // coil (max radius, max length)
      fitPt(1.99 * Math.cos(aq0), 0, 1.99 * Math.sin(aq0)); fitPt(1.99 * Math.cos(aq0), 4.4, 1.99 * Math.sin(aq0));    // yoke (max radius, max length)
    }
    var mL = 58, mR = 14, mT = 30, mB = 46, fs = Math.min((VW - mL - mR) / (bx1 - bx0), (Hh - mT - mB) / (by1 - by0));
    cam.focal = fs;
    cam.cx = mL + ((VW - mL - mR) - (bx1 - bx0) * fs) / 2 - bx0 * fs;
    cam.cy = mT + ((Hh - mT - mB) - (by1 - by0) * fs) / 2 - by0 * fs;
    var jc = CM_J(clamp01(d.J / 200), [0, 0, 0]), iron = [86, 112, 196];
    var NA = 36, NL = 5, NQ = 10;
    function P(r, a, y) { return [r * Math.cos(a), y, r * Math.sin(a)]; }
    function face(pts, n, col, kind, edges) { faces.push({ p: pts, n: n, c: col, k: kind, e: edges }); }
    var i, j, a0, a1, y0, y1;
    for (i = 0; i < NA; i++) {           // coil: outer, inner (bore) surfaces and the end face at the symmetry plane
      a0 = i / NA * TAU; a1 = (i + 1) / NA * TAU;
      var am = (a0 + a1) / 2, axial = i % 3 === 0 ? 1 : 0;
      for (j = 0; j < NL; j++) {
        y0 = d.L * j / NL; y1 = d.L * (j + 1) / NL;
        face([P(d.ro, a0, y0), P(d.ro, a1, y0), P(d.ro, a1, y1), P(d.ro, a0, y1)], [Math.cos(am), 0, Math.sin(am)], jc, 0, axial | 2);
        face([P(d.ri, a0, y1), P(d.ri, a1, y1), P(d.ri, a1, y0), P(d.ri, a0, y0)], [-Math.cos(am), 0, -Math.sin(am)], jc, 0, 0);
      }
      face([P(d.ri, a0, 0), P(d.ri, a1, 0), P(d.ro, a1, 0), P(d.ro, a0, 0)], [0, -1, 0], jc, 0, (i % 3 === 0 ? 8 : 0) | 1 | 4);
      face([P(d.ro, a0, d.L), P(d.ro, a1, d.L), P(d.ri, a1, d.L), P(d.ri, a0, d.L)], [0, 1, 0], jc, 0, 0);
    }
    for (i = 0; i < NQ; i++) {           // yoke: a quarter of a thick tube, beside the coil
      a0 = i / NQ * Math.PI / 2; a1 = (i + 1) / NQ * Math.PI / 2;
      var aq = (a0 + a1) / 2;
      for (j = 0; j < NL; j++) {
        y0 = d.Ly * j / NL; y1 = d.Ly * (j + 1) / NL;
        face([P(d.ryo, a0, y0), P(d.ryo, a1, y0), P(d.ryo, a1, y1), P(d.ryo, a0, y1)], [Math.cos(aq), 0, Math.sin(aq)], iron, 1, 15);
        face([P(d.ryi, a0, y1), P(d.ryi, a1, y1), P(d.ryi, a1, y0), P(d.ryi, a0, y0)], [-Math.cos(aq), 0, -Math.sin(aq)], iron, 1, 15);
      }
      face([P(d.ryi, a0, 0), P(d.ryi, a1, 0), P(d.ryo, a1, 0), P(d.ryo, a0, 0)], [0, -1, 0], iron, 1, 15);
      face([P(d.ryo, a0, d.Ly), P(d.ryo, a1, d.Ly), P(d.ryi, a1, d.Ly), P(d.ryi, a0, d.Ly)], [0, 1, 0], iron, 1, 15);
    }
    for (j = 0; j < NL; j++) {           // flat sides of the yoke quarter
      y0 = d.Ly * j / NL; y1 = d.Ly * (j + 1) / NL;
      face([P(d.ryi, 0, y0), P(d.ryo, 0, y0), P(d.ryo, 0, y1), P(d.ryi, 0, y1)], [0, 0, -1], iron, 1, 15);
      face([P(d.ryo, Math.PI / 2, y0), P(d.ryi, Math.PI / 2, y0), P(d.ryi, Math.PI / 2, y1), P(d.ryo, Math.PI / 2, y1)], [-1, 0, 0], iron, 1, 15);
    }
    // keep front faces, light them, sort far → near
    var pr = this.pr, L0 = [-0.35, -0.75, 0.56];
    var vis = [];
    faces.forEach(function (f) {
      var cxw = 0, cyw = 0, czw = 0;
      f.p.forEach(function (q) { cxw += q[0]; cyw += q[1]; czw += q[2]; });
      cxw /= f.p.length; cyw /= f.p.length; czw /= f.p.length;
      cam.rot(f.n[0], f.n[1], f.n[2], rc); var n0 = rc[0], n1 = rc[1], n2 = rc[2];
      cam.rot(cxw, cyw, czw, rc);
      if (n0 * -rc[0] + n1 * -(cam.dist + rc[1]) + n2 * -rc[2] <= 0) return;
      var sp = f.p.map(function (q) { cam.proj(q[0], q[1], q[2], pr, 0); return [pr[0], pr[1], pr[2]]; });
      var dep = 0; sp.forEach(function (q) { dep += q[2]; });
      var lam = Math.max(0, f.n[0] * L0[0] + f.n[1] * L0[1] + f.n[2] * L0[2]);
      vis.push({ s: sp, d: dep / sp.length, f: 0.55 + 0.5 * lam, c: f.c, k: f.k, e: f.e });
    });
    vis.sort(function (A, B) { return B.d - A.d; });
    ctx.lineJoin = 'round';
    vis.forEach(function (v) {
      var c = v.c, cs = 'rgb(' + Math.min(255, c[0] * v.f) + ',' + Math.min(255, c[1] * v.f) + ',' + Math.min(255, c[2] * v.f) + ')';
      ctx.beginPath(); ctx.moveTo(v.s[0][0], v.s[0][1]);
      for (var q = 1; q < v.s.length; q++) ctx.lineTo(v.s[q][0], v.s[q][1]);
      ctx.closePath(); ctx.fillStyle = cs; ctx.strokeStyle = cs; ctx.lineWidth = 0.8; ctx.fill(); ctx.stroke();
      if (!v.e) return;  // mesh lines: red on the coil, light lines on the iron
      ctx.strokeStyle = v.k === 0 ? 'rgba(200,0,20,.85)' : 'rgba(205,218,255,.45)'; ctx.lineWidth = v.k === 0 ? 1 : 0.7;
      ctx.beginPath();
      for (var e = 0; e < 4; e++) {
        if (!(v.e & (1 << e))) continue;
        var A = v.s[e], B = v.s[(e + 1) % 4];
        ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]);
      }
      ctx.stroke();
    });
    // labels
    function label(text, wx, wy, wz, dx, dy) {
      cam.proj(wx, wy, wz, pr, 0);
      var x = pr[0], y = pr[1];
      ctx.strokeStyle = '#46464e'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + dx, y + dy); ctx.stroke();
      ctx.fillStyle = '#1f1f24'; ctx.font = '600 16px Poppins, sans-serif'; ctx.textAlign = dx < 0 ? 'right' : 'left';
      ctx.fillText(text, x + dx + (dx < 0 ? -4 : 4), y + dy + 5);
    }
    label('coil', d.ro * Math.cos(4.2), d.L * 0.3, d.ro * Math.sin(4.2), -18, 40);
    label('yoke (iron)', d.ryo * Math.cos(1.1), d.Ly * 0.55, d.ryo * Math.sin(1.1), 30, -22);
    colourBar(ctx, VW + 34, 34, 16, Hh - 66, CM_J, 'J (A/mm²)', [0, 50, 100, 150, 200], 0, 200, [{ v: d.J, label: String(Math.round(d.J)) }]);
  };

  // IBSimu on slide 4: electrodes coloured by their potential, which changes
  var ELEC = [{ name: 'plasma', v: function (t) { return 24 + 5 * Math.sin(0.5 * t); } },
    { name: 'puller', v: function (t) { return -5 + 3.5 * Math.sin(0.65 * t + 1); } },
    { name: 'screen', v: function (t) { return -1.6 + 1.4 * Math.sin(0.8 * t + 2); } },
    { name: 'ground', v: function () { return 0; } }];
  function SceneIBSimuV() { SceneIBSimu.call(this); this.elecFill = ['#888', '#888', '#888', '#888']; }
  SceneIBSimuV.prototype = Object.create(SceneIBSimu.prototype);
  SceneIBSimuV.prototype.fps = 20;
  // the drawing keeps the proportions of slide 7 (about 1.95 : 1), the colour bar follows it, the group is centred
  function ibGeom(W, Hh) { var DW = Math.min(W - 190, Hh * 1.95), ox = Math.max(0, (W - DW - 190) / 2); return { ox: ox, DW: DW }; }
  SceneIBSimuV.prototype.draw = function (ctx, W, Hh, t) {
    var col = [0, 0, 0], self = this, g = ibGeom(W, Hh);
    ELEC.forEach(function (e, k) { CM_V((e.v(t) - V_MIN) / (V_MAX - V_MIN), col); self.elecFill[k] = 'rgb(' + (col[0] | 0) + ',' + (col[1] | 0) + ',' + (col[2] | 0) + ')'; });
    ctx.save(); ctx.translate(g.ox, 0);
    SceneIBSimu.prototype.draw.call(this, ctx, g.DW, Hh, t);
    ctx.restore();
    colourBar(ctx, g.ox + g.DW + 44, 34, 16, Hh - 66, CM_V, 'V (kV)', [-10, 0, 10, 20, 30], V_MIN, V_MAX,
      ELEC.map(function (e) { var v = e.v(t); return { v: v, label: e.name + ' ' + (v >= 0 ? '+' : '') + v.toFixed(1) }; }));
  };
  SceneIBSimuV.prototype.drawBg = function (ctx, W, Hh) {
    var g = ibGeom(W, Hh);
    ctx.save(); ctx.translate(g.ox, 0); SceneIBSimu.prototype.drawBg.call(this, ctx, g.DW, Hh); ctx.restore();
  };

  // a strip of canvases drawn directly on the slide (no window), each with its scene
  function panelWidget(parts, labels) {
    return {
      mount: function (el, api) {
        el.style.display = 'flex'; el.style.gap = '18px';
        var items = parts.map(function (p, i) {
          var box = document.createElement('div');
          box.style.cssText = 'position:relative;flex:' + p.flex + ';min-width:0;height:100%';
          var bg = p.Scene.prototype.drawBg ? document.createElement('canvas') : null, c = document.createElement('canvas');
          [bg, c].forEach(function (cv) { if (cv) { cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%'; box.appendChild(cv); } });
          if (labels && labels[i]) {
            var lab = document.createElement('div');
            lab.textContent = labels[i];
            lab.style.cssText = 'position:absolute;left:4px;top:-20px;font:600 16px Poppins,system-ui,sans-serif;color:#8a8a93;z-index:1';
            box.appendChild(lab);
          }
          el.appendChild(box);
          return { box: box, c: c, bg: bg, Scene: p.Scene, scene: null, k: 0, w: 0, h: 0, n: 0 };
        });
        var active = false, t0 = 0, frame = 0;
        function size(it) {
          var Q = Deck.quality, w = it.box.clientWidth, h = it.box.clientHeight, k = Math.min(Q ? Q.kMax : 1.5, (window.devicePixelRatio || 1) * (api.scale || 1));
          if (!w || !h) return false;
          if (w !== it.w || h !== it.h || Math.abs(k - it.k) > 0.05) {
            it.w = w; it.h = h; it.k = k;
            [it.c, it.bg].forEach(function (cv) { if (cv) { cv.width = Math.round(w * k); cv.height = Math.round(h * k); } });
            if (it.bg && it.scene) { var b = it.bg.getContext('2d'); b.setTransform(k, 0, 0, k, 0, 0); it.scene.drawBg(b, w, h); }
          }
          return true;
        }
        function draw(now, force) {
          var t = (now - t0) / 1000, fps = Deck.quality ? Deck.quality.fps : 30;
          frame++;
          items.forEach(function (it) {
            if (!it.scene) { it.scene = new it.Scene(); it.w = 0; }
            var every = Math.max(1, Math.round(fps / (it.scene.fps || fps)));
            if (!force && frame % every) return;
            if (!size(it)) return;
            var ctx = it.c.getContext('2d');
            ctx.setTransform(it.k, 0, 0, it.k, 0, 0); ctx.clearRect(0, 0, it.w, it.h);
            if (it.bg && Deck.printing) { // PDF export drops a canvas stacked under another: flatten
              ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(it.bg, 0, 0); ctx.setTransform(it.k, 0, 0, it.k, 0, 0);
            }
            try { it.scene.draw(ctx, it.w, it.h, t); } catch (e) { console.error('[panel]', e); }
          });
        }
        function tick(now) { if (active) draw(now); }
        return {
          enter: function () { active = true; t0 = performance.now(); items.forEach(function (it) { it.scene = null; }); Deck.ticker.add(tick); },
          leave: function () { active = false; Deck.ticker.remove(tick); },
          resize: function () { items.forEach(function (it) { it.w = 0; }); if (active) draw(performance.now(), true); },
          print: function () { t0 = performance.now() - 9000; items.forEach(function (it) { it.scene = null; }); draw(performance.now(), true); }
        };
      }
    };
  }
  Deck.widget('coil-params', panelWidget([{ Scene: SceneCoilYoke, flex: 1.15 }, { Scene: K.scenes.SceneConductor, flex: 1 }], ['Coil and yoke', 'Conductor']));
  Deck.widget('ibsimu-params', panelWidget([{ Scene: SceneIBSimuV, flex: 1 }], ['Beam extraction electrodes']));

  /* ============================== live workflow (slide "A new optimisation platform") */
  var MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, "DejaVu Sans Mono", monospace';

  // ---- pandas DataFrame (inputs) -------------------------------------------
  var DF_COLS = ['', 'R_coil', 'Z_coil', 'J_e', 'T_op', 'B_peak', 'F_lap', 'σ_vm', 'T_hot', 'score'];
  function SceneDataFrame() { this.R = rng(1234); this.rows = []; this.n = 4810; for (var i = 0; i < 26; i++) this.addRow(); }
  SceneDataFrame.prototype.addRow = function () {
    var R = this.R, T = R() < 0.7 ? 1.94 : 4.55;
    this.rows.push({ id: this.n++, born: this.tNow || -9, v: [
      (10 + 240 * R()).toFixed(1), (900 + 2200 * R()).toFixed(0), (20 + 80 * R()).toFixed(1), T.toFixed(2),
      (5 + 4 * R()).toFixed(2), (0.2 + 2.8 * R()).toFixed(2), (40 + 160 * R()).toFixed(0), (60 + 120 * R()).toFixed(0),
      (Math.pow(10, 2 + 8 * R())).toExponential(2)] });
    if (this.rows.length > 40) this.rows.shift();
  };
  SceneDataFrame.prototype.draw = function (ctx, W, Hh, t) {
    this.tNow = t;
    var lh = 17, top = 34, colW = (W - 54) / 9, speed = 1 / 0.9;
    var target = Math.floor(t * speed);
    while (this.added == null || this.added < target) { this.added = (this.added == null ? 0 : this.added + 1); if (this.added > 0) this.addRow(); }
    ctx.font = '600 12px ' + MONO; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#b8001a'; ctx.fillText('In [12]:', 10, 13);
    ctx.fillStyle = '#26262b'; ctx.font = '12px ' + MONO; ctx.fillText('df.tail(20)', 78, 13);
    // header
    ctx.fillStyle = '#fbeff1'; ctx.fillRect(4, top - 10, W - 8, lh);
    ctx.font = '700 11px ' + MONO; ctx.fillStyle = '#26262b'; ctx.textAlign = 'right';
    for (var c = 1; c < DF_COLS.length; c++) ctx.fillText(DF_COLS[c], 50 + c * colW - 4, top - 1);
    ctx.strokeStyle = '#e9d3d7'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(4, top + 7.5); ctx.lineTo(W - 4, top + 7.5); ctx.stroke();
    // rows (newest at the bottom, gently scrolling)
    ctx.save(); ctx.beginPath(); ctx.rect(0, top + 8, W, Hh - top - 30); ctx.clip();
    var frac2 = (t * speed) % 1, rows = this.rows, nVis = Math.ceil((Hh - top - 30) / lh) + 1;
    for (var k = 0; k < nVis; k++) {
      var ri = rows.length - 1 - k; if (ri < 0) break;
      var row = rows[ri], y = Hh - 30 - lh * (k + 0.5) + (1 - easeOut(frac2)) * lh * 0;
      if (ri % 2) { ctx.fillStyle = '#faf7f8'; ctx.fillRect(4, y - lh / 2, W - 8, lh); }
      var age = t - row.born;
      if (age < 1.2) { ctx.fillStyle = 'rgba(229,0,25,' + (0.16 * (1 - age / 1.2)) + ')'; ctx.fillRect(4, y - lh / 2, W - 8, lh); }
      ctx.font = '700 11px ' + MONO; ctx.fillStyle = '#6b6b73'; ctx.textAlign = 'left';
      ctx.fillText(String(row.id), 8, y);
      ctx.font = '11px ' + MONO; ctx.fillStyle = '#26262b'; ctx.textAlign = 'right';
      for (c = 0; c < 9; c++) ctx.fillText(row.v[c], 50 + (c + 1) * colW - 4, y);
    }
    ctx.restore();
    ctx.textAlign = 'left'; ctx.font = '11px ' + MONO; ctx.fillStyle = '#8a8a93';
    ctx.fillText('[' + this.n.toLocaleString('en').replace(/,/g, ' ') + ' rows × 9 columns]', 10, Hh - 12);
  };

  // ---- SQL query (ALESIA database) ------------------------------------------
  var SQL = [
    [['k', 'SELECT'], ['', ' name, rho, E, k_T, cp_T']],
    [['k', '  FROM'], ['', ' materials m']],
    [['k', '  JOIN'], ['', ' conductor_fits f '], ['k', 'ON'], ['', ' f.id = m.fit_id']],
    [['k', ' WHERE'], ['', ' T_K '], ['k', 'BETWEEN'], ['n', ' 1.9'], ['k', ' AND'], ['n', ' 4.5']],
    [['k', '   AND'], ['', ' f.model = '], ['s', "'Bottura'"]],
    [['k', ' ORDER BY'], ['', ' name;']]
  ];
  var SQL_RES = [['name', 'rho', 'E', 'k_T', 'cp_T'], ['Nb-Ti', '6.0e3', '82e9', '0.12', '0.39'], ['Cu RRR100', '8.9e3', '127e9', '1.6e3', '0.09'],
    ['G10', '1.9e3', '30e9', '0.07', '1.12'], ['SS 316LN', '7.9e3', '205e9', '0.24', '1.96'], ['Al 5083', '2.7e3', '79e9', '4.10', '0.27']];
  var SQL_COL = { k: '#c0001a', n: '#2257c9', s: '#178a45', '': '#26262b' };
  var SQL_LEN = SQL.reduce(function (a, l) { return a + l.reduce(function (b, tk) { return b + tk[1].length; }, 0); }, 0);
  function SceneSQL() {}
  SceneSQL.prototype.draw = function (ctx, W, Hh, t) {
    var cycle = 13, ct = t % cycle, chars = Math.floor(ct * 30), lh = 18, x0 = 38, y0 = 16;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fbf6f7'; ctx.fillRect(0, 0, 28, Hh);
    ctx.font = '12px ' + MONO;
    var shown = 0, cx = 0, cy = 0;
    for (var li = 0; li < SQL.length; li++) {
      var y = y0 + li * lh, x = x0;
      ctx.fillStyle = '#b9aeb1'; ctx.textAlign = 'right'; ctx.fillText(String(li + 1), 22, y); ctx.textAlign = 'left';
      for (var ti = 0; ti < SQL[li].length; ti++) {
        var tk = SQL[li][ti], txt2 = tk[1], take = Math.max(0, Math.min(txt2.length, chars - shown));
        shown += txt2.length;
        if (!take) continue;
        ctx.font = (tk[0] === 'k' ? '700 ' : '') + '12px ' + MONO;
        ctx.fillStyle = SQL_COL[tk[0]];
        var part = txt2.slice(0, take);
        ctx.fillText(part, x, y);
        x += ctx.measureText(part).width;
        cx = x; cy = y;
      }
      if (shown >= chars) break;
    }
    if (chars < SQL_LEN && Math.floor(t * 2.2) % 2 === 0) { ctx.fillStyle = '#E50019'; ctx.fillRect(cx + 1, cy - 7, 7, 14); }
    // result grid
    var rt = ct - SQL_LEN / 30 - 0.4;
    if (rt > 0) {
      var gy = y0 + SQL.length * lh + 6, cw = (W - 50) / 5, rh = 17;
      ctx.font = '11px ' + MONO;
      ctx.fillStyle = '#8a8a93'; ctx.fillText('✓ 5 rows  (3 ms)', x0, gy + 4);
      for (var r = 0; r < SQL_RES.length; r++) {
        var show = clamp01(rt * 4 - r);
        if (show <= 0) break;
        var yy = gy + 20 + r * rh;
        ctx.globalAlpha = show;
        ctx.fillStyle = r === 0 ? '#fbeff1' : (r % 2 ? '#fff' : '#faf7f8'); ctx.fillRect(x0 - 4, yy - rh / 2, W - x0 - 8, rh);
        ctx.font = (r === 0 ? '700 ' : '') + '11px ' + MONO; ctx.fillStyle = '#26262b';
        for (var c = 0; c < 5; c++) ctx.fillText(SQL_RES[r][c], x0 + c * cw, yy);
        ctx.globalAlpha = 1;
      }
    }
  };

  // ---- Python score function ---------------------------------------------
  var PY = [
    [['k', 'def'], ['f', ' score'], ['', '(y, t, w):']],
    [['', '    '], ['s', '"""Weighted distance to the targets."""']],
    [['', '    '], ['k', 'return'], ['b', ' sum'], ['', '(w[k] * (y[k] - t[k]) ** '], ['n', '2']],
    [['', '               '], ['k', 'for'], ['', ' k '], ['k', 'in'], ['', ' t)']],
    [['', '']],
    [['k', 'for'], ['', ' run '], ['k', 'in'], ['', ' finished_runs():']],
    [['', '    run.score = score(run.y, targets, weights)']]
  ];
  var PY_COL = { k: '#c0001a', f: '#7a3fb8', s: '#178a45', n: '#2257c9', b: '#b06a00', '': '#26262b' };
  function SceneScore() { this.R = rng(77); this.log = []; this.best = 1e9; this.n = 4810; }
  SceneScore.prototype.draw = function (ctx, W, Hh, t) {
    var lh = 17, x0 = 38, y0 = 15;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fbf6f7'; ctx.fillRect(0, 0, 28, Hh * 0.62);
    for (var li = 0; li < PY.length; li++) {
      var y = y0 + li * lh, x = x0;
      ctx.font = '12px ' + MONO; ctx.fillStyle = '#b9aeb1'; ctx.textAlign = 'right'; ctx.fillText(String(li + 1), 22, y); ctx.textAlign = 'left';
      for (var ti = 0; ti < PY[li].length; ti++) {
        var tk = PY[li][ti];
        ctx.font = (tk[0] === 'k' || tk[0] === 'f' ? '700 ' : '') + '12px ' + MONO;
        ctx.fillStyle = PY_COL[tk[0]];
        ctx.fillText(tk[1], x, y);
        x += ctx.measureText(tk[1]).width;
      }
    }
    // console: one new score per evaluation, best in green
    var cTop = y0 + PY.length * lh + 6;
    ctx.fillStyle = '#26262b'; ctx.fillRect(6, cTop, W - 12, Hh - cTop - 6);
    var target = Math.floor(t / 0.8);
    while ((this.done || 0) < target) {
      this.done = (this.done || 0) + 1;
      var prog = Math.min(1, this.done / 40), R = this.R;
      var sc = Math.pow(10, 2.6 + 5.5 * Math.pow(R(), 1.6) * (1 - 0.65 * prog));
      this.best = Math.min(this.best, sc);
      this.log.push({ id: this.n++, s: sc, best: sc <= this.best, born: t });
      if (this.log.length > 12) this.log.shift();
      if (this.done > 60) { this.done = 0; this.best = 1e9; this.log = []; }
    }
    var lines = Math.floor((Hh - cTop - 14) / 15);
    ctx.font = '11px ' + MONO;
    for (var k = 0; k < Math.min(lines, this.log.length); k++) {
      var e = this.log[this.log.length - 1 - k], yy = Hh - 16 - k * 15;
      ctx.globalAlpha = Math.min(1, (t - e.born) * 4) * (1 - k / (lines + 2));
      ctx.fillStyle = '#8f8f99'; ctx.fillText('run ' + e.id, 14, yy);
      ctx.fillStyle = e.best ? '#3ddc84' : '#f2f2f4'; ctx.fillText('score = ' + e.s.toExponential(2), 104, yy);
      var bw = Math.max(2, Math.min(W - 300, (Math.log10(e.s) - 2) * 26));
      ctx.fillStyle = e.best ? '#3ddc84' : '#ff6b7d'; ctx.fillRect(270, yy - 4, bw, 8);
      ctx.globalAlpha = 1;
    }
  };

  // ---- Word document (project requirements) -------------------------------
  var REQ = [['FOM', '15.3 / 46.75 T·m'], ['B_quad', '< 1.5 G'], ['B_RCS', '< 3 G'], ['Von Mises', '< 150 MPa'], ['Hotspot', '< 150 K'], ['T_c margin', '> 1.2 K'], ['Bore', '100 mm'], ['Cryostat', '≤ 1200 mm']];
  function SceneWord() {}
  SceneWord.prototype.draw = function (ctx, W, Hh, t) {
    ctx.fillStyle = '#2b579a'; ctx.fillRect(0, 0, W, 22);                // ribbon
    ctx.fillStyle = 'rgba(255,255,255,.75)';
    for (var i = 0; i < 9; i++) ctx.fillRect(12 + i * 40, 8, 26, 6);
    ctx.fillStyle = '#e9ebef'; ctx.fillRect(0, 22, W, Hh - 22);           // canvas grey
    ctx.fillStyle = '#f7f7f8'; ctx.fillRect(0, 22, W, 12);                // ruler
    ctx.strokeStyle = '#c9ccd2'; ctx.lineWidth = 1;
    for (i = 0; i < 40; i++) { var rx = 60 + i * 12; ctx.beginPath(); ctx.moveTo(rx, 30); ctx.lineTo(rx, i % 4 ? 33 : 28); ctx.stroke(); }
    var pw = W * 0.7, px = (W - pw) / 2, scroll = (t * 9) % 260, py = 44 - scroll;
    ctx.save(); ctx.beginPath(); ctx.rect(0, 36, W, Hh - 36); ctx.clip();
    for (var pg = 0; pg < 2; pg++) {
      var top = py + pg * 420;
      ctx.fillStyle = 'rgba(0,0,0,.08)'; ctx.fillRect(px + 3, top + 3, pw, 400);
      ctx.fillStyle = '#fff'; ctx.fillRect(px, top, pw, 400);
      var x = px + 26, y = top + 28;
      ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
      ctx.fillStyle = '#1f3864'; ctx.font = '700 15px Poppins, sans-serif'; ctx.fillText('Project requirements', x, y);
      ctx.fillStyle = '#6b6b73'; ctx.font = '11px Poppins, sans-serif'; ctx.fillText('SPIN ROTATORS — conceptual design', x, y + 18);
      ctx.fillStyle = '#d5d8de';
      [0.92, 0.86, 0.95, 0.6].forEach(function (f, k) { ctx.fillRect(x, y + 36 + k * 11, (pw - 52) * f, 5); });
      var ty = y + 88, cw = (pw - 52) / 2;
      ctx.fillStyle = '#2b579a'; ctx.fillRect(x, ty - 8, pw - 52, 16);
      ctx.fillStyle = '#fff'; ctx.font = '700 10px Poppins, sans-serif'; ctx.fillText('Target', x + 6, ty); ctx.fillText('Value', x + cw + 6, ty);
      ctx.font = '10px Poppins, sans-serif';
      REQ.forEach(function (r, k) {
        var yy = ty + 16 + k * 16;
        ctx.fillStyle = k % 2 ? '#fff' : '#eef2f8'; ctx.fillRect(x, yy - 8, pw - 52, 16);
        ctx.fillStyle = '#26262b'; ctx.fillText(r[0], x + 6, yy); ctx.fillText(r[1], x + cw + 6, yy);
      });
      ctx.fillStyle = '#d5d8de';
      [0.9, 0.97, 0.8, 0.94, 0.55].forEach(function (f, k) { ctx.fillRect(x, ty + 160 + k * 11, (pw - 52) * f, 5); });
      // a line being edited
      var hl = (Math.floor(t / 2.5) + pg) % REQ.length;
      ctx.fillStyle = 'rgba(255,214,0,.35)'; ctx.fillRect(x, ty + 16 + hl * 16 - 8, pw - 52, 16);
    }
    ctx.restore();
  };

  // ---- HPC terminals (ALESIA manager: Slurm jobs running in parallel) -------
  var SL = { bg: '#1e2026', head: '#2b2e36', ink: '#e6e6eb', dim: '#8f93a0', ok: '#3ddc84', wait: '#ffcf4a', end: '#9aa0ad', red: '#ff8796' };
  function SceneSlurm() { this.R = rng(4242); this.jobs = []; this.nextId = 481230; this.lastSub = -0.4; }
  SceneSlurm.prototype.fps = 8;
  SceneSlurm.prototype.update = function (t) {
    while (this.lastSub + 0.5 <= t) {           // a new run is submitted every 0.5 s
      this.lastSub += 0.5;
      var R = this.R, ts = this.lastSub, st = ts + 0.5 + 1.6 * R(), id = this.nextId++;
      this.jobs.push({ id: id, name: 'run_' + String(id - 477000).padStart(4, '0'), ts: ts, start: st, end: st + 3 + 5 * R(), node: 12 + (id % 6) });
      if (this.jobs.length > 60) this.jobs.shift();
    }
  };
  function mmss(x) { x = Math.max(0, Math.floor(x)); return Math.floor(x / 60) + ':' + String(x % 60).padStart(2, '0'); }
  SceneSlurm.prototype.draw = function (ctx, W, Hh, t) {
    this.update(t);
    var g = 6, lw = Math.round(W * 0.58), rw = W - lw - 3 * g, hh = 17, rh = Math.round((Hh - 3 * g) * 0.5);
    ctx.fillStyle = '#f3eef0'; ctx.fillRect(0, 0, W, Hh);
    var panes = [[g, g, lw, Hh - 2 * g, 'squeue'], [2 * g + lw, g, rw, rh, 'sbatch'], [2 * g + lw, 2 * g + rh, rw, Hh - 3 * g - rh, 'sinfo']];
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    panes.forEach(function (p) {
      ctx.fillStyle = SL.bg; roundRect(ctx, p[0], p[1], p[2], p[3], 5); ctx.fill();
      ctx.fillStyle = SL.head; ctx.fillRect(p[0], p[1] + 5, p[2], hh - 5); roundRect(ctx, p[0], p[1], p[2], 10, 5); ctx.fill();
      ctx.font = '600 10px ' + MONO; ctx.fillStyle = SL.dim; ctx.fillText('alesia@hpc · ' + p[4], p[0] + 8, p[1] + hh / 2 + 0.5);
    });
    var jobs = this.jobs, x0 = panes[0][0] + 8, y = panes[0][1] + hh + 11, lh = 14.5;
    // squeue
    ctx.font = '11px ' + MONO; ctx.fillStyle = SL.red; ctx.fillText('$', x0, y);
    ctx.fillStyle = SL.ink; ctx.fillText('squeue -u alesia', x0 + 12, y);
    y += lh + 2;
    var cols = [0, 52, 124, 146, 186], hdr = ['JOBID', 'NAME', 'ST', 'TIME', 'NODE'];
    ctx.font = '700 10.5px ' + MONO; ctx.fillStyle = SL.dim;
    hdr.forEach(function (h, k) { ctx.fillText(h, x0 + cols[k], y); });
    y += lh;
    var live = jobs.filter(function (j) { return j.ts <= t && t < j.end + 0.8; }), rows = Math.floor((panes[0][1] + panes[0][3] - y) / lh);
    live = live.slice(Math.max(0, live.length - rows));
    ctx.font = '10.5px ' + MONO;
    live.forEach(function (j, k) {
      var yy = y + k * lh, stt = t < j.start ? 'PD' : t < j.end ? 'R' : 'CG';
      var col = stt === 'R' ? SL.ok : stt === 'PD' ? SL.wait : SL.end;
      if (t - j.ts < 0.4) { ctx.fillStyle = 'rgba(255,135,150,.16)'; ctx.fillRect(x0 - 4, yy - lh / 2, lw - 8, lh); }
      ctx.fillStyle = SL.ink; ctx.fillText(String(j.id), x0 + cols[0], yy); ctx.fillText(j.name, x0 + cols[1], yy);
      ctx.fillStyle = col; ctx.font = '700 10.5px ' + MONO; ctx.fillText(stt, x0 + cols[2], yy); ctx.font = '10.5px ' + MONO;
      ctx.fillStyle = SL.ink; ctx.fillText(stt === 'PD' ? '0:00' : mmss((Math.min(t, j.end) - j.start) * 37), x0 + cols[3], yy);
      ctx.fillStyle = SL.dim; ctx.fillText(stt === 'PD' ? '(Priority)' : 'n0' + j.node, x0 + cols[4], yy);
    });
    // sbatch: one line per submitted run
    var p1 = panes[1], sx = p1[0] + 8, top1 = p1[1] + hh + 10, n1 = Math.floor((p1[3] - hh - 6) / lh);
    var subs = jobs.filter(function (j) { return j.ts <= t; }).slice(-n1);
    ctx.font = '10.5px ' + MONO;
    subs.forEach(function (j, k) {
      var yy = top1 + k * lh, fresh = t - j.ts < 0.5;
      ctx.fillStyle = fresh ? SL.ok : SL.dim; ctx.fillText('Submitted batch job ' + j.id, sx, yy);
    });
    // sinfo-like node load: running runs per node
    var p2 = panes[2], bx = p2[0] + 44, by = p2[1] + hh + 9, bw = p2[2] - 52, nodes = [0, 0, 0, 0, 0, 0];
    jobs.forEach(function (j) { if (j.start <= t && t < j.end) nodes[j.node - 12]++; });
    var bh = Math.min(9, (p2[3] - hh - 12) / 6 - 4);
    nodes.forEach(function (c, k) {
      var yy = by + k * (bh + 4.5), load = Math.min(1, 0.12 + c * 0.3);
      ctx.fillStyle = SL.dim; ctx.font = '10px ' + MONO; ctx.fillText('n0' + (12 + k), p2[0] + 8, yy + bh / 2);
      ctx.fillStyle = '#343842'; ctx.fillRect(bx, yy, bw, bh);
      ctx.fillStyle = load > 0.85 ? SL.red : SL.ok; ctx.fillRect(bx, yy, bw * load, bh);
    });
  };

  // the text-like windows change a few times a second only: no need to redraw them at the full frame rate
  SceneDataFrame.prototype.fps = 6; SceneSQL.prototype.fps = 8; SceneScore.prototype.fps = 6; SceneWord.prototype.fps = 6;

  // nominal design space; windows and SVG wiring are scaled together to fit the widget
  var WF_W = 1270, WF_H = 800, WF_TOP = 30; // WF_TOP: room above the top row for captions
  var WIN_OPT = { title: 'alesia', status: 'bayesian optimisation ongoing', Scene: SceneBayes, menu: [30, 38, 26, 44, 32, 28], hub: true, z: 20 };
  var WIN_IN = { title: 'pandas · json', status: '', Scene: SceneDataFrame, menu: [28, 34, 30, 40] };
  var WIN_DB = { title: 'alesia database', status: 'material properties', Scene: SceneSQL, menu: [30, 26, 38, 32], hub: true };
  var WIN_SCORE = { title: 'score.py', status: 'score computation ongoing', Scene: SceneScore, menu: [26, 34, 30, 28] };
  var WIN_REQ = { title: 'project_requirements.docx', status: '', Scene: SceneWord, menu: [30, 36, 28, 40, 26] };
  var WIN_MGR = { title: 'alesia manager', status: '', Scene: SceneSlurm, menu: [32, 28, 40, 30], hub: true };
  var WIN_IB = { title: 'ibsimu', status: 'beam dynamics ongoing', Scene: SceneIBSimu, menu: [28, 36, 30, 40], wh: 470 }; // taller: same proportions as slide 9
  var OPT_CAP = ['Optimiser: machine learning', 'or evolutionary algorithms'];

  /* Each variant: windows, pos [centre x, centre y, scale, rotateY, rotateX] (nominal units),
     stage (0 = on entering the slide, 1 = after the key press), delay [jump, key press] for each window,
     caps [window, lines, anchor], and wires(L) drawing the arrows (L.link(d, delayClass), L.M, L.edgeX, L.edgeY). */
  var WF_VARIANTS = {
    // superconducting magnets: the four physics codes chained along the bottom row
    sc: {
      windows: [WIN_OPT, W6[0], W6[1], W6[2], W6[3], WIN_IN, WIN_DB, WIN_SCORE, WIN_REQ, WIN_MGR],
      pos: [
        [560, 150, 0.46, 0, 4],     // 0 optimiser (Bayesian)
        [140, 655, 0.42, 9, 2],     // 1 magnetic   ┐
        [462, 655, 0.42, 6, 2],     // 2 mechanics  │ bottom row, in the order
        [784, 655, 0.42, 6, 2],     // 3 conductor  │ the codes are chained
        [1106, 655, 0.42, -8, 2],   // 4 quench     ┘
        [140, 130, 0.42, 9, 2],     // 5 inputs (DataFrame / json)
        [640, 420, 0.42, 6, 2],     // 6 ALESIA database (SQL)
        [1110, 420, 0.42, -8, 2],   // 7 score (Python)
        [1150, 130, 0.38, -8, 2],   // 8 project requirements (Word)
        [140, 420, 0.42, 9, 2]      // 9 ALESIA manager (Slurm, parallel runs)
      ],
      stage: [1, 0, 0, 0, 0, 0, 1, 1, 0, 1],
      delay: [[0.05, 0.05], [0.25, 0], [0.37, 0], [0.49, 0], [0.61, 0], [0.13, 0], [0.4, 0.3], [0.75, 0.5], [0.2, 0], [0.3, 0.15]],
      caps: [
        [5, ['Inputs'], 'start'], [8, ['Targets & constraints'], 'middle'],
        [1, ['Magnetism'], 'start'], [2, ['Mechanics'], 'start'], [3, ['Conductor design'], 'start'], [4, ['Quench'], 'start'],
        [0, OPT_CAP, 'middle'], [6, ['Material properties', 'Conductor fits'], 'start'], [7, ['Score'], 'end'], [9, ['Parallel running'], 'start']
      ],
      wires: function (L) {
        var M = L.M, eX = L.edgeX, eY = L.edgeY, rowC = 655, colX = 235;
        L.link(M([[colX, eY(5, 1, colX)], [colX, eY(9, -1, colX)]]), 'd1');            // inputs → manager
        L.link(M([[eX(6, -1, 440), 440], [eX(9, 1, 440), 440]]), 'd1');                // database → manager
        L.link(M([[colX, eY(9, 1, colX)], [colX, eY(1, -1, colX)]]), 'd2');            // manager → magnetic
        L.label(colX + 12, 545, 'Run', 'start');
        L.link(M([[eX(1, 1, rowC), rowC], [eX(2, -1, rowC), rowC]]), 'd2');            // magnetic → mechanics
        L.link(M([[eX(2, 1, rowC), rowC], [eX(3, -1, rowC), rowC]]), 'd2');            // mechanics → conductor
        L.link(M([[eX(3, 1, rowC), rowC], [eX(4, -1, rowC), rowC]]), 'd2');            // conductor → quench
        L.link(M([[1150, eY(4, -1, 1150)], [1150, eY(7, 1, 1150)]]), 'd3');            // quench → score
        L.label(1162, 529, 'Design', 'start'); L.label(1162, 548, 'evaluation', 'start');
        L.link(M([[1120, eY(8, 1, 1120)], [1120, eY(7, -1, 1120)]]), 'd3');            // requirements → score
        L.loop(7, 5);                                                                  // score → optimiser → inputs
      }
    },
    // ECR ion sources: a single beam-extraction code (IBSimu), no material database
    ecris: {
      windows: [WIN_OPT, WIN_IB, WIN_IN, WIN_SCORE, WIN_REQ, WIN_MGR],
      pos: [
        [560, 150, 0.46, 0, 4],     // 0 optimiser (Bayesian)
        [625, 548, 0.6, 6, 2],      // 1 IBSimu (beam extraction), larger than the other windows
        [140, 130, 0.42, 9, 2],     // 2 inputs
        [1110, 420, 0.42, -8, 2],   // 3 score
        [1150, 130, 0.38, -8, 2],   // 4 project requirements
        [140, 420, 0.42, 9, 2]      // 5 ALESIA manager
      ],
      stage: [1, 0, 0, 1, 0, 1],
      delay: [[0.05, 0.05], [0.3, 0], [0.13, 0], [0.55, 0.5], [0.2, 0], [0.4, 0.15]],
      caps: [
        [2, ['Inputs'], 'start'], [4, ['Targets & constraints'], 'middle'], [1, ['Beam extraction'], 'start'],
        [0, OPT_CAP, 'middle'], [3, ['Score'], 'end'], [5, ['Parallel running'], 'start']
      ],
      wires: function (L) {
        var M = L.M, eX = L.edgeX, eY = L.edgeY, colX = 235, mid = 470;
        L.link(M([[colX, eY(2, 1, colX)], [colX, eY(5, -1, colX)]]), 'd1');            // inputs → manager
        L.link(M([[eX(5, 1, mid), mid], [eX(1, -1, mid), mid]]), 'd2');                // manager → IBSimu
        L.link(M([[eX(1, 1, mid), mid], [eX(3, -1, mid), mid]]), 'd3');                // IBSimu → score
        L.label((eX(5, 1, mid) + eX(1, -1, mid)) / 2, mid - 15, 'Run', 'middle');
        L.label((eX(1, 1, mid) + eX(3, -1, mid)) / 2, mid - 15, 'Design evaluation', 'middle');
        L.link(M([[1120, eY(4, 1, 1120)], [1120, eY(3, -1, 1120)]]), 'd3');            // requirements → score
        L.loop(3, 2);                                                                  // score → optimiser → inputs
      }
    }
  };

  var WF_CSS = [
    '.wf-host{position:absolute;inset:0}',
    '.wf-svg{position:absolute;left:0;top:0;width:100%;height:100%;overflow:visible;z-index:1;font-family:Poppins,system-ui,sans-serif;pointer-events:none}',
    '.wf-svg text{fill:#26262b}',
    '.wf-svg .wf-cap{opacity:0;transition:opacity .5s ease;paint-order:stroke;stroke:#fff;stroke-width:7px;stroke-linejoin:round}',
    '.wf-svg.play .wf-cap.c0{opacity:1;transition-delay:.7s}',
    '.wf-svg.st1 .wf-cap.c1{opacity:1;transition-delay:.6s}',
    '.wf-svg .wf-in,.wf-svg .wf-dot{opacity:0;transition:opacity .5s ease}',
    '.wf-svg.st1 .wf-in{opacity:1;transition-duration:.7s}',
    '.wf-svg.st1 .d1{transition-delay:.5s}.wf-svg.st1 .d2{transition-delay:.85s}.wf-svg.st1 .d3{transition-delay:1.2s}.wf-svg.st1 .d4{transition-delay:1.55s}',
    '.wf-svg.st1 .wf-dot{opacity:1;transition-delay:1.9s}',
    '.deck-clone .wf-svg *{transition:none!important}', // copies (speaker view): show the state reached, at once
    '@media print{.wf-svg .wf-in,.wf-svg .wf-dot,.wf-svg .wf-cap{opacity:1!important;transition:none!important}}'
  ].join('\n');

  function wfLayout(V) {
    var k = Math.min(this.W / WF_W, this.H / WF_H), ox = (this.W - WF_W * k) / 2, oy = (this.H - WF_H * k) / 2 + WF_TOP * k;
    this._wf = { k: k, ox: ox, oy: oy };
    return V.pos.map(function (p) { return { x: ox + p[0] * k, y: oy + p[1] * k, z: 0, ry: p[3], rx: p[4], s: p[2] * k, o: 1, dim: 0 }; });
  }

  function wfCSS() {
    if (!document.getElementById('wf-style')) { var cs = document.createElement('style'); cs.id = 'wf-style'; cs.textContent = WF_CSS; document.head.appendChild(cs); }
  }
  function wfBuild(st, V) {
    wfCSS();
    var T = wfLayout.call(st, V), f = st._wf, q = [0, 0], RED = '#E50019', NS = 'http://www.w3.org/2000/svg';
    // where a (tilted) window edge really is: x of the left/right edge at a given height, y of the top/bottom edge at a given x
    function edgeX(i, side, y) {
      var p = V.pos[i]; st.projWin(T[i], side * st.wins[i].ww / 2, (y - p[1]) / p[2], q);
      return (q[0] - f.ox) / f.k + side * 5;
    }
    function edgeY(i, side, x) {
      var p = V.pos[i]; st.projWin(T[i], (x - p[0]) / p[2], side * st.wins[i].wh / 2, q);
      return (q[1] - f.oy) / f.k + side * 5;
    }
    var paths = [], labels = '';
    function M(pts) { return 'M' + pts.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' L'); }
    var L = {
      M: M, edgeX: edgeX, edgeY: edgeY,
      link: function (d, cls) { paths.push({ d: d, cls: cls }); },
      // a short text next to an arrow
      label: function (x, y, text, anchor) {
        labels += '<text x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" font-size="17" text-anchor="' + (anchor || 'middle') + '" style="paint-order:stroke;stroke:#fff;stroke-width:5px;stroke-linejoin:round">' + text + '</text>';
      },
      // the automated loop: score → optimiser ("automated loop"), optimiser → inputs ("Selection")
      loop: function (score, inputs) {
        var loopX = 1010, topY = 150, selY = 140;
        L.link(M([[loopX, edgeY(score, -1, loopX)], [loopX, topY], [edgeX(0, 1, topY), topY]]), 'd4');
        L.link(M([[edgeX(0, -1, selY), selY], [edgeX(inputs, 1, selY), selY]]), 'd4');
        labels += '<text x="' + ((edgeX(0, 1, topY) + loopX) / 2).toFixed(1) + '" y="' + (topY - 16) + '" font-size="22" font-weight="600" text-anchor="middle" style="fill:' + RED + '">Automated loop</text>' +
          '<text x="' + ((edgeX(0, -1, selY) + edgeX(inputs, 1, selY)) / 2).toFixed(1) + '" y="' + (selY - 16) + '" font-size="16" text-anchor="middle">Selection</text>';
      }
    };
    V.wires(L);

    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'wf-svg');
    svg.setAttribute('viewBox', (-f.ox / f.k).toFixed(2) + ' ' + (-f.oy / f.k).toFixed(2) + ' ' + (st.W / f.k).toFixed(2) + ' ' + (st.H / f.k).toFixed(2));
    svg.setAttribute('preserveAspectRatio', 'none');
    st.root.insertBefore(svg, st.root.firstChild);
    var dotsG = document.createElementNS(NS, 'g'), wiresG = document.createElementNS(NS, 'g');
    svg.appendChild(wiresG); svg.appendChild(dotsG);
    paths.forEach(function (p, i) {
      var g = document.createElementNS(NS, 'g');
      g.setAttribute('class', 'wf-in ' + p.cls);
      var el = document.createElementNS(NS, 'path');
      el.setAttribute('d', p.d); el.setAttribute('fill', 'none'); el.setAttribute('stroke', RED);
      el.setAttribute('stroke-width', '3.2'); el.setAttribute('stroke-linejoin', 'round'); el.setAttribute('stroke-linecap', 'round');
      g.appendChild(el);
      wiresG.appendChild(g);
      // arrowhead from the direction at the very end of the path
      var Ln = el.getTotalLength(), a = el.getPointAtLength(Ln), b = el.getPointAtLength(Math.max(0, Ln - 6));
      var ang = Math.atan2(a.y - b.y, a.x - b.x), sz = 15, hd = document.createElementNS(NS, 'path');
      hd.setAttribute('d', 'M' + a.x.toFixed(1) + ',' + a.y.toFixed(1) + ' L' + (a.x - sz * Math.cos(ang - 0.42)).toFixed(1) + ',' + (a.y - sz * Math.sin(ang - 0.42)).toFixed(1) +
        ' L' + (a.x - sz * Math.cos(ang + 0.42)).toFixed(1) + ',' + (a.y - sz * Math.sin(ang + 0.42)).toFixed(1) + 'Z');
      hd.setAttribute('fill', RED);
      g.appendChild(hd);
      // red dots running along every arrow (moved by the deck at its frame rate, see deck.js)
      var n = Math.max(1, Math.round(Ln / 230)), dur = Math.max(1.6, Ln / 115);
      for (var k = 0; k < n; k++) {
        var c = document.createElementNS(NS, 'circle');
        c.setAttribute('class', 'wf-dot'); c.setAttribute('r', '6'); c.setAttribute('fill', RED);
        c.innerHTML = '<animateMotion dur="' + dur.toFixed(2) + 's" repeatCount="indefinite" begin="-' + (k * dur / n + i * 0.37).toFixed(2) + 's" path="' + p.d + '"/>';
        dotsG.appendChild(c);
      }
    });
    var lab = document.createElementNS(NS, 'g');
    lab.setAttribute('class', 'wf-in d4');
    lab.innerHTML = labels;
    svg.appendChild(lab);
    // captions (text of the original workflow), large enough to read from the back of the room
    var caps = document.createElementNS(NS, 'g');
    caps.innerHTML = V.caps.map(function (c) {
      var p = V.pos[c[0]], w = st.wins[c[0]], s2 = p[2], left = p[0] - w.ww / 2 * s2, right = p[0] + w.ww / 2 * s2, top = p[1] - w.wh / 2 * s2;
      var x = c[2] === 'start' ? left + 2 : c[2] === 'end' ? right - 2 : p[0];
      var lh = 25, y0 = top - 13 - (c[1].length - 1) * lh;
      return '<text class="wf-cap c' + V.stage[c[0]] + '" x="' + x.toFixed(1) + '" y="' + y0.toFixed(1) + '" font-size="23" font-weight="600" text-anchor="' + c[2] + '">' +
        c[1].map(function (l, i) { return '<tspan x="' + x.toFixed(1) + '" dy="' + (i ? lh : 0) + '">' + l + '</tspan>'; }).join('') + '</text>';
    }).join('');
    svg.appendChild(caps);
    st._wfSvg = svg;
  }

  function wfConfig(V) {
    return {
      windows: V.windows, steps: 1, origin: [0.5, 0.5], ww: 600, wh: 420, cls: 'md-big', printTime: 8000,
      layout: function (stage) {
        var T = wfLayout.call(this, V);
        return T.map(function (t, i) { return V.stage[i] > stage ? null : t; });
      },
      onStage: function (st, stage) { if (st._wfSvg) st._wfSvg.classList.toggle('st1', stage >= 1); },
      appearFrom: function (t) { return { x: t.x, y: t.y + 16, z: t.z - 160, ry: t.ry, rx: t.rx + 8, s: t.s * 0.9, o: 0, dim: 0 }; },
      appearDelay: function (i, n, instant) { return V.delay[i][instant ? 0 : 1]; },
      every: function (i) { return i === 0 ? 1 : 3; },
      onMount: function (st) { wfBuild(st, V); },
      onEnter: function (st) { var g = st._wfSvg; g.classList.remove('play'); void g.getBoundingClientRect(); g.classList.add('play'); },
      onLeave: function (st) { var g = st._wfSvg; setTimeout(function () { if (!st.el.closest('.slide').classList.contains('active')) g.classList.remove('play', 'st1'); }, 700); },
      onPrint: function (st) { st._wfSvg.classList.add('play', 'st1'); }
    };
  }

  // stage 0: inputs, requirements and the codes, not linked yet
  // stage 1 (one key press): optimiser, database, score, ALESIA manager and every link of the automated loop
  // the slide's buttons (data-variant="sc" | "ecris") switch between the two versions
  Deck.widget('alesia-workflow-live', {
    steps: 1,
    mount: function (el, api) {
      wfCSS(); // before the windows are measured
      if (window.getComputedStyle(el).position === 'static') el.style.position = 'relative';
      var parts = {}, cur = null, step = 0, active = false;
      Object.keys(WF_VARIANTS).forEach(function (name) {
        var host = document.createElement('div');
        host.className = 'wf-host';
        el.appendChild(host);
        parts[name] = { host: host, w: K.makeWidget(wfConfig(WF_VARIANTS[name])).mount(host, api) };
      });
      function show(name) {
        Object.keys(parts).forEach(function (k) { parts[k].host.style.display = k === name ? '' : 'none'; });
      }
      cur = Object.keys(parts)[0]; show(cur);
      function each(fn) { var p = parts[cur]; if (p && p.w[fn]) p.w[fn].apply(p.w, Array.prototype.slice.call(arguments, 1)); }
      return {
        enter: function () { active = true; each('enter'); },
        leave: function () { active = false; each('leave'); },
        step: function (k, dir) { step = k; each('step', k, dir); },
        resize: function () { each('resize'); },
        print: function () { each('print'); },
        variant: function (name) {
          if (!parts[name] || name === cur) return;
          var old = parts[cur].host._stage;
          old.reset(); old._wfSvg.classList.remove('play', 'st1');
          cur = name; show(cur);
          if (active) { each('resize'); each('enter'); each('step', step, 'jump'); }
        }
      };
    }
  });
})();
