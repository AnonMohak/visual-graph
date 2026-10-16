# Future ideas

Ideas for new features and improvements to Graph, grouped by area.

## Equations and parsing

- Implicit multiplication: accept `2x`, `2(x+1)`, `x sin(x)`.
- Implicit equations: `x^2 + y^2 = 1`, inequalities with shaded regions (`y < sin(x)`).
- Parametric curves `(cos(t), sin(t))` and polar curves `r = 1 + cos(θ)` in the xy plane.
- Sliders: free parameters (`a*sin(b*x)`) get auto-created sliders with play/loop.
- User-defined functions and constants: `f(x) = x^2`, then `f(x+1)`.
- Piecewise functions: `x < 0 ? -x : x^2` or a `piecewise()` helper.
- Derivative and integral helpers: `d/dx`, `integral(f, a, b)`, shaded area under a curve.
- Data tables / scatter plots from pasted CSV, with linear/poly regression.

## Analysis

- Mark roots, extrema, and inflection points; click to snap the readout to them.
- Intersection points between two selected curves.
- Tangent line at the cursor, with slope readout.
- Numeric table of values for any curve over a chosen range/step.

## Complex mode (σ-t, Re-Im, zeta)

- More built-in complex functions beyond zeta (gamma, eta, Dirichlet L, user `f(s)`).
- Domain coloring for any user-entered complex function, not just zeta.
- Toggle contour lines for |f| and arg(f) on the field.
- Mark known nontrivial zeta zeros on the critical line, with a list panel.
- σ slider for the Re-Im parametric view, animating the curve as σ changes.
- Document complex mode in the README (it exists in code but is undocumented).

## Animation

- Playback controls: pause, scrub, speed, loop, reverse.
- Export animation to GIF/MP4/WebM.
- Animate parameter sliders in sync with draw-on.

## Canvas and UX

- Undo/redo for equation add/delete/edit.
- Inline edit of an existing equation from the legend; drag to reorder.
- Per-curve color picker, line style (dashed/dotted), and thickness.
- Equal-aspect toggle, log scales, degree/radian toggle.
- Light/dark theme switch, high-contrast palette, colorblind-safe palette.
- Axis labels and custom grid spacing; toggle grid/axes.
- Folders/groups of equations; show/hide all.
- Mobile layout polish: bottom sheet legend, larger touch targets.
- Help overlay listing shortcuts (`?`).

## Sharing and export

- Export PNG/SVG of the current view.
- Short share links (hash compression or a tiny KV backend).
- Embed mode (`?embed=1`) for blogs/docs, with read-only UI.
- Named saved graphs in localStorage, import/export JSON.

## Quality and tooling

- Unit tests for `parse.ts`, `sampler.ts`, `zeta.ts`, `share.ts` (Vitest).
- E2E tests (Playwright) for add/share/zoom flows.
- CI on GitHub Actions: lint, typecheck, build, tests.
- Deploy previews (Cloudflare Pages) and a public demo link in the README.
- PWA / offline support.
- Accessibility: screen-reader descriptions of curves, keyboard canvas navigation, sonification of curves.
- i18n for UI strings.
