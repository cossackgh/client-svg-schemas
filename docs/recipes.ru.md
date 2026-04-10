# svgic — Recipes

Практические примеры для типовых сценариев использования.

## Содержание

- [Карта офиса с цветовым статусом](#карта-офиса-с-цветовым-статусом)
- [Переключение этажей](#переключение-этажей)
- [Zoom + фокус на элементе + кнопка сброса](#zoom--фокус-на-элементе--кнопка-сброса)
- [Попап с кнопкой внутри](#попап-с-кнопкой-внутри)
- [Детальная панель вместо попапа](#детальная-панель-вместо-попапа)
- [Кастомный плагин](#кастомный-плагин)
- [Vue: реактивные данные и подсветка](#vue-реактивные-данные-и-подсветка)

---

## Карта офиса с цветовым статусом

Типовой сценарий: схема комнат, каждая комната имеет статус (`free` / `busy`), при наведении показывается попап, при клике — открывается детальная страница.

```ts
import { Svgic } from '@svgic/core'

interface Room {
  id: string
  title: string
  capacity: number
  status: 'free' | 'busy'
}

const rooms: Room[] = [
  { id: 'room-101', title: 'Переговорная А', capacity: 8, status: 'free' },
  { id: 'room-102', title: 'Переговорная Б', capacity: 4, status: 'busy' },
  { id: 'room-201', title: 'Опен-спейс',    capacity: 20, status: 'free' },
]

const client = new Svgic('#map', {
  src: '/office.svg',
  layers: {
    rooms: { role: 'interactive' },
    // background, labels — не указываем, они рендерятся как статичный SVG
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
      const statusLabel = room.status === 'free' ? '🟢 Свободна' : '🔴 Занята'
      return `
        <div style="min-width: 160px">
          <strong>${room.title}</strong>
          <div style="margin-top: 4px; font-size: 13px; color: #64748b">
            Вместимость: ${room.capacity} чел.
          </div>
          <div style="margin-top: 4px; font-size: 13px">${statusLabel}</div>
        </div>
      `
    },
  },
})

await client.ready

// Применить цветовую схему из данных
const freeIds = rooms.filter(r => r.status === 'free').map(r => r.id)
const busyIds = rooms.filter(r => r.status === 'busy').map(r => r.id)
client.setHighlight('free', freeIds)
client.setHighlight('busy', busyIds)

// Переход на страницу комнаты по клику
client.on('click', (id) => {
  if (id) window.location.href = `/rooms/${id}`
})
```

---

## Переключение этажей

Схема здания с несколькими этажами. Пользователь переключает этаж — SVG и данные меняются.

```ts
import { Svgic } from '@svgic/core'

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

// Переключение этажа
async function switchFloor(floor: string) {
  client.destroy()
  client = new Svgic('#map', { ...options, ...floors[floor] })
  await client.ready
}

// Обработчики кнопок
document.querySelectorAll<HTMLButtonElement>('[data-floor]').forEach(btn => {
  btn.addEventListener('click', () => switchFloor(btn.dataset.floor!))
})
```

> **Совет:** `client.destroy()` перед созданием нового — обязательно. Это снимает все слушатели и удаляет SVG из DOM.

---

## Zoom + фокус на элементе + кнопка сброса

ZoomPlugin с автофокусом на кликнутой комнате и кнопкой сброса вида.

```ts
import { Svgic } from '@svgic/core'
import { ZoomPlugin } from '@svgic/core/plugins/zoom'

const zoom = ZoomPlugin({
  wheelMode: 'ctrl',    // zoom колесом только при зажатом Ctrl
  minScale: 0.5,
  maxScale: 6,
  focusOnClick: true,   // авто-фокус при клике
  focusScale: 3,        // масштаб при фокусе
})

const client = new Svgic('#map', {
  src: '/building.svg',
  layers: { rooms: { role: 'interactive' } },
  data: rooms,
  plugins: [zoom],
  popup: { placement: 'element', anchor: 'top-center' },
})

await client.ready

// Кнопка сброса
document.querySelector('#btn-reset')?.addEventListener('click', () => {
  zoom.reset()
})

// Фокус из внешнего списка
document.querySelectorAll<HTMLElement>('[data-room]').forEach(el => {
  el.addEventListener('click', () => {
    zoom.focusElement(el.dataset.room!, { scale: 3 })
  })
})
```

---

## Попап с кнопкой внутри

Попап содержит ссылку или кнопку — он должен оставаться видимым, пока курсор находится на нём.

```ts
import { Svgic } from '@svgic/core'

const client = new Svgic('#map', {
  src: '/map.svg',
  layers: { rooms: { role: 'interactive' } },
  data: rooms,

  popup: {
    placement: 'element',
    anchor: 'top-center',
    interactive: true,   // попап не закрывается при наезде курсора

    render(item) {
      const el = document.createElement('div')
      el.style.cssText = 'padding: 8px 12px; min-width: 140px'
      el.innerHTML = `
        <strong style="display: block; margin-bottom: 6px">${item.title ?? item.id}</strong>
      `
      const link = document.createElement('a')
      link.href = `/rooms/${item.id}`
      link.textContent = 'Открыть →'
      link.style.cssText = 'font-size: 13px; color: #3b82f6; text-decoration: none'
      el.appendChild(link)
      return el
    },
  },
})
```

> **Важно:** `render` возвращает `HTMLElement` — ссылки и кнопки работают нативно. При использовании HTML-строки через `innerHTML` убедитесь, что данные из `item` не содержат пользовательского ввода (XSS). Используйте `textContent` для текстовых полей.

---

## Детальная панель вместо попапа

На мобильных устройствах попап поверх схемы неудобен. Лучше показывать информацию в фиксированной панели рядом.

```html
<div id="map-container">
  <div id="map"></div>
  <aside id="info-panel">
    <p>Выберите элемент на схеме</p>
  </aside>
</div>
```

```ts
import { Svgic } from '@svgic/core'

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
        <a href="/rooms/${item.id}">Подробнее →</a>
      `
    },
  },
})
```

---

## Кастомный плагин

Плагин, который обводит активную (кликнутую) комнату и снимает обводку при клике на другую.

```ts
import type { SvgicPlugin, ISvgic, SvgicItem } from '@svgic/core'

function ActiveRoomPlugin(): SvgicPlugin {
  let activeEl: SVGElement | null = null

  return {
    name: 'active-room',

    onElementClick(element: SVGElement, item: SvgicItem | null): void {
      // Снять обводку с предыдущего
      if (activeEl) {
        activeEl.style.outline = ''
        activeEl.style.filter = ''
      }

      // Если кликнули на тот же — сбросить
      if (activeEl === element) {
        activeEl = null
        return
      }

      // Выделить новый
      element.style.filter = 'drop-shadow(0 0 6px rgba(59, 130, 246, 0.8))'
      activeEl = element
    },

    onDestroy(_client: ISvgic): void {
      activeEl = null
    },
  }
}

// Использование
const client = new Svgic('#map', {
  src: '/map.svg',
  layers: { rooms: { role: 'interactive' } },
  data: rooms,
  plugins: [ActiveRoomPlugin()],
})
```

> **Совет:** `return false` из хука отменяет дефолтное поведение (hover-стиль, попап, событие). Используйте это когда хотите полностью заменить поведение своей логикой.

---

## Vue: реактивные данные и подсветка

Схема офиса в Vue 3 с реактивными данными и управлением подсветкой через composable.

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
        <button @click="closeRoom">Закрыть</button>
      </div>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { SvgicVue } from '@svgic/core/vue'
import type { SvgicItem, SvgicStyleConfig, PopupOption, SvgicLayer } from '@svgic/core'

interface Room extends SvgicItem {
  status: 'free' | 'busy'
}

const rooms = ref<Room[]>([
  { id: 'room-101', title: 'Переговорная А', description: 'Вместимость 8 чел.', status: 'free' },
  { id: 'room-102', title: 'Переговорная Б', description: 'Вместимость 4 чел.', status: 'busy' },
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

// Подсветка через данные — реакция на изменение rooms
// Цветовая схема управляется через style.states,
// подсветка пересчитывается снаружи и передаётся компоненту через :data
// (SvgicVue реактивно вызывает setData при изменении :data)
</script>
```

> **Совет:** Если нужен доступ к `client.setHighlight()` из Vue-компонента — используйте `useSvgic()` composable вместо `<SvgicVue>`. Он возвращает `client` как `shallowRef`, доступный после монтирования.
