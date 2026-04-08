import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ZoomController } from '../src/plugins/zoom/ZoomController'
import { ZoomPlugin } from '../src/plugins/zoom/ZoomPlugin'
import type { ISvgic, SvgicItem } from '../src/types'

// ─── helpers ─────────────────────────────────────────────────────────────────

function makeSvgEl(viewBox = '0 0 800 600'): SVGSVGElement {
  const NS = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(NS, 'svg') as SVGSVGElement
  svg.setAttribute('viewBox', viewBox)
  const g = document.createElementNS(NS, 'g')
  g.id = 'rooms'
  const rect = document.createElementNS(NS, 'rect')
  rect.id = 'room-1'
  rect.setAttribute('x', '100')
  rect.setAttribute('y', '100')
  rect.setAttribute('width', '200')
  rect.setAttribute('height', '150')
  g.appendChild(rect)
  svg.appendChild(g)
  return svg
}

function mockBCR(svg: SVGSVGElement, w = 800, h = 600, left = 0, top = 0): void {
  vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({
    left, top, width: w, height: h,
    right: left + w, bottom: top + h, x: left, y: top,
    toJSON: () => {},
  } as DOMRect)
}

/** Читает viewBox из атрибута в виде числового массива [x, y, w, h] */
function vbAttr(svg: SVGSVGElement): number[] {
  return svg.getAttribute('viewBox')!.split(' ').map(Number)
}

function fireWheel(svg: SVGSVGElement, deltaY: number, ctrlKey = false): void {
  svg.dispatchEvent(new WheelEvent('wheel', { deltaY, ctrlKey, bubbles: true, cancelable: true }))
}

function makeTouch(id: number, x: number, y: number, target: EventTarget): Touch {
  return { identifier: id, target, clientX: x, clientY: y, pageX: x, pageY: y, screenX: x, screenY: y, radiusX: 0, radiusY: 0, rotationAngle: 0, force: 1 } as unknown as Touch
}

function fireTouchStart(svg: SVGSVGElement, ...touches: Touch[]): void {
  svg.dispatchEvent(new TouchEvent('touchstart', { touches, changedTouches: touches, bubbles: true, cancelable: true }))
}

function fireTouchMove(svg: SVGSVGElement, ...touches: Touch[]): void {
  svg.dispatchEvent(new TouchEvent('touchmove', { touches, changedTouches: touches, bubbles: true, cancelable: true }))
}

function fireTouchEnd(svg: SVGSVGElement, remaining: Touch[] = []): void {
  svg.dispatchEvent(new TouchEvent('touchend', { touches: remaining, changedTouches: remaining, bubbles: true }))
}

function makeFakeClient(svg: SVGSVGElement): ISvgic {
  return {
    ready: Promise.resolve(),
    getElement: () => svg,
    on: vi.fn((_event, _handler) => { return undefined as unknown as ISvgic }),
    use: vi.fn().mockReturnThis(),
    setData: vi.fn(),
    setHighlight: vi.fn(),
    clearHighlight: vi.fn(),
    destroy: vi.fn(),
  }
}

// ─── setup ───────────────────────────────────────────────────────────────────

let svg: SVGSVGElement
let ctrl: ZoomController

beforeEach(() => {
  svg = makeSvgEl()
  document.body.appendChild(svg)
  mockBCR(svg)
})

afterEach(() => {
  ctrl?.destroy()
  svg.remove()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

// ─── ZoomController — init ───────────────────────────────────────────────────

describe('ZoomController — init', () => {
  it('читает viewBox из SVG-атрибута', () => {
    ctrl = new ZoomController(svg, {})
    const state = ctrl.getState()
    expect(state.scale).toBe(1)
    expect(state.x).toBe(0)
    expect(state.y).toBe(0)
  })

  it('выставляет cursor: grab при pan: true', () => {
    ctrl = new ZoomController(svg, { pan: true })
    expect(svg.style.cursor).toBe('grab')
  })

  it('не выставляет cursor при pan: false', () => {
    ctrl = new ZoomController(svg, { pan: false })
    expect(svg.style.cursor).toBe('')
  })

  it('выставляет userSelect: none', () => {
    ctrl = new ZoomController(svg, {})
    expect(svg.style.userSelect).toBe('none')
  })
})

// ─── ZoomController — zoomTo ─────────────────────────────────────────────────

describe('ZoomController — zoomTo', () => {
  it('zoomTo(2) устанавливает scale=2 и обновляет viewBox', () => {
    ctrl = new ZoomController(svg, { animate: false })
    ctrl.zoomTo(2, { animate: false })
    const [, , w, h] = vbAttr(svg)
    expect(ctrl.getState().scale).toBe(2)
    expect(w).toBeCloseTo(400) // 800/2
    expect(h).toBeCloseTo(300) // 600/2
  })

  it('zoomTo clamp снизу по minScale', () => {
    ctrl = new ZoomController(svg, { minScale: 1, animate: false })
    ctrl.zoomTo(0.1, { animate: false })
    expect(ctrl.getState().scale).toBe(1)
  })

  it('zoomTo clamp сверху по maxScale', () => {
    ctrl = new ZoomController(svg, { maxScale: 5, animate: false })
    ctrl.zoomTo(20, { animate: false })
    expect(ctrl.getState().scale).toBe(5)
  })

  it('getState() возвращает копию — мутация не влияет на внутреннее состояние', () => {
    ctrl = new ZoomController(svg, { animate: false })
    const state = ctrl.getState()
    state.scale = 999
    expect(ctrl.getState().scale).toBe(1)
  })
})

// ─── ZoomController — panTo ──────────────────────────────────────────────────

describe('ZoomController — panTo', () => {
  it('panTo перемещает viewBox когда zoomed in', () => {
    ctrl = new ZoomController(svg, { animate: false })
    ctrl.zoomTo(2, { animate: false }) // x=200, y=150
    ctrl.panTo(250, 200, { animate: false })
    const state = ctrl.getState()
    expect(state.x).toBe(250)
    expect(state.y).toBe(200)
  })

  it('panTo ограничивает pan границами SVG', () => {
    ctrl = new ZoomController(svg, { animate: false })
    ctrl.zoomTo(2, { animate: false })
    ctrl.panTo(9999, 9999, { animate: false })
    const state = ctrl.getState()
    // максимум x = ovb.x + ovb.width - viewBox.width = 0+800-400 = 400
    expect(state.x).toBe(400)
    expect(state.y).toBe(300)
  })
})

// ─── ZoomController — reset ──────────────────────────────────────────────────

describe('ZoomController — reset', () => {
  it('reset возвращает к scale=1 и исходному viewBox', () => {
    ctrl = new ZoomController(svg, { animate: false })
    ctrl.zoomTo(3, { animate: false })
    ctrl.reset({ animate: false })
    const state = ctrl.getState()
    expect(state.scale).toBe(1)
    expect(state.x).toBe(0)
    expect(state.y).toBe(0)
    expect(vbAttr(svg)).toEqual([0, 0, 800, 600])
  })
})

// ─── ZoomController — wheel ──────────────────────────────────────────────────

describe('ZoomController — wheel', () => {
  it('wheelMode:ctrl + Ctrl зажат → зум', () => {
    ctrl = new ZoomController(svg, { wheelMode: 'ctrl', animate: false })
    fireWheel(svg, -100, true) // deltaY<0 → zoom in
    expect(ctrl.getState().scale).toBeGreaterThan(1)
  })

  it('wheelMode:ctrl без Ctrl → игнорируется', () => {
    ctrl = new ZoomController(svg, { wheelMode: 'ctrl', animate: false })
    fireWheel(svg, -100, false)
    expect(ctrl.getState().scale).toBe(1)
  })

  it('wheelMode:always без Ctrl → зум', () => {
    ctrl = new ZoomController(svg, { wheelMode: 'always', animate: false })
    fireWheel(svg, -100, false)
    expect(ctrl.getState().scale).toBeGreaterThan(1)
  })

  it('deltaY > 0 → zoom out (scale уменьшается)', () => {
    ctrl = new ZoomController(svg, { wheelMode: 'always', animate: false })
    fireWheel(svg, 100, false)
    expect(ctrl.getState().scale).toBeLessThan(1)
  })
})

// ─── ZoomController — drag ───────────────────────────────────────────────────

describe('ZoomController — drag (mouse pan)', () => {
  it('drag перемещает viewBox когда zoomed in', () => {
    ctrl = new ZoomController(svg, { animate: false })
    ctrl.zoomTo(2, { animate: false }) // x=200, y=150, viewBox 400×300

    // Drag: начало (400, 300), движение на (+50, +10)
    svg.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: 400, clientY: 300, bubbles: true }))
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 450, clientY: 310, bubbles: true }))

    const state = ctrl.getState()
    // scaleX=400/800=0.5, dy=-50*0.5=-25 → x = 200-25 = 175
    expect(state.x).toBeCloseTo(175)
    expect(state.y).toBeCloseTo(145)
  })

  it('drag не срабатывает при движении < 3px', () => {
    ctrl = new ZoomController(svg, { animate: false })
    ctrl.zoomTo(2, { animate: false })

    svg.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: 400, clientY: 300, bubbles: true }))
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 401, clientY: 300, bubbles: true }))

    // 1px движение — hasDragged=false, viewBox не меняется
    expect(ctrl.getState().x).toBeCloseTo(200)
  })

  it('mouseup завершает drag, cursor возвращается к grab', () => {
    ctrl = new ZoomController(svg, { animate: false })
    svg.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: 400, clientY: 300, bubbles: true }))
    expect(svg.style.cursor).toBe('grabbing')
    window.dispatchEvent(new MouseEvent('mouseup', {}))
    expect(svg.style.cursor).toBe('grab')
  })

  it('pan: false — mousedown не меняет cursor', () => {
    ctrl = new ZoomController(svg, { pan: false, animate: false })
    svg.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: 400, clientY: 300, bubbles: true }))
    expect(svg.style.cursor).not.toBe('grabbing')
  })
})

// ─── ZoomController — touch ──────────────────────────────────────────────────

describe('ZoomController — touch', () => {
  it('pinch-zoom увеличивает масштаб пропорционально расстоянию', () => {
    ctrl = new ZoomController(svg, { animate: false })

    // два пальца на расстоянии 200px
    const t1 = makeTouch(0, 200, 200, svg)
    const t2 = makeTouch(1, 400, 200, svg)
    fireTouchStart(svg, t1, t2) // lastPinchDist = 200

    // разводим до 300px
    const t1b = makeTouch(0, 150, 200, svg)
    const t2b = makeTouch(1, 450, 200, svg)
    fireTouchMove(svg, t1b, t2b)

    // factor = 300/200 = 1.5
    expect(ctrl.getState().scale).toBeCloseTo(1.5)
  })

  it('двойной тап zoom — удваивает масштаб', () => {
    vi.useFakeTimers()
    ctrl = new ZoomController(svg, { doubleTapScale: 2, animate: false })

    const t = makeTouch(0, 200, 150, svg)
    fireTouchStart(svg, t) // первый тап
    fireTouchEnd(svg)
    fireTouchStart(svg, t) // второй тап сразу (< 300ms, < 20px)

    expect(ctrl.getState().scale).toBe(2)
  })

  it('двойной тап сброс — если уже на maxScale*0.9', () => {
    vi.useFakeTimers()
    ctrl = new ZoomController(svg, { doubleTapScale: 2, animate: false })
    ctrl.zoomTo(2, { animate: false }) // scale=2 >= 2*0.9=1.8

    const t = makeTouch(0, 400, 300, svg)
    fireTouchStart(svg, t)
    fireTouchEnd(svg)
    fireTouchStart(svg, t) // двойной тап → reset

    expect(ctrl.getState().scale).toBe(1)
  })

  it('pan одним пальцем работает как drag', () => {
    ctrl = new ZoomController(svg, { animate: false })
    ctrl.zoomTo(2, { animate: false }) // x=200, y=150

    const t1 = makeTouch(0, 400, 300, svg)
    fireTouchStart(svg, t1)

    const t2 = makeTouch(0, 350, 270, svg) // −50, −30 → hasDragged
    fireTouchMove(svg, t2)

    // scaleX=400/800=0.5, scaleY=300/600=0.5
    // rawX = 200 - (-50)*0.5 = 225, rawY = 150 - (-30)*0.5 = 165
    expect(ctrl.getState().x).toBeCloseTo(225)
    expect(ctrl.getState().y).toBeCloseTo(165)
  })
})

// ─── ZoomController — focusElement ───────────────────────────────────────────

describe('ZoomController — focusElement', () => {
  // CSS.escape и getBBox не реализованы в jsdom — мокаем
  beforeEach(() => {
    vi.stubGlobal('CSS', { escape: (s: string) => s })
  })

  function mockGetBBox(el: Element, bbox = { x: 100, y: 100, width: 200, height: 150 }) {
    // jsdom не расширяет SVGGraphicsElement правильно — патчим прототип и добавляем getBBox
    Object.setPrototypeOf(el, SVGGraphicsElement.prototype)
    ;(el as unknown as Record<string, unknown>)['getBBox'] = () => bbox
  }

  it('focusElement(id) центрирует viewBox на элементе', () => {
    ctrl = new ZoomController(svg, { focusScale: 2, animate: false })
    mockGetBBox(svg.querySelector('#room-1')!)

    ctrl.focusElement('room-1', { animate: false })

    // bbox center: (200, 175), scale=2 → newW=400, newH=300
    // cx=200, cy=175 → x=200-200=0, y=175-150=25
    const state = ctrl.getState()
    expect(state.scale).toBe(2)
    expect(state.x).toBeCloseTo(0)
    expect(state.y).toBeCloseTo(25)
  })

  it('focusElement игнорирует несуществующий id', () => {
    ctrl = new ZoomController(svg, { animate: false })
    // querySelector вернёт null → instanceof SVGGraphicsElement = false → return early
    expect(() => ctrl.focusElement('nonexistent', { animate: false })).not.toThrow()
    expect(ctrl.getState().scale).toBe(1)
  })

  it('focusElement принимает SVGElement напрямую', () => {
    ctrl = new ZoomController(svg, { focusScale: 2, animate: false })
    const el = svg.querySelector('#room-1') as SVGGraphicsElement
    mockGetBBox(el)
    ctrl.focusElement(el, { animate: false })
    expect(ctrl.getState().scale).toBe(2)
  })
})

// ─── ZoomController — svgic:viewchange ───────────────────────────────────────

describe('ZoomController — svgic:viewchange', () => {
  it('диспатчит svgic:viewchange при zoomTo', () => {
    ctrl = new ZoomController(svg, { animate: false })
    const spy = vi.fn()
    svg.addEventListener('svgic:viewchange', spy)
    ctrl.zoomTo(2, { animate: false })
    expect(spy).toHaveBeenCalled()
  })

  it('диспатчит svgic:viewchange при panTo', () => {
    ctrl = new ZoomController(svg, { animate: false })
    ctrl.zoomTo(2, { animate: false })
    const spy = vi.fn()
    svg.addEventListener('svgic:viewchange', spy)
    ctrl.panTo(250, 200, { animate: false })
    expect(spy).toHaveBeenCalled()
  })
})

// ─── ZoomController — panBounds ──────────────────────────────────────────────

describe('ZoomController — panBounds', () => {
  it('panBounds:true — pan не выходит за границы SVG', () => {
    ctrl = new ZoomController(svg, { panBounds: true, animate: false })
    ctrl.zoomTo(2, { animate: false })
    ctrl.panTo(-9999, -9999, { animate: false })
    const state = ctrl.getState()
    expect(state.x).toBeGreaterThanOrEqual(0)
    expect(state.y).toBeGreaterThanOrEqual(0)
  })

  it('panBounds:false — pan не ограничен', () => {
    ctrl = new ZoomController(svg, { panBounds: false, animate: false })
    ctrl.zoomTo(2, { animate: false })
    ctrl.panTo(-500, -300, { animate: false })
    const state = ctrl.getState()
    expect(state.x).toBe(-500)
    expect(state.y).toBe(-300)
  })
})

// ─── ZoomController — animateTo ──────────────────────────────────────────────

describe('ZoomController — animateTo', () => {
  // performance.now() не фейкается vi.useFakeTimers() по умолчанию.
  // Мокаем requestAnimationFrame и performance.now() вручную.

  let fakeTime = 0
  let rafQueue: Array<{ id: number; cb: FrameRequestCallback }> = []
  let rafCounter = 0

  beforeEach(() => {
    fakeTime = 0
    rafQueue = []
    rafCounter = 0

    vi.spyOn(performance, 'now').mockImplementation(() => fakeTime)

    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      const id = ++rafCounter
      rafQueue.push({ id, cb })
      return id
    })

    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
      rafQueue = rafQueue.filter(r => r.id !== id)
    })
  })

  /** Запустить один батч RAF-коллбэков с указанным временем */
  function driveAnimation(toMs: number): void {
    fakeTime = toMs
    const batch = rafQueue.splice(0)
    batch.forEach(({ cb }) => cb(fakeTime))
  }

  it('анимация к zoomTo(2) завершается корректно', () => {
    ctrl = new ZoomController(svg, { animate: true, animationDuration: 300 })
    ctrl.zoomTo(2) // schedules first RAF

    driveAnimation(400) // t = (400-0)/300 > 1 → completes

    expect(ctrl.getState().scale).toBeCloseTo(2)
  })

  it('новая анимация отменяет предыдущую', () => {
    ctrl = new ZoomController(svg, { animate: true, animationDuration: 300 })
    ctrl.zoomTo(3)
    driveAnimation(100) // t=0.33 → промежуточный кадр, ставит следующий RAF

    ctrl.zoomTo(2)     // cancelAnimationFrame + новая анимация
    driveAnimation(600) // t=(600-100)/300 > 1 → завершает анимацию к 2

    expect(ctrl.getState().scale).toBeCloseTo(2)
  })

  it('диспатчит svgic:viewchange во время анимации', () => {
    ctrl = new ZoomController(svg, { animate: true, animationDuration: 300 })
    const spy = vi.fn()
    svg.addEventListener('svgic:viewchange', spy)

    ctrl.zoomTo(2)
    driveAnimation(150) // промежуточный кадр

    expect(spy).toHaveBeenCalled()
  })
})

// ─── ZoomController — destroy ────────────────────────────────────────────────

describe('ZoomController — destroy', () => {
  it('после destroy wheel-события игнорируются', () => {
    ctrl = new ZoomController(svg, { wheelMode: 'always', animate: false })
    ctrl.destroy()
    fireWheel(svg, -100, false)
    expect(ctrl.getState().scale).toBe(1)
  })

  it('destroy отменяет запущенную анимацию', () => {
    vi.useFakeTimers()
    ctrl = new ZoomController(svg, { animate: true })
    ctrl.zoomTo(5)
    ctrl.destroy() // должен вызвать cancelAnimationFrame
    const scaleBefore = ctrl.getState().scale
    vi.advanceTimersByTime(400)
    // шкала не меняется после destroy
    expect(ctrl.getState().scale).toBe(scaleBefore)
  })

  it('destroy снимает mousemove/mouseup с window', () => {
    ctrl = new ZoomController(svg, { animate: false })
    ctrl.zoomTo(2, { animate: false })
    ctrl.destroy()

    svg.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: 400, clientY: 300, bubbles: true }))
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 500, clientY: 350, bubbles: true }))

    // drag не должен был сработать (mousemove listener удалён)
    expect(ctrl.getState().x).toBeCloseTo(200)
  })
})

// ─── ZoomPlugin ──────────────────────────────────────────────────────────────

describe('ZoomPlugin — фабрика и жизненный цикл', () => {
  it('ZoomPlugin() возвращает плагин с name: svgic:zoom', () => {
    const plugin = ZoomPlugin()
    expect(plugin.name).toBe('svgic:zoom')
  })

  it('API методы бросают до onInit', () => {
    const plugin = ZoomPlugin()
    expect(() => plugin.zoomTo(2)).toThrow('[ZoomPlugin]')
    expect(() => plugin.panTo(0, 0)).toThrow('[ZoomPlugin]')
    expect(() => plugin.reset()).toThrow('[ZoomPlugin]')
    expect(() => plugin.getState()).toThrow('[ZoomPlugin]')
    expect(() => plugin.focusElement('x')).toThrow('[ZoomPlugin]')
  })

  it('onInit создаёт ZoomController', () => {
    const plugin = ZoomPlugin({ animate: false })
    const client = makeFakeClient(svg)
    plugin.onInit!(client)
    expect(() => plugin.getState()).not.toThrow()
    plugin.onDestroy!(client)
  })

  it('onDestroy уничтожает контроллер, API снова бросают', () => {
    const plugin = ZoomPlugin({ animate: false })
    const client = makeFakeClient(svg)
    plugin.onInit!(client)
    plugin.onDestroy!(client)
    expect(() => plugin.zoomTo(2)).toThrow('[ZoomPlugin]')
  })
})

describe('ZoomPlugin — API делегирование', () => {
  let plugin: ReturnType<typeof ZoomPlugin>
  let client: ISvgic

  beforeEach(() => {
    plugin = ZoomPlugin({ animate: false, wheelMode: 'always' })
    client = makeFakeClient(svg)
    plugin.onInit!(client)
  })

  afterEach(() => {
    plugin.onDestroy!(client)
  })

  it('zoomTo делегирует в ZoomController', () => {
    plugin.zoomTo(3, { animate: false })
    expect(plugin.getState().scale).toBe(3)
  })

  it('panTo делегирует в ZoomController', () => {
    plugin.zoomTo(2, { animate: false })
    plugin.panTo(250, 200, { animate: false })
    const state = plugin.getState()
    expect(state.x).toBe(250)
    expect(state.y).toBe(200)
  })

  it('reset делегирует в ZoomController', () => {
    plugin.zoomTo(3, { animate: false })
    plugin.reset({ animate: false })
    expect(plugin.getState().scale).toBe(1)
  })

  it('getState возвращает текущее состояние', () => {
    const state = plugin.getState()
    expect(state).toMatchObject({ scale: 1, x: 0, y: 0 })
  })
})

describe('ZoomPlugin — focusOnClick', () => {
  it('focusOnClick:true регистрирует click-обработчик', () => {
    const plugin = ZoomPlugin({ focusOnClick: true, animate: false })
    const client = makeFakeClient(svg)
    plugin.onInit!(client)
    expect(client.on).toHaveBeenCalledWith('click', expect.any(Function))
    plugin.onDestroy!(client)
  })

  it('focusOnClick:false — click-обработчик не регистрируется', () => {
    const plugin = ZoomPlugin({ focusOnClick: false, animate: false })
    const client = makeFakeClient(svg)
    plugin.onInit!(client)
    expect(client.on).not.toHaveBeenCalled()
    plugin.onDestroy!(client)
  })

  it('focusOnClick — не фокусирует если scale уже >= focusScale*0.9', () => {
    let clickHandler: ((id: string, item: SvgicItem | null) => void) | null = null
    const client: ISvgic = {
      ...makeFakeClient(svg),
      on: vi.fn((_, handler) => { clickHandler = handler; return client }),
    }

    const plugin = ZoomPlugin({ focusOnClick: true, focusScale: 2, animate: false })
    plugin.onInit!(client)

    // Сначала зумируем до focusScale
    plugin.zoomTo(2, { animate: false })

    const focusSpy = vi.spyOn(plugin as never, 'focusElement' as never)
    clickHandler!('room-1', { id: 'room-1' })

    // scale=2 >= 2*0.9=1.8 → focusElement НЕ должен был вызваться
    expect(focusSpy).not.toHaveBeenCalled()
    plugin.onDestroy!(client)
  })
})
