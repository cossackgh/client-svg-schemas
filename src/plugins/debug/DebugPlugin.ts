import type { SvgicPlugin, ISvgic, SvgicItem } from '../../types'

export interface DebugPluginOptions {
  /**
   * Триггер показа лейбла с id элемента.
   * - `'hover'` — показывать при наведении (default)
   * - `'click'` — показывать при клике, скрывать при повторном клике
   * - `'both'` — показывать при наведении, закреплять/откреплять кликом
   */
  showOn?: 'hover' | 'click' | 'both'
}

const STYLE_ID = 'svgic-debug-styles'

const STYLES = `
.svgic-debug-label {
  position: absolute;
  z-index: 99999;
  padding: 2px 7px;
  background: rgba(15, 23, 42, 0.88);
  color: #7dd3fc;
  font-family: ui-monospace, monospace;
  font-size: 11px;
  line-height: 1.5;
  border-radius: 3px;
  border: 1px solid rgba(125, 211, 252, 0.25);
  pointer-events: none;
  white-space: nowrap;
  user-select: none;
}
.svgic-debug-label--pinned {
  color: #fbbf24;
  border-color: rgba(251, 191, 36, 0.35);
}
`

function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = STYLES
  document.head.appendChild(style)
}

function createLabel(): HTMLElement {
  const el = document.createElement('div')
  el.className = 'svgic-debug-label'
  document.body.appendChild(el)
  return el
}

function positionLabel(label: HTMLElement, target: SVGElement): void {
  const rect = target.getBoundingClientRect()
  label.style.left = `${rect.left + window.scrollX}px`
  label.style.top = `${rect.bottom + window.scrollY + 4}px`
}

/**
 * Плагин для разработки: показывает id SVG-элементов при наведении/клике.
 *
 * @example
 * ```ts
 * import { DebugPlugin } from 'svgic/plugins/debug'
 *
 * const debug = new URLSearchParams(location.search).has('debug')
 *
 * new Svgic('#container', {
 *   src: '/map.svg',
 *   plugins: debug ? [DebugPlugin()] : [],
 * })
 * ```
 */
export function DebugPlugin(opts: DebugPluginOptions = {}): SvgicPlugin {
  const { showOn = 'hover' } = opts

  let hoverLabel: HTMLElement | null = null
  let pinnedLabel: HTMLElement | null = null
  let pinnedId: string | null = null

  function removeHoverLabel(): void {
    hoverLabel?.remove()
    hoverLabel = null
  }

  function removePinnedLabel(): void {
    pinnedLabel?.remove()
    pinnedLabel = null
    pinnedId = null
  }

  return {
    name: 'svgic:debug',

    onInit(_client: ISvgic): void {
      injectStyles()
    },

    onDestroy(_client: ISvgic): void {
      removeHoverLabel()
      removePinnedLabel()
    },

    onElementHover(element: SVGElement, _item: SvgicItem | null): void {
      if (showOn !== 'hover' && showOn !== 'both') return
      if (!hoverLabel) hoverLabel = createLabel()
      hoverLabel.textContent = element.id
      positionLabel(hoverLabel, element)
    },

    onElementLeave(_element: SVGElement, _item: SvgicItem | null): void {
      if (showOn === 'hover') {
        removeHoverLabel()
      } else if (showOn === 'both') {
        // Оставить hover-лейбл только если это не закреплённый элемент
        if (hoverLabel && hoverLabel.textContent !== pinnedId) {
          removeHoverLabel()
        }
      }
    },

    onElementClick(element: SVGElement, _item: SvgicItem | null): void {
      if (showOn !== 'click' && showOn !== 'both') return

      if (pinnedId === element.id) {
        // Повторный клик — открепить
        removePinnedLabel()
      } else {
        // Закрепить новый лейбл
        removePinnedLabel()
        pinnedLabel = createLabel()
        pinnedLabel.classList.add('svgic-debug-label--pinned')
        pinnedLabel.textContent = element.id
        positionLabel(pinnedLabel, element)
        pinnedId = element.id
      }
    },
  }
}
