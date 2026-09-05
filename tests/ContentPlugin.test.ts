import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Svgic } from '../src/core/Svgic'
import { ContentPlugin } from '../src/plugins/content'
import { clearRatioCache } from '../src/plugins/content/imageRatio'
import type { ContentCandidate } from '../src/plugins/content'
import type { SvgicItem } from '../src/types'

vi.mock('../src/core/loader', () => ({
  loadSvg: vi.fn(),
}))

import { loadSvg } from '../src/core/loader'

interface Box {
  x: number
  y: number
  width: number
  height: number
}

function makeSvgEl(inner: string): SVGSVGElement {
  const doc = new DOMParser().parseFromString(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 700">${inner}</svg>`,
    'image/svg+xml',
  )

  return doc.documentElement as unknown as SVGSVGElement
}

/**
 * jsdom implements no SVG geometry, so shapes get their box and fill test stubbed.
 * Every stubbed shape is treated as a solid rectangle.
 */
function stubShapes(svg: SVGSVGElement, boxes: Record<string, Box>): void {
  Object.defineProperty(svg, 'createSVGPoint', {
    value: () => ({ x: 0, y: 0 }),
    configurable: true,
  })

  for (const [id, box] of Object.entries(boxes)) {
    const element = svg.getElementById(id) as unknown as SVGGraphicsElement

    Object.defineProperty(element, 'getBBox', { value: () => box, configurable: true })
    Object.defineProperty(element, 'isPointInFill', { value: () => true, configurable: true })
    Object.defineProperty(element, 'ownerSVGElement', { value: svg, configurable: true })
  }
}

let container: HTMLElement
let originalGetBBox: unknown

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)

  originalGetBBox = (SVGElement.prototype as unknown as Record<string, unknown>).getBBox

  // Measurement stub for generated content: text is sized from its longest line,
  // anything else from explicit data-w / data-h attributes.
  ;(SVGElement.prototype as unknown as Record<string, unknown>).getBBox = function (this: SVGElement): Box {
    if (this.tagName.toLowerCase() === 'text') {
      const fontSize = Number(this.getAttribute('font-size')) || 10
      const lines = Array.from(this.children).map(child => child.textContent ?? '')
      const longest = lines.reduce((max, line) => Math.max(max, line.length), 0)

      return { x: 0, y: 0, width: longest * fontSize * 0.6, height: fontSize * lines.length }
    }

    return {
      x: 0,
      y: 0,
      width: Number(this.getAttribute('data-w')) || 0,
      height: Number(this.getAttribute('data-h')) || 0,
    }
  }
})

afterEach(() => {
  ;(SVGElement.prototype as unknown as Record<string, unknown>).getBBox = originalGetBBox
  container.remove()
  vi.clearAllMocks()
})

const twoRooms = '<g id="rooms"><rect id="r1"/><rect id="r2"/></g>'
const wideBoxes = {
  r1: { x: 0, y: 0, width: 200, height: 100 },
  r2: { x: 0, y: 200, width: 200, height: 100 },
}

async function mount(
  inner: string,
  boxes: Record<string, Box>,
  plugin: ReturnType<typeof ContentPlugin>,
  data?: SvgicItem[],
) {
  const svg = makeSvgEl(inner)

  vi.mocked(loadSvg).mockResolvedValue(svg)

  const client = new Svgic(container, {
    src: '',
    layers: { rooms: { role: 'interactive' } },
    data,
    plugins: [plugin],
  })

  // Geometry has to be stubbed on the elements before the plugin builds, and the
  // plugin builds during init — so stub as soon as the SVG object exists.
  stubShapes(svg, boxes)

  await client.ready

  return { client, svg }
}

const texts = (svg: SVGSVGElement): string[] =>
  Array.from(svg.querySelectorAll('.svgic-content text')).map(node => node.textContent ?? '')

describe('ContentPlugin — rendering', () => {
  it('places a label inside every element that has content', async () => {
    const { client, svg } = await mount(
      twoRooms,
      wideBoxes,
      ContentPlugin({
        sourceLayer: 'rooms',
        content: [{ type: 'text', text: ({ item }) => item?.title as string, fontSize: 10 }],
      }),
      [{ id: 'r1', title: 'Alpha' }, { id: 'r2', title: 'Beta' }],
    )

    expect(texts(svg)).toEqual(['Alpha', 'Beta'])
    client.destroy()
  })

  it('centers the label in the shape', async () => {
    const { client, svg } = await mount(
      '<g id="rooms"><rect id="r1"/></g>',
      { r1: { x: 100, y: 40, width: 200, height: 100 } },
      ContentPlugin({
        sourceLayer: 'rooms',
        content: [{ type: 'text', text: () => 'Alpha', fontSize: 10 }],
      }),
    )

    const node = svg.querySelector('.svgic-content text')!

    // The spot is a grid cell center, so it can sit up to half a cell away from
    // the true center — here 200 / 24 / 2 is about 4 units.
    expect(Number(node.getAttribute('x'))).toBeGreaterThan(195)
    expect(Number(node.getAttribute('x'))).toBeLessThan(205)
    expect(Number(node.getAttribute('y'))).toBeGreaterThan(85)
    expect(Number(node.getAttribute('y'))).toBeLessThan(95)
    client.destroy()
  })

  it('inserts the generated layer right after the source layer and ignores pointer events', async () => {
    const { client, svg } = await mount(
      twoRooms,
      wideBoxes,
      ContentPlugin({
        sourceLayer: 'rooms',
        content: [{ type: 'text', text: ({ id }) => id, fontSize: 10 }],
      }),
    )

    const layer = svg.getElementById('rooms') as unknown as SVGGElement
    const group = svg.querySelector('.svgic-content') as SVGGElement

    expect(layer.nextSibling).toBe(group)
    expect(group.style.pointerEvents).toBe('none')
    client.destroy()
  })

  it('renders several lines as tspans', async () => {
    const { client, svg } = await mount(
      '<g id="rooms"><rect id="r1"/></g>',
      { r1: { x: 0, y: 0, width: 200, height: 100 } },
      ContentPlugin({
        sourceLayer: 'rooms',
        content: [{ type: 'text', text: () => ['Alpha', 'Beta'], fontSize: 10 }],
      }),
    )

    const spans = svg.querySelectorAll('.svgic-content text tspan')

    expect(Array.from(spans).map(span => span.textContent)).toEqual(['Alpha', 'Beta'])
    expect(spans[1].getAttribute('dy')).toBe(String(10 * 1.15))
    client.destroy()
  })

  it('renders nothing when no candidate produces content', async () => {
    const { client, svg } = await mount(
      twoRooms,
      wideBoxes,
      ContentPlugin({
        sourceLayer: 'rooms',
        content: [{ type: 'text', text: () => null }],
      }),
    )

    expect(svg.querySelector('.svgic-content')).toBeNull()
    client.destroy()
  })

  it('warns and renders nothing for an unknown layer', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { client, svg } = await mount(
      twoRooms,
      wideBoxes,
      ContentPlugin({
        sourceLayer: 'missing',
        content: [{ type: 'text', text: ({ id }) => id }],
      }),
    )

    expect(svg.querySelector('.svgic-content')).toBeNull()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('missing'))
    warn.mockRestore()
    client.destroy()
  })
})

describe('ContentPlugin — group wrappers', () => {
  it('samples a <g> wrapper through its geometry children', async () => {
    const svg = makeSvgEl('<g id="rooms"><g id="r1"><rect id="r1-shape"/></g></g>')

    vi.mocked(loadSvg).mockResolvedValue(svg)

    const client = new Svgic(container, {
      src: '',
      layers: { rooms: { role: 'interactive' } },
      plugins: [
        ContentPlugin({
          sourceLayer: 'rooms',
          content: [{ type: 'text', text: ({ id }) => id, fontSize: 10 }],
        }),
      ],
    })

    // Only the child shape can answer isPointInFill — the wrapper cannot.
    const wrapper = svg.getElementById('r1') as unknown as SVGGraphicsElement
    const shape = svg.getElementById('r1-shape') as unknown as SVGGraphicsElement

    Object.defineProperty(svg, 'createSVGPoint', { value: () => ({ x: 0, y: 0 }), configurable: true })
    Object.defineProperty(wrapper, 'getBBox', {
      value: () => ({ x: 0, y: 0, width: 200, height: 100 }),
      configurable: true,
    })
    Object.defineProperty(wrapper, 'ownerSVGElement', { value: svg, configurable: true })
    Object.defineProperty(shape, 'isPointInFill', { value: () => true, configurable: true })

    await client.ready

    expect(texts(svg)).toEqual(['r1'])
    client.destroy()
  })
})

describe('ContentPlugin — own transform on a shape', () => {
  /** Stubs geometry for a shape whose own transform is a half turn */
  const mountMirrored = async (
    matrix: { a: number; b: number; c: number; d: number; e: number; f: number },
    content: ContentCandidate[] = [{ type: 'text', text: ({ id }) => id, fontSize: 10 }],
  ) => {
    const svg = makeSvgEl('<g id="rooms"><rect id="r1" transform="scale(-1)"/></g>')

    vi.mocked(loadSvg).mockResolvedValue(svg)

    const client = new Svgic(container, {
      src: '',
      layers: { rooms: { role: 'interactive' } },
      plugins: [
        ContentPlugin({ sourceLayer: 'rooms', content }),
      ],
    })

    const element = svg.getElementById('r1') as unknown as SVGGraphicsElement

    Object.defineProperty(svg, 'createSVGPoint', { value: () => ({ x: 0, y: 0 }), configurable: true })
    Object.defineProperty(element, 'getBBox', {
      // Coordinates as the element sees them, before its own transform
      value: () => ({ x: -200, y: -100, width: 200, height: 100 }),
      configurable: true,
    })
    Object.defineProperty(element, 'isPointInFill', { value: () => true, configurable: true })
    Object.defineProperty(element, 'ownerSVGElement', { value: svg, configurable: true })
    Object.defineProperty(element, 'transform', {
      value: { baseVal: { numberOfItems: 1, consolidate: () => ({ matrix }) } },
      configurable: true,
    })

    await client.ready

    return { client, svg }
  }

  it('maps the placement through the transform instead of replaying it', async () => {
    // scale(-1) is how editors commonly express a half turn. Replaying it on the
    // content would place the label correctly and render it upside down.
    const { client, svg } = await mountMirrored({ a: -1, b: 0, c: 0, d: -1, e: 0, f: 0 })

    const host = svg.querySelector('.svgic-content > g') as SVGGElement
    const text = svg.querySelector('.svgic-content text')!

    expect(host.hasAttribute('transform')).toBe(false)
    expect(text.hasAttribute('transform')).toBe(false)
    // The shape sits at -200..0 before its transform, so it lands on 0..200 after it
    expect(Number(text.getAttribute('x'))).toBeGreaterThan(95)
    expect(Number(text.getAttribute('x'))).toBeLessThan(105)
    expect(Number(text.getAttribute('y'))).toBeGreaterThan(45)
    expect(Number(text.getAttribute('y'))).toBeLessThan(55)
    client.destroy()
  })

  it('clips a transformed shape by referencing it, so the clip carries the transform', async () => {
    const { client, svg } = await mountMirrored({ a: -1, b: 0, c: 0, d: -1, e: 0, f: 0 })

    const clipPath = svg.querySelector('clipPath')!

    expect(clipPath.querySelector('use')!.getAttribute('href')).toBe('#r1')
    client.destroy()
  })

  it('swaps the free runs on a quarter turn', async () => {
    // rotate(90): the horizontal run of the shape becomes the vertical one on screen,
    // so a label that fits across the shape must now be checked against the height.
    const { client, svg } = await mountMirrored({ a: 0, b: 1, c: -1, d: 0, e: 0, f: 0 })

    const text = svg.querySelector('.svgic-content text')!

    // Local center (-100, -50) maps to (50, -100)
    expect(Number(text.getAttribute('x'))).toBeGreaterThan(45)
    expect(Number(text.getAttribute('x'))).toBeLessThan(55)
    expect(Number(text.getAttribute('y'))).toBeLessThan(-95)
    client.destroy()
  })

  it('maps the image box too, since it is measured on the untransformed mask', async () => {
    const { client, svg } = await mountMirrored({ a: -1, b: 0, c: 0, d: -1, e: 0, f: 0 }, [
      { type: 'image', href: () => '/logo.png', ratio: () => 2 },
    ])

    const image = svg.querySelector('.svgic-content image')!
    const x = Number(image.getAttribute('x'))
    const width = Number(image.getAttribute('width'))

    // The shape lands on 0..200 after its transform; an unmapped box would be negative
    expect(x).toBeGreaterThan(0)
    expect(x + width).toBeLessThanOrEqual(200)
    expect(width / Number(image.getAttribute('height'))).toBeCloseTo(2)
    client.destroy()
  })
})

describe('ContentPlugin — candidate chain', () => {
  it('falls through to the next candidate when the first yields nothing', async () => {
    const { client, svg } = await mount(
      twoRooms,
      wideBoxes,
      ContentPlugin({
        sourceLayer: 'rooms',
        content: [
          { type: 'text', text: ({ item }) => item?.title as string, fontSize: 10 },
          { type: 'text', text: ({ id }) => id, fontSize: 10 },
        ],
      }),
      [{ id: 'r1', title: 'Alpha' }],
    )

    expect(texts(svg)).toEqual(['Alpha', 'r2'])
    client.destroy()
  })

  it('falls through when the text does not fit even rotated', async () => {
    const { client, svg } = await mount(
      '<g id="rooms"><rect id="r1"/></g>',
      { r1: { x: 0, y: 0, width: 20, height: 100 } },
      ContentPlugin({
        sourceLayer: 'rooms',
        content: [
          { type: 'text', text: () => 'Very long shop name', fontSize: 10 },
          { type: 'text', text: ({ id }) => id, fontSize: 10 },
        ],
      }),
    )

    expect(texts(svg)).toEqual(['r1'])
    client.destroy()
  })

  it('rotates a label that only fits along the vertical axis', async () => {
    const { client, svg } = await mount(
      '<g id="rooms"><rect id="r1"/></g>',
      { r1: { x: 0, y: 0, width: 20, height: 200 } },
      ContentPlugin({
        sourceLayer: 'rooms',
        content: [{ type: 'text', text: () => 'Alpha', fontSize: 10 }],
      }),
    )

    expect(svg.querySelector('.svgic-content text')!.getAttribute('transform')).toContain('rotate(-90')
    client.destroy()
  })

  it('respects rotate: false', async () => {
    const { client, svg } = await mount(
      '<g id="rooms"><rect id="r1"/></g>',
      { r1: { x: 0, y: 0, width: 20, height: 200 } },
      ContentPlugin({
        sourceLayer: 'rooms',
        content: [
          { type: 'text', text: () => 'Alpha', fontSize: 10, rotate: false },
          { type: 'text', text: () => 'A', fontSize: 10 },
        ],
      }),
    )

    // Unrotated 'Alpha' is 30 units wide and the room is 20 — it loses to 'A'.
    expect(texts(svg)).toEqual(['A'])
    client.destroy()
  })

  it('skips a candidate whose when() returns false', async () => {
    const { client, svg } = await mount(
      twoRooms,
      wideBoxes,
      ContentPlugin({
        sourceLayer: 'rooms',
        content: [
          { type: 'text', when: ({ id }) => id === 'r1', text: () => 'first', fontSize: 10 },
          { type: 'text', text: () => 'second', fontSize: 10 },
        ],
      }),
    )

    expect(texts(svg)).toEqual(['first', 'second'])
    client.destroy()
  })
})

describe('ContentPlugin — custom content', () => {
  it('scales oversized content into the shape', async () => {
    const plugin = ContentPlugin({
      sourceLayer: 'rooms',
      content: [
        {
          type: 'custom',
          minScale: 0.3,
          render: () => {
            const node = document.createElementNS('http://www.w3.org/2000/svg', 'rect')

            node.setAttribute('data-w', '400')
            node.setAttribute('data-h', '200')

            return node
          },
        },
      ],
    })

    const { client, svg } = await mount(
      '<g id="rooms"><rect id="r1"/></g>',
      { r1: { x: 0, y: 0, width: 200, height: 100 } },
      plugin,
    )

    const node = svg.querySelector('.svgic-content rect')!

    expect(node.getAttribute('transform')).toContain('scale(0.46)')
    client.destroy()
  })

  it('hands the element to the next candidate when scaling would go below minScale', async () => {
    const { client, svg } = await mount(
      '<g id="rooms"><rect id="r1"/></g>',
      { r1: { x: 0, y: 0, width: 200, height: 100 } },
      ContentPlugin({
        sourceLayer: 'rooms',
        content: [
          {
            type: 'custom',
            minScale: 0.5,
            render: () => {
              const node = document.createElementNS('http://www.w3.org/2000/svg', 'rect')

              node.setAttribute('data-w', '400')
              node.setAttribute('data-h', '200')

              return node
            },
          },
          { type: 'text', text: ({ id }) => id, fontSize: 10 },
        ],
      }),
    )

    expect(svg.querySelector('.svgic-content rect')).toBeNull()
    expect(texts(svg)).toEqual(['r1'])
    client.destroy()
  })
})

describe('ContentPlugin — clipping', () => {
  it('clips content to the shape via a reference to the element', async () => {
    const { client, svg } = await mount(
      '<g id="rooms"><rect id="r1"/></g>',
      { r1: { x: 0, y: 0, width: 200, height: 100 } },
      ContentPlugin({
        sourceLayer: 'rooms',
        content: [{ type: 'text', text: () => 'Alpha', fontSize: 10 }],
      }),
    )

    const host = svg.querySelector('.svgic-content > g') as SVGGElement
    const clipId = host.getAttribute('clip-path')!.replace(/^url\(#|\)$/g, '')
    const clipPath = svg.querySelector(`clipPath#${clipId}`)!

    expect(clipPath.querySelector('use')!.getAttribute('href')).toBe('#r1')
    client.destroy()
  })

  it('flattens a group wrapper into the clip instead of referencing it', async () => {
    const svg = makeSvgEl('<g id="rooms"><g id="r1"><rect id="r1-a"/><rect id="r1-b"/></g></g>')

    vi.mocked(loadSvg).mockResolvedValue(svg)

    const client = new Svgic(container, {
      src: '',
      layers: { rooms: { role: 'interactive' } },
      plugins: [
        ContentPlugin({
          sourceLayer: 'rooms',
          content: [{ type: 'text', text: ({ id }) => id, fontSize: 10 }],
        }),
      ],
    })

    const wrapper = svg.getElementById('r1') as unknown as SVGGraphicsElement

    Object.defineProperty(svg, 'createSVGPoint', { value: () => ({ x: 0, y: 0 }), configurable: true })
    Object.defineProperty(wrapper, 'getBBox', {
      value: () => ({ x: 0, y: 0, width: 200, height: 100 }),
      configurable: true,
    })
    Object.defineProperty(wrapper, 'ownerSVGElement', { value: svg, configurable: true })

    for (const id of ['r1-a', 'r1-b']) {
      Object.defineProperty(svg.getElementById(id) as unknown as SVGGraphicsElement, 'isPointInFill', {
        value: () => true,
        configurable: true,
      })
    }

    await client.ready

    const clipPath = svg.querySelector('clipPath')!

    // <use> pointing at a <g> is ignored by clipPath and would hide everything.
    expect(clipPath.querySelector('use')).toBeNull()
    expect(clipPath.querySelectorAll('rect')).toHaveLength(2)
    expect(clipPath.querySelector('rect')!.hasAttribute('id')).toBe(false)
    client.destroy()
  })

  it('can be turned off', async () => {
    const { client, svg } = await mount(
      '<g id="rooms"><rect id="r1"/></g>',
      { r1: { x: 0, y: 0, width: 200, height: 100 } },
      ContentPlugin({
        sourceLayer: 'rooms',
        clip: false,
        content: [{ type: 'text', text: () => 'Alpha', fontSize: 10 }],
      }),
    )

    expect(svg.querySelector('.svgic-content > g')!.hasAttribute('clip-path')).toBe(false)
    expect(svg.querySelector('clipPath')).toBeNull()
    client.destroy()
  })
})


describe('ContentPlugin — images', () => {
  const oneRoom = '<g id="rooms"><rect id="r1"/></g>'
  const box = { r1: { x: 0, y: 0, width: 200, height: 100 } }

  beforeEach(() => {
    clearRatioCache()
  })

  it('draws an image into a box of the declared ratio', async () => {
    const { client, svg } = await mount(
      oneRoom,
      box,
      ContentPlugin({
        sourceLayer: 'rooms',
        content: [{ type: 'image', href: () => '/logo.png', ratio: () => 2 }],
      }),
    )

    const image = svg.querySelector('.svgic-content image')!
    const width = Number(image.getAttribute('width'))
    const height = Number(image.getAttribute('height'))

    expect(image.getAttribute('href')).toBe('/logo.png')
    expect(image.getAttribute('preserveAspectRatio')).toBe('xMidYMid meet')
    expect(width / height).toBeCloseTo(2)
    // 200 x 100 shrunk by the default 8% padding
    expect(width).toBeCloseTo(184)
    client.destroy()
  })

  it('hands the element to the next candidate when the image would be too small', async () => {
    const { client, svg } = await mount(
      oneRoom,
      box,
      ContentPlugin({
        sourceLayer: 'rooms',
        content: [
          { type: 'image', href: () => '/logo.png', ratio: () => 8, minHeight: 40 },
          { type: 'text', text: ({ id }) => id, fontSize: 10 },
        ],
      }),
    )

    expect(svg.querySelector('.svgic-content image')).toBeNull()
    expect(texts(svg)).toEqual(['r1'])
    client.destroy()
  })

  it('skips the candidate when there is no image url', async () => {
    const { client, svg } = await mount(
      oneRoom,
      box,
      ContentPlugin({
        sourceLayer: 'rooms',
        content: [
          { type: 'image', href: () => null },
          { type: 'text', text: ({ id }) => id, fontSize: 10 },
        ],
      }),
    )

    expect(svg.querySelector('.svgic-content image')).toBeNull()
    expect(texts(svg)).toEqual(['r1'])
    client.destroy()
  })

  it('probes an unknown ratio and redraws with the real proportions', async () => {
    const originalImage = globalThis.Image

    class FakeImage {
      naturalWidth = 0
      naturalHeight = 0
      onload: (() => void) | null = null
      onerror: (() => void) | null = null

      set src(_value: string) {
        queueMicrotask(() => {
          this.naturalWidth = 400
          this.naturalHeight = 100
          this.onload?.()
        })
      }
    }

    globalThis.Image = FakeImage as unknown as typeof Image

    const { client, svg } = await mount(
      oneRoom,
      box,
      ContentPlugin({
        sourceLayer: 'rooms',
        content: [{ type: 'image', href: () => '/logo.png' }],
      }),
    )

    // Before the probe resolves the image gets the whole slot.
    const first = svg.querySelector('.svgic-content image')!

    expect(Number(first.getAttribute('height'))).toBeCloseTo(92)

    await new Promise(resolve => setTimeout(resolve, 0))

    const second = svg.querySelector('.svgic-content image')!
    const width = Number(second.getAttribute('width'))
    const height = Number(second.getAttribute('height'))

    expect(width / height).toBeCloseTo(4)
    expect(width).toBeCloseTo(184)

    client.destroy()
    globalThis.Image = originalImage
  })
})

describe('ContentPlugin — lifecycle', () => {
  it('rebuilds on setData without a manual call', async () => {
    const { client, svg } = await mount(
      twoRooms,
      wideBoxes,
      ContentPlugin({
        sourceLayer: 'rooms',
        content: [{ type: 'text', text: ({ item }) => item?.title as string, fontSize: 10 }],
      }),
    )

    expect(svg.querySelector('.svgic-content')).toBeNull()

    client.setData([{ id: 'r1', title: 'Alpha' }, { id: 'r2', title: 'Beta' }])

    expect(texts(svg)).toEqual(['Alpha', 'Beta'])

    client.setData([{ id: 'r1', title: 'Gamma' }])

    expect(texts(svg)).toEqual(['Gamma'])
    client.destroy()
  })

  it('removes the generated layer on destroy', async () => {
    const { client, svg } = await mount(
      twoRooms,
      wideBoxes,
      ContentPlugin({
        sourceLayer: 'rooms',
        content: [{ type: 'text', text: ({ id }) => id, fontSize: 10 }],
      }),
    )

    expect(svg.querySelector('.svgic-content')).not.toBeNull()

    client.destroy()

    expect(svg.querySelector('.svgic-content')).toBeNull()
  })

  it('repeats the transform of the source layer', async () => {
    const { client, svg } = await mount(
      '<g id="rooms" transform="translate(10, 20)"><rect id="r1"/></g>',
      { r1: { x: 0, y: 0, width: 200, height: 100 } },
      ContentPlugin({
        sourceLayer: 'rooms',
        content: [{ type: 'text', text: ({ id }) => id, fontSize: 10 }],
      }),
    )

    expect(svg.querySelector('.svgic-content')!.getAttribute('transform')).toBe('translate(10, 20)')
    client.destroy()
  })
})
