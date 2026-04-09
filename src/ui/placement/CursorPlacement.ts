import type { PopupOffset } from '../../types'

const DEFAULTS: Required<PopupOffset> = { x: 16, y: 16 }

/**
 * Calculates popup position relative to the cursor, keeping it inside the viewport.
 */
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
  // By default popup is above the cursor
  let y = event.clientY - popupRect.height - oy

  // Don't go out of viewport bounds
  if (x + popupRect.width > vw) x = event.clientX - popupRect.width - ox
  if (x < 0) x = event.clientX + Math.abs(ox)
  // Goes above viewport — flip downward
  if (y < 0) y = event.clientY + Math.abs(oy)
  // After flip goes below viewport — clamp to bottom edge
  if (y + popupRect.height > vh) y = vh - popupRect.height

  return { x: x + window.scrollX, y: y + window.scrollY }
}
