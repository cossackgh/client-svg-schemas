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

// Хуки плагина
export interface SvgicPlugin {
  name: string
  onInit?: (client: import('./core/Svgic').Svgic) => void
  onDestroy?: (client: import('./core/Svgic').Svgic) => void
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
