import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Svgic } from '../src/core/Svgic'
import type { SvgicPlugin } from '../src/types'

vi.mock('../src/core/loader', () => ({
  loadSvg: vi.fn(),
}))

import { loadSvg } from '../src/core/loader'

function makeSvgEl(inner = '<g id="rooms"><rect id="room-1"/></g>'): SVGSVGElement {
  const parser = new DOMParser()
  const doc = parser.parseFromString(
    `<svg xmlns="http://www.w3.org/2000/svg">${inner}</svg>`,
    'image/svg+xml',
  )
  return doc.documentElement as unknown as SVGSVGElement
}

// ---- helpers ----

let container: HTMLElement

beforeEach(() => {
  container = document.createElement('div')
  container.id = 'test-app'
  document.body.appendChild(container)
})

afterEach(() => {
  container.remove()
  vi.clearAllMocks()
})

// ---- init ----

describe('Svgic — init', () => {
  it('throws if container is not found', () => {
    expect(() => new Svgic('#nonexistent', { src: '' })).toThrow('[svgic]')
  })

  it('accepts CSS selector', async () => {
    vi.mocked(loadSvg).mockResolvedValue(makeSvgEl())
    const client = new Svgic('#test-app', { src: '/test.svg' })
    await client.ready
    expect(container.querySelector('svg')).not.toBeNull()
    client.destroy()
  })

  it('accepts Element directly', async () => {
    vi.mocked(loadSvg).mockResolvedValue(makeSvgEl())
    const client = new Svgic(container, { src: '' })
    await client.ready
    expect(container.querySelector('svg')).not.toBeNull()
    client.destroy()
  })

  it('getElement() returns null before ready', () => {
    vi.mocked(loadSvg).mockResolvedValue(makeSvgEl())
    const client = new Svgic(container, { src: '' })
    expect(client.getElement()).toBeNull()
    client.destroy()
  })

  it('getElement() returns SVGSVGElement after ready', async () => {
    vi.mocked(loadSvg).mockResolvedValue(makeSvgEl())
    const client = new Svgic(container, { src: '' })
    await client.ready
    expect(client.getElement()).toBeInstanceOf(SVGSVGElement)
    client.destroy()
  })
})

// ---- use() ----

describe('Svgic — use()', () => {
  it('calls plugin onInit after ready', async () => {
    vi.mocked(loadSvg).mockResolvedValue(makeSvgEl())
    const plugin: SvgicPlugin = { name: 'p', onInit: vi.fn() }
    const client = new Svgic(container, { src: '', plugins: [plugin] })
    await client.ready
    expect(plugin.onInit).toHaveBeenCalledOnce()
    expect(plugin.onInit).toHaveBeenCalledWith(client)
    client.destroy()
  })

  it('use() on ready client calls onInit immediately', async () => {
    vi.mocked(loadSvg).mockResolvedValue(makeSvgEl())
    const client = new Svgic(container, { src: '' })
    await client.ready
    const plugin: SvgicPlugin = { name: 'late', onInit: vi.fn() }
    client.use(plugin)
    expect(plugin.onInit).toHaveBeenCalledOnce()
    client.destroy()
  })

  it('use() before ready does not call onInit immediately', () => {
    vi.mocked(loadSvg).mockResolvedValue(makeSvgEl())
    const plugin: SvgicPlugin = { name: 'early', onInit: vi.fn() }
    const client = new Svgic(container, { src: '', plugins: [plugin] })
    // before await ready — onInit should not have been called yet
    expect(plugin.onInit).not.toHaveBeenCalled()
    client.destroy()
  })
})

// ---- on() ----

describe('Svgic — on()', () => {
  it('registers click handler and calls it on click on bound element', async () => {
    const svgEl = makeSvgEl('<g id="rooms"><rect id="room-1"/></g>')
    vi.mocked(loadSvg).mockResolvedValue(svgEl)

    const client = new Svgic(container, {
      src: '',
      layers: { rooms: { role: 'interactive' } },
      data: [{ id: 'room-1', title: 'Room 1' }],
    })
    await client.ready

    const handler = vi.fn()
    client.on('click', handler)

    svgEl.getElementById('room-1')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(handler).toHaveBeenCalledOnce()
    expect(handler).toHaveBeenCalledWith('room-1', expect.objectContaining({ id: 'room-1' }))
    client.destroy()
  })

  it('on() returns this for method chaining', async () => {
    vi.mocked(loadSvg).mockResolvedValue(makeSvgEl())
    const client = new Svgic(container, { src: '' })
    await client.ready
    expect(client.on('click', vi.fn())).toBe(client)
    client.destroy()
  })
})

// ---- setData() ----

describe('Svgic — setData()', () => {
  it('updates binding — new bound element gets handler', async () => {
    const svgEl = makeSvgEl('<g id="rooms"><rect id="r1"/><rect id="r2"/></g>')
    vi.mocked(loadSvg).mockResolvedValue(svgEl)

    const client = new Svgic(container, {
      src: '',
      layers: { rooms: { role: 'interactive' } },
      data: [{ id: 'r1', title: 'R1' }],
    })
    await client.ready

    const handler = vi.fn()
    client.on('click', handler)

    // r2 is not bound yet — click will not call handler with id='r2'
    svgEl.getElementById('r2')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(handler).not.toHaveBeenCalledWith('r2', expect.anything())

    // bind r2 via setData
    client.setData([{ id: 'r2', title: 'R2' }])
    handler.mockClear()

    svgEl.getElementById('r2')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(handler).toHaveBeenCalledWith('r2', expect.objectContaining({ id: 'r2' }))
    client.destroy()
  })

  it('setData() before ready (svgEl not ready) — does not throw', () => {
    vi.mocked(loadSvg).mockResolvedValue(makeSvgEl())
    const client = new Svgic(container, { src: '' })
    expect(() => client.setData([{ id: 'x' }])).not.toThrow()
    client.destroy()
  })
})

// ---- destroy() ----

describe('Svgic — destroy()', () => {
  it('removes SVG from DOM', async () => {
    vi.mocked(loadSvg).mockResolvedValue(makeSvgEl())
    const client = new Svgic(container, { src: '' })
    await client.ready
    expect(container.querySelector('svg')).not.toBeNull()
    client.destroy()
    expect(container.querySelector('svg')).toBeNull()
  })

  it('getElement() returns null after destroy', async () => {
    vi.mocked(loadSvg).mockResolvedValue(makeSvgEl())
    const client = new Svgic(container, { src: '' })
    await client.ready
    client.destroy()
    expect(client.getElement()).toBeNull()
  })

  it('calls onDestroy on each plugin', async () => {
    vi.mocked(loadSvg).mockResolvedValue(makeSvgEl())
    const plugin: SvgicPlugin = { name: 'p', onDestroy: vi.fn() }
    const client = new Svgic(container, { src: '', plugins: [plugin] })
    await client.ready
    client.destroy()
    expect(plugin.onDestroy).toHaveBeenCalledOnce()
    expect(plugin.onDestroy).toHaveBeenCalledWith(client)
  })

  it('after destroy click handlers are not called', async () => {
    const svgEl = makeSvgEl('<g id="rooms"><rect id="room-1"/></g>')
    vi.mocked(loadSvg).mockResolvedValue(svgEl)

    const client = new Svgic(container, {
      src: '',
      layers: { rooms: { role: 'interactive' } },
      data: [{ id: 'room-1' }],
    })
    await client.ready

    const handler = vi.fn()
    client.on('click', handler)
    client.destroy()

    svgEl.getElementById('room-1')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(handler).not.toHaveBeenCalled()
  })
})
