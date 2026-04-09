export interface ZoomPluginOptions {
  /** Minimum scale. Default: 0.5 */
  minScale?: number
  /** Maximum scale. Default: 10 */
  maxScale?: number
  /**
   * Mouse wheel zoom mode.
   * - 'always'  — always (for fullscreen maps)
   * - 'ctrl'    — only when Ctrl is held (for scrollable pages)
   * Default: 'ctrl'
   */
  wheelMode?: 'always' | 'ctrl'
  /** Allow pan by mouse drag. Default: true */
  pan?: boolean
  /** Allow touch gestures (pinch-zoom, pan, double tap). Default: true */
  touch?: boolean
  /** Scale on double tap/click. Default: 2 */
  doubleTapScale?: number
  /** Restrict pan to SVG bounds. Default: true */
  panBounds?: boolean
  /** Animate programmatic transitions. Default: true */
  animate?: boolean
  /** Animation duration in ms. Default: 300 */
  animationDuration?: number
  /**
   * Auto-focus element on click.
   * Focus scale — focusScale (only if current scale < focusScale).
   * Default: false
   */
  focusOnClick?: boolean
  /** Scale when auto-focusing on an element. Default: 2 */
  focusScale?: number
}

export interface ZoomState {
  /** Current scale (1 = original) */
  scale: number
  /** ViewBox offset along X in SVG coordinates */
  x: number
  /** ViewBox offset along Y in SVG coordinates */
  y: number
}
