import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EventManager } from '../src/core/eventManager'
import type { ParsedLayer } from '../src/core/layerParser'
import type { BoundElement } from '../src/core/dataMapper'
import type { SvgicPlugin } from '../src/types'

function makeSvg(inner: string): SVGSVGElement {
  const parser = new DOMParser()
  const doc = parser.parseFromString(
    `<svg xmlns="http://www.w3.org/2000/svg">${inner}</svg>`,
    'image/svg+xml',
  )
  return doc.documentElement as unknown as SVGSVGElement
}

function fireMouseEvent(target: Element, type: string, relatedTarget?: Element) {
  target.dispatchEvent(new MouseEvent(type, { bubbles: true, relatedTarget: relatedTarget ?? null }))
}

// ---- setup helpers ----

function setup(svgInner: string, boundIds: string[]) {
  const svg = makeSvg(svgInner)
  const layerEl = svg.getElementById('rooms') as SVGGElement

  const layers = new Map<string, ParsedLayer>([
    ['rooms', { element: layerEl, role: 'interactive' }],
  ])

  const boundElements = new Map<string, BoundElement>(
    boundIds.map(id => [
      id,
      { element: svg.getElementById(id) as SVGElement, item: { id, title: `Title ${id}` } },
    ]),
  )

  const plugins: SvgicPlugin[] = []

  const em = new EventManager(
    () => layers,
    () => boundElements,
    () => plugins,
  )
  em.attach()

  return { svg, layerEl, boundElements, plugins, em }
}

// ---- tests ----

describe('EventManager — click', () => {
  it('calls handler with id and item on click on bound element', () => {
    const { svg, em } = setup(
      `<g id="rooms"><rect id="room-1"/></g>`,
      ['room-1'],
    )
    const handler = vi.fn()
    em.on('click', handler)

    fireMouseEvent(svg.getElementById('room-1')!, 'click')

    expect(handler).toHaveBeenCalledOnce()
    expect(handler).toHaveBeenCalledWith('room-1', expect.objectContaining({ id: 'room-1' }))
  })

  it('does not call handler if plugin returned false', () => {
    const { svg, em, plugins } = setup(
      `<g id="rooms"><rect id="room-1"/></g>`,
      ['room-1'],
    )
    plugins.push({ name: 'test', onElementClick: () => false })
    const handler = vi.fn()
    em.on('click', handler)

    fireMouseEvent(svg.getElementById('room-1')!, 'click')

    expect(handler).not.toHaveBeenCalled()
  })

  it('calls handler with empty id and null item on click on unknown element', () => {
    const { svg, em } = setup(
      `<g id="rooms"><rect id="room-1"/><rect id="unknown"/></g>`,
      ['room-1'],
    )
    const handler = vi.fn()
    em.on('click', handler)

    fireMouseEvent(svg.getElementById('unknown')!, 'click')

    expect(handler).toHaveBeenCalledWith('', null)
  })

  it('finds id when clicking child element of bound group', () => {
    const { svg, em } = setup(
      `<g id="rooms"><g id="room-1"><rect id="inner"/></g></g>`,
      ['room-1'],
    )
    const handler = vi.fn()
    em.on('click', handler)

    fireMouseEvent(svg.getElementById('inner')!, 'click')

    expect(handler).toHaveBeenCalledWith('room-1', expect.objectContaining({ id: 'room-1' }))
  })
})

describe('EventManager — hover/leave', () => {
  let svg: SVGSVGElement
  let layerEl: SVGGElement
  let em: EventManager

  beforeEach(() => {
    ;({ svg, layerEl, em } = setup(
      `<g id="rooms"><rect id="room-1"/><rect id="room-2"/></g>`,
      ['room-1', 'room-2'],
    ))
  })

  it('fires hover on mouseover', () => {
    const handler = vi.fn()
    em.on('hover', handler)

    fireMouseEvent(svg.getElementById('room-1')!, 'mouseover')

    expect(handler).toHaveBeenCalledOnce()
    expect(handler).toHaveBeenCalledWith('room-1', expect.objectContaining({ id: 'room-1' }))
  })

  it('does not duplicate hover on repeated mouseover on same element', () => {
    const handler = vi.fn()
    em.on('hover', handler)

    fireMouseEvent(svg.getElementById('room-1')!, 'mouseover')
    fireMouseEvent(svg.getElementById('room-1')!, 'mouseover')

    expect(handler).toHaveBeenCalledOnce()
  })

  it('fires leave and new hover when switching elements', () => {
    const hoverHandler = vi.fn()
    const leaveHandler = vi.fn()
    em.on('hover', hoverHandler)
    em.on('leave', leaveHandler)

    fireMouseEvent(svg.getElementById('room-1')!, 'mouseover')
    fireMouseEvent(svg.getElementById('room-2')!, 'mouseover')

    expect(leaveHandler).toHaveBeenCalledWith('room-1', expect.objectContaining({ id: 'room-1' }))
    expect(hoverHandler).toHaveBeenCalledTimes(2)
    expect(hoverHandler).toHaveBeenLastCalledWith('room-2', expect.objectContaining({ id: 'room-2' }))
  })

  it('fires leave when moving outside the layer', () => {
    const leaveHandler = vi.fn()
    em.on('leave', leaveHandler)

    fireMouseEvent(svg.getElementById('room-1')!, 'mouseover')
    // mouseout with relatedTarget outside the layer
    fireMouseEvent(layerEl, 'mouseout', svg as unknown as Element)

    expect(leaveHandler).toHaveBeenCalledWith('room-1', expect.objectContaining({ id: 'room-1' }))
  })

  it('does not fire leave when moving between child elements of the layer', () => {
    const leaveHandler = vi.fn()
    em.on('leave', leaveHandler)

    fireMouseEvent(svg.getElementById('room-1')!, 'mouseover')
    // mouseout with relatedTarget inside the layer
    fireMouseEvent(layerEl, 'mouseout', svg.getElementById('room-2')!)

    expect(leaveHandler).not.toHaveBeenCalled()
  })
})

describe('EventManager — destroy', () => {
  it('does not call handlers after destroy', () => {
    const { svg, em } = setup(
      `<g id="rooms"><rect id="room-1"/></g>`,
      ['room-1'],
    )
    const handler = vi.fn()
    em.on('click', handler)
    em.destroy()

    fireMouseEvent(svg.getElementById('room-1')!, 'click')

    expect(handler).not.toHaveBeenCalled()
  })
})
