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

// ---- getLayer() ----

describe('Svgic — getLayer()', () => {
  it('returns null before ready', () => {
    vi.mocked(loadSvg).mockResolvedValue(makeSvgEl('<g id="waypoints"></g>'))
    const client = new Svgic(container, {
      src: '',
      layers: { waypoints: { role: 'data' } },
    })
    expect(client.getLayer('waypoints')).toBeNull()
    client.destroy()
  })

  it('returns layer element and role after ready', async () => {
    vi.mocked(loadSvg).mockResolvedValue(makeSvgEl('<g id="waypoints"></g>'))
    const client = new Svgic(container, {
      src: '',
      layers: { waypoints: { role: 'data' } },
    })
    await client.ready

    const layer = client.getLayer('waypoints')
    expect(layer).not.toBeNull()
    expect(layer!.role).toBe('data')
    expect(layer!.element.tagName.toLowerCase()).toBe('g')
    client.destroy()
  })

  it('returns null for unknown layer id', async () => {
    vi.mocked(loadSvg).mockResolvedValue(makeSvgEl('<g id="rooms"></g>'))
    const client = new Svgic(container, {
      src: '',
      layers: { rooms: { role: 'interactive' } },
    })
    await client.ready

    expect(client.getLayer('nonexistent')).toBeNull()
    client.destroy()
  })

  it('returns null after destroy', async () => {
    vi.mocked(loadSvg).mockResolvedValue(makeSvgEl('<g id="waypoints"></g>'))
    const client = new Svgic(container, {
      src: '',
      layers: { waypoints: { role: 'data' } },
    })
    await client.ready
    client.destroy()

    expect(client.getLayer('waypoints')).toBeNull()
    client.destroy()
  })

  it('plugin can access layer elements via getLayer() in onInit', async () => {
    const svgEl = makeSvgEl(`
      <g id="waypoints">
        <circle id="wp-1" cx="10" cy="10" r="5"/>
        <circle id="wp-2" cx="20" cy="20" r="5"/>
      </g>
    `)
    vi.mocked(loadSvg).mockResolvedValue(svgEl)

    let nodeCount = 0
    const navPlugin: SvgicPlugin = {
      name: 'nav',
      onInit(client) {
        const layer = client.getLayer('waypoints')
        nodeCount = layer?.element.querySelectorAll('circle').length ?? 0
      },
    }

    const client = new Svgic(container, {
      src: '',
      layers: { waypoints: { role: 'data' } },
      plugins: [navPlugin],
    })
    await client.ready

    expect(nodeCount).toBe(2)
    client.destroy()
  })
})

// ---- setSrc() ----

describe('Svgic — setSrc()', () => {
  it('replaces SVG in DOM', async () => {
    const svg1 = makeSvgEl('<g id="rooms"><rect id="r1"/></g>')
    const svg2 = makeSvgEl('<g id="floors"><rect id="f1"/></g>')
    vi.mocked(loadSvg).mockResolvedValueOnce(svg1).mockResolvedValueOnce(svg2)

    const client = new Svgic(container, { src: '/floor-1.svg', layers: { rooms: { role: 'interactive' } } })
    await client.ready
    expect(container.contains(svg1)).toBe(true)

    await client.setSrc('/floor-2.svg')
    expect(container.contains(svg1)).toBe(false)
    expect(container.contains(svg2)).toBe(true)
    client.destroy()
  })

  it('passes new src to loadSvg', async () => {
    vi.mocked(loadSvg)
      .mockResolvedValueOnce(makeSvgEl())
      .mockResolvedValueOnce(makeSvgEl())

    const client = new Svgic(container, { src: '/old.svg' })
    await client.ready
    await client.setSrc('/new.svg')

    expect(vi.mocked(loadSvg)).toHaveBeenNthCalledWith(2, '/new.svg')
    client.destroy()
  })

  it('getElement() returns new SVG after setSrc', async () => {
    const svg1 = makeSvgEl()
    const svg2 = makeSvgEl('<g id="rooms"></g>')
    vi.mocked(loadSvg).mockResolvedValueOnce(svg1).mockResolvedValueOnce(svg2)

    const client = new Svgic(container, { src: '' })
    await client.ready
    expect(client.getElement()).toBe(svg1)

    await client.setSrc('/new.svg')
    expect(client.getElement()).toBe(svg2)
    client.destroy()
  })

  it('preserves on() subscriptions across setSrc', async () => {
    const svg1 = makeSvgEl('<g id="rooms"><rect id="r1"/></g>')
    const svg2 = makeSvgEl('<g id="rooms"><rect id="r1"/></g>')
    vi.mocked(loadSvg).mockResolvedValueOnce(svg1).mockResolvedValueOnce(svg2)

    const client = new Svgic(container, {
      src: '',
      layers: { rooms: { role: 'interactive' } },
      data: [{ id: 'r1', title: 'Room 1' }],
    })
    await client.ready

    const handler = vi.fn()
    client.on('click', handler)

    await client.setSrc('/new.svg')
    client.setData([{ id: 'r1', title: 'Room 1 new' }])

    svg2.getElementById('r1')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(handler).toHaveBeenCalledWith('r1', expect.objectContaining({ id: 'r1' }))
    client.destroy()
  })

  it('clears data — old bound elements do not fire after setSrc', async () => {
    const svg1 = makeSvgEl('<g id="rooms"><rect id="r1"/></g>')
    const svg2 = makeSvgEl('<g id="rooms"><rect id="r1"/></g>')
    vi.mocked(loadSvg).mockResolvedValueOnce(svg1).mockResolvedValueOnce(svg2)

    const client = new Svgic(container, {
      src: '',
      layers: { rooms: { role: 'interactive' } },
      data: [{ id: 'r1', title: 'Room 1' }],
    })
    await client.ready

    const handler = vi.fn()
    client.on('click', handler)

    // setSrc without setData — r1 should be unbound
    await client.setSrc('/new.svg')
    svg2.getElementById('r1')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    // click fires but with null item — element is not bound
    expect(handler).not.toHaveBeenCalledWith('r1', expect.objectContaining({ id: 'r1' }))
    client.destroy()
  })

  it('calls plugin onDestroy then onInit again after setSrc', async () => {
    vi.mocked(loadSvg)
      .mockResolvedValueOnce(makeSvgEl())
      .mockResolvedValueOnce(makeSvgEl())

    const order: string[] = []
    const plugin: SvgicPlugin = {
      name: 'p',
      onInit: vi.fn(() => order.push('init')),
      onDestroy: vi.fn(() => order.push('destroy')),
    }
    const client = new Svgic(container, { src: '', plugins: [plugin] })
    await client.ready

    await client.setSrc('/new.svg')
    expect(order).toEqual(['init', 'destroy', 'init'])
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
