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
- One variable only: `x`. Constants `pi` and `e` are available.
- Use `*` for multiplication: `2*(x+1)`, not `2(x+1)`.
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
sqrt cbrt abs sign round floor ceil min max pow mod`, plus `pi`, `e`, `x`
and operators `+ - * / ^ ( )`.

## Working with curves

- **Legend (top right):** lists every curve with its color. Click the eye
  icon to hide/show a curve, the `×` icon to delete it.
- **Readout (top left):** hover the canvas to see each curve's value at the
  cursor's x position. `—` means undefined there (e.g. `log(x)` for x ≤ 0).
- **Snap box (`x=`):** type an exact x to evaluate every curve there.
  While typing in it, **←/→** nudges x by one grid step.
- **"no real points in view"** under a legend entry means the curve has no
  plottable values in the current viewport — pan/zoom or press `f` to fit.

## Navigating the canvas

| Action                | How                              |
|-----------------------|----------------------------------|
| Pan                   | Drag with mouse / one finger     |
| Zoom                  | Mouse wheel (zooms at cursor)    |
| Pinch zoom + pan      | Two-finger touch gesture         |
| Reset view            | Double-click the canvas or `0`   |
| Fit curves vertically | `f`                              |
| Hover values          | Move the mouse over the canvas   |

## Sharing

Click **share** to copy a link containing your equations *and* viewport.
Opening the link loads the exact same view. If there is nothing to share
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

## Notes

- Equations auto-save to `localStorage`, so a reload keeps your work.
- Share links encode equations + viewport in the URL — no backend needed.
- Local debug/tunnel logs (`*.log`, `*.err`, `.playwright-mcp/`) are git-ignored.
