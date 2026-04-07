import { Svgic } from 'svgic'
import type { SvgicItem } from 'svgic'
import { ZoomPlugin } from 'svgic/plugins/zoom'
import type { ZoomPluginInstance } from 'svgic/plugins/zoom'

const rooms: SvgicItem[] = [
  { id: 'room-101', title: 'Переговорная А' },
  { id: 'room-102', title: 'Опен-спейс' },
  { id: 'room-103', title: 'Кухня' },
  { id: 'room-201', title: 'Кабинет директора' },
  { id: 'room-202', title: 'Бухгалтерия' },
  { id: 'room-203', title: 'Серверная' },
]

// --- UI ---

const stateScale  = document.getElementById('state-scale')!
const stateX      = document.getElementById('state-x')!
const stateY      = document.getElementById('state-y')!
const eventLog    = document.getElementById('event-log')!
const wheelBtns   = document.querySelectorAll<HTMLButtonElement>('[data-wheel]')
const focusBtns   = document.querySelectorAll<HTMLButtonElement>('[data-focus]')

// --- state ---

let wheelMode: 'ctrl' | 'free' = 'ctrl'
let focusOnClick = false
let zoom: ZoomPluginInstance
let client: Svgic

// --- helpers ---

function updateState() {
  if (!zoom) return
  const s = zoom.getState()
  stateScale.textContent = s.scale.toFixed(2)
  stateX.textContent     = s.x.toFixed(1)
  stateY.textContent     = s.y.toFixed(1)
}

function addLog(type: 'click' | 'hover' | 'leave', id: string, item: SvgicItem | null) {
  const el = document.createElement('div')
  el.className = `log-entry ${type}`
  el.textContent = `${type.padEnd(5)}  ${item?.title ?? (id || 'пусто')}`
  const h2 = eventLog.querySelector('h2')!
  h2.after(el)
  const entries = eventLog.querySelectorAll('.log-entry')
  if (entries.length > 30) entries[entries.length - 1].remove()
}

// --- client ---

function createClient() {
  zoom = ZoomPlugin({
    wheelMode,
    focusOnClick,
    minScale: 0.3,
    maxScale: 10,
    focusScale: 3,
    animate: true,
  })

  client = new Svgic('#schema-container', {
    src: '/demo.svg',
    layers: {
      rooms:      { role: 'interactive' },
      background: { role: 'decorative' },
    },
    data: rooms,
    style: {
      default: { fill: '#2d2d52', cursor: 'pointer', transition: 'fill 0.18s ease' },
      hover:   { fill: '#4a4a80' },
    },
    plugins: [zoom],
  })

  client.ready.then(() => updateState())

  client.on('click', (id, item) => {
    updateState()
    if (id) addLog('click', id, item)
  })
  client.on('hover', (id, item) => {
    if (id) addLog('hover', id, item)
  })
  client.on('leave', (id, item) => {
    addLog('leave', id, item)
  })

  // Обновляем state при каждом изменении viewBox
  const svgEl = document.querySelector('#schema-container svg')
  if (svgEl) {
    svgEl.addEventListener('svgic:viewchange', () => updateState())
  } else {
    client.ready.then(() => {
      client.getElement()?.addEventListener('svgic:viewchange', () => updateState())
    })
  }

  ;(window as unknown as Record<string, unknown>).zoom   = zoom
  ;(window as unknown as Record<string, unknown>).client = client
}

// --- кнопки управления ---

document.getElementById('btn-zoom-in')!.addEventListener('click', () => {
  zoom.zoomTo(zoom.getState().scale * 1.5)
  updateState()
})
document.getElementById('btn-zoom-out')!.addEventListener('click', () => {
  zoom.zoomTo(zoom.getState().scale / 1.5)
  updateState()
})
document.getElementById('btn-reset')!.addEventListener('click', () => {
  zoom.reset()
  updateState()
})
document.getElementById('btn-focus-101')!.addEventListener('click', () => {
  zoom.focusElement('room-101', { scale: 3 })
})
document.getElementById('btn-focus-203')!.addEventListener('click', () => {
  zoom.focusElement('room-203', { scale: 3 })
})

// --- переключатели ---

wheelBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    wheelMode = btn.dataset.wheel as 'ctrl' | 'free'
    wheelBtns.forEach(b => b.classList.toggle('active', b === btn))
    client.destroy()
    createClient()
  })
})

focusBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    focusOnClick = btn.dataset.focus === 'on'
    focusBtns.forEach(b => b.classList.toggle('active', b === btn))
    client.destroy()
    createClient()
  })
})

// --- старт ---

createClient()
