import type { PopupAnchor, PopupOffset } from '../../types'

const DEFAULTS = {
  anchor: 'top-center' as PopupAnchor,
  offset: { x: 0, y: -8 },
}

export function getElementPosition(
  popupEl: HTMLElement,
  targetEl: SVGElement,
  anchor: PopupAnchor = DEFAULTS.anchor,
  offset: PopupOffset = {},
  flip: boolean = true,
): { x: number; y: number } {
  const rect = targetEl.getBoundingClientRect()
  const popupRect = popupEl.getBoundingClientRect()
  const ox = offset.x ?? DEFAULTS.offset.x
  const oy = offset.y ?? DEFAULTS.offset.y

  let x = 0
  let y = 0

  // Горизонталь
  if (anchor.includes('left')) {
    x = rect.left - popupRect.width + ox
  } else if (anchor.includes('right')) {
    x = rect.right + ox
  } else {
    // center по горизонтали
    x = rect.left + rect.width / 2 - popupRect.width / 2 + ox
  }

  // Вертикаль
  if (anchor === 'center') {
    y = rect.top + rect.height / 2 - popupRect.height / 2 + oy
  } else if (anchor.startsWith('bottom')) {
    y = rect.bottom + oy
  } else if (anchor === 'left' || anchor === 'right') {
    y = rect.top + rect.height / 2 - popupRect.height / 2 + oy
  } else {
    // top-*
    y = rect.top - popupRect.height + oy
  }

  if (flip) {
    const vw = window.innerWidth
    const vh = window.innerHeight

    if (x + popupRect.width > vw) x = rect.right - popupRect.width
    if (x < 0) x = rect.left

    if (y < 0) {
      // уходит вверх — переворачиваем вниз
      y = rect.bottom + Math.abs(oy)
    } else if (y + popupRect.height > vh) {
      y = rect.top - popupRect.height - Math.abs(oy)
    }
  }

  return { x: x + window.scrollX, y: y + window.scrollY }
}
