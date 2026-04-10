import type { SvgicItem, PopupOption, PopupPlacementCursor, PopupPlacementElement, PopupPlacementTarget } from '../types'
import { renderDefaultPopup, DEFAULT_POPUP_STYLES } from './DefaultPopup'
import { getElementPosition } from './placement/ElementPlacement'
import { getCursorPosition } from './placement/CursorPlacement'

const DEFAULT_INTERACTIVE_DELAY = 120

/**
 * Manages the lifecycle of popups: rendering, positioning, and cleanup.
 * Supports element-anchored, cursor-following, target, and interactive placement modes.
 */
export class PopupManager {
  private popupEl: HTMLElement | null = null
  private styleEl: HTMLStyleElement | null = null
  private config: Exclude<PopupOption, boolean>
  private currentTarget: SVGElement | null = null
  private onMouseMove: ((e: MouseEvent) => void) | null = null
  private onViewChange: (() => void) | null = null
  private hideTimer: ReturnType<typeof setTimeout> | null = null

  constructor(option: PopupOption) {
    this.config = option === true
      ? { placement: 'element', anchor: 'top-center', flip: true }
      : option as Exclude<PopupOption, boolean>
  }

  /**
   * Shows the popup for the given element and item.
   * @param targetEl - The SVG element that triggered the popup
   * @param item - Data item associated with the element
   * @param event - Mouse event used for cursor-based positioning
   */
  show(targetEl: SVGElement, item: SvgicItem, event: MouseEvent): void {
    this.cancelHideTimer()

    // Reset previous state (element change)
    if (this.onMouseMove) {
      document.removeEventListener('mousemove', this.onMouseMove)
      this.onMouseMove = null
    }
    if (this.onViewChange) {
      this.currentTarget?.ownerSVGElement?.removeEventListener('svgic:viewchange', this.onViewChange)
      this.onViewChange = null
    }
    this.popupEl?.remove()

    this.currentTarget = targetEl
    this.ensurePopup(item)
    if (!this.popupEl) return

    const { placement } = this.config

    if (placement === 'target') {
      this.renderInTarget(item)
      return
    }

    // Ensure absolute positioning so coordinate calculations (clientX/Y + scrollX/Y) work
    // correctly for both default and custom (render/template) popups.
    this.popupEl.style.position = 'absolute'
    document.body.appendChild(this.popupEl)
    this.updatePosition(targetEl, event)

    if (placement === 'cursor') {
      this.onMouseMove = (e: MouseEvent) => this.updatePosition(targetEl, e)
      document.addEventListener('mousemove', this.onMouseMove)
    } else {
      // element mode: track viewBox changes (pan/zoom)
      const svg = targetEl.ownerSVGElement
      if (svg) {
        this.onViewChange = () => this.updatePosition(targetEl, event)
        svg.addEventListener('svgic:viewchange', this.onViewChange)
      }

      // interactive mode: popup stays visible while cursor is over it
      const cfg = this.config as { interactive?: boolean }
      if (cfg.interactive) {
        this.popupEl.addEventListener('mouseenter', () => this.cancelHideTimer())
        this.popupEl.addEventListener('mouseleave', () => this.hide())
      }
    }
  }

  /** Hides the popup. Respects `hideDelay` for interactive mode. */
  hide(): void {
    const delay = this.effectiveHideDelay
    if (delay > 0) {
      this.hideTimer = setTimeout(() => this.doHide(), delay)
    } else {
      this.doHide()
    }
  }

  destroy(): void {
    this.cancelHideTimer()
    this.doHide()
    this.styleEl?.remove()
    this.popupEl = null
    this.styleEl = null
  }

  private get effectiveHideDelay(): number {
    const cfg = this.config as { interactive?: boolean; hideDelay?: number }
    if (cfg.hideDelay !== undefined) return cfg.hideDelay
    if (cfg.interactive) return DEFAULT_INTERACTIVE_DELAY
    return 0
  }

  private cancelHideTimer(): void {
    if (this.hideTimer !== null) {
      clearTimeout(this.hideTimer)
      this.hideTimer = null
    }
  }

  private doHide(): void {
    if (this.onMouseMove) {
      document.removeEventListener('mousemove', this.onMouseMove)
      this.onMouseMove = null
    }

    if (this.onViewChange) {
      this.currentTarget?.ownerSVGElement?.removeEventListener('svgic:viewchange', this.onViewChange)
      this.onViewChange = null
    }

    const { placement } = this.config

    if (placement === 'target') {
      const targetEl = this.resolveTargetNode()
      if (targetEl) targetEl.innerHTML = ''
      return
    }

    this.popupEl?.remove()
    this.popupEl = null
    this.currentTarget = null
  }

  private ensurePopup(item: SvgicItem): void {
    const cfg = this.config as { render?: unknown; template?: unknown; bind?: unknown }
    const hasCustomContent = !!(cfg.render || cfg.template)

    // Default popup is shown only if item has a title
    if (!hasCustomContent && !item.title) {
      this.popupEl = null
      return
    }

    this.popupEl = this.resolveContent(item)

    if (!this.styleEl && !document.querySelector('#svgic-popup-styles')) {
      this.styleEl = document.createElement('style')
      this.styleEl.id = 'svgic-popup-styles'
      this.styleEl.textContent = DEFAULT_POPUP_STYLES
      document.head.appendChild(this.styleEl)
    }
  }

  private updatePosition(targetEl: SVGElement, event: MouseEvent): void {
    if (!this.popupEl) return
    const { placement } = this.config

    let pos: { x: number; y: number }

    if (placement === 'cursor') {
      const cfg = this.config as PopupPlacementCursor
      pos = getCursorPosition(this.popupEl, event, cfg.offset)
    } else {
      const cfg = this.config as PopupPlacementElement
      pos = getElementPosition(this.popupEl, targetEl, cfg.anchor, cfg.offset, cfg.flip)
    }

    this.popupEl.style.left = `${pos.x}px`
    this.popupEl.style.top = `${pos.y}px`
  }

  private renderInTarget(item: SvgicItem): void {
    const targetNode = this.resolveTargetNode()
    if (!targetNode) return

    const el = this.resolveContent(item)
    targetNode.innerHTML = ''
    targetNode.appendChild(el)
  }

  private resolveContent(item: SvgicItem): HTMLElement {
    const cfg = this.config as {
      render?: (i: SvgicItem) => HTMLElement | string
      template?: string | HTMLTemplateElement
      bind?: (el: HTMLElement, item: SvgicItem) => void
    }

    if (cfg.template) {
      const tpl = typeof cfg.template === 'string'
        ? document.querySelector<HTMLTemplateElement>(cfg.template)
        : cfg.template
      if (!tpl) throw new Error(`[svgic] popup template not found: "${cfg.template}"`)
      const fragment = tpl.content.cloneNode(true) as DocumentFragment
      const el = fragment.firstElementChild as HTMLElement | null
      if (!el) throw new Error(`[svgic] popup template is empty: "${cfg.template}"`)
      cfg.bind?.(el, item)
      return el
    }

    const renderFn = cfg.render ?? renderDefaultPopup
    const content = renderFn(item)
    return typeof content === 'string' ? htmlStringToElement(content) : content
  }

  private resolveTargetNode(): HTMLElement | null {
    const cfg = this.config as PopupPlacementTarget
    if (!cfg.target) return null
    return typeof cfg.target === 'string'
      ? document.querySelector<HTMLElement>(cfg.target)
      : cfg.target
  }
}

function htmlStringToElement(html: string): HTMLElement {
  const d = document.createElement('div')
  d.innerHTML = html
  d.querySelectorAll('script').forEach(el => el.remove())
  for (const el of d.querySelectorAll('*')) {
    for (const attr of [...el.attributes]) {
      if (attr.name.startsWith('on')) el.removeAttribute(attr.name)
    }
  }
  return (d.firstElementChild as HTMLElement | null) ?? d
}
