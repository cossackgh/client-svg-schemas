import { describe, it, expect, vi, beforeEach } from 'vitest'
import { loadSvg } from '../src/core/loader'

const VALID_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect id="room-1" x="10" y="10" width="80" height="80" fill="red"/>
</svg>`

const INVALID_SVG = `<not-svg><garbage></not-svg>`

describe('loadSvg — SVG string', () => {
  it('parses valid SVG from string', async () => {
    const el = await loadSvg(VALID_SVG)
    expect(el).toBeInstanceOf(SVGSVGElement)
    expect(el.querySelector('#room-1')).not.toBeNull()
  })

  it('throws on invalid SVG', async () => {
    // DOMParser does not throw on parse, but root element will not be SVGSVGElement
    await expect(loadSvg(INVALID_SVG)).rejects.toThrow('[svgic]')
  })

  it('detects string with leading whitespace', async () => {
    const el = await loadSvg(`   ${VALID_SVG}`)
    expect(el).toBeInstanceOf(SVGSVGElement)
  })
})

describe('loadSvg — URL (fetch)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('loads SVG from URL', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'image/svg+xml' },
      text: () => Promise.resolve(VALID_SVG),
    }))

    const el = await loadSvg('/demo.svg')
    expect(el).toBeInstanceOf(SVGSVGElement)
    expect(fetch).toHaveBeenCalledWith('/demo.svg', expect.objectContaining({ signal: expect.any(AbortSignal) }))
  })

  it('throws on HTTP 404', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      headers: { get: () => null },
    }))

    await expect(loadSvg('/missing.svg')).rejects.toThrow('404')
  })

  it('throws on unexpected content-type', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/octet-stream' },
      text: () => Promise.resolve(VALID_SVG),
    }))

    await expect(loadSvg('/file.bin')).rejects.toThrow('content-type')
  })
})
