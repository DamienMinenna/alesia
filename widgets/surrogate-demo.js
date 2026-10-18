/*!
 * surrogate-demo.js — learning surrogate on the 2D Ackley function (slide 6).
 * Replays a recorded run (widgets/surrogate-run.js, made by tools/make_surrogate_run.py):
 * 320 random points arrive 20 at a time; after each batch the 2-64-64-1 neural network is refitted,
 * its prediction map is updated, the best predicted point moves, and the prediction error is plotted.
 *
 *   <div data-widget="surrogate-demo"></div>      plays when the slide is shown; "↻" plays it again
 */
(function () {
  'use strict';
  if (!window.Deck) return;
  var TAU = Math.PI * 2, LO = -5, HI = 5, FMAX = 14.5;
  var T0 = 0.6, DT = 0.8, FADE = 0.5;          // start delay, time per iteration, map cross-fade (s)
  var STOPS = [[0, [74, 6, 18]], [0.22, [150, 14, 36]], [0.45, [222, 74, 92]], [0.7, [246, 170, 179]], [1, [255, 246, 247]]];

  function ackley(x, y) {
    return -20 * Math.exp(-0.2 * Math.sqrt(0.5 * (x * x + y * y))) - Math.exp(0.5 * (Math.cos(TAU * x) + Math.cos(TAU * y))) + Math.E + 20;
  }
  function colour(v, out) { // same colour scale as the optimiser example (slide 5)
    var t = Math.pow(Math.max(0, Math.min(1, v / FMAX)), 0.85), k = 1;
    while (k < STOPS.length - 1 && t > STOPS[k][0]) k++;
    var a = STOPS[k - 1], b = STOPS[k], u = Math.max(0, Math.min(1, (t - a[0]) / (b[0] - a[0])));
    out[0] = a[1][0] + (b[1][0] - a[1][0]) * u; out[1] = a[1][1] + (b[1][1] - a[1][1]) * u; out[2] = a[1][2] + (b[1][2] - a[1][2]) * u;
  }
  function picture(G, value) { // G x G canvas from value(i, j)
    var c = document.createElement('canvas'); c.width = c.height = G;
    var ctx = c.getContext('2d'), img = ctx.createImageData(G, G), col = [0, 0, 0];
    for (var j = 0; j < G; j++) for (var i = 0; i < G; i++) {
      colour(value(i, j), col);
      var p = 4 * (j * G + i);
      img.data[p] = col[0]; img.data[p + 1] = col[1]; img.data[p + 2] = col[2]; img.data[p + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }
  var SNAPS = null, TRUE = null;
  function snaps(run) {
    if (SNAPS) return SNAPS;
    // the 48 x 48 predictions are smoothed (bilinear) to 192 x 192 here, so they stay smooth however
    // they are scaled (the PDF export scales pictures without smoothing)
    SNAPS = run.snaps.map(function (b64) {
      var bin = atob(b64), G = run.G, U = 4, GU = G * U;
      var at = function (i, j) { i = Math.max(0, Math.min(G - 1, i)); j = Math.max(0, Math.min(G - 1, j)); return bin.charCodeAt(j * G + i); };
      return picture(GU, function (i, j) {
        var x = (i + 0.5) / U - 0.5, y = (j + 0.5) / U - 0.5, x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
        var v = (at(x0, y0) * (1 - fx) + at(x0 + 1, y0) * fx) * (1 - fy) + (at(x0, y0 + 1) * (1 - fx) + at(x0 + 1, y0 + 1) * fx) * fy;
        return v / 255 * run.fmax;
      });
    });
    return SNAPS;
  }
  function truth() {
    if (TRUE) return TRUE;
    var N = 240;
    TRUE = picture(N, function (i, j) { return ackley(LO + (HI - LO) * (i + 0.5) / N, HI - (HI - LO) * (j + 0.5) / N); });
    return TRUE;
  }
  function ease(u) { u = Math.max(0, Math.min(1, u)); return u * u * (3 - 2 * u); }

  var CSS = [
    '.sg{display:flex;flex-direction:column;gap:14px;height:100%;font-family:Poppins,system-ui,sans-serif}',
    '.sg-head{display:flex;align-items:center;gap:14px;font-size:21px;color:#46464e}',
    '.sg-head b{color:#1f1f24;font-weight:600}',
    '.sg-head button{all:unset;cursor:pointer;margin-left:auto;font-size:21px;padding:7px 14px;border-radius:999px;color:#8a8a93;border:1.5px solid #ece5e6;background:#fff}',
    '.sg-head button:hover{color:#E50019}',
    '.sg-main{flex:1;min-height:0;display:grid;grid-template-columns:1fr 0.7fr;gap:26px}',
    '.sg-main canvas{width:100%;height:100%;display:block;min-height:0}',
    '.sg-side{display:grid;grid-template-rows:1fr 1fr;gap:18px;min-height:0}',
    '.sg-info{font-size:20px;color:#8a8a93;font-variant-numeric:tabular-nums}',
    '.sg-info b{color:#E50019;font-weight:600}'
  ].join('\n');

  Deck.widget('surrogate-demo', {
    mount: function (el, api) {
      var run = window.SURROGATE_RUN;
      if (!run) { el.textContent = 'surrogate-run.js is missing'; return {}; }
      if (!document.getElementById('sg-style')) { var st = document.createElement('style'); st.id = 'sg-style'; st.textContent = CSS; document.head.appendChild(st); }
      el.innerHTML = '<div class="sg"><div class="sg-head"><span><b>Deep neural network</b> (layers: 2, 64, 64, 1) refitted on random points</span><button title="Play again">↻</button></div>' +
        '<div class="sg-main"><canvas class="sg-map"></canvas><div class="sg-side"><canvas class="sg-true"></canvas><canvas class="sg-err"></canvas></div></div>' +
        '<div class="sg-info"></div></div>';
      var map = el.querySelector('.sg-map'), tru = el.querySelector('.sg-true'), err = el.querySelector('.sg-err'), info = el.querySelector('.sg-info');
      var K = run.snaps.length, STEP = run.step, P = run.pts, active = false, t0 = 0, settled = false, infoK = -1, trueDrawn = false;
      el.querySelector('.sg-head button').addEventListener('click', function () { t0 = performance.now(); settled = false; infoK = -1; });

      function measure() { [map, tru, err].forEach(function (c) { c._w = c.clientWidth; c._h = c.clientHeight; c._fresh = true; }); trueDrawn = false; }
      function size(c) {
        if (!c._w) measure();
        var Q = Deck.quality, w = c._w, h = c._h, k = Math.min(Q ? Math.max(1, Q.kMax + 0.5) : 2, (window.devicePixelRatio || 1) * (api.scale || 1));
        if (!w || !h) return null;
        if (c.width !== Math.round(w * k) || c.height !== Math.round(h * k)) { c.width = Math.round(w * k); c.height = Math.round(h * k); }
        var ctx = c.getContext('2d'); ctx.setTransform(k, 0, 0, k, 0, 0);
        return { ctx: ctx, w: w, h: h };
      }
      function frame(ctx, ox, oy, S, ticks, fs) { // border and axis ticks of a square map
        ctx.strokeStyle = 'rgba(0,0,0,.12)'; ctx.lineWidth = 1; ctx.strokeRect(ox + 0.5, oy + 0.5, S - 1, S - 1);
        ctx.fillStyle = '#8a8a93'; ctx.font = fs + 'px Poppins, sans-serif';
        ticks.forEach(function (v) {
          var x = ox + (v - LO) / (HI - LO) * S, y = oy + (HI - v) / (HI - LO) * S;
          ctx.textAlign = 'center'; ctx.fillText(String(v), x, oy + S + fs + 4);
          ctx.textAlign = 'right'; ctx.fillText(String(v), ox - 6, y + fs / 3);
        });
      }
      function cross(ctx, x, y, r) {
        ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(x - r, y); ctx.lineTo(x + r, y); ctx.moveTo(x, y - r); ctx.lineTo(x, y + r); ctx.stroke();
      }
      function diamond(ctx, x, y, s) {
        ctx.beginPath(); ctx.moveTo(x, y - s * 1.45); ctx.lineTo(x + s, y); ctx.lineTo(x, y + s * 1.45); ctx.lineTo(x - s, y); ctx.closePath();
        ctx.fillStyle = '#8f00d6'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.6; ctx.stroke();
      }

      function draw(now, force) {
        var t = (now - t0) / 1000 - T0, k = Math.max(0, Math.min(K - 1, Math.floor(t / DT))), lt = t - k * DT;
        if (t < 0) { k = 0; lt = 0; }
        var animating = t < (K - 1) * DT + FADE + 0.4;
        if (!force && !animating && settled) return;   // finished: nothing changes any more
        settled = !animating;
        var A = size(map), B = size(err), C = size(tru);
        if (!A || !B || !C) return;
        var fade = t < 0 ? 1 : ease(lt / FADE), pop = t < 0 ? 1 : ease(lt / 0.35), glide = t < 0 ? 1 : ease(lt / 0.5);
        var SN = snaps(run);

        // ----- surrogate map, the points it was trained on, its best prediction
        var ctx = A.ctx, S = Math.min(A.w - 40, A.h - 30), ox = (A.w - S) / 2 + 14, oy = 2;
        var X = function (x) { return ox + (x - LO) / (HI - LO) * S; }, Y = function (y) { return oy + (HI - y) / (HI - LO) * S; };
        ctx.clearRect(0, 0, A.w, A.h);
        ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
        if (k > 0 && fade < 1) ctx.drawImage(SN[k - 1], ox, oy, S, S);
        ctx.globalAlpha = k > 0 ? fade : 1; ctx.drawImage(SN[k], ox, oy, S, S); ctx.globalAlpha = 1;
        frame(ctx, ox, oy, S, [-4, -2, 0, 2, 4], 15);
        cross(ctx, X(0), Y(0), 9);
        var n = (k + 1) * STEP;
        ctx.lineWidth = 1.3; ctx.strokeStyle = '#26262b'; ctx.fillStyle = '#fff';
        ctx.beginPath();
        for (var i = 0; i < n - STEP; i++) { var px = X(P[2 * i]), py = Y(P[2 * i + 1]); ctx.moveTo(px + 4, py); ctx.arc(px, py, 4, 0, TAU); }
        ctx.fill(); ctx.stroke();
        for (i = n - STEP; i < n; i++) { // the newest batch pops in, ringed in red
          var qx = X(P[2 * i]), qy = Y(P[2 * i + 1]), r = 4 * (0.4 + 0.6 * pop);
          ctx.beginPath(); ctx.arc(qx, qy, r, 0, TAU); ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = '#E50019'; ctx.lineWidth = 2; ctx.stroke();
        }
        var b1 = run.best[k], b0 = run.best[Math.max(0, k - 1)];
        var bx = b0[0] + (b1[0] - b0[0]) * glide, by = b0[1] + (b1[1] - b0[1]) * glide;
        diamond(ctx, X(bx), Y(by), 9);
        // legend
        ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.fillRect(ox + 10, oy + S - 70, 238, 60);
        diamond(ctx, ox + 26, oy + S - 52, 6);
        ctx.fillStyle = '#26262b'; ctx.font = '15px Poppins, sans-serif'; ctx.textAlign = 'left';
        ctx.fillText('DNN best prediction', ox + 42, oy + S - 47);
        ctx.beginPath(); ctx.arc(ox + 26, oy + S - 26, 4, 0, TAU); ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = '#26262b'; ctx.lineWidth = 1.3; ctx.stroke();
        ctx.fillStyle = '#26262b'; ctx.fillText('training points (random)', ox + 42, oy + S - 21);

        // ----- true function, for comparison (drawn once)
        if (!trueDrawn || force) {
          trueDrawn = true;
          var c3 = C.ctx, S3 = Math.min(C.w - 34, C.h - 52), ox3 = (C.w - S3) / 2 + 10, oy3 = 26;
          c3.clearRect(0, 0, C.w, C.h);
          c3.fillStyle = '#46464e'; c3.font = '600 17px Poppins, sans-serif'; c3.textAlign = 'center';
          c3.fillText('True function (Ackley)', ox3 + S3 / 2, 17);
          c3.imageSmoothingEnabled = true; c3.drawImage(truth(), ox3, oy3, S3, S3);
          frame(c3, ox3, oy3, S3, [-4, 0, 4], 13);
          cross(c3, ox3 + S3 / 2, oy3 + S3 / 2, 7);
        }

        // ----- prediction error vs number of training points
        var c2 = B.ctx, W2 = B.w, H2 = B.h, l = 54, r2 = 12, t2 = 30, b2 = 42, pw = W2 - l - r2, ph = H2 - t2 - b2;
        var emax = 1.6, SX = function (m) { return l + m / (K * STEP) * pw; }, SY = function (e) { return t2 + (1 - e / emax) * ph; };
        c2.clearRect(0, 0, W2, H2);
        c2.fillStyle = '#46464e'; c2.font = '600 17px Poppins, sans-serif'; c2.textAlign = 'center';
        c2.fillText('Prediction error (RMSE)', l + pw / 2, 18);
        c2.strokeStyle = '#d9cfd1'; c2.lineWidth = 1.2; c2.strokeRect(l + 0.5, t2 + 0.5, pw, ph);
        c2.fillStyle = '#8a8a93'; c2.font = '14px Poppins, sans-serif';
        [0, 100, 200, 300].forEach(function (v) { c2.fillText(String(v), SX(v), t2 + ph + 18); });
        c2.fillText('Training points', l + pw / 2, H2 - 4);
        c2.textAlign = 'right';
        [0, 0.5, 1, 1.5].forEach(function (v) { c2.fillText(String(v), l - 8, SY(v) + 5); });
        var shown = t < 0 ? 0 : k + 1;
        c2.strokeStyle = '#111114'; c2.lineWidth = 2.4; c2.beginPath();
        for (var m = 0; m < shown; m++) { var ex = SX((m + 1) * STEP), ey = SY(run.rmse[m]); if (m) c2.lineTo(ex, ey); else c2.moveTo(ex, ey); }
        c2.stroke();
        c2.fillStyle = '#E50019';
        for (m = 0; m < shown; m++) { c2.beginPath(); c2.arc(SX((m + 1) * STEP), SY(run.rmse[m]), m === shown - 1 ? 3 + 2.5 * pop : 3.6, 0, TAU); c2.fill(); }

        if (infoK === k && !force) return;
        infoK = k;
        info.innerHTML = 'iteration ' + (k + 1) + ' / ' + K + ' &nbsp;·&nbsp; ' + n + ' random points &nbsp;·&nbsp; RMSE <b>' + run.rmse[k].toFixed(2) +
          '</b> &nbsp;·&nbsp; best predicted (' + b1[0].toFixed(2) + ', ' + b1[1].toFixed(2) + '), true <i>f</i> there = <b>' + b1[2].toFixed(2) + '</b>';
      }
      function tick(now) { if (active) draw(now); }

      return {
        enter: function () { active = true; measure(); t0 = performance.now(); settled = false; infoK = -1; Deck.ticker.add(tick); },
        leave: function () { active = false; Deck.ticker.remove(tick); },
        resize: function () { measure(); if (active) draw(performance.now(), true); },
        print: function () { measure(); t0 = performance.now() - (T0 + K * DT + 2) * 1000; draw(performance.now(), true); }
      };
    }
  });
})();
