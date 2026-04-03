import type { SvgicOptions, SvgicPlugin } from '../types'
import { loadSvg } from './loader'

export class Svgic {
  private container: Element
  private options: SvgicOptions
  private plugins: SvgicPlugin[] = []
  private svgEl: SVGSVGElement | null = null

  constructor(selector: string | Element, options: SvgicOptions) {
    const container = typeof selector === 'string'
      ? document.querySelector(selector)
      : selector

    if (!container) {
      throw new Error(`[svgic] Container not found: ${selector}`)
    }

    this.container = container
    this.options = options

    if (options.plugins) {
      options.plugins.forEach(p => this.use(p))
    }

    this.init()
  }

  use(plugin: SvgicPlugin): this {
    this.plugins.push(plugin)
    return this
  }

  on(_event: string, _handler: (...args: unknown[]) => void): this {
    // TODO: реализовать event emitter
    return this
  }

  destroy(): void {
    this.container.innerHTML = ''
    this.svgEl = null
    this.plugins.forEach(p => p.onDestroy?.(this))
    this.plugins = []
  }

  private async init(): Promise<void> {
    this.svgEl = await loadSvg(this.options.src)
    this.container.appendChild(this.svgEl)
    // TODO: парсить слои, привязать данные
    this.plugins.forEach(p => p.onInit?.(this))
  }
}
