# svgic — API Reference

> Практические примеры: **[docs/recipes.md](recipes.md)**

## Содержание

- [Конструктор](#конструктор)
- [SvgicOptions](#svgicoptons)
- [Методы экземпляра](#методы-экземпляра)
- [События](#события)
- [SvgicItem — схема данных](#svgicitem--схема-данных)
- [Style — конфигурация стилей](#style--конфигурация-стилей)
- [Popup — конфигурация попапа](#popup--конфигурация-попапа)
- [Plugin API](#plugin-api)
- [ZoomPlugin](#zoomplugin)
- [DebugPlugin](#debugplugin)
- [Vue-адаптер](#vue-адаптер)
- [React-адаптер](#react-адаптер)

---

## Конструктор

```ts
new Svgic(selector, options)
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `selector` | `string \| Element` | CSS-селектор или DOM-элемент контейнера |
| `options` | `SvgicOptions` | Конфигурация (см. ниже) |

Бросает `Error` если контейнер не найден.

```ts
import { Svgic } from 'svgic'

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
  plugins?: SvgicPlugin[]
  popup?: PopupOption
  style?: SvgicStyleConfig
}
```

| Поле | Тип | Обязательное | Описание |
|------|-----|:---:|----------|
| `src` | `string` | ✅ | URL SVG-файла или SVG-строка (`<svg>...</svg>`) |
| `data` | `SvgicItem[]` | — | Массив данных, привязываемых к элементам по `id` |
| `layers` | `Record<string, SvgicLayer>` | — | Конфигурация слоёв SVG |
| `plugins` | `SvgicPlugin[]` | — | Список плагинов |
| `popup` | `PopupOption` | — | Конфигурация попапа (см. [Popup](#popup--конфигурация-попапа)) |
| `style` | `SvgicStyleConfig` | — | Конфигурация стилей (см. [Style](#style--конфигурация-стилей)) |

### SvgicLayer

```ts
interface SvgicLayer {
  role: 'interactive' | 'decorative'
}
```

Роль слоя задаётся в конфиге (не в SVG-файле). Слои идентифицируются по `id` атрибуту `<g>`-элементов.

- `interactive` — элементы слоя реагируют на hover/click и участвуют в привязке данных
- `decorative` — слой игнорируется при обработке событий

```ts
new Svgic('#container', {
  src: '/map.svg',
  layers: {
    'rooms':      { role: 'interactive' },
    'background': { role: 'decorative' },
  },
})
```

---

## Методы экземпляра

### `client.ready`

```ts
readonly ready: Promise<void>
```

Promise, который резолвится после загрузки и инициализации SVG. Необходимо дождаться перед вызовом `setData()` и программным API плагинов.

```ts
await client.ready
client.setData(newData)
```

### `client.setData(data)`

```ts
setData(data: SvgicItem[]): void
```

Обновляет привязанные данные. Вызывать после `await client.ready`.

### `client.on(event, handler)`

```ts
on(event: 'click' | 'hover' | 'leave', handler: (id: string, item: SvgicItem | null) => void): this
```

Подписка на события. Возвращает `this` для чейнинга.

```ts
client
  .on('click', (id, item) => console.log('clicked', id, item))
  .on('hover', (id, item) => console.log('hovered', id))
```

### `client.setHighlight(state, ids)`

```ts
setHighlight(state: string, ids: string[]): void
```

Устанавливает именованное состояние подсветки для указанных элементов. Стиль состояния задаётся в `style.states[state]`. Несколько состояний могут быть активны одновременно.

```ts
client.setHighlight('free', ['room-101', 'room-102'])
client.setHighlight('busy', ['room-201'])
```

### `client.clearHighlight(state?)`

```ts
clearHighlight(state?: string): void
```

Снимает подсветку. Если `state` не указан — сбрасывает все активные состояния.

```ts
client.clearHighlight('free')  // снять только 'free'
client.clearHighlight()        // снять все
```

### `client.getElement()`

```ts
getElement(): SVGSVGElement | null
```

Возвращает корневой `<svg>` элемент после загрузки, иначе `null`.

### `client.use(plugin)`

```ts
use(plugin: SvgicPlugin): this
```

Подключает плагин. Можно вызывать до или после инициализации. Если SVG уже загружен — `onInit` вызывается немедленно.

### `client.destroy()`

```ts
destroy(): void
```

Удаляет SVG из DOM, отписывает все обработчики, вызывает `onDestroy` у плагинов.

---

## События

| Событие | Когда срабатывает | `item` |
|---------|-------------------|--------|
| `click` | клик по интерактивному элементу | данные элемента или `null` |
| `hover` | наведение курсора | данные элемента или `null` |
| `leave` | курсор покинул элемент | данные элемента или `null` |

---

## SvgicItem — схема данных

```ts
interface SvgicItem {
  id: string           // совпадает с id атрибутом SVG-элемента
  title?: string       // используется в дефолтном попапе
  description?: string
  image?: string
  link?: string
  [key: string]: unknown  // любые кастомные поля
}
```

`id` элемента в массиве `data` должен совпадать с `id` атрибутом SVG-элемента (`<g id="room-101">`).

---

## Style — конфигурация стилей

```ts
interface SvgicStyleConfig {
  default?: SvgicStyleProperties
  hover?: SvgicStyleProperties
  highlightedHover?: SvgicStyleProperties
  states?: Record<string, SvgicStyleProperties>
}
```

| Поле | Описание |
|------|----------|
| `default` | Базовые стили всех интерактивных элементов |
| `hover` | Стили при наведении курсора |
| `highlightedHover` | Стили при наведении на подсвеченный элемент (применяется вместо `hover`) |
| `states` | Именованные состояния для `setHighlight()` |

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
  [key: string]: unknown  // любые CSS-свойства
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

## Popup — конфигурация попапа

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

| Значение | Поведение |
|----------|-----------|
| `true` | Дефолтный попап с `title`, размещение `element`, якорь `top-center` |
| `false` / `undefined` | Попап отключён |
| Объект | Кастомная конфигурация |

### Общие поля попапа

| Поле | Тип | Default | Описание |
|------|-----|:-------:|----------|
| `render` | `(item) => HTMLElement \| string` | — | Кастомный рендер содержимого попапа |
| `template` | `string \| HTMLTemplateElement` | — | HTML-шаблон для попапа |
| `bind` | `(el, item) => void` | — | Привязка данных к отрендеренному шаблону |
| `trigger` | `'hover' \| 'click'` | `'hover'` | Триггер открытия попапа |
| `interactive` | `boolean` | `false` | Попап не закрывается пока курсор на нём (для ссылок/кнопок внутри) |
| `hideDelay` | `number` | `0` / `120`* | Задержка скрытия в мс. *При `interactive: true` автоматически `120` |

### Режим `placement: 'element'`

Попап прикреплён к SVG-элементу.

```ts
popup: {
  placement: 'element',
  anchor?: PopupAnchor,  // default: 'top-center'
  offset?: { x?: number, y?: number },  // default: { x: 0, y: -8 }
  flip?: boolean,        // default: true — авто-переворот если уходит за viewport
}
```

**PopupAnchor:** `'center'` | `'top'` | `'top-center'` | `'top-left'` | `'top-right'` | `'bottom'` | `'bottom-center'` | `'bottom-left'` | `'bottom-right'` | `'left'` | `'right'`

### Режим `placement: 'cursor'`

Попап следует за курсором.

```ts
popup: {
  placement: 'cursor',
  offset?: { x?: number, y?: number },  // default: { x: 16, y: 16 }
}
```

### Режим `placement: 'target'`

Попап рендерится в указанный DOM-элемент вне SVG.

```ts
popup: {
  placement: 'target',
  target: string | HTMLElement,  // CSS-селектор или элемент
  trigger?: 'hover' | 'click',  // default: 'hover'
}
```

### Примеры попапа

```ts
// Дефолтный попап
popup: true

// Кастомный render
popup: {
  placement: 'cursor',
  render: (item) => `<strong>${item.title}</strong><br>${item.description ?? ''}`,
}

// Интерактивный попап со ссылкой
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

// Попап в сайдбар
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

| Хук | Когда вызывается | `return false` |
|-----|-----------------|----------------|
| `onInit` | После загрузки SVG | — |
| `onDestroy` | При `client.destroy()` | — |
| `onElementHover` | Наведение на элемент | Отменяет дефолтное поведение (hover-стиль, попап) |
| `onElementLeave` | Курсор покинул элемент | Отменяет дефолтное поведение |
| `onElementClick` | Клик по элементу | Отменяет дефолтное поведение |

```ts
const myPlugin: SvgicPlugin = {
  name: 'my-plugin',
  onInit(client) {
    console.log('SVG ready', client.getElement())
  },
  onElementClick(element, item) {
    console.log('clicked', element.id, item)
    // return false  // чтобы отменить дефолт
  },
}

const client = new Svgic('#container', {
  src: '/map.svg',
  plugins: [myPlugin],
})
```

---

## ZoomPlugin

Официальный плагин zoom/pan. Поддерживает колесо мыши, перетаскивание, touch (pinch-zoom, pan, двойной тап).

```ts
import { ZoomPlugin } from 'svgic/plugins/zoom'
```

### Опции

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
  animationDuration?: number            // default: 300 (мс)
  focusOnClick?     : boolean           // default: false
  focusScale?       : number            // default: 2
}
```

| Поле | Описание |
|------|----------|
| `minScale` | Минимальный масштаб |
| `maxScale` | Максимальный масштаб |
| `wheelMode` | `'always'` — зум всегда; `'ctrl'` — только с Ctrl (для страниц со скроллом) |
| `pan` | Разрешить pan перетаскиванием мыши |
| `touch` | Разрешить touch-жесты |
| `doubleTapScale` | Масштаб при двойном тапе/клике |
| `panBounds` | Ограничить pan границами SVG |
| `animate` | Анимировать программные переходы |
| `animationDuration` | Длительность анимации в мс |
| `focusOnClick` | Автофокус на элемент при клике |
| `focusScale` | Масштаб при авто-фокусе |

### Программный API

```ts
const zoom = ZoomPlugin({ wheelMode: 'ctrl', focusOnClick: true })
const client = new Svgic('#container', { src: '/map.svg', plugins: [zoom] })

await client.ready

zoom.zoomTo(2)                              // установить масштаб
zoom.panTo(100, 200)                        // переместить к SVG-координатам
zoom.focusElement('room-101')               // zoom + center на элемент
zoom.reset()                                // сбросить к исходному viewBox
zoom.getState()                             // { scale, x, y }
```

Все методы принимают опциональный параметр `{ animate?: boolean }`.

### ZoomState

```ts
interface ZoomState {
  scale: number  // текущий масштаб (1 = исходный)
  x: number      // смещение viewBox по X в SVG-координатах
  y: number      // смещение viewBox по Y в SVG-координатах
}
```

---

## DebugPlugin

Плагин для разработки: показывает `id` и данные SVG-элементов при наведении/клике. Помогает отлаживать привязку данных.

```ts
import { DebugPlugin } from 'svgic/plugins/debug'
```

### Опции

```ts
interface DebugPluginOptions {
  showOn?: 'hover' | 'click' | 'both'
  render?: (id: string, item: SvgicItem | null) => HTMLElement | string
}
```

| Поле | Default | Описание |
|------|:-------:|----------|
| `showOn` | `'hover'` | Когда показывать лейбл: при наведении, клике, или обоих |
| `render` | — | Кастомный рендер содержимого лейбла |

Режимы `showOn`:
- `'hover'` — лейбл появляется при наведении, скрывается при уходе
- `'click'` — лейбл закрепляется кликом, повторный клик снимает
- `'both'` — лейбл при наведении + закрепление кликом

```ts
// Базовое использование — только в dev-режиме
const debug = new URLSearchParams(location.search).has('debug')

new Svgic('#container', {
  src: '/map.svg',
  plugins: debug ? [DebugPlugin()] : [],
})

// Кастомный рендер
DebugPlugin({
  showOn: 'both',
  render(id, item) {
    return item ? `${id} · ${item.title}` : `${id} ⚠ нет данных`
  },
})
```

---

## Vue-адаптер

```ts
import { SvgicVue } from 'svgic/vue'
```

### Props

| Prop | Тип | Обязательный | Описание |
|------|-----|:---:|----------|
| `src` | `string` | ✅ | URL SVG-файла или SVG-строка |
| `data` | `SvgicItem[]` | — | Данные (реактивно) |
| `layers` | `Record<string, SvgicLayer>` | — | Конфигурация слоёв |
| `plugins` | `SvgicPlugin[]` | — | Плагины |
| `popup` | `PopupOption` | — | Конфигурация попапа |
| `style` | `SvgicStyleConfig` | — | Конфигурация стилей |

### Events

| Событие | Аргументы |
|---------|-----------|
| `@click` | `(id: string, item: SvgicItem \| null)` |
| `@hover` | `(id: string, item: SvgicItem \| null)` |
| `@leave` | `(id: string, item: SvgicItem \| null)` |

Компонент автоматически пересоздаёт клиент при смене `src` и реактивно обновляет данные при смене `data`.

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
import type { SvgicItem } from 'svgic'

const rooms = ref<SvgicItem[]>([...])

function onRoomClick(id: string, item: SvgicItem | null) {
  console.log('clicked', id, item)
}
</script>
```

### useSvgic (composable)

```ts
import { useSvgic } from 'svgic/vue'

const { client, containerRef } = useSvgic(options)
```

Возвращает `containerRef` (привязать к DOM-элементу) и `client` (экземпляр `Svgic` после инициализации).

---

## React-адаптер

```ts
import { SvgicReact } from 'svgic/react'
```

### Props

Аналогичны Vue-адаптеру: `src`, `data`, `layers`, `plugins`, `popup`, `style`, плюс коллбэки событий:

| Prop | Тип | Описание |
|------|-----|----------|
| `onClick` | `(id: string, item: SvgicItem \| null) => void` | Клик по элементу |
| `onHover` | `(id: string, item: SvgicItem \| null) => void` | Наведение |
| `onLeave` | `(id: string, item: SvgicItem \| null) => void` | Уход курсора |

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
