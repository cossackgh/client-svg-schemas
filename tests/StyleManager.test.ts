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
  it('вставляет <style data-svgic> в head', () => {
    const { sm } = setup('<g id="rooms"><g id="room-1"/></g>', ['room-1'])
    sm.init()
    expect(document.head.querySelector('style[data-svgic]')).not.toBeNull()
    sm.destroy()
  })

  it('style содержит CSS для дефолтного состояния', () => {
    const { sm } = setup('<g id="rooms"><g id="room-1"/></g>', ['room-1'])
    sm.init()
    const css = document.head.querySelector('style[data-svgic]')!.textContent ?? ''
    expect(css).toContain('svgic-interactive')
    expect(css).toContain('fill: gray')
    sm.destroy()
  })

  it('добавляет svgic-interactive к дочерним <g> интерактивного слоя', () => {
    const { svg, sm } = setup(
      '<g id="rooms"><g id="r1"/><g id="r2"/></g>',
      [],
    )
    sm.init()
    expect(svg.getElementById('r1')!.classList.contains('svgic-interactive')).toBe(true)
    expect(svg.getElementById('r2')!.classList.contains('svgic-interactive')).toBe(true)
    sm.destroy()
  })

  it('не добавляет svgic-interactive к не-g дочерним элементам', () => {
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

  it('applyHover добавляет svgic-hover к элементу', () => {
    sm.applyHover('r1')
    expect(svg.getElementById('r1')!.classList.contains('svgic-hover')).toBe(true)
  })

  it('applyHover снимает hover с предыдущего элемента', () => {
    sm.applyHover('r1')
    sm.applyHover('r2')
    expect(svg.getElementById('r1')!.classList.contains('svgic-hover')).toBe(false)
    expect(svg.getElementById('r2')!.classList.contains('svgic-hover')).toBe(true)
  })

  it('removeHover снимает svgic-hover', () => {
    sm.applyHover('r1')
    sm.removeHover()
    expect(svg.getElementById('r1')!.classList.contains('svgic-hover')).toBe(false)
  })

  it('removeHover на пустом состоянии не бросает', () => {
    expect(() => sm.removeHover()).not.toThrow()
  })

  it('applyHover на несуществующем id не бросает', () => {
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

  it('добавляет svgic-state-free и svgic-is-highlighted', () => {
    sm.setHighlight('free', ['r1'])
    expect(svg.getElementById('r1')!.classList.contains('svgic-state-free')).toBe(true)
    expect(svg.getElementById('r1')!.classList.contains('svgic-is-highlighted')).toBe(true)
  })

  it('заменяет предыдущие ids того же состояния', () => {
    sm.setHighlight('free', ['r1'])
    sm.setHighlight('free', ['r2'])
    expect(svg.getElementById('r1')!.classList.contains('svgic-state-free')).toBe(false)
    expect(svg.getElementById('r1')!.classList.contains('svgic-is-highlighted')).toBe(false)
    expect(svg.getElementById('r2')!.classList.contains('svgic-state-free')).toBe(true)
  })

  it('несколько состояний на одном элементе — оба класса присутствуют', () => {
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

  it('clearHighlight(state) снимает классы конкретного состояния', () => {
    sm.setHighlight('free', ['r1'])
    sm.clearHighlight('free')
    expect(svg.getElementById('r1')!.classList.contains('svgic-state-free')).toBe(false)
    expect(svg.getElementById('r1')!.classList.contains('svgic-is-highlighted')).toBe(false)
  })

  it('clearHighlight(state) не снимает svgic-is-highlighted если элемент подсвечен другим state', () => {
    sm.setHighlight('free', ['r1'])
    sm.setHighlight('busy', ['r1'])
    sm.clearHighlight('free')
    const el = svg.getElementById('r1')!
    expect(el.classList.contains('svgic-state-free')).toBe(false)
    expect(el.classList.contains('svgic-is-highlighted')).toBe(true) // busy ещё активен
  })

  it('clearHighlight() без аргументов снимает все состояния со всех элементов', () => {
    sm.setHighlight('free', ['r1'])
    sm.setHighlight('busy', ['r2'])
    sm.clearHighlight()
    expect(svg.getElementById('r1')!.classList.contains('svgic-is-highlighted')).toBe(false)
    expect(svg.getElementById('r2')!.classList.contains('svgic-is-highlighted')).toBe(false)
    expect(svg.getElementById('r1')!.classList.contains('svgic-state-free')).toBe(false)
    expect(svg.getElementById('r2')!.classList.contains('svgic-state-busy')).toBe(false)
  })

  it('clearHighlight() на пустом состоянии не бросает', () => {
    expect(() => sm.clearHighlight()).not.toThrow()
    expect(() => sm.clearHighlight('free')).not.toThrow()
  })
})

// ---- destroy ----

describe('StyleManager — destroy()', () => {
  it('удаляет <style data-svgic> из head', () => {
    const { sm } = setup('<g id="rooms"><g id="r1"/></g>', ['r1'])
    sm.init()
    expect(document.head.querySelector('style[data-svgic]')).not.toBeNull()
    sm.destroy()
    expect(document.head.querySelector('style[data-svgic]')).toBeNull()
  })

  it('снимает все svgic-классы с bound-элементов', () => {
    const { svg, sm } = setup('<g id="rooms"><g id="r1"/></g>', ['r1'])
    sm.init()
    sm.applyHover('r1')
    sm.setHighlight('free', ['r1'])
    sm.destroy()
    const el = svg.getElementById('r1')!
    const svgicClasses = [...el.classList].filter(c => c.startsWith('svgic-'))
    expect(svgicClasses).toHaveLength(0)
  })

  it('destroy() повторно не бросает', () => {
    const { sm } = setup('<g id="rooms"><g id="r1"/></g>', ['r1'])
    sm.init()
    sm.destroy()
    expect(() => sm.destroy()).not.toThrow()
  })
})
