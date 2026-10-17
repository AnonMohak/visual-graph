# Graph — interactive function plotter

Plot math functions as curves on an infinite canvas. Type an equation, press
Enter, and the curve appears instantly with a live math preview.

## Prerequisites

- Node.js 18+ (or [Bun](https://bun.sh/) latest)
- npm (comes with Node) or Bun

## Tech stack

- React 19 + TypeScript + Vite
- Tailwind CSS 4, shadcn-style UI, lucide-react icons
- KaTeX (math preview), mathjs (parsing/evaluation)

## Run it

```bash
npm install
npm run dev      # local site, usually http://localhost:5173
npm run build    # typecheck + production build
npm run preview  # preview the production build
npm run lint     # lint
```

(Bun works too)

## Adding equations

1. Click the input bar at the bottom (the `>` prompt) or press `/`.
2. Type an equation in variable `x`, e.g. `sin(x)/x`.
3. A live rendered-math preview appears under the input as you type.
4. Press **Enter** to add the curve. **Escape** clears the input.

Tips:

- The `y =` prefix is optional: `y = sin(x)/x` and `sin(x)/x` are the same.
- Explicit curves use `x`; implicit curves and inequalities use `x` and `y`.
  Constants `pi` and `e` are available.
- Implicit multiplication works: `2x`, `2(x+1)`, `x sin(x)`, `2pi x`.
- Define constants and functions, then reuse them: `a = 2`, `f(x) = a*x^2`,
  then `f(x+1)`. Definitions can appear in any order.
- Sliders: unknown single letters become parameters. `a*sin(b*x)` adds
  `a = 1` and `b = 1` with sliders in the legend. Press play to sweep a
  value; the loop button bounces it back and forth.
- Parametric curves: `(cos(t), sin(t))` draws t from 0 to 2π.
- Polar curves: `r = 1 + cos(θ)` (or `theta`) draws θ from 0 to 2π.
- Implicit curves: `x^2 + y^2 = 1`, `x = 3`, `y = x*y + 1`.
- Inequalities shade a region: `y < sin(x)`, `x^2 + y^2 <= 4`. A strict
  inequality (`<`, `>`) draws a dashed boundary.
- Derivatives: `d/dx(x^3)`, or `f'(x)` for a function you defined.
- Integrals: `integral(t^2, 0, x)` (the integrand uses t, or x when t is
  absent). With constant bounds, `integral(x^2, 0, 3)` draws the curve,
  shades the area under it, and shows the value.
- Piecewise: `x < 0 ? -x : x^2` or `piecewise(x < 0, -x, x^2)`.
- Invalid input shows an inline error and moves the cursor to the problem
  spot; nothing is added until it parses.
- Paste multiple lines at once to add several curves in one go
  (invalid lines are skipped with a notice telling you how many).
- Unicode helpers are converted automatically: `− × ÷ ² ³ π`.
- Your equations auto-save in the browser, so a reload keeps your work.

### Try these examples

| Type this       | What you get                          |
|-----------------|---------------------------------------|
| `sin(x)/x`      | Damped oscillation through the origin |
| `x^3 - 3x`      | Cubic with two turning points         |
| `tan(x)`        | Periodic curve with vertical gaps     |
| `exp(-x^2)`     | Bell-shaped Gaussian curve            |
| `abs(x)`        | V shape                               |
| `log(x)`        | Logarithmic curve (x > 0)             |
| `1/(x-3)`       | Hyperbola with a gap at x = 3         |
| `cos(x)`        | Cosine wave                           |
| `x^2`           | Parabola                              |
| `sqrt(abs(x))`  | Square root mirrored over the y-axis  |

Or click **samples** next to the input to pick one of 7 built-in examples —
it fills the input so you can preview it, then press Enter to add it.

### Supported functions

`sin cos tan cot sec csc asin acos atan sinh cosh tanh exp log log2 log10
sqrt cbrt abs sign round floor ceil min max pow mod piecewise integral`, plus `pi`, `e`, `x`
and operators `+ - * / ^ ( )`.

## Working with curves

- **Legend (top right):** lists every curve with its color. Click the eye
  icon to hide/show a curve, the `×` icon to delete it.
- **Edit:** double-click an equation in the legend to edit it. Press Enter
  to save or Escape to cancel.
- **Reorder:** drag a legend row by its grip to a new position.
- **Style:** the palette icon opens color swatches, a custom color picker,
  line style (solid, dashed, dotted), and line width. Styles are saved and
  shared with the link.
- **Folders:** type a folder name in the style panel to group curves.
  Click a folder header to collapse it; its eye icon hides or shows the
  whole folder. Dropping a row onto another row moves it into that folder.
- **Show/hide all:** the button in the legend header.
- **Phones:** the legend becomes a collapsible sheet above the input bar,
  with larger buttons. The readout panel is hidden on small screens.
- **Help:** press `?` (or the `?` button on phones) for shortcuts and syntax.
- **Undo/redo:** `Ctrl+Z` undoes, `Ctrl+Shift+Z` or `Ctrl+Y` redoes adds,
  deletes, edits, moves, and style changes.
- **Readout (top left):** hover the canvas to see each curve's value at the
  cursor's x position. `—` means undefined there (e.g. `log(x)` for x ≤ 0).
- **Snap box (`x=`):** type an exact x to evaluate every curve there.
  While typing in it, **←/→** nudges x by one grid step.
- **"no real points in view"** under a legend entry means the curve has no
  plottable values in the current viewport — pan/zoom or press `f` to fit.

## Complex mode

The plane switch at the top has three planes:

| Plane   | What it shows                                                     |
|---------|-------------------------------------------------------------------|
| `xy`    | Normal curves. A complex expression in `t` is drawn as one component (re, im, \|.\|, arg) of f(σ + i t) at a fixed σ. |
| `σ-t`   | Domain coloring of f(s) over s = σ + i t: hue = arg f, brightness = log \|f\|. |
| `Re-Im` | The path of f(σ + i t) for t in [-30, 30], drawn as (Re f, Im f). |

Complex input:

- Use `s` (or `z`) for the complex variable and `i` for the imaginary unit:
  `zeta(s)`, `1/(s-1)`, `s^2 + 1`, `zeta(0.5 + i*t)`.
- Built-in functions: `zeta` (Riemann zeta), `eta` (Dirichlet eta),
  `gamma`, `beta` (Dirichlet beta, the L-function for the character mod 4),
  `lambda` (Dirichlet lambda), `xi` (Riemann xi), and `re im abs arg conj`.
- Your own functions work too: `f(s) = zeta(s)*gamma(s/2)`, then `f(s)`.
- When an expression looks complex, the input bar offers to switch planes
  and shows the σ slider and the component buttons.

In the **σ-t** plane:

- The field shows any complex equation; with several, pick one with the
  **field** selector at the bottom. With none, it shows ζ(s).
- The toolbar toggles **|f| lines** (where \|f\| is a power of 2), **arg
  lines** (where arg f is a multiple of π/6), the **zeros** markers on the
  critical line, and a **list** of the first 30 nontrivial zeros. Click a
  zero in the list to center the view on it.

In the **Re-Im** plane (and in `xy` with complex curves), a σ slider sits
above the input bar. Press play to sweep σ from -1 to 2 and watch the
curve change; the loop button bounces it back and forth.

## Animated mode

Switch **static / animated** at the top to watch curves draw on from
x = -5 to 5 while the camera follows the pen. Click **+** to add curves.

The control bar has:

- **play/pause** and **restart**; play at the end starts over.
- a **scrub** bar to jump to any point of the drawing.
- **speed** in world units per second (0.1 to 5).
- **loop** (start again at the end) and **reverse** (draw backward).
- **sync sliders**: slider constants such as `a = 1` sweep their range
  together with the pen, so `a*sin(x)` grows while it draws.
- **record**: plays one full pass from the start and downloads it as a
  video (MP4 where the browser supports it, otherwise WebM). GIF is not
  supported; convert the video if you need one.

## Analysis

The toolbar under the theme switch (xy plane) has three toggles:

- **points**: mark roots, local maxima and minima, inflection points, and
  intersections of visible curves. Hover a mark to see its coordinates.
  Click a mark to snap the readout to its x.
- **tangent**: draw the tangent line of each curve at the cursor, with its
  slope `m`.
- **table**: show a table of x and f(x) for a curve, with your own range and
  step.

## Data and regression

Click **data** in the toolbar. Paste x,y pairs (CSV, TSV, or spaces; a
header line is skipped) and click **add points** to draw a scatter plot.
You can also type points directly: `(1, 2), (2, 3.9), (3, 6.1)`.

Under **regression**, pick a point set and a fit (linear up to degree 6),
then click **add fit**. The fitted curve is added as a normal equation,
for example `y = 2.01x - 0.03`, and the panel shows R².

## View settings

Click **view** in the toolbar (xy plane) to open the view settings. They
are saved in the browser.

- **grid** and **axes** show or hide the grid and the axes with tick labels.
- **grid step** sets a fixed major grid spacing (empty = automatic).
- **x label** and **y label** set custom axis titles.
- **log x** and **log y** use logarithmic axes. Tick labels show the data
  values (1, 10, 100, ...).
- **equal aspect** off lets the axes scale independently: `f` fits y only,
  Shift+wheel zooms y, and Alt+wheel zooms x.
- **angles** switches trig functions between radians and degrees (xy plane).
- **palette**: default, high contrast, or colorblind-safe (Okabe-Ito).

The **paper** and **neon** buttons switch between a light and a dark theme.

## Navigating the canvas

| Action                | How                              |
|-----------------------|----------------------------------|
| Pan                   | Drag with mouse / one finger     |
| Zoom                  | Mouse wheel (zooms at cursor)    |
| Pinch zoom + pan      | Two-finger touch gesture         |
| Reset view            | Double-click the canvas or `0`   |
| Fit curves vertically | `f`                              |
| Hover values          | Move the mouse over the canvas   |

## Sharing and export

Click **share** to copy a link containing your equations *and* viewport.
Opening the link loads the exact same view. Links are compressed (they
start with `#z`); older uncompressed links still open.

The **file** menu next to it has:

- **saved graphs…**: save the current graph under a name in this browser,
  then load or delete saved graphs. Loading is one undo step.
- **export JSON** / **import JSON…**: move a graph between browsers as a
  `graph.json` file.
- **export PNG** / **export SVG**: download the current view as an image.
  SVG is vector (the complex field is embedded as a picture).
- **copy embed code**: copies an `<iframe>` for blogs and docs. The embed
  URL adds `?embed=1`, which hides the editing UI, keeps pan and zoom, and
  never writes to the visitor's saved work. If there is nothing to share
yet, you'll see the notice `nothing to share yet — add an equation first`;
a `copied` badge confirms a successful copy.

## Keyboard shortcuts

| Key                   | Context         | Action                              |
|-----------------------|-----------------|-------------------------------------|
| `/`                   | Anywhere        | Focus the equation input            |
| `Enter` (`⏎`)         | Equation input  | Add the curve(s)                    |
| `Escape`              | Equation input  | Clear input and unfocus             |
| `Escape`              | Anywhere else   | Unfocus the current field           |
| `←` / `→`             | Anywhere*       | Step the snap x by one grid step    |
| `←` / `→`             | Snap `x=` box   | Step the snap x by one grid step    |
| `0`                   | Anywhere*       | Reset the viewport                  |
| `f`                   | Anywhere*       | Fit curves vertically               |
| `?`                   | Anywhere*       | Show or hide help                   |
| `Ctrl+Z`              | Anywhere*       | Undo                                |
| `Ctrl+Shift+Z`/`Ctrl+Y` | Anywhere*     | Redo                                |

\* Not while typing in a text field.

## Project structure

```text
src/
  App.tsx            # app shell, equation state, share/load logic
  components/        # canvas, legend, command bar, modals, UI
  graph/             # parsing, evaluation, viewport, sharing
  lib/               # helpers (utils, toasts)
public/              # favicon, icons, logo
index.html           # app entry
vite.config.ts       # Vite + Tailwind + `@` alias config
```

## Scripts

| Command         | What it does                          |
|-----------------|---------------------------------------|
| `npm run dev`   | Start local dev server (auto-reload)  |
| `npm run build` | Typecheck (`tsc -b`) + production build |
| `npm run preview` | Preview the production build locally |
| `npm run lint`  | Lint with oxlint                       |
| `npm test`      | Run unit tests (Vitest)                |
| `npm run typecheck` | Typecheck only                     |
| `npm run e2e`   | Build and run Playwright E2E tests     |

## Tests and CI

- `npm test` runs the unit tests (Vitest) in `src/graph/__tests__/`.
- `npm run e2e` builds the app, starts a preview server, and runs the
  Playwright tests in `e2e/` (add, parse error, sliders, undo, share link,
  zoom, embed). Run `npx playwright install chromium` once first.
- GitHub Actions (`.github/workflows/ci.yml`) runs lint, typecheck, unit
  tests, build, and the E2E tests on every push and pull request.

## Deploy

`.github/workflows/deploy.yml` deploys `dist/` to Cloudflare Pages: master
goes to production and every pull request gets a preview URL as a comment.
To turn it on:

1. Create a Cloudflare Pages project (direct upload), for example
   `visual-graph`.
2. Add the repository secrets `CLOUDFLARE_API_TOKEN` (with the "Cloudflare
   Pages: Edit" permission) and `CLOUDFLARE_ACCOUNT_ID`.
3. Optional: set the repository variable `CF_PAGES_PROJECT` if the project
   name is not `visual-graph`.

Without the secrets the workflow only builds. After the first deploy the
public demo is at `https://<project>.pages.dev`.

## Notes

- Equations auto-save to `localStorage`, so a reload keeps your work.
- Share links encode equations + viewport in the URL — no backend needed.
- Local debug/tunnel logs (`*.log`, `*.err`, `.playwright-mcp/`) are git-ignored.
