import { Svgic } from 'svgic'
import type { SvgicItem, PopupOption, SvgicStyleConfig } from 'svgic'
import { ZoomPlugin } from 'svgic/plugins/zoom'

// --- data ---

const rooms: SvgicItem[] = [
  { id: 'room-101', title: 'Conference Room A', description: 'Main meeting room with projector and video conferencing', status: 'free', capacity: 12 },
  { id: 'room-102', title: 'Open Space', description: 'Product team workspace', status: 'busy', capacity: 30 },
  { id: 'room-103', title: 'Kitchen', description: 'Break room with coffee machine and fridge', status: 'free', capacity: 20 },
  { id: 'room-201', title: "CEO's Office", description: "CEO's office and reception area", status: 'busy', capacity: 4 },
  { id: 'room-202', title: 'Accounting', description: 'Finance and accounting department', status: 'free', capacity: 8 },
  { id: 'room-203', title: 'Server Room', description: 'Server hardware and network infrastructure', status: 'restricted', capacity: 2 },
]

// --- popup modes ---

type PopupMode = 'element' | 'cursor' | 'target' | 'template' | 'click' | 'interactive' | 'off'

const STATUS_LABELS: Record<string, string> = { free: 'Available', busy: 'Occupied', restricted: 'Restricted' }

const POPUP_CONFIGS: Record<PopupMode, PopupOption> = {
  element:  { placement: 'element', anchor: 'top-center', flip: true },
  cursor:   { placement: 'cursor', offset: { x: 16, y: 16 } },
  target:   { placement: 'target', target: '#info-panel' },
  template: {
    placement: 'cursor',
    offset: { x: 16, y: 16 },
    template: '#room-popup-tpl',
    bind(el, item) {
      el.querySelector('.room-popup__title')!.textContent = item.title ?? item.id
      el.querySelector('.room-popup__desc')!.textContent = (item.description as string) ?? ''
      const statusEl = el.querySelector('.room-popup__status')!
      const status = item.status as string | undefined
      statusEl.textContent = status ? STATUS_LABELS[status] ?? status : ''
      statusEl.className = `room-popup__status${status ? ` ${status}` : ''}`
    },
  },
  click: {
    placement: 'element',
    anchor: 'top-center',
    flip: true,
    trigger: 'click',
  },
  interactive: {
    placement: 'element',
    anchor: 'top-center',
    flip: true,
    interactive: true,
    render(item) {
      const el = document.createElement('div')
      el.className = 'interactive-popup'
      const title = document.createElement('div')
      title.className = 'interactive-popup__title'
      title.textContent = item.title ?? item.id
      const link = document.createElement('a')
      link.className = 'interactive-popup__link'
      link.href = '#'
      link.textContent = 'Details →'
      link.addEventListener('click', e => {
        e.preventDefault()
        showInfo(item)
      })
      el.append(title, link)
      return el
    },
  },
  off:      false,
}

const MODE_HINTS: Record<PopupMode, string> = {
  element:     '',
  cursor:      '',
  target:      '← hover here',
  template:    '',
  click:       'trigger: click',
  interactive: 'interactive: true',
  off:         '',
}

// --- styling (basic: default + hover) ---

const STYLE_CONFIG: SvgicStyleConfig = {
  default: {
    fill:       '#2d2d52',
    cursor:     'pointer',
    transition: 'fill 0.18s ease',
  },
  hover: {
    fill: '#4a4a80',
  },
}

// --- UI elements ---

const infoHint      = document.getElementById('info-hint')!
const infoCard      = document.getElementById('info-card')!
const infoTitle     = document.getElementById('info-title')!
const infoDesc      = document.getElementById('info-desc')!
const infoId        = document.getElementById('info-id')!
const infoStatus    = document.getElementById('info-status')!
const infoCap       = document.getElementById('info-capacity')!
const eventLog      = document.getElementById('event-log')!
const infoPanelMode = document.getElementById('info-panel-mode')!
const modeButtons   = document.querySelectorAll<HTMLButtonElement>('.mode-btn')

// --- state ---

let activeId:    string | null = null
let currentMode: PopupMode = 'element'
let client: Svgic

// --- helpers ---

function showInfo(item: SvgicItem | null) {
  if (currentMode === 'target') return

  if (!item) {
    infoCard.classList.remove('visible')
    infoHint.style.display = ''
    return
  }
  infoHint.style.display = 'none'
  infoCard.classList.add('visible')
  infoTitle.textContent = item.title ?? item.id
  infoDesc.textContent  = (item.description as string) ?? ''
  infoId.textContent    = item.id

  const status = item.status as string | undefined
  const labels: Record<string, string> = { free: 'Available', busy: 'Occupied', restricted: 'Restricted' }
  infoStatus.innerHTML = status
    ? `<span class="status-badge status-${status}">${labels[status] ?? status}</span>`
    : '—'
  infoCap.textContent = item.capacity ? `${item.capacity} people` : '—'
}

function showInfoForTarget(item: SvgicItem | null) {
  if (!item) {
    infoCard.classList.remove('visible')
    infoHint.style.display = ''
    return
  }
  infoHint.style.display = 'none'
  infoCard.classList.add('visible')
  infoTitle.textContent = item.title ?? item.id
  infoDesc.textContent  = (item.description as string) ?? ''
  infoId.textContent    = item.id

  const status = item.status as string | undefined
  const labels: Record<string, string> = { free: 'Available', busy: 'Occupied', restricted: 'Restricted' }
  infoStatus.innerHTML = status
    ? `<span class="status-badge status-${status}">${labels[status] ?? status}</span>`
    : '—'
  infoCap.textContent = item.capacity ? `${item.capacity} people` : '—'
}

function addLog(type: 'click' | 'hover' | 'leave', id: string, item: SvgicItem | null) {
  const el = document.createElement('div')
  el.className = `log-entry ${type}`
  el.textContent = `${type.padEnd(5)}  ${item?.title ?? (id || 'empty')}`
  const h2 = eventLog.querySelector('h2')!
  h2.after(el)
  const entries = eventLog.querySelectorAll('.log-entry')
  if (entries.length > 30) entries[entries.length - 1].remove()
}

// --- client initialization ---

function createClient(mode: PopupMode): Svgic {
  const zoom = ZoomPlugin({
    wheelMode: 'ctrl',
    focusOnClick: false,
    minScale: 0.5,
    maxScale: 8,
  })
  ;(window as unknown as Record<string, unknown>).zoom = zoom

  const instance = new Svgic('#schema-container', {
    src: '/demo.svg',
    layers: {
      rooms: { role: 'interactive' },
    },
    data: rooms,
    popup: POPUP_CONFIGS[mode],
    style: STYLE_CONFIG,
    plugins: [zoom],
  })

  instance.on('hover', (id, item) => {
    if (id) addLog('hover', id, item)
  })

  instance.on('leave', (id, item) => {
    addLog('leave', id, item)
    if (currentMode === 'target') {
      showInfoForTarget(activeId ? (rooms.find(r => r.id === activeId) ?? null) : null)
    }
  })

  instance.on('click', (id, item) => {
    activeId = id || null
    showInfo(item)
    addLog('click', id, item)
  })

  return instance
}

// --- mode switching ---

function switchMode(mode: PopupMode) {
  currentMode = mode
  activeId = null

  client.destroy()
  client = createClient(mode)
  ;(window as unknown as Record<string, unknown>).client = client

  infoPanelMode.textContent = MODE_HINTS[mode]

  if (mode !== 'target') {
    infoCard.classList.remove('visible')
    infoHint.style.display = ''
  }

  modeButtons.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode)
  })
}

// --- start ---

client = createClient(currentMode)
;(window as unknown as Record<string, unknown>).client = client

modeButtons.forEach(btn => {
  btn.addEventListener('click', () => switchMode(btn.dataset.mode as PopupMode))
})
