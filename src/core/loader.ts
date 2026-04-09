/**
 * Loads SVG from a URL or from a string.
 * Returns a parsed SVGSVGElement.
 */
export async function loadSvg(src: string): Promise<SVGSVGElement> {
  const svgString = isSvgString(src) ? src : await fetchSvg(src)
  return parseSvg(svgString)
}

function isSvgString(src: string): boolean {
  // Any string starting with '<' is treated as inline SVG, not a URL.
  // No valid URL begins with '<', so this is a safe and simple heuristic.
  return src.trimStart().startsWith('<')
}

async function fetchSvg(url: string, timeoutMs = 30_000): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  let response: Response
  try {
    response = await fetch(url, { signal: controller.signal })
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`[svgic] Timeout loading SVG from "${url}" (${timeoutMs}ms)`)
    }
    throw err
  } finally {
    clearTimeout(timer)
  }

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

  sanitizeSvg(svgEl)

  return svgEl
}

/**
 * Removes potentially dangerous content from SVG before DOM insertion:
 * - <script> elements
 * - inline event handler attributes (on*)
 */
function sanitizeSvg(svgEl: SVGSVGElement): void {
  svgEl.querySelectorAll('script').forEach(el => el.remove())

  for (const el of svgEl.querySelectorAll('*')) {
    for (const attr of [...el.attributes]) {
      if (attr.name.startsWith('on')) {
        el.removeAttribute(attr.name)
      }
    }
  }
}
