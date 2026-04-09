import type { SvgicItem } from '../types'
import type { ParsedLayer } from './layerParser'

export interface BoundElement {
  element: SVGElement
  item: SvgicItem
}

/**
 * Binds SvgicItem[] to SVG elements by item.id, searching only within
 * layers with role 'interactive'. Elements in other layers are not considered.
 * Items not found in interactive layers are skipped with a warning.
 * Duplicate ids in data are skipped with a warning.
 */
export function mapData(
  layers: Map<string, ParsedLayer>,
  data: SvgicItem[],
): Map<string, BoundElement> {
  const available = new Map<string, SVGElement>()
  for (const [, layer] of layers) {
    if (layer.role !== 'interactive') continue
    for (const el of layer.element.querySelectorAll('[id]')) {
      available.set(el.id, el as SVGElement)
    }
  }

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

    const el = available.get(item.id)

    if (!el) {
      console.warn(`[svgic] SVG element with id "${item.id}" not found in interactive layers — skipped`)
      continue
    }

    result.set(item.id, { element: el, item })
  }

  return result
}
