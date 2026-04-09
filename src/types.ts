/** Data element — bound to an SVG element by id */
export interface SvgicItem {
  /** Matches the `id` attribute of the SVG element (`<g id="room-101">`) */
  id: string
  /** Title — used in the default popup */
  title?: string
  description?: string
  image?: string
  link?: string
  /** Any custom fields */
  [key: string]: unknown
}

/**
 * Layer role in the SVG file.
 * - `interactive` — elements respond to hover/click and participate in data binding
 * - `data` — read-only layer for plugins (e.g. waypoints, corridors); ignored by the core
 * - Any other string — custom role for plugin use
 *
 * Layers not listed in config are treated as static and are completely invisible to the core.
 */
export type SvgicLayerRole = 'interactive' | 'data' | (string & {})

export interface SvgicLayer {
  role: SvgicLayerRole
}

export type SvgicEventType = 'click' | 'hover' | 'leave'
export type SvgicEventHandler = (id: string, item: SvgicItem | null) => void

/**
 * Public client interface — used in plugins to avoid circular imports.
 * Full implementation — the `Svgic` class.
 */
export interface ISvgic {
  /** Promise that resolves after SVG is loaded and initialized */
  readonly ready: Promise<void>
  /**
   * Registers a plugin. Can be called before or after initialization.
   * If SVG is already loaded — `onInit` is called immediately.
   */
  use(plugin: SvgicPlugin): ISvgic
  /**
   * Subscribes to an event. Returns `this` for chaining.
   * @param event - `'click'` | `'hover'` | `'leave'`
   * @param handler - Callback with the element `id` and its data (`null` if no data)
   */
  on(event: SvgicEventType, handler: SvgicEventHandler): ISvgic
  /**
   * Replaces the SVG source. Unloads the current SVG, loads the new one,
   * clears all data and highlight states. Resolves when the new SVG is ready.
   * @param src - URL or raw SVG string
   */
  setSrc(src: string): Promise<void>
  /**
   * Updates bound data. Call after `await client.ready`.
   * @param data - Array of data elements. Each `id` must match the `id` attribute in SVG.
   */
  setData(data: SvgicItem[]): void
  /**
   * Sets a named highlight state for the specified elements.
   * The state style is defined in `style.states[state]`.
   * Multiple states can be active simultaneously.
   * @param state - State name (key from `style.states`)
   * @param ids - Array of element `id`s
   */
  setHighlight(state: string, ids: string[]): void
  /**
   * Removes highlight.
   * @param state - State name. If not provided — clears all active states.
   */
  clearHighlight(state?: string): void
  /** Returns the root `<svg>` element after loading, otherwise `null` */
  getElement(): SVGSVGElement | null
  /**
   * Returns a parsed layer by its id.
   * Useful for plugins that need direct access to SVG layer elements
   * (e.g. a navigation plugin reading waypoints from a `'data'` layer).
   * Returns `null` if the layer is not found or SVG is not yet loaded.
   * @param id - The `id` attribute of the `<g>` element in the SVG file
   */
  getLayer(id: string): { element: SVGGElement; role: SvgicLayerRole } | null
  /** Removes SVG from DOM, unsubscribes all handlers, calls `onDestroy` on plugins */
  destroy(): void
}

/** Plugin hooks */
export interface SvgicPlugin {
  /** Unique plugin name */
  name: string
  /** Called after SVG is loaded and initialized */
  onInit?: (client: ISvgic) => void
  /** Called on `client.destroy()` */
  onDestroy?: (client: ISvgic) => void
  /** Called on cursor hover. `return false` — cancels default behavior */
  onElementHover?: (element: SVGElement, item: SvgicItem | null) => void | false
  /** Called when cursor leaves the element. `return false` — cancels default behavior */
  onElementLeave?: (element: SVGElement, item: SvgicItem | null) => void | false
  /** Called on element click. `return false` — cancels default behavior */
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

/** Popup anchored to an SVG element */
export interface PopupPlacementElement {
  placement: 'element'
  /** Positioning anchor. Default: `'top-center'` */
  anchor?: PopupAnchor
  /** Offset from anchor in pixels. Default: `{ x: 0, y: -8 }` */
  offset?: PopupOffset
  /** Auto-flip if popup overflows the viewport edge. Default: `true` */
  flip?: boolean
}

/** Popup follows the cursor */
export interface PopupPlacementCursor {
  placement: 'cursor'
  /** Offset from cursor in pixels. Default: `{ x: 16, y: 16 }` */
  offset?: PopupOffset
}

/** Popup renders into a specified DOM node outside the SVG */
export interface PopupPlacementTarget {
  placement: 'target'
  /** CSS selector or container DOM element */
  target: string | HTMLElement
  /** Default: `'hover'` */
  trigger?: PopupTrigger
}

export type PopupPlacement =
  | PopupPlacementElement
  | PopupPlacementCursor
  | PopupPlacementTarget

/**
 * Popup configuration:
 * - `true` — default popup with `title`, placement `element`, anchor `top-center`
 * - `false` | `undefined` — popup disabled
 * - Object — custom configuration
 */
export type PopupOption = boolean | (PopupPlacement & {
  /** Custom popup content renderer. Receives `SvgicItem`, returns `HTMLElement` or HTML string */
  render?: (item: SvgicItem) => HTMLElement | string
  /** HTML template (`<template>` element or its CSS selector). Used together with `bind` */
  template?: string | HTMLTemplateElement
  /** Bind data to the template clone. `el` — clone of `<template>`, `item` — element data */
  bind?: (el: HTMLElement, item: SvgicItem) => void
  /** Popup open trigger. Default: `'hover'` */
  trigger?: PopupTrigger
  /**
   * Popup stays open while cursor is on it.
   * Use for popups with links or buttons inside.
   * When enabled, automatically sets `hideDelay: 120` if not specified.
   * Works with `placement: 'element'`.
   */
  interactive?: boolean
  /** Delay in ms before hiding the popup after cursor leaves the element */
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
  /** Any additional CSS properties */
  [key: string]: unknown
}

export interface SvgicStyleConfig {
  /** Base styles for all interactive elements */
  default?: SvgicStyleProperties
  /** Styles on cursor hover */
  hover?: SvgicStyleProperties
  /**
   * Styles when hovering over a highlighted element.
   * Applied instead of `hover` if the element already has an active state from `states`.
   */
  highlightedHover?: SvgicStyleProperties
  /** Named states for `setHighlight()` */
  states?: Record<string, SvgicStyleProperties>
}

/** Initialization options */
export interface SvgicOptions {
  /** SVG file URL or SVG string (`<svg>...</svg>`) */
  src: string
  /** Data array bound to elements by matching `id` */
  data?: SvgicItem[]
  /**
   * SVG layer configuration. Key — the `id` attribute value of the `<g>` element in the SVG file.
   * @example
   * ```ts
   * layers: {
   *   rooms:      { role: 'interactive' },
   *   background: { role: 'data' },
   * }
   * ```
   */
  layers?: Record<string, SvgicLayer>
  /** Plugin list */
  plugins?: SvgicPlugin[]
  /** Popup configuration */
  popup?: PopupOption
  /** Interactive element style configuration */
  style?: SvgicStyleConfig
}
