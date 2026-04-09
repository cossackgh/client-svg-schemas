import { Svgic } from 'svgic'
import type { SvgicItem, SvgicStyleConfig } from 'svgic'

// --- data ---

const rooms: SvgicItem[] = [
  { id: 'room-101', title: 'Conference Room A', description: 'Main meeting room with projector and video conferencing', status: 'free', capacity: 12 },
  { id: 'room-102', title: 'Open Space', description: 'Product team workspace', status: 'busy', capacity: 30 },
  { id: 'room-103', title: 'Kitchen', description: 'Break room with coffee machine and fridge', status: 'free', capacity: 20 },
  { id: 'room-201', title: "CEO's Office", description: "CEO's office and reception area", status: 'busy', capacity: 4 },
  { id: 'room-202', title: 'Accounting', description: 'Finance and accounting department', status: 'free', capacity: 8 },
  { id: 'room-203', title: 'Server Room', description: 'Server hardware and network infrastructure', status: 'restricted', capacity: 2 },
]

const byStatus = (status: string) => rooms.filter(r => r.status === status).map(r => r.id)

// --- styling ---

const STYLE_CONFIG: SvgicStyleConfig = {
  default: {
    fill:       '#2d2d52',
    cursor:     'pointer',
    transition: 'fill 0.18s ease, opacity 0.18s ease',
  },
  hover: {
    fill: '#4a4a80',
  },
  highlightedHover: {
    opacity: 0.72,
  },
  states: {
    free:       { fill: '#1a4731', stroke: '#2d9e5a', strokeWidth: 1.5 },
    busy:       { fill: '#4a1e1e', stroke: '#e03030', strokeWidth: 1.5 },
    restricted: { fill: '#3d2a0a', stroke: '#d97706', strokeWidth: 1.5 },
    selected:   { fill: '#0f2a5a', stroke: '#4c8aff', strokeWidth: 2 },
  },
}

// --- UI elements ---

const infoHint  = document.getElementById('info-hint')!
const infoCard  = document.getElementById('info-card')!
const infoTitle = document.getElementById('info-title')!
const infoDesc  = document.getElementById('info-desc')!
const infoId    = document.getElementById('info-id')!
const infoStatus = document.getElementById('info-status')!
const infoCap   = document.getElementById('info-capacity')!
const eventLog  = document.getElementById('event-log')!
const hlButtons = document.querySelectorAll<HTMLButtonElement>('.hl-btn')
const btnClear  = document.getElementById('btn-clear')!

// --- helpers ---

function showInfo(item: SvgicItem | null) {
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

const client = new Svgic('#schema-container', {
  src: '/demo.svg',
  layers: {
    rooms:      { role: 'interactive' },
    background: { role: 'decorative' },
  },
  data: rooms,
  style: STYLE_CONFIG,
})

client.on('hover', (id, item) => {
  if (id) addLog('hover', id, item)
})

client.on('leave', (id, item) => {
  addLog('leave', id, item)
})

client.on('click', (id, item) => {
  if (id) {
    client.setHighlight('selected', [id])
    showInfo(item)
  } else {
    client.clearHighlight('selected')
    showInfo(null)
  }
  addLog('click', id, item)
})

;(window as unknown as Record<string, unknown>).client = client

// --- highlight buttons ---

// Button action mapping: 'all-free' and 'all-busy' show both states simultaneously
const HL_ACTIONS: Record<string, { state: string; ids: string[] }[]> = {
  'free':       [{ state: 'free',       ids: byStatus('free') }],
  'busy':       [{ state: 'busy',       ids: byStatus('busy') }],
  'restricted': [{ state: 'restricted', ids: byStatus('restricted') }],
  'all-free':   [
    { state: 'free',       ids: byStatus('free') },
    { state: 'restricted', ids: byStatus('restricted') },
  ],
  'all-busy':   [
    { state: 'busy',       ids: byStatus('busy') },
    { state: 'restricted', ids: byStatus('restricted') },
  ],
}

hlButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const action = btn.dataset.hl!
    const isActive = btn.classList.contains('active')

    // Reset all buttons and states
    hlButtons.forEach(b => b.classList.remove('active'))
    client.clearHighlight()

    if (!isActive) {
      // Apply selected action
      const mappings = HL_ACTIONS[action] ?? []
      mappings.forEach(({ state, ids }) => client.setHighlight(state, ids))
      btn.classList.add('active')
    }
  })
})

btnClear.addEventListener('click', () => {
  client.clearHighlight()
  hlButtons.forEach(b => b.classList.remove('active'))
})
