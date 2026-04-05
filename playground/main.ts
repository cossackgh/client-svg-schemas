import { Svgic } from 'svgic'
import type { SvgicItem, PopupOption, SvgicStyleConfig } from 'svgic'
import { ZoomPlugin } from 'svgic/plugins/zoom'

// --- данные ---

const rooms: SvgicItem[] = [
  { id: 'room-101', title: 'Переговорная А', description: 'Основная переговорная, оснащена проектором и видеосвязью', status: 'free', capacity: 12 },
  { id: 'room-102', title: 'Опен-спейс', description: 'Рабочее пространство продуктовой команды', status: 'busy', capacity: 30 },
  { id: 'room-103', title: 'Кухня', description: 'Зона отдыха и питания, кофемашина, холодильник', status: 'free', capacity: 20 },
  { id: 'room-201', title: 'Кабинет директора', description: 'Кабинет и приёмная генерального директора', status: 'busy', capacity: 4 },
  { id: 'room-202', title: 'Бухгалтерия', description: 'Финансовый и бухгалтерский отдел', status: 'free', capacity: 8 },
  { id: 'room-203', title: 'Серверная', description: 'Серверное оборудование и сетевая инфраструктура', status: 'restricted', capacity: 2 },
]

// --- popup-режимы ---

type PopupMode = 'element' | 'cursor' | 'target' | 'template' | 'off'

const STATUS_LABELS: Record<string, string> = { free: 'Свободно', busy: 'Занято', restricted: 'Ограничен доступ' }

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
  off:      false,
}

const MODE_HINTS: Record<PopupMode, string> = {
  element:  '',
  cursor:   '',
  target:   '← hover сюда',
  template: '',
  off:      '',
}

// --- стилизация (базовая: default + hover) ---

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

// --- UI-элементы ---

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

// --- состояние ---

let activeId:    string | null = null
let currentMode: PopupMode = 'element'
let client: Svgic

// --- вспомогательные ---

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
  const labels: Record<string, string> = { free: 'Свободно', busy: 'Занято', restricted: 'Ограничен доступ' }
  infoStatus.innerHTML = status
    ? `<span class="status-badge status-${status}">${labels[status] ?? status}</span>`
    : '—'
  infoCap.textContent = item.capacity ? `${item.capacity} чел.` : '—'
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
  const labels: Record<string, string> = { free: 'Свободно', busy: 'Занято', restricted: 'Ограничен доступ' }
  infoStatus.innerHTML = status
    ? `<span class="status-badge status-${status}">${labels[status] ?? status}</span>`
    : '—'
  infoCap.textContent = item.capacity ? `${item.capacity} чел.` : '—'
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

// --- инициализация клиента ---

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
      rooms:      { role: 'interactive' },
      background: { role: 'decorative' },
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

// --- переключение режима ---

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

// --- старт ---

client = createClient(currentMode)
;(window as unknown as Record<string, unknown>).client = client

modeButtons.forEach(btn => {
  btn.addEventListener('click', () => switchMode(btn.dataset.mode as PopupMode))
})
