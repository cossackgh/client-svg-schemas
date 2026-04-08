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

/** Ждём: nextTick (onMounted) + один микротаск (ready promise) + nextTick (DOM-обновление) */
async function waitForReady() {
  await nextTick()
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

// ---- монтирование ----

describe('SvgicVue — монтирование', () => {
  it('монтируется без ошибок и рендерит обёртку div', async () => {
    const app = createApp(SvgicVue, { src: '' })
    app.mount(container)
    await nextTick()
    expect(container.querySelector('div')).not.toBeNull()
    await waitForReady()
    app.unmount()
  })

  it('после ready вставляет SVG в DOM', async () => {
    const app = createApp(SvgicVue, { src: '' })
    app.mount(container)
    await waitForReady()
    expect(container.querySelector('svg')).not.toBeNull()
    app.unmount()
  })

  it('при монтировании вызывает loadSvg с переданным src', async () => {
    const app = createApp(SvgicVue, { src: '/my-map.svg' })
    app.mount(container)
    await waitForReady()
    expect(loadSvg).toHaveBeenCalledWith('/my-map.svg')
    app.unmount()
  })
})

// ---- unmount ----

describe('SvgicVue — unmount', () => {
  it('при unmount SVG удаляется из DOM', async () => {
    const app = createApp(SvgicVue, { src: '' })
    app.mount(container)
    await waitForReady()
    expect(container.querySelector('svg')).not.toBeNull()
    app.unmount()
    expect(container.querySelector('svg')).toBeNull()
  })

  it('при unmount вызывается client.destroy()', async () => {
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
  it('вызывает client.setData при изменении prop data', async () => {
    const setDataSpy = vi.spyOn(Svgic.prototype, 'setData')

    const data = ref<SvgicItem[]>([{ id: 'r1', title: 'R1' }])

    // Wrapper-компонент с реактивным data
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

  it('не вызывает setData если data не задан', async () => {
    const setDataSpy = vi.spyOn(Svgic.prototype, 'setData')

    const app = createApp(SvgicVue, { src: '' })
    app.mount(container)
    await waitForReady()

    expect(setDataSpy).not.toHaveBeenCalled()
    app.unmount()
    setDataSpy.mockRestore()
  })
})

// ---- события ----

describe('SvgicVue — события', () => {
  it('эмитит click при клике на bound-элемент', async () => {
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
