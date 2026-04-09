import { describe, it, expect, vi, afterEach } from 'vitest'
import { parseLayers } from '../src/core/layerParser'

function makeSvg(inner: string): SVGSVGElement {
  const parser = new DOMParser()
  const doc = parser.parseFromString(
    `<svg xmlns="http://www.w3.org/2000/svg">${inner}</svg>`,
    'image/svg+xml',
  )
  return doc.documentElement as unknown as SVGSVGElement
}

describe('parseLayers', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('finds <g> by id and stores role', () => {
    const svg = makeSvg(`
      <g id="rooms"></g>
      <g id="background"></g>
    `)

    const result = parseLayers(svg, {
      rooms: { role: 'interactive' },
      background: { role: 'decorative' },
    })

    expect(result.size).toBe(2)
    expect(result.get('rooms')?.role).toBe('interactive')
    expect(result.get('background')?.role).toBe('decorative')
    expect(result.get('rooms')?.element.tagName.toLowerCase()).toBe('g')
  })

  it('skips missing layer with a warning', () => {
    const svg = makeSvg(`<g id="rooms"></g>`)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const result = parseLayers(svg, {
      rooms: { role: 'interactive' },
      missing: { role: 'decorative' },
    })

    expect(result.size).toBe(1)
    expect(result.has('missing')).toBe(false)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"missing"'))
  })

  it('skips non-<g> element with a warning', () => {
    const svg = makeSvg(`<rect id="background" x="0" y="0" width="10" height="10"/>`)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const result = parseLayers(svg, {
      background: { role: 'decorative' },
    })

    expect(result.size).toBe(0)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"background"'))
  })

  it('returns empty Map for empty config', () => {
    const svg = makeSvg(`<g id="rooms"></g>`)
    const result = parseLayers(svg, {})
    expect(result.size).toBe(0)
  })

  it('returns empty Map without second argument', () => {
    const svg = makeSvg(`<g id="rooms"></g>`)
    const result = parseLayers(svg)
    expect(result.size).toBe(0)
  })

  it('correctly handles ids with special characters', () => {
    const svg = makeSvg(`<g id="layer.1"></g>`)

    const result = parseLayers(svg, {
      'layer.1': { role: 'interactive' },
    })

    expect(result.size).toBe(1)
    expect(result.get('layer.1')?.role).toBe('interactive')
  })

  it('accepts "data" role for plugin-only layers', () => {
    const svg = makeSvg(`<g id="waypoints"></g>`)

    const result = parseLayers(svg, {
      waypoints: { role: 'data' },
    })

    expect(result.size).toBe(1)
    expect(result.get('waypoints')?.role).toBe('data')
  })

  it('accepts arbitrary string role for custom plugin use', () => {
    const svg = makeSvg(`<g id="corridors"></g>`)

    const result = parseLayers(svg, {
      corridors: { role: 'navigation' },
    })

    expect(result.size).toBe(1)
    expect(result.get('corridors')?.role).toBe('navigation')
  })
})
