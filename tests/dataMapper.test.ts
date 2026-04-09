import { describe, it, expect, vi, afterEach } from 'vitest'
import { mapData } from '../src/core/dataMapper'
import type { SvgicItem } from '../src/types'

function makeSvg(inner: string): SVGSVGElement {
  const parser = new DOMParser()
  const doc = parser.parseFromString(
    `<svg xmlns="http://www.w3.org/2000/svg">${inner}</svg>`,
    'image/svg+xml',
  )
  return doc.documentElement as unknown as SVGSVGElement
}

describe('mapData', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('binds item to SVG element by id', () => {
    const svg = makeSvg(`
      <rect id="room-1" x="0" y="0" width="10" height="10"/>
      <rect id="room-2" x="10" y="0" width="10" height="10"/>
    `)
    const data: SvgicItem[] = [
      { id: 'room-1', title: 'Room 1' },
      { id: 'room-2', title: 'Room 2' },
    ]

    const result = mapData(svg, data)

    expect(result.size).toBe(2)
    expect(result.get('room-1')?.item.title).toBe('Room 1')
    expect(result.get('room-1')?.element.tagName.toLowerCase()).toBe('rect')
    expect(result.get('room-2')?.item.title).toBe('Room 2')
  })

  it('stores reference to the same DOM element', () => {
    const svg = makeSvg(`<rect id="r1"/>`)
    const data: SvgicItem[] = [{ id: 'r1' }]

    const result = mapData(svg, data)

    expect(result.get('r1')?.element).toBe(svg.getElementById('r1'))
  })

  it('skips item with no matching SVG element', () => {
    const svg = makeSvg(`<rect id="room-1"/>`)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const data: SvgicItem[] = [
      { id: 'room-1' },
      { id: 'missing' },
    ]

    const result = mapData(svg, data)

    expect(result.size).toBe(1)
    expect(result.has('missing')).toBe(false)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"missing"'))
  })

  it('skips duplicate ids in data', () => {
    const svg = makeSvg(`<rect id="room-1"/>`)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const data: SvgicItem[] = [
      { id: 'room-1', title: 'First' },
      { id: 'room-1', title: 'Duplicate' },
    ]

    const result = mapData(svg, data)

    expect(result.size).toBe(1)
    expect(result.get('room-1')?.item.title).toBe('First')
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"room-1"'))
  })

  it('returns empty Map for empty data', () => {
    const svg = makeSvg(`<rect id="room-1"/>`)
    const result = mapData(svg, [])
    expect(result.size).toBe(0)
  })

  it('preserves custom item fields', () => {
    const svg = makeSvg(`<rect id="zone-a"/>`)
    const data: SvgicItem[] = [{ id: 'zone-a', capacity: 50, status: 'free' }]

    const result = mapData(svg, data)

    expect(result.get('zone-a')?.item.capacity).toBe(50)
    expect(result.get('zone-a')?.item.status).toBe('free')
  })
})
