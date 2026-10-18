# Presentation of ALESIA — HTML slides

A small, dependency-free slide engine and the ALESIA talk built on it.

* **No server, no build step.** Double-click `index.html` to present from disk, or push the folder to GitHub Pages.
* **Engine separated from content.** Slides live in `index.html`; the engine (`engine/`) never needs editing.
* **Pen, highlighter, eraser, laser pointer, overview, speaker view, PDF export.**
* **Custom JavaScript per slide** through a tiny widget API (`widgets/`).
* Fonts (Poppins) and maths (KaTeX) are bundled, so it also works offline.

```
index.html              ← the slides (content)
engine/deck.js          ← navigation, steps, tools, overview, speaker view
engine/deck.css         ← engine mechanics (transitions, toolbar, print)
theme/theme.css         ← colours, typography, layouts (red/white CEA look)
theme/cubes.svg         ← top-right isometric cubes
widgets/magnet-design.js← animated title sequence (6 stages) + the tilted-window engine (MDKit)
widgets/alesia-windows.js ← more window animations: fitness landscape, ECRIS/IBSimu, thank-you hub
widgets/diagrams.js     ← SVG diagrams (objectives wheel, workflow, principle, flowcharts)
widgets/alesia-stack.js ← "ALESIA – Under the hood": isometric stack of layers built one press at a time (slide 3)
widgets/optim-demo.js   ← live optimisers on the Ackley function (slide 6)
widgets/optim-runs.js   ← recorded Bayesian optimisation and neural-network runs replayed by the demo
tools/make_optim_runs.py← Python script that produced optim-runs.js (numpy, scipy, scikit-learn)
widgets/surrogate-demo.js ← learning-surrogate animation (slide 7)
widgets/surrogate-run.js  ← its recorded neural-network run; tools/make_surrogate_run.py recomputes it
widgets/widget-template.js ← copy this to write your own widget
assets/img/             ← images extracted from the PowerPoint
assets/video/           ← ECRIS electrode optimisation video (MP4 + WebM fallback)
vendor/                 ← Poppins fonts, KaTeX
```

## Presenting

| Key | Action |
| --- | --- |
| `→` `PageDown` `Space` | next step / slide (works with most clickers) |
| `←` `PageUp` | previous step / slide |
| `Home` `End` | first / last slide |
| number then `Enter` | jump to slide |
| `P` / `H` / `E` | pen / highlighter / eraser (drawings are kept per slide) |
| `L` | laser pointer |
| `C` · `Ctrl+Z` | clear the slide's drawings · undo last stroke |
| `O` | overview (click a slide or use arrows + Enter) |
| `F` (or `F5`) | fullscreen |
| `S` | speaker view in a second window: current/next slide, notes, timer (allow pop-ups) |
| `B` / `W` | black / white screen |
| `V` | switch the case (Superconducting magnet ↔ ECR ion source) on every slide that has one, from any slide |
| `Q` | animation quality: auto → high → medium → low (see *Performance*) |
| `?` | help · `Esc` leaves the current tool |

Moving the mouse shows a small toolbar (bottom right) with the same tools and pen colours.
The URL keeps the position (`index.html#/7/2` = slide 7, step 2), so a reload stays in place.

## Adding a slide

Copy any `<section class="slide">…</section>` block in `index.html`:

```html
<section class="slide" data-title="My new slide">
  <h2>My new slide</h2>
  <div class="content cols" style="--cols: 1fr 1fr">
    <div>
      <ul>
        <li>Always visible</li>
        <li data-step>Appears on the next press</li>
        <li data-step data-anim="zoom">Then this one, with a zoom</li>
      </ul>
      <p>Maths works inline $f(y)=\sum_i w_i (y_i-t_i)^2$ or as a block $$\int_0^{t_d} J^2\,dt$$</p>
    </div>
    <figure class="full">
      <div class="fill"><img src="assets/img/my-figure.png" alt="…"></div>
      <figcaption>Caption</figcaption>
    </figure>
  </div>
  <p class="cite">Author et al. (2026), <a href="https://…">doi:…</a></p>
  <aside class="notes">Speaker notes (press S).</aside>
</section>
```

Useful building blocks (see `theme/theme.css`):

* `.content` — fills the space under the title. `.cols` + `style="--cols: 1.2fr 1fr; --gap: 40px"` for columns, `.rows` for a vertical stack.
* `.card`, `.card.white`, `.card.accent` — tinted boxes. `table.data` — styled tables.
* `figure > .fill > img` — the image scales to the available space. `.cite` — reference above the footer.
* `.hl` red bold, `.muted`, `.small`, `.tiny`, `.pill`.
* Steps: `data-step` (next press), `data-step="3"` (explicit), `data-step-out="4"` (hide again), `data-anim="fade|up|down|left|right|zoom|grow|blur|highlight"`.
* Slide options: `data-chrome="none"` (no footer), class `no-decor` (no cubes), `data-dim-past` (dims earlier steps).
* End of the talk: `data-last` on one slide (here the conclusion, slide 10). Page numbers read `n/10` up to it and the progress bar fills up to it and stays full; the back-up slides after it show the plain number.
* Versions of one slide (slides 4, 5, 8 and 9, *Case: Superconducting magnet / ECR ion source*): buttons `<button data-variant="sc">…</button>` inside `<div class="variant-switch">` (shown at the top left, above the title; hidden in the PDF), and `data-for-variant="sc"` on anything that belongs to one version only — a title, a list, or a whole `<div class="content">` block. The choice is shared by the whole deck: picking ECRIS on one slide switches every slide that has an ECRIS version, and it survives a reload of the tab. Each version has its own build steps, widgets and videos (the hidden version's animations sleep). The first button is the default; widgets with versions of their own get a `variant(name)` call; `Deck.variant('ecris')` switches from a script.
* Footer text, date and logo are set once on `<div class="deck" data-footer="…" data-date="…">` (here: Séminaire AISSAI, 4/11/2026).

## Adding JavaScript (widgets)

```js
Deck.widget('my-thing', {
  steps: 2,                          // optional: key presses consumed on this slide
  mount(el, api) {                   // once, at start-up
    return {
      enter(step) {}, leave() {},    // slide shown / hidden
      step(k, dir) {},               // k = 0…steps, dir = +1, -1 or 'jump'
      resize(scale) {}, print() {}   // optional
    };
  }
});
```

Put it in `widgets/my-thing.js`, add `<script src="widgets/my-thing.js"></script>` after `engine/deck.js`, and use `<div data-widget="my-thing"></div>` in a slide. `widgets/widget-template.js` is a working example. Plain inline scripts also work: listen to `deck:enter`, `deck:leave` and `deck:step` events on `document`.

## The title animation (`magnet-design.js`)

Six windows appear one after the other on their own (one every 4.6 s): magnetic (field map + Biot–Savart field lines), mechanics (stress + deformation), conductor (Rutherford cable with changing dimensions over a Nb-Ti J<sub>c</sub>(B) fit), quench (normal-zone propagation), cryogenics (process loop) and CAD (sketch → extrude). Previous windows slide left and stack; each new pair is linked by a blocked red arrow. After a 6 s hold the windows fade out and the sequence starts again, forever. It consumes no key press: one press goes to slide 2. Timing is set in `MAGNET.auto` near the end of the file; window titles, status texts and sizes are in the `WINDOWS` array. It is self-contained (injects its own CSS) and also runs without the engine.

## Other window animations (`alesia-windows.js`)

They reuse the window engine of `magnet-design.js` (exposed as `window.MDKit`), so they share the same look:

* `alesia-workflow-live` — slide 4: the ALESIA workflow, in two versions chosen with the Case buttons (Superconducting magnet / ECR ion source). **SC magnet**: inputs (pandas · json), targets & constraints and the four physics codes in a row at the bottom; one key press adds the Bayesian optimiser, the ALESIA database (material properties, conductor fits), the ALESIA manager (Slurm terminals, "Parallel running"), the score function and the red animated links of the automated loop. **ECRIS**: the same loop with a single, larger IBSimu window ("Beam extraction") and no database. Both versions are described in `WF_VARIANTS` (`alesia-windows.js`): windows, positions, the step of each window, delays, captions and arrows.
* `coil-params` / `ibsimu-params` — slide 5, top right, drawn on the slide (no window), one per case: 1/8 of a solenoid (coil) in its iron yoke with changing dimensions and a current-density colour bar, next to the conductor animation of the title sequence; or the IBSimu beam extraction with electrodes coloured by their changing potential (colour bar).
* `alesia-landscape` — slide 5, appears with "For each run" (one key press): one ALESIA window, a 2D fitness landscape in the reds of the optimiser example (darkest = global minimum, lighter = local minima) with a green discontinuity band; a particle swarm slowly converges to the global minimum ("finding minima ongoing").
* `ecris-design` — slide 8, ECRIS version: magnetic and mechanics windows, then an IBSimu window: ECRIS extraction electrodes, candidate electrode shapes coloured by fitness score, pink beam propagating left to right ("beam dynamics ongoing"). Two key presses.
* `alesia-hub` — thank-you slide: the six tools of the title sequence, now connected through a central ALESIA window running a Bayesian optimisation (Gaussian-process surrogate, uncertainty band, expected-improvement acquisition).

To build your own, call `MDKit.makeWidget({ windows, steps, layout, links })` — see the three configurations at the end of `alesia-windows.js`. Link types: `blocked` (title slide), `flow` (connected) and `hub`.

## The optimiser example (`optim-demo.js`, slide 6)

The right half of slide 6 is a live example on the 2D Ackley function: 320 evaluations (16 iterations of 20), each key press switches method — random, GA, DE, PSO, CMA-ES, BO, DNN (6 presses); tabs can be clicked, ↻ runs another seed. Random to CMA-ES run live in the browser. **BO** (Gaussian process with expected improvement, batches of 20) and **DNN** (active learning with a 2-64-64-1 network refitted at each iteration, new points = best predicted) are real runs computed offline in Python and replayed, so they cost nothing during the talk; `python3 tools/make_optim_runs.py` recomputes them. The text on the left follows the running method: an element with `data-od-show="bo dnn"` is shown only for those methods, `data-od-hl="…"` is highlighted (dimmed otherwise).

## ALESIA – Under the hood (`alesia-stack.js`, slide 3)

An isometric glass box in which the layers of ALESIA are stacked, bottom to top. The content is in `index.html`, not in the script: the `<ol class="us-list">` beside the widget lists the layers, top first, each `<li>` with a name (`.us-t`), a description (`.us-d`) and its tiles in `data-tiles="GA | DE | …"`. The bottom layer is there when the slide opens; each key press drops the next layer onto the stack, its tiles pop up on its top face and its description appears in the list (current one in red), so the slide uses one press per layer above the first. Hovering a description outlines its layer. A tile can carry a logo: `data-tiles="Name=assets/img/logo.png"` draws the image on the tile with the name under it (none is used at the moment). Colours, sizes and timings are at the top of the script.

## The learning surrogate (`surrogate-demo.js`, slide 7)

320 random points on the same Ackley function arrive 20 at a time; after each batch a 2-64-64-1 neural network is refitted and its prediction map, best predicted point (purple diamond) and prediction error (RMSE over the whole domain) are updated, next to the true function. It plays by itself when the slide is shown (no key press), ↻ plays it again. The network was trained offline in Python (`python3 tools/make_surrogate_run.py` recomputes `widgets/surrogate-run.js`), so the slide costs nothing during the talk.

## Videos

`<video data-autoplay muted loop playsinline controls>` starts from the beginning each time its slide is shown and pauses when you leave. Give an MP4 (H.264) first and a WebM second, as on slide 9 (ECRIS version), so every browser finds a format it can play.

## Performance

The deck is designed to stay light, also on older laptops:

* **One frame clock.** Every animation (windows, moving dots, the optimiser demo) runs on a single shared loop, `Deck.ticker`, so the browser draws at most 30 frames per second, never 60. SVG `<animateMotion>` dots are moved by this loop too.
* **Only what changes is redrawn.** Windows redraw their picture only when it changes, not while they merely move. Text-like windows (tables, code, Word, terminals) refresh a few times per second. Static parts (the fitness map, the IBSimu grid) are painted once on a layer underneath. Arrows are only re-sent to the browser when they really change.
* **Nothing runs off screen.** Hidden slides do not animate, their canvases are released, the pen/laser layers only take memory while you draw, the video only loads on its slide, and pictures of the next slide are decoded in advance.
* **Speaker view** copies the current slide every 2 s (not both previews every second), as still pictures.

### Quality modes

| Mode | Frames / s | Picture resolution | Notes |
| --- | --- | --- | --- |
| high | 30 | up to 1.5× | full effects |
| medium | 20 | up to 1.1× | lighter shadows, secondary windows refresh less |
| low | 15 | up to 0.85× | no shadows, half the field lines, static scrollbars |

The default is **auto**: it starts on *high* and steps down by itself when the computer is working flat out (little idle time left, or frames are being dropped for ~6 s). The level it finds is remembered in this browser, so the next time the deck opens directly at the right level. Press `Q` to choose a mode yourself (auto → high → medium → low); the choice is remembered too, and choosing *auto* again restarts the detection. `index.html?quality=low` forces a mode from the URL.

For widget authors: `Deck.quality` (`fps`, `kMax`, `kMin`, `level`, `onChange(fn)`) and `Deck.ticker.add(fn)` / `remove(fn)`. In window scenes, set `Scene.prototype.fps` for a lower refresh rate and implement `drawBg(ctx, W, H)` for a static background.

## Publishing on GitHub Pages

1. Put the content of this folder at the root of your Pages repository (or in `docs/`).
2. Repository → *Settings* → *Pages* → deploy from your branch (`/` or `/docs`).
3. `.nojekyll` is included so GitHub serves every file as is.

Everything is referenced with relative paths, so it also works in a sub-folder such as `https://<user>.github.io/talks/alesia/`.

## PDF export

Open the deck in Chrome or Edge → *Print* → *Save as PDF*, enable *Background graphics*. Each slide becomes one 1920×1080 page with all build steps shown and the title animation in its final state.

## Credits

Poppins font: SIL Open Font License 1.1. KaTeX: MIT licence (`vendor/katex/LICENSE`). Figures from the original ALESIA presentation (CEA Paris-Saclay, IRFU).
