import type { SvgicPlugin, ISvgic, SvgicItem } from '../../types'
import type { ZoomPluginOptions, ZoomState } from './types'
import { ZoomController } from './ZoomController'

export interface ZoomPluginInstance extends SvgicPlugin {
  /**
   * Sets scale relative to the center of the current viewBox.
   * @param scale - Target scale (1 = original size)
   */
  zoomTo(scale: number, options?: { animate?: boolean }): void
  /**
   * Moves the viewBox to the specified position in SVG coordinates.
   * @param x - Offset along X
   * @param y - Offset along Y
   */
  panTo(x: number, y: number, options?: { animate?: boolean }): void
  /**
   * Focuses on an element: zoom + centering.
   * @param elementOrId - Element `id` (string) or reference to an `SVGElement`
   * @param options.scale - Target scale. Default: value of the `focusScale` option
   */
  focusElement(elementOrId: string | SVGElement, options?: { scale?: number; animate?: boolean }): void
  /** Resets to the original viewBox of the SVG file */
  reset(options?: { animate?: boolean }): void
  /** Returns the current state: `{ scale, x, y }` */
  getState(): ZoomState
}

/**
 * Official zoom/pan plugin for svgic.
 *
 * @example
 * ```ts
 * import { ZoomPlugin } from 'svgic/plugins/zoom'
 *
 * const zoom = ZoomPlugin({ wheelMode: 'ctrl', focusOnClick: true })
 * const client = new Svgic('#container', { src: '/map.svg', plugins: [zoom] })
 *
 * // Programmatic API
 * zoom.focusElement('room-101')
 * zoom.reset()
 * ```
 */
/** Scale threshold for focusOnClick: focus only fires if current scale
 *  is less than focusScale * FOCUS_SCALE_THRESHOLD (prevents re-zoom when already zoomed in) */
const FOCUS_SCALE_THRESHOLD = 0.9

export function ZoomPlugin(opts: ZoomPluginOptions = {}): ZoomPluginInstance {
  let controller: ZoomController | null = null
  // Prevents duplicate handler registration across setSrc() calls.
  // EventManager preserves on() handlers after destroy(), so we must guard manually.
  let clickAttached = false

  const assertReady = (): ZoomController => {
    if (!controller) throw new Error('[ZoomPlugin] Plugin is not active — call after client.ready or before client.destroy().')
    return controller
  }

  const plugin: ZoomPluginInstance = {
    name: 'svgic:zoom',

    onInit(client: ISvgic): void {
      const svg = client.getElement()
      if (!svg) return
      controller = new ZoomController(svg, opts)

      if (opts.focusOnClick && !clickAttached) {
        clickAttached = true
        client.on('click', (_id: string | null, item: SvgicItem | null) => {
          if (!item?.id) return
          const c = controller
          if (!c) return
          const currentScale = c.getState().scale
          // Focus only if scale is not yet larger than focusScale
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
