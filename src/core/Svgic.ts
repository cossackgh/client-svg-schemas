import type { SvgicOptions, SvgicPlugin, SvgicItem, ISvgic, SvgicEventType, SvgicEventHandler, SvgicLayerRole } from '../types'
import { loadSvg } from './loader'
import { parseLayers, type ParsedLayer } from './layerParser'
import { mapData, type BoundElement } from './dataMapper'
import { EventManager } from './eventManager'
import { PopupManager } from '../ui/PopupManager'
import { StyleManager } from '../ui/StyleManager'

/**
 * Interactive SVG client.
 *
 * Embeds SVG into the DOM, binds layers to data, handles events
 * (hover, click), and allows extending behavior via plugins.
 *
 * @example
 * ```ts
 * import { Svgic } from 'svgic'
 *
 * const client = new Svgic('#container', {
 *   src: '/map.svg',
 *   layers: {
 *     rooms: { role: 'interactive' },
 *   },
 *   data: [
 *     { id: 'room-101', title: 'Conference Room' },
 *   ],
 *   popup: true,
 * })
 *
 * await client.ready
 * client.on('click', (id, item) => console.log(id, item))
 * ```
 */
export class Svgic implements ISvgic {
  /** Promise that resolves after SVG is loaded and initialized */
  readonly ready: Promise<void>

  private container: Element
  private options: SvgicOptions
  private plugins: SvgicPlugin[] = []
  private svgEl: SVGSVGElement | null = null
  private layers: Map<string, ParsedLayer> = new Map()
  private boundElements: Map<string, BoundElement> = new Map()
  private eventManager: EventManager
  private popupManager: PopupManager | null = null
  private styleManager: StyleManager | null = null

  /**
   * @param selector - CSS selector or container DOM element
   * @param options - Client configuration
   * @throws {Error} If the container is not found
   */
  constructor(selector: string | Element, options: SvgicOptions) {
    const container = typeof selector === 'string'
      ? document.querySelector(selector)
      : selector

    if (!container) {
      throw new Error(`[svgic] Container not found: ${selector}`)
    }

    this.container = container
    this.options = options

    this.eventManager = new EventManager(
      () => this.layers,
      () => this.boundElements,
      () => this.plugins,
    )

    if (options.plugins) {
      options.plugins.forEach(p => this.use(p))
    }

    this.ready = this.init().catch(err => {
      console.error('[svgic] Initialization failed:', err)
      throw err
    })
  }

  /**
   * Registers a plugin. Can be called before or after initialization.
   * If SVG is already loaded — `onInit` is called immediately.
   * Returns `this` for chaining.
   */
  use(plugin: SvgicPlugin): this {
    this.plugins.push(plugin)
    // If SVG is already loaded — call onInit immediately for late-registered plugins
    if (this.svgEl) {
      plugin.onInit?.(this)
    }
    return this
  }

  /**
   * Updates bound data. Call after `await client.ready`.
   * @param data - Array of data elements. Each `id` must match the `id` attribute in SVG.
   */
  setData(data: SvgicItem[]): void {
    if (!this.svgEl) {
      console.warn('[svgic] setData() called before SVG is ready — call after awaiting client.ready')
      return
    }
    this.boundElements = mapData(this.layers, data)
  }

  /**
   * Sets a named highlight state for the specified elements.
   * The state style is defined in `style.states[state]`.
   * Multiple states can be active simultaneously.
   * @param state - State name (key from `style.states`)
   * @param ids - Array of element `id`s
   */
  setHighlight(state: string, ids: string[]): void {
    this.styleManager?.setHighlight(state, ids)
  }

  /**
   * Removes highlight.
   * @param state - State name. If not provided — clears all active states.
   */
  clearHighlight(state?: string): void {
    this.styleManager?.clearHighlight(state)
  }

  /**
   * Subscribes to an event. Returns `this` for chaining.
   * @param event - `'click'` | `'hover'` | `'leave'`
   * @param handler - Callback with the element `id` and its data (`null` if no data)
   *
   * @example
   * ```ts
   * client
   *   .on('click', (id, item) => console.log('clicked', id, item))
   *   .on('hover', (id, item) => console.log('hovered', id))
   * ```
   */
  on(event: SvgicEventType, handler: SvgicEventHandler): this {
    this.eventManager.on(event, handler)
    return this
  }

  /** Returns the root `<svg>` element after loading, otherwise `null` */
  getElement(): SVGSVGElement | null {
    return this.svgEl
  }

  /**
   * Returns a parsed layer by its id.
   * Useful for plugins that need direct access to SVG layer elements
   * (e.g. a navigation plugin reading waypoints from a `'data'` layer).
   * Returns `null` if the layer is not found or SVG is not yet loaded.
   * @param id - The `id` attribute of the `<g>` element in the SVG file
   */
  getLayer(id: string): { element: SVGGElement; role: SvgicLayerRole } | null {
    if (!this.svgEl) return null
    return this.layers.get(id) ?? null
  }

  /** Removes SVG from DOM, unsubscribes all handlers, calls `onDestroy` on plugins */
  destroy(): void {
    this.eventManager.destroy()
    this.popupManager?.destroy()
    this.popupManager = null
    this.styleManager?.destroy()
    this.styleManager = null
    this.svgEl?.remove()
    this.svgEl = null
    this.plugins.forEach(p => p.onDestroy?.(this))
    this.plugins = []
  }

  private async init(): Promise<void> {
    this.svgEl = await loadSvg(this.options.src)
    this.container.appendChild(this.svgEl)
    this.layers = parseLayers(this.svgEl, this.options.layers)
    if (this.options.data) {
      this.boundElements = mapData(this.layers, this.options.data)
    }
    this.eventManager.attach()

    if (this.options.popup) {
      this.popupManager = new PopupManager(this.options.popup)
      const trigger = this.options.popup !== true
        ? (this.options.popup as { trigger?: 'hover' | 'click' }).trigger ?? 'hover'
        : 'hover'
      this.eventManager.setPopupCallbacks(
        (el, item, event) => this.popupManager!.show(el, item, event),
        () => this.popupManager!.hide(),
        trigger,
      )
    }

    if (this.options.style) {
      this.styleManager = new StyleManager(
        this.options.style,
        () => this.layers,
        () => this.boundElements,
      )
      this.styleManager.init()
      this.eventManager.setStyleCallbacks(
        id => this.styleManager!.applyHover(id),
        () => this.styleManager!.removeHover(),
      )
    }

    this.plugins.forEach(p => p.onInit?.(this))
  }
}
