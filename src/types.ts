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
export type SvgicLayerRole = 'interactive' | 'decorative' | 'labels'

export interface SvgicLayer {
  role: SvgicLayerRole
}

// Публичный интерфейс клиента — используется в плагинах, чтобы избежать кругового импорта
export interface ISvgic {
  readonly ready: Promise<void>
  use(plugin: SvgicPlugin): ISvgic
  setData(data: SvgicItem[]): void
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

// Опции инициализации
export interface SvgicOptions {
  src: string                              // URL или SVG-строка
  data?: SvgicItem[]
  layers?: Record<string, SvgicLayer>
  plugins?: SvgicPlugin[]
}
