# svgic

Интерактивный SVG-клиент. Встраивает SVG в DOM, привязывает слои к данным, обрабатывает события (hover, click) и позволяет расширять поведение через плагины.

Работает с ванильным JS/TS, Vue 3 и React (адаптеры поставляются в комплекте).

**[Полный API Reference →](docs/api.md)** · **[Живые примеры →](https://svgic-examples.za-vod.ru/)**

---

## Установка

```bash
npm install @svgic/core
```

---

## Быстрый старт

```ts
import { Svgic } from '@svgic/core'

const client = new Svgic('#container', {
  src: '/map.svg',
  layers: {
    rooms:      { role: 'interactive' },
    background: { role: 'data' },
  },
  data: [
    { id: 'room-101', title: 'Переговорная', description: 'Вместимость 12 человек' },
    { id: 'room-102', title: 'Опен-спейс' },
  ],
})

await client.ready

client.on('click', (id, item) => {
  console.log('Клик по', id, item)
})
```

SVG должен содержать `<g id="rooms">` и `<g id="background">` — соответствующие `id` в конфиге.

---

## SVG-файл

Слои задаются через `<g id="...">`. Интерактивные элементы — прямые дети интерактивного слоя, идентифицируются по `id`.

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

## Конфиг

```ts
new Svgic(selector, {
  src: string,                          // URL или SVG-строка
  layers?: Record<string, SvgicLayer>,  // описание слоёв
  data?:   SvgicItem[],                 // данные для привязки
  idAttribute?: string,                 // атрибут SVG для привязки (по умолчанию: 'id')
  idMatch?: 'exact' | 'suffix' | fn,   // стратегия сопоставления (по умолчанию: 'exact')
  plugins?: SvgicPlugin[],              // плагины
  popup?:   PopupOption,                // попап при наведении (см. раздел ниже)
  style?:   SvgicStyleConfig,           // стилизация элементов (см. раздел ниже)
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
  id: string           // ключ привязки — сопоставляется с атрибутом SVG-элемента (см. idAttribute / idMatch)
  title?: string
  description?: string
  image?: string
  link?: string
  [key: string]: unknown  // любые кастомные поля
}
```

---

## Сопоставление ID

По умолчанию элементы сопоставляются по точному совпадению `item.id` и атрибута `id` в SVG. Две опции позволяют изменить это:

**`idAttribute`** — использовать другой атрибут как ключ привязки (например, `data-svgic-id`):

```xml
<!-- SVG: редактор переименовал id, но data-svgic-id остаётся стабильным -->
<g id="shop-034_2" data-svgic-id="shop-034" />
```

```ts
new Svgic('#container', { idAttribute: 'data-svgic-id' })
```

**`idMatch: 'suffix'`** — автоматически отрезает числовые суффиксы, добавляемые Inkscape / Illustrator при конфликте ID (`_2`, `_3`, `_1_`…). Точное совпадение проверяется первым; суффиксное сопоставление — только fallback. Выводит `console.warn` со списком авто-сопоставленных элементов:

```ts
new Svgic('#container', { idMatch: 'suffix' })
// [svgic] 2 element(s) matched by suffix stripping:
//   "shop-034_2" → "shop-034"
//   "shop-035_1" → "shop-035"
```

Подробнее в [docs/api.md](docs/api.md#id-matching).

---

## API

```ts
// Ждать окончания инициализации (загрузка SVG, привязка данных)
await client.ready

// Обновить данные после инициализации
client.setData(newData)

// Подписаться на событие
client.on('click', (id, item) => { ... })
client.on('hover', (id, item) => { ... })
client.on('leave', (id, item) => { ... })

// Подключить плагин
client.use(myPlugin)

// Подсветить группу элементов именованным состоянием (требует style.states)
client.setHighlight('free', ['room-101', 'room-102'])
client.clearHighlight('free')   // сбросить конкретное состояние
client.clearHighlight()         // сбросить все состояния

// Уничтожить (снять слушатели, очистить контейнер)
client.destroy()
```

### События

| Событие | Когда | `id` | `item` |
|---------|-------|------|--------|
| `click` | клик по элементу | id элемента | данные или `null` |
| `click` | клик по пустому месту | `null` | `null` |
| `hover` | курсор вошёл в элемент | id элемента | данные или `null` |
| `leave` | курсор вышел из элемента | id элемента | данные или `null` |

---

## Попап при наведении

Библиотека умеет показывать попап с данными элемента при наведении — без дополнительного кода.

### Быстрое включение

```ts
new Svgic('#container', {
  src: '/map.svg',
  data: items,
  popup: true, // показывает title, привязан к элементу сверху
})
```

### Режимы позиционирования

#### `element` — привязан к SVG-элементу

```ts
popup: {
  placement: 'element',
  anchor: 'top-center', // 'center' | 'top' | 'top-center' | 'top-left' | 'top-right'
                        // 'bottom' | 'bottom-center' | 'left' | 'right'
  offset: { x: 0, y: -8 },
  flip: true,           // авто-переворот если выходит за край экрана (default: true)
}
```

#### `cursor` — следует за курсором

```ts
popup: {
  placement: 'cursor',
  offset: { x: 16, y: 16 }, // отступ от курсора (default)
}
```

По умолчанию попап отображается **выше** курсора. Если выходит за верхний край viewport — автоматически переворачивается вниз.

#### `target` — рендерит в указанный DOM-узел

Подходит для мобильных интерфейсов: информация отображается в фиксированной панели, а не поверх схемы.

```ts
popup: {
  placement: 'target',
  target: '#info-panel',  // CSS-селектор или HTMLElement
}
```

### Кастомный контент

По умолчанию попап показывает только `title`. Для кастомного содержимого передайте `render`:

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

`render` принимает `SvgicItem` и возвращает `HTMLElement` или HTML-строку.

> **Безопасность:** если данные в `SvgicItem` поступают из ненадёжного источника (пользовательский ввод, внешний API), не вставляйте их через `innerHTML` в `render()` — это создаёт XSS-уязвимость. Используйте `textContent` для текстовых полей или санируйте HTML перед вставкой (например через [DOMPurify](https://github.com/cure53/DOMPurify)). Вариант с `template` + `bind` безопаснее по умолчанию, так как `bind` поощряет использование `textContent`.

### Попап через HTML-шаблон (`template` + `bind`)

Если нужно отделить вёрстку попапа от кода инициализации — используйте `template` + `bind`. Дизайнер меняет HTML, не трогая JS.

Определите шаблон в HTML:

```html
<template id="room-popup">
  <div class="room-popup">
    <strong class="room-popup__title"></strong>
    <p class="room-popup__desc"></p>
  </div>
</template>
```

Передайте селектор или элемент напрямую:

```ts
popup: {
  placement: 'cursor',
  template: '#room-popup',   // селектор <template> элемента
  bind(el, item) {           // el — клон шаблона, item — данные
    el.querySelector('.room-popup__title')!.textContent = item.title ?? ''
    el.querySelector('.room-popup__desc')!.textContent = item.description ?? ''
  },
}
```

Или передайте `HTMLTemplateElement` напрямую:

```ts
popup: {
  placement: 'element',
  anchor: 'top-center',
  template: document.querySelector<HTMLTemplateElement>('#room-popup')!,
  bind(el, item) { /* ... */ },
}
```

`template` и `render` взаимоисключающие — если указан `template`, `render` игнорируется.

### Триггер открытия (`trigger`)

По умолчанию попап появляется при наведении (`hover`). Для открытия по клику:

```ts
popup: {
  placement: 'element',
  trigger: 'click',  // default: 'hover'
}
```

В режиме `click`:
- hover применяет только смену цвета (через `style`)
- клик на элемент открывает попап
- клик на другой элемент переключает попап
- клик на пустое место или вне SVG закрывает попап

### Задержка скрытия и интерактивный попап

Для попапов со ссылками или кнопками внутри — попап должен оставаться видимым, пока курсор находится на нём:

```ts
popup: {
  placement: 'element',
  interactive: true,   // попап не скрывается при наезде курсора
                       // автоматически устанавливает hideDelay: 120ms
  render(item) {
    const el = document.createElement('div')
    const link = document.createElement('a')
    link.href = `/rooms/${item.id}`
    link.textContent = 'Открыть →'
    el.append(link)
    return el
  },
}
```

Только задержка без интерактивности:

```ts
popup: {
  placement: 'element',
  hideDelay: 300,  // мс перед скрытием
}
```

### Полная замена через плагин

Если нужен полный контроль над попапом (своя анимация, портал, React/Vue компонент) — используйте плагин и верните `false` из `onElementHover`, чтобы отменить встроенный:

```ts
client.use({
  name: 'my-popup',
  onElementHover(element, item) {
    MyPopup.show(item, element.getBoundingClientRect())
    return false // отменяет дефолтный попап
  },
  onElementLeave(element) {
    MyPopup.hide()
    return false
  },
})
```

### Отключить попап

```ts
popup: false // или просто не указывать
```

---

## Стилизация элементов

Библиотека умеет управлять внешним видом интерактивных элементов через конфиг — без ручной работы с CSS.

Стили применяются к прямым дочерним фигурам (`<path>`, `<rect>` и т.д.) через CSS-классы на родительском `<g>`.  
Вложенные `<g>` внутри элемента не затрагиваются.

### Базовый пример

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

### Полный конфиг

```ts
style: {
  // Стиль по умолчанию для всех интерактивных элементов
  default: {
    fill:       '#e0e0e0',
    cursor:     'pointer',
    transition: 'fill 0.2s ease, opacity 0.2s ease',
  },

  // Hover (без подсветки)
  hover: {
    fill: '#4a90d9',
  },

  // Hover поверх подсвеченного элемента — вместо обычного hover
  highlightedHover: {
    opacity: 0.75,
  },

  // Именованные состояния для setHighlight()
  states: {
    free:       { fill: '#1a4731', stroke: '#2d9e5a', strokeWidth: 1.5 },
    busy:       { fill: '#4a1e1e', stroke: '#e03030', strokeWidth: 1.5 },
    restricted: { fill: '#3d2a0a', stroke: '#d97706', strokeWidth: 1.5 },
  },
}
```

### Подсветка группы элементов

```ts
// Подсветить все свободные комнаты
client.setHighlight('free', ['room-101', 'room-103', 'room-202'])

// Можно применять несколько состояний одновременно
client.setHighlight('busy', ['room-102', 'room-201'])

// Сбросить конкретное состояние
client.clearHighlight('free')

// Сбросить всё
client.clearHighlight()
```

### Приоритет состояний

| Классы на элементе | Результат |
|---|---|
| _(ничего)_ | `default` стиль |
| `svgic-hover` | `hover` стиль |
| `svgic-state-free` | `free` стиль |
| `svgic-hover` + `svgic-state-free` | `highlightedHover` поверх `free` |

---

## Vue 3

### Компонент

```vue
<script setup lang="ts">
import { SvgicVue } from '@svgic/core/vue'
import type { SvgicItem } from '@svgic/core'

const rooms = ref<SvgicItem[]>([
  { id: 'room-101', title: 'Переговорная' },
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

Компонент реактивно реагирует на изменение пропа `:data`.

### Пропы компонента

| Проп | Тип | Описание |
|---|---|---|
| `src` | `string` | URL или SVG-строка (обязательный) |
| `data` | `SvgicItem[]` | Данные для привязки к элементам |
| `layers` | `Record<string, SvgicLayer>` | Описание слоёв SVG |
| `plugins` | `SvgicPlugin[]` | Плагины (ZoomPlugin и др.) |
| `popup` | `PopupOption` | Конфигурация попапа |
| `style` | `SvgicStyleConfig` | Стилизация интерактивных элементов |

### События компонента

| Событие | Сигнатура |
|---|---|
| `@click` | `(id: string \| null, item: SvgicItem \| null) => void` |
| `@hover` | `(id: string \| null, item: SvgicItem \| null) => void` |
| `@leave` | `(id: string \| null, item: SvgicItem \| null) => void` |

### Composable

```ts
import { useSvgic } from '@svgic/core/vue'

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

`client` — реактивный `shallowRef<Svgic | null>`, доступен после монтирования. Через него можно вызывать `setHighlight`, `setData`, методы плагинов и т.д.

---

## React

### Компонент

```tsx
import { SvgicReact } from '@svgic/core/react'
import type { SvgicItem } from '@svgic/core'

const rooms: SvgicItem[] = [
  { id: 'room-101', title: 'Переговорная' },
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

Компонент пересоздаёт клиент при смене `src` и реактивно обновляет данные при смене `data` без пересоздания.

### Пропы компонента

| Проп | Тип | Описание |
|---|---|---|
| `src` | `string` | URL или SVG-строка (обязательный) |
| `data` | `SvgicItem[]` | Данные для привязки к элементам |
| `layers` | `Record<string, SvgicLayer>` | Описание слоёв SVG |
| `plugins` | `SvgicPlugin[]` | Плагины (ZoomPlugin и др.) |
| `popup` | `PopupOption` | Конфигурация попапа |
| `styleConfig` | `SvgicStyleConfig` | Стилизация интерактивных элементов |
| `onClick` | `(id, item) => void` | Событие клика |
| `onHover` | `(id, item) => void` | Событие наведения |
| `onLeave` | `(id, item) => void` | Событие ухода курсора |
| `className` | `string` | CSS-класс контейнера |
| `style` | `CSSProperties` | Инлайн-стили контейнера |

> `styleConfig` — конфигурация стилей SVG-слоёв. Называется иначе, чем в ядре, чтобы не конфликтовать со стандартным пропом `style` контейнера.

### Hook

```tsx
import { useRef } from 'react'
import { useSvgic } from '@svgic/core/react'
import { ZoomPlugin } from '@svgic/core/plugins/zoom'

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
      <button onClick={handleReset}>Сброс</button>
    </>
  )
}
```

`client` — `Svgic | null`, доступен после монтирования (через `useState`).

---

## ZoomPlugin — zoom и pan

Официальный плагин для масштабирования и перемещения SVG-схемы.
Поставляется в комплекте с библиотекой, без внешних зависимостей.

```ts
import { ZoomPlugin } from '@svgic/core/plugins/zoom'

const zoom = ZoomPlugin({
  wheelMode: 'ctrl',  // zoom колесом только при зажатом Ctrl
  minScale: 0.5,
  maxScale: 8,
})

const client = new Svgic('#container', {
  src: '/map.svg',
  plugins: [zoom],
})
```

### Возможности

| Устройство | Взаимодействие |
|---|---|
| Мышь — колесо | Zoom к точке курсора |
| Мышь — перетаскивание | Pan |
| Touch — два пальца | Pinch-to-zoom |
| Touch — один палец | Pan |
| Touch — двойной тап | Zoom in / reset |

### Опции

| Опция | Тип | По умолчанию | Описание |
|---|---|---|---|
| `wheelMode` | `'ctrl' \| 'always'` | `'ctrl'` | `ctrl` — zoom только при зажатом Ctrl; `always` — всегда |
| `minScale` | `number` | `0.5` | Минимальный масштаб |
| `maxScale` | `number` | `10` | Максимальный масштаб |
| `pan` | `boolean` | `true` | Разрешить pan мышью |
| `touch` | `boolean` | `true` | Разрешить touch-жесты |
| `doubleTapScale` | `number` | `2` | Масштаб при двойном тапе |
| `panBounds` | `boolean` | `true` | Ограничить pan границами SVG |
| `animate` | `boolean` | `true` | Анимировать программные переходы |
| `animationDuration` | `number` | `300` | Длительность анимации в мс |
| `focusOnClick` | `boolean` | `false` | Автофокус на элемент при клике |
| `focusScale` | `number` | `2` | Масштаб при авто-фокусе |

### Программный API

```ts
zoom.zoomTo(3)                              // масштаб к центру viewBox
zoom.panTo(100, 200)                        // переместить viewBox (SVG-координаты)
zoom.focusElement('room-101')               // zoom + центрирование на элементе
zoom.focusElement('room-101', { scale: 3 })
zoom.reset()                                // сбросить к исходному viewBox
zoom.getState()                             // → { scale, x, y }

// Все методы поддерживают опцию animate
zoom.reset({ animate: false })
zoom.zoomTo(2, { animate: true })
```

---

## DebugPlugin — отображение id элементов

Плагин для разработки: показывает `id` SVG-элементов прямо на схеме при наведении или клике. Удобен на этапе настройки — чтобы узнать нужные `id` без открытия DevTools.

```ts
import { DebugPlugin } from '@svgic/core/plugins/debug'

const client = new Svgic('#container', {
  src: '/map.svg',
  plugins: [DebugPlugin()],
})
```

Типичный паттерн — включать через URL-параметр:

```ts
const debug = new URLSearchParams(location.search).has('debug')

new Svgic('#container', {
  src: '/map.svg',
  plugins: debug ? [DebugPlugin()] : [],
})
// http://localhost:5173/?debug → лейблы включены
```

### Опции

| Опция | Тип | По умолчанию | Описание |
|---|---|---|---|
| `showOn` | `'hover' \| 'click' \| 'both'` | `'hover'` | Триггер показа лейбла |
| `render` | `(id, item) => HTMLElement \| string` | — | Кастомный рендер содержимого лейбла |

**`showOn`:**
- `hover` — лейбл появляется при наведении, исчезает при уходе курсора
- `click` — лейбл закрепляется по клику, повторный клик снимает
- `both` — показывается при наведении, клик закрепляет (жёлтый цвет)

### Отображение данных

По умолчанию лейбл показывает `id` и `title` из привязанных данных. Если для элемента нет записи в `data` — выводится предупреждение `⚠ нет данных`. Это позволяет быстро найти несоответствие между `id` в SVG-файле и ключами в массиве данных.

```
room-101  Переговорная А       ← данные есть
room-203  ⚠ нет данных         ← id есть в SVG, но нет в data
```

### Кастомный render

Для отображения дополнительных полей передайте функцию `render`:

```ts
DebugPlugin({
  render(id, item) {
    if (!item) return `${id} ⚠ нет данных`
    return `${id} · ${item.title} [${item.status}]`
  }
})
```

`render` получает `id` элемента и `SvgicItem | null`, возвращает `HTMLElement` или HTML-строку.

> Предназначен только для разработки. Не включайте в продакшн-сборку.

---

## Плагины

```ts
const highlightPlugin = {
  name: 'highlight',

  onInit(client) {
    console.log('svgic инициализирован')
  },

  onElementHover(element, item) {
    element.style.opacity = '0.7'
  },

  onElementLeave(element, item) {
    element.style.opacity = ''
  },

  onElementClick(element, item) {
    // вернуть false — отменить дефолтное событие click
  },
}

client.use(highlightPlugin)
```

### Хуки плагина

| Хук | Когда вызывается | Возвращает `false` |
|-----|------------------|--------------------|
| `onInit(client)` | после загрузки SVG | — |
| `onDestroy(client)` | при вызове `destroy()` | — |
| `onElementHover(el, item)` | наведение | отменяет событие `hover` |
| `onElementLeave(el, item)` | уход | отменяет событие `leave` |
| `onElementClick(el, item)` | клик | отменяет событие `click` |

---

## Источник SVG

```ts
// URL (fetch)
new Svgic('#container', { src: '/map.svg' })

// SVG-строка напрямую
new Svgic('#container', { src: '<svg>...</svg>' })
```

---

## Лицензия

MIT
