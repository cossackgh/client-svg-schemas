import type { SvgicOptions, SvgicPlugin, SvgicItem, ISvgic, SvgicEventType, SvgicEventHandler } from '../types'
import { loadSvg } from './loader'
import { parseLayers, type ParsedLayer } from './layerParser'
import { mapData, type BoundElement } from './dataMapper'
import { EventManager } from './eventManager'
import { PopupManager } from '../ui/PopupManager'
import { StyleManager } from '../ui/StyleManager'

export class Svgic implements ISvgic {
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

    this.ready = this.init()
  }

  use(plugin: SvgicPlugin): this {
    this.plugins.push(plugin)
    // Если SVG уже загружен — сразу вызываем onInit для позднего плагина
    if (this.svgEl) {
      plugin.onInit?.(this)
    }
    return this
  }

  setData(data: SvgicItem[]): void {
    if (!this.svgEl) return
    this.boundElements = mapData(this.svgEl, data)
  }

  setHighlight(state: string, ids: string[]): void {
    this.styleManager?.setHighlight(state, ids)
  }

  clearHighlight(state?: string): void {
    this.styleManager?.clearHighlight(state)
  }

  on(event: SvgicEventType, handler: SvgicEventHandler): this {
    this.eventManager.on(event, handler)
    return this
  }

  getElement(): SVGSVGElement | null {
    return this.svgEl
  }

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
      this.boundElements = mapData(this.svgEl, this.options.data)
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
