/**
 * Aspect ratios of images referenced by content candidates.
 *
 * The ratio is what decides whether a logo is worth drawing in a given shape or
 * whether the element is better off with its name — and it cannot be known
 * before the file is loaded. Results are cached per URL and shared by every
 * plugin instance, so the same brand on three floors is fetched once.
 *
 * A cached `null` means the probe failed (missing file, CORS, no intrinsic
 * size); it is remembered so the failure is not retried on every rebuild.
 */
const cache = new Map<string, number | null>()
const inflight = new Map<string, Promise<number | null>>()

const isSvgUrl = (href: string): boolean =>
  /\.svg(\?|#|$)/i.test(href) || href.startsWith('data:image/svg+xml')

/** Loads the file as an image and reads its intrinsic size */
function ratioFromImage(href: string): Promise<number | null> {
  return new Promise(resolve => {
    if (typeof Image !== 'function') {
      resolve(null)
      return
    }

    const image = new Image()

    image.onload = () => {
      resolve(
        image.naturalWidth && image.naturalHeight
          ? image.naturalWidth / image.naturalHeight
          : null,
      )
    }
    image.onerror = () => resolve(null)
    image.src = href
  })
}

/**
 * Reads the ratio out of the SVG source.
 *
 * An SVG without `width`/`height` has no intrinsic size, and browsers report a
 * 300x150 default for it — so the markup is the only reliable source. Fails
 * silently on a cross-origin file, and the image path takes over.
 */
async function ratioFromSvgSource(href: string): Promise<number | null> {
  if (typeof fetch !== 'function' || typeof DOMParser !== 'function') return null

  try {
    const response = await fetch(href)

    if (!response.ok) return null

    const root = new DOMParser()
      .parseFromString(await response.text(), 'image/svg+xml')
      .documentElement
    const viewBox = root.getAttribute('viewBox')

    if (viewBox) {
      const parts = viewBox.split(/[\s,]+/).map(Number)

      if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
        return parts[2] / parts[3]
      }
    }

    const width = Number.parseFloat(root.getAttribute('width') ?? '')
    const height = Number.parseFloat(root.getAttribute('height') ?? '')

    return width > 0 && height > 0 ? width / height : null
  } catch {
    return null
  }
}

/**
 * Ratio already known for this URL.
 * `undefined` — not probed yet, `null` — probed and unknown.
 */
export function getCachedRatio(href: string): number | null | undefined {
  return cache.get(href)
}

/** Probes the image once and caches the result, including failures */
export function probeRatio(href: string): Promise<number | null> {
  const known = cache.get(href)

  if (known !== undefined) return Promise.resolve(known)

  const running = inflight.get(href)

  if (running) return running

  const probe = (isSvgUrl(href)
    ? ratioFromSvgSource(href).then(ratio => ratio ?? ratioFromImage(href))
    : ratioFromImage(href)
  ).then(ratio => {
    cache.set(href, ratio)
    inflight.delete(href)

    return ratio
  })

  inflight.set(href, probe)

  return probe
}

/** Drops the cache. Intended for tests */
export function clearRatioCache(): void {
  cache.clear()
  inflight.clear()
}
