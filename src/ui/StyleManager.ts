import type { SvgicStyleConfig, SvgicStyleProperties } from '../types'
import type { ParsedLayer } from '../core/layerParser'
import type { BoundElement } from '../core/dataMapper'

/**
 * Manages CSS classes and injected styles for interactive SVG elements.
 * Handles hover state, highlight states, and style injection into the document.
 */
export class StyleManager {
  private styleEl: HTMLStyleElement | null = null
  private hoveredId: string | null = null
  // state → set of ids
  private highlightStates = new Map<string, Set<string>>()

  constructor(
    private readonly config: SvgicStyleConfig,
    private readonly getLayers: () => Map<string, ParsedLayer>,
    private readonly getBoundElements: () => Map<string, BoundElement>,
  ) {}

  init(): void {
    this.injectStyles()
    this.applyDefaultClasses()
  }

  applyHover(id: string): void {
    this.removeHover()
    const el = this.getElement(id)
    if (!el) return
    el.classList.add('svgic-hover')
    this.hoveredId = id
  }

  removeHover(): void {
    if (this.hoveredId === null) return
    this.getElement(this.hoveredId)?.classList.remove('svgic-hover')
    this.hoveredId = null
  }

  /**
   * Applies a named highlight state to the given element ids.
   * Replaces any previously highlighted ids for the same state.
   * @param state - Highlight state name (e.g. `'free'`, `'busy'`)
   * @param ids - Element ids to highlight
   */
  setHighlight(state: string, ids: string[]): void {
    // Remove old ids for this state
    const oldIds = this.highlightStates.get(state) ?? new Set<string>()
    for (const id of oldIds) {
      const el = this.getElement(id)
      if (!el) continue
      el.classList.remove(`svgic-state-${state}`)
      if (!this.isHighlightedByOther(id, state)) {
        el.classList.remove('svgic-is-highlighted')
      }
    }

    // Apply new ids
    const newSet = new Set(ids)
    this.highlightStates.set(state, newSet)
    for (const id of ids) {
      const el = this.getElement(id)
      if (!el) continue
      el.classList.add(`svgic-state-${state}`, 'svgic-is-highlighted')
    }
  }

  /**
   * Removes highlight state(s) from all affected elements.
   * @param state - State name to clear. If omitted, clears all states.
   */
  clearHighlight(state?: string): void {
    if (state !== undefined) {
      const ids = this.highlightStates.get(state) ?? new Set<string>()
      for (const id of ids) {
        const el = this.getElement(id)
        if (!el) continue
        el.classList.remove(`svgic-state-${state}`)
        if (!this.isHighlightedByOther(id, state)) {
          el.classList.remove('svgic-is-highlighted')
        }
      }
      this.highlightStates.delete(state)
    } else {
      for (const [s, ids] of this.highlightStates) {
        for (const id of ids) {
          const el = this.getElement(id)
          if (!el) continue
          el.classList.remove(`svgic-state-${s}`, 'svgic-is-highlighted')
        }
      }
      this.highlightStates.clear()
    }
  }

  destroy(): void {
    this.styleEl?.remove()
    this.styleEl = null
    this.hoveredId = null
    this.highlightStates.clear()

    for (const [, { element }] of this.getBoundElements()) {
      const toRemove = [...element.classList].filter(c => c.startsWith('svgic-'))
      toRemove.forEach(c => element.classList.remove(c))
    }
  }

  // --- private ---

  private getElement(id: string): Element | null {
    return this.getBoundElements().get(id)?.element ?? null
  }

  private isHighlightedByOther(id: string, excludeState: string): boolean {
    for (const [state, ids] of this.highlightStates) {
      if (state !== excludeState && ids.has(id)) return true
    }
    return false
  }

  private applyDefaultClasses(): void {
    for (const [, layer] of this.getLayers()) {
      if (layer.role !== 'interactive') continue
      for (const child of layer.element.children) {
        if (child.tagName.toLowerCase() === 'g') {
          child.classList.add('svgic-interactive')
        }
      }
    }
  }

  private injectStyles(): void {
    const css = this.buildCSS()
    if (!css) return
    const style = document.createElement('style')
    style.dataset['svgic'] = ''
    style.textContent = css
    document.head.appendChild(style)
    this.styleEl = style
  }

  private buildCSS(): string {
    const { default: def, hover, highlightedHover, states = {} } = this.config
    const lines: string[] = []

    if (def) {
      lines.push(`.svgic-interactive > :not(g) { ${toCSS(def)} }`)
    }
    if (hover) {
      lines.push(`.svgic-hover:not(.svgic-is-highlighted) > :not(g) { ${toCSS(hover)} }`)
    }
    if (highlightedHover) {
      lines.push(`.svgic-hover.svgic-is-highlighted > :not(g) { ${toCSS(highlightedHover)} }`)
    }
    for (const [state, stateStyle] of Object.entries(states)) {
      lines.push(`.svgic-state-${state} > :not(g) { ${toCSS(stateStyle)} }`)
    }

    return lines.join('\n')
  }
}

function toCSS(props: SvgicStyleProperties): string {
  return Object.entries(props)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${camelToKebab(k)}: ${v}`)
    .join('; ')
}

function camelToKebab(s: string): string {
  return s.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`)
}
