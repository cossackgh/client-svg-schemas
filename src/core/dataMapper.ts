import type { SvgicItem } from '../types'

export interface BoundElement {
  element: SVGElement
  item: SvgicItem
}

/**
 * Binds SvgicItem[] to SVG elements by item.id field.
 * Returns Map: itemId → { element, item }.
 * Items not found in SVG are skipped with a warning.
 * Duplicate ids in data are skipped with a warning.
 */
export function mapData(
  svg: SVGSVGElement,
  data: SvgicItem[],
): Map<string, BoundElement> {
  const result = new Map<string, BoundElement>()

  for (const item of data) {
    if (!item.id) {
      console.warn('[svgic] Item with empty id — skipped')
      continue
    }

    if (result.has(item.id)) {
      console.warn(`[svgic] Duplicate item id "${item.id}" in data — skipped`)
      continue
    }

    const el = svg.getElementById(item.id)

    if (!el) {
      console.warn(`[svgic] SVG element with id "${item.id}" not found — skipped`)
      continue
    }

    result.set(item.id, { element: el as SVGElement, item })
  }

  return result
}
