import type { SvgicItem } from '../types'

export interface BoundElement {
  element: SVGElement
  item: SvgicItem
}

/**
 * Привязывает SvgicItem[] к SVG-элементам по полю item.id.
 * Возвращает Map: itemId → { element, item }.
 * Элементы, не найденные в SVG, пропускаются с предупреждением.
 * Дубликаты id в data пропускаются с предупреждением.
 */
export function mapData(
  svg: SVGSVGElement,
  data: SvgicItem[],
): Map<string, BoundElement> {
  const result = new Map<string, BoundElement>()

  for (const item of data) {
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
