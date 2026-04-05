// Элемент данных — привязывается к SVG-элементу по id
export interface SvgicItem {
  id: string
  title?: string
  description?: string
  image?: string
  link?: string
  [key: string]: unknown
}

// Роль слоя в SVG-файле
export type SvgicLayerRole = 'interactive' | 'decorative'

export interface SvgicLayer {
  role: SvgicLayerRole
}

export type SvgicEventType = 'click' | 'hover' | 'leave'
export type SvgicEventHandler = (id: string, item: SvgicItem | null) => void

// Публичный интерфейс клиента — используется в плагинах, чтобы избежать кругового импорта
export interface ISvgic {
  readonly ready: Promise<void>
  use(plugin: SvgicPlugin): ISvgic
  on(event: SvgicEventType, handler: SvgicEventHandler): ISvgic
  setData(data: SvgicItem[]): void
  setHighlight(state: string, ids: string[]): void
  clearHighlight(state?: string): void
  destroy(): void
}

// Хуки плагина
export interface SvgicPlugin {
  name: string
  onInit?: (client: ISvgic) => void
  onDestroy?: (client: ISvgic) => void
  onElementHover?: (element: SVGElement, item: SvgicItem | null) => void | false
  onElementLeave?: (element: SVGElement, item: SvgicItem | null) => void | false
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

// Привязка к элементу SVG
export interface PopupPlacementElement {
  placement: 'element'
  anchor?: PopupAnchor       // default: 'top-center'
  offset?: PopupOffset       // default: { x: 0, y: -8 }
  flip?: boolean             // авто-переворот если уходит за край viewport, default: true
}

// Следует за курсором
export interface PopupPlacementCursor {
  placement: 'cursor'
  offset?: PopupOffset       // default: { x: 16, y: 16 }
}

// Рендер в указанный DOM-узел
export interface PopupPlacementTarget {
  placement: 'target'
  target: string | HTMLElement   // CSS-селектор или элемент
  trigger?: PopupTrigger         // default: 'hover'
}

export type PopupPlacement =
  | PopupPlacementElement
  | PopupPlacementCursor
  | PopupPlacementTarget

export interface PopupConfig extends PopupPlacementElement {
  // По умолчанию placement: 'element' — поэтому PopupConfig расширяет его.
  // Пользователь может передать любой из трёх вариантов.
  render?: (item: SvgicItem) => HTMLElement | string
  template?: string | HTMLTemplateElement
  bind?: (el: HTMLElement, item: SvgicItem) => void
  trigger?: PopupTrigger   // default: 'hover'
}

// popup: true — дефолтный попап с title, placement: 'element', anchor: 'top-center'
// popup: false | undefined — попап отключён
// popup: PopupPlacement & { render? | template+bind? } — кастомная конфигурация
export type PopupOption = boolean | (PopupPlacement & {
  render?: (item: SvgicItem) => HTMLElement | string
  template?: string | HTMLTemplateElement
  bind?: (el: HTMLElement, item: SvgicItem) => void
  trigger?: PopupTrigger
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
  [key: string]: unknown
}

export interface SvgicStyleConfig {
  default?: SvgicStyleProperties
  hover?: SvgicStyleProperties
  // hover поверх highlighted-элемента — применяется вместо hover
  highlightedHover?: SvgicStyleProperties
  // именованные состояния для setHighlight()
  states?: Record<string, SvgicStyleProperties>
}

// Опции инициализации
export interface SvgicOptions {
  src: string                              // URL или SVG-строка
  data?: SvgicItem[]
  layers?: Record<string, SvgicLayer>
  plugins?: SvgicPlugin[]
  popup?: PopupOption
  style?: SvgicStyleConfig
}
