import { Svgic } from 'svgic'
import type { SvgicItem } from 'svgic'
import { DebugPlugin } from 'svgic/plugins/debug'
import type { DebugPluginOptions } from 'svgic/plugins/debug'

// --- data (room-203 intentionally missing — demo for "no data") ---

const rooms: SvgicItem[] = [
  { id: 'room-101', title: 'Conference Room A', status: 'free',       capacity: 12 },
  { id: 'room-102', title: 'Open Space',        status: 'busy',       capacity: 30 },
  { id: 'room-103', title: 'Kitchen',           status: 'free',       capacity: 20 },
  { id: 'room-201', title: "CEO's Office",      status: 'busy',       capacity: 4  },
  { id: 'room-202', title: 'Accounting',        status: 'free',       capacity: 8  },
  // room-203 not added to data — hover over "Server Room" to see ⚠ no data
]

// --- showOn modes ---

type ShowOnMode = NonNullable<DebugPluginOptions['showOn']>

const MODE_HINTS: Record<ShowOnMode, string> = {
  hover: 'hover → label appears / disappears',
  click: 'click → pin · repeat → unpin',
  both:  'hover → show · click → <em>pin</em>',
}

// --- UI ---

const eventLog    = document.getElementById('event-log')!
const modeButtons = document.querySelectorAll<HTMLButtonElement>('.mode-btn[data-mode]')
const renderBtns  = document.querySelectorAll<HTMLButtonElement>('.mode-btn[data-render]')
const modeHint    = document.getElementById('debug-mode-hint')!

function addLog(type: 'click' | 'hover' | 'leave', id: string, item: SvgicItem | null) {
  const el = document.createElement('div')
  el.className = `log-entry ${type}`
  el.textContent = `${type.padEnd(5)}  ${item?.title ?? (id || 'empty')}`
  const h2 = eventLog.querySelector('h2')!
  h2.after(el)
  const entries = eventLog.querySelectorAll('.log-entry')
  if (entries.length > 30) entries[entries.length - 1].remove()
}

function setModeHint(mode: ShowOnMode) {
  modeHint.innerHTML = MODE_HINTS[mode]
}

// --- custom render: shows status and capacity from data ---

function customRender(id: string, item: SvgicItem | null): string {
  if (!item) return `<b style="color:#7dd3fc">${id}</b> <span style="color:#f87171">⚠ no data</span>`
  const status = item.status as string | undefined
  const cap    = item.capacity as number | undefined
  return [
    `<b style="color:#7dd3fc">${id}</b>`,
    item.title ? `<span style="color:#94a3b8">${item.title}</span>` : '',
    status     ? `<span style="color:#64748b">${status}</span>` : '',
    cap        ? `<span style="color:#475569">${cap} people</span>` : '',
  ].filter(Boolean).join('<span style="color:#334155"> · </span>')
}

// --- client ---

let client: Svgic
let currentMode: ShowOnMode = 'hover'
let useCustomRender = false

function createClient(mode: ShowOnMode): Svgic {
  const instance = new Svgic('#schema-container', {
    src: '/demo.svg',
    layers: {
      rooms: { role: 'interactive' },
    },
    data: rooms,
    style: {
      default: { fill: '#2d2d52', cursor: 'pointer', transition: 'fill 0.18s ease' },
      hover:   { fill: '#4a4a80' },
    },
    plugins: [DebugPlugin({
      showOn: mode,
      render: useCustomRender ? customRender : undefined,
    })],
  })

  instance.on('hover', (id, item) => { if (id) addLog('hover', id, item) })
  instance.on('leave', (id, item) => { addLog('leave', id, item) })
  instance.on('click', (id, item) => { addLog('click', id, item) })

  return instance
}

function switchMode(mode: ShowOnMode) {
  currentMode = mode
  client.destroy()
  client = createClient(mode)
  setModeHint(mode)
  modeButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.mode === mode))
}

function switchRender(custom: boolean) {
  useCustomRender = custom
  client.destroy()
  client = createClient(currentMode)
  renderBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.render === (custom ? 'custom' : 'default')))
}

// --- start ---

const params = new URLSearchParams(location.search)
if (params.has('showOn')) {
  const fromUrl = params.get('showOn') as ShowOnMode
  if (['hover', 'click', 'both'].includes(fromUrl)) currentMode = fromUrl
}

client = createClient(currentMode)
setModeHint(currentMode)

modeButtons.forEach(btn => {
  btn.classList.toggle('active', btn.dataset.mode === currentMode)
  btn.addEventListener('click', () => switchMode(btn.dataset.mode as ShowOnMode))
})

renderBtns.forEach(btn => {
  btn.classList.toggle('active', btn.dataset.render === 'default')
  btn.addEventListener('click', () => switchRender(btn.dataset.render === 'custom'))
})
