export interface ZoomPluginOptions {
  /** Минимальный масштаб. Default: 0.5 */
  minScale?: number
  /** Максимальный масштаб. Default: 10 */
  maxScale?: number
  /**
   * Режим зума колесом мыши.
   * - 'always'  — всегда (для fullscreen-карт)
   * - 'ctrl'    — только при зажатом Ctrl (для страниц со скроллом)
   * Default: 'ctrl'
   */
  wheelMode?: 'always' | 'ctrl'
  /** Разрешить pan перетаскиванием мыши. Default: true */
  pan?: boolean
  /** Разрешить touch-жесты (pinch-zoom, pan, двойной тап). Default: true */
  touch?: boolean
  /** Масштаб при двойном тапе/клике. Default: 2 */
  doubleTapScale?: number
  /** Ограничить pan границами SVG. Default: true */
  panBounds?: boolean
  /** Анимировать программные переходы. Default: true */
  animate?: boolean
  /** Длительность анимации в мс. Default: 300 */
  animationDuration?: number
  /**
   * Автофокус на элемент при клике.
   * Масштаб при фокусе — focusScale (если текущий scale < focusScale).
   * Default: false
   */
  focusOnClick?: boolean
  /** Масштаб при авто-фокусе на элемент. Default: 2 */
  focusScale?: number
}

export interface ZoomState {
  /** Текущий масштаб (1 = исходный) */
  scale: number
  /** Смещение viewBox по X в SVG-координатах */
  x: number
  /** Смещение viewBox по Y в SVG-координатах */
  y: number
}
