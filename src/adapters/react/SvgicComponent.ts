import { createElement, useRef, useEffect, type CSSProperties } from 'react'
import { Svgic } from '../../core/Svgic'
import type { SvgicItem, SvgicLayer, SvgicPlugin, PopupOption, SvgicStyleConfig } from '../../types'

export interface SvgicProps {
  src: string
  data?: SvgicItem[]
  layers?: Record<string, SvgicLayer>
  plugins?: SvgicPlugin[]
  popup?: PopupOption
  /** Конфигурация стилей SVG-слоёв (не CSS контейнера — для этого используй style/className) */
  styleConfig?: SvgicStyleConfig
  onClick?: (id: string, item: SvgicItem | null) => void
  onHover?: (id: string, item: SvgicItem | null) => void
  onLeave?: (id: string, item: SvgicItem | null) => void
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

  // Инициализация и очистка при смене src
  useEffect(() => {
    if (!containerRef.current) return

    const client = new Svgic(containerRef.current, { src, data, layers, plugins, popup, style: styleConfig })
    clientRef.current = client

    client.ready.then(() => {
      if (onClick) client.on('click', onClick)
      if (onHover) client.on('hover', onHover)
      if (onLeave) client.on('leave', onLeave)
    })

    return () => {
      client.destroy()
      clientRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src])

  // Реактивное обновление данных без пересоздания клиента
  useEffect(() => {
    if (clientRef.current && data) {
      clientRef.current.setData(data)
    }
  }, [data])

  return createElement('div', { ref: containerRef, className, style })
}
