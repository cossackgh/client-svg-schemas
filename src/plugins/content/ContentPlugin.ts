import type { ISvgic, SvgicItem, SvgicPlugin } from '../../types'
import type {
  ContentCandidate,
  ContentPluginOptions,
  ContentSlot,
  CustomCandidate,
  ImageCandidate,
  TextCandidate,
} from './types'
import {
  findRect,
  findSpot,
  insetRect,
  sampleShape,
  SHAPE_SELECTOR,
  type ShapeMask,
  type ShapeRect,
} from './geometry'
import { getCachedRatio, probeRatio } from './imageRatio'

const SVG_NS = 'http://www.w3.org/2000/svg'

/**
 * How much longer the vertical run has to be before `rotate: 'auto'` turns the
 * text. Without a margin an almost square room flips on a hair of difference,
 * and neighbouring rooms end up with labels at different angles for no reason.
 */
const ROTATE_MARGIN = 1.3

/**
 * Average glyph width as a fraction of the font size, used to guess whether a
 * line fits before it is drawn. Only the rotate decision depends on it — the
 * accept/reject decision is made on the real measured box.
 */
const GLYPH_RATIO = 0.55

/**
 * Relative slack in the fit test. Content built to exactly the slot size comes
 * back from getBBox() a float hair too large, and without the slack every such
 * element would be "scaled" by 0.9999999.
 */
const FIT_EPSILON = 1e-6

/** Distinguishes generated layers when several plugin instances share one schema */
let instanceCounter = 0

export interface ContentPluginInstance extends SvgicPlugin {
  /**
   * Rebuilds the generated layer.
   *
   * Rarely needed: the plugin rebuilds itself on every data change. Call it after
   * something the plugin cannot observe — a web font finishing loading, say.
   */
  rebuild(): void
}

/** One element waiting for a candidate that fits */
interface Entry {
  slot: ContentSlot
  /**
   * Sampled shape, kept so an image can ask for a rectangle of its own aspect
   * ratio instead of reusing the largest one by area.
   */
  mask: ShapeMask | null
  /** Index of the next candidate to try */
  next: number
}

/** A candidate rendered into the DOM and awaiting measurement */
interface Placed {
  entry: Entry
  candidate: ContentCandidate
  host: SVGGElement
  node: SVGGraphicsElement
  /** Text drawn at -90°: its measured box comes back unrotated, so the sides swap */
  rotated: boolean
  box: ShapeRect | null
}

const measure = (node: SVGGraphicsElement): ShapeRect | null => {
  if (typeof node.getBBox !== 'function') return null

  try {
    const box = node.getBBox()

    // jsdom reports zeros for everything; treat that as "cannot measure" and
    // keep whatever was rendered rather than dropping all content in tests and SSR.
    return box.width || box.height ? box : null
  } catch {
    return null
  }
}

/** Shrinks a rectangle towards its center by a factor */
const scaleRect = (rect: ShapeRect, factor: number): ShapeRect => {
  if (factor >= 1) return rect

  return {
    x: rect.x + (rect.width * (1 - factor)) / 2,
    y: rect.y + (rect.height * (1 - factor)) / 2,
    width: rect.width * factor,
    height: rect.height * factor,
  }
}

/** Largest box of the given ratio that fits inside a rectangle, centered */
const fitAspect = (rect: ShapeRect, ratio: number): ShapeRect => {
  const width = Math.min(rect.width, rect.height * ratio)
  const height = width / ratio

  return {
    x: rect.x + (rect.width - width) / 2,
    y: rect.y + (rect.height - height) / 2,
    width,
    height,
  }
}

const safeBBox = (element: SVGGraphicsElement): ShapeRect | null => {
  if (typeof element.getBBox !== 'function') return null

  try {
    const box = element.getBBox()

    return box.width || box.height ? box : null
  } catch {
    return null
  }
}

/**
 * Places text, images and composite content inside the elements of a layer.
 *
 * Positions are computed from the geometry of every shape, so editing the plan
 * never requires moving labels by hand. Candidates are tried in order and the
 * first one that fits wins, which is how a logo degrades to a name and a name to
 * a room number as the available space shrinks.
 *
 * The generated layer does not receive pointer events — hover and click keep
 * reaching the shapes underneath.
 *
 * @example
 * ```ts
 * import { ContentPlugin } from '@svgic/core/plugins/content'
 *
 * const content = ContentPlugin({
 *   sourceLayer: 'rooms',
 *   content: [
 *     { type: 'text', text: ({ item }) => item?.title },
 *     { type: 'text', text: ({ id }) => id, opacity: 0.5 },
 *   ],
 * })
 *
 * const client = new Svgic('#container', { src: '/map.svg', plugins: [content] })
 * ```
 */
export function ContentPlugin(options: ContentPluginOptions): ContentPluginInstance {
  const grid = options.grid ?? 24
  const padding = options.padding ?? 0.08
  const fontScale = options.fontScale ?? 70
  const clip = options.clip ?? true
  const idAttribute = options.idAttribute ?? 'id'
  const uid = `svgic-content-${++instanceCounter}`

  let client: ISvgic | null = null
  let items = new Map<string, SvgicItem>()
  let group: SVGGElement | null = null
  let defs: SVGDefsElement | null = null
  let clipCounter = 0
  /** Guards the rebuild that follows image probes against a build that has moved on */
  let generation = 0
  let pendingProbes: Promise<unknown>[] = []

  const clear = (): void => {
    group?.remove()
    group = null
    defs = null
    clipCounter = 0
  }

  const baseFontSize = (root: SVGSVGElement): number => {
    const height = root.viewBox?.baseVal?.height || safeBBox(root)?.height || 0

    return (height || 1000) / fontScale
  }

  const makeSlot = (
    element: SVGGraphicsElement,
    id: string,
    fontSize: number,
  ): { slot: ContentSlot; mask: ShapeMask | null } | null => {
    const mask = sampleShape(element, grid)
    let rect = mask ? findRect(mask) : null
    let spot = mask ? findSpot(mask) : null

    if (!rect || !spot) {
      // No geometry API (jsdom, SSR) or a degenerate shape — fall back to the
      // bounding box so the plugin degrades instead of throwing.
      const box = safeBBox(element)

      if (!box) return null

      rect = rect ?? box
      spot = spot ?? {
        x: box.x + box.width / 2,
        y: box.y + box.height / 2,
        runX: box.width,
        runY: box.height,
      }
    }

    return {
      mask,
      slot: {
        id,
        item: items.get(id) ?? null,
        element,
        rect: insetRect(rect, padding),
        spot,
        fontSize,
      },
    }
  }

  const buildText = (
    candidate: TextCandidate,
    slot: ContentSlot,
  ): { node: SVGTextElement; rotated: boolean } | null => {
    const raw = candidate.text(slot)
    const lines = (Array.isArray(raw) ? raw : [raw]).filter(
      (line): line is string => typeof line === 'string' && line.trim().length > 0,
    )

    if (!lines.length) return null

    const fontSize = candidate.fontSize ?? slot.fontSize
    const lineHeight = candidate.lineHeight ?? 1.15
    const longest = lines.reduce((max, line) => Math.max(max, line.length), 0)
    const guessWidth = longest * fontSize * GLYPH_RATIO
    const guessHeight = fontSize + (lines.length - 1) * fontSize * lineHeight
    const rotate = candidate.rotate ?? 'auto'
    const rotated =
      rotate === true ||
      (rotate === 'auto' &&
        guessWidth > slot.spot.runX &&
        slot.spot.runY > slot.spot.runX * ROTATE_MARGIN)

    const node = document.createElementNS(SVG_NS, 'text')
    const top = slot.spot.y - (guessHeight - fontSize) / 2

    node.setAttribute('x', String(slot.spot.x))
    node.setAttribute('y', String(top))
    node.setAttribute('text-anchor', 'middle')
    node.setAttribute('dominant-baseline', 'central')
    node.setAttribute('font-size', String(fontSize))

    if (candidate.fontFamily) node.setAttribute('font-family', candidate.fontFamily)
    if (candidate.fontWeight) node.setAttribute('font-weight', String(candidate.fontWeight))
    if (candidate.fill) node.setAttribute('fill', candidate.fill)
    if (candidate.opacity != null) node.setAttribute('opacity', String(candidate.opacity))
    if (candidate.className) node.setAttribute('class', candidate.className)

    lines.forEach((line, index) => {
      const tspan = document.createElementNS(SVG_NS, 'tspan')

      tspan.textContent = line
      tspan.setAttribute('x', String(slot.spot.x))
      tspan.setAttribute('dy', index === 0 ? '0' : String(fontSize * lineHeight))
      node.appendChild(tspan)
    })

    // Counter-clockwise: the SVG y axis points down, so -90° is what makes the
    // text read bottom-up. Top-down reads badly.
    if (rotated) {
      node.setAttribute('transform', `rotate(-90, ${slot.spot.x}, ${slot.spot.y})`)
    }

    return { node, rotated }
  }

  /**
   * Draws an image into the largest box of its own aspect ratio.
   *
   * With a known ratio the box is exact, so `preserveAspectRatio` never has to
   * letterbox anything and the minimum-size check is meaningful. Without one the
   * image gets the whole slot — safe, because `meet` keeps it inside — and a
   * probe is queued, after which the layer is rebuilt with real numbers.
   */
  const buildImage = (candidate: ImageCandidate, entry: Entry): SVGImageElement | null => {
    const href = candidate.href(entry.slot)

    if (!href) return null

    const declared = candidate.ratio?.(entry.slot)
    const ratio =
      typeof declared === 'number' && declared > 0
        ? declared
        : getCachedRatio(href) ?? null

    if (ratio == null && (candidate.probe ?? true)) {
      pendingProbes.push(probeRatio(href))
    }

    const area = scaleRect(entry.slot.rect, candidate.scale ?? 1)
    let box = area

    if (ratio != null) {
      const aspectRect = entry.mask ? findRect(entry.mask, ratio) : null

      box = scaleRect(
        aspectRect ? insetRect(aspectRect, padding) : fitAspect(area, ratio),
        candidate.scale ?? 1,
      )

      // Too small to read as a logo — the next candidate does more good here.
      if (box.height < (candidate.minHeight ?? 0) || box.width < (candidate.minWidth ?? 0)) {
        return null
      }
    }

    const node = document.createElementNS(SVG_NS, 'image')

    node.setAttribute('x', String(box.x))
    node.setAttribute('y', String(box.y))
    node.setAttribute('width', String(box.width))
    node.setAttribute('height', String(box.height))
    node.setAttribute('preserveAspectRatio', 'xMidYMid meet')
    node.setAttribute('href', href)

    if (candidate.opacity != null) node.setAttribute('opacity', String(candidate.opacity))
    if (candidate.className) node.setAttribute('class', candidate.className)

    return node
  }

  const acceptText = (placed: Placed): boolean => {
    if (!placed.box) return true

    const { spot } = placed.entry.slot
    const width = placed.rotated ? placed.box.height : placed.box.width
    const height = placed.rotated ? placed.box.width : placed.box.height

    return width <= spot.runX * (1 + FIT_EPSILON) && height <= spot.runY * (1 + FIT_EPSILON)
  }

  const acceptCustom = (placed: Placed, candidate: CustomCandidate): boolean => {
    if (!placed.box) return true

    const { rect } = placed.entry.slot
    const fits =
      placed.box.width <= rect.width * (1 + FIT_EPSILON) &&
      placed.box.height <= rect.height * (1 + FIT_EPSILON)

    if (fits) return true

    const mode = candidate.fit ?? 'scale'

    if (mode === 'none') return true
    if (mode === 'reject') return false

    const scale = Math.min(rect.width / placed.box.width, rect.height / placed.box.height)

    if (scale < (candidate.minScale ?? 0.5)) return false

    const centerX = rect.x + rect.width / 2
    const centerY = rect.y + rect.height / 2
    const boxCenterX = placed.box.x + placed.box.width / 2
    const boxCenterY = placed.box.y + placed.box.height / 2
    const shiftX = centerX - scale * boxCenterX
    const shiftY = centerY - scale * boxCenterY

    placed.node.setAttribute('transform', `translate(${shiftX}, ${shiftY}) scale(${scale})`)

    return true
  }

  /** Builds a `<clipPath>` from the element geometry and returns its id */
  const clipPathFor = (element: SVGGraphicsElement, root: SVGSVGElement): string | null => {
    if (!group) return null

    if (!defs) {
      defs = document.createElementNS(SVG_NS, 'defs')
      group.appendChild(defs)
    }

    const id = `${uid}-clip-${++clipCounter}`
    const path = document.createElementNS(SVG_NS, 'clipPath')

    path.id = id

    const ownTransform = element.getAttribute('transform')
    const elementId = element.getAttribute('id')
    const isShape = typeof element.matches === 'function' && element.matches(SHAPE_SELECTOR)

    if (isShape && !ownTransform && elementId && root.getElementById(elementId) === element) {
      // Cheapest form: reference the shape instead of copying it.
      const use = document.createElementNS(SVG_NS, 'use')

      use.setAttribute('href', `#${elementId}`)
      path.appendChild(use)
    } else if (isShape) {
      // The shape carries its own transform (which <use> would apply a second
      // time on top of the host group), or has no usable id — clone it and strip
      // the transform, since the host group already carries it.
      const clone = element.cloneNode(true) as SVGGraphicsElement

      clone.removeAttribute('transform')
      clone.removeAttribute('id')
      path.appendChild(clone)
    } else {
      // A <g> wrapper. A clipPath ignores groups and any <use> pointing at one —
      // the result would be an empty clip that hides the content entirely — so the
      // shapes inside are flattened into the clip. Each clone keeps its own
      // transform; transforms on intermediate groups are not composed.
      for (const shape of Array.from(element.querySelectorAll(SHAPE_SELECTOR))) {
        const clone = shape.cloneNode(true) as SVGGraphicsElement

        clone.removeAttribute('id')
        path.appendChild(clone)
      }

      if (!path.childNodes.length) return null
    }

    defs.appendChild(path)

    return id
  }

  /**
   * Renders the next candidate that produces content and inserts it into the DOM.
   * Returns `null` once the entry runs out of candidates.
   */
  const placeNext = (entry: Entry, root: SVGSVGElement): Placed | null => {
    while (entry.next < options.content.length) {
      const candidate = options.content[entry.next++]

      if (candidate.when && !candidate.when(entry.slot)) continue

      let node: SVGGraphicsElement | null = null
      let rotated = false

      if (candidate.type === 'text') {
        const built = buildText(candidate, entry.slot)

        if (built) {
          node = built.node
          rotated = built.rotated
        }
      } else if (candidate.type === 'image') {
        node = buildImage(candidate, entry)
      } else {
        node = (candidate.render(entry.slot) as SVGGraphicsElement) ?? null
      }

      if (!node) continue

      const host = document.createElementNS(SVG_NS, 'g')
      const ownTransform = entry.slot.element.getAttribute('transform')

      // getBBox() and isPointInFill() report coordinates before the element applies
      // its own transform, so the host has to repeat it for the numbers to line up.
      if (ownTransform) host.setAttribute('transform', ownTransform)

      if (clip) {
        const clipId = clipPathFor(entry.slot.element, root)

        if (clipId) host.setAttribute('clip-path', `url(#${clipId})`)
      }

      host.appendChild(node)
      group?.appendChild(host)

      return { entry, candidate, host, node, rotated, box: null }
    }

    return null
  }

  const build = (): void => {
    if (!client) return

    const currentGeneration = ++generation

    pendingProbes = []

    const root = client.getElement()
    const layer = client.getLayer(options.sourceLayer)

    clear()

    if (!root) return

    if (!layer) {
      console.warn(`[svgic:content] Layer "${options.sourceLayer}" not found`)
      return
    }

    const fontSize = baseFontSize(root)

    group = document.createElementNS(SVG_NS, 'g')
    group.id = uid
    group.setAttribute('class', ['svgic-content', options.className].filter(Boolean).join(' '))
    group.style.pointerEvents = 'none'

    // getBBox() returns coordinates in the layer coordinate system, so the generated
    // group sits next to the layer and repeats its transform. Otherwise content
    // drifts away on any schema whose layer is transformed.
    const layerTransform = layer.element.getAttribute('transform')

    if (layerTransform) group.setAttribute('transform', layerTransform)

    // Content belongs above the shapes and in their coordinate system — that is,
    // immediately after the layer.
    layer.element.parentNode?.insertBefore(group, layer.element.nextSibling)

    let round: Entry[] = []

    for (const child of Array.from(layer.element.children)) {
      const element = child as SVGGraphicsElement
      const id = element.getAttribute(idAttribute) || element.getAttribute('id')

      if (!id) continue

      const sampled = makeSlot(element, id, fontSize)

      if (sampled) round.push({ slot: sampled.slot, mask: sampled.mask, next: 0 })
    }

    // The chain runs level by level across all elements rather than element by
    // element: measuring forces a layout, so one flush per candidate level is
    // paid instead of one per element.
    let placedCount = 0

    while (round.length) {
      const placed: Placed[] = []

      for (const entry of round) {
        const result = placeNext(entry, root)

        if (result) placed.push(result)
      }

      if (!placed.length) break

      for (const item of placed) {
        item.box = measure(item.node)
      }

      const retry: Entry[] = []

      for (const item of placed) {
        const accepted =
          item.candidate.type === 'text'
            ? acceptText(item)
            : item.candidate.type === 'image'
              // The box was computed to fit, so there is nothing left to check.
              ? true
              : acceptCustom(item, item.candidate)

        if (accepted) {
          placedCount++
        } else {
          item.host.remove()
          retry.push(item.entry)
        }
      }

      round = retry
    }

    // Nothing was placed — do not leave an empty group behind.
    if (!placedCount) clear()

    // Images whose ratio was unknown are drawn into the whole slot; once their
    // real proportions are in, the layer is rebuilt with the proper boxes. The
    // ratios are cached by then, so this settles after one extra pass.
    if (pendingProbes.length) {
      Promise.allSettled(pendingProbes).then(() => {
        if (client && currentGeneration === generation) build()
      })
    }
  }

  return {
    name: 'svgic:content',

    rebuild: build,

    onInit(instance: ISvgic): void {
      client = instance
      build()
    },

    onDataChange(data: SvgicItem[]): void {
      items = new Map(data.map(item => [item.id, item]))
      build()
    },

    onDestroy(): void {
      clear()
      items = new Map()
      client = null
    },
  }
}
