# svgic

Interactive SVG client. Embeds SVG into the DOM, binds layers to data, handles events (hover, click), and allows extending behavior via plugins.

Works with vanilla JS/TS, Vue 3, and React (adapters included).

> [Русская документация →](README.ru.md)

**[Full API Reference →](docs/api.md)**

---

## Installation

```bash
npm install @svgic/core
```

---

## Quick Start

```ts
import { Svgic } from '@svgic/core'

const client = new Svgic('#container', {
  src: '/map.svg',
  layers: {
    rooms:      { role: 'interactive' },
    background: { role: 'data' },
  },
  data: [
    { id: 'room-101', title: 'Conference Room', description: 'Capacity: 12 people' },
    { id: 'room-102', title: 'Open Space' },
  ],
})

await client.ready

client.on('click', (id, item) => {
  console.log('clicked', id, item)
})
```

The SVG must contain `<g id="rooms">` and `<g id="background">` — matching the `id`s in the config.

---

## SVG File

Layers are defined via `<g id="...">`. Interactive elements are direct children of the interactive layer, identified by `id`.

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600">
  <g id="background">
    <rect width="800" height="600" fill="#f5f5f5"/>
  </g>

  <g id="rooms">
    <g id="room-101">
      <rect x="50" y="50" width="200" height="150"/>
      <text x="150" y="130">101</text>
    </g>
    <g id="room-102">
      <rect x="300" y="50" width="200" height="150"/>
      <text x="400" y="130">102</text>
    </g>
  </g>
</svg>
```

---

## Config

```ts
new Svgic(selector, {
  src: string,                          // URL or SVG string
  layers?: Record<string, SvgicLayer>,  // layer definitions
  data?:   SvgicItem[],                 // data to bind
  idAttribute?: string,                 // SVG attribute used for binding (default: 'id')
  idMatch?: 'exact' | 'suffix' | fn,   // matching strategy (default: 'exact')
  plugins?: SvgicPlugin[],              // plugins
  popup?:   PopupOption,                // hover popup (see section below)
  style?:   SvgicStyleConfig,           // element styling (see section below)
})
```

### SvgicLayer

```ts
interface SvgicLayer {
  role: 'interactive' | 'data' | string
}
```

### SvgicItem

```ts
interface SvgicItem {
  id: string           // binding key — matched against SVG element attribute (see idAttribute / idMatch)
  title?: string
  description?: string
  image?: string
  link?: string
  [key: string]: unknown  // any custom fields
}
```

---

## ID Matching

By default, elements are matched by exact equality of `item.id` and the SVG `id` attribute. Two options let you change this:

**`idAttribute`** — use a different attribute as the binding key (e.g. `data-svgic-id`):

```xml
<!-- SVG: editor renamed the id, but data-svgic-id is stable -->
<g id="shop-034_2" data-svgic-id="shop-034" />
```

```ts
new Svgic('#container', { idAttribute: 'data-svgic-id' })
```

**`idMatch: 'suffix'`** — auto-strip numeric suffixes appended by Inkscape / Illustrator when IDs conflict (`_2`, `_3`, `_1_`…). Exact match is tried first; suffix stripping is a fallback. Logs a `console.warn` listing all auto-matched elements:

```ts
new Svgic('#container', { idMatch: 'suffix' })
// [svgic] 2 element(s) matched by suffix stripping:
//   "shop-034_2" → "shop-034"
//   "shop-035_1" → "shop-035"
```

See full details in [docs/api.md](docs/api.md#id-matching).

---

## API

```ts
// Wait for initialization to complete (SVG loading, data binding)
await client.ready

// Update data after initialization
client.setData(newData)

// Subscribe to an event
client.on('click', (id, item) => { ... })
client.on('hover', (id, item) => { ... })
client.on('leave', (id, item) => { ... })

// Register a plugin
client.use(myPlugin)

// Highlight a group of elements with a named state (requires style.states)
client.setHighlight('free', ['room-101', 'room-102'])
client.clearHighlight('free')   // clear a specific state
client.clearHighlight()         // clear all states

// Destroy (remove listeners, clear container)
client.destroy()
```

### Events

| Event | When | `id` | `item` |
|-------|------|------|--------|
| `click` | click on element | element id | data or `null` |
| `click` | click on empty area | `null` | `null` |
| `hover` | cursor entered element | element id | data or `null` |
| `leave` | cursor left element | element id | data or `null` |

---

## Hover Popup

The library can display a popup with element data on hover — no extra code needed.

### Quick Enable

```ts
new Svgic('#container', {
  src: '/map.svg',
  data: items,
  popup: true, // shows title, anchored above the element
})
```

### Placement Modes

#### `element` — anchored to the SVG element

```ts
popup: {
  placement: 'element',
  anchor: 'top-center', // 'center' | 'top' | 'top-center' | 'top-left' | 'top-right'
                        // 'bottom' | 'bottom-center' | 'left' | 'right'
  offset: { x: 0, y: -8 },
  flip: true,           // auto-flip if overflowing viewport edge (default: true)
}
```

#### `cursor` — follows the cursor

```ts
popup: {
  placement: 'cursor',
  offset: { x: 16, y: 16 }, // offset from cursor (default)
}
```

By default the popup appears **above** the cursor. If it overflows the top of the viewport — it automatically flips below.

#### `target` — renders into a specified DOM node

Suitable for mobile interfaces: information is displayed in a fixed panel rather than over the diagram.

```ts
popup: {
  placement: 'target',
  target: '#info-panel',  // CSS selector or HTMLElement
}
```

### Custom Content

By default the popup shows only `title`. For custom content, pass a `render` function:

```ts
popup: {
  placement: 'cursor',
  render(item) {
    const el = document.createElement('div')
    el.innerHTML = `
      <strong>${item.title}</strong>
      <p>${item.description ?? ''}</p>
    `
    return el
  },
}
```

`render` receives a `SvgicItem` and returns an `HTMLElement` or HTML string.

> **Security:** if data in `SvgicItem` comes from an untrusted source (user input, external API), do not insert it via `innerHTML` in `render()` — this creates an XSS vulnerability. Use `textContent` for text fields or sanitize HTML before insertion (e.g. with [DOMPurify](https://github.com/cure53/DOMPurify)). The `template` + `bind` approach is safer by default, as `bind` encourages using `textContent`.

### Popup via HTML Template (`template` + `bind`)

If you want to separate popup markup from initialization code — use `template` + `bind`. Designers can change the HTML without touching JS.

Define the template in HTML:

```html
<template id="room-popup">
  <div class="room-popup">
    <strong class="room-popup__title"></strong>
    <p class="room-popup__desc"></p>
  </div>
</template>
```

Pass a selector or element directly:

```ts
popup: {
  placement: 'cursor',
  template: '#room-popup',   // selector of the <template> element
  bind(el, item) {           // el — cloned template, item — data
    el.querySelector('.room-popup__title')!.textContent = item.title ?? ''
    el.querySelector('.room-popup__desc')!.textContent = item.description ?? ''
  },
}
```

Or pass an `HTMLTemplateElement` directly:

```ts
popup: {
  placement: 'element',
  anchor: 'top-center',
  template: document.querySelector<HTMLTemplateElement>('#room-popup')!,
  bind(el, item) { /* ... */ },
}
```

`template` and `render` are mutually exclusive — if `template` is provided, `render` is ignored.

### Open Trigger (`trigger`)

By default the popup appears on hover. To open on click:

```ts
popup: {
  placement: 'element',
  trigger: 'click',  // default: 'hover'
}
```

In `click` mode:
- hover only applies color change (via `style`)
- clicking an element opens the popup
- clicking another element switches the popup
- clicking an empty area or outside the SVG closes the popup

### Hide Delay and Interactive Popup

For popups with links or buttons inside — the popup should stay visible while the cursor is on it:

```ts
popup: {
  placement: 'element',
  interactive: true,   // popup stays visible when cursor moves onto it
                       // automatically sets hideDelay: 120ms
  render(item) {
    const el = document.createElement('div')
    const link = document.createElement('a')
    link.href = `/rooms/${item.id}`
    link.textContent = 'Open →'
    el.append(link)
    return el
  },
}
```

Delay only, without interactivity:

```ts
popup: {
  placement: 'element',
  hideDelay: 300,  // ms before hiding
}
```

### Full Override via Plugin

If you need full control over the popup (custom animation, portal, React/Vue component) — use a plugin and return `false` from `onElementHover` to cancel the built-in one:

```ts
client.use({
  name: 'my-popup',
  onElementHover(element, item) {
    MyPopup.show(item, element.getBoundingClientRect())
    return false // cancels the default popup
  },
  onElementLeave(element) {
    MyPopup.hide()
    return false
  },
})
```

### Disable Popup

```ts
popup: false // or simply omit the option
```

---

## Element Styling

The library can manage the appearance of interactive elements via config — without manually writing CSS.

Styles are applied to direct child shapes (`<path>`, `<rect>`, etc.) via CSS classes on the parent `<g>`.  
Nested `<g>` elements inside an element are not affected.

### Basic Example

```ts
new Svgic('#container', {
  src: '/map.svg',
  layers: { rooms: { role: 'interactive' } },
  data: items,
  style: {
    default: { fill: '#2d2d52', cursor: 'pointer', transition: 'fill 0.2s' },
    hover:   { fill: '#4a4a80' },
  },
})
```

### Full Config

```ts
style: {
  // Default style for all interactive elements
  default: {
    fill:       '#e0e0e0',
    cursor:     'pointer',
    transition: 'fill 0.2s ease, opacity 0.2s ease',
  },

  // Hover (without highlight)
  hover: {
    fill: '#4a90d9',
  },

  // Hover over a highlighted element — overrides regular hover
  highlightedHover: {
    opacity: 0.75,
  },

  // Named states for setHighlight()
  states: {
    free:       { fill: '#1a4731', stroke: '#2d9e5a', strokeWidth: 1.5 },
    busy:       { fill: '#4a1e1e', stroke: '#e03030', strokeWidth: 1.5 },
    restricted: { fill: '#3d2a0a', stroke: '#d97706', strokeWidth: 1.5 },
  },
}
```

### Highlighting a Group of Elements

```ts
// Highlight all free rooms
client.setHighlight('free', ['room-101', 'room-103', 'room-202'])

// Multiple states can be applied simultaneously
client.setHighlight('busy', ['room-102', 'room-201'])

// Clear a specific state
client.clearHighlight('free')

// Clear all
client.clearHighlight()
```

### State Priority

| Classes on element | Result |
|---|---|
| _(none)_ | `default` style |
| `svgic-hover` | `hover` style |
| `svgic-state-free` | `free` style |
| `svgic-hover` + `svgic-state-free` | `highlightedHover` on top of `free` |

---

## Vue 3

### Component

```vue
<script setup lang="ts">
import { SvgicVue } from 'svgic/vue'
import type { SvgicItem } from '@svgic/core'

const rooms = ref<SvgicItem[]>([
  { id: 'room-101', title: 'Conference Room' },
])

function onRoomClick(id: string | null, item: SvgicItem | null) {
  console.log(id, item)
}
</script>

<template>
  <SvgicVue
    src="/map.svg"
    :layers="{ rooms: { role: 'interactive' } }"
    :data="rooms"
    :popup="{ placement: 'cursor' }"
    :style="{ default: { fill: '#2d2d52', cursor: 'pointer' }, hover: { fill: '#4a4a80' } }"
    @click="onRoomClick"
  />
</template>
```

The component reactively responds to changes in the `:data` prop.

### Component Props

| Prop | Type | Description |
|---|---|---|
| `src` | `string` | URL or SVG string (required) |
| `data` | `SvgicItem[]` | Data to bind to elements |
| `layers` | `Record<string, SvgicLayer>` | SVG layer definitions |
| `plugins` | `SvgicPlugin[]` | Plugins (ZoomPlugin, etc.) |
| `popup` | `PopupOption` | Popup configuration |
| `style` | `SvgicStyleConfig` | Interactive element styling |

### Component Events

| Event | Signature |
|---|---|
| `@click` | `(id: string \| null, item: SvgicItem \| null) => void` |
| `@hover` | `(id: string \| null, item: SvgicItem \| null) => void` |
| `@leave` | `(id: string \| null, item: SvgicItem \| null) => void` |

### Composable

```ts
import { useSvgic } from 'svgic/vue'

const { containerRef, client } = useSvgic({
  src: '/map.svg',
  layers: { rooms: { role: 'interactive' } },
  popup: true,
  style: { default: { fill: '#e0e0e0', cursor: 'pointer' } },
})
```

```html
<div :ref="containerRef" />
```

`client` is a reactive `shallowRef<Svgic | null>`, available after mount. Use it to call `setHighlight`, `setData`, plugin methods, etc.

---

## React

### Component

```tsx
import { SvgicReact } from 'svgic/react'
import type { SvgicItem } from '@svgic/core'

const rooms: SvgicItem[] = [
  { id: 'room-101', title: 'Conference Room' },
]

function Map() {
  return (
    <SvgicReact
      src="/map.svg"
      layers={{ rooms: { role: 'interactive' } }}
      data={rooms}
      popup={{ placement: 'cursor' }}
      styleConfig={{
        default: { fill: '#2d2d52', cursor: 'pointer' },
        hover:   { fill: '#4a4a80' },
      }}
      onClick={(id, item) => console.log(id, item)}
    />
  )
}
```

The component recreates the client when `src` changes, and reactively updates data when `data` changes without recreating.

### Component Props

| Prop | Type | Description |
|---|---|---|
| `src` | `string` | URL or SVG string (required) |
| `data` | `SvgicItem[]` | Data to bind to elements |
| `layers` | `Record<string, SvgicLayer>` | SVG layer definitions |
| `plugins` | `SvgicPlugin[]` | Plugins (ZoomPlugin, etc.) |
| `popup` | `PopupOption` | Popup configuration |
| `styleConfig` | `SvgicStyleConfig` | Interactive element styling |
| `onClick` | `(id, item) => void` | Click event handler |
| `onHover` | `(id, item) => void` | Hover event handler |
| `onLeave` | `(id, item) => void` | Leave event handler |
| `className` | `string` | Container CSS class |
| `style` | `CSSProperties` | Container inline styles |

> `styleConfig` — SVG layer style configuration. Named differently from the core to avoid conflicting with the standard `style` prop of the container element.

### Hook

```tsx
import { useRef } from 'react'
import { useSvgic } from 'svgic/react'
import { ZoomPlugin } from 'svgic/plugins/zoom'

const zoom = ZoomPlugin({ wheelMode: 'ctrl' })

function Map() {
  const { containerRef, client } = useSvgic({
    src: '/map.svg',
    layers: { rooms: { role: 'interactive' } },
    plugins: [zoom],
    style: { default: { fill: '#e0e0e0', cursor: 'pointer' } },
  })

  function handleReset() {
    zoom.reset()
  }

  return (
    <>
      <div ref={containerRef} />
      <button onClick={handleReset}>Reset</button>
    </>
  )
}
```

`client` is `Svgic | null`, available after mount (via `useState`).

---

## ZoomPlugin — zoom and pan

Official plugin for zooming and panning SVG diagrams.
Bundled with the library, no external dependencies.

```ts
import { ZoomPlugin } from 'svgic/plugins/zoom'

const zoom = ZoomPlugin({
  wheelMode: 'ctrl',  // zoom with wheel only when Ctrl is held
  minScale: 0.5,
  maxScale: 8,
})

const client = new Svgic('#container', {
  src: '/map.svg',
  plugins: [zoom],
})
```

### Capabilities

| Device | Interaction |
|---|---|
| Mouse — wheel | Zoom to cursor point |
| Mouse — drag | Pan |
| Touch — two fingers | Pinch-to-zoom |
| Touch — one finger | Pan |
| Touch — double tap | Zoom in / reset |

### Options

| Option | Type | Default | Description |
|---|---|---|---|
| `wheelMode` | `'ctrl' \| 'always'` | `'ctrl'` | `ctrl` — zoom only with Ctrl held; `always` — always zoom |
| `minScale` | `number` | `0.5` | Minimum scale |
| `maxScale` | `number` | `10` | Maximum scale |
| `pan` | `boolean` | `true` | Allow mouse pan |
| `touch` | `boolean` | `true` | Allow touch gestures |
| `doubleTapScale` | `number` | `2` | Scale on double tap |
| `panBounds` | `boolean` | `true` | Restrict pan to SVG bounds |
| `animate` | `boolean` | `true` | Animate programmatic transitions |
| `animationDuration` | `number` | `300` | Animation duration in ms |
| `focusOnClick` | `boolean` | `false` | Auto-focus element on click |
| `focusScale` | `number` | `2` | Scale when auto-focusing |

### Programmatic API

```ts
zoom.zoomTo(3)                              // zoom to viewBox center
zoom.panTo(100, 200)                        // move viewBox (SVG coordinates)
zoom.focusElement('room-101')               // zoom + center on element
zoom.focusElement('room-101', { scale: 3 })
zoom.reset()                                // reset to original viewBox
zoom.getState()                             // → { scale, x, y }

// All methods support the animate option
zoom.reset({ animate: false })
zoom.zoomTo(2, { animate: true })
```

---

## DebugPlugin — display element IDs

Development plugin: shows SVG element `id`s directly on the diagram on hover or click. Useful during setup — to find the needed `id`s without opening DevTools.

```ts
import { DebugPlugin } from 'svgic/plugins/debug'

const client = new Svgic('#container', {
  src: '/map.svg',
  plugins: [DebugPlugin()],
})
```

Typical pattern — enable via URL parameter:

```ts
const debug = new URLSearchParams(location.search).has('debug')

new Svgic('#container', {
  src: '/map.svg',
  plugins: debug ? [DebugPlugin()] : [],
})
// http://localhost:5173/?debug → labels enabled
```

### Options

| Option | Type | Default | Description |
|---|---|---|---|
| `showOn` | `'hover' \| 'click' \| 'both'` | `'hover'` | Label display trigger |
| `render` | `(id, item) => HTMLElement \| string` | — | Custom label content renderer |

**`showOn`:**
- `hover` — label appears on hover, disappears when cursor leaves
- `click` — label is pinned on click, second click removes it
- `both` — shown on hover, click pins it (yellow color)

### Data Display

By default the label shows `id` and `title` from bound data. If there is no record in `data` for an element — a `⚠ no data` warning is shown. This helps quickly identify mismatches between `id`s in the SVG file and keys in the data array.

```
room-101  Conference Room A     ← data found
room-203  ⚠ no data             ← id exists in SVG but not in data
```

### Custom Render

To display additional fields, pass a `render` function:

```ts
DebugPlugin({
  render(id, item) {
    if (!item) return `${id} ⚠ no data`
    return `${id} · ${item.title} [${item.status}]`
  }
})
```

`render` receives the element `id` and `SvgicItem | null`, returns an `HTMLElement` or HTML string.

> Intended for development only. Do not include in production builds.

---

## Plugins

```ts
const highlightPlugin = {
  name: 'highlight',

  onInit(client) {
    console.log('svgic initialized')
  },

  onElementHover(element, item) {
    element.style.opacity = '0.7'
  },

  onElementLeave(element, item) {
    element.style.opacity = ''
  },

  onElementClick(element, item) {
    // return false — cancel the default click event
  },
}

client.use(highlightPlugin)
```

### Plugin Hooks

| Hook | When called | Returns `false` |
|------|-------------|-----------------|
| `onInit(client)` | after SVG is loaded | — |
| `onDestroy(client)` | when `destroy()` is called | — |
| `onElementHover(el, item)` | hover | cancels `hover` event |
| `onElementLeave(el, item)` | leave | cancels `leave` event |
| `onElementClick(el, item)` | click | cancels `click` event |

---

## SVG Source

```ts
// URL (fetch)
new Svgic('#container', { src: '/map.svg' })

// SVG string directly
new Svgic('#container', { src: '<svg>...</svg>' })
```

---

## License

MIT
