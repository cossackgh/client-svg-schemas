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

  it('находит <g> по id и сохраняет роль', () => {
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

  it('пропускает отсутствующий слой с предупреждением', () => {
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

  it('пропускает элемент не-<g> с предупреждением', () => {
    const svg = makeSvg(`<rect id="background" x="0" y="0" width="10" height="10"/>`)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const result = parseLayers(svg, {
      background: { role: 'decorative' },
    })

    expect(result.size).toBe(0)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"background"'))
  })

  it('возвращает пустой Map при пустом конфиге', () => {
    const svg = makeSvg(`<g id="rooms"></g>`)
    const result = parseLayers(svg, {})
    expect(result.size).toBe(0)
  })

  it('возвращает пустой Map без второго аргумента', () => {
    const svg = makeSvg(`<g id="rooms"></g>`)
    const result = parseLayers(svg)
    expect(result.size).toBe(0)
  })

  it('корректно обрабатывает id со спецсимволами', () => {
    const svg = makeSvg(`<g id="layer.1"></g>`)

    const result = parseLayers(svg, {
      'layer.1': { role: 'interactive' },
    })

    expect(result.size).toBe(1)
    expect(result.get('layer.1')?.role).toBe('interactive')
  })
})
