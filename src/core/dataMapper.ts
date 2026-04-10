import type { SvgicItem, IdMatchOption } from '../types'
import type { ParsedLayer } from './layerParser'

export interface BoundElement {
  element: SVGElement
  item: SvgicItem
}

interface MapDataOptions {
  idAttribute?: string
  idMatch?: IdMatchOption
}

function resolveElementKey(el: Element, idAttribute: string): string {
  if (idAttribute === 'id') return (el as SVGElement).id
  return el.getAttribute(idAttribute) ?? (el as SVGElement).id
}

function normalizeSuffix(svgKey: string): string {
  return svgKey.replace(/_\d+_?$/, '')
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
  options: MapDataOptions = {},
): Map<string, BoundElement> {
  const { idAttribute = 'id', idMatch = 'exact' } = options

  const available = new Map<string, SVGElement>()
  for (const [, layer] of layers) {
    if (layer.role !== 'interactive') continue
    for (const el of layer.element.querySelectorAll('[id]')) {
      const key = resolveElementKey(el, idAttribute)
      if (!key) continue
      if (available.has(key)) {
        console.warn(`[svgic] Duplicate element key "${key}" found across interactive layers — first occurrence used`)
        continue
      }
      available.set(key, el as SVGElement)
    }
  }

  // Pre-build transformed lookup for non-exact modes
  let transformedLookup: Map<string, { svgKey: string; el: SVGElement }> | null = null
  if (idMatch !== 'exact') {
    transformedLookup = new Map()
    const normalize = idMatch === 'suffix'
      ? normalizeSuffix
      : (idMatch as (svgId: string) => string)
    for (const [svgKey, el] of available) {
      const transformed = normalize(svgKey)
      if (transformed && !transformedLookup.has(transformed)) {
        transformedLookup.set(transformed, { svgKey, el })
      }
    }
  }

  const result = new Map<string, BoundElement>()
  const suffixMatches: Array<{ svgKey: string; dataId: string }> = []

  for (const item of data) {
    if (!item.id) {
      console.warn('[svgic] Item with empty id — skipped')
      continue
    }

    if (result.has(item.id)) {
      console.warn(`[svgic] Duplicate item id "${item.id}" in data — skipped`)
      continue
    }

    // 1. Exact match
    let el = available.get(item.id)

    // 2. Transformed match (if enabled and exact failed)
    if (!el && transformedLookup) {
      const match = transformedLookup.get(item.id)
      if (match) {
        el = match.el
        if (idMatch === 'suffix') {
          suffixMatches.push({ svgKey: match.svgKey, dataId: item.id })
        }
      }
    }

    if (!el) {
      console.warn(`[svgic] SVG element for data id "${item.id}" not found in interactive layers — skipped`)
      continue
    }

    result.set(item.id, { element: el, item })
  }

  if (suffixMatches.length > 0) {
    const lines = suffixMatches.map(m => `  "${m.svgKey}" → "${m.dataId}"`).join('\n')
    console.warn(`[svgic] ${suffixMatches.length} element(s) matched by suffix stripping:\n${lines}`)
  }

  return result
}
