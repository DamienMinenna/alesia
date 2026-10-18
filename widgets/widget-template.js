/*
 * widget-template.js — starting point for your own JavaScript on a slide.
 *
 * 1. Copy this file (e.g. widgets/my-plot.js) and rename the widget below.
 * 2. In index.html, add after engine/deck.js:   <script src="widgets/my-plot.js"></script>
 * 3. In any slide:                                <div class="fill" data-widget="hello-canvas"></div>
 *
 * The engine calls mount() once at start-up, enter()/leave() when the slide is
 * shown/hidden, and step() on every key press while the slide is active.
 */
Deck.widget('hello-canvas', {
  steps: 2,                        // optional: number of key presses this widget consumes

  mount: function (el, api) {      // api: { slide, el, scale, dpr, active, printing }
    var canvas = document.createElement('canvas');
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    el.appendChild(canvas);
    var ctx = canvas.getContext('2d'), raf = 0, stage = 0, t0 = 0;

    function draw(now) {
      raf = requestAnimationFrame(draw);
      var w = canvas.clientWidth, h = canvas.clientHeight, k = api.dpr * api.scale;
      if (canvas.width !== Math.round(w * k)) { canvas.width = Math.round(w * k); canvas.height = Math.round(h * k); }
      ctx.setTransform(k, 0, 0, k, 0, 0);
      ctx.clearRect(0, 0, w, h);
      var t = (now - t0) / 1000;
      ctx.fillStyle = ['#f9c3ca', '#ef5466', '#E50019'][stage];
      ctx.beginPath();
      ctx.arc(w / 2 + Math.cos(t) * w / 4, h / 2 + Math.sin(t * 1.3) * h / 4, 30 + stage * 20, 0, Math.PI * 2);
      ctx.fill();
    }

    return {
      enter: function () { t0 = performance.now(); raf = requestAnimationFrame(draw); },
      leave: function () { cancelAnimationFrame(raf); },
      step: function (k) { stage = k; },          // k = 0 … steps
      resize: function () {},                       // window resized (optional)
      print: function () {}                         // draw a final frame for PDF export (optional)
    };
  }
});
