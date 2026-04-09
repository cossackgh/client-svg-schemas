# svgic — Recipes

Practical examples for common usage scenarios.

## Table of Contents

- [Office Map with Color Status](#office-map-with-color-status)
- [Floor Switching](#floor-switching)
- [Zoom + Element Focus + Reset Button](#zoom--element-focus--reset-button)
- [Popup with a Button Inside](#popup-with-a-button-inside)
- [Detail Panel Instead of Popup](#detail-panel-instead-of-popup)
- [Custom Plugin](#custom-plugin)
- [Vue: Reactive Data and Highlighting](#vue-reactive-data-and-highlighting)

---

## Office Map with Color Status

A typical scenario: a room map where each room has a status (`free` / `busy`), a popup is shown on hover, and clicking opens a detail page.

```ts
import { Svgic } from 'svgic'

interface Room {
  id: string
  title: string
  capacity: number
  status: 'free' | 'busy'
}

const rooms: Room[] = [
  { id: 'room-101', title: 'Conference Room A', capacity: 8,  status: 'free' },
  { id: 'room-102', title: 'Conference Room B', capacity: 4,  status: 'busy' },
  { id: 'room-201', title: 'Open Space',        capacity: 20, status: 'free' },
]

const client = new Svgic('#map', {
  src: '/office.svg',
  layers: {
    rooms: { role: 'interactive' },
    // background, labels — not listed, render as static SVG
  },
  data: rooms,

  style: {
    default:          { cursor: 'pointer', transition: 'fill 0.15s' },
    hover:            { opacity: 0.8 },
    highlightedHover: { opacity: 0.75 },
    states: {
      free: { fill: '#86efac', stroke: '#16a34a', strokeWidth: 1.5 },
      busy: { fill: '#fca5a5', stroke: '#dc2626', strokeWidth: 1.5 },
    },
  },

  popup: {
    placement: 'cursor',
    render(item) {
      const room = item as Room
      const statusLabel = room.status === 'free' ? '🟢 Available' : '🔴 Occupied'
      return `
        <div style="min-width: 160px">
          <strong>${room.title}</strong>
          <div style="margin-top: 4px; font-size: 13px; color: #64748b">
            Capacity: ${room.capacity} people
          </div>
          <div style="margin-top: 4px; font-size: 13px">${statusLabel}</div>
        </div>
      `
    },
  },
})

await client.ready

// Apply color scheme from data
const freeIds = rooms.filter(r => r.status === 'free').map(r => r.id)
const busyIds = rooms.filter(r => r.status === 'busy').map(r => r.id)
client.setHighlight('free', freeIds)
client.setHighlight('busy', busyIds)

// Navigate to room page on click
client.on('click', (id) => {
  if (id) window.location.href = `/rooms/${id}`
})
```

---

## Floor Switching

A multi-floor building diagram. The user switches floors — the SVG and data change accordingly.

```ts
import { Svgic } from 'svgic'

const floors: Record<string, { src: string; data: SvgicItem[] }> = {
  '1': { src: '/floor-1.svg', data: [...] },
  '2': { src: '/floor-2.svg', data: [...] },
  '3': { src: '/floor-3.svg', data: [...] },
}

const options = {
  layers: { rooms: { role: 'interactive' } },
  style:  { default: { fill: '#e2e8f0', cursor: 'pointer' }, hover: { fill: '#93c5fd' } },
  popup:  true,
}

let client = new Svgic('#map', { ...options, ...floors['1'] })
await client.ready

// Switch floor
async function switchFloor(floor: string) {
  client.destroy()
  client = new Svgic('#map', { ...options, ...floors[floor] })
  await client.ready
}

// Button handlers
document.querySelectorAll<HTMLButtonElement>('[data-floor]').forEach(btn => {
  btn.addEventListener('click', () => switchFloor(btn.dataset.floor!))
})
```

> **Tip:** Always call `client.destroy()` before creating a new instance. This removes all listeners and clears the SVG from the DOM.

---

## Zoom + Element Focus + Reset Button

ZoomPlugin with auto-focus on the clicked room and a view reset button.

```ts
import { Svgic } from 'svgic'
import { ZoomPlugin } from 'svgic/plugins/zoom'

const zoom = ZoomPlugin({
  wheelMode: 'ctrl',    // zoom with wheel only when Ctrl is held
  minScale: 0.5,
  maxScale: 6,
  focusOnClick: true,   // auto-focus on click
  focusScale: 3,        // scale when focusing
})

const client = new Svgic('#map', {
  src: '/building.svg',
  layers: { rooms: { role: 'interactive' } },
  data: rooms,
  plugins: [zoom],
  popup: { placement: 'element', anchor: 'top-center' },
})

await client.ready

// Reset button
document.querySelector('#btn-reset')?.addEventListener('click', () => {
  zoom.reset()
})

// Focus from an external list
document.querySelectorAll<HTMLElement>('[data-room]').forEach(el => {
  el.addEventListener('click', () => {
    zoom.focusElement(el.dataset.room!, { scale: 3 })
  })
})
```

---

## Popup with a Button Inside

The popup contains a link or button — it must stay visible while the cursor is on it.

```ts
import { Svgic } from 'svgic'

const client = new Svgic('#map', {
  src: '/map.svg',
  layers: { rooms: { role: 'interactive' } },
  data: rooms,

  popup: {
    placement: 'element',
    anchor: 'top-center',
    interactive: true,   // popup stays open when cursor moves onto it

    render(item) {
      const el = document.createElement('div')
      el.style.cssText = 'padding: 8px 12px; min-width: 140px'
      el.innerHTML = `
        <strong style="display: block; margin-bottom: 6px">${item.title ?? item.id}</strong>
      `
      const link = document.createElement('a')
      link.href = `/rooms/${item.id}`
      link.textContent = 'Open →'
      link.style.cssText = 'font-size: 13px; color: #3b82f6; text-decoration: none'
      el.appendChild(link)
      return el
    },
  },
})
```

> **Important:** `render` returns an `HTMLElement` — links and buttons work natively. When using HTML strings via `innerHTML`, make sure data from `item` does not contain user input (XSS). Use `textContent` for text fields.

---

## Detail Panel Instead of Popup

On mobile devices, a popup over the diagram is inconvenient. It is better to show information in a fixed panel next to it.

```html
<div id="map-container">
  <div id="map"></div>
  <aside id="info-panel">
    <p>Select an element on the diagram</p>
  </aside>
</div>
```

```ts
import { Svgic } from 'svgic'

const client = new Svgic('#map', {
  src: '/map.svg',
  layers: { rooms: { role: 'interactive' } },
  data: rooms,
  style: {
    default: { fill: '#e2e8f0', cursor: 'pointer' },
    hover:   { fill: '#93c5fd' },
  },

  popup: {
    placement: 'target',
    target: '#info-panel',
    trigger: 'click',

    render(item) {
      return `
        <h3>${item.title ?? item.id}</h3>
        <p>${item.description ?? '—'}</p>
        <a href="/rooms/${item.id}">Details →</a>
      `
    },
  },
})
```

---

## Custom Plugin

A plugin that outlines the active (clicked) room and removes the outline when another room is clicked.

```ts
import type { SvgicPlugin, ISvgic, SvgicItem } from 'svgic'

function ActiveRoomPlugin(): SvgicPlugin {
  let activeEl: SVGElement | null = null

  return {
    name: 'active-room',

    onElementClick(element: SVGElement, item: SvgicItem | null): void {
      // Remove outline from previous element
      if (activeEl) {
        activeEl.style.outline = ''
        activeEl.style.filter = ''
      }

      // If the same element was clicked — reset
      if (activeEl === element) {
        activeEl = null
        return
      }

      // Highlight the new element
      element.style.filter = 'drop-shadow(0 0 6px rgba(59, 130, 246, 0.8))'
      activeEl = element
    },

    onDestroy(_client: ISvgic): void {
      activeEl = null
    },
  }
}

// Usage
const client = new Svgic('#map', {
  src: '/map.svg',
  layers: { rooms: { role: 'interactive' } },
  data: rooms,
  plugins: [ActiveRoomPlugin()],
})
```

> **Tip:** Returning `false` from a hook cancels the default behavior (hover style, popup, event). Use this when you want to fully replace the behavior with your own logic.

---

## Vue: Reactive Data and Highlighting

An office map in Vue 3 with reactive data and highlight control via a composable.

```vue
<template>
  <div class="office-map">
    <SvgicVue
      src="/office.svg"
      :data="rooms"
      :layers="layers"
      :style="styleConfig"
      :popup="popupConfig"
      @click="onRoomClick"
    />
    <aside class="sidebar">
      <div v-if="selected">
        <h3>{{ selected.title }}</h3>
        <p>{{ selected.description }}</p>
        <button @click="closeRoom">Close</button>
      </div>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { SvgicVue } from 'svgic/vue'
import type { SvgicItem, SvgicStyleConfig, PopupOption, SvgicLayer } from 'svgic'

interface Room extends SvgicItem {
  status: 'free' | 'busy'
}

const rooms = ref<Room[]>([
  { id: 'room-101', title: 'Conference Room A', description: 'Capacity: 8 people', status: 'free' },
  { id: 'room-102', title: 'Conference Room B', description: 'Capacity: 4 people', status: 'busy' },
])

const selected = ref<Room | null>(null)

const layers: Record<string, SvgicLayer> = {
  rooms: { role: 'interactive' },
}

const styleConfig: SvgicStyleConfig = {
  default:          { fill: '#e2e8f0', cursor: 'pointer', transition: 'fill 0.15s' },
  hover:            { opacity: 0.8 },
  highlightedHover: { opacity: 0.7 },
  states: {
    free:     { fill: '#86efac' },
    busy:     { fill: '#fca5a5' },
    selected: { fill: '#93c5fd', stroke: '#3b82f6', strokeWidth: 2 },
  },
}

const popupConfig: PopupOption = {
  placement: 'cursor',
  render: (item) => `<strong>${item.title}</strong>`,
}

function onRoomClick(id: string, item: SvgicItem | null) {
  selected.value = item as Room | null
}

function closeRoom() {
  selected.value = null
}

// Highlight via data — reacts to rooms changes.
// The color scheme is managed through style.states;
// highlights are recalculated externally and passed via :data
// (SvgicVue reactively calls setData when :data changes)
</script>
```

> **Tip:** If you need access to `client.setHighlight()` from a Vue component — use the `useSvgic()` composable instead of `<SvgicVue>`. It returns `client` as a `shallowRef`, available after mount.
