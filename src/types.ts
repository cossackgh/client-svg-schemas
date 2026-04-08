/** Элемент данных — привязывается к SVG-элементу по id */
export interface SvgicItem {
  /** Совпадает с `id` атрибутом SVG-элемента (`<g id="room-101">`) */
  id: string
  /** Заголовок — используется в дефолтном попапе */
  title?: string
  description?: string
  image?: string
  link?: string
  /** Любые кастомные поля */
  [key: string]: unknown
}

/** Роль слоя в SVG-файле */
export type SvgicLayerRole = 'interactive' | 'decorative'

export interface SvgicLayer {
  /**
   * Роль слоя:
   * - `interactive` — элементы реагируют на hover/click и участвуют в привязке данных
   * - `decorative` — слой игнорируется при обработке событий
   */
  role: SvgicLayerRole
}

export type SvgicEventType = 'click' | 'hover' | 'leave'
export type SvgicEventHandler = (id: string, item: SvgicItem | null) => void

/**
 * Публичный интерфейс клиента — используется в плагинах, чтобы избежать кругового импорта.
 * Полная реализация — класс `Svgic`.
 */
export interface ISvgic {
  /** Promise, который резолвится после загрузки и инициализации SVG */
  readonly ready: Promise<void>
  /**
   * Подключает плагин. Можно вызывать до или после инициализации.
   * Если SVG уже загружен — `onInit` вызывается немедленно.
   */
  use(plugin: SvgicPlugin): ISvgic
  /**
   * Подписывается на событие. Возвращает `this` для чейнинга.
   * @param event - `'click'` | `'hover'` | `'leave'`
   * @param handler - Коллбэк с `id` элемента и его данными (`null` если данных нет)
   */
  on(event: SvgicEventType, handler: SvgicEventHandler): ISvgic
  /**
   * Обновляет привязанные данные. Вызывать после `await client.ready`.
   * @param data - Массив элементов данных. `id` каждого должен совпадать с атрибутом `id` в SVG.
   */
  setData(data: SvgicItem[]): void
  /**
   * Устанавливает именованное состояние подсветки для указанных элементов.
   * Стиль состояния задаётся в `style.states[state]`.
   * Несколько состояний могут быть активны одновременно.
   * @param state - Имя состояния (ключ из `style.states`)
   * @param ids - Массив `id` элементов
   */
  setHighlight(state: string, ids: string[]): void
  /**
   * Снимает подсветку.
   * @param state - Имя состояния. Если не указан — сбрасывает все активные состояния.
   */
  clearHighlight(state?: string): void
  /** Возвращает корневой `<svg>` элемент после загрузки, иначе `null` */
  getElement(): SVGSVGElement | null
  /** Удаляет SVG из DOM, отписывает все обработчики, вызывает `onDestroy` у плагинов */
  destroy(): void
}

/** Хуки плагина */
export interface SvgicPlugin {
  /** Уникальное имя плагина */
  name: string
  /** Вызывается после загрузки и инициализации SVG */
  onInit?: (client: ISvgic) => void
  /** Вызывается при `client.destroy()` */
  onDestroy?: (client: ISvgic) => void
  /** Вызывается при наведении курсора. `return false` — отменяет дефолтное поведение */
  onElementHover?: (element: SVGElement, item: SvgicItem | null) => void | false
  /** Вызывается когда курсор покидает элемент. `return false` — отменяет дефолтное поведение */
  onElementLeave?: (element: SVGElement, item: SvgicItem | null) => void | false
  /** Вызывается при клике по элементу. `return false` — отменяет дефолтное поведение */
  onElementClick?: (element: SVGElement, item: SvgicItem | null) => void | false
}

// --- Popup ---

export type PopupAnchor =
  | 'center'
  | 'top' | 'top-center' | 'top-left' | 'top-right'
  | 'bottom' | 'bottom-center' | 'bottom-left' | 'bottom-right'
  | 'left' | 'right'

export type PopupTrigger = 'hover' | 'click'

export interface PopupOffset {
  x?: number
  y?: number
}

/** Попап прикреплён к SVG-элементу */
export interface PopupPlacementElement {
  placement: 'element'
  /** Якорь позиционирования. Default: `'top-center'` */
  anchor?: PopupAnchor
  /** Отступ от якоря в пикселях. Default: `{ x: 0, y: -8 }` */
  offset?: PopupOffset
  /** Авто-переворот если попап уходит за край viewport. Default: `true` */
  flip?: boolean
}

/** Попап следует за курсором */
export interface PopupPlacementCursor {
  placement: 'cursor'
  /** Отступ от курсора в пикселях. Default: `{ x: 16, y: 16 }` */
  offset?: PopupOffset
}

/** Попап рендерится в указанный DOM-узел вне SVG */
export interface PopupPlacementTarget {
  placement: 'target'
  /** CSS-селектор или DOM-элемент контейнера */
  target: string | HTMLElement
  /** Default: `'hover'` */
  trigger?: PopupTrigger
}

export type PopupPlacement =
  | PopupPlacementElement
  | PopupPlacementCursor
  | PopupPlacementTarget

/**
 * Конфигурация попапа:
 * - `true` — дефолтный попап с `title`, placement `element`, anchor `top-center`
 * - `false` | `undefined` — попап отключён
 * - Объект — кастомная конфигурация
 */
export type PopupOption = boolean | (PopupPlacement & {
  /** Кастомный рендер содержимого попапа. Принимает `SvgicItem`, возвращает `HTMLElement` или HTML-строку */
  render?: (item: SvgicItem) => HTMLElement | string
  /** HTML-шаблон (`<template>` элемент или его CSS-селектор). Используется совместно с `bind` */
  template?: string | HTMLTemplateElement
  /** Привязка данных к клону шаблона. `el` — клон `<template>`, `item` — данные элемента */
  bind?: (el: HTMLElement, item: SvgicItem) => void
  /** Триггер открытия попапа. Default: `'hover'` */
  trigger?: PopupTrigger
  /**
   * Попап не закрывается пока курсор находится на нём.
   * Используется для попапов со ссылками или кнопками внутри.
   * При включении автоматически устанавливает `hideDelay: 120` если не задан.
   * Работает с `placement: 'element'`.
   */
  interactive?: boolean
  /** Задержка в мс перед скрытием попапа после того как курсор покинул элемент */
  hideDelay?: number
})

// --- Style ---

export interface SvgicStyleProperties {
  fill?: string
  stroke?: string
  strokeWidth?: number | string
  opacity?: number | string
  cursor?: string
  transition?: string
  filter?: string
  /** Любые дополнительные CSS-свойства */
  [key: string]: unknown
}

export interface SvgicStyleConfig {
  /** Базовые стили всех интерактивных элементов */
  default?: SvgicStyleProperties
  /** Стили при наведении курсора */
  hover?: SvgicStyleProperties
  /**
   * Стили при наведении на подсвеченный элемент.
   * Применяется вместо `hover` если элемент уже имеет активное состояние из `states`.
   */
  highlightedHover?: SvgicStyleProperties
  /** Именованные состояния для `setHighlight()` */
  states?: Record<string, SvgicStyleProperties>
}

/** Опции инициализации */
export interface SvgicOptions {
  /** URL SVG-файла или SVG-строка (`<svg>...</svg>`) */
  src: string
  /** Массив данных, привязываемых к элементам по совпадению `id` */
  data?: SvgicItem[]
  /**
   * Конфигурация слоёв SVG. Ключ — значение атрибута `id` элемента `<g>` в SVG-файле.
   * @example
   * ```ts
   * layers: {
   *   rooms:      { role: 'interactive' },
   *   background: { role: 'decorative' },
   * }
   * ```
   */
  layers?: Record<string, SvgicLayer>
  /** Список плагинов */
  plugins?: SvgicPlugin[]
  /** Конфигурация попапа */
  popup?: PopupOption
  /** Конфигурация стилей интерактивных элементов */
  style?: SvgicStyleConfig
}
