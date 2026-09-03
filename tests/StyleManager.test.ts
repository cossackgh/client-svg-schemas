import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { StyleManager } from '../src/ui/StyleManager'
import type { ParsedLayer } from '../src/core/layerParser'
import type { BoundElement } from '../src/core/dataMapper'
import type { SvgicStyleConfig } from '../src/types'

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

  it('adds svgic-interactive to flat child elements carrying an id', () => {
    const { svg, sm } = setup(
      '<g id="rooms"><rect id="r1"/><g id="r2"/></g>',
      [],
    )
    sm.init()
    expect(svg.getElementById('r1')!.classList.contains('svgic-interactive')).toBe(true)
    expect(svg.getElementById('r2')!.classList.contains('svgic-interactive')).toBe(true)
    sm.destroy()
  })

  it('does not add svgic-interactive to flat child elements without an id', () => {
    const { svg, sm } = setup(
      '<g id="rooms"><rect class="deco"/><g id="r2"/></g>',
      [],
    )
    sm.init()
    const deco = svg.getElementById('rooms')!.querySelector('.deco')!
    expect(deco.classList.contains('svgic-interactive')).toBe(false)
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

// ---- selectors ----

describe('StyleManager — generated selectors', () => {
  it('paints both a flat element itself and the flat children of a <g> wrapper', () => {
    const { sm } = setup('<g id="rooms"><rect id="r1"/></g>', [])
    sm.init()
    const css = document.head.querySelector('style[data-svgic]')!.textContent!
    expect(css).toContain('.svgic-interactive:not(g)')
    expect(css).toContain('.svgic-interactive > :not(g)')
    expect(css).toContain('.svgic-hover:not(.svgic-is-highlighted):not(g)')
    expect(css).toContain('.svgic-state-free:not(g)')
    expect(css).toContain('.svgic-state-free > :not(g)')
    sm.destroy()
  })
})

// ---- stripInlineStyles ----

function setupWithConfig(svgInner: string, config: SvgicStyleConfig) {
  const svg = makeSvgEl(svgInner)
  const layerEl = svg.getElementById('rooms') as SVGGElement
  const layers = new Map<string, ParsedLayer>([
    ['rooms', { element: layerEl, role: 'interactive' }],
  ])
  const boundElements = new Map<string, BoundElement>()
  const sm = new StyleManager(config, () => layers, () => boundElements)
  return { svg, sm }
}

const PAINT_CONFIG: SvgicStyleConfig = {
  default: { fill: 'gray' },
  hover: { fill: 'blue', strokeWidth: 2 },
}

describe('StyleManager — stripInlineStyles', () => {
  it('is disabled by default and leaves inline styles untouched', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { svg, sm } = setupWithConfig(
      '<g id="rooms"><rect id="r1" style="fill:none;stroke:#d5c096"/></g>',
      PAINT_CONFIG,
    )
    sm.init()
    expect(svg.getElementById('r1')!.getAttribute('style')).toBe('fill:none;stroke:#d5c096')
    sm.destroy()
    warn.mockRestore()
  })

  it('warns once about inline styles overriding the config', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { sm } = setupWithConfig(
      '<g id="rooms"><rect id="r1" style="fill:none"/><rect id="r2" style="fill:red"/></g>',
      PAINT_CONFIG,
    )
    sm.init()
    expect(warn).toHaveBeenCalledTimes(1)
    const message = warn.mock.calls[0]![0] as string
    expect(message).toContain('2 interactive element(s)')
    expect(message).toContain('fill')
    expect(message).toContain('r1, r2')
    sm.destroy()
    warn.mockRestore()
  })

  it('does not warn when inline styles do not touch configured properties', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { sm } = setupWithConfig(
      '<g id="rooms"><rect id="r1" style="opacity:0.5"/></g>',
      PAINT_CONFIG,
    )
    sm.init()
    expect(warn).not.toHaveBeenCalled()
    sm.destroy()
    warn.mockRestore()
  })

  it('does not warn when the style config declares nothing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { sm } = setupWithConfig(
      '<g id="rooms"><rect id="r1" style="fill:none"/></g>',
      {},
    )
    sm.init()
    expect(warn).not.toHaveBeenCalled()
    sm.destroy()
    warn.mockRestore()
  })

  it("'managed' removes only the properties declared in the config", () => {
    const { svg, sm } = setupWithConfig(
      '<g id="rooms"><rect id="r1" style="fill:none;stroke:#d5c096;opacity:0.5"/></g>',
      { ...PAINT_CONFIG, stripInlineStyles: 'managed' },
    )
    sm.init()
    const el = svg.getElementById('r1') as SVGElement
    expect(el.style.getPropertyValue('fill')).toBe('')
    expect(el.style.getPropertyValue('stroke-width')).toBe('')
    expect(el.style.getPropertyValue('stroke')).not.toBe('')
    expect(el.style.getPropertyValue('opacity')).toBe('0.5')
    sm.destroy()
  })

  it('true behaves like managed', () => {
    const { svg, sm } = setupWithConfig(
      '<g id="rooms"><rect id="r1" style="fill:none;stroke:#d5c096"/></g>',
      { ...PAINT_CONFIG, stripInlineStyles: true },
    )
    sm.init()
    const el = svg.getElementById('r1') as SVGElement
    expect(el.style.getPropertyValue('fill')).toBe('')
    expect(el.style.getPropertyValue('stroke')).not.toBe('')
    sm.destroy()
  })

  it("'all' removes the whole style attribute", () => {
    const { svg, sm } = setupWithConfig(
      '<g id="rooms"><rect id="r1" style="fill:none;stroke:#d5c096;transform:translate(1px,1px)"/></g>',
      { ...PAINT_CONFIG, stripInlineStyles: 'all' },
    )
    sm.init()
    expect(svg.getElementById('r1')!.hasAttribute('style')).toBe(false)
    sm.destroy()
  })

  it('an explicit property list removes exactly those properties', () => {
    const { svg, sm } = setupWithConfig(
      '<g id="rooms"><rect id="r1" style="fill:none;stroke:#d5c096;opacity:0.5"/></g>',
      { ...PAINT_CONFIG, stripInlineStyles: ['stroke', 'opacity'] },
    )
    sm.init()
    const el = svg.getElementById('r1') as SVGElement
    expect(el.style.getPropertyValue('fill')).toBe('none')
    expect(el.style.getPropertyValue('stroke')).toBe('')
    expect(el.style.getPropertyValue('opacity')).toBe('')
    sm.destroy()
  })

  it('drops the style attribute when nothing is left in it', () => {
    const { svg, sm } = setupWithConfig(
      '<g id="rooms"><rect id="r1" style="fill:none"/></g>',
      { ...PAINT_CONFIG, stripInlineStyles: 'managed' },
    )
    sm.init()
    expect(svg.getElementById('r1')!.hasAttribute('style')).toBe(false)
    sm.destroy()
  })

  it('strips flat children of a <g> wrapper but never nested <g> artwork', () => {
    const { svg, sm } = setupWithConfig(
      '<g id="rooms"><g id="r1"><rect id="shape" style="fill:none"/>' +
      '<g id="icon" style="fill:gold"><path id="ipath" style="fill:gold"/></g></g></g>',
      { ...PAINT_CONFIG, stripInlineStyles: 'managed' },
    )
    sm.init()
    expect(svg.getElementById('shape')!.hasAttribute('style')).toBe(false)
    expect(svg.getElementById('icon')!.getAttribute('style')).toBe('fill:gold')
    expect(svg.getElementById('ipath')!.getAttribute('style')).toBe('fill:gold')
    sm.destroy()
  })

  it('ignores layers that are not interactive', () => {
    const svg = makeSvgEl('<g id="rooms"><rect id="r1" style="fill:none"/></g>')
    const layers = new Map<string, ParsedLayer>([
      ['rooms', { element: svg.getElementById('rooms') as SVGGElement, role: 'data' }],
    ])
    const sm = new StyleManager(
      { ...PAINT_CONFIG, stripInlineStyles: 'all' },
      () => layers,
      () => new Map<string, BoundElement>(),
    )
    sm.init()
    expect(svg.getElementById('r1')!.getAttribute('style')).toBe('fill:none')
    sm.destroy()
  })
})
