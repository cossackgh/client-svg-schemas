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
- [ContentPlugin](#contentplugin)
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

| Поле | Тип | Обязательное | Описание |
|------|-----|:---:|----------|
| `src` | `string` | ✅ | URL SVG-файла или SVG-строка (`<svg>...</svg>`) |
| `data` | `SvgicItem[]` | — | Массив данных, привязываемых к элементам по `id` |
| `layers` | `Record<string, SvgicLayer>` | — | Конфигурация слоёв SVG |
| `idAttribute` | `string` | — | Атрибут SVG для идентификации элементов. По умолчанию: `'id'`. См. [Сопоставление ID](#сопоставление-id) |
| `idMatch` | `'exact' \| 'suffix' \| fn` | — | Способ сопоставления значений атрибута с `id` в данных. По умолчанию: `'exact'`. См. [Сопоставление ID](#сопоставление-id) |
| `plugins` | `SvgicPlugin[]` | — | Список плагинов |
| `popup` | `PopupOption` | — | Конфигурация попапа (см. [Popup](#popup--конфигурация-попапа)) |
| `style` | `SvgicStyleConfig` | — | Конфигурация стилей (см. [Style](#style--конфигурация-стилей)) |

### Сопоставление ID

По умолчанию SVG-элементы сопоставляются с элементами данных по точному совпадению атрибута `id` и `item.id`. Опции `idAttribute` и `idMatch` позволяют изменить это поведение, когда SVG-файлы приходят из векторных редакторов, которые модифицируют ID элементов.

#### `idAttribute`

Указывает, какой атрибут SVG использовать как ключ привязки. Полезно, когда в SVG есть специальный атрибут `data-svgic-id`, добавленный командой:

```xml
<g id="shop-034_2" data-svgic-id="shop-034" />
```

```ts
new Svgic('#container', {
  idAttribute: 'data-svgic-id',
})
```

Если указанный атрибут отсутствует на элементе — используется `id` как fallback.

#### `idMatch`

Управляет тем, как значения атрибутов SVG сравниваются с `id` элементов данных.

| Значение | Поведение |
|----------|-----------|
| `'exact'` (по умолчанию) | Точное равенство |
| `'suffix'` | Отрезает числовые суффиксы, добавленные редактором (`_2`, `_1_`), перед сравнением. Выводит `console.warn` со списком авто-сопоставленных элементов |
| `(svgId: string) => string` | Функция нормализации, применяемая к значениям атрибутов SVG |

**Режим `'suffix'`** полезен, когда SVG редактировался в Inkscape или Illustrator — эти редакторы автоматически переименовывают дублирующиеся ID, добавляя суффикс `_2`, `_3` и т.д. Точное совпадение всегда проверяется первым; суффиксное сопоставление используется только как fallback.

```ts
new Svgic('#container', {
  idMatch: 'suffix',
})
// [svgic] 2 element(s) matched by suffix stripping:
//   "shop-034_2" → "shop-034"
//   "shop-035_1" → "shop-035"
```

**Произвольная функция:**

```ts
new Svgic('#container', {
  idMatch: (svgId) => svgId.toLowerCase(),
})
```

`idAttribute` и `idMatch` независимы и могут комбинироваться:

```ts
new Svgic('#container', {
  idAttribute: 'data-svgic-id',  // какой атрибут читать
  idMatch: 'suffix',             // как сравнивать
})
```

### SvgicLayer

```ts
interface SvgicLayer {
  role: 'interactive' | 'data' | string
}
```

Роль слоя задаётся в конфиге (не в SVG-файле). Слои идентифицируются по `id` атрибуту `<g>`-элементов.

- `interactive` — элементы слоя реагируют на hover/click и участвуют в привязке данных
- `data` — слой только для чтения плагинами (например, waypoints, коридоры); игнорируется ядром
- Любая другая строка — произвольная роль для использования плагинами

Слои, **не указанные** в конфиге `layers`, считаются статическими — ядро их полностью игнорирует.

```ts
new Svgic('#container', {
  src: '/map.svg',
  layers: {
    'rooms':     { role: 'interactive' },
    'waypoints': { role: 'data' },
    // background, labels и т.п. — просто не указывать, они рендерятся как статичный SVG
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

### `client.setSrc(src)`

```ts
setSrc(src: string): Promise<void>
```

Заменяет источник SVG. Выгружает текущий SVG, загружает новый, сбрасывает все данные и состояния подсветки. Резолвится когда новый SVG готов.

Подписки через `on()` сохраняются — повторная подписка после `setSrc()` не нужна.

```ts
// Пример переключения этажей
async function switchFloor(floorId: number) {
  await client.setSrc(`/floor-${floorId}.svg`)
  client.setData(await api.getFloor(floorId))
}
```

### `client.setData(data)`

```ts
setData(data: SvgicItem[]): void
```

Обновляет привязанные данные. Вызывать после `await client.ready`.

### `client.on(event, handler)`

```ts
on(event: 'click' | 'hover' | 'leave', handler: (id: string | null, item: SvgicItem | null) => void): this
```

Подписка на события. Возвращает `this` для чейнинга.

`id` равен `null`, когда событие произошло в пустой области интерактивного слоя (нет привязанного элемента). Используйте это для сброса состояния по клику на фон:

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

### `client.getLayer(id)`

```ts
getLayer(id: string): { element: SVGGElement; role: string } | null
```

Возвращает распарсенный слой по его `id`. Используется в плагинах для прямого доступа к SVG-элементам слоя — например, навигационный плагин может вытащить точки из слоя с ролью `'data'`.

Возвращает `null`, если слой не зарегистрирован, не найден в SVG, или клиент ещё не инициализирован (до `ready`) либо уже уничтожен.

```ts
const navPlugin: SvgicPlugin = {
  name: 'nav',
  onInit(client) {
    const layer = client.getLayer('waypoints') // { element: SVGGElement, role: 'data' }
    const points = layer?.element.querySelectorAll('[data-node]')
    // строим граф навигации...
  },
}
```

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
  id: string           // ключ привязки — сопоставляется с атрибутом SVG-элемента (см. idAttribute / idMatch)
  title?: string       // используется в дефолтном попапе
  description?: string
  image?: string
  link?: string
  [key: string]: unknown  // любые кастомные поля
}
```

По умолчанию `id` должен совпадать с атрибутом `id` SVG-элемента (`<g id="room-101">`). Используйте опции `idAttribute` и `idMatch` для изменения стратегии сопоставления.

---

## Style — конфигурация стилей

```ts
interface SvgicStyleConfig {
  default?: SvgicStyleProperties
  hover?: SvgicStyleProperties
  highlightedHover?: SvgicStyleProperties
  states?: Record<string, SvgicStyleProperties>
  stripInlineStyles?: boolean | 'managed' | 'all' | string[]
}
```

| Поле | Описание |
|------|----------|
| `default` | Базовые стили всех интерактивных элементов |
| `hover` | Стили при наведении курсора |
| `highlightedHover` | Стили при наведении на подсвеченный элемент (применяется вместо `hover`) |
| `states` | Именованные состояния для `setHighlight()` |
| `stripInlineStyles` | Удаляет инлайн-объявления `style`, перебивающие этот конфиг. По умолчанию `false` |

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


### stripInlineStyles

Объявления в атрибуте `style` по каскаду стоят выше любого стилшита, поэтому SVG, выгруженный
с `style="fill:…"`, молча перебивает конфиг выше. Опция их удаляет.

| Значение | Поведение |
|----------|-----------|
| `false` (по умолчанию) | Ничего не удаляется; один `console.warn` перечисляет конфликтующие элементы и свойства |
| `true` / `'managed'` | Удаляет только свойства, объявленные в этом конфиге (объединение `default`, `hover`, `highlightedHover`, `states`) |
| `'all'` | Удаляет атрибут `style` целиком |
| `string[]` | Удаляет ровно перечисленные CSS-свойства |

Действует только на окрашиваемые элементы — саму плоскую фигуру либо плоских прямых потомков
обёртки `<g>`. Вложенные `<g>` и неинтерактивные слои не затрагиваются.

```ts
style: {
  default: { fill: '#cfe8ff' },
  hover:   { fill: '#1e88e5' },
  stripInlineStyles: 'managed',
}
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
  onDataChange? (data: SvgicItem[], client: ISvgic): void
  onElementHover? (element: SVGElement, item: SvgicItem | null): void | false
  onElementLeave? (element: SVGElement, item: SvgicItem | null): void | false
  onElementClick? (element: SVGElement, item: SvgicItem | null): void | false
}
```

| Хук | Когда вызывается | `return false` |
|-----|-----------------|----------------|
| `onInit` | После загрузки SVG | — |
| `onDestroy` | При `client.destroy()` | — |
| `onDataChange` | При `setData()`, при инициализации с `options.data`, а также сразу после `onInit` для плагина, зарегистрированного через `use()`, если данные уже загружены | — |
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

### `onDataChange`

Плагины, которые рисуют по данным — подписи, логотипы, бейджи, — должны
перерисовываться, когда данные пришли или изменились. `onDataChange` избавляет
от публичного `rebuild()`, который прикладной код обязан не забыть вызвать
после каждого `setData()`:

```ts
const labelsPlugin: SvgicPlugin = {
  name: 'labels',
  onInit(client) { root = client.getElement() },
  onDataChange(data, client) { render(data, client) },
}
```

Хук не зависит от порядка регистрации: плагин, переданный в `use()` уже после
установки данных, получит их сразу после собственного `onInit`.
После `setSrc()` данные сбрасываются, и хук не вызывается до прихода новых.

---

## ZoomPlugin

Официальный плагин zoom/pan. Поддерживает колесо мыши, перетаскивание, touch (pinch-zoom, pan, двойной тап).

```ts
import { ZoomPlugin } from '@svgic/core/plugins/zoom'
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
import { DebugPlugin } from '@svgic/core/plugins/debug'
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

## ContentPlugin

Размещает текст, изображения и составной контент внутри элементов слоя.

```ts
import { Svgic } from '@svgic/core'
import { ContentPlugin } from '@svgic/core/plugins/content'

const content = ContentPlugin({
  sourceLayer: 'rooms',
  content: [
    { type: 'text', text: ({ item }) => item?.title as string },
    { type: 'text', text: ({ id }) => id, opacity: 0.5 },
  ],
})

const client = new Svgic('#container', {
  src: '/map.svg',
  layers: { rooms: { role: 'interactive' } },
  data: shops,
  plugins: [content],
})
```

Позиции считаются из геометрии каждой фигуры, поэтому правка плана не требует ручной
расстановки подписей. Сгенерированный слой не получает события указателя — hover и click
по-прежнему доходят до фигур под ним, — а каждый кусок контента обрезается по форме
своего элемента.

Плагин перерисовывается сам при каждом `setData()`, вызывать ничего не нужно.

### Опции

| Опция | Тип | По умолчанию | Описание |
|-------|-----|--------------|----------|
| `sourceLayer` | `string` | — | Id слоя, прямые потомки которого получают контент. Обязательна |
| `content` | `ContentCandidate[]` | — | Кандидаты в порядке приоритета. Обязательна |
| `idAttribute` | `string` | `'id'` | SVG-атрибут с id элемента. Повторяет одноимённую опцию ядра |
| `grid` | `number` | `24` | Плотность сетки: клеток вдоль длинной стороны bbox |
| `padding` | `number` | `0.08` | Отступ контента от стен, доля от каждой стороны |
| `fontScale` | `number` | `70` | Делитель высоты viewBox, задающий размер шрифта |
| `clip` | `boolean` | `true` | Обрезать контент по форме элемента |
| `className` | `string` | — | Дополнительный класс на сгенерированном слое |

Кегль выводится из схемы, а не задаётся числом: холсты у схем разные, и фиксированный
размер, читаемый на viewBox 1600x800, исчезает на 17000x7000, тогда как делитель
переносится между схемами без правок.

### Цепочка кандидатов

Кандидаты пробуются по порядку; побеждает первый, который дал контент **и поместился**.
Так контент деградирует по мере того, как места становится меньше:

```ts
content: [
  { type: 'image', href: ({ item }) => item?.logo as string, minHeight: 14 },
  { type: 'text', text: ({ item }) => item?.title as string },
  { type: 'text', text: ({ id }) => id, opacity: 0.5 },
]
```

Кандидат пропускается, если его `when()` вернул `false` или колбэк контента ничего не дал;
и отклоняется, если отрисованный результат не поместился. Элемент, исчерпавший цепочку,
остаётся без контента — полное название пользователь всё равно получит во всплывашке.

Помещаемость намеренно меряется по-разному. Текст тонкий и может лечь вдоль длинной оси
Г-образного помещения, поэтому проверяется по свободному прогону через `spot`; картинке
или карточке нужен настоящий прямоугольник, поэтому они проверяются по `rect`.

### `ContentSlot`

Каждый колбэк получает один и тот же объект:

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | `string` | Id элемента, по которому идёт связывание с данными |
| `item` | `SvgicItem \| null` | Привязанный элемент данных |
| `element` | `SVGGraphicsElement` | Сам исходный элемент |
| `rect` | `{ x, y, width, height }` | Наибольший прямоугольник внутри фигуры, уже с учётом `padding` |
| `spot` | `{ x, y, runX, runY }` | Точка максимального удаления от границ и свободный прогон через неё |
| `fontSize` | `number` | Кегль, выведенный из viewBox |

### `type: 'text'`

| Поле | Тип | По умолчанию | Описание |
|------|-----|--------------|----------|
| `text` | `(slot) => string \| string[] \| null` | — | Текст. Массив рисуется несколькими строками |
| `rotate` | `boolean \| 'auto'` | `'auto'` | Поворот на -90° в фигуре, вытянутой по вертикали |
| `fontSize` | `number` | из `fontScale` | Абсолютный размер в единицах SVG |
| `fontFamily` | `string` | — | |
| `fontWeight` | `string \| number` | — | |
| `lineHeight` | `number` | `1.15` | Межстрочный интервал в долях кегля |
| `fill` | `string` | — | |
| `opacity` | `number` | — | |
| `className` | `string` | — | Дополнительный класс на сгенерированном `<text>` |
| `when` | `(slot) => boolean` | — | Пропускает кандидата, если вернул `false` |

`'auto'` поворачивает только тогда, когда текст не влезает по горизонтали, а фигура
заметно вытянута по вертикали: почти квадратное помещение остаётся в покое, иначе
соседние подписи начнут вертеться от миллиметровой разницы.

Автопереноса нет: передавайте массив строк. Разбить название бренда на строки лучше
умеет тот, кто знает бренд.

### `type: 'image'`

Растровый или SVG-файл по URL — логотип арендатора, иконка, фотография.

| Поле | Тип | По умолчанию | Описание |
|------|-----|--------------|----------|
| `href` | `(slot) => string \| null` | — | URL картинки. Ничего не вернул — кандидат пропускается |
| `ratio` | `(slot) => number \| null` | — | Отношение ширины к высоте, если приложение его уже знает |
| `probe` | `boolean` | `true` | Загрузить картинку, чтобы узнать пропорцию, если `ratio` не задан |
| `minHeight` | `number` | — | Минимальная высота в единицах SVG, при которой картинка ещё считается размещённой |
| `minWidth` | `number` | — | То же для ширины |
| `scale` | `number` | `1` | Доля доступного бокса, которую занимает картинка |
| `opacity` | `number` | — | |
| `className` | `string` | — | Дополнительный класс на сгенерированном `<image>` |
| `when` | `(slot) => boolean` | — | Пропускает кандидата, если вернул `false` |

```ts
{
  type: 'image',
  href: ({ item }) => item?.logo as string,
  ratio: ({ item }) => item?.logoRatio as number,
  minHeight: 14,
}
```

Картинка вписывается в наибольший прямоугольник **её собственной** пропорции, а не в
наибольший по площади: широкий логотип получает широкий бокс, вытянутый — вытянутый,
и каждый центрируется в самом просторном месте, которое его вмещает.

**Пропорция решает, стоит ли вообще рисовать логотип.** Передавайте её из данных, если
можете. Без неё плагин загружает файл, чтобы измерить: при первой отрисовке картинка
занимает весь слот (безопасно — `preserveAspectRatio="xMidYMid meet"` держит её внутри),
а после получения размеров слой перерисовывается с настоящими боксами. Пропорции кэшируются
по URL и общие для всех экземпляров плагина, так что один бренд на трёх этажах грузится
один раз; неудачи тоже кэшируются и не повторяются при каждой пересборке.

Именно `minHeight` заставляет работать подмену логотипа названием: картинка высотой в две
единицы — уже не логотип, и элементу полезнее следующий кандидат, обычно название,
повёрнутое, если иначе не влезает.

Внешний SVG, вставленный через `<image>`, рендерится в изолированном контексте: его нельзя
перекрасить из схемы, и скрипты внутри него не выполняются — что заодно делает этот способ
безопасным для файлов, загруженных третьими лицами.

### `type: 'custom'`

Всё, что прикладной код рисует сам, — картинка с подписью, бейдж, карточка. Плагин не
интерпретирует результат: он его меряет, вписывает в `rect` и обрезает.

| Поле | Тип | По умолчанию | Описание |
|------|-----|--------------|----------|
| `render` | `(slot) => SVGElement \| null` | — | Возвращает элемент для размещения или `null`, чтобы пропустить |
| `fit` | `'scale' \| 'reject' \| 'none'` | `'scale'` | Что делать, если результат не влез в `rect` |
| `minScale` | `number` | `0.5` | Нижняя граница для `fit: 'scale'`; ниже неё элемент уходит следующему кандидату |
| `when` | `(slot) => boolean` | — | Пропускает кандидата, если вернул `false` |

```ts
{
  type: 'custom',
  minScale: 0.45,
  render: ({ item, rect, fontSize }) => {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g')
    // ...собираем карточку внутри rect...
    return group
  },
}
```

### Геометрические хелперы

Примитивы размещения экспортируются отдельно — для контента, который плагин не покрывает:

```ts
import { sampleShape, findSpot, findRect } from '@svgic/core/plugins/content'

const mask = sampleShape(element, 24)          // растеризовать фигуру
const spot = mask && findSpot(mask)            // точка максимального удаления от границ
const rect = mask && findRect(mask, 16 / 9)    // наибольший вписанный прямоугольник, при желании — по пропорции
```

`sampleShape` возвращает `null` там, где окружение не сообщает геометрию (jsdom, SSR);
сам плагин в этом случае откатывается к bbox, то есть деградирует, а не падает.

### Ограничения

- **Точность сетки.** Точка размещения — центр клетки, поэтому она может отстоять от
  идеальной на полклетки. Увеличивайте `grid` ради точности ценой скорости.
- **Собственные трансформации фигур.** `<g>`-обёртка опрашивается через свои
  геометрические потомки; потомки с собственным `transform` не учитываются.
- **Нет разрешения коллизий.** Подписи соседних фигур размещаются независимо и на плотном
  плане могут визуально мешать друг другу.
- **Зум.** Контент размещается один раз, в единицах схемы, и масштабируется вместе с ней.
  Переключения уровней детализации пока нет.

---

## Vue-адаптер

```ts
import { SvgicVue } from '@svgic/core/vue'
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
| `@click` | `(id: string \| null, item: SvgicItem \| null)` |
| `@hover` | `(id: string \| null, item: SvgicItem \| null)` |
| `@leave` | `(id: string \| null, item: SvgicItem \| null)` |

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
import { SvgicVue } from '@svgic/core/vue'
import type { SvgicItem } from '@svgic/core'

const rooms = ref<SvgicItem[]>([...])

function onRoomClick(id: string | null, item: SvgicItem | null) {
  console.log('clicked', id, item)
}
</script>
```

### useSvgic (composable)

```ts
import { useSvgic } from '@svgic/core/vue'

const { client, containerRef } = useSvgic(options)
```

Возвращает `containerRef` (привязать к DOM-элементу) и `client` (экземпляр `Svgic` после инициализации).

---

## React-адаптер

```ts
import { SvgicReact } from '@svgic/core/react'
```

### Props

Аналогичны Vue-адаптеру: `src`, `data`, `layers`, `plugins`, `popup`, `style`, плюс коллбэки событий:

| Prop | Тип | Описание |
|------|-----|----------|
| `onClick` | `(id: string \| null, item: SvgicItem \| null) => void` | Клик по элементу |
| `onHover` | `(id: string \| null, item: SvgicItem \| null) => void` | Наведение |
| `onLeave` | `(id: string \| null, item: SvgicItem \| null) => void` | Уход курсора |

```tsx
import { SvgicReact } from '@svgic/core/react'

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
import { useSvgic } from '@svgic/core/react'

const { client, containerRef } = useSvgic(options)
```
