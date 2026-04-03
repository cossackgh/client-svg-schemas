import type { SvgicOptions, SvgicPlugin } from '../types'

export class Svgic {
  private container: Element
  private options: SvgicOptions
  private plugins: SvgicPlugin[] = []

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
    this.plugins = []
  }

  private async init(): Promise<void> {
    // TODO: загрузить SVG, парсить слои, привязать данные
    this.plugins.forEach(p => p.onInit?.(this))
  }
}
