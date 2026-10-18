/*!
 * diagrams.js — SVG diagrams for the ALESIA deck (deck.js widgets), rebuilt
 * from the original PowerPoint figures so they stay sharp at any size.
 *
 *   <div data-widget="objectives-wheel"></div>
 *   <div data-widget="alesia-workflow"></div>
 *   <div data-widget="alesia-principle"></div>      (3 build steps)
 *   <div data-widget="optim-flow" data-flow="ga|de|pso|cmaes|bo"></div>
 *
 * Every diagram is plain SVG generated from the small descriptions below, so
 * texts and colours can be edited here. Arrowheads are drawn as paths (no
 * <marker>/<pattern> ids), which keeps clones in the overview identical.
 */
(function () {
  'use strict';
  if (!window.Deck) return;

  var C = {
    ink: '#26262b', line: '#2f2f35', muted: '#77777f', red: '#E50019',
    em: '#ee5f6f', elec: '#ff9a85', gen: '#c6c6c9', mech: '#93b4ff', therm: '#ffea70', mat: '#d3a385',
    opt: '#ff8b96', proj: '#a9e5cd', sup: '#fdd8b7', phys: '#e8e8eb', ana: '#c99a7d', db: '#ffe970'
  };

  var CSS = [
    '.dg{width:100%;height:100%;display:block;overflow:visible;font-family:Poppins,system-ui,sans-serif}',
    '.dg text{fill:' + C.ink + '}',
    '.dg .halo{paint-order:stroke;stroke:#fff;stroke-width:6px;stroke-linejoin:round}',
    '.dg .node{opacity:0;transform:translateY(10px);transform-box:fill-box;transform-origin:center}',
    '.dg.play .node{animation:dg-in .6s cubic-bezier(.2,.8,.2,1) forwards;animation-delay:calc(var(--i,0) * 70ms)}',
    '.dg .wire{stroke-dasharray:var(--len,2000);stroke-dashoffset:var(--len,2000)}',
    '.dg.play .wire{animation:dg-draw 1.1s ease forwards;animation-delay:calc(var(--i,0) * 70ms + 150ms)}',
    '.dg.play .wire.dotted{animation:none;stroke-dashoffset:0;stroke-dasharray:2 5}',
    '.dg .wire.dotted{stroke-dasharray:2 5;stroke-dashoffset:0}',
    '.dg .head{opacity:0}',
    '.dg.play .head{animation:dg-fade .3s ease forwards;animation-delay:calc(var(--i,0) * 70ms + 900ms)}',
    '.dg .flowdot{opacity:0}',
    '.dg.play .flowdot{opacity:1;transition:opacity .4s 1.6s}',
    '.dg .spin{transform-box:fill-box;transform-origin:center}',
    '@keyframes dg-in{to{opacity:1;transform:none}}',
    '@keyframes dg-draw{to{stroke-dashoffset:0}}',
    '@keyframes dg-fade{to{opacity:1}}',
    '.deck-clone .dg .node,.deck-clone .dg .head,.deck-clone .dg .flowdot{opacity:1!important;transform:none!important;animation:none!important}',
    '.deck-clone .dg .wire{stroke-dashoffset:0!important;animation:none!important}',
    '@media print{.dg .node,.dg .head{opacity:1!important;transform:none!important;animation:none!important}.dg .wire{stroke-dashoffset:0!important;animation:none!important}}'
  ].join('\n');
  if (!document.getElementById('dg-style')) {
    var st = document.createElement('style'); st.id = 'dg-style'; st.textContent = CSS; document.head.appendChild(st);
  }

  /* ------------------------------------------------------------ helpers */
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  // tiny markup: _{sub} ^{sup} *italic*
  function rich(s) {
    return esc(s)
      .replace(/_\{([^}]*)\}/g, '<tspan baseline-shift="sub" font-size="72%">$1</tspan>')
      .replace(/\^\{([^}]*)\}/g, '<tspan baseline-shift="super" font-size="72%">$1</tspan>')
      .replace(/\*([^*]+)\*/g, '<tspan font-style="italic">$1</tspan>');
  }
  function text(x, y, lines, o) {
    o = o || {};
    if (!Array.isArray(lines)) lines = String(lines).split('\n');
    var size = o.size || 15, lh = o.lh || size * 1.28, anchor = o.anchor || 'middle';
    var y0 = y - (lines.length - 1) * lh / 2 + size * 0.36;
    var attrs = 'x="' + x + '" y="' + y0 + '" font-size="' + size + '" text-anchor="' + anchor + '"' +
      (o.weight ? ' font-weight="' + o.weight + '"' : '') + (o.italic ? ' font-style="italic"' : '') +
      (o.fill ? ' style="fill:' + o.fill + '"' : '') + (o.cls ? ' class="' + o.cls + '"' : '') +
      (o.rotate ? ' transform="rotate(' + o.rotate + ' ' + x + ' ' + y + ')"' : '');
    return '<text ' + attrs + '>' + lines.map(function (l, i) {
      return '<tspan x="' + x + '" dy="' + (i ? lh : 0) + '">' + rich(l) + '</tspan>';
    }).join('') + '</text>';
  }
  function wrap(s, max) {
    var words = s.split(' '), lines = [], cur = '';
    words.forEach(function (w) {
      if ((cur + ' ' + w).trim().length > max && cur) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim();
    });
    if (cur) lines.push(cur);
    return lines;
  }
  function pathLen(pts) { var L = 0; for (var i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return L; }
  function d(pts) { return 'M' + pts.map(function (p) { return p[0] + ',' + p[1]; }).join(' L'); }
  function head(p, q, s, color) { // arrowhead at q pointing from p
    var a = Math.atan2(q[1] - p[1], q[0] - p[0]); s = s || 10;
    var x1 = q[0] - s * Math.cos(a - 0.42), y1 = q[1] - s * Math.sin(a - 0.42);
    var x2 = q[0] - s * Math.cos(a + 0.42), y2 = q[1] - s * Math.sin(a + 0.42);
    return '<path d="M' + q[0] + ',' + q[1] + ' L' + x1.toFixed(1) + ',' + y1.toFixed(1) + ' L' + x2.toFixed(1) + ',' + y2.toFixed(1) + 'Z" fill="' + (color || C.line) + '"/>';
  }
  /** arrow along a polyline. o: {i, dotted, both, color, width, noHead} */
  function arrow(pts, o) {
    o = o || {};
    var col = o.color || C.line, w = o.width || 1.6, L = Math.ceil(pathLen(pts)) + 2;
    var s = '<path class="wire' + (o.dotted ? ' dotted' : '') + '" style="--len:' + L + ';--i:' + (o.i || 0) + '" d="' + d(pts) + '" fill="none" stroke="' + col + '" stroke-width="' + w + '" stroke-linejoin="round" stroke-linecap="round"/>';
    var hs = '';
    if (!o.noHead) hs += head(pts[pts.length - 2], pts[pts.length - 1], o.hs || 10, col);
    if (o.both) hs += head(pts[1], pts[0], o.hs || 10, col);
    if (hs) s += '<g class="head" style="--i:' + (o.i || 0) + '">' + hs + '</g>';
    return s;
  }
  function node(i, inner, extra) { return '<g class="node" style="--i:' + i + '"' + (extra || '') + '>' + inner + '</g>'; }
  function rect(x, y, w, h, fill, o) {
    o = o || {};
    return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + (o.r == null ? 4 : o.r) + '" fill="' + (fill || '#fff') + '" stroke="' + (o.stroke || C.line) + '" stroke-width="' + (o.sw || 1.5) + '"/>';
  }
  function para(x, y, w, h, fill, k) { // parallelogram
    k = k || 14;
    return '<path d="M' + (x + k) + ',' + y + ' L' + (x + w) + ',' + y + ' L' + (x + w - k) + ',' + (y + h) + ' L' + x + ',' + (y + h) + 'Z" fill="' + fill + '" stroke="' + C.line + '" stroke-width="1.5"/>';
  }
  function junction(x, y, r) {
    r = r || 16; var k = r * 0.7071;
    return '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="#fff" stroke="' + C.line + '" stroke-width="1.5"/>' +
      '<path d="M' + (x - k) + ',' + (y - k) + ' L' + (x + k) + ',' + (y + k) + ' M' + (x + k) + ',' + (y - k) + ' L' + (x - k) + ',' + (y + k) + '" stroke="' + C.line + '" stroke-width="1.5"/>';
  }
  function diamond(x, y, hw, hh, fill) {
    return '<path d="M' + x + ',' + (y - hh) + ' L' + (x + hw) + ',' + y + ' L' + x + ',' + (y + hh) + ' L' + (x - hw) + ',' + y + 'Z" fill="' + (fill || '#fff') + '" stroke="' + C.line + '" stroke-width="1.5"/>';
  }
  function cylinder(x, y, w, h, fill) {
    var ry = 14;
    return '<path d="M' + x + ',' + (y + ry) + ' A' + (w / 2) + ',' + ry + ' 0 0 1 ' + (x + w) + ',' + (y + ry) + ' L' + (x + w) + ',' + (y + h - ry) + ' A' + (w / 2) + ',' + ry + ' 0 0 1 ' + x + ',' + (y + h - ry) + 'Z" fill="' + fill + '" stroke="' + C.line + '" stroke-width="1.5"/>' +
      '<path d="M' + x + ',' + (y + ry) + ' A' + (w / 2) + ',' + ry + ' 0 0 0 ' + (x + w) + ',' + (y + ry) + '" fill="none" stroke="' + C.line + '" stroke-width="1.5"/>';
  }
  function doc(x, y, w, h) {
    var f = 20;
    return '<path d="M' + x + ',' + y + ' L' + (x + w - f) + ',' + y + ' L' + (x + w) + ',' + (y + f) + ' L' + (x + w) + ',' + (y + h) + ' L' + x + ',' + (y + h) + 'Z" fill="#fff" stroke="' + C.line + '" stroke-width="1.5"/>' +
      '<path d="M' + (x + w - f) + ',' + y + ' L' + (x + w - f) + ',' + (y + f) + ' L' + (x + w) + ',' + (y + f) + '" fill="#f1f1f3" stroke="' + C.line + '" stroke-width="1.2"/>';
  }
  function flowDots(pathD, n, dur, color, r) {
    var s = '';
    for (var k = 0; k < n; k++) {
      s += '<circle class="flowdot" r="' + (r || 4.5) + '" fill="' + (color || C.red) + '"><animateMotion dur="' + dur + 's" repeatCount="indefinite" begin="-' + (k * dur / n).toFixed(2) + 's" path="' + pathD + '"/></circle>';
    }
    return s;
  }
  function svg(vb, inner, cls) {
    return '<svg class="dg' + (cls ? ' ' + cls : '') + '" viewBox="' + vb + '" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">' + inner + '</svg>';
  }
  function playable(el) {
    var s = el.querySelector('svg.dg');
    return {
      enter: function () { s.classList.remove('play'); void s.getBoundingClientRect(); s.classList.add('play'); },
      leave: function () { setTimeout(function () { if (!el.closest('.slide').classList.contains('active')) s.classList.remove('play'); }, 700); },
      print: function () { s.classList.add('play'); }
    };
  }

  /* ===================================================== objectives wheel */
  var ICONS = {
    conductor: '<ellipse cx="0" cy="-15" rx="15" ry="5"/><ellipse cx="0" cy="15" rx="15" ry="5"/><path d="M-9-11v24M9-11v24"/><path d="M-9-7h18M-9-2h18M-9 3h18M-9 8h18" stroke-width="2.4"/><path d="M9 8c8 0 10 6 14 6"/>',
    coils: '<ellipse cx="0" cy="-14" rx="16" ry="5.5"/><ellipse cx="0" cy="-5" rx="16" ry="5.5"/><ellipse cx="0" cy="4" rx="16" ry="5.5"/><ellipse cx="0" cy="13" rx="16" ry="5.5"/>',
    structure: '<rect x="-17" y="-17" width="34" height="34" rx="6"/><circle r="11"/><circle r="6"/><circle cx="-13" cy="-13" r="1.5"/><circle cx="13" cy="-13" r="1.5"/><circle cx="-13" cy="13" r="1.5"/><circle cx="13" cy="13" r="1.5"/>',
    magnetics: '<rect x="-3" y="-6" width="6" height="12" rx="1"/><path d="M-6-3c-14-10-14 16 0 6M6-3c14-10 14 16 0 6"/><path d="M-6-8c-24-14-24 30 0 16M6-8c24-14 24 30 0 16"/>',
    mechanics: '<path d="M-9-15h18M-9 15h18M0-15v30"/><path d="M-20 0h9M-14-4l3 4-3 4M20 0h-9M14-4l-3 4 3 4"/>',
    cryo: '<path d="M0-18v36M-15.6-9l31.2 18M-15.6 9l31.2-18"/><path d="M-4-14l4 4 4-4M-4 14l4-4 4 4M-14.5-3.5l5.5 1.5-1.5 5.5M14.5 3.5l-5.5-1.5 1.5-5.5M14.5-3.5l-5.5 1.5 1.5 5.5M-14.5 3.5l5.5-1.5-1.5-5.5"/>',
    quench: '<path d="M0-18l15 6v9c0 10-7 17-15 21-8-4-15-11-15-21v-9z"/><path d="M0 11c-5 0-7-4-6-8 1-3 3-4 3-8 3 2 4 5 3 7 1-1 2-2 2-4 3 3 4 6 3 8-1 3-3 5-5 5z"/>',
    project: '<path d="M-16-2l14-14h14v14l-14 14z"/><circle cx="6" cy="-10" r="2.2"/><path d="M-3 0c-2-3 3-4 3-1s-6 2-5 5c1 3 6 1 5-1M-3-4v2M-2 5v2" stroke-width="1.8"/>',
    modeling: '<rect x="-18" y="-15" width="36" height="24" rx="2.5"/><path d="M-6 15h12M0 9v6"/><path d="M-13 3l6-6 5 4 7-8 6 4"/><path d="M-13-9h6M-13-6h4" stroke-width="1.6"/>'
  };
  var WHEEL = [
    ['1. Conductor', 'Dimension, composition, critical current fits, LTS, HTS, margins, layout, strands, material properties', 'conductor', '#2f9d55'],
    ['2. Coils', 'Winding geometry, layout, turns', 'coils', '#2f62d0'],
    ['3. Structure layout', 'Iron yoke, mandrel, brass flanges, insulation spacers, interfaces, instrumentation, ancillaries, power supply, CAD design', 'structure', '#77777f'],
    ['4. Magnetics / Field quality', 'Peak field, harmonics, homogeneity, fringe field, current density, transient', 'magnetics', '#ef8424'],
    ['5. Mechanics / Stress', 'Lorentz force, cool-down shrinkage, deformation, gravity', 'mechanics', '#8a52d4'],
    ['6. Cryogenics / Cooling', 'Operating temperature, cooling power, thermal shields, cryostats, losses', 'cryo', '#1898a0'],
    ['7. Quench protection', 'Hotspot temperature, power deposition, propagation velocities, voltages, dump resistances', 'quench', '#e2302d'],
    ['8. Project', 'Cost, fabrication, schedule, reliability, risks, available space, politics, transport', 'project', '#8d8d93'],
    ['9. Modelling', 'FEM codes, models, data analysis, parameter space, data files (excel), in-house codes (C++, Fortran, Python), data exchange', 'modeling', '#23408c']
  ];
  Deck.widget('objectives-wheel', {
    mount: function (el) {
      var cx = 470, cy = 335, R = 225, rn = 43, rc = 108, s = '';
      s += '<g class="node" style="--i:0"><circle cx="' + cx + '" cy="' + cy + '" r="' + rc + '" fill="#fff" stroke="' + C.ink + '" stroke-width="3"/>' +
        text(cx, cy, ['Superconducting', 'magnet design'], { size: 23, weight: 500 }) + '</g>';
      WHEEL.forEach(function (w, i) {
        var a = (-90 + i * 40) * Math.PI / 180, x = cx + R * Math.cos(a), y = cy + R * Math.sin(a);
        var p1 = [cx + (rc + 6) * Math.cos(a), cy + (rc + 6) * Math.sin(a)], p2 = [x - (rn + 6) * Math.cos(a), y - (rn + 6) * Math.sin(a)];
        s += arrow([p1, p2], { both: true, i: i + 2, hs: 9, width: 1.6 });
        var right = Math.cos(a) > 0.2, left = Math.cos(a) < -0.2, top = !right && !left;
        var lx = top ? x : right ? x + rn + 16 : x - rn - 16, anchor = top ? 'middle' : right ? 'start' : 'end';
        var desc = wrap(w[1], top ? 46 : 31);
        var ty = top ? y - rn - 36 - desc.length * 18 : y - (desc.length * 18) / 2 - 4;
        var label = text(lx, ty, w[0], { size: 23, weight: 500, anchor: anchor }) +
          text(lx, ty + 21 + (desc.length - 1) * 9, desc, { size: 15, lh: 18, anchor: anchor, fill: C.muted });
        s += node(i + 1,
          '<circle cx="' + x + '" cy="' + y + '" r="' + rn + '" fill="#fff" stroke="' + w[3] + '" stroke-width="3.2"/>' +
          '<g transform="translate(' + x + ',' + y + ') scale(1.05)" fill="none" stroke="' + w[3] + '" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' + ICONS[w[2]] + '</g>' + label);
      });
      // iterative process arc
      s += '<g class="node" style="--i:11"><path d="M760,40 C860,40 930,110 930,210" fill="none" stroke="' + C.red + '" stroke-width="4" stroke-linecap="round"/>' +
        head([800, 39], [752, 40], 16, C.red) + head([930, 170], [930, 218], 16, C.red) +
        text(946, 122, ['Iterative', 'process'], { size: 21, fill: C.red, anchor: 'start', weight: 500 }) + '</g>';
      el.innerHTML = svg('0 0 1000 640', s);
      return playable(el);
    }
  });

  /* ===================================================== ALESIA workflow */
  Deck.widget('alesia-workflow', {
    mount: function (el) {
      var s = '', i = 0;
      // wires first (under the boxes)
      s += arrow([[330, 45], [165, 45]], { i: 9 });
      s += text(247, 33, 'Selection', { size: 14 });
      s += arrow([[66, 45], [10, 45], [10, 206], [25, 206]], { i: 1 });
      s += arrow([[60, 206], [85, 206]], { i: 2 });
      s += arrow([[130, 104], [43, 104], [43, 188]], { i: 2, dotted: true });
      s += arrow([[258, 104], [361, 104], [361, 128]], { i: 2, dotted: true });
      s += '<path class="wire" style="--len:200;--i:3" d="M244,206 L298,206" stroke="' + C.line + '" stroke-width="1.6"/>';
      s += '<path class="wire" style="--len:200;--i:3" d="M298,174 L298,238" stroke="' + C.line + '" stroke-width="2.2"/>';
      s += arrow([[298, 174], [298, 146], [343, 146]], { i: 3 });
      s += arrow([[298, 238], [298, 266], [343, 266]], { i: 3 });
      s += text(290, 160 + 0, ['Laplace', 'forces'], { size: 14, anchor: 'end', cls: 'halo' });
      s += text(290, 252, ['Energy', '*B* peak'], { size: 14, anchor: 'end', cls: 'halo' });
      s += arrow([[378, 146], [404, 146]], { i: 4 });
      s += arrow([[378, 266], [404, 266]], { i: 4 });
      s += arrow([[361, 324], [361, 284]], { i: 4, dotted: true });
      s += '<path class="wire" style="--len:80;--i:5" d="M565,146 L586,146 M586,136 L586,156" stroke="' + C.line + '" stroke-width="1.8"/>';
      s += text(641, 147, ['Stress', 'Deformations'], { size: 14 });
      s += arrow([[663, 170], [663, 196]], { i: 5 });
      s += '<path class="wire" style="--len:80;--i:5" d="M485,286 L485,300 M475,300 L495,300" stroke="' + C.line + '" stroke-width="1.8"/>';
      s += text(525, 330, ['Margins', 'Sc %'], { size: 14, anchor: 'end' });
      s += arrow([[540, 341], [584, 341]], { i: 6 });
      s += '<path class="wire" style="--len:80;--i:6" d="M663,321 L663,306 M653,306 L673,306" stroke="' + C.line + '" stroke-width="1.8"/>';
      s += text(663, 278, ['Hotspot', 'Discharge'], { size: 14 });
      s += arrow([[663, 252], [663, 232]], { i: 6 });
      s += arrow([[680, 214], [789, 214]], { i: 7 });
      s += arrow([[866, 214], [915, 214]], { i: 8 });
      s += text(892, 228, 'Yes', { size: 14, anchor: 'start' });
      s += arrow([[828, 176], [828, 45], [527, 45]], { i: 8 });
      s += text(846, 162, 'No', { size: 14, anchor: 'start' });
      s += text(728, 33, 'Automated feedback loop', { size: 14 });
      s += arrow([[828, 311], [828, 253]], { i: 8 });
      // boxes
      s += node(i++, '<path d="M66,36 L163,25 L163,63 L66,63Z" fill="' + C.gen + '" stroke="' + C.line + '" stroke-width="1.5"/>' + text(114, 48, 'Inputs', { size: 16 }));
      s += node(i++, rect(330, 3, 196, 84, '#fff', { r: 2 }) + text(428, 45, ['Optimiser:', 'Machine learning or', 'Evolutionary algorithms'], { size: 15.5 }));
      s += node(i++, para(122, 84, 146, 41, C.mat, 16) + text(195, 104.5, ['Material', 'properties'], { size: 14.5 }));
      s += node(i++, junction(43, 206, 17));
      s += node(i++, rect(86, 186, 158, 40, C.em, { r: 2 }) + text(165, 206, 'Magnetism', { size: 16 }));
      s += node(i++, junction(361, 146, 17) + junction(361, 266, 17));
      s += node(i++, rect(405, 126, 160, 40, C.mech, { r: 2 }) + text(485, 146, 'Mechanics', { size: 16 }));
      s += node(i++, rect(405, 246, 160, 40, C.mat, { r: 2 }) + text(485, 266, 'Conductor design', { size: 16 }));
      s += node(i++, para(291, 325, 150, 41, C.mat, 16) + text(366, 345.5, 'Conductor fits', { size: 15 }));
      s += node(i++, '<path d="M585,321 L682,321 L652,361 L585,361Z" fill="' + C.elec + '"/><path d="M682,321 L745,321 L745,361 L652,361Z" fill="' + C.therm + '"/>' +
        rect(585, 321, 160, 40, 'none', { r: 2 }) + text(665, 341, 'Quench', { size: 16 }));
      s += node(i++, junction(663, 214, 17));
      s += node(i++, diamond(828, 214, 38, 38, '#fff') + text(828, 214, 'Ok?', { size: 16 }));
      s += node(i++, para(762, 312, 134, 56, C.gen, 18) + text(829, 340, ['Targets', 'Constraints'], { size: 15 }));
      // automation: tokens travelling around the loop
      var loop = 'M527,45 L165,45 L66,45 L10,45 L10,206 L86,206 L244,206 L298,206 L298,146 L405,146 L565,146 L663,146 L663,214 L790,214 L828,214 L828,45 L527,45';
      var loop2 = 'M244,206 L298,206 L298,266 L405,266 L485,266 L485,341 L585,341 L663,341 L663,214 L790,214';
      s += flowDots(loop, 4, 7, C.red, 5) + flowDots(loop2, 2, 4.2, '#ff7a8a', 4);
      el.innerHTML = svg('0 0 940 375', s);
      return playable(el);
    }
  });

  /* ===================================================== ALESIA principle */
  Deck.widget('alesia-principle', {
    mount: function (el) {
      var s = '', k;
      // outer automation frame with hatch
      var hatch = '';
      for (k = -640; k < 900; k += 18) {
        // line from (157+k, 555) going up-right at 45°, clipped to the frame box
        var x0 = 157 + k, y0 = 553, x1 = x0 + 551, y1 = 2;
        var cx0 = Math.max(x0, 166), cy0 = y0 - (cx0 - x0), cx1 = Math.min(x1, 1016), cy1 = y0 - (cx1 - x0);
        if (cy0 > 546) { cx0 += cy0 - 546; cy0 = 546; }
        if (cy1 < 10) { cx1 -= 10 - cy1; cy1 = 10; }
        if (cx1 > cx0) hatch += 'M' + cx0 + ',' + cy0 + ' L' + cx1 + ',' + cy1 + ' ';
      }
      s += '<g class="node" style="--i:0"><rect x="158" y="3" width="866" height="551" rx="26" fill="#fbfefc"/>' +
        '<path d="' + hatch + '" stroke="#bfe8d4" stroke-width="1.6"/>' +
        '<rect x="158" y="3" width="866" height="551" rx="26" fill="none" stroke="' + C.ink + '" stroke-width="2.2"/></g>';
      // base layer
      s += node(1, doc(4, 22, 104, 128) + text(55, 86, ['Scripts', 'Input ranges', 'Targets'], { size: 16 }));
      s += arrow([[108, 85], [187, 85]], { i: 2 });
      s += text(134, 150, ['Start', 'automation'], { size: 15, rotate: -90 });
      s += node(2, rect(188, 38, 142, 92, C.opt, { r: 2 }) + text(259, 84, ['Multi-parametric', 'optimiser'], { size: 16 }));
      s += node(3, diamond(956, 270, 64, 60, '#fff') + text(956, 270, ['Score', 'minimised?'], { size: 16 }));
      s += arrow([[956, 210], [956, 84], [331, 84]], { i: 4 });
      s += text(486, 72, 'Wait for parallel runs', { size: 15.5 });
      s += text(966, 191, 'No', { size: 15, anchor: 'start' });
      // step 1: execution
      var s1 = '';
      s1 += arrow([[259, 130], [259, 207]], { i: 0 });
      s1 += text(259, 168, ['Choose', 'inputs'], { size: 15, cls: 'halo' });
      s1 += rect(217, 208, 89, 122, C.proj, { r: 2 }) + text(261.5, 269, ['Parallel', 'execution'], { size: 15.5 });
      s1 += arrow([[306, 268], [365, 268]], { i: 0 });
      s1 += text(326, 238, 'Run', { size: 15, rotate: -90 });
      s1 += '<rect x="345" y="150" width="531" height="268" rx="28" fill="#fff" stroke="' + C.ink + '" stroke-width="2.4"/>';
      s1 += text(611, 173, 'Execution sequence (user-configured)', { size: 16, weight: 600 });
      s1 += rect(366, 252, 160, 36, '#fff', { r: 1 }) + text(446, 270, '*Magnetism*', { size: 16 });
      s1 += arrow([[526, 270], [548, 270], [548, 229], [575, 229]], {});
      s1 += arrow([[548, 270], [548, 311], [575, 311]], {});
      s1 += rect(576, 210, 160, 38, '#fff', { r: 1 }) + text(656, 229, '*Mechanics*', { size: 16 });
      s1 += rect(576, 292, 160, 38, C.phys, { r: 1 }) + text(656, 311, '*Conductor design*', { size: 16 });
      s1 += arrow([[656, 330], [656, 364], [695, 364]], {});
      s1 += rect(696, 345, 160, 38, C.phys, { r: 1 }) + text(776, 364, '*Quench*', { size: 16 });
      s1 += arrow([[736, 229], [775, 229], [775, 250]], {});
      s1 += arrow([[776, 345], [776, 286]], {});
      s1 += junction(775, 268, 17);
      s1 += arrow([[792, 268], [891, 268]], {});
      s1 += text(615, 399, '*Ex: Superconducting magnet design*', { size: 15 });
      s += '<g data-step="1">' + s1 + '</g>';
      // step 2: data management
      var s2 = '';
      s2 += cylinder(186, 362, 120, 108, C.db) + text(246, 422, ['Material', 'database', '(SQL, FastAPI)'], { size: 15 });
      s2 += arrow([[306, 416], [328, 416], [328, 350], [344, 350]], {});
      s2 += arrow([[328, 416], [328, 494], [344, 494]], {});
      s2 += rect(345, 474, 239, 40, C.mech, { r: 1 }) + text(464.5, 494, 'Interface between codes', { size: 16 });
      s2 += arrow([[465, 473], [465, 419]], { both: true });
      s2 += arrow([[585, 494], [707, 494]], { both: true });
      s2 += cylinder(708, 438, 122, 108, C.proj) + text(769, 498, ['Project', 'database', '(HDF5)'], { size: 15 });
      s2 += arrow([[956, 330], [956, 472]], {});
      s2 += text(972, 345, 'Yes', { size: 15, anchor: 'start' });
      s2 += arrow([[830, 492], [935, 492]], {});
      s2 += junction(952, 492, 17);
      s2 += text(905, 530, ['End', 'optimisation'], { size: 15 });
      s += '<g data-step="2">' + s2 + '</g>';
      // step 3: analysis
      var s3 = '';
      s3 += arrow([[952, 509], [952, 568], [588, 568], [588, 593]], {});
      s3 += arrow([[528, 594], [528, 568], [55, 568], [55, 541]], {});
      s3 += text(110, 556, 'Generate', { size: 15 });
      s3 += doc(4, 405, 104, 135) + text(52, 472, ['.doc', '.pptx', '.tex', '.ipynb'], { size: 16 });
      s3 += rect(172, 594, 238, 40, '#fff', { r: 1 }) + text(291, 614, 'Design validation', { size: 16 });
      s3 += rect(468, 594, 240, 40, C.ana, { r: 1 }) + text(588, 614, 'Data analysis', { size: 16 });
      s3 += rect(776, 594, 239, 40, C.sup, { r: 1 }) + text(895.5, 614, 'Supervised learning', { size: 16 });
      s3 += arrow([[468, 614], [411, 614]], {});
      s3 += arrow([[776, 614], [709, 614]], {});
      s += '<g data-step="3">' + s3 + '</g>';
      s += flowDots('M331,84 L956,84 L956,210', 3, 5, C.red, 4.5);
      el.innerHTML = svg('0 0 1030 640', s);
      return playable(el);
    }
  });

  /* ===================================================== optimiser flowcharts */
  var FLOWS = {
    ga: { pre: [], post: [['box', 'Select best parents'], ['box', 'Crossover: take genes randomly between 2 parents'], ['box', 'Mutation: take random genes']] },
    de: { pre: [], post: [['dec', 'Is best score?', 'No · recover previous best', 'Yes · keep individual'], ['box', 'Take 3 random parents'], ['box', 'Update individual genes depending on the differential weight']] },
    pso: { pre: [], post: [['box', 'Update particle “velocities”: depends on the particle best “position” and the global best “position”'], ['box', 'Update particle “positions”']] },
    cmaes: { pre: [['box', 'Compute covariance matrix']], post: [['box', 'Update covariance matrix'], ['box', 'Generate new population']] },
    bo: { pre: [], post: [['box', 'Build surrogate model (Gaussian process) from all data'], ['box', 'Optimise acquisition function'], ['box', 'Generate new population']] }
  };
  var FC = { init: ['#eaf6e5', '#7fbf6a'], dia: ['#fff6d4', '#e2b93b'], end: ['#fde4e7', '#E50019'], box: ['#eef3ff', '#7fa2f0'] };
  Deck.widget('optim-flow', {
    mount: function (el) {
      var f = FLOWS[el.getAttribute('data-flow')] || FLOWS.ga;
      var X = 205, BW = 290, y = 8, s = '', gapY = 36, items = [], idx = 0;
      function boxH(t) { return 22 + wrap(t, 30).length * 21; }
      function addBox(t, colors) {
        var h = boxH(t);
        items.push({ type: 'box', y: y, h: h });
        s += node(idx++, '<rect x="' + (X - BW / 2) + '" y="' + y + '" width="' + BW + '" height="' + h + '" rx="10" fill="' + colors[0] + '" stroke="' + colors[1] + '" stroke-width="2"/>' +
          text(X, y + h / 2, wrap(t, 30), { size: 17, lh: 21 }));
        var top = y; y += h + gapY; return { top: top, bottom: top + h };
      }
      var first = addBox('Initial random population', FC.init);
      var prevBottom = first.bottom;
      f.pre.forEach(function (it) {
        s += arrow([[X, prevBottom], [X, y - 1]], { i: idx });
        var b = addBox(it[1], FC.box); prevBottom = b.bottom;
      });
      // score diamond
      var dy = y + 42;
      s += arrow([[X, prevBottom], [X, dy - 42]], { i: idx });
      s += node(idx++, diamond(X, dy, 62, 42, FC.dia[0]).replace('stroke="' + C.line + '"', 'stroke="' + FC.dia[1] + '"').replace('stroke-width="1.5"', 'stroke-width="2"') + text(X, dy, 'Score', { size: 18, weight: 500 }));
      s += arrow([[X + 62, dy], [X + 190, dy]], { i: idx });
      s += text(X + 126, dy - 22, ['N generation', 'reached'], { size: 14, fill: C.muted });
      s += node(idx++, '<circle cx="' + (X + 222) + '" cy="' + dy + '" r="31" fill="' + FC.end[0] + '" stroke="' + FC.end[1] + '" stroke-width="2"/>' + text(X + 222, dy, 'End', { size: 17, weight: 500 }));
      y = dy + 42 + gapY;
      prevBottom = dy + 42;
      var lastBox = null;
      f.post.forEach(function (it) {
        if (it[0] === 'box') {
          s += arrow([[X, prevBottom], [X, y - 1]], { i: idx });
          var b = addBox(it[1], FC.box); prevBottom = b.bottom; lastBox = b;
        } else {
          var cy = y + 36;
          s += arrow([[X, prevBottom], [X, cy - 36]], { i: idx });
          s += node(idx++, diamond(X, cy, 74, 36, FC.dia[0]).replace('stroke="' + C.line + '"', 'stroke="' + FC.dia[1] + '"').replace('stroke-width="1.5"', 'stroke-width="2"') + text(X, cy, it[1], { size: 15 }));
          s += text(X + 92, cy - 18, it[2], { size: 14, anchor: 'start', fill: C.muted });
          s += text(X + 12, cy + 52, it[3], { size: 14, anchor: 'start', fill: C.muted });
          var nextTop = cy + 36 + gapY + 22;
          s += arrow([[X + 74, cy], [X + 165, cy], [X + 165, nextTop + 18], [X + BW / 2 + 1, nextTop + 18]], { i: idx });
          prevBottom = cy + 36; y = nextTop;
        }
      });
      // loop back
      var lb = lastBox, ly = lb.top + (lb.bottom - lb.top) / 2;
      var loopPts = [[X - BW / 2, ly], [X - BW / 2 - 30, ly], [X - BW / 2 - 30, dy], [X - 63, dy]];
      s += arrow(loopPts, { i: idx });
      var H = lb.bottom + 10;
      // one token running the loop
      s += '<circle class="flowdot" r="6" fill="' + C.red + '"><animateMotion dur="4.5s" repeatCount="indefinite" path="M' + X + ',' + dy + ' L' + X + ',' + ly + ' L' + (X - BW / 2 - 30) + ',' + ly + ' L' + (X - BW / 2 - 30) + ',' + dy + ' L' + X + ',' + dy + '"/></circle>';
      el.innerHTML = svg('0 0 470 ' + Math.ceil(H), s);
      return playable(el);
    }
  });
})();
