# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
