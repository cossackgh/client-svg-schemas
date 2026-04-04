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
})
```

### SvgicLayer

```ts
interface SvgicLayer {
  role: 'interactive' | 'decorative' | 'labels'
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
