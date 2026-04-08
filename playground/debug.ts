import { Svgic } from 'svgic'
import type { SvgicItem } from 'svgic'
import { DebugPlugin } from 'svgic/plugins/debug'
import type { DebugPluginOptions } from 'svgic/plugins/debug'

// --- данные ---

const rooms: SvgicItem[] = [
  { id: 'room-101', title: 'Переговорная А',    status: 'free',       capacity: 12 },
  { id: 'room-102', title: 'Опен-спейс',        status: 'busy',       capacity: 30 },
  { id: 'room-103', title: 'Кухня',             status: 'free',       capacity: 20 },
  { id: 'room-201', title: 'Кабинет директора', status: 'busy',       capacity: 4  },
  { id: 'room-202', title: 'Бухгалтерия',       status: 'free',       capacity: 8  },
  { id: 'room-203', title: 'Серверная',         status: 'restricted', capacity: 2  },
]

// --- режимы showOn ---

type ShowOnMode = NonNullable<DebugPluginOptions['showOn']>

const MODE_HINTS: Record<ShowOnMode, string> = {
  hover: 'hover → лейбл появляется / уходит',
  click: 'клик → закрепить · повтор → снять',
  both:  'hover → показать · клик → <em>закрепить</em>',
}

// --- UI ---

const eventLog    = document.getElementById('event-log')!
const modeButtons = document.querySelectorAll<HTMLButtonElement>('.mode-btn')
const modeHint    = document.getElementById('debug-mode-hint')!

function addLog(type: 'click' | 'hover' | 'leave', id: string, item: SvgicItem | null) {
  const el = document.createElement('div')
  el.className = `log-entry ${type}`
  el.textContent = `${type.padEnd(5)}  ${item?.title ?? (id || 'пусто')}`
  const h2 = eventLog.querySelector('h2')!
  h2.after(el)
  const entries = eventLog.querySelectorAll('.log-entry')
  if (entries.length > 30) entries[entries.length - 1].remove()
}

function setModeHint(mode: ShowOnMode) {
  modeHint.innerHTML = MODE_HINTS[mode]
}

// --- клиент ---

let client: Svgic
let currentMode: ShowOnMode = 'hover'

function createClient(mode: ShowOnMode): Svgic {
  const instance = new Svgic('#schema-container', {
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
    plugins: [DebugPlugin({ showOn: mode })],
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
  modeButtons.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode)
  })
}

// --- старт ---

// Поддержка паттерна ?debug в URL — плагин уже подключён всегда на этой странице,
// но демонстрируем как это работает через query-параметр в других проектах.
const params = new URLSearchParams(location.search)
if (params.has('showOn')) {
  const fromUrl = params.get('showOn') as ShowOnMode
  if (['hover', 'click', 'both'].includes(fromUrl)) {
    currentMode = fromUrl
  }
}

client = createClient(currentMode)
setModeHint(currentMode)
modeButtons.forEach(btn => {
  btn.classList.toggle('active', btn.dataset.mode === currentMode)
  btn.addEventListener('click', () => switchMode(btn.dataset.mode as ShowOnMode))
})
