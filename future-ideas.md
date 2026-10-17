# Future ideas

The ideas from the first version of this list are implemented (see the
README for how to use each one). The items below are what is still open,
including the parts that were done in a smaller form.

## Still open

- **Export GIF.** Animated mode records MP4 or WebM only. A GIF encoder
  (for example in a worker) would add GIF.
- **Short links with a backend.** Share links are compressed in the URL
  hash. A tiny KV backend (for example Cloudflare KV) would give fixed
  short IDs.
- **Public demo link.** The deploy workflow is ready but needs the
  Cloudflare secrets; add the `*.pages.dev` link to the README after the
  first deploy.
- **Intersections of two selected curves.** The **points** toggle marks
  intersections of all visible pairs (first 6 curves). A way to pick two
  curves would scale better.
- **Derivatives in other variables.** `d/dx` works on x only; `d/dt` for
  parametric curves is not supported.
- **More translations.** UI strings are in English, Spanish and German;
  parse error messages are English only.
- **Dirichlet L-functions for any character.** `beta` covers the
  character mod 4; a general `L(s, q, a)` needs a Hurwitz zeta.

## Done

- Equations: implicit multiplication, implicit equations and shaded
  inequalities, parametric and polar curves, sliders with play/loop,
  user-defined functions and constants, piecewise, `d/dx` and `f'`,
  `integral` with shaded area, CSV scatter plots with regression.
- Analysis: roots, extrema, inflections (click to snap), intersections,
  tangent line with slope, table of values.
- Complex mode: `beta`, `lambda`, `xi`, user `f(s)`, domain coloring for any
  complex equation, `|f|` and arg contour lines, zeta zero markers and list,
  animated σ slider, README section.
- Animation: pause, scrub, speed, loop, reverse, slider sync, MP4/WebM export.
- Canvas and UX: undo/redo, inline edit, drag reorder, color/dash/width,
  equal-aspect toggle, log scales, degrees, light/dark themes with
  high-contrast and colorblind-safe palettes, axis labels, grid step,
  grid/axes toggles, folders, show/hide all, mobile legend sheet, help (`?`).
- Sharing: PNG/SVG export, compressed links, embed mode, saved graphs,
  JSON import/export.
- Quality: Vitest unit tests, Playwright E2E tests, GitHub Actions CI,
  Cloudflare Pages deploy previews, PWA/offline, keyboard canvas
  navigation, screen-reader description, sonification, i18n.
