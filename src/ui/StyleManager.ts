import type { SvgicStyleConfig, SvgicStyleProperties, StripInlineStylesOption } from '../types'
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
    private readonly idAttribute: string = 'id',
  ) {}

  init(): void {
    this.injectStyles()
    this.applyDefaultClasses()
    this.processInlineStyles()
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

    const touched = new Set<Element>(this.interactiveElements())
    for (const [, { element }] of this.getBoundElements()) touched.add(element)

    for (const element of touched) {
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

  /**
   * Direct children of interactive layers that svgic treats as interactive elements:
   * - `<g>` wrappers — their flat children are painted, nested `<g>` is left to the designer
   * - flat shapes carrying an id key — painted directly
   *
   * Flat shapes without an id key are decoration: they cannot be bound to data,
   * so they are left untouched.
   */
  private interactiveElements(): Element[] {
    const result: Element[] = []
    for (const [, layer] of this.getLayers()) {
      if (layer.role !== 'interactive') continue
      for (const child of layer.element.children) {
        if (child.tagName.toLowerCase() === 'g' || this.hasIdKey(child)) {
          result.push(child)
        }
      }
    }
    return result
  }

  /**
   * Elements the generated CSS actually paints — the same set the selectors match:
   * a flat interactive element itself, or the flat direct children of a `<g>` wrapper.
   */
  private paintTargets(): SVGElement[] {
    const targets: SVGElement[] = []
    for (const el of this.interactiveElements()) {
      if (el.tagName.toLowerCase() !== 'g') {
        targets.push(el as SVGElement)
        continue
      }
      for (const child of el.children) {
        if (child.tagName.toLowerCase() !== 'g') targets.push(child as SVGElement)
      }
    }
    return targets
  }

  private hasIdKey(el: Element): boolean {
    if (this.idAttribute !== 'id' && el.hasAttribute(this.idAttribute)) return true
    return !!el.id
  }

  /** CSS property names (kebab-case) declared anywhere in the style config */
  private managedProperties(): string[] {
    const { default: def, hover, highlightedHover, states = {} } = this.config
    const props = new Set<string>()
    for (const block of [def, hover, highlightedHover, ...Object.values(states)]) {
      if (!block) continue
      for (const key of Object.keys(block)) props.add(camelToKebab(key))
    }
    return [...props]
  }

  /**
   * Strips inline `style` declarations that would override the configured styles,
   * or warns about them when stripping is disabled.
   *
   * Declarations in a `style` attribute outrank any stylesheet regardless of
   * specificity, so an SVG exported with `style="fill:…"` silently defeats the
   * style config.
   */
  private processInlineStyles(): void {
    const mode: StripInlineStylesOption = this.config.stripInlineStyles ?? false
    const targets = this.paintTargets()
    if (targets.length === 0) return

    if (mode === false) {
      this.warnAboutInlineStyles(targets)
      return
    }

    if (mode === 'all') {
      for (const el of targets) el.removeAttribute('style')
      return
    }

    const props = Array.isArray(mode) ? mode.map(camelToKebab) : this.managedProperties()
    if (props.length === 0) return

    for (const el of targets) {
      if (!el.hasAttribute('style')) continue
      for (const prop of props) el.style.removeProperty(prop)
      if (el.style.length === 0) el.removeAttribute('style')
    }
  }

  /**
   * One-shot diagnostic: without it the failure is silent — styles are configured,
   * nothing changes on screen, and the console stays empty.
   */
  private warnAboutInlineStyles(targets: SVGElement[]): void {
    const props = this.managedProperties()
    if (props.length === 0) return

    const conflicting = new Set<string>()
    const ids: string[] = []

    for (const el of targets) {
      if (!el.hasAttribute('style')) continue
      let hit = false
      for (const prop of props) {
        if (el.style.getPropertyValue(prop)) {
          conflicting.add(prop)
          hit = true
        }
      }
      if (hit) ids.push(el.id || el.parentElement?.id || '<no id>')
    }

    if (ids.length === 0) return

    const sample = ids.slice(0, 5).join(', ') + (ids.length > 5 ? ', …' : '')
    console.warn(
      `[svgic] ${ids.length} interactive element(s) have an inline style overriding ` +
      `configured styles (${[...conflicting].join(', ')}): ${sample}. ` +
      'Set `style.stripInlineStyles` to strip them.',
    )
  }

  private applyDefaultClasses(): void {
    for (const el of this.interactiveElements()) {
      el.classList.add('svgic-interactive')
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
      lines.push(`${paintSelector('.svgic-interactive')} { ${toCSS(def)} }`)
    }
    if (hover) {
      lines.push(`${paintSelector('.svgic-hover:not(.svgic-is-highlighted)')} { ${toCSS(hover)} }`)
    }
    if (highlightedHover) {
      lines.push(`${paintSelector('.svgic-hover.svgic-is-highlighted')} { ${toCSS(highlightedHover)} }`)
    }
    for (const [state, stateStyle] of Object.entries(states)) {
      const safeState = state.replace(/[^a-zA-Z0-9_-]/g, '')
      if (safeState !== state) {
        console.warn(`[svgic] Invalid state name "${state}" — only [a-zA-Z0-9_-] allowed, skipped`)
        continue
      }
      lines.push(`${paintSelector(`.svgic-state-${safeState}`)} { ${toCSS(stateStyle)} }`)
    }

    return lines.join('\n')
  }
}

/**
 * Builds the selector pair covering both supported shapes of an interactive element:
 * - `base:not(g)` — a flat element (rect/path/circle…) carrying the class itself
 * - `base > :not(g)` — flat children of a `<g>` wrapper; nested `<g>` stays untouched
 *
 * Both halves have equal specificity (0,1,1), so neither overrides the other.
 */
function paintSelector(base: string): string {
  return `${base}:not(g), ${base} > :not(g)`
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
