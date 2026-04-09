import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createApp, defineComponent, ref, h, nextTick } from 'vue'
import { SvgicVue } from '../src/adapters/vue/SvgicComponent'
import { Svgic } from '../src/core/Svgic'
import type { SvgicItem } from '../src/types'

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

/** Wait for async init() to complete: several microtasks (loadSvg + .catch() + createClient) */
async function waitForReady() {
  await nextTick()
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
  await nextTick()
}

let container: HTMLElement

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  vi.mocked(loadSvg).mockResolvedValue(makeSvgEl())
})

afterEach(() => {
  container.remove()
  vi.clearAllMocks()
})

// ---- mount ----

describe('SvgicVue — mount', () => {
  it('mounts without errors and renders wrapper div', async () => {
    const app = createApp(SvgicVue, { src: '' })
    app.mount(container)
    await nextTick()
    expect(container.querySelector('div')).not.toBeNull()
    await waitForReady()
    app.unmount()
  })

  it('inserts SVG into DOM after ready', async () => {
    const app = createApp(SvgicVue, { src: '' })
    app.mount(container)
    await waitForReady()
    expect(container.querySelector('svg')).not.toBeNull()
    app.unmount()
  })

  it('calls loadSvg with provided src on mount', async () => {
    const app = createApp(SvgicVue, { src: '/my-map.svg' })
    app.mount(container)
    await waitForReady()
    expect(loadSvg).toHaveBeenCalledWith('/my-map.svg')
    app.unmount()
  })
})

// ---- unmount ----

describe('SvgicVue — unmount', () => {
  it('removes SVG from DOM on unmount', async () => {
    const app = createApp(SvgicVue, { src: '' })
    app.mount(container)
    await waitForReady()
    expect(container.querySelector('svg')).not.toBeNull()
    app.unmount()
    expect(container.querySelector('svg')).toBeNull()
  })

  it('calls client.destroy() on unmount', async () => {
    const destroySpy = vi.spyOn(Svgic.prototype, 'destroy')
    const app = createApp(SvgicVue, { src: '' })
    app.mount(container)
    await waitForReady()
    app.unmount()
    expect(destroySpy).toHaveBeenCalledOnce()
    destroySpy.mockRestore()
  })
})

// ---- watch data ----

describe('SvgicVue — watch data', () => {
  it('calls client.setData when prop data changes', async () => {
    const setDataSpy = vi.spyOn(Svgic.prototype, 'setData')

    const data = ref<SvgicItem[]>([{ id: 'r1', title: 'R1' }])

    // Wrapper component with reactive data
    const Wrapper = defineComponent({
      setup: () => ({ data }),
      render() {
        return h(SvgicVue, { src: '', data: this.data as SvgicItem[] })
      },
    })

    const app = createApp(Wrapper)
    app.mount(container)
    await waitForReady()

    setDataSpy.mockClear()
    data.value = [{ id: 'r2', title: 'R2' }]
    await nextTick()

    expect(setDataSpy).toHaveBeenCalledOnce()
    expect(setDataSpy).toHaveBeenCalledWith([{ id: 'r2', title: 'R2' }])

    app.unmount()
    setDataSpy.mockRestore()
  })

  it('does not call setData if data is not provided', async () => {
    const setDataSpy = vi.spyOn(Svgic.prototype, 'setData')

    const app = createApp(SvgicVue, { src: '' })
    app.mount(container)
    await waitForReady()

    expect(setDataSpy).not.toHaveBeenCalled()
    app.unmount()
    setDataSpy.mockRestore()
  })
})

// ---- watch src ----

describe('SvgicVue — watch src', () => {
  it('recreates client and calls loadSvg with new src when src changes', async () => {
    const src = ref('/map-a.svg')

    const Wrapper = defineComponent({
      setup: () => ({ src }),
      render() {
        return h(SvgicVue, { src: this.src as string })
      },
    })

    const app = createApp(Wrapper)
    app.mount(container)
    await waitForReady()

    expect(loadSvg).toHaveBeenCalledWith('/map-a.svg')
    vi.mocked(loadSvg).mockClear()

    src.value = '/map-b.svg'
    await waitForReady()

    expect(loadSvg).toHaveBeenCalledWith('/map-b.svg')
    app.unmount()
  })

  it('destroys old client when src changes', async () => {
    const destroySpy = vi.spyOn(Svgic.prototype, 'destroy')
    const src = ref('/map-a.svg')

    const Wrapper = defineComponent({
      setup: () => ({ src }),
      render() {
        return h(SvgicVue, { src: this.src as string })
      },
    })

    const app = createApp(Wrapper)
    app.mount(container)
    await waitForReady()

    destroySpy.mockClear()
    src.value = '/map-b.svg'
    await waitForReady()

    expect(destroySpy).toHaveBeenCalledOnce()
    app.unmount()
    destroySpy.mockRestore()
  })
})

// ---- events ----

describe('SvgicVue — events', () => {
  it('emits click on click on bound element', async () => {
    const svgEl = makeSvgEl('<g id="rooms"><rect id="room-1"/></g>')
    vi.mocked(loadSvg).mockResolvedValue(svgEl)

    const onClickSpy = vi.fn()

    const app = createApp(SvgicVue, {
      src: '',
      layers: { rooms: { role: 'interactive' } },
      data: [{ id: 'room-1', title: 'Room 1' }],
      onClick: onClickSpy,
    })
    app.mount(container)
    await waitForReady()

    svgEl.getElementById('room-1')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(onClickSpy).toHaveBeenCalledWith('room-1', expect.objectContaining({ id: 'room-1' }))
    app.unmount()
  })
})
