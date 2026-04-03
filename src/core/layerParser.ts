import type { SvgicLayer, SvgicLayerRole } from '../types'

export interface ParsedLayer {
  element: SVGGElement
  role: SvgicLayerRole
}

/**
 * Ищет <g id="..."> элементы в SVG по конфигу слоёв.
 * Возвращает Map: layerId → { element, role }.
 * Слои, отсутствующие в SVG, пропускаются с предупреждением.
 */
export function parseLayers(
  svg: SVGSVGElement,
  layers: Record<string, SvgicLayer> = {},
): Map<string, ParsedLayer> {
  const result = new Map<string, ParsedLayer>()

  for (const [id, config] of Object.entries(layers)) {
    const el = svg.getElementById(id)

    if (!el) {
      console.warn(`[svgic] Layer "${id}" not found in SVG`)
      continue
    }

    if (el.tagName.toLowerCase() !== 'g') {
      console.warn(`[svgic] Layer "${id}" is <${el.tagName.toLowerCase()}>, expected <g> — skipped`)
      continue
    }

    result.set(id, { element: el as SVGGElement, role: config.role })
  }

  return result
}
