import type { SvgicPlugin, ISvgic, SvgicItem } from '../../types'

export interface DebugPluginOptions {
  /**
   * Триггер показа лейбла с id элемента.
   * - `'hover'` — показывать при наведении (default)
   * - `'click'` — показывать при клике, скрывать при повторном клике
   * - `'both'` — показывать при наведении, закреплять/откреплять кликом
   */
  showOn?: 'hover' | 'click' | 'both'

  /**
   * Кастомный рендер содержимого лейбла.
   * Получает `id` элемента и привязанные данные (`null` если данных нет).
   * Возвращает `HTMLElement` или HTML-строку.
   *
   * @example
   * ```ts
   * DebugPlugin({
   *   render(id, item) {
   *     return item
   *       ? `${id} · ${item.title}`
   *       : `${id} ⚠ нет данных`
   *   }
   * })
   * ```
   */
  render?: (id: string, item: SvgicItem | null) => HTMLElement | string
}

const STYLE_ID = 'svgic-debug-styles'

const STYLES = `
.svgic-debug-label {
  position: absolute;
  z-index: 99999;
  padding: 4px 8px;
  background: rgba(15, 23, 42, 0.92);
  font-family: ui-monospace, monospace;
  font-size: 11px;
  line-height: 1.5;
  border-radius: 4px;
  border: 1px solid rgba(125, 211, 252, 0.2);
  pointer-events: none;
  white-space: nowrap;
  user-select: none;
}
.svgic-debug-label--pinned {
  border-color: rgba(251, 191, 36, 0.4);
}
.svgic-debug-id {
  color: #7dd3fc;
}
.svgic-debug-label--pinned .svgic-debug-id {
  color: #fbbf24;
}
.svgic-debug-title {
  color: #94a3b8;
  margin-left: 6px;
}
.svgic-debug-nodata {
  color: #f87171;
  margin-left: 6px;
}
`

function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = STYLES
  document.head.appendChild(style)
}

function renderDefault(id: string, item: SvgicItem | null): HTMLElement {
  const el = document.createElement('div')
  const idSpan = document.createElement('span')
  idSpan.className = 'svgic-debug-id'
  idSpan.textContent = id
  el.appendChild(idSpan)

  if (item) {
    if (item.title) {
      const titleSpan = document.createElement('span')
      titleSpan.className = 'svgic-debug-title'
      titleSpan.textContent = item.title
      el.appendChild(titleSpan)
    }
  } else {
    const noDataSpan = document.createElement('span')
    noDataSpan.className = 'svgic-debug-nodata'
    noDataSpan.textContent = '⚠ нет данных'
    el.appendChild(noDataSpan)
  }

  return el
}

function applyContent(
  label: HTMLElement,
  id: string,
  item: SvgicItem | null,
  customRender?: DebugPluginOptions['render'],
): void {
  label.innerHTML = ''
  const content = customRender ? customRender(id, item) : renderDefault(id, item)
  if (typeof content === 'string') {
    label.innerHTML = content
  } else {
    label.appendChild(content)
  }
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
 * Плагин для разработки: показывает id и данные SVG-элементов при наведении/клике.
 * Помогает отлаживать привязку данных — сразу видно, есть ли в `data` запись для элемента.
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
  const { showOn = 'hover', render } = opts

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

    onElementHover(element: SVGElement, item: SvgicItem | null): void {
      if (showOn !== 'hover' && showOn !== 'both') return
      if (!hoverLabel) hoverLabel = createLabel()
      applyContent(hoverLabel, element.id, item, render)
      positionLabel(hoverLabel, element)
    },

    onElementLeave(_element: SVGElement, _item: SvgicItem | null): void {
      if (showOn === 'hover') {
        removeHoverLabel()
      } else if (showOn === 'both') {
        // Убрать hover-лейбл только если элемент не закреплён
        const hoveredId = hoverLabel?.querySelector('.svgic-debug-id')?.textContent
        if (hoveredId !== pinnedId) removeHoverLabel()
      }
    },

    onElementClick(element: SVGElement, item: SvgicItem | null): void {
      if (showOn !== 'click' && showOn !== 'both') return

      if (pinnedId === element.id) {
        removePinnedLabel()
      } else {
        removePinnedLabel()
        pinnedLabel = createLabel()
        pinnedLabel.classList.add('svgic-debug-label--pinned')
        applyContent(pinnedLabel, element.id, item, render)
        positionLabel(pinnedLabel, element)
        pinnedId = element.id
      }
    },
  }
}
