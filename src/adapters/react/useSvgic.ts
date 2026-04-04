import { useRef, useEffect, useState } from 'react'
import { Svgic } from '../../core/Svgic'
import type { SvgicOptions } from '../../types'

export function useSvgic(options: SvgicOptions) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [client, setClient] = useState<Svgic | null>(null)
  const optionsRef = useRef(options)

  useEffect(() => {
    if (!containerRef.current) return

    const c = new Svgic(containerRef.current, optionsRef.current)
    c.ready.then(() => setClient(c))

    return () => {
      c.destroy()
      setClient(null)
    }
  }, [])

  return { containerRef, client }
}
