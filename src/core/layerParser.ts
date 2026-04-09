import type { SvgicLayer, SvgicLayerRole } from '../types'

export interface ParsedLayer {
  element: SVGGElement
  role: SvgicLayerRole
}

/**
 * Finds <g id="..."> elements in SVG by layer config.
 * Returns Map: layerId → { element, role }.
 * Layers not found in SVG are skipped with a warning.
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
