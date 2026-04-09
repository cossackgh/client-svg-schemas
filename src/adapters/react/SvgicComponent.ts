import { createElement, useRef, useEffect, useLayoutEffect, type CSSProperties } from 'react'
import { Svgic } from '../../core/Svgic'
import type { SvgicItem, SvgicLayer, SvgicPlugin, PopupOption, SvgicStyleConfig } from '../../types'

export interface SvgicProps {
  src: string
  data?: SvgicItem[]
  layers?: Record<string, SvgicLayer>
  plugins?: SvgicPlugin[]
  popup?: PopupOption
  /** SVG layer style configuration (not container CSS — use style/className for that) */
  styleConfig?: SvgicStyleConfig
  onClick?: (id: string | null, item: SvgicItem | null) => void
  onHover?: (id: string | null, item: SvgicItem | null) => void
  onLeave?: (id: string | null, item: SvgicItem | null) => void
  className?: string
  style?: CSSProperties
}

export function SvgicReact({
  src,
  data,
  layers,
  plugins,
  popup,
  styleConfig,
  onClick,
  onHover,
  onLeave,
  className,
  style,
}: SvgicProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const clientRef = useRef<Svgic | null>(null)

  // Keep refs to latest callbacks to avoid stale closures.
  // useLayoutEffect (no deps) syncs them synchronously after every render,
  // before any events can fire.
  const onClickRef = useRef(onClick)
  const onHoverRef = useRef(onHover)
  const onLeaveRef = useRef(onLeave)
  useLayoutEffect(() => {
    onClickRef.current = onClick
    onHoverRef.current = onHover
    onLeaveRef.current = onLeave
  })

  // Initialize and clean up when src changes
  useEffect(() => {
    if (!containerRef.current) return

    const client = new Svgic(containerRef.current, { src, data, layers, plugins, popup, style: styleConfig })
    clientRef.current = client

    client.ready.then(() => {
      // Stable wrappers always invoke the latest callback ref
      client.on('click', (id, item) => onClickRef.current?.(id, item))
      client.on('hover', (id, item) => onHoverRef.current?.(id, item))
      client.on('leave', (id, item) => onLeaveRef.current?.(id, item))
    })

    return () => {
      client.destroy()
      clientRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src])

  // Reactively update data without recreating the client
  useEffect(() => {
    if (clientRef.current && data) {
      clientRef.current.setData(data)
    }
  }, [data])

  return createElement('div', { ref: containerRef, className, style })
}
