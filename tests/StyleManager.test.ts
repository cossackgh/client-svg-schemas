import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { StyleManager } from '../src/ui/StyleManager'
import type { ParsedLayer } from '../src/core/layerParser'
import type { BoundElement } from '../src/core/dataMapper'

// ---- helpers ----

function makeSvgEl(inner: string): SVGSVGElement {
  const parser = new DOMParser()
  const doc = parser.parseFromString(
    `<svg xmlns="http://www.w3.org/2000/svg">${inner}</svg>`,
    'image/svg+xml',
  )
  return doc.documentElement as unknown as SVGSVGElement
}

function setup(svgInner: string, boundIds: string[]) {
  const svg = makeSvgEl(svgInner)
  const layerEl = svg.getElementById('rooms') as SVGGElement

  const layers = new Map<string, ParsedLayer>([
    ['rooms', { element: layerEl, role: 'interactive' }],
  ])

  const boundElements = new Map<string, BoundElement>(
    boundIds.map(id => [
      id,
      { element: svg.getElementById(id) as SVGElement, item: { id } },
    ]),
  )

  const sm = new StyleManager(
    {
      default: { fill: 'gray' },
      hover: { fill: 'blue' },
      states: { free: { fill: 'green' }, busy: { fill: 'red' } },
    },
    () => layers,
    () => boundElements,
  )

  return { svg, layers, boundElements, sm }
}

afterEach(() => {
  document.querySelectorAll('style[data-svgic]').forEach(el => el.remove())
})

// ---- init ----

describe('StyleManager — init()', () => {
  it('injects <style data-svgic> into head', () => {
    const { sm } = setup('<g id="rooms"><g id="room-1"/></g>', ['room-1'])
    sm.init()
    expect(document.head.querySelector('style[data-svgic]')).not.toBeNull()
    sm.destroy()
  })

  it('style contains CSS for default state', () => {
    const { sm } = setup('<g id="rooms"><g id="room-1"/></g>', ['room-1'])
    sm.init()
    const css = document.head.querySelector('style[data-svgic]')!.textContent ?? ''
    expect(css).toContain('svgic-interactive')
    expect(css).toContain('fill: gray')
    sm.destroy()
  })

  it('adds svgic-interactive to child <g> elements of interactive layer', () => {
    const { svg, sm } = setup(
      '<g id="rooms"><g id="r1"/><g id="r2"/></g>',
      [],
    )
    sm.init()
    expect(svg.getElementById('r1')!.classList.contains('svgic-interactive')).toBe(true)
    expect(svg.getElementById('r2')!.classList.contains('svgic-interactive')).toBe(true)
    sm.destroy()
  })

  it('does not add svgic-interactive to non-<g> child elements', () => {
    const { svg, sm } = setup(
      '<g id="rooms"><rect id="r1"/><g id="r2"/></g>',
      [],
    )
    sm.init()
    expect(svg.getElementById('r1')!.classList.contains('svgic-interactive')).toBe(false)
    expect(svg.getElementById('r2')!.classList.contains('svgic-interactive')).toBe(true)
    sm.destroy()
  })
})

// ---- hover ----

describe('StyleManager — applyHover / removeHover', () => {
  let svg: ReturnType<typeof makeSvgEl>
  let sm: StyleManager

  beforeEach(() => {
    ;({ svg, sm } = setup('<g id="rooms"><g id="r1"/><g id="r2"/></g>', ['r1', 'r2']))
    sm.init()
  })

  afterEach(() => {
    sm.destroy()
  })

  it('applyHover adds svgic-hover to element', () => {
    sm.applyHover('r1')
    expect(svg.getElementById('r1')!.classList.contains('svgic-hover')).toBe(true)
  })

  it('applyHover removes hover from previous element', () => {
    sm.applyHover('r1')
    sm.applyHover('r2')
    expect(svg.getElementById('r1')!.classList.contains('svgic-hover')).toBe(false)
    expect(svg.getElementById('r2')!.classList.contains('svgic-hover')).toBe(true)
  })

  it('removeHover removes svgic-hover', () => {
    sm.applyHover('r1')
    sm.removeHover()
    expect(svg.getElementById('r1')!.classList.contains('svgic-hover')).toBe(false)
  })

  it('removeHover on empty state does not throw', () => {
    expect(() => sm.removeHover()).not.toThrow()
  })

  it('applyHover on nonexistent id does not throw', () => {
    expect(() => sm.applyHover('nonexistent')).not.toThrow()
  })
})

// ---- setHighlight ----

describe('StyleManager — setHighlight()', () => {
  let svg: ReturnType<typeof makeSvgEl>
  let sm: StyleManager

  beforeEach(() => {
    ;({ svg, sm } = setup('<g id="rooms"><g id="r1"/><g id="r2"/><g id="r3"/></g>', ['r1', 'r2', 'r3']))
    sm.init()
  })

  afterEach(() => {
    sm.destroy()
  })

  it('adds svgic-state-free and svgic-is-highlighted', () => {
    sm.setHighlight('free', ['r1'])
    expect(svg.getElementById('r1')!.classList.contains('svgic-state-free')).toBe(true)
    expect(svg.getElementById('r1')!.classList.contains('svgic-is-highlighted')).toBe(true)
  })

  it('replaces previous ids of the same state', () => {
    sm.setHighlight('free', ['r1'])
    sm.setHighlight('free', ['r2'])
    expect(svg.getElementById('r1')!.classList.contains('svgic-state-free')).toBe(false)
    expect(svg.getElementById('r1')!.classList.contains('svgic-is-highlighted')).toBe(false)
    expect(svg.getElementById('r2')!.classList.contains('svgic-state-free')).toBe(true)
  })

  it('multiple states on same element — both classes are present', () => {
    sm.setHighlight('free', ['r1'])
    sm.setHighlight('busy', ['r1'])
    const el = svg.getElementById('r1')!
    expect(el.classList.contains('svgic-state-free')).toBe(true)
    expect(el.classList.contains('svgic-state-busy')).toBe(true)
    expect(el.classList.contains('svgic-is-highlighted')).toBe(true)
  })
})

// ---- clearHighlight ----

describe('StyleManager — clearHighlight()', () => {
  let svg: ReturnType<typeof makeSvgEl>
  let sm: StyleManager

  beforeEach(() => {
    ;({ svg, sm } = setup('<g id="rooms"><g id="r1"/><g id="r2"/></g>', ['r1', 'r2']))
    sm.init()
  })

  afterEach(() => {
    sm.destroy()
  })

  it('clearHighlight(state) removes classes for specific state', () => {
    sm.setHighlight('free', ['r1'])
    sm.clearHighlight('free')
    expect(svg.getElementById('r1')!.classList.contains('svgic-state-free')).toBe(false)
    expect(svg.getElementById('r1')!.classList.contains('svgic-is-highlighted')).toBe(false)
  })

  it('clearHighlight(state) does not remove svgic-is-highlighted if element is highlighted by another state', () => {
    sm.setHighlight('free', ['r1'])
    sm.setHighlight('busy', ['r1'])
    sm.clearHighlight('free')
    const el = svg.getElementById('r1')!
    expect(el.classList.contains('svgic-state-free')).toBe(false)
    expect(el.classList.contains('svgic-is-highlighted')).toBe(true) // busy is still active
  })

  it('clearHighlight() without arguments removes all states from all elements', () => {
    sm.setHighlight('free', ['r1'])
    sm.setHighlight('busy', ['r2'])
    sm.clearHighlight()
    expect(svg.getElementById('r1')!.classList.contains('svgic-is-highlighted')).toBe(false)
    expect(svg.getElementById('r2')!.classList.contains('svgic-is-highlighted')).toBe(false)
    expect(svg.getElementById('r1')!.classList.contains('svgic-state-free')).toBe(false)
    expect(svg.getElementById('r2')!.classList.contains('svgic-state-busy')).toBe(false)
  })

  it('clearHighlight() on empty state does not throw', () => {
    expect(() => sm.clearHighlight()).not.toThrow()
    expect(() => sm.clearHighlight('free')).not.toThrow()
  })
})

// ---- destroy ----

describe('StyleManager — destroy()', () => {
  it('removes <style data-svgic> from head', () => {
    const { sm } = setup('<g id="rooms"><g id="r1"/></g>', ['r1'])
    sm.init()
    expect(document.head.querySelector('style[data-svgic]')).not.toBeNull()
    sm.destroy()
    expect(document.head.querySelector('style[data-svgic]')).toBeNull()
  })

  it('removes all svgic-classes from bound elements', () => {
    const { svg, sm } = setup('<g id="rooms"><g id="r1"/></g>', ['r1'])
    sm.init()
    sm.applyHover('r1')
    sm.setHighlight('free', ['r1'])
    sm.destroy()
    const el = svg.getElementById('r1')!
    const svgicClasses = [...el.classList].filter(c => c.startsWith('svgic-'))
    expect(svgicClasses).toHaveLength(0)
  })

  it('destroy() does not throw when called again', () => {
    const { sm } = setup('<g id="rooms"><g id="r1"/></g>', ['r1'])
    sm.init()
    sm.destroy()
    expect(() => sm.destroy()).not.toThrow()
  })
})
