# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] — 2026-09-05

### Added

- **ContentPlugin** (`@svgic/core/plugins/content`): places text, images and composite content
  inside the elements of a layer. Positions are computed from the geometry of every shape — the
  point furthest from its boundary for text, the largest inscribed rectangle for boxed content —
  so the L- and U-shaped rooms that make up most of a real plan get their content in the fill
  rather than on a wall, and editing the plan never requires moving labels by hand
  - Candidates are tried in priority order and the first one that produces content **and fits**
    wins, so content degrades gracefully as the available space shrinks: a logo gives way to a
    name, a name to a room number, and a label is turned by -90° where that is the only way it fits
  - `type: 'text'` — one line or several, with `rotate: 'auto'`
  - `type: 'image'` — a raster or SVG file drawn into the largest box of its own aspect ratio.
    The ratio comes from the data or from probing the file (cached per URL), and `minHeight`
    decides when a logo would come out too small to be worth drawing
  - `type: 'custom'` — anything the application draws itself; the plugin does not interpret it,
    only measures it, scales it into the slot and clips it
  - Content is clipped to the shape it belongs to, and the generated layer ignores pointer events,
    so hover and click keep reaching the shapes underneath
  - The placement primitives (`sampleShape`, `findSpot`, `findRect`) are exported for content
    the plugin does not cover
- **`onDataChange` plugin hook**: fires on `setData()`, once on init when `options.data` is given,
  and right after `onInit` for a plugin registered via `use()` while data is already loaded — so
  plugin behaviour no longer depends on registration order. Plugins that render from data no longer
  need to expose a manual `rebuild()` for the host application to remember to call

## [0.1.5] — 2026-09-03

### Added

- **`style.stripInlineStyles`**: removes inline `style` declarations that would override the
  style config (`false` | `true`/`'managed'` | `'all'` | `string[]`, default `false`).
  When disabled, conflicting inline styles are reported once via `console.warn`

### Fixed

- **CJS entry point**: `exports["."].require` pointed at `dist/svgic.umd.cjs`, a file the build never
  emits (the library is built as es + cjs, and Vite has no UMD output for multi-entry builds), so
  `require("@svgic/core")` failed to resolve. Now points at `dist/svgic.cjs`
- **Element styling**: flat shapes (`<path>`, `<rect>`, `<circle>`…) placed directly in an
  interactive layer are now painted. Previously only `<g>` wrappers received `.svgic-interactive`,
  so SVGs without wrapper groups got events but no styling

## [0.1.0] — 2026-04-10

Initial public release.

### Added

- **Core**: SVG loader (URL and inline string), layer parser, data mapper, event manager
- **Events**: `click`, `hover`, `leave` — with `null` id/item support for empty-area clicks
- **Popup system**: placement modes `element`, `cursor`, `target`; triggers `hover` / `click`; `render`, `template`+`bind`, `hideDelay`, `interactive`
- **Element styling**: `default`, `hover`, `highlightedHover`, named `states` via CSS classes
- **Highlight API**: `setHighlight(state, ids)`, `clearHighlight(state?)`
- **`setSrc()`**: replace SVG without recreating the client; concurrent calls are serialized
- **ID matching**: `idAttribute` option to use a custom SVG attribute as binding key; `idMatch: 'suffix'` to strip Inkscape/Illustrator numeric suffixes
- **`getLayer(id)`**: access a parsed SVG layer by id
- **ZoomPlugin** (`svgic/plugins/zoom`): wheel zoom, drag pan, pinch-to-zoom, double-tap, programmatic API (`zoomTo`, `panTo`, `focusElement`, `reset`, `getState`), `focusOnClick`
- **DebugPlugin** (`svgic/plugins/debug`): shows element ids and data on hover/click; custom `render`
- **Vue 3 adapter** (`svgic/vue`): `<SvgicVue>` component + `useSvgic()` composable
- **React adapter** (`svgic/react`): `<SvgicReact>` component + `useSvgic()` hook
- **Plugin API**: hooks `onInit`, `onDestroy`, `onElementHover`, `onElementLeave`, `onElementClick`
- Full API reference in [docs/api.md](docs/api.md)
- Usage recipes in [docs/recipes.md](docs/recipes.md)
