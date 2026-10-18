/* =============================================================================
 * ALESIA – Under the hood: an isometric stack of layers that builds up one press at a time.
 *
 *   <div data-widget="alesia-stack"></div>
 *   <ol class="us-list">                          the layers, top first (same order as the stack)
 *     <li data-tiles="GA | DE | Opera=assets/img/logo-opera.png">
 *       <div class="us-t">Layer name</div><div class="us-d">Description</div>
 *     </li>
 *     …
 *   </ol>
 *
 * The bottom layer is there when the slide opens; each key press drops the next layer onto the
 * stack with its tiles, and its description appears in the list (current one in red).
 * Hovering a description outlines its layer.
 * Tiles: "Name", or "Name=path/to/logo.png" to draw a logo on the tile (the name goes under it).
 * ========================================================================== */
(function () {
  'use strict';
  if (!window.Deck) return;

  var NS = 'http://www.w3.org/2000/svg';
  var C = 0.8660254, S = 0.5;                 // isometric projection
  var A = 430, T = 42, M = 20, HEAD = 14, TH = 9, BASE = 12;  // footprint, slab thickness, glass margin, headroom, tile height, glass base
  var PAL = [
    { top: '#fde9ec', right: '#f4c0c8', left: '#e9a0ab', ink: '#7d0c1e' },   // red layers
    { top: '#f8f8f9', right: '#e6e6ea', left: '#d3d3d9', ink: '#34343b' }    // grey layers
  ];

  function P(x, y, z) { return [C * (x - y), -S * (x + y) - z]; }
  function pts(list) {
    return list.map(function (p) { var q = P(p[0], p[1], p[2]); return q[0].toFixed(1) + ',' + q[1].toFixed(1); }).join(' ');
  }
  function mk(tag, attrs, parent, text) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }
  // a group whose local (u, v) coordinates lie on a face of the stack
  function faceTop(z, parent) {      // top face: u along +x, v towards the viewer (-y), origin at (0, A, z)
    var o = P(0, A, z);
    return mk('g', { transform: 'matrix(' + C + ',' + (-S) + ',' + C + ',' + S + ',' + o[0].toFixed(2) + ',' + o[1].toFixed(2) + ')' }, parent);
  }
  function faceRight(z, parent) {    // right face (y = 0): u along +x, v downwards, origin at (0, 0, z)
    var o = P(0, 0, z);
    return mk('g', { transform: 'matrix(' + C + ',' + (-S) + ',0,1,' + o[0].toFixed(2) + ',' + o[1].toFixed(2) + ')' }, parent);
  }

  var mctx = null;
  function textW(str, fs) {
    if (!mctx) mctx = document.createElement('canvas').getContext('2d');
    mctx.font = '600 ' + fs + 'px Poppins, system-ui, sans-serif';
    return mctx.measureText(str).width;
  }
  function wrap(label, fs, maxW) {
    var words = label.split(/\s+/), lines = [], cur = '';
    words.forEach(function (w) {
      if (!cur) cur = w;
      else if (textW(cur + ' ' + w, fs) <= maxW) cur += ' ' + w;
      else { lines.push(cur); cur = w; }
    });
    if (cur) lines.push(cur);
    return lines;
  }
  function fitLabel(label, fs, maxW, maxLines) {   // largest font (down to 12 px) that fits the tile
    for (; fs > 12; fs--) {
      var lines = wrap(label, fs, maxW);
      if (lines.length <= maxLines && lines.every(function (l) { return textW(l, fs) <= maxW; })) return { fs: fs, lines: lines };
    }
    return { fs: 12, lines: wrap(label, 12, maxW) };
  }

  var CSS = [
    '.us-wrap{position:relative;width:100%;height:100%}',
    '.us-svg{width:100%;height:100%;display:block;overflow:visible}',
    '.us-svg text{font-family:Poppins,system-ui,sans-serif}',
    '.us-slab{transition:transform .8s cubic-bezier(.22,1.08,.36,1),opacity .45s ease}',
    '.us-slab.off{transform:translateY(-190px);opacity:0}',
    '.us-tile{transition:transform .45s cubic-bezier(.3,1.5,.5,1),opacity .35s ease}',
    '.us-slab.off .us-tile{transform:translateY(-28px);opacity:0}',
    '.us-slab.covered .us-tile{opacity:0}',
    '.us-side{transition:stroke .2s ease}',
    '.us-slab.hov .us-side{stroke:#e2001a;stroke-width:2.4}',
    '.us-slab.hov .us-name{fill:#e2001a;font-weight:700}',
    '.us-top{stroke:rgba(0,0,0,.10);stroke-width:1}',
    '.us-slab.cur .us-top,.us-slab.hov .us-top{stroke:#e2001a;stroke-width:2.6}',
    '.us-name{font-size:22px;font-weight:600}',
    '.us-slab.cur .us-name{fill:#c0001a;font-weight:700}',
    '.us-instant .us-slab,.us-instant .us-tile,.us-instant .us-side{transition:none!important}'
  ].join('');
  function injectCSS() {
    if (document.getElementById('us-style')) return;
    var st = document.createElement('style'); st.id = 'us-style'; st.textContent = CSS; document.head.appendChild(st);
  }

  function listOf(node) { var s = node.closest('.slide'); return s && s.querySelector('.us-list'); }
  function readLayers(list) {      // bottom layer first
    var items = Array.prototype.slice.call(list.querySelectorAll(':scope > li')).reverse();
    return items.map(function (li) {
      var t = li.querySelector('.us-t');
      var tiles = (li.getAttribute('data-tiles') || '').split('|').map(function (s) { return s.trim(); }).filter(Boolean)
        .map(function (s) { var i = s.indexOf('='); return i < 0 ? { name: s } : { name: s.slice(0, i).trim(), img: s.slice(i + 1).trim() }; });
      return { li: li, name: t ? t.textContent.trim() : '', tiles: tiles };
    });
  }

  function drawTile(g, tile, u0, v0, tw, th, z) {
    var y0 = A - v0 - th, y1 = A - v0, x0 = u0, x1 = u0 + tw;
    mk('polygon', { points: pts([[x0, y0, z], [x0, y1, z], [x0, y1, z + TH], [x0, y0, z + TH]]), fill: '#dadade' }, g);   // left side
    mk('polygon', { points: pts([[x0, y0, z], [x1, y0, z], [x1, y0, z + TH], [x0, y0, z + TH]]), fill: '#e9e9ed' }, g);   // front side
    var f = faceTop(z + TH, g);
    mk('rect', { x: u0, y: v0, width: tw, height: th, rx: 4, fill: '#fff', stroke: '#d4d4da', 'stroke-width': 1 }, f);
    var cx = u0 + tw / 2, hasPic = !!tile.img;
    var fit = fitLabel(tile.name, hasPic ? 17 : 21, tw - 14, hasPic ? 1 : 2), fs = fit.fs, lines = fit.lines;
    var lh = fs * 1.18, textH = lines.length * lh;
    var ty = hasPic ? v0 + th - 10 - textH + fs * 0.85 : v0 + th / 2 - textH / 2 + fs * 0.82;
    if (tile.img) {
      var ph = th - 26 - textH;
      mk('image', { href: tile.img, x: u0 + 10, y: v0 + 10, width: tw - 20, height: Math.max(20, ph), preserveAspectRatio: 'xMidYMid meet' }, f);
    }
    lines.forEach(function (l, i) {
      mk('text', { x: cx, y: ty + i * lh, 'text-anchor': 'middle', 'font-size': fs, 'font-weight': 600, fill: '#26262b' }, f, l);
    });
  }

  function layoutTiles(n) {        // grid on the top face: columns along u, rows towards the viewer
    var cols = n <= 3 ? n : (n === 4 ? 2 : 3), rows = Math.ceil(n / cols), pad = 26, gap = 16;
    var tw = Math.min(124, (A - 2 * pad - (cols - 1) * gap) / cols), th = Math.min(118, (A - 2 * pad - (rows - 1) * gap) / rows);
    var out = [], v = (A - (rows * th + (rows - 1) * gap)) / 2;
    for (var r = 0, k = 0; r < rows; r++) {
      var inRow = Math.min(cols, n - k), u = (A - (inRow * tw + (inRow - 1) * gap)) / 2;
      for (var c = 0; c < inRow; c++, k++) out.push([u + c * (tw + gap), v + r * (th + gap), tw, th]);
    }
    return out;
  }

  Deck.widget('alesia-stack', {
    steps: function (node) { var l = listOf(node); return l ? Math.max(0, l.querySelectorAll(':scope > li').length - 1) : 0; },
    mount: function (el) {
      injectCSS();
      var list = listOf(el);
      if (!list) return {};
      var layers = readLayers(list), n = layers.length;
      if (!n) return {};
      var zTop = n * T + HEAD, zF = -BASE, lo = -M, hi = A + M;
      var x0 = P(lo, hi, 0)[0] - 12, x1 = P(hi, lo, 0)[0] + 12, y0 = P(hi, hi, zTop)[1] - 12, y1 = P(lo, lo, zF)[1] + 14;
      var wrapEl = document.createElement('div'); wrapEl.className = 'us-wrap'; el.appendChild(wrapEl);
      var svg = mk('svg', { class: 'us-svg', viewBox: [x0, y0, x1 - x0, y1 - y0].map(function (v) { return v.toFixed(1); }).join(' '), preserveAspectRatio: 'xMidYMid meet' });
      wrapEl.appendChild(svg);

      // glass box: floor and back walls first
      var glass = { fill: '#f6f6f7', stroke: '#cfcfd5', 'stroke-width': 1 };
      mk('polygon', Object.assign({ points: pts([[lo, lo, zF], [hi, lo, zF], [hi, hi, zF], [lo, hi, zF]]) }, glass, { fill: '#f1f1f3' }), svg);
      mk('polygon', Object.assign({ points: pts([[hi, lo, zF], [hi, hi, zF], [hi, hi, zTop], [hi, lo, zTop]]) }, glass), svg);
      mk('polygon', Object.assign({ points: pts([[lo, hi, zF], [hi, hi, zF], [hi, hi, zTop], [lo, hi, zTop]]) }, glass), svg);
      mk('polygon', { points: pts([[-8, -8, zF], [A + 8, -8, zF], [A + 8, A + 8, zF], [-8, A + 8, zF]]), fill: 'rgba(60,0,10,.06)' }, svg);   // shadow

      var slabs = layers.map(function (L, i) {
        var pal = PAL[i % 2], z0 = i * T, z1 = z0 + T;
        var g = mk('g', { class: 'us-slab off' }, svg), lift = mk('g', { class: 'us-lift' }, g);
        mk('polygon', { points: pts([[0, 0, z0], [0, A, z0], [0, A, z1], [0, 0, z1]]), fill: pal.left, class: 'us-side', stroke: 'rgba(0,0,0,.08)', 'stroke-width': 1 }, lift);
        mk('polygon', { points: pts([[0, 0, z0], [A, 0, z0], [A, 0, z1], [0, 0, z1]]), fill: pal.right, class: 'us-side', stroke: 'rgba(0,0,0,.08)', 'stroke-width': 1 }, lift);
        mk('polygon', { class: 'us-top', points: pts([[0, 0, z1], [A, 0, z1], [A, A, z1], [0, A, z1]]), fill: pal.top }, lift);
        mk('text', { class: 'us-name', x: 18, y: T * 0.67, fill: pal.ink }, faceRight(z1, lift), L.name);
        var tiles = layoutTiles(L.tiles.length).map(function (r, j) {
          var tg = mk('g', { class: 'us-tile' }, lift);
          drawTile(tg, L.tiles[j], r[0], r[1], r[2], r[3], z1);
          return tg;
        });
        L.li.addEventListener('mouseenter', function () { if (L.li.classList.contains('on')) g.classList.add('hov'); });
        L.li.addEventListener('mouseleave', function () { g.classList.remove('hov'); });
        return { g: g, tiles: tiles, li: L.li };
      });

      // glass box: front edges on top of everything
      var edge = { stroke: '#b8b8c0', 'stroke-width': 1.2, fill: 'none', opacity: 0.85 };
      mk('polygon', Object.assign({ points: pts([[lo, lo, zTop], [hi, lo, zTop], [hi, hi, zTop], [lo, hi, zTop]]) }, edge), svg);
      mk('polyline', Object.assign({ points: pts([[lo, hi, zF], [lo, lo, zF], [hi, lo, zF]]) }, edge), svg);
      [[lo, lo], [hi, lo], [lo, hi]].forEach(function (c) { mk('polyline', Object.assign({ points: pts([[c[0], c[1], zF], [c[0], c[1], zTop]]) }, edge), svg); });

      var k = -1;
      function flush() { void svg.getBoundingClientRect(); getComputedStyle(slabs[0].g).transform; }
      function apply(next, mode) {
        slabs.forEach(function (s, i) {
          var on = i <= next, wasOn = i <= k;
          var d = mode === 'stagger' ? Math.max(0, i) * 0.11 : 0;
          s.g.classList.toggle('off', !on);
          s.g.classList.toggle('covered', i < next);
          s.g.classList.toggle('cur', i === next);
          s.g.style.transitionDelay = (on && !wasOn ? d : 0) + 's';
          s.tiles.forEach(function (t, j) {
            var td;
            if (i < next) td = mode === 'stagger' ? 0 : 0.45;                 // covered by the layer landing above
            else if (on && !wasOn) td = d + 0.5 + j * 0.07;                    // landing: tiles pop up
            else td = on ? 0.25 + j * 0.05 : 0;                                // uncovered again, or leaving
            t.style.transitionDelay = td.toFixed(2) + 's';
          });
          s.li.classList.toggle('on', on);
          s.li.classList.toggle('cur', i === next);
          s.li.style.transitionDelay = (on && !wasOn ? d + 0.25 : 0) + 's';
        });
        k = next;
      }
      function instant(next) {
        svg.classList.add('us-instant'); list.classList.add('us-instant');
        apply(next, 'instant'); flush();
        svg.classList.remove('us-instant'); list.classList.remove('us-instant');
      }
      return {
        enter: function () { instant(-1); flush(); },
        leave: function () { slabs.forEach(function (s) { s.g.classList.remove('hov'); }); },
        step: function (s, dir) { s = Math.min(n - 1, Math.max(0, s)); apply(s, dir === 'jump' ? 'stagger' : 'anim'); },
        print: function () { svg.classList.add('us-instant'); list.classList.add('us-instant'); apply(n - 1, 'instant'); }
      };
    }
  });
})();
