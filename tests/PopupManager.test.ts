import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { PopupManager } from '../src/ui/PopupManager'
import type { SvgicItem } from '../src/types'

// ---- helpers ----

function makeSvgEl(): SVGSVGElement {
  const parser = new DOMParser()
  const doc = parser.parseFromString(
    `<svg xmlns="http://www.w3.org/2000/svg"><g id="rooms"><rect id="room-1" x="0" y="0" width="100" height="100"/></g></svg>`,
    'image/svg+xml',
  )
  return doc.documentElement as unknown as SVGSVGElement
}

function makeEvent(x = 100, y = 100): MouseEvent {
  return new MouseEvent('mouseover', { clientX: x, clientY: y, bubbles: true })
}

function cleanupPopups() {
  document.querySelectorAll('.svgic-popup').forEach(el => el.remove())
  document.querySelector('#svgic-popup-styles')?.remove()
}

const ITEM: SvgicItem = { id: 'room-1', title: 'Room 1' }
const ITEM_NO_TITLE: SvgicItem = { id: 'room-2' }

let svg: SVGSVGElement
let target: SVGElement

beforeEach(() => {
  svg = makeSvgEl()
  document.body.appendChild(svg)
  target = svg.getElementById('room-1') as SVGElement
})

afterEach(() => {
  svg.remove()
  cleanupPopups()
})

// ---- show / hide ----

describe('PopupManager — show/hide (placement: element)', () => {
  it('show() добавляет .svgic-popup в document.body', () => {
    const pm = new PopupManager({ placement: 'element', anchor: 'top-center' })
    pm.show(target, ITEM, makeEvent())
    expect(document.body.querySelector('.svgic-popup')).not.toBeNull()
    pm.destroy()
  })

  it('show() с item без title и без render — попап не создаётся', () => {
    const pm = new PopupManager({ placement: 'element' })
    const before = document.body.querySelectorAll('.svgic-popup').length
    pm.show(target, ITEM_NO_TITLE, makeEvent())
    expect(document.body.querySelectorAll('.svgic-popup').length).toBe(before)
    pm.destroy()
  })

  it('show() инжектирует #svgic-popup-styles в head', () => {
    const pm = new PopupManager({ placement: 'element' })
    pm.show(target, ITEM, makeEvent())
    expect(document.head.querySelector('#svgic-popup-styles')).not.toBeNull()
    pm.destroy()
  })

  it('hide() немедленно убирает попап из body', () => {
    const pm = new PopupManager({ placement: 'element' })
    pm.show(target, ITEM, makeEvent())
    pm.hide()
    expect(document.body.querySelector('.svgic-popup')).toBeNull()
    pm.destroy()
  })

  it('повторный show() на другой элемент заменяет предыдущий попап', () => {
    const svg2 = makeSvgEl()
    document.body.appendChild(svg2)
    const target2 = svg2.getElementById('room-1') as SVGElement

    const pm = new PopupManager({ placement: 'element' })
    pm.show(target, ITEM, makeEvent())
    pm.show(target2, { id: 'r2', title: 'Room 2' }, makeEvent())

    const popups = document.body.querySelectorAll('.svgic-popup')
    expect(popups.length).toBe(1)
    expect(popups[0].textContent).toBe('Room 2')
    pm.destroy()
    svg2.remove()
  })
})

// ---- hideDelay ----

describe('PopupManager — hideDelay', () => {
  it('с hideDelay > 0 попап не скрывается сразу', () => {
    vi.useFakeTimers()
    const pm = new PopupManager({ placement: 'element', hideDelay: 300 } as never)
    pm.show(target, ITEM, makeEvent())
    pm.hide()
    expect(document.body.querySelector('.svgic-popup')).not.toBeNull()
    vi.runAllTimers()
    expect(document.body.querySelector('.svgic-popup')).toBeNull()
    vi.useRealTimers()
    pm.destroy()
  })

  it('повторный show() отменяет pending hide', () => {
    vi.useFakeTimers()
    const pm = new PopupManager({ placement: 'element', hideDelay: 300 } as never)
    pm.show(target, ITEM, makeEvent())
    pm.hide()
    pm.show(target, ITEM, makeEvent()) // отменяет таймер
    vi.runAllTimers()
    expect(document.body.querySelector('.svgic-popup')).not.toBeNull()
    vi.useRealTimers()
    pm.destroy()
  })
})

// ---- interactive ----

describe('PopupManager — interactive mode', () => {
  it('mouseenter на попапе отменяет hide-таймер', () => {
    vi.useFakeTimers()
    const pm = new PopupManager({ placement: 'element', interactive: true } as never)
    pm.show(target, ITEM, makeEvent())
    const popup = document.body.querySelector('.svgic-popup') as HTMLElement
    pm.hide() // запускает таймер DEFAULT_INTERACTIVE_DELAY
    popup.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }))
    vi.runAllTimers()
    // таймер был отменён — попап остался
    expect(document.body.querySelector('.svgic-popup')).not.toBeNull()
    vi.useRealTimers()
    pm.destroy()
  })

  it('mouseleave с попапа скрывает попап', () => {
    vi.useFakeTimers()
    const pm = new PopupManager({ placement: 'element', interactive: true } as never)
    pm.show(target, ITEM, makeEvent())
    const popup = document.body.querySelector('.svgic-popup') as HTMLElement
    popup.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }))
    vi.runAllTimers()
    expect(document.body.querySelector('.svgic-popup')).toBeNull()
    vi.useRealTimers()
    pm.destroy()
  })
})

// ---- placement: cursor ----

describe('PopupManager — placement: cursor', () => {
  it('show() навешивает mousemove listener на document', () => {
    const addSpy = vi.spyOn(document, 'addEventListener')
    const pm = new PopupManager({ placement: 'cursor' })
    pm.show(target, ITEM, makeEvent())
    expect(addSpy).toHaveBeenCalledWith('mousemove', expect.any(Function))
    pm.destroy()
    addSpy.mockRestore()
  })

  it('hide() снимает mousemove listener', () => {
    const removeSpy = vi.spyOn(document, 'removeEventListener')
    const pm = new PopupManager({ placement: 'cursor' })
    pm.show(target, ITEM, makeEvent())
    pm.hide()
    expect(removeSpy).toHaveBeenCalledWith('mousemove', expect.any(Function))
    pm.destroy()
    removeSpy.mockRestore()
  })
})

// ---- placement: target ----

describe('PopupManager — placement: target', () => {
  let targetEl: HTMLDivElement

  beforeEach(() => {
    targetEl = document.createElement('div')
    targetEl.id = 'sidebar'
    document.body.appendChild(targetEl)
  })

  afterEach(() => {
    targetEl.remove()
  })

  it('show() рендерит контент в указанный target-элемент', () => {
    const pm = new PopupManager({ placement: 'target', target: '#sidebar' })
    pm.show(target, ITEM, makeEvent())
    expect(targetEl.innerHTML).not.toBe('')
    pm.destroy()
  })

  it('hide() очищает target-элемент', () => {
    const pm = new PopupManager({ placement: 'target', target: '#sidebar' })
    pm.show(target, ITEM, makeEvent())
    pm.hide()
    expect(targetEl.innerHTML).toBe('')
    pm.destroy()
  })

  it('show() рендерит попап внутри target, а не напрямую в body', () => {
    const pm = new PopupManager({ placement: 'target', target: '#sidebar' })
    pm.show(target, ITEM, makeEvent())
    // .svgic-popup должен быть внутри targetEl, а не прямым дочерним body
    const popup = document.body.querySelector('.svgic-popup')
    expect(popup).not.toBeNull()
    expect(popup!.parentElement).toBe(targetEl)
    pm.destroy()
  })
})

// ---- destroy ----

describe('PopupManager — destroy()', () => {
  it('удаляет #svgic-popup-styles из head', () => {
    const pm = new PopupManager({ placement: 'element' })
    pm.show(target, ITEM, makeEvent())
    pm.destroy()
    expect(document.head.querySelector('#svgic-popup-styles')).toBeNull()
  })

  it('удаляет попап из body', () => {
    const pm = new PopupManager({ placement: 'element' })
    pm.show(target, ITEM, makeEvent())
    pm.destroy()
    expect(document.body.querySelector('.svgic-popup')).toBeNull()
  })

  it('destroy() с cursor — снимает mousemove listener', () => {
    const removeSpy = vi.spyOn(document, 'removeEventListener')
    const pm = new PopupManager({ placement: 'cursor' })
    pm.show(target, ITEM, makeEvent())
    pm.destroy()
    expect(removeSpy).toHaveBeenCalledWith('mousemove', expect.any(Function))
    removeSpy.mockRestore()
  })
})

// ---- custom render ----

describe('PopupManager — custom render', () => {
  it('render() используется вместо дефолтного попапа', () => {
    const customEl = document.createElement('div')
    customEl.className = 'custom-popup'
    customEl.textContent = 'custom'
    const pm = new PopupManager({
      placement: 'element',
      render: () => customEl,
    })
    pm.show(target, ITEM_NO_TITLE, makeEvent()) // item без title, но render задан
    expect(document.body.querySelector('.custom-popup')).not.toBeNull()
    pm.destroy()
  })
})
