import type { SvgicItem } from '../../types'
import type { ShapeRect, ShapeSpot } from './geometry'

/**
 * Everything known about one element at render time.
 *
 * Passed to every candidate callback, so the same signature covers a one-line
 * label and a composite card built by the host application.
 */
export interface ContentSlot {
  /** Element id, as matched against data */
  id: string
  /** Bound data item, `null` when the element has no data */
  item: SvgicItem | null
  /** The source element itself */
  element: SVGGraphicsElement
  /**
   * Largest rectangle that fits inside the shape, already inset by `padding`.
   * The place for images and composite content.
   */
  rect: ShapeRect
  /**
   * Point furthest from the boundary, plus the free run through it.
   * The place for text: a thin line fits where a rectangle does not.
   */
  spot: ShapeSpot
  /** Font size derived from the viewBox — the common size for the whole schema */
  fontSize: number
}

interface CandidateBase {
  /** Skips the candidate when it returns `false`. Omitted — the candidate applies to every element */
  when?: (slot: ContentSlot) => boolean
}

/**
 * Text: one line or several.
 *
 * Fits when its measured box stays within the free run through `spot`.
 */
export interface TextCandidate extends CandidateBase {
  type: 'text'
  /**
   * Text to draw. An array renders as several lines; `null`, `undefined` or an
   * empty string skips the candidate and hands the element to the next one.
   */
  text: (slot: ContentSlot) => string | string[] | null | undefined
  /**
   * Rotate by -90° in a shape that is taller than it is wide.
   * `'auto'` (default) — only when the text does not fit horizontally but fits vertically.
   */
  rotate?: boolean | 'auto'
  /** Absolute font size in SVG units. Overrides the size derived from `fontScale` */
  fontSize?: number
  fontFamily?: string
  fontWeight?: string | number
  /** Line spacing as a multiple of the font size. Default: `1.15` */
  lineHeight?: number
  fill?: string
  opacity?: number
  /** Extra class on the generated `<text>` */
  className?: string
}

/**
 * Anything the host application draws itself: an image with a caption, a badge,
 * a card. The callback receives the slot geometry and returns an SVG element.
 *
 * The plugin does not interpret the result — it measures it and either scales it
 * into `rect` or passes the element to the next candidate.
 */
export interface CustomCandidate extends CandidateBase {
  type: 'custom'
  /** Returns the element to place, or `null` to skip the candidate */
  render: (slot: ContentSlot) => SVGElement | null | undefined
  /**
   * What to do when the rendered element does not fit `rect`:
   * - `'scale'` (default) — shrink uniformly, and reject if that would go below `minScale`
   * - `'reject'` — hand the element to the next candidate
   * - `'none'` — keep as is (still clipped to the shape when `clip` is on)
   */
  fit?: 'scale' | 'reject' | 'none'
  /** Lower bound for `fit: 'scale'`, as a fraction of the original size. Default: `0.5` */
  minScale?: number
}

export type ContentCandidate = TextCandidate | CustomCandidate

export interface ContentPluginOptions {
  /** Layer id whose direct children get content */
  sourceLayer: string
  /**
   * Candidates in priority order. The first one that produces content and fits wins,
   * so `[logo, name, number]` degrades gracefully as the available space shrinks.
   */
  content: ContentCandidate[]
  /**
   * SVG attribute holding the element id. Mirrors the core option of the same name.
   * @default 'id'
   */
  idAttribute?: string
  /**
   * Grid density for shape sampling: cells along the longer side of the bounding box.
   * Higher is more precise and slower.
   * @default 24
   */
  grid?: number
  /**
   * Inset of the content box as a fraction of each side, so content does not touch the walls.
   * @default 0.08
   */
  padding?: number
  /**
   * Divider of the viewBox height that yields the font size.
   *
   * The size is derived from the schema rather than given as a number because canvases
   * differ wildly — a fixed size that reads on a 1600x800 viewBox disappears on 17000x7000,
   * while a divider carries over unchanged.
   * @default 70
   */
  fontScale?: number
  /**
   * Clip content to the shape of its element, so nothing can spill outside
   * even when a custom renderer misbehaves.
   * @default true
   */
  clip?: boolean
  /** Extra class on the generated layer */
  className?: string
}
