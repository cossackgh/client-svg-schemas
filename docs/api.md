# svgic — API Reference

> Practical examples: **[docs/recipes.md](recipes.md)**

## Table of Contents

- [Constructor](#constructor)
- [SvgicOptions](#svgicoptons)
- [Instance Methods](#instance-methods)
- [Events](#events)
- [SvgicItem — Data Schema](#svgicitem--data-schema)
- [Style — Style Configuration](#style--style-configuration)
- [Popup — Popup Configuration](#popup--popup-configuration)
- [Plugin API](#plugin-api)
- [ZoomPlugin](#zoomplugin)
- [DebugPlugin](#debugplugin)
- [Vue Adapter](#vue-adapter)
- [React Adapter](#react-adapter)

---

## Constructor

```ts
new Svgic(selector, options)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `selector` | `string \| Element` | CSS selector or container DOM element |
| `options` | `SvgicOptions` | Configuration (see below) |

Throws `Error` if the container is not found.

```ts
import { Svgic } from '@svgic/core'

const client = new Svgic('#container', {
  src: '/map.svg',
  data: rooms,
  popup: true,
})

await client.ready
```

---

## SvgicOptions

```ts
interface SvgicOptions {
  src: string
  data?: SvgicItem[]
  layers?: Record<string, SvgicLayer>
  idAttribute?: string
  idMatch?: 'exact' | 'suffix' | ((svgId: string) => string)
  plugins?: SvgicPlugin[]
  popup?: PopupOption
  style?: SvgicStyleConfig
}
```

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `src` | `string` | ✅ | SVG file URL or SVG string (`<svg>...</svg>`) |
| `data` | `SvgicItem[]` | — | Data array bound to elements by `id` |
| `layers` | `Record<string, SvgicLayer>` | — | SVG layer configuration |
| `idAttribute` | `string` | — | SVG attribute used to identify elements. Default: `'id'`. See [ID Matching](#id-matching) |
| `idMatch` | `'exact' \| 'suffix' \| fn` | — | How SVG attribute values are matched against data `id`s. Default: `'exact'`. See [ID Matching](#id-matching) |
| `plugins` | `SvgicPlugin[]` | — | Plugin list |
| `popup` | `PopupOption` | — | Popup configuration (see [Popup](#popup--popup-configuration)) |
| `style` | `SvgicStyleConfig` | — | Style configuration (see [Style](#style--style-configuration)) |

### ID Matching

By default, SVG elements are matched to data items by exact equality of the `id` attribute and `item.id`. The `idAttribute` and `idMatch` options let you adjust this when SVG files come from vector editors that modify element IDs.

#### `idAttribute`

Specifies which SVG attribute to use as the binding key. Useful when the SVG contains a dedicated `data-svgic-id` attribute added by the team:

```xml
<g id="shop-034_2" data-svgic-id="shop-034" />
```

```ts
new Svgic('#container', {
  idAttribute: 'data-svgic-id',
})
```

If the specified attribute is absent on an element, falls back to `id`.

#### `idMatch`

Controls how SVG attribute values are compared to data item `id`s.

| Value | Behavior |
|-------|----------|
| `'exact'` (default) | Strict equality |
| `'suffix'` | Strips editor-appended numeric suffixes (`_2`, `_1_`) before matching. Emits `console.warn` listing all auto-matched elements |
| `(svgId: string) => string` | Custom normalization function applied to SVG attribute values |

**`'suffix'` mode** is useful when the SVG was edited in Inkscape or Illustrator, which automatically rename duplicate IDs by appending `_2`, `_3`, etc. Exact match is always tried first; suffix stripping is used as a fallback only.

```ts
new Svgic('#container', {
  idMatch: 'suffix',
})
// [svgic] 2 element(s) matched by suffix stripping:
//   "shop-034_2" → "shop-034"
//   "shop-035_1" → "shop-035"
```

**Custom function:**

```ts
new Svgic('#container', {
  idMatch: (svgId) => svgId.toLowerCase(),
})
```

`idAttribute` and `idMatch` are independent and can be combined:

```ts
new Svgic('#container', {
  idAttribute: 'data-svgic-id',  // which attribute to read
  idMatch: 'suffix',             // how to compare it
})
```

### SvgicLayer

```ts
interface SvgicLayer {
  role: 'interactive' | 'data' | string
}
```

Layer role is set in config (not in the SVG file). Layers are identified by the `id` attribute of `<g>` elements.

- `interactive` — layer elements respond to hover/click and participate in data binding
- `data` — read-only layer for plugins (e.g. waypoints, corridors); ignored by the core
- Any other string — custom role for plugin use

Layers **not listed** in `layers` config are treated as static — the core ignores them entirely.

```ts
new Svgic('#container', {
  src: '/map.svg',
  layers: {
    'rooms':     { role: 'interactive' },
    'waypoints': { role: 'data' },
    // background, labels, etc. — just omit them, they render as static SVG
  },
})
```

---

## Instance Methods

### `client.ready`

```ts
readonly ready: Promise<void>
```

Promise that resolves after SVG is loaded and initialized. Must be awaited before calling `setData()` and programmatic plugin APIs.

```ts
await client.ready
client.setData(newData)
```

### `client.setSrc(src)`

```ts
setSrc(src: string): Promise<void>
```

Replaces the SVG source. Unloads the current SVG, loads the new one, clears all data and highlight states. Resolves when the new SVG is ready.

Event subscriptions registered via `on()` are preserved — no need to re-subscribe after `setSrc()`.

```ts
// Floor switching example
async function switchFloor(floorId: number) {
  await client.setSrc(`/floor-${floorId}.svg`)
  client.setData(await api.getFloor(floorId))
}
```

### `client.setData(data)`

```ts
setData(data: SvgicItem[]): void
```

Updates bound data. Call after `await client.ready`.

### `client.on(event, handler)`

```ts
on(event: 'click' | 'hover' | 'leave', handler: (id: string | null, item: SvgicItem | null) => void): this
```

Subscribe to events. Returns `this` for chaining.

`id` is `null` when the event fires on an empty area inside an interactive layer (no bound element). Use this to reset state on background clicks:

```ts
client
  .on('click', (id, item) => {
    if (id === null) { client.clearHighlight(); return }
    console.log('clicked', id, item)
  })
  .on('hover', (id, item) => console.log('hovered', id))
```

### `client.setHighlight(state, ids)`

```ts
setHighlight(state: string, ids: string[]): void
```

Sets a named highlight state for the specified elements. The state style is defined in `style.states[state]`. Multiple states can be active simultaneously.

```ts
client.setHighlight('free', ['room-101', 'room-102'])
client.setHighlight('busy', ['room-201'])
```

### `client.clearHighlight(state?)`

```ts
clearHighlight(state?: string): void
```

Removes highlight. If `state` is not provided — clears all active states.

```ts
client.clearHighlight('free')  // clear only 'free'
client.clearHighlight()        // clear all
```

### `client.getElement()`

```ts
getElement(): SVGSVGElement | null
```

Returns the root `<svg>` element after loading, otherwise `null`.

### `client.getLayer(id)`

```ts
getLayer(id: string): { element: SVGGElement; role: string } | null
```

Returns a parsed layer by its `id`. Useful for plugins that need direct access to SVG layer elements — for example, a navigation plugin reading waypoints from a `'data'` layer.

Returns `null` if the layer is not registered, not found in SVG, or the client is not yet initialized (before `ready`) or has been destroyed.

```ts
const navPlugin: SvgicPlugin = {
  name: 'nav',
  onInit(client) {
    const layer = client.getLayer('waypoints') // { element: SVGGElement, role: 'data' }
    const points = layer?.element.querySelectorAll('[data-node]')
    // build navigation graph...
  },
}
```

### `client.use(plugin)`

```ts
use(plugin: SvgicPlugin): this
```

Registers a plugin. Can be called before or after initialization. If SVG is already loaded — `onInit` is called immediately.

### `client.destroy()`

```ts
destroy(): void
```

Removes SVG from the DOM, unsubscribes all handlers, calls `onDestroy` on plugins.

---

## Events

| Event | When fired | `item` |
|-------|------------|--------|
| `click` | click on an interactive element | element data or `null` |
| `hover` | cursor enters element | element data or `null` |
| `leave` | cursor leaves element | element data or `null` |

---

## SvgicItem — Data Schema

```ts
interface SvgicItem {
  id: string           // binding key — matched against SVG element attribute (see idAttribute / idMatch)
  title?: string       // used in the default popup
  description?: string
  image?: string
  link?: string
  [key: string]: unknown  // any custom fields
}
```

By default, `id` must match the `id` attribute of the SVG element (`<g id="room-101">`). Use `idAttribute` and `idMatch` options to change the matching strategy.

---

## Style — Style Configuration

```ts
interface SvgicStyleConfig {
  default?: SvgicStyleProperties
  hover?: SvgicStyleProperties
  highlightedHover?: SvgicStyleProperties
  states?: Record<string, SvgicStyleProperties>
}
```

| Field | Description |
|-------|-------------|
| `default` | Base styles for all interactive elements |
| `hover` | Styles on cursor hover |
| `highlightedHover` | Styles when hovering over a highlighted element (overrides `hover`) |
| `states` | Named states for `setHighlight()` |

### SvgicStyleProperties

```ts
interface SvgicStyleProperties {
  fill?: string
  stroke?: string
  strokeWidth?: number | string
  opacity?: number | string
  cursor?: string
  transition?: string
  filter?: string
  [key: string]: unknown  // any CSS properties
}
```

```ts
new Svgic('#container', {
  src: '/map.svg',
  style: {
    default:  { fill: '#e2e8f0', cursor: 'pointer', transition: 'fill 0.2s' },
    hover:    { fill: '#93c5fd' },
    states: {
      free:   { fill: '#86efac' },
      busy:   { fill: '#fca5a5' },
    },
  },
})
```

---

## Popup — Popup Configuration

```ts
popup?: boolean | (PopupPlacement & {
  render?: (item: SvgicItem) => HTMLElement | string
  template?: string | HTMLTemplateElement
  bind?: (el: HTMLElement, item: SvgicItem) => void
  trigger?: 'hover' | 'click'
  interactive?: boolean
  hideDelay?: number
})
```

| Value | Behavior |
|-------|----------|
| `true` | Default popup with `title`, placement `element`, anchor `top-center` |
| `false` / `undefined` | Popup disabled |
| Object | Custom configuration |

### Common Popup Fields

| Field | Type | Default | Description |
|-------|------|:-------:|-------------|
| `render` | `(item) => HTMLElement \| string` | — | Custom popup content renderer |
| `template` | `string \| HTMLTemplateElement` | — | HTML template for the popup |
| `bind` | `(el, item) => void` | — | Bind data to the rendered template |
| `trigger` | `'hover' \| 'click'` | `'hover'` | Popup open trigger |
| `interactive` | `boolean` | `false` | Popup stays open while cursor is on it (for links/buttons inside) |
| `hideDelay` | `number` | `0` / `120`* | Hide delay in ms. *Automatically `120` when `interactive: true` |

### Mode `placement: 'element'`

Popup is anchored to the SVG element.

```ts
popup: {
  placement: 'element',
  anchor?: PopupAnchor,  // default: 'top-center'
  offset?: { x?: number, y?: number },  // default: { x: 0, y: -8 }
  flip?: boolean,        // default: true — auto-flip if overflowing viewport
}
```

**PopupAnchor:** `'center'` | `'top'` | `'top-center'` | `'top-left'` | `'top-right'` | `'bottom'` | `'bottom-center'` | `'bottom-left'` | `'bottom-right'` | `'left'` | `'right'`

### Mode `placement: 'cursor'`

Popup follows the cursor.

```ts
popup: {
  placement: 'cursor',
  offset?: { x?: number, y?: number },  // default: { x: 16, y: 16 }
}
```

### Mode `placement: 'target'`

Popup renders into a specified DOM element outside the SVG.

```ts
popup: {
  placement: 'target',
  target: string | HTMLElement,  // CSS selector or element
  trigger?: 'hover' | 'click',  // default: 'hover'
}
```

### Popup Examples

```ts
// Default popup
popup: true

// Custom render
popup: {
  placement: 'cursor',
  render: (item) => `<strong>${item.title}</strong><br>${item.description ?? ''}`,
}

// Interactive popup with a link
popup: {
  placement: 'element',
  anchor: 'top-center',
  interactive: true,
  render: (item) => {
    const el = document.createElement('div')
    el.innerHTML = `<a href="${item.link}">${item.title}</a>`
    return el
  },
}

// Popup in sidebar
popup: {
  placement: 'target',
  target: '#sidebar',
  trigger: 'click',
  render: (item) => `<h2>${item.title}</h2>`,
}
```

---

## Plugin API

```ts
interface SvgicPlugin {
  name: string
  onInit?    (client: ISvgic): void
  onDestroy? (client: ISvgic): void
  onElementHover? (element: SVGElement, item: SvgicItem | null): void | false
  onElementLeave? (element: SVGElement, item: SvgicItem | null): void | false
  onElementClick? (element: SVGElement, item: SvgicItem | null): void | false
}
```

| Hook | When called | `return false` |
|------|-------------|----------------|
| `onInit` | After SVG is loaded | — |
| `onDestroy` | On `client.destroy()` | — |
| `onElementHover` | Hover over element | Cancels default behavior (hover style, popup) |
| `onElementLeave` | Cursor leaves element | Cancels default behavior |
| `onElementClick` | Click on element | Cancels default behavior |

```ts
const myPlugin: SvgicPlugin = {
  name: 'my-plugin',
  onInit(client) {
    console.log('SVG ready', client.getElement())
  },
  onElementClick(element, item) {
    console.log('clicked', element.id, item)
    // return false  // to cancel the default
  },
}

const client = new Svgic('#container', {
  src: '/map.svg',
  plugins: [myPlugin],
})
```

---

## ZoomPlugin

Official zoom/pan plugin. Supports mouse wheel, drag, touch (pinch-zoom, pan, double tap).

```ts
import { ZoomPlugin } from 'svgic/plugins/zoom'
```

### Options

```ts
interface ZoomPluginOptions {
  minScale?         : number             // default: 0.5
  maxScale?         : number             // default: 10
  wheelMode?        : 'always' | 'ctrl' // default: 'ctrl'
  pan?              : boolean            // default: true
  touch?            : boolean            // default: true
  doubleTapScale?   : number            // default: 2
  panBounds?        : boolean            // default: true
  animate?          : boolean            // default: true
  animationDuration?: number            // default: 300 (ms)
  focusOnClick?     : boolean           // default: false
  focusScale?       : number            // default: 2
}
```

| Field | Description |
|-------|-------------|
| `minScale` | Minimum scale |
| `maxScale` | Maximum scale |
| `wheelMode` | `'always'` — always zoom; `'ctrl'` — only with Ctrl (for scrollable pages) |
| `pan` | Allow pan by mouse drag |
| `touch` | Allow touch gestures |
| `doubleTapScale` | Scale on double tap/click |
| `panBounds` | Restrict pan to SVG bounds |
| `animate` | Animate programmatic transitions |
| `animationDuration` | Animation duration in ms |
| `focusOnClick` | Auto-focus element on click |
| `focusScale` | Scale when auto-focusing |

### Programmatic API

```ts
const zoom = ZoomPlugin({ wheelMode: 'ctrl', focusOnClick: true })
const client = new Svgic('#container', { src: '/map.svg', plugins: [zoom] })

await client.ready

zoom.zoomTo(2)                              // set scale
zoom.panTo(100, 200)                        // move to SVG coordinates
zoom.focusElement('room-101')               // zoom + center on element
zoom.reset()                                // reset to original viewBox
zoom.getState()                             // { scale, x, y }
```

All methods accept an optional `{ animate?: boolean }` parameter.

### ZoomState

```ts
interface ZoomState {
  scale: number  // current scale (1 = original)
  x: number      // viewBox offset along X in SVG coordinates
  y: number      // viewBox offset along Y in SVG coordinates
}
```

---

## DebugPlugin

Development plugin: shows `id` and data of SVG elements on hover/click. Helps debug data binding.

```ts
import { DebugPlugin } from 'svgic/plugins/debug'
```

### Options

```ts
interface DebugPluginOptions {
  showOn?: 'hover' | 'click' | 'both'
  render?: (id: string, item: SvgicItem | null) => HTMLElement | string
}
```

| Field | Default | Description |
|-------|:-------:|-------------|
| `showOn` | `'hover'` | When to show the label: on hover, click, or both |
| `render` | — | Custom label content renderer |

`showOn` modes:
- `'hover'` — label appears on hover, hides on leave
- `'click'` — label is pinned on click, second click removes it
- `'both'` — label on hover + pinned on click

```ts
// Basic usage — dev mode only
const debug = new URLSearchParams(location.search).has('debug')

new Svgic('#container', {
  src: '/map.svg',
  plugins: debug ? [DebugPlugin()] : [],
})

// Custom render
DebugPlugin({
  showOn: 'both',
  render(id, item) {
    return item ? `${id} · ${item.title}` : `${id} ⚠ no data`
  },
})
```

---

## Vue Adapter

```ts
import { SvgicVue } from 'svgic/vue'
```

### Props

| Prop | Type | Required | Description |
|------|------|:--------:|-------------|
| `src` | `string` | ✅ | SVG file URL or SVG string |
| `data` | `SvgicItem[]` | — | Data (reactive) |
| `layers` | `Record<string, SvgicLayer>` | — | Layer configuration |
| `plugins` | `SvgicPlugin[]` | — | Plugins |
| `popup` | `PopupOption` | — | Popup configuration |
| `style` | `SvgicStyleConfig` | — | Style configuration |

### Events

| Event | Arguments |
|-------|-----------|
| `@click` | `(id: string \| null, item: SvgicItem \| null)` |
| `@hover` | `(id: string \| null, item: SvgicItem \| null)` |
| `@leave` | `(id: string \| null, item: SvgicItem \| null)` |

The component automatically recreates the client when `src` changes and reactively updates data when `data` changes.

```vue
<template>
  <SvgicVue
    src="/map.svg"
    :data="rooms"
    :style="styleConfig"
    :popup="{ placement: 'cursor' }"
    @click="onRoomClick"
  />
</template>

<script setup lang="ts">
import { SvgicVue } from 'svgic/vue'
import type { SvgicItem } from '@svgic/core'

const rooms = ref<SvgicItem[]>([...])

function onRoomClick(id: string | null, item: SvgicItem | null) {
  console.log('clicked', id, item)
}
</script>
```

### useSvgic (composable)

```ts
import { useSvgic } from 'svgic/vue'

const { client, containerRef } = useSvgic(options)
```

Returns `containerRef` (bind to a DOM element) and `client` (the `Svgic` instance after initialization).

---

## React Adapter

```ts
import { SvgicReact } from 'svgic/react'
```

### Props

Same as the Vue adapter: `src`, `data`, `layers`, `plugins`, `popup`, `style`, plus event callbacks:

| Prop | Type | Description |
|------|------|-------------|
| `onClick` | `(id: string \| null, item: SvgicItem \| null) => void` | Click on element |
| `onHover` | `(id: string \| null, item: SvgicItem \| null) => void` | Hover |
| `onLeave` | `(id: string \| null, item: SvgicItem \| null) => void` | Cursor leave |

```tsx
import { SvgicReact } from 'svgic/react'

function App() {
  return (
    <SvgicReact
      src="/map.svg"
      data={rooms}
      popup={{ placement: 'cursor' }}
      onClick={(id, item) => console.log('clicked', id, item)}
    />
  )
}
```

### useSvgic (hook)

```ts
import { useSvgic } from 'svgic/react'

const { client, containerRef } = useSvgic(options)
```
