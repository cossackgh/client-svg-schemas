import { describe, it, expect } from 'vitest'
import {
  distanceTransform,
  findRect,
  findSpot,
  insetRect,
  type ShapeMask,
} from '../src/plugins/content/geometry'

/**
 * Builds a mask from an ASCII picture: `#` is inside, anything else is outside.
 * Cell size is 1x1 by default, so cell indices and SVG units coincide.
 */
function maskFrom(rows: string[], stepX = 1, stepY = 1): ShapeMask {
  return {
    inside: rows.map(row => row.split('').map(char => char === '#')),
    rows: rows.length,
    cols: rows[0].length,
    stepX,
    stepY,
    x: 0,
    y: 0,
  }
}

describe('content geometry — distanceTransform', () => {
  it('reports zero for outside cells', () => {
    const dist = distanceTransform(maskFrom([
      '...',
      '.#.',
      '...',
    ]))

    expect(dist[0][0]).toBe(0)
    expect(dist[2][2]).toBe(0)
  })

  it('treats the grid edge as an obstacle', () => {
    // A fully filled grid has no outside cells at all — without the virtual ring
    // beyond the border every cell would come out equally clear.
    const dist = distanceTransform(maskFrom([
      '#####',
      '#####',
      '#####',
      '#####',
      '#####',
    ]))

    expect(dist[0][0]).toBe(1)
    expect(dist[2][2]).toBe(3)
    expect(dist[2][2]).toBeGreaterThan(dist[1][1])
  })

  it('measures Chebyshev distance to a hole', () => {
    const dist = distanceTransform(maskFrom([
      '#######',
      '#######',
      '###.###',
      '#######',
      '#######',
    ]))

    // The neighbours of the hole are one cell away, diagonals included.
    expect(dist[1][3]).toBe(1)
    expect(dist[1][2]).toBe(1)
    expect(dist[2][2]).toBe(1)
  })
})

describe('content geometry — findSpot', () => {
  it('picks the center of a rectangle', () => {
    const spot = findSpot(maskFrom([
      '#####',
      '#####',
      '#####',
    ]))

    expect(spot).not.toBeNull()
    expect(spot!.x).toBeCloseTo(2.5)
    expect(spot!.y).toBeCloseTo(1.5)
    expect(spot!.runX).toBe(5)
    expect(spot!.runY).toBe(3)
  })

  it('stays out of the notch of an L-shape', () => {
    const spot = findSpot(maskFrom([
      '######',
      '######',
      '######',
      '###...',
      '###...',
      '###...',
    ]))!

    // The point has to sit in the wide part, not in the bounding box center
    // (3, 3) — which is the corner of the notch.
    expect(spot.x).toBeLessThan(3)
  })

  it('returns null for an empty mask', () => {
    expect(findSpot(maskFrom([
      '...',
      '...',
    ]))).toBeNull()
  })

  it('reports the free run through the point, not the bounding box', () => {
    const spot = findSpot(maskFrom([
      '..##..',
      '..##..',
      '..##..',
      '..##..',
    ]))!

    expect(spot.runX).toBe(2)
    expect(spot.runY).toBe(4)
  })

  it('scales the result by the cell size', () => {
    const spot = findSpot(maskFrom(['###', '###', '###'], 10, 4))!

    expect(spot.x).toBeCloseTo(15)
    expect(spot.y).toBeCloseTo(6)
    expect(spot.runX).toBe(30)
    expect(spot.runY).toBe(12)
  })
})

describe('content geometry — findRect', () => {
  it('finds the largest rectangle by area', () => {
    const rect = findRect(maskFrom([
      '######',
      '######',
      '######',
    ]))!

    expect(rect).toEqual({ x: 0, y: 0, width: 6, height: 3 })
  })

  it('avoids a hole', () => {
    const rect = findRect(maskFrom([
      '#######',
      '###.###',
      '#######',
      '#######',
    ]))!

    // The bottom two full-width rows give 14; the tallest blocks beside the hole
    // are 3 x 4 = 12, so anything crossing the hole loses.
    expect(rect.height).toBe(2)
    expect(rect.width).toBe(7)
    expect(rect.y).toBe(2)
  })

  it('keeps the requested aspect ratio and centers the box', () => {
    const rect = findRect(maskFrom([
      '########',
      '########',
      '########',
      '########',
    ]), 2)!

    expect(rect.width / rect.height).toBeCloseTo(2)
    expect(rect.width).toBe(8)
    expect(rect.height).toBe(4)
  })

  it('shrinks a wide box to fit a narrow shape', () => {
    const rect = findRect(maskFrom([
      '..##..',
      '..##..',
      '..##..',
      '..##..',
    ]), 3)!

    // Widest available run is 2, so a 3:1 box can only be 2 x 0.67.
    expect(rect.width).toBeCloseTo(2)
    expect(rect.height).toBeCloseTo(2 / 3)
    expect(rect.x).toBeCloseTo(2)
  })

  it('returns null for an empty mask', () => {
    expect(findRect(maskFrom(['...', '...']))).toBeNull()
  })
})

describe('content geometry — insetRect', () => {
  it('shrinks towards the center', () => {
    expect(insetRect({ x: 0, y: 0, width: 100, height: 50 }, 0.1)).toEqual({
      x: 5,
      y: 2.5,
      width: 90,
      height: 45,
    })
  })

  it('returns the rectangle unchanged for zero padding', () => {
    const rect = { x: 1, y: 2, width: 3, height: 4 }

    expect(insetRect(rect, 0)).toBe(rect)
  })
})
