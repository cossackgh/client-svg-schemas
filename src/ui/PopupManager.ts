import type { SvgicItem, PopupOption, PopupPlacementCursor, PopupPlacementElement, PopupPlacementTarget } from '../types'
import { renderDefaultPopup, DEFAULT_POPUP_STYLES } from './DefaultPopup'
import { getElementPosition } from './placement/ElementPlacement'
import { getCursorPosition } from './placement/CursorPlacement'

export class PopupManager {
  private popupEl: HTMLElement | null = null
  private styleEl: HTMLStyleElement | null = null
  private config: Exclude<PopupOption, boolean>
  private currentTarget: SVGElement | null = null
  private onMouseMove: ((e: MouseEvent) => void) | null = null

  constructor(option: PopupOption) {
    this.config = option === true
      ? { placement: 'element', anchor: 'top-center', flip: true }
      : option as Exclude<PopupOption, boolean>
  }

  // Вызывается при hover / click на элемент
  show(targetEl: SVGElement, item: SvgicItem, event: MouseEvent): void {
    this.currentTarget = targetEl
    this.ensurePopup(item)
    if (!this.popupEl) return

    const { placement } = this.config

    if (placement === 'target') {
      this.renderInTarget(item)
      return
    }

    document.body.appendChild(this.popupEl)
    this.updatePosition(targetEl, event)

    if (placement === 'cursor') {
      this.onMouseMove = (e: MouseEvent) => this.updatePosition(targetEl, e)
      document.addEventListener('mousemove', this.onMouseMove)
    }
  }

  // Вызывается при mouseleave / второй клик для скрытия
  hide(): void {
    if (this.onMouseMove) {
      document.removeEventListener('mousemove', this.onMouseMove)
      this.onMouseMove = null
    }

    const { placement } = this.config

    if (placement === 'target') {
      const targetEl = this.resolveTargetNode()
      if (targetEl) targetEl.innerHTML = ''
      return
    }

    this.popupEl?.remove()
    this.currentTarget = null
  }

  destroy(): void {
    this.hide()
    this.styleEl?.remove()
    this.popupEl = null
    this.styleEl = null
  }

  private ensurePopup(item: SvgicItem): void {
    const cfg = this.config as { render?: unknown; template?: unknown; bind?: unknown }
    const hasCustomContent = !!(cfg.render || cfg.template)

    // Дефолтный попап показываем только если есть title
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
  return d
}
