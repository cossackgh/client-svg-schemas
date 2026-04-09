import { describe, it, expect, vi, afterEach } from 'vitest'
import { mapData } from '../src/core/dataMapper'
import type { ParsedLayer } from '../src/core/layerParser'
import type { SvgicItem } from '../src/types'

function makeLayer(inner: string): Map<string, ParsedLayer> {
  const parser = new DOMParser()
  const doc = parser.parseFromString(
    `<svg xmlns="http://www.w3.org/2000/svg"><g id="rooms">${inner}</g></svg>`,
    'image/svg+xml',
  )
  const g = doc.getElementById('rooms') as unknown as SVGGElement
  return new Map([['rooms', { element: g, role: 'interactive' }]])
}

describe('mapData', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('binds item to SVG element by id', () => {
    const layers = makeLayer(`
      <rect id="room-1" x="0" y="0" width="10" height="10"/>
      <rect id="room-2" x="10" y="0" width="10" height="10"/>
    `)
    const data: SvgicItem[] = [
      { id: 'room-1', title: 'Room 1' },
      { id: 'room-2', title: 'Room 2' },
    ]

    const result = mapData(layers, data)

    expect(result.size).toBe(2)
    expect(result.get('room-1')?.item.title).toBe('Room 1')
    expect(result.get('room-1')?.element.tagName.toLowerCase()).toBe('rect')
    expect(result.get('room-2')?.item.title).toBe('Room 2')
  })

  it('stores reference to the same DOM element', () => {
    const layers = makeLayer(`<rect id="r1"/>`)
    const data: SvgicItem[] = [{ id: 'r1' }]

    const result = mapData(layers, data)
    const layer = [...layers.values()][0]

    expect(result.get('r1')?.element).toBe(layer.element.querySelector('#r1'))
  })

  it('skips item with no matching SVG element in interactive layers', () => {
    const layers = makeLayer(`<rect id="room-1"/>`)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const data: SvgicItem[] = [
      { id: 'room-1' },
      { id: 'missing' },
    ]

    const result = mapData(layers, data)

    expect(result.size).toBe(1)
    expect(result.has('missing')).toBe(false)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"missing"'))
  })

  it('skips duplicate ids in data', () => {
    const layers = makeLayer(`<rect id="room-1"/>`)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const data: SvgicItem[] = [
      { id: 'room-1', title: 'First' },
      { id: 'room-1', title: 'Duplicate' },
    ]

    const result = mapData(layers, data)

    expect(result.size).toBe(1)
    expect(result.get('room-1')?.item.title).toBe('First')
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"room-1"'))
  })

  it('returns empty Map for empty data', () => {
    const layers = makeLayer(`<rect id="room-1"/>`)
    const result = mapData(layers, [])
    expect(result.size).toBe(0)
  })

  it('preserves custom item fields', () => {
    const layers = makeLayer(`<rect id="zone-a"/>`)
    const data: SvgicItem[] = [{ id: 'zone-a', capacity: 50, status: 'free' }]

    const result = mapData(layers, data)

    expect(result.get('zone-a')?.item.capacity).toBe(50)
    expect(result.get('zone-a')?.item.status).toBe('free')
  })

  it('ignores elements in non-interactive layers', () => {
    const parser = new DOMParser()
    const doc = parser.parseFromString(
      `<svg xmlns="http://www.w3.org/2000/svg">
        <g id="rooms"><rect id="room-1"/></g>
        <g id="waypoints"><circle id="wp-1"/></g>
      </svg>`,
      'image/svg+xml',
    )
    const layers = new Map<string, ParsedLayer>([
      ['rooms',     { element: doc.getElementById('rooms') as unknown as SVGGElement,     role: 'interactive' }],
      ['waypoints', { element: doc.getElementById('waypoints') as unknown as SVGGElement, role: 'data' }],
    ])
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const result = mapData(layers, [
      { id: 'room-1' },
      { id: 'wp-1' },   // in 'data' layer — should be skipped
    ])

    expect(result.size).toBe(1)
    expect(result.has('room-1')).toBe(true)
    expect(result.has('wp-1')).toBe(false)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"wp-1"'))
  })
})
