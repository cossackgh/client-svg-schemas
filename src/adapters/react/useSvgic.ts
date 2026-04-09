import { useRef, useEffect, useState } from 'react'
import { Svgic } from '../../core/Svgic'
import type { SvgicOptions } from '../../types'

/**
 * Low-level hook for manual Svgic client management.
 * The client is created once on mount with the initial `options`.
 * Subsequent `options` changes are ignored — use `client.setSrc()` or
 * `client.setData()` to update the client programmatically.
 */
export function useSvgic(options: SvgicOptions) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [client, setClient] = useState<Svgic | null>(null)
  useEffect(() => {
    if (!containerRef.current) return

    const c = new Svgic(containerRef.current, options)
    c.ready.then(() => setClient(c))

    return () => {
      c.destroy()
      setClient(null)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { containerRef, client }
}
