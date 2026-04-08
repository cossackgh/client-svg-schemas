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
  it('бросает ошибку если контейнер не найден', () => {
    expect(() => new Svgic('#nonexistent', { src: '' })).toThrow('[svgic]')
  })

  it('принимает CSS-селектор', async () => {
    vi.mocked(loadSvg).mockResolvedValue(makeSvgEl())
    const client = new Svgic('#test-app', { src: '/test.svg' })
    await client.ready
    expect(container.querySelector('svg')).not.toBeNull()
    client.destroy()
  })

  it('принимает Element напрямую', async () => {
    vi.mocked(loadSvg).mockResolvedValue(makeSvgEl())
    const client = new Svgic(container, { src: '' })
    await client.ready
    expect(container.querySelector('svg')).not.toBeNull()
    client.destroy()
  })

  it('getElement() возвращает null до ready', () => {
    vi.mocked(loadSvg).mockResolvedValue(makeSvgEl())
    const client = new Svgic(container, { src: '' })
    expect(client.getElement()).toBeNull()
    client.destroy()
  })

  it('getElement() возвращает SVGSVGElement после ready', async () => {
    vi.mocked(loadSvg).mockResolvedValue(makeSvgEl())
    const client = new Svgic(container, { src: '' })
    await client.ready
    expect(client.getElement()).toBeInstanceOf(SVGSVGElement)
    client.destroy()
  })
})

// ---- use() ----

describe('Svgic — use()', () => {
  it('вызывает onInit плагина после ready', async () => {
    vi.mocked(loadSvg).mockResolvedValue(makeSvgEl())
    const plugin: SvgicPlugin = { name: 'p', onInit: vi.fn() }
    const client = new Svgic(container, { src: '', plugins: [plugin] })
    await client.ready
    expect(plugin.onInit).toHaveBeenCalledOnce()
    expect(plugin.onInit).toHaveBeenCalledWith(client)
    client.destroy()
  })

  it('use() на готовом клиенте вызывает onInit сразу', async () => {
    vi.mocked(loadSvg).mockResolvedValue(makeSvgEl())
    const client = new Svgic(container, { src: '' })
    await client.ready
    const plugin: SvgicPlugin = { name: 'late', onInit: vi.fn() }
    client.use(plugin)
    expect(plugin.onInit).toHaveBeenCalledOnce()
    client.destroy()
  })

  it('use() до ready не вызывает onInit сразу', () => {
    vi.mocked(loadSvg).mockResolvedValue(makeSvgEl())
    const plugin: SvgicPlugin = { name: 'early', onInit: vi.fn() }
    const client = new Svgic(container, { src: '', plugins: [plugin] })
    // до await ready — onInit ещё не должен быть вызван
    expect(plugin.onInit).not.toHaveBeenCalled()
    client.destroy()
  })
})

// ---- on() ----

describe('Svgic — on()', () => {
  it('регистрирует click-обработчик и вызывает его при клике на bound-элемент', async () => {
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

  it('on() возвращает this для цепочки вызовов', async () => {
    vi.mocked(loadSvg).mockResolvedValue(makeSvgEl())
    const client = new Svgic(container, { src: '' })
    await client.ready
    expect(client.on('click', vi.fn())).toBe(client)
    client.destroy()
  })
})

// ---- setData() ----

describe('Svgic — setData()', () => {
  it('обновляет привязку — новый bound-элемент получает обработчик', async () => {
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

    // r2 ещё не привязан — click не вызовет handler с id='r2'
    svgEl.getElementById('r2')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(handler).not.toHaveBeenCalledWith('r2', expect.anything())

    // привязываем r2 через setData
    client.setData([{ id: 'r2', title: 'R2' }])
    handler.mockClear()

    svgEl.getElementById('r2')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(handler).toHaveBeenCalledWith('r2', expect.objectContaining({ id: 'r2' }))
    client.destroy()
  })

  it('setData() до ready (svgEl не готов) — не бросает', () => {
    vi.mocked(loadSvg).mockResolvedValue(makeSvgEl())
    const client = new Svgic(container, { src: '' })
    expect(() => client.setData([{ id: 'x' }])).not.toThrow()
    client.destroy()
  })
})

// ---- destroy() ----

describe('Svgic — destroy()', () => {
  it('удаляет SVG из DOM', async () => {
    vi.mocked(loadSvg).mockResolvedValue(makeSvgEl())
    const client = new Svgic(container, { src: '' })
    await client.ready
    expect(container.querySelector('svg')).not.toBeNull()
    client.destroy()
    expect(container.querySelector('svg')).toBeNull()
  })

  it('getElement() возвращает null после destroy', async () => {
    vi.mocked(loadSvg).mockResolvedValue(makeSvgEl())
    const client = new Svgic(container, { src: '' })
    await client.ready
    client.destroy()
    expect(client.getElement()).toBeNull()
  })

  it('вызывает onDestroy на каждом плагине', async () => {
    vi.mocked(loadSvg).mockResolvedValue(makeSvgEl())
    const plugin: SvgicPlugin = { name: 'p', onDestroy: vi.fn() }
    const client = new Svgic(container, { src: '', plugins: [plugin] })
    await client.ready
    client.destroy()
    expect(plugin.onDestroy).toHaveBeenCalledOnce()
    expect(plugin.onDestroy).toHaveBeenCalledWith(client)
  })

  it('после destroy click-обработчики не вызываются', async () => {
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
