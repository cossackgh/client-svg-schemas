import type { SvgicItem, SvgicPlugin } from '../types'
import type { ParsedLayer } from './layerParser'
import type { BoundElement } from './dataMapper'

export type SvgicEventType = 'click' | 'hover' | 'leave'
export type SvgicEventHandler = (id: string, item: SvgicItem | null) => void

interface AttachedListener {
  el: Element
  type: string
  fn: EventListener
}

export class EventManager {
  private handlers: Record<SvgicEventType, SvgicEventHandler[]> = {
    click: [],
    hover: [],
    leave: [],
  }
  private currentHoveredId: string | null = null
  private attached: AttachedListener[] = []
  private popupShow: ((el: SVGElement, item: SvgicItem, event: MouseEvent) => void) | null = null
  private popupHide: (() => void) | null = null

  constructor(
    private readonly getLayers: () => Map<string, ParsedLayer>,
    private readonly getBoundElements: () => Map<string, BoundElement>,
    private readonly getPlugins: () => SvgicPlugin[],
  ) {}

  on(event: SvgicEventType, handler: SvgicEventHandler): void {
    this.handlers[event].push(handler)
  }

  setPopupCallbacks(
    onShow: (el: SVGElement, item: SvgicItem, event: MouseEvent) => void,
    onHide: () => void,
  ): void {
    this.popupShow = onShow
    this.popupHide = onHide
  }

  attach(): void {
    for (const [, layer] of this.getLayers()) {
      if (layer.role !== 'interactive') continue

      const el = layer.element
      const clickFn = (e: Event) => this.handleClick(e, el)
      const overFn = (e: Event) => this.handleMouseOver(e, el)
      const outFn = (e: Event) => this.handleMouseOut(e, el)

      el.addEventListener('click', clickFn)
      el.addEventListener('mouseover', overFn)
      el.addEventListener('mouseout', outFn)

      this.attached.push(
        { el, type: 'click', fn: clickFn },
        { el, type: 'mouseover', fn: overFn },
        { el, type: 'mouseout', fn: outFn },
      )
    }
  }

  destroy(): void {
    for (const { el, type, fn } of this.attached) {
      el.removeEventListener(type, fn)
    }
    this.attached = []
    this.currentHoveredId = null
  }

  // --- private ---

  private handleClick(e: Event, layerEl: SVGGElement): void {
    const id = this.findBoundId(e.target, layerEl)

    if (id === null) {
      this.emit('click', '', null)
      return
    }

    const bound = this.getBoundElements().get(id)
    const item = bound?.item ?? null
    const element = bound?.element ?? (e.target as SVGElement)

    const cancelled = this.getPlugins().some(
      p => p.onElementClick?.(element, item) === false,
    )
    if (!cancelled) {
      this.emit('click', id, item)
    }
  }

  private handleMouseOver(e: Event, layerEl: SVGGElement): void {
    const id = this.findBoundId(e.target, layerEl)
    if (id === this.currentHoveredId) return

    // leave предыдущий
    if (this.currentHoveredId !== null) {
      this.fireLeave(this.currentHoveredId)
    }

    this.currentHoveredId = id

    if (id === null) return

    const bound = this.getBoundElements().get(id)
    const item = bound?.item ?? null
    const element = bound?.element ?? (e.target as SVGElement)

    const cancelled = this.getPlugins().some(
      p => p.onElementHover?.(element, item) === false,
    )
    if (!cancelled) {
      this.popupShow?.(element, item ?? { id }, e as MouseEvent)
      this.emit('hover', id, item)
    }
  }

  private handleMouseOut(e: Event, layerEl: SVGGElement): void {
    // mouseout стреляет при переходе между дочерними элементами —
    // игнорируем если курсор остаётся внутри того же слоя
    const relatedTarget = (e as MouseEvent).relatedTarget
    if (relatedTarget instanceof Node && layerEl.contains(relatedTarget)) return

    if (this.currentHoveredId !== null) {
      this.fireLeave(this.currentHoveredId)
      this.currentHoveredId = null
    }
  }

  private fireLeave(id: string): void {
    const bound = this.getBoundElements().get(id)
    const item = bound?.item ?? null
    const element = bound?.element

    if (element) {
      const cancelled = this.getPlugins().some(
        p => p.onElementLeave?.(element, item) === false,
      )
      if (cancelled) return
    }

    this.popupHide?.()
    this.emit('leave', id, item)
  }

  private emit(event: SvgicEventType, id: string, item: SvgicItem | null): void {
    for (const handler of this.handlers[event]) {
      handler(id, item)
    }
  }

  private findBoundId(target: EventTarget | null, layerEl: SVGGElement): string | null {
    let el = target instanceof Element ? target : null
    while (el && el !== layerEl) {
      if (el.id && this.getBoundElements().has(el.id)) return el.id
      el = el.parentElement
    }
    return null
  }
}
