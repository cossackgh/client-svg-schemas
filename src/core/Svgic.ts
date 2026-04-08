import type { SvgicOptions, SvgicPlugin, SvgicItem, ISvgic, SvgicEventType, SvgicEventHandler } from '../types'
import { loadSvg } from './loader'
import { parseLayers, type ParsedLayer } from './layerParser'
import { mapData, type BoundElement } from './dataMapper'
import { EventManager } from './eventManager'
import { PopupManager } from '../ui/PopupManager'
import { StyleManager } from '../ui/StyleManager'

/**
 * Интерактивный SVG-клиент.
 *
 * Встраивает SVG в DOM, привязывает слои к данным, обрабатывает события
 * (hover, click) и позволяет расширять поведение через плагины.
 *
 * @example
 * ```ts
 * import { Svgic } from 'svgic'
 *
 * const client = new Svgic('#container', {
 *   src: '/map.svg',
 *   layers: {
 *     rooms:      { role: 'interactive' },
 *     background: { role: 'decorative' },
 *   },
 *   data: [
 *     { id: 'room-101', title: 'Переговорная' },
 *   ],
 *   popup: true,
 * })
 *
 * await client.ready
 * client.on('click', (id, item) => console.log(id, item))
 * ```
 */
export class Svgic implements ISvgic {
  /** Promise, который резолвится после загрузки и инициализации SVG */
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
   * @param selector - CSS-селектор или DOM-элемент контейнера
   * @param options - Конфигурация клиента
   * @throws {Error} Если контейнер не найден
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
   * Подключает плагин. Можно вызывать до или после инициализации.
   * Если SVG уже загружен — `onInit` вызывается немедленно.
   * Возвращает `this` для чейнинга.
   */
  use(plugin: SvgicPlugin): this {
    this.plugins.push(plugin)
    // Если SVG уже загружен — сразу вызываем onInit для позднего плагина
    if (this.svgEl) {
      plugin.onInit?.(this)
    }
    return this
  }

  /**
   * Обновляет привязанные данные. Вызывать после `await client.ready`.
   * @param data - Массив элементов данных. `id` каждого должен совпадать с атрибутом `id` в SVG.
   */
  setData(data: SvgicItem[]): void {
    if (!this.svgEl) {
      console.warn('[svgic] setData() called before SVG is ready — call after awaiting client.ready')
      return
    }
    this.boundElements = mapData(this.svgEl, data)
  }

  /**
   * Устанавливает именованное состояние подсветки для указанных элементов.
   * Стиль состояния задаётся в `style.states[state]`.
   * Несколько состояний могут быть активны одновременно.
   * @param state - Имя состояния (ключ из `style.states`)
   * @param ids - Массив `id` элементов
   */
  setHighlight(state: string, ids: string[]): void {
    this.styleManager?.setHighlight(state, ids)
  }

  /**
   * Снимает подсветку.
   * @param state - Имя состояния. Если не указан — сбрасывает все активные состояния.
   */
  clearHighlight(state?: string): void {
    this.styleManager?.clearHighlight(state)
  }

  /**
   * Подписывается на событие. Возвращает `this` для чейнинга.
   * @param event - `'click'` | `'hover'` | `'leave'`
   * @param handler - Коллбэк с `id` элемента и его данными (`null` если данных нет)
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

  /** Возвращает корневой `<svg>` элемент после загрузки, иначе `null` */
  getElement(): SVGSVGElement | null {
    return this.svgEl
  }

  /** Удаляет SVG из DOM, отписывает все обработчики, вызывает `onDestroy` у плагинов */
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
