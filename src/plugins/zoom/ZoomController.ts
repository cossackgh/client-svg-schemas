import type { ZoomPluginOptions, ZoomState } from './types'

const DEFAULTS: Required<ZoomPluginOptions> = {
  minScale: 0.5,
  maxScale: 10,
  wheelMode: 'ctrl',
  pan: true,
  touch: true,
  doubleTapScale: 2,
  panBounds: true,
  animate: true,
  animationDuration: 300,
  focusOnClick: false,
  focusScale: 2,
}

interface ViewBox {
  x: number
  y: number
  width: number
  height: number
}

export class ZoomController {
  private svg: SVGSVGElement
  private opts: Required<ZoomPluginOptions>

  /** Original viewBox (from the SVG file) */
  private originalViewBox: ViewBox

  /** Current state */
  private state: ZoomState

  /** Event listeners for later removal */
  private listeners: Array<{ target: EventTarget; type: string; fn: EventListener }> = []

  /** Animation frame (RAF) */
  private animFrame: number | null = null

  // --- drag ---
  private isDragging = false
  private dragStart = { x: 0, y: 0, vbX: 0, vbY: 0 }
  private hasDragged = false

  // --- touch ---
  private lastPinchDist = 0
  private lastPinchMid = { x: 0, y: 0 }
  private lastTapTime = 0
  private lastTapPos = { x: 0, y: 0 }

  constructor(svg: SVGSVGElement, opts: ZoomPluginOptions) {
    this.svg = svg
    this.opts = { ...DEFAULTS, ...opts }
    this.originalViewBox = this.readViewBox()
    this.state = {
      scale: 1,
      x: this.originalViewBox.x,
      y: this.originalViewBox.y,
    }
    // Disable native browser drag and text selection on SVG
    svg.style.userSelect = 'none'
    if (this.opts.pan) {
      svg.style.cursor = 'grab'
    }
    this.attach()
  }

  // ─── Public API ──────────────────────────────────────────────────────────────

  getState(): ZoomState {
    return { ...this.state }
  }

  zoomTo(scale: number, options?: { animate?: boolean }): void {
    const s = this.clampScale(scale)
    const vb = this.currentViewBox()
    // Scale relative to center of current viewBox
    const cx = vb.x + vb.width / 2
    const cy = vb.y + vb.height / 2
    this.zoomAround(cx, cy, s, options?.animate ?? this.opts.animate)
  }

  panTo(x: number, y: number, options?: { animate?: boolean }): void {
    const vb = this.currentViewBox()
    const target = this.clampViewBox(x, y, vb.width, vb.height)
    if (options?.animate ?? this.opts.animate) {
      this.animateTo(vb, { ...target, width: vb.width, height: vb.height })
    } else {
      this.state.x = target.x
      this.state.y = target.y
      this.applyViewBox()
    }
  }

  /** Focus on an SVG element (zoom + center) */
  focusElement(elementOrId: string | SVGElement, options?: { scale?: number; animate?: boolean }): void {
    const el = typeof elementOrId === 'string'
      ? this.svg.querySelector(`#${CSS.escape(elementOrId)}`)
      : elementOrId

    if (!(el instanceof SVGGraphicsElement)) return

    const bbox = el.getBBox()
    const targetScale = options?.scale ?? this.opts.focusScale
    const s = this.clampScale(targetScale)

    const ovb = this.originalViewBox
    const newW = ovb.width / s
    const newH = ovb.height / s

    // Center viewBox on element bbox
    const cx = bbox.x + bbox.width / 2
    const cy = bbox.y + bbox.height / 2
    const raw = { x: cx - newW / 2, y: cy - newH / 2, width: newW, height: newH }
    const from = this.currentViewBox()
    const clamped = this.clampViewBox(raw.x, raw.y, raw.width, raw.height)
    this.state.scale = s

    if (options?.animate ?? this.opts.animate) {
      this.animateTo(from, { ...clamped, width: raw.width, height: raw.height })
    } else {
      this.state.x = clamped.x
      this.state.y = clamped.y
      this.applyViewBox()
    }
  }

  reset(options?: { animate?: boolean }): void {
    const ovb = this.originalViewBox
    if (options?.animate ?? this.opts.animate) {
      this.animateTo(this.currentViewBox(), ovb)
    } else {
      this.state = { scale: 1, x: ovb.x, y: ovb.y }
      this.applyViewBox()
    }
  }

  destroy(): void {
    if (this.animFrame !== null) {
      cancelAnimationFrame(this.animFrame)
      this.animFrame = null
    }
    for (const { target, type, fn } of this.listeners) {
      target.removeEventListener(type, fn)
    }
    this.listeners = []
  }

  // ─── Listener setup ───────────────────────────────────────────────────────

  private attach(): void {
    const svg = this.svg

    // Wheel
    const onWheel = (e: Event) => this.handleWheel(e as WheelEvent)
    svg.addEventListener('wheel', onWheel, { passive: false })
    this.listeners.push({ target: svg, type: 'wheel', fn: onWheel as EventListener })

    if (this.opts.pan) {
      const onMouseDown = (e: Event) => this.handleMouseDown(e as MouseEvent)
      const onMouseMove = (e: Event) => this.handleMouseMove(e as MouseEvent)
      const onMouseUp   = (e: Event) => this.handleMouseUp(e as MouseEvent)
      svg.addEventListener('mousedown', onMouseDown)
      window.addEventListener('mousemove', onMouseMove)
      window.addEventListener('mouseup', onMouseUp)
      this.listeners.push(
        { target: svg,    type: 'mousedown', fn: onMouseDown as EventListener },
        { target: window, type: 'mousemove', fn: onMouseMove as EventListener },
        { target: window, type: 'mouseup',   fn: onMouseUp   as EventListener },
      )
    }

    if (this.opts.touch) {
      const onTouchStart = (e: Event) => this.handleTouchStart(e as TouchEvent)
      const onTouchMove  = (e: Event) => this.handleTouchMove(e as TouchEvent)
      const onTouchEnd   = (e: Event) => this.handleTouchEnd(e as TouchEvent)
      svg.addEventListener('touchstart', onTouchStart, { passive: false })
      svg.addEventListener('touchmove',  onTouchMove,  { passive: false })
      svg.addEventListener('touchend',   onTouchEnd)
      this.listeners.push(
        { target: svg, type: 'touchstart', fn: onTouchStart as EventListener },
        { target: svg, type: 'touchmove',  fn: onTouchMove  as EventListener },
        { target: svg, type: 'touchend',   fn: onTouchEnd   as EventListener },
      )
    }
  }

  // ─── Wheel ────────────────────────────────────────────────────────────────

  private handleWheel(e: WheelEvent): void {
    if (this.opts.wheelMode === 'ctrl' && !e.ctrlKey) return
    e.preventDefault()

    const factor = e.deltaY > 0 ? 0.9 : 1.1
    const newScale = this.clampScale(this.state.scale * factor)
    const svgPt = this.clientToSvg(e.clientX, e.clientY)
    this.zoomAround(svgPt.x, svgPt.y, newScale, false)
  }

  // ─── Mouse drag ──────────────────────────────────────────────────────────

  private handleMouseDown(e: MouseEvent): void {
    if (e.button !== 0) return
    e.preventDefault() // prevent native SVG drag in browser
    this.isDragging = true
    this.hasDragged = false
    this.dragStart = {
      x: e.clientX,
      y: e.clientY,
      vbX: this.state.x,
      vbY: this.state.y,
    }
    this.svg.style.cursor = 'grabbing'
  }

  private handleMouseMove(e: MouseEvent): void {
    if (!this.isDragging) return

    const dx = e.clientX - this.dragStart.x
    const dy = e.clientY - this.dragStart.y

    if (!this.hasDragged && Math.abs(dx) + Math.abs(dy) > 3) {
      this.hasDragged = true
    }
    if (!this.hasDragged) return

    const vb = this.currentViewBox()
    const rect = this.svg.getBoundingClientRect()
    // Convert pixels to SVG units
    const scaleX = vb.width / rect.width
    const scaleY = vb.height / rect.height

    const rawX = this.dragStart.vbX - dx * scaleX
    const rawY = this.dragStart.vbY - dy * scaleY
    const clamped = this.clampViewBox(rawX, rawY, vb.width, vb.height)

    this.state.x = clamped.x
    this.state.y = clamped.y
    this.applyViewBox()
  }

  private handleMouseUp(_e: MouseEvent): void {
    this.isDragging = false
    this.svg.style.cursor = this.opts.pan ? 'grab' : ''
  }

  // ─── Touch ───────────────────────────────────────────────────────────────

  private handleTouchStart(e: TouchEvent): void {
    e.preventDefault()

    if (e.touches.length === 1) {
      const t = e.touches[0]
      // Double tap
      const now = Date.now()
      const dx = t.clientX - this.lastTapPos.x
      const dy = t.clientY - this.lastTapPos.y
      if (now - this.lastTapTime < 300 && Math.abs(dx) + Math.abs(dy) < 20) {
        this.handleDoubleTap(t)
        this.lastTapTime = 0
        return
      }
      this.lastTapTime = now
      this.lastTapPos = { x: t.clientX, y: t.clientY }

      // Start pan
      this.isDragging = true
      this.hasDragged = false
      this.dragStart = {
        x: t.clientX,
        y: t.clientY,
        vbX: this.state.x,
        vbY: this.state.y,
      }
    } else if (e.touches.length === 2) {
      this.isDragging = false
      this.lastPinchDist = this.touchDist(e.touches[0], e.touches[1])
      this.lastPinchMid  = this.touchMid(e.touches[0], e.touches[1])
    }
  }

  private handleTouchMove(e: TouchEvent): void {
    e.preventDefault()

    if (e.touches.length === 1 && this.isDragging) {
      const t = e.touches[0]
      const dx = t.clientX - this.dragStart.x
      const dy = t.clientY - this.dragStart.y

      if (!this.hasDragged && Math.abs(dx) + Math.abs(dy) > 5) {
        this.hasDragged = true
      }
      if (!this.hasDragged) return

      const vb = this.currentViewBox()
      const rect = this.svg.getBoundingClientRect()
      const scaleX = vb.width / rect.width
      const scaleY = vb.height / rect.height

      const rawX = this.dragStart.vbX - dx * scaleX
      const rawY = this.dragStart.vbY - dy * scaleY
      const clamped = this.clampViewBox(rawX, rawY, vb.width, vb.height)
      this.state.x = clamped.x
      this.state.y = clamped.y
      this.applyViewBox()

    } else if (e.touches.length === 2) {
      const dist = this.touchDist(e.touches[0], e.touches[1])
      const mid  = this.touchMid(e.touches[0], e.touches[1])

      const pinchFactor = dist / this.lastPinchDist
      const newScale = this.clampScale(this.state.scale * pinchFactor)
      const svgMid = this.clientToSvg(mid.x, mid.y)

      this.zoomAround(svgMid.x, svgMid.y, newScale, false)

      // Additionally — pan from midpoint finger movement
      if (this.opts.pan) {
        const vb = this.currentViewBox()
        const rect = this.svg.getBoundingClientRect()
        const scaleX = vb.width / rect.width
        const scaleY = vb.height / rect.height
        const panDx = (mid.x - this.lastPinchMid.x) * scaleX
        const panDy = (mid.y - this.lastPinchMid.y) * scaleY
        const rawX = this.state.x - panDx
        const rawY = this.state.y - panDy
        const clamped = this.clampViewBox(rawX, rawY, vb.width, vb.height)
        this.state.x = clamped.x
        this.state.y = clamped.y
        this.applyViewBox()
      }

      this.lastPinchDist = dist
      this.lastPinchMid  = mid
    }
  }

  private handleTouchEnd(e: TouchEvent): void {
    if (e.touches.length < 2) {
      this.lastPinchDist = 0
    }
    if (e.touches.length === 0) {
      this.isDragging = false
    }
  }

  private handleDoubleTap(t: Touch): void {
    const svgPt = this.clientToSvg(t.clientX, t.clientY)
    // If already zoomed in significantly — reset, otherwise zoom in
    if (this.state.scale >= this.opts.doubleTapScale * 0.9) {
      this.reset()
    } else {
      const newScale = this.clampScale(this.state.scale * this.opts.doubleTapScale)
      this.zoomAround(svgPt.x, svgPt.y, newScale, true)
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  /** Current viewBox based on state */
  private currentViewBox(): ViewBox {
    const ovb = this.originalViewBox
    const w = ovb.width  / this.state.scale
    const h = ovb.height / this.state.scale
    return { x: this.state.x, y: this.state.y, width: w, height: h }
  }

  /** Zoom around a point in SVG coordinates */
  private zoomAround(svgX: number, svgY: number, newScale: number, animate: boolean): void {
    const ovb = this.originalViewBox
    const newW = ovb.width  / newScale
    const newH = ovb.height / newScale

    // The point must stay in the same position
    const vb = this.currentViewBox()
    const ratioX = (svgX - vb.x) / vb.width
    const ratioY = (svgY - vb.y) / vb.height

    const rawX = svgX - ratioX * newW
    const rawY = svgY - ratioY * newH

    const clamped = this.clampViewBox(rawX, rawY, newW, newH)
    this.state.scale = newScale

    if (animate) {
      this.animateTo(vb, { ...clamped, width: newW, height: newH })
    } else {
      this.state.x = clamped.x
      this.state.y = clamped.y
      this.applyViewBox()
    }
  }

  /** Apply viewBox to SVG and notify subscribers */
  private applyViewBox(): void {
    this.commitViewBox(this.currentViewBox())
  }

  /** Write viewBox to attribute and dispatch view change event */
  private commitViewBox(vb: ViewBox): void {
    this.svg.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.width} ${vb.height}`)
    this.svg.dispatchEvent(new CustomEvent('svgic:viewchange', { bubbles: false }))
  }

  /** Smooth animation to target viewBox */
  private animateTo(from: ViewBox, target: ViewBox): void {
    if (this.animFrame !== null) {
      cancelAnimationFrame(this.animFrame)
      this.animFrame = null
    }

    const duration = this.opts.animationDuration
    const startTime = performance.now()

    const tick = (now: number) => {
      const t = Math.min((now - startTime) / duration, 1)
      const ease = 1 - Math.pow(1 - t, 3) // ease-out cubic

      const vb: ViewBox = {
        x:      from.x      + (target.x      - from.x)      * ease,
        y:      from.y      + (target.y      - from.y)      * ease,
        width:  from.width  + (target.width  - from.width)  * ease,
        height: from.height + (target.height - from.height) * ease,
      }
      // Sync state
      const ovb = this.originalViewBox
      this.state.scale = ovb.width / vb.width
      this.state.x = vb.x
      this.state.y = vb.y
      this.commitViewBox(vb)

      if (t < 1) {
        this.animFrame = requestAnimationFrame(tick)
      } else {
        this.animFrame = null
      }
    }

    this.animFrame = requestAnimationFrame(tick)
  }

  /** Read viewBox from SVG attribute */
  private readViewBox(): ViewBox {
    const vb = this.svg.viewBox.baseVal
    // If viewBox is not set — try SVG width/height
    if (vb.width === 0 && vb.height === 0) {
      const w = this.svg.width.baseVal.value
      const h = this.svg.height.baseVal.value
      if (!w || !h) {
        console.warn('[svgic] ZoomPlugin: SVG has no viewBox and no width/height — falling back to 800×600')
      }
      const finalW = w || 800
      const finalH = h || 600
      this.svg.setAttribute('viewBox', `0 0 ${finalW} ${finalH}`)
      return { x: 0, y: 0, width: finalW, height: finalH }
    }
    return { x: vb.x, y: vb.y, width: vb.width, height: vb.height }
  }

  /** Convert client coordinates to SVG user units */
  private clientToSvg(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.svg.getBoundingClientRect()
    const vb   = this.currentViewBox()
    const x = vb.x + (clientX - rect.left) * (vb.width  / rect.width)
    const y = vb.y + (clientY - rect.top)  * (vb.height / rect.height)
    return { x, y }
  }

  /** Clamp scale */
  private clampScale(s: number): number {
    return Math.max(this.opts.minScale, Math.min(this.opts.maxScale, s))
  }

  /** Clamp viewBox position to prevent going outside SVG bounds */
  private clampViewBox(x: number, y: number, w: number, h: number): { x: number; y: number } {
    if (!this.opts.panBounds) return { x, y }

    const ovb = this.originalViewBox

    // When viewBox is wider than SVG (zoom out) — center it
    // When viewBox is narrower than SVG (zoom in) — restrict to SVG bounds
    const clampedX = w >= ovb.width
      ? ovb.x - (w - ovb.width) / 2
      : Math.max(ovb.x, Math.min(x, ovb.x + ovb.width - w))

    const clampedY = h >= ovb.height
      ? ovb.y - (h - ovb.height) / 2
      : Math.max(ovb.y, Math.min(y, ovb.y + ovb.height - h))

    return { x: clampedX, y: clampedY }
  }

  private touchDist(a: Touch, b: Touch): number {
    const dx = a.clientX - b.clientX
    const dy = a.clientY - b.clientY
    return Math.sqrt(dx * dx + dy * dy)
  }

  private touchMid(a: Touch, b: Touch): { x: number; y: number } {
    return { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 }
  }
}
