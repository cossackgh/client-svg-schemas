/**
 * Shape geometry helpers.
 *
 * All functions here are pure except `sampleShape`, which is the single place
 * that touches SVG geometry APIs. Everything downstream works on a plain boolean
 * matrix, so the algorithms are testable without a browser.
 */

/** Rectangle in SVG user units */
export interface ShapeRect {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Point inside a shape plus the free run through it along both axes.
 * Used to decide whether a line of text fits and whether to rotate it.
 */
export interface ShapeSpot {
  x: number
  y: number
  /** Uninterrupted horizontal run through the point, in SVG units */
  runX: number
  /** Uninterrupted vertical run through the point, in SVG units */
  runY: number
}

/**
 * Rasterized shape: a grid over the element bounding box where each cell records
 * whether its center lies inside the filled area.
 *
 * The bounding box center is useless for the L- and U-shaped rooms that make up
 * most of a floor plan — it often lands on a wall or outside the shape entirely.
 * A mask lets every placement decision be made on the real geometry, holes included.
 */
export interface ShapeMask {
  /** `inside[row][col]` */
  inside: boolean[][]
  rows: number
  cols: number
  /** Cell size in SVG units */
  stepX: number
  stepY: number
  /** Top-left corner of the sampled bounding box, in SVG units */
  x: number
  y: number
}

/** Shape elements that can answer a point-in-fill test, and that a clipPath accepts */
export const SHAPE_SELECTOR = 'path,rect,circle,ellipse,polygon,polyline'

/**
 * Builds a point-in-fill test for an element.
 *
 * A layer holds either flat shapes or `<g>` wrappers around them, and only the
 * shapes themselves can answer the test — so a wrapper is asked through its own
 * geometry children. Children carrying their own transform are the one case this
 * misses: their coordinates no longer share the space `getBBox()` reports.
 *
 * Returns `null` when nothing in the element can be tested.
 */
function fillTester(element: SVGGraphicsElement): ((point: DOMPoint) => boolean) | null {
  const self = element as SVGGeometryElement

  if (typeof self.isPointInFill === 'function') {
    return point => self.isPointInFill(point)
  }

  if (typeof element.querySelectorAll !== 'function') return null

  const shapes = Array.from(
    element.querySelectorAll<SVGGeometryElement>(SHAPE_SELECTOR),
  ).filter(shape => typeof shape.isPointInFill === 'function')

  if (!shapes.length) return null

  return point => shapes.some(shape => shape.isPointInFill(point))
}

/**
 * Samples the fill of an SVG element into a grid mask.
 *
 * The step is the same along both axes on purpose: with rectangular cells a
 * distance measured in cells stops matching the distance on screen, and in a
 * long room the label drifts towards the long wall.
 *
 * Returns `null` when the environment cannot report geometry (jsdom, SSR) or the
 * element has no area — callers fall back to the bounding box.
 *
 * @param element - Element to sample
 * @param grid - Grid density: cells along the longer bbox side. Higher is more precise and slower
 */
export function sampleShape(element: SVGGraphicsElement, grid: number): ShapeMask | null {
  const isInside = typeof element.getBBox === 'function' ? fillTester(element) : null

  if (!isInside) {
    return null
  }

  const svg = element.ownerSVGElement

  if (!svg || typeof svg.createSVGPoint !== 'function') {
    return null
  }

  let box: ShapeRect

  try {
    box = element.getBBox()
  } catch {
    return null
  }

  if (!box.width || !box.height) {
    return null
  }

  const step = Math.max(box.width, box.height) / grid
  const cols = Math.max(3, Math.ceil(box.width / step))
  const rows = Math.max(3, Math.ceil(box.height / step))
  const stepX = box.width / cols
  const stepY = box.height / rows
  const point = svg.createSVGPoint()
  const inside: boolean[][] = []

  for (let row = 0; row < rows; row++) {
    inside[row] = []

    for (let col = 0; col < cols; col++) {
      point.x = box.x + (col + 0.5) * stepX
      point.y = box.y + (row + 0.5) * stepY
      inside[row][col] = isInside(point)
    }
  }

  return { inside, rows, cols, stepX, stepY, x: box.x, y: box.y }
}

/**
 * Chebyshev distance from every inside cell to the nearest obstacle, in cells.
 *
 * Obstacles are the outside cells plus a virtual ring just beyond the grid: the
 * bbox edge has to count as an obstacle, otherwise a rectangle has none at all
 * and a shape with a single notch pushes the label to the opposite wall.
 *
 * Two chamfer passes — linear in cells. The straightforward "for every cell scan
 * every other cell" is quadratic and becomes the bottleneck on a floor with a
 * hundred-plus rooms.
 */
export function distanceTransform(mask: ShapeMask): number[][] {
  const { inside, rows, cols } = mask
  const dist: number[][] = []
  const at = (row: number, col: number): number =>
    row < 0 || col < 0 || row >= rows || col >= cols ? 0 : dist[row][col]

  for (let row = 0; row < rows; row++) {
    dist[row] = []

    for (let col = 0; col < cols; col++) {
      dist[row][col] = inside[row][col] ? Number.POSITIVE_INFINITY : 0
    }
  }

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (!inside[row][col]) continue

      dist[row][col] = Math.min(
        dist[row][col],
        Math.min(at(row - 1, col - 1), at(row - 1, col), at(row - 1, col + 1), at(row, col - 1)) + 1,
      )
    }
  }

  for (let row = rows - 1; row >= 0; row--) {
    for (let col = cols - 1; col >= 0; col--) {
      if (!inside[row][col]) continue

      dist[row][col] = Math.min(
        dist[row][col],
        Math.min(at(row + 1, col - 1), at(row + 1, col), at(row + 1, col + 1), at(row, col + 1)) + 1,
      )
    }
  }

  return dist
}

/**
 * The inside point furthest from the shape boundary, plus the free run through it.
 *
 * Ties are broken towards the bbox center: in a plain rectangle the whole middle
 * band shares the same clearance, and without a second criterion the first cell
 * in traversal order wins — the topmost one — so the label sticks to the edge.
 */
export function findSpot(mask: ShapeMask, dist = distanceTransform(mask)): ShapeSpot | null {
  const { inside, rows, cols, stepX, stepY } = mask
  const centerRow = (rows - 1) / 2
  const centerCol = (cols - 1) / 2

  let best: { row: number; col: number; clearance: number; offCenter: number } | null = null

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (!inside[row][col]) continue

      const clearance = dist[row][col]
      const offCenter = Math.hypot(row - centerRow, col - centerCol)
      const better =
        !best ||
        clearance > best.clearance ||
        (clearance === best.clearance && offCenter < best.offCenter)

      if (better) {
        best = { row, col, clearance, offCenter }
      }
    }
  }

  if (!best) {
    return null
  }

  let runX = 1

  for (let col = best.col - 1; col >= 0 && inside[best.row][col]; col--) runX++
  for (let col = best.col + 1; col < cols && inside[best.row][col]; col++) runX++

  let runY = 1

  for (let row = best.row - 1; row >= 0 && inside[row][best.col]; row--) runY++
  for (let row = best.row + 1; row < rows && inside[row][best.col]; row++) runY++

  return {
    x: mask.x + (best.col + 0.5) * stepX,
    y: mask.y + (best.row + 0.5) * stepY,
    runX: runX * stepX,
    runY: runY * stepY,
  }
}

/**
 * Largest axis-aligned rectangle that fits inside the shape.
 *
 * A point is enough for text, but an image needs an actual box. The classic
 * largest-rectangle-in-a-binary-matrix sweep enumerates every maximal rectangle
 * in one pass per row; when `aspect` is given, each of them is scored by the
 * largest box of that ratio it can host. That is exact: any rectangle inside the
 * shape is contained in some maximal one, and the aspect box inscribed in the
 * container is never smaller.
 *
 * Ties are broken towards the roomiest container. Once the requested ratio makes
 * one side the binding constraint, every larger container hosts the very same box
 * and scores the same — and keeping the first would anchor the box to whichever
 * edge the sweep happened to reach first instead of centering it.
 *
 * @param mask - Sampled shape
 * @param aspect - Desired width/height ratio. Omitted — the largest rectangle by area
 */
export function findRect(mask: ShapeMask, aspect?: number): ShapeRect | null {
  const { inside, rows, cols, stepX, stepY } = mask
  const heights = new Array<number>(cols).fill(0)

  let best: ShapeRect | null = null
  let bestScore = 0
  let bestArea = 0

  const consider = (colStart: number, rowStart: number, wCells: number, hCells: number): void => {
    const width = wCells * stepX
    const height = hCells * stepY

    if (width <= 0 || height <= 0) return

    let rect: ShapeRect
    let score: number

    if (aspect && aspect > 0) {
      const fitWidth = Math.min(width, height * aspect)
      const fitHeight = fitWidth / aspect

      score = fitWidth * fitHeight
      rect = {
        x: mask.x + colStart * stepX + (width - fitWidth) / 2,
        y: mask.y + rowStart * stepY + (height - fitHeight) / 2,
        width: fitWidth,
        height: fitHeight,
      }
    } else {
      score = width * height
      rect = {
        x: mask.x + colStart * stepX,
        y: mask.y + rowStart * stepY,
        width,
        height,
      }
    }

    const area = width * height

    if (score > bestScore || (score === bestScore && area > bestArea)) {
      bestScore = score
      bestArea = area
      best = rect
    }
  }

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      heights[col] = inside[row][col] ? heights[col] + 1 : 0
    }

    const stack: number[] = []

    for (let col = 0; col <= cols; col++) {
      const height = col === cols ? 0 : heights[col]

      while (stack.length && heights[stack[stack.length - 1]] > height) {
        const top = stack.pop() as number
        const barHeight = heights[top]
        const left = stack.length ? stack[stack.length - 1] + 1 : 0

        consider(left, row - barHeight + 1, col - left, barHeight)
      }

      if (col < cols) stack.push(col)
    }
  }

  return best
}

/** Shrinks a rectangle towards its center by a fraction of each side. */
export function insetRect(rect: ShapeRect, padding: number): ShapeRect {
  if (!padding) return rect

  const dx = rect.width * padding
  const dy = rect.height * padding

  return {
    x: rect.x + dx / 2,
    y: rect.y + dy / 2,
    width: Math.max(0, rect.width - dx),
    height: Math.max(0, rect.height - dy),
  }
}
