/**
 * Загружает SVG из URL или из строки.
 * Возвращает распарсенный SVGSVGElement.
 */
export async function loadSvg(src: string): Promise<SVGSVGElement> {
  const svgString = isSvgString(src) ? src : await fetchSvg(src)
  return parseSvg(svgString)
}

function isSvgString(src: string): boolean {
  return src.trimStart().startsWith('<')
}

async function fetchSvg(url: string): Promise<string> {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`[svgic] Failed to load SVG from "${url}": ${response.status} ${response.statusText}`)
  }

  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('svg') && !contentType.includes('xml') && !contentType.includes('text')) {
    throw new Error(`[svgic] Unexpected content-type "${contentType}" for "${url}"`)
  }

  return response.text()
}

function parseSvg(svgString: string): SVGSVGElement {
  const parser = new DOMParser()
  const doc = parser.parseFromString(svgString, 'image/svg+xml')

  const parseError = doc.querySelector('parsererror')
  if (parseError) {
    throw new Error(`[svgic] Invalid SVG: ${parseError.textContent?.trim()}`)
  }

  const svgEl = doc.documentElement
  if (!(svgEl instanceof SVGSVGElement)) {
    throw new Error('[svgic] Root element is not <svg>')
  }

  return svgEl
}
