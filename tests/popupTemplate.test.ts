import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { PopupManager } from '../src/ui/PopupManager'
import type { SvgicItem } from '../src/types'

const item: SvgicItem = { id: 'room-1', title: 'Conference Room', description: 'Floor 2' }

function makeMouseEvent(): MouseEvent {
  return new MouseEvent('mousemove', { clientX: 100, clientY: 100 })
}

function makeSvgElement(): SVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  // stub for getBoundingClientRect
  svg.getBoundingClientRect = () => ({ top: 50, left: 50, bottom: 100, right: 100, width: 50, height: 50, x: 50, y: 50, toJSON: () => ({}) })
  document.body.appendChild(svg)
  return svg
}

function makeTemplate(html: string, id: string): HTMLTemplateElement {
  const tpl = document.createElement('template')
  tpl.id = id
  tpl.innerHTML = html
  document.body.appendChild(tpl)
  return tpl
}

describe('PopupManager — template + bind', () => {
  let svgEl: SVGElement

  beforeEach(() => {
    svgEl = makeSvgElement()
  })

  afterEach(() => {
    document.body.innerHTML = ''
    document.head.querySelectorAll('#svgic-popup-styles').forEach(el => el.remove())
  })

  it('clones <template> by selector and inserts into DOM', () => {
    makeTemplate('<div class="popup"><span class="title"></span></div>', 'my-popup')

    const manager = new PopupManager({
      placement: 'element',
      anchor: 'top-center',
      template: '#my-popup',
      bind(el, i) {
        el.querySelector('.title')!.textContent = i.title ?? ''
      },
    })

    manager.show(svgEl as SVGElement, item, makeMouseEvent())

    const popup = document.body.querySelector('.title')
    expect(popup).not.toBeNull()
    expect(popup!.textContent).toBe('Conference Room')
  })

  it('accepts HTMLTemplateElement directly', () => {
    const tpl = makeTemplate('<div><span class="popup-body"></span></div>', 'direct-tpl')

    const manager = new PopupManager({
      placement: 'element',
      anchor: 'top-center',
      template: tpl,
      bind(el, i) {
        el.querySelector('.popup-body')!.textContent = i.description ?? ''
      },
    })

    manager.show(svgEl as SVGElement, item, makeMouseEvent())

    const body = document.body.querySelector('.popup-body')
    expect(body).not.toBeNull()
    expect(body!.textContent).toBe('Floor 2')
  })

  it('bind is called with the clone and correct item', () => {
    makeTemplate('<p></p>', 'bind-test')

    let receivedItem: SvgicItem | null = null
    let receivedEl: HTMLElement | null = null

    const manager = new PopupManager({
      placement: 'element',
      anchor: 'top-center',
      template: '#bind-test',
      bind(el, i) {
        receivedEl = el
        receivedItem = i
      },
    })

    manager.show(svgEl as SVGElement, item, makeMouseEvent())

    expect(receivedItem).toEqual(item)
    expect(receivedEl).toBeInstanceOf(HTMLElement)
  })

  it('throws if selector is not found', () => {
    const manager = new PopupManager({
      placement: 'element',
      anchor: 'top-center',
      template: '#non-existent',
    })

    expect(() => manager.show(svgEl as SVGElement, item, makeMouseEvent()))
      .toThrow('[svgic] popup template not found')
  })

  it('render works as usual if template is not set', () => {
    const manager = new PopupManager({
      placement: 'element',
      anchor: 'top-center',
      render(i) {
        const el = document.createElement('div')
        el.className = 'custom-render'
        el.textContent = i.title ?? ''
        return el
      },
    })

    manager.show(svgEl as SVGElement, item, makeMouseEvent())

    const popup = document.body.querySelector('.custom-render')
    expect(popup).not.toBeNull()
    expect(popup!.textContent).toBe('Conference Room')
  })
})
