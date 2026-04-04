import type { SvgicItem } from '../types'

export function renderDefaultPopup(item: SvgicItem): HTMLElement {
  const el = document.createElement('div')
  el.className = 'svgic-popup'
  el.textContent = item.title ?? ''
  return el
}

export const DEFAULT_POPUP_STYLES = `
.svgic-popup {
  position: absolute;
  z-index: 9999;
  padding: 6px 10px;
  background: rgba(0, 0, 0, 0.75);
  color: #fff;
  font-size: 13px;
  line-height: 1.4;
  border-radius: 4px;
  pointer-events: none;
  white-space: nowrap;
}
`
