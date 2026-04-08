import type { SvgicPlugin, ISvgic, SvgicItem } from '../../types'
import type { ZoomPluginOptions, ZoomState } from './types'
import { ZoomController } from './ZoomController'

export interface ZoomPluginInstance extends SvgicPlugin {
  /**
   * Устанавливает масштаб относительно центра текущего viewBox.
   * @param scale - Целевой масштаб (1 = исходный размер)
   */
  zoomTo(scale: number, options?: { animate?: boolean }): void
  /**
   * Перемещает viewBox к указанной позиции в SVG-координатах.
   * @param x - Смещение по X
   * @param y - Смещение по Y
   */
  panTo(x: number, y: number, options?: { animate?: boolean }): void
  /**
   * Фокусируется на элементе: zoom + центрирование.
   * @param elementOrId - `id` элемента (строка) или ссылка на `SVGElement`
   * @param options.scale - Целевой масштаб. Default: значение опции `focusScale`
   */
  focusElement(elementOrId: string | SVGElement, options?: { scale?: number; animate?: boolean }): void
  /** Сбрасывает к исходному viewBox SVG-файла */
  reset(options?: { animate?: boolean }): void
  /** Возвращает текущее состояние: `{ scale, x, y }` */
  getState(): ZoomState
}

/**
 * Официальный плагин zoom/pan для svgic.
 *
 * @example
 * ```ts
 * import { ZoomPlugin } from 'svgic/plugins/zoom'
 *
 * const zoom = ZoomPlugin({ wheelMode: 'ctrl', focusOnClick: true })
 * const client = new Svgic('#container', { src: '/map.svg', plugins: [zoom] })
 *
 * // Программный API
 * zoom.focusElement('room-101')
 * zoom.reset()
 * ```
 */
/** Порог масштаба для focusOnClick: фокус срабатывает только если текущий масштаб
 *  меньше чем focusScale * FOCUS_SCALE_THRESHOLD (предотвращает повторный zoom на уже крупном виде) */
const FOCUS_SCALE_THRESHOLD = 0.9

export function ZoomPlugin(opts: ZoomPluginOptions = {}): ZoomPluginInstance {
  let controller: ZoomController | null = null

  const assertReady = (): ZoomController => {
    if (!controller) throw new Error('[ZoomPlugin] Plugin not initialized yet. Wait for client.ready.')
    return controller
  }

  const plugin: ZoomPluginInstance = {
    name: 'svgic:zoom',

    onInit(client: ISvgic): void {
      const svg = client.getElement()
      if (!svg) return
      controller = new ZoomController(svg, opts)

      if (opts.focusOnClick) {
        client.on('click', (_id: string, item: SvgicItem | null) => {
          if (!item?.id) return
          const c = controller
          if (!c) return
          const currentScale = c.getState().scale
          // Фокус только если масштаб ещё не крупнее focusScale
          if (currentScale < (opts.focusScale ?? 2) * FOCUS_SCALE_THRESHOLD) {
            c.focusElement(item.id)
          }
        })
      }
    },

    onDestroy(_client: ISvgic): void {
      controller?.destroy()
      controller = null
    },

    zoomTo(scale, options) {
      assertReady().zoomTo(scale, options)
    },

    panTo(x, y, options) {
      assertReady().panTo(x, y, options)
    },

    focusElement(elementOrId, options) {
      assertReady().focusElement(elementOrId, options)
    },

    reset(options) {
      assertReady().reset(options)
    },

    getState() {
      return assertReady().getState()
    },
  }

  return plugin
}
