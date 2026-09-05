import { Svgic } from '@svgic/core'
import type { SvgicItem } from '@svgic/core'
import { ContentPlugin } from '@svgic/core/plugins/content'
import type { ContentCandidate, ContentSlot } from '@svgic/core/plugins/content'

const SVG_NS = 'http://www.w3.org/2000/svg'

const shops: SvgicItem[] = [
  { id: 'sh-l', title: 'Sportmaster' },
  { id: 'sh-u', title: 'Bookstore' },
  { id: 'sh-narrow', title: 'Coffee & Bakery' },
  { id: 'sh-hole', title: 'Electronics Hypermarket' },
  { id: 'sh-wide', title: 'Food Court' },
  { id: 'sh-group', title: 'Pharmacy' },
  // sh-small has no data on purpose — it falls back to the id
]

// --- UI ---

type Mode = 'name' | 'multiline' | 'card'

const modeBtns = document.querySelectorAll<HTMLButtonElement>('[data-mode]')
const clipBtns = document.querySelectorAll<HTMLButtonElement>('[data-clip]')
const gridInput = document.getElementById('grid-input') as HTMLInputElement
const gridValue = document.getElementById('grid-value')!
const eventLog = document.getElementById('event-log')!

let mode: Mode = 'name'
let clip = true
let grid = 24
let client: Svgic | null = null

const log = (message: string): void => {
  const line = document.createElement('div')

  line.className = 'log-entry'
  line.textContent = message
  eventLog.appendChild(line)
  eventLog.scrollTop = eventLog.scrollHeight
}

/** A card built by the host application: a rounded plate with two lines of text */
const renderCard = ({ id, item, rect, fontSize }: ContentSlot): SVGElement => {
  const group = document.createElementNS(SVG_NS, 'g')
  const plate = document.createElementNS(SVG_NS, 'rect')
  const width = Math.max(rect.width, fontSize * 8)
  const height = fontSize * 3.4

  plate.setAttribute('x', String(rect.x + rect.width / 2 - width / 2))
  plate.setAttribute('y', String(rect.y + rect.height / 2 - height / 2))
  plate.setAttribute('width', String(width))
  plate.setAttribute('height', String(height))
  plate.setAttribute('rx', String(fontSize * 0.5))
  plate.setAttribute('fill', '#ffffff')
  plate.setAttribute('stroke', '#90a4ae')
  group.appendChild(plate)

  const title = document.createElementNS(SVG_NS, 'text')

  title.textContent = (item?.title as string) ?? id
  title.setAttribute('x', String(rect.x + rect.width / 2))
  title.setAttribute('y', String(rect.y + rect.height / 2 - fontSize * 0.45))
  title.setAttribute('text-anchor', 'middle')
  title.setAttribute('dominant-baseline', 'central')
  title.setAttribute('font-size', String(fontSize))
  title.setAttribute('font-weight', '600')
  title.setAttribute('fill', '#37474f')
  group.appendChild(title)

  const caption = document.createElementNS(SVG_NS, 'text')

  caption.textContent = id
  caption.setAttribute('x', String(rect.x + rect.width / 2))
  caption.setAttribute('y', String(rect.y + rect.height / 2 + fontSize * 0.75))
  caption.setAttribute('text-anchor', 'middle')
  caption.setAttribute('dominant-baseline', 'central')
  caption.setAttribute('font-size', String(fontSize * 0.7))
  caption.setAttribute('fill', '#78909c')
  group.appendChild(caption)

  return group
}

const CHAINS: Record<Mode, ContentCandidate[]> = {
  // Shop name, and the bare id wherever the name does not fit
  name: [
    { type: 'text', text: ({ item }) => item?.title as string, fill: '#37474f', fontWeight: 600 },
    { type: 'text', text: ({ id }) => id, fill: '#78909c', opacity: 0.8 },
  ],

  // The same names broken into lines: a stack of short lines fits where one long line does not
  multiline: [
    { type: 'text', text: ({ item }) => ((item?.title as string) ?? '').split(' '), fill: '#37474f', fontWeight: 600 },
    { type: 'text', text: ({ id }) => id, fill: '#78909c', opacity: 0.8 },
  ],

  // Composite content: a card the plugin only measures, scales and clips
  card: [
    { type: 'custom', render: renderCard, minScale: 0.45 },
    { type: 'text', text: ({ id }) => id, fill: '#78909c', opacity: 0.8 },
  ],
}

const mount = (): void => {
  client?.destroy()

  client = new Svgic('#schema-container', {
    src: '/content.svg',
    layers: { rooms: { role: 'interactive' }, background: { role: 'data' } },
    data: shops,
    style: {
      default: { cursor: 'pointer', transition: 'fill 0.15s' },
      hover: { fill: '#cfd8dc' },
    },
    plugins: [
      ContentPlugin({
        sourceLayer: 'rooms',
        clip,
        grid,
        content: CHAINS[mode],
      }),
    ],
  })

  client.on('click', (id, item) => {
    log(`click: ${id ?? '—'}${item?.title ? ` (${item.title})` : ''}`)
  })

  log(`mount: mode=${mode} clip=${clip} grid=${grid}`)
}

modeBtns.forEach(button => {
  button.addEventListener('click', () => {
    mode = button.dataset.mode as Mode
    modeBtns.forEach(other => other.classList.toggle('active', other === button))
    mount()
  })
})

clipBtns.forEach(button => {
  button.addEventListener('click', () => {
    clip = button.dataset.clip === 'on'
    clipBtns.forEach(other => other.classList.toggle('active', other === button))
    mount()
  })
})

gridInput.addEventListener('input', () => {
  grid = Number(gridInput.value)
  gridValue.textContent = String(grid)
})

gridInput.addEventListener('change', mount)

mount()
