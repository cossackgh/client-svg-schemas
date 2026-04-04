import { describe, it, expect, vi, beforeEach } from 'vitest'
import { loadSvg } from '../src/core/loader'

const VALID_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect id="room-1" x="10" y="10" width="80" height="80" fill="red"/>
</svg>`

const INVALID_SVG = `<not-svg><garbage></not-svg>`

describe('loadSvg — SVG-строка', () => {
  it('парсит валидный SVG из строки', async () => {
    const el = await loadSvg(VALID_SVG)
    expect(el).toBeInstanceOf(SVGSVGElement)
    expect(el.querySelector('#room-1')).not.toBeNull()
  })

  it('бросает ошибку при невалидном SVG', async () => {
    // DOMParser не кидает при парсинге, но root-элемент будет не SVGSVGElement
    await expect(loadSvg(INVALID_SVG)).rejects.toThrow('[svgic]')
  })

  it('определяет строку с пробелами в начале', async () => {
    const el = await loadSvg(`   ${VALID_SVG}`)
    expect(el).toBeInstanceOf(SVGSVGElement)
  })
})

describe('loadSvg — URL (fetch)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('загружает SVG по URL', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'image/svg+xml' },
      text: () => Promise.resolve(VALID_SVG),
    }))

    const el = await loadSvg('/demo.svg')
    expect(el).toBeInstanceOf(SVGSVGElement)
    expect(fetch).toHaveBeenCalledWith('/demo.svg')
  })

  it('бросает ошибку при HTTP 404', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      headers: { get: () => null },
    }))

    await expect(loadSvg('/missing.svg')).rejects.toThrow('404')
  })

  it('бросает ошибку при неожиданном content-type', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/octet-stream' },
      text: () => Promise.resolve(VALID_SVG),
    }))

    await expect(loadSvg('/file.bin')).rejects.toThrow('content-type')
  })
})
