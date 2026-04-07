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
  // По умолчанию попап выше курсора
  let y = event.clientY - popupRect.height - oy

  // Не выходим за края viewport
  if (x + popupRect.width > vw) x = event.clientX - popupRect.width - ox
  if (x < 0) x = event.clientX + Math.abs(ox)
  // Уходит выше viewport — переворачиваем вниз
  if (y < 0) y = event.clientY + Math.abs(oy)
  // После переворота уходит ниже viewport — прижимаем к нижнему краю
  if (y + popupRect.height > vh) y = vh - popupRect.height

  return { x: x + window.scrollX, y: y + window.scrollY }
}
