# svgic

Интерактивный SVG-клиент. Встраивает SVG в DOM, привязывает слои к данным, обрабатывает события (hover, click) и позволяет расширять поведение через плагины.

Работает с ванильным JS/TS, Vue 3 и React (адаптеры поставляются в комплекте).

---

## Установка

```bash
npm install svgic
```

---

## Быстрый старт

```ts
import { Svgic } from 'svgic'

const client = new Svgic('#container', {
  src: '/map.svg',
  layers: {
    rooms:      { role: 'interactive' },
    background: { role: 'decorative' },
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
  plugins?: SvgicPlugin[],              // плагины
  popup?:   PopupOption,                // попап при наведении (см. раздел ниже)
  style?:   SvgicStyleConfig,           // стилизация элементов (см. раздел ниже)
})
```

### SvgicLayer

```ts
interface SvgicLayer {
  role: 'interactive' | 'decorative'
}
```

### SvgicItem

```ts
interface SvgicItem {
  id: string           // совпадает с id элемента в SVG
  title?: string
  description?: string
  image?: string
  link?: string
  [key: string]: unknown  // любые кастомные поля
}
```

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
| `click` | клик по пустому месту | `''` | `null` |
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
import { SvgicVue } from 'svgic/vue'
import type { SvgicItem } from 'svgic'

const rooms = ref<SvgicItem[]>([
  { id: 'room-101', title: 'Переговорная' },
])

function onRoomClick(id: string, item: SvgicItem | null) {
  console.log(id, item)
}
</script>

<template>
  <SvgicVue
    src="/map.svg"
    :layers="{ rooms: { role: 'interactive' } }"
    :data="rooms"
    @click="onRoomClick"
  />
</template>
```

Компонент реактивно реагирует на изменение пропа `:data`.

### Composable

```ts
import { useSvgic } from 'svgic/vue'

const { containerRef, client } = useSvgic({
  src: '/map.svg',
  layers: { rooms: { role: 'interactive' } },
})
```

```html
<div :ref="containerRef" />
```

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
