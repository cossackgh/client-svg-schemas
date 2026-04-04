import type { PopupOffset } from '../../types'

const DEFAULTS: Required<PopupOffset> = { x: 16, y: 16 }

export function getCursorPosition(
  popupEl: HTMLElement,
  event: MouseEvent,
  offset: PopupOffset = {},
): { x: number; y: number } {
  const ox = offset.x ?? DEFAULTS.x
  const oy = offset.y ?? DEFAULTS.y

  const popupRect = popupEl.getBoundingClientRect()
  const vw = window.innerWidth
  const vh = window.innerHeight

  let x = event.clientX + ox
  let y = event.clientY + oy

  // Не выходим за правый/нижний край viewport
  if (x + popupRect.width > vw) x = event.clientX - popupRect.width - ox
  if (y + popupRect.height > vh) y = event.clientY - popupRect.height - oy

  return { x: x + window.scrollX, y: y + window.scrollY }
}
